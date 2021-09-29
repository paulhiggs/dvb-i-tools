
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
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fetcherr=require("./fetch-err-handler.js");

const ui=require('/ui.js');

const locs=require('./data-locations.js');

// error buffer
const ErrorList=require("./ErrorList.js");

const {isEmpty, readmyfile}=require('./utils.js');

// the service list validation
const ServiceListCheck=require('./sl-check.js');
var slcheck;

const https=require("https");
const keyFilename=path.join(".","selfsigned.key"), certFilename=path.join(".","selfsigned.crt");



/**
 * Process the service list specificed for errors and display them
 *
 * @param {Object} req  The request from Express
 * @param {Object} res  The HTTP response to be sent to the client
 */ 
function processQuery(req, res) {
    if (isEmpty(req.query)) {
		ui.drawSLForm(true, res);
		res.end();
	}
	else if (req && req.query && req.query.SLurl) {
		fetch(req.query.SLurl)
			.then(fetcherr.handleErrors)
			.then(response => response.text())
			.then(res=>slcheck.validateServiceList(res))
			.then(errs=>ui.drawSLForm(true, res, req.query.SLurl, null, errs))
			.then(res=>res.end())
			.catch(error => {
				console.log(error);
				console.log(`error (${error}) handling ${req.query.SLurl}`) ;
				ui.drawSLForm(true, res, req.query.SLurl, `error (${error}) handling ${req.query.SLurl}`, null);
				res.end();
			});
   }
   else {
		ui.drawSLForm(true, res, req.query.SLurl, "URL not specified");
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
		ui.drawSLForm(false, res);    
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
			slcheck.doValidateServiceList(SLxml.toString(), errs);

		ui.drawSLForm(false, res, req.files.SLfile.name, null, errs);
    }
	else {
        ui.drawSLForm(false, res, req.files.SLfile.name, "File not specified");
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
	{name:'urls', alias:'u', type:Boolean, defaultValue:false},
	{name:'port', alias:'p', type:Number, defaultValue:globals.HTTPPort.sl },
	{name:'sport', alias:'s', type:Number, defaultValue:globals.HTTPPort.sl+1 }
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

slcheck=new ServiceListCheck(options.urls, knownLanguages, knownGenres, isoCountries);

// initialize Express
app.use(express.urlencoded({ extended: true }));

// handle HTTP POST requests to /check
app.post("/check", function(req,res) {
    req.query.SLurl=req.body.SLurl;
    processQuery(req,res);
});

// handle HTTP GET requests to /check
app.get("/check", function(req,res) {
    processQuery(req,res);
});

// handle HTTP POST requests to /checkFile
app.post("/checkFile", function(req,res) {
    req.query.SLfile=req.body.SLfile;
    processFile(req,res);
});

// handle HTTP GET requests to /checkFile
app.get("/checkFile", function(req,res) {
    processFile(req,res);
});

app.get('/stats', function(req,res) {
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

