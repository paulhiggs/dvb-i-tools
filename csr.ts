/**
 * csr.ts
 *
 * An standalone runner for a service list entry point registry (SLEPR) that can be used as a Central Service List Registry (CSR)
 */
import chalk from "chalk";
import cluster from "cluster";
import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";
import cors from "cors";
import express from "express";
import { Application } from "express";
import morgan, { token } from "morgan";
import { cpus } from "os";
import { join } from "path";
import process from "process";
import favicon from "serve-favicon";

import ClassificationScheme from "./lib/classification_scheme.mts";
import { Default_SLEPR, IANA_Subtag_Registry, ISO3166, TVA_ContentCS, TVA_FormatCS, DVBI_ContentSubject } from "./lib/data_locations.mts";
import { CORSlibrary, CORSmanual, CORSnone, CORSoptions, HTTPPort } from "./lib/globals.mts";
import { StartServers } from "./lib/http_servers.mts";
import IANAlanguages from "./lib/IANA_languages.mts";
import ISOcountries from "./lib/ISO_countries.mts";


const numCPUs = cpus().length;

// SLEPR == Service List Entry Point Registry
import SLEPR from "./lib/slepr.mts";

declare module "command-line-args" {
	interface OptionDefinition {
		// add qualifier for command-line-usage so we dont have to replicate
		typeLabel?: string,
		description? : string,
	}
}

// command line options
const optionDefinitions : Array<commandLineArgs.OptionDefinition> = [
	{ name: "urls", alias: "u", type: Boolean, defaultValue: false, description: "Load data files from network locations." },
	{ name: "port", alias: "p", type: Number, defaultValue: HTTPPort.csr, typeLabel: "{underline ip-port}", description: `The HTTP port to listen on. Default: ${HTTPPort.csr}` },
	{
		name: "sport",
		alias: "s",
		type: Number,
		defaultValue: HTTPPort.csr + 1,
		typeLabel: "{underline ip-port}",
		description: `The HTTPS port to listen on. Default: ${HTTPPort.csr + 1}`,
	},
	{ name: "CSRfile", alias: "f", type: String, defaultValue: Default_SLEPR.file, typeLabel: "{underline filename}", description: "local file name of SLEPR file" },
	{
		name: "CORSmode",
		alias: "c",
		type: String,
		defaultValue: "library",
		typeLabel: "{underline mode}",
		description: `type of CORS habdling ${CORSlibrary.quote()} (default), ${CORSmanual.quote()} or ${CORSnone.quote()}`,
	},
	{ name: "help", alias: "h", type: Boolean, defaultValue: false, description: "This help" },
];

const commandLineHelp : Array<commandLineUsage.Section> = [
	{
		header: "DVB Central Service Registry",
		content: "An implementaion of a DVB-I Service List Registry",
	},
	{
		header: "Synopsis",
		content: "$ node csr <options>",
	},
	{
		header: "Options",
		optionList: optionDefinitions,
	},
	{
		header: "Client Query",
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
			{ name: "ProviderName[]", summary: "Select only service lists that match one of the specified Provider names" },
			{ name: "inlineImages", summary: "Allow data: URLs in RelatedMaterial images in the response (true|false)" },
		],
	},
	{ content: "note that all query values except Provider are checked against constraints. An HTTP 400 response is returned with errors in the response body." },
	{
		header: "About",
		content: "Project home: {underline https://github.com/paulhiggs/dvb-i-tools/}",
	},
];

let options : commandLineArgs.CommandLineOptions;
try {
	options = commandLineArgs(optionDefinitions);
} catch (/* eslint-disable no-unused-vars*/ err /* eslint-enable */) {
	console.log(commandLineUsage(commandLineHelp));
	process.exit(1);
}

if (!CORSoptions.includes(options.CORSmode)) {
	console.log(chalk.red(`CORSmode must be ${CORSnone.quote()}, ${CORSlibrary.quote()}" to use the Express cors() handler, or ${CORSmanual.quote()} to have headers inserted manually`));
	process.exit(1);
}

if (options.help) {
	console.log(commandLineUsage(commandLineHelp));
	process.exit(0);
}

if (options.urls && options.file == Default_SLEPR.file) options.file = Default_SLEPR.url;

let knownLanguages = new IANAlanguages();
knownLanguages.loadLanguages(options.urls ? { url: IANA_Subtag_Registry.url } : { file: IANA_Subtag_Registry.file });

let knownCountries = new ISOcountries(false, true);
knownCountries.loadCountries(options.urls ? { url: ISO3166.url } : { file: ISO3166.file });

let knownGenres = new ClassificationScheme();
knownGenres.loadCS(
	options.urls ? { urls: [TVA_ContentCS.url, TVA_FormatCS.url, DVBI_ContentSubject.url] } : { files: [TVA_ContentCS.file, TVA_FormatCS.file, DVBI_ContentSubject.file] }
);

