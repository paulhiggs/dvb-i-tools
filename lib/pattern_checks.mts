/**
 * pattern_checks.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * useful regular expression based checks
 */

import { allowedImageTypes } from "./MIME_checks.mts";

const e_pct = "%", 
	e_lowalpha = "a-z",
	e_highalpha = "A-Z",
	e_hexChar = "a-fA-F",
	e_alpha = `${e_lowalpha}${e_highalpha}`,
	e_digit = "0-9",
	e_hex = `${e_digit}${e_hexChar}`,
	e_hex16 = `[${e_hex}]{1,4}`,
	e_DecimalByte = `(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[${e_digit}])`;

//const ASCII_chars = `!"#$%&'()*+,\-./${e_digit}:;<=>?@${e_highalpha}[\\]^_${e_lowalpha}{|}~`;
const ASCII_chars = `!"#$%&'()*+,-./${e_digit}:;<=>?@${e_highalpha}[\\]^_${e_lowalpha}{|}~`;

export const e_IPv4Address = `${e_DecimalByte}(\\.${e_DecimalByte}){3}`;

const e_v6_8words = `(${e_hex16}:){7,7}${e_hex16}`, // TEST: 1:2:3:4:5:6:7:8
	e_v6_7words = `(${e_hex16}:){1,7}:`, // TEST: 1::                              1:2:3:4:5:6:7::
	e_v6_6words = `(${e_hex16}:){1,6}:${e_hex16}`, // TEST: 1::8             1:2:3:4:5:6::8  1:2:3:4:5:6::8
	e_v6_5words = `(${e_hex16}:){1,5}(:${e_hex16}){1,2}`, // TEST: 1::7:8           1:2:3:4:5::7:8  1:2:3:4:5::8
	e_v6_4words = `(${e_hex16}:){1,4}(:${e_hex16}){1,3}`, // TEST: 1::6:7:8         1:2:3:4::6:7:8  1:2:3:4::8
	e_v6_3words = `(${e_hex16}:){1,3}(:${e_hex16}){1,4}`, // TEST: 1::5:6:7:8       1:2:3::5:6:7:8  1:2:3::8
	e_v6_2words = `(${e_hex16}:){1,2}(:${e_hex16}){1,5}`, // TEST: 1::4:5:6:7:8     1:2::4:5:6:7:8  1:2::8
	e_v6_1word = `${e_hex16}:((:${e_hex16}){1,6})`, // TEST: 1::3:4:5:6:7:8   1::3:4:5:6:7:8  1::8
	e_v6_nowords = `:((:${e_hex16}){1,7}|:)`, // TEST: ::2:3:4:5:6:7:8  ::2:3:4:5:6:7:8 ::8       ::
	e_v6_linklocal = `fe08:(:${e_hex16}){0,4}%[${e_alpha}${e_digit}]{1,}`, // TEST: fe08::7:8%eth0      fe08::7:8%1                                      (link-local IPv6 addresses with zone index)
	e_v6_v4mapped = `::(ffff(0{1,4}){0,1}:){0,1}${e_IPv4Address}|(${e_hex16}:){1,4}:${e_IPv4Address}`, // TEST: ::255.255.255.255   ::ffff:255.255.255.255  ::ffff:0:255.255.255.255 (IPv4-mapped IPv6 addresses and IPv4-translated addresses)
	e_v6_v4embed = `(${e_hex16}:){1,4}:${e_IPv4Address}`; // TEST: 2001:db8:3:4::192.0.2.33  64:ff9b::192.0.2.33                        (IPv4-Embedded IPv6 Address)

export const e_IPv6Address = `(${e_v6_8words}|${e_v6_7words}|${e_v6_6words}|${e_v6_5words}|${e_v6_4words}|${e_v6_3words}|${e_v6_2words}|${e_v6_1word}|${e_v6_nowords}|${e_v6_linklocal}|${e_v6_v4mapped}|${e_v6_v4embed})`,
	e_IPv6Host = `\\[${e_IPv6Address}]`;

