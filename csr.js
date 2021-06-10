/*jshint esversion: 8 */

// node.js - https://nodejs.org/en/
// express framework - https://expressjs.com/en/4x/api.html
const express=require('express');

const cluster = require('cluster');
const totalCPUs = require('os').cpus().length;


// morgan - https://www.npmjs.com/package/morgan
const morgan=require('morgan');

// favourite icon - https://www.npmjs.com/package/serve-favicon
const favicon=require('serve-favicon');

const fs=require('fs'), path=require('path');

// command line arguments - https://www.npmjs.com/package/command-line-args
const commandLineArgs=require('command-line-args');

// Fetch() API for node.js- https://www.npmjs.com/package/node-fetch
const fetch=require('node-fetch');

const https=require('https');
const keyFilename=path.join('.','selfsigned.key'), certFilename=path.join('.','selfsigned.crt');

const locs=require('./data-locations.js');



// SLEPR == Service List Entry Point Registry
const slepr_data=require('./slepr-data.js');
const SLEPR=require('./slepr.js');

// command line options
const DEFAULT_HTTP_SERVICE_PORT=3000;
const optionDefinitions=[
  { name: 'urls', alias: 'u', type: Boolean, defaultValue: false},
  { name: 'port', alias: 'p', type: Number, defaultValue:DEFAULT_HTTP_SERVICE_PORT },
  { name: 'sport', alias: 's', type: Number, defaultValue:DEFAULT_HTTP_SERVICE_PORT+1 },
  { name: 'file', alias: 'f', type: String, defaultValue:slepr_data.MASTER_SLEPR_FILE}
];


function readmyfile(filename) {
	try {
		let stats=fs.statSync(filename);
		if (stats.isFile()) return fs.readFileSync(filename); 
	}
	catch (err) {console.log(err.code,err.path);}
	return null;
}

const options=commandLineArgs(optionDefinitions);


const IANAlanguages=require('./IANAlanguages.js');
var knownLanguages=new IANAlanguages();
knownLanguages.loadLanguages(options.urls?
	{url:locs.IANA_Subtag_Registry.url}:
	{file:locs.IANA_Subtag_Registry.file}
);

const ISOcountries=require("./ISOcountries.js");
var knownCountries=new ISOcountries(false, true);
knownCountries.loadCountries(options.urls?
	{url:locs.ISO3166.url, purge:true}:
	{file:locs.ISO3166.file, purge:true});

const ClassificationScheme=require("./ClassificationScheme.js");
let knownGenres=new ClassificationScheme();
knownGenres.loadCS(options.urls?
	{urls:[locs.TVA_ContentCS.url, locs.TVA_FormatCS.url, locs.DVBI_ContentSubject.url], leafNodesOnly:false}:
	{files:[locs.TVA_ContentCS.file, locs.TVA_FormatCS.file, locs.DVBI_ContentSubject.file], leafNodesOnly:false});

const RELOAD='RELOAD', UPDATE='UPDATE',
	  INCR_REQUESTS='REQUESTS++', INCR_FAILURES='FAILURES++',
	  STATS='STATS';

if (cluster.isMaster) {

	var metrics={
		numRequests:0,
		numFailed:0,
		reloadRequests:0
	};
	
	console.log(`Number of CPUs is ${totalCPUs}`);
	console.log(`Master ${process.pid} is running`);

	// Fork workers.
	for (let i=0; i<totalCPUs; i++) {
	  cluster.fork();
	}
  
	cluster.on('exit', (worker, code, signal) => {
	  console.log(`worker ${worker.process.pid} died`);
	  console.log("Let's fork another worker!");
	  cluster.fork();
	});

	cluster.on('message', (worker, msg, handle) => {
		if (msg.topic)
			switch (msg.topic) {
				case RELOAD: 
					metrics.reloadRequests++;
					for (const id in cluster.workers) {
						// Here we notify each worker of the updated value
						cluster.workers[id].send({topic: UPDATE});
					}
					break;
				case INCR_REQUESTS:
					metrics.numRequests++;
					break;
				case INCR_FAILURES:
					metrics.numFailed++;
					break;
				case STATS:
					console.log(`knownLanguages.length=${knownLanguages.languagesList.length}`);
					console.log(`knownCountries.length=${knownCountries.count()}`);
					console.log(`requests=${metrics.numRequests} failed=${metrics.numFailed} reloads=${metrics.reloadRequests}`);
					console.log(`SLEPR file=${options.file}`);
					break;
			}
	});
  } else {
	var app=express();

	morgan.token('pid', function getPID(req) {
		return process.pid;
	});
	morgan.token('protocol', function getProtocol(req) {
		return req.protocol;
	});
	morgan.token('parseErr',function getParseErr(req) {
		if (req.parseErr.length>0) return `(query errors=${req.parseErr.length})`;
		return "";
	});
	morgan.token('agent',function getAgent(req) {
		return `(${req.headers['user-agent']})`;
	});
	

	var csr = new SLEPR(options.urls);
	csr.loadServiceListRegistry(options.file, knownLanguages, knownCountries, knownGenres);

	app.use(morgan(':pid :remote-addr :protocol :method :url :status :res[content-length] - :response-time ms :agent :parseErr'));
	app.use(favicon(path.join('phlib','ph-icon.ico')));
	app.get('/query', function(req,res) {
		process.send({ topic: INCR_REQUESTS });

		if (!csr.processServiceListRequest(req, res))
			process.send({ topic: INCR_FAILURES });
	});

	app.get('/reload', function(req,res) {
		process.send({ topic: RELOAD });
		res.status(404).end();
	});
	
	
	app.get('/stats', function(req,res) {
		process.send({ topic: STATS });
		res.status(404).end();
	});
	
	app.get('*', function(req,res) {
		res.status(404).end();
	});
	

	process.on('message', (msg) => {
		if (msg.topic)
			switch (msg.topic) {
				case UPDATE:
					knownCountries.loadCountries(options.urls?
						{url:locs.ISO3166.url, purge:true}:
						{file:locs.ISO3166.file, purge:true});
					knownLanguages.loadLanguages(options.urls?
							{url:locs.IANA_Subtag_Registry.url}:
							{file:locs.IANA_Subtag_Registry.file}
						);
					knownGenres.loadCS(options.urls?
						{urls:[locs.TVA_ContentCS.url, locs.TVA_FormatCS.url, locs.DVBI_ContentSubject.url], leafNodesOnly:false}:
						{files:[locs.TVA_ContentCS.file, locs.TVA_FormatCS.file, locs.DVBI_ContentSubject.file], leafNodesOnly:false});		
					csr.loadDataFiles(options.urls, knownLanguages, knownCountries, knownGenres);
					csr.loadServiceListRegistry(options.file);
					break;
			}
	});

	// start the HTTP server
	var http_server=app.listen(options.port, function() {
		console.log(`HTTP listening on port number ${http_server.address().port}, PID=${process.pid}`);
	});

	// start the HTTPS server
	// sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt

	var https_options = {
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
 }