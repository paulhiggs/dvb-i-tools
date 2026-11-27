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
};

// the settings for the documents of one A177 revision
export type MarketSettings = Readonly<{
	market?: string; // the id of the market, or undefined for the A177 baseline
	schemas: Readonly<{ serviceList?: MarketSchema; serviceListRegistry?: MarketSchema }>;
	parameters: Readonly<{ [P in keyof MarketParameters]: Readonly<MarketParameters[P]> }>;
}>;

// the A177 baseline: no market. A market file holds only what a market changes
export const MARKET_DEFAULTS: MarketSettings = deepFreeze({
	market: undefined,
	schemas: {},
	parameters: {
		schedule: { daysEitherSide: 28 },
	},
});

export type Market = Readonly<{
	id: string;
	name: string;
	description?: string;
	settings: (revision: A177Revision) => MarketSettings;
}>;

// a markets file that cannot be used: the start-up stops
export class MarketsError extends Error {}

// the checks of the values of each parameter
const positiveWholeNumber = (value: unknown): string | undefined =>
	typeof value == "number" && Number.isInteger(value) && value > 0 ? undefined : "must be a positive whole number";
const PARAMETER_CHECKS: { [P in keyof MarketParameters]: { [Q in keyof MarketParameters[P]]: (value: unknown) => string | undefined } } = {
	schedule: { daysEitherSide: positiveWholeNumber },
};
const SCHEMA_KINDS = ["serviceList", "serviceListRegistry"] as const;

const MARKET_KEYS = ["id", "name", "description", "revisions"],
	RANGE_KEYS = ["from", "to", "schemas", "parameters"];

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
		if (!Array.isArray(m.revisions) || m.revisions.length == 0) {
			problems.push(`${where}: revisions must be a list of revision ranges`);
			return undefined;
		}

		// the settings of each range, in the order they are listed
		type Range = { from: A177Revision; to: A177Revision; schemas: Record<string, MarketSchema>; parameters: Record<string, Record<string, unknown>> };
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

			const range: Range = { from: from ?? A177Revision.unknown, to: to ?? A177Revision.unknown, schemas: {}, parameters: {} };
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
			ranges.push(range);
		});

		// the settings for each revision: the ranges that include it, merged in the order they are listed (a later range wins)
		const id = m.id as string;
		const byRevision = new Map<A177Revision, MarketSettings>();
		A177Revision.all.forEach((revision) => {
			const schemas: Record<string, MarketSchema> = {};
			const parameters = structuredClone(MARKET_DEFAULTS.parameters) as Record<string, Record<string, unknown>>;
			ranges
				.filter((range) => range.from <= revision && revision <= range.to)
				.forEach((range) => {
					Object.assign(schemas, range.schemas);
					Object.entries(range.parameters).forEach(([group, values]) => Object.assign(parameters[group], values));
				});
			byRevision.set(revision, deepFreeze({ market: id, schemas, parameters } as unknown as MarketSettings));
		});
		// a document whose revision is not known has the A177 baseline
		const unknown = deepFreeze({ ...MARKET_DEFAULTS, market: id });
		return Object.freeze({
			id,
			name: m.name as string,
			description: m.description as string | undefined,
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
