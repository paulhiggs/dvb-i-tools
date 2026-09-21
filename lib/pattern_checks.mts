/**
 * pattern_checks.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * useful regular expression based checks
 */

import { datatypeIs } from "./utils.mts";
import { allowedImageTypes } from "./MIME_checks.mts";

const e_pct: string = "%", 
	e_lowalpha: string = "a-z",
	e_highalpha: string = "A-Z",
	e_hexChar: string = "a-fA-F",
	e_alpha: string = `${e_lowalpha}${e_highalpha}`,
	e_digit: string = "0-9",
	e_hex: string = `${e_digit}${e_hexChar}`,
	e_hex16: string = `[${e_hex}]{1,4}`,
	e_DecimalByte: string = `(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[${e_digit}])`;

const ASCII_chars: string = ` !"#$%&'()*+,-./${e_digit}:;<=>?@${e_highalpha}[\\]^_${e_lowalpha}{|}~`;

export const e_IPv4Address: string = `${e_DecimalByte}(\\.${e_DecimalByte}){3}`;

const e_v6_8words: string = `(${e_hex16}:){7,7}${e_hex16}`, // TEST: 1:2:3:4:5:6:7:8
	e_v6_7words: string = `(${e_hex16}:){1,7}:`, // TEST: 1::                              1:2:3:4:5:6:7::
	e_v6_6words: string = `(${e_hex16}:){1,6}:${e_hex16}`, // TEST: 1::8             1:2:3:4:5:6::8  1:2:3:4:5:6::8
	e_v6_5words: string = `(${e_hex16}:){1,5}(:${e_hex16}){1,2}`, // TEST: 1::7:8           1:2:3:4:5::7:8  1:2:3:4:5::8
	e_v6_4words: string = `(${e_hex16}:){1,4}(:${e_hex16}){1,3}`, // TEST: 1::6:7:8         1:2:3:4::6:7:8  1:2:3:4::8
	e_v6_3words: string = `(${e_hex16}:){1,3}(:${e_hex16}){1,4}`, // TEST: 1::5:6:7:8       1:2:3::5:6:7:8  1:2:3::8
	e_v6_2words: string = `(${e_hex16}:){1,2}(:${e_hex16}){1,5}`, // TEST: 1::4:5:6:7:8     1:2::4:5:6:7:8  1:2::8
	e_v6_1word: string = `${e_hex16}:((:${e_hex16}){1,6})`, // TEST: 1::3:4:5:6:7:
	e_v6_nowords: string = `:((:${e_hex16}){1,7}|:)`, // TEST:
	e_v6_linklocal: string = `fe08:(:${e_hex16}){0,4}%[${e_alpha}${e_digit}]{1,}`, // TEST:
	e_v6_v4mapped: string = `::(ffff(0{1,4}){0,1}:){0,1}${e_IPv4Address}|(${e_hex16}:){1,4}:${e_IPv4Address}`, // TEST:
	e_v6_v4embed: string = `(${e_hex16}:){1,4}:${e_IPv4Address}`; // TEST:

export const e_IPv6Address: string = `(${e_v6_8words}|${e_v6_7words}|${e_v6_6words}|${e_v6_5words}|${e_v6_4words}|${e_v6_3words}|${e_v6_2words}|${e_v6_1word}|${e_v6_nowords}|${e_v6_linklocal}|${e_v6_v4mapped}|${e_v6_v4embed})`,
	e_IPv6Host: string = `\\[${e_IPv6Address}]`;

const e_NamespaceID: string = `[${e_alpha}${e_digit}][${e_alpha}${e_digit}-]{1,31}`,
//	e_NSSothers: string = `()+,\-\.:=@;$_!*'`,
	e_NSSothers: string = `()+,-.:=@;$_!*'`,
	e_NSSreserved: string = `${e_pct}/?#`,
	e_NamespaceSpecific: string = `[${e_alpha}${e_digit}${e_NSSothers}${e_NSSreserved}]+`,
	e_URN: string = `urn:${e_NamespaceID}:${e_NamespaceSpecific}`;


