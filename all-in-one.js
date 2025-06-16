/**
 * all-in-one.js
 *
 * runner for all three DVB-I V&V tools
 */
import process from "node:process";
import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";

import { CORSlibrary, CORSmanual, CORSnone, CORSoptions, HTTPPort } from "./lib/globals.mjs";
import { Default_SLEPR, MOTD } from "./lib/data_locations.mjs";
import validator from "./lib/validator.mjs";

// parse command line options
const optionDefinitions = [
	{ name: "urls", alias: "u", type: Boolean, defaultValue: false, description: "Load data files from network locations." },
	{
		name: "port",
		alias: "p",
		type: Number,
		defaultValue: HTTPPort.all_in_one,
		typeLabel: "{underline ip-port}",
		description: `The HTTP port to listen on. Default: ${HTTPPort.all_in_one}`,
	},
	{
		name: "sport",
		alias: "s",
		type: Number,
		defaultValue: HTTPPort.all_in_one + 1,
		typeLabel: "{underline ip-port}",
		description: `The HTTPS port to listen on. Default: ${HTTPPort.all_in_one + 1}`,
	},
	{ name: "nocsr", type: Boolean, defaultValue: false, typeLabel: "{underline flag}", description: "disallow SLR function" },
	{ name: "nosl", type: Boolean, defaultValue: false, typeLabel: "{underline flag}", description: "disallow Service List validation" },
	{ name: "nocg", type: Boolean, defaultValue: false, typeLabel: "{underline flag}", description: "disallow Content Guide validation" },
	{ name: "CSRfile", alias: "f", type: String, defaultValue: Default_SLEPR.file, typeLabel: "{underline filename}", description: "local file name of SLEPR file" },
	{
		name: "CORSmode",
		alias: "c",
		type: String,
		defaultValue: CORSlibrary,
		typeLabel: "{underline mode}",
		description: `type of CORS habdling "${CORSlibrary}" (default), "${CORSmanual}" or "${CORSnone}"`,
	},
	{ name: "motd", alias: "m", type: String, defaultValue: MOTD.file, typeLabel: "{underline filename}", description: "local file name containing HTML for Message Of The Day" },
	{ name: "help", alias: "h", type: Boolean, defaultValue: false, description: "This help" },
];

const commandLineHelp = [
	{
		header: "DVB Service List and Content Guide validator",
		content: "Syntax and semantic validation of XML documents defined in DVB Blueblook A177 (DVB-I)",
	},
	{
		header: "Synopsis",
		content: "$ node all-in-one <options>",
	},
	{
		header: "Options",
		optionList: optionDefinitions,
	},
	{
		header: "SLR Client Query",
		content: "{underline <host>}:{underline <port>}/query[?{underline arg}={underline value}(&{underline arg}={underline value})*]",
	},
	{
		content: [
			{ header: "{underline arg}" },
			{ name: "regulatorListFlag", summary: "Select only service lists that have the @regulatorListFlag set as specified (true|false)" },
			{ name: "Delivery[]", summary: "Select only service lists that use the specified delivery system (dvb-t|dvb-dash|dvb-c|dvb-s|dvb-iptv)" },
			{ name: "TargetCountry[]", summary: "Select only service lists that apply to the specified countries (form: {underline ISO3166 3-digit code})" },
			{ name: "Language[]", summary: "Select only service lists that use the specified language (form: {underline IANA 2 digit language code})" },
			{ name: "Genre[]", summary: "Select only service lists that match one of the given Genres" },
			{ name: "Provider[]", summary: "Select only service lists that match one of the specified Provider names" },
		],
	},
	{ content: "note that all query values except Provider are checked against constraints. An HTTP 400 response is returned with errors in the response body." },
	{
		header: "About",
		content: "Project home: {underline https://github.com/paulhiggs/dvb-i-tools/}",
	},
];

const options = commandLineArgs(optionDefinitions);

if (!CORSoptions.includes(options.CORSmode) || options.help) {
	console.log(commandLineUsage(commandLineHelp));
	process.exit(0);
}

validator(options);
