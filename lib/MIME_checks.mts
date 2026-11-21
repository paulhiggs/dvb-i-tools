/**
 * MIME_checks.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * useful routines to check MIME types that could be used in DVB-I documents
 */

const JPEG_MIME: string = "image/jpeg",
	PNG_MIME: string = "image/png",
	WebP_MIME: string = "image/webp";

// media types are case-insensitive (IETF RFC 6838 clause 4.2), and may carry parameters after a ";"
const mediaType = (mime: string): string => mime.split(";")[0].trim().toLowerCase();

const REQUIRED_MIMES: string[] = [JPEG_MIME, PNG_MIME];
export const allowedImageTypes: string[] = [JPEG_MIME, PNG_MIME, WebP_MIME];

/**
 * determines if the value is a valid MIME type
 *
 * @param {string} mime the MIME type
 * @returns {boolean} true if the MIME type is formatted according to IETF RFC 2045, otherwise false
 */
const simple_mime_regex: RegExp = new RegExp(`^(.+[/].*)$`);
export const isMIME = (mime: string) : boolean => simple_mime_regex.test(mime.trim())
/**
 * determines if the value is a valid JPEG MIME type
 *
 * @param {string} mime the MIME type
 * @returns {boolean} true if the MIME type represents a JPEG image, otherwise false
 */
export const isJPEGmime = (mime: string) : boolean => mediaType(mime) == JPEG_MIME;

/**
 * determines if the value is a valid PNG MIME type
 *
 * @param {string} mime the MIME type
 * @returns {boolean} true if the MIME type represents a PNG image, otherwise false
 */
export const isPNGmime = (mime: string) : boolean => mediaType(mime) == PNG_MIME;

/**
 * determines if the value is a valid WebP MIME type
 *
 * @param {string} mime the MIME type
 * @returns {boolean} true if the MIME type represents a WebP image, otherwise false
 */
export const isWebPmime = (mime: string) : boolean => mediaType(mime) == WebP_MIME;

/**
 * determines if the value is a DVB-I permitted image MIME type
 *
 * @param {string} mime the MIME type
 * @returns {boolean} true if the MIME type is permitted by DVB-I, otherwise false
 */
export const isAllowedImageMime = (mime: string) : boolean => allowedImageTypes.includes(mediaType(mime));

/**
 * determines if the value is a DVB-I required image MIME type
 *
 * @param {string} mime the MIME type
 * @returns {boolean} true if the MIME type is required by DVB-I, otherwise false
 */
export const isRequiredImageMime = (mime: string) : boolean => REQUIRED_MIMES.includes(mediaType(mime));

/**
 * the image format a media type represents, for comparison with the format of a retrieved image
 *
 * @param {string} mime the MIME type
 * @returns {string | undefined} "jpeg", "png" or "webp", or undefined for any other media type
 */
export const imageFormatOf = (mime: string): string | undefined =>
	({ [JPEG_MIME]: "jpeg", [PNG_MIME]: "png", [WebP_MIME]: "webp" })[mediaType(mime)];

/**
 *
 * @param {string[]} MIMEs the list of MIME types provided for an image type
 * @returns {boolean}  false if the 'other' mime types are present without a requred MIME type, otherwise true
 */
export function validImageSet(MIMEs: string[]) : boolean {
	if (MIMEs.length == 0) return false;

	let hasRequired = false,
		hasOther = false;
	const uniqueMIMEs = [...new Set<string>(MIMEs.map(mediaType))];

	uniqueMIMEs.forEach((MIME) => {
		if (REQUIRED_MIMES.includes(MIME)) hasRequired = true;
		else hasOther = true;
	});

	return hasOther && !hasRequired ? false : hasRequired;
}
