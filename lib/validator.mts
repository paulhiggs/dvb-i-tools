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

import { fetch_options, read_string_options, CORSlibrary, CORSmanual, CORSnone, CORSoptions } from "./globals.mts"
import type { StatsType } from "./globals.mts"
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
import type { SL_Validator_Options } from "./sl_check.mts"
import PlaylistCheck from "./playlist_check.mts"
import ContentGuideCheck from "./cg_check.mts"
import type { CG_Validator_Options } from "./cg_check.mts"
import ServiceListRegistryCheck from "./slr_check.mts"
import SLEPR from "./slepr.mts"
import document_logger, { createPrefix } from "./logger.mts"
import { init_spam_blocker } from "./spam_disruptions.mts"
import { GERMAN_A177r6_VARIANT } from "./globals.mts"

// initialise string formatting extensions
import {} from "./string-extensions.mts"
import { CaseInsensitiveSet } from "./StringSet.ts"

let csr: SLEPR | null= null;
     
export type ValidationSession = {
	req: express.Request										// The Express request that triggered the validation
	res: express.Response										// The Express response to be written to the requester
	slrChecker?: ServiceListRegistryCheck		// Initialised Service List Registry validator
	slChecker?: ServiceListCheck						// Initialised Service List validator
	cgChecker?: ContentGuideCheck						// Content Guide metadata validator
	plChecker?: PlaylistCheck								// Initialised Playlist validator
	traverse: boolean												// Validate documents referenced from teh initial document
	traversedPaths?: CaseInsensitiveSet			// URLs of documents already checked/validated (avoids duplictated validation and loops)
	errs?: ErrorList
	jsonResponse?: boolean
}

const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), read_string_options).toString());

const keyFilename: string = join(".", "selfsigned.key"),
	certFilename: string = join(".", "selfsigned.crt");

function getDocument(req: express.Request, res: express.Response) : string | null {
	let resp = null
	if (req.method == "GET") {
		try {
			resp = fetchS(req.query.url as string, fetch_options)
		} catch (error) {
			req.parseErr = [`${error}`]
		}
		if (resp) {
			if (resp.ok) 
				return resp.text()
			else req.parseErr = [`error (${resp.status}:${resp.statusText}) handling ${req.body.XMLurl}`]
		}
	} 
	else if (req.method == "POST")
		return req.body
	else 
		res.status(405)
	return null
}

function getVariant(req: express.Request) : number {
	switch (req.method) {
		case "GET":
			if (req.query?.variants && (req.query.variants as string).toLowerCase() == "de")
				return GERMAN_A177r6_VARIANT
			break
		case "POST":
			if (req.header("X-variants")?.toLowerCase() == "de")
				return GERMAN_A177r6_VARIANT
			break
	}
	return 0
}


function report(session: ValidationSession, motd: string | undefined) : void {
	if (session.jsonResponse) {
		session.res.setHeader("Content-Type", "application/json")
		if (session.req.parseErr) 
			session.res.write(JSON.stringify({ parseErr: session.req.parseErr }))
		else delete session.errs?.markupXML
		session.res.write(
			JSON.stringify(
				session.req.query.results && session.req.query.results == "all" 
					?  session.errs 
					: { errors: session.errs?.errors.length, warnings: session.errs?.warnings.length, informationals: session.errs?.informationals.length }
			)
		)
	}
	else 
		drawResults(session, motd)
}


