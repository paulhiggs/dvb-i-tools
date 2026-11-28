/**
 * markets.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * The markets: the settings of a market deployment (such as Germany) that a validation can be made for, instead of the A177
 * baseline (issue #119). They are defined in res/markets.json, which is loaded once, checked and frozen. A validation is
 * made for one market or none (ValidationRequest.market), and the settings that apply to a document are those of its A177
 * revision (currentMarket() in safe_fetch.mts)
 */

import { existsSync } from "fs"
import { join } from "path"

import chalk from "chalk"
import fetchS from "sync-fetch"
import { XmlDocument } from "libxml2-wasm"

import { A177Revision } from "./revisions.mts"
import { dvbi } from "./DVB-I_definitions.mts"
import { Markets, schemaURL, schemasPath } from "./data_locations.mts"
import { fetch_options } from "./globals.mts"
import type { LoadOptions } from "./globals.mts"
import { readmyfile } from "./utils.mts"

// initialise string formatting extensions
import {} from "./string-extensions.mts"

// a schema that a market uses instead of the one of A177, for the documents of one revision
export type MarketSchema = Readonly<{ filename: string; schema: XmlDocument }>;

// the values that a market can change. MARKET_DEFAULTS has those of A177
export type MarketParameters = {
	schedule: {
		daysEitherSide: number; // the days of programme guide needed before and after today (issue #122)
	};
	lcn: {
		min: number; // the lowest channel number of an LCN table (LCN@channelNumber, LCNRange@start/@end)
		max: number; // the highest
	};
	postcode: {
		digits?: number; // the number of digits of every postcode of the market's regions (none in A177)
	};
};

// the kinds of image a market can stipulate a size for (decision 11 of issue #119), by their HowRelated
export const IMAGE_KINDS = ["serviceListLogo", "serviceLogo", "contentGuideSourceLogo", "promotionalStillImage"] as const;
export type MarketImageKind = (typeof IMAGE_KINDS)[number];
// what a market stipulates for a kind of image: its exact width, and optionally height (decision 27), and the largest file
// size it recommends (decision 28)
export type MarketImage = Readonly<{ width?: number; height?: number; maxBytes?: number }>;
const IMAGE_KEYS = ["width", "height", "maxBytes"];

// the rules a market can enable, each with its own codes (market_checks.mts)
export const MARKET_RULES = ["serviceLogoRequired", "dvbsDirectTuning"] as const;
export type MarketRule = (typeof MARKET_RULES)[number];

// the severity a market gives a code instead of A177's: "suppressed" for findings that are listed, marked as suppressed by
// the market, but not counted as errors, warnings or information, or "off" for findings that do not apply to the market
// (they are not reported at all)
export type MarketSeverity = "error" | "warning" | "information" | "suppressed" | "off";
export const MARKET_SEVERITIES: readonly MarketSeverity[] = ["error", "warning", "information", "suppressed", "off"];

/**
 * the codes whose severity a market cannot change (decision 20 of issue #119): a document that cannot be parsed (fatal), and
 * the XSD validation, whose findings all have one code for each type of document. A market relaxes a schema rule with its
 * own schema instead. Each is the code given to SchemaLoad() or SchemaCheck(), which add suffixes to it (SL001-1, SL005:8)
 */
export const NOT_OVERRIDABLE: readonly string[] = ["SL001", "SR001", "CG001", "PL001", "AIT001", "SL005", "SR005", "CG003", "PL005", "AIT005", "MKT001"];

// a severity key: a code (SL264), which starts with the letters and 3 digits that every code has, or a prefix of codes
// followed by * (SI020-1-*, SL24*), which has at least the letters and one digit
const SEVERITY_KEY = /^[A-Z]{2,6}[0-9]{3}[A-Za-z0-9:._-]*$/,
	SEVERITY_PREFIX_KEY = /^[A-Z]{2,6}[0-9][A-Za-z0-9:._-]*\*$/;

// the settings for the documents of one A177 revision
export type MarketSettings = Readonly<{
	market?: string; // the id of the market, or undefined for the A177 baseline
	schemas: Readonly<{ serviceList?: MarketSchema; serviceListRegistry?: MarketSchema }>;
	parameters: Readonly<{ [P in keyof MarketParameters]: Readonly<MarketParameters[P]> }>;
	severity: Readonly<Record<string, MarketSeverity>>; // the severity of codes, by code or prefix* (see marketSeverity())
	images: Readonly<Partial<Record<MarketImageKind, MarketImage>>>; // what the market stipulates for each kind of image
	rules: Readonly<Partial<Record<MarketRule, boolean>>>; // the rules the market enables
}>;

