// express framework - https://expressjs.com/en/4x/api.html
import express from 'express';

// morgan - https://www.npmjs.com/package/morgan
import morgan, { token } from 'morgan';

// favourite icon - https://www.npmjs.com/package/serve-favicon
import favicon from 'serve-favicon';

import { join } from 'path';
const keyFilename=join('.','selfsigned.key'), certFilename=join('.','selfsigned.crt');

import { createServer } from 'https';

// command line arguments - https://www.npmjs.com/package/command-line-args
import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';

import cluster from 'cluster';
import { cpus } from 'os';
import cors from 'cors';
import process from "process";

import { Default_SLEPR, IANA_Subtag_Registry, ISO3166, TVA_ContentCS, TVA_FormatCS, DVBI_ContentSubject } from './data-locations.js';

import { CORSlibrary, CORSmanual, CORSnone, CORSoptions, HTTPPort } from './globals.js';
import { readmyfile } from './utils.js';

const numCPUs = cpus().length;

// SLEPR == Service List Entry Point Registry
import SLEPR from './slepr.js';

// command line options
const optionDefinitions=[
	{ name:'urls', alias:'u', 
		type:Boolean, defaultValue:false, 
		description:'Load data files from network locations.'},
	{ name:'port', alias:'p', 
		type:Number, defaultValue:HTTPPort.csr, 
		typeLabel:'{underline ip-port}',
		 description:`The HTTP port to listen on. Default: ${HTTPPort.csr}`},
	{ name:'sport', alias:'s', 
		type:Number, defaultValue:HTTPPort.csr+1, 
		typeLabel:'{underline ip-port}', 
		description:`The HTTPS port to listen on. Default: ${HTTPPort.csr+1}` },
	{ name:'file', alias:'f', 
		type:String, defaultValue:Default_SLEPR.file, 
		typeLabel:'{underline filename}', 
		description:'local file name of master SLEPR file'},
	{ name:'CORSmode', alias:'c',
		type:String, defaultValue:"library",
		typeLabel:'{underline mode}',
		description:`type of CORS habdling "${CORSlibrary}" (default), "${CORSmanual}" or "${CORSnone}"`},
	{ name:'help', alias:'h', 
		type:Boolean, defaultValue:false, 
		description:'This help'}
];

const commandLineHelp=[
	{
		header: 'DVB Central Service Registry',
		content: 'An implementaion of a DVB-I Service List Registry'
	},
	{
		header: 'Synopsis',
		content: '$ node csr <options>'
	},
	{
		header: 'Options',
		optionList: optionDefinitions
	},
	{
		header: 'Client Query',
		content: '{underline <host>}:{underline <port>}/query[?{underline arg}={underline value}(&{underline arg}={underline value})*]',
	},
	{
		content: [
			{header:'{underline arg}'},
			{name:'regulatorListFlag', summary:'Select only service lists that have the @regulatorListFlag set as specified (true|false)'},
			{name:'Delivery[]', summary:'Select only service lists that use the specified delivery system (dvb-t|dvb-dash|dvb-c|dvb-s|dvb-iptv)'},
			{name:'TargetCountry[]', summary:'Select only service lists that apply to the specified countries (form: {underline ISO3166 3-digit code})' },		
			{name:'Language[]', summary:'Select only service lists that use the specified language (form: {underline IANA 2 digit language code})'},		
			{name:'Genre[]', summary:'Select only service lists that match one of the given Genres'},		
			{name:'Provider[]', summary:'Select only service lists that match one of the specified Provider names'}
		]
	},
	{	content:'note that all query values except Provider are checked against constraints. An HTTP 400 response is returned with errors in the response body.'},
	{
		header: 'About',
		content: 'Project home: {underline https://github.com/paulhiggs/dvb-i-tools/}'
	}
];


try {
	var options=commandLineArgs(optionDefinitions);
}
catch (err) {
	console.log(commandLineUsage(commandLineHelp));
	process.exit(1);
}

