/**
 * config_file.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * The configuration files of the servers (issue #147): all-in-one.json for all-in-one.ts, and csr.json for csr.ts. Each
 * server reads its own file from the program's folder (the folder of all-in-one.ts and csr.ts) when it exists, and then
 * the file given with --config, over it. The command line options win over both, and a setting that no file gives has
 * the value coded here.
 *
 * A file is checked in this module, with no JSON schema: an unknown setting, a value of the wrong type or out of range,
 * and a file that cannot be read or parsed are all reported together, as one ConfigError, which stops the start-up.
 *
 * Each setting gives the value of one option (the name used on the command line, when the setting is also a command
 * line option), so the result is the same set of options as the command line gives (see loadConfig() in config.mts)
 */

import { existsSync, readFileSync } from "fs"
import { dirname, resolve } from "path"
import { isIP } from "net"
import chalk from "chalk"

import { __dirname, Default_SLEPR, MOTD } from "./data_locations.mts"
import { CORSoptions, CORSlibrary, DEFAULT_FETCH_TIMEOUT_MS, DEFAULT_USER_AGENT, HTTPPort, SHUTDOWN_GRACE_MS, read_string_options } from "./globals.mts"
import { DEFAULT_PROCESSING, SLR_Processing_Modes } from "./slepr.mts"
import { DEFAULT_MAX_TRAVERSAL } from "./safe_fetch.mts"
import { HasProperty } from "./utils.mts"

// a problem with the configuration, which stops the validator from starting
export class ConfigError extends Error {}

/**
 * the type of a setting's value:
 * - boolean, string
 * - port: a whole number from 0 to 65535
 * - count: a whole number, 0 or more
 * - positive: a whole number, 1 or more
 * - path: the name of a file or folder. A relative name in a configuration file is relative to the folder of that file
 * - endpoints: a list of URL paths, each starting with "/"
 * - addresses: a list of IP addresses
 */
export type SettingType = "boolean" | "string" | "port" | "count" | "positive" | "path" | "endpoints" | "addresses";

export type SettingDefinition = {
	path: string; // where the setting is in the file, e.g. "server.httpPort"
	option: string; // the option it gives: the command line option, when it is one
	type: SettingType;
	default: unknown; // the value coded in the validator, used when no file gives the setting
	values?: readonly string[]; // the values a string may have
	invert?: boolean; // the setting is the opposite of its option, e.g. features.sl and --nosl
	description: string;
};

// the settings of every server that reads the reference data, uses the network and logs its requests
const MB = 1024 * 1024;
const commonSettings = (port: number, workers: { default: number; description: string }): SettingDefinition[] => [
	{ path: "server.httpPort", option: "port", type: "port", default: port, description: "the HTTP port to listen on" },
	{ path: "server.httpsPort", option: "sport", type: "port", default: port + 1, description: "the HTTPS port to listen on, when the key and certificate exist" },
	{ path: "server.tls.key", option: "tls_key", type: "path", default: resolve(__dirname, "selfsigned.key"), description: "the private key of the HTTPS server" },
	{ path: "server.tls.certificate", option: "tls_certificate", type: "path", default: resolve(__dirname, "selfsigned.crt"), description: "the certificate of the HTTPS server" },
	{ path: "server.workers", option: "workers", type: "count", ...workers },
	{ path: "server.corsMode", option: "CORSmode", type: "string", values: CORSoptions, default: CORSlibrary, description: "the CORS handling" },
	{ path: "server.shutdownGraceMs", option: "shutdown_grace_ms", type: "positive", default: SHUTDOWN_GRACE_MS, description: "how long a shutdown waits for the requests in progress (ms)" },
	{ path: "fetch.userAgent", option: "user_agent", type: "string", default: DEFAULT_USER_AGENT, description: "the User-Agent of every request the server makes" },
	{ path: "fetch.timeoutMs", option: "fetch_timeout_ms", type: "positive", default: DEFAULT_FETCH_TIMEOUT_MS, description: "the timeout of a retrieval (ms)" },
	{ path: "slr.file", option: "CSRfile", type: "path", default: Default_SLEPR.file, description: "the master SLEPR document" },
	{ path: "slr.mode", option: "SLRmode", type: "string", values: SLR_Processing_Modes, default: DEFAULT_PROCESSING, description: "the processing of the SLR response" },
	{ path: "referenceData.useURLs", option: "urls", type: "boolean", default: false, description: "load the reference data from the network" },
	{ path: "files.logs", option: "logs", type: "path", default: resolve(__dirname, "logs"), description: "the folder of the request log, used when it exists" },
	{ path: "spamBlocker.enabled", option: "spam_blocker", type: "boolean", default: false, description: "enable the frustrator for network scanners" },
	{ path: "spamBlocker.endpoints", option: "spam_endpoints", type: "endpoints", default: [], description: "the paths the spam blocker answers with a redirect" },
	{ path: "spamBlocker.protocol", option: "spam_protocol", type: "string", values: ["http", "https"], default: "http", description: "the protocol of the spam blocker's redirects" },
	{ path: "spamBlocker.redirections", option: "spam_redirections", type: "addresses", default: [], description: "the addresses of the spam blocker's redirects" },
];