function DVB_I_check(
		session: ValidationSession,
		hasSL: boolean, hasPL: boolean, hasCG: boolean, hasSLR: boolean, 
		allow_traversal: boolean,
		motd: string | undefined, 
		mode: string = MODE_UNSPECIFIED, linktype: string = MODE_UNSPECIFIED) : void {

	if (!session.req.session.data) {
		// setup defaults
		session.req.session.data = {};
		session.req.session.data.lastUrl = "";
		session.req.session.data.mode = mode == MODE_UNSPECIFIED ? (hasSL ? MODE_SL : MODE_CG) : mode;
		session.req.session.data.entry = linktype == MODE_UNSPECIFIED ? MODE_URL : linktype;
		if (session.cgChecker)session. req.session.data.cgmode = session.cgChecker.supportedRequests[0].value;
		session.req.session.data.forGermany = false;
		session.req.session.data.traverse = false;
	}
	if (session.req.session.data.lastUrl != session.req.url) {
		session.req.session.data.mode = mode == MODE_UNSPECIFIED ? (hasSL ? MODE_SL : MODE_CG) : mode;
		session.req.session.data.entry = linktype == MODE_UNSPECIFIED ? MODE_URL : linktype;
		session.req.session.data.lastUrl = session.req.url;
	}
	
	const FormArguments: FormModes = { cg: MODE_CG, sl: MODE_SL, pl: MODE_PL, slr: MODE_SLR, file: MODE_FILE, url: MODE_URL, hasSL: hasSL, hasPL: hasPL, hasCG: hasCG, hasSLR: hasSLR, allowTraversal: allow_traversal };
	if (!session.req.body?.testtype) {
		session.errs = undefined
		session.req.parseErr = undefined
		drawForm(session, FormArguments, (session.cgChecker && session.cgChecker.supportedRequests) ? session.cgChecker.supportedRequests : null, motd);
	}
	else {
		let VVxml: string | null = null;
		session.req.parseErr = undefined;

		if (session.req.body.testtype == MODE_CG && session.req.body.requestType.length == 0) session.req.parseErr = ["request type not specified"]
		else if (session.req.body.doclocation == MODE_URL && session.req.body.XMLurl.length == 0) session.req.parseErr = ["URL not specified"]
		else if (session.req.body.doclocation == MODE_FILE && !(session.req.files && session.req.files.XMLfile)) session.req.parseErr = ["File not provided"]

		session.req.session.data.forGermany = session.req.body.forGermany == "on";
		session.req.session.data.traverse = session.req.body.traverse == "on"
		const log_prefix = createPrefix(session.req, session.req.body.testtype);
		session.errs = new ErrorList();
		if (!session.req.parseErr)
			switch (session.req.body.doclocation) {
				case MODE_URL:
					if (isHTTPURL(session.req.body.XMLurl)) {
						let resp = null;
						try {
							session.errs.setLocation(session.req.body.XMLurl)
							resp = fetchS(session.req.body.XMLurl, fetch_options);
						} catch (error) {
							session.req.parseErr = [`${error}`];
						}
						if (resp) {
							if (resp.ok) VVxml = resp.text();
							else session.req.parseErr = [`error (${resp.status}:${resp.statusText}) handling ${session.req.body.XMLurl}`];
						}
					} else session.req.parseErr = [`${session.req.body.XMLurl} is not an HTTP(S) URL`];
					session.req.session.data.url = session.req.body.XMLurl;
					break;
				case MODE_FILE:
					try {
						session.errs.setLocation((session.req.files!.XMLfile as fileupload.UploadedFile).name)
						VVxml = (session.req.files!.XMLfile as fileupload.UploadedFile).data.toString();
					} catch (err) {
						session.req.parseErr = [`retrieval of FILE ${(session.req.files!.XMLfile as fileupload.UploadedFile).name} failed (${err})`];
					}
					session.req.session.data.url = undefined;
					break;
				default:
					session.req.parseErr = [`method is not ${MODE_URL.quote()} or ${MODE_FILE.quote()}`];
			}

		if (!session.req.parseErr && VVxml)
			switch (session.req.body.testtype) {
				case MODE_CG:
					session.errs.setType(`Content Guide-${session.req.body.requestType}`)
					if (session.cgChecker) 
						session.cgChecker.doValidateContentGuide(VVxml, session.req.body.requestType, session.errs, { log_prefix: log_prefix, report_schema_version: true });
					break;
				case MODE_SL:
					session.errs.setType("Service List")
					if (session.slChecker) 
						session.slChecker.doValidateServiceList(VVxml, session.errs, 
							{ log_prefix: log_prefix, report_schema_version: true, variants: session.req.session.data.forGermany ? GERMAN_A177r6_VARIANT : 0, traverse: session.req.session.data.traverse}
						);
					break;
				case MODE_PL:
					session.errs.setType("Playlist")
					if (session.plChecker) 
						session.plChecker.doValidatePlaylist(VVxml, session.errs, { log_prefix: log_prefix, report_schema_version: true });
					break;
				case MODE_SLR:
					session.errs.setType("Service List Registry")
					if (session.slrChecker) 
						session.slrChecker.doValidateServiceListRegistry(VVxml, session.errs, { log_prefix: log_prefix, report_schema_version: true, traverse: session.req.session.data.traverse });
					break;
			}

		session.req.session.data.mode = session.req.body.testtype;
		session.req.session.data.entry = session.req.body.doclocation;
		if (session.req.body.requestType) session.req.session.data.cgmode = session.req.body.requestType;
		drawForm(session, FormArguments, session.cgChecker ? session.cgChecker.supportedRequests : null, motd);

		session.req.diags = {};
		session.req.diags.countErrors = session.errs.numErrors();
		session.req.diags.countWarnings = session.errs.numWarnings();
		session.req.diags.countInforms = session.errs.numInformationals();

		document_logger(session, log_prefix, true);
	}
	session.res.end();
}


