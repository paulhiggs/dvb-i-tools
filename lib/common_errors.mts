/**
 * common_errors.mts
 
 * error templates used by different validatirs
 */
import { tva } from "./TVA_definitions.mts";
import { dvbi } from "./DVB-I_definitions.mts";
import { WARNING } from "./error_list.mts";

//import type { XmlElement } from "libxml2-wasm";

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
};

/**
 * Add an error message when the a required element is not present
 *
 * @param {string}      missingElement  Name of the missing element
 * @param {XmlElement}  parentElement   The element which should contain the missingElement
 * @param {string}      schemaLocation  The location in the schema of the element
 * @param {string}      errCode         The error number to show in the log
 */
export let NoChildElement = (missingElement : string, parentElement : XmlElement, schemaLocation : string | undefined, errCode : string) => ({
	code: errCode,
	message: `${missingElement} element not specified for ${parentElement.name.elementize()}${schemaLocation ? " in " + schemaLocation : ""}`,
	line: parentElement.line,
});

/**
 * Add an error message when the @href contains an invalid value
 *
 * @param {string}     value     The invalid value for the href attribute
 * @param {XmlElement} element   The element containing the @href attribute
 * @param {string}     loc       The location of the element
 * @param {string}     errCode   The error number to show in the log
 */
export let cg_InvalidHrefValue = (value : string, element : XmlElement, loc : string, errCode : string) => ({
	code: errCode,
	message: `invalid ${tva.a_href.attribute()}=${value.quote()} specified for ${element.name.elementize()} in ${loc}`,
	line: element.line,
	key: keys.k_InvalidHRef,
});

export let sl_InvalidHrefValue = (value : string, element : XmlElement, src : string, loc : string, errCode : string) => ({
	code: errCode,
	fragment: element,

	message: `invalid ${dvbi.a_href.attribute()}=${value.quote()} specified for ${src} in ${loc}`,
	key: keys.k_InvalidHRef,
});

export let InvalidURL = (value : string, element : XmlElement, src : string, errCode : string) => ({
	code: errCode,
	fragment: element,
	message: `invalid URL "${value}" value specified for ${src}`,
	key: keys.k_InvalidURL,
});

export let DeprecatedElement = (what : XmlElement, when: string, errCode : string) => ({
	type: WARNING,
	code: errCode,
	fragment: what,
	message: `Element ${what.name.elementize()} ${what.parent ? `in ${what.parent.name.elementize()} ` : ""}is deprecated since ${when}`,
	key: keys.k_DeprecatedElement,
});

export let DeprecatedAttribute = (what : XmlElement, when : string, errCode : string) => ({
	type: WARNING,
	code: errCode,
	fragment: what.parent,
	message: `Attribute ${what.name.elementize(what.parent?.name)} is deprecated since ${when}`,
	key: keys.k_DeprecatedAttribute,
});

/**
 * Add an error message an incorrect country code is specified in transmission parameters
 *
 * @param {string} value            The invalid country code
 * @param {string | undefined} src  The transmission mechanism
 * @param {string} loc              The location of the element
 */
export let InvalidCountryCode = (value : string, src : string | undefined, loc : string) => `invalid country code ${value.quote()} ${src ? `for ${src} parameters ` : ""}in ${loc}`;
