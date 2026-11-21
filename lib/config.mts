/**
 * config.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * The validator's configuration: the command line options (see OptionDefinitions in all-in-one.ts), checked and
 * normalised once. A problem is reported by throwing a ConfigError, so the decision to stop is left to the entry point
 */

import chalk from "chalk"
import commandLineArgs from "command-line-args"

import { read_string_options, CORSlibrary, CORSmanual, CORSnone, CORSoptions } from "./globals.mts"
import { Default_SLEPR } from "./data_locations.mts"
import { configureFetchPolicy } from "./safe_fetch.mts"
import { readmyfile, HasProperty } from "./utils.mts"

// initialise string formatting extensions
import {} from "./string-extensions.mts"

// a problem with the configuration, which stops the validator from starting
export class ConfigError extends Error {}

export type ValidatorConfig = Readonly<{
	features: Readonly<{ sl: boolean; pl: boolean; cg: boolean; slr: boolean; csr: boolean }>; // what the server offers
	useURLs: boolean; // load reference data (classification schemes etc.) from the network rather than res/
	csrFile: string; // the master SLEPR document for /query
	slrMode: string; // how /query responses are produced
	corsMode: string; // "library", "manual" or "none"
	allowTraversal: boolean; // validations may traverse into referenced documents
	spamBlocker: boolean;
	workers: number; // 0 for a single process, otherwise the number of cluster workers
	port: number; // HTTP
	sport: number; // HTTPS
	motd?: string; // HTML shown at the top of each page
	fetch: Readonly<{ allowPrivateAddresses: boolean; fetchConcurrency?: number; fetchesPerHost?: number }>;
}>;

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
	const features = { sl: !options.nosl, pl: !options.nopl, cg: !options.nocg, slr: !options.noslr, csr: !options.nocsr };
	if (!features.csr && !features.sl && !features.pl && !features.cg && !features.slr) throw new ConfigError("nothing to do... exiting");
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
		spamBlocker: options.spam_blocker == true,
		workers: options.workers ?? 0,
		port: options.port,
		sport: options.sport,
		motd,
		// a flag given without a value (null) means true
		fetch: Object.freeze({ allowPrivateAddresses: options.allow_private_fetch !== false, fetchConcurrency, fetchesPerHost }),
	});
}

/**
 * set the fetch policy for the validations made through the server
 */
export function applyFetchPolicy(config: ValidatorConfig): void {
	configureFetchPolicy({ allowPrivateAddresses: config.fetch.allowPrivateAddresses });
	// every validation made through the server retrieves and checks the images it references. The library default is off,
	// so documents validated directly (e.g. by the testsuite) do not make network requests for their images
	configureFetchPolicy({ checkImages: true });
	// references with a signature policy have the certificate chain of their HTTPS connection and the signature of their
	// response checked. These are separate settings, so either can be turned off without the other
	configureFetchPolicy({ checkConnectionCertificates: true, checkResponseSignatures: true });
	if (config.fetch.fetchConcurrency != undefined) configureFetchPolicy({ fetchConcurrency: config.fetch.fetchConcurrency });
	if (config.fetch.fetchesPerHost != undefined) configureFetchPolicy({ fetchesPerHost: config.fetch.fetchesPerHost });
}
