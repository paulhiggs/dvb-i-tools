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

import { drawForm, liveDocumentResults, sendCheckResults, MODE_URL, MODE_FILE, MODE_SL, MODE_PL, MODE_CG, MODE_SLR, MODE_AIT, MODE_UNSPECIFIED } from "../ui.mts"
import type { FormModes, FormState } from "../ui.mts"
import ErrorList from "../error_list.mts"
import { safeFetch, currentFetchPolicy, observeValidation, DEFAULT_MAX_TRAVERSAL, parseTraversalLimit } from "../safe_fetch.mts"
import type { ValidationObserver } from "../safe_fetch.mts"
import { ProgressReport } from "../progress.mts"
import { HasProperty } from "../utils.mts"
import ServiceListCheck from "../sl_check.mts"
import PlaylistCheck from "../playlist_check.mts"
import ContentGuideCheck from "../cg_check.mts"
import ServiceListRegistryCheck from "../slr_check.mts"
import XmlAitCheck from "../ait_check.mts"
import { AIT_ROLE_LINKED } from "../MHP_definitions.mts"
import document_logger, { createPrefix } from "../logger.mts"
import type { ValidatorConfig } from "../config.mts"
import type { ValidatorServices } from "../services.mts"
import { imageChecking, parseDepthLimit, recordOutcome, requestFromCheckForm, signatureChecks } from "./request_handling.mts"
import { XML_BODY, MAX_DOCUMENT_BYTES } from "./validate.mts"

// initialise string formatting extensions
import {} from "../string-extensions.mts"

