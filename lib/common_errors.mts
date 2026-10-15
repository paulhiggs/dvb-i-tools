/**
 * common_errors.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * error templates used by different validatirs
 */

import { tva } from "./TVA_definitions.mts"
import { dvbi } from "./DVB-I_definitions.mts"
import { WARNING } from "./error_list.mts"
import type { ReportedErrorType } from "./error_list.mts"

class _keys {
	k_InvalidHRef: string = "invalid href"
	k_InvalidValue: string = "invalid value"
	k_InvalidTag: string = "invalid tag"
	k_LengthError: string = "length error"
	k_DuplicatedSynopsisLength: string = "duplicated synopsis length"
	k_DuplicateValue: string = "duplicated value"
	k_MissingSynopsisLength: string = "missing synopsis length"
	k_InvalidKeywordType: string = "invalid keyword type"
	k_ParentalGuidance: string = "parental guidance"
	k_InvalidElement: string = "invalid element"
	k_MissingElement: string = "missing element"
	k_InvalidURL: string = "invalid URL"
	k_UnspecifiedLanguage: string = "unspecified language"
	k_InvalidLanguage: string = "invalid language"
	k_InvalidRegion: string = "invalid region"
	k_InvalidCountryCode: string = "invalid country code"
	k_XSDValidation: string = "XSD validation"
	k_InvalidIdentifier: string = "invalid identifier"
	k_Accessibility: string = "accessibility attributes"
	k_CMCD: string = "CMCD"
	k_Extensibility: string = "extensibility"
	k_MalformedXML: string = "malformed XML"
	k_DeprecatedElement: string = "deprecated"
	k_DeprecatedAttribute: string = "deprecated"
	k_SignaturePolicies: string = "signature policies"
	k_InvalidDigest: string = "incorrect digest"
	k_Icecast: string = "icecast"
	k_Traversal: string = "Traversal issue"
};
export const keys = new _keys()

/**
 * Add an error message when the a required element is not present
 *
 * @param {string}      missingElement  Name of the missing element
 * @param {XmlElement}  parentElement   The element which should contain the missingElement
 * @param {string}      schemaLocation  The location in the schema of the element
 * @param {string}      errCode         The error number to show in the log
 */
export const NoChildElement = (missingElement: string, parentElement: XmlElement, schemaLocation: string | undefined, errCode: string) : ReportedErrorType => ({
	code: errCode,
	message: `${missingElement} element not specified for ${parentElement.name.elementize()}${schemaLocation ? ` in ${schemaLocation}` : ""}`,
	line: parentElement.line,
	key: keys.k_MissingElement,
});

/**
 * Error message when the @href contains an invalid value
 *
 * @param {string}     value     The invalid value for the href attribute
 * @param {XmlElement} element   The element containing the @href attribute
 * @param {string}     loc       The location of the element
 * @param {string}     errCode   The error number to show in the log
 * @returns {ReportedErrorType} an error object to be passed to the logging function
 */
export const cg_InvalidHrefValue = (value: string, element: XmlElement, loc: string, errCode: string) : ReportedErrorType => ({
	code: errCode,
	message: `invalid ${tva.a_href.attribute()}=${value.quote()} specified for ${element.name.elementize()} in ${loc}`,
	line: element.line,
	key: keys.k_InvalidHRef,
});

export const sl_InvalidHrefValue = (value: string, element: XmlElement, src: string, loc: string, errCode: string) : ReportedErrorType => ({
	code: errCode,
	fragment: element,
	message: `invalid ${dvbi.a_href.attribute()}=${value.quote()} specified for ${src} in ${loc}`,
	key: keys.k_InvalidHRef,
});

export const InvalidURL = (value: string, element: XmlElement, src: string, errCode: string) : ReportedErrorType => ({
	code: errCode,
	fragment: element,
	message: `invalid URL ${value.quote()} value specified for ${src}`,
	key: keys.k_InvalidURL,
});

/**
 * standard message for deprecated element
 * 
 * @param {XmlElement} what  the element that is deprecated
 * @param {string} since     the specification revision when the element was deprecated
 * @param {string} errCode   the error code for the error
 * @returns {ReportedErrorType} an error object to be passed to the logging function
 */
export const DeprecatedElement = (what: XmlElement, since: string, errCode: string) : ReportedErrorType => ({
	type: WARNING,
	code: errCode,
	fragment: what,
	message: `Element ${what.name.elementize()} in ${what.parent?.name.elementize()} is deprecated since ${since}`,
	key: keys.k_DeprecatedElement,
});

/**
 * standard message for deprecated attributes
 * 
 * @param {XmlAttribute} what  the attribute that is deprecated
 * @param {string} since       the specification revision when the attribute was deprecated
 * @param {string} errCode     the error code for the error
 * @returns {ReportedErrorType} an error object to be passed to the logging function
 */
export const DeprecatedAttribute = (what: XmlAttribute, since: string, errCode: string) : ReportedErrorType => ({
	type: WARNING,
	code: errCode,
	fragment: what.parent as XmlElement,
	message: `Attribute ${what.name.attribute(what.parent?.name)} is deprecated since ${since}`,
	key: keys.k_DeprecatedAttribute,
});

/**
 * Add an error message an incorrect country code is specified in transmission parameters
 *
 * @param {string} value    The invalid country code
 * @param {string} src      The transmission mechanism
 * @param {string} loc      The location of the element
 * @returns {string} error message for a invalid country code
 */
export const InvalidCountryCode = (value: string, src: string | null, loc: string) : string => 
	`invalid country code ${value.quote()} ${src ? `for ${src} parameters ` : ""}in ${loc}`;
