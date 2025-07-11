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

export function StartServers(app : any, options : any) : boolean {
	// start the HTTP server
	var https_server : httpsServer | undefined = undefined, 
		http_server : httpServer;
		
		http_server = createServer({}, app);
		http_server.on('listening', () => {
			console.log(chalk.cyan(listening(http_server, false)));
		});
		http_server.on('error', function(error) {
			// TODO: this is not being invoked even when the port is in use
			showError(error, options.port, true);
		});
		http_server.listen(options.port);

	// start the HTTPS server: SecureContextOptions
	// sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt
	const https_options : any = {
		key: readmyfileB(keyFilename),
		cert: readmyfileB(certFilename),
	};

	if (https_options?.key && https_options?.cert) {
		if (options.sport == options.port) options.sport = options.port + 1;

		https_server = createServer(https_options, app)
		.on('listening', () => {
			console.log(chalk.cyan(listening(https_server as httpsServer, true)));
		})
		.on('error', (error) => {
			showError(error, options.sport, true);
		});
		https_server.listen(options.sport);
/*
		https_server.listen(options.sport, (error) => {
			if (error) {
				throw error;
			}
			console.log(chalk.cyan(`HTTPS listening on port number ${https_server.address().port}`));
		}); */
	}

	return (http_server.listening || (https_server != undefined && https_server.listening));
}
