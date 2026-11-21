/**
 * server.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Starts the listeners for the validator's application, and the cluster workers when --workers is given
 */

import { join } from "path"
import { createServer } from "https"
import { createServer as createHttpServer } from "http"
import type { AddressInfo } from "node:net"
import process from "process"
import cluster from "cluster"
import { cpus } from "os"
import chalk from "chalk"
import express from "express"

import { __dirname } from "./data_locations.mts"
import { readmyfile } from "./utils.mts"
import { restartWorkersOnExit } from "./cluster_restart.mts"
import { consoleLogger } from "./request_logging.mts"
import type { ValidatorConfig } from "./config.mts"

const keyFilename: string = join(__dirname, "selfsigned.key"),
	certFilename: string = join(__dirname, "selfsigned.crt");

/**
 * in the primary process of a cluster, fork the workers (each runs the validator), and restart any that exit
 *
 * @param {number} workers  the number of workers asked for, limited to the number of CPUs
 */
export function startWorkers(workers: number): void {
	const numCPUs = cpus().length;
	const count = Math.min(Math.max(workers, 1), numCPUs);
	console.log(chalk.green(`Number of CPUs is ${numCPUs}, ${count} workers`));
	console.log(chalk.green(`Primary ${process.pid} is running`));

	// SCHED_RR is the default on all operating systems except Windows. Windows will change to
	// SCHED_RR once libuv is able to effectively distribute IOCP handles without incurring
	// a large performance hit.
	cluster.schedulingPolicy = cluster.SCHED_RR;

	for (let i = 0; i < count; i++) cluster.fork();
	restartWorkersOnExit();
}

/**
 * listen for the application: on HTTPS (--sport) when selfsigned.key and selfsigned.crt exist, with HTTP (--port)
 * redirecting to HTTPS, or otherwise on HTTP only
 *
 * @param {ValidatorConfig}     config  the configuration
 * @param {express.Application} app     the application (see createApp())
 */
export function startServer(config: ValidatorConfig, app: express.Application): void {
	// start the HTTPS server
	// sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt
	const https_options = {
		key: readmyfile(keyFilename, {}) as Buffer,
		cert: readmyfile(certFilename, {}) as Buffer,
	};
	const port = config.port;
	const sport = config.sport == config.port ? config.port + 1 : config.sport;

	// Only one server uses the HTTP port: the validator itself when HTTPS is not available, otherwise a redirect to HTTPS.
	// The choice is made from the HTTPS server's 'listening' and 'error' events, as listen() is asynchronous.
	const listenFailed = (protocol: string, port: number, consequence: string) => (err: NodeJS.ErrnoException) => {
		const reason = err.code == "EADDRINUSE" ? "already in use" : `${err.code ?? ""} ${err.message}`.trim();
		console.log(chalk.red(`${protocol} port ${port} ${reason} -- ${consequence}`));
	};

	const startHTTP = () => {
		const http_server = createHttpServer(app);
		http_server.on("error", (err: NodeJS.ErrnoException) => {
			listenFailed("HTTP", port, "HTTP server not started")(err);
			// nothing is listening, so stop with a failure status (e.g. for systemd Restart=on-failure, or the cluster primary
			// to restart the worker). An explicit exit is needed as a cluster worker's IPC channel would otherwise keep it running
			process.exit(1);
		});
		http_server.listen(port, () => {
			console.log(chalk.cyan(`HTTP listening on port number ${(http_server.address() as AddressInfo).port}`));
		});
	};

	const startHTTPredirect = () => {
		const redirect_app = express();
		redirect_app.use(consoleLogger());
		redirect_app.use(function (req, res) {
			res.redirect(`https://${req.hostname}:${sport}${req.originalUrl}`);
		});
		const redirect_server = createHttpServer(redirect_app);
		redirect_server.on("error", listenFailed("HTTP", port, "HTTP to HTTPS redirect not started"));
		redirect_server.listen(port, () => {
			console.log(chalk.cyan(`HTTP redirecting to HTTPS on port number ${port}`));
		});
	};

	if (https_options.key && https_options.cert) {
		const https_server = createServer(https_options, app);
		https_server.once("error", (err: NodeJS.ErrnoException) => {
			listenFailed("HTTPS", sport, "HTTPS server not started, using HTTP")(err);
			startHTTP();
		});
		https_server.listen(sport, () => {
			console.log(chalk.cyan(`HTTPS listening on port number ${(https_server.address() as AddressInfo).port}`));
			startHTTPredirect();
		});
	} else startHTTP();
}
