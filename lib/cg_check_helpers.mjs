/**
 * cg_check_helpers.mjs
 *
*  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
* static self contained helper fuctions for content guide validation 
 */

import { isIn, parameterCheck } from "./utils.mjs";
import { dvbi } from "./DVB-I_definitions.mjs";
import { tva } from "./TVA_definitions.mjs";

export default class CG_helpers {

	/**
	 * checks is the specified element (elem) has an attribute named attrName and that its value is on the given list)
	 *
	 * @param {XmlElement} elem       the XML element to be checked
	 * @param {String}     attrName   the name of the attribute carrying the boolean value
	 * @param {Array}      allowed    the set or permitted values
	 * @param {ErrorList}  errs       errors found in validaton
	 * @param {String}     errCode    the error number used as a prefix for reporting errors
	 * @param {boolean}    isRequired true if the specified attribute is required to be specified for the element
	 */
	static AllowedValue(elem, attrName, allowed, errs, errCode, isRequired = true) {
		if (!parameterCheck("AllowedValue", elem, null, errs, "AV000")) return;

		const attr_value = elem.attrAnyNsValueOr(attrName);
		if (attr_value) {
			if (!isIn(allowed, attr_value))
				errs.addError({
					code: `${errCode}-1`,
					message: `${attrName.attribute(`${elem.parent.name}.${elem.name}`)} must be ${allowed.join(" or ")}`,
					fragment: elem,
				});
		} else if (isRequired)
			errs.addError({
				code: `${errCode}-2`,
				message: `${attrName.attribute()} must be specified for ${elem.parent.name}.${elem.name}`,
				fragment: elem,
			});
	}

	/**
	 * checks is the specified element (elem) has an attribute named attrName and that its value is "true" or "false"
	 *
	 * @param {XmlElement} elem       the XML element to be checked
	 * @param {String}     attrName   the name of the attribute carrying the boolean value
	 * @param {ErrorList}  errs       errors found in validaton
	 * @param {String}     errCode    the error number used as a prefix for reporting errors
	 * @param {boolean}    isRequired true if the specified attribute is required to be specified for the element
	 */
	static BooleanValue = (elem, attrName, errs, errCode, isRequired = true) => this.AllowedValue(elem, attrName, ["true", "false"], errs, errCode, isRequired);

	/**
	 * checks is the specified element (elem) has an attribute named attrName and that its value is "true"
	 *
	 * @param {XmlElement} elem       the XML element to be checked
	 * @param {String}     attrName   the name of the attribute carrying the boolean value
	 * @param {ErrorList}  errs       errors found in validaton
	 * @param {String}     errCode    the error number used as a prefix for reporting errors
	 * @param {boolean}    isRequired true if the specified attribute is required to be specified for the element
	 */
	static TrueValue = (elem, attrName, errs, errCode, isRequired = true) => this.AllowedValue(elem, attrName, ["true"], errs, errCode, isRequired);
	
	/**
	 * checks is the specified element (elem) has an attribute named attrName and that its value is "false"
	 *
	 * @param {XmlElement} elem       the XML element to be checked
	 * @param {String}     attrName   the name of the attribute carrying the boolean value
	 * @param {ErrorList}  errs       errors found in validaton
	 * @param {String}     errCode    the error number used as a prefix for reporting errors
	 * @param {boolean}    isRequired true if the specified attribute is required to be specified for the element
	 */
	static FalseValue = (elem, attrName, errs, errCode, isRequired = true) => this.AllowedValue(elem, attrName, ["false"], errs, errCode, isRequired);
	

	/**
	 * @param {String} genre the value to check as being a restart availability genre
	 * @returns {boolean} true if the value provided is a valid restart availability genre
	 */
	static isRestartAvailability = (genre) => [dvbi.RESTART_AVAILABLE, dvbi.RESTART_CHECK, dvbi.RESTART_PENDING].includes(genre);


	static isRestartLink = (str) => str == dvbi.RESTART_LINK;	

	static synopsisLengthError = (label, length, actual) => `length of ${tva.a_length.attribute(tva.e_Synopsis)}=${label.quote()} exceeds ${length} characters, measured(${actual})`;
	static singleLengthLangError = (length, lang) => `only a single ${tva.e_Synopsis.elementize()} is permitted per length (${length}) and language (${lang})`;
	static requiredSynopsisError = (length) => `a ${tva.e_Synopsis.elementize()} with ${tva.a_length.attribute()}=${length.quote()} is required`;


	static {
		// initialise static variables here
	}
} 