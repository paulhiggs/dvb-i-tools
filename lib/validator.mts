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
import { randomBytes } from "crypto"
import { restartWorkersOnExit } from "./cluster_restart.mts"
import { cpus } from "os"
const numCPUs = cpus().length;

import chalk from "chalk"
import cors from "cors"
import express from "express"
import session from "express-session"
import morgan, { token } from "morgan"
import fileupload from "express-fileupload"
import favicon from "serve-favicon"
import commandLineArgs from "command-line-args"
import { createServer as createHttpServer } from "http"
import type { AddressInfo } from "node:net"
import { createStream } from "rotating-file-stream";

import { read_string_options, CORSlibrary, CORSmanual, CORSnone, CORSoptions } from "./globals.mts"
import type { StatsType } from "./globals.mts"
import { Default_SLEPR, __dirname } from "./data_locations.mts"
import { drawForm, PAGE_TOP, PAGE_BOTTOM, drawResults, MODE_URL, MODE_FILE, MODE_SL, MODE_PL, MODE_CG, MODE_SLR, MODE_UNSPECIFIED } from "./ui.mts"
import type {FormModes} from './ui.mts'
import ErrorList from "./error_list.mts"
import { safeFetch, configureFetchPolicy, IMAGE_CHECKING, DEFAULT_MAX_TRAVERSAL, parseTraversalLimit } from "./safe_fetch.mts"
import type { ImageChecking } from "./safe_fetch.mts"
import { readmyfile, HasProperty, escapeHTML } from "./utils.mts"
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

let csr: SLEPR | null= null;

const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), read_string_options).toString());

const keyFilename: string = join(__dirname, "selfsigned.key"),
	certFilename: string = join(__dirname, "selfsigned.crt");

async function getDocument(req: express.Request) : Promise<string | null> {
	if (req.method == "GET") {
		const { response: resp, error } = await safeFetch(req.query.url as string)
		if (error)
			req.parseErr = [error]
		if (resp) {
			if (resp.ok)
				return resp.text()
			else req.parseErr = [`error (${resp.status}:${resp.statusText}) handling ${req.query.url}`]
		}
	}
	else if (req.method == "POST")
		return req.body
	return null
}

const ALLOWED_VALIDATION_METHODS = ["GET", "POST"]

/**
 * reject requests to the validation endpoints that do not use an allowed HTTP method
 *
 * @returns {boolean} true if the request method is allowed, otherwise a 405 response has been sent and the request should not be processed further
 */
