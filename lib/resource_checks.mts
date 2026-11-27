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

import { currentFetchPolicy, currentValidation, deferRetrieval, firstReference, normaliseURL, safeFetch, sharedRetrieval, signaturePoliciesInEffect, currentRequest, connectionCertificatesChecked, responseSignaturesChecked } from "./safe_fetch.mts"
import type { FetchedResponse, ValidationHandle } from "./safe_fetch.mts"
import { evaluateSignature, reportSignature } from "./jws_checks.mts"
import type { SignatureEvaluation } from "./jws_checks.mts"
import { prefetchConnection, reportConnection } from "./tls_checks.mts"
import { readImageInfo } from "./image_format.mts"
import type { ImageInfo } from "./image_format.mts"
import { checkInlineImage, reportImage, reportImageScaling, scaledURL, scalingWidth } from "./image_checks.mts"
import { contentDigestCheck, parseInlineImageData } from "./digest_validation.mts"
import { dvbi } from "./DVB-I_definitions.mts"
import { tva } from "./TVA_definitions.mts"
import type { MarketImageKind } from "./markets.mts"
import { APPLICATION, INFORMATION, WARNING } from "./error_list.mts"
import ErrorList from "./error_list.mts"
import { keys } from "./common_errors.mts"
import { isDataURI, isHTTPURL, isHTTSPURL } from "./pattern_checks.mts"

import type { FoundDocumentItems } from "./sl_check.mts"
import type { SignaturePolicy } from "./certificate_utils.mts"

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
	url?: string; // the URL the response came from, after any redirects
	signature?: SignatureEvaluation; // the X-JWS-Signature of the response, when response signatures are checked
	expires?: string | null; // the Expires response header
	cacheControl?: string | null; // the Cache-Control response header
	// the content, only when the retrieval is asked to keep it: an XML AIT that is also validated (issue #134), which removes
	// it once it has been validated, so that it is not kept until the validation finishes
	text?: string;
};

export const digestsOf = (content: Buffer | string): Digests => ({
	sha1: SHA("sha1").update(content).digest("hex"),
	sha256: SHA("sha256").update(content).digest("hex"),
});

/**
 * retrieve a resource, once per validation
 *
 * @param {string}           url          the URL of the resource
 * @param {ValidationHandle} validation   the validation the retrieval belongs to (see sharedRetrieval())
 * @param {boolean}          keepContent  keep the content in the result (only the first retrieval of a URL decides)
 * @returns {Promise<ResourceOutcome>} the result of the retrieval. It never rejects
 */
export function retrieveResource(url: string, validation?: ValidationHandle, keepContent: boolean = false): Promise<ResourceOutcome> {
	return sharedRetrieval(
		`resource ${normaliseURL(url)}`,
		async (): Promise<ResourceOutcome> => {
			const { response, error } = await safeFetch(url, validation);
			if (!response) return { ok: false, error };
			const outcome: ResourceOutcome = {
				ok: response.ok,
				status: response.status,
				statusText: response.statusText,
				contentType: response.contentType,
				url: response.url,
				expires: response.expires,
				cacheControl: response.cacheControl,
			};
			if (response.ok) {
				const content = response.buffer();
				if (keepContent) outcome.text = response.text();
				outcome.digests = digestsOf(content);
				outcome.image = readImageInfo(content);
				// the signature is evaluated now, while the content is available, and compared with any policy when reported
				if (responseSignaturesChecked(validation)) outcome.signature = evaluateSignature(response.jwsSignature, content, response.reportingEndpoints);
			}
			return outcome;
		},
		validation
	);
}

/**
 * verifies that any specified signature policy is defined, in the document (a service list or service list registry) or,
 * for a document that does not define policies (a content guide document), in the service list that traversed into it
 *
 * @param {Xmlelement} element              The XML element possibly containing the @verificationPolicy attribute
 * @param {FoundDocumentItems} documentInfo
 *                     signaturePolicies    Signature Verification policies defined in this service list
 * @param {ErrorList}  errs                 The class where errors and warnings relating to the serivce list processing are stored
 * @param {string}     errCode              error code prefix for reporting
 * @returns {SignaturePolicy | undefined} the policy the element refers to, if it is defined
 */
