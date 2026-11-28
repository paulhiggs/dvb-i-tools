/**
 * config.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * The validator's configuration: the options of the command line and the configuration files (command_line.mts and
 * config_file.mts, issue #147), checked and normalised once. A problem is reported by throwing a ConfigError, so the
 * decision to stop is left to the entry point
 */

import chalk from "chalk"
import commandLineArgs from "command-line-args"

import { read_string_options, CORSlibrary, CORSmanual, CORSnone, CORSoptions, setSystemSettings } from "./globals.mts"
import { Default_SLEPR } from "./data_locations.mts"
import { configureFetchPolicy } from "./safe_fetch.mts"
import { readmyfile, HasProperty } from "./utils.mts"
import { ALL_IN_ONE_SETTINGS, ConfigError, checkSetting, optionOrDefault } from "./config_file.mts"
import type { SpamBlockerSettings } from "./spam_disruptions.mts"

// initialise string formatting extensions
import {} from "./string-extensions.mts"

export { ConfigError };

export type ValidatorConfig = Readonly<{
	features: Readonly<{ sl: boolean; pl: boolean; cg: boolean; slr: boolean; ait: boolean; csr: boolean }>; // what the server offers
	useURLs: boolean; // load reference data (classification schemes etc.) from the network rather than res/
	csrFile: string; // the master SLEPR document for /query
	slrMode: string; // how /query responses are produced
	corsMode: string; // "library", "manual" or "none"
	allowTraversal: boolean; // validations may traverse into referenced documents
	spamBlocker?: Readonly<SpamBlockerSettings>; // the endpoints of the spam blocker, when it is enabled
	workers: number; // 0 for a single process, otherwise the number of cluster workers
	port: number; // HTTP
	sport: number; // HTTPS
	tls: Readonly<{ key: string; certificate: string }>; // the files of the HTTPS server, which is started when both exist
	shutdownGraceMs: number; // how long a shutdown waits for the requests in progress
	maxDocumentBytes: number; // the largest document that can be sent to be validated
	motd?: string; // HTML shown at the top of each page
	archiveFolder: string; // where the documents validated are archived, when the folder exists
	logFolder: string; // where the request log is written, when the folder exists
	fetch: Readonly<{
		allowPrivateAddresses: boolean;
		fetchConcurrency?: number;
		fetchesPerHost?: number;
		userAgent: string; // of every request the server makes
		timeoutMs: number;
		maxResponseBytes: number;
	}>;
	traversal: Readonly<{ maxDocuments: number; maxDepth: number }>; // the limits of a validation's traversal
}>;

// the settings that are only in the configuration file (they have no command line option). A configuration made without
// them (e.g. by a test) has their coded values
const FILE_ONLY_OPTIONS = ["tls_key", "tls_certificate", "shutdown_grace_ms", "max_document_bytes", "user_agent", "fetch_timeout_ms", "max_response_bytes", "max_traversal", "max_depth", "archive", "logs", "spam_endpoints", "spam_protocol", "spam_redirections"];

const positiveWholeNumber = (options: commandLineArgs.CommandLineOptions, name: string): number | undefined => {
	if (!HasProperty(options, name)) return undefined;
	const value = options[name];
	if (typeof value != "number" || Number.isNaN(value)) throw new ConfigError(`${name} must be a positive whole number`);
	return value;
};

/**
 * check and normalise the command line options
 *
 * @param {commandLineArgs.CommandLineOptions} options  the parsed command line (see OptionDefinitions in all-in-one.ts)
 * @returns {ValidatorConfig} the configuration
 * @throws {ConfigError} when an option is missing or not valid
 */
