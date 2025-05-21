/**
 * test-runner.js
 * 
 * An standalone runner for tests
 */
import { readFileSync } from "fs";
import process from "process";

import chalk from "chalk";
import commandLineArgs from "command-line-args";
import fetchS from "sync-fetch";

import ServiceListCheck from "../sl_check.js";
import ContentGuideCheck from "../cg_check.js";
import { isHTTPURL } from "../pattern_checks.js";

import ErrorList from "../error_list.js";

import { Libxml2_wasm_init } from '../libxml2-wasm-extensions.js';

// parse command line options
const optionDefinitions = [
	{ name: "urls", alias: "u", type: Boolean, defaultValue: false },
	{ name: "mode", alias: "m", type: String},
	{ name: "src", type: String, multiple: true, defaultOption: true },
];

const options = commandLineArgs(optionDefinitions);

if (!options.src || options.src.length == 0) {
	console.log(chalk.red('no files specified to validate, exiting...'));
	process.exit(1);
}

if (options.mode.toLowerCase() == "sl") {
	// test a service list
	let sl = new ServiceListCheck(options.urls, null, false);
	options.src.forEach((ref) => {
		let SLtext = null;
		if (isHTTPURL(ref)) {
			let resp = null;
			try {
				resp = fetchS(req.body.XMLurl);
			} catch (error) {
				console.log(chalk.red(error.message));
			}
			if (resp) {
				if (resp.ok) SLtext = resp.content;
				else console.log(chalk.red(`error (${resp.status}:${resp.statusText}) handling ${ref}`));
			}
		}
		else SLtext = readFileSync(ref, { encoding: 'utf8', flag: 'r' });

		let errs = new ErrorList();
		sl.doValidateServiceList(SLtext, errs);
		console.log(JSON.stringify({errs}, null, 2));
	});
}
else if (options.mode.toLowerCase("cg")) {
	// test a content guide frsagmet
	if (options.mode.indexOf("-") == -1) {
		console.log(chalk.red(`content guide request type must be specified`));
		process.exit(1);
	}
	let cg = new ContentGuideCheck(options.urls, null, false);
	let cg_request = options.mode.substring(options.mode.indexOf("-")+1);
  let req = cg.supportedRequests.find((s) => s.value == cg_request);
	if (req == undefined) {
		console.log(chalk.red(`"${cg_request}" is not a supported content guide requet type`));
		process.exit(1);
	}
	//console.log(`processing cg as "${req.label}"`);
	options.src.forEach((ref) => {
		let CGtext = null;
		if (isHTTPURL(ref)) {
			let resp = null;
			try {
				resp = fetchS(req.body.XMLurl);
			} catch (error) {
				console.log(chalk.red(error.message));
			}
			if (resp) {
				if (resp.ok) CGtext = resp.content;
				else console.log(chalk.red(`error (${resp.status}:${resp.statusText}) handling ${ref}`));
			}
		}
		else CGtext = readFileSync(ref, { encoding: 'utf8', flag: 'r' });

		let errs = new ErrorList();
		cg.doValidateContentGuide(CGtext, cg_request, errs);
		console.log(JSON.stringify({errs}, null, 2));
	});
}
else {
	console.log(chalk.red("test mode not specified"));
}
