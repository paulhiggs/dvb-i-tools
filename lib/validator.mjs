/**
 * validator.mjs
 *
 *
 */
import { join } from "path";
import { createServer } from "https";
import os from "node:os";
import process from "process";

import chalk from "chalk";
import cors from "cors";
import express from "express";
import session from "express-session";
import morgan, { token } from "morgan";
import fileupload from "express-fileupload";
import favicon from "serve-favicon";
import fetchS from "sync-fetch";

import { Libxml2_wasm_init } from "../libxml2-wasm-extensions.mjs";
Libxml2_wasm_init();

import { CORSlibrary, CORSmanual, CORSnone, CORSoptions } from "./globals.mjs";
import { Default_SLEPR, __dirname } from "./data_locations.mjs";
import { drawForm, PAGE_TOP, PAGE_BOTTOM, drawResults } from "./ui.mjs";
import ErrorList from "./error_list.mjs";
import { isHTTPURL } from "./pattern_checks.mjs";
import { readmyfile } from "./utils.mjs";
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
} from "./classification_scheme_loaders.mjs";
import ServiceListCheck from "./sl_check.mjs";
import ContentGuideCheck from "./cg_check.mjs";
import SLEPR from "./slepr.mjs";
import writeOut, { createPrefix } from "./logger.mjs";
import { MODE_URL, MODE_FILE, MODE_SL, MODE_CG, MODE_UNSPECIFIED } from "./ui.mjs";

let csr = null;

const keyFilename = join(".", "selfsigned.key"),
	certFilename = join(".", "selfsigned.crt");