export function loadConfig(options: commandLineArgs.CommandLineOptions): ValidatorConfig {
	// the settings that have no command line option are checked here too, for a configuration that is not from the files
	const value = (option: string) => optionOrDefault(ALL_IN_ONE_SETTINGS, options, option);
	const problems = FILE_ONLY_OPTIONS.flatMap((option) => {
		const setting = ALL_IN_ONE_SETTINGS.find((s) => s.option == option)!;
		const problem = checkSetting(setting, value(option));
		return problem ? [`${setting.path} ${problem}`] : [];
	});
	if (problems.length > 0) throw new ConfigError(problems.join("\n"));

	const features = { sl: !options.nosl, pl: !options.nopl, cg: !options.nocg, slr: !options.noslr, ait: !options.noait, csr: !options.nocsr };
	if (!features.csr && !features.sl && !features.pl && !features.cg && !features.slr && !features.ait) throw new ConfigError("nothing to do... exiting");
	if (features.csr && !HasProperty(options, "CSRfile")) throw new ConfigError("SLEPR file not specified... exiting");

	const corsMode = HasProperty(options, "CORSmode") ? options.CORSmode : CORSlibrary;
	if (!CORSoptions.includes(corsMode))
		throw new ConfigError(`CORSmode must be ${CORSnone.quote()}, ${CORSlibrary.quote()} to use the Express cors() handler, or ${CORSmanual.quote()} to have headers inserted manually`);

	const fetchConcurrency = positiveWholeNumber(options, "fetch_concurrency"),
		fetchesPerHost = positiveWholeNumber(options, "fetch_per_host");

	let motd: string | undefined = undefined;
	if (HasProperty(options, "motd")) {
		console.log(chalk.yellow("reading Message Of The Day from " + chalk.green(options.motd)));
		motd = readmyfile(options.motd, read_string_options) as string;
	}

	return Object.freeze({
		features: Object.freeze(features),
		useURLs: options.urls == true,
		// the default master SLEPR is fetched from the repository when reference data is loaded from the network
		csrFile: options.urls && options.CSRfile == Default_SLEPR.file ? Default_SLEPR.url : options.CSRfile,
		slrMode: options.SLRmode,
		corsMode,
		allowTraversal: options.allow_traversal == true,
		spamBlocker:
			options.spam_blocker == true
				? Object.freeze({ endpoints: value("spam_endpoints") as string[], protocol: value("spam_protocol") as string, redirections: value("spam_redirections") as string[] })
				: undefined,
		workers: options.workers ?? 0,
		port: options.port,
		sport: options.sport,
		tls: Object.freeze({ key: value("tls_key") as string, certificate: value("tls_certificate") as string }),
		shutdownGraceMs: value("shutdown_grace_ms") as number,
		maxDocumentBytes: value("max_document_bytes") as number,
		motd,
		archiveFolder: value("archive") as string,
		logFolder: value("logs") as string,
		// a flag given without a value (null) means true
		fetch: Object.freeze({
			allowPrivateAddresses: options.allow_private_fetch !== false,
			fetchConcurrency,
			fetchesPerHost,
			userAgent: value("user_agent") as string,
			timeoutMs: value("fetch_timeout_ms") as number,
			maxResponseBytes: value("max_response_bytes") as number,
		}),
		traversal: Object.freeze({ maxDocuments: value("max_traversal") as number, maxDepth: value("max_depth") as number }),
	});
}

/**
 * set the fetch policy for the validations made through the server, and the settings of the process (the User-Agent and
 * timeout of the retrievals of reference data, the shutdown grace period, and the archive and log folders)
 */
export function applyFetchPolicy(config: ValidatorConfig): void {
	setSystemSettings({
		userAgent: config.fetch.userAgent,
		fetchTimeoutMs: config.fetch.timeoutMs,
		shutdownGraceMs: config.shutdownGraceMs,
		archiveFolder: config.archiveFolder,
		logFolder: config.logFolder,
	});
	configureFetchPolicy({
		allowPrivateAddresses: config.fetch.allowPrivateAddresses,
		timeout: config.fetch.timeoutMs,
		maxResponseBytes: config.fetch.maxResponseBytes,
		maxTraversalDocuments: config.traversal.maxDocuments,
		maxTraversalDepth: config.traversal.maxDepth,
	});
	// every validation made through the server retrieves and checks the images it references. The library default is off,
	// so documents validated directly (e.g. by the testsuite) do not make network requests for their images
	configureFetchPolicy({ checkImages: true });
	// references with a signature policy have the certificate chain of their HTTPS connection and the signature of their
	// response checked. These are separate settings, so either can be turned off without the other
	configureFetchPolicy({ checkConnectionCertificates: true, checkResponseSignatures: true });
	if (config.fetch.fetchConcurrency != undefined) configureFetchPolicy({ fetchConcurrency: config.fetch.fetchConcurrency });
	if (config.fetch.fetchesPerHost != undefined) configureFetchPolicy({ fetchesPerHost: config.fetch.fetchesPerHost });
}
