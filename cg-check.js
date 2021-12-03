// libxmljs2 - github.com/marudor/libxmljs2
import { parseXmlString } from "libxmljs2";
import format from 'xml-formatter';

import { readFileSync } from "fs";

import { attribute, elementize, quote } from './phlib/phlib.js';

import ErrorList, { ERROR, WARNING, APPLICATION } from "./ErrorList.js";
import ClassificationScheme from "./ClassificationScheme.js";
import Role from "./Role.js";
import IANAlanguages from "./IANAlanguages.js";

import { dvbi } from "./DVB-I_definitions.js";
import { tva, tvaEA, tvaEC } from "./TVA_definitions.js";

import { mpeg7 } from "./MPEG7_definitions.js";

import { isCRIDURI, isTAGURI } from "./URI_checks.js";
import { xPath, xPathM, isIn, isIni, unEntity, parseISOduration } from "./utils.js";

import { isHTTPURL, isDVBLocator, isUTCDateTime } from "./pattern_checks.js";

import { IANA_Subtag_Registry, TVA_ContentCS, TVA_FormatCS, DVBI_ContentSubject, DVBI_CreditsItemRoles, DVBIv2_CreditsItemRoles, TVAschema } from "./data-locations.js";

import { ValidatePromotionalStillImage } from "./RelatedMaterialChecks.js";
import { cg_InvalidHrefValue, NoChildElement } from "./CommonErrors.js";
import { checkAttributes, checkTopElementsAndCardinality} from "./schema_checks.js";

import { checkLanguage, GetNodeLanguage, checkXMLLangs } from "./MultilingualElement.js";

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
 * @param {XMLnode} node            the libxmljs node to check
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
 * @param {XMLnode} elem       the XML element to be checked
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
 * @param {XMLnode} elem       the XML element to be checked
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
 * @param {XMLnode} elem       the XML element to be checked
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
 * @param {XMLnode} elem       the XML element to be checked
 * @param {string}  attrName   the name of the attribute carrying the boolean value
 * @param {string}  errCode    the error number used as a prefix for reporting errors
 * @param {Class}   errs       errors found in validaton
 * @param {boolean} isRequired true if the specificed attribued is required to be specified for the element
 */
