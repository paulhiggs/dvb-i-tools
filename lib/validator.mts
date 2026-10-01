/**
 * validator.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 *
 */

import { join } from "path"
import { createServer } from "https"
import os from "node:os"
import process from "process"
import { readFileSync, existsSync } from "fs"
import cluster from "cluster"
import { cpus } from "os"
const numCPUs = cpus().length;

import chalk from "chalk"
import cors from "cors"
import express from "express"
import session from "express-session"
import morgan, { token } from "morgan"
import fileupload from "express-fileupload"
import favicon from "serve-favicon"
import fetchS from "sync-fetch"
import commandLineArgs from "command-line-args"
import { Server } from "https"
import type { AddressInfo } from "node:net"
import { createStream } from "rotating-file-stream";

import { fetch_options, CORSlibrary, CORSmanual, CORSnone, CORSoptions } from "./globals.mts"
import { Default_SLEPR, __dirname } from "./data_locations.mts"
import { drawForm, PAGE_TOP, PAGE_BOTTOM, drawResults, LINE, MODE_URL, MODE_FILE, MODE_SL, MODE_PL, MODE_CG, MODE_SLR, MODE_UNSPECIFIED } from "./ui.mts"
import type {FormModes} from './ui.mts'
import ErrorList from "./error_list.mts"
import { isHTTPURL } from "./pattern_checks.mts"
import { readmyfile, HasProperty } from "./utils.mts"
import {
	LoadGenres,
	LoadRatings,
	LoadVideoCodecCS,
	LoadAudioCodecCS,
	LoadAudioPresentationCS,
	LoadAccessibilityPurpose,
	LoadAudioPurpose,
	LoadSubtitleCodings,
	LoadSubtitlePurposes,
	LoadLanguages,
	LoadCountries,
	LoadSubtitleCarriages,
	LoadLinkedApplicationCS,
} from "./classification_scheme_loaders.mts"
import ServiceListCheck from "./sl_check.mts"
import PlaylistCheck from "./playlist_check.mts"
import ContentGuideCheck from "./cg_check.mts"
import ServiceListRegistryCheck from "./slr_check.mts"
import SLEPR from "./slepr.mts"
import writeOut, { createPrefix } from "./logger.mts"
import { init_spam_blocker } from "./spam_disruptions.mts"
import { GERMAN_A177r6_VARIANT } from "./globals.mts"

let csr: SLEPR | null= null;

const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), { encoding: "utf-8" }).toString());

const keyFilename = join(".", "selfsigned.key"),
	certFilename = join(".", "selfsigned.crt");

