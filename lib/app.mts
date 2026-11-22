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
import chalk from "chalk"
import cors from "cors"
import express from "express"
import helmet from "helmet"
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
import { PAGE_ASSETS } from "./ui.mts"

export const HEALTH_ROUTE = "/healthz";

// the content security policy of every response (issue #89). The pages load their stylesheet and script from the validator
// (PAGE_ASSETS in ui.mts) and have no inline scripts, styles or event handlers. The live view of /check posts the form with
// fetch(), so connect-src is 'self'. There is no upgrade-insecure-requests, as a validator can be run over HTTP only
export const CONTENT_SECURITY_POLICY = {
	"default-src": ["'none'"],
	"script-src": ["'self'"],
	"style-src": ["'self'"],
	"img-src": ["'self'"],
	"connect-src": ["'self'"],
	"form-action": ["'self'"],
	"frame-ancestors": ["'self'"],
	"base-uri": ["'none'"],
};

/**
 * create the validator's Express application
 *
 * @param {ValidatorConfig}   config         the configuration
 * @param {ValidatorServices} services       the checkers and service list registry (see createServices())
 * @returns {express.Application} the application
 */
export function createApp(config: ValidatorConfig, services: ValidatorServices): express.Application {
	const app = express();

	// CORS handling, according to --CORSmode. This is registered before any routes so that it applies to all of them. In
	// "manual" mode, the /query route inserts its own headers (routes/slepr.mts)
	if (config.corsMode == CORSlibrary) app.use(cors());

	// the standard security headers, with these exceptions:
	//   - the content security policy is CONTENT_SECURITY_POLICY, without helmet's defaults
	//   - no Strict-Transport-Security: whether HTTP redirects to HTTPS is decided by the server (server.mts), and the
	//     header would also apply to every subdomain of the host the validator is deployed on
	//   - Cross-Origin-Resource-Policy is cross-origin, as the endpoints are meant to be used from other origins (--CORSmode)
	// X-Frame-Options is SAMEORIGIN, which "manual" CORS mode set for /query before
	app.use(
		helmet({
			contentSecurityPolicy: { useDefaults: false, directives: CONTENT_SECURITY_POLICY },
			strictTransportSecurity: false,
			crossOriginResourcePolicy: { policy: "cross-origin" },
			xFrameOptions: { action: "sameorigin" },
		})
	);

	// the health of the server, for a load balancer or container orchestrator. It is not logged, as it is asked for often.
	// The server is ready once the service list registry has been read (the other reference data is loaded before the server
	// listens), and stops being ready when it shuts down (server.mts sets app.locals.stopping)
	app.get(HEALTH_ROUTE, (req: express.Request, res: express.Response) => {
		const state = req.app.locals.stopping ? "stopping" : services.csr && !services.csr.loaded ? "starting" : "ok";
		res.status(state == "ok" ? 200 : 503).set("Cache-Control", "no-store").type("text/plain").send(state);
	});

	// the stylesheet and script of the pages. They are not logged, as each page asks for them. Their addresses have a hash of
	// their content (?v=), so a browser can keep them for a long time
	for (const asset of PAGE_ASSETS)
		app.get(asset.path, (req: express.Request, res: express.Response) => {
			res.set("Cache-Control", "public, max-age=31536000, immutable").type(asset.type).send(asset.body);
		});

	// no static file serving: the pages are generated, and the installation directory holds keys, logs and configuration.
	// The form's body parsers (file upload and URL encoded fields) are only on the /check route (routes/check.mts)
	app.use(favicon(join(__dirname, "icon", "ph-icon.ico")));
	app.use(...requestLoggers());

	app.set("trust proxy", 1);

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
