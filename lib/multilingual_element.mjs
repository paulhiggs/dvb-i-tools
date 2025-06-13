/**
 * multilingual_element.mjs
 *
 * check that multiple elements for expressing multilingual values match DVB-I requirments
 */
import { XmlElement } from 'libxml2-wasm';

import { tva } from "./TVA_definitions.mjs";

import { APPLICATION } from "./error_list.mjs";
import { CountChildElements, isIn } from "./utils.mjs";
import { isValidLangFormat } from "./IANA_languages.mjs";

const NO_DOCUMENT_LANGUAGE = "**"; // this should not be needed as @xml:lang is required in <ServiceList> and <TVAMain> root elements

/**
 * check a language code and log its result
 *
 * @param {string}        lang      the language to check
 * @param {string}        loc       the 'location' of the element containing the language value
 * @param {XmlElement}    element   the element containing the language value
 * @param {ErrorList}     errs      the class where errors and warnings relating to the service list processing are stored
 * @param {string}        errCode   the error code to be reported
 * @returns {boolean} true if the specified language is valid
 */
export function checkLanguage(lang, loc, element, errs, errCode) {
	if (!isValidLangFormat(lang)) {
		errs.addError({
			code: `${errCode}-100`,
			key: "invalid format",
			fragment: element,
			message: `xml:${tva.a_lang} value ${lang.quote()} does not match format for Language-Tag in BCP47`,
		});
		return false;
	}
	return true;
}

/**
 * Recurse up the XML element hierarchy until we find an element with an @xml:lang attribute or return a ficticouus
 * value of topmost level element does not contain @xml:lang
 *
 * @param {XmlElement} node    the multilingual element whose language is needed
 * @returns {String} the value of the xml:lang attribute for the element, or the teh closest ancestor
 */
export function mlLanguage(node) {
	if (!(node instanceof XmlElement)) return NO_DOCUMENT_LANGUAGE;
	const langAttr = node.attrAnyNs(tva.a_lang);
	if (langAttr) return langAttr.value;
	return mlLanguage(node.parent);
}

/**
 * checks that all the @xml:lang values for an element are unique and that only one instace of the element does not contain an xml:lang attribute
 *
 * @param {String}        elementName      The multilingual XML element to check
 * @param {String}        elementLocation  The descriptive location of the element being checked (for reporting)
 * @param {XmlElement}    node             The XML tree node containing the element being checked
 * @param {ErrorList}     errs             The class where errors and warnings relating to the service list processing are stored
 * @param {String}        errCode          The error code to be reported
 */
export function checkXMLLangs(elementName, elementLocation, node, errs, errCode) {
	if (!node) {
		errs.addError({ type: APPLICATION, code: "XL000", message: "checkXMLLangs() called with node==null" });
		return;
	}

	let childElems = node.childNodes();
	if (CountChildElements(node, elementName) > 1)
		childElems?.forEachNamedSubElement(elementName, elem => {
			if (!elem.attrAnyNs(tva.a_lang))
				errs.addError({
					code: `${errCode}-1`,
					message: `xml:lang must be declared for each multilingual element for ${elementName.elementize()} in ${elementLocation}`,
					fragment: elem,
					key: "required @xml:lang",
				});
		});

	let elementLanguages = [];
	childElems?.forEachNamedSubElement(elementName, elem => {
		let lang = mlLanguage(elem);
		if (isIn(elementLanguages, lang))
			errs.addError({
				code: `${errCode}-2`,
				message: `${lang == NO_DOCUMENT_LANGUAGE ? "default language" : `xml:lang=${lang.quote()}`} already specifed for ${elementName.elementize()} in ${elementLocation}`,
				fragment: elem,
				key: "duplicate @xml:lang",
			});
		else elementLanguages.push(lang);

		if (elem.content.length == 0) //!!
			errs.addError({
				code: `${errCode}-3`,
				message: `value must be specified for ${elem.parent.name.elementize()}${elem.name.elementize()}`,
				fragment: elem,
				key: "empty value",
			});

		// if lang is specified, validate the format and value of the attribute against BCP47 (RFC 5646)
		if (elem.attrAnyNs(tva.a_lang) && lang != NO_DOCUMENT_LANGUAGE) checkLanguage(lang, `xml:lang in ${elementName}`, elem, errs, `${errCode}-4`);
	});
}

/**
 * validate the language specified record any errors
 *
 * @param {XmlElement}    node       the XML node whose @lang attribute should be checked
 * @param {boolean}       isRequired report an error if @lang is not explicitly stated
 * @param {ErrorList}     errs       errors found in validaton
 * @param {string}        errCode    error number to use
 * @returns {string} the @lang attribute of the node element of the parentLang if it does not exist of is not specified
 */
export function GetNodeLanguage(node, isRequired, errs, errCode) {
	if (!node) return NO_DOCUMENT_LANGUAGE;
	if (isRequired && !node.attrAnyNs(tva.a_lang))
		errs.addError({ code: `${errCode}-1`, message: `${tva.a_lang.attribute()} is required for ${node.name.quote()}`, key: "unspecified language", line: node.line });

	const localLang = mlLanguage(node);

	if (node.attrAnyNs(tva.a_lang) && localLang != NO_DOCUMENT_LANGUAGE) 
		checkLanguage(localLang, node.name, node, errs, `${errCode}-2`);
	return localLang;
}
