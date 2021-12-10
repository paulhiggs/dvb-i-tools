// express framework - https://expressjs.com/en/4x/api.html
import express from "express";

// morgan - https://github.com/expressjs/morgan
import morgan, { token } from "morgan";

// express-fileupload - https://github.com/richardgirges/express-fileupload#readme
import fileUpload from 'express-fileupload';

// favourite icon - https://www.npmjs.com/package/serve-favicon
import favicon from "serve-favicon";

import { join } from "path";
const keyFilename=join(".", "selfsigned.key"), certFilename=join(".", "selfsigned.crt");

import { createServer } from "https";

// command line arguments - https://github.com/75lb/command-line-args
import commandLineArgs from 'command-line-args';

import { IANA_Subtag_Registry, TVA_ContentCS, TVA_FormatCS, DVBI_ContentSubject } from "./data-locations.js";

import { HTTPPort } from "./globals.js";
import { isEmpty, readmyfile } from './utils.js';

// the content guide validation
import ContentGuideCheck from './cg-check.js';
var cgcheck=null;

import { DVB_I_check, MODE_SL, MODE_CG, MODE_FILE, MODE_URL } from './Validator.js';


// command line options
const optionDefinitions=[
	{ name:'urls', alias:'u', type:Boolean, defaultValue:false},
	{ name:'port', alias:'p', type:Number, defaultValue:HTTPPort.cg },
	{ name:'sport', alias:'s', type:Number, defaultValue:HTTPPort.cg+1 }
];
const options=commandLineArgs(optionDefinitions);

import IANAlanguages from "./IANAlanguages.js";
let knownLanguages=new IANAlanguages();
knownLanguages.loadLanguages(options.urls?{url:IANA_Subtag_Registry.url}:{file:IANA_Subtag_Registry.file});

import ClassificationScheme from "./ClassificationScheme.js";

let knownGenres=new ClassificationScheme();
knownGenres.loadCS(options.urls?
		{urls:[TVA_ContentCS.url, TVA_FormatCS.url, DVBI_ContentSubject.url]}:
		{files:[TVA_ContentCS.file, TVA_FormatCS.file, DVBI_ContentSubject.file]});

cgcheck=new ContentGuideCheck(options.urls, knownLanguages, knownGenres);


//middleware
token("protocol", function getProtocol(req) {
	return req.protocol;
});
token("parseErr", function getParseErr(req) {
	if (req.parseErr) return `(${req.parseErr})`;
	return "";
});
token("agent", function getAgent(req) {
	return `(${req.headers["user-agent"]})`;
});
token("cgLoc", function getCheckedLocation(req) {
	if (req.files && req.files.CGfile) return `[${req.files.CGfile.name}]`;
	if (req.query.CGurl) return `[${req.query.CGurl}]`;
	return "[*]";
});

var app=express();
app.use(morgan(":remote-addr :protocol :method :url :status :res[content-length] - :response-time ms :agent :parseErr :cgLoc"));

import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(__dirname));
app.set('view engine', 'ejs');
app.use(fileUpload());

// initialize Express
app.use(express.urlencoded({ extended: true }));

app.set('trust proxy', 1);
import session from 'express-session';
app.use(session({
	secret:'keyboard car',
	resave: false,
	saveUninitialized: true,
	cookie: { maxAge:60000}
}));

app.use(favicon(join('phlib', 'ph-icon.ico')));

// handle HTTP POST requests to /check
app.post("/check", function(req, res) {
	//req.query.CGurl=req.body.CGurl;
	//processQuery(req, res);
	DVB_I_check(false, req, res, null, cgcheck, false, true, MODE_CG, MODE_URL);
});

// handle HTTP GET requests to /check
app.get("/check", function(req, res) {
	//processQuery(req, res);
	DVB_I_check(false, req, res, null, cgcheck, false, true, MODE_CG, MODE_URL);
});

// handle HTTP POST requests to /checkFile
app.post("/checkFile", function(req, res) {
	//req.query.CGfile=req.body.CGfile;
	//processFile(req, res);
	DVB_I_check(false, req, res, null, cgcheck, false, true, MODE_CG, MODE_FILE);
});

// handle HTTP GET requests to /checkFile
app.get("/checkFile", function(req, res) {
	//processFile(req, res);
	DVB_I_check(false, req, res, null, cgcheck, false, true, MODE_CG, MODE_FILE);
});

// dont handle any other requests
app.get("*", function(req, res) {
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
		console.log(`HTTPS listening on port number ${https_server.address().port}` );
	});
}
