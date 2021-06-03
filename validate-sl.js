/* jshint esversion: 8 */
// node.js - https://nodejs.org/en/
// express framework - https://expressjs.com/en/4x/api.html
const express=require("express");

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


// pauls useful tools
const phlib=require('./phlib/phlib.js');

const locs=require('./data-locations.js');

// error buffer
const ErrorList=require("./ErrorList.js");

// the service list validation
const ServiceListCheck=require('./sl-check.js');
var slcheck;



const https=require("https");
const DEFAULT_HTTP_SERVICE_PORT=3010;
const keyFilename=path.join(".","selfsigned.key"), certFilename=path.join(".","selfsigned.crt");


/**
 * checks of the object provided is empty, either contains no values or properties
 *
 * @param {Object} obj  The item (array, string, object) to be checked
 * @returns {boolean} true if the object being checked is empty
 */
function isEmpty(obj) {
    for(let key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
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
function drawForm(URLmode, res, lastInput=null, error=null, errs=null) {
	
	const TABLE_STYLE="<style>table {border-collapse: collapse;border: 1px solid black;} th, td {text-align: left; padding: 8px; }	tr:nth-child(even) {background-color: #f2f2f2;}	</style>";
	const XML_STYLE="<style>.xmlfont {font-family: Arial, Helvetica, sans-serif; font-size:90%;}</style>";

	const PAGE_TOP=`<html><head>${TABLE_STYLE}${XML_STYLE}<title>DVB-I Service List Validator</title></head><body>`;
	const PAGE_HEADING="<h1>DVB-I Service List Validator</h1>";
	const PAGE_BOTTOM="</body></html>";

	const ENTRY_FORM_URL=`<form method=\"post\"><p><i>URL:</i></p><input type=\"url\" name=\"SLurl\" value=\"${lastInput?lastInput:""}\"><input type=\"submit\" value=\"submit\"></form>`;
	const ENTRY_FORM_FILE=`<form method=\"post\" encType=\"multipart/form-data\"><p><i>FILE:</i></p><input type=\"file\" name=\"SLfile\" value=\"${lastInput?lastInput:""}\"><input type=\"submit\" value=\"submit\"></form>`;
	const RESULT_WITH_INSTRUCTION="<br><p><i>Results:</i></p>";
	const SUMMARY_FORM_HEADER="<table><tr><th>item</th><th>count</th></tr>";

	DETAIL_FORM_HEADER = (mode) => `<table><tr><th>code</th><th>${mode}</th></tr>`;

	function tabluateMessage(value) {
		res.write(`<tr><td>${value.code?phlib.HTMLize(value.code):""}</td>`);
		res.write(`<td>${value.message?phlib.HTMLize(value.message):""}${value.element?`<br/><span class=\"xmlfont\">${phlib.HTMLize(value.element)}</span>`:""}</td></tr>`);
	}	

    res.write(PAGE_TOP);    
	res.write(PAGE_HEADING);   
	res.write(URLmode?ENTRY_FORM_URL:ENTRY_FORM_FILE);
    res.write(RESULT_WITH_INSTRUCTION);

	if (!URLmode && lastInput)
		res.write(`${lastInput}: `);

	if (error) 
		res.write(`<p>${error}</p>`);
	let resultsShown=false;
	if (errs) {

		if (errs.numCountsErr() > 0 || errs.numCountsWarn() > 0 ) {
			res.write(SUMMARY_FORM_HEADER);

			Object.keys(errs.countsErr).forEach( i => {res.write(`<tr><td>${phlib.HTMLize(i)}</td><td>${errs.countsErr[i]}</td></tr>`); });
			Object.keys(errs.countsWarn).forEach( i => {res.write(`<tr><td><i>${phlib.HTMLize(i)}</i></td><td>${errs.countsWarn[i]}</td></tr>`); });

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
function processQuery(req, res) {

	function handleErrors(response) {
		if (!response.ok) {
			throw Error(response.statusText);
		}
		return response;
	}

    if (isEmpty(req.query)) {
		drawForm(true, res);
		res.end();
	}
	else if (req && req.query && req.query.SLurl) {
		fetch(req.query.SLurl)
			.then(handleErrors)
			.then(response => response.text())
			.then(res=>slcheck.validateServiceList(res.replace(/(\r\n|\n|\r|\t)/gm,"")))
			.then(errs=>drawForm(true, res, req.query.SLurl, null, errs))
			.then(res=>res.end())
			.catch(error => {
				console.log(error);
				console.log(`error (${error}) handling ${req.query.SLurl}`) ;
				drawForm(true, res, req.query.SLurl, `error (${error}) handling ${req.query.SLurl}`, null);
				res.end();
			});
   }
   else {
        drawForm(true, res, req.query.SLurl, "URL not specified");
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
function processFile(req, res) {
    if (isEmpty(req.query)) 
        drawForm(false, res);    
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

        drawForm(false, res, req.files.SLfile.name, null, errs);
    }
	else {
        drawForm(false, res, req.files.SLfile.name, "File not specified");
        res.status(400);
    }
    
    res.end();
}


let app=express();

app.use(express.static(__dirname));
app.set('view engine', 'ejs');
app.use(fileupload());
app.use(favicon(path.join('phlib','ph-icon.ico')));


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
morgan.token("slLoc", function getCheckedLocation(req) {
	if (req.files && req.files.SLfile) return `[${req.files.SLfile.name}]`;
    if (req.query && req.query.SLurl) return `[${req.query.SLurl}]`;
	return "[*]";
});

app.use(morgan(":remote-addr :protocol :method :url :status :res[content-length] - :response-time ms :agent :parseErr :slLoc"));


// parse command line options
const optionDefinitions=[
  {name: 'urls', alias: 'u', type: Boolean, defaultValue: false},
  {name: 'port', alias: 'p', type: Number, defaultValue: DEFAULT_HTTP_SERVICE_PORT },
  {name: 'sport', alias: 's', type: Number, defaultValue: DEFAULT_HTTP_SERVICE_PORT+1 }
];
 
const options=commandLineArgs(optionDefinitions);

const IANAlanguages=require("./IANAlanguages.js");
let knownLanguages=new IANAlanguages();
knownLanguages.loadLanguages(options.urls?
	{url:locs.IANA_Subtag_Registry_URL}:
	{file:locs.IANA_Subtag_Registry_Filename}
);

const ClassificationScheme=require("./ClassificationScheme.js");
let knownGenres=new ClassificationScheme();
knownGenres.loadCSExt(options.urls?
		{urls:[locs.TVA_ContentCSURL, locs.TVA_FormatCSURL, locs.DVBI_ContentSubjectURL], leafNodesOnly:false}:
		{files:[locs.TVA_ContentCSFilename, locs.TVA_FormatCSFilename, locs.DVBI_ContentSubjectFilename], leafNodesOnly:false});

const ISOcountries=require("./ISOcountries.js");
let isoCountries=new ISOcountries(false, true);
isoCountries.loadCountries(options.urls?
	{url:locs.ISO3166_URL, purge:true}:
	{file:locs.ISO3166_Filename, purge:true});

slcheck=new ServiceListCheck(options.urls, knownLanguages, knownGenres, isoCountries);

// initialize Express
app.use(express.urlencoded({ extended: true }));

// handle HTTP POST requests to /check
app.post("/check", function(req,res) {
    req.query.SLurl=req.body.SLurl;
    processQuery(req,res);
});

// handle HTTP GET requests to /check
app.get("/check", function(req,res){
    processQuery(req,res);
});

// handle HTTP POST requests to /checkFile
app.post("/checkFile", function(req,res) {
    req.query.SLfile=req.body.SLfile;
    processFile(req,res);
});

// handle HTTP GET requests to /checkFile
app.get("/checkFile", function(req,res){
    processFile(req,res);
});

app.get('/stats', function(req,res){
	res.write("<html><head><title>Service List Verifier (stats)</title></head>");
	res.write("<body>");
	slcheck.getStats().forEach(e => {
		res.write(`${e}<BR/>`);
	});
	res.write("</body></html>");
	res.end();
});

// dont handle any other requests
app.get("*", function(req,res) {
    res.status(404).end();
});


// start the HTTP server
var http_server=app.listen(options.port, function() {
    console.log(`HTTP listening on port number ${http_server.address().port}`);
});


/**
 * synchronously read a file if it exists
 * 
 * @param {string} filename  The name of the file to read
 * @returns the contents of the file or "null" if the file does not exist
 */
 function readmyfile(filename) {
    try {
        let stats=fs.statSync(filename);
        if (stats.isFile()) return fs.readFileSync(filename); 
    }
    catch (err) {console.log(err.code,err.path);}
    return null;
}

// start the HTTPS server
// sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt
var https_options={
    key: readmyfile(keyFilename),
    cert: readmyfile(certFilename)
};

if (https_options.key && https_options.cert) {
	if (options.sport==options.port)
		options.sport=options.port+1;
	
    var https_server=https.createServer(https_options, app);
    https_server.listen(options.sport, function(){
        console.log(`HTTPS listening on port number ${https_server.address().port}`);
    });
}