if (!CORSoptions.includes(options.CORSmode)) {
	console.log(`CORSmode must be "${CORSnone}", "${CORSlibrary}" to use the Express cors() handler, or "${CORSmanual}" to have headers inserted manually`);
	process.exit(1); 
}

if (options.help) {
	console.log(commandLineUsage(commandLineHelp));
	process.exit(0);
}

if (options.urls && (options.file==Default_SLEPR.file))
	options.file=Default_SLEPR.url;

import IANAlanguages from './IANAlanguages.js';
var knownLanguages=new IANAlanguages();
knownLanguages.loadLanguages(options.urls?{url:IANA_Subtag_Registry.url}:{file:IANA_Subtag_Registry.file});

import ISOcountries from "./ISOcountries.js";
var knownCountries=new ISOcountries(false, true);
knownCountries.loadCountries(options.urls?{url:ISO3166.url}:{file:ISO3166.file});

import ClassificationScheme from "./ClassificationScheme.js";
let knownGenres=new ClassificationScheme();
knownGenres.loadCS(options.urls?
	{urls:[TVA_ContentCS.url, TVA_FormatCS.url, DVBI_ContentSubject.url]}:
	{files:[TVA_ContentCS.file, TVA_FormatCS.file, DVBI_ContentSubject.file]});

const RELOAD='RELOAD', UPDATE='UPDATE',
	  INCR_REQUESTS='REQUESTS++', INCR_FAILURES='FAILURES++',
	  STATS='STATS';

if (cluster.isPrimary) {
	console.log(`Number of CPUs is ${numCPUs}`);
	console.log(`Primary ${process.pid} is running`);


	var metrics={
		numRequests:0,
		numFailed:0,
		reloadRequests:0
	};

	// Fork workers.
	for (let i = 0; i < numCPUs; i++) {
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
}
else {
	var app=express();
	app.use(cors());
	token('pid', function getPID(req) {
		return process.pid;
	});
	token('protocol', function getProtocol(req) {
		return req.protocol;
	});
	token('parseErr',function getParseErr(req) {
		if (req.parseErr?.length>0) return `(query errors=${req.parseErr.length})`;
		return "";
	});
	token('agent',function getAgent(req) {
		return `(${req.headers['user-agent']})`;
	});
	
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
	var csr=new SLEPR(options.urls);
	csr.loadServiceListRegistry(options.file, knownLanguages, knownCountries, knownGenres);
	app.use(morgan(':pid :remote-addr :protocol :method :url :status :res[content-length] - :response-time ms :agent :parseErr'));
	app.use(favicon(join('phlib','ph-icon.ico')));
	if (options.CORSmode==CORSlibrary)
		app.options(SLEPR_query_route, cors());
	else if (options.CORSmode==CORSmanual)
		app.options(SLEPR_query_route, manualCORS); 
	app.get(SLEPR_query_route, function(req,res) {
		process.send({ topic: INCR_REQUESTS });
		if (!csr.processServiceListRequest(req, res))
			process.send({ topic: INCR_FAILURES });
		res.end();
	});
	app.get(SLEPR_reload_route, function(req,res) {
		process.send({ topic: RELOAD });
		res.status(404).end();
	});
	app.get(SLEPR_stats_route, function(req,res) {
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
					knownCountries.loadCountries(options.urls?{url:ISO3166.url}:{file:ISO3166.filee});
					knownLanguages.loadLanguages(options.urls?{url:IANA_Subtag_Registry.url}:{file:IANA_Subtag_Registry.file});
					knownGenres.loadCS(options.urls?
						{urls:[TVA_ContentCS.url, TVA_FormatCS.url, DVBI_ContentSubject.url]}:
						{files:[TVA_ContentCS.file, TVA_FormatCS.file, DVBI_ContentSubject.file]});		
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
			
		var https_server=createServer(https_options, app);
		https_server.listen(options.sport, function() {
			console.log(`HTTPS listening on port number ${https_server.address().port}, PID=${process.pid}`);
		});
	}
}
