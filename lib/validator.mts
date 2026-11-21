/**
 * validator.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Starts the validator: the configuration (config.mts), the cluster workers, the checkers and service list registry
 * (services.mts), the Express application (app.mts) and its listeners (server.mts)
 */

import process from "process"
import cluster from "cluster"
import chalk from "chalk"
import commandLineArgs from "command-line-args"

import { ConfigError, applyFetchPolicy, loadConfig } from "./config.mts"
import type { ValidatorConfig } from "./config.mts"
import { createServices } from "./services.mts"
import { createApp } from "./app.mts"
import { startServer, startWorkers } from "./server.mts"

/**
 * start the validation and service list registry endpoints
 *
 * @param {commandLineArgs.CommandLineOptions} app_options  Command Line Arguments - see OptionDefinitions in all-in-one.ts
 */
export default function validator(app_options: commandLineArgs.CommandLineOptions): void {
	let config: ValidatorConfig;
	try {
		config = loadConfig(app_options);
	} catch (err) {
		if (!(err instanceof ConfigError)) throw err;
		console.log(chalk.red(err.message));
		process.exit(1);
	}
	applyFetchPolicy(config);

	if (config.workers != 0 && cluster.isPrimary) startWorkers(config.workers);
	else startServer(config, createApp(config, createServices(config)));
}
