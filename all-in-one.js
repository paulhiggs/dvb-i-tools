/**
 * all-in-one.js
 * 
 * runner for all three DVB-I V&V tools 
 */
import commandLineArgs from "command-line-args";

import { CORSlibrary, HTTPPort } from "./globals.js";
import { Default_SLEPR } from "./data_locations.js";
import validator from "./validator.js";

// parse command line options
const optionDefinitions = [
	{ name: "urls", alias: "u", type: Boolean, defaultValue: false },
	{ name: "port", alias: "p", type: Number, defaultValue: HTTPPort.all_in_one },
	{ name: "sport", alias: "s", type: Number, defaultValue: HTTPPort.all_in_one + 1 },
	{ name: "nocsr", type: Boolean, defaultValue: false },
	{ name: "nosl", type: Boolean, defaultValue: false },
	{ name: "nocg", type: Boolean, defaultValue: false },
	{ name: "CSRfile", alias: "f", type: String, defaultValue: Default_SLEPR.file },
	{ name: "CORSmode", alias: "c", type: String, defaultValue: CORSlibrary },
];

const options = commandLineArgs(optionDefinitions);
validator(options);