const feature = (name: string, option: string, what: string): SettingDefinition => ({ path: `features.${name}`, option, type: "boolean", default: true, invert: true, description: `offer ${what}` });

// the settings of all-in-one.ts (all-in-one.json)
export const ALL_IN_ONE_SETTINGS: readonly SettingDefinition[] = Object.freeze([
	...commonSettings(HTTPPort.all_in_one, { default: 0, description: "the number of cluster workers, or 0 for a single process" }),
	{ path: "server.maxDocumentBytes", option: "max_document_bytes", type: "positive", default: 10 * MB, description: "the largest document that can be sent to be validated" },
	feature("sl", "nosl", "Service List validation"),
	feature("pl", "nopl", "Playlist validation"),
	feature("cg", "nocg", "Content Guide validation"),
	feature("slr", "noslr", "Service List Registry validation"),
	feature("ait", "noait", "XML AIT validation"),
	feature("csr", "nocsr", "the SLR function (/query)"),
	{ path: "fetch.maxResponseBytes", option: "max_response_bytes", type: "positive", default: 10 * MB, description: "the largest response that is retrieved" },
	{ path: "fetch.concurrency", option: "fetch_concurrency", type: "positive", default: 8, description: "the most documents retrieved at the same time" },
	{ path: "fetch.perHost", option: "fetch_per_host", type: "positive", default: 4, description: "the most documents retrieved at the same time from one host" },
	{ path: "fetch.allowPrivateAddresses", option: "allow_private_fetch", type: "boolean", default: true, description: "allow retrievals from localhost and private network addresses" },
	{ path: "traversal.allowed", option: "allow_traversal", type: "boolean", default: false, description: "allow validations to traverse into referenced documents" },
	{ path: "traversal.maxDocuments", option: "max_traversal", type: "positive", default: DEFAULT_MAX_TRAVERSAL, description: "the most documents a validation traverses, unless it sets its own limit" },
	{ path: "traversal.maxDepth", option: "max_depth", type: "positive", default: 10, description: "the deepest level a validation traverses into" },
	{ path: "files.motd", option: "motd", type: "path", default: MOTD.file, description: "the HTML of the Message Of The Day, used when it exists" },
	{ path: "files.archive", option: "archive", type: "path", default: resolve(__dirname, "arch"), description: "the folder the documents validated are archived in, used when it exists" },
]);

// the settings of csr.ts (csr.json)
export const CSR_SETTINGS: readonly SettingDefinition[] = Object.freeze(commonSettings(HTTPPort.csr, { default: 0, description: "the number of cluster workers, or 0 for one for each CPU" }));

// the default configuration file of each server, in the program's folder
export const ALL_IN_ONE_CONFIG: string = resolve(__dirname, "all-in-one.json"),
	CSR_CONFIG: string = resolve(__dirname, "csr.json");

const isWholeNumber = (value: unknown): value is number => typeof value == "number" && Number.isInteger(value);

/**
 * check the value of a setting
 *
 * @returns {string | undefined} what is wrong with the value (to follow the setting's name), or undefined when it is valid
 */
export function checkSetting(setting: SettingDefinition, value: unknown): string | undefined {
	switch (setting.type) {
		case "boolean":
			return typeof value == "boolean" ? undefined : "must be true or false";
		case "string":
		case "path":
			if (typeof value != "string" || value.trim().length == 0) return "must be a string that is not empty";
			if (setting.values && !setting.values.includes(value)) return `must be one of ${setting.values.map((v) => JSON.stringify(v)).join(", ")}`;
			return undefined;
		case "port":
			return isWholeNumber(value) && value >= 0 && value <= 65535 ? undefined : "must be a port number (0 to 65535)";
		case "count":
			return isWholeNumber(value) && value >= 0 ? undefined : "must be a whole number, 0 or more";
		case "positive":
			return isWholeNumber(value) && value > 0 ? undefined : "must be a positive whole number";
		case "endpoints":
			if (!Array.isArray(value)) return "must be a list of paths";
			return value.every((v) => typeof v == "string" && v.startsWith("/")) ? undefined : 'must be a list of paths, each starting with "/"';
		case "addresses":
			if (!Array.isArray(value)) return "must be a list of IP addresses";
			return value.every((v) => typeof v == "string" && isIP(v) != 0) ? undefined : "must be a list of IP addresses";
	}
}