function DVB_I_check(
		req: express.Request, res: express.Response, 
		slcheck: ServiceListCheck | null, plcheck: PlaylistCheck | null, cgcheck: ContentGuideCheck | null, slrcheck: ServiceListRegistryCheck | null, 
		hasSL: boolean, hasPL: boolean, hasCG: boolean, hasSLR: boolean, 
		motd: string | undefined, 
		mode: string = MODE_UNSPECIFIED, linktype: string = MODE_UNSPECIFIED) : void {
			
	if (!req.session.data) {
		// setup defaults
		req.session.data = {};
		req.session.data.lastUrl = "";
		req.session.data.mode = mode == MODE_UNSPECIFIED ? (hasSL ? MODE_SL : MODE_CG) : mode;
		req.session.data.entry = linktype == MODE_UNSPECIFIED ? MODE_URL : linktype;
		if (cgcheck) req.session.data.cgmode = cgcheck.supportedRequests[0].value;
		req.session.data.forGermany = false;
	}
	if (req.session.data.lastUrl != req.url) {
		req.session.data.mode = mode == MODE_UNSPECIFIED ? (hasSL ? MODE_SL : MODE_CG) : mode;
		req.session.data.entry = linktype == MODE_UNSPECIFIED ? MODE_URL : linktype;
		req.session.data.lastUrl = req.url;
	}
	
	const FormArguments: FormModes = { cg: MODE_CG, sl: MODE_SL, pl: MODE_PL, slr: MODE_SLR, file: MODE_FILE, url: MODE_URL, hasSL: hasSL, hasPL: hasPL, hasCG: hasCG, hasSLR: hasSLR };
	if (!req.body?.testtype) 
		drawForm(req, res, FormArguments, (cgcheck && cgcheck.supportedRequests) ? cgcheck.supportedRequests : null, motd, undefined, undefined);
	else {
		let VVxml: string | null = null;
		req.parseErr = undefined;

		if (req.body.testtype == MODE_CG && req.body.requestType.length == 0) req.parseErr = ["request type not specified"]
		else if (req.body.doclocation == MODE_URL && req.body.XMLurl.length == 0) req.parseErr = ["URL not specified"]
		else if (req.body.doclocation == MODE_FILE && !(req.files && req.files.XMLfile)) req.parseErr = ["File not provided"]

		req.session.data.forGermany = req.body.forGermany == "on";
		const log_prefix = createPrefix(req);
		if (!req.parseErr)
			switch (req.body.doclocation) {
				case MODE_URL:
					if (isHTTPURL(req.body.XMLurl)) {
						let resp = null;
						try {
							resp = fetchS(req.body.XMLurl, fetch_options);
						} catch (error) {
							req.parseErr = [`${error}`];
						}
						if (resp) {
							if (resp.ok) VVxml = resp.text();
							else req.parseErr = [`error (${resp.status}:${resp.statusText}) handling ${req.body.XMLurl}`];
						}
					} else req.parseErr = [`${req.body.XMLurl} is not an HTTP(S) URL`];
					req.session.data.url = req.body.XMLurl;
					break;
				case MODE_FILE:
					try {
						VVxml = (req.files!.XMLfile as fileupload.UploadedFile).data.toString();
					} catch (err) {
						req.parseErr = [`retrieval of FILE ${(req.files!.XMLfile as fileupload.UploadedFile).name} failed (${err})`];
					}
					req.session.data.url = undefined;
					break;
				default:
					req.parseErr = [`method is not ${MODE_URL.quote()} or ${MODE_FILE.quote()}`];
			}
		const errs = new ErrorList();
		if (!req.parseErr && VVxml)
			switch (req.body.testtype) {
				case MODE_CG:
					if (cgcheck) cgcheck.doValidateContentGuide(VVxml, req.body.requestType, errs, { log_prefix: log_prefix, report_schema_version: true });
					break;
				case MODE_SL:
					if (slcheck) slcheck.doValidateServiceList(VVxml, errs, { log_prefix: log_prefix, report_schema_version: true, variants: req.session.data.forGermany ? GERMAN_A177r6_VARIANT : 0});
					break;
				case MODE_PL:
					if (plcheck) plcheck.doValidatePlaylist(VVxml, errs, { log_prefix: log_prefix, report_schema_version: true });
					break;
				case MODE_SLR:
					if (slrcheck) slrcheck.doValidateServiceListRegistry(VVxml, errs, { log_prefix: log_prefix, report_schema_version: true });
					break;
			}

		req.session.data.mode = req.body.testtype;
		req.session.data.entry = req.body.doclocation;
		if (req.body.requestType) req.session.data.cgmode = req.body.requestType;
		drawForm(req, res, FormArguments, cgcheck ? cgcheck.supportedRequests : null, motd, req.parseErr, errs);

		req.diags = {};
		req.diags.countErrors = errs.numErrors();
		req.diags.countWarnings = errs.numWarnings();
		req.diags.countInforms = errs.numInformationals();

		writeOut(errs, log_prefix, true, req);
	}
	res.end();
}


/**
 * Validate a service list
 *
 * @param {express.Request}  req           The Express request that triggered the validation
 * @param {express.Response} res           The Express response to be written to the requester
 * @param {ServiceListCheck} slcheck       Initialised Service List validator
 * @param {string | undefined} motd          HTML text for the Message Of The Day
 * @param {boolean}          jsonResponse  Flag indicating that the response should ne JSON format rather than HTML
 */