// from BCP47 - https://www.rfc-editor.org/rfc/bcp/bcp47.txt
const l_alphanum: string = `${e_alpha}${e_digit}`;
const regular: string = "(art-lojban|cel-gaulish|no-bok|no-nyn|zh-guoyu|zh-hakka|zh-min|zh-min-nan|zh-xiang)";
const irregular: string = "(en-GB-oed|i-ami|i-bnn|i-default|i-enochian|i-hak|i-klingon|i-lux|i-mingo|i-navajo|i-pwn|i-tao|i-tay|i-tsu|sgn-BE-FR|sgn-BE-NL|sgn-CH-DE)";
const grandfathered: string = `(?<grandfathered>${irregular}|${regular})`;
const privateUse_unlabelled: string = `x(-[${l_alphanum}]{1,8})+)`;
const privateUse1: string = `(?<privateUse1>${privateUse_unlabelled}`;
const privateUse2: string = `(?<privateUse2>${privateUse_unlabelled}`;
const singleton: string = `[${e_digit}A-WY-Za-wy-z]`;
const extension: string = `(?<extension>${singleton}(-[${l_alphanum}]{2,8})+)`;
const variant: string = `(?<variant>[${e_alpha}]{5,8}|[${e_digit}][${l_alphanum}]{3})`;
const region: string = `(?<region>[${e_highalpha}]{2}|[${e_digit}]{3})`;
const script: string = `(?<script>[${e_highalpha}][${e_lowalpha}]{3})`;
const extlang: string = `(?<extlang>[${e_alpha}]{3}(-[${e_alpha}]{3}){0,2})`;
const language: string = `(?<language>([${e_lowalpha}]{2,3}(-${extlang})?)|[${e_alpha}]{4}|[${e_alpha}]{5,8})`;
const langtag: string = `(${language}(-${script})?(-${region})?(-${variant})*(-${extension})*(-${privateUse2})?)`;
const languageTag: string = `^(${grandfathered}|${langtag}|${privateUse1})$`;

export const BCP47_Language_Tag: string = languageTag;

/**
 * checks if the argument complies to the TV Anytime defintion of RatioType
 *
 * @param {String} ratio string contining value to check
 * @returns {boolean} true if the argment is compliant to a tva:RatioType
 */
const ratioRegex: RegExp = new RegExp(`^[${e_digit}]+:[${e_digit}]+$`);
export const isRatioType = (ratio: string): boolean => (datatypeIs(ratio, "string") ? ratioRegex.test(ratio.trim()) : false);

/**
 * checks if the argument complies to an XML representation of UTC time
 *
 * @param {String} time string contining the UTC time
 * @returns {boolean}  true if the argment is formatted according to UTC ("Zulu") time
 */
const UTCregex: RegExp = new RegExp(/^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\.[0-9]{1,3})?Z?$/);
export const isUTCDateTime = (time: string): boolean => (datatypeIs(time, "string") ? UTCregex.test(time.trim()) : false);


