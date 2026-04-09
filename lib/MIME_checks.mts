/**
 * MIME_checkst.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * useful routines to check MIME types that could be used in DVB-I documents
 */

const JPEG_MIME = "image/jpeg",
	PNG_MIME = "image/png",
	WebP_MIME = "image/WebP"; 

const REQUIRED_MIMES = [JPEG_MIME, PNG_MIME];
export const allowedImageTypes = [JPEG_MIME, PNG_MIME, WebP_MIME];

/**
 * determines if the value is a valid MIME type
 *
 * @param {String} mime the MIME type
 * @return {boolean} true if the MIME type is formatted according to IETF RFC 2045, otherwise false
 */
const simple_mime_regex = new RegExp(`^(.+[/].*)$`);
export const isMIME = (mime : string) => simple_mime_regex.test(mime.trim());

/**
 * determines if the value is a valid JPEG MIME type
 *
 * @param {String} mime the MIME type
 * @return {boolean} true if the MIME type represents a JPEG image, otherwise false
 */
export const isJPEGmime = (mime : string) => (mime == JPEG_MIME);

/**
 * determines if the value is a valid PNG MIME type
 *
 * @param {String} mime the MIME type
 * @return {boolean} true if the MIME type represents a PNG image, otherwise false
 */
export const isPNGmime = (mime : string) => (mime == PNG_MIME);

/**
 * determines if the value is a valid WebP MIME type
 *
 * @param {String} mime the MIME type
 * @return {boolean} true if the MIME type represents a WebP image, otherwise false
 */
export const isWebPmime = (mime : string) => (mime == WebP_MIME);

/**
 * determines if the value is a DVB-I permitted image MIME type
 *
 * @param {String} mime the MIME type
 * @return {boolean} true if the MIME type is permitted by DVB-I, otherwise false
 */
export const isAllowedImageMime = (mime : string) => allowedImageTypes.includes(mime);

/**
 * determines if the value is a DVB-I required image MIME type
 *
 * @param {String} mime the MIME type
 * @return {boolean} true if the MIME type is required by DVB-I, otherwise false
 */
export const isRequiredImageMime = (mime : string) => REQUIRED_MIMES.includes(mime);

/**
 *
 * @param {Array} MIMEs the list of MIME types provided for an image type
 * @returns {boolean}  false if the 'other' mime types are present without a requred MIME type, otherwise true
 */
export function validImageSet(MIMEs : Array<string>) : boolean {
	if (MIMEs.length == 0) return false;

	let hasRequired = false,
		hasOther = false;
	const uniqueMIMEs = [...new Set(MIMEs)];

	uniqueMIMEs.forEach((MIME) => {
		if (REQUIRED_MIMES.includes(MIME)) hasRequired = true;
		else hasOther = true;
	});

	return hasOther && !hasRequired ? false : hasRequired;
}
