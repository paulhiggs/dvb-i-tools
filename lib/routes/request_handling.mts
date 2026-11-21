/**
 * request_handling.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Reading a validation request (the document, its choices) and writing the report, shared by the routes
 */

import express from "express"

import { drawResults, MODE_SL, MODE_SLR } from "../ui.mts"
import ErrorList, { INFORMATION } from "../error_list.mts"
import { jsonResult } from "../json_results.mts"
import type { ResultMode } from "../json_results.mts"
import { keys } from "../common_errors.mts"
import { safeFetch, IMAGE_CHECKING, DEFAULT_MAX_TRAVERSAL, parseTraversalLimit } from "../safe_fetch.mts"
import type { ImageChecking, ValidationOptions } from "../safe_fetch.mts"
import { GERMAN_A177r6_VARIANT } from "../globals.mts"

// initialise string formatting extensions
import {} from "../string-extensions.mts"

export async function getDocument(req: express.Request) : Promise<string | null> {
	if (req.method == "GET") {
		const { response: resp, error } = await safeFetch(req.query.url as string)
		if (error)
			req.parseErr = [error]
		if (resp) {
			if (resp.ok)
				return resp.text()
			else req.parseErr = [`error (${resp.status}:${resp.statusText}) handling ${req.query.url}`]
		}
	}
	else if (req.method == "POST")
		return req.body
	return null
}

const ALLOWED_VALIDATION_METHODS = ["GET", "POST"]

/**
 * reject requests to the validation endpoints that do not use an allowed HTTP method
 *
 * @returns {boolean} true if the request method is allowed, otherwise a 405 response has been sent and the request should not be processed further
 */
export function checkMethod(req: express.Request, res: express.Response) : boolean {
	if (ALLOWED_VALIDATION_METHODS.includes(req.method)) return true
	res.status(405).set("Allow", ALLOWED_VALIDATION_METHODS.join(", ")).type("text/plain").send(`method ${req.method} is not allowed, use ${ALLOWED_VALIDATION_METHODS.join(" or ")}`)
	return false
}

export function getVariant(req: express.Request) : number {
	switch (req.method) {
		case "GET":
			if (req.query?.variants && (req.query.variants as string).toLowerCase() == "de")
				return GERMAN_A177r6_VARIANT
			break
		case "POST":
			if (req.header("X-variants")?.toLowerCase() == "de")
				return GERMAN_A177r6_VARIANT
			break
	}
	return 0
}


/**
 * how a request asks for referenced images to be checked: "no", "yes" or "scaled". For a /validate_* endpoint this is
 * the images query parameter (GET) or the X-images header (POST); for /check it is the images form field.
 * Anything else (including nothing) is "yes"
 */
export function imageChecking(value: unknown) : ImageChecking {
	const v = typeof value == "string" ? value.toLowerCase() : "";
	return (IMAGE_CHECKING as string[]).includes(v) ? (v as ImageChecking) : "yes";
}
export const getImageChecking = (req: express.Request) : ImageChecking => imageChecking(req.method == "GET" ? req.query?.images : req.header("X-images"));

// a parameter of a /validate_* request: from the query of a GET, or from an X- header of a POST (whose body is the document)
const requestParameter = (req: express.Request, name: string): string | undefined => {
	const value = req.method == "GET" ? req.query?.[name] : req.header(`X-${name.replace(/_/g, "-")}`);
	return typeof value == "string" ? value : undefined;
};
const isTrue = (value: string | undefined): boolean => value != undefined && ["true", "on", "yes", "1"].includes(value.trim().toLowerCase());
const isFalse = (value: string | undefined): boolean => value != undefined && ["false", "off", "no", "0"].includes(value.trim().toLowerCase());

/**
 * read a limit on the depth of traversal: a positive whole number. A value above the server's limit is lowered to it
 * (validationRequest())
 *
 * @returns {number | undefined} the depth, or undefined if the value is not valid
 */
export function parseDepthLimit(value: string): number | undefined {
	const v = value.trim();
	return /^[1-9][0-9]*$/.test(v) ? Number(v) : undefined;
}

// which checks of references against their signature policies a /check form asks for (the "signatureChecks" field)
export type SignatureChecks = "both" | "connection" | "signature" | "none";
export const SIGNATURE_CHECKS: SignatureChecks[] = ["both", "connection", "signature", "none"];
export function signatureChecks(value: unknown): SignatureChecks {
	const v = typeof value == "string" ? value.toLowerCase() : "";
	return (SIGNATURE_CHECKS as string[]).includes(v) ? (v as SignatureChecks) : "both";
}

