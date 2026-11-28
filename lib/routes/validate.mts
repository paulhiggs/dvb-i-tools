/**
 * validate.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * The /validate_* endpoints: validate a document given by URL (GET) or in the request body (POST), and report the
 * results as HTML or, for the _json endpoints, as JSON
 */

import express from "express"

import { MODE_SL, MODE_PL, MODE_CG, MODE_SLR, MODE_AIT } from "../ui.mts"
import ErrorList from "../error_list.mts"
import type { ValidationOptions } from "../safe_fetch.mts"
import document_logger, { createPrefix } from "../logger.mts"
import type { ValidatorConfig } from "../config.mts"
import type { ValidatorServices } from "../services.mts"
import { checkMethod, getDocument, imageVariantOf, recordOutcome, report, requestFromQuery } from "./request_handling.mts"

// a document to validate may be sent as the body of a POST, up to the largest document the server accepts (by default
// MAX_DOCUMENT_BYTES, or server.maxDocumentBytes of the configuration, issue #147). A larger one is answered with 413
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const xmlBody = (maxBytes: number): express.RequestHandler => express.text({ type: "application/xml", limit: maxBytes });

// validates a document with the choices of the request
type Validation = (document: string, errs: ErrorList, options: ValidationOptions, req: express.Request) => Promise<void>

/**
 * validate a document given by URL (GET) or in the request body (POST), and send the results
 *
 * @param {express.Request}  req           the request
 * @param {express.Response} res           the response
 * @param {string}           mode          the type of document (MODE_SL, ...), for the archive
 * @param {Validation}       validate      validates the document
 * @param {string}           motd          the message of the day, for the HTML page
 * @param {boolean}          jsonResponse  JSON (the _json endpoints) rather than HTML
 * @param {object}           traversal     for a document that can traverse: whether the server allows traversal
 */
async function validateDocument(
		req: express.Request, res: express.Response, mode: string, validate: Validation, motd: string | undefined, jsonResponse: boolean, traversal?: { allowed: boolean }) : Promise<void> {
	if (!checkMethod(req, res)) return;
	const errs = ErrorList.withMarkup();
	const log_prefix = createPrefix(req, mode);
	// the request is checked first, so a document is not retrieved for a request that is not valid
	let request = requestFromQuery(req, log_prefix, errs, traversal);
	// the image variant of the URL applies to the requests for service lists, registry responses and content guides, and
	// must be one of table 8 of A177 (issue #153)
	if (request.options) {
		if (![MODE_SL, MODE_SLR, MODE_CG].includes(mode)) request.options.imageVariant = undefined;
		else if (req.method == "GET") {
			const variant = imageVariantOf(typeof req.query.url == "string" ? req.query.url : undefined);
			if (variant.parseErr) request = { parseErr: variant.parseErr, status: 400 };
		}
	}
	const { document, parseErr } = request.options ? await getDocument(req) : { document: undefined, parseErr: request.parseErr };

	if (document && request.options) await validate(document, errs, request.options, req);
	recordOutcome(res, errs, parseErr);
	if (request.parseErr && request.status) res.status(request.status);
	await report(req, res, jsonResponse, errs, motd, parseErr);
	document_logger(errs, log_prefix, true, req);
	res.end();
}

/**
 * the /validate_* endpoints of the document types the server offers
 *
 * @param {ValidatorConfig}   config    the configuration
 * @param {ValidatorServices} services  the checkers
 * @returns {express.Router} the router
 */
export function validateRouter(config: ValidatorConfig, services: ValidatorServices): express.Router {
	const router = express.Router();
	const { slcheck, plcheck, cgcheck, slrcheck, aitcheck } = services;
	const { motd, allowTraversal } = config;
	const XML_BODY = xmlBody(config.maxDocumentBytes);

	// the HTML and JSON endpoints of a document type
	const endpoints = (path: string, mode: string, validate: Validation, traversal?: { allowed: boolean }) => {
		router.all(path, XML_BODY, (req: express.Request, res: express.Response) => validateDocument(req, res, mode, validate, motd, false, traversal));
		router.all(`${path}_json`, XML_BODY, (req: express.Request, res: express.Response) => validateDocument(req, res, mode, validate, motd, true, traversal));
	};
	const traversal = { allowed: allowTraversal };

	if (config.features.sl) endpoints("/validate_sl", MODE_SL, (document, errs, options) => slcheck!.doValidateServiceList(document, errs, options), traversal);
	if (config.features.pl) endpoints("/validate_pl", MODE_PL, (document, errs, options) => plcheck!.doValidatePlaylist(document, errs, options));
	// the content guide request type (Time, NowNext, ...) is the type query parameter
	if (config.features.cg) endpoints("/validate_cg", MODE_CG, (document, errs, options, req) => cgcheck!.doValidateContentGuide(document, req.query.type as string, errs, options));
	if (config.features.slr) endpoints("/validate_slr", MODE_SLR, (document, errs, options) => slrcheck!.doValidateServiceListRegistry(document, errs, options), traversal);
	// how the XML AIT is used (linked, deeplink or template) is the role query parameter
	if (config.features.ait) endpoints("/validate_ait", MODE_AIT, (document, errs, options, req) => aitcheck!.doValidateXmlAit(document, req.query.role as string | undefined, errs, options));
	return router;
}
