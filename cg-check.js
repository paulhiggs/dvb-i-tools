// libxmljs2 - github.com/marudor/libxmljs2
import { parseXmlString } from "libxmljs2";

import { elementize, quote } from './phlib/phlib.js';

import { readFileSync } from "fs";

import ErrorList, { ERROR, WARNING, APPLICATION } from "./ErrorList.js";
import ClassificationScheme from "./ClassificationScheme.js";
import Role from "./Role.js";
import IANAlanguages from "./IANAlanguages.js";

import { dvbi } from "./DVB-I_definitions.js";
import { tva } from "./TVA_definitions.js";
import { mpeg7 } from "./MPEG7_definitions.js";

import { isJPEGmime, isPNGmime } from "./MIME_checks.js";
import { isCRIDURI, isTAGURI } from "./URI_checks.js";
import { xPath, xPathM, isIn, isIni, unEntity, parseISOduration } from "./utils.js";

import { isHTTPURL, isDVBLocator, isUTCDateTime } from "./pattern_checks.js";

import { IANA_Subtag_Registry, TVA_ContentCS, TVA_FormatCS, DVBI_ContentSubject, DVBI_CreditsItemRoles, DVBIv2_CreditsItemRoles, TVAschema } from "./data-locations.js";


// convenience/readability values
const DEFAULT_LANGUAGE="***";
const CATEGORY_GROUP_NAME="\"category group\"";

const CG_REQUEST_SCHEDULE_TIME="Time";
const CG_REQUEST_SCHEDULE_NOWNEXT="NowNext";
const CG_REQUEST_SCHEDULE_WINDOW="Window";
const CG_REQUEST_PROGRAM="ProgInfo";
const CG_REQUEST_MORE_EPISODES="MoreEpisodes";
const CG_REQUEST_BS_CATEGORIES="bsCategories";
const CG_REQUEST_BS_LISTS="bsLists";
const CG_REQUEST_BS_CONTENTS="bsContents";

const supportedRequests=[
	{value:CG_REQUEST_SCHEDULE_TIME, label:"Schedule Info (time stamp)"},
	{value:CG_REQUEST_SCHEDULE_NOWNEXT, label:"Schedule Info (now/next)"},
	{value:CG_REQUEST_SCHEDULE_WINDOW, label:"Schedule Info (window)"},
	{value:CG_REQUEST_PROGRAM, label:"Program Info"},
	{value:CG_REQUEST_MORE_EPISODES, label:"More Episodes"},
	{value:CG_REQUEST_BS_CATEGORIES, label:"Box Set Categories"},
	{value:CG_REQUEST_BS_LISTS, label:"Box Set Lists"},
	{value:CG_REQUEST_BS_CONTENTS, label:"Box Set Contents"}];

/**
 * counts the number of named elements in the specificed node 
 * *
 * @param {Object} node the libxmljs node to check
 * @param {String} childElementName the name of the child element to count
 * @returns {integer} the number of named child elments 
 */
function CountChildElements(node, childElementName) {
	let r=0, childElems=node?node.childNodes():null;
	if (childElems) childElems.forEachSubElement(elem => {
		if (elem.name()==childElementName)
			r++;
	});
	return r;
}


/**
 * check that the specified child elements are in the parent element
 *
 * @param {Object}  parentElement         the element whose children should be checked
 * @param {Array}   childElements		  the names of elements and their cardinality
 * @param {boolean} allowOtherElements    flag indicating if other (foreign defined) elements are permitted
 * @param {Class}   errs                  errors found in validaton
 * @param {string}  errCode               error code to be used for any error found 
 * @returns {boolean} true if no errors are found (all mandatory elements are present and no extra elements are specified)
 * 
 * NOTE: elements are described as an object containing "name", "minOccurs", "maxOccurs".
 *   Default values for minOccurs and maxOccurs are 1
 */
 function checkTopElementsAndCardinality(parentElement, childElements, allowOtherElements, errs, errCode=null) {

	function findElementIn(elementList, elementName) {
		if (elementList instanceof Array)
			return elementList.find(element => element.name == elementName);
		else return false;
	}
	if (!parentElement) {
		errs.addError({type:APPLICATION, code:errCode?`${errCode}-0`:"TE000", message:"checkTopElementsAndCardinality() called with a 'null' element to check"});
		return false;
	}
	let rv=true, thisElem=elementize(`${parentElement.parent().name()}.${parentElement.name()}`);
	// check that each of the specifid childElements exists
	childElements.forEach(elem => {
		let _min=elem?.minOccurs ? elem.minOccurs : 1;
		let _max=elem?.maxOccurs ? elem.maxOccurs : 1;
		let count=CountChildElements(parentElement, elem.name);
		if (count==0 && _min!=0) {
			errs.addError({tcode:errCode?`${errCode}-1`:"TE001", message:`Mandatory element ${elem.name.elementize()} not specified in ${thisElem}`});
			rv=false;
		}
		else {
			if (count<_min || count>_max) {
				errs.addError({code:errCode?`${errCode}-2`:"TE002", 
								message:`Cardinality of ${elem.name.elementize()} in ${thisElem} is not in the range ${_min}..${(_max==Infinity)?"unbounded":_max}`});
				rv=false;				
			}
		}
	});

	// check that no additional child elements existance if the "Other Child Elements are OK" flag is not set
	if (!allowOtherElements) {
		let children=parentElement.childNodes();
		if (children) children.forEachSubElement(child => {
			if (!findElementIn(childElements, child.name())) {	
				errs.addError({code:errCode?`${errCode}-3`:"TE003", 
								message:`Element ${child.name().elementize()} is not permitted in ${thisElem}`, 
								fragment:child});
				rv=false;
			}
		});
	}
	return rv;
}


/**
 * check that the specified child elements are in the parent element
 *
 * @param {Object} parentElement      the element whose attributes should be checked
 * @param {Array}  requiredAttributes the element names permitted within the parent
 * @param {Array}  optionalAttributes the element names permitted within the parent
 * @param {Class}  errs               errors found in validaton
 * @param {string} errCode            error code prefix to be used in reports, if not present then use local codes
 */
function checkAttributes(parentElement, requiredAttributes, optionalAttributes, errs, errCode=null)
{
	if (!requiredAttributes || !parentElement) {
		errs.addError({type:APPLICATION, code:"AT000", message:"checkAttributes() called with parentElement==null or requiredAttributes==null"});
		return;
	}
	
	requiredAttributes.forEach(attributeName => {
		if (!parentElement.attr(attributeName)) {
			let p=`${(parentElement.parent()?`${parentElement.parent().name()}.`:"")}${parentElement.name()}`;
			errs.addError({code:errCode?`${errCode}-1`:"AT001", message:`${attributeName.attribute(`${p}`)} is a required attribute`});
		}
	});
	
	parentElement.attrs().forEach(attr => {
		if (!isIn(requiredAttributes, attr.name()) && !isIn(optionalAttributes, attr.name())) {
			let p=`${elementize(`${parentElement.parent()?`${parentElement.parent().name()}.`:""}${parentElement.name()}`)}`;
			errs.addError({code:errCode?`${errCode}-2`:"AT002",  message:`${attr.name().attribute()} is not permitted in ${p}`});
		}
	});
}


/**
 * converts a decimal representation of a string to a number
 *
 * @param {string} str    string contining the decimal value
 * @returns {integer}  the decimal representation of the string, or 0 is non-digits are included
 */
 function valUnsignedInt(str) {
	const intRegex=/[\d]+/;
	let s=str.match(intRegex);
	return s[0]===str?parseInt(str, 10):0;
}


/** 
 * checks is the specified element (elem) has an attribute named attrName and that its value is on the given list)
 *
 * @param {Node}    elem       the XML element to be checked
 * @param {string}  attrName   the name of the attribute carrying the boolean value
 * @param {string}  errCode    the error number used as a prefix for reporting errors
 * @param {Class}   errs       errors found in validaton
 * @param {array}   allowed    the set or permitted values
 * @param {boolean} isRequired true if the specificed attribued is required to be specified for the element
 */
 function AllowedValue(elem, attrName, errCode, errs, allowed, isRequired=true) {
	if (!elem) {
		errs.addError({type:APPLICATION, code:`${errCode}-0`, message:"AllowedValue() called with elem==null"});
		return;
	}

	if (elem.attr(attrName)) {
		if (!isIn(allowed, elem.attr(attrName).value())) {
			let str="";
			allowed.forEach(value => str=str+((str.length)?" or ":"")+value);
			errs.addError({code:`${errCode}-1`, message:`${attrName.attribute(`${elem.parent().name}.${elem.name()}`)} must be ${str}`, fragment:elem});
		}
	}
	else 
		if (isRequired) 
			errs.addError({code:`${errCode}-2`, message:`${attrName.attribute()} must be specified for ${elem.parent().name()}.${elem.name()}`, fragment:elem});
}


/** 
 * checks is the specified element (elem) has an attribute named attrName and that its value is "true" or "false"
 *
 * @param {Node}    elem       the XML element to be checked
 * @param {string}  attrName   the name of the attribute carrying the boolean value
 * @param {string}  errCode    the error number used as a prefix for reporting errors
 * @param {Class}   errs       errors found in validaton
 * @param {boolean} isRequired true if the specificed attribued is required to be specified for the element
 */
function BooleanValue(elem, attrName, errCode, errs, isRequired=true) {
	AllowedValue(elem, attrName, errCode, errs, ["true", "false"], isRequired);
}


/** 
 * checks is the specified element (elem) has an attribute named attrName and that its value is "true"
 *
 * @param {Node}    elem       the XML element to be checked
 * @param {string}  attrName   the name of the attribute carrying the boolean value
 * @param {string}  errCode    the error number used as a prefix for reporting errors
 * @param {Class}   errs       errors found in validaton
 * @param {boolean} isRequired true if the specificed attribued is required to be specified for the element
 */
 function TrueValue(elem, attrName, errCode, errs, isRequired=true) {
	AllowedValue(elem, attrName, errCode, errs, ["true"], isRequired);
}

/** 
 * checks is the specified element (elem) has an attribute named attrName and that its value is "false"
 *
 * @param {Node}    elem       the XML element to be checked
 * @param {string}  attrName   the name of the attribute carrying the boolean value
 * @param {string}  errCode    the error number used as a prefix for reporting errors
 * @param {Class}   errs       errors found in validaton
 * @param {boolean} isRequired true if the specificed attribued is required to be specified for the element
 */
function FalseValue(elem, attrName, errCode, errs, isRequired=true) {
	AllowedValue(elem, attrName, errCode, errs, ["false"], isRequired);
}


/** 
 * verify the language using a validation class
 *
 * @param {object} validator  the validation class to use
 * @param {Class}  errs       errors found in validaton
 * @param {string} lang 	  that should be displayed in HTML
 * @param {string} loc        (optional) "location" of the language being checked
 * @param {string} errCode      (optional) error number to use instead of local values
 */
function CheckLanguage(validator, errs, lang, loc=null, errCode=null ) {
	if (!validator) {
		errs.addError({type:APPLICATION, code:errCode?`${errCode}-1`:"LA001", message:`cannot validate language ${lang.quote()}${loc?" for "+loc.elementize():""}`, 
						key:"no language validator"});
		return false;
	}
	if (!validator.isKnown(lang))  {
		errs.addError({code:errCode?`${errCode}-2`:"LA002", message:`language ${lang.quote()} specified${loc?" for "+loc.elementize():""} is invalid`, 
						key:"invalid language"});
		return false;
	}
	return true;
}


if (!Array.prototype.forEachSubElement) {
	// based on the polyfill at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach 
	/*
	* alternate to Array.prototype.forEach that only returns XML tree nodes that are elements
	*/

	Array.prototype.forEachSubElement = function(callback, thisArg) {

	if (this == null) { throw new TypeError('Array.prototype.forEachSubElement called on null or undefined'); }

	var T, k;
	// 1. Let O be the result of calling toObject() passing the
	// |this| value as the argument.
	var O = Object(this);

	// 2. Let lenValue be the result of calling the Get() internal
	// method of O with the argument "length".
	// 3. Let len be toUint32(lenValue).
	var len = O.length >>> 0;

	// 4. If isCallable(callback) is false, throw a TypeError exception.
	// See: https://es5.github.com/#x9.11
	if (typeof callback !== "function") { throw new TypeError(`${callback} is not a function`); }

	// 5. If thisArg was supplied, let T be thisArg; else let
	// T be undefined.
	if (arguments.length > 1) { T = thisArg; }

	// 6. Let k be 0
	k = 0;

	// 7. Repeat, while k < len
	while (k < len) {

		var kValue;

		// a. Let Pk be ToString(k).
		//    This is implicit for LHS operands of the in operator
		// b. Let kPresent be the result of calling the HasProperty
		//    internal method of O with argument Pk.
		//    This step can be combined with c
		// c. If kPresent is true, then
		if (k in O) {

		// i. Let kValue be the result of calling the Get internal
		// method of O with argument Pk.
		kValue = O[k];

		// ii. Call the Call internal method of callback with T as
		// the this value and argument list containing kValue, k, and O.
		if (kValue.type()=='element')
			callback.call(T, kValue, k, O);
		}
		// d. Increase k by 1.
		k++;
	}
	// 8. return undefined
	};
}


export default class ContentGuideCheck {

	constructor(useURLs, preloadedLanguageValidator=null,  preloadedGenres=null, preloadedCreditItemRoles=null) {

		if (preloadedLanguageValidator) 
			this.knownLanguages=preloadedLanguageValidator;
		else {
			console.log("loading languages...");
			this.knownLanguages=new IANAlanguages();
			this.knownLanguages.loadLanguages(useURLs?{url: IANA_Subtag_Registry.url, purge: true}:{file: IANA_Subtag_Registry.file, purge: true});
		}

		if (preloadedGenres) 
			this.allowedGenres=preloadedGenres;
		else {
			console.log("loading classification schemes...");
			this.allowedGenres=new ClassificationScheme();
			this.allowedGenres.loadCS(useURLs?
						{urls:[TVA_ContentCS.url, TVA_FormatCS.url, DVBI_ContentSubject.url]}:
						{files:[TVA_ContentCS.file, TVA_FormatCS.file, DVBI_ContentSubject.file]});
		}
		
		if (preloadedCreditItemRoles)
			this.allowedCreditItemRoles=preloadedCreditItemRoles;
		else {
			console.log("loading CreditItem roles...");
			this.allowedCreditItemRoles=new Role();
			this.allowedCreditItemRoles.loadRoles(useURLs?
					{urls:[DVBI_CreditsItemRoles.url, DVBIv2_CreditsItemRoles.url]}:
					{files:[DVBI_CreditsItemRoles.file, DVBIv2_CreditsItemRoles.file]});
		}

		console.log("loading Schemas...");
		this.TVAschema=parseXmlString(readFileSync(TVAschema.file));

		this.supportedRequests=supportedRequests;
	}


	/**
	 * validate the language specified record any errors
	 *
	 * @param {object} validator  the validation class to use
	 * @param {Class}  errs       errors found in validaton
	 * @param {Object} node       the XML node whose @lang attribute should be checked
	 * @param {string} parentLang the language of the XML element which is the parent of node
	 * @param {boolean} isRequired report an error if @lang is not explicitly stated
	 * @param {string} errCode     (optional) error number to use instead of local values
	 * @returns {string} the @lang attribute of the node element of the parentLang if it does not exist of is not specified
	 */
	/* private */  GetLanguage(validator, errs, node, parentLang, isRequired=false, errCode=null) {
		if (!node) 
			return parentLang;
		if (!node.attr(tva.a_lang) && isRequired) {
			errs.addError({code:errCode?errCode:"AC001", message:`${tva.a_lang.attribute()} is required for ${node.name().quote()}`, key:"unspecified language"});
			return parentLang;		
		}

		if (!node.attr(tva.a_lang))
			return parentLang;
		
		let localLang=node.attr(tva.a_lang).value();
		CheckLanguage(validator, errs, localLang, node.name(), errCode);
		return localLang;
	}


	/**
	 * check if the specificed element has the named child elemeny
	 * 
	 * @param {string} CG_SCHEMA       Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX   Used when constructing Xpath queries
	 * @param {object} node            the node to check
	 * @param {string} elementName     the name of the child element
	 * @returns {boolean} true if an element named node.elementName exists, else false
	 */
	/* private */  hasElement(CG_SCHEMA, SCHEMA_PREFIX,  node, elementName) {
		if (!node) return false;
		return (node.get(xPath(SCHEMA_PREFIX, elementName), CG_SCHEMA)!=null);
	}


	/**
	 * check that the serviceIdRef attribute is a TAG URI and report warnings
	 * 
	 * @param {Object} elem       the node containing the element being checked
	 * @param {Class}  errs       errors found in validaton
	 * @param {string} errCode    error code prefix to be used in reports, if not present then use local codes
	 * @returns {string} the serviceIdRef, whether it is valid of not
	 */
	/* private */  checkTAGUri(elem, errs, errCode=null) {
		if (elem && elem.attr(tva.a_serviceIDRef)) {
			let svcID=elem.attr(tva.a_serviceIDRef).value();
			if (!isTAGURI(svcID))
				errs.addError({type:WARNING, code:errCode?errCode:"UR001", 
								message:`${tva.a_serviceIDRef.attribute(elem.name())} ${svcID.quote()} is not a TAG URI`});
			return svcID;
		}
		return "";
	}


