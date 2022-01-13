// express framework - https://expressjs.com/en/4x/api.html
import express from "express";

import cors from "cors";

// morgan - https://github.com/expressjs/morgan
import morgan, { token } from "morgan";

// file upload for express - https://github.com/richardgirges/express-fileupload
import fileupload from "express-fileupload";

// favourite icon - https://www.npmjs.com/package/serve-favicon
import favicon from "serve-favicon";

import process from "process";

import { join } from "path";
const keyFilename=join(".","selfsigned.key"), certFilename=join(".","selfsigned.crt");

import { createServer } from "https";

// command line arguments - https://github.com/75lb/command-line-args
import commandLineArgs from 'command-line-args';

import { Default_SLEPR, IANA_Subtag_Registry, TVA_ContentCS, TVA_FormatCS, DVBI_ContentSubject, ISO3166 } from "./data-locations.js";

import { CORSlibrary, CORSmanual, CORSnone, CORSoptions, HTTPPort } from './globals.js';
import { readmyfile } from "./utils.js";

// the service list validation
import ServiceListCheck from './sl-check.js';

// the content guide validation
import ContentGuideCheck from './cg-check.js';

// the service list registrt
import SLEPR from './slepr.js';
var csr=null;

import IANAlanguages from "./IANAlanguages.js";
import ISOcountries from "./ISOcountries.js";
import ClassificationScheme from "./ClassificationScheme.js";

import { DVB_I_check, MODE_SL, MODE_CG, MODE_FILE, MODE_URL } from './Validator.js';

// initialize Express
let app=express();
app.use(cors());

import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(express.static(__dirname));

app.set('view engine', 'ejs');
app.use(fileupload());
app.use(favicon(join('phlib','ph-icon.ico')));


token("protocol", function getProtocol(req) {
	return req.protocol;
});
token("agent", function getAgent(req) {
	return `(${req.headers["user-agent"]})`;
});
token("parseErr", function getParseErr(req) {
	if (req.parseErr) return `(${req.parseErr})`;
	return "";
});
token("location", function getCheckedLocation(req) {
	if (req.body.testtype)
		return `${req.body.testtype}::[${req.body.testtype==MODE_CG?`(${req.body.requestType})`:""}${req.body.doclocation==MODE_FILE?(req.files?.XMLfile?req.files.XMLfile.name:'unnamed'):req.body.XMLurl}]`;
	return "[*]";
});

app.use(morgan(":remote-addr :protocol :method :url :status :res[content-length] - :response-time ms :agent :parseErr :location"));

app.use(express.urlencoded({ extended: true }));

app.set('trust proxy', 1);
import session from 'express-session';
app.use(session({
	secret:'keyboard car',
	resave: false,
	saveUninitialized: true,
	cookie: { maxAge:60000}
}));

// parse command line options
const optionDefinitions=[
	{name:'urls', alias:'u', type:Boolean, defaultValue:false},
	{name:'port', alias:'p', type:Number, defaultValue:HTTPPort.all_in_one },
	{name:'sport', alias:'s', type:Number, defaultValue:HTTPPort.all_in_one+1 },
	{name:'nocsr', type:Boolean, defaultValue:false},
	{name:'nosl', type:Boolean, defaultValue:false},
	{name:'nocg', type:Boolean, defaultValue:false},
	{name:'CSRfile', alias:'f', type:String, defaultValue:Default_SLEPR.file},
	{name:'CORSmode', alias: 'c', type:String, defaultValue:CORSlibrary}
];
 
const options=commandLineArgs(optionDefinitions);

if (!CORSoptions.includes(options.CORSmode)) {
	console.log(`CORSmode must be "${CORSnone}", "${CORSlibrary}" to use the Express cors() handler, or "${CORSmanual}" to have headers inserted manually`);
	process.exit(1); 
}

if (options.urls && (options.CSRfile==Default_SLEPR.file))
	options.CSRfile=Default_SLEPR.url;

let knownLanguages=new IANAlanguages();
knownLanguages.loadLanguages(options.urls?{url:IANA_Subtag_Registry.url}:{file:IANA_Subtag_Registry.file});

let knownGenres=new ClassificationScheme();
knownGenres.loadCS(options.urls?
		{urls:[TVA_ContentCS.url, TVA_FormatCS.url, DVBI_ContentSubject.url]}:
		{files:[TVA_ContentCS.file, TVA_FormatCS.file, DVBI_ContentSubject.file]});

let isoCountries=new ISOcountries(false, true);
isoCountries.loadCountries(options.urls?{url:ISO3166.url}:{file:ISO3166.file});

