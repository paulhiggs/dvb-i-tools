/**
 * digest_validation.mjs
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Checks a resource against any specified content digests
 */

import fetchS from "sync-fetch";

import SHA from "sha.js"
import { fetch_options } from "./globals.mjs";
import { tva} from "./TVA_definitions.mjs";
import { dvbi} from "./DVB-I_definitions.mjs";
import { APPLICATION, WARNING } from "./error_list.mjs";
import { keys } from "./common_errors.mjs";
import { isDataURI } from "./pattern_checks.mjs";

const parseInlineImageData = (inline_image) => inline_image.substring(inline_image.indexOf(","));
const fetchContent = (url, options) => {
	let resp = null;
	try {
		resp = fetchS(url, options);
	}
	// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-empty 
	catch (error) {
	}
	return resp?.ok ? resp.buffer() : null;
};

const DigestRegexp = /^(?<algorithm>([a-z\d]+))=:(?<digest>([a-zA-Z0-9]+)):$/;
/**
* verifies that only premitted content digest algorithms are used for referenced elements
*  
* @param {Xmlelement} element  The XML element possibly containing the @integrity attribute
* @param {ErrorList}  errs     The class where errors and warnings relating to the serivce list processing are stored
* @param {String}     errCode  Error code prefix for reporting
*/
export function ValidateAnyContentDigests(element, errs, errCode) {
	if (!element) {
		errs.addError({ type: APPLICATION, code: "VD000", message: "ValidateAnyContentDigests() called with element==null" });
		return;
	}

	const contentDigests = element.attrAnyNsValueOr(tva.a_integrity);
	if (contentDigests) {
		const img = isDataURI(element.content) ? parseInlineImageData(element.content) :  fetchContent(element.content, fetch_options);
		contentDigests.split(",").forEach( (contentDigest) => {
			const result = contentDigest.match(DigestRegexp);
 
			if (result && result.groups && !dvbi.ALLOWED_DIGESTS.includes(result.groups.algorithm))
				errs.addError({
					code: `${errCode}a`,
					message: `invalid digest algorithm specified (${result.groups.algorithm})`,
					fragment: element,
					key: `invalid ${tva.a_integrity.attribute()}`,
				})
 
			if (result && result.groups && img) 
				switch (result.groups.algorithm) {
					case "sha1":
						if (SHA('sha1').update(img).digest('hex') != result.groups.digest)
							errs.addError({
								code: `${errCode}c`,
								message: `incorrect digest specified for "${result.groups.algorithm}"`,
								fragment: element,
								key: keys.k_InvalidDigest,
							});
						break;
					case "sha256":
						if (SHA('sha256').update(img).digest('hex') != result.groups.digest)
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
		});
 
		if (isDataURI(element.content))
			errs.addError({
				type: WARNING,
				code: `${errCode}u`,
				message: "digest with inline image provides no meaningful security protection",
				fragment: element,
				key: `unnecessary ${tva.a_integrity.attribute()}`,
				clause: "A177 clause 7.5.3",
				description: "There is limited merit in including the content digest and inline images in the same document.",
			});
	}
}
 
 
 