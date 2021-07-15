/*jshint esversion: 6 */

// node.js - https://nodejs.org/en/
// express framework - https://expressjs.com/en/4x/api.html
const express=require("express");

const fs=require("fs"), path=require("path");

// command line arguments - https://github.com/75lb/command-line-args
const commandLineArgs=require('command-line-args');

// favourite icon - https://www.npmjs.com/package/serve-favicon
const favicon=require("serve-favicon");

const fetch=require("node-fetch");

// morgan - https://github.com/expressjs/morgan
const morgan=require("morgan");

// express-fileupload - https://github.com/richardgirges/express-fileupload#readme
const fileUpload=require('express-fileupload');
	
const https=require("https");
const keyFilename=path.join(".", "selfsigned.key"), certFilename=path.join(".", "selfsigned.crt");

const phlib=require('./phlib/phlib');

const ui=require('./ui.js');

const ErrorList=require("./ErrorList.js");

const locs=require("./data-locations.js");

const globals = require("./globals");
const {isEmpty, readmyfile}=require('./utils.js');

// the content guide validation
const ContentGuideCheck=require('./cg-check.js');
var cgcheck=null;




/**
 * Process the content guide specificed for errors and display them
 *
 * @param {Object} req The request from Express
 * @param {Object} res The HTTP response to be sent to the client
 */ 
function processQuery(req, res) {

	function handleErrors(response) {
		if (!response.ok) {
			throw Error(response.statusText);
		}
		return response;
	}

    if (isEmpty(req.query)) {
		ui.drawCGForm(true, res);
		res.end();
	}  
    else if (req && req.query && req.query.CGurl) {
		fetch(req.query.CGurl)
			.then(handleErrors)
			.then(function (response) {return response.text();})
			.then(function (res) {return cgcheck.validateContentGuide(res.replace(/(\r\n|\n|\r|\t)/gm, ""), req.body.requestType);})
			.then(function (errs) {return ui.drawCGForm(true, res, req.query.CGurl, req.body.requestType, null, errs);})
			.then(function (res) {res.end();})
			.catch(function (error) {
				console.log(error);
				ui.drawCGForm(true, res, req.query.CGurl, req.body.requestType, `error (${error}) handling ${req.query.CGurl}`);
				res.status(400);
				res.end();
			});
    }
	else {
        ui.drawCGForm(true, res, req.query.CGurl, req.body.requestType, "URL not specified");
        res.status(400);
		res.end();
	}
}


/**
 * Process the content guide specificed by a file name for errors and display them
 *
 * @param {Object} req The request from Express
 * @param {Object} res The HTTP response to be sent to the client
 */ 
function processFile(req, res) {
    if (isEmpty(req.query)) 
		ui.drawCGForm(false, res);    
    else if (req && req.files && req.files.CGfile) {
        let CGxml=null, errs=new ErrorList(), fname="***";
		if (req && req.files && req.files.CGfile) fname=req.files.CGfile.name;
        try {
            CGxml=req.files.CGfile.data;
        }
        catch (err) {
            errs.pushCode("PF001", `retrieval of FILE ${fname} failed`);
        }
		if (CGxml) {
			let doc=CGxml.toString().replace(/(\r\n|\n|\r|\t)/gm, "");
			errs.loadDocument(doc);
			cgcheck.doValidateContentGuide(doc, req.body.requestType, errs);
		}
        ui.drawCGForm(false, res, fname, req.body.requestType, null, errs);
    }
	else {
        ui.drawCGForm(false, res, (req.files && req.files.CGfile)?req.files.CGfile.name:null, req.body.requestType, "File not specified");
        res.status(400);
	}
    res.end();
}


// command line options
const optionDefinitions=[
	{ name:'urls', alias:'u', type:Boolean, defaultValue:false},
	{ name:'port', alias:'p', type:Number, defaultValue:globals.HTTPPort.cg },
	{ name:'sport', alias:'s', type:Number, defaultValue:globals.HTTPPort.cg+1 }
];
const options=commandLineArgs(optionDefinitions);

const IANAlanguages=require("./IANAlanguages.js");
let knownLanguages=new IANAlanguages();
knownLanguages.loadLanguages(options.urls?{url:locs.IANA_Subtag_Registry.url}:{file:locs.IANA_Subtag_Registry.file});

const ClassificationScheme=require("./ClassificationScheme.js");

let knownGenres=new ClassificationScheme();
knownGenres.loadCS(options.urls?
		{urls:[locs.TVA_ContentCS.url, locs.TVA_FormatCS.url, locs.DVBI_ContentSubject.url]}:
		{files:[locs.TVA_ContentCS.file, locs.TVA_FormatCS.file, locs.DVBI_ContentSubject.file]});

cgcheck=new ContentGuideCheck(options.urls, knownLanguages, knownGenres);


//middleware
morgan.token("protocol", function getProtocol(req) {
    return req.protocol;
});
morgan.token("parseErr", function getParseErr(req) {
    if (req.parseErr) return `(${req.parseErr})`;
    return "";
});
morgan.token("agent", function getAgent(req) {
    return `(${req.headers["user-agent"]})`;
});
morgan.token("cgLoc", function getCheckedLocation(req) {
	if (req.files && req.files.CGfile) return `[${req.files.CGfile.name}]`;
    if (req.query.CGurl) return `[${req.query.CGurl}]`;
	return "[*]";
});

var app=express();
app.use(morgan(":remote-addr :protocol :method :url :status :res[content-length] - :response-time ms :agent :parseErr :cgLoc"));

app.use(express.static(__dirname));
app.set('view engine', 'ejs');
app.use(fileUpload());

// initialize Express
app.use(express.urlencoded({ extended: true }));

app.use(favicon(path.join('phlib', 'ph-icon.ico')));

// handle HTTP POST requests to /check
app.post("/check", function(req, res) {
    req.query.CGurl=req.body.CGurl;
    processQuery(req, res);
});

// handle HTTP GET requests to /check
app.get("/check", function(req, res) {
    processQuery(req, res);
});

// handle HTTP POST requests to /checkFile
app.post("/checkFile", function(req, res) {
	req.query.CGfile=req.body.CGfile;
    processFile(req, res);
});

// handle HTTP GET requests to /checkFile
app.get("/checkFile", function(req, res) {
    processFile(req, res);
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
		
    var https_server=https.createServer(https_options, app);
    https_server.listen(options.sport, function() {
        console.log(`HTTPS listening on port number ${https_server.address().port}` );
    });
}
