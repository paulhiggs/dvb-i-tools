/* jshint esversion: 8 */
// node.js - https://nodejs.org/en/
// express framework - https://expressjs.com/en/4x/api.html
const express=require("express");

//const cluster = require('cluster');
//const totalCPUs = require('os').cpus().length;

// morgan - https://github.com/expressjs/morgan
const morgan=require("morgan");

// file upload for express - https://github.com/richardgirges/express-fileupload
const fileupload=require("express-fileupload");

// favourite icon - https://www.npmjs.com/package/serve-favicon
const favicon=require("serve-favicon");

const fs=require("fs"), path=require("path");

// command line arguments - https://github.com/75lb/command-line-args
const commandLineArgs=require('command-line-args');

// fetch API for node.js - https://www.npmjs.com/package/node-fetch
const fetch=require('node-fetch');

const https=require("https");

// pauls useful tools
const phlib=require('./phlib/phlib.js');

// the service list validation
const ServiceListCheck=require('./sl-check.js');
var slcheck=null;

// the content guide validation
const ContentGuideCheck=require('./cg-check.js');
var cgcheck=null;

// the service list registrt
const SLEPR_data=require('./slepr-data.js');
const SLEPR=require('./slepr.js');
var csr=null;

// error buffer
const ErrorList=require("./ErrorList.js");

const locs=require("./data-locations.js");
const globals=require("./globals.js");
const {isEmpty, readmyfile}=require("./utils.js");

const keyFilename=path.join(".","selfsigned.key"), certFilename=path.join(".","selfsigned.crt");



function PAGE_TOP(label) {
	const TABLE_STYLE="<style>table {border-collapse: collapse;border: 1px solid black;} th, td {text-align: left; padding: 8px; }	tr:nth-child(even) {background-color: #f2f2f2;}	</style>";
	const XML_STYLE="<style>.xmlfont {font-family: Arial, Helvetica, sans-serif; font-size:90%;}</style>";

	const PG=`<html><head>${TABLE_STYLE}${XML_STYLE}<title>${label}</title></head><body>`;
	const PH=`<h1>${label}</h1>`;

	return `${PG}${PH}`;
}
const PAGE_BOTTOM="</body></html>";

