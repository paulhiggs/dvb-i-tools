/**
 * app.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * The validator's Express application: the middleware, the routes of the features the configuration enables, and the
 * handling of unknown paths and errors. Creating the application does not listen on a port or exit the process, so it can
 * be exercised in-process (see server.mts for the listeners)
 */

import { join } from "path"
import { randomBytes } from "crypto"
import chalk from "chalk"
import cors from "cors"
import express from "express"
import session from "express-session"
import fileupload from "express-fileupload"
import favicon from "serve-favicon"

import { CORSlibrary } from "./globals.mts"
import { __dirname } from "./data_locations.mts"
import { init_spam_blocker } from "./spam_disruptions.mts"
import { requestLoggers } from "./request_logging.mts"
import type { ValidatorConfig } from "./config.mts"
import type { ValidatorServices } from "./services.mts"
import { validateRouter } from "./routes/validate.mts"
import { checkRouter } from "./routes/check.mts"
import { sleprRouter } from "./routes/slepr.mts"
import { infoRouter } from "./routes/info.mts"

/**
 * create the validator's Express application
 *
 * @param {ValidatorConfig}   config         the configuration
 * @param {ValidatorServices} services       the checkers and service list registry (see createServices())
 * @param {string}            sessionSecret  signs the session cookies. SESSION_SECRET from the environment by default, or
 *                                           a random secret for this application
 * @returns {express.Application} the application
 */
export function createApp(config: ValidatorConfig, services: ValidatorServices, sessionSecret: string = process.env.SESSION_SECRET ?? randomBytes(32).toString("hex")): express.Application {
	const app = express();

	// CORS handling, according to --CORSmode. This is registered before any routes so that it applies to all of them. In
	// "manual" mode, the /query route inserts its own headers (routes/slepr.mts)
	if (config.corsMode == CORSlibrary) app.use(cors());

	// no static file serving: the pages are generated, and the installation directory holds keys, logs and configuration
	app.use(fileupload());
	app.use(favicon(join(__dirname, "icon", "ph-icon.ico")));
	app.use(...requestLoggers());
	app.use(express.urlencoded({ extended: true }));

	app.set("trust proxy", 1);
	app.use(
		session({
			secret: sessionSecret,
			resave: false,
			saveUninitialized: true,
			cookie: { maxAge: 60000 },
		})
	);

	app.use(validateRouter(config, services));
	app.use(checkRouter(config, services));
	app.use(sleprRouter(config, services));
	if (config.spamBlocker) init_spam_blocker(app);
	app.use(infoRouter(services));

	// any other path, with any method
	app.use((req: express.Request, res: express.Response) => {
		res.status(404).end();
	});

	// an error not handled by a route (including a rejected async handler) is logged, and reported to the client
	// without any detail of the server, such as a stack trace or file paths
	app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
		console.log(chalk.red(`unhandled error for ${req.method} ${req.originalUrl}: ${err instanceof Error ? err.stack : String(err)}`));
		if (res.headersSent) return next(err); // part of the response has been sent, so the connection can only be closed
		// errors from the body parsers carry an HTTP status (e.g. 413 when a document exceeds the size limit), and
		// "expose" when their message is safe to return to the client
		const { status, expose, message } = (err ?? {}) as { status?: unknown; expose?: unknown; message?: unknown };
		const code = typeof status == "number" && status >= 400 && status < 600 ? status : 500;
		res.status(code).type("text/plain").send(expose === true && typeof message == "string" ? message : "internal error while processing the request");
	});

	return app;
}
