/**
 * http_servers.mts
 *
 *
 */
import chalk from "chalk";
import { createServer } from "https";
import { join } from "path";

import { readmyfileB } from "./utils.mts";


const keyFilename = join(".", "selfsigned.key"),
	certFilename = join(".", "selfsigned.crt");

export function StartServers(app : any, options : any) : boolean {
	// start the HTTP server
	var https_server : any, 
		http_server = app.listen(options.port, (error) => {
		if (error) {
			console.log(chalk.red(`HTTP port ${options.port} already in use -- HTTP server not started`));
		}
		if (http_server.listening)
			console.log(chalk.cyan(`HTTP listening on port number ${options.port}`));
	});

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
			console.log(chalk.cyan(`HTTPS listening on port number ${https_server.address().port}`));
		})
		.on('error', (error) => {
			console.log(chalk.red(`HTTPS port ${options.port} already in use -- HTTPS server not started`));
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

	return (http_server.listening || (https_server && https_server.listening));
}
