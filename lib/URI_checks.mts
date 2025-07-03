/**
 * URI_check.mts
 *
 * Check various forms of URI
 */

/**
 * determine if the passed value conforms to am IETF RFC4151 TAG URI
 *
 * @param {string | undefined} identifier  The service identifier to be checked
 * @return {boolean} true if the service identifier is in RFC4151 TAG URI format
 */
// RFC 4151 compliant - https://tools.ietf.org/html/rfc4151
// tagURI = "tag:" taggingEntity ":" specific [ "#" fragment ]
const TagRegex = new RegExp(
	/^tag:(([\da-z\-._]+@)?[\da-z][\da-z-]*[\da-z]*(\.[\da-z][\da-z-]*[\da-z]*)*),\d{4}(-\d{2}(\-\d{2})?)?:(['\da-z-._~!$&()*+,;=:@?/]|%[0-9a-f]{2})*(#(['a-z0-9\-._~!$&()*+,;=:@\\?/]|%[0-9a-f]{2})*)?$/,
	"i"
);
export let isTAGURI = (identifier : string | undefined) : boolean => 
	identifier ? TagRegex.test(identifier.trim()) : false;

/**
 * check if the argument complies to a CRID format
 *
 * @param {string| undefined} value  value whose format to check
 * @returns	{boolean} true if the argument confirms to the CRID format, else false
 **/
const CRIDRegex = new RegExp("crid://(.*)/(.*)", "i");
export let isCRIDURI = (value : string | undefined) : boolean  => 
	value ? CRIDRegex.test(value.trim()) : false;