function validateServiceList(req: express.Request, res: express.Response, slcheck: ServiceListCheck, motd: string | undefined, jsonResponse: boolean) : void {
	const errs = new ErrorList();
	let resp,
		VVxml = null;
	const log_prefix = createPrefix(req);
	if (req.method == "GET") {
		try {
			resp = fetchS(req.query.url as string, fetch_options);
		} catch (error) {
			req.parseErr = [`${error}`];
		}
		if (resp) {
			if (resp.ok) VVxml = resp.text();
			else req.parseErr = [`error (${resp.status}:${resp.statusText}) handling ${req.body.XMLurl}`];
		}
	} else if (req.method == "POST") {
		VVxml = req.body;
	} else {
		res.status(405).end();
	}
	slcheck.doValidateServiceList(VVxml, errs, { log_prefix: log_prefix, report_schema_version: true });
	if (jsonResponse) {
		res.setHeader("Content-Type", "application/json");
		if (req.parseErr) res.write(JSON.stringify({ parseErr: req.parseErr }));
		else delete errs.markupXML;
		res.write(
			JSON.stringify(
				req.query.results && req.query.results == "all" ? { errs } : { errors: errs.errors.length, warnings: errs.warnings.length, informationals: errs.informationals.length }
			)
		);
	} else {
		drawResults(req, res, motd, req.parseErr, errs);
	}
	writeOut(errs, log_prefix, true, req);
	res.end();
}


/**
 * Validate a play list
 *
 * @param {express.Request}  req           The Express request that triggered the validation
 * @param {express.Response} res           The Express response to be written to the requester
 * @param {PlaylistCheck}    plcheck       Initialised play List validator
 * @param {string | undefined} motd          HTML text for the Message Of The Day
 * @param {boolean}          jsonResponse  Flag indicating that the response should ne JSON format rather than HTML
 */
function validatePlaylist(req: express.Request, res: express.Response, plcheck: PlaylistCheck, motd: string | undefined, jsonResponse: boolean) : void {
	const errs = new ErrorList();
	let resp,
		VVxml = null;
	const log_prefix = createPrefix(req);
	if (req.method == "GET") {
		try {
			resp = fetchS(req.query.url as string, fetch_options);
		} catch (error) {
			req.parseErr = [`${error}`]
		}
		if (resp) {
			if (resp.ok) VVxml = resp.text();
			else req.parseErr = [`error (${resp.status}:${resp.statusText}) handling ${req.body.XMLurl}`]
		}
	} else if (req.method == "POST") {
		VVxml = req.body;
	} else {
		res.status(405).end();
	}
	plcheck.doValidatePlaylist(VVxml, errs, { log_prefix: log_prefix, report_schema_version: true });
	if (jsonResponse) {
		res.setHeader("Content-Type", "application/json");
		if (req.parseErr) res.write(JSON.stringify({ parseErr: req.parseErr }));
		else delete errs.markupXML;
		res.write(
			JSON.stringify(
				req.query.results && req.query.results == "all" ? { errs } : { errors: errs.errors.length, warnings: errs.warnings.length, informationals: errs.informationals.length }
			)
		);
	} else {
		drawResults(req, res, motd, req.parseErr, errs);
	}
	writeOut(errs, log_prefix, true, req);
	res.end();
}



/**
 * Validate a service list registry
 *
 * @param {express.Request}          req           The Express request that triggered the validation
 * @param {express.Response}         res           The Express response to be written to the requester
 * @param {ServiceListRegistryCheck} slrcheck       Initialised Service List validator
 * @param {string | undefined}       motd           HTML text for the Message Of The Day
 * @param {boolean}                  jsonResponse   Flag indicating that the response should ne JSON format rather than HTML
 */
function validateServiceListRegistry(req: express.Request, res: express.Response, slrcheck: ServiceListRegistryCheck, motd: string | undefined, jsonResponse: boolean) : void {
	const errs = new ErrorList();
	let resp,
		VVxml = null;
	const log_prefix = createPrefix(req);
	if (req.method == "GET") {
		try {
			resp = fetchS(req.query.url as string, fetch_options);
		} catch (error) {
			req.parseErr =  [`${error}`]
		}
		if (resp) {
			if (resp.ok) VVxml = resp.text();
			else req.parseErr = [`error (${resp.status}:${resp.statusText}) handling ${req.body.XMLurl}`];
		}
	} else if (req.method == "POST") {
		VVxml = req.body;
	} else {
		res.status(405).end();
	}
	slrcheck.doValidateServiceListRegistry(VVxml, errs, { log_prefix: log_prefix, report_schema_version: true });
	if (jsonResponse) {
		res.setHeader("Content-Type", "application/json");
		if (req.parseErr) res.write(JSON.stringify({ parseErr: req.parseErr }));
		else delete errs.markupXML;
		res.write(
			JSON.stringify(
				req.query.results && req.query.results == "all" ? { errs } : { errors: errs.errors.length, warnings: errs.warnings.length, informationals: errs.informationals.length }
			)
		);
	} else {
		drawResults(req, res, motd, req.parseErr, errs);
	}
	writeOut(errs, log_prefix, true, req);
	res.end();
}

