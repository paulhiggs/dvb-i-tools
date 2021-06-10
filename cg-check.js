/* jshint esversion: 8 */

// libxmljs2 - github.com/marudor/libxmljs2
const libxml=require("libxmljs2");

const phlib=require('./phlib/phlib');

const fs=require("fs");

const ErrorList=require("./ErrorList.js");
const ClassificationScheme=require("./ClassificationScheme.js");
const Role=require("./Role.js");
const IANAlanguages=require("./IANAlanguages.js");

const dvbi=require("./DVB-I_definitions.js");
const tva=require("./TVA_definitions.js");
const mpeg7=require("./MPEG7_definitions.js");

const {isJPEGmime, isPNGmime}=require("./MIME_checks.js");
const {isCRIDURI, isTAGURI}=require("./URI_checks.js");
const {xPath, xPathM, isIn, isIni, unEntity, parseISOduration}=require("./utils.js");

const patterns=require("./pattern_checks.js");

const locs=require("./data-locations.js");


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
		errs.pushCode(errCode?`${errCode}-0`:"TE000", "checkTopElementsAndCardinality() called with a 'null' element to check");
		return false;
	}
	let rv=true, thisElem=phlib.elementize(`${parentElement.parent().name()}.${parentElement.name()}`);
	// check that each of the specifid childElements exists
	childElements.forEach(elem => {
		let _min=elem.hasOwnProperty('minOccurs')?elem.minOccurs:1;
		let _max=elem.hasOwnProperty('maxOccurs')?elem.maxOccurs:1;
		let count=CountChildElements(parentElement, elem.name);
		if (count==0 && _min!=0) {
			errs.pushCode(errCode?`${errCode}-1`:"TE010", `Mandatory element ${elem.name.elementize()} not specified in ${thisElem}`);
			rv=false;
		}
		else {
			if (count<_min || count>_max) {
				errs.pushCode(errCode?`${errCode}-1`:"TE011", 
					`Cardinality of ${elem.name.elementize()} in ${thisElem} is not in the range ${_min}..${(_max==Infinity)?"unbounded":_max}`);
				rv=false;				
			}
		}
	});

	// check that no additional child elements existance if the "Other Child Elements are OK" flag is not set
	if (!allowOtherElements) {
		let children=parentElement.childNodes();
		if (children) children.forEachSubElement(child => {
			let _childName=child.name();
			if (!findElementIn(childElements, _childName)) {		
				errs.pushCode(errCode?`${errCode}-2`:"TE011", `Element ${_childName.elementize()} is not permitted in ${thisElem}`);
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
		errs.pushCode("AT000", "checkAttributes() called with parentElement==null or requiredAttributes==null");
		return;
	}
	
	requiredAttributes.forEach(attributeName => {
		if (!parentElement.attr(attributeName)) {
			let p=`${(parentElement.parent()?`${parentElement.parent().name()}.`:"")}${parentElement.name()}`;
			errs.pushCode(errCode?`${errCode}-1`:"AT001", `${attributeName.attribute(`${p}`)} is a required attribute`);
		}
	});
	
	parentElement.attrs().forEach(attr => {
		if (!isIn(requiredAttributes, attr.name()) && !isIn(optionalAttributes, attr.name())) {
			let p=`${phlib.elementize(`${parentElement.parent()?`${parentElement.parent().name()}.`:""}${parentElement.name()}`)}`;
			errs.pushCode(errCode?`${errCode}-2`:"AT002", 
				`${attr.name().attribute()} is not permitted in ${p}`);
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
 * @param {string}  errno      the error number used as a prefix for reporting errors
 * @param {Class}   errs       errors found in validaton
 * @param {array}   allowed    the set or permitted values
 * @param {boolean} isRequired true if the specificed attribued is required to be specified for the element
 */
 function AllowedValue(elem, attrName, errno, errs, allowed, isRequired=true) {
	if (!elem) {
		errs.pushCode(`${errno}-0`, "AllowedValue() called with elem==null");
		return;
	}

	if (elem.attr(attrName)) {
		if (!isIn(allowed, elem.attr(attrName).value())) {
			let str="";
			allowed.forEach(value => str=str+((str.length!=0)?" or ":"")+value);
			errs.pushCode(`${errno}-1`, `${attrName.attribute(`${elem.parent().name}.${elem.name()}`)} must be ${str}`);
		}
	}
	else 
		if (isRequired) 
			errs.pushCode(`${errno}-2`, `${attrName.attribute()} must be specified for ${elem.parent().name()}.${elem.name()}`);
}


/** 
 * checks is the specified element (elem) has an attribute named attrName and that its value is "true" or "false"
 *
 * @param {Node}    elem       the XML element to be checked
 * @param {string}  attrName   the name of the attribute carrying the boolean value
 * @param {string}  errno      the error number used as a prefix for reporting errors
 * @param {Class}   errs       errors found in validaton
 * @param {boolean} isRequired true if the specificed attribued is required to be specified for the element
 */
function BooleanValue(elem, attrName, errno, errs, isRequired=true) {
	AllowedValue(elem, attrName, errno, errs, ["true", "false"], isRequired);
}


/** 
 * checks is the specified element (elem) has an attribute named attrName and that its value is "true"
 *
 * @param {Node}    elem       the XML element to be checked
 * @param {string}  attrName   the name of the attribute carrying the boolean value
 * @param {string}  errno      the error number used as a prefix for reporting errors
 * @param {Class}   errs       errors found in validaton
 * @param {boolean} isRequired true if the specificed attribued is required to be specified for the element
 */
 function TrueValue(elem, attrName, errno, errs, isRequired=true) {
	AllowedValue(elem, attrName, errno, errs, ["true"], isRequired);
}

/** 
 * checks is the specified element (elem) has an attribute named attrName and that its value is "false"
 *
 * @param {Node}    elem       the XML element to be checked
 * @param {string}  attrName   the name of the attribute carrying the boolean value
 * @param {string}  errno      the error number used as a prefix for reporting errors
 * @param {Class}   errs       errors found in validaton
 * @param {boolean} isRequired true if the specificed attribued is required to be specified for the element
 */
function FalseValue(elem, attrName, errno, errs, isRequired=true) {
	AllowedValue(elem, attrName, errno, errs, ["false"], isRequired);
}


/** 
 * verify the language using a validation class
 *
 * @param {object} validator  the validation class to use
 * @param {Class}  errs       errors found in validaton
 * @param {string} lang 	  that should be displayed in HTML
 * @param {string} loc        (optional) "location" of the language being checked
 * @param {string} errno      (optional) error number to use instead of local values
 */
function CheckLanguage(validator, errs, lang, loc=null, errno=null ) {
	if (!validator) {
		errs.pushCode(errno?`${errno}-1`:"LA001", `cannot validate language ${lang.quote()}${loc?" for "+loc.elementize():""}`, "no language validator");
		return false;
	}
	if (!validator.isKnown(lang))  {
		errs.pushCode(errno?`${errno}-2`:"LA002", `language ${lang.quote()} specified${loc?" for "+loc.elementize():""} is invalid`, "invalid language");
		return false;
	}
	return true;
}

module.exports = class ContentGuideCheck {

	constructor(useURLs, preloadedLanguageValidator=null,  preloadedGenres=null, preloadedCreditItemRoles=null) {

		if (preloadedLanguageValidator) 
			this.knownLanguages=preloadedLanguageValidator;
		else {
			console.log("loading languages...");
			this.knownLanguages=new IANAlanguages();
			this.knownLanguages.loadLanguages(useURLs?{url: locs.IANA_Subtag_Registry.url, purge: true}:{file: locs.IANA_Subtag_Registry.file, purge: true});
		}

		if (preloadedGenres) 
			this.allowedGenres=preloadedGenres;
		else {
			console.log("loading classification schemes...");
			this.allowedGenres=new ClassificationScheme();
			this.allowedGenres.loadCS(useURLs?
						{urls:[locs.TVA_ContentCS.url, locs.TVA_FormatCS.url, locs.DVBI_ContentSubject.url]}:
						{files:[locs.TVA_ContentCS.file, locs.TVA_FormatCS.file, locs.DVBI_ContentSubject.file]});
		}
		
		if (preloadedCreditItemRoles)
			this.allowedCreditItemRoles=preloadedCreditItemRoles;
		else {
			console.log("loading CreditItem roles...");
			this.allowedCreditItemRoles=new Role();
			this.allowedCreditItemRoles.loadRoles(useURLs?
					{urls:[locs.DVBI_CreditsItemRoles.url, locs.DVBIv2_CreditsItemRoles.url]}:
					{files:[locs.DVBI_CreditsItemRoles.file, locs.DVBIv2_CreditsItemRoles.file]});
		}

		console.log("loading Schemas...");
		this.TVAschema=libxml.parseXmlString(fs.readFileSync(locs.TVAschema.file));

		this.supportedRequests=supportedRequests;

		this.extendArray();
	}


	/*private*/ extendArray() {
		// based on the polyfill at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach 
		/*
		* alternate to Array.prototype.forEach that only returns XML tree nodes that are elements
		*/
		if (!Array.prototype.forEachSubElement) {

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
	}


	/**
	 * counts the number of named elements in the specificed node 
	 * *
	 * @param {Object} node the libxmljs node to check
	 * @param {String} childElementName the name of the child element to count
	 * @returns {integer} the number of named child elments 
	 */
	/* private */  CountChildElements(node, childElementName) {
		let r=0, childElems=node?node.childNodes():null;
		if (childElems) childElems.forEachSubElement(elem => {
			if (elem.name()==childElementName)
				r++;
		});
		return r;
	}


	/**
	 * validate the language specified record any errors
	 *
	 * @param {object} validator  the validation class to use
	 * @param {Class}  errs       errors found in validaton
	 * @param {Object} node       the XML node whose @lang attribute should be checked
	 * @param {string} parentLang the language of the XML element which is the parent of node
	 * @param {boolean} isRequired report an error if @lang is not explicitly stated
	 * @param {string} errno      (optional) error number to use instead of local values
	 * @returns {string} the @lang attribute of the node element of the parentLang if it does not exist of is not specified
	 */
	/* private */  GetLanguage(validator, errs, node, parentLang, isRequired=false, errno=null) {
		if (!node) 
			return parentLang;
		if (!node.attr(tva.a_lang) && isRequired) {
			errs.pushCode(errno?errno:"AC001", `${tva.a_lang.attribute()} is required for ${node.name().quote()}`, "unspecified language");
			return parentLang;		
		}

		if (!node.attr(tva.a_lang))
			return parentLang;
		
		let localLang=node.attr(tva.a_lang).value();
		CheckLanguage(validator, errs, localLang, node.name(), errno);
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
				errs.pushCodeW(errCode?errCode:"UR001", `${tva.a_serviceIDRef.attribute(elem.name())} ${svcID.quote()} is not a TAG URI`);
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
			errs.pushCode("SY000", "ValidateSynopsis() called with BasicDescription==null");
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
							errs.pushCodeWithFragment(errCode?`${errCode}-11`:"SY011", synopsisLengthError(tva.SYNOPSIS_SHORT_LABEL, tva.SYNOPSIS_SHORT_LENGTH, _len), Synopsis.toString());
						hasShort=true;
						break;
					case tva.SYNOPSIS_MEDIUM_LABEL:
						if (_len > tva.SYNOPSIS_MEDIUM_LENGTH)
							errs.pushCodeWithFragment(errCode?`${errCode}-12`:"SY012", synopsisLengthError(tva.SYNOPSIS_MEDIUM_LABEL, tva.SYNOPSIS_MEDIUM_LENGTH, _len), Synopsis.toString());
						hasMedium=true;
						break;
					case tva.SYNOPSIS_LONG_LABEL:
						if (_len > tva.SYNOPSIS_LONG_LENGTH)
							errs.pushCodeWithFragment(errCode?`${errCode}-13`:"SY013", synopsisLengthError(tva.SYNOPSIS_LONG_LABEL, tva.SYNOPSIS_LONG_LENGTH, _len), Synopsis.toString());
						hasLong=true;
						break;						
					}
				}
				else
					errs.pushCodeWithFragment(errCode?`${errCode}-14`:"SY014", `${tva.a_length.attribute()}=${synopsisLength.quote()} is not permitted for this request type`, Synopsis.toString());
			}
		
			if (synopsisLang && synopsisLength) {
				switch (synopsisLength) {
					case tva.SYNOPSIS_SHORT_LABEL:
						if (isIn(shortLangs, synopsisLang)) 
							errs.pushCodeWithFragment(errCode?`${errCode}-16`:"SY016", singleLengthLangError(synopsisLength, synopsisLang), Synopsis.toString());
						else shortLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_MEDIUM_LABEL:
						if (isIn(mediumLangs, synopsisLang)) 
							errs.pushCodeWithFragment(errCode?`${errCode}-17`:"SY017", singleLengthLangError(synopsisLength, synopsisLang), Synopsis.toString());
						else mediumLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_LONG_LABEL:
						if (isIn(longLangs, synopsisLang)) 
							errs.pushCodeWithFragment(errCode?`${errCode}-18`:"SY018", singleLengthLangError(synopsisLength, synopsisLang), Synopsis.toString());
						else longLangs.push(synopsisLang);
						break;
				}
			}
		}
		
		if (isIn(requiredLengths, tva.SYNOPSIS_SHORT_LABEL) && !hasShort)
			errs.pushCode(errCode?`${errCode}-19`:"SY019", requiredSynopsisError(tva.SYNOPSIS_SHORT_LABEL));
		if (isIn(requiredLengths, tva.SYNOPSIS_MEDIUM_LABEL) && !hasMedium)
			errs.pushCode(errCode?`${errCode}-20`:"SY020", requiredSynopsisError(tva.SYNOPSIS_MEDIUM_LABEL));
		if (isIn(requiredLengths, tva.SYNOPSIS_LONG_LABEL) && !hasLong)
			errs.pushCode(errCode?`${errCode}-21`:"SY021", requiredSynopsisError(tva.SYNOPSIS_LONG_LABEL));
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
			errs.pushCode("KW000", "ValidateKeyword() called with BasicDescription=null");
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
				errs.pushCode(errCode?`${errCode}-1`:"KW011", `${tva.a_type.attribute()}=${keywordType.quote()} not permitted for ${tva.e_Keyword.elementize()}`);
			if (unEntity(Keyword.text()).length > dvbi.MAX_KEYWORD_LENGTH)
				errs.pushCode(errCode?`${errCode}-2`:"KW012", `length of ${tva.e_Keyword.elementize()} is greater than ${dvbi.MAX_KEYWORD_LENGTH}`);
		}
		
		for (let i in counts) {
			if (counts[i]!=0 && counts[i]>maxKeywords) 
				errs.pushCode(errCode?`${errCode}-3`:"KW013", 
					`More than ${maxKeywords} ${tva.e_Keyword.elementize()} element${(maxKeywords>1?"s":"")} specified${(i==DEFAULT_LANGUAGE?"":" for language "+i.quote())}`);
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
			errs.pushCode("GE000", "ValidateGenre() called with BasicDescription=null");
			return;
		}

		let g=0, Genre;
		while ((Genre=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_Genre, ++g), CG_SCHEMA))!=null) {
			let genreType=Genre.attr(tva.a_type)?Genre.attr(tva.a_type).value():tva.DEFAULT_GENRE_TYPE;
			if (genreType!=tva.GENRE_TYPE_MAIN)
				errs.pushCode(errCode?`${errCode}-1`:"GE001", `${tva.a_type.attribute()}=${genreType.quote()} not permitted for ${tva.e_Genre.elementize()}`);
			
			let genreValue=Genre.attr(tva.a_href)?Genre.attr(tva.a_href).value():"";
			if (!this.allowedGenres.isIn(genreValue))
				errs.pushCode(errCode?`${errCode}-2`:"GE002", `invalid ${tva.a_href.attribute()} value ${genreValue.quote()} for ${tva.e_Genre.elementize()}`);
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
			errs.pushCode("PG000", "ValidateParentalGuidance() called with BasicDescription=null");
			return;
		}

		let countParentalGuidance=0, countExplanatoryText;
		function checkPGchild(pgChild, index, array) {
			switch (pgChild.name()) {
				case tva.e_MinimumAge:
				case tva.e_ParentalRating:
					if (countParentalGuidance==1 && pgChild.name()!=tva.e_MinimumAge)
						errs.pushCode(errCode?`${errCode}-1`:"PG011", `first ${tva.e_ParentalGuidance.elementize()} element must contain ${phlib.elementize("mpeg7:"+tva.e_MinimumAge)}`);
					
					if (pgChild.name()==tva.e_MinimumAge && countParentalGuidance!=1)
						errs.pushCode(errCode?`${errCode}-2`:"PG012", `${tva.e_MinimumAge.elementize()} must be in the first ${tva.e_ParentalGuidance.elementize()} element`);
					
					if (pgChild.name()==tva.e_ParentalRating) {
						checkAttributes(pgChild, [tva.a_href], [], errs, errCode?`${errCode}-3`:"PG013");
					}
					break;		
				case tva.e_ExplanatoryText:
					countExplanatoryText++;
					checkAttributes(pgChild, [tva.a_length], [], errs, errCode?`${errCode}-4`:"PG004") ;
					if (pgChild.attr(tva.a_length)) {
						if (pgChild.attr(tva.a_length).value()!=tva.v_lengthLong)
							errs.pushCode(errCode?`${errCode}-3`:"PG003", `${tva.a_length.attribute()}=${pgChild.attr(tva.a_length).value().quote()} is not allowed for ${tva.e_ExplanatoryText.elementize()}`);
					}
					
					if (unEntity(pgChild.text()).length > dvbi.MAX_EXPLANATORY_TEXT_LENGTH)
						errs.pushCode(errCode?`${errCode}-5`:"PG005", `length of ${tva.e_ExplanatoryText.elementize()} cannot exceed ${dvbi.MAX_EXPLANATORY_TEXT_LENGTH} characters`);
					break;
			}
		}
		let pg=0, ParentalGuidance;
		while ((ParentalGuidance=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_ParentalGuidance, ++pg), CG_SCHEMA))!=null) {
			countParentalGuidance++;
			countExplanatoryText=0;

			if (ParentalGuidance.childNodes()) ParentalGuidance.childNodes().forEachSubElement(checkPGchild);

			if (countExplanatoryText > 1)
				errs.pushCode(errCode?`${errCode}-6`:"PG006", `only a single ${tva.e_ExplanatoryText.elementize()} element is premitted in ${tva.e_ParentalGuidance.elementize()}`);
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
				errs.pushCode(errCode?`${errCode}-1`:"VN001", `${elem.name().elementize()} in ${elem.parent().name().elementize()} is longer than ${dvbi.MAX_NAME_PART_LENGTH} characters`);
		}
		
		if (!elem) {
			errs.pushCode("VN000", "ValidateName() called with elem==null");
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
			errs.pushCode("VN004", `${tva.e_GivenName.elementize()} is mandatory in ${elem.name().elementize()}`);
		if (familyNameCount>1)
			errs.pushCode("VN005", `only a single ${tva.e_FamilyName.elementize()} is permitted in ${elem.name().elementize()}`);
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
			errs.pushCode("CL000", "ValidateCreditsList() called with BasicDescription==null");
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
						errs.pushCode(errCode?`${errCode}-2`:"CL002", `${CreditsItemRole.quote()} is not valid for ${tva.a_role.attribute(tva.e_CreditsItem)}`);
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
								errs.pushCode(errCode?`${errCode}-5`:"CL005", 
									`length of ${tva.e_OrganizationName.elementize()} in ${tva.e_CreditsItem.elementize()} exceeds ${dvbi.MAX_ORGANIZATION_NAME_LENGTH} characters`);
							break;
						default:
							if (elem.name()!="text")
								errs.pushCode(errCode?`${errCode}-6`:"CL006", `extra element ${elem.name().elementize()} found in ${tva.e_CreditsItem.elementize()}`);
					}
					if (foundPersonName>1)
						errs.pushCode(errCode?`${errCode}-10`:"CL010", singleElementError(tva.e_PersonName, tva.e_CreditsItem));
					if (foundCharacter>1)
						errs.pushCode(errCode?`${errCode}-11`:"CL011", singleElementError(tva.e_Character, tva.e_CreditsItem));
					if (foundOrganizationName>1)
						errs.pushCode(errCode?`${errCode}-12`:"CL012", singleElementError(tva.e_OrganizationName, tva.e_CreditsItem));
					if (foundCharacter>0 && foundPersonName==0)
						errs.pushCode(errCode?`${errCode}-13`:"CL013", `${tva.e_Character.elementize()} in ${tva.e_CreditsItem.elementize()} requires ${tva.e_PersonName.elementize()}`);
					if (foundOrganizationName>0 && (foundPersonName>0 || foundCharacter>0))
						errs.pushCode(errCode?`${errCode}-14`:"CL014", `${tva.e_OrganizationName.elementize()} can only be present when ${tva.e_PersonName.elementize()} is absent in ${tva.e_CreditsItem.elementize()}`);
				});
				/* jshint +W083 */
				if (foundPersonName>1)
					errs.pushCode(errCode?`${errCode}-20`:"CL020", singleElementError(tva.e_PersonName, tva.e_CreditsItem));
				if (foundCharacter>1)
					errs.pushCode(errCode?`${errCode}-21`:"CL021", singleElementError(tva.e_Character, tva.e_CreditsItem));
				if (foundOrganizationName>1)
					errs.pushCode(errCode?`${errCode}-22`:"CL022", singleElementError(tva.e_OrganizationName, tva.e_CreditsItem));
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
			errs.pushCode("IRM000", "CheckImageRelatedMaterial() called with RelatedMaterial==null");
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
					if (!isJPEGmime(contentType) && !isPNGmime(contentType)) 
						errs.pushCode("IRM003", `${tva.a_contentType.attribute(tva.e_MediaUri)}=${contentType.quote()} is not valid for a ${errLocation}`);
				}
				
				if (!patterns.isHTTPURL(MediaUri.text()))
					errs.pushCode("IRM004", `${tva.e_MediaUri.elementize()}=${MediaUri.text().quote()} is not a valid Image URL`, "invalid URL");
			}
			else errs.pushCode("IRM001", `${tva.e_MediaUri.elementize()} not specified for Promotional Still Image (${tva.a_href.attribute(tva.e_HowRelated)}=${tva.cs_PromotionalStillImage})`);
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
			errs.pushCode("RM000", "ValidateRelatedMaterial() called with BasicDescription==null");
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
				errs.pushCode(errCode, `more than 1 ${quote(`${label} pagination`)} link is specified`) ;
				return true;
			}
			return false;
		}
		
		if (!BasicDescription) {
			errs.pushCode("VP000", "ValidatePagination() called with BasicDescription==null");
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
					if (!patterns.isHTTPURL(MediaURI.text()))
						errs.pushCode("VP011", `${tva.e_MediaUri.elementize()}=${MediaURI.text().quote()} is not a valid Pagination URL`, "invalid URL");
				}
				else
					errs.pushCode("VP010", `${tva.e_MediaLocator.elementize()}${tva.e_MediaUri.elementize()} not specified for pagination link`);
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
				errs.pushCode("VP020", `only 0, 2 or 4 paginations links may be signalled in ${tva.e_RelatedMaterial.elementize()} elements for ${Location}`);
			else if (numPaginations==2) {
				if (countPaginationPrev==1 && countPaginationLast==1) 
					errs.pushCode("VP021", `${"previous".quote()} and ${"last".quote()} links cannot be specified alone`);
				if (countPaginationFirst==1 && countPaginationNext==1) 
					errs.pushCode("VP022", `${"first".quote()} and ${"next".quote()} links cannot be specified alone`);
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
			errs.pushCode("RMME000", "ValidateRelatedMaterial_MoreEpisodes() called with BasicDescription==null");
			return;
		}
		switch (BasicDescription.parent().name()) {
			case tva.e_ProgramInformation:
				let rm=0, RelatedMaterial;
				while ((RelatedMaterial=BasicDescription.get(xPath(SCHEMA_PREFIX, tva.e_RelatedMaterial, ++rm), CG_SCHEMA))!=null) 
					this.ValidatePromotionalStillImage(CG_SCHEMA, SCHEMA_PREFIX, RelatedMaterial, errs, BasicDescription.name(), "More Episodes");
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
	 * @param {string} errno           The error number to show in the log
	 */
	/* private */  NoChildElement(errs, missingElement, parentElement, schemaLocation=null, errno=null) {
		errs.pushCode(errno?errno:"NC001", `${missingElement} element not specified for ${parentElement}${schemaLocation?(" in "+schemaLocation):""}`);
	}


	/**
	 * Add an error message when the @href contains an invalid value
	 *
	 * @param {Object} errs    Errors buffer
	 * @param {string} value   The invalid value for the href attribute
	 * @param {string} src     The element missing the @href
	 * @param {string} loc     The location of the element
	 * @param {string} errno   The error number to show in the log
	 */
	/* private */  InvalidHrefValue(errs, value, src, loc=null, errno=null) {
		errs.pushCode(errno?errno:"HV001", `invalid ${tva.a_href.attribute()}=${value.quote()} specified for ${src}${loc?(" in "+loc):""}`);
	}


	/**
	 * Add an error message when the MediaLocator does not contain a MediaUri sub-element
	 *
	 * @param {Object} errs Errors buffer
	 * @param {String} src The type of element with the <MediaLocator>
	 * @param {String} loc The location of the element
	 */
	/* private */  NoAuxiliaryURI(errs, src, loc, errno=null) {
		NoChildElement(errs, tva.e_AuxiliaryURI.elementize(), `${src} ${tva.e_MediaLocator.elementize()}`, loc, errno?errno:"AU001");
	}


	/** TemplateAITPromotional Still Image
	 *
	 * @param {Object} RelatedMaterial   the <RelatedMaterial> element (a libxmls ojbect tree) to be checked
	 * @param {Object} errs              The class where errors and warnings relating to the serivce list processing are stored 
	 * @param {string} Location          The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
	 */
	/* private */  ValidateTemplateAIT(CG_SCHEMA, SCHEMA_PREFIX, RelatedMaterial, errs, Location) {
		
		if (!RelatedMaterial) {
			errs.pushCode("TA000", "ValidateTemplateAIT() called with RelatedMaterial==null");
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
				errs.pushCode("TA003", `${tva.a_href.attribute(tva.e_HowRelated)}=${HowRelated.attr(tva.a_href).value().quote()} does not designate a Template AIT`);
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
										errs.pushCode("TA011", 
											`invalid ${tva.a_contentType.attribute()}=${contentType.quote()} specified for ${RelatedMaterial.name().elementize()}${tva.e_MediaLocator.elementize()} in ${Location}`);
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
	 * @param {string} LocationType      The type of element containing the <RelatedMaterial> element. Different validation rules apply to different location types
	 */
	/* private */  ValidatePromotionalStillImage(CG_SCHEMA, SCHEMA_PREFIX, RelatedMaterial, errs, Location, LocationType) {
		
		if (!RelatedMaterial) {
			errs.pushCode("PS000", "ValidatePromotionalStillImage() called with RelatedMaterial==null");
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
				errs.pushCode("PS010", `${tva.a_href.attribute(tva.e_HowRelated)}=${HowRelated.attr(tva.a_href).value().quote()} does not designate a Promotional Still Image`);
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
										errs.pushCode("PS032", 
											`invalid ${tva.a_contentType.attribute(tva.e_MediaLocator)}=${contentType.quote()} specified for ${RelatedMaterial.name().elementize()} in ${Location}`);
									if (Format && ((isJPEGmime(contentType) && !isJPEG) || (isPNGmime(contentType) && !isPNG))) 
										errs.pushCode("PS033", `conflicting media types in ${tva.e_Format.elementize()} and ${tva.e_MediaUri.elementize()} for ${Location}`);
								}
								if (!patterns.isHTTPURL(child.text()))
									errs.pushCode("PS034", `${tva.e_MediaUri.elementize()}=${child.text().quote()} is not a valid Image URL`, "invalid URL");
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
	 * @param {integer} minRMelements       the minimum number of RelatedMaterial elements
	 * @param {integer} maxRMelements       the maximum number of RelatedMaterial elements
	 * @param {Class}   errs                errors found in validaton
	 */
	/* private */  ValidateRelatedMaterial_BoxSetList(CG_SCHEMA, SCHEMA_PREFIX, BasicDescription, errs, Location) {
		
		if (!BasicDescription) {
			errs.pushCode("MB000", "ValidateRelatedMaterial_BoxSetList() called with BasicDescription==null");
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
							this.ValidateTemplateAIT(CG_SCHEMA, SCHEMA_PREFIX, RelatedMaterial, errs, BasicDescription.name().elementize());
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
							this.ValidatePromotionalStillImage(CG_SCHEMA, SCHEMA_PREFIX, RelatedMaterial, errs, BasicDescription.name().elementize());
							break;
						default:
							this.InvalidHrefValue(errs, hrHref, tva.e_HowRelated.elementize(), `${tva.e_RelatedMaterial.elementize()} in Box Set List`, "MB011");
					}	
				}
			}
		}
		if (countTemplateAIT==0)
			errs.pushCode("MB021", `a ${tva.e_RelatedMaterial.elementize()} element signalling the Template XML AIT must be specified for a Box Set List`);
		if (countTemplateAIT>1)
			errs.pushCode("MB022", `only one ${tva.e_RelatedMaterial.elementize()} element signalling the Template XML AIT can be specified for a Box Set List`);
		if (countImage>1)
			errs.pushCode("MB023", `only one ${tva.e_RelatedMaterial.elementize()} element signalling the promotional still image can be specified for a Box Set List`);
		
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
			errs.pushCode("VT000", "ValidateTitle() called with BasicDescription==null");
			return;
		}
		
		let mainSet=[], secondarySet=[];

		function analyseLang(lang, index, array) {
			if (!isIn(mainSet, lang)) {
				let tLoc= lang!=DEFAULT_LANGUAGE ? ` for @xml:${tva.a_lang}=${lang.quote()}` : "";
				errs.pushCode(errCode?`${errCode}-16`:"VT016", 
					`${tva.a_type.attribute()}=${mpeg7.TITLE_TYPE_SECONDARY.quote()} specified without ${tva.a_type.attribute()}=${mpeg7.TITLE_TYPE_MAIN.quote()}${tLoc}`);
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
				errs.pushCode(errCode?`${errCode}-11`:"VT011", `${tva.e_Title.elementize()} length exceeds ${dvbi.MAX_TITLE_LENGTH} characters`);
				
			switch (titleType) {
				case mpeg7.TITLE_TYPE_MAIN:
					if (isIn(mainSet, titleLang))
						errs.pushCode(errCode?`${errCode}-12`:"VT012", 
							`only a single language (${titleLang}) is permitted for ${tva.a_type.attribute(tva.e_Title)}=${mpeg7.TITLE_TYPE_MAIN.quote()}`);
					else mainSet.push(titleLang);
					break;
				case mpeg7.TITLE_TYPE_SECONDARY:
					if (allowSecondary) {
						if (isIn(secondarySet, titleLang))
							errs.pushCode(errCode?`${errCode}-13`:"VT013", 
								`only a single language (${titleLang}) is permitted for ${tva.a_type.attribute(tva.e_Title)}=${mpeg7.TITLE_TYPE_SECONDARY.quote()}`);
						else secondarySet.push(titleLang);
					}
					else 
						errs.pushCode(errCode?`${errCode}-14`:"VT014", 
							`${tva.a_type.attribute(tva.e_Title)}=${mpeg7.TITLE_TYPE_SECONDARY.quote()} is not permitted for this ${BasicDescription.name().elementize()}`);
					break;
				default:	
					errs.pushCode(errCode?`${errCode}-15`:"VT015", 
						`${tva.a_type.attribute()} must be ${mpeg7.TITLE_TYPE_MAIN.quote()} or ${mpeg7.TITLE_TYPE_SECONDARY.quote()} for ${tva.e_Title.elementize()}`);
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
			errs.pushCode("BD000", "ValidateBasicDescription() called with parentElement==null");
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
						errs.pushCode("BD050", `ValidateBasicDescription() called with invalid requestType/element (${requestType}/${parentElement.name()})`);
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
						errs.pushCode("BD100", `ValidateBasicDescription() called with invalid requestType/element (${requestType}/${parentElement.name()})`);
					}
				break;
			default:
				errs.pushCode("BD003", `ValidateBasicDescription() called with invalid element (${parentElement.name()})`);	
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
			errs.pushCode("PI000", "ValidateProgramInformation() called with ProgramInformation==null");
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
				errs.pushCode("PI011", `${tva.a_programId.attribute(ProgramInformation.name())} is not a valid CRID (${programCRID})`);
			if (isIni(programCRIDs, programCRID))
				errs.pushCode("PI012", `${tva.a_programId.attribute(ProgramInformation.name())}=${programCRID.quote()} is already used`);
			else programCRIDs.push(programCRID);
		}

		// <ProgramInformation><BasicDescription>
		this.ValidateBasicDescription(CG_SCHEMA, SCHEMA_PREFIX, ProgramInformation, requestType, errs, piLang, null);

		let children=ProgramInformation.childNodes();
		if (children) children.forEachSubElement(child => {
			switch (child.name()) {
				case tva.e_OtherIdentifier:		// <ProgramInformation><OtherIdentifier>
					if (requestType==CG_REQUEST_MORE_EPISODES)
						errs.pushCode("PI021", `${tva.e_OtherIdentifier.elementize()} is not permitted in this request type`);
					break;
				case tva.e_EpisodeOf:			// <ProgramInformation><EpisodeOf>
					checkAttributes(child, [tva.a_crid], [], errs, "PI031");
					
					// <ProgramInformation><EpisodeOf>@crid
					if (child.attr(tva.a_crid)) {
						let foundCRID=child.attr(tva.a_crid).value();
						if (groupCRIDs && !isIni(groupCRIDs, foundCRID)) 
							errs.pushCode("PI032", 
								`${tva.a_crid.attribute(`${ProgramInformation.name()}.${tva.e_EpisodeOf}`)}=${foundCRID.quote()} is not a defined Group CRID for ${tva.e_EpisodeOf.elementize()}`);
						else
							if (!isCRIDURI(foundCRID))
								errs.pushCode("PI033", `${tva.a_crid.attribute(`${ProgramInformation.name()}.${tva.e_EpisodeOf}`)}=${foundCRID.quote()} is not a valid CRID`);
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
						errs.pushCode("PI043", `${attribute(`xsi:${tva.a_type}`)} must be ${tva.t_MemberOfType.quote()} for ${ProgramInformation.name()}.${tva.e_MemberOf}`);
				
					// <ProgramInformation><MemberOf>@crid
					let foundCRID=null;
					if (child.attr(tva.a_crid)) {
						foundCRID=child.attr(tva.a_crid).value();
						if (groupCRIDs && !isIni(groupCRIDs, foundCRID)) 
							errs.pushCode("PI044", 
								`${tva.a_crid.attribute(`${ProgramInformation.name()}.${tva.e_MemberOf}`)}=${foundCRID.quote()} is not a defined Group CRID for ${tva.e_MemberOf.elementize()}`);
						else
							if (!isCRIDURI(foundCRID))
								errs.pushCode("PI045", `${tva.a_crid.attribute(`${ProgramInformation.name()}.${tva.e_MemberOf}`)}=${foundCRID.quote()} is not a valid CRID`);
					}
					
					// <ProgramInformation><MemberOf>@index
					if (child.attr(tva.a_index)) {
						let index=valUnsignedInt(child.attr(tva.a_index).value());
						let indexInCRID=`${(foundCRID?foundCRID:"noCRID")}(${index})`;
						if (isIni(indexes, indexInCRID))
							errs.pushCode("PI046", `${tva.a_index.attribute(tva.e_MemberOf)}=${index} is in use by another ${ProgramInformation.name()} element`);
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
			errs.pushCode("PI100", "CheckProgramInformation() called with ProgramDescription==null");
			return null;
		}
			
		let ProgramInformationTable=ProgramDescription.get(xPath(SCHEMA_PREFIX, tva.e_ProgramInformationTable), CG_SCHEMA);
		if (!ProgramInformationTable) {
			errs.pushCode("PI101", `${tva.e_ProgramInformationTable.elementize()} not specified in ${ProgramDescription.name().elementize()}`);
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
				errs.pushCode("PI110", 
					`number of items (${cnt}) in ${tva.e_ProgramInformationTable.elementize()} does match ${tva.a_numOfItems.attribute(tva.e_GroupInformation)} specified in ${CATEGORY_GROUP_NAME} (${o.childCount})`);
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
			errs.pushCode("GIB000", "ValidateGroupInformationBoxSets() called with GroupInformation==null");
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
				errs.pushCode("GIB021", `${tva.a_groupId.attribute(GroupInformation.name())} value ${groupId.quote()} is not a CRID`);
		}

		let categoryCRID=(categoryGroup && categoryGroup.attr(tva.a_groupId)) ? categoryGroup.attr(tva.a_groupId).value() : "";

		if ([CG_REQUEST_BS_LISTS, CG_REQUEST_BS_CATEGORIES].includes(requestType)) {
			if (!isParentGroup && GroupInformation.attr(tva.a_ordered)) 
				errs.pushCode("GIB031", `${tva.a_ordered.attribute(GroupInformation.name())} is only permitted in the ${CATEGORY_GROUP_NAME}`);
			if (isParentGroup && !GroupInformation.attr(tva.a_ordered)) 
				errs.pushCode("GIB032", `${tva.a_ordered.attribute(GroupInformation.name())} is required for this request type`);
			if (!isParentGroup && GroupInformation.attr(tva.a_numOfItems)) 
				errs.pushCode("GIB033", `${tva.a_numOfItems.attribute(GroupInformation.name())} is only permitted in the ${CATEGORY_GROUP_NAME}`);
			if (isParentGroup && !GroupInformation.attr(tva.a_numOfItems)) 
				errs.pushCode("GIB034", `${tva.a_numOfItems.attribute(GroupInformation.name())}is required for this request type`);
		}

		if (!isParentGroup) {
			let MemberOf=GroupInformation.get(xPath(SCHEMA_PREFIX, tva.e_MemberOf), CG_SCHEMA);
			if (MemberOf) {
				checkAttributes(MemberOf, [tva.a_type, tva.a_index, tva.a_crid], [], errs, "GIB041");
				if (MemberOf.attr(tva.a_type) && MemberOf.attr(tva.a_type).value()!=tva.t_MemberOfType)
					errs.pushCode("GIB042", `${GroupInformation.name()}.${tva.e_MemberOf}@xsi:${tva.a_type} is invalid (${MemberOf.attr(tva.a_type).value().quote()})`);
				
				if (MemberOf.attr(tva.a_index)) {
					let index=valUnsignedInt(MemberOf.attr(tva.a_index).value());
					if (index>=1) {
						if (indexes) {
							if (indexes.includes(index)) 
								errs.pushCode("GI043", `duplicated ${tva.a_index.attribute(`${GroupInformation.name()}.${tva.e_MemberOf}`)} values (${index})`);
							else indexes.push(index);
						}
					}
					else 
						errs.pushCode("GIB44", `${tva.a_index.attribute(`${GroupInformation.name()}.${tva.e_MemberOf}`)} must be an integer >= 1 (parsed ${index})`);
				}

				if (MemberOf.attr(tva.a_crid) && MemberOf.attr(tva.a_crid).value()!=categoryCRID)
					errs.pushCode("GIB045", 
						`${tva.a_crid.attribute(`${GroupInformation.name()}.${tva.e_MemberOf}`)} (${MemberOf.attr(tva.a_crid).value()}) does not match the ${CATEGORY_GROUP_NAME} crid (${categoryCRID})`);
			}
			else
				errs.pushCode("GIB046", `${GroupInformation.name()} requires a ${tva.e_MemberOf.elementize()} element referring to the ${CATEGORY_GROUP_NAME} (${categoryCRID})`);
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
	 * @param {array}  indexes			   an accumulation of the @index values found
	 * @param {string} groupsFound         groupId values found (null if not needed)
	 */
	/* private */  ValidateGroupInformationSchedules(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, parentLanguage, categoryGroup, indexes, groupsFound) {

		if (!GroupInformation) {
			errs.pushCode("GIS000", "ValidateGroupInformationSchedules() called with GroupInformation==null");
			return;
		}
		checkAttributes(GroupInformation, [tva.a_groupId, tva.a_ordered, tva.a_numOfItems], [tva.a_lang], errs, "GIS001");

		if (GroupInformation.attr(tva.a_groupId)) {
			let groupId=GroupInformation.attr(tva.a_groupId).value();
			if ([CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_WINDOW].includes(requestType)) 
				if (!([dvbi.CRID_NOW, dvbi.CRID_LATER, dvbi.CRID_EARLIER].includes(groupId)))
					errs.pushCode("GIS011", `${tva.a_groupId.attribute(GroupInformation.name())} value ${groupId.quote()} is valid for this request type`);
		}

		if ([CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_WINDOW].includes(requestType)) {		
			TrueValue(GroupInformation, tva.a_ordered, "GIS013", errs);
			if (!GroupInformation.attr(tva.a_numOfItems)) 
				errs.pushCode("GIS015", `${tva.a_numOfItems.attribute(GroupInformation.name())} is required for this request type`);
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
	 * @param {array}  indexes			   an accumulation of the @index values found
	 * @param {string} groupsFound         groupId values found (null if not needed)
	 */
	/* private */  ValidateGroupInformationMoreEpisodes(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, parentLanguage, categoryGroup, indexes, groupsFound) {
		
		if (!GroupInformation) {
			errs.pushCode("GIM000", "ValidateGroupInformationMoreEpisodes() called with GroupInformation==null");
			return;
		}
		if (categoryGroup) 
			errs.pushCode("GIM001", `${CATEGORY_GROUP_NAME} should not be specified for this request type`);
		
		checkAttributes(GroupInformation, [tva.a_groupId, tva.a_ordered, tva.a_numOfItems], [tva.a_lang], errs, "GIM002");
		
		if (GroupInformation.attr(tva.a_groupId)) {
			let groupId=GroupInformation.attr(tva.a_groupId).value();
			if (!isCRIDURI(groupId)) 
				errs.pushCode("GIM003", `${tva.a_groupId.attribute(GroupInformation.name())} value ${groupId.quote()} is not a valid CRID`);
			else 
				groupsFound.push(groupId);
		}

		TrueValue(GroupInformation, tva.a_ordered, "GIM004", errs, false);
		
		let GroupType=GroupInformation.get(xPath(SCHEMA_PREFIX, tva.e_GroupType), CG_SCHEMA);
		if (GroupType) {
			checkAttributes(GroupType, [tva.a_type, tva.a_value], [], errs, "GIM011");
			
			if (GroupType.attr(tva.a_type) && GroupType.attr(tva.a_type).value()!=tva.t_ProgramGroupTypeType) 
				errs.pushCode("GIM012", `${tva.e_GroupType}@xsi:${tva.a_type} must be ${tva.t_ProgramGroupTypeType.quote()}`);
			if (GroupType.attr(tva.a_value) && GroupType.attr(tva.a_value).value()!="otherCollection") 
				errs.pushCode("GIM013", `${tva.a_value.attribute(tva.e_GroupType)} must be ${"otherCollection".quote()}`);
		}
		else
			errs.pushCode("GIM014", `${tva.e_GroupType.elementize()} is required in ${GroupInformation.name().elementize()}`);

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
			errs.pushCode("GI000", "ValidateGroupInformation() called with GroupInformation==null");
			return;
		}

		let giLang=this.GetLanguage(this.knownLanguages, errs, GroupInformation, parentLanguage, false, "GI001");
		
		switch (requestType) {
			case CG_REQUEST_SCHEDULE_NOWNEXT:
			case CG_REQUEST_SCHEDULE_WINDOW:
				this.ValidateGroupInformationSchedules(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, giLang, categoryGroup, indexes, groupsFound);
				break;
			case CG_REQUEST_BS_CATEGORIES:
			case CG_REQUEST_BS_LISTS:
			case CG_REQUEST_BS_CONTENTS:
				this.ValidateGroupInformationBoxSets(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, giLang, categoryGroup, indexes, groupsFound);
				break;		
			case CG_REQUEST_MORE_EPISODES:
				this.ValidateGroupInformationMoreEpisodes(CG_SCHEMA, SCHEMA_PREFIX, GroupInformation, requestType, errs, giLang, categoryGroup, indexes, groupsFound);
				break;				
		}

		let GroupType=GroupInformation.get(xPath(SCHEMA_PREFIX, tva.e_GroupType), CG_SCHEMA);
		if (GroupType) {
			if (!(GroupType.attr(tva.a_type) && GroupType.attr(tva.a_type).value()==tva.t_ProgramGroupTypeType)) 
				errs.pushCode("GI011", `${tva.e_GroupType}@xsi:${tva.a_type}=${tva.t_ProgramGroupTypeType.quote()} is required`);
			if (!(GroupType.attr(tva.a_value) && GroupType.attr(tva.a_value).value()=="otherCollection")) 
				errs.pushCode("GI022", `${tva.a_value.attribute(tva.e_GroupType)}=${"otherCollection".quote()} is required`);
		}
		else
			errs.pushCode("GI014", `${tva.e_GroupType.elementize()} is required in ${GroupInformation.name().elementize()}`);
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
			errs.pushCode("GI100", "CheckGroupInformation() called with ProgramDescription==null");
			return;
		}
		let gi, GroupInformation;
		let GroupInformationTable=ProgramDescription.get(xPath(SCHEMA_PREFIX, tva.e_GroupInformationTable), CG_SCHEMA);
		
		if (!GroupInformationTable) {
			errs.pushCode("GI101", `${tva.e_GroupInformationTable.elementize()} not specified in ${ProgramDescription.name().elementize()}`);
			return;
		}
		let gitLang=this.GetLanguage(this.knownLanguages, errs, GroupInformationTable, parentLang, false, "GI102");

		// find which GroupInformation element is the "category group"
		let categoryGroup=null;
		if ([CG_REQUEST_BS_LISTS, CG_REQUEST_BS_CATEGORIES, CG_REQUEST_BS_CONTENTS].includes(requestType)) {
			gi=0;
			while ((GroupInformation=GroupInformationTable.get(xPath(SCHEMA_PREFIX, tva.e_GroupInformation, ++gi), CG_SCHEMA))!=null) {
				// this GroupInformation element is the "category group" if it does not contain a <MemberOf> element
				if (this.CountChildElements(GroupInformation, tva.e_MemberOf)==0) {
					// this GroupInformation element is not a member of another GroupInformation so it must be the "category group"
					if (categoryGroup)
						errs.pushCode("GI111", `only a single ${CATEGORY_GROUP_NAME} can be present in ${tva.e_GroupInformationTable.elementize()}`);
					else categoryGroup=GroupInformation;
				}
			}
			if (!categoryGroup)
				errs.pushCode("GI112", `a ${CATEGORY_GROUP_NAME} must be specified in ${tva.e_GroupInformationTable.elementize()} for this request type`);
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
				errs.pushCode("GI113", `${tva.a_numOfItems.attribute(tva.e_GroupInformation)} specified in ${CATEGORY_GROUP_NAME} (${numOfItems}) does match the number of items (${giCount})`);

			if (o) 
				o.childCount=numOfItems;
		}

		if (requestType==CG_REQUEST_MORE_EPISODES && giCount>1)
			errs.pushCode("GI114", `only one ${tva.e_GroupInformation} element is premitted for this request type`);
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
				errs.pushCode("VNN101", `${tva.a_numOfItems.attribute(tva.e_GroupInformation)} must be > 0 for ${grp.quote()}`);		
			if (numOfItems>numAllowed)
				errs.pushCode("VNN102", `${tva.a_numOfItems.attribute(tva.e_GroupInformation)} must be <= ${numAllowed} for ${grp.quote()}`);
		}
		
		if (!GroupInformation) {
			errs.pushCode("VNN000", "ValidateGroupInformationNowNext() called with GroupInformation==null");
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
					errs.pushCode("VNN001", `only a single ${grp.quote()} structural CRID is premitted in this request`);
				else 
					groupCRIDsFound.push(grp);
			}
			else 
				errs.pushCode("VNN002", `${tva.e_GroupInformation.elementize()} for ${grp.quote()} is not permitted for this request type`);
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
			errs.pushCode("NN000", "CheckGroupInformationNowNext() called with ProgramDescription==null");
			return;
		}
		
		let GroupInformationTable=ProgramDescription.get(xPath(SCHEMA_PREFIX, tva.e_GroupInformationTable), CG_SCHEMA);
		if (!GroupInformationTable) {
			errs.pushCode("NN001", `${tva.e_GroupInformationTable.elementize()} not specified in ${ProgramDescription.name().elementize()}`);
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
					errs.pushCode("NN003", `${tva.e_GroupInformation.elementize()} not processed for this request type`);
			}
		}
	}


	/**
	 * validate any <AVAttributes> elements in <InstanceDescription> elements
	 *
	 * @param {string} CG_SCHEMA           Used when constructing Xpath queries
	 * @param {string} SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {Object} AVAttributes        the <AVAttributes> node to be checked
	 * @param {string} parentLanguage      XML language of the parent element (expliclt or implicit from its parent(s))
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {Class}  errs                errors found in validaton
	 */
	/* private */  ValidateAVAttributes(CG_SCHEMA, SCHEMA_PREFIX, AVAttributes, parentLanguage, requestType, errs) {
		
		function isValidAudioMixType(mixType) { return [mpeg7.AUDIO_MIX_MONO, mpeg7.AUDIO_MIX_STEREO, mpeg7.AUDIO_MIX_5_1].includes(mixType); }
		function isValidAudioLanguagePurpose(purpose) {	return [dvbi.AUDIO_PURPOSE_MAIN,dvbi.AUDIO_PURPOSE_DESCRIPTION].includes(purpose);	}
		
		if (!AVAttributes) {
			errs.pushCode("AV000", "ValidateAVAttributes() called with AVAttributes==null");
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
					errs.pushCode("AV012", `${tva.e_AudioAttributes}.${tva.e_MixType} is not valid`);
			}
					
			let AudioLanguage=AudioAttributes.get(xPath(SCHEMA_PREFIX, tva.e_AudioLanguage), CG_SCHEMA);
			if (AudioLanguage) {
				checkAttributes(AudioLanguage, [tva.a_purpose], [], errs, "AV013" );
				let validLanguage=false, validPurpose=false, audioLang=AudioLanguage.text();
				if (AudioLanguage.attr(tva.a_purpose)) {
					if (!(validPurpose=isValidAudioLanguagePurpose(AudioLanguage.attr(tva.a_purpose).value())))
						errs.pushCode("AV014", `${tva.a_purpose.attribute(tva.e_AudioLanguage)} is not valid`);
				}

				validLanguage=CheckLanguage(this.knownLanguages, errs, audioLang, `${tva.e_AudioAttributes}.${tva.e_AudioLanguage}`, "AV015");
				
				if (validLanguage && validPurpose) {	
					if (audioCounts[audioLang]===undefined)
						audioCounts[audioLang]=1;
					else audioCounts[audioLang]++;

					let combo=`${audioLang}!--!${AudioLanguage.attr(tva.a_purpose).value()}`;
					if (isIn(foundAttributes, combo))
						errs.pushCode("AV016", `audio ${tva.a_purpose.attribute()} ${AudioLanguage.attr(tva.a_purpose).value().quote()} already specified for language ${audioLang.quote()}`);
					else
						foundAttributes.push(combo);
				}
			}
		}
		audioCounts.forEach(audioLang => {
			if (audioCounts[audioLang]>2)
				errs.pushCode("AV020", `more than 2 ${tva.e_AudioAttributes.elementize()} elements for language ${audioLang.quote()}`);
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
						errs.pushCode("AV042", `${tva.a_href.attribute(`${tva.e_CaptioningAttributes}.${tva.e_Coding}`)} is not valid - should be DVB (bitmap or character) or EBU TT-D`);
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
			errs.pushCode("RR000", "ValidateRestartRelatedMaterial() called with RelatedMaterial==null");
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
					errs.pushCode("RR003", `invalid ${tva.a_href.attribute(tva.e_HowRelated)} (${HowRelated.attr(tva.a_href).value()}) for Restart Application Link`);
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
	 * @param {string} parentLanguage      XML language of the parent element (expliclt or implicit from its parent(s))
	 * @param {array}  programCRIDs        array to record CRIDs for later use 
	 * @param {string} requestType         the type of content guide request being checked
	 * @param {Class}  errs                errors found in validaton
	 */
	/* private */  ValidateInstanceDescription(CG_SCHEMA, SCHEMA_PREFIX, VerifyType, InstanceDescription, isCurrentProgram, parentLanguage, programCRIDs, requestType, errs) {

		function isRestartAvailability(str) { return [dvbi.RESTART_AVAILABLE, dvbi.RESTART_CHECK, dvbi.RESTART_PENDING].includes(str); }
		function isMediaAvailability(str) { return [dvbi.MEDIA_AVAILABLE, dvbi.MEDIA_UNAVAILABLE].includes(str); }
		function isEPGAvailability(str) { return [dvbi.FORWARD_EPG_AVAILABLE, dvbi.FORWARD_EPG_UNAVAILABLE].includes(str); }
		function isAvailability(str) { return isMediaAvailability(str) || isEPGAvailability(str); }
		
		function checkGenre(node, errs, errcode=null) {
			if (!node) return null;
			checkAttributes(node, [tva.a_href], [tva.a_type], errs, errcode?`${errcode}-1`:"ChG001");
			let GenreType=(node.attr(tva.a_type)?node.attr(tva.a_type).value():tva.GENRE_TYPE_OTHER);
			if (GenreType!=tva.GENRE_TYPE_OTHER)
				errs.pushCode(errcode?`${errcode}-2`:"ChG002", `${tva.a_type.attribute(`${node.parent().name()}.${+node.name()}`)} must contain ${tva.GENRE_TYPE_OTHER.quote()}`);

			return (node.attr(tva.a_href)?node.attr(tva.a_href).value():null);
		}

		if (!InstanceDescription) {
			errs.pushCode("ID000", "ValidateInstanceDescription() called with InstanceDescription==null");
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
				errs.pushCode("ID003", `ValidateInstanceDescription() called with VerifyType=${VerifyType}`);
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
					errs.pushCode("ID012", `first ${phlib.elementize(`${InstanceDescription.name()}.+${tva.e_Genre}`)} must contain a media or fepg availability indicator`);

				let g2href=checkGenre(Genre2, errs, "ID013");
				if (g2href && !isAvailability(g2href))
					errs.pushCode("ID014", `second ${phlib.elementize(`${InstanceDescription.name()}.+${tva.e_Genre}`)} must contain a media or fepg availability indicator`);
				
				if (Genre1 && Genre2) {
					if ((isMediaAvailability(g1href) && isMediaAvailability(g2href)) || (isEPGAvailability(g1href) && isEPGAvailability(g2href)))
						errs.pushCode("ID015", `${phlib.elementize(`${InstanceDescription.name()}.+${tva.e_Genre}`)} elements must indicate different availabilities`);
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
								errs.pushCode("ID018", `${tva.a_type.attribute(Genre.name())} must be ${tva.GENRE_TYPE_OTHER.quote()} or omitted`);
						}
						else 
							errs.pushCode("ID017", `${phlib.elementize(`${InstanceDescription.name()}.+${tva.e_Genre}`)} must contain a restart link indicator`);
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
				errs.pushCode("ID033", `invalid ${tva.e_SignLanguage.elementize()} ${SignLanguage.text().quote()} in ${InstanceDescription.name().elementize()}`);
		}
		
		// <AVAttributes>
		let AVAttributes=InstanceDescription.get(xPath(SCHEMA_PREFIX, tva.e_AVAttributes), CG_SCHEMA);
		if (AVAttributes)
			this.ValidateAVAttributes(CG_SCHEMA, SCHEMA_PREFIX, AVAttributes, parentLanguage, requestType, errs);
		
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
						errs.pushCode("ID050", `${tva.a_type.attribute(tva.e_OtherIdentifier)}=${oiType.quote()} is not valid for ${VerifyType}.${InstanceDescription.name()}`);		
					if ([dvbi.EIT_PROGRAMME_CRID_TYPE, dvbi.EIT_SERIES_CRID_TYPE].includes(oiType))
						if (!isCRIDURI(OtherIdentifier.text()))
							errs.pushCode("ID051", `${tva.e_OtherIdentifier} must be a CRID for ${tva.a_type.attribute()}=${oiType.quote()}`);
			}
		}
		
		// <RelatedMaterial>
		switch (VerifyType) {
			case tva.e_ScheduleEvent:
				let RelatedMaterial=InstanceDescription.get(xPath(SCHEMA_PREFIX, tva.e_RelatedMaterial), CG_SCHEMA);
				if (RelatedMaterial) {
					if (this.ValidateRestartRelatedMaterial(CG_SCHEMA, SCHEMA_PREFIX, RelatedMaterial, errs))
						restartRelatedMaterial=RelatedMaterial; 		
				}
				break;
			case tva.e_ScheduleEvent:
				// Genre and RelatedMaterial for restart capability should only be specified for the "current" (ie. 'now') program
				if (!isCurrentProgram && (restartGenre || restartRelatedMaterial))
					errs.pushCode("ID060", `restart ${tva.e_Genre.elementize()} and ${tva.e_RelatedMaterial.elementize()} are only permitted for the current (${"now".quote()}) program`);
				
				if ((restartGenre && !restartRelatedMaterial) || (restartRelatedMaterial && !restartGenre))
					errs.pushCode("ID061", `both ${tva.e_Genre.elementize()} and ${tva.e_RelatedMaterial.elementize()} are required together for ${VerifyType}`)	;	
				break;
		}
	}


	/**
	 * validate a <ProgramURL> or <AuxiliaryURL> element to see if it signals a Template XML AIT
	 *
	 * @param {Object} node              the element node containing the an XML AIT reference
	 * @param {Array} allowedContentTypes the contentTypes that can be signalled in the node@contentType attribute
	 * @param {Class}  errs              errors found in validaton
	 * @param {string} errcode           error code to be used with any errors founf
	 */
	/* private */  CheckPlayerApplication(node, allowedContentTypes, errs, errcode=null) {

		if (!node)  {
			errs.pushCode(errcode?`${errcode}-0`:"PA000", "CheckPlayerApplication() called with node==null");
			return;
		}
		if (!node.attr(tva.a_contentType)) {
			errs.pushCode(errcode?`${errcode}-1`:"PA001", `${tva.a_contentType.attribute()} attribute is required when signalling a player in ${node.name().elementize()}`);
			return;
		}

		if (allowedContentTypes.includes(node.attr(tva.a_contentType).value())) {
			switch (node.attr(tva.a_contentType).value()) {
				case dvbi.XML_AIT_CONTENT_TYPE:
					if (!patterns.isHTTPURL(node.text()))
						errs.pushCode(errcode?`${errcode}-2`:"PA002", `${node.name().elementize()}=${node.text().quote()} is not a valid AIT URL`, "invalid URL");
					break;
	/*			case dvbi.HTML5_APP:
				case dvbi.XHTML_APP:
					if (!patterns.isHTTPURL(node.text()))
						errs.pushCode(errcode?`${errcode}-3`:"PA003", `${node.name().elementize()}=${node.text().quote()} is not a valid URL`, "invalid URL");		
					break;
	*/		}
		}
		else
			errs.pushCode(errcode?`${errcode}-4`:"PA004", `${tva.a_contentType.attribute(node.name())}=${node.attr(tva.a_contentType).value().quote()} is not valid for a player`);
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
			errs.pushCode("OD000", "ValidateOnDemandProgram() called with OnDemandProgram==null");
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
				errs.pushCode("OD004", `requestType=${requestType} is not valid for ${OnDemandProgram.name()}`);
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
					errs.pushCode("OD010", `${tva.a_crid.attribute(`${OnDemandProgram.name()}.${tva.e_Program}`)} is not a CRID URI`);
				else {
					if (!isIni(programCRIDs, programCRID))
						errs.pushCode("OD011", 
							`${tva.a_crid.attribute(`${OnDemandProgram.name()}.${tva.e_Program}`)}=${programCRID.quote()} does not refer to a program in the ${tva.e_ProgramInformationTable.elementize()}`);
				}
				plCRIDs.push(programCRID);
			}	
		}
		if (--prog>1)
			errs.pushCode("OD013", `only a single ${tva.e_Program.elementize()} is permitted in ${OnDemandProgram.name().elementize()}`);

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
		if (validRequest)
			while ((InstanceDescription=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_InstanceDescription, ++id), CG_SCHEMA))!=null)
				this.ValidateInstanceDescription(CG_SCHEMA, SCHEMA_PREFIX, OnDemandProgram.name(), InstanceDescription, false, odpLang, programCRIDs, requestType, errs);
		if (--id>1)
			errs.pushCode("OD041", `only a single ${tva.e_InstanceDescription.elementize()} is permitted in ${OnDemandProgram.name().elementize()}`);
		
		// <PublishedDuration>
		let pd=0, PublishedDuration;
		while ((PublishedDuration=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_PublishedDuration, ++pd), CG_SCHEMA))!=null) {
		/*
		* checked in schema based validation
			if (!patterns.isISODuration(PublishedDuration.text()))
				errs.pushCode("OD050", `${OnDemandProgram.name()}.${tva.e_PublishedDuration} is not a valid ISO Duration (xs:duration)`)
		*/
		}
		if (--pd>1)
			errs.pushCode("OD051", `only a single ${tva.e_PublishedDuration.elementize()} is permitted in ${OnDemandProgram.name().elementize()}`);
		
		// <StartOfAvailability> and <EndOfAvailability>
		let soa=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_StartOfAvailability), CG_SCHEMA),
			eoa=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_EndOfAvailability), CG_SCHEMA);

		if (soa && eoa) {
			let fr=new Date(soa.text()), to=new Date(eoa.text());	
			if (to.getTime() < fr.getTime()) 
				errs.pushCode("OD062", `${tva.e_StartOfAvailability.elementize()} must be earlier than ${tva.e_EndOfAvailability.elementize()}`);
		}
		
		// <DeliveryMode>
		let dm=0, DeliveryMode;
		while ((DeliveryMode=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_DeliveryMode, ++dm), CG_SCHEMA))!=null)
			if (DeliveryMode.text()!=tva.DELIVERY_MODE_STREAMING)
				errs.pushCode("OD070", `${OnDemandProgram.name()}.${tva.e_DeliveryMode} must be ${tva.DELIVERY_MODE_STREAMING.quote()}`);
		if (--dm>1)
			errs.pushCode("OD071", `only a single ${tva.e_DeliveryMode.elementize()} is permitted in ${OnDemandProgram.name().elementize()}`);
		
		// <Free>
		let fr=0, Free;
		while ((Free=OnDemandProgram.get(xPath(SCHEMA_PREFIX, tva.e_Free, ++fr), CG_SCHEMA))!=null)
			TrueValue(Free, tva.a_value, "OD080", errs);
		if (--fr>1)
			errs.pushCode("OD081", `only a single ${tva.e_Free.elementize()} is permitted in ${OnDemandProgram.name().elementize()}`);
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
			errs.pushCode("SE000", "ValidateScheduleEvents() called with Schedule==null");
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
				 {name: tva.e_Free, minOccurs:0}], 
				false, errs, "SE002");
			
			// <Program>
			let Program=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_Program), CG_SCHEMA);
			if (Program) {
				checkAttributes(Program, [tva.a_crid], [], errs, "SE010" );

				let ProgramCRID=Program.attr(tva.a_crid);
				if (ProgramCRID) {
					if (!isCRIDURI(ProgramCRID.value()))
						errs.pushCode("SE011", `${tva.a_crid.attribute(tva.e_Program)} is not a valid CRID (${ProgramCRID.value()})`);
					if (!isIni(programCRIDs, ProgramCRID.value()))
						errs.pushCode("SE012", `${tva.a_crid.attribute(tva.e_Program)}=${ProgramCRID.value().quote()} does not refer to a program in the ${tva.e_ProgramInformationTable.elementize()}`);
					plCRIDs.push(ProgramCRID.value());
					isCurrentProgram=(ProgramCRID.value()==currentProgramCRID) ;
				}
			}
				
			// <ProgramURL>
			let ProgramURL=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_ProgramURL), CG_SCHEMA);
			if (ProgramURL) 
				if (!patterns.isDVBLocator(ProgramURL.text()))
					errs.pushCode("SE021", `${tva.e_ScheduleEvent}.${tva.e_ProgramURL} (${ProgramURL.text()}) is not a valid DVB locator`);
			
			// <InstanceDescription>
			let InstanceDescription=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_InstanceDescription), CG_SCHEMA);
			if (InstanceDescription) 
				this.ValidateInstanceDescription(CG_SCHEMA, SCHEMA_PREFIX, tva.e_ScheduleEvent, InstanceDescription, isCurrentProgram, seLang, programCRIDs, requestType, errs);
			
			// <PublishedStartTime> and <PublishedDuration>
			let pstElem=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_PublishedStartTime), CG_SCHEMA);
			if (pstElem) {

				if (patterns.isUTCDateTime(pstElem.text())) {
					let PublishedStartTime=new Date(pstElem.text());
					
					if (scheduleStart && (PublishedStartTime < scheduleStart)) 
						errs.pushCode("SE041", `${tva.e_PublishedStartTime.elementize()} (${PublishedStartTime}) is earlier than ${tva.a_start.attribute(tva.e_Schedule)}`);
					if (scheduleEnd && (PublishedStartTime > scheduleEnd)) 
						errs.pushCode("SE042", `${tva.e_PublishedStartTime.elementize()} (${PublishedStartTime}) is after ${tva.a_end.attribute(tva.e_Schedule)}`);

					let pdElem=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_PublishedDuration), CG_SCHEMA);
					if (pdElem && scheduleEnd) {
						let parsedPublishedDuration=parseISOduration(pdElem.text());
						if (parsedPublishedDuration.add(PublishedStartTime) > scheduleEnd) 
							errs.pushCode("SE043", `${tva.e_PublishedStartTime}+${tva.e_PublishedDuration} of event is after ${tva.a_end.attribute(tva.e_Schedule)}`);
					}
				}
				else 
					errs.pushCode("SE049", `${tva.e_PublishedStartTime.elementize()} is not expressed in UTC format (${pstElem.text()})`);
			}
			
			// <ActualStartTime> 
			let astElem=ScheduleEvent.get(xPath(SCHEMA_PREFIX, tva.e_ActualStartTime), CG_SCHEMA);
			if (astElem && !patterns.isUTCDateTime(astElem.text())) 
				errs.pushCode("SE051", `${tva.e_ActualStartTime.elementize()} is not expressed in UTC format (${astElem.text()})`);

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
			errs.pushCode("VS000", "ValidateSchedule() called with Schedule==null");
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
				errs.pushCode("VS012", `${tva.a_start.attribute(Schedule.name())} must be earlier than ${tva.a_end.attribute()}`);
		
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
			errs.pushCode("PL000", "CheckProgramLocation() called with ProgramDescription==null");
			return;
		}
		
		let ProgramLocationTable=ProgramDescription.get(xPath(SCHEMA_PREFIX, tva.e_ProgramLocationTable), CG_SCHEMA);
		if (!ProgramLocationTable) {
			errs.pushCode("PL001", `${tva.e_ProgramLocationTable.elementize()} is not specified`);
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
							errs.pushCode("PL020", `A ${tva.e_Schedule.elementize()} element with ${tva.a_serviceIDRef.attribute()}=${thisServiceIdRef.quote()} is already specified`);
						else 
							foundServiceIds.push(thisServiceIdRef);
					cnt++;
					break;
			}
		});

		if (o && o.childCount!=0) {
			if (o.childCount!=cnt)
				errs.pushCode("PL021", `number of items (${cnt}) in the ${tva.e_ProgramLocationTable.elementize()} does match ${tva.a_numOfItems.attribute(tva.e_GroupInformation)} specified in ${CATEGORY_GROUP_NAME} (${o.childCount})`);
		}

		programCRIDs.forEach(programCRID => {
			if (!isIni(plCRIDs, programCRID))
				errs.pushCode("PL022", `CRID ${programCRID.quote()} specified in ${tva.e_ProgramInformationTable.elementize()} is not specified in ${tva.e_ProgramLocationTable.elementize()}`);		
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
			CG=libxml.parseXmlString(CGtext);
		} catch (err) {
			errs.pushCode("CG000", `XML parsing failed: ${err.message}`);
		}
		if (!CG) return;

		if (!CG.validate(this.TVAschema)) 
			CG.validationErrors.forEach(ve => {
				let s=ve.toString().split('\r');
				s.forEach(err => errs.pushCode("CG001", err, "XSD validation")); 
			});

		if (CG.root().name()!=tva.e_TVAMain) {
			errs.pushCode("CG002", `Root element is not ${tva.e_TVAMain.elementize()}`, "XSD validation");
			return;
		}
		let CG_SCHEMA={}, 
			SCHEMA_PREFIX=CG.root().namespace()?CG.root().namespace().prefix():"", 
			SCHEMA_NAMESPACE=CG.root().namespace()?CG.root().namespace().href():"";
		CG_SCHEMA[SCHEMA_PREFIX]=SCHEMA_NAMESPACE;

		let tvaMainLang=this.GetLanguage(this.knownLanguages, errs, CG.root(), DEFAULT_LANGUAGE, true, "CG003");
		let ProgramDescription=CG.get(xPath(SCHEMA_PREFIX, tva.e_ProgramDescription), CG_SCHEMA);
		if (!ProgramDescription) {
			errs.pushCode("CG004", `No ${tva.e_ProgramDescription.elementize()} element specified.`);
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
				ccheckTopElementsAndCardinality(ProgramDescription, [{name:tva.e_GroupInformationTable}], false, errs, "CG071"); 
				
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
};
