/**
 * http_servers.mts
 *
 *
 */
import { Server as NetServer } from "node:net";
import type { AddressInfo } from "node:net";
import chalk from "chalk";
import { createServer, Server as httpsServer } from "https";
import { Server as httpServer} from "http";
import { join } from "path";

import { datatypeIs } from "../phlib/phlib.ts";

import { readmyfileB } from "./utils.mts";

/*	var https_server : httpsServer | undefined = undefined, 
		http_server : httpServer;
*/

const keyFilename = join(".", "selfsigned.key"),
	certFilename = join(".", "selfsigned.crt");

let showError = (error: any, port : number, secure : boolean) => {
	if (error?.code == 'EADDRINUSE')
		console.log(chalk.red(`HTTP${secure ? "S" : ""} port ${port} already in use -- HTTP${secure ? "S" : ""} server not started`));
	else console.dir(error);
	}

let listening = ( server : NetServer, isSecure : boolean) => {
	let _port : string= 'unknown'
	const addr = server.address();
	if (addr) {
		if (datatypeIs(addr, "string"))
			_port = addr as string;
		else _port = `${(addr as AddressInfo).port}`
	}
	return `HTTP${isSecure ? "S" : ""} listening on port number ${_port}`;
}

export function StartServers(servers: any, app : any, options : any) : boolean {
	// start the HTTP server
		servers.http = createServer({}, app);
		servers.http.on('listening', () => {
			console.log(chalk.cyan(listening(servers.http, false)));
		});
		servers.http.on('error', function(error : any) {
			// TODO: this is not being invoked even when the port is in use
			showError(error, options.port, true);
		});
		servers.http.listen(options.port);

	// start the HTTPS server: SecureContextOptions
	// sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt
	const https_options : any = {
		key: readmyfileB(keyFilename),
		cert: readmyfileB(certFilename),
	};

	if (https_options?.key && https_options?.cert) {
		if (options.sport == options.port) options.sport = options.port + 1;

		servers.https = createServer(https_options, app)
		.on('listening', () => {
			console.log(chalk.cyan(listening(servers.https as httpsServer, true)));
		})
		.on('error', (error) => {
			showError(error, options.sport, true);
		});
		servers.https.listen(options.sport);
/*
		https_server.listen(options.sport, (error) => {
			if (error) {
				throw error;
			}
			console.log(chalk.cyan(`HTTPS listening on port number ${https_server.address().port}`));
		}); */
	}

	return (servers.http.listening || (servers.https != undefined && servers.https.listening));
}



export function StartServers_test(app : any, options : any) 
{
	var http_server = app.listen(options.port, function () {
		if (http_server.address()?.port) console.log(chalk.cyan(`HTTP listening on port number ${http_server.address().port}`));
		else console.log(chalk.red(`HTTP port ${options.port} already in use -- HTTP server not started`));
	});

	// start the HTTPS server
	// sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt
	var https_options = {
		key: readmyfileB(keyFilename),
		cert: readmyfileB(certFilename),
	};

	if (https_options.key && https_options.cert) {
		if (options.sport == options.port) options.sport = options.port + 1;

		var https_server = createServer(https_options, app);
		https_server.listen(options.sport, function () {
			console.log(chalk.cyan(`HTTPS listening on port number ${options.sport}`));
		});
	}
}
