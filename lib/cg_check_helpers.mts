/**
 * cg_check_helpers.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * static self contained helper fuctions for content guide validation 
 */

import { parameterCheck } from "./utils.mts"
import { dvbi } from "./DVB-I_definitions.mts"
import { tva } from "./TVA_definitions.mts"

import ErrorList from "./error_list.mts"

export default class CG_helpers {

	/**
	 * checks is the specified element (elem) has an attribute named attrName and that its value is on the given list)
	 *
	 * @param {XmlElement} elem     the XML element to be checked
	 * @param {string} attrName     the name of the attribute carrying the boolean value
	 * @param {string[]} allowed    the set or permitted values
	 * @param {ErrorList} errs      errors found in validaton
	 * @param {string} errCode      the error number used as a prefix for reporting errors
	 * @param {boolean} isRequired  true if the specified attribute is required to be specified for the element
	 */
	static AllowedValue(elem: XmlElement, attrName: string, allowed: string[], errs: ErrorList, errCode: string, isRequired: boolean = true): void {
		if (!parameterCheck("AllowedValue", elem, null, errs, "AV000")) return;

		const attr_value = elem.attrAnyNsValueOr(attrName);
		if (attr_value) {
			if (!allowed.includes(attr_value))
				errs.addError({
					code: `${errCode}-1`,
					message: `${attrName.attribute(`${elem.parent?.name}.${elem.name}`)} must be ${allowed.join(" or ")}`,
					fragment: elem,
				});
		} else if (isRequired)
			errs.addError({
				code: `${errCode}-2`,
				message: `${attrName.attribute()} must be specified for ${elem.parent?.name}.${elem.name}`,
				fragment: elem,
			});
	}


	/**
	 * checks is the specified element (elem) has an attribute named attrName and that its value is "true" or "false"
	 *
	 * @param {XmlElement} elem       the XML element to be checked
	 * @param {string}     attrName   the name of the attribute carrying the boolean value
	 * @param {ErrorList}  errs       errors found in validaton
	 * @param {string}     errCode    the error number used as a prefix for reporting errors
	 * @param {boolean}    isRequired true if the specified attribute is required to be specified for the element
	 */
	static BooleanValue = (elem: XmlElement, attrName: string, errs: ErrorList, errCode: string, isRequired: boolean = true): void => 
		this.AllowedValue(elem, attrName, ["true", "false"], errs, errCode, isRequired);


	/**
	 * checks is the specified element (elem) has an attribute named attrName and that its value is "true"
	 *
	 * @param {XmlElement} elem       the XML element to be checked
	 * @param {string}     attrName   the name of the attribute carrying the boolean value
	 * @param {ErrorList}  errs       errors found in validaton
	 * @param {string}     errCode    the error number used as a prefix for reporting errors
	 * @param {boolean}    isRequired true if the specified attribute is required to be specified for the element
	 */
	static TrueValue = (elem: XmlElement, attrName: string, errs: ErrorList, errCode: string, isRequired: boolean = true) : void => 
		this.AllowedValue(elem, attrName, ["true"], errs, errCode, isRequired);
	

	/**
	 * checks is the specified element (elem) has an attribute named attrName and that its value is "false"
	 *
	 * @param {XmlElement} elem       the XML element to be checked
	 * @param {string}     attrName   the name of the attribute carrying the boolean value
	 * @param {ErrorList}  errs       errors found in validaton
	 * @param {string}     errCode    the error number used as a prefix for reporting errors
	 * @param {boolean}    isRequired true if the specified attribute is required to be specified for the element
	 */
	static FalseValue = (elem: XmlElement, attrName: string, errs: ErrorList, errCode: string, isRequired: boolean = true) : void => 
		this.AllowedValue(elem, attrName, ["false"], errs, errCode, isRequired);
	

	/**
	 * @param {string} genre the value to check as being a restart availability genre
	 * @returns {boolean} true if the value provided is a valid restart availability genre
	 */
	static isRestartAvailability = (genre: string) : boolean => 
		[dvbi.RESTART_AVAILABLE, dvbi.RESTART_CHECK, dvbi.RESTART_PENDING].includes(genre);


	/**
	 * @param {string} href the value to check as being a link to a restart Template XML AIT link
	 * @returns {boolean} true if the value provided is a valid restart link
	 */
	static isRestartLink = (href: string) : boolean => href == dvbi.RESTART_LINK;	


	/**
	 * @param {string} label the synopsis length type
	 * @param {number} length the number of characters allowed for the length type
	 * @param {number} actual the number of characters found in the synopsis
	 * @returns {string} a reportable error message
	 */
	static synopsisLengthError = (label: string, length: number, actual: number) => 
		`length of ${tva.a_length.attribute(tva.e_Synopsis)}=${label.quote()} exceeds ${length} characters, measured(${actual})`;


	/**
	 * @param {string} length the synopsis length type
	 * @param {string} lang the language specified for the synopsis
	 * @returns {string} a reportable error message
	 */
	static singleLengthLangError = (length: string, lang: string) : string => 
		`only a single ${tva.e_Synopsis.elementize()} is permitted per length (${length}) and language (${lang})`;


	/**
	 * @param {string} length the synopsis length type
	 * @returns {string} a reportable error message
	 */
	static requiredSynopsisError = (length: string) : string => 
		`a ${tva.e_Synopsis.elementize()} with ${tva.a_length.attribute()}=${length.quote()} is required`;


	static {
		// initialise static variables here
	}
} 