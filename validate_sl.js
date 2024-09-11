/**
 * validate_sl.js
 * 
 * An standalone runner for the service list validator
 */
import chalk from "chalk";
import commandLineArgs from "command-line-args";

import { HTTPPort } from "./globals.js";
import validator from "./validator.js";

// parse command line options
const optionDefinitions = [
	{ name: "urls", alias: "u", type: Boolean, defaultValue: false },
	{ name: "port", alias: "p", type: Number, defaultValue: HTTPPort.sl },
	{ name: "sport", alias: "s", type: Number, defaultValue: HTTPPort.sl + 1 },
];

const options = commandLineArgs(optionDefinitions);

console.log(`this application is deprecated! use ${chalk.green(`"all-in-one --nocsr --nocg${options.urls ? " --urls" : ""}  --port ${options.port} --sport ${options.sport}"`)}`);

options.nocsr = true;
options.nosl = false;
options.nocg = true;
validator(options);