// the A177 baseline: no market. A market file holds only what a market changes
export const MARKET_DEFAULTS: MarketSettings = deepFreeze({
	market: undefined,
	schemas: {},
	parameters: {
		schedule: { daysEitherSide: 28 },
		lcn: { min: dvbi.MIN_LCN, max: dvbi.MAX_LCN }, // A177 table 23
		postcode: {}, // A177 permits any postcode format
	},
	severity: {},
	images: {},
	rules: {},
});

export type Market = Readonly<{
	id: string;
	name: string;
	description?: string;
	permitted?: readonly A177Revision[]; // the A177 revisions the market permits, in order (decision 29), or undefined for all
	permits: (revision: A177Revision) => boolean;
	settings: (revision: A177Revision) => MarketSettings;
}>;

// a markets file that cannot be used: the start-up stops
export class MarketsError extends Error {}

// the checks of the values of each parameter
const positiveWholeNumber = (value: unknown): string | undefined =>
	typeof value == "number" && Number.isInteger(value) && value > 0 ? undefined : "must be a positive whole number";
const PARAMETER_CHECKS: { [P in keyof MarketParameters]: { [Q in keyof MarketParameters[P]]: (value: unknown) => string | undefined } } = {
	schedule: { daysEitherSide: positiveWholeNumber },
	lcn: { min: positiveWholeNumber, max: positiveWholeNumber },
	postcode: { digits: positiveWholeNumber },
};
const SCHEMA_KINDS = ["serviceList", "serviceListRegistry"] as const;

const MARKET_KEYS = ["id", "name", "description", "permitted", "revisions"],
	RANGE_KEYS = ["from", "to", "schemas", "parameters", "severity", "images", "rules"];

const isObject = (value: unknown): value is Record<string, unknown> => typeof value == "object" && value != null && !Array.isArray(value);

function deepFreeze<T>(value: T): T {
	if (typeof value == "object" && value != null && !(value instanceof XmlDocument)) {
		Object.values(value).forEach((v) => deepFreeze(v));
		Object.freeze(value);
	}
	return value;
}

// the revision named in a market's range: r0 ... r8, or latest
function revisionNamed(name: unknown): A177Revision | undefined {
	if (name == "latest") return A177Revision.latest;
	return A177Revision.all.find((r) => name == `r${r.level}`);
}

/**
 * check the markets of a markets file and build them. The XSD files they name are loaded
 *
 * @param {string} text    the content of the markets file: a JSON array of markets
 * @param {string} source  where it came from, for the messages
 * @returns {Market[]} the markets
 * @throws {MarketsError} listing every problem found
 */
