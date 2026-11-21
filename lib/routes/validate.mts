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

import { MODE_SL, MODE_PL, MODE_CG, MODE_SLR } from "../ui.mts"
import ErrorList from "../error_list.mts"
import ServiceListCheck from "../sl_check.mts"
import type { SL_Validator_Options } from "../sl_check.mts"
import PlaylistCheck from "../playlist_check.mts"
import ContentGuideCheck from "../cg_check.mts"
import type { CG_Validator_Options } from "../cg_check.mts"
import ServiceListRegistryCheck from "../slr_check.mts"
import document_logger, { createPrefix } from "../logger.mts"
import type { ValidatorConfig } from "../config.mts"
import type { ValidatorServices } from "../services.mts"
import { checkMethod, getDocument, report, requestFromQuery } from "./request_handling.mts"

// a document to validate may be sent as the body of a POST
export const XML_BODY = express.text({ type: "application/xml", limit: "10mb" });

/**
 * Validate a service list
 *
 * @param {express.Request}  req           The Express request that triggered the validation
 * @param {express.Response} res           The Express response to be written to the requester
 * @param {ServiceListCheck} slcheck       Initialised Service List validator
 * @param {string | undefined} motd          HTML text for the Message Of The Day
 * @param {boolean}          jsonResponse  Flag indicating that the response should ne JSON format rather than HTML
 * @param {boolean}          allowTraversal Whether the server allows traversal (--allow_traversal), which the request can ask for
 */
async function validateServiceList(req: express.Request, res: express.Response, slcheck: ServiceListCheck, motd: string | undefined, jsonResponse: boolean, allowTraversal: boolean = false) : Promise<void> {
	if (!checkMethod(req, res)) return;
	const errs = ErrorList.withMarkup();
	const log_prefix = createPrefix(req, MODE_SL);
	const SLxml = await getDocument(req)
	const _options: SL_Validator_Options | undefined = requestFromQuery(req, log_prefix, errs, { allowed: allowTraversal })

	if (SLxml && _options) await slcheck.doValidateServiceList(SLxml, errs, _options);
	await report(req, res, jsonResponse, errs, motd)
	document_logger(errs, log_prefix, true, req);
	res.end();
}


/**
 * Validate a play list
 *
 * @param {express.Request}  req           The Express request that triggered the validation
 * @param {express.Response} res           The Express response to be written to the requester
 * @param {PlaylistCheck}    plcheck       Initialised play List validator
 * @param {string | undefined} motd          HTML text for the Message Of The Day
 * @param {boolean}          jsonResponse  Flag indicating that the response should ne JSON format rather than HTML
 */
async function validatePlaylist(req: express.Request, res: express.Response, plcheck: PlaylistCheck, motd: string | undefined, jsonResponse: boolean) : Promise<void> {
	if (!checkMethod(req, res)) return;
	const errs = ErrorList.withMarkup();
	const log_prefix = createPrefix(req, MODE_PL);
	const PLxml = await getDocument(req)

	if (PLxml) await plcheck.doValidatePlaylist(PLxml, errs, requestFromQuery(req, log_prefix)!);
	await report(req, res, jsonResponse, errs, motd)
	document_logger(errs, log_prefix, true, req);
	res.end();
}



/**
 * Validate a service list registry
 *
 * @param {express.Request}          req           The Express request that triggered the validation
 * @param {express.Response}         res           The Express response to be written to the requester
 * @param {ServiceListRegistryCheck} slrcheck       Initialised Service List validator
 * @param {string | undefined}       motd           HTML text for the Message Of The Day
 * @param {boolean}                  jsonResponse   Flag indicating that the response should ne JSON format rather than HTML
 * @param {boolean}                  allowTraversal Whether the server allows traversal (--allow_traversal), which the request can ask for
 */
async function validateServiceListRegistry(req: express.Request, res: express.Response, slrcheck: ServiceListRegistryCheck, motd: string | undefined, jsonResponse: boolean, allowTraversal: boolean = false) : Promise<void> {
	if (!checkMethod(req, res)) return;
	const errs = ErrorList.withMarkup();
	const log_prefix = createPrefix(req, MODE_SLR);
	const SLRxml = await getDocument(req)

	const _options: SL_Validator_Options | undefined = requestFromQuery(req, log_prefix, errs, { allowed: allowTraversal })
	if (SLRxml && _options) await slrcheck.doValidateServiceListRegistry(SLRxml, errs, _options);
	await report(req, res, jsonResponse, errs, motd)

	document_logger(errs, log_prefix, true, req);
	res.end();
}

/**
 * Validate a content guide metadata
 *
 * @param {express.Request}   req           The Express request that triggered the validation
 * @param {express.Response}  res           The Express response to be written to the requester
 * @param {ContentGuideCheck} cgcheck       Initialised Content Guide Metadata validator
 * @param {string | undefined} motd          HTML text for the Message Of The Day
 * @param {boolean}           jsonResponse  Flag indicating that the response should ne JSON format rather than HTML
 */
async function validateContentGuide(req: express.Request, res: express.Response, cgcheck: ContentGuideCheck, motd: string | undefined, jsonResponse: boolean) : Promise<void> {
	if (!checkMethod(req, res)) return;
	const errs = ErrorList.withMarkup();
	const log_prefix = createPrefix(req, MODE_CG);
	const CGxml = await getDocument(req)
	const _options: CG_Validator_Options = requestFromQuery(req, log_prefix)!

	if (CGxml) await cgcheck.doValidateContentGuide(CGxml, req.query.type as string, errs, _options);
	await report(req, res, jsonResponse, errs, motd)
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
	const { slcheck, plcheck, cgcheck, slrcheck } = services;
	const { motd, allowTraversal } = config;

	if (config.features.sl) {
		router.all("/validate_sl", XML_BODY, async (req: express.Request, res: express.Response) => {
			await validateServiceList(req, res, slcheck!, motd, false, allowTraversal);
		});
		router.all("/validate_sl_json", XML_BODY, async (req: express.Request, res: express.Response) => {
			await validateServiceList(req, res, slcheck!, motd, true, allowTraversal);
		});
	}

	if (config.features.pl) {
		router.all("/validate_pl", XML_BODY, async (req: express.Request, res: express.Response) => {
			await validatePlaylist(req, res, plcheck!, motd, false);
		});
		router.all("/validate_pl_json", XML_BODY, async (req: express.Request, res: express.Response) => {
			await validatePlaylist(req, res, plcheck!, motd, true);
		});
	}

	if (config.features.cg) {
		router.all("/validate_cg", XML_BODY, async (req: express.Request, res: express.Response) => {
			await validateContentGuide(req, res, cgcheck!, motd, false);
		});
		router.all("/validate_cg_json", XML_BODY, async (req: express.Request, res: express.Response) => {
			await validateContentGuide(req, res, cgcheck!, motd, true);
		});
	}

	if (config.features.slr) {
		router.all("/validate_slr", XML_BODY, async (req: express.Request, res: express.Response) => {
			await validateServiceListRegistry(req, res, slrcheck!, motd, false, allowTraversal);
		});
		router.all("/validate_slr_json", XML_BODY, async (req: express.Request, res: express.Response) => {
			await validateServiceListRegistry(req, res, slrcheck!, motd, true, allowTraversal);
		});
	}
	return router;
}
