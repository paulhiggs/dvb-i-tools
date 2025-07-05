/**
 * common_errors.mts
 *
 * error templates used by different validators
 * 
 */
import { XmlElement, XmlAttribute } from "libxml2-wasm";

import { dvbi } from "./DVB-I_definitions.mts";
import { WARNING } from "./error_list.mts";
import type { ErrorArgs } from "./error_list.mts";
import { tva } from "./TVA_definitions.mts";


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
};

/**
 * An error message when the a required element is not present
 *
 * @param {string} missingElement         Name of the missing element
 * @param {XmlElement} parentElement      The element which should contain the missingElement
 * @param {string | null} schemaLocation  The location in the schema of the element
 * @param {string} errCode                The error number to show in the log
 */
export let NoChildElement = (missingElement : string, parentElement : XmlElement, schemaLocation : string | null, errCode : string ) : ErrorArgs => ({
	code: errCode,
	message: `${missingElement} element not specified for ${parentElement.name.elementize()}${schemaLocation ? " in " + schemaLocation : ""}`,
	line: parentElement.line,
});

/**
 * An error message when the @href contains an invalid value
 *
 * @param {string}     value    The invalid value for the href attribute
 * @param {XmlElement} element  The element containing the @href attribute
 * @param {string}     loc      The location of the element
 * @param {string}     errCode  The error number to show in the log
 */
export let cg_InvalidHrefValue = (value : string, element : XmlElement, loc : string, errCode : string) : ErrorArgs => ({
	code: errCode,
	message: `invalid ${tva.a_href.attribute()}=${value.quote()} specified for ${element.name.elementize()} in ${loc}`,
	line: element.line,
	key: keys.k_InvalidHRef,
});

export let sl_InvalidHrefValue = (value : string, element : XmlElement, src : string, loc : string, errCode : string) : ErrorArgs => ({
	code: errCode,
	fragment: element,
	line: element.line,
	message: `invalid ${dvbi.a_href.attribute()}=${value.quote()} specified for ${src} in ${loc}`,
	key: keys.k_InvalidHRef,
});

export let InvalidURL = (value : string, element, src : string, errCode : string) : ErrorArgs => ({
	code: errCode,
	fragment: element,
	line: element.line,
	message: `invalid URL ${value.quote()} specified for ${src.elementize()}`,
	key: keys.k_InvalidURL,
});

export let DeprecatedElement = (what : XmlElement, when : string, errCode : string) : ErrorArgs => ({
	type: WARNING,
	code: errCode,
	fragment: what,
	line: what.line,
	message: `${what.name.elementize()} in ${what?.parent?.name.elementize()} is deprecated in ${when}`,
	key: "deprecated element",
});

export let DeprecatedAttribute = (what : XmlAttribute, when : string, errCode : string) : ErrorArgs => ({
	type: WARNING,
	code: errCode,
	fragment: what?.parent ? what.parent : undefined,
	line: what?.parent?.line,
	message: `${what.name.attribute(what?.parent?.name)} is deprecated in ${when}`,
	key: "deprecated attribute",
});
