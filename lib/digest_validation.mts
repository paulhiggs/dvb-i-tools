/**
 * digest_validation.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Checks a resource against any specified content digests. The resource is retrieved by checkReferencedResource() in
 * resource_checks.mts, which also performs the other checks of the resource from the same retrieval
 */

import type { Digests } from "./resource_checks.mts"
import { tva} from "./TVA_definitions.mts"
import { dvbi} from "./DVB-I_definitions.mts"
import { APPLICATION, INFORMATION, WARNING } from "./error_list.mts"
import ErrorList from "./error_list.mts";
import { keys } from "./common_errors.mts"
import { isDataURI } from "./pattern_checks.mts"

// the part of a data: URI that its content digest is calculated over
export const parseInlineImageData = (inline_image: string) : string => inline_image.substring(inline_image.indexOf(","));

const DigestRegexp = /^(?<algorithm>([a-z\d]+))=:(?<digest>([a-zA-Z\d]+)):$/;
/**
* prepares the check of any content digests (@integrity) of a referenced resource: that only permitted algorithms are
* used, and that each digest matches the resource
*
* @param {XmlElement} element  The XML element possibly containing the @integrity attribute
* @param {ErrorList}  errs     The class where errors and warnings relating to the serivce list processing are stored
* @param {string}     errCode  Error code prefix for reporting
* @returns {((digests: Digests | null) => void) | null} null if the element has no content digest, otherwise the check,
*          to be called with the digests of the resource, or null if the resource could not be retrieved
*/
export function contentDigestCheck(element: XmlElement, errs: ErrorList, errCode: string) : ((digests: Digests | null) => void) | null {
	if (!element) {
		errs.addError({ type: APPLICATION, code: "VD000", message: "contentDigestCheck() called with element==null" });
		return null;
	}

	const contentDigests = element.attrAnyNsValueOr(tva.a_integrity);
	if (contentDigests) {
		// compare the resource with each digest. digests is null when the resource could not be retrieved
		const checkDigests = (digests: Digests | null) : void => {
			contentDigests.split(",").forEach( (contentDigest: string) => {
				const result = contentDigest.match(DigestRegexp);
				if (result?.groups) {

					if (!dvbi.ALLOWED_DIGESTS.includes(result.groups.algorithm))
						errs.addError({
							code: `${errCode}a`,
							message: `invalid digest algorithm specified (${result.groups.algorithm})`,
							fragment: element,
							key: `invalid ${tva.a_integrity.attribute()}`,
						})
	 
						if (digests) 
							switch (result.groups.algorithm) {
								case "sha1":
									if (digests.sha1 != result.groups.digest)
										errs.addError({
											code: `${errCode}c`,
											message: `incorrect digest specified for "${result.groups.algorithm}"`,
											fragment: element,
											key: keys.k_InvalidDigest,
										});
									break;
								case "sha256":
									if (digests.sha256 != result.groups.digest)
										errs.addError({
											code: `${errCode}d`,
											message: `incorrect digest specified for "${result.groups.algorithm}"`,
											fragment: element,
											key: keys.k_InvalidDigest,
										});
									break;
								case "sm3":
									errs.addError({
										type: WARNING,
										code: `${errCode}e`,
										message: `digest not calculated/compared for "result.groups.algorithm"`,
										fragment: element,
									});
									break;
							}
					}
			});
	 
			if (isDataURI(element.content))
				errs.addError({
					type: WARNING,
					code: `${errCode}h`,
					message: "digest with inline image provides no meaningful security protection",
					fragment: element,
					key: `unnecessary ${tva.a_integrity.attribute()}`,
					clause: "A177 clause 7.5.3",
					description: "There is limited merit in including the content digest and inline images in the same document.",
				});

			if (!digests)
				errs.addError({
					type: INFORMATION,
					code: `${errCode}${isDataURI(element.content)?"i":"u"}`,
					message: `${isDataURI(element.content)?"inline ":""}resource${isDataURI(element.content)?"":` at "${element.content}"`} could not be retrieved`,
					key: "unavailable resource",
				})
		};

		return checkDigests;
	}
	return null;
}
 
 
 