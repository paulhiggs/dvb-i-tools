// pattern_checks.js
  
const e_pct="&#x25;",
	  e_quot="&#x22;",
	  e_lowalpha="a-z",
	  e_highalpha="A-Z",
	  e_alpha=`${e_lowalpha}${e_highalpha}`,
	  e_digit="0-9",
	  e_safe="$\-_.+",
	  e_extra=`!*(),${e_quot}`,	
	  e_hex=`${e_digit}A-Fa-f`,
	  e_unreserved=`${e_alpha}${e_digit}${e_safe}${e_extra}`,
	  e_hex16=`[${e_hex}]{1,4}`,
	  e_allFs="", // e_allFs="[fF]{4}",
	  e_chrs=`${e_unreserved}${e_pct}&amp;~;=:@`,
	  e_uword=`(:([${e_digit}]{1,4}|[1-5][${e_digit}]{4}|6[0-4][${e_digit}]{3}|65[0-4][${e_digit}]{2}|655[0-2][${e_digit}]|6553[0-5]))`, 
	  e_DecimalByte=`((25[0-5]|(2[0-4]|1{0,1}[${e_digit}]){0,1}[${e_digit}]))`, 
	  e_Scheme=`[${e_alpha}][${e_alpha}${e_digit}+\-.]*`,
	  e_User=`([${e_unreserved}${e_pct}&amp;~;=]+)`,
	  e_Password=`([${e_unreserved}${e_pct}&amp;~;=]+)`,
	  e_NamedHost=`[${e_alpha}${e_digit}${e_pct}._~\-]+`,
	  e_IPv4Host=`${e_DecimalByte}(.${e_DecimalByte}){3}`,
	  e_IPv6Address=`((${e_hex16}:){7,7}${e_hex16}|(${e_hex16}:){1,7}:|(${e_hex16}:){1,6}:${e_hex16}|(${e_hex16}:){1,5}(:${e_hex16}){1,2}|(${e_hex16}:){1,4}(:${e_hex16}){1,3}|(${e_hex16}:){1,3}(:${e_hex16}){1,4}|(${e_hex16}:){1,2}(:${e_hex16}){1,5}|${e_hex16}:((:${e_hex16}){1,6})|:((:${e_hex16}){1,7}|:)|fe80:(:${e_hex16}){0,4}${e_pct}[${e_hex}]{1,}|::(${e_allFs}(0{1,4}){0,1}:){0,1}${e_IPv4Host}|(${e_hex16}:){1,4}:${e_IPv4Host})`,
	  e_IPv6Host=`\\[${e_IPv6Address}\]`,
	  e_IPvFutureHost=`\\[v[a-f${e_digit}][${e_unreserved}${e_pct}&amp;~;=:]+\]`,
	  e_Port=`${e_uword}`,
	  e_Path=`(/[${e_chrs}]+)`,
	  e_AuthorityAndPath=`(${e_User}(:${e_Password})?@)?(${e_NamedHost}|${e_IPv6Host}|${e_IPvFutureHost})${e_Port}?${e_Path}*/?`,
	  e_PathNoAuthority=`(/?[${e_chrs}]+${e_Path}*/?)`,
	  e_RelativePath=`[${e_chrs}]+${e_Path}*`,
	  e_AbsolutePath=`${e_Path}+`,
	  e_Query=`(\\?[${e_chrs}/?]*)`,
	  e_Fragment=`(#[${e_chrs}/?]*)`,
	  e_NamespaceID=`[${e_alpha}${e_digit}][${e_alpha}${e_digit}-]{1,31}`,
	  e_NSSothers=`()+,\-\.:=@;$_!*'`,
	  e_NSSreserved=`${e_pct}/?#`,
	  e_NamespaceSpecific=`[${e_alpha}${e_digit}${e_NSSothers}${e_NSSreserved}]+`,
	  e_URN=`urn:${e_NamespaceID}:${e_NamespaceSpecific}`,
	  e_URL=`(${e_Scheme}:(//${e_AuthorityAndPath}|${e_PathNoAuthority})|(${e_RelativePath}/?|${e_AbsolutePath}/?))${e_Query}?${e_Fragment}?`;

