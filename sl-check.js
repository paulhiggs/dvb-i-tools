import { parseXmlString } from "libxmljs2";

import { readFileSync } from "fs";

import { elementize, quote } from './phlib/phlib.js';

import ErrorList, { ERROR, WARNING, APPLICATION } from "./ErrorList.js";
import ClassificationScheme from "./ClassificationScheme.js";

import { dvbi } from "./DVB-I_definitions.js";

import { tva, tvaEA } from "./TVA_definitions.js";
import { isTAGURI } from "./URI_checks.js";
 
import { xPath, xPathM, isIn, unEntity } from "./utils.js";

import { isPostcode, isHTTPURL,isHTTPPathURL, isDomainName, isRTSPURL } from "./pattern_checks.js";

import { IANA_Subtag_Registry, TVA_ContentCS, TVA_FormatCS, DVBI_ContentSubject, ISO3166, DVBI_ServiceListSchema, TVA_PictureFormatCS, DVBI_ServiceTypeCS, DVB_AudioCodecCS, MPEG7_AudioCodingFormatCS, DVB_AudioConformanceCS, DVB_VideoCodecCS, MPEG7_VisualCodingFormatCS, DVB_VideoConformanceCS, MPEG7_AudioPresentationCS, DVBI_RecordingInfoCS } from "./data-locations.js";

import ISOcountries from "./ISOcountries.js";
import IANAlanguages from "./IANAlanguages.js";

import { checkValidLogos } from "./RelatedMaterialChecks.js";
import { sl_InvalidHrefValue } from "./CommonErrors.js";

import { mlLanguage, checkLanguage, checkXMLLangs, GetNodeLanguage } from "./MultilingualElement.js";
import { checkAttributes, SchemaCheck, SchemaLoad } from "./schema_checks.js";

/* TODO:

 - also look for TODO in the code itself
*/

const ANY_NAMESPACE="$%$!!";
const LCN_TABLE_NO_TARGETREGION='unspecifiedRegion', LCN_TABLE_NO_SUBSCRIPTION='unspecifiedPackage';

const SERVICE_LIST_RM="service list";
const SERVICE_RM="service";
const SERVICE_INSTANCE_RM="service instance";
const CONTENT_GUIDE_RM="content guide";

const SCHEMA_v1=1;
const SCHEMA_v2=2;
const SCHEMA_v3=3;
const SCHEMA_v4=4;
const SCHEMA_unknown= -1;

const EXTENSION_LOCATION_SERVICE_LIST_REGISTRY=101,
	  EXTENSION_LOCATION_SERVICE_ELEMENT=201,
	  EXTENSION_LOCATION_DASH_INSTANCE=202,
	  EXTENSION_LOCATION_OTHER_DELIVERY=203;


/** 
 * determines if the identifer provided complies with the requirements for a service identifier
 * at this stage only IETF RFC 4151 TAG URIs are permitted
 *
 * @param {String} identifier  The service identifier
 * @returns {boolean} true if the service identifier complies with the specification otherwise false
 */ 
let validServiceIdentifier = (identifier) => isTAGURI(identifier);

/** 
 * determines if the identifer provided is unique against a list of known identifiers
 *
 * @param {String} identifier  The service identifier
 * @param {Array}  identifiers The list of known service identifiers
 * @returns {boolean} true if the service identifier is unique otherwise false
 */
let uniqueServiceIdentifier = (identifier, identifiers) => !isIn(identifiers, identifier);

/** 
 * determines if the identifer provided refers to a valid application being used with the service
 *
 * @param {String} hrefType  The type of the service application
 * @returns {boolean} true if this is a valid application being used with the service else false
 */
let validServiceControlApplication = (hrefType) => [dvbi.APP_IN_PARALLEL, dvbi.APP_IN_CONTROL].includes(hrefType);

/** 
 * determines if the identifer provided refers to a valid application to be launched when a service is unavailable
 *
 * @param {String} hrefType  The type of the service application
 * @returns {boolean} true if this is a valid application to be launched when a service is unavailable else false
 */
let validServiceUnavailableApplication = (hrefType) => hrefType==dvbi.APP_OUTSIDE_AVAILABILITY;

/** 
 * determines if the identifer provided refers to a valid DASH media type (single MPD or MPD playlist)
 * per A177 clause 5.2.7.2
 * 
 * @param {String} contentType  The contentType for the file
 * @returns {boolean} true if this is a valid MPD or playlist identifier
 */
let validDASHcontentType = (contentType) => [dvbi.CONTENT_TYPE_DASH_MPD, dvbi.CONTENT_TYPE_DVB_PLAYLIST].includes(contentType);

/**
 * Add an error message an incorrect country code is specified in transmission parameters
 *
 * @param {String} value    The invalid country code
 * @param {String} src      The transmission mechanism
 * @param {String} loc      The location of the element
 */
let  InvalidCountryCode = (value, src, loc) => `invalid country code ${value.quote()} for ${src} parameters in ${loc}`;

/**
 * Create a label for the optional language and value provided 
 * @param {XMLnode} pkg 
 * @param {String} lang 
 * @returns {String}
 */
let localizedSubscriptionPackage = (pkg, lang=null) => `${pkg.text()}/lang=${lang?lang:mlLanguage(pkg)}`; 


/**
 * Construct	 an error message an unspecifed target region is used
 *
 * @param {String} region   The unspecified target region
 * @param {String} loc      The location of the element
 * @param {String} errCode  The error code to be reported
 */
let UnspecifiedTargetRegion = (region, loc, errCode) =>
	({code:errCode, 
		message:`${loc} has an unspecified ${dvbi.e_TargetRegion.elementize()} ${region.quote()}`, 
		key:"target region"});



/**
 * Construct an error message for missing <xxxDeliveryParameters>
 *
 * @param {String}  source     The missing source type
 * @param {String}  serviceId  The serviceId whose instance is missing delivery parameters
 * @param {XMLnode} element    The <SourceType> element for which delivery parameters are not specified
 * @param {String}  errCode    The error code to be reported
 */
let NoDeliveryParams = (source, serviceId, element, errCode) => 
	({code:errCode, 
		message:`${source} delivery parameters not specified for service instance in service ${serviceId.quote()}`,
		fragment:element, key:"no delivery params"});




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


export default class ServiceListCheck {

	constructor(useURLs, preloadedLanguageValidator=null, preloadedGenres=null, preloadedCountries=null ) {

		if (preloadedLanguageValidator) 
			this.knownLanguages=preloadedLanguageValidator;
		else {
			this.knownLanguages=new IANAlanguages();
			console.log("loading languages...");
			if (useURLs) 
				this.knownLanguages.loadLanguages({url: IANA_Subtag_Registry.url, purge: true});
			else this.knownLanguages.loadLanguages({file: IANA_Subtag_Registry.file, purge: true});
		}

		if (preloadedGenres) 
			this.allowedGenres=preloadedGenres;
		else {
			this.allowedGenres=new ClassificationScheme();
			console.log("loading Genre classification schemes...");
			this.allowedGenres.loadCS(useURLs?
					{urls:[TVA_ContentCS.url, TVA_FormatCS.url, DVBI_ContentSubject.url]}:
					{files:[TVA_ContentCS.file, TVA_FormatCS.file, DVBI_ContentSubject.file]});
		}

		if (preloadedCountries)
			this.knownCountries=preloadedCountries;
		else {
			this.knownCountries=new ISOcountries(false, true);
			this.knownCountries.loadCountries(useURLs?{url:ISO3166.url}:{file:ISO3166.file});
		}

		this.allowedServiceTypes=new ClassificationScheme();
		this.allowedAudioSchemes=new ClassificationScheme();
		this.allowedVideoSchemes=new ClassificationScheme();
		this.allowedAudioConformancePoints=new ClassificationScheme();
		this.allowedVideoConformancePoints=new ClassificationScheme();
		this.RecordingInfoCSvalues=new ClassificationScheme();
		this.allowedPictureFormats=new ClassificationScheme();
		this.AudioPresentationCSvalues=new ClassificationScheme();

		console.log("loading service list schemas...");
		this.SLschema_v1=parseXmlString(readFileSync(DVBI_ServiceListSchema.v1.file));
		this.SLschema_v2=parseXmlString(readFileSync(DVBI_ServiceListSchema.v2.file));
		this.SLschema_v3=parseXmlString(readFileSync(DVBI_ServiceListSchema.v3.file));
		this.SLschema_v4=parseXmlString(readFileSync(DVBI_ServiceListSchema.v4.file));

		this.loadDataFiles(useURLs);
	}


	/**
	 * loads in the configuration files for the validator, loading the appropriate global variables
	 * 
	 * @param {boolean} useURLs if true then configuration data should be loaded from network locations otherwise, load from local files 
	 */
	/*private*/ loadDataFiles(useURLs) {
		console.log("loading classification schemes...");
		this.allowedPictureFormats.loadCS(useURLs?{url:TVA_PictureFormatCS.url}:{file:TVA_PictureFormatCS.file});
	
		this.allowedServiceTypes.loadCS(useURLs?{url:DVBI_ServiceTypeCS.url}:{file:DVBI_ServiceTypeCS.file} );

		this.allowedAudioSchemes.loadCS(useURLs?
			{urls:[DVB_AudioCodecCS.y2007.url, DVB_AudioCodecCS.y2020.url, MPEG7_AudioCodingFormatCS.url], leafNodesOnly:true} :
			{files:[DVB_AudioCodecCS.y2007.file, DVB_AudioCodecCS.y2020.file, MPEG7_AudioCodingFormatCS.file], leafNodesOnly:true});

		this.allowedAudioConformancePoints.loadCS(useURLs?{url:DVB_AudioConformanceCS.url, leafNodesOnly:true}:{file:DVB_AudioConformanceCS.file, leafNodesOnly:true});
		
		this.allowedVideoSchemes.loadCS(useURLs?
			{urls:[DVB_VideoCodecCS.y2007.url, DVB_VideoCodecCS.y2021.url, MPEG7_VisualCodingFormatCS.url], leafNodesOnly:true} :
			{files:[DVB_VideoCodecCS.y2007.file, DVB_VideoCodecCS.y2021.file, MPEG7_VisualCodingFormatCS.file], leafNodesOnly:true});

		this.allowedVideoConformancePoints.loadCS(useURLs?
			{urls:[DVB_VideoConformanceCS.y2017.url, DVB_VideoConformanceCS.y2017.url], leafNodesOnly:true} :
			{files:[DVB_VideoConformanceCS.y2017.file, DVB_VideoConformanceCS.y2021.file], leafNodesOnly:true});

		this.AudioPresentationCSvalues.loadCS(useURLs?{url:MPEG7_AudioPresentationCS.url} :  {file:MPEG7_AudioPresentationCS.file} );

		this.RecordingInfoCSvalues.loadCS(useURLs?{url:DVBI_RecordingInfoCS.url}:{file:DVBI_RecordingInfoCS.file});		
	}