function FalseValue(elem, attrName, errCode, errs, isRequired=true) {
	AllowedValue(elem, attrName, errCode, errs, ["false"], isRequired);
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
	 * check if the specificed element has the named child elemeny
	 * 
	 * @param {XMLnode} node            the node to check
	 * @param {string}  elementName     the name of the child element
	 * @returns {boolean} true if an element named node.elementName exists, else false
	 */
	/* private */  hasElement( node, elementName) {
		if (!node) return false;

		return node.childNodes().find(c => ( c.type()=="element" && c.name()==elementName) );
	}


	/**
	 * check that the serviceIdRef attribute is a TAG URI and report warnings
	 * 
	 * @param {XMLnode} elem       the node containing the element being checked
	 * @param {Class}   errs       errors found in validaton
	 * @param {string}  errCode    error code prefix to be used in reports
	 * @returns {string} the serviceIdRef, whether it is valid of not
	 */
	/* private */  checkTAGUri(elem, errs, errCode) {
		if (elem && elem.attr(tva.a_serviceIDRef)) {
			let svcID=elem.attr(tva.a_serviceIDRef).value();
			if (!isTAGURI(svcID)) {
				errs.addError({type:WARNING, code:errCode, 
								message:`${tva.a_serviceIDRef.attribute(elem.name())} ${svcID.quote()} is not a TAG URI`, line:elem.line()});
			}
			return svcID;
		}
		return "";
	}


	/**
	 * validate the <Synopsis> elements 
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} BasicDescription    the element whose children should be checked
	 * @param {array}   requiredLengths	    @length attributes that are required to be present
	 * @param {array}   optionalLengths	    @length attributes that can optionally be present
	 * @param {string}  requestType         the type of content guide request being checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {string}  errCode             error code prefix to be used in reports
	 */
	/* private */  ValidateSynopsis(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, requiredLengths, optionalLengths, requestType, errs, errCode) {
		
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
			
			checkAttributes(Synopsis, [tva.a_length], [tva.a_lang], tvaEA.Synopsis, errs, `${errCode}-1`);

			let synopsisLang=GetNodeLanguage(Synopsis, false, errs, `${errCode}-2`, this.knownLanguages);
			let synopsisLength=Synopsis.attr(tva.a_length)?Synopsis.attr(tva.a_length).value():null;
			
			if (synopsisLength) {
				if (isIn(requiredLengths, synopsisLength) || isIn(optionalLengths, synopsisLength)) {
					let _len=unEntity(Synopsis.text()).length;
					switch (synopsisLength) {
					case tva.SYNOPSIS_SHORT_LABEL:
						if (_len > tva.SYNOPSIS_SHORT_LENGTH)
							errs.addError({code:`${errCode}-11`, message:synopsisLengthError(tva.SYNOPSIS_SHORT_LABEL, tva.SYNOPSIS_SHORT_LENGTH, _len), 
											fragment:Synopsis});
						hasShort=true;
						break;
					case tva.SYNOPSIS_MEDIUM_LABEL:
						if (_len > tva.SYNOPSIS_MEDIUM_LENGTH)
							errs.addError({code:`${errCode}-12`, 
											message:synopsisLengthError(tva.SYNOPSIS_MEDIUM_LABEL, tva.SYNOPSIS_MEDIUM_LENGTH, _len), 
											fragment:Synopsis});
						hasMedium=true;
						break;
					case tva.SYNOPSIS_LONG_LABEL:
						if (_len > tva.SYNOPSIS_LONG_LENGTH)
							errs.addError({code:`${errCode}-13`, 
											message:synopsisLengthError(tva.SYNOPSIS_LONG_LABEL, tva.SYNOPSIS_LONG_LENGTH, _len), 
											fragment:Synopsis});
						hasLong=true;
						break;						
					}
				}
				else
					errs.addError({code:`${errCode}-14`, 
									message:`${tva.a_length.attribute()}=${synopsisLength.quote()} is not permitted for this request type`, 
									fragment:Synopsis});
			}
		
			if (synopsisLang && synopsisLength) {
				switch (synopsisLength) {
					case tva.SYNOPSIS_SHORT_LABEL:
						if (isIn(shortLangs, synopsisLang)) 
							errs.addError({code:`${errCode}-16`, 
											message:singleLengthLangError(synopsisLength, synopsisLang), 
											fragment:Synopsis});
						else shortLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_MEDIUM_LABEL:
						if (isIn(mediumLangs, synopsisLang)) 
							errs.addError({code:`${errCode}-17`, message:singleLengthLangError(synopsisLength, synopsisLang), fragment:Synopsis});
						else mediumLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_LONG_LABEL:
						if (isIn(longLangs, synopsisLang)) 
							errs.addError({code:`${errCode}-18`, message:singleLengthLangError(synopsisLength, synopsisLang), fragment:Synopsis});
						else longLangs.push(synopsisLang);
						break;
				}
			}
		}
		
		if (isIn(requiredLengths, tva.SYNOPSIS_SHORT_LABEL) && !hasShort)
			errs.addError({code:`${errCode}-19`, message:requiredSynopsisError(tva.SYNOPSIS_SHORT_LABEL), line:BasicDescription.line()});
		if (isIn(requiredLengths, tva.SYNOPSIS_MEDIUM_LABEL) && !hasMedium)
			errs.addError({code:`${errCode}-20`, message:requiredSynopsisError(tva.SYNOPSIS_MEDIUM_LABEL), line:BasicDescription.line()});
		if (isIn(requiredLengths, tva.SYNOPSIS_LONG_LABEL) && !hasLong)
			errs.addError({code:`${errCode}-21`, message:requiredSynopsisError(tva.SYNOPSIS_LONG_LABEL), line:BasicDescription.line()});
	}


	/**
	 * validate the <Keyword> elements specified
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} BasicDescription    the element whose children should be checked
	 * @param {integer} minKeywords         the minimum number of keywords
	 * @param {integer} maxKeywords         the maximum number of keywords
	 * @param {Class}   errs                errors found in validaton
	 * @param {string}  errCode             error code prefix to be used in reports
	 */
	/* private */  ValidateKeyword(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, minKeywords, maxKeywords, errs, errCode) {

		if (!BasicDescription) {
			errs.addError({type:APPLICATION, code:"KW000", message:"ValidateKeyword() called with BasicDescription=null"});
			return;
		}
		let k=0, Keyword, counts=[];
		while ((Keyword=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_Keyword, ++k), CG_SCHEMA))!=null) {
			
			checkAttributes(Keyword, [], [tva.a_lang, tva.a_type], tvaEA.Keyword, errs, `${errCode}-1`);

			let keywordType=Keyword.attr(tva.a_type)?Keyword.attr(tva.a_type).value():tva.DEFAULT_KEYWORD_TYPE;
			let keywordLang=GetNodeLanguage(Keyword, false, errs, `${errCode}-2`, this.knownLanguages);
	
			if (counts[keywordLang]===undefined)
				counts[keywordLang]=[Keyword];
			else counts[keywordLang].push(Keyword);	

			if (keywordType!=tva.KEYWORD_TYPE_MAIN && keywordType!=tva.KEYWORD_TYPE_OTHER)
				errs.addError({code:`${errCode}-11`, 
								message:`${tva.a_type.attribute()}=${keywordType.quote()} not permitted for ${tva.e_Keyword.elementize()}`, fragment:Keyword});
			if (unEntity(Keyword.text()).length > dvbi.MAX_KEYWORD_LENGTH)
				errs.addError({code:`${errCode}-12`, message:`length of ${tva.e_Keyword.elementize()} is greater than ${dvbi.MAX_KEYWORD_LENGTH}`, fragment:Keyword});
		}
		
		for (let i in counts) {
			if (counts[i].length!=0 && counts[i].length>maxKeywords) 
				errs.addError({code:`${errCode}-13`, 
						message:`More than ${maxKeywords} ${tva.e_Keyword.elementize()} element${(maxKeywords>1?"s":"")} specified${(i==DEFAULT_LANGUAGE?"":" for language "+i.quote())}`, 
						multiElementError:counts[i]});
		}
	}


	/**
	 * validate the <Genre> elements specified
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} BasicDescription    the element whose children should be checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {string}  errCode             error code prefix to be used in reports
	 */
	/* private */  ValidateGenre(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, errCode) {

		if (!BasicDescription) {
			errs.addError({type:APPLICATION, code:"GE000", message:"ValidateGenre() called with BasicDescription=null"});
			return;
		}

		let g=0, Genre;
		while ((Genre=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_Genre, ++g), CG_SCHEMA))!=null) {
			let genreType=Genre.attr(tva.a_type)?Genre.attr(tva.a_type).value():tva.DEFAULT_GENRE_TYPE;
			if (genreType!=tva.GENRE_TYPE_MAIN)
				errs.addError({code:`${errCode}-1`, 
								message:`${tva.a_type.attribute()}=${genreType.quote()} not permitted for ${tva.e_Genre.elementize()}`, fragment:Genre});
			
			let genreValue=Genre.attr(tva.a_href)?Genre.attr(tva.a_href).value():"";
			if (!this.allowedGenres.isIn(genreValue))
				errs.addError({code:`${errCode}-2`, 
								message:`invalid ${tva.a_href.attribute()} value ${genreValue.quote()} for ${tva.e_Genre.elementize()}`, fragment:Genre});
		}
	}

	/**
	 * validate the <ParentalGuidance> elements specified. 
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} BasicDescription    the element whose children should be checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {string}  errCode             error code prefix to be used in reports
	 */
	/* private */  ValidateParentalGuidance(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, errCode) {
		// first <ParentalGuidance> element must contain an <mpeg7:MinimumAge> element

		if (!BasicDescription) {
			errs.addError({type:APPLICATION, code:"PG000", message:"ValidateParentalGuidance() called with BasicDescription=null"});
			return;
		}

		let countParentalGuidance=0, countExplanatoryText=[];

		let pg=0, ParentalGuidance;
		while ((ParentalGuidance=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_ParentalGuidance, ++pg), CG_SCHEMA))!=null) {
			countParentalGuidance++;
			countExplanatoryText=[];
/* jshint -W083 */
			if (ParentalGuidance.childNodes()) 
				ParentalGuidance.childNodes().forEachSubElement( pgChild => {
					switch (pgChild.name()) {
						case tva.e_MinimumAge:
							if (countParentalGuidance!=1)
								errs.addError({code:`${errCode}-1`, 
											message:`${tva.e_MinimumAge.elementize()} must be in the first ${tva.e_ParentalGuidance.elementize()} element`, fragment:pgChild});

							break;
						case tva.e_ParentalRating:
							if (countParentalGuidance==1)
								errs.addError({code:`${errCode}-2`, 
												message:`first ${tva.e_ParentalGuidance.elementize()} element must contain ${elementize("mpeg7:"+tva.e_MinimumAge)}`, fragment:pgChild});
							
							
							checkAttributes(pgChild, [tva.a_href], [], tvaEA.ParentalRating, errs, `${errCode}-3`);
							break;		
						case tva.e_ExplanatoryText:
							
							checkAttributes(pgChild, [tva.a_length], [tva.a_lang], tvaEA.ExplanatoryText, errs, `${errCode}-4`);
							if (pgChild.attr(tva.a_length)) {
								if (pgChild.attr(tva.a_length).value()!=tva.v_lengthLong)
									errs.addError({code:`${errCode}-5`, 
													message:`${tva.a_length.attribute()}=${pgChild.attr(tva.a_length).value().quote()} is not allowed for ${tva.e_ExplanatoryText.elementize()}`,
													fragment:pgChild});
							}
							
							if (unEntity(pgChild.text()).length > dvbi.MAX_EXPLANATORY_TEXT_LENGTH)
								errs.addError({code:`${errCode}-6`, 
												message:`length of ${tva._ExplanatoryText.elementize()} cannot exceed ${dvbi.MAX_EXPLANATORY_TEXT_LENGTH} characters`,
												fragment:pgChild});

							countExplanatoryText.push(pgChild);
							break;
					}
				});
/* jshint +W083 */
			checkXMLLangs(CG_SCHEMA, SCHEMA_PREFIX, tva.e_ExplanatoryText, `${BasicDescription.name()}.${tva.e_ParentalGuidance}`, ParentalGuidance, errs, `${errCode}-8`, this.knownLanguages);
		}
	}


	/**
	 * validate a name (either PersonName of Character) to ensure a single GivenName is present with a single optional FamilyName
	 *
	 * @param {XMLnode} elem             the element whose children should be checked
	 * @param {Class}   errs             errors found in validaton
	 * @param {string}  errCode          error code prefix to be used in reports
	 */
	/* private */  ValidateName(elem, errs, errCode) {
		
		function checkNamePart(elem, errs, errCode) {
			if (unEntity(elem.text()).length > dvbi.MAX_NAME_PART_LENGTH)	
				errs.addError({code:errCode, fragment:elem,
								message:`${elem.name().elementize()} in ${elem.parent().name().elementize()} is longer than ${dvbi.MAX_NAME_PART_LENGTH} characters`});
		}
		
		if (!elem) {
			errs.addError({type:APPLICATION, code:"VN000", message:"ValidateName() called with elem==null"});
			return;
		}
		let familyNameCount=[], givenNameCount=0, children=elem.childNodes();
		if (children) children.forEachSubElement(subElem => {
			switch (subElem.name()) {
				case tva.e_GivenName:
					givenNameCount++;
					checkNamePart(subElem, errs, `${errCode}-2`);
					break;
				case tva.e_FamilyName:
					familyNameCount.push(subElem);
					checkNamePart(subElem, errs, `${errCode}-3`);
					break;	
			}
		});
			
		if (givenNameCount==0)
			errs.addError({code:`${errCode}-4`, message:`${tva.e_GivenName.elementize()} is mandatory in ${elem.name().elementize()}`, line:elem.line()});
		if (familyNameCount.length>1) 
			errs.addError({code:`${errCode}-5`, 
					message:`only a single ${tva.e_FamilyName.elementize()} is permitted in ${elem.name().elementize()}`, 
					multiElementError:familyNameCount});
	}


	/**
	 * validate the <CreditsList> elements specified
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} BasicDescription    the element whose children should be checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {string}  errCode             error code prefix to be used in reports
	 */
	/* private */  ValidateCreditsList(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, errCode) {
		
		function singleElementError(elementName, parentElementName) {
			return `only a single ${elementName.elementize()} is permitted in ${parentElementName.elementize()}`;
		}
		if (!BasicDescription) {
			errs.addError({type:APPLICATION, code:"CL000", message:"ValidateCreditsList() called with BasicDescription==null"});
			return;
		}
		let CreditsList=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_CreditsList), CG_SCHEMA);
		if (CreditsList) {
			let ci=0, CreditsItem;
			while ((CreditsItem=CreditsList.get(xPath(SCHEMA_PREFIX, tva.e_CreditsItem, ++ci), CG_SCHEMA))!=null) {
				checkAttributes(CreditsItem, [tva.a_role], [], tvaEA.CreditsItem, errs, `${errCode}-1`);
				if (CreditsItem.attr(tva.a_role)) {
					let CreditsItemRole=CreditsItem.attr(tva.a_role).value();
					if (!this.allowedCreditItemRoles.isIn(CreditsItemRole))
						errs.addError({code:`${errCode}-2`, 
										message:`${CreditsItemRole.quote()} is not valid for ${tva.a_role.attribute(tva.e_CreditsItem)}`, fragment:CreditsItem});
				}
				
				let foundPersonName=[], foundCharacter=[], foundOrganizationName=[];
				/* jshint -W083 */
				let vn=this.ValidateName;  // since this. is not allowed in a function declared within a loop
				if (CreditsItem.childNodes()) CreditsItem.childNodes().forEachSubElement(elem => {
					switch (elem.name()) {
						case tva.e_PersonName:
							foundPersonName.push(elem);
							// required to have a GivenName optionally have a FamilyName
							vn(elem, errs, `${errCode}-3`);
							break;
						case tva.e_Character:
							foundCharacter.push(elem);
							// required to have a GivenName optionally have a FamilyName
							vn(elem, errs, `${errCode}-4`);
							break;
						case tva.e_OrganizationName:
							foundOrganizationName.push(elem);
							if (unEntity(elem.text()).length > dvbi.MAX_ORGANIZATION_NAME_LENGTH)
								errs.addError({code:`${errCode}-5`, 
									message:`length of ${tva.e_OrganizationName.elementize()} in ${tva.e_CreditsItem.elementize()} exceeds ${dvbi.MAX_ORGANIZATION_NAME_LENGTH} characters`,
									fragment:elem});
							break;
						default:
							if (elem.name()!="text")
								errs.addError({code:`${errCode}-6`, message:`extra element ${elem.name().elementize()} found in ${tva.e_CreditsItem.elementize()}`, fragment:elem});
					}
				});
				/* jshint +W083 */
				if (foundPersonName.length>1)
					errs.addError({code:`${errCode}-10`, message:singleElementError(tva.e_PersonName, tva.e_CreditsItem), multiElementError:foundPersonName});
				if (foundCharacter.length>1)
					errs.addError({code:`${errCode}-11`, message:singleElementError(tva.e_Character, tva.e_CreditsItem), multiElementError:foundCharacter});
				if (foundOrganizationName.length>1)
					errs.addError({code:`${errCode}-12`, message:singleElementError(tva.e_OrganizationName, tva.e_CreditsItem), multiElementError:foundOrganizationName});
				if (foundCharacter.length>0 && foundPersonName.length==0)
					errs.addError({code:`${errCode}-13`, 
						message:`${tva.e_Character.elementize()} in ${tva.e_CreditsItem.elementize()} requires ${tva.e_PersonName.elementize()}`, line:CreditsItem.line()});
				if (foundOrganizationName.length>0 && (foundPersonName.length>0 || foundCharacter.length>0))
					errs.addError({code:`${errCode}-14`, 
						message:`${tva.e_OrganizationName.elementize()} can only be present when ${tva.e_PersonName.elementize()} and ${tva.e_OrganizationName.elementize()} are absent in ${tva.e_CreditsItem.elementize()}`,
						line:CreditsItem.line()});
			}
		}
	}


	/**
	 * validate the <RelatedMaterial> elements specified
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} BasicDescription    the element whose children should be checked
	 * @param {Class}   errs                errors found in validaton
	 */
	/* private */  ValidateRelatedMaterial(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs) {
		
		if (!BasicDescription) {
			errs.addError({type:APPLICATION, code:"RM000", message:"ValidateRelatedMaterial() called with BasicDescription==null"});
			return;
		}	
		
		let rm=0, RelatedMaterial;
		while ((RelatedMaterial=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_RelatedMaterial, ++rm), CG_SCHEMA))!=null) 
			ValidatePromotionalStillImage(RelatedMaterial, errs, BasicDescription.name().elementize(), this.knownLanguages);
	}


	/**
	 * validate the <RelatedMaterial> elements containing pagination links 
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} BasicDescription    the element whose children should be checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {string}  Location			The location of the Basic Description element
	 */
	/* private */  ValidatePagination(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, Location) {
		
		function checkLinkCounts(errs, elements, label, errCode) {
			if (elements.length>1) {
				errs.addError({code:errCode, message:`more than 1 ${quote(`${label} pagination`)} link is specified`, multiElementError:elements});
				return true;
			}
			return false;
		}	

		if (!BasicDescription) {
			errs.addError({type:APPLICATION, code:"VP000", message:"ValidatePagination() called with BasicDescription==null"});
			return;
		}
		let countPaginationFirst=[], countPaginationPrev=[], countPaginationNext=[], countPaginationLast=[];
		let rm=0, RelatedMaterial;
		while ((RelatedMaterial=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_RelatedMaterial, ++rm), CG_SCHEMA))!=null) {
			let HowRelated=RelatedMaterial.get(xPath(SCHEMA_PREFIX, tva.e_HowRelated), CG_SCHEMA);
			if (!HowRelated) 
				NoChildElement(errs, tva.e_HowRelated.elementize(), RelatedMaterial, Location, "VP001");
			else {	
				checkAttributes(HowRelated, [tva.a_href], [], tvaEA.HowRelated, errs, "VP002"); 
				if (HowRelated.attr(tva.a_href))
					switch (HowRelated.attr(tva.a_href).value()) {
						case dvbi.PAGINATION_FIRST_URI:
							countPaginationFirst.push(HowRelated);
							break;
						case dvbi.PAGINATION_PREV_URI:
							countPaginationPrev.push(HowRelated);
							break;
						case dvbi.PAGINATION_NEXT_URI:
							countPaginationNext.push(HowRelated);
							break;
						case dvbi.PAGINATION_LAST_URI:
							countPaginationLast.push(HowRelated);
							break;
					}	
				let MediaURI=RelatedMaterial.get(xPathM(SCHEMA_PREFIX, [tva.e_MediaLocator, tva.e_MediaUri]), CG_SCHEMA);
				if (MediaURI) {
					if (!isHTTPURL(MediaURI.text()))
						errs.addError({code:"VP011", message:`${tva.e_MediaUri.elementize()}=${MediaURI.text().quote()} is not a valid Pagination URL`, 
								key:"invalid URL", fragment:MediaURI});
				}
				else
					errs.addError({code:"VP010", message:`${tva.e_MediaLocator.elementize()}${tva.e_MediaUri.elementize()} not specified for pagination link`, 
						fragment:RelatedMaterial});
			}
		}

		let linkCountErrs=false;
		if (checkLinkCounts(errs, countPaginationFirst, "first", "VP011")) linkCountErrs=true;
		if (checkLinkCounts(errs, countPaginationPrev, "previous", "VP012")) linkCountErrs=true;
		if (checkLinkCounts(errs, countPaginationNext, "next", "VP013")) linkCountErrs=true;
		if (checkLinkCounts(errs, countPaginationLast, "last", "VP014")) linkCountErrs=true;

		if (!linkCountErrs) {
			let numPaginations=countPaginationFirst.length + countPaginationPrev.length + countPaginationNext.length + countPaginationLast.length;
			if (numPaginations!=0 && numPaginations!=2 && numPaginations!=4) 
				errs.addError({code:"VP020", message:`only 0, 2 or 4 paginations links may be signalled in ${tva.e_RelatedMaterial.elementize()} elements for ${Location}`,
					multiElementError:countPaginationFirst.concat(countPaginationPrev).concat(countPaginationNext).concat(countPaginationLast)});
			else if (numPaginations==2) {
				if (countPaginationPrev.length==1 && countPaginationLast.length==1) 
					errs.addError({code:"VP021", message:`${"previous".quote()} and ${"last".quote()} links cannot be specified alone`,
					multiElementError:countPaginationPrev.concat(countPaginationLast)});
				if (countPaginationFirst.length==1 && countPaginationNext.length==1) 
					errs.addError({code:"VP022", message:`${"first".quote()} and ${"next".quote()} links cannot be specified alone`,
					multiElementError:countPaginationFirst.concat(countPaginationNext)});
			}
		}
	}


	/**
	 * validate the <RelatedMaterial> elements in  More Episodes response
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} BasicDescription    the element whose children should be checked
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
					ValidatePromotionalStillImage(RelatedMaterial, errs, BasicDescription.name(), this.knownLanguages);
				break;
			case tva.e_GroupInformation:
				this.ValidatePagination(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, "More Episodes");
				break;
		}
	}

	/** TemplateAITPromotional Still Image
	 *
	 * @param {XMLnode} RelatedMaterial   the <RelatedMaterial> element (a libxmls ojbect tree) to be checked
	 * @param {Object}  errs              The class where errors and warnings relating to the serivce list processing are stored 
	 * @param {string}  Location          The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
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
			NoChildElement(errs, tva.e_HowRelated.elementize(), RelatedMaterial, Location, "TA001");
			return;
		}
		
		checkAttributes(HowRelated, [tva.a_href], [], tvaEA.HowRelated, errs, "TA002");
		if (HowRelated.attr(tva.a_href)) {
			if (HowRelated.attr(tva.a_href).value()!=dvbi.TEMPLATE_AIT_URI) 
				errs.addError({code:"TA003", message:`${tva.a_href.attribute(tva.e_HowRelated)}=${HowRelated.attr(tva.a_href).value().quote()} does not designate a Template AIT`,
								fragment:HowRelated});
			else {		
				if (MediaLocator.length!=0) 
					MediaLocator.forEach(ml => {
						let subElems=ml.childNodes(), hasAuxiliaryURI=false;
						if (subElems) subElems.forEachSubElement(child => {
							if (child.name()==tva.e_AuxiliaryURI) {
								hasAuxiliaryURI=true;
								checkAttributes(child, [tva.a_contentType], [], tvaEA.AuxiliaryURI, errs, "TA010");
								if (child.attr(tva.a_contentType)) {
									let contentType=child.attr(tva.a_contentType).value();
									if (contentType!=dvbi.XML_AIT_CONTENT_TYPE) 
										errs.addError({code:"TA011", 
											message:`invalid ${tva.a_contentType.attribute()}=${contentType.quote()} specified for ${RelatedMaterial.name().elementize()}${tva.e_MediaLocator.elementize()} in ${Location}`,
											fragment:child});
								}
							}
						});	
						if (!hasAuxiliaryURI) 
							NoChildElement(errs, tva.e_AuxiliaryURI.elementize(), MediaLocator, Location, "TA012");
					});
				else 
					NoChildElement(errs, tva.e_MediaLocator.elementize(), RelatedMaterial, Location, "TA013");
			}
		}
	}


	/**
	 * validate the <RelatedMaterial> elements specified in a Box Set List
	 *
	 * @param {string}   CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}   SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode}  BasicDescription    the element whose children should be checked
	 * @param {Class}    errs                errors found in validaton
	 */
	/* private */  ValidateRelatedMaterial_BoxSetList(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs) {
		
		if (!BasicDescription) {
			errs.addError({type:APPLICATION, code:"MB000", message:"ValidateRelatedMaterial_BoxSetList() called with BasicDescription==null"});
			return;
		}
		let countImage=[], countTemplateAIT=[], hasPagination=false;
		let rm=0, RelatedMaterial;
		while ((RelatedMaterial=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_RelatedMaterial, ++rm), CG_SCHEMA))!=null) {
			let HowRelated=RelatedMaterial.get(xPath(SCHEMA_PREFIX, tva.e_HowRelated), CG_SCHEMA);
			if (!HowRelated) 
				NoChildElement(errs, tva.e_HowRelated.elementize(), RelatedMaterial, null, "MB009");
			else {		
				checkAttributes(HowRelated, [tva.a_href], [], tvaEA.HowRelated, errs, "MB010");
				if (HowRelated.attr(tva.a_href)) {
					let hrHref=HowRelated.attr(tva.a_href).value();
					switch (hrHref) {
						case dvbi.TEMPLATE_AIT_URI:
							countTemplateAIT.push(HowRelated);
							this.ValidateTemplateAIT(RelatedMaterial, errs, BasicDescription.name().elementize());
							break;
						case dvbi.PAGINATION_FIRST_URI:
						case dvbi.PAGINATION_PREV_URI:
						case dvbi.PAGINATION_NEXT_URI:
						case dvbi.PAGINATION_LAST_URI:
							// pagination links are allowed, but checked in ValidatePagination()
							hasPagination=true;
							break;
						case tva.cs_PromotionalStillImage:  
							countImage.push(HowRelated);
							ValidatePromotionalStillImage(RelatedMaterial, errs, BasicDescription.name().elementize(), this.knownLanguages);
							break;
						default:
							cg_InvalidHrefValue(hrHref, HowRelated, tva.e_HowRelated.elementize(), `${tva.e_RelatedMaterial.elementize()} in Box Set List`, errs, "MB011");
					}	
				}
			}
		}
		if (countTemplateAIT.length==0)
			errs.addError({code:"MB021", 
					message:`a ${tva.e_RelatedMaterial.elementize()} element signalling the Template XML AIT must be specified for a Box Set List`,
					multiElementError:countTemplateAIT});
		if (countTemplateAIT.length>1)
			errs.addError({code:"MB022", 
					message:`only one ${tva.e_RelatedMaterial.elementize()} element signalling the Template XML AIT can be specified for a Box Set List`,
					multiElementError:countTemplateAIT});
		if (countImage.length>1)
			errs.addError({code:"MB023", message:`only one ${tva.e_RelatedMaterial.elementize()} element signalling the promotional still image can be specified for a Box Set List`,
					multiElementError:countImage});
		
		if (hasPagination)
			this.ValidatePagination(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, "Box Set List");
	}


	/**
	 * validate the <Title> elements specified
	 *
	 * @param {string}   CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}   SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode}  containingNode     the element whose children should be checked
	 * @param {boolean}  allowSecondary      indicates if  Title with @type="secondary" is permitted
	 * @param {Class}    errs                errors found in validaton
	 * @param {string}   errCode             error code prefix to be used in reports
	 * @param {boolean}  TypeIsRequired      true is the @type is a required attribute in this use of <Title>
	 */
	/* private */  ValidateTitle(CG_SCHEMA, SCHEMA_PREFIX, containingNode, allowSecondary, errs, errCode, TypeIsRequired) {
		
		if (!containingNode) {
			errs.addError({type:APPLICATION, code:"VT000", message:"ValidateTitle() called with containingNode==null"});
			return;
		}
		
		let mainTitles=[], secondaryTitles=[];

		let t=0, Title, requiredAttributes=[], optionalAttributes=[tva.a_lang];
		if (TypeIsRequired) 
			requiredAttributes.push(tva.a_type);
		else optionalAttributes.push(tva.a_type);
		while ((Title=containingNode.get(xPath(SCHEMA_PREFIX, tva.e_Title, ++t), CG_SCHEMA))!=null) {

			checkAttributes(Title, requiredAttributes, optionalAttributes, tvaEA.Title, errs, `${errCode}-1`);
			
			let titleType=Title.attr(tva.a_type) ? Title.attr(tva.a_type).value() : mpeg7.DEFAULT_TITLE_TYPE;
			let titleLang=GetNodeLanguage(Title, false, errs, `${errCode}-2`, this.knownLanguages);
			let titleStr=unEntity(Title.text());
			
			if (titleStr.length > dvbi.MAX_TITLE_LENGTH)
				errs.addError({code:`${errCode}-11`, message:`${tva.e_Title.elementize()} length exceeds ${dvbi.MAX_TITLE_LENGTH} characters`, fragment:Title});
/* jshint -W083*/				
			switch (titleType) {
				case mpeg7.TITLE_TYPE_MAIN:
					if (mainTitles.find(e => e.lang == titleLang)) 
						errs.addError({code:`${errCode}-12`, 
							message:`only a single language (${titleLang}) is permitted for ${tva.a_type.attribute(tva.e_Title)}=${mpeg7.TITLE_TYPE_MAIN.quote()}`});
					else mainTitles.push({lang:titleLang, elem:Title});
					break;
				case mpeg7.TITLE_TYPE_SECONDARY:
					if (allowSecondary) {
						if (secondaryTitles.find(e => e.lang==titleLang))
							errs.addError({code:`${errCode}-13`, 
								message:`only a single language (${titleLang}) is permitted for ${tva.a_type.attribute(tva.e_Title)}=${mpeg7.TITLE_TYPE_SECONDARY.quote()}`});
						else secondaryTitles.push({lang:titleLang, elem:Title});						
					}
					else 
						errs.addError({code:`${errCode}-14`, 
							message:`${tva.a_type.attribute(tva.e_Title)}=${mpeg7.TITLE_TYPE_SECONDARY.quote()} is not permitted for this ${containingNode.name().elementize()}`, 
							fragment:Title});
					break;
				default:	
					errs.addError({code:`${errCode}-15`, 
						message:`${tva.a_type.attribute()} must be ${mpeg7.TITLE_TYPE_MAIN.quote()} or ${mpeg7.TITLE_TYPE_SECONDARY.quote()} for ${tva.e_Title.elementize()}`,
						fragment:Title});
			}
/* jshint +W083*/	
		}
		secondaryTitles.forEach(item => {
			if (!mainTitles.find(e => e.lang==item.lang)) {
				let tLoc= item.lang!=DEFAULT_LANGUAGE ? ` for @xml:${tva.a_lang}=${item.lang.quote()}` : "";
				errs.addError({code:`${errCode}-16`, 
					message:`${tva.a_type.attribute()}=${mpeg7.TITLE_TYPE_SECONDARY.quote()} specified without ${tva.a_type.attribute()}=${mpeg7.TITLE_TYPE_MAIN.quote()}${tLoc}`,
					fragment:item.elem});
			}
		});
	}


	/**
	 * validate the <BasicDescription> element against the profile for the given request/response type
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} parentElement  	    the element whose children should be checked
	 * @param {string}  requestType         the type of content guide request being checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {XMLnode} categoryGroup       the GroupInformation element that others must refer to through <MemberOf>
	 */
	/* private */  ValidateBasicDescription(CG_SCHEMA, SCHEMA_PREFIX, parentElement, requestType, errs, categoryGroup) {

		if (!parentElement) {
			errs.addError({type:APPLICATION, code:"BD000", message:"ValidateBasicDescription() called with parentElement==null"});
			return;
		}

		let isParentGroup=parentElement==categoryGroup;
		let BasicDescription=parentElement.get(xPath(SCHEMA_PREFIX, tva.e_BasicDescription), CG_SCHEMA);
		if (!BasicDescription) {
			NoChildElement(errs, tva.e_BasicDescription.elementize(), parentElement, null, "BD010");
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
							tvaEC.BasicDescription,
							false, errs, "BD010");
						this.ValidateTitle(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, true, errs, "BD011", true);
						this.ValidateSynopsis(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, [tva.SYNOPSIS_MEDIUM_LABEL], [tva.SYNOPSIS_SHORT_LABEL], requestType, errs, "BD012");
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
							tvaEC.BasicDescription,
							false, errs, "BD020");
						this.ValidateTitle(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, true, errs, "BD021", true);
						this.ValidateSynopsis(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, [tva.SYNOPSIS_MEDIUM_LABEL], [tva.SYNOPSIS_SHORT_LABEL, tva.SYNOPSIS_LONG_LABEL], requestType, errs, "BD022");
						this.ValidateKeyword(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, 0, 20, errs, "BD023");
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
							tvaEC.BasicDescription,
							false, errs, "BD030");
						this.ValidateTitle(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, true, errs, "BD031", true);
						this.ValidateSynopsis(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, [], [tva.SYNOPSIS_MEDIUM_LABEL], requestType, errs, "BD032");
						this.ValidateParentalGuidance(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, "BD033");
						this.ValidateRelatedMaterial(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription,  errs);
						break;
					case CG_REQUEST_MORE_EPISODES:
						checkTopElementsAndCardinality(BasicDescription,
							[{name:tva.e_Title, maxOccurs:Infinity},
							 {name:tva.e_RelatedMaterial, minOccurs:0}],
							tvaEC.BasicDescription,
							false, errs, "BD040");
						this.ValidateTitle(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, true, errs, "BD041", true);
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
						checkTopElementsAndCardinality(BasicDescription, [], tvaEC.BasicDescription, false, errs, "BD060");
						break;
					case CG_REQUEST_BS_CONTENTS:
						// BasicDescription must be empty
						checkTopElementsAndCardinality(BasicDescription, [], tvaEC.BasicDescription, false, errs, "BD090");
						break;
					case CG_REQUEST_BS_LISTS:	// 6.10.5.5
						if (isParentGroup)
							checkTopElementsAndCardinality(BasicDescription, [{name:tva.e_Title, maxOccurs:Infinity}], tvaEC.BasicDescription, false, errs, "BD061");
						else checkTopElementsAndCardinality(BasicDescription, 
									[{name:tva.e_Title, maxOccurs:Infinity},
									 {name:tva.e_Synopsis, maxOccurs:Infinity},
									 {name:tva.e_Keyword, minOccurs:0, maxOccurs:Infinity},
									 {name:tva.e_RelatedMaterial, minOccurs:0, maxOccurs:Infinity}],
									tvaEC.BasicDescription, false, errs, "BD062");
						
						this.ValidateTitle(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, false, errs, "BD063", false);
						if (!isParentGroup) {
							this.ValidateSynopsis(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, [tva.SYNOPSIS_MEDIUM_LABEL], [], requestType, errs, "BD064");
							this.ValidateKeyword(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, 0, 20, errs, "BD065");
							this.ValidateRelatedMaterial_BoxSetList(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs);
						}
					break;
					case CG_REQUEST_MORE_EPISODES: 
						checkTopElementsAndCardinality(BasicDescription, [{name:tva.e_RelatedMaterial, maxOccurs:4}], tvaEC.BasicDescription, false, errs, "BD070");
						this.ValidateRelatedMaterial_MoreEpisodes(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs);
						break;
					case CG_REQUEST_BS_CATEGORIES:
						if (isParentGroup)
							checkTopElementsAndCardinality(BasicDescription, [{name:tva.e_Title, maxOccurs:Infinity}], tvaEC.BasicDescription, false, errs, "BD080");
						else checkTopElementsAndCardinality(BasicDescription,
										[{name:tva.e_Title, maxOccurs:Infinity},
										 {name:tva.e_Synopsis, maxOccurs:Infinity},
										 {name:tva.e_Genre, minOccurs:0},
										 {name:tva.e_RelatedMaterial, minOccurs:0}],
										tvaEC.BasicDescription,
										false, errs, "BD081");
						this.ValidateTitle(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, false, errs, "BD082", false);
						if (!isParentGroup)
							this.ValidateSynopsis(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, [tva.SYNOPSIS_SHORT_LABEL], [], requestType, errs, "BD083");
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
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} ProgramInformation  the element whose children should be checked
	 * @param {array}   programCRIDs        array to record CRIDs for later use 
	 * @param {array}   groupCRIDs          array of CRIDs found in the GroupInformationTable (null if not used)
	 * @param {string}  requestType         the type of content guide request being checked
	 * @param {array}   indexes             array of @index values from other elements in the same table - for duplicate detection
	 * @param {Class}   errs                errors found in validaton
	 * @returns {String} CRID if the current program, if this is it
	 */
	/* private */  ValidateProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramInformation, programCRIDs, groupCRIDs, requestType, indexes, errs) {
		
		if (!ProgramInformation) {
			errs.addError({type:APPLICATION, code:"PI000", message:"ValidateProgramInformation() called with ProgramInformation==null"});
			return null;
		}
		
		checkTopElementsAndCardinality(ProgramInformation, 
				[{name:tva.e_BasicDescription},
				 {name:tva.e_OtherIdentifier, minOccurs:0, maxOccurs:Infinity},
				 {name:tva.e_MemberOf, minOccurs:0, maxOccurs:Infinity},
				 {name:tva.e_EpisodeOf, minOccurs:0, maxOccurs:Infinity}],
				tvaEC.ProgramInformation, 
				false, errs, "PI001");		
		checkAttributes(ProgramInformation, [tva.a_programId], [tva.a_lang], [tva.a_metadataOriginIDRef, tva.a_fragmentId, tva.a_fragmentVersion, tva.a_fragmentExpirationDate], errs, "PI002");

		let piLang=GetNodeLanguage(ProgramInformation, false, errs,  "PI010", this.knownLanguages);
		let isCurrentProgram=false, programCRID=null;
		
		if (ProgramInformation.attr(tva.a_programId)) {
			programCRID=ProgramInformation.attr(tva.a_programId).value();
			if (!isCRIDURI(programCRID)) 
				errs.addError({code:"PI011", message:`${tva.a_programId.attribute(ProgramInformation.name())} is not a valid CRID (${programCRID})`, line:ProgramInformation.line()});
			if (isIni(programCRIDs, programCRID))
				errs.addError({code:"PI012", message:`${tva.a_programId.attribute(ProgramInformation.name())}=${programCRID.quote()} is already used`, line:ProgramInformation.line()});
			else programCRIDs.push(programCRID);
		}

		// <ProgramInformation><BasicDescription>
		this.ValidateBasicDescription(CG_SCHEMA, SCHEMA_PREFIX, ProgramInformation, requestType, errs, null);

		let children=ProgramInformation.childNodes();
		if (children) children.forEachSubElement(child => {
			switch (child.name()) {
				case tva.e_OtherIdentifier:		// <ProgramInformation><OtherIdentifier>
				checkAttributes(child, [], [], tvaEA.OtherIdentifier, errs, "PI021");
				if (requestType==CG_REQUEST_MORE_EPISODES)
						errs.addError({code:"PI022", message:`${tva.e_OtherIdentifier.elementize()} is not permitted in this request type`, fragment:child});
					break;
				case tva.e_EpisodeOf:			// <ProgramInformation><EpisodeOf>
					checkAttributes(child, [tva.a_crid], [], [tva.a_index], errs, "PI031");
					
					// <ProgramInformation><EpisodeOf>@crid
					if (child.attr(tva.a_crid)) {
						let foundCRID=child.attr(tva.a_crid).value();
						if (groupCRIDs && !isIni(groupCRIDs, foundCRID)) 
							errs.addError({code:"PI032", 
								message:`${tva.a_crid.attribute(`${ProgramInformation.name()}.${tva.e_EpisodeOf}`)}=${foundCRID.quote()} is not a defined Group CRID for ${tva.e_EpisodeOf.elementize()}`,
								fragment:child});
						else
							if (!isCRIDURI(foundCRID))
								errs.addError({code:"PI033", message:`${tva.a_crid.attribute(`${ProgramInformation.name()}.${tva.e_EpisodeOf}`)}=${foundCRID.quote()} is not a valid CRID`, fragment:child});
					}
					break;
				case tva.e_MemberOf:			// <ProgramInformation><MemberOf>
					if ([CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_WINDOW].includes(requestType)) {
						// xsi:type is optional for Now/Next
						checkAttributes(child, [tva.a_index, tva.a_crid], [tva.a_type], tvaEA.MemberOf, errs, "PI041");
						if (child.attr(tva.a_crid) && child.attr(tva.a_crid).value()==dvbi.CRID_NOW)
							isCurrentProgram=true;
					}
					else 
						checkAttributes(child, [tva.a_type, tva.a_index, tva.a_crid], [], tvaEA.MemberOf, errs, "PI042");
							
					// <ProgramInformation><MemberOf>@xsi:type
					if (child.attr(tva.a_type) && child.attr(tva.a_type).value()!=tva.t_MemberOfType)
						errs.addError({code:"PI043", message:`${attribute(`xsi:${tva.a_type}`)} must be ${tva.t_MemberOfType.quote()} for ${ProgramInformation.name()}.${tva.e_MemberOf}`, fragment:child});
				
					// <ProgramInformation><MemberOf>@crid
					let foundCRID=null;
					if (child.attr(tva.a_crid)) {
						foundCRID=child.attr(tva.a_crid).value();
						if (groupCRIDs && !isIni(groupCRIDs, foundCRID)) 
							errs.addError({code:"PI044", 
								message:`${tva.a_crid.attribute(`${ProgramInformation.name()}.${tva.e_MemberOf}`)}=${foundCRID.quote()} is not a defined Group CRID for ${tva.e_MemberOf.elementize()}`,
								fragment:child});
						else
							if (!isCRIDURI(foundCRID))
								errs.addError({code:"PI045", message:`${tva.a_crid.attribute(`${ProgramInformation.name()}.${tva.e_MemberOf}`)}=${foundCRID.quote()} is not a valid CRID`,
												fragment:child});
					}
					
					// <ProgramInformation><MemberOf>@index
					if (child.attr(tva.a_index)) {
						let index=valUnsignedInt(child.attr(tva.a_index).value());
						let indexInCRID=`${(foundCRID?foundCRID:"noCRID")}(${index})`;
						if (isIni(indexes, indexInCRID))
							errs.addError({code:"PI046", message:`${tva.a_index.attribute(tva.e_MemberOf)}=${index} is in use by another ${ProgramInformation.name()} element`,
									fragment:child});
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
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} ProgramDescription  the element containing the <ProgramInformationTable>
	 * @param {array}   programCRIDs        array to record CRIDs for later use 
	 * @param {array}   groupCRIDs          array of CRIDs found in the GroupInformationTable (null if not used)
	 * @param {string}  requestType         the type of content guide request being checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {integer} o.childCount        the number of child elements to be present (to match GroupInformation@numOfItems)
	 * @returns {string} the CRID of the currently airing program (that which is a member of the "now" structural crid)
	 */
	/* private */  CheckProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, programCRIDs, groupCRIDs, requestType, errs, o=null) { 
		if (!ProgramDescription) {
			errs.addError({type:APPLICATION, code:"PI100", message:"CheckProgramInformation() called with ProgramDescription==null"});
			return null;
		}
			
		let ProgramInformationTable=ProgramDescription.get(xPath(SCHEMA_PREFIX, tva.e_ProgramInformationTable), CG_SCHEMA);
		if (!ProgramInformationTable) {
			//errs.addError({code:"PI101", message:`${tva.e_ProgramInformationTable.elementize()} not specified in ${ProgramDescription.name().elementize()}, line:ProgramDescription.line()`});
			return null;
		}
		checkAttributes(ProgramInformationTable, [], [tva.a_lang], tvaEA.ProgramInformationTable, errs, "PI102");
		GetNodeLanguage(ProgramInformationTable, false, errs, "PI103", this.knownLanguages);

		let pi=0, ProgramInformation, cnt=0, indexes=[], currentProgramCRID=null;
		while ((ProgramInformation=ProgramInformationTable.get(xPath(SCHEMA_PREFIX, tva.e_ProgramInformation, ++pi), CG_SCHEMA))!=null) {
			let t=this.ValidateProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramInformation, programCRIDs, groupCRIDs, requestType, indexes, errs);
			if (t) currentProgramCRID=t;
			cnt++; 
		}

		if (o && o.childCount!=0) {
			if (o.childCount!=cnt)
				errs.addError({code:"PI110", 
					message:`number of items (${cnt}) in the ${tva.e_ProgramInformationTable.elementize()} does not match ${tva.a_numOfItems.attribute(tva.e_GroupInformation)} specified in ${CATEGORY_GROUP_NAME} (${o.childCount})`,
					line:ProgramInformationTable.line()});
		}
		return currentProgramCRID;
	}


	/**
	 * validate the <GroupInformation> element for Box Set related requests
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} GroupInformation    the element whose children should be checked
	 * @param {string}  requestType         the type of content guide request being checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {object}  categoryGroup       the GroupInformationElement that others must refer to through <MemberOf>
	 * @param {array}   indexes			    an accumulation of the @index values found
	 * @param {array}   groupsFound         groupId values found (null if not needed)
	 */
	/* private */  ValidateGroupInformationBoxSets(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, categoryGroup, indexes, groupsFound) {

		if (!GroupInformation) {
			errs.addError({type:APPLICATION, code:"GIB000", message:"ValidateGroupInformationBoxSets() called with GroupInformation==null"});
			return;
		}
		let isParentGroup=GroupInformation==categoryGroup;
	
		switch (requestType) {
			case CG_REQUEST_BS_CATEGORIES:
				if (isParentGroup) {
					checkAttributes(GroupInformation, [tva.a_groupId], [tva.a_lang, tva.a_ordered, tva.a_numOfItems], tvaEA.GroupInformation, errs, "GIB001");
					checkTopElementsAndCardinality(GroupInformation,
						[{name:tva.e_GroupType},
						 {name:tva.e_BasicDescription, minOccurs:0}],
						tvaEC.GroupInformation, 
						false, errs, "GIB002");
				}
				else {
					checkAttributes(GroupInformation, [tva.a_groupId], [tva.a_lang], tvaEA.GroupInformation, errs, "GIB003");
					checkTopElementsAndCardinality(GroupInformation,
						[{name:tva.e_GroupType},
						 {name:tva.e_BasicDescription, minOccurs:0},
						 {name:tva.e_MemberOf}],
						tvaEC.GroupInformation,
						false, errs, "GIB004");
				}
				break;
			case CG_REQUEST_BS_LISTS:
				if (isParentGroup) {
					checkAttributes(GroupInformation, [tva.a_groupId], [tva.a_lang, tva.a_ordered, tva.a_numOfItems], tvaEA.GroupInformation, errs, "GIB005");
					checkTopElementsAndCardinality(GroupInformation,
						[{name:tva.e_GroupType},
						 {name:tva.e_BasicDescription, minOccurs:0}],
						tvaEC.GroupInformation,
						false, errs, "GIB006");
				}
				else {
					checkAttributes(GroupInformation, [tva.a_groupId], [tva.a_lang, tva.a_serviceIDRef], tvaEA.GroupInformation, errs, "GIB007");
					checkTopElementsAndCardinality(GroupInformation,
						[{name:tva.e_GroupType},
						 {name:tva.e_BasicDescription, minOccurs:0},
						 {name:tva.e_MemberOf}],
						tvaEC.GroupInformation,
						false, errs, "GIB008");
				}
				break;
			case CG_REQUEST_BS_CONTENTS:
				checkAttributes(GroupInformation, [tva.a_groupId], [tva.a_lang, tva.a_ordered, tva.a_numOfItems, tva.a_serviceIDRef], tvaEA.GroupInformation, errs, "GIB009"); //!!HERE
				checkTopElementsAndCardinality(GroupInformation,
					[{name:tva.e_GroupType},
					 {name:tva.e_BasicDescription, minOccurs:0}],
					tvaEC.GroupInformation,
					false, errs, "GIB010");
				break;
		}

		if (GroupInformation.attr(tva.a_groupId)) {
			let groupId=GroupInformation.attr(tva.a_groupId).value();
			if (isCRIDURI(groupId)) {
				if (groupsFound) 
					groupsFound.push(groupId);				
			}
		}

		let categoryCRID=(categoryGroup && categoryGroup.attr(tva.a_groupId)) ? categoryGroup.attr(tva.a_groupId).value() : "";

		if (!isParentGroup) {
			let MemberOf=GroupInformation.get(xPath(SCHEMA_PREFIX, tva.e_MemberOf), CG_SCHEMA);
			if (MemberOf) {
				checkAttributes(MemberOf, [tva.a_type, tva.a_index, tva.a_crid], [], tvaEA.MemberOf, errs, "GIB041");
				if (MemberOf.attr(tva.a_type) && MemberOf.attr(tva.a_type).value()!=tva.t_MemberOfType)
					errs.addError({code:"GIB042", message:`${GroupInformation.name()}.${tva.e_MemberOf}@xsi:${tva.a_type} is invalid (${MemberOf.attr(tva.a_type).value().quote()})`,
									fragment:MemberOf});
				
				if (MemberOf.attr(tva.a_index)) {
					let index=valUnsignedInt(MemberOf.attr(tva.a_index).value());
					if (index>=1) {
						if (indexes) {
							if (indexes.includes(index)) 
								errs.addError({code:"GI043", message:`duplicated ${tva.a_index.attribute(`${GroupInformation.name()}.${tva.e_MemberOf}`)} values (${index})`,
									fragment:MemberOf});
							else indexes.push(index);
						}
					}
					else 
						errs.addError({code:"GIB44", message:`${tva.a_index.attribute(`${GroupInformation.name()}.${tva.e_MemberOf}`)} must be an integer >= 1 (parsed ${index})`, 
										fragment:MemberOf});
				}

				if (MemberOf.attr(tva.a_crid) && MemberOf.attr(tva.a_crid).value()!=categoryCRID)
					errs.addError({code:"GIB045", 
						message:`${tva.a_crid.attribute(`${GroupInformation.name()}.${tva.e_MemberOf}`)} (${MemberOf.attr(tva.a_crid).value()}) does not match the ${CATEGORY_GROUP_NAME} crid (${categoryCRID})`,
						fragment:MemberOf});
			}
			else
				errs.addError({code:"GIB046", message:`${GroupInformation.name()} requires a ${tva.e_MemberOf.elementize()} element referring to the ${CATEGORY_GROUP_NAME} (${categoryCRID})`,
								line:GroupInformation.line()});
		}
		
		this.checkTAGUri(GroupInformation, errs, "GIB51");	
		
		// <GroupInformation><BasicDescription>
		this.ValidateBasicDescription(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, categoryGroup);
	}


	/**
	 * validate the <GroupInformation> element for Schedules related requests
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} GroupInformation    the element whose children should be checked
	 * @param {string}  requestType         the type of content guide request being checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {XMLnode} categoryGroup       the GroupInformationElement that others must refer to through <MemberOf>
	 */
	/* private */  ValidateGroupInformationSchedules(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, categoryGroup) {

		if (!GroupInformation) {
			errs.addError({type:APPLICATION, code:"GIS000", message:"ValidateGroupInformationSchedules() called with GroupInformation==null"});
			return;
		}
		checkAttributes(GroupInformation, [tva.a_groupId, tva.a_ordered, tva.a_numOfItems], [tva.a_lang], tvaEA.GroupInformation, errs, "GIS001");

		if (GroupInformation.attr(tva.a_groupId)) {
			let groupId=GroupInformation.attr(tva.a_groupId).value();
			if ([CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_WINDOW].includes(requestType)) 
				if (!([dvbi.CRID_NOW, dvbi.CRID_LATER, dvbi.CRID_EARLIER].includes(groupId)))
					errs.addError({code:"GIS011", message:`${tva.a_groupId.attribute(GroupInformation.name())} value ${groupId.quote()} is not valid for this request type`, line:GroupInformation.line()});
		}

		if ([CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_WINDOW].includes(requestType)) {		
			TrueValue(GroupInformation, tva.a_ordered, "GIS013", errs);
			if (!GroupInformation.attr(tva.a_numOfItems)) 
				errs.addError({code:"GIS015", message:`${tva.a_numOfItems.attribute(GroupInformation.name())} is required for this request type`, line:GroupInformation.line()});
		}

		// <GroupInformation><BasicDescription>
		this.ValidateBasicDescription(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, categoryGroup);	
	}


	/**
	 * validate the <GroupInformation> element for More Episodes requests
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} GroupInformation    the element whose children should be checked
	 * @param {string}  requestType         the type of content guide request being checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {XMLnode} categoryGroup       the GroupInformationElement that others must refer to through <MemberOf>
	 * @param {array}   groupsFound         groupId values found (null if not needed)
	 */
	/* private */  ValidateGroupInformationMoreEpisodes(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, categoryGroup, groupsFound) {
		
		if (!GroupInformation) {
			errs.addError({type:APPLICATION, code:"GIM000", message:"ValidateGroupInformationMoreEpisodes() called with GroupInformation==null"});
			return;
		}
		if (categoryGroup) 
			errs.addError({code:"GIM001", message:`${CATEGORY_GROUP_NAME} should not be specified for this request type`, line:GroupInformation.line()});
		
		checkAttributes(GroupInformation, [tva.a_groupId, tva.a_ordered, tva.a_numOfItems], [tva.a_lang], tvaEA.GroupInformation, errs, "GIM002");
		
		if (GroupInformation.attr(tva.a_groupId)) {
			let groupId=GroupInformation.attr(tva.a_groupId).value();
			if (!isCRIDURI(groupId)) 
				errs.addError({code:"GIM003", message:`${tva.a_groupId.attribute(GroupInformation.name())} value ${groupId.quote()} is not a valid CRID`, line:GroupInformation.line()});
			else 
				groupsFound.push(groupId);
		}

		TrueValue(GroupInformation, tva.a_ordered, "GIM004", errs, false);
		
		let GroupType=GroupInformation.get(xPath(SCHEMA_PREFIX, tva.e_GroupType), CG_SCHEMA);
		if (GroupType) {
			checkAttributes(GroupType, [tva.a_type, tva.a_value], [], tvaEA.GroupType, errs, "GIM011");
			
			if (GroupType.attr(tva.a_type) && GroupType.attr(tva.a_type).value()!=tva.t_ProgramGroupTypeType) 
				errs.addError({code:"GIM012", message:`${tva.e_GroupType}@xsi:${tva.a_type} must be ${tva.t_ProgramGroupTypeType.quote()}`, fragment:GroupType});
			if (GroupType.attr(tva.a_value) && GroupType.attr(tva.a_value).value()!="otherCollection") 
				errs.addError({code:"GIM013", message:`${tva.a_value.attribute(tva.e_GroupType)} must be ${"otherCollection".quote()}`, fragment:GroupType});
		}
		else
			errs.addError({code:"GIM014", message:`${tva.e_GroupType.elementize()} is required in ${GroupInformation.name().elementize()}`, line:GroupInformation.line()});

		// <GroupInformation><BasicDescription>
		this.ValidateBasicDescription(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, categoryGroup);
	}


	/**
	 * validate the <GroupInformation> element against the profile for the given request/response type
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} GroupInformation    the element whose children should be checked
	 * @param {string}  requestType         the type of content guide request being checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {XMLnode} categoryGroup       the GroupInformationElement that others must refer to through <MemberOf>
	 * @param {array}   indexes			    an accumulation of the @index values found
	 * @param {array}   groupsFound         groupId values found (null if not needed)
	 */
	/* private */  ValidateGroupInformation(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, categoryGroup, indexes, groupsFound) {

		if (!GroupInformation) {
			errs.addError({type:APPLICATION, code:"GI000", message:"ValidateGroupInformation() called with GroupInformation==null"});
			return;
		}

		let giLang=GetNodeLanguage(GroupInformation, false, errs, "GI001", this.knownLanguages);
		
		switch (requestType) {
			case CG_REQUEST_SCHEDULE_NOWNEXT:
			case CG_REQUEST_SCHEDULE_WINDOW:
				this.ValidateGroupInformationSchedules(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, categoryGroup);
				break;
			case CG_REQUEST_BS_CATEGORIES:
			case CG_REQUEST_BS_LISTS:
			case CG_REQUEST_BS_CONTENTS:
				this.ValidateGroupInformationBoxSets(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, categoryGroup, indexes, groupsFound);
				break;		
			case CG_REQUEST_MORE_EPISODES:
				this.ValidateGroupInformationMoreEpisodes(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, categoryGroup, groupsFound);
				break;				
		}

		let GroupType=GroupInformation.get(xPath(SCHEMA_PREFIX, tva.e_GroupType), CG_SCHEMA);
		if (GroupType) {
			if (!(GroupType.attr(tva.a_type) && GroupType.attr(tva.a_type).value()==tva.t_ProgramGroupTypeType)) 
				errs.addError({code:"GI011", message:`${tva.e_GroupType}@xsi:${tva.a_type}=${tva.t_ProgramGroupTypeType.quote()} is required`, fragment:GroupType});
			if (!(GroupType.attr(tva.a_value) && GroupType.attr(tva.a_value).value()=="otherCollection")) 
				errs.addError({code:"GI022", message:`${tva.a_value.attribute(tva.e_GroupType)}=${"otherCollection".quote()} is required`, fragment:GroupType});
		}
		else
			errs.addError({code:"GI014", message:`${tva.e_GroupType.elementize()} is required in ${GroupInformation.name().elementize()}`, line:GroupInformation.line()});
	}


	/**
	 * find and validate any <GroupInformation> elements in the <GroupInformationTable>
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} ProgramDescription  the element containing the <ProgramInformationTable>
	 * @param {string}  requestType         the type of content guide request being checked
	 * @param {array}   groupIds            buffer to recieve the group ids parsed (null if not needed)
	 * @param {Class}   errs                errors found in validaton
	 * @param {integer} o.childCount        the value from the @numItems attribute of the "category group"
	 */
	/* private */  CheckGroupInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, requestType, groupIds, errs, o) { 
		
		if (!ProgramDescription) {
			errs.addError({type:APPLICATION, code:"GI100", message:"CheckGroupInformation() called with ProgramDescription==null"});
			return;
		}
		let gi, GroupInformation;
		let GroupInformationTable=ProgramDescription.get(xPath(SCHEMA_PREFIX, tva.e_GroupInformationTable), CG_SCHEMA);
		
		if (!GroupInformationTable) {
			//errs.addError({code:"GI101", message:`${tva.e_GroupInformationTable.elementize()} not specified in ${ProgramDescription.name().elementize()}`, line:ProgramDescription.line()});
			return;
		}
		let gitLang=GetNodeLanguage(GroupInformationTable, false, errs, "GI102", this.knownLanguages);

		// find which GroupInformation element is the "category group"
		let categoryGroup=null;
		if ([CG_REQUEST_BS_LISTS, CG_REQUEST_BS_CATEGORIES, CG_REQUEST_BS_CONTENTS].includes(requestType)) {
			gi=0;
			while ((GroupInformation=GroupInformationTable.get(xPath(SCHEMA_PREFIX, tva.e_GroupInformation, ++gi), CG_SCHEMA))!=null) {
				// this GroupInformation element is the "category group" if it does not contain a <MemberOf> element
				if (CountChildElements(GroupInformation, tva.e_MemberOf)==0) {
					// this GroupInformation element is not a member of another GroupInformation so it must be the "category group"
					if (categoryGroup)
						errs.addError({code:"GI111", message:`only a single ${CATEGORY_GROUP_NAME} can be present in ${tva.e_GroupInformationTable.elementize()}`, line:GroupInformation.line()});
					else categoryGroup=GroupInformation;
				}
			}
			if (!categoryGroup)
				errs.addError({code:"GI112", message:`a ${CATEGORY_GROUP_NAME} must be specified in ${tva.e_GroupInformationTable.elementize()} for this request type`, line:GroupInformation.line()});
		}
		
		let indexes=[], giCount=0;
		gi=0;
		while ((GroupInformation=GroupInformationTable.get(xPath(SCHEMA_PREFIX, tva.e_GroupInformation, ++gi), CG_SCHEMA))!=null) {
			this.ValidateGroupInformation(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, categoryGroup, indexes, groupIds);
			if (GroupInformation!=categoryGroup) 
				giCount++;
		}
		if (categoryGroup) {
			let numOfItems=(categoryGroup.attr(tva.a_numOfItems) ? valUnsignedInt(categoryGroup.attr(tva.a_numOfItems).value()) : 0);
			if (requestType!=CG_REQUEST_BS_CONTENTS && numOfItems!=giCount)
				errs.addError({code:"GI113", 
								message:`${tva.a_numOfItems.attribute(tva.e_GroupInformation)} specified in ${CATEGORY_GROUP_NAME} (${numOfItems}) does match the number of items (${giCount})`,
								line:categoryGroup.line()});

			if (o) 
				o.childCount=numOfItems;
		}

		if (requestType==CG_REQUEST_MORE_EPISODES && giCount>1)
			errs.addError({code:"GI114", message:`only one ${tva.e_GroupInformation.elementize()} element is premitted for this request type`, line:GroupInformationTable.line()});
	}


	/**
	 * validate the <GroupInformation> element against the profile for the given request/response type
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} GroupInformation    the element whose children should be checked
	 * @param {string}  requestType         the type of content guide request being checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {int}     numEarlier		    maximum number of <GroupInformation> elements that are earlier
	 * @param {int}     numNow			    maximum number of <GroupInformation> elements that are now
	 * @param {int}     numLater			maximum number of <GroupInformation> elements that are later
	 * @param {array}   groupCRIDsFound     list of structural crids already found in this response
	 */
	/* private */  ValidateGroupInformationNowNext(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, numEarlier, numNow, numLater, groupCRIDsFound) {

		function validValues(errs, numOfItems, numAllowed, grp, element) {
			if (numOfItems<=0)
				errs.addError({code:"VNN101", message:`${tva.a_numOfItems.attribute(tva.e_GroupInformation)} must be > 0 for ${grp.quote()}`, line:element.line()});		
			if (numOfItems>numAllowed)
				errs.addError({code:"VNN102", message:`${tva.a_numOfItems.attribute(tva.e_GroupInformation)} must be <= ${numAllowed} for ${grp.quote()}`, line:element.line()});
		}
		
		if (!GroupInformation) {
			errs.addError({type:APPLICATION, code:"VNN000", message:"ValidateGroupInformationNowNext() called with GroupInformation==null"});
			return;
		}

		// NOWNEXT and WINDOW GroupInformationElements contains the same syntax as other GroupInformationElements
		this.ValidateGroupInformation(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, null, null, null );
		
		if (GroupInformation.attr(tva.a_groupId)) {
			let grp=GroupInformation.attr(tva.a_groupId).value();
			if ((grp==dvbi.CRID_EARLIER && numEarlier>0) || (grp==dvbi.CRID_NOW && numNow>0) || (grp==dvbi.CRID_LATER && numLater>0)) {
				let numOfItems=GroupInformation.attr(tva.a_numOfItems)?valUnsignedInt(GroupInformation.attr(tva.a_numOfItems).value()):-1;
				switch (grp) {
					case dvbi.CRID_EARLIER:
						validValues(errs, numOfItems, numEarlier, grp, GroupInformation);
						break;
					case dvbi.CRID_NOW:
						validValues(errs, numOfItems, numNow, grp, GroupInformation);
						break;
					case dvbi.CRID_LATER:
						validValues(errs, numOfItems, numLater, grp, GroupInformation);
						break;
				}
				if (isIni(groupCRIDsFound, grp))
					errs.addError({code:"VNN001", message:`only a single ${grp.quote()} structural CRID is premitted in this request`, line:GroupInformation.line()});
				else 
					groupCRIDsFound.push(grp);
			}
			else 
				errs.addError({code:"VNN002", message:`${tva.e_GroupInformation.elementize()} for ${grp.quote()} is not permitted for this request type`, line:GroupInformation.line()});
		}
	}


	/**
	 * find and validate any <GroupInformation> elements used for now/next in the <GroupInformationTable>
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} ProgramDescription  the element containing the <ProgramInformationTable>
	 * @param {array}   groupIds            array of GroupInformation@CRID values found
	 * @param {string}  requestType         the type of content guide request being checked
	 * @param {Class}   errs                errors found in validaton
	 */
	/* private */  CheckGroupInformationNowNext(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, groupIds, requestType, errs) { 
		
		if (!ProgramDescription) {
			errs.addError({type:APPLICATION, code:"NN000", message:"CheckGroupInformationNowNext() called with ProgramDescription==null"});
			return;
		}
		
		let GroupInformationTable=ProgramDescription.get(xPath(SCHEMA_PREFIX, tva.e_GroupInformationTable), CG_SCHEMA);
		if (!GroupInformationTable) {
			errs.addError({code:"NN001", message:`${tva.e_GroupInformationTable.elementize()} not specified in ${ProgramDescription.name().elementize()}`, line:ProgramDescription.line()});
			return;
		}
		let gitLang=GetNodeLanguage(GroupInformationTable, false, errs, "NM002", this.knownLanguages);
		
		let gi=0, GroupInformation;
		while ((GroupInformation=GroupInformationTable.get(xPath(SCHEMA_PREFIX, tva.e_GroupInformation, ++gi), CG_SCHEMA))!=null) {	
			switch (requestType) {
				case CG_REQUEST_SCHEDULE_NOWNEXT:
					this.ValidateGroupInformationNowNext(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, 0, 1, 1, groupIds);
					break;
				case CG_REQUEST_SCHEDULE_WINDOW:
					this.ValidateGroupInformationNowNext(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, 10, 1, 10, groupIds);
					break;
				default:
					errs.addError({code:"NN003", message:`${tva.e_GroupInformation.elementize()} not processed for this request type`, line:GroupInformation.line()});
			}
		}
	}


	/**
	 * validate any <AVAttributes> elements in <InstanceDescription> elements
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} AVAttributes        the <AVAttributes> node to be checked
	 * @param {Class}   errs                errors found in validaton
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
			tvaEC.AVAttributes,
			false, errs, "AV001");

		// <AudioAttributes>
		let aa=0, AudioAttributes, foundAttributes=[], audioCounts=[];
		while ((AudioAttributes=AVAttributes.get(xPath(SCHEMA_PREFIX, tva.e_AudioAttributes, ++aa), CG_SCHEMA))!=null) {
			checkTopElementsAndCardinality(AudioAttributes,
				[{name:tva.e_MixType, minOccurs:0},
				 {name:tva.e_AudioLanguage, minOccurs:0}],
				tvaEC.AudioAttributes,
				false, errs, "AV010");

			let MixType=AudioAttributes.get(xPath(SCHEMA_PREFIX, tva.e_MixType), CG_SCHEMA);
			if (MixType) {
				checkAttributes(MixType, [tva.a_href], [], tvaEA.MixType, errs, "AV011"); 
				if (MixType.attr(tva.a_href) && !isValidAudioMixType(MixType.attr(tva.a_href).value()))
					errs.addError({code:"AV012", message:`${tva.e_AudioAttributes}.${tva.e_MixType} is not valid`, fragment:MixType});
			}
					
			let AudioLanguage=AudioAttributes.get(xPath(SCHEMA_PREFIX, tva.e_AudioLanguage), CG_SCHEMA);
			if (AudioLanguage) {
				checkAttributes(AudioLanguage, [tva.a_purpose], [], tvaEA.AudioLanguage, errs, "AV013" );
				let validLanguage=false, validPurpose=false, audioLang=AudioLanguage.text();
				if (AudioLanguage.attr(tva.a_purpose)) {
					if (!(validPurpose=isValidAudioLanguagePurpose(AudioLanguage.attr(tva.a_purpose).value())))
						errs.addError({code:"AV014", message:`${tva.a_purpose.attribute(tva.e_AudioLanguage)} is not valid`, fragment:AudioLanguage});
				}

				validLanguage=checkLanguage(this.knownLanguages, audioLang, `${tva.e_AudioAttributes}.${tva.e_AudioLanguage}`, AudioLanguage, errs, "AV015");
				
				if (validLanguage && validPurpose) {	
					if (audioCounts[audioLang]===undefined)
						audioCounts[audioLang]=[AudioLanguage];
					else audioCounts[audioLang].push(AudioLanguage);

					let combo=`${audioLang}!--!${AudioLanguage.attr(tva.a_purpose).value()}`;
					if (isIn(foundAttributes, combo))
						errs.addError({code:"AV016", message:`audio ${tva.a_purpose.attribute()} ${AudioLanguage.attr(tva.a_purpose).value().quote()} already specified for language ${audioLang.quote()}`,
										fragment:AudioLanguage});
					else
						foundAttributes.push(combo);
				}
			}
		}
		audioCounts.forEach(audioLang => {
			if (audioCounts[audioLang].length>2)
				errs.addError({code:"AV020", message:`more than 2 ${tva.e_AudioAttributes.elementize()} elements for language ${audioLang.quote()}`, multiElementError:audioCounts[audioLang]});
		});
		
		// <VideoAttributes>
		let va=0, VideoAttributes;
		while ((VideoAttributes=AVAttributes.get(xPath(SCHEMA_PREFIX, tva.e_VideoAttributes, ++va), CG_SCHEMA))!=null) {
			checkTopElementsAndCardinality(VideoAttributes, 
				[{name:tva.e_HorizontalSize, minOccurs:0},
				 {name:tva.e_VerticalSize, minOccurs:0},
				 {name:tva.e_AspectRatio, minOccurs:0}],
				tvaEC.VideoAttributes,
				false, errs, "AV030");
		}

		// <CaptioningAttributes>
		let CaptioningAttributes=AVAttributes.get(xPath(SCHEMA_PREFIX, tva.e_CaptioningAttributes), CG_SCHEMA);
		if (CaptioningAttributes) {
			checkTopElementsAndCardinality(CaptioningAttributes, [{name:tva.e_Coding, minOccurs:0}], tvaEC.CaptioningAttributes, false, errs, "AV040");	
			
			let Coding=CaptioningAttributes.get(xPath(SCHEMA_PREFIX, tva.e_Coding), CG_SCHEMA);
			if (Coding) {
				checkAttributes(Coding, [tva.a_href], [], tvaEA.Coding, errs, "AV041");
				if (Coding.attr(tva.a_href)) {
					let codingHref=Coding.attr(tva.a_href).value();
					if (!([dvbi.DVB_BITMAP_SUBTITLES, dvbi.DVB_CHARACTER_SUBTITLES, dvbi.EBU_TT_D].includes(codingHref)))
						errs.addError({code:"AV042", 
										message:`${tva.a_href.attribute(`${tva.e_CaptioningAttributes}.${tva.e_Coding}`)} is not valid - should be DVB (bitmap or character) or EBU TT-D`,
										fragment:Coding});
				}
			}		
		}
	}


	/**
	 * validate a <RelatedMaterial> element conforms to the Restart Application Linking rules (A177r1 clause 6.5.5)
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} RelatedMaterial     the <RelatedMaterial> node to be checked
	 * @param {Class}   errs                errors found in validaton
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
			tvaEC.RelatedMaterial,
			false, errs, "RR001");
		
		let HowRelated=RelatedMaterial.get(xPath(SCHEMA_PREFIX, tva.e_HowRelated), CG_SCHEMA);
		if (HowRelated) {
			checkAttributes(HowRelated, [tva.a_href], [], tvaEA.HowRelated, errs, "RR002");
			if (HowRelated.attr(tva.a_href)) {
				if (!isRestartLink(HowRelated.attr(tva.a_href).value())) {
					errs.addError({code:"RR003", message:`invalid ${tva.a_href.attribute(tva.e_HowRelated)} (${HowRelated.attr(tva.a_href).value()}) for Restart Application Link`, fragment:HowRelated});
					isRestart=false;
				}
			}
		}
		
		let MediaLocator=RelatedMaterial.get(xPath(SCHEMA_PREFIX, tva.e_MediaLocator), CG_SCHEMA);
		if (MediaLocator) 
			if (!checkTopElementsAndCardinality(MediaLocator,
					[{name:tva.e_MediaUri},
					 {name:tva.e_AuxiliaryURI}], 
					tvaEC.MediaLocator,
					true, errs, "RR003"))
				isRestart=false;
		
		return isRestart;
	}


	/**
	 * validate any <InstanceDescription> elements in the <ScheduleEvent> and <OnDemandProgram> elements
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {string}  VerifyType		   the type of verification to perform (OnDemandProgram | ScheduleEvent)
	 * @param {XMLnode} InstanceDescription the <InstanceDescription> node to be checked
	 * @param {boolean} isCurrentProgram   indicates if this <InstanceDescription> element is for the currently airing program
	 * @param {Class}   errs                errors found in validaton
	 */
	/* private */  ValidateInstanceDescription(CG_SCHEMA, SCHEMA_PREFIX, VerifyType, InstanceDescription, isCurrentProgram, errs) {

		function isRestartAvailability(str) { return [dvbi.RESTART_AVAILABLE, dvbi.RESTART_CHECK, dvbi.RESTART_PENDING].includes(str); }
		function isMediaAvailability(str) { return [dvbi.MEDIA_AVAILABLE, dvbi.MEDIA_UNAVAILABLE].includes(str); }
		function isEPGAvailability(str) { return [dvbi.FORWARD_EPG_AVAILABLE, dvbi.FORWARD_EPG_UNAVAILABLE].includes(str); }
		function isAvailability(str) { return isMediaAvailability(str) || isEPGAvailability(str); }
		
		function checkGenre(genre, errs, errcode) {
			if (!genre) return null;
			checkAttributes(genre, [tva.a_href], [tva.a_type], tvaEA.Genre, errs, `${errcode}-1`);
			let GenreType=(genre.attr(tva.a_type)?genre.attr(tva.a_type).value():tva.GENRE_TYPE_OTHER);
			if (GenreType!=tva.GENRE_TYPE_OTHER)
				errs.addError({code:`${errcode}-2`, message:`${tva.a_type.attribute(`${genre.parent().name()}.${+genre.name()}`)} must contain ${tva.GENRE_TYPE_OTHER.quote()}`, fragment:genre});

			return (genre.attr(tva.a_href)?genre.attr(tva.a_href).value():null);
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
					tvaEC.InstanceDescription,
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
					tvaEC.InstanceDescription,
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
					errs.addError({code:"ID012", message:`first ${elementize(`${InstanceDescription.name()}.+${tva.e_Genre}`)} must contain a media or fepg availability indicator`, fragment:Genre1});

				let g2href=checkGenre(Genre2, errs, "ID013");
				if (g2href && !isAvailability(g2href))
					errs.addError({code:"ID014", message:`second ${elementize(`${InstanceDescription.name()}.+${tva.e_Genre}`)} must contain a media or fepg availability indicator`, fragment:Genre2});
				
				if (Genre1 && Genre2) {
					if ((isMediaAvailability(g1href) && isMediaAvailability(g2href)) || (isEPGAvailability(g1href) && isEPGAvailability(g2href))) {
						errs.addError({code:"ID015-1", message:`${elementize(`${InstanceDescription.name()}.+${tva.e_Genre}`)} elements must indicate different availabilities`, 
									fragments:[Genre1, Genre2]});
					}
				}
				break;
			case tva.e_ScheduleEvent:
				let Genre=InstanceDescription.get(xPath(SCHEMA_PREFIX, tva.e_Genre), CG_SCHEMA);
				if (Genre) {
					checkAttributes(Genre, [tva.a_href], [tva.a_type], tvaEA.Genre, errs, "ID016");
					if (Genre.attr(tva.a_href)) {
						if (isRestartAvailability(Genre.attr(tva.a_href).value())) {
							restartGenre=Genre;
							if (Genre.attr(tva.a_type) && Genre.attr(tva.a_type).value()!=tva.GENRE_TYPE_OTHER) 
								errs.addError({code:"ID018", message:`${tva.a_type.attribute(Genre.name())} must be ${tva.GENRE_TYPE_OTHER.quote()} or omitted`,
											fragment:Genre});
						}
						else 
							errs.addError({code:"ID017", message:`${elementize(`${InstanceDescription.name()}.+${tva.e_Genre}`)} must contain a restart link indicator`, 
											line:InstanceDescription.line()});
					}
				}	
				break;
		}

		// <CaptionLanguage>
		let CaptionLanguage=InstanceDescription.get(xPath(SCHEMA_PREFIX, tva.e_CaptionLanguage), CG_SCHEMA);
		if (CaptionLanguage) {
			checkLanguage(this.knownLanguages, CaptionLanguage.text(), `${InstanceDescription.name()}.${tva.e_CaptionLanguage}`, CaptionLanguage, errs, "ID021");
			BooleanValue(CaptionLanguage, tva.a_closed, "ID022", errs);
		}
		
		// <SignLanguage>
		let SignLanguage=InstanceDescription.get(xPath(SCHEMA_PREFIX, tva.e_SignLanguage), CG_SCHEMA);
		if (SignLanguage) {
			checkLanguage(this.knownLanguages, SignLanguage.text(), `${InstanceDescription.name()}.${tva.e_SignLanguage}`, SignLanguage, errs, "ID031");
			FalseValue(SignLanguage, tva.a_closed, "ID032", errs);
			// check value is "sgn" according to ISO 639-2 or a sign language listed in ISO 639-3
			if (SignLanguage.text()!="sgn" && !this.knownLanguages.isKnownSignLanguage(SignLanguage.text())) 
				errs.addError({code:"ID033", message:`invalid ${tva.e_SignLanguage.elementize()} ${SignLanguage.text().quote()} in ${InstanceDescription.name().elementize()}`,
					fragment:SignLanguage});
		}

		// <AVAttributes>
		let AVAttributes=InstanceDescription.get(xPath(SCHEMA_PREFIX, tva.e_AVAttributes), CG_SCHEMA);
		if (AVAttributes)
			this.ValidateAVAttributes(CG_SCHEMA, SCHEMA_PREFIX, AVAttributes, errs);
		
		// <OtherIdentifier>
		let oi=0, OtherIdentifier;
		while ((OtherIdentifier=InstanceDescription.get(xPath(SCHEMA_PREFIX, tva.e_OtherIdentifier, ++oi), CG_SCHEMA))!=null) {
			checkAttributes(OtherIdentifier, [tva.a_type], [], tvaEA.OtherIdentifier, errs, "VID052");
			if (OtherIdentifier.attr(tva.a_type)) {			
				let oiType=OtherIdentifier.attr(tva.a_type).value();
		
				if ((VerifyType==tva.e_ScheduleEvent  && (["CPSIndex", dvbi.EIT_PROGRAMME_CRID_TYPE, dvbi.EIT_SERIES_CRID_TYPE].includes(oiType))) ||
					(VerifyType==tva.e_OnDemandProgram && oiType=="CPSIndex")) {
						// all good
					}
					else {
						if (!OtherIdentifier.attr(mpeg7.a_organization))  // don't throw errors for other organisations <OtherIdentifier> values
							errs.addError({code:"ID050", message:`${tva.a_type.attribute(tva.e_OtherIdentifier)}=${oiType.quote()} is not valid for ${VerifyType}.${InstanceDescription.name()}`,
											fragment:OtherIdentifier});
					}
					if ([dvbi.EIT_PROGRAMME_CRID_TYPE, dvbi.EIT_SERIES_CRID_TYPE].includes(oiType))
						if (!isCRIDURI(OtherIdentifier.text()))
							errs.addError({code:"ID051", message:`${tva.e_OtherIdentifier} must be a CRID for ${tva.a_type.attribute()}=${oiType.quote()}`,
									fragment:OtherIdentifier});
			}
		}
		
		// <RelatedMaterial>
		let RelatedMaterial=InstanceDescription.get(xPath(SCHEMA_PREFIX, tva.e_RelatedMaterial), CG_SCHEMA);
		if (RelatedMaterial) {
			if (this.ValidateRestartRelatedMaterial(CG_SCHEMA, SCHEMA_PREFIX, RelatedMaterial, errs))
				restartRelatedMaterial=RelatedMaterial; 		
		}

		// Genre and RelatedMaterial for restart capability should only be specified for the "current" (ie. 'now') program
		if (!isCurrentProgram && restartGenre )
			errs.addError({code:"ID061", message:`restart ${tva.e_Genre.elementize()} is only permitted for the current ("now") program`, fragment:restartGenre});
		if (!isCurrentProgram && restartRelatedMaterial)
			errs.addError({code:"ID062", message:`restart ${tva.e_RelatedMaterial.elementize()} is only permitted for the current ("now") program`, fragment:restartRelatedMaterial});
		
		if ((restartGenre && !restartRelatedMaterial) || (restartRelatedMaterial && !restartGenre))
			errs.addError({code:"ID063", message:`both ${tva.e_Genre.elementize()} and ${tva.e_RelatedMaterial.elementize()} are required together for ${VerifyType}`, 
								multiElementError:[restartGenre, restartRelatedMaterial]});	
	}


	/**
	 * validate a <ProgramURL> or <AuxiliaryURL> element to see if it signals a Template XML AIT
	 *
	 * @param {XMLnode} node                the element node containing the an XML AIT reference
	 * @param {Array}   allowedContentTypes the contentTypes that can be signalled in the node@contentType attribute
	 * @param {Class}   errs                errors found in validaton
	 * @param {string}  errcode             error code to be used with any errors found
	 */
	/* private */  CheckPlayerApplication(node, allowedContentTypes, errs, errcode) {

		if (!node)  {
			errs.addError({type:APPLICATION, code:"PA000a", message:"CheckPlayerApplication() called with node==null"});
			return;
		}
		if (!Array.isArray(allowedContentTypes)) {
			errs.addError({type:APPLICATION, code:"PA000b", message:"CheckPlayerApplication() called with incorrect type for allowedContentTypes"});
			return;			
		}

		if (!node.attr(tva.a_contentType)) {
			errs.addError({code:`${errcode}-1`, message:`${tva.a_contentType.attribute()} attribute is required when signalling a player in ${node.name().elementize()}`, 
				key:`missing ${tva.a_contentType.attribute()}`, fragment:node});
			return;
		}

		if (allowedContentTypes.includes(node.attr(tva.a_contentType).value())) {
			switch (node.attr(tva.a_contentType).value()) {
				case dvbi.XML_AIT_CONTENT_TYPE:
					if (!isHTTPURL(node.text()))
						errs.addError({code:`${errcode}-2`, message:`${node.name().elementize()}=${node.text().quote()} is not a valid AIT URL`, key:"invalid URL", fragment:node});
					break;
	/*			case dvbi.HTML5_APP:
				case dvbi.XHTML_APP:
					if (!patterns.isHTTPURL(node.text()))
						errs.addError({code:`${errcode}-3`, message:`${node.name().elementize()}=${node.text().quote()} is not a valid URL`, key:"invalid URL", fragment:node});		
					break;
	*/		}
		}
		else
			errs.addError({code:`${errcode}-4`,
							message:`${tva.a_contentType.attribute(node.name())}=${node.attr(tva.a_contentType).value().quote()} is not valid for a player`, 
							fragment:node, key:`invalid ${tva.a_contentType}`});
	}


	/**
	 * validate an <OnDemandProgram> elements in the <ProgramLocationTable>
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} OnDemandProgram     the node containing the <OnDemandProgram> being checked
	 * @param {array}   programCRIDs        array of program crids defined in <ProgramInformationTable> 
	 * @param {array}   plCRIDs        	    array of program crids defined in <ProgramLocationTable>
	 * @param {string}  requestType         the type of content guide request being checked
	 * @param {Class}   errs                errors found in validaton
	 */
	/* private */  ValidateOnDemandProgram(CG_SCHEMA, SCHEMA_PREFIX, OnDemandProgram, programCRIDs, plCRIDs, requestType, errs) {

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
					tvaEC.OnDemandProgram,
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
					tvaEC.OnDemandProgram,
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
					tvaEC.OnDemandProgram,
					false, errs, "OD003");
				break;
			default:
				errs.addError({code:"OD004", message:`requestType=${requestType} is not valid for ${OnDemandProgram.name()}`});
				validRequest=false;
		}
			
		checkAttributes(OnDemandProgram, [tva.a_serviceIDRef], [tva.a_lang], tvaEA.OnDemandProgram, errs, "OD005"); 
		GetNodeLanguage(OnDemandProgram, false, errs, "OD006", this.knownLanguages);
		this.checkTAGUri(OnDemandProgram, errs, "OD007");	
		
		// <Program>
		let Program=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_Program), CG_SCHEMA);
		if (Program) {
			checkAttributes(Program, [tva.a_crid], [], tvaEA.Program, errs, "OD012");
			if (Program.attr(tva.a_crid)) {
				let programCRID=Program.attr(tva.a_crid).value();
				if (!isCRIDURI(programCRID))
					errs.addError({code:"OD010", message:`${tva.a_crid.attribute(`${OnDemandProgram.name()}.${tva.e_Program}`)} is not a CRID URI`, line:Program.line()});
				else {
					if (!isIni(programCRIDs, programCRID))
						errs.addError({code:"OD011", 
								message:`${tva.a_crid.attribute(`${OnDemandProgram.name()}.${tva.e_Program}`)}=${programCRID.quote()} does not refer to a program in the ${tva.e_ProgramInformationTable.elementize()}`,
								line:Program.line()});
				}
				plCRIDs.push(programCRID);
			}	
		}

		// <ProgramURL>
		let ProgramURL=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_ProgramURL), CG_SCHEMA);
		if (ProgramURL)
			this.CheckPlayerApplication(ProgramURL, [dvbi.XML_AIT_CONTENT_TYPE], errs, "OD020");

		// <AuxiliaryURL>
		let AuxiliaryURL=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_AuxiliaryURL), CG_SCHEMA);
		if (AuxiliaryURL)
			this.CheckPlayerApplication(AuxiliaryURL, [dvbi.XML_AIT_CONTENT_TYPE /*, dvbi.HTML5_APP, dvbi.XHTML_APP, dvbi.iOS_APP, dvbi.ANDROID_APP*/], errs, "OD030");

		// <InstanceDescription>
		if (validRequest && [CG_REQUEST_BS_CONTENTS, CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_TIME, CG_REQUEST_SCHEDULE_WINDOW, CG_REQUEST_PROGRAM].includes(requestType)) {
			let InstanceDescription=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_InstanceDescription), CG_SCHEMA);
			if (InstanceDescription)
				this.ValidateInstanceDescription(CG_SCHEMA, SCHEMA_PREFIX, OnDemandProgram.name(), InstanceDescription, false, errs);
		}
		// <PublishedDuration>

		// <StartOfAvailability> and <EndOfAvailability>
		let soa=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_StartOfAvailability), CG_SCHEMA),
			eoa=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_EndOfAvailability), CG_SCHEMA);

		if (soa && eoa) {
			let fr=new Date(soa.text()), to=new Date(eoa.text());	
			if (to.getTime() < fr.getTime())
				errs.addError({code:"OD062", message:`${tva.e_StartOfAvailability.elementize()} must be earlier than ${tva.e_EndOfAvailability.elementize()}`, multiElementError:[soa,eoa]});
		}
		
		// <DeliveryMode>
		if ([CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_TIME, CG_REQUEST_SCHEDULE_WINDOW, CG_REQUEST_PROGRAM].includes(requestType)) {
			let DeliveryMode=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_DeliveryMode), CG_SCHEMA);
			if (DeliveryMode && DeliveryMode.text()!=tva.DELIVERY_MODE_STREAMING)
				errs.addError({code:"OD070", message:`${OnDemandProgram.name()}.${tva.e_DeliveryMode} must be ${tva.DELIVERY_MODE_STREAMING.quote()}`, fragment:DeliveryMode});
		}

		// <Free>
		let fr=0, Free;
		while ((Free=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_Free, ++fr), CG_SCHEMA))!=null)
			TrueValue(Free, tva.a_value, "OD080", errs);
	}	


	/**
	 * validate any <ScheduleEvent> elements in the <ProgramLocationTable.Schedule>
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} Schedule            the <Schedule> node containing the <ScheduleEvent> element to be checked
	 * @param {array}   programCRIDs        array of program crids defined in <ProgramInformationTable> 
	 * @param {array}   plCRIDs             array of program crids defined in <ProgramLocationTable>
	 * @param {string}  currentProgramCRID  CRID of the currently airing program
	 * @param {Date}    scheduleStart	    Date representation of Schedule@start
	 * @param {Date}    scheduleEnd  	    Date representation of Schedule@end
	 * @param {string}  requestType         the type of content guide request being checked
	 * @param {Class}   errs                errors found in validaton
	 */
	/* private */  ValidateScheduleEvents(CG_SCHEMA, SCHEMA_PREFIX, Schedule, programCRIDs, plCRIDs, currentProgramCRID, scheduleStart, scheduleEnd, requestType, errs) {
		
		if (!Schedule) {
			errs.addError({type:APPLICATION, code:"SE000", message:"ValidateScheduleEvents() called with Schedule==null"});
			return;
		}
		
		let isCurrentProgram=false;
		let se=0, ScheduleEvent;
		while ((ScheduleEvent=Schedule.get(xPath(SCHEMA_PREFIX, tva.e_ScheduleEvent, ++se), CG_SCHEMA))!=null) {
			GetNodeLanguage(ScheduleEvent, false, errs, "SE001", this.knownLanguages);
			checkAttributes(ScheduleEvent, [], [], tvaEA.ScheduleEvent, errs, "SE002");
			
			checkTopElementsAndCardinality(ScheduleEvent, 
				[{name:tva.e_Program}, 
				 {name:tva.e_ProgramURL, minOccurs:0},
				 {name:tva.e_InstanceDescription, minOccurs:0},
				 {name:tva.e_PublishedStartTime},
				 {name:tva.e_PublishedDuration},
				 {name:tva.e_ActualStartTime, minOccurs:0}, 
				 {name:tva.e_FirstShowing, minOccurs:0 }, 
				 {name:tva.e_Free, minOccurs:0}], 
				tvaEC.ScheduleEvent,
				false, errs, "SE003");
			
			// <Program>
			let Program=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_Program), CG_SCHEMA);
			if (Program) {
				checkAttributes(Program, [tva.a_crid], [], tvaEA.Program, errs, "SE010");

				let ProgramCRID=Program.attr(tva.a_crid);
				if (ProgramCRID) {
					if (!isCRIDURI(ProgramCRID.value()))
						errs.addError({code:"SE011", message:`${tva.a_crid.attribute(tva.e_Program)} is not a valid CRID (${ProgramCRID.value()})`, fragment:Program});
					if (!isIni(programCRIDs, ProgramCRID.value()))
						errs.addError({code:"SE012", 
									message:`${tva.a_crid.attribute(tva.e_Program)}=${ProgramCRID.value().quote()} does not refer to a program in the ${tva.e_ProgramInformationTable.elementize()}`,
									fragment:Program});
					plCRIDs.push(ProgramCRID.value());
					isCurrentProgram=(ProgramCRID.value()==currentProgramCRID) ;
				}
			}
				
			// <ProgramURL>
			let ProgramURL=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_ProgramURL), CG_SCHEMA);
			if (ProgramURL) 
				if (!isDVBLocator(ProgramURL.text()))
					errs.addError({code:"SE021", message:`${tva.e_ScheduleEvent}.${tva.e_ProgramURL} (${ProgramURL.text()}) is not a valid DVB locator`, fragment:ProgramURL});
			
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
										message:`${tva.e_PublishedStartTime.elementize()} (${PublishedStartTime}) is earlier than ${tva.a_start.attribute(tva.e_Schedule)}`,
										multiElementError:[Schedule, pstElem]});
					if (scheduleEnd && (PublishedStartTime > scheduleEnd)) 
						errs.addError({code:"SE042", 
										message:`${tva.e_PublishedStartTime.elementize()} (${PublishedStartTime}) is after ${tva.a_end.attribute(tva.e_Schedule)}`,
										multiElementError:[Schedule, pstElem]});

					let pdElem=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_PublishedDuration), CG_SCHEMA);
					if (pdElem && scheduleEnd) {
						let parsedPublishedDuration=parseISOduration(pdElem.text());
						if (parsedPublishedDuration.add(PublishedStartTime) > scheduleEnd) 
							errs.addError({code:"SE043", 
											message:`${tva.e_PublishedStartTime}+${tva.e_PublishedDuration} of event is after ${tva.a_end.attribute(tva.e_Schedule)}`,
											multiElementError:[Schedule, pdElem]});
					}
				}
				else 
					errs.addError({code:"SE049", message:`${tva.e_PublishedStartTime.elementize()} is not expressed in UTC format (${pstElem.text()})`, fragment:pstElem});
			}
			
			// <ActualStartTime> 
			let astElem=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_ActualStartTime), CG_SCHEMA);
			if (astElem && !isUTCDateTime(astElem.text())) 
				errs.addError({code:"SE051", message:`${tva.e_ActualStartTime.elementize()} is not expressed in UTC format (${astElem.text()})`, fragment:astElem});

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
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} Schedule            the node containing the <Schedule> being checked
	 * @param {array}   programCRIDs        array of program crids defined in <ProgramInformationTable> 
	 * @param {array}   plCRIDs             array of program crids defined in <ProgramLocationTable>
	 * @param {string}  currentProgramCRID  CRID of the currently airing program
	 * @param {string}  requestType         the type of content guide request being checked
	 * @param {Class}   errs                errors found in validaton
	 * @returns {string} the serviceIdRef for this <Schedule> element
	 */
	/* private */  ValidateSchedule(CG_SCHEMA, SCHEMA_PREFIX, Schedule, programCRIDS, plCRIDs, currentProgramCRID, requestType, errs) {

		if (!Schedule) {
			errs.addError({type:APPLICATION, code:"VS000", message:"ValidateSchedule() called with Schedule==null"});
			return;
		}

		checkTopElementsAndCardinality(Schedule, [{name:tva.e_ScheduleEvent, minOccurs:0, maxOccurs:Infinity}], tvaEC.Schedule, false, errs, "VS001");
		checkAttributes(Schedule, [tva.a_serviceIDRef, tva.a_start, tva.a_end], [], tvaEA.Schedule, errs, "VS002");
		
		GetNodeLanguage(Schedule, false, errs, "VS003", this.knownLanguages);	
		let serviceIdRef=this.checkTAGUri(Schedule, errs, "VS004");
		let startSchedule=Schedule.attr(tva.a_start), fr=null, endSchedule=Schedule.attr(tva.a_end), to=null;
		if (startSchedule)
			fr=new Date(startSchedule.value());

		if (endSchedule)
			to=new Date(endSchedule.value());

		if (startSchedule && endSchedule) 
			if (to.getTime() <= fr.getTime()) 
				errs.addError({code:"VS012", message:`${tva.a_start.attribute(Schedule.name())} must be earlier than ${tva.a_end.attribute()}`, fragment:Schedule});
		
				this.ValidateScheduleEvents(CG_SCHEMA, SCHEMA_PREFIX, Schedule, programCRIDS, plCRIDs, currentProgramCRID, fr, to, requestType, errs);
		
		return serviceIdRef;
	}


	/**
	 * find and validate any <ProgramLocation> elements in the <ProgramLocationTable>
	 *
	 * @param {string}  CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} ProgramDescription  the element containing the <ProgramInformationTable>
	 * @param {array}   programCRIDs        array to record CRIDs for later use  
	 * @param {string}  currentProgramCRID  CRID of the currently airing program
	 * @param {string}  requestType         the type of content guide request being checked
	 * @param {Class}   errs                errors found in validaton
	 * @param {integer} o.childCount        the number of child elements to be present (to match GroupInformation@numOfItems)
	 */
	/* private */  CheckProgramLocation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, programCRIDs, currentProgramCRID, requestType, errs, o=null) {

		if (!ProgramDescription) {
			errs.addError({type:APPLICATION, code:"PL000", message:"CheckProgramLocation() called with ProgramDescription==null"});
			return;
		}
		
		let ProgramLocationTable=ProgramDescription.get(xPath(SCHEMA_PREFIX, tva.e_ProgramLocationTable), CG_SCHEMA);
		if (!ProgramLocationTable) {
			//errs.addError({code:"PL001", message:`${tva.e_ProgramLocationTable.elementize()} is not specified`, line:ProgramDescription.line()});
			return;
		}
		checkTopElementsAndCardinality(ProgramLocationTable, 
			[{name:tva.e_Schedule, minOccurs:0, maxOccurs:Infinity},
			 {name:tva.e_OnDemandProgram, minOccurs:0, maxOccurs:Infinity}], 
			tvaEC.ProgramLocationTable,
			false, errs, "PL010");
		checkAttributes(ProgramLocationTable, [], [tva.a_lang], tvaEA.ProgramLocationTable, errs, "PL011");
		
		GetNodeLanguage(ProgramLocationTable, false, errs, "PL012", this.knownLanguages);
		
		let cnt=0, foundServiceIds=[], plCRIDs=[];

		let children=ProgramLocationTable.childNodes();
		if (children) children.forEachSubElement(child => {
			switch (child.name()) {
				case tva.e_OnDemandProgram:
					this.ValidateOnDemandProgram(CG_SCHEMA, SCHEMA_PREFIX, child, programCRIDs, plCRIDs, requestType, errs);
					cnt++;
					break;
				case tva.e_Schedule:
					let thisServiceIdRef=this.ValidateSchedule(CG_SCHEMA, SCHEMA_PREFIX, child, programCRIDs, plCRIDs, currentProgramCRID, requestType, errs);
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
								message:`number of items (${cnt}) in the ${tva.e_ProgramLocationTable.elementize()} does not match ${tva.a_numOfItems.attribute(tva.e_GroupInformation)} specified in ${CATEGORY_GROUP_NAME} (${o.childCount})`});
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
	 * @param {String} CGtext      the service list text to be validated
	 * @param {String} requestType the type of CG request/response (specified in the form/query as not possible to deduce from metadata)
	 * @param {Class} errs         errors found in validaton
	 */
	doValidateContentGuide(CGtext, requestType, errs) {
		if (!CGtext) {
			errs.addError({type:APPLICATION, code:"CG000", message:'doValidateContentGuide() called with CGtext==null'});
			return;
		}

		let CG=null;
		try {
			CG=parseXmlString(CGtext);
		} catch (err) {
			errs.addError({type:APPLICATION, code:"CG001", message:`XML parsing failed: ${err.message}`});
			return;
		}
		if (!CG || !CG.root()) {
			errs.addError({code:"CG002", message:"CG is empty"});
			return;
		}

		let prettyXML=format(CGtext.replace(/(\n\t)/gm,"\n"), {collapseContent:true, lineSeparator:'\n'});
		CG=parseXmlString(prettyXML);
		errs.loadDocument(prettyXML);

		if (CG.root().name()!=tva.e_TVAMain) {
			errs.addError({code:"CG004", message:`Root element is not ${tva.e_TVAMain.elementize()}`, key:"XSD validation"});
			return;
		}

		let CG_SCHEMA={}, 
			SCHEMA_PREFIX=CG.root().namespace()?CG.root().namespace().prefix():"", 
			SCHEMA_NAMESPACE=CG.root().namespace()?CG.root().namespace().href():"";
			CG_SCHEMA[SCHEMA_PREFIX]=SCHEMA_NAMESPACE;

		if (!CG.validate(this.TVAschema)) {
			let lines=prettyXML.split('\n');
			CG.validationErrors.forEach(ve => {
				let s=ve.toString().split('\r');
				s.forEach(err => {
					errs.addError({code:"CG003", message:err, fragment:lines[ve.line-1], line:ve.line-1, key:"XSD validation"});
					errs.setError(err, ve.line-1);
				}); 
			});
		}

		let tvaMainLang=GetNodeLanguage(CG.root(), true, errs, "CG005", this.knownLanguages);
		let ProgramDescription=CG.get(xPath(SCHEMA_PREFIX, tva.e_ProgramDescription), CG_SCHEMA);
		if (!ProgramDescription) {
			errs.addError({code:"CG006", message:`No ${tva.e_ProgramDescription.elementize()} element specified.`});
			return;
		}
		
		let programCRIDs=[], groupIds=[], o={childCount:0};
		
		switch (requestType) {
			case CG_REQUEST_SCHEDULE_TIME:
				// schedule response (6.5.4.1) has <ProgramLocationTable> and <ProgramInformationTable> elements 
				checkTopElementsAndCardinality(ProgramDescription,
					[{name:tva.e_ProgramLocationTable},
					 {name:tva.e_ProgramInformationTable}],
					tvaEC.ProgramDescription,
					false, errs, "CG011");
				
				this.CheckProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, programCRIDs, null, requestType, errs);
				this.CheckProgramLocation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, programCRIDs, null, requestType, errs);
				break;
			case CG_REQUEST_SCHEDULE_NOWNEXT:
				// schedule response (6.5.4.1) has <ProgramLocationTable> and <ProgramInformationTable> elements 
				checkTopElementsAndCardinality(ProgramDescription,
					[{name:tva.e_ProgramLocationTable},
					 {name:tva.e_ProgramInformationTable},
					 {name:tva.e_GroupInformationTable}],
					tvaEC.ProgramDescription,
					false, errs, "CG021");
			
				// <GroupInformation> may become optional for now/next, the program sequence should be determined by ScheduleEvent.PublishedStartTime
				if (this.hasElement(ProgramDescription, tva.e_GroupInformationTable))
					this.CheckGroupInformationNowNext(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, groupIds, requestType, errs);
				let currentProgramCRIDnn=this.CheckProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, programCRIDs, groupIds, requestType, errs);
				this.CheckProgramLocation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, programCRIDs, currentProgramCRIDnn, requestType, errs);
				break;
			case CG_REQUEST_SCHEDULE_WINDOW:
				checkTopElementsAndCardinality(ProgramDescription,
					[{name:tva.e_ProgramLocationTable},
					 {name:tva.e_ProgramInformationTable},
				 	 {name:tva.e_GroupInformationTable}],
					tvaEC.ProgramDescription,
					false, errs, "CG031");

				// <GroupInformation> may become optional for now/next, the program sequence should be determined by ScheduleEvent.PublishedStartTime
				if (this.hasElement(ProgramDescription, tva.e_GroupInformationTable))
					this.CheckGroupInformationNowNext(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, groupIds, requestType, errs);
				let currentProgramCRIDsw=this.CheckProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, programCRIDs, groupIds, requestType, errs);
				this.CheckProgramLocation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, programCRIDs, currentProgramCRIDsw, requestType, errs);
				break;
			case CG_REQUEST_PROGRAM:
				// program information response (6.6.2) has <ProgramLocationTable> and <ProgramInformationTable> elements
				checkTopElementsAndCardinality(ProgramDescription,
					[{name:tva.e_ProgramLocationTable},
					 {name:tva.e_ProgramInformationTable}],
					tvaEC.ProgramDescription,
					false, errs, "CG041");	
			
				this.CheckProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, programCRIDs, null, requestType, errs);
				this.CheckProgramLocation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, programCRIDs, null, requestType, errs);
				break;
			case CG_REQUEST_MORE_EPISODES:
				// more episodes response (6.7.3) has <ProgramInformationTable>, <GroupInformationTable> and <ProgramLocationTable> elements 
				checkTopElementsAndCardinality(ProgramDescription,
					[{name:tva.e_ProgramLocationTable},
					 {name:tva.e_ProgramInformationTable},
					 {name:tva.e_GroupInformationTable}],
					 tvaEC.ProgramDescription,
					false, errs, "CG051");

				this.CheckGroupInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, requestType, groupIds, errs, o);
				this.CheckProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, programCRIDs, groupIds, requestType, errs, o);
				this.CheckProgramLocation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, programCRIDs, null, requestType, errs, o);
				break;
			case CG_REQUEST_BS_CATEGORIES:
				// box set categories response (6.8.2.3) has <GroupInformationTable> element
				checkTopElementsAndCardinality(ProgramDescription, [{name:tva.e_GroupInformationTable}], tvaEC.ProgramDescription, false, errs, "CG061"); 

				this.CheckGroupInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, requestType, null, errs, null);
				break;
			case CG_REQUEST_BS_LISTS:
				// box set lists response (6.8.3.3) has <GroupInformationTable> element
				checkTopElementsAndCardinality(ProgramDescription, [{name:tva.e_GroupInformationTable}], tvaEC.ProgramDescription, false, errs, "CG071"); 
				
				this.CheckGroupInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, requestType, null, errs, null);
				break;
			case CG_REQUEST_BS_CONTENTS:
				// box set contents response (6.8.4.3) has <ProgramInformationTable>, <GroupInformationTable> and <ProgramLocationTable> elements 
				checkTopElementsAndCardinality(ProgramDescription,
					[{name:tva.e_ProgramLocationTable},
					 {name:tva.e_ProgramInformationTable},
					 {name:tva.e_GroupInformationTable}],
					tvaEC.ProgramDescription,
					false, errs, "CG081");
				
				this.CheckGroupInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, requestType, groupIds, errs, o);
				this.CheckProgramInformation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, programCRIDs, groupIds, requestType, errs, o);
				this.CheckProgramLocation(CG_SCHEMA, SCHEMA_PREFIX, ProgramDescription, programCRIDs, null, requestType, errs, o);
				break;
		}
	}


	/**
	 * validate the content guide and record any errors
	 *
	 * @param {String} CGtext      the service list text to be validated
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