/**
 * Validate a content guide metadata
 *
 * @param {express.Request}   req           The Express request that triggered the validation
 * @param {express.Response}  res           The Express response to be written to the requester
 * @param {ContentGuideCheck} cgcheck       Initialised Content Guide Metadata validator
 * @param {string | undefined} motd          HTML text for the Message Of The Day
 * @param {boolean}           jsonResponse  Flag indicating that the response should ne JSON format rather than HTML
 */
function validateContentGuide(req: express.Request, res: express.Response, cgcheck: ContentGuideCheck, motd: string | undefined, jsonResponse: boolean) : void {
	const errs = new ErrorList();
	let resp,
		VVxml = null;
	const log_prefix = createPrefix(req);
	if (req.method == "GET") {
		try {
			resp = fetchS(req.query.url as string, fetch_options);
		} catch (error) {
			console.log(error);
			req.parseErr =  [`${error}`]
		}
		if (resp) {
			if (resp.ok) VVxml = resp.text();
			else req.parseErr = [`error (${resp.status}:${resp.statusText}) handling ${req.body.XMLurl}`]
		}
	} else if (req.method == "POST") {
		VVxml = req.body;
	} else {
		res.status(405).end();
	}
	cgcheck.doValidateContentGuide(VVxml, req.query.type as string, errs, { log_prefix: log_prefix, report_schema_version: true });
	if (jsonResponse) {
		res.setHeader("Content-Type", "application/json");
		if (req.parseErr) res.write(JSON.stringify({ parseErr: req.parseErr }));
		else delete errs.markupXML;
		res.write(
			JSON.stringify(
				req.query.results && req.query.results == "all" ? { errs } : { errors: errs.errors.length, warnings: errs.warnings.length, informationals: errs.informationals.length }
			)
		);
	} else {
		drawResults(req, res, motd, req.parseErr, errs);
	}
	writeOut(errs, log_prefix, true, req);
	res.end();
}


/**
 * Setup the validation and service list registry endpoints
 *
 * @param {commandLineArgs.CommandLineOptions} options   Command Line Arguments - see OptionDefinitions in all-in-one.ts
 */
