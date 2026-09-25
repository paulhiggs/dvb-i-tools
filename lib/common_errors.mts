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

import {} from "./string-extensions.ts"

export const keys = {
	k_InvalidHRef: "invalid href",
	k_InvalidValue: "invalid value",
	k_InvalidTag: "invalid tag",
	k_LengthError: "length error",
	k_DuplicatedSynopsisLength: "duplicated synopsis length",
	k_DuplicateValue: "duplicated value",
	k_MissingSynopsisLength: "missing synopsis length",
	k_InvalidKeywordType: "invalid keyword type",
	k_ParentalGuidance: "parental guidance",
	k_InvalidElement: "invalid element",
	k_MissingElement: "missing element",
	k_InvalidURL: "invalid URL",
	k_UnspecifiedLanguage: "unspecified language",
	k_InvalidLanguage: "invalid language",
	k_InvalidRegion: "invalid region",
	k_InvalidCountryCode: "invalid country code",
	k_XSDValidation: "XSD validation",
	k_InvalidIdentifier: "invalid identifier",
	k_Accessibility: "accessibility attributes",
	k_CMCD: "CMCD",
	k_Extensibility: "extensibility",
	k_MalformedXML: "malformed XML",
	k_DeprecatedElement: "deprecated",
	k_DeprecatedAttribute: "deprecated",
	k_SignaturePolicies: "signature policies",
	k_InvalidDigest: "incorrect digest",
	k_Icecast: "icecast",
};

/**
 * Add an error message when the a required element is not present
 *
 * @param {string}      missingElement  Name of the missing element
 * @param {XmlElement}  parentElement   The element which should contain the missingElement
 * @param {string}      schemaLocation  The location in the schema of the element
 * @param {string}      errCode         The error number to show in the log
 */
export const NoChildElement = (missingElement: string, parentElement: XmlElement, schemaLocation: string | null, errCode: string)  : ReportedErrorType => ({
	code: errCode,
	message: `${missingElement} element not specified for ${parentElement.name.elementize()}${schemaLocation ? " in " + schemaLocation : ""}`,
	line: parentElement.line,
});

/**
 * Error message when the @href contains an invalid value
 *
 * @param {string}     value     The invalid value for the href attribute
 * @param {XmlElement} element   The element containing the @href attribute
 * @param {string}     loc       The location of the element
 * @param {string}     errCode   The error number to show in the log
 */
export const cg_InvalidHrefValue = (value: string, element: XmlElement, loc: string, errCode: string)  : ReportedErrorType => ({
	code: errCode,
	message: `invalid ${tva.a_href.attribute()}=${value.quote()} specified for ${element.name.elementize()} in ${loc}`,
	line: element.line,
	key: keys.k_InvalidHRef,
});

export const sl_InvalidHrefValue = (value: string, element: XmlElement, src: string, loc: string, errCode: string)  : ReportedErrorType=> ({
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
 * @returns {any} an error object to be passed to the logging function
 */
export const DeprecatedElement = (what: XmlElement, since: string, errCode: string) => ({
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
 * @returns {any} an error object to be passed to the logging function
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
 */
export const InvalidCountryCode = (value: string, src: string | null, loc: string): string => 
	`invalid country code ${value.quote()} ${src ? `for ${src} parameters ` : ""}in ${loc}`;
