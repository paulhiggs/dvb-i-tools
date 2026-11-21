/**
 * check.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * The /check form: choose the type of document, where it comes from and the validation options, and see the results
 * below the form
 */

import express from "express"
import fileupload from "express-fileupload"

import { drawForm, MODE_URL, MODE_FILE, MODE_SL, MODE_PL, MODE_CG, MODE_SLR, MODE_UNSPECIFIED } from "../ui.mts"
import type { FormModes } from "../ui.mts"
import ErrorList from "../error_list.mts"
import { safeFetch, currentFetchPolicy, DEFAULT_MAX_TRAVERSAL, parseTraversalLimit } from "../safe_fetch.mts"
import { HasProperty } from "../utils.mts"
import ServiceListCheck from "../sl_check.mts"
import PlaylistCheck from "../playlist_check.mts"
import ContentGuideCheck from "../cg_check.mts"
import ServiceListRegistryCheck from "../slr_check.mts"
import document_logger, { createPrefix } from "../logger.mts"
import type { ValidatorConfig } from "../config.mts"
import type { ValidatorServices } from "../services.mts"
import { imageChecking, parseDepthLimit, requestFromCheckForm, signatureChecks } from "./request_handling.mts"
import { XML_BODY } from "./validate.mts"

// initialise string formatting extensions
import {} from "../string-extensions.mts"