const URNregex=new RegExp(`^${e_URN}$`,'i'),
      URLregex=new RegExp(`^${e_URL}$`,'i');

const e_HTTPURL=`https?:(//${e_AuthorityAndPath}|${e_PathNoAuthority})${e_Query}?${e_Fragment}?`;
const HTTPURLregex=new RegExp(`^${e_HTTPURL}$`,'i');

/**
 * checks if the argument complies to the TV Anytime defintion of RatioType
 *
 * @param {string}     str string contining value to check
 * @returns {boolean} true if the argment is compliant to a tva:RatioType
 */
const ratioRegex=new RegExp(/^\d+:\d+$/);
export function isRatioType (str) {
	return ratioRegex.test(str.trim());
}


/**
 * checks if the argument complies to an XML representation of UTC time
 *
 * @param {string} str string contining the UTC time
 * @returns {boolean}  true if the argment is formatted according to UTC ("Zulu") time
 */
const UTCregex=new RegExp(/^[\d]{4}-((0[1-9])|(1[0-2]))-((0[1-9])|1\d|2\d|(3[0-1]))T(([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?|(24:00:00(\.0+)?))Z$/);
export function isUTCDateTime (str) {
	return UTCregex.test(str.trim());
}


/**
 * checks of the specified argument matches an HTTP(s) URL where the protocol is required to be provided
 *
 * @param {string} arg  The value whose format is to be checked
 * @returns {boolean} true if the argument is an HTTP URL
 * 
 * see RFC 3986 - https://tools.ietf.org/html/rfc3986
 */
export function isHTTPURL (arg) {
	return HTTPURLregex.test(arg.trim());
}


/**
 * checks of the specified argument matches URL according to RFC 3986 - https://tools.ietf.org/html/rfc3986
 *
 * @param {string} arg  The value whose format is to be checked
 * @returns {boolean} true if the argument is an HTTP URL
 */
export function isURI (arg) {
	return this.isURL(arg) || this.isURN(arg);
}


/**
 * isURL and isURN use the syntax from MPEG DASH - http://github.com/MPEGGroup/DASHSchema/
 * @param {*} arg 
 */
export function isURL (arg) {
	return URLregex.test(arg);
}
export function isURN (arg) {
	return URNregex.test(arg);
}


/**
 * checks if the argument complies to an XML representation of UTC time
 *
 * @param {string} duration string contining the UTC time
 * @returns {boolean}  true if the argment is formatted according to UTC ("Zulu") time
 */
 const isoRegex=new RegExp(/^(-|\+)?P(?:([-+]?[\d,.]*)Y)?(?:([-+]?[\d,.]*)M)?(?:([-+]?[\d,.]*)W)?(?:([-+]?[\d,.]*)D)?(?:T(?:([-+]?[\d,.]*)H)?(?:([-+]?[\d,.]*)M)?(?:([-+]?[0\d,.]*)S)?)?$/);
 export function isISODuration (duration) {
	return isoRegex.test(duration.trim());
}
 
 
/**
 * checks if the argument complies to a DVB locator according to clause 6.4.2 of ETSI TS 102 851 
 * i.e. dvb://<original_network_id>..<service_id> ;<event_id>
 *
 * @param {string} locator string contining the DVB locator
 * @returns {boolean}  true is the argment is formatted as a DVB locator
 */
const locatorRegex=new RegExp(/^dvb:\/\/[\dA-Fa-f]+\.[\dA-Fa-f]*\.[\dA-Fa-f]+;[\dA-Fa-f]+$/);
export function isDVBLocator (locator) {
	return locatorRegex.test(locator.trim());
}


/**
 *
 * @param {String} postcode  the postcode value to check
 * @returns {boolean} true if the postcode argument is a valid postcode , otherwise false 
 */
const postcodeRegex=new RegExp(/[a-z\d]+([\- ][a-z\d]+)?$/, 'i');
export function isPostcode(postcode) {
	if (!postcode) return false;	
	return postcodeRegex.test(postcode.trim());
}


/**
 *
 * @param {String} postcode  the postcode value to check
 * @returns {boolean} true if the postcode argument is a valid wildcarded postcode , otherwise false 
 */
 const WildcardFirstRegex=new RegExp(/^(\*[a-z\\d]*[\- ]?[a-z\d]+)/, 'i');
 const WildcardMiddleRegex=new RegExp(/^(([a-z\d]+\*[\- ]?[a-z\d]+)|([a-z\d]+[\- ]?\\*[a-z\d]+))$/, 'i');
 const WildcardEndRegex=new RegExp(/^([a-z\d]+[\- ]?[a-z\d]*\*)$/, 'i');
 export function isWildcardPostcode(postcode) {
	if (!postcode) return false;
	return WildcardEndRegex.test(postcode.trim()) || WildcardMiddleRegex.test(postcode.trim())|| WildcardFirstRegex.test(postcode.trim());
}


/**
 * check if the argument is in the correct format for an DVB-I extension identifier
 *
 * @param {string} ext  the signalled extensionName
 * @returns {boolean} true if the signalled extensionName is in the specification defined format, else false
 */
const ExtensionRegex=new RegExp(/^[a-z\d][a-z\d:\-/\.]*[a-z\d]$/,'i');
export function validExtensionName(ext) {	
	return ExtensionRegex.test(ext.trim());
}


/**
 * check if the argument is in the correct format for a TV-Anytime FrameRateType
 *    <pattern value="([0-9]{1,3}(.[0-9]{1,3})?)|([0-9]{1,3}/1.001)"/>
 *
 * @param {string} ratre  the signalled frameRate
 * @returns {boolean} true if the signalled frameRate is a valid TV-Anytime FrameRateType, else false
 */
const FrameRateRegex1=new RegExp(/^\d{1,3}(\.\d{1,3})?$/);
const FrameRateRegex2=new RegExp(/^\d{1,3}\/1\.001$/);
export function validFrameRate(rate) {
	return FrameRateRegex1.test(rate.trim()) || FrameRateRegex2.test(rate.trim());
}



/**
 * checks of the specified argument matches an domain name (RFC 1034)
 *
 * @param {string} domain  The value whose format is to be checked
 * @returns {boolean} true if the argument is a domain name
 */
const DomainNameRegex=new RegExp(/^[a-z\d]+([\-\.]{1}[a-z\d]+)*\.[a-z]{2,5}(:[\d]{1,5})?(\/.*)?$/, 'i');
export function isDomainName(domain) {
	if (!domain) return false;
    return DomainNameRegex.test(domain.trim());
}



/**
 * checks of the specified argument matches an RTSP URL
 *  <restriction base="anyURI"><pattern value="rtsp://.*"/></restriction>
 *
 * @param {string} arg  The value whose format is to be checked
 * @returns {boolean} true if the argument is an RTSP URL
 */
const RTSPRegex=new RegExp(/^rtsp:\/\/.*$/, 'i');
export function isRTSPURL(arg) {
	if (!(arg && isURL(arg))) return false;
	return RTSPRegex.test(arg.trim());
}


/**
 * check that a values conforms to the ServiceDaysList type
 *
 * @param {string} the value to check, likely from an Interval@days attribute
 * @returns {boolean} true if the value is properly formated
 */
const DaysListRegex=new RegExp(/^([1-7]\s+)*[1-7]$/); // list of values 1-7 separeted by spaces
 export function validServiceDaysList(daysList) {
	if (!daysList) return false;
	return DaysListRegex.test(daysList.trim());
}


/**
 * check that a values conforms to the ZuluTimeType type
 *
 * @param {string} val the value to check, likely from an Interval@startTime or @endTime attributes
 * @returns {boolean} true if the value is properly formated
 */
const ZuluRegex=new RegExp(/^(([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?|(24:00:00(\.0+)?))Z$/);
export function validZuluTimeType(time) {
	if (!time) return false;
	return ZuluRegex.test(time.trim());
}


/**
 * checks that the supplied argument conforms to the pattern for a TVA LanguageType 
 * @param {String} languageCode 
 * @param {Boolean} caseSensitive
 */
export function isTVAAudioLanguageType(languageCode, caseSensitive=true) {
	// any language specified should be an XML language
	const languageRegex=new RegExp(/^[a-z]{1,8}(-[a-z0-9]{1,8})*$/, caseSensitive?'':'i');
	return languageRegex.test(languageCode);
}



