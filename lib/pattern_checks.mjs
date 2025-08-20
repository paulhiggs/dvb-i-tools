/**
 * pattern_checks.mjs
 *
 * useful regular expression based checks
 */
import { datatypeIs } from "../phlib/phlib.js";

const e_pct = "%", //e_pct="&#x25;",
	e_quot = "&#x22;",
	e_lowalpha = "a-z",
	e_highalpha = "A-Z",
	e_hexChar = "a-fA-F",
	e_alpha = `${e_lowalpha}${e_highalpha}`,
	e_digit = "0-9",
	e_safe = "$-_.+",
	e_extra = `!*(),${e_quot}`,
	e_hex = `${e_digit}${e_hexChar}`,
	e_unreserved = `${e_alpha}${e_digit}${e_safe}${e_extra}`,
	e_hex16 = `[${e_hex}]{1,4}`,
	e_chrs = `${e_unreserved}${e_pct}&amp;~;=:@`,
	e_uword = `(:([${e_digit}]{1,4}|[1-5][${e_digit}]{4}|6[0-4][${e_digit}]{3}|65[0-4][${e_digit}]{2}|655[0-2][${e_digit}]|6553[0-5]))`,
	e_Scheme = `[${e_alpha}][${e_alpha}${e_digit}+-.]*`,
	e_User = `([${e_unreserved}${e_pct}&amp;~;=]+)`,
	e_Password = `([${e_unreserved}${e_pct}&amp;~;=]+)`,
	e_NamedHost = `[${e_alpha}${e_digit}${e_pct}._~-]+`,
	e_DecimalByte = `(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[${e_digit}])`;

const ASCII_chars = `!"#$%&'()*+,\-./${e_digit}:;<=>?@${e_highalpha}[\\]^_${e_lowalpha}{|}~`;

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
	e_IPv6Host = `\\[${e_IPv6Address}\]`;

const e_IPvFutureHost = `\\[v[a-f${e_digit}][${e_unreserved}${e_pct}&amp;~;=:]+\]`,
	e_Port = `${e_uword}`,
	e_Path = `(/[${e_chrs}]+)`,
	e_AuthorityAndPath = `(${e_User}(:${e_Password})?@)?(${e_NamedHost}|${e_IPv6Host}|${e_IPvFutureHost})${e_Port}?${e_Path}*/?`,
	e_PathNoAuthority = `(/?[${e_chrs}]+${e_Path}*/?)`,
	e_RelativePath = `[${e_chrs}]+${e_Path}*`,
	e_AbsolutePath = `${e_Path}+`,
	e_Query = `(\\?[${e_chrs}/?]*)`,
	e_Fragment = `(#[${e_chrs}/?]*)`,
	e_NamespaceID = `[${e_alpha}${e_digit}][${e_alpha}${e_digit}-]{1,31}`,
	e_NSSothers = `()+,\-\.:=@;$_!*'`,
	e_NSSreserved = `${e_pct}/?#`,
	e_NamespaceSpecific = `[${e_alpha}${e_digit}${e_NSSothers}${e_NSSreserved}]+`,
	e_URN = `urn:${e_NamespaceID}:${e_NamespaceSpecific}`,
	e_URL = `(${e_Scheme}:(//${e_AuthorityAndPath}|${e_PathNoAuthority})|(${e_RelativePath}/?|${e_AbsolutePath}/?))${e_Query}?${e_Fragment}?`;

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
export let isRatioType = (ratio) => (datatypeIs(ratio, "string") ? ratioRegex.test(ratio.trim()) : false);

/**
 * checks if the argument complies to an XML representation of UTC time
 *
 * @param {String} time string contining the UTC time
 * @returns {boolean}  true if the argment is formatted according to UTC ("Zulu") time
 */
const UTCregex = new RegExp(/^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\.[0-9]{1,3})?Z?$/);
export let isUTCDateTime = (time) => (datatypeIs(time, "string") ? UTCregex.test(time.trim()) : false);

/**
 * checks of the specified argument matches an HTTP(s) URL where the protocol is required to be provided
 *
 * @param {String} url  The value whose format is to be checked
 * @returns {boolean} true if the argument is an HTTP URL
 *
 * see RFC 3986 - https://tools.ietf.org/html/rfc3986
 */
