/**
 * csr.js
 *
 * An standalone runner for a service list entry point registry (SLEPR) that can be used as a Central Service List Registry (CSR)
 */
import { join } from "path";
import { createServer } from "https";
import cluster from "cluster";
import { cpus } from "os";
import process from "process";

import chalk from "chalk";
import express from "express";
import morgan, { token } from "morgan";
import favicon from "serve-favicon";
import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";
import cors from "cors";

import { Libxml2_wasm_init } from "./libxml2-wasm-extensions.mjs";
Libxml2_wasm_init();

import { Default_SLEPR, IANA_Subtag_Registry, ISO3166, TVA_ContentCS, TVA_FormatCS, DVBI_ContentSubject } from "./lib/data_locations.mjs";
import { CORSlibrary, CORSmanual, CORSnone, CORSoptions, HTTPPort } from "./lib/globals.mjs";
import { readmyfile } from "./lib/utils.mjs";

import IANAlanguages from "./lib/IANA_languages.mjs";
import ISOcountries from "./lib/ISO_countries.mjs";
import ClassificationScheme from "./lib/classification_scheme.mjs";

const keyFilename = join(".", "selfsigned.key"),
	certFilename = join(".", "selfsigned.crt");

const numCPUs = cpus().length;

// SLEPR == Service List Entry Point Registry
import SLEPR from "./lib/slepr.mjs";

import { DEFAULT_PROCESSING, SLR_Processing_Modes } from "./lib/slepr.mjs";

// command line options
const optionDefinitions = [
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
		description: `type of CORS handling "${CORSlibrary}" (default), "${CORSmanual}" or "${CORSnone}"`,
	},
	{ name: "workers", alias: "w", type: Number, defaultValue: numCPUs, description: "The number of worker threads to spawn" },
	{
		name: "SLRmode",
		type: String,
		defaultValue: DEFAULT_PROCESSING,
		typeLabel: "{underline mode}",
		description: `The type of processing for the SLR response [${SLR_Processing_Modes.join(",")}]`,
	},
	{ name: "help", alias: "h", type: Boolean, defaultValue: false, description: "This help" },
];

const commandLineHelp = [
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

let options = null;
try {
	options = commandLineArgs(optionDefinitions);
} catch (/* eslint-disable no-unused-vars*/ err /* eslint-enable */) {
	console.log(commandLineUsage(commandLineHelp));
	process.exit(1);
}

if (options.help) {
	console.log(commandLineUsage(commandLineHelp));
	process.exit(0);
}

if (!CORSoptions.includes(options.CORSmode)) {
	console.log(chalk.red(`CORSmode must be "${CORSnone}", "${CORSlibrary}" to use the Express cors() handler, or "${CORSmanual}" to have headers inserted manually`));
	process.exit(1);
}

if (!SLR_Processing_Modes.includes(options.SLRmode)) {
	console.log(chalk.red(`SLRmode must be one of [${SLR_Processing_Modes.join(", ")}]`));
	process.exit(1);
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
	if (options.workers > numCPUs) options.workers = numCPUs;
	else if (options.workers < 1) options.workers = 1;
	console.log(chalk.green(`Number of CPUs is ${numCPUs}, ${options.workers} workers`));
	console.log(chalk.green(`Primary ${process.pid} is running`));

	let metrics = {
		numRequests: 0,
		numFailed: 0,
		reloadRequests: 0,
	};

	// Fork workers.
	for (let i = 0; i < options.workers; i++) {
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
					for (const id in cluster.workers) {
						// Here we notify each worker of the updated value
						cluster.workers[id].send({ topic: UPDATE });
					}
					break;
				case INCR_REQUESTS:
					metrics.numRequests++;
					break;
				case INCR_FAILURES:
					metrics.numFailed++;
					break;
				case STATS:
					console.log(`knownLanguages.length=${knownLanguages.languagesList.length}`);
					console.log(`numCPUs=${numCPUs}`);
					console.log(`knownCountries.length=${knownCountries.count()}`);
					console.log(`requests=${metrics.numRequests} failed=${metrics.numFailed} reloads=${metrics.reloadRequests}`);
					console.log(`SLEPR file=${options.file}`);
					break;
			}
	});
} else {
	let app = express();
	app.use(cors());
	token("pid", () => {
		return process.pid;
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
	let csr = new SLEPR(options.urls, options.SLRmode);
	csr.loadServiceListRegistry(options.CSRfile, knownLanguages, knownCountries, knownGenres);
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
	// start the HTTP server
	let http_server = app.listen(options.port, (error) => {
		if (error) {
			throw error;
		}
		console.log(chalk.cyan(`HTTP listening on port number ${http_server.address().port}, PID=${process.pid}`));
	});
	// start the HTTPS server
	// sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt
	let https_options = {
		key: readmyfile(keyFilename),
		cert: readmyfile(certFilename),
	};
	if (https_options.key && https_options.cert) {
		if (options.sport == options.port) options.sport = options.port + 1;

		let https_server = createServer(https_options, app);
		https_server.listen(options.sport, (error) => {
			if (error) {
				throw error;
			}
			console.log(chalk.cyan(`HTTPS listening on port number ${https_server.address().port}, PID=${process.pid}`));
		});
	}
}