/**
 * Validate a service list
 *
 * @param {ValidationSession}  session  
 * @param {string | undefined} motd          HTML text for the Message Of The Day
 */
function validateServiceList(session: ValidationSession, motd: string | undefined) : void {
	session.errs = new ErrorList();
	const log_prefix = createPrefix(session.req, MODE_SL);
	const SLxml = getDocument(session.req, session.res)
	const _options: SL_Validator_Options = { log_prefix: log_prefix, report_schema_version: true, variants: getVariant(session.req) }

	if (SLxml) session.slChecker?.doValidateServiceList(SLxml, session.errs, _options);
	report(session, motd)
	document_logger(session, log_prefix, true);
	session.res.end();
}


/**
 * Validate a play list
 *
 * @param {ValidationSession}  session  
 * @param {string | undefined} motd          HTML text for the Message Of The Day
 */
function validatePlaylist(session: ValidationSession, motd: string | undefined) : void {
	session.errs = new ErrorList();
	const log_prefix = createPrefix(session.req, MODE_PL);
	const PLxml = getDocument(session.req, session.res)

	if (PLxml) session.plChecker?.doValidatePlaylist(PLxml, session.errs, { log_prefix: log_prefix, report_schema_version: true });
	report(session, motd)
	document_logger(session, log_prefix, true);
	session.res.end();
}



/**
 * Validate a service list registry
 *
 * @param {ValidationSession}  session  
 * @param {string | undefined} motd          HTML text for the Message Of The Day
 */
function validateServiceListRegistry(session: ValidationSession, motd: string | undefined) : void {
	session.errs = new ErrorList();
	const log_prefix = createPrefix(session.req, MODE_SLR);
	const SLRxml = getDocument(session.req, session.res)

	const _options: SL_Validator_Options = { log_prefix: log_prefix, report_schema_version: true, variants: getVariant(session.req) }
	switch (session.req.method) {
		case "GET":
			if (session.req.query?.variants && (session.req.query.variants as string).toLowerCase() == "de")
				_options.variants = GERMAN_A177r6_VARIANT
			break
		case "POST":
			if (session.req.header("X-variants")?.toLowerCase() == "de")
				_options.variants = GERMAN_A177r6_VARIANT
			break
	}
	if (SLRxml) session.slrChecker?.doValidateServiceListRegistry(SLRxml, session.errs, _options);
	report(session, motd)

	document_logger(session, log_prefix, true);
	session.res.end();
}

/**
 * Validate a content guide metadata
 *
 * @param {ValidationSession}  session  
 * @param {string | undefined} motd          HTML text for the Message Of The Day
 */