	/**
	 * determine the schema version (and hence the specificaion version) in use 
	 *
	 * @param {String} namespace  The namespace used in defining the schema
	 * @returns {integer} Representation of the schema version or error code if unknown 
	 */
	/*private*/ SchemaVersion(namespace) {
		if (namespace == dvbi.A177v4_Namespace)
			return SCHEMA_v4;
		if (namespace == dvbi.A177v3_Namespace)
			return SCHEMA_v3;
		if (namespace == dvbi.A177v2_Namespace)
			return SCHEMA_v2;
		if (namespace == dvbi.A177v1_Namespace)
			return SCHEMA_v1;
		
		return SCHEMA_unknown;
	}


	/**
	 * parses the region element, checks the values and adds it and its children (through recursion) to the linear list of region ids
	 *
	 * @param {String}  SL_SCHEMA      Used when constructing Xpath queries
	 * @param {String}  SCHEMA_PREFIX  Used when constructing Xpath queries
	 * @param {XMLnode} Region         The <Region> element to process
	 * @param {integer} depth         The current depth in the hierarchial structure of regions
	 * @param {Array}  knownRegionIDs  The list of region IDs that have been found
	 * @param {Object} errs           The class where errors and warnings relating to the service list processing are stored 
	 */
	/*private*/  addRegion(SL_SCHEMA, SCHEMA_PREFIX, Region, depth, knownRegionIDs, errs) {
		
		if (!Region) {
			errs.addError({type:APPLICATION, code:"AR000", message:"addRegion() called with Region==null"});
			return;
		}
		
		let regionID=Region.attr(dvbi.a_regionID)?Region.attr(dvbi.a_regionID).value():"";
		if (regionID=="")
			regionID="unspecified";
		else {
			if (isIn(knownRegionIDs, regionID)) 
				errs.addError({code:"AR003", message:`Duplicate ${dvbi.a_regionID.attribute()} ${regionID.quote()}`, key:"duplicate regionID", line:Region.line()});
			else knownRegionIDs.push(regionID);
		}
		let countryCodesSpecified=Region.attr(dvbi.a_countryCodes);
		if ((depth!=0) && countryCodesSpecified) 
			errs.addError({code:"AR004", message:`${dvbi.a_countryCodes.attribute(Region.name())} not permitted for sub-region ${regionID.quote()}`, key:"ccode in subRegion", line:Region.line()});

		if (countryCodesSpecified) {
			let countries=countryCodesSpecified.value().split(",");
			if (countries) 
				countries.forEach(country => {
					if (!this.knownCountries.isISO3166code(country)) 
						errs.addError({code:"AR005", message:`invalid country code (${country}) for region ${regionID.quote()}`, key:"invalid country code", line:Region.line()});
				});
		}

		checkXMLLangs(SL_SCHEMA, SCHEMA_PREFIX, dvbi.e_RegionName, `${dvbi.a_regionID.attribute(dvbi.e_Region)}=${regionID.quote()}`, Region, errs, "AR006", this.knownLanguages);
		
		// <Region><Postcode>
		let pc=0, Postcode, PostcodeErrorMessage="invalid postcode";
		while ((Postcode=Region.get(xPath(SCHEMA_PREFIX, dvbi.e_Postcode, ++pc), SL_SCHEMA))!=null) 
			if (!isPostcode(Postcode.text()))
				errs.addError({code:"AR011", message:`${Postcode.text().quote()} is not a valid postcode`, key:PostcodeErrorMessage, fragment:Postcode});
		
		if (depth > dvbi.MAX_SUBREGION_LEVELS) 
			errs.addError({code:"AR007", message:`${dvbi.e_Region.elementize()} depth exceeded (>${dvbi.MAX_SUBREGION_LEVELS}) for sub-region ${regionID.quote()}`, key:"region depth exceeded", line:Region.line()});

		let rc=0, RegionChild;
		while ((RegionChild=Region.get(xPath(SCHEMA_PREFIX, dvbi.e_Region, ++rc), SL_SCHEMA))!=null) 
			this.addRegion(SL_SCHEMA, SCHEMA_PREFIX, RegionChild, depth+1, knownRegionIDs, errs);
	}


	/**
	 * looks for the {index, value} pair within the array of permitted values
	 *
	 * @param {array} permittedValues  array of allowed value pairs {ver: , val:}
	 * @param {any}   version          value to match with ver: in the allowed values or ANY_NAMESPACE
	 * @param {any}   value            value to match with val: in the allowed values
	 * @returns {boolean} true if {index, value} pair exists in the list of allowed values when namespace is specific or if any val: equals value with namespace is ANY_NAMESPACE, else false
	 */
	/*private*/  match(permittedValues, version, value) {
		if (value && permittedValues) {
			if (version==ANY_NAMESPACE) 
				return permittedValues.find(elem => elem.value==value)!=undefined;
			else {
				let i=permittedValues.find(elem => elem.ver==version);
				return i && i.val==value;
			}
		}
		return false;
	} 
	

	/** 
	 * determines if the identifer provided refers to a valid banner for out-of-servce-hours presentation
	 *
	 * @param {XMLnode} HowRelated  The banner identifier
	 * @param {String}  namespace   The namespace being used in the XML document
	 * @returns {boolean} true if this is a valid banner for out-of-servce-hours presentation else false
	 */
	/*private*/  validOutScheduleHours(HowRelated, namespace) {
		// return true if val is a valid CS value for Out of Service Banners (A177 5.2.5.3)
		return this.match([ 
			{ver: SCHEMA_v1, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v1 },
			{ver: SCHEMA_v2, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v2 },
			{ver: SCHEMA_v3, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v2 },
			{ver: SCHEMA_v4, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v3 }
			], this.SchemaVersion(namespace), HowRelated.attr(dvbi.a_href)?HowRelated.attr(dvbi.a_href).value():null) ;
	}


	/** 
	 * determines if the identifer provided refers to a valid banner for content-finished presentation
	 *
	 * @since DVB A177v2
	 * @param {XMLnode} HowRelated  The banner identifier
	 * @param {String}  namespace   The namespace being used in the XML document
	 * @returns {boolean} true if this is a valid banner for content-finished presentation else false
	 */
	/*private*/  validContentFinishedBanner(HowRelated, namespace) {
		// return true if val is a valid CS value for Content Finished Banner (A177 5.2.7.3)
		return this.match([ 
			{ver: SCHEMA_v2, val: dvbi.BANNER_CONTENT_FINISHED_v2 },
			{ver: SCHEMA_v3, val: dvbi.BANNER_CONTENT_FINISHED_v2 },
			{ver: SCHEMA_v4, val: dvbi.BANNER_CONTENT_FINISHED_v3 }
			], namespace==ANY_NAMESPACE?namespace:this.SchemaVersion(namespace), HowRelated.attr(dvbi.a_href)?HowRelated.attr(dvbi.a_href).value():null);
	}


	/** 
	 * determines if the identifer provided refers to a valid service list logo
	 *
	 * @param {XMLnode} HowRelated  The logo identifier
	 * @param {String}  namespace   The namespace being used in the XML document
	 * @returns {boolean} true if this is a valid logo for a service list else false
	 */
	/*private*/  validServiceListLogo(HowRelated, namespace) {
		// return true if HowRelated@href is a valid CS value Service List Logo (A177 5.2.6.1)
		return this.match([ 
			{ver: SCHEMA_v1, val: dvbi.LOGO_SERVICE_LIST_v1},
			{ver: SCHEMA_v2, val: dvbi.LOGO_SERVICE_LIST_v2},
			{ver: SCHEMA_v3, val: dvbi.LOGO_SERVICE_LIST_v2},
			{ver: SCHEMA_v4, val: dvbi.LOGO_SERVICE_LIST_v3}
			], this.SchemaVersion(namespace), HowRelated.attr(dvbi.a_href)?HowRelated.attr(dvbi.a_href).value():null);
	}


	/** 
	 * determines if the identifer provided refers to a valid service logo
	 *
	 * @param {XMLnode} HowRelated  The logo identifier
	 * @param {String}  namespace   The namespace being used in the XML document
	 * @returns {boolean} true if this is a valid logo for a service  else false
	 */
	/*private*/  validServiceLogo(HowRelated, namespace) {
		// return true if val is a valid CS value Service Logo (A177 5.2.6.2)
		return this.match([
			{ver: SCHEMA_v1, val: dvbi.LOGO_SERVICE_v1},
			{ver: SCHEMA_v2, val: dvbi.LOGO_SERVICE_v2},
			{ver: SCHEMA_v3, val: dvbi.LOGO_SERVICE_v2},
			{ver: SCHEMA_v4, val: dvbi.LOGO_SERVICE_v3}
			], this.SchemaVersion(namespace), HowRelated.attr(dvbi.a_href)?HowRelated.attr(dvbi.a_href).value():null);
	}


	/** 
	 * determines if the identifer provided refers to a valid service banner
	 *
	 * @param {XMLnode} HowRelated  The logo identifier
	 * @param {String}  namespace   The namespace being used in the XML document
	 * @returns {boolean} true if this is a valid banner for a service  else false
	 */
	/*private*/  validServiceBanner(HowRelated, namespace) {
		// return true if val is a valid CS value Service Banner (A177 5.2.6.x)
		return this.match([
			{ver: SCHEMA_v4, val: dvbi.SERVICE_BANNER_v4}
			], this.SchemaVersion(namespace), HowRelated.attr(dvbi.a_href)?HowRelated.attr(dvbi.a_href).value():null);
	}


	/** 
	 * determines if the identifer provided refers to a valid content guide source logo
	 *
	 * @param {XMLnode} HowRelated  The logo identifier
	 * @param {String}  namespace   The namespace being used in the XML document
	 * @returns {boolean} true if this is a valid logo for a content guide source else false
	 */
	/*private*/  validContentGuideSourceLogo(HowRelated, namespace) {
		// return true if val is a valid CS value Service Logo (A177 5.2.6.3)
		return this.match([
			{ver: SCHEMA_v1, val: dvbi.LOGO_CG_PROVIDER_v1},
			{ver: SCHEMA_v2, val: dvbi.LOGO_CG_PROVIDER_v2},
			{ver: SCHEMA_v3, val: dvbi.LOGO_CG_PROVIDER_v2},
			{ver: SCHEMA_v4, val: dvbi.LOGO_CG_PROVIDER_v3}
			], this.SchemaVersion(namespace), HowRelated.attr(dvbi.a_href)?HowRelated.attr(dvbi.a_href).value():null);
	}



