/**
 * command_line.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * The command line options of all-in-one.ts and csr.ts, and their help. Every option, except --config and --help, is
 * also a setting of the server's configuration file (config_file.mts, issue #147), and the default shown is the value
 * coded there. The options have no default values of their own, so that only the options given on the command line
 * override the configuration files
 */

import process from "node:process"
import chalk from "chalk"
import commandLineArgs from "command-line-args"
import type { OptionDefinition } from "command-line-args"
import commandLineUsage from "command-line-usage"
import type { Section } from "command-line-usage"

import { ALL_IN_ONE_CONFIG, ALL_IN_ONE_SETTINGS, CSR_CONFIG, CSR_SETTINGS, ConfigError, serverOptions } from "./config_file.mts"
import type { SettingDefinition } from "./config_file.mts"
import { CORSlibrary, CORSmanual, CORSnone } from "./globals.mts"
import { SLR_Processing_Modes } from "./slepr.mts"

import {} from "./string-extensions.mts"

// command-line-args Boolean options cannot be turned off, so options that default to true take an explicit value
export function parseBooleanOption(value: string): boolean {
	return !["false", "no", "off", "0"].includes(value.toLowerCase());
}

// a positive whole number. Anything else is NaN, which is reported when the options are checked
export function parsePositiveInteger(value: string): number {
	return /^\d+$/.test(value) && parseInt(value, 10) > 0 ? parseInt(value, 10) : NaN;
}

type ServerOption = OptionDefinition & { description: string; typeLabel?: string };

// the value coded for an option, for its description
const defaultOf = (settings: readonly SettingDefinition[], option: string): string => {
	const setting = settings.find((s) => s.option == option);
	return setting ? String(setting.invert ? !setting.default : setting.default) : "";
};

const configOption = (file: string): ServerOption => ({
	name: "config",
	type: String,
	typeLabel: "{underline filename}",
	description: `the configuration file, read over ${file} (which is read when it exists). The options given here win over both`,
});
const HELP: ServerOption = { name: "help", alias: "h", type: Boolean, description: "This help" };

// the options of both servers
const common = (settings: readonly SettingDefinition[]): ServerOption[] => [
	{ name: "urls", alias: "u", type: Boolean, description: "Load data files from network locations." },
	{ name: "port", alias: "p", type: Number, typeLabel: "{underline ip-port}", description: `The HTTP port to listen on. Default: ${defaultOf(settings, "port")}` },
	{ name: "sport", alias: "s", type: Number, typeLabel: "{underline ip-port}", description: `The HTTPS port to listen on. Default: ${defaultOf(settings, "sport")}` },
	{ name: "CSRfile", alias: "f", type: String, typeLabel: "{underline filename}", description: "local file name of SLEPR file" },
	{
		name: "CORSmode",
		alias: "c",
		type: String,
		typeLabel: "{underline mode}",
		description: `type of CORS handling ${CORSlibrary.quote()} (default), ${CORSmanual.quote()} or ${CORSnone.quote()}`,
	},
	{ name: "SLRmode", type: String, typeLabel: "{underline mode}", description: `The type of processing for the SLR response [${SLR_Processing_Modes.join(",")}]` },
	{ name: "spam_blocker", alias: "b", type: Boolean, description: "enable frustrator for network scanners" },
];

export const ALL_IN_ONE_OPTIONS: readonly ServerOption[] = [
	...common(ALL_IN_ONE_SETTINGS),
	{ name: "nocsr", type: Boolean, typeLabel: "{underline flag}", description: "disallow SLR function" },
	{ name: "nosl", type: Boolean, typeLabel: "{underline flag}", description: "disallow Service List validation" },
	{ name: "nocg", type: Boolean, typeLabel: "{underline flag}", description: "disallow Content Guide validation" },
	{ name: "noslr", type: Boolean, typeLabel: "{underline flag}", description: "disallow Service List Registry validation" },
	{ name: "nopl", type: Boolean, typeLabel: "{underline flag}", description: "disallow Playlist validation" },
	{ name: "noait", type: Boolean, typeLabel: "{underline flag}", description: "disallow XML AIT validation" },
	{ name: "motd", alias: "m", type: String, typeLabel: "{underline filename}", description: "local file name containing HTML for Message Of The Day" },
	{ name: "workers", alias: "w", type: Number, description: "The number of worker threads to spawn. Default: 0 (a single process)" },
	{ name: "allow_traversal", alias: "t", type: Boolean, description: "allow use of metadata traversal" },
	{
		name: "fetch_concurrency",
		type: parsePositiveInteger,
		typeLabel: "{underline number}",
		description: `maximum number of documents retrieved at the same time. Default: ${defaultOf(ALL_IN_ONE_SETTINGS, "fetch_concurrency")}`,
	},
	{
		name: "fetch_per_host",
		type: parsePositiveInteger,
		typeLabel: "{underline number}",
		description: `maximum number of documents retrieved at the same time from one host. Default: ${defaultOf(ALL_IN_ONE_SETTINGS, "fetch_per_host")}`,
	},
	{
		name: "allow_private_fetch",
		type: parseBooleanOption,
		typeLabel: "{underline true|false}",
		description: "allow documents to be retrieved from localhost and private network addresses (literal IP addresses only). Default: true",
	},
	configOption("all-in-one.json"),
	HELP,
];

