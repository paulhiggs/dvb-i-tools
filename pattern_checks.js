/* jshint esversion: 8 */
// pattern_checks.js
  

/**
 * checks if the argument complies to the TV Anytime defintion of RatioType
 *
 * @param {string}     str string contining value to check
 * @returns {boolean} true if the argment is compliant to a tva:RatioType
 */
module.exports.isRatioType = function (str) {
    const ratioRegex=new RegExp(/^\d+:\d+$/);
    return ratioRegex.test(str.trim());
};


/**
 * checks if the argument complies to an XML representation of UTC time
 *
 * @param {string} str string contining the UTC time
 * @returns {boolean}  true if the argment is formatted according to UTC ("Zulu") time
 */
module.exports.isUTCDateTime = function (str) {
    const UTCregex=new RegExp(/^[\d]{4}-((0[1-9])|(1[0-2]))-((0[1-9])|1\d|2\d|(3[0-1]))T(([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?|(24:00:00(\.0+)?))Z$/);
    return UTCregex.test(str.trim());
};


/**
 * checks of the specified argument matches an HTTP(s) URL where the protocol is required to be provided
 *
 * @param {string} arg  The value whose format is to be checked
 * @returns {boolean} true if the argument is an HTTP URL
 * 
 * see RFC 3986 - https://tools.ietf.org/html/rfc3986
 */
module.exports.isHTTPURL=function (arg) {
	return this.isURI(arg.trim(), '(https?:\\/\\/)');
};


/**
 * checks of the specified argument matches URL according to RFC 3986 - https://tools.ietf.org/html/rfc3986
 *
 * @param {string} arg  The value whose format is to be checked
 * @returns {boolean} true if the argument is an HTTP URL
 */
 module.exports.isURI=function (arg, scheme='([a-zA-Z][-a-zA-Z\\d.+]*:)') {
	let pattern = new RegExp('^'+scheme+ // protocol
		'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
		'((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
		'(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
		'(\\?[\\/?;&a-z\\d%_.~+=-]*)?'+ // query string
		'(\\#[\\/?-a-z\\d_]*)?$','i'); // fragment locator
	return pattern.test(arg);
};


/**
 * checks if the argument complies to an XML representation of UTC time
 *
 * @param {string} duration string contining the UTC time
 * @returns {boolean}  true if the argment is formatted according to UTC ("Zulu") time
 */
 module.exports.isISODuration = function (duration) {
    let isoRegex=new RegExp(/^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/);
    return isoRegex.test(duration.trim());
};
 
 
/**
 * checks if the argument complies to a DVB locator according to clause 6.4.2 of ETSI TS 102 851 
 * i.e. dvb://<original_network_id>..<service_id> ;<event_id>
 *
 * @param {string} locator string contining the DVB locator
 * @returns {boolean}  true is the argment is formatted as a DVB locator
 */
module.exports.isDVBLocator = function (locator) {
    let locatorRegex = new RegExp(/^dvb:\/\/[\dA-Fa-f]+\.[\dA-Fa-f]*\.[\dA-Fa-f]+;[\dA-Fa-f]+$/);
    return locatorRegex.test(locator.trim());
};


/**
 *
 * @param {String} postcode  the postcode value to check
 * @returns {boolean} true if the postcode argument is a valid postcode , otherwise false 
 */
module.exports.isPostcode = function(postcode) {
	if (!postcode) return false;

	let postcodeRegex=new RegExp(/[a-z\d]+([\- ][a-z\d]+)?$/, 'i');
	return postcodeRegex.test(postcode.trim());
};


/**
 *
 * @param {String} postcode  the postcode value to check
 * @returns {boolean} true if the postcode argument is a valid wildcarded postcode , otherwise false 
 */
 module.exports.isWildcardPostcode = function(postcode) {
	if (!postcode) return false;

	let WildcardFirstRegex=new RegExp(/^(\*[a-z\\d]*[\- ]?[a-z\d]+)/, 'i');
	let WildcardMiddleRegex=new RegExp(/^(([a-z\d]+\*[\- ]?[a-z\d]+)|([a-z\d]+[\- ]?\\*[a-z\d]+))$/, 'i');
	let WildcardEndRegex=new RegExp(/^([a-z\d]+[\- ]?[a-z\d]*\*)$/, 'i');
	return WildcardEndRegex.test(postcode.trim()) || WildcardMiddleRegex.test(postcode.trim())|| WildcardFirstRegex.test(postcode.trim());
};


/**
 * check if the argument is in the correct format for an DVB-I extension identifier
 *
 * @param {string} ext  the signalled extensionName
 * @returns {boolean} true if the signalled extensionName is in the specification defined format, else false
 */
module.exports.validExtensionName=function(ext) {
	let ExtensionRegex=new RegExp(/^[a-z\d][a-z\d:\-/\.]*[a-z\d]$/,'i');
	return ExtensionRegex.test(ext.trim());
};


/**
 * check if the argument is in the correct format for a TV-Anytime FrameRateType
 *    <pattern value="([0-9]{1,3}(.[0-9]{1,3})?)|([0-9]{1,3}/1.001)"/>
 *
 * @param {string} ratre  the signalled frameRate
 * @returns {boolean} true if the signalled frameRate is a valid TV-Anytime FrameRateType, else false
 */
module.exports.validFrameRate=function(rate) {
	let FrameRateRegex1=new RegExp(/^\d{1,3}(\.\d{1,3})?$/);
	let FrameRateRegex2=new RegExp(/^\d{1,3}\/1\.001$/);
	
	return FrameRateRegex1.test(rate.trim()) || FrameRateRegex2.test(rate.trim());
};


/**
 * checks of the specified argument matches an HTTP or HTTPS URL (or no protocol is specified)
 *
 * @param {string} url  The value whose format is to be checked
 * @returns {boolean} true if the argument is an HTTP URL
 */
module.exports.isURL=function(url) {
	// genericurl as defined in RFC1738 - https://tools.ietf.org/html/rfc1738
	
	let genericURL = new RegExp(/^[-a-z\d@:%._\+~#=]{1,256}\\.[a-z\d()]{1,6}\b([-a-z\d()@:%_\+.~#?&//=]*)$/, 'i');
	return genericURL.test(url.trim());
};


/**
 * checks of the specified argument matches an domain name (RFC 1034)
 *
 * @param {string} domain  The value whose format is to be checked
 * @returns {boolean} true if the argument is a domain name
 */
module.exports.isDomainName=function(domain) {
	if (!domain) return false;
	let DomainNameRegex=new RegExp(/^[a-z\d]+([\-\.]{1}[a-z\d]+)*\.[a-z]{2,5}(:[\d]{1,5})?(\/.*)?$/, 'i');
    return DomainNameRegex.test(domain.trim());
};



/**
 * checks of the specified argument matches an RTSP URL
 *  <restriction base="anyURI"><pattern value="rtsp://.*"/></restriction>
 *
 * @param {string} arg  The value whose format is to be checked
 * @returns {boolean} true if the argument is an RTSP URL
 */
module.exports.isRTSPURL=function(arg) {
	if (!(arg && isURL(arg))) return false;
	
	let RTSPRegex=new RegExp(/^rtsp:\/\/.*$/, 'i');
	return RTSPRegex.test(arg.trim());
};


/**
 * check that a values conforms to the ServiceDaysList type
 *
 * @param {string} the value to check, likely from an Interval@days attribute
 * @returns {boolean} true if the value is properly formated
 */
 module.exports.validServiceDaysList=function(daysList) {
	if (!daysList) return false;
	// list of values 1-7 separeted by spaces
	let DaysListRegex=new RegExp(/^([1-7]\s+)*[1-7]$/);
	return DaysListRegex.test(daysList.trim());
};


/**
 * check that a values conforms to the ZuluTimeType type
 *
 * @param {string} val the value to check, likely from an Interval@startTime or @endTime attributes
 * @returns {boolean} true if the value is properly formated
 */
module.exports.validZuluTimeType=function(time) {
	if (!time) return false;
	// <pattern value="(([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?|(24:00:00(\.0+)?))Z"/>
	
	let ZuluRegex=new RegExp(/^(([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?|(24:00:00(\.0+)?))Z$/);
	return ZuluRegex.test(time.trim());
};


/**
 * checks that the supplied argument conforms to the pattern for a TVA LanguageType 
 * @param {String} languageCode 
 * @param {Boolean} caseSensitive
 */
module.exports.isTVAAudioLanguageType=function(languageCode, caseSensitive=true) {
	// any language specified should be an XML language
	const languageRegex=new RegExp(/^[a-z]{1,8}(-[a-z0-9]{1,8})*$/, caseSensitive?'':'i');
	return languageRegex.test(languageCode);
};



