/**
 * server.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Starts the listeners for the validator's application, and the cluster workers when --workers is given
 */

import { createServer } from "https"
import { createServer as createHttpServer } from "http"
import type { Server } from "http"
import type { AddressInfo } from "node:net"
import process from "process"
import cluster from "cluster"
import { cpus } from "os"
import chalk from "chalk"
import express from "express"

import { readmyfile } from "./utils.mts"
import { restartWorkersOnExit } from "./cluster_restart.mts"
import { consoleLogger } from "./request_logging.mts"
import type { ValidatorConfig } from "./config.mts"
import { SHUTDOWN_SIGNALS, shutdownGraceMs } from "./globals.mts"
import { stopAllValidations } from "./safe_fetch.mts"

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
 * shut down gracefully on SIGTERM (e.g. "docker stop", or the cluster primary) or SIGINT:
 * - /healthz reports "stopping", so a load balancer stops sending requests
 * - the servers stop accepting connections, and idle keep-alive connections are closed
 * - the validations in progress are stopped (stopAllValidations()), so their requests finish with the results so far
 * - the process exits when the servers have closed, or after shutdownGraceMs(). A second signal is not caught
 *
 * @param {express.Application} app      the application
 * @param {Server[]}            servers  the servers listening, added to as they are started
 */
function stopOnSignal(app: express.Application, servers: Server[]): void {
	for (const signal of SHUTDOWN_SIGNALS)
		process.once(signal, () => {
			app.locals.stopping = true;
			const stopped = stopAllValidations();
			console.log(chalk.yellow(`${signal} received - shutting down (${stopped} validations stopped)`));
			let open = servers.length;
			if (open == 0) process.exit(0);
			for (const server of servers) {
				server.close(() => {
					if (--open == 0) {
						console.log(chalk.yellow("all connections closed - exiting"));
						process.exit(0);
					}
				});
				server.closeIdleConnections();
			}
			setTimeout(() => {
				console.log(chalk.yellow(`requests still in progress after ${shutdownGraceMs() / 1000}s - exiting`));
				process.exit(0);
			}, shutdownGraceMs()).unref();
		});
}

/**
 * listen for the application: on HTTPS (--sport) when the key and certificate files exist (server.tls of the
 * configuration, by default selfsigned.key and selfsigned.crt in the program's folder), with HTTP (--port) redirecting to
 * HTTPS, or otherwise on HTTP only
 *
 * @param {ValidatorConfig}     config  the configuration
 * @param {express.Application} app     the application (see createApp())
 */
export function startServer(config: ValidatorConfig, app: express.Application): void {
	// start the HTTPS server
	// sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt
	const https_options = {
		key: readmyfile(config.tls.key, {}) as Buffer,
		cert: readmyfile(config.tls.certificate, {}) as Buffer,
	};
	const port = config.port;
	const sport = config.sport == config.port ? config.port + 1 : config.sport;
	const servers: Server[] = [];
	stopOnSignal(app, servers);

	// Only one server uses the HTTP port: the validator itself when HTTPS is not available, otherwise a redirect to HTTPS.
	// The choice is made from the HTTPS server's 'listening' and 'error' events, as listen() is asynchronous.
	const listenFailed = (protocol: string, port: number, consequence: string) => (err: NodeJS.ErrnoException) => {
		const reason = err.code == "EADDRINUSE" ? "already in use" : `${err.code ?? ""} ${err.message}`.trim();
		console.log(chalk.red(`${protocol} port ${port} ${reason} -- ${consequence}`));
	};

	const startHTTP = () => {
		const http_server = createHttpServer(app);
		servers.push(http_server);
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
		servers.push(redirect_server);
		redirect_server.on("error", listenFailed("HTTP", port, "HTTP to HTTPS redirect not started"));
		redirect_server.listen(port, () => {
			console.log(chalk.cyan(`HTTP redirecting to HTTPS on port number ${port}`));
		});
	};

	if (https_options.key && https_options.cert) {
		const https_server = createServer(https_options, app);
		servers.push(https_server);
		https_server.once("error", (err: NodeJS.ErrnoException) => {
			servers.splice(servers.indexOf(https_server), 1);
			listenFailed("HTTPS", sport, "HTTPS server not started, using HTTP")(err);
			startHTTP();
		});
		https_server.listen(sport, () => {
			console.log(chalk.cyan(`HTTPS listening on port number ${(https_server.address() as AddressInfo).port}`));
			startHTTPredirect();
		});
	} else startHTTP();
}
