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
import cors from "cors"
import { Server } from "https"
import type { AddressInfo } from "node:net"
import { createStream } from "rotating-file-stream";

import { xmlRegisterFsInputProviders } from "libxml2-wasm/lib/nodejs.mjs"
xmlRegisterFsInputProviders();

import { Default_SLEPR, IANA_Subtag_Registry, ISO3166, TVA_ContentCS, TVA_FormatCS, DVBI_ContentSubject } from "./lib/data_locations.mts"
import { CORSlibrary, CORSmanual, CORSnone, CORSoptions, read_string_options, setSystemSettings } from "./lib/globals.mts"
import type { StatsType } from "./lib/globals.mts"
import { readmyfile } from "./lib/utils.mts"

import IANAlanguages from "./lib/IANA_languages.mts"
import ISOcountries from "./lib/ISO_countries.mts"
import ClassificationScheme from "./lib/classification_scheme.mts"
import { __dirname } from "./lib/data_locations.mts"
import { restartWorkersOnExit } from "./lib/cluster_restart.mts"
import { commandLineOptions } from "./lib/command_line.mts"

import {} from "./lib/string-extensions.mts"

const numCPUs = cpus().length;
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), read_string_options).toString());

// SLEPR == Service List Entry Point Registry
import SLEPR from "./lib/slepr.mts";
import { SLR_Processing_Modes } from "./lib/slepr.mts";
import { sendRegistryResponse } from "./lib/routes/slepr.mts";

import { init_spam_blocker } from "./lib/spam_disruptions.mts";

// the options of the command line and the configuration files (csr.json, or the file given with --config, issue #147)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const options: Record<string, any> = commandLineOptions("csr");
// the User-Agent and timeout of the retrievals of reference data (with --urls), the shutdown grace period and the log folder
setSystemSettings({ userAgent: options.user_agent, fetchTimeoutMs: options.fetch_timeout_ms, shutdownGraceMs: options.shutdown_grace_ms, logFolder: options.logs });

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
	// 0 (the default) is one worker for each CPU
	if (options.workers > numCPUs || options.workers == 0) options.workers = numCPUs;
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

	restartWorkersOnExit();
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
	token("protocol", (req: express.Request) => {
		return req.protocol;
	});
	token("agent", (req: express.Request) => {
		return `(${req.headers["user-agent"]})`;
	});
	token("vary", (req: express.Request, res: express.Response) => {
		return res.locals.vary && res.locals.vary.length > 0 ? `vary(${res.locals.vary.join(",")})` : "-";
	});
	token("parseErr", (req: express.Request, res: express.Response) => {
		return res.locals.parseErr ? `(${res.locals.parseErr})` : "";
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
	
	const logDir = options.logs;
	if (existsSync(logDir)) {
		const logStream = createStream('access.log', {
			interval: "1M", // rotate monthly
			compress: "gzip", // compress rotated files
			path: logDir,
		})
		app.use(morgan(LOG_FORMAT, {stream: logStream}));
	}


	app.use(favicon(join(__dirname, "icon", "ph-icon.ico")));
	// in library mode, cors() is already applied to all routes by app.use() above
	if (options.CORSmode == CORSmanual)
		app.options(SLEPR_query_route, manualCORS);
	app.get(SLEPR_query_route, manualCORS, (req: express.Request, res: express.Response) => {
		if (process.send) process.send({ topic: INCR_REQUESTS });
		const response = csr.processServiceListRequest(req.query, req.get("user-agent"));
		if (response.status != 200 && process.send) process.send({ topic: INCR_FAILURES });
		sendRegistryResponse(res, response);
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
		init_spam_blocker(app, { endpoints: options.spam_endpoints, protocol: options.spam_protocol, redirections: options.spam_redirections });
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
		key: readmyfile(options.tls_key, {}) as Buffer,
		cert: readmyfile(options.tls_certificate, {}) as Buffer,
	};
	if (https_options.key && https_options.cert) {
		if (options.sport == options.port) options.sport = options.port + 1;

		const https_server : Server = createServer(https_options, app);
		https_server.listen(options.sport, () => {
			console.log(chalk.cyan(`HTTPS listening on port number ${(https_server!.address() as AddressInfo).port}, PID=${process.pid}`));
		});
	}
}