	/**
	 * verifies if the specified application is valid according to specification
	 *
	 * @param {XMLnode} MediaLocator  The <MediaLocator> subelement (a libxmls ojbect tree) of the <RelatedMaterial> element
	 * @param {Object}  errs          The class where errors and warnings relating to the service list processing are stored 
	 * @param {string}  Location      The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
	 */
	/*private*/  checkSignalledApplication(MediaLocator, errs, Location) {
		
		const validApplicationTypes=[dvbi.XML_AIT_CONTENT_TYPE, dvbi.HTML5_APP, dvbi.XHTML_APP];
		
		if (!MediaLocator) 
			errs.addError({code:"SA001", 
					message:`${tva.e_MediaLocator.elementize()} not specified for application ${tva.e_RelatedMaterialr.elementize()} in ${Location}`, 
					key:`no ${tva.e_MediaUri}`});
		else {
			let subElems=MediaLocator.childNodes(), hasMediaURI=false;
			if (subElems) subElems.forEachSubElement(child => {
				if (child.name()==tva.e_MediaUri) {
					hasMediaURI=true;
					if (child.attr(tva.a_contentType) && !isIn(validApplicationTypes, child.attr(tva.a_contentType).value())) 
						errs.addError({type:WARNING, code:"SA003", 
							message:`${tva.a_contentType.attribute()} ${child.attr(tva.a_contentType).value().quote()} is not DVB AIT for ${tva.e_RelatedMaterial.elementize()}${tva.e_MediaLocator.elementize()} in ${Location}`, 
							fragment:child, key:`invalid ${tva.a_contentType.attribute(tva.e_MediaUri)}`});
					if (!isHTTPURL(child.text())) 
						errs.addError({code:"SA004", message:`invalid URL ${child.text().quote()} specified for ${child.name().elementize()}`, 
										fragment:child, key:"invalid resource URL"});
				}
			});
			if (!hasMediaURI) 
				errs.addError({code:"SA005", 
					message:`${tva.e_MediaUri.elementize()} not specified for application ${tva.e_MediaLocator.elementize()} in ${Location}`, 
					fragment:MediaLocator, key:`no ${tva.e_MediaUri}`});
		}
	}


	/** 
	 * determines if the identifer provided refers to a valid application launching method
	 *
	 * @param {XMLnode} HowRelated  The service identifier
	 * @returns {boolean} true if this is a valid application launching method else false
	 */
	/*private*/  validServiceApplication(HowRelated) {
		// return true if the HowRelated element has a 	valid CS value for Service Related Applications (A177 5.2.3)
		// urn:dvb:metadata:cs:LinkedApplicationCS:2019
		if (!HowRelated) return false;
		let val=HowRelated.attr(dvbi.a_href)?HowRelated.attr(dvbi.a_href).value():null;
		if (!val) return false;
		return validServiceControlApplication(val) || validServiceUnavailableApplication(val);
	}