async function DVB_I_check(
		req: express.Request, res: express.Response, 
		slcheck: ServiceListCheck | undefined, plcheck: PlaylistCheck | undefined, cgcheck: ContentGuideCheck | undefined, slrcheck: ServiceListRegistryCheck | undefined,
		aitcheck: XmlAitCheck | undefined,
		hasSL: boolean, hasPL: boolean, hasCG: boolean, hasSLR: boolean, hasAIT: boolean,
		allow_traversal: boolean,
		motd: string | undefined, 
		mode: string = MODE_UNSPECIFIED, linktype: string = MODE_UNSPECIFIED) : Promise<void> {
			
	// the form's choices are not kept between requests: a new form has the defaults, and the form with the results shows
	// the values just submitted
	const defaults: FormState = {
		mode: mode == MODE_UNSPECIFIED ? (hasSL ? MODE_SL : hasCG ? MODE_CG : hasAIT ? MODE_AIT : MODE_CG) : mode,
		entry: linktype == MODE_UNSPECIFIED ? MODE_URL : linktype,
		url: "",
		cgmode: cgcheck?.supportedRequests[0].value,
		aitrole: AIT_ROLE_LINKED,
		forGermany: false,
		traverse: false,
		aits: false,
		maxTraversal: String(DEFAULT_MAX_TRAVERSAL),
		maxDepth: String(currentFetchPolicy().maxTraversalDepth),
		images: "yes",
		signatureChecks: "both",
	};

	const FormArguments: FormModes = { cg: MODE_CG, sl: MODE_SL, pl: MODE_PL, slr: MODE_SLR, ait: MODE_AIT, file: MODE_FILE, url: MODE_URL, hasSL: hasSL, hasPL: hasPL, hasCG: hasCG, hasSLR: hasSLR, hasAIT: hasAIT, allowTraversal: allow_traversal };
	if (!req.body?.testtype) 
		await drawForm(req, res, FormArguments, defaults, (cgcheck && cgcheck.supportedRequests) ? cgcheck.supportedRequests : null, motd, undefined, undefined);
	else {
		let VVxml: string | null = null;
		// why the document could not be obtained or validated, or why the form is not valid
		let parseErr: string[] | undefined;

		// a form field is only used when it is a single string - a missing field is treated as empty, and express.urlencoded()
		// can also produce arrays or objects (e.g. XMLurl[]=a&XMLurl[]=b), which are not valid values for any field
		const field = (name: string): string => (typeof req.body[name] == "string" ? req.body[name] : "");
		const testtype = field("testtype"),
			doclocation = field("doclocation"),
			requestType = field("requestType"),
			aitRole = field("aitRole"),
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
		const available: Record<string, boolean> = { [MODE_SL]: hasSL, [MODE_PL]: hasPL, [MODE_CG]: hasCG, [MODE_SLR]: hasSLR, [MODE_AIT]: hasAIT };

		if (testtype.length == 0) parseErr = ["validation type not specified"]
		else if (!HasProperty(available, testtype)) parseErr = [`unknown validation type ${testtype.quote()}`]
		else if (!available[testtype]) parseErr = [`validation type ${testtype.quote()} is not available`]
		else if (testtype == MODE_CG && requestType.length == 0) parseErr = ["request type not specified"]
		else if (testtype == MODE_CG && !cgcheck?.supportedRequests.some((r) => r.value == requestType)) parseErr = [`unknown request type ${requestType.quote()}`]
		else if (testtype == MODE_AIT && aitRole.length > 0 && !aitcheck?.supportedRoles.some((r) => r.value == aitRole)) parseErr = [`unknown XML AIT role ${aitRole.quote()}`]
		else if (doclocation != MODE_URL && doclocation != MODE_FILE) parseErr = [`method is not ${MODE_URL.quote()} or ${MODE_FILE.quote()}`]
		else if (doclocation == MODE_URL && XMLurl.length == 0) parseErr = ["URL not specified"]
		else if (doclocation == MODE_FILE && !(req.files && req.files.XMLfile)) parseErr = ["File not provided"]
		else if (doclocation == MODE_FILE && Array.isArray(req.files!.XMLfile)) parseErr = ["only one file can be validated at a time"]
		else if (traverse && maxTraversal == undefined)
			parseErr = [`the maximum number of documents to traverse must be a positive whole number or ${"unlimited".quote()}, not ${maxTraversalField.quote()}`]
		else if (traverse && maxDepthField.length > 0 && maxDepth == undefined)
			parseErr = [`the maximum depth of traversal must be a positive whole number, not ${maxDepthField.quote()}`]

		const form: FormState = {
			mode: available[testtype] ? testtype : defaults.mode,
			entry: doclocation == MODE_URL || doclocation == MODE_FILE ? doclocation : defaults.entry,
			url: XMLurl,
			cgmode: requestType.length > 0 ? requestType : defaults.cgmode,
			aitrole: aitRole.length > 0 ? aitRole : defaults.aitrole,
			forGermany: req.body.forGermany == "on",
			traverse: traverseSelected,
			aits: req.body.aits == "on",
			maxTraversal: maxTraversalField.length > 0 ? maxTraversalField : defaults.maxTraversal,
			maxDepth: maxDepthField.length > 0 ? maxDepthField : defaults.maxDepth,
			images: imageChecking(req.body.images),
			signatureChecks: signatureChecks(req.body.signatureChecks),
		};
		const log_prefix = createPrefix(req, testtype);
		// the choices for the validation, and every document it traverses into
		const request = requestFromCheckForm(form, testtype, log_prefix, maxTraversal, maxDepth);
		const errs = ErrorList.withMarkup();

		// the live view (issue #104) asks for the progress of the validation as events, one JSON object on each line, followed by
		// {"event":"results"} and the HTML of the results. Otherwise the results come with the page, when the validation has
		// finished
		const live = (req.get("Accept") ?? "").includes("application/x-ndjson");
		let observer: ValidationObserver & { cancel(): void; stop?(): void };
		if (live) {
			res.status(200).set({ "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
			res.flushHeaders();
			const send = (event: object) => {
				if (!res.destroyed) res.write(`${JSON.stringify(event)}\n`);
			};
			observer = new ProgressReport(errs, send, { rootHTML: liveDocumentResults, canSend: () => !res.writableNeedDrain });
		} else {
			let cancelled = false;
			observer = { get cancelled() { return cancelled }, cancel: () => { cancelled = true } };
		}
		// when the client goes away before the results are sent, the validation stops, as nobody will see the results
		res.on("close", () => {
			if (!res.writableEnded) observer.cancel();
		});
		if (!parseErr)
			switch (doclocation) {
				case MODE_URL:
					{
						errs.setLocation(XMLurl)
						const { response: resp, error } = await safeFetch(XMLurl);
						if (error)
							parseErr = [error];
						if (resp) {
							if (resp.ok) VVxml = resp.text();
							else parseErr = [`error (${resp.status}:${resp.statusText}) handling ${XMLurl}`];
						}
					}
					break;
				case MODE_FILE:
					try {
						errs.setLocation((req.files!.XMLfile as fileupload.UploadedFile).name)
						VVxml = (req.files!.XMLfile as fileupload.UploadedFile).data.toString();
					} catch (err) {
						parseErr = [`retrieval of FILE ${(req.files!.XMLfile as fileupload.UploadedFile).name} failed (${err})`];
					}
					break;
				default:
					parseErr = [`method is not ${MODE_URL.quote()} or ${MODE_FILE.quote()}`];
			}

		if (!parseErr && VVxml) await observeValidation(observer, async () => {
			switch (testtype) {
				case MODE_CG:
					errs.setType(`Content Guide-${requestType}`)
					if (cgcheck) 
						await cgcheck.doValidateContentGuide(VVxml!, requestType, errs, request);
					break;
				case MODE_SL:
					errs.setType("Service List")
					if (slcheck) 
						await slcheck.doValidateServiceList(VVxml!, errs, 
							request
						);
					break;
				case MODE_PL:
					errs.setType("Playlist")
					if (plcheck) 
						await plcheck.doValidatePlaylist(VVxml!, errs, request);
					break;
				case MODE_SLR:
					errs.setType("Service List Registry")
					if (slrcheck) 
						await slrcheck.doValidateServiceListRegistry(VVxml!, errs, request);
					break;
				case MODE_AIT:
					errs.setType(`XML AIT-${form.aitrole}`)
					if (aitcheck)
						await aitcheck.doValidateXmlAit(VVxml!, form.aitrole, errs, request);
					break;
			}
		});
		observer.stop?.();

		if (live) {
			if (!res.destroyed) res.write(`${JSON.stringify({ event: "results" })}\n`);
			await sendCheckResults(req, res, parseErr, errs);
		}
		else await drawForm(req, res, FormArguments, form, cgcheck ? cgcheck.supportedRequests : null, motd, parseErr, errs);

		recordOutcome(res, errs, parseErr);

		document_logger(errs, log_prefix, true, req);
	}
	res.end();
}


// the form's body: an uploaded document, with the same size limit as a document sent to the /validate_* endpoints (a larger
// one is answered with 413), or the fields alone
const FORM_FILE = fileupload({ limits: { fileSize: MAX_DOCUMENT_BYTES }, abortOnLimit: true }),
	FORM_FIELDS = express.urlencoded({ extended: true });

/**
 * the /check form, when the server offers any document type
 *
 * @param {ValidatorConfig}   config    the configuration
 * @param {ValidatorServices} services  the checkers
 * @returns {express.Router} the router
 */
export function checkRouter(config: ValidatorConfig, services: ValidatorServices): express.Router {
	const router = express.Router();
	const { sl, pl, cg, slr, ait } = config.features;
	if (sl || pl || cg || slr || ait)
		router.all("/check", XML_BODY, FORM_FILE, FORM_FIELDS, async (req: express.Request, res: express.Response) => {
			await DVB_I_check(req, res, services.slcheck, services.plcheck, services.cgcheck, services.slrcheck, services.aitcheck, sl, pl, cg, slr, ait, config.allowTraversal, config.motd);
		});
	return router;
}
