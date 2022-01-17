// MultilingualElement.js

import { WARNING, APPLICATION } from "./ErrorList.js";
import { dvbi } from "./DVB-I_definitions.js";
import { tva } from "./TVA_definitions.js";
import { xPath, isIn } from "./utils.js";
import { datatypeIs } from "./phlib/phlib.js";

const NO_DOCUMENT_LANGUAGE='**'; // this should not be needed as @xml:lang is required in <ServiceList> and <TVAMain> root elements

/**
 * check a language code and log its result
 *
 * @param {Object}  validator the validation class to use
 * @param {string}  lang      the language to check
 * @param {string}  loc       the 'location' of the element containing the language value
 * @param {XMLnode} element   the element containing the language value
 * @param {Object}  errs      the class where errors and warnings relating to the service list processing are stored 
 * @param {String}  errCode   the error code to be reported
 * @returns {boolean} true if the specified language is valid
 */
export function checkLanguage(validator, lang, loc, element, errs, errCode) {
	if (!validator) {
		errs.addError({type:APPLICATION, code:'CL000', message:`cannot validate language ${lang.quote()}${loc?` for ${loc.elementize()}`:""}`, 
						key:"no language validator"});
		return false;
	}

	let validatorResp=validator.isKnown(lang), langOK=false;
	switch (validatorResp.resp) {
		case validator.languageKnown:
			langOK=true;
			break;
		case validator.languageUnknown:
			errs.addError({type:WARNING, code:`${errCode}-1`, 
							message:`${loc?loc:"language"} value ${lang.quote()} is invalid`, 
							fragment:element, key:"invalid language"});
			break;
		case validator.languageRedundant:
			errs.addError({type:WARNING, code:`${errCode}-2`, 
							message:`${loc?loc:"language"} value ${lang.quote()} is deprecated (use ${validatorResp.pref.quote()} instead)`, 
							fragment:element, key:"deprecated language"});
			break;	
		case validator.languageNotSpecified:
			errs.addError({code:`${errCode}-3`, message:`${loc?loc:"language"} value is not provided`, 
							fragment:element, key:"unspecified language"});
			break;
		case validator.languageInvalidType:
			errs.addError({code:`${errCode}-4`, message:`language is not a String, its "${datatypeIs(lang)}"`, 
							fragment:element, key:"invalid language"});
			break;
	}
	return langOK;
}


/**
 * Recurse up the XML element hierarchy until we find an element with an @xml:lang attribute or return a ficticouus 
 * value of topmost level element does not contain @xml:lang
 * @param {XMLNode} node  the multilingual element whose language is needed
 * @returns {String} the value of the xml:lang attribute for the element, or the teh closest ancestor 
 */
export function mlLanguage(node) {
	if (node.type() != 'element')
		return NO_DOCUMENT_LANGUAGE;

	if (node.attr(dvbi.a_lang))
		return (node.attr(dvbi.a_lang).value());

	return mlLanguage(node.parent());
}

/**
 * checks that all the @xml:lang values for an element are unique and that only one instace of the element does not contain an xml:lang attribute
 *
 * @param {String}  SCHEMA           Used when constructing Xpath queries
 * @param {String}  PREFIX           Used when constructing Xpath queries
 * @param {String}  elementName      The multilingual XML element to check
 * @param {String}  elementLocation  The descriptive location of the element being checked (for reporting)
 * @param {XMLnode} node             The XML tree node containing the element being checked
 * @param {Object}  errs             The class where errors and warnings relating to the service list processing are stored 
 * @param {String}  errCode          The error code to be reported
 * @param {Object}  validator 		 The validation class for check the value of the language, or null if no check is to be performed
 */
export function checkXMLLangs(SCHEMA, PREFIX, elementName, elementLocation, node, errs, errCode, validator=null) {
	if (!node) {
		errs.addError({type:APPLICATION, code:"XL000", message:"checkXMLLangs() called with node==null"});
		return;
	}

	let elementLanguages=[], i=0, elem;
	while ((elem=node.get(xPath(PREFIX, elementName, ++i), SCHEMA))!=null) {
		let lang=mlLanguage(elem);
		if (isIn(elementLanguages, lang)) 
			errs.addError({code:`${errCode}-1`, 
				message:`${lang==NO_DOCUMENT_LANGUAGE?"default language":`xml:lang=${lang.quote()}`} already specifed for ${elementName.elementize()} for ${elementLocation}`, 
				fragment:elem, key:"duplicate @xml:lang"});
		else elementLanguages.push(lang);

		//if lang is specified, validate the format and value of the attribute against BCP47 (RFC 5646)
		if (validator && lang!=NO_DOCUMENT_LANGUAGE) 
			checkLanguage(validator, lang, `xml:lang in ${elementName}`, elem, errs, `${errCode}-2`);
	}
}


/**
 * validate the language specified record any errors
 *
 * @param {XMLnode} node       the XML node whose @lang attribute should be checked
 * @param {boolean} isRequired report an error if @lang is not explicitly stated
 * @param {Class}   errs       errors found in validaton
 * @param {string}  errCode    error number to use
 * @param {object}  validator  the validation class to use
 * @returns {string} the @lang attribute of the node element of the parentLang if it does not exist of is not specified
 */

export function GetNodeLanguage(node, isRequired, errs, errCode, validator=null) {
	if (!node) 
		return NO_DOCUMENT_LANGUAGE;
	if (isRequired && !node.attr(tva.a_lang))
		errs.addError({code:`${errCode}-1`, message:`${tva.a_lang.attribute()} is required for ${node.name().quote()}`, key:"unspecified language", line:node.line()});

	let localLang=mlLanguage(node);

	if (validator && node.attr(tva.a_lang) && localLang!=NO_DOCUMENT_LANGUAGE)
		checkLanguage(validator, localLang, node.name(), node, errs, `${errCode}-2`);
	return localLang;
}