/**
 * the choices of a validation requested through a /validate_* endpoint, from the query (GET) or the X- headers (POST):
 * - the A177 variant (variants / X-variants) and image checking (images / X-images)
 * - turning off the checks of references against their signature policies: connection_certificates=false
 *   (X-connection-certificates) and response_signatures=false (X-response-signatures)
 * - for a document that can traverse (a service list or service list registry): traversal (traverse / X-traverse) and its
 *   limits (max_traversal / X-max-traversal, max_depth / X-max-depth)
 *
 * @param {express.Request} req         the request
 * @param {string}          log_prefix  where the document is archived, if it is
 * @param {ErrorList}       errs        where a note is added when traversal is requested but not allowed
 * @param {object}          traversal   for a document that can traverse: whether the server allows traversal
 * @returns {ValidationOptions | undefined} the choices for the validation, or undefined if a parameter is not valid (the
 *                                          reason is in req.parseErr)
 */
export function requestFromQuery(req: express.Request, log_prefix: string | undefined, errs?: ErrorList, traversal?: { allowed: boolean }): ValidationOptions | undefined {
	const options: ValidationOptions = {
		log_prefix,
		report_schema_version: true,
		variants: getVariant(req),
		images: getImageChecking(req),
		connectionCertificates: !isFalse(requestParameter(req, "connection_certificates")),
		responseSignatures: !isFalse(requestParameter(req, "response_signatures")),
	};
	if (!traversal || !isTrue(requestParameter(req, "traverse"))) return options;

	if (!traversal.allowed) {
		errs?.addError({
			type: INFORMATION,
			code: "TRAV004",
			message: "traversal was requested, but is not allowed on this server (it is started without --allow_traversal), so referenced documents are not validated",
			key: keys.k_Traversal,
		});
		return options;
	}
	const limit = requestParameter(req, "max_traversal");
	const maxTraversal = limit == undefined || limit.trim().length == 0 ? DEFAULT_MAX_TRAVERSAL : parseTraversalLimit(limit);
	if (maxTraversal == undefined) {
		req.parseErr = [`the maximum number of documents to traverse must be a positive whole number or ${"unlimited".quote()}, not ${limit!.quote()}`];
		return undefined;
	}
	const depth = requestParameter(req, "max_depth");
	const maxTraversalDepth = depth == undefined || depth.trim().length == 0 ? undefined : parseDepthLimit(depth);
	if (depth != undefined && depth.trim().length > 0 && maxTraversalDepth == undefined) {
		req.parseErr = [`the maximum depth of traversal must be a positive whole number, not ${depth.quote()}`];
		return undefined;
	}
	return { ...options, traverse: true, maxTraversal, maxTraversalDepth };
}

/**
 * the choices of a validation requested with the /check form, from its fields (already checked, and kept in the session)
 *
 * @param {express.Request} req           the request
 * @param {string}          testtype      the type of document being validated
 * @param {string}          log_prefix    where the document is archived, if it is
 * @param {number}          maxTraversal  the most documents to traverse, from the form
 * @param {number}          maxTraversalDepth  the deepest level to traverse into, from the form
 * @returns {ValidationOptions} the choices for the validation
 */
export function requestFromCheckForm(req: express.Request, testtype: string, log_prefix: string | undefined, maxTraversal: number | undefined, maxTraversalDepth?: number): ValidationOptions {
	// the Germany variant and traversal are offered for service lists and service list registries
	const list = testtype == MODE_SL || testtype == MODE_SLR,
		form = req.session.data;
	return {
		log_prefix,
		report_schema_version: true,
		variants: list && form?.forGermany ? GERMAN_A177r6_VARIANT : 0,
		traverse: list && form?.traverse == true,
		maxTraversal,
		maxTraversalDepth,
		images: form?.images,
		connectionCertificates: ["both", "connection"].includes(form?.signatureChecks ?? "both"),
		responseSignatures: ["both", "signature"].includes(form?.signatureChecks ?? "both"),
	};
}


export async function report(req: express.Request, res: express.Response, jsonResponse: boolean, errs: ErrorList, motd: string | undefined) : Promise<void> {
	if (jsonResponse) {
		res.setHeader("Content-Type", "application/json")
		if (!req.parseErr) delete errs.markupXML
		// a single JSON document is returned, with parseErr included only when the document could not be obtained or the
		// request was not valid. results=tree adds a node for each document (nested=problems and depth=N narrow it), and
		// results=all returns the whole ErrorList
		const mode: ResultMode = req.query.results == "all" ? "all" : req.query.results == "tree" ? "tree" : "summary"
		const depth = typeof req.query.depth == "string" && /^\d+$/.test(req.query.depth) ? Number(req.query.depth) : undefined
		res.write(JSON.stringify(jsonResult(errs, mode, { problemsOnly: req.query.nested == "problems", maxDepth: depth }, req.parseErr)))
	}
	else 
		await drawResults(req, res, motd, req.parseErr, errs)
}
