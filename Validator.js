// express framework - https://expressjs.com/en/4x/api.html
import express from "express";
import session from "express-session";

import { existsSync, writeFile } from "fs";
import { join, sep } from "path";

import chalk from "chalk";

import cors from "cors";
import { createServer } from "https";

import os from "node:os";

// morgan - https://github.com/expressjs/morgan
import morgan, { token } from "morgan";

// file upload for express - https://github.com/richardgirges/express-fileupload
import fileupload from "express-fileupload";

// favourite icon - https://www.npmjs.com/package/serve-favicon
import favicon from "serve-favicon";

import process from "process";

import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import fetchS from "sync-fetch";

import { drawForm, PAGE_TOP, PAGE_BOTTOM } from "./ui.js";
import ErrorList from "./ErrorList.js";
import { isHTTPURL } from "./pattern_checks.js";
import { Default_SLEPR } from "./data-locations.js";
import { CORSlibrary, CORSmanual, CORSnone, CORSoptions } from "./globals.js";

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
} from "./CSLoaders.js";

export const MODE_UNSPECIFIED = "none",
	MODE_SL = "sl",
	MODE_CG = "cg",
	MODE_URL = "url",
	MODE_FILE = "file";

// the service list validation
import ServiceListCheck from "./sl-check.js";

// the content guide validation
import ContentGuideCheck from "./cg-check.js";

// the service list registrt
import SLEPR from "./slepr.js";
var csr = null;

import { readmyfile } from "./utils.js";
const keyFilename = join(".", "selfsigned.key"),
	certFilename = join(".", "selfsigned.crt");

export function writeOut(errs, filebase, markup, req = null) {
	if (!filebase || errs.markupXML?.length == 0) return;

	let outputLines = [];
	if (markup && req?.body?.XMLurl) outputLines.push(`<!-- source: ${req.body.XMLurl} -->`);
	errs.markupXML.forEach((line) => {
		outputLines.push(line.value);
		if (markup && line.validationErrors)
			line.validationErrors.forEach((error) => {
				outputLines.push(`<!--${error.replace(/[\n]/g, "")}-->`);
			});
	});
	let filename = markup ? `${filebase}.mkup.txt` : `${filebase}.raw.txt`;
	writeFile(filename, outputLines.join("\n"), (err) => {
		if (err) console.log(chalk.red(err));
	});
}

function createPrefix(req) {
	const logDir = join(".", "arch");

	if (!existsSync(logDir)) return null;

	const getDate = (d) => {
		const fillZero = (t) => (t < 10 ? `0${t}` : t);
		return `${d.getFullYear()}-${fillZero(d.getMonth() + 1)}-${fillZero(d.getDate())} ${fillZero(d.getHours())}.${fillZero(d.getMinutes())}.${fillZero(d.getSeconds())}`;
	};

	let fname = req.body.doclocation == MODE_URL ? req.body.XMLurl.substr(req.body.XMLurl.lastIndexOf("/") + 1) : req?.files?.XMLfile?.name;
	if (!fname) return null;

	return `${logDir}${sep}${getDate(new Date())} (${req.body.testtype == MODE_SL ? "SL" : req.body.requestType}) ${fname.replace(/[/\\?%*:|"<>]/g, "-")}`;
}

