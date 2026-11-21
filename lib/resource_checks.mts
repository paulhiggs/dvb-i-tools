/**
 * resource_checks.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Checks of a resource referenced from a document (an image, an application, a program URL...): its signature
 * verification policy, its content digests and, for an image, the image itself. A resource is retrieved at most once
 * per validation, and that one retrieval serves all of its checks
 */

import SHA from "sha.js"

import { currentFetchPolicy, currentValidation, deferRetrieval, firstReference, normaliseURL, safeFetch, sharedRetrieval, validationSettings } from "./safe_fetch.mts"
import type { ValidationHandle } from "./safe_fetch.mts"
import { readImageInfo } from "./image_format.mts"
import type { ImageInfo } from "./image_format.mts"
import { checkInlineImage, reportImage, reportImageScaling, scaledURL, scalingWidth } from "./image_checks.mts"
import { contentDigestCheck, parseInlineImageData } from "./digest_validation.mts"
import { dvbi } from "./DVB-I_definitions.mts"
import { APPLICATION, INFORMATION, WARNING } from "./error_list.mts"
import ErrorList from "./error_list.mts"
import { keys } from "./common_errors.mts"
import { isDataURI, isHTTPURL, isHTTSPURL } from "./pattern_checks.mts"

import type { FoundDocumentItems } from "./sl_check.mts"

export type Digests = { sha1: string; sha256: string };

/**
 * the result of retrieving a resource. Only what the checks need is kept (not the content), as the result is kept for
 * the rest of the validation so the resource is not retrieved again
 */
export type ResourceOutcome = {
	ok: boolean; // a 2xx response was received
	error?: string; // why the resource could not be retrieved
	status?: number;
	statusText?: string;
	contentType?: string | null; // the Content-Type response header
	digests?: Digests; // of the content, for a 2xx response
	image?: ImageInfo; // the image properties read from the content, for a 2xx response
};

export const digestsOf = (content: Buffer | string): Digests => ({
	sha1: SHA("sha1").update(content).digest("hex"),
	sha256: SHA("sha256").update(content).digest("hex"),
});

/**
 * retrieve a resource, once per validation
 *
 * @param {string}           url         the URL of the resource
 * @param {ValidationHandle} validation  the validation the retrieval belongs to (see sharedRetrieval())
 * @returns {Promise<ResourceOutcome>} the result of the retrieval. It never rejects
 */
export function retrieveResource(url: string, validation?: ValidationHandle): Promise<ResourceOutcome> {
	return sharedRetrieval(
		`resource ${normaliseURL(url)}`,
		async (): Promise<ResourceOutcome> => {
			const { response, error } = await safeFetch(url, validation);
			if (!response) return { ok: false, error };
			const outcome: ResourceOutcome = { ok: response.ok, status: response.status, statusText: response.statusText, contentType: response.contentType };
			if (response.ok) {
				const content = response.buffer();
				outcome.digests = digestsOf(content);
				outcome.image = readImageInfo(content);
			}
			return outcome;
		},
		validation
	);
}

/**
 * verifies that any specified signature policy is already defined in the service list
 *
 * @param {Xmlelement} element              The XML element possibly containing the @verificationPolicy attribute
 * @param {FoundDocumentItems} documentInfo
 *                     signaturePolicyIDs   Signature Verification policy identifiers defined in this service list
 * @param {ErrorList}  errs                 The class where errors and warnings relating to the serivce list processing are stored
 * @param {string}     errCode              error code prefix for reporting
 */
export function ValidateAnySignaturePolicy(element: XmlElement, documentInfo: FoundDocumentItems, errs: ErrorList, errCode: string): void {
	if (!element) {
		errs.addError({ type: APPLICATION, code: "VSP000", message: "ValidateAnySignaturePolicy() called with element==null" });
		return;
	}

	const policy = element.attrAnyNsValueOr(dvbi.a_verificationPolicy);
	if (!policy) return;

	if (!documentInfo.definesPolicies) {
		errs.addError({
			type: INFORMATION,
			code: `${errCode}-1`,
			message: "document type does not define signature policies. ID checking is skipped",
			fragment: element,
			key: keys.k_SignaturePolicies,
		});
		return;
	}

	if (!documentInfo.signaturePolicyIDs.has(policy))
		errs.addError({
			type: WARNING,
			code: `${errCode}-2`,
			message: `${policy.quote()} is not defined in this document`,
			fragment: element,
			key: keys.k_SignaturePolicies,
		});

	if (!isHTTSPURL(element.content.trim()))
		errs.addError({
			type: WARNING,
			code: `${errCode}-3`,
			message: "Signature validation is only applicable to secure (https) connections",
			fragment: element,
			key: keys.k_SignaturePolicies,
		});
}

export type ResourceCheckCodes = {
	digest: string; // error code prefix for the content digest checks
	policy?: string; // error code prefix for the signature policy checks, which are skipped when not given
};

/**
 * check a resource referenced by an element: its signature policy (@verificationPolicy), its content digests
 * (@integrity) and, when it is an image and image checks are enabled, the image itself. The resource is retrieved at most
 * once per validation, however many checks and references there are: an image is checked and reported only at its first
 * reference, while the content digests of every reference are compared with the one retrieval
 *
 * The retrieval is started straight away, so it proceeds while the rest of the validation continues (within the fetch
 * concurrency limit). Its findings are reported when the validation performs its deferred work
 *
 * @param {XmlElement}         element       the element whose content is the URL (or data: URI) of the resource
 * @param {FoundDocumentItems} documentInfo  the signature policies defined in the document
 * @param {ErrorList}          errs          where findings are reported
 * @param {ResourceCheckCodes} codes         the error code prefixes
 * @param {object}             image         when the resource is an image: its signalled MediaUri@contentType
 */
export function checkReferencedResource(element: XmlElement, documentInfo: FoundDocumentItems, errs: ErrorList, codes: ResourceCheckCodes, image?: { contentType: string | null }): void {
	const compareDigests = contentDigestCheck(element, errs, codes.digest);
	if (codes.policy) ValidateAnySignaturePolicy(element, documentInfo, errs, codes.policy);
	if (!element) return;

	const images = validationSettings().images ?? "yes";
	const location = element.content.trim(),
		checkingImage = image != undefined && currentFetchPolicy().checkImages && images != "no";
	if (isDataURI(location)) {
		compareDigests?.(digestsOf(parseInlineImageData(element.content)));
		if (checkingImage) checkInlineImage(element, image!.contentType, errs);
		return;
	}

	const imageFirst = checkingImage && isHTTPURL(location) && firstReference("image", location);
	if (!compareDigests && !imageFirst) return;

	const validation = currentValidation(),
		scaling = imageFirst && images == "scaled";
	const work = (async () => {
		const original = await retrieveResource(location, validation);
		const target = scaling ? scalingWidth(original) : undefined,
			request = target ? scaledURL(location, target) : undefined;
		const scaled = request ? await retrieveResource(request, validation) : undefined;
		return { original, target, scaled };
	})();
	deferRetrieval(
		() => work,
		async ({ original, target, scaled }) => {
			compareDigests?.(original.ok ? (original.digests ?? null) : null);
			if (imageFirst && reportImage(original, location, image!.contentType, element, errs) && target && scaled)
				reportImageScaling(original, target, scaled, location, element, errs);
		}
	);
}