async function DVB_I_check(
		req: express.Request, res: express.Response, 
		slcheck: ServiceListCheck | undefined, plcheck: PlaylistCheck | undefined, cgcheck: ContentGuideCheck | undefined, slrcheck: ServiceListRegistryCheck | undefined, 
		hasSL: boolean, hasPL: boolean, hasCG: boolean, hasSLR: boolean, 
		allow_traversal: boolean,
		motd: string | undefined, 
		mode: string = MODE_UNSPECIFIED, linktype: string = MODE_UNSPECIFIED) : Promise<void> {
			
	if (!req.session.data) {
		// setup defaults
		req.session.data = {};
		req.session.data.lastUrl = "";
		req.session.data.mode = mode == MODE_UNSPECIFIED ? (hasSL ? MODE_SL : MODE_CG) : mode;
		req.session.data.entry = linktype == MODE_UNSPECIFIED ? MODE_URL : linktype;
		if (cgcheck) req.session.data.cgmode = cgcheck.supportedRequests[0].value;
		req.session.data.forGermany = false;
		req.session.data.traverse = false;
		req.session.data.maxTraversal = String(DEFAULT_MAX_TRAVERSAL);
		req.session.data.maxDepth = String(currentFetchPolicy().maxTraversalDepth);
		req.session.data.images = "yes";
		req.session.data.signatureChecks = "both";
	}
	if (req.session.data.lastUrl != req.url) {
		req.session.data.mode = mode == MODE_UNSPECIFIED ? (hasSL ? MODE_SL : MODE_CG) : mode;
		req.session.data.entry = linktype == MODE_UNSPECIFIED ? MODE_URL : linktype;
		req.session.data.lastUrl = req.url;
	}
	
	const FormArguments: FormModes = { cg: MODE_CG, sl: MODE_SL, pl: MODE_PL, slr: MODE_SLR, file: MODE_FILE, url: MODE_URL, hasSL: hasSL, hasPL: hasPL, hasCG: hasCG, hasSLR: hasSLR, allowTraversal: allow_traversal };
	if (!req.body?.testtype) 
		await drawForm(req, res, FormArguments, (cgcheck && cgcheck.supportedRequests) ? cgcheck.supportedRequests : null, motd, undefined, undefined);
	else {
		let VVxml: string | null = null;
		req.parseErr = undefined;

		// a form field is only used when it is a single string - a missing field is treated as empty, and express.urlencoded()
		// can also produce arrays or objects (e.g. XMLurl[]=a&XMLurl[]=b), which are not valid values for any field
		const field = (name: string): string => (typeof req.body[name] == "string" ? req.body[name] : "");
		const testtype = field("testtype"),
			doclocation = field("doclocation"),
			requestType = field("requestType"),
			XMLurl = field("XMLurl"),
			maxTraversalField = field("maxTraversal").trim(),
			maxDepthField = field("maxDepth").trim();
		// traversal is only offered (and only done) when the server is started with --allow_traversal. Then the most
		// documents to traverse: a positive whole number or "unlimited", given when traversal is selected
		const traverseSelected = allow_traversal && req.body.traverse == "on",
			traverse = traverseSelected && (testtype == MODE_SL || testtype == MODE_SLR),
			maxTraversal = maxTraversalField.length == 0 ? DEFAULT_MAX_TRAVERSAL : parseTraversalLimit(maxTraversalField),
			// the deepest level to traverse into: a positive whole number, lowered to the server's limit if above it
			maxDepth = maxDepthField.length == 0 ? undefined : parseDepthLimit(maxDepthField);
		const available: Record<string, boolean> = { [MODE_SL]: hasSL, [MODE_PL]: hasPL, [MODE_CG]: hasCG, [MODE_SLR]: hasSLR };

		if (testtype.length == 0) req.parseErr = ["validation type not specified"]
		else if (!HasProperty(available, testtype)) req.parseErr = [`unknown validation type ${testtype.quote()}`]
		else if (!available[testtype]) req.parseErr = [`validation type ${testtype.quote()} is not available`]
		else if (testtype == MODE_CG && requestType.length == 0) req.parseErr = ["request type not specified"]
		else if (testtype == MODE_CG && !cgcheck?.supportedRequests.some((r) => r.value == requestType)) req.parseErr = [`unknown request type ${requestType.quote()}`]
		else if (doclocation != MODE_URL && doclocation != MODE_FILE) req.parseErr = [`method is not ${MODE_URL.quote()} or ${MODE_FILE.quote()}`]
		else if (doclocation == MODE_URL && XMLurl.length == 0) req.parseErr = ["URL not specified"]
		else if (doclocation == MODE_FILE && !(req.files && req.files.XMLfile)) req.parseErr = ["File not provided"]
		else if (doclocation == MODE_FILE && Array.isArray(req.files!.XMLfile)) req.parseErr = ["only one file can be validated at a time"]
		else if (traverse && maxTraversal == undefined)
			req.parseErr = [`the maximum number of documents to traverse must be a positive whole number or ${"unlimited".quote()}, not ${maxTraversalField.quote()}`]
		else if (traverse && maxDepthField.length > 0 && maxDepth == undefined)
			req.parseErr = [`the maximum depth of traversal must be a positive whole number, not ${maxDepthField.quote()}`]

		req.session.data.forGermany = req.body.forGermany == "on";
		req.session.data.traverse = traverseSelected
		req.session.data.maxTraversal = maxTraversalField.length > 0 ? maxTraversalField : String(DEFAULT_MAX_TRAVERSAL)
		req.session.data.maxDepth = maxDepthField.length > 0 ? maxDepthField : String(currentFetchPolicy().maxTraversalDepth)
		req.session.data.images = imageChecking(req.body.images)
		req.session.data.signatureChecks = signatureChecks(req.body.signatureChecks)
		const log_prefix = createPrefix(req, testtype);
		// the choices for the validation, and every document it traverses into
		const request = requestFromCheckForm(req, testtype, log_prefix, maxTraversal, maxDepth);
		const errs = ErrorList.withMarkup();
		if (!req.parseErr)
			switch (doclocation) {
				case MODE_URL:
					{
						errs.setLocation(XMLurl)
						const { response: resp, error } = await safeFetch(XMLurl);
						if (error)
							req.parseErr = [error];
						if (resp) {
							if (resp.ok) VVxml = resp.text();
							else req.parseErr = [`error (${resp.status}:${resp.statusText}) handling ${XMLurl}`];
						}
					}
					req.session.data.url = XMLurl;
					break;
				case MODE_FILE:
					try {
						errs.setLocation((req.files!.XMLfile as fileupload.UploadedFile).name)
						VVxml = (req.files!.XMLfile as fileupload.UploadedFile).data.toString();
					} catch (err) {
						req.parseErr = [`retrieval of FILE ${(req.files!.XMLfile as fileupload.UploadedFile).name} failed (${err})`];
					}
					req.session.data.url = undefined;
					break;
				default:
					req.parseErr = [`method is not ${MODE_URL.quote()} or ${MODE_FILE.quote()}`];
			}

		if (!req.parseErr && VVxml)
			switch (testtype) {
				case MODE_CG:
					errs.setType(`Content Guide-${requestType}`)
					if (cgcheck) 
						await cgcheck.doValidateContentGuide(VVxml, requestType, errs, request);
					break;
				case MODE_SL:
					errs.setType("Service List")
					if (slcheck) 
						await slcheck.doValidateServiceList(VVxml, errs, 
							request
						);
					break;
				case MODE_PL:
					errs.setType("Playlist")
					if (plcheck) 
						await plcheck.doValidatePlaylist(VVxml, errs, request);
					break;
				case MODE_SLR:
					errs.setType("Service List Registry")
					if (slrcheck) 
						await slrcheck.doValidateServiceListRegistry(VVxml, errs, request);
					break;
			}

		req.session.data.mode = testtype;
		req.session.data.entry = doclocation;
		if (requestType) req.session.data.cgmode = requestType;
		await drawForm(req, res, FormArguments, cgcheck ? cgcheck.supportedRequests : null, motd, req.parseErr, errs);

		req.diags = {};
		req.diags.countErrors = errs.numErrors();
		req.diags.countWarnings = errs.numWarnings();
		req.diags.countInforms = errs.numInformationals();

		document_logger(errs, log_prefix, true, req);
	}
	res.end();
}


/**
 * the /check form, when the server offers any document type
 *
 * @param {ValidatorConfig}   config    the configuration
 * @param {ValidatorServices} services  the checkers
 * @returns {express.Router} the router
 */
export function checkRouter(config: ValidatorConfig, services: ValidatorServices): express.Router {
	const router = express.Router();
	const { sl, pl, cg, slr } = config.features;
	if (sl || pl || cg || slr)
		router.all("/check", XML_BODY, async (req: express.Request, res: express.Response) => {
			await DVB_I_check(req, res, services.slcheck, services.plcheck, services.cgcheck, services.slrcheck, sl, pl, cg, slr, config.allowTraversal, config.motd);
		});
	return router;
}