function checkMethod(req: express.Request, res: express.Response) : boolean {
	if (ALLOWED_VALIDATION_METHODS.includes(req.method)) return true
	res.status(405).set("Allow", ALLOWED_VALIDATION_METHODS.join(", ")).type("text/plain").send(`method ${req.method} is not allowed, use ${ALLOWED_VALIDATION_METHODS.join(" or ")}`)
	return false
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


/**
 * how a request asks for referenced images to be checked: "no", "yes" or "scaled". For a /validate_* endpoint this is
 * the images query parameter (GET) or the X-images header (POST); for /check it is the images form field.
 * Anything else (including nothing) is "yes"
 */
function imageChecking(value: unknown) : ImageChecking {
	const v = typeof value == "string" ? value.toLowerCase() : "";
	return (IMAGE_CHECKING as string[]).includes(v) ? (v as ImageChecking) : "yes";
}
const getImageChecking = (req: express.Request) : ImageChecking => imageChecking(req.method == "GET" ? req.query?.images : req.header("X-images"));


async function report(req: express.Request, res: express.Response, jsonResponse: boolean, errs: ErrorList, motd: string | undefined) : Promise<void> {
	if (jsonResponse) {
		res.setHeader("Content-Type", "application/json")
		if (!req.parseErr) delete errs.markupXML
		// a single JSON document is returned, with parseErr included only when the document could not be obtained
		const result: Record<string, unknown> = req.parseErr ? { parseErr: req.parseErr } : {}
		if (req.query.results && req.query.results == "all")
			result.errs = errs
		else {
			result.fatals = errs.fatals.length
			result.errors = errs.errors.length
			result.warnings = errs.warnings.length
			result.informationals = errs.informationals.length
		}
		res.write(JSON.stringify(result))
	}
	else 
		await drawResults(req, res, motd, req.parseErr, errs)
}


async function DVB_I_check(
		req: express.Request, res: express.Response, 
		slcheck: ServiceListCheck | undefined, plcheck: PlaylistCheck | undefined, cgcheck: ContentGuideCheck | undefined, slrcheck: ServiceListRegistryCheck | undefined, 
		hasSL: boolean, hasPL: boolean, hasCG: boolean, hasSLR: boolean, 
		allow_traversal: boolean,
		motd: string | undefined, 
		mode: string = MODE_UNSPECIFIED, linktype: string = MODE_UNSPECIFIED) : Promise<void> {
			
	if (!req.session.data) {
		// setup defaults
		req.session.data = {};
		req.session.data.lastUrl = "";
		req.session.data.mode = mode == MODE_UNSPECIFIED ? (hasSL ? MODE_SL : MODE_CG) : mode;
		req.session.data.entry = linktype == MODE_UNSPECIFIED ? MODE_URL : linktype;
		if (cgcheck) req.session.data.cgmode = cgcheck.supportedRequests[0].value;
		req.session.data.forGermany = false;
		req.session.data.traverse = false;
		req.session.data.maxTraversal = String(DEFAULT_MAX_TRAVERSAL);
		req.session.data.images = "yes";
	}
	if (req.session.data.lastUrl != req.url) {
		req.session.data.mode = mode == MODE_UNSPECIFIED ? (hasSL ? MODE_SL : MODE_CG) : mode;
		req.session.data.entry = linktype == MODE_UNSPECIFIED ? MODE_URL : linktype;
		req.session.data.lastUrl = req.url;
	}
	
	const FormArguments: FormModes = { cg: MODE_CG, sl: MODE_SL, pl: MODE_PL, slr: MODE_SLR, file: MODE_FILE, url: MODE_URL, hasSL: hasSL, hasPL: hasPL, hasCG: hasCG, hasSLR: hasSLR, allowTraversal: allow_traversal };
	if (!req.body?.testtype) 
		await drawForm(req, res, FormArguments, (cgcheck && cgcheck.supportedRequests) ? cgcheck.supportedRequests : null, motd, undefined, undefined);
	else {
		let VVxml: string | null = null;
		req.parseErr = undefined;

		// a form field is only used when it is a single string - a missing field is treated as empty, and express.urlencoded()
		// can also produce arrays or objects (e.g. XMLurl[]=a&XMLurl[]=b), which are not valid values for any field
		const field = (name: string): string => (typeof req.body[name] == "string" ? req.body[name] : "");
		const testtype = field("testtype"),
			doclocation = field("doclocation"),
			requestType = field("requestType"),
			XMLurl = field("XMLurl"),
			maxTraversalField = field("maxTraversal").trim();
		// the most documents to traverse: a positive whole number or "unlimited", given when traversal is selected
		const traverse = req.body.traverse == "on" && (testtype == MODE_SL || testtype == MODE_SLR),
			maxTraversal = maxTraversalField.length == 0 ? DEFAULT_MAX_TRAVERSAL : parseTraversalLimit(maxTraversalField);
		const available: Record<string, boolean> = { [MODE_SL]: hasSL, [MODE_PL]: hasPL, [MODE_CG]: hasCG, [MODE_SLR]: hasSLR };

		if (testtype.length == 0) req.parseErr = ["validation type not specified"]
		else if (!HasProperty(available, testtype)) req.parseErr = [`unknown validation type ${testtype.quote()}`]
		else if (!available[testtype]) req.parseErr = [`validation type ${testtype.quote()} is not available`]
		else if (testtype == MODE_CG && requestType.length == 0) req.parseErr = ["request type not specified"]
		else if (testtype == MODE_CG && !cgcheck?.supportedRequests.some((r) => r.value == requestType)) req.parseErr = [`unknown request type ${requestType.quote()}`]
		else if (doclocation != MODE_URL && doclocation != MODE_FILE) req.parseErr = [`method is not ${MODE_URL.quote()} or ${MODE_FILE.quote()}`]
		else if (doclocation == MODE_URL && XMLurl.length == 0) req.parseErr = ["URL not specified"]
		else if (doclocation == MODE_FILE && !(req.files && req.files.XMLfile)) req.parseErr = ["File not provided"]
		else if (doclocation == MODE_FILE && Array.isArray(req.files!.XMLfile)) req.parseErr = ["only one file can be validated at a time"]
		else if (traverse && maxTraversal == undefined)
			req.parseErr = [`the maximum number of documents to traverse must be a positive whole number or ${"unlimited".quote()}, not ${maxTraversalField.quote()}`]

		req.session.data.forGermany = req.body.forGermany == "on";
		req.session.data.traverse = req.body.traverse == "on"
		req.session.data.maxTraversal = maxTraversalField.length > 0 ? maxTraversalField : String(DEFAULT_MAX_TRAVERSAL)
		req.session.data.images = imageChecking(req.body.images)
		const log_prefix = createPrefix(req, testtype);
		const errs = ErrorList.withMarkup();
		if (!req.parseErr)
			switch (doclocation) {
				case MODE_URL:
					{
						errs.setLocation(XMLurl)
						const { response: resp, error } = await safeFetch(XMLurl);
						if (error)
							req.parseErr = [error];
						if (resp) {
							if (resp.ok) VVxml = resp.text();
							else req.parseErr = [`error (${resp.status}:${resp.statusText}) handling ${XMLurl}`];
						}
					}
					req.session.data.url = XMLurl;
					break;
				case MODE_FILE:
					try {
						errs.setLocation((req.files!.XMLfile as fileupload.UploadedFile).name)
						VVxml = (req.files!.XMLfile as fileupload.UploadedFile).data.toString();
					} catch (err) {
						req.parseErr = [`retrieval of FILE ${(req.files!.XMLfile as fileupload.UploadedFile).name} failed (${err})`];
					}
					req.session.data.url = undefined;
					break;
				default:
					req.parseErr = [`method is not ${MODE_URL.quote()} or ${MODE_FILE.quote()}`];
			}

		if (!req.parseErr && VVxml)
			switch (testtype) {
				case MODE_CG:
					errs.setType(`Content Guide-${requestType}`)
					if (cgcheck) 
						await cgcheck.doValidateContentGuide(VVxml, requestType, errs, { log_prefix: log_prefix, report_schema_version: true, images: req.session.data.images });
					break;
				case MODE_SL:
					errs.setType("Service List")
					if (slcheck) 
						await slcheck.doValidateServiceList(VVxml, errs, 
							{ log_prefix: log_prefix, report_schema_version: true, variants: req.session.data.forGermany ? GERMAN_A177r6_VARIANT : 0, traverse: req.session.data.traverse, maxTraversal: maxTraversal, images: req.session.data.images }
						);
					break;
				case MODE_PL:
					errs.setType("Playlist")
					if (plcheck) 
						await plcheck.doValidatePlaylist(VVxml, errs, { log_prefix: log_prefix, report_schema_version: true, images: req.session.data.images });
					break;
				case MODE_SLR:
					errs.setType("Service List Registry")
					if (slrcheck) 
						await slrcheck.doValidateServiceListRegistry(VVxml, errs, { log_prefix: log_prefix, report_schema_version: true, traverse: req.session.data.traverse, maxTraversal: maxTraversal, images: req.session.data.images });
					break;
			}

		req.session.data.mode = testtype;
		req.session.data.entry = doclocation;
		if (requestType) req.session.data.cgmode = requestType;
		await drawForm(req, res, FormArguments, cgcheck ? cgcheck.supportedRequests : null, motd, req.parseErr, errs);

		req.diags = {};
		req.diags.countErrors = errs.numErrors();
		req.diags.countWarnings = errs.numWarnings();
		req.diags.countInforms = errs.numInformationals();

		document_logger(errs, log_prefix, true, req);
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
async function validateServiceList(req: express.Request, res: express.Response, slcheck: ServiceListCheck, motd: string | undefined, jsonResponse: boolean) : Promise<void> {
	if (!checkMethod(req, res)) return;
	const errs = ErrorList.withMarkup();
	const log_prefix = createPrefix(req, MODE_SL);
	const SLxml = await getDocument(req)
	const _options: SL_Validator_Options = { log_prefix: log_prefix, report_schema_version: true, variants: getVariant(req), images: getImageChecking(req) }

	if (SLxml) await slcheck.doValidateServiceList(SLxml, errs, _options);
	await report(req, res, jsonResponse, errs, motd)
	document_logger(errs, log_prefix, true, req);
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
async function validatePlaylist(req: express.Request, res: express.Response, plcheck: PlaylistCheck, motd: string | undefined, jsonResponse: boolean) : Promise<void> {
	if (!checkMethod(req, res)) return;
	const errs = ErrorList.withMarkup();
	const log_prefix = createPrefix(req, MODE_PL);
	const PLxml = await getDocument(req)

	if (PLxml) await plcheck.doValidatePlaylist(PLxml, errs, { log_prefix: log_prefix, report_schema_version: true, images: getImageChecking(req) });
	await report(req, res, jsonResponse, errs, motd)
	document_logger(errs, log_prefix, true, req);
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
async function validateServiceListRegistry(req: express.Request, res: express.Response, slrcheck: ServiceListRegistryCheck, motd: string | undefined, jsonResponse: boolean) : Promise<void> {
	if (!checkMethod(req, res)) return;
	const errs = ErrorList.withMarkup();
	const log_prefix = createPrefix(req, MODE_SLR);
	const SLRxml = await getDocument(req)

	const _options: SL_Validator_Options = { log_prefix: log_prefix, report_schema_version: true, variants: getVariant(req), images: getImageChecking(req) }
	if (SLRxml) await slrcheck.doValidateServiceListRegistry(SLRxml, errs, _options);
	await report(req, res, jsonResponse, errs, motd)

	document_logger(errs, log_prefix, true, req);
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
async function validateContentGuide(req: express.Request, res: express.Response, cgcheck: ContentGuideCheck, motd: string | undefined, jsonResponse: boolean) : Promise<void> {
	if (!checkMethod(req, res)) return;
	const errs = ErrorList.withMarkup();
	const log_prefix = createPrefix(req, MODE_CG);
	const CGxml = await getDocument(req)
	const _options: CG_Validator_Options = { log_prefix: log_prefix, report_schema_version: true, images: getImageChecking(req) }

	if (CGxml) await cgcheck.doValidateContentGuide(CGxml, req.query.type as string, errs, _options);
	await report(req, res, jsonResponse, errs, motd)
	document_logger(errs, log_prefix, true, req);
	res.end();
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

	// a flag given without a value (null) means true
	configureFetchPolicy({ allowPrivateAddresses: app_options.allow_private_fetch !== false });
	// every validation made through the server retrieves and checks the images it references. The library default is off,
	// so documents validated directly (e.g. by the testsuite) do not make network requests for their images
	configureFetchPolicy({ checkImages: true });

	if (HasProperty(app_options, "fetch_concurrency")) {
		const fetchConcurrency = app_options.fetch_concurrency;
		if (typeof fetchConcurrency != "number" || Number.isNaN(fetchConcurrency)) {
			console.log(chalk.red("fetch_concurrency must be a positive whole number"));
			process.exit(1);
		}
		configureFetchPolicy({ fetchConcurrency: fetchConcurrency });
	}

	if (HasProperty(app_options, "fetch_per_host")) {
		const fetchesPerHost = app_options.fetch_per_host;
		if (typeof fetchesPerHost != "number" || Number.isNaN(fetchesPerHost)) {
			console.log(chalk.red("fetch_per_host must be a positive whole number"));
			process.exit(1);
		}
		configureFetchPolicy({ fetchesPerHost: fetchesPerHost });
	}

	let motd: string | undefined = undefined;
	if (HasProperty(app_options, "motd")) {
		console.log(chalk.yellow("reading Message Of The Day from " + chalk.green(app_options.motd)));
		motd = readmyfile(app_options.motd, read_string_options) as string;
	}

	// session cookies are signed with SESSION_SECRET. If it is not provided, a random secret is used for this run.
	// It is set in the environment before any workers are forked, so all workers share it.
	if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = randomBytes(32).toString("hex");

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

		restartWorkersOnExit();
	}
	else {

		// initialize Express
		const app = express();

		// CORS handling, according to --CORSmode. This is registered before any routes so that it applies to all of them
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

		// no static file serving: the pages are generated, and the installation directory holds keys, logs and configuration
		app.use(fileupload());
		app.use(favicon(join(__dirname, "icon", "ph-icon.ico")));

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
				interval: "1M", // rotate monthly
				compress: "gzip", // compress rotated files
				path: logDir,
			})
			app.use(morgan(LOGGING_TEMPLATE, {stream: logStream}));
		}

		app.use(express.urlencoded({ extended: true }));

		app.set("trust proxy", 1);
		app.use(
			session({
				secret: process.env.SESSION_SECRET as string,
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
			app.all("/validate_sl", express.text(Express_Options), async (req: express.Request, res: express.Response) => {
				await validateServiceList(req, res, slcheck!, motd, false);
			});

			app.all("/validate_sl_json", express.text(Express_Options), async (req: express.Request, res: express.Response) => {
				await validateServiceList(req, res, slcheck!, motd, true);
			});
		}

		if (!app_options.nopl) {
			app.all("/validate_pl", express.text(Express_Options), async (req: express.Request, res: express.Response) => {
				await validatePlaylist(req, res, plcheck!, motd, false);
			});

			app.all("/validate_pl_json", express.text(Express_Options), async (req: express.Request, res: express.Response) => {
				await validatePlaylist(req, res, plcheck!, motd, true);
			});
		}

		if (!app_options.nocg) {
			app.all("/validate_cg", express.text(Express_Options), async (req: express.Request, res: express.Response) => {
				await validateContentGuide(req, res, cgcheck!, motd, false);
			});

			app.all("/validate_cg_json", express.text(Express_Options), async (req: express.Request, res: express.Response) => {
				await validateContentGuide(req, res, cgcheck!, motd, true);
			});
		}

		if (!app_options.noslr) {
			app.all("/validate_slr", express.text(Express_Options), async (req: express.Request, res: express.Response) => {
				await validateServiceListRegistry(req, res, slrcheck!, motd, false);
			});

			app.all("/validate_slr_json", express.text(Express_Options), async (req: express.Request, res: express.Response) => {
				await validateServiceListRegistry(req, res, slrcheck!, motd, true);
			});
		}

		const SLEPR_query_route = "/query",
			SLEPR_reload_route = "/reload";

		if (!app_options.nosl || !app_options.nopl || !app_options.nocg || !app_options.noslr) {
			app.all("/check", express.text(Express_Options), async (req: express.Request, res: express.Response) => {
				await DVB_I_check(req, res, slcheck, plcheck, cgcheck, slrcheck, !app_options.nosl, !app_options.nopl, !app_options.nocg, !app_options.noslr, app_options.allow_traversal, motd);
			});
		}

		if (!app_options.nocsr) {
			csr = new SLEPR(app_options.urls, app_options.SLRmode, knownLanguages, isoCountries, knownGenres);
			csr.loadServiceListRegistry(app_options.CSRfile);

			if (app_options.CORSmode == CORSmanual) {
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
			res.write(`<section class="panel stats"><h2>${group}</h2>`);
			if (Object.keys(stats).length === 0) res.write(`<p class="hint">No statistics</p>`);
			else {
				res.write(`<div class="scroll"><table><thead><tr><th scope="col">Item</th><th scope="col">Value</th></tr></thead><tbody>`);
				Object.getOwnPropertyNames(stats).forEach((key) => res.write(`<tr><td>${escapeHTML(key)}</td><td>${escapeHTML(stats[key])}</td></tr>`));
				res.write("</tbody></table></div>");
			}
			res.write("</section>");
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
			res.write(`<section class="panel stats"><h2>${escapeHTML(groupname)}</h2>`);
			if (values.length == 0)
				res.write(`<p class="hint">No values</p>`);
			else {
				res.write(`<div class="scroll"><table>`);
				let maxLen = 0;
				values.forEach((value) => {if (value.length > maxLen) maxLen = value.length});
				let firstRow = true; 
				for (let i=0; i<values.length; i++) {
					if (i % (maxLen > 4 ? 10 : 20) == 0) {
						res.write(`${firstRow ? "" : "</tr>"}<tr>`)
						firstRow = false;
					}
					res.write(`<td>${escapeHTML(values[i])}</td>`);
				}
				res.write(`${firstRow ? "" : "</tr>"}</table></div>`);
			}
			res.write("</section>");
		}
		app.get("/langs", (req: express.Request, res: express.Response) => {
			res.setHeader("Content-Type", "text/html");
			res.write(PAGE_TOP("Languages", req.secure));

			let langs: Record<string, string[]> = {empty: []} 
			if (slcheck) langs = slcheck.langs(true) as Record<string, string[]>;

			if (HasProperty(langs, "empty"))
				res.write(`<p class="hint">No statistics</p>`);
			else {
				Object.getOwnPropertyNames(langs).forEach((key) => tabularize(res, key, langs[key] as string[]));
			}
			res.write(PAGE_BOTTOM);
			res.status(200).end();
		});

		app.get("{*splat}", (req, res) => {
			res.status(404).end();
		});

		// an error not handled by a route (including a rejected async handler) is logged, and reported to the client
		// without any detail of the server, such as a stack trace or file paths
		app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
			console.log(chalk.red(`unhandled error for ${req.method} ${req.originalUrl}: ${err instanceof Error ? err.stack : String(err)}`));
			if (res.headersSent) return next(err); // part of the response has been sent, so the connection can only be closed
			// errors from the body parsers carry an HTTP status (e.g. 413 when a document exceeds the size limit), and
			// "expose" when their message is safe to return to the client
			const { status, expose, message } = (err ?? {}) as { status?: unknown; expose?: unknown; message?: unknown };
			const code = typeof status == "number" && status >= 400 && status < 600 ? status : 500;
			res.status(code).type("text/plain").send(expose === true && typeof message == "string" ? message : "internal error while processing the request");
		});


		// start the HTTPS server
		// sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt
		const https_options = {
			key: readmyfile(keyFilename, {}) as Buffer,
			cert: readmyfile(certFilename, {}) as Buffer,
		};
		// Only one server uses the HTTP port: the validator itself when HTTPS is not available, otherwise a redirect to HTTPS.
		// The choice is made from the HTTPS server's 'listening' and 'error' events, as listen() is asynchronous.
		const listenFailed = (protocol: string, port: number, consequence: string) => (err: NodeJS.ErrnoException) => {
			const reason = err.code == "EADDRINUSE" ? "already in use" : `${err.code ?? ""} ${err.message}`.trim();
			console.log(chalk.red(`${protocol} port ${port} ${reason} -- ${consequence}`));
		};

		const startHTTP = () => {
			const http_server = createHttpServer(app);
			http_server.on("error", (err: NodeJS.ErrnoException) => {
				listenFailed("HTTP", app_options.port, "HTTP server not started")(err);
				// nothing is listening, so stop with a failure status (e.g. for systemd Restart=on-failure, or the cluster primary
				// to restart the worker). An explicit exit is needed as a cluster worker's IPC channel would otherwise keep it running
				process.exit(1);
			});
			http_server.listen(app_options.port, () => {
				console.log(chalk.cyan(`HTTP listening on port number ${(http_server.address() as AddressInfo).port}`));
			});
		};

		const startHTTPredirect = () => {
			const redirect_app = express();
			redirect_app.use(morgan(LOGGING_TEMPLATE));
			redirect_app.use(function(req, res) {
				res.redirect(`https://${req.hostname}:${app_options.sport}${req.originalUrl}`);
			});
			const redirect_server = createHttpServer(redirect_app);
			redirect_server.on("error", listenFailed("HTTP", app_options.port, "HTTP to HTTPS redirect not started"));
			redirect_server.listen(app_options.port, () => {
				console.log(chalk.cyan(`HTTP redirecting to HTTPS on port number ${app_options.port}`));
			});
		};

		if (https_options.key && https_options.cert) {
			if (app_options.sport == app_options.port) app_options.sport = app_options.port + 1;

			const https_server = createServer(https_options, app);
			https_server.once("error", (err: NodeJS.ErrnoException) => {
				listenFailed("HTTPS", app_options.sport, "HTTPS server not started, using HTTP")(err);
				startHTTP();
			});
			https_server.listen(app_options.sport, () => {
				console.log(chalk.cyan(`HTTPS listening on port number ${(https_server.address() as AddressInfo).port}`));
				startHTTPredirect();
			});
		}
		else startHTTP();
	}
}