function validateContentGuide(session: ValidationSession, motd: string | undefined) : void {
	session.errs = new ErrorList();
	const log_prefix = createPrefix(session.req);
	const CGxml = getDocument(session.req, session.res)
	const _options: CG_Validator_Options = { log_prefix: log_prefix, report_schema_version: true }

	if (CGxml) session.cgChecker?.doValidateContentGuide(CGxml, session.req.query.type as string, session.errs, _options);
	report(session, motd)
	document_logger(session, log_prefix, true);
	session.res.end();
}


/**
 * Setup the validation and service list registry endpoints
 *
 * @param {commandLineArgs.CommandLineOptions} options   Command Line Arguments - see OptionDefinitions in all-in-one.ts
 */
export default function validator(app_options: commandLineArgs.CommandLineOptions) : void {
	if (app_options.nocsr && app_options.nosl && app_options.nopl && app_options.nocg && app_options.noslr) {
		console.log(chalk.red("nothing to do... exiting"));
		process.exit(1);
	}

	if (!app_options.nocsr && !HasProperty(app_options, "CSRfile")) {
		console.log(chalk.red("SLEPR file not specified... exiting"));
		process.exit(1);
	}

	if (!HasProperty(app_options, "CORSmode")) app_options.CORSmode = CORSlibrary;
	else if (!CORSoptions.includes(app_options.CORSmode)) {
		console.log(chalk.red(`CORSmode must be ${CORSnone.quote()}, ${CORSlibrary.quote()} to use the Express cors() handler, or ${CORSmanual.quote()} to have headers inserted manually`));
		process.exit(1);
	}

	let motd: string | undefined = undefined;
	if (HasProperty(app_options, "motd")) {
		console.log(chalk.yellow("reading Message Of The Day from " + chalk.green(app_options.motd)));
		motd = readmyfile(app_options.motd, read_string_options) as string;
	}

	if (app_options.workers != 0 && cluster.isPrimary) {
		if (app_options.workers > numCPUs) app_options.workers = numCPUs;
		else if (app_options.workers < 1) app_options.workers = 1;
		console.log(chalk.green(`Number of CPUs is ${numCPUs}, ${app_options.workers} workers`));
		console.log(chalk.green(`Primary ${process.pid} is running`));

		// SCHED_RR is the default on all operating systems except Windows. Windows will change to 
		// SCHED_RR once libuv is able to effectively distribute IOCP handles without incurring 
		// a large performance hit.
		cluster.schedulingPolicy = cluster.SCHED_RR

		// Fork workers.
		for (let i = 0; i < app_options.workers; i++) 
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

		let slcheck = undefined,
			plcheck = undefined,
			cgcheck = undefined,
			slrcheck = undefined;

		const DFLT_async = false, DFLT_verbose = true;

		if (app_options.urls && app_options.CSRfile == Default_SLEPR.file) app_options.CSRfile = Default_SLEPR.url;

		const knownLanguages = LoadLanguages({useURLs: app_options.urls, async: DFLT_async, verbose: DFLT_verbose});
		const isoCountries = LoadCountries({useURLs: app_options.urls, async: DFLT_async, verbose: DFLT_verbose});
		const knownGenres = LoadGenres({useURLs: app_options.urls, async: DFLT_async, verbose: DFLT_verbose});

		if (!app_options.nosl || !app_options.nopl || !app_options.nocg || !app_options.noslr) {
			const knownRatings = LoadRatings({useURLs: app_options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const accessibilityPurposes = LoadAccessibilityPurpose({useURLs: app_options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const audioPurposes = LoadAudioPurpose({useURLs: app_options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const subtitleCarriages = LoadSubtitleCarriages({useURLs: app_options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const subtitleCodings = LoadSubtitleCodings({useURLs: app_options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const subtitlePurposes = LoadSubtitlePurposes({useURLs: app_options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const videoFormats = LoadVideoCodecCS({useURLs: app_options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const audioFormats = LoadAudioCodecCS({useURLs: app_options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const audioPresentation = LoadAudioPresentationCS({useURLs: app_options.urls, async: DFLT_async, verbose: DFLT_verbose});
			const linkedApplicationTypes = LoadLinkedApplicationCS({useURLs: app_options.urls, async: DFLT_async, verbose: DFLT_verbose});

			if (!app_options.nocg)
				cgcheck = new ContentGuideCheck({
					useURLs: app_options.urls,
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

			if (!app_options.nosl)
				slcheck = new ServiceListCheck({
					useURLs: app_options.urls,
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
				}, cgcheck);

			if (!app_options.nopl)
				plcheck = new PlaylistCheck( {
					useURLs: app_options.urls,
					async: DFLT_async,
					verbose: DFLT_verbose,
				});

			if (!app_options.noslr) 
				slrcheck = new ServiceListRegistryCheck({
					useURLs: app_options.urls,
					async: DFLT_async,
					verbose: DFLT_verbose,

					countries: isoCountries, 
					genres: knownGenres, 
					languages: knownLanguages, 
					appfmts: linkedApplicationTypes,
				}, slcheck);
		}

		const Express_Options = {
			type: "application/xml", 
			limit: "10mb",
		}

		if (!app_options.nosl) {
			app.all("/validate_sl", express.text(Express_Options), (req: express.Request, res: express.Response) => {
				const session: ValidationSession = {
					req: req,
					res: res,
					slChecker: slcheck,
					jsonResponse: false,
					traverse: false,
					traversedPaths: undefined,
				}
				validateServiceList(session, motd);
			});

			app.all("/validate_sl_json", express.text(Express_Options), (req: express.Request, res: express.Response) => {
				const session: ValidationSession = {
					req: req,
					res: res,
					slChecker: slcheck,
					jsonResponse: true,
					traverse: false,
					traversedPaths: undefined,
				}
				validateServiceList(session, motd);
			});
		}

		if (!app_options.nopl) {
			app.all("/validate_pl", express.text(Express_Options), (req: express.Request, res: express.Response) => {
				const session: ValidationSession = {
					req: req,
					res: res,
					plChecker: plcheck,
					jsonResponse: false,
					traverse: false,
					traversedPaths: undefined,
				}
				validatePlaylist(session, motd);
			});

			app.all("/validate_pl_json", express.text(Express_Options), (req: express.Request, res: express.Response) => {
				const session: ValidationSession = {
					req: req,
					res: res,
					plChecker: plcheck,
					jsonResponse: true,
					traverse: false,
					traversedPaths: undefined,
				}
				validatePlaylist(session, motd);
			});
		}

		if (!app_options.nocg) {
			app.all("/validate_cg", express.text(Express_Options), (req: express.Request, res: express.Response) => {
				const session: ValidationSession = {
					req: req,
					res: res,
					cgChecker: cgcheck,
					jsonResponse: false,
					traverse: false,
					traversedPaths: undefined,
				}
				validateContentGuide(session, motd);
			});

			app.all("/validate_cg_json", express.text(Express_Options), (req: express.Request, res: express.Response) => {
				const session: ValidationSession = {
					req: req,
					res: res,
					cgChecker: cgcheck,
					jsonResponse: true,
					traverse: false,
					traversedPaths: undefined,
				}
				validateContentGuide(session, motd);
			});
		}

		if (!app_options.noslr) {
			app.all("/validate_slr", express.text(Express_Options), (req: express.Request, res: express.Response) => {
				const session: ValidationSession = {
					req: req,
					res: res,
					slrChecker: slrcheck,
					jsonResponse: false,
					traverse: false,
					traversedPaths: undefined,
				}
				validateServiceListRegistry(session, motd);
			});

			app.all("/validate_slr_json", express.text(Express_Options), (req: express.Request, res: express.Response) => {
				const session: ValidationSession = {
					req: req,
					res: res,
					slrChecker: slrcheck,
					jsonResponse: true,
					traverse: false,
					traversedPaths: undefined,
				}
				validateServiceListRegistry(session, motd);
			});
		}

		const SLEPR_query_route = "/query",
			SLEPR_reload_route = "/reload";

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		type nextFn = (err?: any) => any  // cors module doesnot strictly type this

		let manualCORS = function (req: express.Request, res: express.Response, next: nextFn) {
			next();
		};
		if (app_options.CORSmode == CORSlibrary) {
			app.use(cors());
		} else if (app_options.CORSmode == CORSmanual) {
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

		if (!app_options.nosl || !app_options.nopl || !app_options.nocg || !app_options.noslr) {
			app.all("/check", express.text(Express_Options), (req: express.Request, res: express.Response) => {
				// we need to disable listening as the Windows cluster seems to 'prefer' some workers, expecialy  when the validator is being used to verify 
				// a file it is serving itself (like an SLR respose from `SLEPR_query_route`)
				const saved_port = req.socket.localPort  
				if (cluster.isWorker && app_options.workers > 1)
					req.socket.server!.close();

				const session: ValidationSession= {
					req: req,
					res: res,
					slrChecker: slrcheck,
					slChecker: slcheck,
					cgChecker: cgcheck,
					plChecker: plcheck,
					traverse: app_options.allow_traversal,
					traversedPaths: new CaseInsensitiveSet(),
				}
	
				DVB_I_check(session, !app_options.nosl, !app_options.nopl, !app_options.nocg, !app_options.noslr, app_options.allow_traversal, motd);
				if (req.socket.server!.listening == false)
					req.socket.server!.listen(saved_port)
			});
		}

		if (!app_options.nocsr) {
			csr = new SLEPR(app_options.urls, app_options.SLRmode, knownLanguages, isoCountries, knownGenres);
			csr.loadServiceListRegistry(app_options.CSRfile);

			if (app_options.CORSmode == "manual") {
				app.options(SLEPR_query_route, manualCORS);
			}
			app.get(SLEPR_query_route, manualCORS, (req: express.Request, res: express.Response) => {
				csr!.processServiceListRequest(req, res);
				res.end();
			});

			app.get(SLEPR_reload_route, (req: express.Request, res: express.Response) => {
				csr!.loadServiceListRegistry(app_options.CSRfile);
				res.status(200).end();
			});
		}

		if (app_options.spam_blocker) {
			init_spam_blocker(app);
		}

		const tabulate = function (res: express.Response, group: string, stats: StatsType) {
			res.write(`<h1>${group}</h1>`);
			if (Object.keys(stats).length === 0) res.write("<p>No statistics</p>");
			else {
				res.write("<table><tr><th>item</th><th>count</th></tr>");
				Object.getOwnPropertyNames(stats).forEach((key) => res.write(`<tr><td>${key}</td><td>${stats[key]}</td></tr>`));
				res.write("</table>");
			}
			res.write(LINE);
		}

		app.get("/stats", (req : express.Request, res: express.Response) => {
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
			if (app_options.sport == app_options.port) app_options.sport = app_options.port + 1;

			https_server = createServer(https_options, app);
			https_server.listen(app_options.sport, () => {
				if ((https_server?.address() as AddressInfo)?.port) {
					console.log(chalk.cyan(`HTTPS listening on port number ${(https_server!.address() as AddressInfo).port}`));

					const redirect_app = express();
					redirect_app.use(morgan(LOGGING_TEMPLATE));
					redirect_app.use(function(req, res) {
						res.redirect(`https://${req.hostname}:${app_options.sport}${req.originalUrl}`);
					})
					redirect_app.listen(app_options.port, () => {
						console.log(chalk.cyan(`HTTP redirecting to HTTPS on port number ${app_options.port}`));
					});
				}
				else console.log(chalk.red(`HTTPS port ${app_options.sport} already in use -- HTTPS server not started`));

			});
		}

		const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
		delay(3000); // give the HTTPS server time to start before starting the HTTP server

		if (!https_server?.listening) {
		// start the HTTP server
			const http_server = app.listen(app_options.port, () => {
				if ((http_server.address() as AddressInfo)?.port) 
					console.log(chalk.cyan(`HTTP listening on port number ${(http_server.address() as AddressInfo).port}`));
				else console.log(chalk.red(`HTTP port ${app_options.port} already in use -- HTTP server not started`));
			});
		}
	}
}