const RELOAD = "RELOAD",
	UPDATE = "UPDATE",
	INCR_REQUESTS = "REQUESTS++",
	INCR_FAILURES = "FAILURES++",
	STATS = "STATS";

if (cluster.isPrimary) {
	console.log(chalk.green(`Number of CPUs is ${numCPUs}`));
	console.log(chalk.green(`Primary ${process.pid} is running`));

	let metrics = {
		numRequests: 0,
		numFailed: 0,
		reloadRequests: 0,
	};

	// Fork workers.
	for (let i = 0; i < numCPUs; i++) {
		cluster.fork();
	}

	cluster.on("exit", (worker, /* eslint-disable no-unused-vars*/ code, signal /* eslint-enable */) => {
		console.log(chalk.red(`worker ${worker.process.pid} died`));
		console.log(chalk.red("Let's fork another worker!"));
		cluster.fork();
	});
	cluster.on("message", (worker, msg, /* eslint-disable no-unused-vars*/ handle /* eslint-enable */) => {
		if (msg.topic)
			switch (msg.topic) {
				case RELOAD:
					metrics.reloadRequests++;
					if (cluster.workers) // Here we notify each worker of the updated value
						for (const id in cluster.workers)
							cluster.workers[id].send({ topic: UPDATE });
					break;
				case INCR_REQUESTS:
					metrics.numRequests++;
					break;
				case INCR_FAILURES:
					metrics.numFailed++;
					break;
				case STATS:
					console.log(`knownLanguages.length=${knownLanguages.numLanguages()}`);
					console.log(`knownCountries.length=${knownCountries.count()}`);
					console.log(`requests=${metrics.numRequests} failed=${metrics.numFailed} reloads=${metrics.reloadRequests}`);
					console.log(`SLEPR file=${options.file}`);
					break;
			}
	});
} else {
	const app : Application = express();
	app.use(cors());
	token("pid", () => {
		return `${process.pid}`;
	});
	token("protocol", (req) => {
		return req.protocol;
	});
	token("parseErr", (req) => {
		if (req.parseErr?.length > 0) return `(query errors=${req.parseErr.length})`;
		return "";
	});
	token("agent", (req) => {
		return `(${req.headers["user-agent"]})`;
	});

	const SLEPR_query_route = "/query",
		SLEPR_reload_route = "/reload",
		SLEPR_stats_route = "/stats";
	let manualCORS = function (res, req, next) {
		next();
	};
	if (options.CORSmode == CORSlibrary) {
		app.use(cors());
	} else if (options.CORSmode == CORSmanual) {
		manualCORS = function (req, res, next) {
			let opts = res.getHeader("X-Frame-Options");
			if (opts) {
				if (!opts.includes("SAMEORIGIN")) opts.push("SAMEORIGIN");
			} else opts = ["SAMEORIGIN"];
			res.setHeader("X-Frame-Options", opts);
			res.setHeader("Access-Control-Allow-Origin", "*");
			next();
		};
	}
	let csr = new SLEPR(options.urls, knownLanguages, knownCountries, knownGenres);
	csr.loadServiceListRegistry(options.CSRfile);
	app.use(morgan(":pid :remote-addr :protocol :method :url :status :res[content-length] - :response-time ms :agent :parseErr"));
	app.use(favicon(join("phlib", "ph-icon.ico")));
	if (options.CORSmode == CORSlibrary) app.options(SLEPR_query_route, cors());
	else if (options.CORSmode == CORSmanual) app.options(SLEPR_query_route, manualCORS);
	app.get(SLEPR_query_route, (req, res) => {
		process.send({ topic: INCR_REQUESTS });
		if (!csr.processServiceListRequest(req, res)) process.send({ topic: INCR_FAILURES });
		res.end();
	});
	app.get(SLEPR_reload_route, (req, res) => {
		process.send({ topic: RELOAD });
		res.status(404).end();
	});
	app.get(SLEPR_stats_route, (req, res) => {
		process.send({ topic: STATS });
		res.status(404).end();
	});

	app.get("{*splat}", (req, res) => {
		res.status(404).end();
	});

	process.on("message", (msg) => {
		if (msg.topic)
			switch (msg.topic) {
				case UPDATE:
					knownCountries.loadCountries(options.urls ? { url: ISO3166.url } : { file: ISO3166.file });
					knownLanguages.loadLanguages(options.urls ? { url: IANA_Subtag_Registry.url } : { file: IANA_Subtag_Registry.file });
					knownGenres.loadCS(
						options.urls ? { urls: [TVA_ContentCS.url, TVA_FormatCS.url, DVBI_ContentSubject.url] } : { files: [TVA_ContentCS.file, TVA_FormatCS.file, DVBI_ContentSubject.file] }
					);
					csr.loadDataFiles(options.urls, knownLanguages, knownCountries, knownGenres);
					csr.loadServiceListRegistry(options.file);
					break;
			}
	});


	if (!StartServers(app, options)){
		console.log(chalk.red("No listeners - exiting!!"));
		process.exit(1);
	}
}
