/**
 * MIME_checks.js
 * 
 * useful routines to check MIME types that could be used in DVB-I documents
 */

const JPEG_MIME = "image/jpeg",
	PNG_MIME = "image/png",
	WebP_MIME = "image/WebP"; // BUG2937 - https://bugzilla.dvb.org/show_bug.cgi?id=2937

const REQUIRED_MIMES = [JPEG_MIME, PNG_MIME];

const allowedImageTypes = [JPEG_MIME, PNG_MIME, WebP_MIME];
/**
 * determines if the value is a valid JPEG MIME type
 *
 * @param {String} val the MIME type
 * @return {boolean} true if the MIME type represents a JPEG image, otherwise false
 */
export let isJPEGmime = (val) => (val ? val == JPEG_MIME : false);

/**
 * determines if the value is a valid PNG MIME type
 *
 * @param {String} val the MIME type
 * @return {boolean} true if the MIME type represents a PNG image, otherwise false
 */
export let isPNGmime = (val) => (val ? val == PNG_MIME : false);

/** BUG2937 - https://bugzilla.dvb.org/show_bug.cgi?id=2937
 * determines if the value is a valid WebP MIME type
 *
 * @param {String} val the MIME type
 * @return {boolean} true if the MIME type represents a WebP image, otherwise false
 */
export let isWebPmime = (val) => (val ? val == WebP_MIME : false);

export let isAllowedImageMime = (val) => (val ? allowedImageTypes.includes(val) : false);

/**
 *
 * @param {array} MIMEs the list of MIME types provided for an image type
 * @returns {boolean}  false if the 'other' mime types are present without a requred MIME type, otherwise true
 */
export function validImageSet(MIMEs) {
	if (MIMEs.length == 0) return false;

	let hasRequired = false,
		hasOther = false;
	let uniqueMIMEs = [...new Set(MIMEs)];

	uniqueMIMEs.forEach((MIME) => {
		if (REQUIRED_MIMES.includes[MIME]) hasRequired = true;
		else hasOther = true;
	});

	return hasRequired || (hasOther && !hasRequired);
}