export default function validator(options: commandLineArgs.CommandLineOptions) : void {
	if (options.nocsr && options.nosl && options.nopl && options.nocg && options.noslr) {
		console.log(chalk.red("nothing to do... exiting"));
		process.exit(1);
	}

	if (!options.nocsr && !HasProperty(options, "CSRfile")) {
		console.log(chalk.red("SLEPR file not specified... exiting"));
		process.exit(1);
	}

	if (!HasProperty(options, "CORSmode")) options.CORSmode = CORSlibrary;
	else if (!CORSoptions.includes(options.CORSmode)) {
		console.log(chalk.red(`CORSmode must be ${CORSnone.quote()}, ${CORSlibrary.quote()} to use the Express cors() handler, or ${CORSmanual.quote()} to have headers inserted manually`));
		process.exit(1);
	}

	let motd: string | undefined = undefined;
	if (HasProperty(options, "motd")) {
		console.log(chalk.yellow("reading Message Of The Day from " + chalk.green(options.motd)));
		motd = readmyfile(options.motd, { encoding: "utf-8", flag: "r" }) as string;
	}

	if (options.workers != 0 && cluster.isPrimary) {
		if (options.workers > numCPUs) options.workers = numCPUs;
		else if (options.workers < 1) options.workers = 1;
		console.log(chalk.green(`Number of CPUs is ${numCPUs}, ${options.workers} workers`));
		console.log(chalk.green(`Primary ${process.pid} is running`));

		// SCHED_RR is the default on all operating systems except Windows. Windows will change to 
		// SCHED_RR once libuv is able to effectively distribute IOCP handles without incurring 
		// a large performance hit.
		cluster.schedulingPolicy = cluster.SCHED_RR

		// Fork workers.
		for (let i = 0; i < options.workers; i++) 
			cluster.fork();

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		cluster.on("exit", (worker, code, signal) => {
			console.log(chalk.red(`worker ${worker.process.pid} died`));
			console.log(chalk.red("Let's fork another worker!"));
			cluster.fork();
		});
	}
	else {

		// initialize Express
		const app = express();
		app.use(cors());

		app.use(express.static(__dirname));

		app.set("view engine", "ejs");
		app.use(fileupload());
		app.use(favicon(join("icon", "ph-icon.ico")));

		token("protocol", (req: express.Request) => {
			return req.protocol;
		});
		token("counts", (req: express.Request) => {
			return req.diags ? `(${req.diags.countErrors},${req.diags.countWarnings},${req.diags.countInforms})` : "[-]";
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
		token("location", (req: express.Request) => {
			return req?.body?.testtype
				? `${req.body.testtype}::[${req.body.testtype == MODE_CG ? `(${req.body.requestType})` : ""}${
						req.body.doclocation == MODE_FILE ? (req.files?.XMLfile ? (req.files.XMLfile as fileupload.UploadedFile).name : "unnamed") : req.body.XMLurl
					}]`
				: "[*]";
		});

		const getSource = (req: express.Request) => req.ip || /*req._remoteAddress ||*/ (req.socket && req.socket.remoteAddress) ||  undefined;
		token("redirect", (req: express.Request, res: express.Response) => {
			return [301,302].includes(res.statusCode) ? `redirect(${req.socket.remoteFamily}-${getSource(req)}` : "";
		});

		const LOGGING_TEMPLATE = ":pid :remote-addr :protocol :method :url :status :res[content-length] :counts - :response-time ms :agent :parseErr :location :vary :redirect"
		app.use(morgan(LOGGING_TEMPLATE));

		const logDir = join(".", "logs");
		if (existsSync(logDir)) {
			const logStream = createStream('access.log', {
				interval: "1M", // rotate daily
				compress: "gzip", // compress rotated files
				path: logDir,
			})
			app.use(morgan(LOGGING_TEMPLATE, {stream: logStream}));
		}

		app.use(express.urlencoded({ extended: true }));

		app.set("trust proxy", 1);
		app.use(
			session({
				secret: "keyboard car",
				resave: false,
				saveUninitialized: true,
				cookie: { maxAge: 60000 },
			})
		);

		let slcheck = null,
			plcheck = null,
			cgcheck = null,
			slrcheck = null;

		const DFLT_async = true, DFLT_verbose = true;

		if (options.urls && options.CSRfile == Default_SLEPR.file) options.CSRfile = Default_SLEPR.url;

		const knownLanguages = LoadLanguages({useURLs: options.urls, async: DFLT_async, verbose: DFLT_verbose});
		const isoCountries = LoadCountries({useURLs: options.urls, async: DFLT_async, verbose: DFLT_verbose});
		const knownGenres = LoadGenres({useURLs: options.urls, async: DFLT_async, verbose: DFLT_verbose});

		if (!options.nosl || !options.nopl || !options.nocg || !options.noslr) {
			const knownRatings = LoadRatings({useURLs: options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const accessibilityPurposes = LoadAccessibilityPurpose({useURLs: options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const audioPurposes = LoadAudioPurpose({useURLs: options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const subtitleCarriages = LoadSubtitleCarriages({useURLs: options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const subtitleCodings = LoadSubtitleCodings({useURLs: options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const subtitlePurposes = LoadSubtitlePurposes({useURLs: options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const videoFormats = LoadVideoCodecCS({useURLs: options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const audioFormats = LoadAudioCodecCS({useURLs: options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const audioPresentation = LoadAudioPresentationCS({useURLs: options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const linkedApplicationTypes = LoadLinkedApplicationCS({useURLs: options.urls, async: DFLT_async, verbose: DFLT_verbose});

			if (!options.nosl)
				slcheck = new ServiceListCheck({
					useURLs: options.urls,
					async: DFLT_async,
					verbose: DFLT_verbose,

					accessibilities: accessibilityPurposes,
					audiofmts: audioFormats,
					audiopres: audioPresentation,
					audiopurps: audioPurposes,
					countries: isoCountries,
					genres: knownGenres,
					languages: knownLanguages,
					stcarriage: subtitleCarriages,
					stcodings: subtitleCodings,
					stpurposes: subtitlePurposes,
					videofmts: videoFormats,
					appfmts: linkedApplicationTypes,
				});

			if (!options.nopl)
				plcheck = new PlaylistCheck( {
					useURLs: options.urls,
					async: DFLT_async,
					verbose: DFLT_verbose,
				});

			if (!options.nocg)
				cgcheck = new ContentGuideCheck({
					useURLs: options.urls,
					async: DFLT_async,
					verbose: DFLT_verbose,

					accessibilities: accessibilityPurposes,
					audiofmts: audioFormats,
					audiopres: audioPresentation,
					audiopurps: audioPurposes,
					countries: isoCountries,
					genres: knownGenres,
					languages: knownLanguages,
					ratings: knownRatings,
					stcarriage: subtitleCarriages,
					stcodings: subtitleCodings,
					stpurposes: subtitlePurposes,
					videofmts: videoFormats,
				});

			if (!options.noslr) 
				slrcheck = new ServiceListRegistryCheck({
					useURLs: options.urls,
					async: DFLT_async,
					verbose: DFLT_verbose,

					countries: isoCountries, 
					genres: knownGenres, 
					languages: knownLanguages, 
					appfmts: linkedApplicationTypes,
				});
		}

		const Express_Options = {
			type: "application/xml", 
			limit: "10mb",
		}

		if (!options.nosl) {
			app.all("/validate_sl", express.text(Express_Options), (req, res) => {
				validateServiceList(req, res, slcheck!, motd, false);
			});

			app.all("/validate_sl_json", express.text(Express_Options), (req, res) => {
				validateServiceList(req, res, slcheck!, motd, true);
			});
		}

		if (!options.nopl) {
			app.all("/validate_pl", express.text(Express_Options), (req, res) => {
				validatePlaylist(req, res, plcheck!, motd, false);
			});

			app.all("/validate_pl_json", express.text(Express_Options), (req, res) => {
				validatePlaylist(req, res, plcheck!, motd, true);
			});
		}

		if (!options.nocg) {
			app.all("/validate_cg", express.text(Express_Options), (req, res) => {
				validateContentGuide(req, res, cgcheck!, motd, false);
			});

			app.all("/validate_cg_json", express.text(Express_Options), (req, res) => {
				validateContentGuide(req, res, cgcheck!, motd, true);
			});
		}

		if (!options.noslr) {
			app.all("/validate_slr", express.text(Express_Options), (req, res) => {
				validateServiceListRegistry(req, res, slrcheck!, motd, false);
			});

			app.all("/validate_slr_json", express.text(Express_Options), (req, res) => {
				validateServiceListRegistry(req, res, slrcheck!, motd, true);
			});
		}

		const SLEPR_query_route = "/query",
			SLEPR_reload_route = "/reload";

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
				} else opts = ["SAMEORIGIN"];
				res.setHeader("X-Frame-Options", opts);
				res.setHeader("Access-Control-Allow-Origin", "*");
				next();
			};
		}

		if (!options.nosl || !options.nopl || !options.nocg || !options.noslr) {
			app.all("/check", express.text(Express_Options), (req, res) => {
				// we need to disable listening as the Windows cluster seems to 'prefer' some workers, expecialy  when the validator is being used to verify 
				// a file it is serving itself (like an SLR respose from `SLEPR_query_route`)
				const saved_port = req.socket.localPort  
				if (cluster.isWorker && options.workers > 1)
					req.socket.server!.close();
				DVB_I_check(req, res, slcheck, plcheck, cgcheck, slrcheck, !options.nosl, !options.nopl, !options.nocg, !options.noslr, motd);
				if (req.socket.server!.listening == false)
					req.socket.server!.listen(saved_port)
			});
		}

		if (!options.nocsr) {
			csr = new SLEPR(options.urls, options.SLRmode, knownLanguages, isoCountries, knownGenres);
			csr.loadServiceListRegistry(options.CSRfile);

			if (options.CORSmode == "manual") {
				app.options(SLEPR_query_route, manualCORS);
			}
			app.get(SLEPR_query_route, manualCORS, (req, res) => {
				csr!.processServiceListRequest(req, res);
				res.end();
			});

			app.get(SLEPR_reload_route, (req, res) => {
				csr!.loadServiceListRegistry(options.CSRfile);
				res.status(200).end();
			});
		}

		if (options.spam_blocker) {
			init_spam_blocker(app);
		}

		const tabulate = function (res: express.Response, group: string, stats: Record<string, string | number>) {
			res.write(`<h1>${group}</h1>`);
			if (Object.keys(stats).length === 0) res.write("<p>No statistics</p>");
			else {
				res.write("<table><tr><th>item</th><th>count</th></tr>");
				Object.getOwnPropertyNames(stats).forEach((key) => res.write(`<tr><td>${key}</td><td>${stats[key]}</td></tr>`));
				res.write("</table>");
			}
			res.write(LINE);
		}

		app.get("/stats", (req, res) => {
			res.setHeader("Content-Type", "text/html");
			res.write(PAGE_TOP("Validator Stats", req.secure));
			tabulate(res, "System", {
				arch: os.arch(),
				endianness: os.endianness(),
				host: os.hostname(),
				os: os.type(),
				numCPUs: os.cpus().length,
				machine: os.machine(),
				platform: os.platform(),
				release: os.release(),
				version: os.version(),
				node: process.version,
			});
			tabulate(res, "Application", {
				version: pkg?.version ? pkg.version : "unknown",
			});
			const InactiveFeatureStats = { active: "false" };
			tabulate(res, "CSR", csr ? csr.stats() : InactiveFeatureStats);
			tabulate(res, "SL", slcheck ? slcheck.stats()  : InactiveFeatureStats);
			tabulate(res, "PL", plcheck ? plcheck.stats() : InactiveFeatureStats);
			tabulate(res, "SLR", slrcheck ? slrcheck.stats() : InactiveFeatureStats);
			tabulate(res, "CG", cgcheck ? cgcheck.stats() : InactiveFeatureStats);
			res.write(PAGE_BOTTOM);
			res.status(200).end();
		});

		const tabularize = function(res : express.Response, groupname: string, values: string[] ) {
			res.write(`<h1>${groupname}</h1>`);
			if (values.length == 0)
				res.write("<p>No values</p>");
			else {
				res.write("<table>");
				let maxLen = 0;
				values.forEach((value) => {if (value.length > maxLen) maxLen = value.length});
				let firstRow = true; 
				for (let i=0; i<values.length; i++) {
					if (i % (maxLen > 4 ? 10 : 20) == 0) {
						res.write(`${firstRow ? "" : "</tr>"}<tr>`)
						firstRow = false;
					}
					res.write(`<td>${values[i]}</td>`);
				}
				res.write("</table>");
			}
		}
		app.get("/langs", (req: express.Request, res: express.Response) => {
			res.setHeader("Content-Type", "text/html");
			res.write(PAGE_TOP("Languages", req.secure));

			let langs: Record<string, string[]> = {empty: []} 
			if (slcheck) langs = slcheck.langs(true) as Record<string, string[]>;

			if (HasProperty(langs, "empty"))
				res.write("<p>No statistics</p>");
			else {
				Object.getOwnPropertyNames(langs).forEach((key) => tabularize(res, key, langs[key] as string[]));
			}
			res.write(PAGE_BOTTOM);
			res.status(200).end();
		});

		app.get("{*splat}", (req, res) => {
			res.status(404).end();
		});


		// start the HTTPS server
		// sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt
		const https_options = {
			key: readmyfile(keyFilename, {}) as Buffer,
			cert: readmyfile(certFilename, {}) as Buffer,
		};
		let https_server : Server | null = null;

		if (https_options.key && https_options.cert) {
			if (options.sport == options.port) options.sport = options.port + 1;

			https_server = createServer(https_options, app);
			https_server.listen(options.sport, () => {
				console.log(chalk.cyan(`HTTPS listening on port number ${(https_server!.address() as AddressInfo).port}`));

				const redirect_app = express();
				redirect_app.use(morgan(LOGGING_TEMPLATE));
				redirect_app.use(function(req, res) {
					res.redirect(`https://${req.hostname}:${options.sport}${req.originalUrl}`);
				})
				redirect_app.listen(options.port, () => {
					console.log(chalk.cyan(`HTTP redirecting to HTTPS on port number ${options.port}`));
				});
			});
		}

		const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
		delay(3000); // give the HTTPS server time to start before starting the HTTP server

		if (!https_server?.listening) {
		// start the HTTP server
			const http_server = app.listen(options.port, () => {
				if ((http_server.address() as AddressInfo).port) 
					console.log(chalk.cyan(`HTTP listening on port number ${(http_server.address() as AddressInfo).port}`));
				else console.log(chalk.red(`HTTP port ${options.port} already in use -- HTTP server not started`));
			});
		}
	}
}
