
const JPEG_MIME = "image/jpeg", 
      PNG_MIME =  "image/png";
	  
/**
 * determines if the value is a valid JPEG MIME type
 *
 * @param {String} val the MIME type
 * @return {boolean} true if the MIME type represents a JPEG image, otherwise false
 */
export function isJPEGmime(val) { return val==JPEG_MIME; }


/**
 * determines if the value is a valid PNG MIME type
 *
 * @param {String} val the MIME type
 * @return {boolean} true if the MIME type represents a PNG image, otherwise false
 */
export function isPNGmime(val) { return val==PNG_MIME; }