export function isInlineImage(data: string): boolean {
	let valid: boolean	 = false;
	allowedImageTypes.forEach((image_MIME) => {
		valid = valid || data.startsWith(`data:${image_MIME};base64,`);
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
const HTTPprotocolRegex: RegExp = new RegExp("^https?:$", "i");
const HTTPprotocolPrefix: RegExp = new RegExp("^https?://", "i");
export function isHTTPURL(url: string): boolean {
	url = decodeURIComponent(url);
	if (!HTTPprotocolPrefix.test(url)) return false;
	try {
		const sss = new URL(url);
		return HTTPprotocolRegex.test(sss.protocol);
	} catch (/* eslint-disable @typescript-eslint/no-unused-vars */ err /* eslint-enable @typescript-eslint/no-unused-vars */) {
		return false;
	}
}

/**
 * checks of the specified argument matches an HTTP(s) URL where the protocol is required to be provided
 *
 * @param {String} url  The value whose format is to be checked
 * @returns {boolean} true if the argument is an HTTP URL
 *
 * see RFC 3986 - https://tools.ietf.org/html/rfc3986
 */
const HTTPSprotocolRegex: RegExp = new RegExp("^https:$", "i");
const HTTPSprotocolPrefix: RegExp = new RegExp("^https://", "i");
export function isHTTSPURL(url: string): boolean {
	url = decodeURIComponent(url);
	if (!HTTPSprotocolPrefix.test(url)) return false;
	try {
		const sss = new URL(url);
		return HTTPSprotocolRegex.test(sss.protocol);
	} 
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	catch (err) {
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
export function isHTTPPathURL(url: string): boolean {
	if (!HTTPprotocolPrefix.test(url)) return false;
	try {
		const sss = new URL(url);
		return url.endsWith("/") && HTTPprotocolRegex.test(sss.protocol);
	} catch (/* eslint-disable @typescript-eslint/no-unused-vars */ err /* eslint-enable @typescript-eslint/no-unused-vars */) {
		return false;
	}
}

/**
 * isURL and isURN use the syntax from MPEG DASH - http://github.com/MPEGGroup/DASHSchema/
 * @param {*} urn | url
 */
const URNregex: RegExp = new RegExp(`^${e_URN}$`, "i");
export const isURL = (url: string) : boolean => {
	if (!datatypeIs(url, "string")) return false;
	if (url.includes(" ")) return false;
	try {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const sss = new URL(url);
		return true;
	} catch (/* eslint-disable @typescript-eslint/no-unused-vars */ err /* eslint-enable @typescript-eslint/no-unused-vars */) {
		return false;
	}
	};
export const isURN = (urn: string): boolean => (datatypeIs(urn, "string") ? URNregex.test(urn) : false);

/**
 * checks of the specified argument matches URL according to RFC 3986 - https://tools.ietf.org/html/rfc3986
 *
 * @param {String} uri  The value whose format is to be checked
 * @returns {boolean} true if @uri is an HTTP URL
 */
export const isURI = (uri: string): boolean => isURL(uri) || isURN(uri);

/**
 * Checks the URI conforms to RFC 2397.
 * dataurl := "data:" [ mediatype ] [ ";base64" ] "," data 
 *   mediatype := [ type "/" subtype ] *( ";" parameter ) 
 *   data := *urlchar 
 *   parameter := attribute "=" value
 *
 * @param {String} uri  the value to be checked
 * @returns {boolean}  true if @uri is a string and mateches teh format of a data: URI, otherwise false
 * Thanks to https://gist.github.com/khanzadimahdi/bab8a3416bdb764b9eda5b38b35735b8
 */
const dataRegexp: RegExp = new RegExp(/^data:((?:\w+\/(?:(?!;).)+)?)((?:;[\w=]*[^;])*),(.+)$/, "i");
export const isDataURI = (uri: string): boolean => (datatypeIs(uri, "string") ? dataRegexp.test(uri) : false);

/**
 * checks if the argument complies to an XML representation of UTC time (i.e. ISO 8601-2:2019)
 *
 * @param {String} duration string contining the UTC time
 * @returns {boolean}  true if @duration is formatted according to UTC ("Zulu") time
 */
// based on https://stackoverflow.com/questions/32044846/regex-for-iso-8601-durations
const isoRegex: RegExp = new RegExp(
	/^[-+]?P(?!$)(([-+]?\d+Y)|([-+]?\d+\.\d+Y$))?(([-+]?\d+M)|([-+]?\d+\.\d+M$))?(([-+]?\d+W)|([-+]?\d+\.\d+W$))?(([-+]?\d+D)|([-+]?\d+\.\d+D$))?(T(?=[\d+-])(([-+]?\d+H)|([-+]?\d+\.\d+H$))?(([-+]?\d+M)|([-+]?\d+\.\d+M$))?([-+]?\d+(\.\d+)?S)?)??$/
);
export const isISODuration = (duration: string): boolean => (datatypeIs(duration, "string") ? isoRegex.test(duration.trim()) : false);

/**
 * checks if the argument complies to a DVB locator according to clause 6.4.2 of ETSI TS 102 851
 * i.e. dvb://<original_network_id>..<service_id> ;<event_id>
 *
 * @param {String} locator string contining the DVB locator
 * @returns {boolean}  true if @locator is formatted as a DVB locator
 */
const locatorRegex: RegExp = new RegExp(`^dvb://[${e_hex}]+.[${e_hex}]*.[${e_hex}]+;[${e_hex}]+$`);
export const isDVBLocator = (locator: string): boolean => (datatypeIs(locator, "string") ? locatorRegex.test(locator.trim()) : false);

/**
 *
 * @param {String} postcode  the postcode value to check
 * @returns {boolean} true if @postcode is a valid postcode, otherwise false
 */
const postcodeRegex: RegExp = new RegExp(`^[${e_digit}${e_lowalpha}]+([- ][${e_digit}${e_lowalpha}]+)?$`, "i");
export const isPostcode = (postcode: string): boolean => (datatypeIs(postcode, "string") ? postcodeRegex.test(postcode.trim()) : false);

/**
 *
 * @param {String} postcode  the postcode value to check
 * @returns {boolean} true if @postcode is a valid wildcarded postcode (single asterix '*' in beginning, middle or end), otherwise false
 */
const WildcardFirstRegex: RegExp = new RegExp(`^(\\*[${e_digit}${e_lowalpha}]*[\\- ]?[${e_digit}${e_lowalpha}]+)`, "i"),
	WildcardMiddleRegex: RegExp = new RegExp(`^(([${e_digit}${e_lowalpha}]+\\*[\\- ]?[${e_digit}${e_lowalpha}]+)|([${e_digit}${e_lowalpha}]+[\\- ]?\\*[${e_digit}${e_lowalpha}]+))$`, "i"),
	WildcardEndRegex: RegExp = new RegExp(`^([${e_digit}${e_lowalpha}]+[\\- ]?[${e_digit}${e_lowalpha}]*\\*)$`, "i");
export const isWildcardPostcode = (postcode: string): boolean =>
	datatypeIs(postcode, "string") ? WildcardEndRegex.test(postcode.trim()) || WildcardMiddleRegex.test(postcode.trim()) || WildcardFirstRegex.test(postcode.trim()) : false;

/**
 * check if the argument is in the correct format for an DVB-I extension identifier
 *
 * @param {String} ext  the signalled extensionName
 * @returns {boolean} true if the signalled extensionName is in the specification defined format, else false
 */
const ExtensionRegex: RegExp = new RegExp(`^[${e_digit}${e_lowalpha}][${e_digit}${e_lowalpha}:\\-/\\.]*[${e_digit}${e_lowalpha}]$`, "i");
export const validExtensionName = (ext: string): boolean => (datatypeIs(ext, "string") ? ExtensionRegex.test(ext.trim()) : false);

/**
 * check if the argument is in the correct format for a TV-Anytime FrameRateType
 *    <pattern value="([0-9]{1,3}(.[0-9]{1,3})?)|([0-9]{1,3}/1.001)"/>
 *
 * @param {String} ratre  the signalled frameRate
 * @returns {boolean} true if the signalled frameRate is a valid TV-Anytime FrameRateType, else false
 */
const FrameRateRegex1: RegExp = new RegExp(`^[${e_digit}]{1,3}(\\.[${e_digit}]{1,3})?$`);
const FrameRateRegex2: RegExp = new RegExp(`^[${e_digit}]{1,3}\\/1\\.001$`);
export const validFrameRate = (rate: string): boolean => (datatypeIs(rate, "string") ? FrameRateRegex1.test(rate.trim()) || FrameRateRegex2.test(rate.trim()) : false);

/**
 * checks of the specified argument matches an domain name (RFC 1034)
 *
 * @param {String} domain  The value whose format is to be checked
 * @returns {boolean} true if the argument is a domain name
 */
const DomainNameRegex: RegExp = new RegExp(/^[a-z\d]+([-.]{1}[a-z\d]+)*\.[a-z]{2,5}(:[\d]{1,5})?(\/.*)?$/, "i");
export const isDomainName = (domain: string): boolean => (datatypeIs(domain, "string") ? DomainNameRegex.test(domain.trim()) : false);

/**
 * checks of the specified argument matches an RTSP URL
 *  <restriction base="anyURI"><pattern value="rtsp://.*"/></restriction>
 *
 * @param {String} url  The value whose format is to be checked
 * @returns {boolean} true if the argument is an RTSP URL
 */
const RTSPRegex: RegExp = new RegExp(/^rtsp:\/\/.*$/, "i");
export const isRTSPURL = (url: string): boolean => (datatypeIs(url, "string") ? isURL(url) && RTSPRegex.test(url.trim()) : false);

/**
 * check that a values conforms to the ServiceDaysList type
 *
 * @param {String} daysList  the value to check, likely from an Interval@days attribute
 * @returns {boolean} true if the value is properly formated
 */
const DaysListRegex: RegExp = new RegExp(/^([1-7]\s+)*[1-7]$/); // list of values 1-7 separeted by spaces
export const validServiceDaysList = (daysList: string): boolean => (datatypeIs(daysList, "string") ? DaysListRegex.test(daysList.trim()) : false);

/**
 * check that a values conforms to the ZuluTimeType type
 *
 * @param {String} time the value to check, likely from an Interval@startTime or @endTime attributes
 * @returns {boolean} true if @time is properly formated
 */
const ZuluRegex: RegExp = new RegExp(/^(([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?)Z$/);
export const validZuluTimeType = (time: string): boolean => (datatypeIs(time, "string") ? ZuluRegex.test(time.trim()) : false);

/**
 * checks that the supplied argument conforms to the pattern for a TVA LanguageType
 * @param {String} languageCode  the language code to check
 * @returns {boolean}  true if @languageCode matches the specified format for a TV Anytime language (i.e. XML languge)
 */
const languageFormat = `^[${e_alpha}]{1,8}(-[${e_alpha}${e_digit}]{1,8})*$`;
const languageRegex: RegExp = new RegExp(languageFormat,"i");
export const  isTVAAudioLanguageType = (languageCode: string): boolean => datatypeIs(languageCode, "string") ? languageRegex.test(languageCode) : false;

/**
 * checks if the supplied string only contains ASCII values
 * @param {String} ascii_str   the string to check
 * @returns {boolean} true of @ascii_str is a string any contains only ASCII characters, otherwise false
 */
const ASCIIregexp: RegExp = new RegExp(`^[${ASCII_chars}]*$`);
export const isASCII = (ascii_str: string): boolean => (datatypeIs(ascii_str, "string") ? ASCIIregexp.test(ascii_str) : false);

/**
 * determine if the passed value conforms to am IETF RFC4151 TAG URI
 *
 * @param {String} identifier  The service identifier to be checked
 * @return {boolean} true if the service identifier is in RFC4151 TAG URI format
 */

const year: string = "([0-9]{4})", month: string = "([0-9]{2})", day: string = "([0-9]{2})";
const date: string = `${year}(-${month}(-${day})?)?`
const DNScomp: string = `[${l_alphanum}](([${l_alphanum}]|-)*[${l_alphanum}])?`
const DNSname: string = `${DNScomp}(.${DNScomp})*`
const emailAddress: string = `[${l_alphanum}-._]+@${DNSname}`
const authorityName: string = `(${DNSname}|${emailAddress})`;
const taggingEntity: string = `${authorityName},${date}`;
//const unreserved: string = `${e_alpha}0-9-._~`
const pct_encoded: string = "(%[0-9a-f]{2})"
//const sub_delims: string = "*\\+!$&',;=\\(\\)"
//const pchar: string = `${unreserved}:${sub_delims}@|${pct_encoded}`; // from RFC 3986
const specific: string = `(['a-z0-9-._~!$&()*+,;=:@?/]|${pct_encoded})*`;
const fragment: string = `(['a-z0-9-._~!$&()*+,;=:@?/]|${pct_encoded})*`;

// RFC 4151 compliant - https://tools.ietf.org/html/rfc4151
// tagURI = "tag:" taggingEntity ":" specific [ "#" fragment ]
const TagRegex: RegExp = new RegExp(
	`^tag:${taggingEntity}:${specific}(#${fragment})?$`,
  "i"
);
export const isTAGURI = (identifier: string): boolean => (datatypeIs(identifier, "string") ? TagRegex.test(identifier.trim()) : false);

/**
 * check if the argument complies to a CRID format
 *
 * @param {String} value  value whose format to check
 * @returns	{boolean} true if the argument confirms to the CRID format, else false
 **/
const CRIDRegex: RegExp = new RegExp("crid://(.*)/(.*)", "i");
export const isCRIDURI = (value: string): boolean => (datatypeIs(value, "string") ? CRIDRegex.test(value.trim()) : false);

/**
 * check if the argument only contains printable ascii characters ("space" --> "tilda")
 * @param {String} value  value whose format to check
 * @returns {boolean} true if the value only contains ASCII characters, else false
 */
const ASCIIPrint: RegExp = new RegExp(/^[ -~]*$/);
export const hasNonPrintableChars = (value: string): boolean => (datatypeIs(value, "string") ? !ASCIIPrint.test(value) : false);

//const UnicodePrint = new RegExp(/^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+$/);
//const UnicodePrint = new RegExp(/^\PC+$/);
//export const hasNonPrintableUnicodeChars = (value: string): boolean => (datatypeIs(value, "string") ? !UnicodePrint.test(value) : false);

/**
 * check if the argument contains a UUID value in the hyphenated format of IETF RFC 4122 (https://datatracker.ietf.org/doc/html/rfc4122#section-3)
 * @param {String} value  value whose format to check
 * @returns {boolean} true if the value contains a formatted UUID, else false
 */
const UUIDRegex: RegExp = new RegExp(`^[${e_hex}]{8}-[${e_hex}]{4}-[${e_hex}]{4}-[${e_hex}]{4}-[${e_hex}]{12}$`, "i");
export const isUUIDformat = (value: string): boolean => (datatypeIs(value, "string") ? UUIDRegex.test(value) : false);