const e_NamespaceID = `[${e_alpha}${e_digit}][${e_alpha}${e_digit}-]{1,31}`,
//	e_NSSothers = `()+,\-\.:=@;$_!*'`,
	e_NSSothers = `()+,-.:=@;$_!*'`,
	e_NSSreserved = `${e_pct}/?#`,
	e_NamespaceSpecific = `[${e_alpha}${e_digit}${e_NSSothers}${e_NSSreserved}]+`,
	e_URN = `urn:${e_NamespaceID}:${e_NamespaceSpecific}`;


// from BCP47 - https://www.rfc-editor.org/rfc/bcp/bcp47.txt
const l_alphanum = `${e_alpha}${e_digit}`;
const regular = "(art-lojban|cel-gaulish|no-bok|no-nyn|zh-guoyu|zh-hakka|zh-min|zh-min-nan|zh-xiang)";
const irregular = "(en-GB-oed|i-ami|i-bnn|i-default|i-enochian|i-hak|i-klingon|i-lux|i-mingo|i-navajo|i-pwn|i-tao|i-tay|i-tsu|sgn-BE-FR|sgn-BE-NL|sgn-CH-DE)";
const grandfathered = `(?<grandfathered>${irregular}|${regular})`;
const privateUse_unlabelled = `x(-[${l_alphanum}]{1,8})+)`;
const privateUse1 = `(?<privateUse1>${privateUse_unlabelled}`;
const privateUse2 = `(?<privateUse2>${privateUse_unlabelled}`;
const singleton = `[${e_digit}A-WY-Za-wy-z]`;
const extension = `(?<extension>${singleton}(-[${l_alphanum}]{2,8})+)`;
const variant = `(?<variant>[${l_alphanum}]{5,8}|[${e_digit}][${l_alphanum}]{3})`;
const region = `(?<region>[${e_alpha}]{2}|[${e_digit}]{3})`;
const script = `(?<script>[${e_alpha}]{4})`;
const extlang = `(?<extlang>[${e_alpha}]{3}(-[${e_alpha}]{3}){0,2})`;
const language = `(?<language>([${e_alpha}]{2,3}(-${extlang})?)|[${e_alpha}]{4}|[${e_alpha}]{5,8})`;
const langtag = `(${language}(-${script})?(-${region})?(-${variant})*(-${extension})*(-${privateUse2})?)`;
const languageTag = `^(${grandfathered}|${langtag}|${privateUse1})$`;

export const BCP47_Language_Tag = languageTag;

/**
 * checks if the argument complies to the TV Anytime defintion of RatioType
 *
 * @param {String} ratio string contining value to check
 * @returns {boolean} true if the argment is compliant to a tva:RatioType
 */
const ratioRegex = new RegExp(`^[${e_digit}]+:[${e_digit}]+$`);
export const isRatioType = (ratio : string) => ratioRegex.test(ratio.trim());

/**
 * checks if the argument complies to an XML representation of UTC time
 *
 * @param {String} time string contining the UTC time
 * @returns {boolean}  true if the argment is formatted according to UTC ("Zulu") time
 */
const UTCregex = new RegExp(/^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\.[0-9]{1,3})?Z?$/);
export const isUTCDateTime = (time : string) => UTCregex.test(time.trim());

export function isInlineImage(data : string) {
	let valid : boolean = false;
	allowedImageTypes.forEach((image_MIME) => {
		valid ||= data.startsWith(`data:${image_MIME};base64,`);
	});
	return valid;
}

/**
 * checks of the specified argument matches an HTTP(s) URL where the protocol is required to be provided
 *
 * @param {String} url  The value whose format is to be checked
 * @returns {boolean} true if the argument is an HTTP URL
 *
 * see RFC 3986 - https://tools.ietf.org/html/rfc3986
 */
const HTTPprotocolRegex = new RegExp("^https?:$", "i");
export function isHTTPURL(url : string) {
	try {
		const sss = new URL(url);
		return HTTPprotocolRegex.test(sss.protocol);
	} catch (/* eslint-disable @typescript-eslint/no-unused-vars */ err /* eslint-enable @typescript-eslint/no-unused-vars */) {
		return false;
	}
}