let slcheck=new ServiceListCheck(options.urls, knownLanguages, knownGenres, isoCountries),
    cgcheck=new ContentGuideCheck(options.urls, knownLanguages, knownGenres);	
    
if (options.nocsr && options.nosl && options.nocg) {
	console.log("nothing to do... exiting");
	process.exit(1);
}

if (!options.nosl) {
	// handle HTTP POST requests to /checkSL
	app.post("/checkSL", function(req, res) {
		DVB_I_check(true, req, res, slcheck, cgcheck, !options.nosl, !options.nocg, MODE_SL, MODE_URL);
	});

	// handle HTTP GET requests to /checkSL
	app.get("/checkSL", function(req,res) {
		DVB_I_check(true, req, res, slcheck, cgcheck, !options.nosl, !options.nocg, MODE_SL, MODE_URL);
	});

	// handle HTTP POST requests to /checkSLFile
	app.post("/checkSLFile", function(req,res) {
		DVB_I_check(true, req, res, slcheck, cgcheck, !options.nosl, !options.nocg, MODE_SL, MODE_FILE);
	});

	// handle HTTP GET requests to /checkSLFile
	app.get("/checkSLFile", function(req,res) {
		DVB_I_check(true, req, res, slcheck, cgcheck, !options.nosl, !options.nocg, MODE_SL, MODE_FILE);
	});
}

const SLEPR_query_route='/query', SLEPR_reload_route='/reload', SLEPR_stats_route='/stats';

let manualCORS=function(res, req, next) {next();};
if (options.CORSmode==CORSlibrary) {
	app.options("*", cors());
}
else if (options.CORSmode==CORSmanual) {
	manualCORS=function (req, res, next) {
		let opts=res.getHeader('X-Frame-Options');
		if (opts) {
			if (!opts.includes('SAMEORIGIN')) opts.push('SAMEORIGIN');
		}
		else opts=['SAMEORIGIN'];
		res.setHeader('X-Frame-Options', opts );
		res.setHeader('Access-Control-Allow-Origin', "*");
		next();
	};
}

if (!options.nocg) {
	// handle HTTP POST requests to /checkCG
	app.post("/checkCG", function(req, res) {
		DVB_I_check(true, req, res, slcheck, cgcheck, !options.nosl, !options.nocg, MODE_CG, MODE_URL);
	});

	// handle HTTP GET requests to /checkCG
	app.get("/checkCG", function(req, res) {
		DVB_I_check(true, req, res, slcheck, cgcheck, !options.nosl, !options.nocg, MODE_CG, MODE_URL);
	});

	// handle HTTP POST requests to /checkCGFile
	app.post("/checkCGFile", function(req, res) {
		DVB_I_check(true, req, res, slcheck, cgcheck, !options.nosl, !options.nocg, MODE_CG, MODE_FILE);
	});

	// handle HTTP GET requests to /checkCGFile
	app.get("/checkCGFile", function(req, res) {
		DVB_I_check(true, req, res, slcheck, cgcheck, !options.nosl, !options.nocg, MODE_CG, MODE_FILE);
	});
}

if (!options.nosl || !options.nocg) {
	app.get("/check", function (req,res) {
		DVB_I_check(false, req, res, slcheck, cgcheck, !options.nosl, !options.nocg);
	});
	app.post("/check", function (req,res) {
		DVB_I_check(false, req, res, slcheck, cgcheck, !options.nosl, !options.nocg);
	});
}

if (!options.nocsr) {
	csr=new SLEPR(options.urls, knownLanguages, isoCountries, knownGenres);
	csr.loadServiceListRegistry(options.CSRfile);

	if (options.CORSmode=="manual") {
		app.options(SLEPR_query_route, manualCORS); 
	}
	app.get(SLEPR_query_route, manualCORS, function(req, res) {
		csr.processServiceListRequest(req, res);
		res.end();
	});

	app.get(SLEPR_reload_route, function(req, res) {
		csr.loadServiceListRegistry(options.CSRfile);
		res.status(200).end();
	});
	
	app.get(SLEPR_stats_route, function(req, res) {
		res.status(404).end();
	});
}


// dont handle any other requests
app.get("*", function(req,res) {
	res.status(404).end();
});


// start the HTTP server
var http_server=app.listen(options.port, function() {
	console.log(`HTTP listening on port number ${http_server.address().port}`);
});



// start the HTTPS server
// sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt
var https_options={
	key:readmyfile(keyFilename),
	cert:readmyfile(certFilename)
};

if (https_options.key && https_options.cert) {
	if (options.sport==options.port)
		options.sport=options.port+1;
	
	var https_server=createServer(https_options, app);
	https_server.listen(options.sport, function() {
		console.log(`HTTPS listening on port number ${https_server.address().port}`);
	});
}
