// express framework - https://expressjs.com/en/4x/api.html
import express from "express";

// morgan - https://github.com/expressjs/morgan
import morgan, { token } from "morgan";

// file upload for express - https://github.com/richardgirges/express-fileupload
import fileupload from "express-fileupload";

// favourite icon - https://www.npmjs.com/package/serve-favicon
import favicon from "serve-favicon";

import { join } from "path";
const keyFilename=join(".","selfsigned.key"), certFilename=join(".","selfsigned.crt");

import { createServer } from "https";

// command line arguments - https://github.com/75lb/command-line-args
import commandLineArgs from 'command-line-args';

import { IANA_Subtag_Registry, TVA_ContentCS, TVA_FormatCS, DVBI_ContentSubject, ISO3166 } from './data-locations.js';

import { HTTPPort } from "./globals.js";
import { readmyfile } from './utils.js';

// the service list validation
import ServiceListCheck from './sl-check.js';

import { DVB_I_check, MODE_SL, MODE_CG, MODE_FILE, MODE_URL } from './Validator.js';

let app=express();

import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(__dirname));

app.set('view engine', 'ejs');
app.use(fileupload());

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

app.use(favicon(join('phlib','ph-icon.ico')));


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
token("slLoc", function getCheckedLocation(req) {
	if (req.files && req.files.XMLfile) return `[${req.files.XMLfile.name}]`;
	if (req.query && req.query.XMLurl) return `[${req.query.XMLurl}]`;
	return "[*]";
});

app.use(morgan(":remote-addr :protocol :method :url :status :res[content-length] - :response-time ms :agent :parseErr :slLoc"));


// parse command line options
const optionDefinitions=[
	{name:'urls', alias:'u', type:Boolean, defaultValue:false},
	{name:'port', alias:'p', type:Number, defaultValue:HTTPPort.sl },
	{name:'sport', alias:'s', type:Number, defaultValue:HTTPPort.sl+1 }
];
 
const options=commandLineArgs(optionDefinitions);

var slcheck=new ServiceListCheck(options.urls);

// handle HTTP POST requests to /check
app.post("/check", function(req,res) {
	DVB_I_check(false, req, res, slcheck, null, true, false, MODE_SL, MODE_URL);
});

// handle HTTP GET requests to /check
app.get("/check", function(req,res) {
	DVB_I_check(false, req, res, slcheck, null, true, false, MODE_SL, MODE_URL);
});

// handle HTTP POST requests to /checkFile
app.post("/checkFile", function(req,res) {
	DVB_I_check(false, req, res, slcheck, null, true, false, MODE_SL, MODE_FILE);
});

// handle HTTP GET requests to /checkFile
app.get("/checkFile", function(req,res) {
	DVB_I_check(false, req, res, slcheck, null, true, false, MODE_SL, MODE_FILE);
});

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

