/**
 * csr.ts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * An standalone runner for a service list entry point registry (SLEPR) that can be used as a Central Service List Registry (CSR)
 */
import { join } from "path"
import { createServer } from "https"
import cluster from "cluster"
import { cpus } from "os"
import process from "process"
import { readFileSync, existsSync } from "fs"

import chalk from "chalk"
import express from "express"
import morgan, { token } from "morgan"
import favicon from "serve-favicon"
import commandLineArgs from "command-line-args"
import commandLineUsage from "command-line-usage"
import cors from "cors"
import { Server } from "https"
import type { AddressInfo } from "node:net"
import { createStream } from "rotating-file-stream";

import { xmlRegisterFsInputProviders } from "libxml2-wasm/lib/nodejs.mjs"
xmlRegisterFsInputProviders();

import { Default_SLEPR, IANA_Subtag_Registry, ISO3166, TVA_ContentCS, TVA_FormatCS, DVBI_ContentSubject } from "./lib/data_locations.mts"
import { CORSlibrary, CORSmanual, CORSnone, CORSoptions, HTTPPort } from "./lib/globals.mts"
import type { StatsType } from "./lib/globals.mts"
import { readmyfile } from "./lib/utils.mts"

import IANAlanguages from "./lib/IANA_languages.mts"
import ISOcountries from "./lib/ISO_countries.mts"
import ClassificationScheme from "./lib/classification_scheme.mts"
import { __dirname } from "./lib/data_locations.mts"

const keyFilename = join(".", "selfsigned.key"),
	certFilename = join(".", "selfsigned.crt");

const numCPUs = cpus().length;
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), { encoding: "utf-8" }).toString());

// SLEPR == Service List Entry Point Registry
import SLEPR from "./lib/slepr.mts";
import { DEFAULT_PROCESSING, SLR_Processing_Modes } from "./lib/slepr.mts";

import { init_spam_blocker } from "./lib/spam_disruptions.mts";

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
		description: `type of CORS handling ${CORSlibrary.quote()} (default), ${CORSmanual.quote()} or ${CORSnone.quote()}`,
	},
	{ name: "workers", alias: "w", type: Number, defaultValue: numCPUs, description: "The number of worker threads to spawn" },
	{
		name: "SLRmode",
		type: String,
		defaultValue: DEFAULT_PROCESSING,
		typeLabel: "{underline mode}",
		description: `The type of processing for the SLR response [${SLR_Processing_Modes.join(",")}]`,
	},
	{ name: "spam_blocker", alias: "b", type: Boolean, defaultValue: false, description: "enable frustrator for network scanners"},
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (err) {
	console.log(commandLineUsage(commandLineHelp));
	process.exit(1);
}

if (options.help) {
	console.log(commandLineUsage(commandLineHelp));
	process.exit(0);
}

if (!CORSoptions.includes(options.CORSmode)) {
	console.log(chalk.red(`CORSmode must be ${CORSnone.quote()}, ${CORSlibrary.quote()} to use the Express cors() handler, or ${CORSmanual.quote()} to have headers inserted manually`));
	process.exit(1);
}

if (!SLR_Processing_Modes.includes(options.SLRmode)) {
	console.log(chalk.red(`SLRmode must be one of [${SLR_Processing_Modes.join(", ")}]`));
	process.exit(1);
}

if (options.urls && options.CSRfile == Default_SLEPR.file) options.CSRfile = Default_SLEPR.url;

const knownLanguages = new IANAlanguages();
knownLanguages.loadLanguages(
	options.urls ? { url: IANA_Subtag_Registry.url } : { file: IANA_Subtag_Registry.file },
	{async: true, verbose: true, useURLs: options.urls}
);

const knownCountries = new ISOcountries(false, true);
knownCountries.loadCountries(
	options.urls ? { url: ISO3166.url } : { file: ISO3166.file },
{async: true, verbose: true, useURLs: options.urls}
);