/**
 * checks of the specified argument matches the scheme, authority and path syntax components of an HTTP(s) URL where the protocol is required to be provided
 *
 * @param {String} path  The value whose format is to be checked
 * @returns {boolean} true if the argument is an HTTP URL path (no query or fragment componenets)
 *
 * see RFC 3986 - https://tools.ietf.org/html/rfc3986
 */
export function isHTTPPathURL(url : string) : boolean {
	try {
		const sss = new URL(url);
		return sss.pathname.endsWith("/") && HTTPprotocolRegex.test(sss.protocol);
	} catch (/* eslint-disable @typescript-eslint/no-unused-vars */ err /* eslint-enable @typescript-eslint/no-unused-vars */) {
		return false;
	}
}

/**
 * isURL and isURN use the syntax from MPEG DASH - http://github.com/MPEGGroup/DASHSchema/
 * @param {*} urn | url
 */
const URNregex = new RegExp(`^${e_URN}$`, "i");
export const isURL = (url : string) : boolean => {
	if (url.includes(" ")) return false;
	try {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const sss = new URL(url);
		return true;
	} catch (/* eslint-disable @typescript-eslint/no-unused-vars */ err /* eslint-enable @typescript-eslint/no-unused-vars */) {
		return false;
	}
};
export const isURN = (urn : string) => URNregex.test(urn);

/**
 * checks of the specified argument matches URL according to RFC 3986 - https://tools.ietf.org/html/rfc3986
 *
 * @param {String} uri  The value whose format is to be checked
 * @returns {boolean} true if @uri is an HTTP URL
 */
export const isURI = (uri : string) : boolean => isURL(uri) || isURN(uri);

/**
 * Checks the URI conforms to RFC 2397.
 * dataurl := "data:" [ mediatype ] [ ";base64" ] "," data mediatype := [ type "/" subtype ] *( ";" parameter ) data := *urlchar parameter := attribute "=" value
 *
 * @param {String} uri  the value to be checked
 * @returns {boolean}  true if @uri is a string and mateches teh format of a data: URI, otherwise false
 * Thanks to https://gist.github.com/khanzadimahdi/bab8a3416bdb764b9eda5b38b35735b8
 */
// eslint-disable-next-line no-useless-escape
const dataRegexp = new RegExp(`^data:((?:\w+\/(?:(?!;).)+)?)((?:;[\w\W]*?[^;])*),(.+)$`, "i");
export const isDataURI = (uri : string) : boolean => dataRegexp.test(uri);

/**
 * checks if the argument complies to an XML representation of UTC time (i.e. ISO 8601-2:2019)
 *
 * @param {String} duration string contining the UTC time
 * @returns {boolean}  true if @duration is formatted according to UTC ("Zulu") time
 */
// based on https://stackoverflow.com/questions/32044846/regex-for-iso-8601-durations
const isoRegex = new RegExp(
	/^[-+]?P(?!$)(([-+]?\d+Y)|([-+]?\d+\.\d+Y$))?(([-+]?\d+M)|([-+]?\d+\.\d+M$))?(([-+]?\d+W)|([-+]?\d+\.\d+W$))?(([-+]?\d+D)|([-+]?\d+\.\d+D$))?(T(?=[\d+-])(([-+]?\d+H)|([-+]?\d+\.\d+H$))?(([-+]?\d+M)|([-+]?\d+\.\d+M$))?([-+]?\d+(\.\d+)?S)?)??$/
);
export const isISODuration = (duration : string) : boolean => isoRegex.test(duration.trim());

/**
 * checks if the argument complies to a DVB locator according to clause 6.4.2 of ETSI TS 102 851
 * i.e. dvb://<original_network_id>..<service_id> ;<event_id>
 *
 * @param {String} locator string contining the DVB locator
 * @returns {boolean}  true if @locator is formatted as a DVB locator
 */
const locatorRegex = new RegExp(`^dvb://[${e_digit}${e_hexChar}]+.[${e_digit}${e_hexChar}]*.[${e_digit}${e_hexChar}]+;[${e_digit}${e_hexChar}]+$`);
export const isDVBLocator = (locator : string) : boolean => locatorRegex.test(locator.trim());

/**
 *
 * @param {String} postcode  the postcode value to check
 * @returns {boolean} true if @postcode is a valid postcode, otherwise false
 */