export function parseMarkets(text: string, source: string): readonly Market[] {
	const problems: string[] = [];
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch (err) {
		throw new MarketsError(`${source}: not valid JSON: ${(err as Error).message}`);
	}
	if (!Array.isArray(data)) throw new MarketsError(`${source}: must be an array of markets`);

	const schemas = new Map<string, MarketSchema>();
	const loadSchema = (file: string, where: string): MarketSchema | undefined => {
		const filename = join(schemasPath, file);
		if (!schemas.has(filename)) {
			const buf = existsSync(filename) ? (readmyfile(filename, {}) as Buffer | null) : null;
			if (!buf) {
				problems.push(`${where}: the schema ${file.quote()} is not in ${schemasPath}`);
				return undefined;
			}
			schemas.set(filename, Object.freeze({ filename, schema: XmlDocument.fromBuffer(buf, { url: schemaURL(filename) }) }));
		}
		return schemas.get(filename);
	};

	const ids = new Set<string>();
	const markets = data.map((m: unknown, i: number): Market | undefined => {
		let where = `${source}: market ${i + 1}`;
		if (!isObject(m)) {
			problems.push(`${where} is not an object`);
			return undefined;
		}
		if (typeof m.id != "string" || !/^[A-Za-z0-9_-]+$/.test(m.id)) problems.push(`${where}: id must be letters, digits, - or _`);
		else {
			where = `${source}: market ${m.id.quote()}`;
			if (ids.has(m.id.toLowerCase())) problems.push(`${where} is defined more than once`);
			ids.add(m.id.toLowerCase());
		}
		Object.keys(m)
			.filter((k) => !MARKET_KEYS.includes(k))
			.forEach((k) => problems.push(`${where}: unknown property ${k.quote()}`));
		if (typeof m.name != "string" || m.name.length == 0) problems.push(`${where}: name must be given`);
		if (m.description != undefined && typeof m.description != "string") problems.push(`${where}: description must be text`);
		// the revisions the market permits: a list of revision names, or every revision when there is none
		let permitted: A177Revision[] | undefined = undefined;
		if (m.permitted != undefined) {
			if (!Array.isArray(m.permitted) || m.permitted.length == 0) problems.push(`${where}: permitted must be a list of A177 revisions`);
			else {
				const revisions = m.permitted.map((name: unknown) => {
					const revision = revisionNamed(name);
					if (!revision) problems.push(`${where}: permitted revision ${JSON.stringify(name)} is not a revision of A177 (r0 to r${A177Revision.latest.level}, or latest)`);
					return revision;
				});
				permitted = A177Revision.all.filter((r) => revisions.includes(r));
			}
		}
		if (!Array.isArray(m.revisions) || m.revisions.length == 0) {
			problems.push(`${where}: revisions must be a list of revision ranges`);
			return undefined;
		}

		// the settings of each range, in the order they are listed
		type Range = {
			from: A177Revision;
			to: A177Revision;
			schemas: Record<string, MarketSchema>;
			parameters: Record<string, Record<string, unknown>>;
			severity: Record<string, MarketSeverity>;
			images: Record<string, MarketImage>;
			rules: Record<string, boolean>;
		};
		const ranges: Range[] = [];
		m.revisions.forEach((r: unknown, j: number) => {
			const rwhere = `${where}, revision range ${j + 1}`;
			if (!isObject(r)) {
				problems.push(`${rwhere} is not an object`);
				return;
			}
			Object.keys(r)
				.filter((k) => !RANGE_KEYS.includes(k))
				.forEach((k) => problems.push(`${rwhere}: unknown property ${k.quote()}`));
			const from = revisionNamed(r.from),
				to = revisionNamed(r.to);
			if (!from) problems.push(`${rwhere}: from must be a revision of A177 (r0 to r${A177Revision.latest.level}, or latest)`);
			if (!to) problems.push(`${rwhere}: to must be a revision of A177 (r0 to r${A177Revision.latest.level}, or latest)`);
			if (from && to && from > to) problems.push(`${rwhere}: from is after to`);
			else if (from && to && permitted && !permitted.some((p) => from <= p && p <= to)) problems.push(`${rwhere}: includes no revision that the market permits`);

			const range: Range = { from: from ?? A177Revision.unknown, to: to ?? A177Revision.unknown, schemas: {}, parameters: {}, severity: {}, images: {}, rules: {} };
			if (r.schemas != undefined) {
				if (!isObject(r.schemas)) problems.push(`${rwhere}: schemas must be an object`);
				else
					Object.entries(r.schemas).forEach(([kind, file]) => {
						if (!(SCHEMA_KINDS as readonly string[]).includes(kind)) problems.push(`${rwhere}: unknown schema ${kind.quote()}`);
						else if (typeof file != "string" || file.length == 0) problems.push(`${rwhere}: schema ${kind.quote()} must be a file name`);
						else {
							const schema = loadSchema(file, rwhere);
							if (schema) range.schemas[kind] = schema;
						}
					});
			}
			if (r.parameters != undefined) {
				if (!isObject(r.parameters)) problems.push(`${rwhere}: parameters must be an object`);
				else
					Object.entries(r.parameters).forEach(([group, values]) => {
						const checks = (PARAMETER_CHECKS as Record<string, Record<string, (value: unknown) => string | undefined>>)[group];
						if (!checks) problems.push(`${rwhere}: unknown parameter ${group.quote()}`);
						else if (!isObject(values)) problems.push(`${rwhere}: parameter ${group.quote()} must be an object`);
						else
							Object.entries(values).forEach(([name, value]) => {
								const check = checks[name];
								const problem = check ? check(value) : "is not a parameter";
								if (problem) problems.push(`${rwhere}: ${`${group}.${name}`.quote()} ${problem}`);
								else (range.parameters[group] ??= {})[name] = value;
							});
					});
			}
			if (r.severity != undefined) {
				if (!isObject(r.severity)) problems.push(`${rwhere}: severity must be an object`);
				else
					Object.entries(r.severity).forEach(([key, value]) => {
						const code = key.endsWith("*") ? key.slice(0, -1) : key;
						if (!(key.endsWith("*") ? SEVERITY_PREFIX_KEY : SEVERITY_KEY).test(key)) problems.push(`${rwhere}: severity ${key.quote()} is not a code, or a prefix of codes followed by *`);
						else if (NOT_OVERRIDABLE.some((c) => (key.endsWith("*") && c.startsWith(code)) || (code.startsWith(c) && !/[0-9]/.test(code.charAt(c.length)))))
							problems.push(`${rwhere}: the severity of ${key.quote()} cannot be changed (a fatal or XSD finding)`);
						else if (!(MARKET_SEVERITIES as readonly unknown[]).includes(value))
							problems.push(`${rwhere}: severity ${key.quote()} must be one of ${MARKET_SEVERITIES.map((s) => s.quote()).join(", ")}`);
						else range.severity[key] = value as MarketSeverity;
					});
			}
			if (r.images != undefined) {
				if (!isObject(r.images)) problems.push(`${rwhere}: images must be an object`);
				else
					Object.entries(r.images).forEach(([kind, value]) => {
						const iwhere = `${rwhere}: image ${kind.quote()}`;
						if (!(IMAGE_KINDS as readonly string[]).includes(kind)) problems.push(`${rwhere}: unknown kind of image ${kind.quote()}`);
						else if (!isObject(value)) problems.push(`${iwhere} must be an object`);
						else {
							const unknown = Object.keys(value).filter((k) => !IMAGE_KEYS.includes(k));
							unknown.forEach((k) => problems.push(`${iwhere}: unknown property ${k.quote()}`));
							const bad = IMAGE_KEYS.filter((k) => value[k] != undefined && positiveWholeNumber(value[k]));
							bad.forEach((k) => problems.push(`${iwhere}: ${k} must be a positive whole number`));
							if (value.height != undefined && value.width == undefined) problems.push(`${iwhere}: a height needs a width`);
							else if (value.width == undefined && value.maxBytes == undefined) problems.push(`${iwhere}: needs a width or maxBytes`);
							else if (unknown.length == 0 && bad.length == 0) range.images[kind] = value as MarketImage;
						}
					});
			}
			if (r.rules != undefined) {
				if (!isObject(r.rules)) problems.push(`${rwhere}: rules must be an object`);
				else
					Object.entries(r.rules).forEach(([rule, value]) => {
						if (!(MARKET_RULES as readonly string[]).includes(rule)) problems.push(`${rwhere}: unknown rule ${rule.quote()}`);
						else if (typeof value != "boolean") problems.push(`${rwhere}: rule ${rule.quote()} must be true or false`);
						else range.rules[rule] = value;
					});
			}
			ranges.push(range);
		});

		// the settings for each revision: the ranges that include it, merged in the order they are listed (a later range wins)
		const id = m.id as string;
		const byRevision = new Map<A177Revision, MarketSettings>();
		const lcnAbove: string[] = []; // the revisions whose lcn.min is above their lcn.max
		A177Revision.all.forEach((revision) => {
			const schemas: Record<string, MarketSchema> = {};
			const parameters = structuredClone(MARKET_DEFAULTS.parameters) as Record<string, Record<string, unknown>>;
			const severity: Record<string, MarketSeverity> = {};
			const images: Record<string, MarketImage> = {},
				rules: Record<string, boolean> = {};
			ranges
				.filter((range) => range.from <= revision && revision <= range.to)
				.forEach((range) => {
					Object.assign(schemas, range.schemas);
					Object.entries(range.parameters).forEach(([group, values]) => Object.assign(parameters[group], values));
					Object.assign(severity, range.severity);
					// a later range replaces what an earlier one stipulates for a kind of image
					Object.assign(images, range.images);
					Object.assign(rules, range.rules);
				});
			const { min, max } = parameters.lcn as MarketParameters["lcn"];
			if (min > max) lcnAbove.push(`r${revision.level} (${min} > ${max})`);
			byRevision.set(revision, deepFreeze({ market: id, schemas, parameters, severity, images, rules } as unknown as MarketSettings));
		});
		if (lcnAbove.length > 0) problems.push(`${where}: "lcn.min" is above "lcn.max" for ${lcnAbove.join(", ")}`);
		// a document whose revision is not known has the A177 baseline
		const unknown = deepFreeze({ ...MARKET_DEFAULTS, market: id });
		return Object.freeze({
			id,
			name: m.name as string,
			description: m.description as string | undefined,
			permitted: permitted ? Object.freeze(permitted) : undefined,
			permits: (revision: A177Revision) => permitted == undefined || permitted.includes(revision),
			settings: (revision: A177Revision) => byRevision.get(revision) ?? unknown,
		});
	});
	if (problems.length > 0) throw new MarketsError(`the markets in ${source} cannot be used:\n  ${problems.join("\n  ")}`);
	return Object.freeze(markets as Market[]);
}

