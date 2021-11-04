// CommonErrors.js
import { dvbi } from "./DVB-I_definitions.js";
import { elementize, attribute, quote } from './phlib/phlib.js';

/**
 * Add an error message when the a required element is not present
 *
 * @param {Object} errs            Errors buffer
 * @param {string} missingElement  Name of the missing element
 * @param {XMLnode} parentElement  Name of the element which should contain the missingElement
 * @param {string} schemaLoctation The location in the schema of the element
 * @param {string} errCode         The error number to show in the log
 */
export function NoChildElement(errs, missingElement, parentElement, schemaLocation, errCode) {
	errs.addError({code:errCode, 
		message:`${missingElement} element not specified for ${parentElement.name().elementize()}${schemaLocation?(" in "+schemaLocation):""}`,
		line:parentElement.line()});
}


/**
* Add an error message when the @href contains an invalid value
*
* @param {Object} errs    Errors buffer
* @param {string} value   The invalid value for the href attribute
* @param {string} src     The element missing the @href
* @param {string} loc     The location of the element
* @param {string} errCode The error number to show in the log
*/
export function cg_InvalidHrefValue(errs, value, src, loc, errCode) {
	errs.addError({code:errCode, message:`invalid ${tva.a_href.attribute()}=${value.quote()} specified for ${src} in ${loc}`});
}

export function sl_InvalidHrefValue(value, element, src, loc, errs, errCode) {
		errs.addError({code:errCode, fragment:element, line:element.line(),
			message:`invalid ${dvbi.a_href.attribute()}=${value.quote()} specified for ${src} in ${loc}`, 
			key:"invalid href"});
}