	/**
	 * verifies if the specified RelatedMaterial element is valid according to specification (contents and location)
	 *
	 * @param {XMLnode} RelatedMaterial   The <RelatedMaterial> element (a libxmls ojbect tree) to be checked
	 * @param {Object}  errs              The class where errors and warnings relating to the service list processing are stored 
	 * @param {string}  Location          The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
	 * @param {string}  LocationType      The type of element containing the <RelatedMaterial> element. Different validation rules apply to different location types
	 * @param {string}  SCHEMA_NAMESPACE  The namespace of XML document
	 * @param {string}  errCode			  The prefix to use for any errors found
	 * @returns {string} an href value if valid, else ""
	 */
	/*private*/  validateRelatedMaterial(RelatedMaterial, errs, Location, LocationType, SCHEMA_NAMESPACE, errCode) {
		let rc="";
		if (!RelatedMaterial) {
			errs.addError({type:APPLICATION, code:"RM000", message:"validateRelatedMaterial() called with RelatedMaterial==null", key:"invalid args"});
			return rc;
		}
		
		let HowRelated=null, MediaLocator=[];
		let elems=RelatedMaterial.childNodes();
		if (elems) elems.forEachSubElement(elem => {
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
			errs.addError({code:`${errCode}-1`, 
							message:`${tva.e_HowRelated.elementize()} not specified for ${tva.e_RelatedMaterial.elementize()} in ${Location}`, 
							line:RelatedMaterial.line(), key:`no ${tva.e_HowRelated}`});
			return rc;
		}

		checkAttributes(HowRelated, [dvbi.a_href], [], tvaEA.HowRelated, errs, `${errCode}-2`);

		if (HowRelated.attr(dvbi.a_href)) {	
			switch (LocationType) {
				case SERVICE_LIST_RM:
					if (this.validServiceListLogo(HowRelated, SCHEMA_NAMESPACE)) {
						rc=HowRelated.attr(dvbi.a_href).value();
						checkValidLogos(RelatedMaterial, errs, `${errCode}-10`, Location, this.knownLanguages);
					}
					else
						errs.addError(sl_InvalidHrefValue(HowRelated.attr(dvbi.a_href).value(), HowRelated, tva.e_RelatedMaterial.elementize(), Location, `${errCode}-11`));
					break;
				case SERVICE_RM:
					if (this.validContentFinishedBanner(HowRelated, ANY_NAMESPACE) && (this.SchemaVersion(SCHEMA_NAMESPACE)==SCHEMA_v1)) 
						errs.addError({code:`${errCode}-21`,
							message:`${HowRelated.attr(dvbi.href).value().quote()} not permitted for ${SCHEMA_NAMESPACE.quote()} in ${Location}`, key:"invalid CS value", fragment:HowRelated});
			
					if (this.validOutScheduleHours(HowRelated, SCHEMA_NAMESPACE) || this.validContentFinishedBanner(HowRelated, SCHEMA_NAMESPACE) || 
						this.validServiceLogo(HowRelated, SCHEMA_NAMESPACE) || this.validServiceBanner(HowRelated, SCHEMA_NAMESPACE)) {
						rc=HowRelated.attr(dvbi.a_href).value();

						checkValidLogos(RelatedMaterial, errs, `${errCode}-22`, Location, this.knownLanguages);
					}
					else if (this.validServiceApplication(HowRelated)) {
						rc=HowRelated.attr(dvbi.a_href).value();
						MediaLocator.forEach(locator =>
								this.checkSignalledApplication(locator, errs, Location));
					}
					else 
						errs.addError(sl_InvalidHrefValue(HowRelated.attr(dvbi.a_href).value(), HowRelated, tva.e_RelatedMaterial.elementize(), Location, `${errCode}-24`));
				break;
				case SERVICE_INSTANCE_RM:
					if (this.validContentFinishedBanner(HowRelated, ANY_NAMESPACE) && (this.SchemaVersion(SCHEMA_NAMESPACE)==SCHEMA_v1)) 
						errs.addError({code:`${errCode}-31`,
							message:`${HowRelated.attr(dvbi.href).value().quote()} not permitted for ${SCHEMA_NAMESPACE.quote()} in ${Location}`, key:"invalid CS value", fragment:HowRelated});
					
					if (this.validOutScheduleHours(HowRelated, SCHEMA_NAMESPACE) || this.validContentFinishedBanner(HowRelated, SCHEMA_NAMESPACE) ||  this.validServiceLogo(HowRelated, SCHEMA_NAMESPACE)) {
						rc=HowRelated.attr(dvbi.a_href).value();

						checkValidLogos(RelatedMaterial, errs, `${errCode}-32`, Location, this.knownLanguages);
					}
					else if (this.validServiceBanner(HowRelated, SCHEMA_NAMESPACE)) {
						errs.addError({code:`${errCode}-33`,
							message:'Service Banner is not permitted in a Service Instance', key:'misplaced image type', fragment:HowRelated});
					}
					else if (this.validServiceApplication(HowRelated)) {
						rc=HowRelated.attr(dvbi.a_href).value();
						MediaLocator.forEach(locator =>
								this.checkSignalledApplication(locator, errs, Location));
					}
					else 
						errs.addError(sl_InvalidHrefValue(HowRelated.attr(dvbi.a_href).value(), HowRelated, tva.e_RelatedMaterial.elementize(), Location, `${errCode}-24`));
					break;
				case CONTENT_GUIDE_RM:
					if (this.validContentGuideSourceLogo(HowRelated, SCHEMA_NAMESPACE)) {
						rc=HowRelated.attr(dvbi.a_href).value();
						checkValidLogos(RelatedMaterial, errs, `${errCode}-41`, Location, this.knownLanguages);
					}
					else
						errs.addError(sl_InvalidHrefValue(HowRelated.attr(dvbi.a_href).value(), HowRelated, tva.e_RelatedMaterial.elementize(), Location, `${errCode}-42`));
					break;
			}
		}
		return rc;
	}


	/**
	 * check if the node provided contains an RelatedMaterial element for a signalled application
	 *
	 * @param {string}  SL_SCHEMA      Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX  Used when constructing Xpath queries
	 * @param {XMLnode} node           The XML tree node (either a <Service> or a <ServiceInstance>) to be checked
	 * @returns {boolean} true if the node contains a <RelatedMaterial> element which signals an application else false
	 */
	/*private*/  hasSignalledApplication(SL_SCHEMA, SCHEMA_PREFIX, node) {
		if (node) {
			let i=0, elem;
			while ((elem=node.get(xPath(SCHEMA_PREFIX, tva.e_RelatedMaterial, ++i), SL_SCHEMA))!=null) {
				let hr=elem.get(xPath(SCHEMA_PREFIX, tva.e_HowRelated), SL_SCHEMA);
				if (hr && this.validServiceApplication(hr)) 
					return true;			
			}
		}
		return false;
	}


	/**
	 * perform any validation on a ContentTypeSourceType element
	 * 
	 * @param {string}  SL_SCHEMA         Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX     Used when constructing Xpath queries
	 * @param {string}  SCHEMA_NAMESPACE  The namespace of XML document
	 * @param {XMLnode} source            The node of the element to check
	 * @param {Class}   errs              Errors found in validaton
	 * @param {object}  loc			      The 'location' in the XML document of the element being checked, if unspecified then this is set to be the name of the parent element
	 * @param {string}  errCode           Error code prefix to be used in reports
	 */
	/*private*/  validateAContentGuideSource(SL_SCHEMA, SCHEMA_PREFIX, SCHEMA_NAMESPACE, source, errs, loc, errCode) {

		let NotURLMessage = (errCode, elem, frag) => ({code:`${errCode}`, message:`${elem} is not a valid URL path`, fragment:frag, key:"not URL path"});
		if (!source) {
			errs.addError({type:APPLICATION,code:"GS000", message:"validateAContentGuideSource() called with source==null"});
			return;
		}
		loc=loc?loc:source.parent().name().elementize();
		
		checkXMLLangs(SL_SCHEMA, SCHEMA_PREFIX, dvbi.e_Name, loc, source, errs, `${errCode}-1`, this.knownLanguages);
		checkXMLLangs(SL_SCHEMA, SCHEMA_PREFIX, dvbi.e_ProviderName, loc, source, errs, `${errCode}-2`, this.knownLanguages);
		
		let rm=0, RelatedMaterial;
		while ((RelatedMaterial=source.get(xPath(SCHEMA_PREFIX, tva.e_RelatedMaterial, ++rm), SL_SCHEMA))!=null) 
			this.validateRelatedMaterial(RelatedMaterial, errs, loc, CONTENT_GUIDE_RM, SCHEMA_NAMESPACE, `${errCode}-3`);
		
		// ContentGuideSourceType::ScheduleInfoEndpoint - should be a URL
		let sie=source.get(xPath(SCHEMA_PREFIX, dvbi.e_ScheduleInfoEndpoint), SL_SCHEMA);
		if (sie && !isHTTPPathURL(sie.text()))
			errs.addError(NotURLMessage(`${errCode}-4`,dvbi.e_ScheduleInfoEndpoint.elementize(), sie));
		
		// ContentGuideSourceType::ProgramInfoEndpoint - should be a URL
		let pie=source.get(xPath(SCHEMA_PREFIX, dvbi.e_ProgramInfoEndpoint), SL_SCHEMA);
		if (pie && !isHTTPPathURL(pie.text()))
			errs.addError(NotURLMessage(`${errCode}-5`, dvbi.e_ProgramInfoEndpoint.elementize(), pie));
		
		// ContentGuideSourceType::GroupInfoEndpoint - should be a URL
		let gie=source.get(xPath(SCHEMA_PREFIX, dvbi.e_GroupInfoEndpoint), SL_SCHEMA);
		if (gie && !isHTTPPathURL(gie.text()))
			errs.addError(NotURLMessage(`${errCode}-6`, dvbi.e_GroupInfoEndpoint.elementize(), gie));
		
		// ContentGuideSourceType::MoreEpisodesEndpoint - should be a URL
		let mee=source.get(xPath(SCHEMA_PREFIX, dvbi.e_MoreEpisodesEndpoint), SL_SCHEMA);
		if (mee && !isHTTPPathURL(mee.text()))
			errs.addError(NotURLMessage(`${errCode}-7`, dvbi.e_MoreEpisodesEndpoint.elementize(), mee));
	}	
	

	/**
	 * validate the language specified record any errors
	 *
	 * @param {object}  validator  the validation class to use
	 * @param {Class}   errs       errors found in validaton
	 * @param {XMLnode} node       the XML node whose @lang attribute should be checked
	 * @param {string}  parentLang the language of the XML element which is the parent of node
	 * @param {boolean} isRequired report an error if @lang is not explicitly stated
	 * @param {string}  errCode    error number to use instead of local values
	 * @returns {string} the @lang attribute of the node element of the parentLang if it does not exist of is not specified
	 */
	/* private */  GetLanguage(validator, errs, node, parentLang, isRequired, errCode) {
		if (!node) 
			return parentLang;
		if (!node.attr(tva.a_lang) && isRequired) {
			errs.addError({code:errCode, message:`${tva.a_lang.attribute()} is required for ${node.name().quote()}`, key:"unspecified language", line:node.line()});
			return parentLang;		
		}

		if (!node.attr(tva.a_lang))
			return parentLang;
		
		let localLang=node.attr(tva.a_lang).value();
		if (validator && localLang)
			checkLanguage(validator, localLang, node.name(), node, errs, errCode);
		return localLang;	
	}

	/**
	 * validate the SynopsisType elements 
	 *
	 * @param {string}  SCHEMA              Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX       Used when constructing Xpath queries
	 * @param {XMLnode} Element             the element whose children should be checked
	 * @param {string}  ElementName		    the name of the child element to be checked
	 * @param {array}   requiredLengths	    @length attributes that are required to be present
	 * @param {array}   optionalLengths	    @length attributes that can optionally be present
	 * @param {string}  parentLanguage	    the xml:lang of the parent element
	 * @param {Class}   errs                errors found in validaton
	 * @param {string}  errCode             error code prefix to be used in reports
	 */
	/*private*/  ValidateSynopsisType(SCHEMA, SCHEMA_PREFIX, Element, ElementName, requiredLengths, optionalLengths, parentLanguage, errs, errCode) {

		if (!Element) {
			errs.addError({type:APPLICATION, code:"SY000", message:"ValidateSynopsisType() called with Element==null"});
			return;
		}

		let synopsisLengthError = (elem, label, length) => `length of ${elementize(`${tva.a_length.attribute(elem)}=${label.quote()}`)} exceeds ${length} characters`; 
		let synopsisToShortError = (elem, label, length) => `length of ${elementize(`${tva.a_length.attribute(elem)}=${label.quote()}`)} is less than ${length} characters`; 
		let singleLengthLangError = (elem, length, lang) => `only a single ${elem.elementize()} is permitted per length (${length}) and language (${lang})`; 
		let requiredSynopsisError = (elem, length) => `a ${elem.elementize()} element with ${tva.a_length.attribute()}=${quote(length)} is required`; 

		let s=0, ste, hasBrief=false, hasShort=false, hasMedium=false, hasLong=false, hasExtended=false;
		let briefLangs=[], shortLangs=[], mediumLangs=[], longLangs=[], extendedLangs=[];
		let ERROR_KEY="synopsis";
		while ((ste=Element.get(xPath(SCHEMA_PREFIX, ElementName, ++s), SCHEMA))!=null) {
			
			let synopsisLang=this.GetLanguage(this.knownLanguages, errs, ste, parentLanguage, false, `${errCode}-2`);
			let synopsisLength=ste.attr(tva.a_length)?ste.attr(tva.a_length).value():null;
			
			if (synopsisLength) {
				let cleanSynopsisLength=unEntity(ste.text()).length;  // replace ENTITY strings with a generic character
				if (isIn(requiredLengths, synopsisLength) || isIn(optionalLengths, synopsisLength)) {
					switch (synopsisLength) {
						case tva.SYNOPSIS_BRIEF_LABEL:
							if (cleanSynopsisLength > tva.SYNOPSIS_BRIEF_LENGTH)
								errs.addError({code:`${errCode}-10`, message:synopsisLengthError(ElementName, tva.SYNOPSIS_BRIEF_LABEL, tva.SYNOPSIS_BRIEF_LENGTH), 
										fragment:ste, key:ERROR_KEY});
							hasBrief=true;
							break;
						case tva.SYNOPSIS_SHORT_LABEL:
							if (cleanSynopsisLength > tva.SYNOPSIS_SHORT_LENGTH)
								errs.addError({code:`${errCode}-11`, message:synopsisLengthError(ElementName, tva.SYNOPSIS_SHORT_LABEL, tva.SYNOPSIS_SHORT_LENGTH), 
										fragment:ste, key:ERROR_KEY});
							hasShort=true;
							break;
						case tva.SYNOPSIS_MEDIUM_LABEL:
							if (cleanSynopsisLength > tva.SYNOPSIS_MEDIUM_LENGTH)
								errs.addError({code:`${errCode}-12`, message:synopsisLengthError(ElementName, tva.SYNOPSIS_MEDIUM_LABEL, tva.SYNOPSIS_MEDIUM_LENGTH), 
										fragment:ste, key:ERROR_KEY});
							hasMedium=true;
							break;
						case tva.SYNOPSIS_LONG_LABEL:
							if (cleanSynopsisLength > tva.SYNOPSIS_LONG_LENGTH)
								errs.addError({code:`${errCode}-13`, message:synopsisLengthError(ElementName, tva.SYNOPSIS_LONG_LABEL, tva.SYNOPSIS_LONG_LENGTH), 
										fragment:ste, key:ERROR_KEY});
							hasLong=true;
							break;						
						case tva.SYNOPSIS_EXTENDED_LABEL:
							if (cleanSynopsisLength < tva.SYNOPSIS_LONG_LENGTH)
								errs.addError({code:`${errCode}-14`, message:synopsisToShortError(ElementName, tva.SYNOPSIS_EXTENDED_LABEL, tva.SYNOPSIS_LONG_LENGTH), 
										fragment:ste, key:ERROR_KEY});
							hasExtended=true;
							break;
					}
				}
				else
					errs.addError({code:`${errCode}-15`, message:`${tva.a_length.attribute()}=${synopsisLength.quote()} is not permitted in ${ElementName.elementize()}`, 
									fragment:ste, key:ERROR_KEY});
			}
		
			if (synopsisLang && synopsisLength) 
				switch (synopsisLength) {
					case tva.SYNOPSIS_BRIEF_LABEL:
						if (isIn(briefLangs, synopsisLang)) 
							errs.addError({code:`${errCode}-21`, message:singleLengthLangError(ElementName, synopsisLength, synopsisLang), 
									fragment:ste, key:ERROR_KEY});
						else briefLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_SHORT_LABEL:
						if (isIn(shortLangs, synopsisLang)) 
							errs.addError({code:`${errCode}-22`, message:singleLengthLangError(ElementName, synopsisLength, synopsisLang), 
									fragment:ste, key:ERROR_KEY});
						else shortLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_MEDIUM_LABEL:
						if (isIn(mediumLangs, synopsisLang)) 
							errs.addError({code:`${errCode}-23`, message:singleLengthLangError(ElementName, synopsisLength, synopsisLang), 
									fragment:ste, key:ERROR_KEY});
						else mediumLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_LONG_LABEL:
						if (isIn(longLangs, synopsisLang)) 
							errs.addError({code:`${errCode}-24`, message:singleLengthLangError(ElementName, synopsisLength, synopsisLang), 
									fragment:ste, key:ERROR_KEY});
						else longLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_EXTENDED_LABEL:
						if (isIn(extendedLangs, synopsisLang)) 
							errs.addError({code:`${errCode}-25`, message:singleLengthLangError(ElementName, synopsisLength, synopsisLang), 
									fragment:ste, key:ERROR_KEY});
						else extendedLangs.push(synopsisLang);
						break;
				}
		}
		
		if (isIn(requiredLengths, tva.SYNOPSIS_BRIEF_LABEL) && !hasBrief)
			errs.addError({code:`${errCode}-31`, message:requiredSynopsisError(tva.SYNOPSIS_BRIEF_LABEL), fragment:Element, key:ERROR_KEY});	
		if (isIn(requiredLengths, tva.SYNOPSIS_SHORT_LABEL) && !hasShort)
			errs.addError({code:`${errCode}-32`, message:requiredSynopsisError(tva.SYNOPSIS_SHORT_LABEL), fragment:Element, key:ERROR_KEY});	
		if (isIn(requiredLengths, tva.SYNOPSIS_MEDIUM_LABEL) && !hasMedium)
			errs.addError({code:`${errCode}-33`, message:requiredSynopsisError(tva.SYNOPSIS_MEDIUM_LABEL), fragment:Element, key:ERROR_KEY});	
		if (isIn(requiredLengths, tva.SYNOPSIS_LONG_LABEL) && !hasLong)
			errs.addError({code:`${errCode}-34`, message:requiredSynopsisError(tva.SYNOPSIS_LONG_LABEL), fragment:Element, key:ERROR_KEY});
		if (isIn(requiredLengths, tva.SYNOPSIS_EXTENDED_LABEL) && !hasExtended)
			errs.addError({code:`${errCode}-35`, message:requiredSynopsisError(tva.SYNOPSIS_EXTENDED_LABEL), fragment:Element, key:ERROR_KEY});	
	}


	/**
	 * validate a ServiceInstance element
	 *
	 * @param {string}  SL_SCHEMA             Used when constructing Xpath queries
	 * @param {string}  SCHEMA_PREFIX         Used when constructing Xpath queries
	 * @param {string}  SCHEMA_NAMESPACE      The namespace of XML document 
	 * @param {XMLnode} ServiceInstance       the service instance element to check
	 * @param {string}  thisServiceId         the identifier of the service 
	 * @param {array}   subscriptionPackages  the subscription packages reported in the service list
	 * @param {Class}   errs                  errors found in validaton
	 */
	/*private*/  validateServiceInstance(SL_SCHEMA, SCHEMA_PREFIX, SCHEMA_NAMESPACE, ServiceInstance, thisServiceId, subscriptionPackages, errs) {
		if (!ServiceInstance) {
			errs.addError({type:APPLICATION, code:"SI000", key:"validateServiceInstance() called with ServiceInstance==null"});
			return;
		}

		function checkMulticastDeliveryParams(params, errs, errCode) {
			let IPMulticastAddress=params.get(xPath(SCHEMA_PREFIX, dvbi.e_IPMulticastAddress), SL_SCHEMA);
			if (IPMulticastAddress) {
				let CNAME=IPMulticastAddress.get(xPath(SCHEMA_PREFIX, dvbi.e_CNAME), SL_SCHEMA);
				if (CNAME && !isDomainName(CNAME.text()))
					errs.addError({code:`${errCode}-1`, message:`${dvbi.e_IPMulticastAddress.elementize()}${dvbi.e_CNAME.elementize()} is not a valid domain name for use as a CNAME`, 
							fragment:CNAME, key:"invalid CNAME"});
			}
		}

		//<ServiceInstance><DisplayName>
		checkXMLLangs(SL_SCHEMA, SCHEMA_PREFIX, dvbi.e_DisplayName, `service instance in service=${thisServiceId.quote()}`, ServiceInstance, errs, "SI010", this.knownLanguages);

		// check @href of <ServiceInstance><RelatedMaterial>
		let rm=0, controlApps=[], RelatedMaterial;
		while ((RelatedMaterial=ServiceInstance.get(xPath(SCHEMA_PREFIX, tva.e_RelatedMaterial, ++rm), SL_SCHEMA))!=null) {
			let foundHref=this.validateRelatedMaterial(RelatedMaterial, errs, `service instance of ${thisServiceId.quote()}`, SERVICE_INSTANCE_RM, SCHEMA_NAMESPACE, "SI020");
			if (foundHref!="" && validServiceControlApplication(foundHref)) 
				controlApps.push(RelatedMaterial);
		}
		if (controlApps.length>1)
			controlApps.forEach(app => {
				errs.addError({code:"SI021", message:"only a single service control application can be signalled in a service instance", fragment:app, key:"multi apps"});
			});

		// <ServiceInstance><ContentProtection>

		// <ServiceInstance><ContentAttributes>
		let ContentAttributes=ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_ContentAttributes), SL_SCHEMA);
		if (ContentAttributes) {

			// Check ContentAttributes/AudioAttributes - other subelements are checked with schema based validation
			let cp=0, conf;
			while ((conf=ContentAttributes.get(xPath(SCHEMA_PREFIX, tva.e_AudioAttributes, ++cp), SL_SCHEMA))!=null) 
				/* jshint -W083 */
				if (conf.childNodes()) conf.childNodes().forEachSubElement(child => {
					switch (child.name()) {
						case tva.e_Coding:
							if (child.attr(dvbi.a_href) && !this.allowedAudioSchemes.isIn(child.attr(dvbi.a_href).value())) 
								errs.addError({code:"SI052", message:`invalid ${dvbi.a_href.attribute(child.name())} value for (${child.attr(dvbi.a_href).value()})`, 
										fragment:child, key:"audio codec"});
							break;
						case tva.e_MixType:
							// taken from MPEG-7 AudioPresentationCS
							if (child.attr(dvbi.a_href) && !this.AudioPresentationCSvalues.isIn(child.attr(dvbi.a_href).value())) 
								errs.addError({code:"SI055", message:`invalid ${dvbi.a_href.attribute(child.name())} value for (${child.attr(dvbi.a_href).value()})`, 
										fragment:child, key:"audio codec"});
							break;
					}
				});
				/* jshint +W083 */

			// Check @href of ContentAttributes/AudioConformancePoints
			cp=0;
			while ((conf=ContentAttributes.get(xPath(SCHEMA_PREFIX, dvbi.e_AudioConformancePoint, ++cp), SL_SCHEMA))!=null) 
				if (conf.attr(dvbi.a_href) && !this.allowedAudioConformancePoints.isIn(conf.attr(dvbi.a_href).value())) 
					errs.addError({code:"SI061", message:`invalid ${dvbi.a_href.attribute(dvbi.e_AudioConformancePoint)} (${conf.attr(dvbi.a_href).value()})`, 
							fragment:conf, key:"audio conf point"});

			// Check ContentAttributes/VideoAttributes - other subelements are checked with schema based validation
			cp=0;
			while ((conf=ContentAttributes.get(xPath(SCHEMA_PREFIX, tva.e_VideoAttributes, ++cp), SL_SCHEMA))!=null) 
				/* jshint -W083 */
				if (conf.childNodes()) conf.childNodes().forEachSubElement(child => {
					switch (child.name()) {
						case tva.e_Coding:
							if (child.attr(dvbi.a_href) && !this.allowedVideoSchemes.isIn(child.attr(dvbi.a_href).value())) 
								errs.addError({code:"SI072", message:`invalid ${dvbi.a_href.attribute(tva.e_Coding)} (${child.attr(dvbi.a_href).value()})`, 
											fragment:child, key:"video codec"});
							break;
						case tva.e_PictureFormat:
							if (child.attr(dvbi.a_href) && !this.allowedPictureFormats.isIn(child.attr(dvbi.a_href).value())) 
								errs.addError({code:"SI082", message:`invalid ${dvbi.a_href.attribute(tva.e_PictureFormat)} value (${child.attr(dvbi.a_href).value()})`, 
											fragment:child, key:tva.e_PictureFormat});
							break;
						case dvbi.e_Colorimetry:
							if (child.attr(dvbi.a_href) && !isIn(dvbi.ALLOWED_COLORIMETRY, child.attr(dvbi.a_href).value())) 
								errs.addError({code:"SI084", message:`invalid ${dvbi.a_href.attribute(dvbi.e_Colorimetry)} value (${child.attr(dvbi.a_href).value()})`, 
											fragment:child, key:dvbi.e_Colorimetry});
							break;
					}
				});
				/* jshint +W083 */

			// Check @href of ContentAttributes/VideoConformancePoints
			cp=0;
			while ((conf=ContentAttributes.get(xPath(SCHEMA_PREFIX, dvbi.e_VideoConformancePoint, ++cp), SL_SCHEMA))!=null) 
				if (conf.attr(dvbi.a_href) && !this.allowedVideoConformancePoints.isIn(conf.attr(dvbi.a_href).value())) 
					errs.addError({code:"SI091", message:`invalid ${dvbi.a_href.attribute(dvbi.e_VideoConformancePoint)} value (${conf.attr(dvbi.a_href).value()})`, 
									fragment:conf, key:"video conf point"});

			// Check ContentAttributes/CaptionLanguage
			cp=0;
			while ((conf=ContentAttributes.get(xPath(SCHEMA_PREFIX, tva.e_CaptionLanguage, ++cp), SL_SCHEMA))!=null) 
				checkLanguage(this.knownLanguages, conf.text(), tva.e_CaptionLanguage.elementize(), conf, errs, "SI101");

			// Check ContentAttributes/SignLanguage
			cp=0;
			while ((conf=ContentAttributes.get(xPath(SCHEMA_PREFIX, tva.e_SignLanguage, ++cp), SL_SCHEMA))!=null)
				checkLanguage(this.knownLanguages, conf.text(), tva.e_SignLanguage.elementize(), conf, errs, "SI111");
		}