const postcodeRegex = new RegExp(`[${e_digit}${e_lowalpha}]+([- ][${e_digit}${e_lowalpha}]+)?$`, "i");
export const isPostcode = (postcode : string) : boolean => postcodeRegex.test(postcode.trim());

/**
 *
 * @param {String} postcode  the postcode value to check
 * @returns {boolean} true if @postcode is a valid wildcarded postcode (single asterix '*' in beginning, middle or end), otherwise false
 */
const WildcardFirstRegex = new RegExp(`^(\\*[${e_digit}${e_lowalpha}]*[\\- ]?[${e_digit}${e_lowalpha}]+)`, "i"),
	WildcardMiddleRegex = new RegExp(`^(([${e_digit}${e_lowalpha}]+\\*[\\- ]?[${e_digit}${e_lowalpha}]+)|([${e_digit}${e_lowalpha}]+[\\- ]?\\*[${e_digit}${e_lowalpha}]+))$`, "i"),
	WildcardEndRegex = new RegExp(`^([${e_digit}${e_lowalpha}]+[\\- ]?[${e_digit}${e_lowalpha}]*\\*)$`, "i");
export const isWildcardPostcode = (postcode : string) : boolean =>
	WildcardEndRegex.test(postcode.trim()) || WildcardMiddleRegex.test(postcode.trim()) || WildcardFirstRegex.test(postcode.trim());

/**
 * check if the argument is in the correct format for an DVB-I extension identifier
 *
 * @param {String} ext  the signalled extensionName
 * @returns {boolean} true if the signalled extensionName is in the specification defined format, else false
 */
const ExtensionRegex = new RegExp(`^[${e_digit}${e_lowalpha}][${e_digit}${e_lowalpha}:\\-/\\.]*[${e_digit}${e_lowalpha}]$`, "i");
export const validExtensionName = (ext : string) : boolean => ExtensionRegex.test(ext.trim());

/**
 * check if the argument is in the correct format for a TV-Anytime FrameRateType
 *    <pattern value="([0-9]{1,3}(.[0-9]{1,3})?)|([0-9]{1,3}/1.001)"/>
 *
 * @param {String} ratre  the signalled frameRate
 * @returns {boolean} true if the signalled frameRate is a valid TV-Anytime FrameRateType, else false
 */
const FrameRateRegex1 = new RegExp(`^[${e_digit}]{1,3}(\\.[${e_digit}]{1,3})?$`);
const FrameRateRegex2 = new RegExp(`^[${e_digit}]{1,3}\\/1\\.001$`);
export const validFrameRate = (rate : string) : boolean => FrameRateRegex1.test(rate.trim()) || FrameRateRegex2.test(rate.trim());

/**
 * checks of the specified argument matches an domain name (RFC 1034)
 *
 * @param {String} domain  The value whose format is to be checked
 * @returns {boolean} true if the argument is a domain name
 */
const DomainNameRegex = new RegExp(/^[a-z\d]+([-.]{1}[a-z\d]+)*\.[a-z]{2,5}(:[\d]{1,5})?(\/.*)?$/, "i");
export const isDomainName = (domain : string) : boolean => DomainNameRegex.test(domain.trim());

/**
 * checks of the specified argument matches an RTSP URL
 *  <restriction base="anyURI"><pattern value="rtsp://.*"/></restriction>
 *
 * @param {String} url  The value whose format is to be checked
 * @returns {boolean} true if the argument is an RTSP URL
 */
const RTSPRegex = new RegExp(/^rtsp:\/\/.*$/, "i");
export const isRTSPURL = (url : string) : boolean => isURL(url) && RTSPRegex.test(url.trim());

/**
 * check that a values conforms to the ServiceDaysList type
 *
 * @param {String} daysList  the value to check, likely from an Interval@days attribute
 * @returns {boolean} true if the value is properly formated
 */
const DaysListRegex = new RegExp(/^([1-7]\s+)*[1-7]$/); // list of values 1-7 separeted by spaces
export const validServiceDaysList = (daysList : string) : boolean => DaysListRegex.test(daysList.trim());

/**
 * check that a values conforms to the ZuluTimeType type
 *
 * @param {String} time the value to check, likely from an Interval@startTime or @endTime attributes
 * @returns {boolean} true if @time is properly formated
 */