export const CSR_OPTIONS: readonly ServerOption[] = [
	...common(CSR_SETTINGS),
	{ name: "workers", alias: "w", type: Number, description: "The number of worker threads to spawn. Default: 0 (one for each CPU)" },
	configOption("csr.json"),
	HELP,
];

// the query of /query, in the help of both servers
const queryHelp = (inlineImages: boolean): Section[] => [
	{
		header: "SLR Client Query",
		content: "{underline <host>}:{underline <port>}/query[?{underline arg}={underline value}(&{underline arg}={underline value})*]",
	},
	{
		content: [
			{ header: "{underline arg}" },
			{ name: "regulatorListFlag", summary: "Select only service lists that have the @regulatorListFlag set as specified (true|false)" },
			{ name: "Delivery[]", summary: "Select only service lists that use the specified delivery system (dvb-t|dvb-dash|dvb-c|dvb-s|dvb-iptv|application)" },
			{ name: "TargetCountry[]", summary: "Select only service lists that apply to the specified countries (form: {underline ISO3166 3-digit code})" },
			{ name: "Language[]", summary: "Select only service lists that use the specified language (form: {underline IANA 2 digit language code})" },
			{ name: "Genre[]", summary: "Select only service lists that match one of the given Genres" },
			{ name: "ProviderName[]", summary: "Select only service lists that match one of the specified Provider names" },
			...(inlineImages ? [{ name: "inlineImages", summary: "Allow data: URLs in RelatedMaterial images in the response (true|false)" }] : []),
		],
	},
	{ content: "each argument can be given with or without the [] suffix, and repeated to give several values. Note that all query values except ProviderName are checked against constraints. An HTTP 400 response is returned with errors in the response body." },
	{
		header: "About",
		content: "Project home: {underline https://github.com/paulhiggs/dvb-i-tools/}",
	},
];

const ALL_IN_ONE_HELP: Section[] = [
	{ header: "DVB Service List and Content Guide validator", content: "Syntax and semantic validation of XML documents defined in DVB Blueblook A177 (DVB-I)" },
	{ header: "Synopsis", content: "$ node all-in-one.ts <options>" },
	{ header: "Options", optionList: [...ALL_IN_ONE_OPTIONS] },
	{ header: "Configuration", content: "Every option, and the settings that have no option, can also be set in all-in-one.json (see the README)." },
	...queryHelp(false),
];

const CSR_HELP: Section[] = [
	{ header: "DVB Central Service Registry", content: "An implementaion of a DVB-I Service List Registry" },
	{ header: "Synopsis", content: "$ node csr.ts <options>" },
	{ header: "Options", optionList: [...CSR_OPTIONS] },
	{ header: "Configuration", content: "Every option, and the settings that have no option, can also be set in csr.json (see the README)." },
	...queryHelp(true),
];

/**
 * the options of a server, from its command line and configuration files. --help prints the help and exits, and an
 * option that cannot be parsed or a configuration file that is not valid is reported, and the process exits with 1
 *
 * @param {"all-in-one" | "csr"} server  the server
 * @param {string[]}             argv    the command line (by default, the process's)
 * @returns {Record<string, unknown>} the options, as loadConfig() takes them
 */
export function commandLineOptions(server: "all-in-one" | "csr", argv?: string[]): Record<string, unknown> {
	const [definitions, help, settings, defaultFile] =
		server == "csr" ? [CSR_OPTIONS, CSR_HELP, CSR_SETTINGS, CSR_CONFIG] : [ALL_IN_ONE_OPTIONS, ALL_IN_ONE_HELP, ALL_IN_ONE_SETTINGS, ALL_IN_ONE_CONFIG];
	let given: commandLineArgs.CommandLineOptions;
	try {
		given = commandLineArgs([...definitions], argv ? { argv } : undefined);
	} catch (err) {
		console.log(chalk.red((err as Error).message));
		console.log(commandLineUsage(help));
		process.exit(1);
	}
	if (given.help) {
		console.log(commandLineUsage(help));
		process.exit(0);
	}
	delete given.help;
	try {
		return serverOptions(settings, given, defaultFile);
	} catch (err) {
		if (!(err instanceof ConfigError)) throw err;
		console.log(chalk.red(err.message));
		process.exit(1);
	}
}
