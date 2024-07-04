import chalk from "chalk";

// command line arguments - https://github.com/75lb/command-line-args
import commandLineArgs from "command-line-args";

import { HTTPPort } from "./globals.js";

import validator from "./validator.js";

// command line options
const optionDefinitions = [
	{ name: "urls", alias: "u", type: Boolean, defaultValue: false },
	{ name: "port", alias: "p", type: Number, defaultValue: HTTPPort.cg },
	{ name: "sport", alias: "s", type: Number, defaultValue: HTTPPort.cg + 1 },
];
const options = commandLineArgs(optionDefinitions);

console.log(`this application is deprecated! use ${chalk.green(`"all-in-one --nocsr --nosl ${options.urls ? "--urls" : ""}--port ${options.port} --sport ${options.sport}"`)}`);

options.nocsr = true;
options.nosl = true;
options.nocg = false;
validator(options);