		// <ServiceInstance><Availability>
		let Availability=ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_Availability), SL_SCHEMA);
		if (Availability) {
			let Period, p=0;
			while ((Period=Availability.get(xPath(SCHEMA_PREFIX, dvbi.e_Period, ++p), SL_SCHEMA))!=null)
				if (Period.attr(dvbi.a_validFrom) && Period.attr(dvbi.a_validTo)) {
					// validTo should be >= validFrom
					let fr=new Date(Period.attr(dvbi.a_validFrom).value()), 
						to=new Date(Period.attr(dvbi.a_validTo).value());

					if (to.getTime() < fr.getTime()) 
						errs.addError({code:"SI124", message:`invalid availability period for service ${thisServiceId.quote()}. ${fr}>${to}`, fragment:Period, key:"period start>end"});
				}
		}

		// <ServiceInstance><SubscriptionPackage>
		checkXMLLangs(SL_SCHEMA, SCHEMA_PREFIX, dvbi.e_SubscriptionPackage, ServiceInstance.name().elementize(), ServiceInstance, errs, "SI131", this.knownLanguages);
		let sp=0, SubscriptionPackage;
		while ((SubscriptionPackage=ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_SubscriptionPackage, ++sp), SL_SCHEMA))!=null) {
			if (this.SchemaVersion(SCHEMA_NAMESPACE) >= SCHEMA_v4) {
				let pkg=localizedSubscriptionPackage(SubscriptionPackage);
				if (!subscriptionPackages.includes(pkg))
					errs.addError({code:"SI130", message:`${dvbi.e_SubscriptionPackage.elementize()}="${pkg}" is not declared in ${dvbi.e_SubscriptionPackageList.elementize()}`,
						fragment:SubscriptionPackage, key:`undeclared ${dvbi.e_SubscriptionPackage}`});
			}
		}

		// <ServiceInstance><FTAContentManagement>

		// note that the <SourceType> element becomes optional and in A177v2, but if specified then the relevant
		// delivery parameters also need to be specified
		let SourceType=ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_SourceType), SL_SCHEMA);
		if (SourceType) {
			let v1Params=false;
			switch (SourceType.text()) {
				case dvbi.DVBT_SOURCE_TYPE:
					if (!ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_DVBTDeliveryParameters), SL_SCHEMA) ) 
						errs.addError(NoDeliveryParams("DVB-T", thisServiceId, SourceType, "SI151")); 
					v1Params=true;
					break;
				case dvbi.DVBS_SOURCE_TYPE:
					if (!ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_DVBSDeliveryParameters), SL_SCHEMA) ) 
						errs.addError(NoDeliveryParams("DVB-S", thisServiceId, SourceType, "SI152"));
					v1Params=true;
					break;
				case dvbi.DVBC_SOURCE_TYPE:
					if (!ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_DVBCDeliveryParameters), SL_SCHEMA) ) 
						errs.addError(NoDeliveryParams("DVB-C", thisServiceId, SourceType, "SI153"));
					v1Params=true;
					break;
				case dvbi.DVBDASH_SOURCE_TYPE:
					if (!ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_DASHDeliveryParameters), SL_SCHEMA) ) 
						errs.addError(NoDeliveryParams("DVB-DASH", thisServiceId, SourceType, "SI154"));
					v1Params=true;
					break;
				case dvbi.DVBIPTV_SOURCE_TYPE:
					if (!ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_MulticastTSDeliveryParameters), SL_SCHEMA) && 
					    !ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_RTSPDeliveryParameters), SL_SCHEMA)) 
						errs.addError(NoDeliveryParams("Multicast or RTSP", thisServiceId, SourceType, "SI155"));
					v1Params=true;
					break;
				case dvbi.DVBAPPLICATION_SOURCE_TYPE:
					// there should not be any <xxxxDeliveryParameters> elements and there should be either a Service.RelatedMaterial or Service.ServiceInstance.RelatedMaterial signalling a service related application
					if (ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_DVBTDeliveryParameters), SL_SCHEMA) ||
						ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_DVBSDeliveryParameters), SL_SCHEMA) ||
						ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_DVBCDeliveryParameters), SL_SCHEMA) ||
						ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_DASHDeliveryParameters), SL_SCHEMA) ||
						ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_SATIPDeliveryParametersDeliveryParameters), SL_SCHEMA) ||
						ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_MulticastTSDeliveryParameters), SL_SCHEMA) ||
						ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_RTSPDeliveryParameters), SL_SCHEMA) ) {
							errs.addError({code:"SI156", message:`Delivery parameters are not permitted for Application service instance in Service ${thisServiceId.quote()}`, 
									fragment:SourceType, key:"invalid application"});
							v1Params=true;
						}
						else {
							// no xxxxDeliveryParameters is signalled
							// check for appropriate Service.RelatedMaterial or Service.ServiceInstance.RelatedMaterial
							let service=ServiceInstance.parent();
							if (!this.hasSignalledApplication(SL_SCHEMA, SCHEMA_PREFIX, service) && !this.hasSignalledApplication(SL_SCHEMA, SCHEMA_PREFIX, ServiceInstance)) {
								errs.addError({code:"SI157a", message:`No Application is signalled for ${dvbi.e_SourceType}=${dvbi.DVBAPPLICATION_SOURCE_TYPE.quote()} in Service ${thisServiceId.quote()}`, 
										line:service.line(), key:"no application"});
								errs.addError({code:"SI157b", message:`No Application is signalled for ${dvbi.e_SourceType}=${dvbi.DVBAPPLICATION_SOURCE_TYPE.quote()} in ServiceInstance ${thisServiceId.quote()}`, 
										line:ServiceInstance.line(), key:"no application"});							}
						}
					break;
				default:
					switch (this.SchemaVersion(SCHEMA_NAMESPACE)) {
						case SCHEMA_v1:
							errs.addError({code:"SI158", message:`${dvbi.e_SourceType.elementize()} ${SourceType.text().quote()} is not valid in Service ${thisServiceId.quote()}`, 
									fragment:SourceType, key:`invalid ${dvbi.e_SourceType}`});
							break;
						case SCHEMA_v2:
						case SCHEMA_v3:
						case SCHEMA_v4:
							if (!ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_OtherDeliveryParameters), SL_SCHEMA))
								errs.addError({code:"SI159", 
									message:`${dvbi.e_OtherDeliveryParameters.elementize()} must be specified with user-defined ${dvbi.e_SourceType} ${SourceType.text().quote()}`, 
									line:ServiceInstance.line(), key:`no ${dvbi.e_OtherDeliveryParameters}`});
							break;
					}
			}
			if (v1Params && this.SchemaVersion(SCHEMA_NAMESPACE)>=SCHEMA_v2)
				errs.addError({type:WARNING, code:"SI160", 
								message:`${dvbi.e_SourceType.elementize()} is deprecated in this version (service ${thisServiceId.quote()})`, 
								fragment:SourceType, key:'deprecated feature'});
		}
		else {
			if (this.SchemaVersion(SCHEMA_NAMESPACE)==SCHEMA_v1) 
				errs.addError({code:"SI161", message:`${dvbi.e_SourceType.elementize()} not specified in ${dvbi.e_ServiceInstance.elementize()} of service ${thisServiceId.quote()}`, 
								key:`no ${dvbi.e_SourceType}`});
		}

		// <ServiceInstance><AltServiceName>
		let alternateNames=[], altSN, alt=0;
		while ((altSN=ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_AltServiceName, ++alt), SL_SCHEMA))!=null) {
			if (alternateNames.includes(altSN.text())) 
				errs.addError({type:WARNING, code:"SI165", fragment:altSN,
								message:`${dvbi.e_AltServiceName}=${altSN.text().quote} already specificed in ${dvbi.e_ServiceInstance.elementize()} of service ${thisServiceId.quote()}`, 
								key:'duplicate name'});
			else alternateNames.push(altSN.text());
		}

		// <ServiceInstance><DASHDeliveryParameters>
		let DASHDeliveryParameters=ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_DASHDeliveryParameters), SL_SCHEMA);
		if (DASHDeliveryParameters) {
			let URIBasedLocation=DASHDeliveryParameters.get(xPath(SCHEMA_PREFIX, dvbi.e_UriBasedLocation), SL_SCHEMA);
			if (URIBasedLocation) {
				let uriContentType=URIBasedLocation.attr(dvbi.a_contentType);
				if (uriContentType && !validDASHcontentType(uriContentType.value()))
					errs.addError({code:"SI173", fragment:URIBasedLocation,
						message:`${dvbi.a_contentType.attribute()}=${uriContentType.value().quote()} in service ${thisServiceId.quote()} is not valid`, 
						key:`no ${dvbi.a_contentType.attribute()} for DASH`});

				let uri=URIBasedLocation.get(xPath(SCHEMA_PREFIX, dvbi.e_URI), SL_SCHEMA);
				if (uri && !isHTTPURL(uri.text()))
					errs.addError({code:"SI174", message:`invalid URL ${uri.text().quote()} specified for ${dvbi.e_URI.elementize()} of service ${thisServiceId.quote()}`, 
						fragment:uri, key:"invalid resource URL"});
			}
			
			// <DASHDeliveryParameters><MulticastTSDeliveryParameters>
			let MulticastTSDeliveryParameters=DASHDeliveryParameters.get(xPath(SCHEMA_PREFIX, dvbi.e_MulticastTSDeliveryParameters), SL_SCHEMA);
			if (MulticastTSDeliveryParameters) {
				checkMulticastDeliveryParams(MulticastTSDeliveryParameters, errs, "SI176");
			}

			// <DASHDeliveryParameters><Extension>
			let e=0, Extension;
			while ((Extension=DASHDeliveryParameters.get(xPath(SCHEMA_PREFIX, dvbi.e_Extension, ++e), SL_SCHEMA))!=null) {
				this.CheckExtension(Extension, EXTENSION_LOCATION_DASH_INSTANCE, errs, "SI175");
			}
		}

		// <ServiceInstance><DVBTDeliveryParameters>			
		let DVBTDeliveryParameters=ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_DVBTDeliveryParameters), SL_SCHEMA);
		if (DVBTDeliveryParameters) {
			let DVBTtargetCountry=DVBTDeliveryParameters.get(xPath(SCHEMA_PREFIX, dvbi.e_TargetCountry), SL_SCHEMA);
			if (DVBTtargetCountry && !this.knownCountries.isISO3166code(DVBTtargetCountry.text())) 
				errs.addError({code:"SI182", message:InvalidCountryCode(DVBTtargetCountry.text(), "DVB-T", `service ${thisServiceId.quote()}`), 
						fragment:DVBTtargetCountry, key:"invalid country code"});
		}

		// <ServiceInstance><DVBCDeliveryParameters>
		let DVBCDeliveryParameters=ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_DVBCDeliveryParameters), SL_SCHEMA);
		if (DVBCDeliveryParameters) {
			let DVBCtargetCountry=ServiceInstance.get(xPathM(SCHEMA_PREFIX, [dvbi.e_DVBCDeliveryParameters, dvbi.e_TargetCountry]), SL_SCHEMA);
			if (DVBCtargetCountry && !this.knownCountries.isISO3166code(DVBCtargetCountry.text()))  
				errs.addError({code:"SI191", message:InvalidCountryCode(DVBCtargetCountry.text(), "DVB-C", `service ${thisServiceId.quote()}`), 
						fragment:DVBCtargetCountry, key:"invalid country code"});
		}

		// <ServiceInstance><DVBSDeliveryParameters>
		// checked by schema validation	

		// <ServiceInstance><SATIPDeliveryParameters>	
		// SAT-IP Delivery Parameters can only exist if DVB-T or DVB-S delivery parameters are specified		
		// checked by schema validation

		// <ServiceInstance><RTSPDeliveryParameters>
		let RTSPDeliveryParameters=ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_RTSPDeliveryParameters), SL_SCHEMA);
		if (RTSPDeliveryParameters) {
			let RTSPURL=RTSPDeliveryParameters.get(xPath(SCHEMA_PREFIX, dvbi.e_RTSPURL), SL_SCHEMA);
			if (RTSPURL && !isRTSPURL(RTSPURL.text()))
				errs.addError({code:"SI223", message:`${RTSPURL.text().quote()} is not a valid RTSP URL`, fragment:RTSPURL, key:"invalid URL"});
		}
		
		// <ServiceInstance><MulticastTSDeliveryParameters>
		let MulticastTSDeliveryParameters=ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_MulticastTSDeliveryParameters), SL_SCHEMA);
		if (MulticastTSDeliveryParameters) {
			checkMulticastDeliveryParams(MulticastTSDeliveryParameters, errs, "SI235");
		}

		// <ServiceInstance><OtherDeliveryParameters>
		let OtherDeliveryParameters=ServiceInstance.get(xPath(SCHEMA_PREFIX, dvbi.e_OtherDeliveryParameters), SL_SCHEMA);
		if (OtherDeliveryParameters) {
			this.CheckExtension(OtherDeliveryParameters, EXTENSION_LOCATION_OTHER_DELIVERY, errs, "SI237");
		}
	}

	/*private*/ CheckExtension(extn, extLoc, errs, errCode) {
		if (!extn) {
			errs.addError({type:APPLICATION, code:"CE000", message:"CheckExtension() called with extn=null"});
			return;
		}
		// extension type is checked in schema validation

		if (extn.attr(dvbi.a_extensionName)) {
			switch (extn.attr(dvbi.a_extensionName).value()) {
				case 'DVB-HB': 
					if (extLoc != EXTENSION_LOCATION_SERVICE_LIST_REGISTRY)
						errs.addError({code:`${errCode}-1`, message:"DVB-HB Extension only permitted in the Service List Registry", 
							fragment:extn, key:'extensability'});
					break;
				case 'urn:hbbtv:dvbi:service:serviceIdentifierTriplet':
					if (extLoc != EXTENSION_LOCATION_SERVICE_ELEMENT)
						errs.addError({code:`${errCode}-2`, message:"HbbTV extension only permitted in Service List", 
						fragment:extn, key:'extensability'});
					break;
				default:
					errs.addError({type:WARNING, code:`${errCode}-100`, key:'unknown extension', fragment:extn,
									message:`extenstion "${extn.attr(dvbi.a_extensionName).value()}" is not known to this tool`});
			}
		}
	}


	/*private*/ doSchemaVerification(ServiceList, SCHEMA_NAMESPACE, errs, errCode) {
		let _rc=true;
		switch (this.SchemaVersion(SCHEMA_NAMESPACE)) {
			case SCHEMA_v1:
				SchemaCheck(ServiceList, this.SLschema_v1, errs, `${errCode}-1`);
				break;
			case SCHEMA_v2:
				SchemaCheck(ServiceList, this.SLschema_v2, errs, `${errCode}-2`);
				break;
			case SCHEMA_v3:
				SchemaCheck(ServiceList, this.SLschema_v3, errs, `${errCode}-3`);
				break;	
			case SCHEMA_v4:
				SchemaCheck(ServiceList, this.SLschema_v4, errs, `${errCode}-4`);
				break;	
			default:
				_rc=false;
				break;	
		}
		return _rc;
	}


	/**
	 * validate the service list and record any errors
	 *
	 * @param {String} SLtext  The service list text to be validated
	 * @param {Class} errs     Errors found in validaton
	 */
	/*public*/ doValidateServiceList(SLtext, errs) {
		if (!SLtext) {
			errs.addError({type:APPLICATION, code:"SL000", message:'doValidateServiceList() called with SLtext==null'});
			return;
		}

		let SL=SchemaLoad(SLtext, errs, "SL001");
		if (!SL)
			return;

		if (!SL.root().namespace()) {
			errs.addError({code:"SL003", message:`namespace is not provided for ${dvbi.e_ServiceList.elementize()}`, key:"XSD validation"});
			return;
		}

		if (SL.root().name() !== dvbi.e_ServiceList) {
			errs.addError({code:"SL004", message:`Root element is not ${dvbi.e_ServiceList.elementize()}`, line:SL.root().line(), key:"XSD validation"});
			return;
		}

		let SL_SCHEMA={}, 
			SCHEMA_PREFIX=SL.root().namespace().prefix(), 
			SCHEMA_NAMESPACE=SL.root().namespace().href();
			SL_SCHEMA[SCHEMA_PREFIX]=SCHEMA_NAMESPACE;

		if (!this.doSchemaVerification(SL, SCHEMA_NAMESPACE, errs, "SL005")) {
			errs.addError({code:"SL010", message:`Unsupported namespace ${SCHEMA_NAMESPACE.quote()}`, key:"XSD validation"});
			return;
		}

		//check <ServiceList><Name>
		checkXMLLangs(SL_SCHEMA, SCHEMA_PREFIX, dvbi.e_Name, dvbi.e_ServiceList, SL, errs, "SL020", this.knownLanguages);

		//check <ServiceList><ProviderName>
		checkXMLLangs(SL_SCHEMA, SCHEMA_PREFIX, dvbi.e_ProviderName, dvbi.e_ServiceList, SL, errs, "SL030", this.knownLanguages);

		//check <ServiceList><RelatedMaterial>
		let rm=0, countControlApps=0, RelatedMaterial;
		while ((RelatedMaterial=SL.get(xPath(SCHEMA_PREFIX, tva.e_RelatedMaterial, ++rm), SL_SCHEMA))!=null) {
			let _foundHref=this.validateRelatedMaterial(RelatedMaterial, errs, "service list", SERVICE_LIST_RM, SCHEMA_NAMESPACE, "SL040");
			if (_foundHref!="" && validServiceControlApplication(_foundHref)) 
				countControlApps++;
		}

		if (countControlApps>1)
			errs.addError({code:"SL041", message:"only a single service control application can be signalled in a service", key:"multi apps"});
			
		// check <ServiceList><RegionList> and remember regionID values
		let knownRegionIDs=[], RegionList=SL.get(xPath(SCHEMA_PREFIX, dvbi.e_RegionList), SL_SCHEMA);
		if (RegionList) {
			// recurse the regionlist - Regions can be nested in Regions
			let r=0, Region;
			while ((Region=RegionList.get(xPath(SCHEMA_PREFIX, dvbi.e_Region, ++r), SL_SCHEMA))!=null)
				this.addRegion(SL_SCHEMA, SCHEMA_PREFIX, Region, 0, knownRegionIDs, errs);
		}

		//check <ServiceList><TargetRegion>
		let tr=0, TargetRegion;
		while ((TargetRegion=SL.get(xPath(SCHEMA_PREFIX, dvbi.e_TargetRegion, ++tr), SL_SCHEMA))!=null)
			if (!isIn(knownRegionIDs, TargetRegion.text())) 
				errs.addError(UnspecifiedTargetRegion(TargetRegion.text(), "service list", "SL060"));


		// check <ServiceList><SubscriptionPackageList>
		let declaredSubscriptionPackages=[];
		let SubscriptionPackageList=SL.get(xPath(SCHEMA_PREFIX, dvbi.e_SubscriptionPackageList), SL_SCHEMA);
		if (SubscriptionPackageList) {
			checkXMLLangs(SL_SCHEMA, SCHEMA_PREFIX, dvbi.e_SubscriptionPackage, dvbi.e_SubscriptionPackageList, SubscriptionPackageList, errs, "SL063", this.knownLanguages);
			let sp=0, SubscriptionPackage;
			while ((SubscriptionPackage=SubscriptionPackageList.get(xPath(SCHEMA_PREFIX, dvbi.e_SubscriptionPackage, ++sp), SL_SCHEMA))!=null) {
				let pkg=localizedSubscriptionPackage(SubscriptionPackage);
				
				if (!declaredSubscriptionPackages.includes(pkg))
					declaredSubscriptionPackages.push(pkg);
			}
		}

		// <ServiceList><LCNTableList> is checked below, after the services are enumerated

		//check service list <ContentGuideSourceList>
		let ContentGuideSourceIDs=[],
			CGSourceList=SL.get(xPath(SCHEMA_PREFIX, dvbi.e_ContentGuideSourceList), SL_SCHEMA);
		if (CGSourceList) {
			let cgs=0, CGSource;
			while ((CGSource=CGSourceList.get(xPath(SCHEMA_PREFIX, dvbi.e_ContentGuideSource, ++cgs), SL_SCHEMA))!=null) {

				this.validateAContentGuideSource(SL_SCHEMA, SCHEMA_PREFIX, SCHEMA_NAMESPACE, CGSource, errs,
					`${dvbi.e_ServiceList}.${dvbi.e_ContentGuideSourceList}.${dvbi.e_ContentGuideSource}[${cgs}]`, "SL070");
				
				if (CGSource.attr(dvbi.a_CGSID)) {
					if (isIn(ContentGuideSourceIDs, CGSource.attr(dvbi.a_CGSID).value()))
						errs.addError({code:"SL071", 
							message:`duplicate ${dvbi.a_CGSID.attribute(dvbi.a_CGSID)} (${CGSource.attr(dvbi.a_CGSID).value()}) in service list`, 
							key:`duplicate ${dvbi.a_CGSID.attribute()}`});
					else ContentGuideSourceIDs.push(CGSource.attr(dvbi.a_CGSID).value());
				}
			}
		}

		// check  elements in <ServiceList><ContentGuideSource>
		let slGCS=SL.get(xPath(SCHEMA_PREFIX, dvbi.e_ContentGuideSource), SL_SCHEMA);
		if (slGCS) 
			this.validateAContentGuideSource(SL_SCHEMA, SCHEMA_PREFIX, SCHEMA_NAMESPACE, slGCS, errs, `${dvbi.e_ServiceList}.${dvbi.e_ContentGuideSource}`, "SL080");

		errs.setW("num services", 0);

		// check <Service>
		let s=0, service, knownServices=[], thisServiceId;
		while ((service=SL.get(xPath(SCHEMA_PREFIX, dvbi.e_Service, ++s), SL_SCHEMA))!=null) {
			// for each service
			errs.setW("num services", s);
			thisServiceId=`service-${s}`;  // use a default value in case <UniqueIdentifier> is not specified
			
			let serviceOptionalElements=[dvbi.e_ServiceInstance, dvbi.e_TargetRegion, tva.e_RelatedMaterial, dvbi.e_ServiceGenre, dvbi.e_ServiceType, dvbi.e_RecordingInfo, dvbi.e_ContentGuideSource, dvbi.e_ContentGuideSourceRef, dvbi.e_ContentGuideServiceRef];
			if (this.SchemaVersion(SCHEMA_NAMESPACE) > SCHEMA_v2)
				serviceOptionalElements.push(dvbi.e_ServiceDescription);
			
			// check <Service><UniqueIdentifier>
			let uID=service.get(xPath(SCHEMA_PREFIX, dvbi.e_UniqueIdentifier), SL_SCHEMA);
			if (uID) {
				thisServiceId=uID.text();
				if (!validServiceIdentifier(thisServiceId)) 
					errs.addError({code:"SL110", message:`${thisServiceId.quote()} is not a valid service identifier`, fragment:uID, key:"invalid tag"});
				if (!uniqueServiceIdentifier(thisServiceId, knownServices)) 
					errs.addError({code:"SL111", message:`${thisServiceId.quote()} is not unique`, key:"non unique id", fragment:uID});
				knownServices.push(thisServiceId);			
			}

			//check <Service><ServiceInstance>
			let si=0, ServiceInstance;
			while ((ServiceInstance=service.get(xPath(SCHEMA_PREFIX, dvbi.e_ServiceInstance, ++si), SL_SCHEMA))!=null)
				this.validateServiceInstance(SL_SCHEMA, SCHEMA_PREFIX, SCHEMA_NAMESPACE, ServiceInstance, thisServiceId, declaredSubscriptionPackages, errs);

			//check <Service><TargetRegion>
			let tr=0, TargetRegion;
			while ((TargetRegion=service.get(xPath(SCHEMA_PREFIX, dvbi.e_TargetRegion, ++tr), SL_SCHEMA))!=null) 
				if (!isIn(knownRegionIDs, TargetRegion.text())) 
					errs.addError(UnspecifiedTargetRegion(TargetRegion.text(), `service ${thisServiceId.quote()}`, "SL130"));

			//check <Service><ServiceName>
			checkXMLLangs(SL_SCHEMA, SCHEMA_PREFIX, dvbi.e_ServiceName, `service ${thisServiceId.quote()}`, service, errs, "SL140", this.knownLanguages);

			//check <Service><ProviderName>
			checkXMLLangs(SL_SCHEMA, SCHEMA_PREFIX, dvbi.e_ProviderName, `service ${thisServiceId.quote()}`, service, errs, "SL141", this.knownLanguages);

			//check <Service><RelatedMaterial>
			let rm=0, RelatedMaterial;
			while ((RelatedMaterial=service.get(xPath(SCHEMA_PREFIX, tva.e_RelatedMaterial, ++rm), SL_SCHEMA))!=null)
				this.validateRelatedMaterial(RelatedMaterial, errs, `service ${thisServiceId.quote()}`, SERVICE_RM, SCHEMA_NAMESPACE, "SL150"); 

			//check <Service><ServiceGenre>
			let ServiceGenre=service.get(xPath(SCHEMA_PREFIX, dvbi.e_ServiceGenre), SL_SCHEMA);
			if (ServiceGenre) {
				checkAttributes(ServiceGenre, [tva.a_href], [tva.a_type], tvaEA.Genre, errs, "SL160");
				if (ServiceGenre.attr(tva.a_type)) 
					if (!isIn(tva.ALL_GENRE_TYPES, ServiceGenre.attr(tva.a_type).value()))
						errs.addError({code:"SL161", 
							message:`service ${thisServiceId.quote()} has an invalid ${dvbi.a_href.attribute(dvbi.e_ServiceGenre)} type ${ServiceGenre.attr(dvbi.a_href).value().quote()}`, 
							fragment:ServiceGenre, key:`invalid ${dvbi.e_ServiceGenre} type`});
			
				if (ServiceGenre.attr(dvbi.a_href)) {
					let genre=ServiceGenre.attr(dvbi.a_href).value();
					if (!this.allowedGenres.isIn(genre)) 
						errs.addError({code:"SL162", 
							message:`service ${thisServiceId.quote()} has an invalid ${dvbi.a_href.attribute(dvbi.e_ServiceGenre)} value ${genre} (must be content genre)`, 
							fragment:ServiceGenre, key:`invalid ${dvbi.e_ServiceGenre}`});
				}
			}
			//check <Service><ServiceType>                    
			let ServiceType=service.get(xPath(SCHEMA_PREFIX, dvbi.e_ServiceType), SL_SCHEMA);
			if (ServiceType && ServiceType.attr(dvbi.a_href) && !this.allowedServiceTypes.isIn(ServiceType.attr(dvbi.a_href).value())) 
				errs.addError({code:"SL164", 
					message:`service ${thisServiceId.quote()} has an invalid ${dvbi.e_ServiceType.elementize()} (${ServiceType.attr(dvbi.a_href).value()})`, 
					fragment:ServiceType, key:`invalid ${dvbi.e_ServiceType}`});

			// check <Service><ServiceDescription>
			this.ValidateSynopsisType(SL_SCHEMA, SCHEMA_PREFIX, service, dvbi.e_ServiceDescription, 
				[], [tva.SYNOPSIS_BRIEF_LABEL, tva.SYNOPSIS_SHORT_LABEL, tva.SYNOPSIS_MEDIUM_LABEL, tva.SYNOPSIS_LONG_LABEL, tva.SYNOPSIS_EXTENDED_LABEL], "***", errs, "SL170");

			// check <Service><RecordingInfo>
			let RecordingInfo=service.get(xPath(SCHEMA_PREFIX, dvbi.e_RecordingInfo), SL_SCHEMA);
			if (RecordingInfo && RecordingInfo.attr(dvbi.a_href) && !this.RecordingInfoCSvalues.isIn(RecordingInfo.attr(dvbi.a_href).value())) 
				errs.addError({code:"SL180", message:`invalid ${dvbi.e_RecordingInfo.elementize()} value ${RecordingInfo.attr(dvbi.a_href).value().quote()} for service ${thisServiceId}`, 
						fragment:RecordingInfo, key:`invalid ${dvbi.e_RecordingInfo}`});

			// check <Service><ContentGuideSource>
			let sCG=service.get(xPath(SCHEMA_PREFIX, dvbi.e_ContentGuideSource), SL_SCHEMA);
			if (sCG) 
				this.validateAContentGuideSource(SL_SCHEMA, SCHEMA_PREFIX, SCHEMA_NAMESPACE, sCG, errs, `${dvbi.e_ContentGuideSource.elementize()} in service ${thisServiceId}`, "SL190");

			//check <Service><ContentGuideSourceRef>
			let sCGref=service.get(xPath(SCHEMA_PREFIX, dvbi.e_ContentGuideSourceRef), SL_SCHEMA);
			if (sCGref && !isIn(ContentGuideSourceIDs, sCGref.text())) 
				errs.addError({code:"SL200", message:`content guide reference ${sCGref.text().quote()} for service ${thisServiceId.quote()} not specified`, 
						fragment:sCGref, key:"unspecified content guide source"});

			// check <Service><AdditionalServiceParameters>
			let _ap=0, AdditionalParams;
			while ((AdditionalParams=service.get(xPath(SCHEMA_PREFIX, dvbi.e_AdditionalServiceParameters, ++_ap), SL_SCHEMA))!=null) {
				this.CheckExtension(AdditionalParams, EXTENSION_LOCATION_SERVICE_ELEMENT, errs, "SL211");
			}
		}

		// check <Service><ContentGuideServiceRef>
		// issues a warning if this is a reference to self
		s=0;
		while ((service=SL.get("//"+xPath(SCHEMA_PREFIX, dvbi.e_Service, ++s), SL_SCHEMA))!=null) {
			let CGSR=service.get(xPath(SCHEMA_PREFIX, dvbi.e_ContentGuideServiceRef), SL_SCHEMA);
			if (CGSR) {
				let uniqueID=service.get(xPath(SCHEMA_PREFIX, dvbi.e_UniqueIdentifier), SL_SCHEMA);
				if (uniqueID && (CGSR.text()==uniqueID.text()))
					errs.addError({type:WARNING, code:"SL230", message:`${dvbi.e_ContentGuideServiceRef.elementize()} is self`, 
									fragment:uniqueID, key:`self ${dvbi.e_ContentGuideServiceRef.elementize()}`});
			}
		}

		// check <ServiceList><LCNTableList>
		let LCNtableList=SL.get("//"+xPath(SCHEMA_PREFIX, dvbi.e_LCNTableList), SL_SCHEMA);
		if (LCNtableList) {
			let l=0, LCNTable, tableQualifiers=[];
			while ((LCNTable=LCNtableList.get(xPath(SCHEMA_PREFIX, dvbi.e_LCNTable, ++l), SL_SCHEMA))!=null) {
				// <LCNTable><TargetRegion>
				let tr=0, TargetRegion, TargetRegions=[];
				while ((TargetRegion=LCNTable.get(xPath(SCHEMA_PREFIX, dvbi.e_TargetRegion, ++tr), SL_SCHEMA))!=null) {
					if (!isIn(knownRegionIDs, TargetRegion.text())) 
						errs.addError({code:"SL241", message:`${dvbi.e_TargetRegion.elementize()} ${TargetRegion.text()} in ${dvbi.e_LCNTable.elementize()} is not defined`, 
										fragment:TargetRegion, key:"undefined region"});
					if (TargetRegions.includes(TargetRegion.text()))
						errs.addError({code:"SL242", message:`respecification of ${dvbi.e_TargetRegion.elementize()}=${TargetRegion.text()}`,
								fragment:TargetRegion, key:'duplicate region'});
					else TargetRegions.push(TargetRegion.text());
				} 
				
				// <LCNTable><SubscriptionPackage>
				let sp=0, SubscriptionPackage, SubscriptionPackages=[];
				while ((SubscriptionPackage=LCNTable.get(xPath(SCHEMA_PREFIX, dvbi.e_SubscriptionPackage, ++sp), SL_SCHEMA))!=null) {
					let packageLanguage=null;
					if (SubscriptionPackage.attr(tva.a_lang)) {
						packageLanguage=SubscriptionPackage.attr(tva.a_lang).value();
						checkLanguage(this.knownLanguages, packageLanguage, `${dvbi.e_SubscriptionPackage} in ${dvbi.e_LCNTable}`,
							SubscriptionPackage, errs, "SL245");
					}
					else if (this.SchemaVersion(SCHEMA_NAMESPACE) >= SCHEMA_v4) {
						packageLanguage=GetNodeLanguage(SubscriptionPackage, false, errs, "SL246", this.knownLanguages);
					}

					let localSubscriptionPackage=localizedSubscriptionPackage(SubscriptionPackage, packageLanguage);
					if (SubscriptionPackages.includes(localSubscriptionPackage)) 
						errs.addError({code:"SL247", message:`duplicated ${dvbi.e_SubscriptionPackage.elementize()}`, 
										fragment:SubscriptionPackage, key:'duplicate package name'});
					else SubscriptionPackages.push(localSubscriptionPackage);

					if (this.SchemaVersion(SCHEMA_NAMESPACE) >= SCHEMA_v4)
						if (!declaredSubscriptionPackages.includes(localSubscriptionPackage))
							errs.addError({code:"SL248", message:`${dvbi.e_SubscriptionPackage.elementize()}="${localSubscriptionPackage}" is not declared in ${dvbi.e_SubscriptionPackageList.elementize()}`,
								fragment:SubscriptionPackage, key:`undeclared ${dvbi.e_SubscriptionPackage}`});
				}

				if (TargetRegions.length==0) TargetRegions.push(LCN_TABLE_NO_TARGETREGION);
				if (SubscriptionPackages==0) SubscriptionPackages.push(LCN_TABLE_NO_SUBSCRIPTION);

/* jshint -W083*/
				TargetRegions.forEach( region => {
					let displayRegion=(region==LCN_TABLE_NO_TARGETREGION) ? `unspecified ${dvbi.e_TargetRegion.elementize()}` : `${dvbi.e_TargetRegion.elementize()}="${region}"`;
					SubscriptionPackages.forEach( sPackage => {
						let key=`${region}::${sPackage}`,
							displayPackage=(sPackage==LCN_TABLE_NO_SUBSCRIPTION) ? `unspecified ${dvbi.e_SubscriptionPackage.elementize()}` : `${dvbi.e_SubscriptionPackage.elementize()}="${sPackage}"`;
						if (tableQualifiers.includes(key))
							errs.addError({code:"SL251", message:`combination of ${displayRegion} and ${displayPackage} already used`,
									key:'reused region/package', line:LCNTable.line()});
						else tableQualifiers.push(key);
					});
				});
/* jshint +W083*/

				// <LCNTable><LCN>
				let LCNNumbers=[], e=0, LCN;
				while ((LCN=LCNTable.get(xPath(SCHEMA_PREFIX, dvbi.e_LCN, ++e), SL_SCHEMA))!=null) {
					// LCN@channelNumber
					if (LCN.attr(dvbi.a_channelNumber)) {
						let _chanNum=LCN.attr(dvbi.a_channelNumber).value();

						if (isIn(LCNNumbers, _chanNum)) 
							errs.addError({code:"SL262", message:`duplicated channel number ${_chanNum} for ${dvbi.e_LCNTable.elementize()}`, 
											key:"duplicate channel number", fragment:LCN});
						else LCNNumbers.push(_chanNum);
					}

					// LCN@serviceRef
					if (LCN.attr(dvbi.a_serviceRef) && !isIn(knownServices, LCN.attr(dvbi.a_serviceRef).value())) 
						errs.addError({code:"SL263", message:`LCN reference to unknown service ${LCN.attr(dvbi.a_serviceRef).value()}`, 
										key:"LCN unknown services", fragment:LCN});
				}
			}
		}
	}


	/**
	 * validate the service list and record any errors
	 *
	 * @param {String} SLtext  The service list text to be validated
	 * @returns {Class} errs     Errors found in validaton
	 */
	/*public*/ validateServiceList(SLtext) {
		var errs=new ErrorList(SLtext);
		this.doValidateServiceList(SLtext, errs);

		return new Promise((resolve, reject) => {
			resolve(errs);
		});
	}
}