export function ValidateAnySignaturePolicy(element: XmlElement, documentInfo: FoundDocumentItems, errs: ErrorList, errCode: string): SignaturePolicy | undefined {
	if (!element) {
		errs.addError({ type: APPLICATION, code: "VSP000", message: "ValidateAnySignaturePolicy() called with element==null" });
		return undefined;
	}

	const policyId = element.attrAnyNsValueOr(dvbi.a_verificationPolicy);
	if (!policyId) return undefined;

	const inherited = !documentInfo.definesPolicies,
		policies = inherited ? signaturePoliciesInEffect() : documentInfo.signaturePolicies;
	if (!policies) {
		errs.addError({
			type: INFORMATION,
			code: `${errCode}-1`,
			message: "document type does not define signature policies, and was not reached from a service list that does. ID checking is skipped",
			fragment: element,
			key: keys.k_SignaturePolicies,
		});
		return undefined;
	}

	const policy = policies.get(policyId);
	if (!policy)
		errs.addError({
			type: WARNING,
			code: `${errCode}-2`,
			message: `${policyId.quote()} is not defined in ${inherited ? "the service list that refers to this document" : "this document"}`,
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
	return policy;
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
 * @param {object}             image         when the resource is an image: its signalled MediaUri@contentType, and its kind
 *                                           when a market can stipulate its size (issue #119)
 */
export function checkReferencedResource(element: XmlElement, documentInfo: FoundDocumentItems, errs: ErrorList, codes: ResourceCheckCodes, image?: { contentType: string | null; kind?: MarketImageKind }): void {
	const compareDigests = contentDigestCheck(element, errs, codes.digest);
	const policy = codes.policy ? ValidateAnySignaturePolicy(element, documentInfo, errs, codes.policy) : undefined;
	if (!element) return;

	const images = currentRequest().images;
	const location = element.content.trim(),
		checkingImage = image != undefined && currentFetchPolicy().checkImages && images != "no";
	if (isDataURI(location)) {
		compareDigests?.(digestsOf(parseInlineImageData(element.content)));
		if (checkingImage) checkInlineImage(element, image!.contentType, errs, image!.kind);
		return;
	}

	const imageFirst = checkingImage && isHTTPURL(location) && firstReference("image", location);
	const signed = signedChecks(location, policy);
	if (!compareDigests && !imageFirst && !signed.signature && !signed.certificates) return;

	const validation = currentValidation(),
		scaling = imageFirst && images == "scaled";
	// an XML AIT that is also validated (aits) keeps its content, so that its validation uses this retrieval (issue #134)
	const keepContent = currentRequest().aits && element.attrAnyNsValueOr(tva.a_contentType) == dvbi.XML_AIT_CONTENT_TYPE;
	if (signed.certificates) prefetchConnection(location, validation);
	const work = (async () => {
		const original = await retrieveResource(location, validation, keepContent);
		const target = scaling ? scalingWidth(original) : undefined,
			request = target ? scaledURL(location, target) : undefined;
		const scaled = request ? await retrieveResource(request, validation) : undefined;
		return { original, target, scaled };
	})();
	deferRetrieval(
		() => work,
		async ({ original, target, scaled }) => {
			compareDigests?.(original.ok ? (original.digests ?? null) : null);
			if (imageFirst && reportImage(original, location, image!.contentType, element, errs, image!.kind) && target && scaled)
				reportImageScaling(original, target, scaled, location, element, errs);
			await reportSigned(original, location, policy, signed, element, errs, validation);
		}
	);
}

// which checks of its signature policy are made for a retrieved resource
type SignedChecks = { signature: boolean; certificates: boolean };

/**
 * the checks of a resource's signature policy that are made: the response to a resource with a signature policy is
 * checked once per policy in the validation, its signature and the certificate chain of the server it finally came from,
 * as far as the server and the request ask for them
 */
function signedChecks(url: string, policy: SignaturePolicy | undefined): SignedChecks {
	const signed = policy != undefined && isHTTPURL(url) && firstReference(`signed ${policy.policyId}`, url);
	return { signature: signed && responseSignaturesChecked(), certificates: signed && connectionCertificatesChecked() };
}

/**
 * report the checks of a resource's signature policy, from its retrieval
 */
async function reportSigned(original: ResourceOutcome, url: string, policy: SignaturePolicy | undefined, checks: SignedChecks, element: XmlElement, errs: ErrorList, validation?: ValidationHandle): Promise<void> {
	if (!policy) return;
	const finalURL = original.url ?? url;
	if (checks.signature)
		reportSignature(original.ok ? original.signature : undefined, url, finalURL, policy, element, errs, original.ok ? undefined : (original.error ?? `${original.status} ${original.statusText}`));
	if (checks.certificates) await reportConnection(element, finalURL, policy, errs, validation);
}

/**
 * check a URL that refers to a signature policy, when the URL is not the content of one element: e.g. the launch location
 * of an XML AIT application, which is <URLBase> followed by <applicationLocation> (issue #134). The response's signature and
 * the certificate chain of its server are checked against the policy, as for the resource of checkReferencedResource(),
 * with the same single retrieval per validation. The policy has already been found for the element (it is defined)
 *
 * @param {string}          url      the URL
 * @param {XmlElement}      element  the element that refers to the policy, where findings are reported
 * @param {SignaturePolicy} policy   the policy
 * @param {ErrorList}       errs     where findings are reported
 */
export function checkSignedLocation(url: string, element: XmlElement, policy: SignaturePolicy, errs: ErrorList): void {
	const signed = signedChecks(url, policy);
	if (!signed.signature && !signed.certificates) return;
	const validation = currentValidation();
	if (signed.certificates) prefetchConnection(url, validation);
	const retrieval = retrieveResource(url, validation);
	deferRetrieval(
		() => retrieval,
		(original) => reportSigned(original, url, policy, signed, element, errs, validation)
	);
}

/**
 * the signature policy an element refers to with @verificationPolicy, from the policies in effect for the document whose
 * rules are being checked. Nothing is reported: the reference is checked by ValidateAnySignaturePolicy()
 *
 * @param {XmlElement} element  the element, e.g. the <URI> of an endpoint
 * @returns {SignaturePolicy | undefined} the policy, if the element refers to one that is defined
 */
export function signaturePolicyOf(element: XmlElement): SignaturePolicy | undefined {
	const policyId = element?.attrAnyNsValueOr(dvbi.a_verificationPolicy);
	return policyId ? signaturePoliciesInEffect()?.get(policyId) : undefined;
}

/**
 * check a response retrieved from an endpoint whose <URI> refers to a signature policy, e.g. a document reached by
 * traversal: its signature (every response), and the certificate chain of the server it came from (once per host). Call
 * from the complete part of the retrieval
 *
 * @param {XmlElement}       element     the endpoint's <URI>, which carries @verificationPolicy
 * @param {string}           url         the URL requested
 * @param {FetchedResponse}  response    the response
 * @param {SignaturePolicy}  policy      the policy
 * @param {ErrorList}        errs        where findings are reported (the results of the retrieved document)
 * @param {ValidationHandle} validation  the validation the response belongs to
 */
export async function checkSignedResponse(element: XmlElement, url: string, response: FetchedResponse, policy: SignaturePolicy, errs: ErrorList, validation?: ValidationHandle): Promise<void> {
	if (responseSignaturesChecked(validation))
		reportSignature(evaluateSignature(response.jwsSignature, response.buffer(), response.reportingEndpoints), url, response.url, policy, element, errs);
	await reportConnection(element, response.url, policy, errs, validation);
}
