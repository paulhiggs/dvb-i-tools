
const JPEG_MIME = "image/jpeg", 
      PNG_MIME =  "image/png",
	  WebP_MIME = "image/WebP"; // BUG2937 - https://bugzilla.dvb.org/show_bug.cgi?id=2937
	  
const allowedImageTypes=[JPEG_MIME, PNG_MIME, WebP_MIME];
/**
 * determines if the value is a valid JPEG MIME type
 *
 * @param {String} val the MIME type
 * @return {boolean} true if the MIME type represents a JPEG image, otherwise false
 */
export function isJPEGmime(val) { 
	return val ? val==JPEG_MIME : false;
}


/**
 * determines if the value is a valid PNG MIME type
 *
 * @param {String} val the MIME type
 * @return {boolean} true if the MIME type represents a PNG image, otherwise false
 */
export function isPNGmime(val) { 
	return val ? val==PNG_MIME : false;
}


/** BUG2937 - https://bugzilla.dvb.org/show_bug.cgi?id=2937
 * determines if the value is a valid WebP MIME type
 *
 * @param {String} val the MIME type
 * @return {boolean} true if the MIME type represents a WebP image, otherwise false
 */
export function isWebPmime(val) { 
	return val ? val==WebP_MIME : false;
}

export function isAllowedImageMime(val) {
	return val ? allowedImageTypes.includes(val) : false;
}