function tabulateResults(res, error, errs) {

	const RESULT_WITH_INSTRUCTION="<br><p><i>Results:</i></p>";
	const SUMMARY_FORM_HEADER="<table><tr><th>item</th><th>count</th></tr>";
	
	DETAIL_FORM_HEADER = (mode) => `<table><tr><th>code</th><th>${mode}</th></tr>`;

	function tabluateMessage(value) {
		res.write(`<tr><td>${value.code?phlib.HTMLize(value.code):""}</td>`);
		res.write(`<td>${value.message?phlib.HTMLize(value.message):""}${value.element?`<br/><span class=\"xmlfont\">${phlib.HTMLize(value.element)}</span>`:""}</td></tr>`);
	}	

    res.write(RESULT_WITH_INSTRUCTION);
	if (error) 
		res.write(`<p>${error}</p>`);
	let resultsShown=false;
	if (errs) {

		if (errs.numCountsErr()>0 || errs.numCountsWarn()>0 ) {		
			res.write(SUMMARY_FORM_HEADER);
			Object.keys(errs.countsErr).forEach( function (i) {return res.write(`<tr><td>${phlib.HTMLize(i)}</td><td>${errs.countsErr[i]}</td></tr>`); });
			Object.keys(errs.countsWarn).forEach( function (i) {return res.write(`<tr><td><i>${phlib.HTMLize(i)}</i></td><td>${errs.countsWarn[i]}</td></tr>`); });
			resultsShown=true;
			res.write("</table><br/>");
		}

		if (errs.numErrors() > 0) {
			res.write(DETAIL_FORM_HEADER("errors"));
			errs.errors.forEach(tabluateMessage);
			resultsShown=true;
			res.write("</table><br/>");
		} 

		if (errs.numWarnings()>0) {
			res.write(DETAIL_FORM_HEADER("warnings"));
			errs.warnings.forEach(tabluateMessage);
			resultsShown=true;
			res.write("</table><br/>");
		}     
	}
	if (!error && !resultsShown) 
		res.write("no errors or warnings");
}

/**
 * constructs HTML output of the errors found in the service list analysis
 *
 * @param {boolean} URLmode    If true ask for a URL to a service list, if false ask for a file
 * @param {Object}  res        The Express result 
 * @param {string}  lastInput  The url of the service list - used to keep the form intact
 * @param {string}  error      a single error message to display on the form, genrrally related to loading the content to validate
 * @param {Object}  errors     the errors and warnings found during the content guide validation
 * @returns {Promise} the output stream (res) for further async processing
 */
function drawSLForm(URLmode, res, lastInput=null, error=null, errs=null) {
	
	const ENTRY_FORM_URL=`<form method=\"post\"><p><i>URL:</i></p><input type=\"url\" name=\"SLurl\" value=\"${lastInput?lastInput:""}\"><input type=\"submit\" value=\"submit\"></form>`;
	const ENTRY_FORM_FILE=`<form method=\"post\" encType=\"multipart/form-data\"><p><i>FILE:</i></p><input type=\"file\" name=\"SLfile\" value=\"${lastInput?lastInput:""}\"><input type=\"submit\" value=\"submit\"></form>`;

    res.write(PAGE_TOP('DVB-I Service List Validator'));    

	res.write(URLmode?ENTRY_FORM_URL:ENTRY_FORM_FILE);

	tabulateResults(res, error, errs);

	res.write(PAGE_BOTTOM);
	
	return new Promise((resolve, reject) => {
		resolve(res);
	});
}


/**
 * Process the service list specificed for errors and display them
 *
 * @param {Object} req  The request from Express
 * @param {Object} res  The HTTP response to be sent to the client
 */ 
function processSLQuery(req, res) {

	function handleErrors(response) {
		if (!response.ok) {
			throw Error(response.statusText);
		}
		return response;
	}

    if (isEmpty(req.query)) {
		drawSLForm(true, res);
		res.end();
	}
	else if (req && req.query && req.query.SLurl) {
		fetch(req.query.SLurl)
			.then(handleErrors)
			.then(response => response.text())
			.then(res=>slcheck.validateServiceList(res.replace(/(\r\n|\n|\r|\t)/gm,"")))
			.then(errs=>drawSLForm(true, res, req.query.SLurl, null, errs))
			.then(res=>res.end())
			.catch(error => {
				console.log(error);
				console.log(`error (${error}) handling ${req.query.SLurl}`) ;
				drawSLForm(true, res, req.query.SLurl, `error (${error}) handling ${req.query.SLurl}`, null);
				res.end();
			});
   }
   else {
        drawSLForm(true, res, req.query.SLurl, "URL not specified");
		res.status(400);
		res.end();
    }
}


/**
 * Process the service list specificed by a file name for errors and display them
 *
 * @param {Object} req  The request from Express
 * @param {Object} res  The HTTP response to be sent to the client
 */ 
function processSLFile(req, res) {
    if (isEmpty(req.query)) 
        drawSLForm(false, res);    
	else if (req && req.files && req.files.SLfile) {
        let SLxml=null;
        let errs=new ErrorList();
        try {
            SLxml=req.files.SLfile.data;
        }
        catch (err) {
			// this should not happen as file is read and uploaded through the browser
            errs.pushCode("PR101", `reading of FILE (${req.files.SLfile.name}) failed`);
        }
		if (SLxml)
			slcheck.doValidateServiceList(SLxml.toString().replace(/(\r\n|\n|\r|\t)/gm,""), errs);

        drawSLForm(false, res, req.files.SLfile.name, null, errs);
    }
	else {
        drawSLForm(false, res, req.files.SLfile.name, "File not specified");
        res.status(400);
    }
    
    res.end();
}


/**
 * constructs HTML output of the errors found in the content guide analysis
 *
 * @param {boolean} URLmode   if true ask for a URL to a content guide, if false ask for a file
 * @param {Object}  res       the Express result 
 * @param {string}  lastInput the url or file name previously used - used to keep the form intact
 * @param {string}  lastType  the previously request type - used to keep the form intact
 * @param {string}  error     a single error message to display on the form, generally related to loading the content to validate
 * @param {ErrorList}  errors    the errors and warnings found during the content guide validation
 */
 function drawCGForm(URLmode, res, lastInput=null, lastType=null, error=null, errs=null) {
	const ENTRY_FORM_URL=`<form method=\"post\"><p><i>URL:</i></p><input type=\"url\" name=\"CGurl\" value=\"${lastInput?lastInput:""}\"/><input type=\"submit\" value=\"submit\"/>`;
	const ENTRY_FORM_FILE=`<form method=\"post\" encType=\"multipart/form-data\"><p><i>FILE:</i></p><input type=\"file\" name=\"CGfile\" value=\"${lastInput ? lastInput : ""}\"/><input type=\"submit\" value=\"submit\"/>`;
	const ENTRY_FORM_END="</form>";

	const ENTRY_FORM_REQUEST_TYPE_HEADER="<p><i>REQUEST TYPE:</i></p>";

	const ENTRY_FORM_REQUEST_TYPE_ID="requestType";

    res.write(PAGE_TOP('DVB-I Content Guide Validator'));
    res.write(URLmode?ENTRY_FORM_URL:ENTRY_FORM_FILE);

	res.write(ENTRY_FORM_REQUEST_TYPE_HEADER);

	if (!lastType) 
		lastType=cgcheck.supportedRequests[0].value;
	cgcheck.supportedRequests.forEach(function (choice) {
		res.write(`<input type=\"radio\" name=${ENTRY_FORM_REQUEST_TYPE_ID.quote()} value=${choice.value.quote()}`);
		if (lastType==choice.value)
			res.write(" checked");
		res.write(`>${choice.label}</input>`);
	});
	res.write(ENTRY_FORM_END);

	tabulateResults(res, error, errs);

	res.write(PAGE_BOTTOM);

	return new Promise(function (resolve, reject) {
		resolve(res);
	});
}


/**
 * Process the content guide specificed for errors and display them
 *
 * @param {Object} req The request from Express
 * @param {Object} res The HTTP response to be sent to the client
 */ 
 function processCGQuery(req, res) {

	function handleErrors(response) {
		if (!response.ok) {
			throw Error(response.statusText);
		}
		return response;
	}

    if (isEmpty(req.query)) {
		drawCGForm(true, res);
		res.end();
	}  
    else if (req && req.query && req.query.CGurl) {
		fetch(req.query.CGurl)
			.then(handleErrors)
			.then(function (response) {return response.text();})
			.then(function (res) {return cgcheck.validateContentGuide(res.replace(/(\r\n|\n|\r|\t)/gm, ""), req.body.requestType);})
			.then(function (errs) {return drawCGForm(true, res, req.query.CGurl, req.body.requestType, null, errs);})
			.then(function (res) {res.end();})
			.catch(function (error) {
				console.log(error);
				drawCGForm(true, res, req.query.CGurl, req.body.requestType, `error (${error}) handling ${req.query.CGurl}`);
				res.status(400);
				res.end();
			});
    }
	else {
        drawCGForm(true, res, req.query.CGurl, req.body.requestType, "URL not specified");
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
function processCGFile(req, res) {
    if (isEmpty(req.query)) 
        drawCGForm(false, res);    
    else if (req && req.files && req.files.CGfile) {
        let CGxml=null, errs=new ErrorList(), fname="***";
		if (req && req.files && req.files.CGfile) fname=req.files.CGfile.name;
        try {
            CGxml=req.files.CGfile.data;
        }
        catch (err) {
            errs.pushCode("PF001", `retrieval of FILE ${fname} failed`);
        }
		if (CGxml) 
			cgcheck.doValidateContentGuide(CGxml.toString().replace(/(\r\n|\n|\r|\t)/gm, ""), req.body.requestType, errs);
		
        drawCGForm(false, res, fname, req.body.requestType, null, errs);
    }
	else {
        drawCGForm(false, res, (req.files && req.files.CGfile)?req.files.CGfile.name:null, req.body.requestType, "File not specified");
        res.status(400);
	}
    res.end();
}



// initialize Express
let app=express();

app.use(express.static(__dirname));
app.set('view engine', 'ejs');
app.use(fileupload());
app.use(favicon(path.join('phlib','ph-icon.ico')));


morgan.token("protocol", function getProtocol(req) {
    return req.protocol;
});
morgan.token("agent", function getAgent(req) {
    return `(${req.headers["user-agent"]})`;
});
morgan.token("parseErr", function getParseErr(req) {
    if (req.parseErr && req.parseErr.length>0) return `(query errors=${req.parseErr.length})`;
    return "";
});
morgan.token("location", function getCheckedLocation(req) {
	if (req.files && req.files.SLfile) return `[${req.files.SLfile.name}]`;
    if (req.query && req.query.SLurl) return `[${req.query.SLurl}]`;
	if (req.files && req.files.CGfile) return `[${req.files.CGfile.name}]`;
    if (req.query && req.query.CGurl) return `[${req.query.CGurl}]`;
	return "[*]";
});

app.use(morgan(":remote-addr :protocol :method :url :status :res[content-length] - :response-time ms :agent :parseErr :location"));

app.use(express.urlencoded({ extended: true }));


// parse command line options
const optionDefinitions=[
	{name:'urls', alias:'u', type:Boolean, defaultValue:false},
	{name:'port', alias:'p', type:Number, defaultValue:globals.HTTPPort.all_in_one },
	{name:'sport', alias:'s', type:Number, defaultValue:globals.HTTPPort.all_in_one+1 },
	{name:'nocsr', type:Boolean, defaultValue:false},
	{name:'nosl', type:Boolean, defaultValue:false},
	{name:'nocg', type:Boolean, defaultValue:false},
	{name:'CSRfile', alias:'f', type:String, defaultValue:SLEPR_data.MASTER_SLEPR_FILE}
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

const ISOcountries=require("./ISOcountries.js");
let isoCountries=new ISOcountries(false, true);
isoCountries.loadCountries(options.urls?{url:locs.ISO3166.url}:{file:locs.ISO3166.file});


if (!options.nosl) {
	slcheck=new ServiceListCheck(options.urls, knownLanguages, knownGenres, isoCountries);

	// handle HTTP POST requests to /checkSL
	app.post("/checkSL", function(req, res) {
		req.query.SLurl=req.body.SLurl;
		processSLQuery(req, res);
	});

	// handle HTTP GET requests to /checkSL
	app.get("/checkSL", function(req,res){
		processSLQuery(req, res);
	});

	// handle HTTP POST requests to /checkSLFile
	app.post("/checkSLFile", function(req,res) {
		req.query.SLfile=req.body.SLfile;
		processSLFile(req, res);
	});

	// handle HTTP GET requests to /checkSLFile
	app.get("/checkSLFile", function(req,res){
		processSLFile(req, res);
	});

	app.get('/SLstats', function(req,res){
		res.write("<html><head><title>Service List Verifier (stats)</title></head>");
		res.write("<body>");
		slcheck.getStats().forEach(e => {
			res.write(`${e}<BR/>`);
		});
		res.write("</body></html>");
		res.end();
	});
}


if (!options.nocg) {
	cgcheck=new ContentGuideCheck(options.urls, knownLanguages, knownGenres);

	// handle HTTP POST requests to /checkCG
	app.post("/checkCG", function(req, res) {
		req.query.CGurl=req.body.CGurl;
		processCGQuery(req, res);
	});

	// handle HTTP GET requests to /checkCG
	app.get("/checkCG", function(req, res) {
		processCGQuery(req, res);
	});

	// handle HTTP POST requests to /checkCGFile
	app.post("/checkCGFile", function(req, res) {
		req.query.CGfile=req.body.CGfile;
		processCGFile(req, res);
	});

	// handle HTTP GET requests to /checkCGFile
	app.get("/checkCGFile", function(req, res) {
		processCGFile(req, res);
	});
}


if (!options.nocsr) {
	csr=new SLEPR(options.urls, knownLanguages, isoCountries, knownGenres);
	csr.loadServiceListRegistry(options.CSRfile);

	app.get('/query', function(req, res) {
		csr.processServiceListRequest(req, res);
	});

	app.get('/reload', function(req, res) {
		csr.loadServiceListRegistry(options.CSRfile);
		res.status(200).end();
	});
	
	app.get('/stats', function(req, res) {
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
	
	var https_server=https.createServer(https_options, app);
	https_server.listen(options.sport, function(){
		console.log(`HTTPS listening on port number ${https_server.address().port}`);
	});
}
