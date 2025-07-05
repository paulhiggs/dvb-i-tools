/**
 * MIME_checks.mts
 *
 * useful routines to check MIME types that could be used in DVB-I documents
 * 
 */


const JPEG_MIME : string = "image/jpeg",
	PNG_MIME : string = "image/png",
	WebP_MIME : string = "image/WebP"; // BUG2937 - https://bugzilla.dvb.org/show_bug.cgi?id=2937

const REQUIRED_MIMES : Array<string> = [JPEG_MIME, PNG_MIME];
const allowedImageTypes : Array<string> = [JPEG_MIME, PNG_MIME, WebP_MIME];

/**
 * determines if the value is a valid JPEG MIME type
 *
 * @param {string | undefined} mime the MIME type
 * @return {boolean} true if the MIME type represents a JPEG image, otherwise false
 */
export let isJPEGmime = (mime : string | undefined) : boolean => mime ? mime == JPEG_MIME : false;

/**
 * determines if the value is a valid PNG MIME type
 *
 * @param {string | undefined} mime the MIME type
 * @return {boolean} true if the MIME type represents a PNG image, otherwise false
 */
export let isPNGmime = (mime : string | undefined) : boolean => mime ? mime == PNG_MIME : false;

/** BUG2937 - https://bugzilla.dvb.org/show_bug.cgi?id=2937
 * determines if the value is a valid WebP MIME type
 *
 * @param {string | undefined} mime the MIME type
 * @return {boolean} true if the MIME type represents a WebP image, otherwise false
 */
export let isWebPmime = (mime: string | undefined) : boolean => mime ? mime == WebP_MIME : false;

/**
 * determines if the value is a DVB-I permitted image MIME type
 *
 * @param {string | undefined} mime the MIME type
 * @return {boolean} true if the MIME type is permitted by DVB-I, otherwise false
 */
export let isAllowedImageMime = (mime : string | undefined) : boolean => mime ? allowedImageTypes.includes(mime) : false;

/**
 * determines if the value is a DVB-I required image MIME type
 *
 * @param {string | undefined} mime the MIME type
 * @return {boolean} true if the MIME type is required by DVB-I, otherwise false
 */
export let isRequiredImageMime = (mime : string | undefined) : boolean => mime ? REQUIRED_MIMES.includes(mime) : false;

/**
 *
 * @param {Array<string>} MIMEs the list of MIME types provided for an image type
 * @returns {boolean}  false if the 'other' mime types are present without a requred MIME type, otherwise true
 */
export function validImageSet(MIMEs : Array<string>) : boolean {
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
