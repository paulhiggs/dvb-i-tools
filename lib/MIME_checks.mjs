/**
 * MIME_checks.mjs
 *
 * useful routines to check MIME types that could be used in DVB-I documents
 */
import { datatypeIs } from "./utils.mjs";

const JPEG_MIME = "image/jpeg",
	PNG_MIME = "image/png",
	WebP_MIME = "image/WebP"; // BUG2937 - https://bugzilla.dvb.org/show_bug.cgi?id=2937

const REQUIRED_MIMES = [JPEG_MIME, PNG_MIME];
export const allowedImageTypes = [JPEG_MIME, PNG_MIME, WebP_MIME];

/**
 * determines if the value is a valid MIME type
 *
 * @param {String} mime the MIME type
 * @return {boolean} true if the MIME type is formatted according to IETF RFC 2045, otherwise false
 */
let simple_mime_regex = new RegExp(`^(.+[/].*)$`);
export let isMIME = (mime) => (datatypeIs(mime, "string") ? simple_mime_regex.test(mime.trim()) : false);

/**
 * determines if the value is a valid JPEG MIME type
 *
 * @param {String} mime the MIME type
 * @return {boolean} true if the MIME type represents a JPEG image, otherwise false
 */
export let isJPEGmime = (mime) => (mime ? mime == JPEG_MIME : false);

/**
 * determines if the value is a valid PNG MIME type
 *
 * @param {String} mime the MIME type
 * @return {boolean} true if the MIME type represents a PNG image, otherwise false
 */
export let isPNGmime = (mime) => (mime ? mime == PNG_MIME : false);

/** BUG2937 - https://bugzilla.dvb.org/show_bug.cgi?id=2937
 * determines if the value is a valid WebP MIME type
 *
 * @param {String} mime the MIME type
 * @return {boolean} true if the MIME type represents a WebP image, otherwise false
 */
export let isWebPmime = (mime) => (mime ? mime == WebP_MIME : false);

/**
 * determines if the value is a DVB-I permitted image MIME type
 *
 * @param {String} mime the MIME type
 * @return {boolean} true if the MIME type is permitted by DVB-I, otherwise false
 */
export let isAllowedImageMime = (mime) => (mime ? allowedImageTypes.includes(mime) : false);

/**
 * determines if the value is a DVB-I required image MIME type
 *
 * @param {String} mime the MIME type
 * @return {boolean} true if the MIME type is required by DVB-I, otherwise false
 */
export let isRequiredImageMime = (mime) => (mime ? REQUIRED_MIMES.includes(mime) : false);

/**
 *
 * @param {Array} MIMEs the list of MIME types provided for an image type
 * @returns {boolean}  false if the 'other' mime types are present without a requred MIME type, otherwise true
 */
export function validImageSet(MIMEs) {
	if (MIMEs.length == 0) return false;

	let hasRequired = false,
		hasOther = false;
	let uniqueMIMEs = [...new Set(MIMEs)];

	uniqueMIMEs.forEach((MIME) => {
		if (REQUIRED_MIMES.includes(MIME)) hasRequired = true;
		else hasOther = true;
	});

	return hasOther && !hasRequired ? false : hasRequired;
}