//const HTTPURLregex = new RegExp(`^https?:(//${e_AuthorityAndPath}|${e_PathNoAuthority})${e_Query}?${e_Fragment}?$`, "i");
//let isHTTPURL = (url) => (datatypeIs(url, "string") ? HTTPURLregex.test(url.trim()) : false);
export function isHTTPURL(url) {
	try {
		const sss = new URL(url);
		return true;
	} catch (err) {
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
//const HTTPPathURLregex = new RegExp(`^https?:(//${e_AuthorityAndPath}|${e_PathNoAuthority})$`, "i");
//export let isHTTPPathURL = (path) => (datatypeIs(path, "string") ? HTTPPathURLregex.test(path.trim()) : false);
export function isHTTPPathURL(url) {
	try {
		const sss = new URL(url);
		return sss.pathname.endsWith("/");
	} catch (err) {
		return false;
	}
}

/**
 * isURL and isURN use the syntax from MPEG DASH - http://github.com/MPEGGroup/DASHSchema/
 * @param {*} urn | url
 */
const URNregex = new RegExp(`^${e_URN}$`, "i"),
	URLregex = new RegExp(`^${e_URL}$`, "i");
export let isURL = (url) => (datatypeIs(url, "string") ? URLregex.test(url) : false);
export let isURN = (urn) => (datatypeIs(urn, "string") ? URNregex.test(urn) : false);

/**
 * checks of the specified argument matches URL according to RFC 3986 - https://tools.ietf.org/html/rfc3986
 *
 * @param {String} uri  The value whose format is to be checked
 * @returns {boolean} true if @uri is an HTTP URL
 */
export let isURI = (uri) => isURL(uri) || isURN(uri);

/**
 * Checks the URI conforms to RFC 2397.
 * dataurl := "data:" [ mediatype ] [ ";base64" ] "," data mediatype := [ type "/" subtype ] *( ";" parameter ) data := *urlchar parameter := attribute "=" value
 *
 * @param {String} uri  the value to be checked
 * @returns {boolean}  true if @uri is a string and mateches teh format of a data: URI, otherwise false
 * Thanks to https://gist.github.com/khanzadimahdi/bab8a3416bdb764b9eda5b38b35735b8
 */
const dataRegexp = new RegExp(`^data:((?:\w+\/(?:(?!;).)+)?)((?:;[\w\W]*?[^;])*),(.+)$`, "i");
export let isDataURI = (uri) => (datatypeIs(uri, "string") ? dataRegexp.test(uri) : false);

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
export let isISODuration = (duration) => (datatypeIs(duration, "string") ? isoRegex.test(duration.trim()) : false);

/**
 * checks if the argument complies to a DVB locator according to clause 6.4.2 of ETSI TS 102 851
 * i.e. dvb://<original_network_id>..<service_id> ;<event_id>
 *
 * @param {String} locator string contining the DVB locator
 * @returns {boolean}  true if @locator is formatted as a DVB locator
 */
const locatorRegex = new RegExp(`^dvb://[${e_digit}${e_hexChar}]+.[${e_digit}${e_hexChar}]*.[${e_digit}${e_hexChar}]+;[${e_digit}${e_hexChar}]+$`);
export let isDVBLocator = (locator) => (datatypeIs(locator, "string") ? locatorRegex.test(locator.trim()) : false);

/**
 *
 * @param {String} postcode  the postcode value to check
 * @returns {boolean} true if @postcode is a valid postcode, otherwise false
 */
const postcodeRegex = new RegExp(`[${e_digit}${e_lowalpha}]+([- ][${e_digit}${e_lowalpha}]+)?$`, "i");
export let isPostcode = (postcode) => (datatypeIs(postcode, "string") ? postcodeRegex.test(postcode.trim()) : false);

/**
 *
 * @param {String} postcode  the postcode value to check
 * @returns {boolean} true if @postcode is a valid wildcarded postcode (single asterix '*' in beginning, middle or end), otherwise false
 */
const WildcardFirstRegex = new RegExp(`^(\\*[${e_digit}${e_lowalpha}]*[\\- ]?[${e_digit}${e_lowalpha}]+)`, "i"),
	WildcardMiddleRegex = new RegExp(`^(([${e_digit}${e_lowalpha}]+\\*[\\- ]?[${e_digit}${e_lowalpha}]+)|([${e_digit}${e_lowalpha}]+[\\- ]?\\*[${e_digit}${e_lowalpha}]+))$`, "i"),
	WildcardEndRegex = new RegExp(`^([${e_digit}${e_lowalpha}]+[\\- ]?[${e_digit}${e_lowalpha}]*\\*)$`, "i");
export let isWildcardPostcode = (postcode) =>
	datatypeIs(postcode, "string") ? WildcardEndRegex.test(postcode.trim()) || WildcardMiddleRegex.test(postcode.trim()) || WildcardFirstRegex.test(postcode.trim()) : false;

/**
 * check if the argument is in the correct format for an DVB-I extension identifier
 *
 * @param {String} ext  the signalled extensionName
 * @returns {boolean} true if the signalled extensionName is in the specification defined format, else false
 */
const ExtensionRegex = new RegExp(`^[${e_digit}${e_lowalpha}][${e_digit}${e_lowalpha}:\\-/\\.]*[${e_digit}${e_lowalpha}]$`, "i");
export let validExtensionName = (ext) => (datatypeIs(ext, "string") ? ExtensionRegex.test(ext.trim()) : false);

/**
 * check if the argument is in the correct format for a TV-Anytime FrameRateType
 *    <pattern value="([0-9]{1,3}(.[0-9]{1,3})?)|([0-9]{1,3}/1.001)"/>
 *
 * @param {String} ratre  the signalled frameRate
 * @returns {boolean} true if the signalled frameRate is a valid TV-Anytime FrameRateType, else false
 */
const FrameRateRegex1 = new RegExp(`^[${e_digit}]{1,3}(\\.[${e_digit}]{1,3})?$`);
const FrameRateRegex2 = new RegExp(`^[${e_digit}]{1,3}\\/1\\.001$`);
export let validFrameRate = (rate) => (datatypeIs(rate, "string") ? FrameRateRegex1.test(rate.trim()) || FrameRateRegex2.test(rate.trim()) : false);

/**
 * checks of the specified argument matches an domain name (RFC 1034)
 *
 * @param {String} domain  The value whose format is to be checked
 * @returns {boolean} true if the argument is a domain name
 */
const DomainNameRegex = new RegExp(/^[a-z\d]+([\-\.]{1}[a-z\d]+)*\.[a-z]{2,5}(:[\d]{1,5})?(\/.*)?$/, "i");
export let isDomainName = (domain) => (datatypeIs(domain, "string") ? DomainNameRegex.test(domain.trim()) : false);

/**
 * checks of the specified argument matches an RTSP URL
 *  <restriction base="anyURI"><pattern value="rtsp://.*"/></restriction>
 *
 * @param {String} url  The value whose format is to be checked
 * @returns {boolean} true if the argument is an RTSP URL
 */
const RTSPRegex = new RegExp(/^rtsp:\/\/.*$/, "i");
export let isRTSPURL = (url) => (datatypeIs(url, "string") ? isURL(url) && RTSPRegex.test(url.trim()) : false);

/**
 * check that a values conforms to the ServiceDaysList type
 *
 * @param {String} daysList  the value to check, likely from an Interval@days attribute
 * @returns {boolean} true if the value is properly formated
 */
const DaysListRegex = new RegExp(/^([1-7]\s+)*[1-7]$/); // list of values 1-7 separeted by spaces
export let validServiceDaysList = (daysList) => (datatypeIs(daysList, "string") ? DaysListRegex.test(daysList.trim()) : false);

/**
 * check that a values conforms to the ZuluTimeType type
 *
 * @param {String} time the value to check, likely from an Interval@startTime or @endTime attributes
 * @returns {boolean} true if @time is properly formated
 */
const ZuluRegex = new RegExp(/^(([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?)Z$/);
export let validZuluTimeType = (time) => (datatypeIs(time, "string") ? ZuluRegex.test(time.trim()) : false);

/**
 * checks that the supplied argument conforms to the pattern for a TVA LanguageType
 * @param {String} languageCode  the language code to check
 * @param {boolean} caseSensitive  if false, then allow upper and lower case characters (default is true)
 * @returns {boolean}  true if @languageCode matches the specified format for a TV Anytime language (i.e. XML languge)
 */
const languageFormat = `^[${e_lowalpha}]{1,8}(-[${e_lowalpha}${e_digit}]{1,8})*$`;
export function isTVAAudioLanguageType(languageCode, caseSensitive = true) {
	const languageRegex = new RegExp(languageFormat, caseSensitive ? "" : "i");
	return datatypeIs(languageCode, "string") ? languageRegex.test(languageCode) : false;
}

/**
 * checks if the supplied string only contains ASCII values
 * @param {String} ascii_str   the string to check
 * @returns {boolean} true of @ascii_str is a string any contains only ASCII characters, otherwise false
 */
const ASCIIregexp = new RegExp(`^[${ASCII_chars}]*$`);
export let isASCII = (ascii_str) => (datatypeIs(ascii_str, "string") ? ASCIIregexp.test(ascii_str) : false);
