/**
 * all-in-one.ts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * runner for all three DVB-I V&V tools
 */
import process from "node:process"

import chalk from "chalk"

import { xmlRegisterFsInputProviders } from "libxml2-wasm/lib/nodejs.mjs"
xmlRegisterFsInputProviders();

import { CORSlibrary, CORSmanual, CORSnone, CORSoptions } from "./lib/globals.mts"
import validator from "./lib/validator.mts"
import { SLR_Processing_Modes } from "./lib/slepr.mts";
import { commandLineOptions } from "./lib/command_line.mts"

// the options of the command line and the configuration files (all-in-one.json, or the file given with --config, issue #147)
const application_options = commandLineOptions("all-in-one");

if (!CORSoptions.includes(application_options.CORSmode as string)) {
	console.log(chalk.red(`CORSmode must be ${CORSnone.quote()}, ${CORSlibrary.quote()} to use the Express cors() handler, or "${CORSmanual}" to have headers inserted manually`));
	process.exit(1);
}

if (!SLR_Processing_Modes.includes(application_options.SLRmode as string)) {
	console.log(chalk.red(`SLRmode must be one of [${SLR_Processing_Modes.join(", ")}]`));
	process.exit(1);
}

validator(application_options);