function DVB_I_check(deprecationWarning, req, res, slcheck, cgcheck, hasSL, hasCG, mode = MODE_UNSPECIFIED, linktype = MODE_UNSPECIFIED) {
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
	if (!req.body.testtype) drawForm(deprecationWarning ? "/check" : null, req, res, FormArguments, cgcheck ? cgcheck.supportedRequests : null, null, null);
	else {
		let VVxml = null;
		req.parseErr = null;

		if (req.body.testtype == MODE_CG && req.body.requestType.length == 0) req.parseErr = "request type not specified";
		else if (req.body.doclocation == MODE_URL && req.body.XMLurl.length == 0) req.parseErr = "URL not specified";
		else if (req.body.doclocation == MODE_FILE && !(req.files && req.files.XMLfile)) req.parseErr = "File not provided";

		let log_prefix = createPrefix(req, res);
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
						req.parseErr = `retrieval of FILE ${req.files.XMLfile.name} failed`;
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
					if (cgcheck) cgcheck.doValidateContentGuide(VVxml, req.body.requestType, errs, log_prefix);
					break;
				case MODE_SL:
					if (slcheck) slcheck.doValidateServiceList(VVxml, errs, log_prefix);
					break;
			}

		req.session.data.mode = req.body.testtype;
		req.session.data.entry = req.body.doclocation;
		if (req.body.requestType) req.session.data.cgmode = req.body.requestType;
		drawForm(deprecationWarning ? "/check" : null, req, res, FormArguments, cgcheck ? cgcheck.supportedRequests : null, req.parseErr, errs);

		req.diags = {};
		req.diags.countErrors = errs.numErrors();
		req.diags.countWarnings = errs.numWarnings();
		req.diags.countInforms = errs.numInformationals();

		writeOut(errs, log_prefix, true, req);
	}
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

	// initialize Express
	let app = express();
	app.use(cors());

	app.use(express.static(__dirname));

	app.set("view engine", "ejs");
	app.use(fileupload());
	app.use(favicon(join("phlib", "ph-icon.ico")));

	token("protocol", function getProtocol(req) {
		return req.protocol;
	});
	token("agent", function getAgent(req) {
		return `(${req.headers["user-agent"]})`;
	});
	token("parseErr", function getParseErr(req) {
		return req.parseErr ? `(${req.parseErr})` : "";
	});
	token("location", function getCheckedLocation(req) {
		return req.body.testtype
			? `${req.body.testtype}::[${req.body.testtype == MODE_CG ? `(${req.body.requestType})` : ""}${
					req.body.doclocation == MODE_FILE ? (req.files?.XMLfile ? req.files.XMLfile.name : "unnamed") : req.body.XMLurl
			  }]`
			: "[*]";
	});
	token("counts", function getCounts(req) {
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

	if (options.urls && options.CSRfile == Default_SLEPR.file) options.CSRfile = Default_SLEPR.url;

	let knownLanguages = LoadLanguages(options.urls);
	let knownGenres = LoadGenres(options.urls);
	let knownRatings = LoadRatings(options.urls);
	let accessibilityPurposes = LoadAccessibilityPurpose(options.urls);
	let audioPurposes = LoadAudioPurpose(options.urls);
	let subtitleCodings = LoadSubtitleCodings(options.urls);
	let subtitlePurposes = LoadSubtitlePurposes(options.urls);
	let isoCountries = LoadCountries(options.urls);
	let videoFormats = LoadVideoCodecCS(options.urls);
	let audioFormats = LoadAudioCodecCS(options.urls);
	let audioPresentation = LoadAudioPresentationCS(options.urls);

	let slcheck = new ServiceListCheck(options.urls, {
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
	let cgcheck = new ContentGuideCheck(options.urls, {
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

	if (!options.nosl) {
		// handle HTTP POST requests to /checkSL
		app.post("/checkSL", function (req, res) {
			DVB_I_check(true, req, res, slcheck, cgcheck, !options.nosl, !options.nocg, MODE_SL, MODE_URL);
		});

		// handle HTTP GET requests to /checkSL
		app.get("/checkSL", function (req, res) {
			DVB_I_check(true, req, res, slcheck, cgcheck, !options.nosl, !options.nocg, MODE_SL, MODE_URL);
		});

		// handle HTTP POST requests to /checkSLFile
		app.post("/checkSLFile", function (req, res) {
			DVB_I_check(true, req, res, slcheck, cgcheck, !options.nosl, !options.nocg, MODE_SL, MODE_FILE);
		});

		// handle HTTP GET requests to /checkSLFile
		app.get("/checkSLFile", function (req, res) {
			DVB_I_check(true, req, res, slcheck, cgcheck, !options.nosl, !options.nocg, MODE_SL, MODE_FILE);
		});
	}

	const SLEPR_query_route = "/query",
		SLEPR_reload_route = "/reload";

	let manualCORS = function (res, req, next) {
		next();
	};
	if (options.CORSmode == CORSlibrary) {
		app.options("*", cors());
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

	if (!options.nocg) {
		// handle HTTP POST requests to /checkCG
		app.post("/checkCG", function (req, res) {
			DVB_I_check(true, req, res, slcheck, cgcheck, !options.nosl, !options.nocg, MODE_CG, MODE_URL);
		});

		// handle HTTP GET requests to /checkCG
		app.get("/checkCG", function (req, res) {
			DVB_I_check(true, req, res, slcheck, cgcheck, !options.nosl, !options.nocg, MODE_CG, MODE_URL);
		});

		// handle HTTP POST requests to /checkCGFile
		app.post("/checkCGFile", function (req, res) {
			DVB_I_check(true, req, res, slcheck, cgcheck, !options.nosl, !options.nocg, MODE_CG, MODE_FILE);
		});

		// handle HTTP GET requests to /checkCGFile
		app.get("/checkCGFile", function (req, res) {
			DVB_I_check(true, req, res, slcheck, cgcheck, !options.nosl, !options.nocg, MODE_CG, MODE_FILE);
		});
	}

	if (!options.nosl || !options.nocg) {
		app.get("/check", function (req, res) {
			DVB_I_check(false, req, res, slcheck, cgcheck, !options.nosl, !options.nocg);
		});
		app.post("/check", function (req, res) {
			DVB_I_check(false, req, res, slcheck, cgcheck, !options.nosl, !options.nocg);
		});
	}

	if (!options.nocsr) {
		csr = new SLEPR(options.urls, knownLanguages, isoCountries, knownGenres);
		csr.loadServiceListRegistry(options.CSRfile);

		if (options.CORSmode == "manual") {
			app.options(SLEPR_query_route, manualCORS);
		}
		app.get(SLEPR_query_route, manualCORS, function (req, res) {
			csr.processServiceListRequest(req, res);
			res.end();
		});

		app.get(SLEPR_reload_route, function (req, res) {
			csr.loadServiceListRegistry(options.CSRfile);
			res.status(200).end();
		});
	}

	app.get("/stats", function (req, res) {
		stats_header(res);
		tabulate(res, "System", {
			host: os.hostname(),
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
		res.status(4200).end();
	});

	// dont handle any other requests
	app.get("*", function (req, res) {
		res.status(404).end();
	});

	// start the HTTP server
	var http_server = app.listen(options.port, function () {
		console.log(chalk.cyan(`HTTP listening on port number ${http_server.address().port}`));
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
