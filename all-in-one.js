/* jshint esversion: 8 */
// node.js - https://nodejs.org/en/
// express framework - https://expressjs.com/en/4x/api.html
const express=require("express");

const cors=require("cors");

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
const SLEPR=require('./slepr.js');
var csr=null;

// error buffer
const ErrorList=require("./ErrorList.js");

const ui=require("./ui.js");

const locs=require("./data-locations.js");
const globals=require("./globals.js");
const {isEmpty, readmyfile}=require("./utils.js");

const keyFilename=path.join(".","selfsigned.key"), certFilename=path.join(".","selfsigned.crt");







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
		ui.drawSLForm(true, res);
		res.end();
	}
	else if (req && req.query && req.query.SLurl) {
		fetch(req.query.SLurl)
			.then(handleErrors)
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
function processSLFile(req, res) {
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
		ui.drawCGForm(true, cgcheck.supportedRequests, res);
		res.end();
	}  
    else if (req && req.query && req.query.CGurl) {
		fetch(req.query.CGurl)
			.then(handleErrors)
			.then(function (response) {return response.text();})
			.then(function (res) {return cgcheck.validateContentGuide(res, req.body.requestType);})
			.then(function (errs) {return ui.drawCGForm(true, cgcheck.supportedRequests, res, req.query.CGurl, req.body.requestType, null, errs);})
			.then(function (res) {res.end();})
			.catch(function (error) {
				console.log(error);
				ui.drawCGForm(true, cgcheck.supportedRequests, res, req.query.CGurl, req.body.requestType, `error (${error}) handling ${req.query.CGurl}`);
				res.status(400);
				res.end();
			});
    }
	else {
        ui.drawCGForm(true, cgcheck.supportedRequests, res, req.query.CGurl, req.body.requestType, "URL not specified");
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
        ui.drawCGForm(false, cgcheck.supportedRequests, res);    
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
			cgcheck.doValidateContentGuide(CGxml.toString(), req.body.requestType, errs);
		
        ui.drawCGForm(false, cgcheck.supportedRequests, res, fname, req.body.requestType, null, errs);
    }
	else {
        ui.drawCGForm(false, cgcheck.supportedRequests, res, (req.files && req.files.CGfile)?req.files.CGfile.name:null, req.body.requestType, "File not specified");
        res.status(400);
	}
    res.end();
}



// initialize Express
let app=express();
app.use(cors());

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
	if (req.files && req.files.CGfile) return `[(${req.body.requestType})${req.files.CGfile.name}]`;
    if (req.query && req.query.CGurl) return `[(${req.body.requestType})${req.query.CGurl}]`;
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
	{name:'CSRfile', alias:'f', type:String, defaultValue:locs.Default_SLEPR.file},
	{name:'CORSmode', alias: 'c', type:String, defaultValue:"library"}
];
 
const options=commandLineArgs(optionDefinitions);

if (!["none", "library", "manual"].includes(options.CORSmode)) {
	console.log('CORSmode must be "none", "library" to use the Express cors() handler, or "manual" to have headers inserted manually');
	process.exit(1); 
}

if (options.urls && (options.CSRfile==locs.Default_SLEPR.file))
	options.CSRfile=locs.Default_SLEPR.url;

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

let hasFunctions=false;

if (!options.nosl) {
	slcheck=new ServiceListCheck(options.urls, knownLanguages, knownGenres, isoCountries);
	hasFunctions=true;

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

const SLEPR_query_route='/query', SLEPR_reload_route='/reload', SLEPR_stats_route='/stats';

let manualCORS=function(res, req, next) {next();};
if (options.CORSmode=="library") {
	app.options("*", cors());
}
else if (options.CORSmode=="manual") {
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
	cgcheck=new ContentGuideCheck(options.urls, knownLanguages, knownGenres);
	hasFunctions=true;

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
	hasFunctions=true;

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

if (!hasFunctions) {
	console.log("nothing to do... exiting");
	process.exit(1);
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