function DVB_I_check(req, res, slcheck, cgcheck, hasSL, hasCG, motd, mode = MODE_UNSPECIFIED, linktype = MODE_UNSPECIFIED) {
	if (!req.session.data) {
		// setup defaults
		req.session.data = {};
		req.session.data.lastUrl = "";
		req.session.data.mode = mode == MODE_UNSPECIFIED ? (hasSL ? MODE_SL : MODE_CG) : mode;
		req.session.data.entry = linktype == MODE_UNSPECIFIED ? MODE_URL : linktype;
		if (cgcheck) req.session.data.cgmode = cgcheck.supportedRequests[0].value;
	}
	if (req.session.data.lastUrl != req.url) {
		req.session.data.mode = mode == MODE_UNSPECIFIED ? (hasSL ? MODE_SL : MODE_CG) : mode;
		req.session.data.entry = linktype == MODE_UNSPECIFIED ? MODE_URL : linktype;
		req.session.data.lastUrl = req.url;
	}

	let FormArguments = { cg: MODE_CG, sl: MODE_SL, file: MODE_FILE, url: MODE_URL, hasSL: hasSL, hasCG: hasCG };
	if (!req.body?.testtype) drawForm(req, res, FormArguments, cgcheck ? cgcheck.supportedRequests : null, motd, null, null);
	else {
		let VVxml = null;
		req.parseErr = null;

		if (req.body.testtype == MODE_CG && req.body.requestType.length == 0) req.parseErr = "request type not specified";
		else if (req.body.doclocation == MODE_URL && req.body.XMLurl.length == 0) req.parseErr = "URL not specified";
		else if (req.body.doclocation == MODE_FILE && !(req.files && req.files.XMLfile)) req.parseErr = "File not provided";

		const log_prefix = createPrefix(req);
		if (!req.parseErr)
			switch (req.body.doclocation) {
				case MODE_URL:
					if (isHTTPURL(req.body.XMLurl)) {
						let resp = null;
						try {
							resp = fetchS(req.body.XMLurl);
						} catch (error) {
							req.parseErr = error.message;
						}
						if (resp) {
							if (resp.ok) VVxml = resp.text();
							else req.parseErr = `error (${resp.status}:${resp.statusText}) handling ${req.body.XMLurl}`;
						}
					} else req.parseErr = `${req.body.XMLurl} is not an HTTP(S) URL`;
					req.session.data.url = req.body.XMLurl;
					break;
				case MODE_FILE:
					try {
						VVxml = req.files.XMLfile.data.toString();
					} catch (err) {
						req.parseErr = `retrieval of FILE ${req.files.XMLfile.name} failed (${err})`;
					}
					req.session.data.url = null;
					break;
				default:
					req.parseErr = `method is not "${MODE_URL}" or "${MODE_FILE}"`;
			}
		let errs = new ErrorList();
		if (!req.parseErr)
			switch (req.body.testtype) {
				case MODE_CG:
					if (cgcheck) cgcheck.doValidateContentGuide(VVxml, req.body.requestType, errs, { log_prefix: log_prefix, report_schema_version: true });
					break;
				case MODE_SL:
					if (slcheck) slcheck.doValidateServiceList(VVxml, errs, { log_prefix: log_prefix, report_schema_version: true });
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
 * @param {Express request}  req           The Express request that triggered the validation
 * @param {Express response} res           The Express response to be written to the requester
 * @param {ServiceListCheck} slcheck       Initialised Service List validator
 * @param {String}           motd          HTML text for the Message Of The Day
 * @param {boolean}          jsonResponse  Flag indicating that the response should ne JSON format rather than HTML
 */
function validateServiceList(req, res, slcheck, motd, jsonResponse) {
	let errs = new ErrorList();
	let resp,
		VVxml = null;
	const log_prefix = createPrefix(req);
	if (req.method == "GET") {
		try {
			resp = fetchS(req.query.url);
		} catch (error) {
			req.parseErr = error.message;
		}
		if (resp) {
			if (resp.ok) VVxml = resp.text();
			else req.parseErr = `error (${resp.status}:${resp.statusText}) handling ${req.body.XMLurl}`;
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
 * Validate a service list
 *
 * @param {Express request}   req           The Express request that triggered the validation
 * @param {Express response}  res           The Express response to be written to the requester
 * @param {ContentGuideCheck} cgcheck       Initialised Content Guide Metadata validator
 * @param {String}            motd          HTML text for the Message Of The Day
 * @param {boolean}           jsonResponse  Flag indicating that the response should ne JSON format rather than HTML
 */
function validateContentGuide(req, res, cgcheck, motd, jsonResponse) {
	let errs = new ErrorList();
	let resp,
		VVxml = null;
	const log_prefix = createPrefix(req);
	if (req.method == "GET") {
		try {
			resp = fetchS(req.query.url);
		} catch (error) {
			console.log(error);
			req.parseErr = error.message;
		}
		if (resp) {
			console.log(resp.content);
			if (resp.ok) VVxml = resp.text();
			else req.parseErr = `error (${resp.status}:${resp.statusText}) handling ${req.body.XMLurl}`;
		}
	} else if (req.method == "POST") {
		VVxml = req.body;
	} else {
		res.status(405).end();
	}
	cgcheck.doValidateContentGuide(VVxml, req.query.type, errs, { log_prefix: log_prefix, report_schema_version: true });
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

function stats_header(res) {
	res.setHeader("Content-Type", "text/html");
	res.write(PAGE_TOP("Validator Stats"));
}
function stats_footer(res) {
	res.write(PAGE_BOTTOM);
}

function tabulate(res, group, stats) {
	res.write(`<h1>${group}</h1>`);
	if (Object.keys(stats).length === 0) res.write("<p>No statistics</p>");
	else {
		res.write("<table><tr><th>item</th><th>count</th></tr>");
		Object.getOwnPropertyNames(stats).forEach((key) => res.write(`<tr><td>${key}</td><td>${stats[key]}</td?</tr>`));
		res.write("</table>");
	}
	res.write("<hr/>");
}

/**
 * Setup the validation and service list registry endpoints
 *
 * @param {Object} options   Command Line Arguments - see OptionDefinitions in all-in-one.js
 */
export default function validator(options) {
	if (options.nocsr && options.nosl && options.nocg) {
		console.log(chalk.red("nothing to do... exiting"));
		process.exit(1);
	}

	if (!options.nocsr && !Object.prototype.hasOwnProperty.call(options, "CSRfile")) {
		console.log(chalk.red("SLEPR file not specified... exiting"));
		process.exit(1);
	}

	if (!Object.prototype.hasOwnProperty.call(options, "CORSmode")) options.CORSmode = CORSlibrary;
	else if (!CORSoptions.includes(options.CORSmode)) {
		console.log(chalk.red(`CORSmode must be "${CORSnone}", "${CORSlibrary}" to use the Express cors() handler, or "${CORSmanual}" to have headers inserted manually`));
		process.exit(1);
	}

	let motd = null;
	if (Object.prototype.hasOwnProperty.call(options, "motd")) {
		console.log(chalk.yellow("reading Message Of The Day from " + chalk.green(options.motd)));
		motd = readmyfile(options.motd, { encoding: "utf-8", flag: "r" });
	}

	// initialize Express
	let app = express();
	app.use(cors());

	app.use(express.static(__dirname));

	app.set("view engine", "ejs");
	app.use(fileupload());
	app.use(favicon(join("phlib", "ph-icon.ico")));

	token("protocol", (req) => {
		return req.protocol;
	});
	token("agent", (req) => {
		return `(${req.headers["user-agent"]})`;
	});
	token("parseErr", (req) => {
		return req.parseErr ? `(${req.parseErr})` : "";
	});
	token("location", (req) => {
		return req?.body?.testtype
			? `${req.body.testtype}::[${req.body.testtype == MODE_CG ? `(${req.body.requestType})` : ""}${
					req.body.doclocation == MODE_FILE ? (req.files?.XMLfile ? req.files.XMLfile.name : "unnamed") : req.body.XMLurl
				}]`
			: "[*]";
	});
	token("counts", (req) => {
		return req.diags ? `(${req.diags.countErrors},${req.diags.countWarnings},${req.diags.countInforms})` : "[-]";
	});

	app.use(morgan(":remote-addr :protocol :method :url :status :res[content-length] :counts - :response-time ms :agent :parseErr :location"));

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
		cgcheck = null;

	if (options.urls && options.CSRfile == Default_SLEPR.file) options.CSRfile = Default_SLEPR.url;

	let knownLanguages = LoadLanguages(options.urls);
	let isoCountries = LoadCountries(options.urls);
	let knownGenres = LoadGenres(options.urls);

	if (!options.nosl || !options.nocg) {
		let knownRatings = LoadRatings(options.urls);
		let accessibilityPurposes = LoadAccessibilityPurpose(options.urls);
		let audioPurposes = LoadAudioPurpose(options.urls);
		let subtitleCodings = LoadSubtitleCodings(options.urls);
		let subtitlePurposes = LoadSubtitlePurposes(options.urls);
		let videoFormats = LoadVideoCodecCS(options.urls);
		let audioFormats = LoadAudioCodecCS(options.urls);
		let audioPresentation = LoadAudioPresentationCS(options.urls);

		if (!options.nosl)
			slcheck = new ServiceListCheck(options.urls, {
				languagess: knownLanguages,
				genres: knownGenres,
				countries: isoCountries,
				accessibilities: accessibilityPurposes,
				audiopurps: audioPurposes,
				stcodings: subtitleCodings,
				stpurposes: subtitlePurposes,
				videofmts: videoFormats,
				audiofmts: audioFormats,
				audiopres: audioPresentation,
			});

		if (!options.nocg)
			cgcheck = new ContentGuideCheck(options.urls, {
				languages: knownLanguages,
				genres: knownGenres,
				ratings: knownRatings,
				countries: isoCountries,
				accessibilities: accessibilityPurposes,
				audiopurps: audioPurposes,
				stcodings: subtitleCodings,
				stpurposes: subtitlePurposes,
				videofmts: videoFormats,
				audiofmts: audioFormats,
				audiopres: audioPresentation,
			});
	}
	if (!options.nosl) {
		app.all("/validate_sl", express.text({ type: "application/xml", limit: "10mb" }), (req, res) => {
			validateServiceList(req, res, slcheck, motd, false);
		});

		app.all("/validate_sl_json", express.text({ type: "application/xml", limit: "10mb" }), (req, res) => {
			validateServiceList(req, res, slcheck, motd, true);
		});

		app.all("/validate_cg", express.text({ type: "application/xml", limit: "10mb" }), (req, res) => {
			validateContentGuide(req, res, cgcheck, motd, false);
		});

		app.all("/validate_cg_json", express.text({ type: "application/xml", limit: "10mb" }), (req, res) => {
			validateContentGuide(req, res, cgcheck, motd, true);
		});
	}

	const SLEPR_query_route = "/query",
		SLEPR_reload_route = "/reload";

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

	if (!options.nosl || !options.nocg) {
		app.get("/check", express.text({ type: "application/xml", limit: "10mb" }), (req, res) => {
			DVB_I_check(req, res, slcheck, cgcheck, !options.nosl, !options.nocg, motd);
		});
		app.post("/check", express.text({ type: "application/xml", limit: "10mb" }), (req, res) => {
			DVB_I_check(req, res, slcheck, cgcheck, !options.nosl, !options.nocg, motd);
		});
	}

	if (!options.nocsr) {
		csr = new SLEPR(options.urls, knownLanguages, isoCountries, knownGenres);
		csr.loadServiceListRegistry(options.CSRfile);

		if (options.CORSmode == "manual") {
			app.options(SLEPR_query_route, manualCORS);
		}
		app.get(SLEPR_query_route, manualCORS, (req, res) => {
			csr.processServiceListRequest(req, res);
			res.end();
		});

		app.get(SLEPR_reload_route, (req, res) => {
			csr.loadServiceListRegistry(options.CSRfile);
			res.status(200).end();
		});
	}

	app.get("/stats", (req, res) => {
		stats_header(res);
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
		csr && tabulate(res, "CSR", csr.stats());
		slcheck && tabulate(res, "SL", slcheck.stats());
		cgcheck && tabulate(res, "CG", cgcheck.stats());
		stats_footer(res);
		res.status(200).end();
	});

	app.get("{*splat}", (req, res) => {
		res.status(404).end();
	});

	// start the HTTP server
	var http_server = app.listen(options.port, function () {
		if (http_server.address()?.port) console.log(chalk.cyan(`HTTP listening on port number ${http_server.address().port}`));
		else console.log(chalk.red(`HTTP port ${options.port} already in use -- HTTP server not started`));
	});

	// start the HTTPS server
	// sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt
	var https_options = {
		key: readmyfile(keyFilename),
		cert: readmyfile(certFilename),
	};

	if (https_options.key && https_options.cert) {
		if (options.sport == options.port) options.sport = options.port + 1;

		var https_server = createServer(https_options, app);
		https_server.listen(options.sport, function () {
			console.log(chalk.cyan(`HTTPS listening on port number ${https_server.address().port}`));
		});
	}
}