let loadedMarkets: readonly Market[] | undefined = undefined;

/**
 * load the markets, from res/markets.json, or from the repository with --urls. They are loaded once: later calls do nothing
 *
 * @param {LoadOptions} opts  where to load from
 * @throws {MarketsError} when the markets cannot be loaded or are not valid
 */
export function LoadMarkets(opts: LoadOptions): void {
	if (loadedMarkets) return;
	if (opts.verbose) console.log(chalk.yellow.underline("loading markets..."));
	let text: string | undefined;
	const source = opts.useURLs && Markets.url ? Markets.url : Markets.file;
	if (opts.useURLs && Markets.url) {
		try {
			const resp = fetchS(Markets.url, fetch_options);
			if (!resp.ok) throw new MarketsError(`cannot retrieve the markets from ${Markets.url}: ${resp.status} ${resp.statusText}`);
			text = resp.text();
		} catch (err) {
			if (err instanceof MarketsError) throw err;
			throw new MarketsError(`cannot retrieve the markets from ${Markets.url}: ${(err as Error).message}`);
		}
	} else {
		const buf = readmyfile(Markets.file, { encoding: "utf8" });
		if (buf == null) throw new MarketsError(`cannot read the markets from ${Markets.file}`);
		text = buf.toString();
	}
	loadedMarkets = parseMarkets(text, source);
	if (opts.verbose) console.log(chalk.yellow(`..${loadedMarkets.map((m) => m.id).join(", ") || "no markets"} ${chalk.green("OK")}`));
}

