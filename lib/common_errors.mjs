/**
 * common_errors.mjs
 *
 * error templates used by different validatirs
 */
import { tva } from "./TVA_definitions.mjs";
import { dvbi } from "./DVB-I_definitions.mjs";
import { WARNING } from "./error_list.mjs";

export const keys = {
	k_InvalidHRef: "invalid href",
	k_InvalidValue: "invalid value",
	k_InvalidTag: "invalid tag",
	k_LengthError: "length error",
	k_DuplicatedSynopsisLength: "duplicted synopsis length",
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
};

/**
 * Add an error message when the a required element is not present
 *
 * @param {String}      missingElement   Name of the missing element
 * @param {XmlElement}  parentElement    The element which should contain the missingElement
 * @param {String}      schemaLoctation  The location in the schema of the element
 * @param {String}      errCode          The error number to show in the log
 */
export let NoChildElement = (missingElement, parentElement, schemaLocation, errCode) => ({
	code: errCode,
	message: `${missingElement} element not specified for ${parentElement.name.elementize()}${schemaLocation ? " in " + schemaLocation : ""}`,
	line: parentElement.line,
});

/**
 * Add an error message when the @href contains an invalid value
 *
 * @param {String}     value     The invalid value for the href attribute
 * @param {XmlElement} element   The element containing the @href attribute
 * @param {String}     loc       The location of the element
 * @param {String}     errCode   The error number to show in the log
 */
export let cg_InvalidHrefValue = (value, element, loc, errCode) => ({
	code: errCode,
	message: `invalid ${tva.a_href.attribute()}=${value.quote()} specified for ${element.name.elementize()} in ${loc}`,
	line: element.line,
	key: keys.k_InvalidHRef,
});

export let sl_InvalidHrefValue = (value, element, src, loc, errCode) => ({
	code: errCode,
	fragment: element,
	line: element.line,
	message: `invalid ${dvbi.a_href.attribute()}=${value.quote()} specified for ${src} in ${loc}`,
	key: keys.k_InvalidHRef,
});

export let InvalidURL = (value, element, src, errCode) => ({
	code: errCode,
	fragment: element,
	line: element.line,
	message: `invalid URL "${value}" specified for ${src.elementize()}`,
	key: keys.k_InvalidURL,
});

export let DeprecatedElement = (what, when, errCode) => ({
	type: WARNING,
	code: errCode,
	fragment: what,
	line: what.line,
	message: `${what.name.elementize()} in ${what.parent.name.elementize()} is deprecated in ${when}`,
	keys: "deprecated element",
});

export let DeprecatedAttribute = (what, when, errCode) => ({
	type: WARNING,
	code: errCode,
	fragment: what.parent,
	line: what.parent.line,
	message: `${what.name.elementize(what.parent.name)} is deprecated in ${when}`,
	keys: "deprecated attribute",
});