/**
 * the options a server has when no configuration file and no command line option is given: the values coded here
 */
export function defaultOptions(settings: readonly SettingDefinition[]): Record<string, unknown> {
	return Object.fromEntries(settings.map((s) => [s.option, s.invert ? !s.default : s.default]));
}

export type ConfigFileContents = {
	options: Record<string, unknown>; // the options the file gives
	given: Set<string>; // the settings the file gives, by path
};

/**
 * read and check a configuration file
 *
 * @param {string}              file      the file name
 * @param {SettingDefinition[]} settings  the settings of the server
 * @returns {ConfigFileContents} the options the file gives
 * @throws {ConfigError} when the file cannot be read, is not JSON, or has a setting that is unknown or not valid
 */
export function readConfigFile(file: string, settings: readonly SettingDefinition[]): ConfigFileContents {
	let content: unknown;
	try {
		content = JSON.parse(readFileSync(file, read_string_options));
	} catch (err) {
		throw new ConfigError(`${file}: cannot be read as JSON (${(err as Error).message})`);
	}
	const problems: string[] = [],
		options: Record<string, unknown> = {},
		given = new Set<string>();
	const isObject = (value: unknown): value is Record<string, unknown> => typeof value == "object" && value != null && !Array.isArray(value);

	const visit = (value: unknown, prefix: string) => {
		if (!isObject(value)) {
			problems.push(`${prefix || "the file"} must be an object`);
			return;
		}
		for (const [key, child] of Object.entries(value)) {
			const path = prefix ? `${prefix}.${key}` : key;
			const setting = settings.find((s) => s.path == path);
			if (setting) {
				const problem = checkSetting(setting, child);
				if (problem) problems.push(`${path} ${problem}`);
				else {
					given.add(path);
					// a relative file name is relative to the folder of the configuration file
					const resolved = setting.type == "path" ? resolve(dirname(file), child as string) : child;
					options[setting.option] = setting.invert ? !resolved : resolved;
				}
			} else if (settings.some((s) => s.path.startsWith(`${path}.`))) visit(child, path);
			else problems.push(`${path} is not a setting`);
		}
	};
	visit(content, "");
	if (problems.length > 0) throw new ConfigError(`${file}:\n  ${problems.join("\n  ")}`);
	return { options, given };
}

/**
 * the options of a server: the values coded here, then those of the server's configuration file in the program's folder
 * (when it exists), then those of the file given with --config (which must exist), then the command line options given
 *
 * @param {SettingDefinition[]} settings     the settings of the server
 * @param {Record}              commandLine  the command line options given (with no default values)
 * @param {string}              defaultFile  the server's configuration file in the program's folder
 * @returns {Record<string, unknown>} the options, as loadConfig() takes them
 * @throws {ConfigError} when a configuration file is missing (--config only) or not valid
 */
export function serverOptions(settings: readonly SettingDefinition[], commandLine: Record<string, unknown>, defaultFile: string): Record<string, unknown> {
	const options = defaultOptions(settings);
	const read = (file: string) => {
		console.log(chalk.yellow(`reading configuration from ${chalk.green(file)}`));
		Object.assign(options, readConfigFile(file, settings).options);
	};
	if (existsSync(defaultFile)) read(defaultFile);
	const configFile = commandLine.config;
	if (configFile != undefined) {
		if (typeof configFile != "string" || configFile.length == 0) throw new ConfigError("--config must be given a file name");
		if (!existsSync(configFile)) throw new ConfigError(`the configuration file ${configFile} does not exist`);
		read(resolve(configFile));
	}

	for (const [option, value] of Object.entries(commandLine)) {
		if (option == "config" || value === undefined) continue;
		// a flag given without a value (null) is true
		const setting = settings.find((s) => s.option == option);
		options[option] = value === null && setting?.type == "boolean" ? true : value;
	}

	return options;
}

/**
 * the value of an option, or its coded default when it is not given (e.g. a configuration made by a test)
 */
export function optionOrDefault(settings: readonly SettingDefinition[], options: Record<string, unknown>, option: string): unknown {
	if (HasProperty(options, option) && options[option] !== undefined) return options[option];
	const setting = settings.find((s) => s.option == option);
	return setting ? (setting.invert ? !setting.default : setting.default) : undefined;
}