// the markets that are defined (none until LoadMarkets() has been called)
export const definedMarkets = (): readonly Market[] => loadedMarkets ?? [];

/**
 * define markets as well as those of the markets file: for the testsuite, whose test markets are not in res/markets.json.
 * The file's markets are loaded first, if they are not yet
 *
 * @param {Market[]} markets  the markets, from parseMarkets()
 * @throws {MarketsError} when a market has the id of one already defined
 */
export function addMarkets(markets: readonly Market[]): void {
	LoadMarkets({ useURLs: false, async: false, verbose: false });
	const twice = markets.filter((m) => findMarket(m.id));
	if (twice.length > 0) throw new MarketsError(`the markets ${twice.map((m) => m.id.quote()).join(", ")} are already defined`);
	loadedMarkets = Object.freeze([...definedMarkets(), ...markets]);
}

/**
 * the market with an id (in any case)
 *
 * @param {string} id  the id of the market
 * @returns {Market | undefined} the market, or undefined if none has the id
 */
export const findMarket = (id: string): Market | undefined => definedMarkets().find((m) => m.id.toLowerCase() == id.trim().toLowerCase());

/**
 * the settings of a market for the documents of an A177 revision
 *
 * @param {string}       id        the id of the market, or undefined for the A177 baseline
 * @param {A177Revision} revision  the revision of the document
 * @returns {MarketSettings} the settings
 */
export const marketSettings = (id: string | undefined, revision: A177Revision): MarketSettings =>
	(id == undefined ? undefined : findMarket(id)?.settings(revision)) ?? MARKET_DEFAULTS;

/**
 * the severity that a market's settings give a code (decision 21 of issue #119): the entry for the code itself, or else the
 * entry for the longest prefix* that the code starts with
 *
 * @param {MarketSettings} settings  the settings of the market for the revision of the document
 * @param {string}         code      the code of the finding
 * @returns {MarketSeverity | undefined} the severity, or undefined when the market does not change it
 */
export function marketSeverity(settings: MarketSettings, code: string): MarketSeverity | undefined {
	const exact = settings.severity[code];
	if (exact) return exact;
	let best: string | undefined = undefined;
	for (const key of Object.keys(settings.severity))
		if (key.endsWith("*") && code.startsWith(key.slice(0, -1)) && (best == undefined || key.length > best.length)) best = key;
	return best ? settings.severity[best] : undefined;
}