const knownGenres = new ClassificationScheme();
knownGenres.loadCS(
	options.urls 
		? { urls: [TVA_ContentCS.url, TVA_FormatCS.url, DVBI_ContentSubject.url] as string[] } 
		: { files: [TVA_ContentCS.file, TVA_FormatCS.file, DVBI_ContentSubject.file] },
	{async: true, verbose: true, useURLs: options.urls}
);

const RELOAD = "RELOAD",
	UPDATE = "UPDATE",
	INCR_REQUESTS = "REQUESTS++",
	INCR_FAILURES = "FAILURES++",
	STATS = "STATS";

type IPCmessage = {
	topic: string
}

if (cluster.isPrimary) {
	if (options.workers > numCPUs) options.workers = numCPUs;
	else if (options.workers < 1) options.workers = 1;
	console.log(chalk.green(`Number of CPUs is ${numCPUs}, ${options.workers} workers`));
	console.log(chalk.green(`Primary ${process.pid} is running`));

	const metrics = {
		numRequests: 0,
		numFailed: 0,
		reloadRequests: 0,
	};

	// Fork workers.
	for (let i = 0; i < options.workers; i++) 
		cluster.fork();

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	cluster.on("exit", (worker, code, signal) => {
		console.log(chalk.red(`worker ${worker.process.pid} died`));
		console.log(chalk.red("Let's fork another worker!"));
		cluster.fork();
	});
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	cluster.on("message", (worker, msg: IPCmessage, handle) => {
		if (msg.topic)
			switch (msg.topic) {
				case RELOAD:
					metrics.reloadRequests++;
					for (const id in cluster.workers) {
						// Here we notify each worker of the updated value
						cluster.workers[id]?.send({ topic: UPDATE });
					}
					break;
				case INCR_REQUESTS:
					metrics.numRequests++;
					break;
				case INCR_FAILURES:
					metrics.numFailed++;
					break;
				case STATS:
					// eslint-disable-next-line no-case-declarations
					const kl: StatsType = {};
					knownLanguages.stats(kl);
					console.log(`knownLanguages.length=${kl.numLanguages}`);
					console.log(`numCPUs=${numCPUs}`);
					console.log(`knownCountries.length=${knownCountries.count()}`);
					console.log(`requests=${metrics.numRequests} failed=${metrics.numFailed} reloads=${metrics.reloadRequests}`);
					console.log(`SLEPR file=${options.CSRfile}`);
					console.log(`application version=${pkg?.version ? pkg.version : "unknown"}`);
					break;
			}
	});
} 
else {
	const app = express();
	app.use(cors());
	token("protocol", (req: express.Request) => {
		return req.protocol;
	});
	token("agent", (req: express.Request) => {
		return `(${req.headers["user-agent"]})`;
	});
	token("vary", (req: express.Request, res: express.Response) => {
		return (res.varyOn && res.varyOn.size > 0) ? `vary(${[...res.varyOn!].join(",")})` : "-";
	});
	token("parseErr", (req: express.Request) => {
		return req?.parseErr ? `(${req.parseErr})` : "";
	});

	const getSource = (req: express.Request) => req.ip || /*req._remoteAddress ||*/ (req.socket && req.socket.remoteAddress) ||  undefined;
	token("redirect", (req: express.Request, res: express.Response) => {
		return [301,302].includes(res.statusCode) ? `redirect(${req.socket.remoteFamily}-${getSource(req)}` : "";
	});

	const SLEPR_query_route = "/query",
		SLEPR_reload_route = "/reload",
		SLEPR_stats_route = "/stats";

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type nextFn = (err?: any) => any  // cors module doesnot strictly type this
	let manualCORS = function (req: express.Request, res: express.Response, next: nextFn) {
		next();
	};
	if (options.CORSmode == CORSlibrary) {
		app.use(cors());
	} else if (options.CORSmode == CORSmanual) {
		manualCORS = function (req: express.Request, res: express.Response, next: nextFn) {
			let opts : string[] | undefined = res.getHeader("X-Frame-Options") as string[] | undefined;
			if (opts) {
				if (!opts.includes("SAMEORIGIN")) 
					opts.push("SAMEORIGIN");
			} 
			else opts = ["SAMEORIGIN"];
			res.setHeader("X-Frame-Options", opts);
			res.setHeader("Access-Control-Allow-Origin", "*");
			next();
		};
	}

	const csr = new SLEPR(options.urls, options.SLRmode, knownLanguages, knownCountries, knownGenres);
	csr.loadServiceListRegistry(options.CSRfile);

	const LOG_FORMAT = ":pid :remote-addr :protocol :method :url :status :res[content-length] - :response-time ms :agent :parseErr :vary :redirect"
	app.use(morgan(LOG_FORMAT));
	
	const logDir = join(".", "logs");
	if (existsSync(logDir)) {
		const logStream = createStream('access.log', {
			interval: "1M", // rotate daily
			compress: "gzip", // compress rotated files
			path: logDir,
		})
		app.use(morgan(LOG_FORMAT, {stream: logStream}));
	}


	app.use(favicon(join("icon", "ph-icon.ico")));
	if (options.CORSmode == CORSlibrary) 
		app.options(SLEPR_query_route, cors());
	else if (options.CORSmode == CORSmanual) 
		app.options(SLEPR_query_route, manualCORS);
	app.get(SLEPR_query_route, (req: express.Request, res: express.Response) => {
		if (process.send) process.send({ topic: INCR_REQUESTS });
		if (!csr.processServiceListRequest(req, res)) 
			if (process.send) process.send({ topic: INCR_FAILURES });
		res.end();
	});
	app.get(SLEPR_reload_route, (req: express.Request, res: express.Response) => {
		if (process.send) process.send({ topic: RELOAD });
		res.status(404).end();
	});
	app.get(SLEPR_stats_route, (req: express.Request, res: express.Response) => {
		if (process.send) process.send({ topic: STATS });
		res.status(404).end();
	});

	if (options.spam_blocker) {
		init_spam_blocker(app);
	}

	app.get("{*splat}", (req: express.Request, res: express.Response) => {
		res.status(404).end();
	});

	process.on("message", (msg: IPCmessage) => {
		if (msg.topic)
			switch (msg.topic) {
				case UPDATE:
					knownCountries.loadCountries(
						options.urls ? { url: ISO3166.url } : { file: ISO3166.file },
						{useURLs: options.urls, async: true, verbose: false},
					);
					knownLanguages.loadLanguages(
						options.urls ? { url: IANA_Subtag_Registry.url } : { file: IANA_Subtag_Registry.file },
						{useURLs: options.urls, async: true, verbose: false},
					);
					knownGenres.loadCS(
						options.urls 
							? { urls: [TVA_ContentCS.url, TVA_FormatCS.url, DVBI_ContentSubject.url] as string[] } 
							: { files: [TVA_ContentCS.file, TVA_FormatCS.file, DVBI_ContentSubject.file] },
						{useURLs: options.urls, async: true, verbose: false},
					);
					csr.loadDataFiles(options.urls, knownLanguages, knownCountries, knownGenres);
					csr.loadServiceListRegistry(options.CSRfile);
					break;
			}
	});

	// start the HTTP server
	const http_server = app.listen(options.port, () => {
		if ((http_server.address() as AddressInfo).port) 
			console.log(chalk.cyan(`HTTP listening on port number ${(http_server.address() as AddressInfo).port}`));
		else console.log(chalk.red(`HTTP port ${options.port} already in use -- HTTP server not started`));
	});
	// start the HTTPS server
	// sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt
	const https_options = {
		key: readmyfile(keyFilename, {}) as Buffer,
		cert: readmyfile(certFilename, {}) as Buffer,
	};
	if (https_options.key && https_options.cert) {
		if (options.sport == options.port) options.sport = options.port + 1;

		const https_server : Server = createServer(https_options, app);
		https_server.listen(options.sport, () => {
			console.log(chalk.cyan(`HTTPS listening on port number ${(https_server!.address() as AddressInfo).port}, PID=${process.pid}`));
		});
	}
}
