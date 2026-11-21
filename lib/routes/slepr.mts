/**
 * slepr.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * The service list registry endpoints: /query answers a service list registry query from the master SLEPR document, and
 * /reload reads that document again
 */

import express from "express"

import { CORSmanual } from "../globals.mts"
import type { ValidatorConfig } from "../config.mts"
import type { ValidatorServices } from "../services.mts"
import type { RegistryResponse } from "../slepr.mts"

export const SLEPR_query_route = "/query",
	SLEPR_reload_route = "/reload";

// with --CORSmode manual, the CORS header is inserted by this handler (in "library" mode, cors() applies to every route).
// X-Frame-Options: SAMEORIGIN, which this handler also set before, is now set for every route by helmet() (app.mts)
function manualCORS(config: ValidatorConfig): express.RequestHandler {
	if (config.corsMode != CORSmanual) return (req, res, next) => next();
	return (req, res, next) => {
		res.setHeader("Access-Control-Allow-Origin", "*");
		next();
	};
}

/**
 * send the registry's answer to a query, and record its parseErr and the headers it varies on for the request log
 *
 * @param {express.Response} res       the response
 * @param {RegistryResponse} response  the registry's answer (see SLEPR.processServiceListRequest())
 */
export function sendRegistryResponse(res: express.Response, response: RegistryResponse): void {
	if (response.vary.length > 0) res.vary(response.vary.join(", "));
	res.locals.vary = response.vary;
	res.locals.parseErr = response.parseErr;
	// the errors of a query that is not valid echo the values the client supplied, so they must not be sniffed as HTML
	if (response.status == 400) res.setHeader("X-Content-Type-Options", "nosniff");
	res.status(response.status).type(response.contentType).send(response.body);
}

/**
 * the service list registry endpoints, when the server offers them
 *
 * @param {ValidatorConfig}   config    the configuration
 * @param {ValidatorServices} services  the service list registry
 * @returns {express.Router} the router
 */
export function sleprRouter(config: ValidatorConfig, services: ValidatorServices): express.Router {
	const router = express.Router();
	const csr = services.csr;
	if (!csr) return router;

	const cors = manualCORS(config);
	if (config.corsMode == CORSmanual) router.options(SLEPR_query_route, cors);
	router.get(SLEPR_query_route, cors, (req: express.Request, res: express.Response) => {
		sendRegistryResponse(res, csr.processServiceListRequest(req.query, req.get("user-agent")));
	});
	router.get(SLEPR_reload_route, (req: express.Request, res: express.Response) => {
		csr.loadServiceListRegistry(config.csrFile);
		res.status(200).end();
	});
	return router;
}