const ZuluRegex = new RegExp(/^(([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?)Z$/);
export const validZuluTimeType = (time : string) : boolean => ZuluRegex.test(time.trim());

/**
 * checks that the supplied argument conforms to the pattern for a TVA LanguageType
 * @param {String} languageCode  the language code to check
 * @param {boolean} caseSensitive  if false, then allow upper and lower case characters (default is true)
 * @returns {boolean}  true if @languageCode matches the specified format for a TV Anytime language (i.e. XML languge)
 */
const languageFormat = `^[${e_lowalpha}]{1,8}(-[${e_lowalpha}${e_digit}]{1,8})*$`;
export function isTVAAudioLanguageType(languageCode : string, caseSensitive : boolean = true) : boolean {
	const languageRegex = new RegExp(languageFormat, caseSensitive ? "" : "i");
	return languageRegex.test(languageCode);
}

/**
 * checks if the supplied string only contains ASCII values
 * @param {String} ascii_str   the string to check
 * @returns {boolean} true of @ascii_str is a string any contains only ASCII characters, otherwise false
 */
const ASCIIregexp = new RegExp(`^[${ASCII_chars}]*$`);
export const isASCII = (ascii_str : string) : boolean => ASCIIregexp.test(ascii_str);

/**
 * determine if the passed value conforms to am IETF RFC4151 TAG URI
 *
 * @param {String} identifier  The service identifier to be checked
 * @return {boolean} true if the service identifier is in RFC4151 TAG URI format
 */
// RFC 4151 compliant - https://tools.ietf.org/html/rfc4151
// tagURI = "tag:" taggingEntity ":" specific [ "#" fragment ]
const TagRegex = new RegExp(
//	/^tag:(([\da-z\-._]+@)?[\da-z][\da-z-]*[\da-z]*(\.[\da-z][\da-z-]*[\da-z]*)*),\d{4}(-\d{2}(\-\d{2})?)?:(['\da-z-._~!$&()*+,;=:@?/]|%[0-9a-f]{2})*(#(['a-z0-9\-._~!$&()*+,;=:@\\?/]|%[0-9a-f]{2})*)?$/,
	/^tag:(([\da-z\-._]+@)?[\da-z][\da-z-]*[\da-z]*(\.[\da-z][\da-z-]*[\da-z]*)*),\d{4}(-\d{2}(-\d{2})?)?:(['\da-z-._~!$&()*+,;=:@?/]|%[0-9a-f]{2})*(#(['a-z0-9\-._~!$&()*+,;=:@\\?/]|%[0-9a-f]{2})*)?$/,
	"i"
);

// RFC 4151 clause 2.1 tagURI = "tag:" taggingEntity ":" specific [ "#" fragment ]
export const isTAGURI = (identifier : string) : boolean => TagRegex.test(identifier.trim());

/**
 * check if the argument complies to a CRID format
 *
 * @param {String} value  value whose format to check
 * @returns	{boolean} true if the argument confirms to the CRID format, else false
 **/
const CRIDRegex = new RegExp("crid://(.*)/(.*)", "i");
export const isCRIDURI = (value : string) : boolean => CRIDRegex.test(value.trim());

/**
 * check if the argument only contains printable ascii characters ("space" --> "tilda")
 * @param {String} value  value whose format to check
 * @returns {boolean} true if the value only contains ASCII characters, else false
 */
const ASCIIPrint = new RegExp("/^[ -~]+$/");
export const hasNonPrintableChars = (value : string) : boolean => !ASCIIPrint.test(value);

/**
 * check if the argument contains a UUID value in the hyphenated format of IETF RFC 4122 (https://datatracker.ietf.org/doc/html/rfc4122#section-3)
 * @param {String} value  value whose format to check
 * @returns {boolean} true if the value contains a formatted UUID, else false
 */
const UUIDRegex = new RegExp(`^[${e_hex}]{8}-[${e_hex}]{4}-[${e_hex}]{4}-[${e_hex}]{4}-[${e_hex}]{12}$`, "i");
export const isUUIDformat = (value : string) : boolean => UUIDRegex.test(value);