	/**
	 * validate the <Synopsis> elements 
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} BasicDescription    the element whose children should be checked
	 * @param {array}  requiredLengths	   @length attributes that are required to be present
	 * @param {array}  optionalLengths	   @length attributes that can optionally be present
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {Class}  errs                errors found in validaton
	 * @param {string} parentLanguage	   the xml:lang of the parent element to ProgramInformation
	 * @param {string} errCode             error code prefix to be used in reports, if not present then use local codes
	 */
	/* private */  ValidateSynopsis(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, requiredLengths, optionalLengths, requestType, errs, parentLanguage, errCode=null) {
		
		function synopsisLengthError(label, length, actual) {
			return `length of ${tva.a_length.attribute(tva.e_Synopsis)}=${label.quote()} exceeds ${length} characters, measured(${actual})`; }
		function singleLengthLangError(length, lang) {
			return `only a single ${tva.e_Synopsis.elementize()} is permitted per length (${length}) and language (${lang})`; }
		function requiredSynopsisError(length) {
			return `a ${tva.e_Synopsis.elementize()} with ${tva.a_length.attribute()}=${length.quote()} is required`; }
		
		if (!BasicDescription) {
			errs.addError({type:APPLICATION, code:"SY000", message:"ValidateSynopsis() called with BasicDescription==null"});
			return;
		}
		let s=0, Synopsis, hasShort=false, hasMedium=false, hasLong=false;
		let shortLangs=[], mediumLangs=[], longLangs=[];
		while ((Synopsis=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_Synopsis, ++s), CG_SCHEMA))!=null) {
			
			checkAttributes(Synopsis, [tva.a_length], [tva.a_lang], errs, "SY001");

			let synopsisLang=this.GetLanguage(this.knownLanguages, errs, Synopsis, parentLanguage, false, "SY002");
			let synopsisLength=Synopsis.attr(tva.a_length)?Synopsis.attr(tva.a_length).value():null;
			
			if (synopsisLength) {
				if (isIn(requiredLengths, synopsisLength) || isIn(optionalLengths, synopsisLength)) {
					let _len=unEntity(Synopsis.text()).length;
					switch (synopsisLength) {
					case tva.SYNOPSIS_SHORT_LABEL:
						if (_len > tva.SYNOPSIS_SHORT_LENGTH)
							errs.addError({code:errCode?`${errCode}-11`:"SY011", message:synopsisLengthError(tva.SYNOPSIS_SHORT_LABEL, tva.SYNOPSIS_SHORT_LENGTH, _len), 
											fragment:Synopsis});
						hasShort=true;
						break;
					case tva.SYNOPSIS_MEDIUM_LABEL:
						if (_len > tva.SYNOPSIS_MEDIUM_LENGTH)
							errs.addError({code:errCode?`${errCode}-12`:"SY012", 
											message:synopsisLengthError(tva.SYNOPSIS_MEDIUM_LABEL, tva.SYNOPSIS_MEDIUM_LENGTH, _len), 
											fragment:Synopsis});
						hasMedium=true;
						break;
					case tva.SYNOPSIS_LONG_LABEL:
						if (_len > tva.SYNOPSIS_LONG_LENGTH)
							errs.addError({code:errCode?`${errCode}-13`:"SY013", 
											message:synopsisLengthError(tva.SYNOPSIS_LONG_LABEL, tva.SYNOPSIS_LONG_LENGTH, _len), 
											fragment:Synopsis});
						hasLong=true;
						break;						
					}
				}
				else
					errs.addError({code:errCode?`${errCode}-14`:"SY014", 
									message:`${tva.a_length.attribute()}=${synopsisLength.quote()} is not permitted for this request type`, 
									fragment:Synopsis});
			}
		
			if (synopsisLang && synopsisLength) {
				switch (synopsisLength) {
					case tva.SYNOPSIS_SHORT_LABEL:
						if (isIn(shortLangs, synopsisLang)) 
							errs.addError({code:errCode?`${errCode}-16`:"SY016", 
											message:singleLengthLangError(synopsisLength, synopsisLang), 
											fragment:Synopsis});
						else shortLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_MEDIUM_LABEL:
						if (isIn(mediumLangs, synopsisLang)) 
							errs.addError({code:errCode?`${errCode}-17`:"SY017", message:singleLengthLangError(synopsisLength, synopsisLang), fragment:Synopsis});
						else mediumLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_LONG_LABEL:
						if (isIn(longLangs, synopsisLang)) 
							errs.addError({code:errCode?`${errCode}-18`:"SY018", message:singleLengthLangError(synopsisLength, synopsisLang), fragment:Synopsis});
						else longLangs.push(synopsisLang);
						break;
				}
			}
		}
		
		if (isIn(requiredLengths, tva.SYNOPSIS_SHORT_LABEL) && !hasShort)
			errs.addError({code:errCode?`${errCode}-19`:"SY019", message:requiredSynopsisError(tva.SYNOPSIS_SHORT_LABEL)});
		if (isIn(requiredLengths, tva.SYNOPSIS_MEDIUM_LABEL) && !hasMedium)
			errs.addError({code:errCode?`${errCode}-20`:"SY020", message:requiredSynopsisError(tva.SYNOPSIS_MEDIUM_LABEL)});
		if (isIn(requiredLengths, tva.SYNOPSIS_LONG_LABEL) && !hasLong)
			errs.addError({code:errCode?`${errCode}-21`:"SY021", message:requiredSynopsisError(tva.SYNOPSIS_LONG_LABEL)});
	}


	/**
	 * validate the <Keyword> elements specified
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object}  BasicDescription    the element whose children should be checked
	 * @param {integer} minKeywords         the minimum number of keywords
	 * @param {integer} maxKeywords         the maximum number of keywords
	 * @param {Class}   errs                errors found in validaton
	 * @param {string}  parentLanguage	    the xml:lang of the parent element to ProgramInformation
	 * @param {string}  errCode             error code prefix to be used in reports, if not present then use local codes
	 */
	/* private */  ValidateKeyword(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, minKeywords, maxKeywords, errs, parentLanguage, errCode=null) {

		if (!BasicDescription) {
			errs.addError({type:APPLICATION, code:"KW000", message:"ValidateKeyword() called with BasicDescription=null"});
			return;
		}
		let k=0, Keyword, counts=[];
		while ((Keyword=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_Keyword, ++k), CG_SCHEMA))!=null) {
			
			checkAttributes(Keyword, [], [tva.a_lang, tva.a_type], errs, "KW001");

			let keywordType=Keyword.attr(tva.a_type)?Keyword.attr(tva.a_type).value():tva.DEFAULT_KEYWORD_TYPE;
			let keywordLang=this.GetLanguage(this.knownLanguages, errs, Keyword, parentLanguage, false, "KW002");

			if (counts[keywordLang]===undefined)
				counts[keywordLang]=1;
			else counts[keywordLang]++;
			if (keywordType!=tva.KEYWORD_TYPE_MAIN && keywordType!=tva.KEYWORD_TYPE_OTHER)
				errs.addError({code:errCode?`${errCode}-1`:"KW011", 
								message:`${tva.a_type.attribute()}=${keywordType.quote()} not permitted for ${tva.e_Keyword.elementize()}`});
			if (unEntity(Keyword.text()).length > dvbi.MAX_KEYWORD_LENGTH)
				errs.addError({code:errCode?`${errCode}-2`:"KW012", message:`length of ${tva.e_Keyword.elementize()} is greater than ${dvbi.MAX_KEYWORD_LENGTH}`});
		}
		
		for (let i in counts) {
			if (counts[i]!=0 && counts[i]>maxKeywords) 
				errs.addError({code:errCode?`${errCode}-3`:"KW013", 
					message:`More than ${maxKeywords} ${tva.e_Keyword.elementize()} element${(maxKeywords>1?"s":"")} specified${(i==DEFAULT_LANGUAGE?"":" for language "+i.quote())}`});
		}
	}


	/**
	 * validate the <Genre> elements specified
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object}  BasicDescription    the element whose children should be checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {string}  errCode             error code prefix to be used in reports, if not present then use local codes
	 */
	/* private */  ValidateGenre(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, errCode=null) {

		if (!BasicDescription) {
			errs.addError({type:APPLICATION, code:"GE000", message:"ValidateGenre() called with BasicDescription=null"});
			return;
		}

		let g=0, Genre;
		while ((Genre=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_Genre, ++g), CG_SCHEMA))!=null) {
			let genreType=Genre.attr(tva.a_type)?Genre.attr(tva.a_type).value():tva.DEFAULT_GENRE_TYPE;
			if (genreType!=tva.GENRE_TYPE_MAIN)
				errs.addError({code:errCode?`${errCode}-1`:"GE001", 
								message:`${tva.a_type.attribute()}=${genreType.quote()} not permitted for ${tva.e_Genre.elementize()}`});
			
			let genreValue=Genre.attr(tva.a_href)?Genre.attr(tva.a_href).value():"";
			if (!this.allowedGenres.isIn(genreValue))
				errs.addError({code:errCode?`${errCode}-2`:"GE002", 
								message:`invalid ${tva.a_href.attribute()} value ${genreValue.quote()} for ${tva.e_Genre.elementize()}`});
		}
	}

	/**
	 * validate the <ParentalGuidance> elements specified. 
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object}  BasicDescription    the element whose children should be checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {string}  errCode             error code prefix to be used in reports, if not present then use local codes
	 */
	/* private */  ValidateParentalGuidance(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, errCode=null) {
		// first <ParentalGuidance> element must contain an <mpeg7:MinimumAge> element

		if (!BasicDescription) {
			errs.addError({type:APPLICATION, code:"PG000", message:"ValidateParentalGuidance() called with BasicDescription=null"});
			return;
		}

		let countParentalGuidance=0, countExplanatoryText;
		function checkPGchild(pgChild, index, array) {
			switch (pgChild.name()) {
				case tva.e_MinimumAge:
				case tva.e_ParentalRating:
					if (countParentalGuidance==1 && pgChild.name()!=tva.e_MinimumAge)
						errs.addError({code:errCode?`${errCode}-1`:"PG011", 
										message:`first ${tva.e_ParentalGuidance.elementize()} element must contain ${elementize("mpeg7:"+tva.e_MinimumAge)}`});
					
					if (pgChild.name()==tva.e_MinimumAge && countParentalGuidance!=1)
						errs.addError({code:errCode?`${errCode}-2`:"PG012", 
										message:`${tva.e_MinimumAge.elementize()} must be in the first ${tva.e_ParentalGuidance.elementize()} element`});
					
					if (pgChild.name()==tva.e_ParentalRating) {
						checkAttributes(pgChild, [tva.a_href], [], errs, errCode?`${errCode}-3`:"PG013");
					}
					break;		
				case tva.e_ExplanatoryText:
					countExplanatoryText++;
					checkAttributes(pgChild, [tva.a_length], [], errs, errCode?`${errCode}-4`:"PG004") ;
					if (pgChild.attr(tva.a_length)) {
						if (pgChild.attr(tva.a_length).value()!=tva.v_lengthLong)
							errs.addError({code:errCode?`${errCode}-3`:"PG003", 
											message:`${tva.a_length.attribute()}=${pgChild.attr(tva.a_length).value().quote()} is not allowed for ${tva.e_ExplanatoryText.elementize()}`});
					}
					
					if (unEntity(pgChild.text()).length > dvbi.MAX_EXPLANATORY_TEXT_LENGTH)
						errs.addError({code:errCode?`${errCode}-5`:"PG005", 
										message:`length of ${tva._ExplanatoryText.elementize()} cannot exceed ${dvbi.MAX_EXPLANATORY_TEXT_LENGTH} characters`});
					break;
			}
		}
		let pg=0, ParentalGuidance;
		while ((ParentalGuidance=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_ParentalGuidance, ++pg), CG_SCHEMA))!=null) {
			countParentalGuidance++;
			countExplanatoryText=0;

			if (ParentalGuidance.childNodes()) ParentalGuidance.childNodes().forEachSubElement(checkPGchild);

			if (countExplanatoryText > 1)
				errs.addError({code:errCode?`${errCode}-6`:"PG006", 
								message:`only a single ${tva.e_ExplanatoryText.elementize()} element is premitted in ${tva.e_ParentalGuidance.elementize()}`});
		}
	}


	/**
	 * validate a name (either PersonName of Character) to ensure a single GivenName is present with a single optional FamilyName
	 *
	 * @param {Object}  elem             the element whose children should be checked
	 * @param {Class}   errs             errors found in validaton
	 * @param {string}  errCode          error code prefix to be used in reports, if not present then use local codes
	 */
	/* private */  ValidateName(elem, errs, errCode=null) {
		
		function checkNamePart(elem, errs, errCode=null) {
			if (unEntity(elem.text()).length > dvbi.MAX_NAME_PART_LENGTH)	
				errs.addError({code:errCode?`${errCode}-1`:"VN001", 
								message:`${elem.name().elementize()} in ${elem.parent().name().elementize()} is longer than ${dvbi.MAX_NAME_PART_LENGTH} characters`});
		}
		
		if (!elem) {
			errs.addError({type:APPLICATION, code:"VN000", message:"ValidateName() called with elem==null"});
			return;
		}
		let familyNameCount=0, givenNameCount=0, children=elem.childNodes();
		if (children) children.forEachSubElement(subElem => {
			switch (subElem.name()) {
				case tva.e_GivenName:
					givenNameCount++;
					checkNamePart(subElem, errs, errCode?`${errCode}-2`:"VN002");
					break;
				case tva.e_FamilyName:
					familyNameCount++;
					checkNamePart(subElem, errs, errCode?`${errCode}-3`:"VN003");
					break;	
			}
		});
			
		if (givenNameCount==0)
			errs.addError({code:"VN004", message:`${tva.e_GivenName.elementize()} is mandatory in ${elem.name().elementize()}`});
		if (familyNameCount>1)
			errs.addError({code:"VN005", message:`only a single ${tva.e_FamilyName.elementize()} is permitted in ${elem.name().elementize()}`});
	}


	/**
	 * validate the <CreditsList> elements specified
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object}  BasicDescription    the element whose children should be checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {string}  errCode             error code prefix to be used in reports, if not present then use local codes
	 */
	/* private */  ValidateCreditsList(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, errCode=null) {
		
		function singleElementError(elementname, parentElemmentName) {
			return `only a single ${elementname.elementize()} is permitted in ${parentElemmentName.elementize()}`;
		}
		if (!BasicDescription) {
			errs.addError({type:APPLICATION, code:"CL000", message:"ValidateCreditsList() called with BasicDescription==null"});
			return;
		}
		let CreditsList=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_CreditsList), CG_SCHEMA);
		if (CreditsList) {
			let ci=0, CreditsItem;
			while ((CreditsItem=CreditsList.get(xPath(SCHEMA_PREFIX, tva.e_CreditsItem, ++ci), CG_SCHEMA))!=null) {
				checkAttributes(CreditsItem, [tva.a_role], [], errs, errCode?`${errCode}-1`:"CL001");
				if (CreditsItem.attr(tva.a_role)) {
					let CreditsItemRole=CreditsItem.attr(tva.a_role).value();
					if (!this.allowedCreditItemRoles.isIn(CreditsItemRole))
						errs.addError({code:errCode?`${errCode}-2`:"CL002", 
										message:`${CreditsItemRole.quote()} is not valid for ${tva.a_role.attribute(tva.e_CreditsItem)}`});
				}
				
				let foundPersonName=0, foundCharacter=0, foundOrganizationName=0;
				/* jshint -W083 */
				let vn=this.ValidateName;  // since this. is not allowed in a function declared within a loop
				if (CreditsItem.childNodes()) CreditsItem.childNodes().forEachSubElement(elem => {
					switch (elem.name()) {
						case tva.e_PersonName:
							foundPersonName++;
							// required to have a GivenName optionally have a FamilyName
							vn(elem, errs, errCode?`${errCode}-3`:"CL003" );
							break;
						case tva.e_Character:
							foundCharacter++;
							// required to have a GivenName optionally have a FamilyName
							vn(elem, errs, errCode?`${errCode}-4`:"CL004" );
							break;
						case tva.e_OrganizationName:
							foundOrganizationName++;
							if (unEntity(elem.text()).length > dvbi.MAX_ORGANIZATION_NAME_LENGTH)
								errs.addError({code:errCode?`${errCode}-5`:"CL005", 
									message:`length of ${tva.e_OrganizationName.elementize()} in ${tva.e_CreditsItem.elementize()} exceeds ${dvbi.MAX_ORGANIZATION_NAME_LENGTH} characters`});
							break;
						default:
							if (elem.name()!="text")
								errs.addError({code:errCode?`${errCode}-6`:"CL006", message:`extra element ${elem.name().elementize()} found in ${tva.e_CreditsItem.elementize()}`});
					}
					if (foundPersonName>1)
						errs.addError({code:errCode?`${errCode}-10`:"CL010", message:singleElementError(tva.e_PersonName, tva.e_CreditsItem)});
					if (foundCharacter>1)
						errs.addError({code:errCode?`${errCode}-11`:"CL011", message:singleElementError(tva.e_Character, tva.e_CreditsItem)});
					if (foundOrganizationName>1)
						errs.addError({code:errCode?`${errCode}-12`:"CL012", message:singleElementError(tva.e_OrganizationName, tva.e_CreditsItem)});
					if (foundCharacter>0 && foundPersonName==0)
						errs.addError({code:errCode?`${errCode}-13`:"CL013", 
										message:`${tva.e_Character.elementize()} in ${tva.e_CreditsItem.elementize()} requires ${tva.e_PersonName.elementize()}`});
					if (foundOrganizationName>0 && (foundPersonName>0 || foundCharacter>0))
						errs.addError({code:errCode?`${errCode}-14`:"CL014", 
										message:`${tva.e_OrganizationName.elementize()} can only be present when ${tva.e_PersonName.elementize()} is absent in ${tva.e_CreditsItem.elementize()}`});
				});
				/* jshint +W083 */
				if (foundPersonName>1)
					errs.addError({code:errCode?`${errCode}-20`:"CL020", message:singleElementError(tva.e_PersonName, tva.e_CreditsItem)});
				if (foundCharacter>1)
					errs.addError({code:errCode?`${errCode}-21`:"CL021",message:singleElementError(tva.e_Character, tva.e_CreditsItem)});
				if (foundOrganizationName>1)
					errs.addError({code:errCode?`${errCode}-22`:"CL022", message:singleElementError(tva.e_OrganizationName, tva.e_CreditsItem)});
			}
		}
	}


	/**
	 * validate a <RelatedMaterial> if it is signalled as an carrying an image
	 *
	 * @param {string}  CG_SCHEMA         Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX     Used when constructing Xpath queries
	 * @param {Object}  ReltedMaterial    the element whose children should be checked
	 * @param {Class}   errs              errors found in validaton
	 * @returns {boolean}  true if the RelatedMaterial element is evaluated here
	 */
	/* private */  CheckImageRelatedMaterial(CG_SCHEMA, SCHEMA_PREFIX, RelatedMaterial, errs) {

		if (!RelatedMaterial) {
			errs.addError({code:"IRM000", message:"CheckImageRelatedMaterial() called with RelatedMaterial==null"});
			return;
		}
		let HowRelated=RelatedMaterial.get(xPath(SCHEMA_PREFIX, tva.e_HowRelated), CG_SCHEMA);
		if (!(HowRelated && HowRelated.attr(tva.a_href))) return false;

		if (HowRelated.attr(tva.a_href).value()==tva.cs_PromotionalStillImage) {
			// Promotional Still Image
			
			let MediaUri=RelatedMaterial.get(xPathM(SCHEMA_PREFIX, [tva.e_MediaLocator, tva.e_MediaUri]), CG_SCHEMA) ;
			if (MediaUri) {
				checkAttributes(MediaUri, [tva.a_contentType], [], errs, "IRM002");
				if (MediaUri.attr(tva.a_contentType)) {
					let contentType=MediaUri.attr(tva.a_contentType).value();
					if (!isJPEGmime(contentType) && !isPNGmime(tva.a_contentType)) 
						errs.addError({code:"IRM003", 
										message:`${tva.a_contentType.attribute(tva.e_MediaUri)}=${contentType} is a valid image type`, key:'invalid image type'});
				}
				
				if (!isHTTPURL(MediaUri.text()))
					errs.addError({code:"IRM004", message:`${tva.e_MediaUri.elementize()}=${MediaUri.text().quote()} is not a valid Image URL`, key:"invalid URL"});
			}
			else errs.addError({code:"IRM001", message:`${tva.e_MediaUri.elementize()} not specified for Promotional Still Image (${tva.a_href.attribute(tva.e_HowRelated)}=${tva.cs_PromotionalStillImage})`});
			return true;
		}
		return false;
	}


	/**
	 * validate the <RelatedMaterial> elements specified
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object}  BasicDescription    the element whose children should be checked
	 * @param {Class}   errs                errors found in validaton
	 */
	/* private */  ValidateRelatedMaterial(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs) {
		
		if (!BasicDescription) {
			errs.addError({code:"RM000", message:"ValidateRelatedMaterial() called with BasicDescription==null"});
			return;
		}	
		let rm=0, RelatedMaterial;
		while ((RelatedMaterial=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_RelatedMaterial, ++rm), CG_SCHEMA))!=null) 
			this.CheckImageRelatedMaterial(CG_SCHEMA, SCHEMA_PREFIX, RelatedMaterial, errs);
	}


	/**
	 * validate the <RelatedMaterial> elements containing pagination links 
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object}  BasicDescription    the element whose children should be checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {string}  Location			The location of the Basic Description element
	 */
	/* private */  ValidatePagination(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, Location) {
		
		function checkLinkCount(errs, count, label, errCode) {
			if (count>1) {
				errs.addError({code:errCode, message:`more than 1 ${quote(`${label} pagination`)} link is specified`});
				return true;
			}
			return false;
		}
		
		if (!BasicDescription) {
			errs.addError({type:APPLICATION, code:"VP000", message:"ValidatePagination() called with BasicDescription==null"});
			return;
		}
		let countPaginationFirst=0, countPaginationPrev=0, countPaginationNext=0, countPaginationLast=0;
		let rm=0, RelatedMaterial;
		while ((RelatedMaterial=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_RelatedMaterial, ++rm), CG_SCHEMA))!=null) {
			let HowRelated=RelatedMaterial.get(xPath(SCHEMA_PREFIX, tva.e_HowRelated), CG_SCHEMA);
			if (!HowRelated) 
				this.NoChildElement(errs, tva.e_HowRelated.elementize(), tva.e_RelatedMaterial.elementize(), "VP001");
			else {	
				checkAttributes(HowRelated, [tva.a_href], [], errs, "VP002");
				if (HowRelated.attr(tva.a_href))
					switch (HowRelated.attr(tva.a_href).value()) {
						case dvbi.PAGINATION_FIRST_URI:
							countPaginationFirst++;
							break;
						case dvbi.PAGINATION_PREV_URI:
							countPaginationPrev++;
							break;
						case dvbi.PAGINATION_NEXT_URI:
							countPaginationNext++;
							break;
						case dvbi.PAGINATION_LAST_URI:
							countPaginationLast++;
							break;
					}	
				let MediaURI=RelatedMaterial.get(xPathM(SCHEMA_PREFIX, [tva.e_MediaLocator, tva.e_MediaUri]), CG_SCHEMA);
				if (MediaURI) {
					if (!isHTTPURL(MediaURI.text()))
						errs.addError({code:"VP011", message:`${tva.e_MediaUri.elementize()}=${MediaURI.text().quote()} is not a valid Pagination URL`, key:"invalid URL"});
				}
				else
					errs.addError({code:"VP010", message:`${tva.e_MediaLocator.elementize()}${tva.e_MediaUri.elementize()} not specified for pagination link`});
			}
		}

		let linkCountErrs=false;
		if (checkLinkCount(errs, countPaginationFirst, "first", "VP011")) linkCountErrs=true;
		if (checkLinkCount(errs, countPaginationPrev, "previous", "VP012")) linkCountErrs=true;
		if (checkLinkCount(errs, countPaginationNext, "next", "VP013")) linkCountErrs=true;
		if (checkLinkCount(errs, countPaginationLast, "last", "VP014")) linkCountErrs=true;

		if (!linkCountErrs) {
			let numPaginations=countPaginationFirst+countPaginationPrev+countPaginationNext+countPaginationLast;
			if (numPaginations!=0 && numPaginations!=2 && numPaginations!=4)
				errs.addError({code:"VP020", message:`only 0, 2 or 4 paginations links may be signalled in ${tva.e_RelatedMaterial.elementize()} elements for ${Location}`});
			else if (numPaginations==2) {
				if (countPaginationPrev==1 && countPaginationLast==1) 
					errs.addError({code:"VP021", message:`${"previous".quote()} and ${"last".quote()} links cannot be specified alone`});
				if (countPaginationFirst==1 && countPaginationNext==1) 
					errs.addError({code:"VP022", message:`${"first".quote()} and ${"next".quote()} links cannot be specified alone`});
			}
		}
	}


	/**
	 * validate the <RelatedMaterial> elements in  More Episodes response
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object}  BasicDescription    the element whose children should be checked
	 * @param {Class}   errs                errors found in validaton
	 */
	/* private */  ValidateRelatedMaterial_MoreEpisodes(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs) {
		
		if (!BasicDescription) {
			errs.addError({type:APPLICATION, code:"RMME000", message:"ValidateRelatedMaterial_MoreEpisodes() called with BasicDescription==null"});
			return;
		}
		switch (BasicDescription.parent().name()) {
			case tva.e_ProgramInformation:
				let rm=0, RelatedMaterial;
				while ((RelatedMaterial=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_RelatedMaterial, ++rm), CG_SCHEMA))!=null) 
					this.ValidatePromotionalStillImage(RelatedMaterial, errs, BasicDescription.name());
				break;
			case tva.e_GroupInformation:
				this.ValidatePagination(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, "More Episodes");
				break;
		}
	}


	//------------------------------- ERROR TEMPLATES -------------------------------
	/**
	 * Add an error message when the a required element is not present
	 *
	 * @param {Object} errs            Errors buffer
	 * @param {string} missingElement  Name of the missing element
	 * @param {string} parentElement   Name of the element which should contain the missingElement
	 * @param {string} schemaLoctation The location in the schema of the element
	 * @param {string} errCode         The error number to show in the log
	 */
	/* private */  NoChildElement(errs, missingElement, parentElement, schemaLocation=null, errCode=null) {
		errs.addError({code:errCode?errCode:"NC001", 
						message:`${missingElement} element not specified for ${parentElement}${schemaLocation?(" in "+schemaLocation):""}`});
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
	/* private */  InvalidHrefValue(errs, value, src, loc=null, errCode=null) {
		errs.addError({code:errCode?errCode:"HV001", message:`invalid ${tva.a_href.attribute()}=${value.quote()} specified for ${src}${loc?(" in "+loc):""}`});
	}


	/**
	 * Add an error message when the MediaLocator does not contain a MediaUri sub-element
	 *
	 * @param {Object} errs Errors buffer
	 * @param {String} src The type of element with the <MediaLocator>
	 * @param {String} loc The location of the element
	 * @param {string} errCode The error number to show in the log
	 */
	/* private */  NoAuxiliaryURI(errs, src, loc, errCode=null) {
		this.NoChildElement(errs, tva.e_AuxiliaryURI.elementize(), `${src} ${tva.e_MediaLocator.elementize()}`, loc, errCode?errCode:"AU001");
	}


	/** TemplateAITPromotional Still Image
	 *
	 * @param {Object} RelatedMaterial   the <RelatedMaterial> element (a libxmls ojbect tree) to be checked
	 * @param {Object} errs              The class where errors and warnings relating to the serivce list processing are stored 
	 * @param {string} Location          The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
	 */
	/* private */  ValidateTemplateAIT(RelatedMaterial, errs, Location) {
		
		if (!RelatedMaterial) {
			errs.addError({type:APPLICATION, code:"TA000", message:"ValidateTemplateAIT() called with RelatedMaterial==null"});
			return;
		}
		let HowRelated=null, MediaLocator=[];

		let children=RelatedMaterial.childNodes();
		if (children) children.forEachSubElement(elem => {
			switch (elem.name()) {
				case tva.e_HowRelated:
					HowRelated=elem;
					break;
				case tva.e_MediaLocator:
					MediaLocator.push(elem);
					break;
			}
		});

		if (!HowRelated) {
			this.NoChildElement(errs, tva.e_HowRelated.elementize(), RelatedMaterial.name(), Location, "TA001");
			return;
		}
		
		checkAttributes(HowRelated, [tva.a_href], [], errs, "TA002");
		if (HowRelated.attr(tva.a_href)) {
			if (HowRelated.attr(tva.a_href).value()!=dvbi.TEMPLATE_AIT_URI) 
				errs.addError({code:"TA003", message:`${tva.a_href.attribute(tva.e_HowRelated)}=${HowRelated.attr(tva.a_href).value().quote()} does not designate a Template AIT`});
			else {		
				if (MediaLocator.length!=0) 
					MediaLocator.forEach(ml => {
						let subElems=ml.childNodes(), hasAuxiliaryURI=false;
						if (subElems) subElems.forEachSubElement(child => {
							if (child.name()==tva.e_AuxiliaryURI) {
								hasAuxiliaryURI=true;
								checkAttributes(child, [tva.a_contentType], [], errs, "TA010");
								if (child.attr(tva.a_contentType)) {
									let contentType=child.attr(tva.a_contentType).value();
									if (contentType!=dvbi.XML_AIT_CONTENT_TYPE) 
										errs.addError({code:"TA011", 
											message:`invalid ${tva.a_contentType.attribute()}=${contentType.quote()} specified for ${RelatedMaterial.name().elementize()}${tva.e_MediaLocator.elementize()} in ${Location}`});
								}
							}
						});	
						if (!hasAuxiliaryURI) 
							this.NoAuxiliaryURI(errs, "template AIT", Location, "TA012");
					});
				else 
					this.NoChildElement(errs, tva.e_MediaLocator.elementize(), RelatedMaterial.name(), Location, "TA013");
			}
		}
	}


	/**
	 * verifies if the specified RelatedMaterial contains a Promotional Still Image
	 *
	 * @param {Object} RelatedMaterial   the <RelatedMaterial> element (a libxmls ojbect tree) to be checked
	 * @param {Object} errs              The class where errors and warnings relating to the serivce list processing are stored 
	 * @param {string} Location          The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
	 */
	/* private */  ValidatePromotionalStillImage(RelatedMaterial, errs, Location) {
		
		if (!RelatedMaterial) {
			errs.addError({type:APPLICATION, code:"PS000", message:"ValidatePromotionalStillImage() called with RelatedMaterial==null"});
			return;
		}
		let HowRelated=null, Format=null, MediaLocator=[];
		let children=RelatedMaterial.childNodes();
		if (children) children.forEachSubElement(elem => {
			switch (elem.name()) {
				case tva.e_HowRelated:
					HowRelated=elem;
					break;
				case tva.e_Format:
					Format=elem;
					break;
				case tva.e_MediaLocator:
					MediaLocator.push(elem);
					break;
			}
		});

		if (!HowRelated) {
			this.NochildElement(errs, tva.e_HowRelated.elementize(), RelatedMaterial.name(), Location, "PS001");
			return;
		}
		
		checkAttributes(HowRelated, [tva.a_href], [], errs, "PS002");
		if (HowRelated.attr(tva.a_href)) {
			if (HowRelated.attr(tva.a_href).value()!=dvbi.PROMOTIONAL_STILL_IMAGE_URI) 
				errs.addError({code:"PS010", message:`${tva.a_href.attribute(tva.e_HowRelated)}=${HowRelated.attr(tva.a_href).value().quote()} does not designate a Promotional Still Image`});
			else {
				let isJPEG=false, isPNG=false;
				if (Format) {
					let subElems=Format.childNodes(), hasStillPictureFormat=false;
					if (subElems) subElems.forEachSubElement(child => {
						if (child.name()==tva.e_StillPictureFormat) {
							hasStillPictureFormat=true;
							
							checkAttributes(child, [tva.a_horizontalSize, tva.a_verticalSize, tva.a_href], [], errs, "PS021");
							
							if (child.attr(tva.a_href)) {
								let href=child.attr(tva.a_href).value();
								switch (href) {
									case dvbi.JPEG_IMAGE_CS_VALUE:
										isJPEG=true;
										break;
									case dvbi.PNG_IMAGE_CS_VALUE:
										isPNG=true;
										break;
									default:
										this.InvalidHrefValue(errs, href, `${RelatedMaterial.name()}.${tva.e_Format}.${tva.e_StillPictureFormat}`, Location, "PS022");
								}
							}
						}
					});
					if (!hasStillPictureFormat) 
						this.NoChildElement(errs, tva.e_StillPictureFormat.elementize(), tva.e_Format, Location, "PS023");
				}

				if (MediaLocator.length!=0) 
					MediaLocator.forEach(ml => {
						let subElems=ml.childNodes(), hasMediaURI=false;
						if (subElems) subElems.forEachSubElement(child => {
							if (child.name()==tva.e_MediaUri) {
								hasMediaURI=true;
								checkAttributes(child, [tva.a_contentType], [], errs, "PS031");
								if (child.attr(tva.a_contentType)) {
									let contentType=child.attr(tva.a_contentType).value();
									if (!isJPEGmime(contentType) && !isPNGmime(contentType)) 
										errs.addError({code:"PS032", 
														message:`invalid ${tva.a_contentType.attribute(tva.e_MediaLocator)}=${contentType.quote()} specified for ${RelatedMaterial.name().elementize()} in ${Location}`});
									if (Format && ((isJPEGmime(contentType) && !isJPEG) || (isPNGmime(contentType) && !isPNG))) 
										errs.addError({code:"PS033",
														message:`conflicting media types in ${tva.e_Format.elementize()} and ${tva.e_MediaUri.elementize()} for ${Location}`});
								}
								if (!isHTTPURL(child.text()))
									errs.addError({code:"PS034", message:`${tva.e_MediaUri.elementize()}=${child.text().quote()} is not a valid Image URL`, key:"invalid URL"});
							}
						});
						if (!hasMediaURI) 
							this.NoMediaLocator(errs, "logo", Location);
					});
				else 
					this.NoChildElement(errs, tva.e_MediaLocator, RelatedMaterial.name().elementize(), Location, "PS039");
			}
		}
	}


	/**
	 * validate the <RelatedMaterial> elements specified in a Box Set List
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object}  BasicDescription    the element whose children should be checked
	 * @param {Class}   errs                errors found in validaton
	 */
	/* private */  ValidateRelatedMaterial_BoxSetList(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs) {
		
		if (!BasicDescription) {
			errs.addError({type:APPLICATION, code:"MB000", message:"ValidateRelatedMaterial_BoxSetList() called with BasicDescription==null"});
			return;
		}
		let countImage=0, countTemplateAIT=0, hasPagination=false;
		let rm=0, RelatedMaterial;
		while ((RelatedMaterial=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_RelatedMaterial, ++rm), CG_SCHEMA))!=null) {
			let HowRelated=RelatedMaterial.get(xPath(SCHEMA_PREFIX, tva.e_HowRelated), CG_SCHEMA);
			if (!HowRelated) 
				this.NoChildElement(errs, tva.e_HowRelated.elementize(), tva.e_RelatedMaterial.elementize());
			else {		
				checkAttributes(HowRelated, [tva.a_href], [], errs, "MB010");
				if (HowRelated.attr(tva.a_href)) {
					let hrHref=HowRelated.attr(tva.a_href).value();
					switch (hrHref) {
						case dvbi.TEMPLATE_AIT_URI:
							countTemplateAIT++;
							this.ValidateTemplateAIT(RelatedMaterial, errs, BasicDescription.name().elementize());
							break;
						case dvbi.PAGINATION_FIRST_URI:
						case dvbi.PAGINATION_PREV_URI:
						case dvbi.PAGINATION_NEXT_URI:
						case dvbi.PAGINATION_LAST_URI:
							// pagination links are allowed, but checked in ValidatePagination()
							hasPagination=true;
							break;
						case dvbi.PROMOTIONAL_STILL_IMAGE_URI:  // promotional still image
							countImage++;
							this.ValidatePromotionalStillImage(RelatedMaterial, errs, BasicDescription.name().elementize());
							break;
						default:
							this.InvalidHrefValue(errs, hrHref, tva.e_HowRelated.elementize(), `${tva.e_RelatedMaterial.elementize()} in Box Set List`, "MB011");
					}	
				}
			}
		}
		if (countTemplateAIT==0)
			errs.addError({code:"MB021", message:`a ${tva.e_RelatedMaterial.elementize()} element signalling the Template XML AIT must be specified for a Box Set List`});
		if (countTemplateAIT>1)
			errs.addError({code:"MB022", message:`only one ${tva.e_RelatedMaterial.elementize()} element signalling the Template XML AIT can be specified for a Box Set List`});
		if (countImage>1)
			errs.addError({code:"MB023", message:`only one ${tva.e_RelatedMaterial.elementize()} element signalling the promotional still image can be specified for a Box Set List`});
		
		if (hasPagination)
			this.ValidatePagination(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, "Box Set List");
	}


	/**
	 * validate the <Title> elements specified
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object}  BasicDescription    the element whose children should be checked
	 * @param {boolean} allowSecondary      indicates if  Title with @type="secondary" is permitted
	 * @param {Class}   errs                errors found in validaton
	 * @param {string}  parentLanguage	    the xml:lang of the parent element to ProgramInformation
	 * @param {string}  errCode             error code prefix to be used in reports, if not present then use local codes
	 * @param {boolean} TypeIsRequired      true is the @type is a required attribute in this use of <Title>
	 */
	/* private */  ValidateTitle(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, allowSecondary, errs, parentLanguage, errCode=null, TypeIsRequired=false) {
		
		if (!BasicDescription) {
			errs.addError({type:APPLICATION, code:"VT000", message:"ValidateTitle() called with BasicDescription==null"});
			return;
		}
		
		let mainSet=[], secondarySet=[];

		function analyseLang(lang, index, array) {
			if (!isIn(mainSet, lang)) {
				let tLoc= lang!=DEFAULT_LANGUAGE ? ` for @xml:${tva.a_lang}=${lang.quote()}` : "";
				errs.addError({code:errCode?`${errCode}-16`:"VT016", 
					message:`${tva.a_type.attribute()}=${mpeg7.TITLE_TYPE_SECONDARY.quote()} specified without ${tva.a_type.attribute()}=${mpeg7.TITLE_TYPE_MAIN.quote()}${tLoc}`});
			}
		}

		let t=0, Title, requiredAttributes=[], optionalAttributes=[tva.a_lang];
		if (TypeIsRequired) 
			requiredAttributes.push(tva.a_type);
		else optionalAttributes.push(tva.a_type);
		while ((Title=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_Title, ++t), CG_SCHEMA))!=null) {

			checkAttributes(Title, requiredAttributes, optionalAttributes, errs, errCode?`${errCode}-1`:"VT001");
			
			let titleType=Title.attr(tva.a_type) ? Title.attr(tva.a_type).value() : mpeg7.DEFAULT_TITLE_TYPE;
			let titleLang=this.GetLanguage(this.knownLanguages, errs, Title, parentLanguage, false, "VT002");
			let titleStr=unEntity(Title.text());
			
			if (titleStr.length > dvbi.MAX_TITLE_LENGTH)
				errs.addError({code:errCode?`${errCode}-11`:"VT011", message:`${tva.e_Title.elementize()} length exceeds ${dvbi.MAX_TITLE_LENGTH} characters`});
				
			switch (titleType) {
				case mpeg7.TITLE_TYPE_MAIN:
					if (isIn(mainSet, titleLang))
						errs.addError({code:errCode?`${errCode}-12`:"VT012", 
							message:`only a single language (${titleLang}) is permitted for ${tva.a_type.attribute(tva.e_Title)}=${mpeg7.TITLE_TYPE_MAIN.quote()}`});
					else mainSet.push(titleLang);
					break;
				case mpeg7.TITLE_TYPE_SECONDARY:
					if (allowSecondary) {
						if (isIn(secondarySet, titleLang))
							errs.addError({code:errCode?`${errCode}-13`:"VT013", 
								message:`only a single language (${titleLang}) is permitted for ${tva.a_type.attribute(tva.e_Title)}=${mpeg7.TITLE_TYPE_SECONDARY.quote()}`});
						else secondarySet.push(titleLang);
					}
					else 
						errs.addError({code:errCode?`${errCode}-14`:"VT014", 
							message:`${tva.a_type.attribute(tva.e_Title)}=${mpeg7.TITLE_TYPE_SECONDARY.quote()} is not permitted for this ${BasicDescription.name().elementize()}`});
					break;
				default:	
					errs.addError({code:errCode?`${errCode}-15`:"VT015", 
						message:`${tva.a_type.attribute()} must be ${mpeg7.TITLE_TYPE_MAIN.quote()} or ${mpeg7.TITLE_TYPE_SECONDARY.quote()} for ${tva.e_Title.elementize()}`});
			}	
			secondarySet.forEach(analyseLang);
		}
	}


	/**
	 * validate the <BasicDescription> element against the profile for the given request/response type
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} parentElement  	   the element whose children should be checked
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {Class}  errs                errors found in validaton
	 * @param {string} parentLanguage	   the xml:lang of the parent element to parentElement
	 * @param {object} categoryGroup       the GroupInformationElement that others must refer to through <MemberOf>
	 */
	/* private */  ValidateBasicDescription(CG_SCHEMA, SCHEMA_PREFIX, parentElement, requestType, errs, parentLanguage, categoryGroup) {

		if (!parentElement) {
			errs.addError({type:APPLICATION, code:"BD000", message:"ValidateBasicDescription() called with parentElement==null"});
			return;
		}

		let isParentGroup=parentElement==categoryGroup;
		let BasicDescription=parentElement.get(xPath(SCHEMA_PREFIX, tva.e_BasicDescription), CG_SCHEMA);
		if (!BasicDescription) {
			this.NoChildElement(errs, tva.e_BasicDescription.elementize(), parentElement.name());
			return;
		}

		switch (parentElement.name()) {
			case tva.e_ProgramInformation:
				switch (requestType) {
					case CG_REQUEST_SCHEDULE_NOWNEXT:  //6.10.5.2
					case CG_REQUEST_SCHEDULE_WINDOW:
					case CG_REQUEST_SCHEDULE_TIME:
						checkTopElementsAndCardinality(BasicDescription, 
							[{name:tva.e_Title, maxOccurs:Infinity},
							 {name:tva.e_Synopsis, maxOccurs:Infinity},
							 {name:tva.e_Genre, minOccurs:0},
							 {name:tva.e_ParentalGuidance, minOccurs:0, maxOccurs:2},
							 {name:tva.e_RelatedMaterial, minOccurs:0, }],
							false, errs, "BD010");
						this.ValidateTitle(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, true, errs, parentLanguage, "BD011", true);
						this.ValidateSynopsis(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, [tva.SYNOPSIS_MEDIUM_LABEL], [tva.SYNOPSIS_SHORT_LABEL], requestType, errs, parentLanguage, "BD012");
						this.ValidateGenre(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, "BD013");
						this.ValidateParentalGuidance(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, "BD014");
						this.ValidateRelatedMaterial(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription,  errs);
						break;
					case CG_REQUEST_PROGRAM:	// 6.10.5.3
						checkTopElementsAndCardinality(BasicDescription,
							[{name:tva.e_Title, maxOccurs:Infinity},
							 {name:tva.e_Synopsis, maxOccurs:Infinity},
							 {name:tva.e_Keyword, minOccurs:0, maxOccurs:Infinity},
							 {name:tva.e_Genre, minOccurs:0},
							 {name:tva.e_ParentalGuidance, minOccurs:0, maxOccurs:2},
							 {name:tva.e_CreditsList, minOccurs:0},
							 {name:tva.e_RelatedMaterial, minOccurs:0}],
							false, errs, "BD020");
						this.ValidateTitle(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, true, errs, parentLanguage, "BD021", true);
						this.ValidateSynopsis(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, [tva.SYNOPSIS_MEDIUM_LABEL], [tva.SYNOPSIS_SHORT_LABEL, tva.SYNOPSIS_LONG_LABEL], requestType, errs, parentLanguage, "BD022");
						this.ValidateKeyword(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, 0, 20, errs, parentLanguage, "BD023");
						this.ValidateGenre(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, "BD024");
						this.ValidateParentalGuidance(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, "BD025");	
						this.ValidateCreditsList(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription,  errs, "BD026");	
						this.ValidateRelatedMaterial(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription,  errs);						
						break;
					case CG_REQUEST_BS_CONTENTS:  // 6.10.5.4					
						checkTopElementsAndCardinality(BasicDescription,
							[{name:tva.e_Title, maxOccurs:Infinity},
							 {name:tva.e_Synopsis, minOccurs:0, maxOccurs:Infinity},
							 {name:tva.e_ParentalGuidance, minOccurs:0, maxOccurs:2},
							 {name:tva.e_RelatedMaterial, minOccurs:0}],
							false, errs, "BD030");
						this.ValidateTitle(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, true, errs, parentLanguage, "BD031", true);
						this.ValidateSynopsis(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, [], [tva.SYNOPSIS_MEDIUM_LABEL], requestType, errs, parentLanguage, "BD032");
						this.ValidateParentalGuidance(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, "BD033");
						this.ValidateRelatedMaterial(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription,  errs);
						break;
					case CG_REQUEST_MORE_EPISODES:
						checkTopElementsAndCardinality(BasicDescription,
							[{name:tva.e_Title, maxOccurs:Infinity},
							 {name:tva.e_RelatedMaterial, minOccurs:0}],
							false, errs, "BD040");
						this.ValidateTitle(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, true, errs, parentLanguage, "BD041", true);
						this.ValidateRelatedMaterial_MoreEpisodes(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs);
						break;
					default:
						errs.addError({type:APPLICATION, code:"BD050", message:`ValidateBasicDescription() called with invalid requestType/element (${requestType}/${parentElement.name()})`});
				}
				break;

			case tva.e_GroupInformation:
				switch (requestType) {
					case CG_REQUEST_SCHEDULE_NOWNEXT:  //6.10.17.3 - BasicDescription for NowNext should be empty
					case CG_REQUEST_SCHEDULE_WINDOW:
						checkTopElementsAndCardinality(BasicDescription, [], false, errs, "BD060");
						break;
					case CG_REQUEST_BS_CONTENTS:
						// BasicDescription must be empty
						checkTopElementsAndCardinality(BasicDescription, [], false, errs, "BD090");
						break;
					case CG_REQUEST_BS_LISTS:	// 6.10.5.5
						if (isParentGroup)
							checkTopElementsAndCardinality(BasicDescription, [{name:tva.e_Title, maxOccurs:Infinity}], false, errs, "BD061");
						else checkTopElementsAndCardinality(BasicDescription, 
									[{name:tva.e_Title, maxOccurs:Infinity},
									 {name:tva.e_Synopsis, maxOccurs:Infinity},
									 {name:tva.e_Keyword, minOccurs:0, maxOccurs:Infinity},
									 {name:tva.e_RelatedMaterial, minOccurs:0, maxOccurs:Infinity}],
									false, errs, "BD062");
						
						this.ValidateTitle(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, false, errs, parentLanguage, "BD063", false);						
						if (!isParentGroup) {
							this.ValidateSynopsis(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, [tva.SYNOPSIS_MEDIUM_LABEL], [], requestType, errs, parentLanguage, "BD064");
							this.ValidateKeyword(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, 0, 20, errs, parentLanguage, "BD065");
							this.ValidateRelatedMaterial_BoxSetList(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs);
						}
					break;
					case CG_REQUEST_MORE_EPISODES: 
						checkTopElementsAndCardinality(BasicDescription, [{name:tva.e_RelatedMaterial, maxOccurs:4}], false, errs, "BD070");
						this.ValidateRelatedMaterial_MoreEpisodes(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs);
						break;
					case CG_REQUEST_BS_CATEGORIES:
						if (isParentGroup)
							checkTopElementsAndCardinality(BasicDescription, [{name:tva.e_Title, maxOccurs:Infinity}], false, errs, "BD080");
						else checkTopElementsAndCardinality(BasicDescription,
										[{name:tva.e_Title, maxOccurs:Infinity},
										 {name:tva.e_Synopsis, maxOccurs:Infinity},
										 {name:tva.e_Genre, minOccurs:0},
										 {name:tva.e_RelatedMaterial, minOccurs:0}],
										false, errs, "BD081");
						this.ValidateTitle(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, false, errs, parentLanguage, "BD082", false);
						if (!isParentGroup)
							this.ValidateSynopsis(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, [tva.SYNOPSIS_SHORT_LABEL], [], requestType, errs, parentLanguage, "BD083");
						this.ValidateGenre(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, "BD084");
						this.ValidateRelatedMaterial(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs);
						break;
					default:
						errs.addError({type:APPLICATION, code:"BD100", message:`ValidateBasicDescription() called with invalid requestType/element (${requestType}/${parentElement.name()})`});
					}
				break;
			default:
				errs.addError({type:APPLICATION, code:"BD003", message:`ValidateBasicDescription() called with invalid element (${parentElement.name()})`});
		}
	}


	/**
	 * validate the <ProgramInformation> element against the profile for the given request/response type
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} ProgramInformation  the element whose children should be checked
	 * @param {string} parentLanguage	   the xml:lang of the parent element to ProgramInformation
	 * @param {array}  programCRIDs        array to record CRIDs for later use 
	 * @param {array}  groupCRIDs          array of CRIDs found in the GroupInformationTable (null if not used)
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {array}  indexes             array of @index values from other elements in the same table - for duplicate detection
	 * @param {Class}  errs                errors found in validaton
	 * @returns {String}				CRID if the current program, if this is it
	 */
	/* private */  ValidateProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramInformation, parentLanguage, programCRIDs, groupCRIDs, requestType, indexes, errs) {
		
		if (!ProgramInformation) {
			errs.addError({type:APPLICATION, code:"PI000", message:"ValidateProgramInformation() called with ProgramInformation==null"});
			return null;
		}
		
		checkTopElementsAndCardinality(ProgramInformation, 
				[{name:tva.e_BasicDescription},
				 {name:tva.e_OtherIdentifier, minOccurs:0, maxOccurs:Infinity},
				 {name:tva.e_MemberOf, minOccurs:0, maxOccurs:Infinity},
				 {name:tva.e_EpisodeOf, minOccurs:0, maxOccurs:Infinity}],
				false, errs, "PI001");		
		checkAttributes(ProgramInformation, [tva.a_programId], [tva.a_lang], errs, "PI002");

		let piLang=this.GetLanguage(this.knownLanguages, errs, ProgramInformation, parentLanguage, false, "PI010");
		let isCurrentProgram=false, programCRID=null;
		
		if (ProgramInformation.attr(tva.a_programId)) {
			programCRID=ProgramInformation.attr(tva.a_programId).value();
			if (!isCRIDURI(programCRID)) 
				errs.addError({code:"PI011", message:`${tva.a_programId.attribute(ProgramInformation.name())} is not a valid CRID (${programCRID})`});
			if (isIni(programCRIDs, programCRID))
				errs.addError({code:"PI012", message:`${tva.a_programId.attribute(ProgramInformation.name())}=${programCRID.quote()} is already used`});
			else programCRIDs.push(programCRID);
		}

		// <ProgramInformation><BasicDescription>
		this.ValidateBasicDescription(CG_SCHEMA, SCHEMA_PREFIX, ProgramInformation, requestType, errs, piLang, null);

		let children=ProgramInformation.childNodes();
		if (children) children.forEachSubElement(child => {
			switch (child.name()) {
				case tva.e_OtherIdentifier:		// <ProgramInformation><OtherIdentifier>
					if (requestType==CG_REQUEST_MORE_EPISODES)
						errs.addError({code:"PI021", message:`${tva.e_OtherIdentifier.elementize()} is not permitted in this request type`});
					break;
				case tva.e_EpisodeOf:			// <ProgramInformation><EpisodeOf>
					checkAttributes(child, [tva.a_crid], [], errs, "PI031");
					
					// <ProgramInformation><EpisodeOf>@crid
					if (child.attr(tva.a_crid)) {
						let foundCRID=child.attr(tva.a_crid).value();
						if (groupCRIDs && !isIni(groupCRIDs, foundCRID)) 
							errs.addError({code:"PI032", 
								message:`${tva.a_crid.attribute(`${ProgramInformation.name()}.${tva.e_EpisodeOf}`)}=${foundCRID.quote()} is not a defined Group CRID for ${tva.e_EpisodeOf.elementize()}`});
						else
							if (!isCRIDURI(foundCRID))
								errs.addError({code:"PI033", message:`${tva.a_crid.attribute(`${ProgramInformation.name()}.${tva.e_EpisodeOf}`)}=${foundCRID.quote()} is not a valid CRID`});
					}
					break;
				case tva.e_MemberOf:			// <ProgramInformation><MemberOf>
					if ([CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_WINDOW].includes(requestType)) {
						// xsi:type is optional for Now/Next
						checkAttributes(child, [tva.a_index, tva.a_crid], [tva.a_type], errs, "PI041");
						if (child.attr(tva.a_crid) && child.attr(tva.a_crid).value()==dvbi.CRID_NOW)
							isCurrentProgram=true;
					}
					else 
						checkAttributes(child, [tva.a_type, tva.a_index, tva.a_crid], [], errs, "PI042");
							
					// <ProgramInformation><MemberOf>@xsi:type
					if (child.attr(tva.a_type) && child.attr(tva.a_type).value()!=tva.t_MemberOfType)
						errs.addError({code:"PI043", message:`${attribute(`xsi:${tva.a_type}`)} must be ${tva.t_MemberOfType.quote()} for ${ProgramInformation.name()}.${tva.e_MemberOf}`});
				
					// <ProgramInformation><MemberOf>@crid
					let foundCRID=null;
					if (child.attr(tva.a_crid)) {
						foundCRID=child.attr(tva.a_crid).value();
						if (groupCRIDs && !isIni(groupCRIDs, foundCRID)) 
							errs.addError({code:"PI044", 
								message:`${tva.a_crid.attribute(`${ProgramInformation.name()}.${tva.e_MemberOf}`)}=${foundCRID.quote()} is not a defined Group CRID for ${tva.e_MemberOf.elementize()}`});
						else
							if (!isCRIDURI(foundCRID))
								errs.addError({code:"PI045", message:`${tva.a_crid.attribute(`${ProgramInformation.name()}.${tva.e_MemberOf}`)}=${foundCRID.quote()} is not a valid CRID`});
					}
					
					// <ProgramInformation><MemberOf>@index
					if (child.attr(tva.a_index)) {
						let index=valUnsignedInt(child.attr(tva.a_index).value());
						let indexInCRID=`${(foundCRID?foundCRID:"noCRID")}(${index})`;
						if (isIni(indexes, indexInCRID))
							errs.addError({code:"PI046", message:`${tva.a_index.attribute(tva.e_MemberOf)}=${index} is in use by another ${ProgramInformation.name()} element`});
						else 
							indexes.push(indexInCRID);
					}
					break;			
			}	
		});

		return isCurrentProgram?programCRID:null;
	}


	/**
	 * find and validate any <ProgramInformation> elements in the <ProgramInformationTable>
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} ProgramDescription  the element containing the <ProgramInformationTable>
	 * @param {string} parentLang          XML language of the parent element (or its parent(s))
	 * @param {array}  programCRIDs        array to record CRIDs for later use 
	 * @param {array}  groupCRIDs          array of CRIDs found in the GroupInformationTable (null if not used)
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {Class}  errs                errors found in validaton
	 * @param {integer} o.childCount       the number of child elements to be present (to match GroupInformation@numOfItems)
	 * @returns {string} the CRID of the currently airing program (that which is a member of the "now" structural crid)
	 */
	/* private */  CheckProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, parentLang, programCRIDs, groupCRIDs, requestType, errs, o=null) { 
		if (!ProgramDescription) {
			errs.addError({type:APPLICATION, code:"PI100", message:"CheckProgramInformation() called with ProgramDescription==null"});
			return null;
		}
			
		let ProgramInformationTable=ProgramDescription.get(xPath(SCHEMA_PREFIX, tva.e_ProgramInformationTable), CG_SCHEMA);
		if (!ProgramInformationTable) {
			errs.addError({code:"PI101", message:`${tva.e_ProgramInformationTable.elementize()} not specified in ${ProgramDescription.name().elementize()}`});
			return null;
		}
		checkAttributes(ProgramInformationTable, [], [tva.a_lang], errs, "PI102");
		let pitLang=this.GetLanguage(this.knownLanguages, errs, ProgramInformationTable, parentLang, false, "PI103");

		let pi=0, ProgramInformation, cnt=0, indexes=[], currentProgramCRID=null;
		while ((ProgramInformation=ProgramInformationTable.get(xPath(SCHEMA_PREFIX, tva.e_ProgramInformation, ++pi), CG_SCHEMA))!=null) {
			let t=this.ValidateProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramInformation, pitLang, programCRIDs, groupCRIDs, requestType, indexes, errs);
			if (t) currentProgramCRID=t;
			cnt++; 
		}

		if (o && o.childCount!=0) {
			if (o.childCount!=cnt)
				errs.addError({code:"PI110", 
					message:`number of items (${cnt}) in ${tva.e_ProgramInformationTable.elementize()} does match ${tva.a_numOfItems.attribute(tva.e_GroupInformation)} specified in ${CATEGORY_GROUP_NAME} (${o.childCount})`});
		}
		return currentProgramCRID;
	}


	/**
	 * validate the <GroupInformation> element for Box Set related requests
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} GroupInformation    the element whose children should be checked
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {Class}  errs                errors found in validaton
	 * @param {string} parentLanguage	   the xml:lang of the parent element to GroupInformation
	 * @param {object} categoryGroup       the GroupInformationElement that others must refer to through <MemberOf>
	 * @param {array}  indexes			   an accumulation of the @index values found
	 * @param {string} groupsFound         groupId values found (null if not needed)
	 */
	/* private */  ValidateGroupInformationBoxSets(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, parentLanguage, categoryGroup, indexes, groupsFound) {

		if (!GroupInformation) {
			errs.addError({type:APPLIACTION, code:"GIB000", message:"ValidateGroupInformationBoxSets() called with GroupInformation==null"});
			return;
		}
		let isParentGroup=GroupInformation==categoryGroup;
		
		switch (requestType) {
			case CG_REQUEST_BS_CATEGORIES:
				if (isParentGroup) {
					checkAttributes(GroupInformation, [tva.a_groupId], [tva.a_lang, tva.a_ordered, tva.a_numOfItems], errs, "GIB001");
					checkTopElementsAndCardinality(GroupInformation,
						[{name:tva.e_GroupType},
						 {name:tva.e_BasicDescription, minOccurs:0}],
						false, errs, "GIB002");
				}
				else {
					checkAttributes(GroupInformation, [tva.a_groupId], [tva.a_lang], errs, "GIB003");
					checkTopElementsAndCardinality(GroupInformation,
						[{name:tva.e_GroupType},
						 {name:tva.e_BasicDescription, minOccurs:0},
						 {name:tva.e_MemberOf}],
						false, errs, "GIB004");
				}
				break;
			case CG_REQUEST_BS_LISTS:
				if (isParentGroup) {
					checkAttributes(GroupInformation, [tva.a_groupId], [tva.a_lang, tva.a_ordered, tva.a_numOfItems], errs, "GIB005");
					checkTopElementsAndCardinality(GroupInformation,
						[{name:tva.e_GroupType},
						 {name:tva.e_BasicDescription, minOccurs:0}],
						false, errs, "GIB006");
				}
				else {
					checkAttributes(GroupInformation, [tva.a_groupId], [tva.a_lang, tva.a_serviceIDRef], errs, "GIB007");
					checkTopElementsAndCardinality(GroupInformation,
						[{name:tva.e_GroupType},
						 {name:tva.e_BasicDescription, minOccurs:0},
						 {name:tva.e_MemberOf}],
						false, errs, "GIB008");
				}
				break;
			case CG_REQUEST_BS_CONTENTS:
				checkAttributes(GroupInformation, [tva.a_groupId], [tva.a_lang, tva.a_ordered, tva.a_numOfItems, tva.a_serviceIDRef], errs, "GIB009");
				checkTopElementsAndCardinality(GroupInformation,
					[{name:tva.e_GroupType},
					 {name:tva.e_BasicDescription, minOccurs:0}],
					false, errs, "GIB010");
				break;
		}

		if (GroupInformation.attr(tva.a_groupId)) {
			let groupId=GroupInformation.attr(tva.a_groupId).value();
			if (isCRIDURI(groupId)) {
				if (groupsFound) 
					groupsFound.push(groupId);				
			}
			else
				errs.addError({code:"GIB021", message:`${tva.a_groupId.attribute(GroupInformation.name())} value ${groupId.quote()} is not a CRID`});
		}

		let categoryCRID=(categoryGroup && categoryGroup.attr(tva.a_groupId)) ? categoryGroup.attr(tva.a_groupId).value() : "";

		if ([CG_REQUEST_BS_LISTS, CG_REQUEST_BS_CATEGORIES].includes(requestType)) {
			if (!isParentGroup && GroupInformation.attr(tva.a_ordered)) 
				errs.addError({code:"GIB031", message:`${tva.a_ordered.attribute(GroupInformation.name())} is only permitted in the ${CATEGORY_GROUP_NAME}`});
			if (isParentGroup && !GroupInformation.attr(tva.a_ordered)) 
				errs.addError({code:"GIB032", message:`${tva.a_ordered.attribute(GroupInformation.name())} is required for this request type`});
			if (!isParentGroup && GroupInformation.attr(tva.a_numOfItems)) 
				errs.addError({code:"GIB033", message:`${tva.a_numOfItems.attribute(GroupInformation.name())} is only permitted in the ${CATEGORY_GROUP_NAME}`});
			if (isParentGroup && !GroupInformation.attr(tva.a_numOfItems)) 
				errs.addError({code:"GIB034", message:`${tva.a_numOfItems.attribute(GroupInformation.name())}is required for this request type`});
		}

		if (!isParentGroup) {
			let MemberOf=GroupInformation.get(xPath(SCHEMA_PREFIX, tva.e_MemberOf), CG_SCHEMA);
			if (MemberOf) {
				checkAttributes(MemberOf, [tva.a_type, tva.a_index, tva.a_crid], [], errs, "GIB041");
				if (MemberOf.attr(tva.a_type) && MemberOf.attr(tva.a_type).value()!=tva.t_MemberOfType)
					errs.addError({code:"GIB042", message:`${GroupInformation.name()}.${tva.e_MemberOf}@xsi:${tva.a_type} is invalid (${MemberOf.attr(tva.a_type).value().quote()})`});
				
				if (MemberOf.attr(tva.a_index)) {
					let index=valUnsignedInt(MemberOf.attr(tva.a_index).value());
					if (index>=1) {
						if (indexes) {
							if (indexes.includes(index)) 
								errs.addError({code:"GI043", message:`duplicated ${tva.a_index.attribute(`${GroupInformation.name()}.${tva.e_MemberOf}`)} values (${index})`});
							else indexes.push(index);
						}
					}
					else 
						errs.addError({code:"GIB44", message:`${tva.a_index.attribute(`${GroupInformation.name()}.${tva.e_MemberOf}`)} must be an integer >= 1 (parsed ${index})`});
				}

				if (MemberOf.attr(tva.a_crid) && MemberOf.attr(tva.a_crid).value()!=categoryCRID)
					errs.addError({code:"GIB045", 
						message:`${tva.a_crid.attribute(`${GroupInformation.name()}.${tva.e_MemberOf}`)} (${MemberOf.attr(tva.a_crid).value()}) does not match the ${CATEGORY_GROUP_NAME} crid (${categoryCRID})`});
			}
			else
				errs.addError({code:"GIB046", message:`${GroupInformation.name()} requires a ${tva.e_MemberOf.elementize()} element referring to the ${CATEGORY_GROUP_NAME} (${categoryCRID})`});
		}
		
		this.checkTAGUri(GroupInformation, errs, "GIB51");	
		
		// <GroupInformation><BasicDescription>
		this.ValidateBasicDescription(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, parentLanguage, categoryGroup);
	}


	/**
	 * validate the <GroupInformation> element for Schedules related requests
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} GroupInformation    the element whose children should be checked
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {Class}  errs                errors found in validaton
	 * @param {string} parentLanguage	   the xml:lang of the parent element to GroupInformation
	 * @param {object} categoryGroup       the GroupInformationElement that others must refer to through <MemberOf>
	 */
	/* private */  ValidateGroupInformationSchedules(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, parentLanguage, categoryGroup) {

		if (!GroupInformation) {
			errs.addError({type:APPLICATION, code:"GIS000", message:"ValidateGroupInformationSchedules() called with GroupInformation==null"});
			return;
		}
		checkAttributes(GroupInformation, [tva.a_groupId, tva.a_ordered, tva.a_numOfItems], [tva.a_lang], errs, "GIS001");

		if (GroupInformation.attr(tva.a_groupId)) {
			let groupId=GroupInformation.attr(tva.a_groupId).value();
			if ([CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_WINDOW].includes(requestType)) 
				if (!([dvbi.CRID_NOW, dvbi.CRID_LATER, dvbi.CRID_EARLIER].includes(groupId)))
					errs.addError({code:"GIS011", message:`${tva.a_groupId.attribute(GroupInformation.name())} value ${groupId.quote()} is valid for this request type`});
		}

		if ([CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_WINDOW].includes(requestType)) {		
			TrueValue(GroupInformation, tva.a_ordered, "GIS013", errs);
			if (!GroupInformation.attr(tva.a_numOfItems)) 
				errs.addError({code:"GIS015", message:`${tva.a_numOfItems.attribute(GroupInformation.name())} is required for this request type`});
		}

		// <GroupInformation><BasicDescription>
		this.ValidateBasicDescription(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, parentLanguage, categoryGroup);	
	}


	/**
	 * validate the <GroupInformation> element for More Episodes requests
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} GroupInformation    the element whose children should be checked
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {Class}  errs                errors found in validaton
	 * @param {string} parentLanguage	   the xml:lang of the parent element to GroupInformation
	 * @param {object} categoryGroup       the GroupInformationElement that others must refer to through <MemberOf>
	 * @param {string} groupsFound         groupId values found (null if not needed)
	 */
	/* private */  ValidateGroupInformationMoreEpisodes(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, parentLanguage, categoryGroup, groupsFound) {
		
		if (!GroupInformation) {
			errs.addError({type:APPLICATION, code:"GIM000", message:"ValidateGroupInformationMoreEpisodes() called with GroupInformation==null"});
			return;
		}
		if (categoryGroup) 
			errs.addError({code:"GIM001", message:`${CATEGORY_GROUP_NAME} should not be specified for this request type`});
		
		checkAttributes(GroupInformation, [tva.a_groupId, tva.a_ordered, tva.a_numOfItems], [tva.a_lang], errs, "GIM002");
		
		if (GroupInformation.attr(tva.a_groupId)) {
			let groupId=GroupInformation.attr(tva.a_groupId).value();
			if (!isCRIDURI(groupId)) 
				errs.addError({code:"GIM003", message:`${tva.a_groupId.attribute(GroupInformation.name())} value ${groupId.quote()} is not a valid CRID`});
			else 
				groupsFound.push(groupId);
		}

		TrueValue(GroupInformation, tva.a_ordered, "GIM004", errs, false);
		
		let GroupType=GroupInformation.get(xPath(SCHEMA_PREFIX, tva.e_GroupType), CG_SCHEMA);
		if (GroupType) {
			checkAttributes(GroupType, [tva.a_type, tva.a_value], [], errs, "GIM011");
			
			if (GroupType.attr(tva.a_type) && GroupType.attr(tva.a_type).value()!=tva.t_ProgramGroupTypeType) 
				errs.addError({code:"GIM012", message:`${tva.e_GroupType}@xsi:${tva.a_type} must be ${tva.t_ProgramGroupTypeType.quote()}`});
			if (GroupType.attr(tva.a_value) && GroupType.attr(tva.a_value).value()!="otherCollection") 
				errs.addError({code:"GIM013", message:`${tva.a_value.attribute(tva.e_GroupType)} must be ${"otherCollection".quote()}`});
		}
		else
			errs.addError({code:"GIM014", message:`${tva.e_GroupType.elementize()} is required in ${GroupInformation.name().elementize()}`});

		// <GroupInformation><BasicDescription>
		this.ValidateBasicDescription(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, parentLanguage, categoryGroup);
	}


	/**
	 * validate the <GroupInformation> element against the profile for the given request/response type
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} GroupInformation    the element whose children should be checked
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {Class}  errs                errors found in validaton
	 * @param {string} parentLanguage	   the xml:lang of the parent element to GroupInformation
	 * @param {object} categoryGroup       the GroupInformationElement that others must refer to through <MemberOf>
	 * @param {array}  indexes			   an accumulation of the @index values found
	 * @param {string} groupsFound         groupId values found (null if not needed)
	 */
	/* private */  ValidateGroupInformation(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, parentLanguage, categoryGroup, indexes, groupsFound) {

		if (!GroupInformation) {
			errs.addError({type:APPLICATION, code:"GI000", message:"ValidateGroupInformation() called with GroupInformation==null"});
			return;
		}

		let giLang=this.GetLanguage(this.knownLanguages, errs, GroupInformation, parentLanguage, false, "GI001");
		
		switch (requestType) {
			case CG_REQUEST_SCHEDULE_NOWNEXT:
			case CG_REQUEST_SCHEDULE_WINDOW:
				this.ValidateGroupInformationSchedules(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, giLang, categoryGroup);
				break;
			case CG_REQUEST_BS_CATEGORIES:
			case CG_REQUEST_BS_LISTS:
			case CG_REQUEST_BS_CONTENTS:
				this.ValidateGroupInformationBoxSets(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, giLang, categoryGroup, indexes, groupsFound);
				break;		
			case CG_REQUEST_MORE_EPISODES:
				this.ValidateGroupInformationMoreEpisodes(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, giLang, categoryGroup, groupsFound);
				break;				
		}

		let GroupType=GroupInformation.get(xPath(SCHEMA_PREFIX, tva.e_GroupType), CG_SCHEMA);
		if (GroupType) {
			if (!(GroupType.attr(tva.a_type) && GroupType.attr(tva.a_type).value()==tva.t_ProgramGroupTypeType)) 
				errs.addError({code:"GI011", message:`${tva.e_GroupType}@xsi:${tva.a_type}=${tva.t_ProgramGroupTypeType.quote()} is required`});
			if (!(GroupType.attr(tva.a_value) && GroupType.attr(tva.a_value).value()=="otherCollection")) 
				errs.addError({code:"GI022", message:`${tva.a_value.attribute(tva.e_GroupType)}=${"otherCollection".quote()} is required`});
		}
		else
			errs.addError({code:"GI014", message:`${tva.e_GroupType.elementize()} is required in ${GroupInformation.name().elementize()}`});
	}


	/**
	 * find and validate any <GroupInformation> elements in the <GroupInformationTable>
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} ProgramDescription  the element containing the <ProgramInformationTable>
	 * @param {string} parentLang          XML language of the parent element (or its parent(s))
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {array}  groupIds            buffer to recieve the group ids parsed (null if not needed)
	 * @param {Class}  errs                errors found in validaton
	 * @param {integer} o.childCount       the value from the @numItems attribute of the "category group"
	 */
	/* private */  CheckGroupInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, parentLang, requestType, groupIds, errs, o) { 
		
		if (!ProgramDescription) {
			errs.addError({type:APPLICATION, code:"GI100", message:"CheckGroupInformation() called with ProgramDescription==null"});
			return;
		}
		let gi, GroupInformation;
		let GroupInformationTable=ProgramDescription.get(xPath(SCHEMA_PREFIX, tva.e_GroupInformationTable), CG_SCHEMA);
		
		if (!GroupInformationTable) {
			errs.addError({code:"GI101", message:`${tva.e_GroupInformationTable.elementize()} not specified in ${ProgramDescription.name().elementize()}`});
			return;
		}
		let gitLang=this.GetLanguage(this.knownLanguages, errs, GroupInformationTable, parentLang, false, "GI102");

		// find which GroupInformation element is the "category group"
		let categoryGroup=null;
		if ([CG_REQUEST_BS_LISTS, CG_REQUEST_BS_CATEGORIES, CG_REQUEST_BS_CONTENTS].includes(requestType)) {
			gi=0;
			while ((GroupInformation=GroupInformationTable.get(xPath(SCHEMA_PREFIX, tva.e_GroupInformation, ++gi), CG_SCHEMA))!=null) {
				// this GroupInformation element is the "category group" if it does not contain a <MemberOf> element
				if (CountChildElements(GroupInformation, tva.e_MemberOf)==0) {
					// this GroupInformation element is not a member of another GroupInformation so it must be the "category group"
					if (categoryGroup)
						errs.addError({code:"GI111", message:`only a single ${CATEGORY_GROUP_NAME} can be present in ${tva.e_GroupInformationTable.elementize()}`});
					else categoryGroup=GroupInformation;
				}
			}
			if (!categoryGroup)
				errs.addError({code:"GI112", message:`a ${CATEGORY_GROUP_NAME} must be specified in ${tva.e_GroupInformationTable.elementize()} for this request type`});
		}
		
		let indexes=[], giCount=0;
		gi=0;
		while ((GroupInformation=GroupInformationTable.get(xPath(SCHEMA_PREFIX, tva.e_GroupInformation, ++gi), CG_SCHEMA))!=null) {
			this.ValidateGroupInformation(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, gitLang, categoryGroup, indexes, groupIds);
			if (GroupInformation!=categoryGroup) 
				giCount++;
		}
		if (categoryGroup) {
			let numOfItems=(categoryGroup.attr(tva.a_numOfItems) ? valUnsignedInt(categoryGroup.attr(tva.a_numOfItems).value()) : 0);
			if (requestType!=CG_REQUEST_BS_CONTENTS && numOfItems!=giCount)
				errs.addError({code:"GI113", 
								message:`${tva.a_numOfItems.attribute(tva.e_GroupInformation)} specified in ${CATEGORY_GROUP_NAME} (${numOfItems}) does match the number of items (${giCount})`});

			if (o) 
				o.childCount=numOfItems;
		}

		if (requestType==CG_REQUEST_MORE_EPISODES && giCount>1)
			errs.addError({code:"GI114", message:`only one ${tva.e_GroupInformation} element is premitted for this request type`});
	}


	/**
	 * validate the <GroupInformation> element against the profile for the given request/response type
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} GroupInformation    the element whose children should be checked
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {Class}  errs                errors found in validaton
	 * @param {string} parentLanguage	   the xml:lang of the parent element to GroupInformation
	 * @param {int}    numEarlier		   maximum number of <GroupInformation> elements that are earlier
	 * @param {int}    numNow			   maximum number of <GroupInformation> elements that are now
	 * @param {int}    numLater			   maximum number of <GroupInformation> elements that are later
	 * @param {array}  groupCRIDsFound     list of structural crids already found in this response
	 */
	/* private */  ValidateGroupInformationNowNext(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, parentLanguage, numEarlier, numNow, numLater, groupCRIDsFound) {

		function validValues(errs, numOfItems, numAllowed, grp) {
			if (numOfItems<=0)
				errs.addError({code:"VNN101", message:`${tva.a_numOfItems.attribute(tva.e_GroupInformation)} must be > 0 for ${grp.quote()}`});		
			if (numOfItems>numAllowed)
				errs.addError({code:"VNN102", message:`${tva.a_numOfItems.attribute(tva.e_GroupInformation)} must be <= ${numAllowed} for ${grp.quote()}`});
		}
		
		if (!GroupInformation) {
			errs.addError({type:APPLICATION, code:"VNN000", message:"ValidateGroupInformationNowNext() called with GroupInformation==null"});
			return;
		}

		// NOWNEXT and WINDOW GroupInformationElements contains the same syntax as other GroupInformationElements
		this.ValidateGroupInformation(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, parentLanguage, null, null, null );
		
		if (GroupInformation.attr(tva.a_groupId)) {
			let grp=GroupInformation.attr(tva.a_groupId).value();
			if ((grp==dvbi.CRID_EARLIER && numEarlier>0) || (grp==dvbi.CRID_NOW && numNow>0) || (grp==dvbi.CRID_LATER && numLater>0)) {
				let numOfItems=GroupInformation.attr(tva.a_numOfItems)?valUnsignedInt(GroupInformation.attr(tva.a_numOfItems).value()):-1;
				switch (grp) {
					case dvbi.CRID_EARLIER:
						validValues(errs, numOfItems, numEarlier, grp);
						break;
					case dvbi.CRID_NOW:
						validValues(errs, numOfItems, numNow, grp);
						break;
					case dvbi.CRID_LATER:
						validValues(errs, numOfItems, numLater, grp);
						break;
				}
				if (isIni(groupCRIDsFound, grp))
					errs.addError({code:"VNN001", message:`only a single ${grp.quote()} structural CRID is premitted in this request`});
				else 
					groupCRIDsFound.push(grp);
			}
			else 
				errs.addError({code:"VNN002", message:`${tva.e_GroupInformation.elementize()} for ${grp.quote()} is not permitted for this request type`});
		}
	}


	/**
	 * find and validate any <GroupInformation> elements used for now/next in the <GroupInformationTable>
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} ProgramDescription  the element containing the <ProgramInformationTable>
	 * @param {string} parentLang          XML language of the parent element (or its parent(s))
	 * @param {array}  groupIds            array of GroupInformation@CRID values found
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {Class}  errs                errors found in validaton
	 */
	/* private */  CheckGroupInformationNowNext(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, parentLang, groupIds, requestType, errs) { 
		
		if (!ProgramDescription) {
			errs.addError({type:APPLICATION, code:"NN000", message:"CheckGroupInformationNowNext() called with ProgramDescription==null"});
			return;
		}
		
		let GroupInformationTable=ProgramDescription.get(xPath(SCHEMA_PREFIX, tva.e_GroupInformationTable), CG_SCHEMA);
		if (!GroupInformationTable) {
			errs.addError({code:"NN001", message:`${tva.e_GroupInformationTable.elementize()} not specified in ${ProgramDescription.name().elementize()}`});
			return;
		}
		let gitLang=this.GetLanguage(this.knownLanguages, errs, GroupInformationTable, parentLang, false, "NN002");
		
		let gi=0, GroupInformation;
		while ((GroupInformation=GroupInformationTable.get(xPath(SCHEMA_PREFIX, tva.e_GroupInformation, ++gi), CG_SCHEMA))!=null) {	
			switch (requestType) {
				case CG_REQUEST_SCHEDULE_NOWNEXT:
					this.ValidateGroupInformationNowNext(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, gitLang, 0, 1, 1, groupIds);
					break;
				case CG_REQUEST_SCHEDULE_WINDOW:
					this.ValidateGroupInformationNowNext(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, gitLang, 10, 1, 10, groupIds);
					break;
				default:
					errs.addError({code:"NN003", message:`${tva.e_GroupInformation.elementize()} not processed for this request type`});
			}
		}
	}


	/**
	 * validate any <AVAttributes> elements in <InstanceDescription> elements
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} AVAttributes        the <AVAttributes> node to be checked
	 * @param {Class}  errs                errors found in validaton
	 */
	/* private */  ValidateAVAttributes(CG_SCHEMA, SCHEMA_PREFIX, AVAttributes, errs) {
		
		function isValidAudioMixType(mixType) { return [mpeg7.AUDIO_MIX_MONO, mpeg7.AUDIO_MIX_STEREO, mpeg7.AUDIO_MIX_5_1].includes(mixType); }
		function isValidAudioLanguagePurpose(purpose) {	return [dvbi.AUDIO_PURPOSE_MAIN, dvbi.AUDIO_PURPOSE_DESCRIPTION].includes(purpose);	}
		
		if (!AVAttributes) {
			errs.addError({type:APPLICATION, code:"AV000", message:"ValidateAVAttributes() called with AVAttributes==null"});
			return;
		}
		
		checkTopElementsAndCardinality(AVAttributes,
			[{name:tva.e_AudioAttributes, minOccurs:0, maxOccurs:Infinity},
			 {name:tva.e_VideoAttributes, minOccurs:0, maxOccurs:Infinity},
			 {name:tva.e_CaptioningAttributes, minOccurs:0, maxOccurs:Infinity}],
			false, errs, "AV001");

		// <AudioAttributes>
		let aa=0, AudioAttributes, foundAttributes=[], audioCounts=[];
		while ((AudioAttributes=AVAttributes.get(xPath(SCHEMA_PREFIX, tva.e_AudioAttributes, ++aa), CG_SCHEMA))!=null) {
			checkTopElementsAndCardinality(AudioAttributes,
				[{name:tva.e_MixType, minOccurs:0},
				 {name:tva.e_AudioLanguage, minOccurs:0}],
				false, errs, "AV010");

			let MixType=AudioAttributes.get(xPath(SCHEMA_PREFIX, tva.e_MixType), CG_SCHEMA);
			if (MixType) {
				checkAttributes(MixType, [tva.a_href], [], errs, "AV011"); 
				if (MixType.attr(tva.a_href) && !isValidAudioMixType(MixType.attr(tva.a_href).value()))
					errs.addError({code:"AV012", message:`${tva.e_AudioAttributes}.${tva.e_MixType} is not valid`});
			}
					
			let AudioLanguage=AudioAttributes.get(xPath(SCHEMA_PREFIX, tva.e_AudioLanguage), CG_SCHEMA);
			if (AudioLanguage) {
				checkAttributes(AudioLanguage, [tva.a_purpose], [], errs, "AV013" );
				let validLanguage=false, validPurpose=false, audioLang=AudioLanguage.text();
				if (AudioLanguage.attr(tva.a_purpose)) {
					if (!(validPurpose=isValidAudioLanguagePurpose(AudioLanguage.attr(tva.a_purpose).value())))
						errs.addError({code:"AV014", message:`${tva.a_purpose.attribute(tva.e_AudioLanguage)} is not valid`});
				}

				validLanguage=CheckLanguage(this.knownLanguages, errs, audioLang, `${tva.e_AudioAttributes}.${tva.e_AudioLanguage}`, "AV015");
				
				if (validLanguage && validPurpose) {	
					if (audioCounts[audioLang]===undefined)
						audioCounts[audioLang]=1;
					else audioCounts[audioLang]++;

					let combo=`${audioLang}!--!${AudioLanguage.attr(tva.a_purpose).value()}`;
					if (isIn(foundAttributes, combo))
						errs.addError({code:"AV016", message:`audio ${tva.a_purpose.attribute()} ${AudioLanguage.attr(tva.a_purpose).value().quote()} already specified for language ${audioLang.quote()}`});
					else
						foundAttributes.push(combo);
				}
			}
		}
		audioCounts.forEach(audioLang => {
			if (audioCounts[audioLang]>2)
				errs.addError({code:"AV020", message:`more than 2 ${tva.e_AudioAttributes.elementize()} elements for language ${audioLang.quote()}`});
		});
		
		// <VideoAttributes>
		let va=0, VideoAttributes;
		while ((VideoAttributes=AVAttributes.get(xPath(SCHEMA_PREFIX, tva.e_VideoAttributes, ++va), CG_SCHEMA))!=null) {
			checkTopElementsAndCardinality(VideoAttributes, 
				[{name:tva.e_HorizontalSize, minOccurs:0},
				 {name:tva.e_VerticalSize, minOccurs:0},
				 {name:tva.e_AspectRatio, minOccurs:0}],
				false, errs, "AV030");	
		}

		// <CaptioningAttributes>
		let CaptioningAttributes=AVAttributes.get(xPath(SCHEMA_PREFIX, tva.e_CaptioningAttributes), CG_SCHEMA);
		if (CaptioningAttributes) {
			checkTopElementsAndCardinality(CaptioningAttributes, [{name:tva.e_Coding, minOccurs:0}], false, errs, "AV040");	
			
			let Coding=CaptioningAttributes.get(xPath(SCHEMA_PREFIX, tva.e_Coding), CG_SCHEMA);
			if (Coding) {
				checkAttributes(Coding, [tva.a_href], [], errs, "AV041");
				if (Coding.attr(tva.a_href)) {
					let codingHref=Coding.attr(tva.a_href).value();
					if (!([dvbi.DVB_BITMAP_SUBTITLES, dvbi.DVB_CHARACTER_SUBTITLES, dvbi.EBU_TT_D].includes(codingHref)))
						errs.addError({code:"AV042", 
										message:`${tva.a_href.attribute(`${tva.e_CaptioningAttributes}.${tva.e_Coding}`)} is not valid - should be DVB (bitmap or character) or EBU TT-D`});
				}
			}		
		}
	}


	/**
	 * validate a <RelatedMaterial> element iconforms to the Restart Application Linking rules (A177r1 clause 6.5.5)
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} RelatedMaterial     the <RelatedMaterial> node to be checked
	 * @param {Class}  errs                errors found in validaton
	 * @returns {boolean} true if this RelatedMaterial element contains a restart link (proper HowRelated@href and MediaLocator.MediaUri and MediaLocator.AuxiliaryURI)
	 */
	/* private */  ValidateRestartRelatedMaterial(CG_SCHEMA, SCHEMA_PREFIX, RelatedMaterial, errs) {
		
		function isRestartLink(str) { return str==dvbi.RESTART_LINK; }

		if (!RelatedMaterial) {
			errs.addError({type:APPLICATION, code:"RR000", message:"ValidateRestartRelatedMaterial() called with RelatedMaterial==null"});
			return false;
		}

		let isRestart=checkTopElementsAndCardinality(RelatedMaterial, 
			[{name:tva.e_HowRelated},
			 {name:tva.e_MediaLocator}], 
			false, errs, "RR001");
		
		let HowRelated=RelatedMaterial.get(xPath(SCHEMA_PREFIX, tva.e_HowRelated), CG_SCHEMA);
		if (HowRelated) {
			checkAttributes(HowRelated, [tva.a_href], [], errs, "RR002");
			if (HowRelated.attr(tva.a_href)) {
				if (!isRestartLink(HowRelated.attr(tva.a_href).value())) {
					errs.addError({code:"RR003", message:`invalid ${tva.a_href.attribute(tva.e_HowRelated)} (${HowRelated.attr(tva.a_href).value()}) for Restart Application Link`});
					isRestart=false;
				}
			}
		}
		
		let MediaLocator=RelatedMaterial.get(xPath(SCHEMA_PREFIX, tva.e_MediaLocator), CG_SCHEMA);
		if (MediaLocator) 
			if (!checkTopElementsAndCardinality(MediaLocator,
					[{name:tva.e_MediaUri},
					 {name:tva.e_AuxiliaryURI}], 
					true, errs, "RR003"))
				isRestart=false;
		
		return isRestart;
	}


	/**
	 * validate any <InstanceDescription> elements in the <ScheduleEvent> and <OnDemandProgram> elements
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {string} VerifyType		   the type of verification to perform (OnDemandProgram | ScheduleEvent)
	 * @param {Object} InstanceDescription the <InstanceDescription> node to be checked
	 * @param {boolean} isCurrentProgram   indicates if this <InstanceDescription> element is for the currently airing program
	 * @param {Class}  errs                errors found in validaton
	 */
	/* private */  ValidateInstanceDescription(CG_SCHEMA, SCHEMA_PREFIX, VerifyType, InstanceDescription, isCurrentProgram, errs) {

		function isRestartAvailability(str) { return [dvbi.RESTART_AVAILABLE, dvbi.RESTART_CHECK, dvbi.RESTART_PENDING].includes(str); }
		function isMediaAvailability(str) { return [dvbi.MEDIA_AVAILABLE, dvbi.MEDIA_UNAVAILABLE].includes(str); }
		function isEPGAvailability(str) { return [dvbi.FORWARD_EPG_AVAILABLE, dvbi.FORWARD_EPG_UNAVAILABLE].includes(str); }
		function isAvailability(str) { return isMediaAvailability(str) || isEPGAvailability(str); }
		
		function checkGenre(node, errs, errcode=null) {
			if (!node) return null;
			checkAttributes(node, [tva.a_href], [tva.a_type], errs, errcode?`${errcode}-1`:"ChG001");
			let GenreType=(node.attr(tva.a_type)?node.attr(tva.a_type).value():tva.GENRE_TYPE_OTHER);
			if (GenreType!=tva.GENRE_TYPE_OTHER)
				errs.addError({code:errcode?`${errcode}-2`:"ChG002", message:`${tva.a_type.attribute(`${node.parent().name()}.${+node.name()}`)} must contain ${tva.GENRE_TYPE_OTHER.quote()}`});

			return (node.attr(tva.a_href)?node.attr(tva.a_href).value():null);
		}

		if (!InstanceDescription) {
			errs.addError({type:APPLICATION, code:"ID000", message:"ValidateInstanceDescription() called with InstanceDescription==null"});
			return;
		}
		switch (VerifyType) {
			case tva.e_OnDemandProgram:
				checkTopElementsAndCardinality(InstanceDescription, 
					[{name:tva.e_Genre, minOccurs:2, maxOccurs:2},
					 {name:tva.e_CaptionLanguage, minOccurs:0},
					 {name:tva.e_SignLanguage, minOccurs:0},
					 {name:tva.e_AVAttributes, minOccurs:0},
					 {name:tva.e_OtherIdentifier, minOccurs:0 , maxOccurs:Infinity}],
					false, errs, "ID001");
				break;
			case tva.e_ScheduleEvent:
				checkTopElementsAndCardinality(InstanceDescription, 
					[{name:tva.e_Genre, minOccurs:0},
					 {name:tva.e_CaptionLanguage, minOccurs:0},
					 {name:tva.e_SignLanguage, minOccurs:0},
					 {name:tva.e_AVAttributes, minOccurs:0},
					 {name:tva.e_OtherIdentifier, minOccurs:0 , maxOccurs:Infinity}, 
					 {name:tva.e_RelatedMaterial, minOccurs:0}],
					false, errs, "ID002");
				break;
			default:
				errs.addError({type:APPLICATION, code:"ID003", message:`message:ValidateInstanceDescription() called with VerifyType=${VerifyType}`});
		}

		let restartGenre=null, restartRelatedMaterial=null;
		
		// <Genre>
		switch (VerifyType) {
			case tva.e_OnDemandProgram:
				// A177r1 Table 54 - must be 2 elements
				
				let Genre1=InstanceDescription.get(xPath(SCHEMA_PREFIX, tva.e_Genre, 1), CG_SCHEMA),
					Genre2=InstanceDescription.get(xPath(SCHEMA_PREFIX, tva.e_Genre, 2), CG_SCHEMA);
					
				let g1href=checkGenre(Genre1, errs, "ID011");
				if (g1href && !isAvailability(g1href))
					errs.addError({code:"ID012", message:`first ${elementize(`${InstanceDescription.name()}.+${tva.e_Genre}`)} must contain a media or fepg availability indicator`});

				let g2href=checkGenre(Genre2, errs, "ID013");
				if (g2href && !isAvailability(g2href))
					errs.addError({code:"ID014", message:`second ${elementize(`${InstanceDescription.name()}.+${tva.e_Genre}`)} must contain a media or fepg availability indicator`});
				
				if (Genre1 && Genre2) {
					if ((isMediaAvailability(g1href) && isMediaAvailability(g2href)) || (isEPGAvailability(g1href) && isEPGAvailability(g2href)))
						errs.addError({code:"ID015", message:`${elementize(`${InstanceDescription.name()}.+${tva.e_Genre}`)} elements must indicate different availabilities`});
				}
				break;
			case tva.e_ScheduleEvent:
				let Genre=InstanceDescription.get(xPath(SCHEMA_PREFIX, tva.e_Genre), CG_SCHEMA);
				if (Genre) {
					checkAttributes(Genre, [tva.a_href], [tva.a_type], errs, "ID016");
					if (Genre.attr(tva.a_href)) {
						if (isRestartAvailability(Genre.attr(tva.a_href).value())) {
							restartGenre=Genre;
							if (Genre.attr(tva.a_type) && Genre.attr(tva.a_type).value()!=tva.GENRE_TYPE_OTHER) 
								errs.addError({code:"ID018", message:`${tva.a_type.attribute(Genre.name())} must be ${tva.GENRE_TYPE_OTHER.quote()} or omitted`});
						}
						else 
							errs.addError({code:"ID017", message:`${elementize(`${InstanceDescription.name()}.+${tva.e_Genre}`)} must contain a restart link indicator`});
					}
				}	
				break;
		}
		
		// <CaptionLanguage>
		let CaptionLanguage=InstanceDescription.get(xPath(SCHEMA_PREFIX, tva.e_CaptionLanguage), CG_SCHEMA);
		if (CaptionLanguage) {
			CheckLanguage(this.knownLanguages, errs, CaptionLanguage.text(), `${InstanceDescription.name()}.${tva.e_CaptionLanguage}`, "ID021");
			BooleanValue(CaptionLanguage, tva.a_closed, "ID022", errs);
		}
		
		// <SignLanguage>
		let SignLanguage=InstanceDescription.get(xPath(SCHEMA_PREFIX, tva.e_SignLanguage), CG_SCHEMA);
		if (SignLanguage) {
			CheckLanguage(this.knownLanguages, errs, SignLanguage.text(), `${InstanceDescription.name()}.${tva.e_SignLanguage}`, "ID-310");
			FalseValue(SignLanguage, tva.a_closed, "ID032", errs);
			// check value is "sgn" according to ISO 639-2 or a sign language listed in ISO 639-3
			if (SignLanguage.text()!="sgn" && !this.knownLanguages.isKnownSignLanguage(SignLanguage.text())) 
				errs.addError({code:"ID033", message:`invalid ${tva.e_SignLanguage.elementize()} ${SignLanguage.text().quote()} in ${InstanceDescription.name().elementize()}`});
		}
		
		// <AVAttributes>
		let AVAttributes=InstanceDescription.get(xPath(SCHEMA_PREFIX, tva.e_AVAttributes), CG_SCHEMA);
		if (AVAttributes)
			this.ValidateAVAttributes(CG_SCHEMA, SCHEMA_PREFIX, AVAttributes, errs);
		
		// <OtherIdentifier>
		let oi=0, OtherIdentifier;
		while ((OtherIdentifier=InstanceDescription.get(xPath(SCHEMA_PREFIX, tva.e_OtherIdentifier, ++oi), CG_SCHEMA))!=null) {
			checkAttributes(OtherIdentifier, [tva.a_type], [], errs, "VID052");
			if (OtherIdentifier.attr(tva.a_type)) {			
				let oiType=OtherIdentifier.attr(tva.a_type).value();
		
				if ((VerifyType==tva.e_ScheduleEvent  && (oiType=="CPSIndex" || [dvbi.EIT_PROGRAMME_CRID_TYPE, dvbi.EIT_SERIES_CRID_TYPE].includes(oiType))) ||
					(VerifyType==tva.e_OnDemandProgram && oiType=="CPSIndex")) {
						// all good
					}
					else 
						errs.addError({code:"ID050", message:`${tva.a_type.attribute(tva.e_OtherIdentifier)}=${oiType.quote()} is not valid for ${VerifyType}.${InstanceDescription.name()}`});		
					if ([dvbi.EIT_PROGRAMME_CRID_TYPE, dvbi.EIT_SERIES_CRID_TYPE].includes(oiType))
						if (!isCRIDURI(OtherIdentifier.text()))
							errs.addError({code:"ID051", message:`${tva.e_OtherIdentifier} must be a CRID for ${tva.a_type.attribute()}=${oiType.quote()}`});
			}
		}
		
		// <RelatedMaterial>
		switch (VerifyType) {
			case tva.e_OnDemandProgram:
				let RelatedMaterial=InstanceDescription.get(xPath(SCHEMA_PREFIX, tva.e_RelatedMaterial), CG_SCHEMA);
				if (RelatedMaterial) {
					if (this.ValidateRestartRelatedMaterial(CG_SCHEMA, SCHEMA_PREFIX, RelatedMaterial, errs))
						restartRelatedMaterial=RelatedMaterial; 		
				}
				break;
			case tva.e_ScheduleEvent:
				// Genre and RelatedMaterial for restart capability should only be specified for the "current" (ie. 'now') program
				if (!isCurrentProgram && (restartGenre || restartRelatedMaterial))
					errs.addError({code:"ID060", message:`restart ${tva.e_Genre.elementize()} and ${tva.e_RelatedMaterial.elementize()} are only permitted for the current (${"now".quote()}) program`});
				
				if ((restartGenre && !restartRelatedMaterial) || (restartRelatedMaterial && !restartGenre))
					errs.addError({code:"ID061", message:`both ${tva.e_Genre.elementize()} and ${tva.e_RelatedMaterial.elementize()} are required together for ${VerifyType}`});	
				break;
		}
	}


	/**
	 * validate a <ProgramURL> or <AuxiliaryURL> element to see if it signals a Template XML AIT
	 *
	 * @param {Object} node              the element node containing the an XML AIT reference
	 * @param {Array}  allowedContentTypes the contentTypes that can be signalled in the node@contentType attribute
	 * @param {Class}  errs              errors found in validaton
	 * @param {string} errcode           error code to be used with any errors founf
	 */
	/* private */  CheckPlayerApplication(node, allowedContentTypes, errs, errcode=null) {

		if (!node)  {
			errs.addError({type:APPLICATION, code:"PA000a", message:"CheckPlayerApplication() called with node==null"});
			return;
		}
		if (!Array.isArray(allowedContentTypes)) {
			errs.addError({type:APPLICATION, code:"PA000b", message:"CheckPlayerApplication() called with incorrect type for allowedContentTypes"});
			return;			
		}

		if (!node.attr(tva.a_contentType)) {
			errs.addError({code:errcode?`${errcode}-1`:"PA001", message:`${tva.a_contentType.attribute()} attribute is required when signalling a player in ${node.name().elementize()}`, 
				key:`missing ${tva.a_contentType.attribute()}`});
			return;
		}

		if (allowedContentTypes.includes(node.attr(tva.a_contentType).value())) {
			switch (node.attr(tva.a_contentType).value()) {
				case dvbi.XML_AIT_CONTENT_TYPE:
					if (!isHTTPURL(node.text()))
						errs.addError({code:errcode?`${errcode}-2`:"PA002", message:`${node.name().elementize()}=${node.text().quote()} is not a valid AIT URL`, key:"invalid URL"});
					break;
	/*			case dvbi.HTML5_APP:
				case dvbi.XHTML_APP:
					if (!patterns.isHTTPURL(node.text()))
						errs.addError({code:errcode?`${errcode}-3`:"PA003", message:`${node.name().elementize()}=${node.text().quote()} is not a valid URL`, key:"invalid URL"});		
					break;
	*/		}
		}
		else
			errs.addError({code:errcode?`${errcode}-4`:"PA004",
							message:`${tva.a_contentType.attribute(node.name())}=${node.attr(tva.a_contentType).value().quote()} is not valid for a player`, 
							fragment:node, key:`invalid ${tva.a_contentType}`});
	}


	/**
	 * validate an <OnDemandProgram> elements in the <ProgramLocationTable>
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} OnDemandProgram     the node containing the <OnDemandProgram> being checked
	 * @param {string} parentLang          XML language of the parent element (expliclt or implicit from its parent(s))
	 * @param {array}  programCRIDs        array of program crids defined in <ProgramInformationTable> 
	 * @param {array}  plCRIDs        	   array of program crids defined in <ProgramLocationTable>
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {Class}  errs                errors found in validaton
	 */
	/* private */  ValidateOnDemandProgram(CG_SCHEMA, SCHEMA_PREFIX, OnDemandProgram, parentLanguage, programCRIDs, plCRIDs, requestType, errs) {

		if (!OnDemandProgram) {
			errs.addError({type:APPLICATION, code:"OD000", message:"ValidateOnDemandProgram() called with OnDemandProgram==null"});
			return;
		}
		let validRequest=true;
		switch (requestType) {
			case CG_REQUEST_BS_CONTENTS:
				checkTopElementsAndCardinality(OnDemandProgram,
					[{name:tva.e_Program},
					 {name:tva.e_ProgramURL},
					 {name:tva.e_AuxiliaryURL, minOccurs:0},
					 {name:tva.e_InstanceDescription, minOccurs:0},
					 {name:tva.e_PublishedDuration},
					 {name:tva.e_StartOfAvailability},
					 {name:tva.e_EndOfAvailability},
					 {name:tva.e_Free}],
					false, errs, "OD001");
				break;
			case CG_REQUEST_MORE_EPISODES:
				checkTopElementsAndCardinality(OnDemandProgram,
					[{name:tva.e_Program},
					 {name:tva.e_ProgramURL},
					 {name:tva.e_AuxiliaryURL, minOccurs:0},
					 {name:tva.e_PublishedDuration},
					 {name:tva.e_StartOfAvailability},
					 {name:tva.e_EndOfAvailability},
					 {name:tva.e_Free}],
					false, errs, "OD002");
				break;
			case CG_REQUEST_SCHEDULE_NOWNEXT:
			case CG_REQUEST_SCHEDULE_TIME:
			case CG_REQUEST_SCHEDULE_WINDOW:
			case CG_REQUEST_PROGRAM:
				checkTopElementsAndCardinality(OnDemandProgram,
					[{name:tva.e_Program},
					 {name:tva.e_ProgramURL},
					 {name:tva.e_AuxiliaryURL, minOccurs:0},
					 {name:tva.e_InstanceDescription},
					 {name:tva.e_PublishedDuration},
					 {name:tva.e_StartOfAvailability},
					 {name:tva.e_EndOfAvailability},
					 {name:tva.e_DeliveryMode},
					 {name:tva.e_Free}],
					false, errs, "OD003");
				break;
			default:
				errs.addError({code:"OD004", message:`requestType=${requestType} is not valid for ${OnDemandProgram.name()}`});
				validRequest=false;
		}
			
		checkAttributes(OnDemandProgram, [], [tva.a_serviceIDRef, tva.a_lang], errs, "OD005"); 
		let odpLang=this.GetLanguage(this.knownLanguages, errs, OnDemandProgram, parentLanguage, false, "OD006");
		this.checkTAGUri(OnDemandProgram, errs, "OD007");	
		
		// <Program>
		let prog=0, Program;
		while ((Program=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_Program, ++prog), CG_SCHEMA))!=null) {
			checkAttributes(Program, [tva.a_crid], [], errs, "OD012");
			if (Program.attr(tva.a_crid)) {
				let programCRID=Program.attr(tva.a_crid).value();
				if (!isCRIDURI(programCRID))
					errs.addError({code:"OD010", message:`${tva.a_crid.attribute(`${OnDemandProgram.name()}.${tva.e_Program}`)} is not a CRID URI`});
				else {
					if (!isIni(programCRIDs, programCRID))
						errs.addError({code:"OD011", 
								message:`${tva.a_crid.attribute(`${OnDemandProgram.name()}.${tva.e_Program}`)}=${programCRID.quote()} does not refer to a program in the ${tva.e_ProgramInformationTable.elementize()}`});
				}
				plCRIDs.push(programCRID);
			}	
		}

		// <ProgramURL>
		let pUrl=0, ProgramURL;
		while ((ProgramURL=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_ProgramURL, ++pUrl), CG_SCHEMA))!=null) 
			this.CheckPlayerApplication(ProgramURL, [dvbi.XML_AIT_CONTENT_TYPE], errs, "OD020");

		// <AuxiliaryURL>
		let aux=0, AuxiliaryURL;
		while ((AuxiliaryURL=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_AuxiliaryURL, ++aux), CG_SCHEMA))!=null) 
			this.CheckPlayerApplication(AuxiliaryURL, [dvbi.XML_AIT_CONTENT_TYPE /*, dvbi.HTML5_APP, dvbi.XHTML_APP, dvbi.iOS_APP, dvbi.ANDROID_APP*/], errs, "OD030");

		// <InstanceDescription>
		let id=0, InstanceDescription;
		if (validRequest && [CG_REQUEST_BS_CONTENTS, CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_WINDOW, CG_REQUEST_PROGRAM].includes(requestType))
			while ((InstanceDescription=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_InstanceDescription, ++id), CG_SCHEMA))!=null)
				this.ValidateInstanceDescription(CG_SCHEMA, SCHEMA_PREFIX, OnDemandProgram.name(), InstanceDescription, false, errs);
		
		// <PublishedDuration>

		// <StartOfAvailability> and <EndOfAvailability>
		let soa=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_StartOfAvailability), CG_SCHEMA),
			eoa=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_EndOfAvailability), CG_SCHEMA);

		if (soa && eoa) {
			let fr=new Date(soa.text()), to=new Date(eoa.text());	
			if (to.getTime() < fr.getTime()) 
				errs.addError({code:"OD062", message:`${tva.e_StartOfAvailability.elementize()} must be earlier than ${tva.e_EndOfAvailability.elementize()}`});
		}
		
		// <DeliveryMode>
		let dm=0, DeliveryMode;
		if ([CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_TIME, CG_REQUEST_SCHEDULE_WINDOW, CG_REQUEST_PROGRAM].includes(requestType))
			while ((DeliveryMode=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_DeliveryMode, ++dm), CG_SCHEMA))!=null)
				if (DeliveryMode.text()!=tva.DELIVERY_MODE_STREAMING)
					errs.addError({code:"OD070", message:`${OnDemandProgram.name()}.${tva.e_DeliveryMode} must be ${tva.DELIVERY_MODE_STREAMING.quote()}`});
		
		// <Free>
		let fr=0, Free;
		while ((Free=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_Free, ++fr), CG_SCHEMA))!=null)
			TrueValue(Free, tva.a_value, "OD080", errs);
	}	


	/**
	 * validate any <ScheduleEvent> elements in the <ProgramLocationTable.Schedule>
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} Schedule            the <Schedule> node containing the <ScheduleEvent> element to be checked
	 * @param {string} parentLanguage      XML language of the parent element (expliclt or implicit from its parent(s))
	 * @param {array}  programCRIDs        array of program crids defined in <ProgramInformationTable> 
	 * @param {array}  plCRIDs             array of program crids defined in <ProgramLocationTable>
	 * @param {string} currentProgramCRID  CRID of the currently airing program
	 * @param {Date}   scheduleStart	   Date representation of Schedule@start
	 * @param {Date}   scheduleEnd  	   Date representation of Schedule@end
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {Class}  errs                errors found in validaton
	 */
	/* private */  ValidateScheduleEvents(CG_SCHEMA, SCHEMA_PREFIX, Schedule, parentLanguage, programCRIDs, plCRIDs, currentProgramCRID, scheduleStart, scheduleEnd, requestType, errs) {
		
		if (!Schedule) {
			errs.addError({type:APPLICATION, code:"SE000", message:"ValidateScheduleEvents() called with Schedule==null"});
			return;
		}
		
		let isCurrentProgram=false;
		let se=0, ScheduleEvent;
		while ((ScheduleEvent=Schedule.get(xPath(SCHEMA_PREFIX, tva.e_ScheduleEvent, ++se), CG_SCHEMA))!=null) {
			let seLang=this.GetLanguage(this.knownLanguages, errs, ScheduleEvent, parentLanguage, false, "SE001");
			
			checkTopElementsAndCardinality(ScheduleEvent, 
				[{name:tva.e_Program}, 
				 {name:tva.e_ProgramURL, minOccurs:0},
				 {name:tva.e_InstanceDescription, minOccurs:0},
				 {name:tva.e_PublishedStartTime},
				 {name:tva.e_PublishedDuration},
				 {name:tva.e_ActualStartTime, minOccurs:0}, 
				 {name:tva.e_FirstShowing, minOccurs:0 }, 
				 {name:tva.e_Free, minOccurs:0}], 
				false, errs, "SE002");
			
			// <Program>
			let Program=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_Program), CG_SCHEMA);
			if (Program) {
				checkAttributes(Program, [tva.a_crid], [], errs, "SE010" );

				let ProgramCRID=Program.attr(tva.a_crid);
				if (ProgramCRID) {
					if (!isCRIDURI(ProgramCRID.value()))
						errs.addError({code:"SE011", message:`${tva.a_crid.attribute(tva.e_Program)} is not a valid CRID (${ProgramCRID.value()})`});
					if (!isIni(programCRIDs, ProgramCRID.value()))
						errs.addError({code:"SE012", 
									message:`${tva.a_crid.attribute(tva.e_Program)}=${ProgramCRID.value().quote()} does not refer to a program in the ${tva.e_ProgramInformationTable.elementize()}`});
					plCRIDs.push(ProgramCRID.value());
					isCurrentProgram=(ProgramCRID.value()==currentProgramCRID) ;
				}
			}
				
			// <ProgramURL>
			let ProgramURL=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_ProgramURL), CG_SCHEMA);
			if (ProgramURL) 
				if (!isDVBLocator(ProgramURL.text()))
					errs.addError({code:"SE021", message:`${tva.e_ScheduleEvent}.${tva.e_ProgramURL} (${ProgramURL.text()}) is not a valid DVB locator`});
			
			// <InstanceDescription>
			let InstanceDescription=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_InstanceDescription), CG_SCHEMA);
			if (InstanceDescription) 
				this.ValidateInstanceDescription(CG_SCHEMA, SCHEMA_PREFIX, tva.e_ScheduleEvent, InstanceDescription, isCurrentProgram, errs);
			
			// <PublishedStartTime> and <PublishedDuration>
			let pstElem=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_PublishedStartTime), CG_SCHEMA);
			if (pstElem) {

				if (isUTCDateTime(pstElem.text())) {
					let PublishedStartTime=new Date(pstElem.text());
					
					if (scheduleStart && (PublishedStartTime < scheduleStart)) 
						errs.addError({code:"SE041", 
										message:`${tva.e_PublishedStartTime.elementize()} (${PublishedStartTime}) is earlier than ${tva.a_start.attribute(tva.e_Schedule)}`});
					if (scheduleEnd && (PublishedStartTime > scheduleEnd)) 
						errs.addError({code:"SE042", 
										message:`${tva.e_PublishedStartTime.elementize()} (${PublishedStartTime}) is after ${tva.a_end.attribute(tva.e_Schedule)}`});

					let pdElem=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_PublishedDuration), CG_SCHEMA);
					if (pdElem && scheduleEnd) {
						let parsedPublishedDuration=parseISOduration(pdElem.text());
						if (parsedPublishedDuration.add(PublishedStartTime) > scheduleEnd) 
							errs.addError({code:"SE043", 
											message:`${tva.e_PublishedStartTime}+${tva.e_PublishedDuration} of event is after ${tva.a_end.attribute(tva.e_Schedule)}`});
					}
				}
				else 
					errs.addError({code:"SE049", message:`${tva.e_PublishedStartTime.elementize()} is not expressed in UTC format (${pstElem.text()})`});
			}
			
			// <ActualStartTime> 
			let astElem=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_ActualStartTime), CG_SCHEMA);
			if (astElem && !isUTCDateTime(astElem.text())) 
				errs.addError({code:"SE051", message:`${tva.e_ActualStartTime.elementize()} is not expressed in UTC format (${astElem.text()})`});

			// <FirstShowing>
			let FirstShowing=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_FirstShowing), CG_SCHEMA);
			if (FirstShowing) 
				BooleanValue(FirstShowing, tva.a_value, "SE060", errs);
			
			// <Free>
			let Free=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_Free), CG_SCHEMA);
			if (Free) 
				BooleanValue(Free, tva.a_value, "SE070", errs);
		}
	}


	/**
	 * validate a <Schedule> elements in the <ProgramLocationTable>
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} Schedule            the node containing the <Schedule> being checked
	 * @param {string} parentLanguage      XML language of the parent element (expliclt or implicit from its parent(s))
	 * @param {array}  programCRIDs        array of program crids defined in <ProgramInformationTable> 
	 * @param {array}  plCRIDs             array of program crids defined in <ProgramLocationTable>
	 * @param {string} currentProgramCRID  CRID of the currently airing program
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {Class}  errs                errors found in validaton
	 * @returns {string} the serviceIdRef for this <Schedule> element
	 */
	/* private */  ValidateSchedule(CG_SCHEMA, SCHEMA_PREFIX, Schedule, parentLanguage, programCRIDS, plCRIDs, currentProgramCRID, requestType, errs) {

		if (!Schedule) {
			errs.addError({type:APPLICATION, code:"VS000", message:"ValidateSchedule() called with Schedule==null"});
			return;
		}

		checkTopElementsAndCardinality(Schedule, [{name:tva.e_ScheduleEvent, minOccurs:0, maxOccurs:Infinity}], false, errs, "VS001");
		checkAttributes(Schedule, [tva.a_serviceIDRef, tva.a_start, tva.a_end], [], errs, "VS002");
		
		let scheduleLang=this.GetLanguage(this.knownLanguages, errs, Schedule, parentLanguage, false, "VS003");	
		let serviceIdRef=this.checkTAGUri(Schedule, errs, "VS004");
		let startSchedule=Schedule.attr(tva.a_start), fr=null, endSchedule=Schedule.attr(tva.a_end), to=null;
		if (startSchedule)
			fr=new Date(startSchedule.value());

		if (endSchedule)
			to=new Date(endSchedule.value());

		if (startSchedule && endSchedule) 
			if (to.getTime() <= fr.getTime()) 
				errs.addError({code:"VS012", message:`${tva.a_start.attribute(Schedule.name())} must be earlier than ${tva.a_end.attribute()}`});
		
				this.ValidateScheduleEvents(CG_SCHEMA, SCHEMA_PREFIX, Schedule, scheduleLang, programCRIDS, plCRIDs, currentProgramCRID, fr, to, requestType, errs);
		
		return serviceIdRef;
	}


	/**
	 * find and validate any <ProgramLocation> elements in the <ProgramLocationTable>
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} ProgramDescription  the element containing the <ProgramInformationTable>
	 * @param {string} parentLang          XML language of the parent element (or its parent(s))
	 * @param {array}  programCRIDs        array to record CRIDs for later use  
	 * @param {string} currentProgramCRID  CRID of the currently airing program
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {Class}  errs                errors found in validaton
	 * @param {integer} o.childCount         the number of child elements to be present (to match GroupInformation@numOfItems)
	 */
	/* private */  CheckProgramLocation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, parentLang, programCRIDs, currentProgramCRID, requestType, errs, o=null) {

		if (!ProgramDescription) {
			errs.addError({type:APPLICATION, code:"PL000", message:"CheckProgramLocation() called with ProgramDescription==null"});
			return;
		}
		
		let ProgramLocationTable=ProgramDescription.get(xPath(SCHEMA_PREFIX, tva.e_ProgramLocationTable), CG_SCHEMA);
		if (!ProgramLocationTable) {
			errs.addError({code:"PL001", message:`${tva.e_ProgramLocationTable.elementize()} is not specified`});
			return;
		}
		checkTopElementsAndCardinality(ProgramLocationTable, 
			[{name:tva.e_Schedule, minOccurs:0, maxOccurs:Infinity},
			 {name:tva.e_OnDemandProgram, minOccurs:0, maxOccurs:Infinity}], 
			false, errs, "PL010");
		checkAttributes(ProgramLocationTable, [], [tva.a_lang], errs, "PL011");
		
		let pltLang=this.GetLanguage(this.knownLanguages, errs, ProgramLocationTable, parentLang, false, "PL012");	
		
		let cnt=0, foundServiceIds=[], plCRIDs=[];

		let children=ProgramLocationTable.childNodes();
		if (children) children.forEachSubElement(child => {
			switch (child.name()) {
				case tva.e_OnDemandProgram:
					this.ValidateOnDemandProgram(CG_SCHEMA, SCHEMA_PREFIX, child, pltLang, programCRIDs, plCRIDs, requestType, errs);
					cnt++;
					break;
				case tva.e_Schedule:
					let thisServiceIdRef=this.ValidateSchedule(CG_SCHEMA, SCHEMA_PREFIX, child, pltLang, programCRIDs, plCRIDs, currentProgramCRID, requestType, errs);
					if (thisServiceIdRef.length)
						if (isIni(foundServiceIds, thisServiceIdRef))
							errs.addError({code:"PL020", 
											message:`A ${tva.e_Schedule.elementize()} element with ${tva.a_serviceIDRef.attribute()}=${thisServiceIdRef.quote()} is already specified`});
						else 
							foundServiceIds.push(thisServiceIdRef);
					cnt++;
					break;
			}
		});

		if (o && o.childCount!=0) {
			if (o.childCount!=cnt)
				errs.addError({code:"PL021", 
								message:`number of items (${cnt}) in the ${tva.e_ProgramLocationTable.elementize()} does match ${tva.a_numOfItems.attribute(tva.e_GroupInformation)} specified in ${CATEGORY_GROUP_NAME} (${o.childCount})`});
		}

		programCRIDs.forEach(programCRID => {
			if (!isIni(plCRIDs, programCRID))
				errs.addError({code:"PL022", 
								message:`CRID ${programCRID.quote()} specified in ${tva.e_ProgramInformationTable.elementize()} is not specified in ${tva.e_ProgramLocationTable.elementize()}`});
		});
	}


	/**
	 * validate the content guide and record any errors
	 *
	 * @param {String} CGtext the service list text to be validated
	 * @param {String} requestType the type of CG request/response (specified in the form/query as not possible to deduce from metadata)
	 * @param {Class} errs errors found in validaton
	 */
	doValidateContentGuide(CGtext, requestType, errs) {
		let CG=null;

		if (CGtext) try {
			CG=parseXmlString(CGtext);
		} catch (err) {
			errs.addError({type:APPLICATION, code:"CG000", message:`XML parsing failed: ${err.message}`});
		}
		if (!CG) return;

		errs.loadDocument(CGtext);

		let prettyXML=CG.toString();
		let formattedCG=parseXmlString(prettyXML);
		if (!formattedCG.validate(this.TVAschema)) {
			let lines=prettyXML.split('\n');
			formattedCG.validationErrors.forEach(ve => {
				let s=ve.toString().split('\r');
				s.forEach(err => {
					errs.addError({code:"CG001", message:err, fragment:lines[ve.line-1], key:"XSD validation"});
					errs.setError(err, ve.line-1);
				}); 
			});
		}

		if (CG.root().name()!=tva.e_TVAMain) {
			errs.addError({code:"CG002", message:`Root element is not ${tva.e_TVAMain.elementize()}`, key:"XSD validation"});
			return;
		}
		let CG_SCHEMA={}, 
			SCHEMA_PREFIX=CG.root().namespace()?CG.root().namespace().prefix():"", 
			SCHEMA_NAMESPACE=CG.root().namespace()?CG.root().namespace().href():"";
		CG_SCHEMA[SCHEMA_PREFIX]=SCHEMA_NAMESPACE;

		let tvaMainLang=this.GetLanguage(this.knownLanguages, errs, CG.root(), DEFAULT_LANGUAGE, true, "CG003");
		let ProgramDescription=CG.get(xPath(SCHEMA_PREFIX, tva.e_ProgramDescription), CG_SCHEMA);
		if (!ProgramDescription) {
			errs.addError({code:"CG004", message:`No ${tva.e_ProgramDescription.elementize()} element specified.`});
			return;
		}
		
		let programCRIDs=[], groupIds=[], o={childCount:0};
		
		switch (requestType) {
			case CG_REQUEST_SCHEDULE_TIME:
				// schedule response (6.5.4.1) has <ProgramLocationTable> and <ProgramInformationTable> elements 
				checkTopElementsAndCardinality(ProgramDescription,
					[{name:tva.e_ProgramLocationTable},
					 {name:tva.e_ProgramInformationTable}],
					false, errs, "CG011");
				
				this.CheckProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, programCRIDs, null, requestType, errs);
				this.CheckProgramLocation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, programCRIDs, null, requestType, errs);
				break;
			case CG_REQUEST_SCHEDULE_NOWNEXT:
				// schedule response (6.5.4.1) has <ProgramLocationTable> and <ProgramInformationTable> elements 
				checkTopElementsAndCardinality(ProgramDescription,
					[{name:tva.e_ProgramLocationTable},
					 {name:tva.e_ProgramInformationTable},
					 {name:tva.e_GroupInformationTable}],
					false, errs, "CG021");
			
				// <GroupInformation> may become optional for now/next, the program sequence should be determined by ScheduleEvent.PublishedStartTime
				if (this.hasElement(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tva.e_GroupInformationTable))
					this.CheckGroupInformationNowNext(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, groupIds, requestType, errs);
				let currentProgramCRIDnn=this.CheckProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, programCRIDs, groupIds, requestType, errs);
				this.CheckProgramLocation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, programCRIDs, currentProgramCRIDnn, requestType, errs);
				break;
			case CG_REQUEST_SCHEDULE_WINDOW:
				checkTopElementsAndCardinality(ProgramDescription,
					[{name:tva.e_ProgramLocationTable},
					 {name:tva.e_ProgramInformationTable},
				 	 {name:tva.e_GroupInformationTable}],
					false, errs, "CG031");

				// <GroupInformation> may become optional for now/next, the program sequence should be determined by ScheduleEvent.PublishedStartTime
				if (this.hasElement(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tva.e_GroupInformationTable))
					this.CheckGroupInformationNowNext(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, groupIds, requestType, errs);
				let currentProgramCRIDsw=this.CheckProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, programCRIDs, groupIds, requestType, errs);
				this.CheckProgramLocation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, programCRIDs, currentProgramCRIDsw, requestType, errs);
				break;
			case CG_REQUEST_PROGRAM:
				// program information response (6.6.2) has <ProgramLocationTable> and <ProgramInformationTable> elements
				checkTopElementsAndCardinality(ProgramDescription,
					[{name:tva.e_ProgramLocationTable},
					 {name:tva.e_ProgramInformationTable}],
					false, errs, "CG041");	
			
				this.CheckProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, programCRIDs, null, requestType, errs);
				this.CheckProgramLocation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, programCRIDs, null, requestType, errs);
				break;
			case CG_REQUEST_MORE_EPISODES:
				// more episodes response (6.7.3) has <ProgramInformationTable>, <GroupInformationTable> and <ProgramLocationTable> elements 
				checkTopElementsAndCardinality(ProgramDescription,
					[{name:tva.e_ProgramLocationTable},
					 {name:tva.e_ProgramInformationTable},
					 {name:tva.e_GroupInformationTable}],
					false, errs, "CG051");

				this.CheckGroupInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, requestType, groupIds, errs, o);
				this.CheckProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, programCRIDs, groupIds, requestType, errs, o);
				this.CheckProgramLocation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, programCRIDs, null, requestType, errs, o);
				break;
			case CG_REQUEST_BS_CATEGORIES:
				// box set categories response (6.8.2.3) has <GroupInformationTable> element
				checkTopElementsAndCardinality(ProgramDescription, [{name:tva.e_GroupInformationTable}], false, errs, "CG061"); 

				this.CheckGroupInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, requestType, null, errs, null);
				break;
			case CG_REQUEST_BS_LISTS:
				// box set lists response (6.8.3.3) has <GroupInformationTable> element
				checkTopElementsAndCardinality(ProgramDescription, [{name:tva.e_GroupInformationTable}], false, errs, "CG071"); 
				
				this.CheckGroupInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, requestType, null, errs, null);
				break;
			case CG_REQUEST_BS_CONTENTS:
				// box set contents response (6.8.4.3) has <ProgramInformationTable>, <GroupInformationTable> and <ProgramLocationTable> elements 
				checkTopElementsAndCardinality(ProgramDescription,
					[{name:tva.e_ProgramLocationTable},
					 {name:tva.e_ProgramInformationTable},
					 {name:tva.e_GroupInformationTable}],
					false, errs, "CG081");
				
				this.CheckGroupInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, requestType, groupIds, errs, o);
				this.CheckProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, programCRIDs, groupIds, requestType, errs, o);
				this.CheckProgramLocation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, tvaMainLang, programCRIDs, null, requestType, errs, o);
				break;
		}
	}


	/**
	 * validate the content guide and record any errors
	 *
	 * @param {String} CGtext the service list text to be validated
	 * @param {String} requestType the type of CG request/response (specified in the form/query as not possible to deduce from metadata)
	 * @returns {Class} errs errors found in validaton
	 */
	validateContentGuide(CGtext, requestType)  {
		var errs=new ErrorList();
		this.doValidateContentGuide(CGtext, requestType, errs);

		return new Promise((resolve, reject) => {
			resolve(errs);
		});
	}
}
