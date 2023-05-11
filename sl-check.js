import "colors";
import { parseXmlString } from "libxmljs2";

import { readFileSync } from "fs";
import process from "process";

import { elementize, quote } from "./phlib/phlib.js";

import ErrorList, { WARNING, APPLICATION } from "./ErrorList.js";
import ClassificationScheme from "./ClassificationScheme.js";

import { dvbi, dvbiEC, dvbEA, XMLdocumentType } from "./DVB-I_definitions.js";

import { tva, tvaEA } from "./TVA_definitions.js";
import { isTAGURI } from "./URI_checks.js";

import { xPath, xPathM, isIn, unEntity } from "./utils.js";

import { isPostcode, isHTTPURL, isHTTPPathURL, isDomainName, isRTSPURL } from "./pattern_checks.js";

import {
	IANA_Subtag_Registry,
	TVA_ContentCS,
	TVA_FormatCS,
	DVBI_ContentSubject,
	ISO3166,
	DVBI_ServiceListSchema,
	TVA_PictureFormatCS,
	DVBI_ServiceTypeCS,
	DVB_AudioCodecCS,
	MPEG7_AudioCodingFormatCS,
	DVB_AudioConformanceCS,
	DVB_VideoCodecCS,
	MPEG7_VisualCodingFormatCS,
	DVB_VideoConformanceCS,
	MPEG7_AudioPresentationCS,
	DVBI_RecordingInfoCS,
	DVB_ColorimetryCS,
} from "./data-locations.js";

import ISOcountries from "./ISOcountries.js";
import IANAlanguages from "./IANAlanguages.js";

import { checkValidLogos } from "./RelatedMaterialChecks.js";
import { sl_InvalidHrefValue } from "./CommonErrors.js";

import { mlLanguage, checkLanguage, checkXMLLangs, GetNodeLanguage } from "./MultilingualElement.js";
import { checkAttributes, checkTopElementsAndCardinality, hasChild, SchemaCheck, SchemaVersionCheck, SchemaLoad } from "./schema_checks.js";

import "colors";
import { writeOut } from "./Validator.js";

const ANY_NAMESPACE = "$%$!!";
const LCN_TABLE_NO_TARGETREGION = "unspecifiedRegion",
	LCN_TABLE_NO_SUBSCRIPTION = "unspecifiedPackage";

const SERVICE_LIST_RM = "service list";
const SERVICE_RM = "service";
const SERVICE_INSTANCE_RM = "service instance";
const CONTENT_GUIDE_RM = "content guide";

const SCHEMA_r0 = 0,
	SCHEMA_r1 = 1,
	SCHEMA_r2 = 2,
	SCHEMA_r3 = 3,
	SCHEMA_r4 = 4,
	SCHEMA_r5 = 5,
	SCHEMA_unknown = -1;

export const DRAFT = 0x01,
	OLD = 0x02,
	ETSI = 0x04,
	CURRENT = 0x08;

var SchemaVersions = [
	// schema property is loaded from specified filename
	{
		namespace: dvbi.A177v6_Namespace,
		version: SCHEMA_r5,
		filename: DVBI_ServiceListSchema.r5.file,
		schema: null,
		status: DRAFT,
	},
	{
		namespace: dvbi.A177v5_Namespace,
		version: SCHEMA_r4,
		filename: DVBI_ServiceListSchema.r4.file,
		schema: null,
		status: CURRENT,
	},
	{
		namespace: dvbi.A177v4_Namespace,
		version: SCHEMA_r3,
		filename: DVBI_ServiceListSchema.r3.file,
		schema: null,
		status: OLD,
	},
	{
		namespace: dvbi.A177v3_Namespace,
		version: SCHEMA_r2,
		filename: DVBI_ServiceListSchema.r2.file,
		schema: null,
		status: OLD,
	},
	{
		namespace: dvbi.A177v2_Namespace,
		version: SCHEMA_r1,
		filename: DVBI_ServiceListSchema.r1.file,
		schema: null,
		status: ETSI,
	},
	{
		namespace: dvbi.A177v1_Namespace,
		version: SCHEMA_r0,
		filename: DVBI_ServiceListSchema.r0.file,
		schema: null,
		status: OLD,
	},
];

const OutOfScheduledHoursBanners = [
	{ ver: SCHEMA_r0, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v1 },
	{ ver: SCHEMA_r1, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v2 },
	{ ver: SCHEMA_r2, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v2 },
	{ ver: SCHEMA_r3, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v3 },
	{ ver: SCHEMA_r4, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v3 },
	{ ver: SCHEMA_r5, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v3 },
];
const ContentFinishedBanners = [
	{ ver: SCHEMA_r1, val: dvbi.BANNER_CONTENT_FINISHED_v2 },
	{ ver: SCHEMA_r2, val: dvbi.BANNER_CONTENT_FINISHED_v2 },
	{ ver: SCHEMA_r3, val: dvbi.BANNER_CONTENT_FINISHED_v3 },
	{ ver: SCHEMA_r4, val: dvbi.BANNER_CONTENT_FINISHED_v3 },
	{ ver: SCHEMA_r5, val: dvbi.BANNER_CONTENT_FINISHED_v3 },
];
const ServiceListLogos = [
	{ ver: SCHEMA_r0, val: dvbi.LOGO_SERVICE_LIST_v1 },
	{ ver: SCHEMA_r1, val: dvbi.LOGO_SERVICE_LIST_v2 },
	{ ver: SCHEMA_r2, val: dvbi.LOGO_SERVICE_LIST_v2 },
	{ ver: SCHEMA_r3, val: dvbi.LOGO_SERVICE_LIST_v3 },
	{ ver: SCHEMA_r4, val: dvbi.LOGO_SERVICE_LIST_v3 },
	{ ver: SCHEMA_r5, val: dvbi.LOGO_SERVICE_LIST_v3 },
];
const ServiceLogos = [
	{ ver: SCHEMA_r0, val: dvbi.LOGO_SERVICE_v1 },
	{ ver: SCHEMA_r1, val: dvbi.LOGO_SERVICE_v2 },
	{ ver: SCHEMA_r2, val: dvbi.LOGO_SERVICE_v2 },
	{ ver: SCHEMA_r3, val: dvbi.LOGO_SERVICE_v3 },
	{ ver: SCHEMA_r4, val: dvbi.LOGO_SERVICE_v3 },
	{ ver: SCHEMA_r5, val: dvbi.LOGO_SERVICE_v3 },
];
const ServiceBanners = [
	{ ver: SCHEMA_r2, val: dvbi.SERVICE_BANNER_v4 },
	{ ver: SCHEMA_r3, val: dvbi.SERVICE_BANNER_v4 },
	{ ver: SCHEMA_r4, val: dvbi.SERVICE_BANNER_v4 },
];
const ContentGuideSourceLogos = [
	{ ver: SCHEMA_r0, val: dvbi.LOGO_CG_PROVIDER_v1 },
	{ ver: SCHEMA_r1, val: dvbi.LOGO_CG_PROVIDER_v2 },
	{ ver: SCHEMA_r2, val: dvbi.LOGO_CG_PROVIDER_v2 },
	{ ver: SCHEMA_r3, val: dvbi.LOGO_CG_PROVIDER_v3 },
	{ ver: SCHEMA_r4, val: dvbi.LOGO_CG_PROVIDER_v3 },
	{ ver: SCHEMA_r5, val: dvbi.LOGO_CG_PROVIDER_v3 },
];

/**
 * determine the schema version (and hence the specificaion version) in use
 *
 * @param {String} namespace     The namespace used in defining the schema
 * @returns {integer} Representation of the schema version or error code if unknown
 */
let SchemaVersion = (namespace) => {
	let x = SchemaVersions.find((ver) => ver.namespace == namespace);
	return x ? x.version : SCHEMA_unknown;
};

const EXTENSION_LOCATION_SERVICE_LIST_REGISTRY = 101,
	EXTENSION_LOCATION_SERVICE_ELEMENT = 201,
	EXTENSION_LOCATION_DASH_INSTANCE = 202,
	EXTENSION_LOCATION_OTHER_DELIVERY = 203;

/**
 * determines if the identifer provided complies with the requirements for a service identifier
 * at this stage only IETF RFC 4151 TAG URIs are permitted
 *
 * @param {String} identifier    The service identifier
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
let validServiceUnavailableApplication = (hrefType) => hrefType == dvbi.APP_OUTSIDE_AVAILABILITY;

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
let InvalidCountryCode = (value, src, loc) => `invalid country code ${value.quote()} ${src ? `for ${src} parameters ` : ""}in ${loc}`;

/**
 * Create a label for the optional language and value provided
 * @param {XMLnode} pkg
 * @param {String} lang
 * @returns {String}
 */
let localizedSubscriptionPackage = (pkg, lang = null) => `${pkg.text()}/lang=${lang ? lang : mlLanguage(pkg)}`;

/**
 * Construct	 an error message an unspecifed target region is used
 *
 * @param {String} region   The unspecified target region
 * @param {String} loc      The location of the element
 * @param {String} errCode  The error code to be reported
 */
let UnspecifiedTargetRegion = (region, loc, errCode) => ({
	code: errCode,
	message: `${loc} has an unspecified ${dvbi.e_TargetRegion.elementize()} ${region.quote()}`,
	key: "target region",
});

/**
 * Construct an error message for missing <xxxDeliveryParameters>
 *
 * @param {String}  source     The missing source type
 * @param {String}  serviceId  The serviceId whose instance is missing delivery parameters
 * @param {XMLnode} element    The <SourceType> element for which delivery parameters are not specified
 * @param {String}  errCode    The error code to be reported
 */
let NoDeliveryParams = (source, serviceId, element, errCode) => ({
	code: errCode,
	message: `${source} delivery parameters not specified for service instance in service ${serviceId.quote()}`,
	fragment: element,
	key: "no delivery params",
});

if (!Array.prototype.forEachSubElement) {
	// based on the polyfill at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
	/*
	 * alternate to Array.prototype.forEach that only returns XML tree nodes that are elements
	 */

	Array.prototype.forEachSubElement = function (callback, thisArg) {
		if (this == null) {
			throw new TypeError("Array.prototype.forEachSubElement called on null or undefined");
		}

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
		if (typeof callback !== "function") {
			throw new TypeError(`${callback} is not a function`);
		}

		// 5. If thisArg was supplied, let T be thisArg; else let
		// T be undefined.
		if (arguments.length > 1) {
			T = thisArg;
		}

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
				if (kValue.type() == "element") callback.call(T, kValue, k, O);
			}
			// d. Increase k by 1.
			k++;
		}
		// 8. return undefined
	};
}

export default class ServiceListCheck {
	constructor(useURLs, preloadedLanguageValidator = null, preloadedGenres = null, preloadedCountries = null) {
		if (preloadedLanguageValidator) this.knownLanguages = preloadedLanguageValidator;
		else {
			this.knownLanguages = new IANAlanguages();
			console.log("loading languages...".yellow.underline);
			if (useURLs)
				this.knownLanguages.loadLanguages({
					url: IANA_Subtag_Registry.url,
					purge: true,
				});
			else
				this.knownLanguages.loadLanguages({
					file: IANA_Subtag_Registry.file,
					purge: true,
				});
		}

		if (preloadedGenres) this.allowedGenres = preloadedGenres;
		else {
			this.allowedGenres = new ClassificationScheme();
			console.log("loading Genre classification schemes...".yellow.underline);
			this.allowedGenres.loadCS(
				useURLs
					? {
							urls: [TVA_ContentCS.url, TVA_FormatCS.url, DVBI_ContentSubject.url],
					  }
					: {
							files: [TVA_ContentCS.file, TVA_FormatCS.file, DVBI_ContentSubject.file],
					  }
			);
		}

		if (preloadedCountries) this.knownCountries = preloadedCountries;
		else {
			this.knownCountries = new ISOcountries(false, true);
			this.knownCountries.loadCountries(useURLs ? { url: ISO3166.url } : { file: ISO3166.file });
		}

		this.allowedServiceTypes = new ClassificationScheme();
		this.allowedAudioSchemes = new ClassificationScheme();
		this.allowedVideoSchemes = new ClassificationScheme();
		this.allowedAudioConformancePoints = new ClassificationScheme();
		this.allowedVideoConformancePoints = new ClassificationScheme();
		this.RecordingInfoCSvalues = new ClassificationScheme();
		this.allowedPictureFormats = new ClassificationScheme();
		this.AudioPresentationCSvalues = new ClassificationScheme();
		this.allowedColorimetry = new ClassificationScheme();

		console.log("loading service list schemas...".yellow.underline);
		SchemaVersions.forEach((version) => {
			process.stdout.write(`..loading ${version.version} ${version.namespace} from ${version.filename} `.yellow);
			version.schema = parseXmlString(readFileSync(version.filename));
			console.log(version.schema ? "OK".green : "FAIL".red);
		});

		this.loadDataFiles(useURLs);
	}

	/**
	 * loads in the configuration files for the validator, loading the appropriate global variables
	 *
	 * @param {boolean} useURLs    if true then configuration data should be loaded from network locations otherwise, load from local files
	 */
	/*private*/ loadDataFiles(useURLs) {
		console.log("loading classification schemes...".yellow.underline);
		this.allowedPictureFormats.loadCS(useURLs ? { url: TVA_PictureFormatCS.url } : { file: TVA_PictureFormatCS.file });
		this.allowedColorimetry.loadCS(useURLs ? { url: DVB_ColorimetryCS.y2020.url, leafNodesOnly: true } : { file: DVB_ColorimetryCS.y2020.file, leafNodesOnly: true });
		this.allowedServiceTypes.loadCS(useURLs ? { url: DVBI_ServiceTypeCS.url } : { file: DVBI_ServiceTypeCS.file });

		this.allowedAudioSchemes.loadCS(
			useURLs
				? {
						urls: [DVB_AudioCodecCS.y2007.url, DVB_AudioCodecCS.y2020.url, MPEG7_AudioCodingFormatCS.url],
						leafNodesOnly: true,
				  }
				: {
						files: [DVB_AudioCodecCS.y2007.file, DVB_AudioCodecCS.y2020.file, MPEG7_AudioCodingFormatCS.file],
						leafNodesOnly: true,
				  }
		);

		this.allowedAudioConformancePoints.loadCS(useURLs ? { url: DVB_AudioConformanceCS.url, leafNodesOnly: true } : { file: DVB_AudioConformanceCS.file, leafNodesOnly: true });

		this.allowedVideoSchemes.loadCS(
			useURLs
				? {
						urls: [DVB_VideoCodecCS.y2007.url, DVB_VideoCodecCS.y2021.url, DVB_VideoCodecCS.y2022.url, MPEG7_VisualCodingFormatCS.url],
						leafNodesOnly: true,
				  }
				: {
						files: [DVB_VideoCodecCS.y2007.file, DVB_VideoCodecCS.y2021.file, DVB_VideoCodecCS.y2022.file, MPEG7_VisualCodingFormatCS.file],
						leafNodesOnly: true,
				  }
		);

		this.allowedVideoConformancePoints.loadCS(
			useURLs
				? {
						urls: [DVB_VideoConformanceCS.y2017.url, DVB_VideoConformanceCS.y2021.url, DVB_VideoConformanceCS.y2022.url],
						leafNodesOnly: true,
				  }
				: {
						files: [DVB_VideoConformanceCS.y2017.file, DVB_VideoConformanceCS.y2021.file, DVB_VideoConformanceCS.y2022.file],
						leafNodesOnly: true,
				  }
		);

		this.AudioPresentationCSvalues.loadCS(useURLs ? { url: MPEG7_AudioPresentationCS.url } : { file: MPEG7_AudioPresentationCS.file });

		this.RecordingInfoCSvalues.loadCS(useURLs ? { url: DVBI_RecordingInfoCS.url } : { file: DVBI_RecordingInfoCS.file });
	}

	/**
	 * parses the region element, checks the values and adds it and its children (through recursion) to the linear list of region ids
	 *
	 * @param {object}  props            Metadata of the XML document
	 * @param {XMLnode} Region           The <Region> element to process
	 * @param {integer} depth            The current depth in the hierarchial structure of regions
	 * @param {Array}   knownRegionIDs   The list of region IDs that have been found
	 * @param {Array}   countries
	 * @param {Object}  errs             The class where errors and warnings relating to the service list processing are stored
	 */
	/*private*/ addRegion(props, Region, depth, knownRegionIDs, countries, errs) {
		if (!Region) {
			errs.addError({
				type: APPLICATION,
				code: "AR000",
				message: "addRegion() called with Region==null",
			});
			return;
		}
		let schemaVersion = SchemaVersion(props.namespace);
		let regionID = Region.attr(dvbi.a_regionID) ? Region.attr(dvbi.a_regionID).value() : null;
		let displayRegionID = regionID ? regionID.quote() : '"noID"';
		let countriesSpecified = [],
			countryCodesSpecified = Region.attr(dvbi.a_countryCodes);

		// this check should not happen with schema version 5 or greater, as this becomes part of the syntax
		if (depth != 0 && countryCodesSpecified)
			errs.addError({
				code: "AR032",
				message: `${dvbi.a_countryCodes.attribute(Region.name())} not permitted for sub-region ${displayRegionID}`,
				key: "ccode in subRegion",
				line: Region.line(),
			});

		if (countryCodesSpecified) {
			countriesSpecified = countryCodesSpecified.value().split(",");
			if (countriesSpecified)
				countriesSpecified.forEach((country) => {
					if (!this.knownCountries.isISO3166code(country))
						errs.addError({
							code: "AR033",
							message: `invalid country code (${country}) for region ${displayRegionID}`,
							key: "invalid country code",
							line: Region.line(),
						});
				});
		} else countriesSpecified = countries;

		if (schemaVersion >= SCHEMA_r4) {
			let selectable = Region.attr(dvbi.a_selectable) ? Region.attr(dvbi.a_selectable).value() == "true" : true;

			if (!selectable && depth == dvbi.MAX_SUBREGION_LEVELS)
				errs.addError({
					code: "AR010",
					message: "Tertiary (leaf) subregion must be selectable",
					key: "not selectable",
					line: Region.line(),
				});

			if (!selectable && !hasChild(Region, dvbi.e_Region))
				errs.addError({
					code: "AR011",
					message: "leaf subregion must be selectable",
					key: "not selectable",
					line: Region.line(),
				});

			if (regionID) {
				if (knownRegionIDs.find((r) => r.region == regionID) != undefined)
					errs.addError({
						code: "AR012",
						message: `Duplicate ${dvbi.a_regionID.attribute()} ${displayRegionID}`,
						key: `duplicate ${dvbi.a_regionID}`,
						line: Region.line(),
					});
				else
					knownRegionIDs.push({
						countries: countriesSpecified,
						region: regionID,
						selectable: selectable,
						used: false,
						line: Region.line(),
					});
			} else
				errs.addError({
					code: "AR013",
					message: `${dvbi.a_regionID.attribute()} is required`,
					key: `no ${dvbi.a_regionID}`,
					line: Region.line(),
				});
		} else {
			if (regionID) {
				if (knownRegionIDs.find((r) => r.region == regionID) != undefined)
					errs.addError({
						code: "AR021",
						message: `Duplicate ${dvbi.a_regionID.attribute()} ${displayRegionID}`,
						key: `duplicate ${dvbi.a_regionID}`,
						line: Region.line(),
					});
				else
					knownRegionIDs.push({
						countries: countriesSpecified,
						region: regionID,
						used: false,
						line: Region.line(),
					});
			} else
				errs.addError({
					code: "AR020",
					message: `${dvbi.a_regionID.attribute()} is required`,
					key: `no ${dvbi.a_regionID}`,
					line: Region.line(),
				});
		}

		if (depth > dvbi.MAX_SUBREGION_LEVELS)
			errs.addError({
				code: "AR031",
				message: `${dvbi.e_Region.elementize()} depth exceeded (>${dvbi.MAX_SUBREGION_LEVELS}) for sub-region ${displayRegionID}`,
				key: "region depth exceeded",
				line: Region.line(),
			});

		checkXMLLangs(props, dvbi.e_RegionName, `${dvbi.a_regionID.attribute(dvbi.e_Region)}=${displayRegionID}`, Region, errs, "AR041", this.knownLanguages);

		// <Region><Postcode>
		let pc = 0,
			Postcode,
			PostcodeErrorMessage = "invalid postcode";
		while ((Postcode = Region.get(xPath(props.prefix, dvbi.e_Postcode, ++pc), props.schema)) != null)
			if (!isPostcode(Postcode.text()))
				errs.addError({
					code: "AR051",
					message: `${Postcode.text().quote()} is not a valid postcode`,
					key: PostcodeErrorMessage,
					fragment: Postcode,
				});

		let rc = 0,
			RegionChild;
		while ((RegionChild = Region.get(xPath(props.prefix, dvbi.e_Region, ++rc), props.schema)) != null)
			this.addRegion(props, RegionChild, depth + 1, knownRegionIDs, countriesSpecified, errs);
	}

	/**
	 * looks for the {index, value} pair within the array of permitted values
	 *
	 * @param {array} permittedValues  array of allowed value pairs {ver: , val:}
	 * @param {any}   version          value to match with ver: in the allowed values or ANY_NAMESPACE
	 * @param {any}   value            value to match with val: in the allowed values
	 * @returns {boolean} true if {index, value} pair exists in the list of allowed values when namespace is specific or if any val: equals value with namespace is ANY_NAMESPACE, else false
	 */
	/*private*/ match(permittedValues, version, value) {
		if (value && permittedValues) {
			if (version == ANY_NAMESPACE) return permittedValues.find((elem) => elem.value == value) != undefined;
			else {
				let i = permittedValues.find((elem) => elem.ver == version);
				return i && i.val == value;
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
	/*private*/ validOutScheduleHours(HowRelated, namespace) {
		// return true if val is a valid CS value for Out of Service Banners (A177 5.2.5.3)
		return this.match(OutOfScheduledHoursBanners, SchemaVersion(namespace), HowRelated.attr(dvbi.a_href) ? HowRelated.attr(dvbi.a_href).value() : null);
	}

	/**
	 * determines if the identifer provided refers to a valid banner for content-finished presentation
	 *
	 * @since DVB A177v2
	 * @param {XMLnode} HowRelated  The banner identifier
	 * @param {String}  namespace   The namespace being used in the XML document
	 * @returns {boolean} true if this is a valid banner for content-finished presentation else false
	 */
	/*private*/ validContentFinishedBanner(HowRelated, namespace) {
		// return true if val is a valid CS value for Content Finished Banner (A177 5.2.7.3)
		return this.match(
			ContentFinishedBanners,
			namespace == ANY_NAMESPACE ? namespace : SchemaVersion(namespace),
			HowRelated.attr(dvbi.a_href) ? HowRelated.attr(dvbi.a_href).value() : null
		);
	}

	/**
	 * determines if the identifer provided refers to a valid service list logo
	 *
	 * @param {XMLnode} HowRelated  The logo identifier
	 * @param {String}  namespace   The namespace being used in the XML document
	 * @returns {boolean} true if this is a valid logo for a service list else false
	 */
	/*private*/ validServiceListLogo(HowRelated, namespace) {
		// return true if HowRelated@href is a valid CS value Service List Logo (A177 5.2.6.1)
		return this.match(ServiceListLogos, SchemaVersion(namespace), HowRelated.attr(dvbi.a_href) ? HowRelated.attr(dvbi.a_href).value() : null);
	}

	/**
	 * determines if the identifer provided refers to a valid service logo
	 *
	 * @param {XMLnode} HowRelated  The logo identifier
	 * @param {String}  namespace   The namespace being used in the XML document
	 * @returns {boolean} true if this is a valid logo for a service  else false
	 */
	/*private*/ validServiceLogo(HowRelated, namespace) {
		// return true if val is a valid CS value Service Logo (A177 5.2.6.2)
		return this.match(ServiceLogos, SchemaVersion(namespace), HowRelated.attr(dvbi.a_href) ? HowRelated.attr(dvbi.a_href).value() : null);
	}

	/**
	 * determines if the identifer provided refers to a valid service banner
	 *
	 * @param {XMLnode} HowRelated  The logo identifier
	 * @param {String}  namespace   The namespace being used in the XML document
	 * @returns {boolean} true if this is a valid banner for a service  else false
	 */
	/*private*/ validServiceBanner(HowRelated, namespace) {
		// return true if val is a valid CS value Service Banner (A177 5.2.6.x)
		return this.match(ServiceBanners, SchemaVersion(namespace), HowRelated.attr(dvbi.a_href) ? HowRelated.attr(dvbi.a_href).value() : null);
	}

	/**
	 * determines if the identifer provided refers to a valid content guide source logo
	 *
	 * @param {XMLnode} HowRelated  The logo identifier
	 * @param {String}  namespace   The namespace being used in the XML document
	 * @returns {boolean} true if this is a valid logo for a content guide source else false
	 */
	/*private*/ validContentGuideSourceLogo(HowRelated, namespace) {
		// return true if val is a valid CS value Service Logo (A177 5.2.6.3)
		return this.match(ContentGuideSourceLogos, SchemaVersion(namespace), HowRelated.attr(dvbi.a_href) ? HowRelated.attr(dvbi.a_href).value() : null);
	}

	/**
	 * verifies if the specified application is valid according to specification
	 *
	 * @param {XMLnode} MediaLocator  The <MediaLocator> subelement (a libxmls object tree) of the <RelatedMaterial> element
	 * @param {Object}  errs          The class where errors and warnings relating to the service list processing are stored
	 * @param {string}  Location      The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
	 */
	/*private*/ checkSignalledApplication(MediaLocator, errs, Location) {
		const validApplicationTypes = [dvbi.XML_AIT_CONTENT_TYPE, dvbi.HTML5_APP, dvbi.XHTML_APP];
		let isValidApplicationType = (type) => validApplicationTypes.includes(type);

		if (!MediaLocator)
			errs.addError({
				code: "SA001",
				message: `${tva.e_MediaLocator.elementize()} not specified for application ${tva.e_RelatedMaterialr.elementize()} in ${Location}`,
				key: `no ${tva.e_MediaUri}`,
			});
		else {
			let hasMediaURI = false;
			if (MediaLocator.childNodes())
				MediaLocator.childNodes().forEachSubElement((child) => {
					if (child.name() == tva.e_MediaUri) {
						hasMediaURI = true;
						if (child.attr(tva.a_contentType) && !isValidApplicationType(child.attr(tva.a_contentType).value()))
							errs.addError({
								type: WARNING,
								code: "SA003",
								message: `${tva.a_contentType.attribute()} ${child
									.attr(tva.a_contentType)
									.value()
									.quote()} is not DVB AIT for ${tva.e_RelatedMaterial.elementize()}${tva.e_MediaLocator.elementize()} in ${Location}`,
								fragment: child,
								key: `invalid ${tva.a_contentType.attribute(tva.e_MediaUri)}`,
							});
						if (!isHTTPURL(child.text()))
							errs.addError({
								code: "SA004",
								message: `invalid URL ${child.text().quote()} specified for ${child.name().elementize()}`,
								fragment: child,
								key: "invalid resource URL",
							});
					}
				});
			if (!hasMediaURI)
				errs.addError({
					code: "SA005",
					message: `${tva.e_MediaUri.elementize()} not specified for application ${tva.e_MediaLocator.elementize()} in ${Location}`,
					fragment: MediaLocator,
					key: `no ${tva.e_MediaUri}`,
				});
		}
	}

	/**
	 * determines if the identifer provided refers to a valid application launching method
	 *
	 * @param {XMLnode} HowRelated  The service identifier
	 * @returns {boolean} true if this is a valid application launching method else false
	 */
	/*private*/ validServiceApplication(HowRelated) {
		// return true if the HowRelated element has a 	valid CS value for Service Related Applications (A177 5.2.3)
		// urn:dvb:metadata:cs:LinkedApplicationCS:2019
		if (!HowRelated) return false;
		let val = HowRelated.attr(dvbi.a_href) ? HowRelated.attr(dvbi.a_href).value() : null;
		if (!val) return false;
		return validServiceControlApplication(val) || validServiceUnavailableApplication(val);
	}

	/**
	 * verifies if the specified RelatedMaterial element is valid according to specification (contents and location)
	 *
	 * @param {object}  props             Metadata of the XML document
	 * @param {XMLnode} RelatedMaterial   The <RelatedMaterial> element (a libxmls object tree) to be checked
	 * @param {Object}  errs              The class where errors and warnings relating to the service list processing are stored
	 * @param {string}  Location          The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
	 * @param {string}  LocationType      The type of element containing the <RelatedMaterial> element. Different validation rules apply to different location types
	 * @param {string}  errCode           The prefix to use for any errors found
	 * @returns {string} an href value if valid, else ""
	 */
	/*private*/ validateRelatedMaterial(props, RelatedMaterial, errs, Location, LocationType, errCode) {
		let rc = "";
		if (!RelatedMaterial) {
			errs.addError({
				type: APPLICATION,
				code: "RM000",
				message: "validateRelatedMaterial() called with RelatedMaterial==null",
				key: "invalid args",
			});
			return rc;
		}
		checkTopElementsAndCardinality(
			RelatedMaterial,
			[{ name: tva.e_HowRelated }, { name: tva.e_MediaLocator, maxOccurs: Infinity }],
			dvbiEC.RelatedMaterial,
			false,
			errs,
			`${errCode}-1`
		);

		let HowRelated = null,
			MediaLocator = [];
		if (RelatedMaterial.childNodes())
			RelatedMaterial.childNodes().forEachSubElement((elem) => {
				switch (elem.name()) {
					case tva.e_HowRelated:
						HowRelated = elem;
						break;
					case tva.e_MediaLocator:
						MediaLocator.push(elem);
						break;
				}
			});

		if (!HowRelated) {
			errs.addError({
				code: `${errCode}-2`,
				message: `${tva.e_HowRelated.elementize()} not specified for ${tva.e_RelatedMaterial.elementize()} in ${Location}`,
				line: RelatedMaterial.line(),
				key: `no ${tva.e_HowRelated}`,
			});
			return rc;
		}

		checkAttributes(HowRelated, [dvbi.a_href], [], tvaEA.HowRelated, errs, `${errCode}-2`);

		if (HowRelated.attr(dvbi.a_href)) {
			switch (LocationType) {
				case SERVICE_LIST_RM:
					if (this.validServiceListLogo(HowRelated, props.namespace)) {
						rc = HowRelated.attr(dvbi.a_href).value();
						checkValidLogos(RelatedMaterial, errs, `${errCode}-10`, Location, this.knownLanguages);
					} else errs.addError(sl_InvalidHrefValue(HowRelated.attr(dvbi.a_href).value(), HowRelated, tva.e_RelatedMaterial.elementize(), Location, `${errCode}-11`));
					break;
				case SERVICE_RM:
					if (this.validContentFinishedBanner(HowRelated, ANY_NAMESPACE) && SchemaVersion(props.namespace) == SCHEMA_r0)
						errs.addError({
							code: `${errCode}-21`,
							message: `${HowRelated.attr(dvbi.href).value().quote()} not permitted for ${props.namespace.quote()} in ${Location}`,
							key: "invalid CS value",
							fragment: HowRelated,
						});

					if (
						this.validOutScheduleHours(HowRelated, props.namespace) ||
						this.validContentFinishedBanner(HowRelated, props.namespace) ||
						this.validServiceLogo(HowRelated, props.namespace) ||
						this.validServiceBanner(HowRelated, props.namespace)
					) {
						rc = HowRelated.attr(dvbi.a_href).value();

						checkValidLogos(RelatedMaterial, errs, `${errCode}-22`, Location, this.knownLanguages);
					} else if (this.validServiceApplication(HowRelated)) {
						rc = HowRelated.attr(dvbi.a_href).value();
						MediaLocator.forEach((locator) => this.checkSignalledApplication(locator, errs, Location));
					} else errs.addError(sl_InvalidHrefValue(HowRelated.attr(dvbi.a_href).value(), HowRelated, tva.e_RelatedMaterial.elementize(), Location, `${errCode}-24`));
					break;
				case SERVICE_INSTANCE_RM:
					if (this.validContentFinishedBanner(HowRelated, ANY_NAMESPACE) && SchemaVersion(props.namespace) == SCHEMA_r0)
						errs.addError({
							code: `${errCode}-31`,
							message: `${HowRelated.attr(dvbi.href).value().quote()} not permitted for ${props.namespace.quote()} in ${Location}`,
							key: "invalid CS value",
							fragment: HowRelated,
						});

					if (
						this.validOutScheduleHours(HowRelated, props.namespace) ||
						this.validContentFinishedBanner(HowRelated, props.namespace) ||
						this.validServiceLogo(HowRelated, props.namespace)
					) {
						rc = HowRelated.attr(dvbi.a_href).value();
						checkValidLogos(RelatedMaterial, errs, `${errCode}-32`, Location, this.knownLanguages);
					} else if (this.validServiceBanner(HowRelated, props.namespace)) {
						errs.addError({
							code: `${errCode}-33`,
							message: "Service Banner is not permitted in a Service Instance",
							key: "misplaced image type",
							fragment: HowRelated,
						});
					} else if (this.validServiceApplication(HowRelated)) {
						rc = HowRelated.attr(dvbi.a_href).value();
						MediaLocator.forEach((locator) => this.checkSignalledApplication(locator, errs, Location));
					} else errs.addError(sl_InvalidHrefValue(HowRelated.attr(dvbi.a_href).value(), HowRelated, tva.e_RelatedMaterial.elementize(), Location, `${errCode}-24`));
					break;
				case CONTENT_GUIDE_RM:
					if (this.validContentGuideSourceLogo(HowRelated, props.namespace)) {
						rc = HowRelated.attr(dvbi.a_href).value();
						checkValidLogos(RelatedMaterial, errs, `${errCode}-41`, Location, this.knownLanguages);
					} else errs.addError(sl_InvalidHrefValue(HowRelated.attr(dvbi.a_href).value(), HowRelated, tva.e_RelatedMaterial.elementize(), Location, `${errCode}-42`));
					break;
			}
		}
		return rc;
	}

	/**
	 * check if the node provided contains an RelatedMaterial element for a signalled application
	 *
	 * @param {object}  props     Metadata of the XML document
	 * @param {XMLnode} node      The XML tree node (either a <Service>, <TestService> or a <ServiceInstance>) to be checked
	 * @returns {boolean} true if the node contains a <RelatedMaterial> element which signals an application else false
	 */

	/*private*/ hasSignalledApplication(props, node) {
		if (node) {
			let i = 0,
				elem;
			while ((elem = node.get(xPath(props.prefix, tva.e_RelatedMaterial, ++i), props.schema)) != null) {
				let hr = elem.get(xPath(props.prefix, tva.e_HowRelated), props.schema);
				if (hr && this.validServiceApplication(hr)) return true;
			}
		}
		return false;
	}

	/**
	 * perform any validation on a ContentTypeSourceType element
	 *
	 * @param {object}  props         Metadata of the XML document
	 * @param {XMLnode} source        The <ContentGuideSource> element to be checked
	 * @param {Class}   errs          Errors found in validaton
	 * @param {object}  loc			      The 'location' in the XML document of the element being checked, if unspecified then this is set to be the name of the parent element
	 * @param {string}  errCode       Error code prefix to be used in reports
	 */
	/*private*/ validateAContentGuideSource(props, source, errs, loc, errCode) {
		function CheckEndpoint(elementName, suffix, MustEndWithSlash = false) {
			let ep = source.get(xPath(props.prefix, elementName), props.schema);
			if (ep) {
				let epURL = ep.get(xPath(props.prefix, dvbi.e_URI), props.schema);
				if (epURL) {
					if (!isHTTPPathURL(epURL.text()))
						errs.addError({
							code: `${errCode}-${suffix}a`,
							message: `"${epURL.text()}" is not a valid URL path for ${elementName.elementize()}`,
							fragment: ep,
							key: "not URL path",
						});

					if (MustEndWithSlash && !epURL.text().endsWith("/"))
						errs.addError({
							type: WARNING,
							code: `${errCode}-${suffix}b`,
							message: `"${epURL.text()}" should end with a slash '/' for ${elementName.elementize()}`,
							fragment: ep,
							key: "not URL path",
						});
				}

				if (ep.attr(dvbi.a_contentType) && ep.attr(dvbi.a_contentType).value() != XMLdocumentType)
					errs.addError({
						type: WARNING,
						code: `${errCode}-${suffix + 1}`,
						message: `${elementName.elementize(dvbi.a_contentType)} should contain ${XMLdocumentType}`,
						fragment: ep,
						key: `invalid @${dvbi.a_contentType}`,
					});
			}
		}

		if (!source) {
			errs.addError({
				type: APPLICATION,
				code: "GS000",
				message: "validateAContentGuideSource() called with source==null",
			});
			return;
		}
		loc = loc ? loc : source.parent().name().elementize();

		checkXMLLangs(props, dvbi.e_Name, loc, source, errs, `${errCode}-1`, this.knownLanguages);
		checkXMLLangs(props, dvbi.e_ProviderName, loc, source, errs, `${errCode}-2`, this.knownLanguages);

		let rm = 0,
			RelatedMaterial;
		while ((RelatedMaterial = source.get(xPath(props.prefix, tva.e_RelatedMaterial, ++rm), props.schema)) != null)
			this.validateRelatedMaterial(props, RelatedMaterial, errs, loc, CONTENT_GUIDE_RM, `${errCode}-3`);

		// ContentGuideSourceType::ScheduleInfoEndpoint - should be a URL
		CheckEndpoint(dvbi.e_ScheduleInfoEndpoint, 4);

		// ContentGuideSourceType::ProgramInfoEndpoint - should be a URL
		CheckEndpoint(dvbi.e_ProgramInfoEndpoint, 6);

		// ContentGuideSourceType::GroupInfoEndpoint - should be a URL and should end with a /
		CheckEndpoint(dvbi.e_GroupInfoEndpoint, 8, SchemaVersion(props.namespace) >= SCHEMA_r5);

		// ContentGuideSourceType::MoreEpisodesEndpoint - should be a URL
		CheckEndpoint(dvbi.e_MoreEpisodesEndpoint, 10);
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
	/* private */ GetLanguage(validator, errs, node, parentLang, isRequired, errCode) {
		if (!node) return parentLang;
		if (!node.attr(tva.a_lang) && isRequired) {
			errs.addError({
				code: errCode,
				message: `${tva.a_lang.attribute()} is required for ${node.name().quote()}`,
				key: "unspecified language",
				line: node.line(),
			});
			return parentLang;
		}

		if (!node.attr(tva.a_lang)) return parentLang;

		let localLang = node.attr(tva.a_lang).value();
		if (validator && localLang) checkLanguage(validator, localLang, node.name(), node, errs, errCode);
		return localLang;
	}

	/**
	 * validate the SynopsisType elements
	 *
	 * @param {object}  props              Metadata of the XML document
	 * @param {XMLnode} Element            the element whose children should be checked
	 * @param {string}  ElementName        the name of the child element to be checked
	 * @param {array}   requiredLengths	   @length attributes that are required to be present
	 * @param {array}   optionalLengths	   @length attributes that can optionally be present
	 * @param {string}  parentLanguage	   the xml:lang of the parent element
	 * @param {Class}   errs               errors found in validaton
	 * @param {string}  errCode            error code prefix to be used in reports
	 */
	/*private*/ ValidateSynopsisType(props, Element, ElementName, requiredLengths, optionalLengths, parentLanguage, errs, errCode) {
		if (!Element) {
			errs.addError({
				type: APPLICATION,
				code: "SY000",
				message: "ValidateSynopsisType() called with Element==null",
			});
			return;
		}

		let synopsisLengthError = (elem, label, length) => `length of ${elementize(`${tva.a_length.attribute(elem)}=${label.quote()}`)} exceeds ${length} characters`;
		let synopsisToShortError = (elem, label, length) => `length of ${elementize(`${tva.a_length.attribute(elem)}=${label.quote()}`)} is less than ${length} characters`;
		let singleLengthLangError = (elem, length, lang) => `only a single ${elem.elementize()} is permitted per length (${length}) and language (${lang})`;
		let requiredSynopsisError = (elem, length) => `a ${elem.elementize()} element with ${tva.a_length.attribute()}=${quote(length)} is required`;

		let s = 0,
			ste,
			hasBrief = false,
			hasShort = false,
			hasMedium = false,
			hasLong = false,
			hasExtended = false;
		let briefLangs = [],
			shortLangs = [],
			mediumLangs = [],
			longLangs = [],
			extendedLangs = [];
		let ERROR_KEY = "synopsis";
		while ((ste = Element.get(xPath(props.prefix, ElementName, ++s), props.schema)) != null) {
			let synopsisLang = this.GetLanguage(this.knownLanguages, errs, ste, parentLanguage, false, `${errCode}-2`);
			let synopsisLength = ste.attr(tva.a_length) ? ste.attr(tva.a_length).value() : null;

			if (synopsisLength) {
				let cleanSynopsisLength = unEntity(ste.text()).length; // replace ENTITY strings with a generic character
				if (isIn(requiredLengths, synopsisLength) || isIn(optionalLengths, synopsisLength)) {
					switch (synopsisLength) {
						case tva.SYNOPSIS_BRIEF_LABEL:
							if (cleanSynopsisLength > tva.SYNOPSIS_BRIEF_LENGTH)
								errs.addError({
									code: `${errCode}-10`,
									message: synopsisLengthError(ElementName, tva.SYNOPSIS_BRIEF_LABEL, tva.SYNOPSIS_BRIEF_LENGTH),
									fragment: ste,
									key: ERROR_KEY,
								});
							hasBrief = true;
							break;
						case tva.SYNOPSIS_SHORT_LABEL:
							if (cleanSynopsisLength > tva.SYNOPSIS_SHORT_LENGTH)
								errs.addError({
									code: `${errCode}-11`,
									message: synopsisLengthError(ElementName, tva.SYNOPSIS_SHORT_LABEL, tva.SYNOPSIS_SHORT_LENGTH),
									fragment: ste,
									key: ERROR_KEY,
								});
							hasShort = true;
							break;
						case tva.SYNOPSIS_MEDIUM_LABEL:
							if (cleanSynopsisLength > tva.SYNOPSIS_MEDIUM_LENGTH)
								errs.addError({
									code: `${errCode}-12`,
									message: synopsisLengthError(ElementName, tva.SYNOPSIS_MEDIUM_LABEL, tva.SYNOPSIS_MEDIUM_LENGTH),
									fragment: ste,
									key: ERROR_KEY,
								});
							hasMedium = true;
							break;
						case tva.SYNOPSIS_LONG_LABEL:
							if (cleanSynopsisLength > tva.SYNOPSIS_LONG_LENGTH)
								errs.addError({
									code: `${errCode}-13`,
									message: synopsisLengthError(ElementName, tva.SYNOPSIS_LONG_LABEL, tva.SYNOPSIS_LONG_LENGTH),
									fragment: ste,
									key: ERROR_KEY,
								});
							hasLong = true;
							break;
						case tva.SYNOPSIS_EXTENDED_LABEL:
							if (cleanSynopsisLength < tva.SYNOPSIS_LONG_LENGTH)
								errs.addError({
									code: `${errCode}-14`,
									message: synopsisToShortError(ElementName, tva.SYNOPSIS_EXTENDED_LABEL, tva.SYNOPSIS_LONG_LENGTH),
									fragment: ste,
									key: ERROR_KEY,
								});
							hasExtended = true;
							break;
					}
				} else
					errs.addError({
						code: `${errCode}-15`,
						message: `${tva.a_length.attribute()}=${synopsisLength.quote()} is not permitted in ${ElementName.elementize()}`,
						fragment: ste,
						key: ERROR_KEY,
					});
			}

			if (synopsisLang && synopsisLength)
				switch (synopsisLength) {
					case tva.SYNOPSIS_BRIEF_LABEL:
						if (isIn(briefLangs, synopsisLang))
							errs.addError({
								code: `${errCode}-21`,
								message: singleLengthLangError(ElementName, synopsisLength, synopsisLang),
								fragment: ste,
								key: ERROR_KEY,
							});
						else briefLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_SHORT_LABEL:
						if (isIn(shortLangs, synopsisLang))
							errs.addError({
								code: `${errCode}-22`,
								message: singleLengthLangError(ElementName, synopsisLength, synopsisLang),
								fragment: ste,
								key: ERROR_KEY,
							});
						else shortLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_MEDIUM_LABEL:
						if (isIn(mediumLangs, synopsisLang))
							errs.addError({
								code: `${errCode}-23`,
								message: singleLengthLangError(ElementName, synopsisLength, synopsisLang),
								fragment: ste,
								key: ERROR_KEY,
							});
						else mediumLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_LONG_LABEL:
						if (isIn(longLangs, synopsisLang))
							errs.addError({
								code: `${errCode}-24`,
								message: singleLengthLangError(ElementName, synopsisLength, synopsisLang),
								fragment: ste,
								key: ERROR_KEY,
							});
						else longLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_EXTENDED_LABEL:
						if (isIn(extendedLangs, synopsisLang))
							errs.addError({
								code: `${errCode}-25`,
								message: singleLengthLangError(ElementName, synopsisLength, synopsisLang),
								fragment: ste,
								key: ERROR_KEY,
							});
						else extendedLangs.push(synopsisLang);
						break;
				}
		}

		if (isIn(requiredLengths, tva.SYNOPSIS_BRIEF_LABEL) && !hasBrief)
			errs.addError({
				code: `${errCode}-31`,
				message: requiredSynopsisError(tva.SYNOPSIS_BRIEF_LABEL),
				fragment: Element,
				key: ERROR_KEY,
			});
		if (isIn(requiredLengths, tva.SYNOPSIS_SHORT_LABEL) && !hasShort)
			errs.addError({
				code: `${errCode}-32`,
				message: requiredSynopsisError(tva.SYNOPSIS_SHORT_LABEL),
				fragment: Element,
				key: ERROR_KEY,
			});
		if (isIn(requiredLengths, tva.SYNOPSIS_MEDIUM_LABEL) && !hasMedium)
			errs.addError({
				code: `${errCode}-33`,
				message: requiredSynopsisError(tva.SYNOPSIS_MEDIUM_LABEL),
				fragment: Element,
				key: ERROR_KEY,
			});
		if (isIn(requiredLengths, tva.SYNOPSIS_LONG_LABEL) && !hasLong)
			errs.addError({
				code: `${errCode}-34`,
				message: requiredSynopsisError(tva.SYNOPSIS_LONG_LABEL),
				fragment: Element,
				key: ERROR_KEY,
			});
		if (isIn(requiredLengths, tva.SYNOPSIS_EXTENDED_LABEL) && !hasExtended)
			errs.addError({
				code: `${errCode}-35`,
				message: requiredSynopsisError(tva.SYNOPSIS_EXTENDED_LABEL),
				fragment: Element,
				key: ERROR_KEY,
			});
	}

	/**
	 * validate a ServiceInstance element
	 *
	 * @param {object}  props                         Metadata of the XML document
	 * @param {XMLnode} ServiceInstance               the service instance element to check
	 * @param {string}  thisServiceId                 the identifier of the service
	 * @param {array}   declaredSubscriptionPackages  subscription packages that are declared in the service list
	 * @param {Class}   errs                          errors found in validaton
	 */
	/*private*/ validateServiceInstance(props, ServiceInstance, thisServiceId, declaredSubscriptionPackages, errs) {
		if (!ServiceInstance) {
			errs.addError({
				type: APPLICATION,
				code: "SI000",
				key: "validateServiceInstance() called with ServiceInstance==null",
			});
			return;
		}

		function checkMulticastDeliveryParams(params, errs, errCode) {
			let IPMulticastAddress = params.get(xPath(props.prefix, dvbi.e_IPMulticastAddress), props.schema);
			if (IPMulticastAddress) {
				let CNAME = IPMulticastAddress.get(xPath(props.prefix, dvbi.e_CNAME), props.schema);
				if (CNAME && !isDomainName(CNAME.text()))
					errs.addError({
						code: `${errCode}-1`,
						message: `${dvbi.e_IPMulticastAddress.elementize()}${dvbi.e_CNAME.elementize()} is not a valid domain name for use as a CNAME`,
						fragment: CNAME,
						key: "invalid CNAME",
					});
			}
		}

		let hasDeliveryParameters = (instance, PREFIX, SCHEMA) =>
			instance.get(xPath(PREFIX, dvbi.e_DVBTDeliveryParameters), SCHEMA) ||
			instance.get(xPath(PREFIX, dvbi.e_DVBSDeliveryParameters), SCHEMA) ||
			instance.get(xPath(PREFIX, dvbi.e_DVBCDeliveryParameters), SCHEMA) ||
			instance.get(xPath(PREFIX, dvbi.e_DASHDeliveryParameters), SCHEMA) ||
			instance.get(xPath(PREFIX, dvbi.e_SATIPDeliveryParametersDeliveryParameters), SCHEMA) ||
			instance.get(xPath(PREFIX, dvbi.e_MulticastTSDeliveryParameters), SCHEMA) ||
			instance.get(xPath(PREFIX, dvbi.e_RTSPDeliveryParameters), SCHEMA);

		//<ServiceInstance@priority>
		if (SchemaVersion(props.namespace) <= SCHEMA_r4) {
			if (ServiceInstance.attr(dvbi.a_priority) && ServiceInstance.attr(dvbi.a_priority).value() < 0)
				errs.addError({
					code: "SI011",
					message: `${dvbi.a_priority.attribute(dvbi.e_ServiceInstance)} should not be negative`,
					line: ServiceInstance.attr(dvbi.a_priority).line(),
					key: `negative ${dvbi.a_priority.attribute()}`,
				});
		}

		//<ServiceInstance><DisplayName>
		checkXMLLangs(props, dvbi.e_DisplayName, `service instance in service=${thisServiceId.quote()}`, ServiceInstance, errs, "SI010", this.knownLanguages);

		// check @href of <ServiceInstance><RelatedMaterial>
		let rm = 0,
			controlApps = [],
			RelatedMaterial;
		while ((RelatedMaterial = ServiceInstance.get(xPath(props.prefix, tva.e_RelatedMaterial, ++rm), props.schema)) != null) {
			let foundHref = this.validateRelatedMaterial(props, RelatedMaterial, errs, `service instance of ${thisServiceId.quote()}`, SERVICE_INSTANCE_RM, "SI020");
			if (foundHref != "" && validServiceControlApplication(foundHref)) controlApps.push(RelatedMaterial);
			if (foundHref == dvbi.APP_IN_CONTROL) {
				//Application controlling playback SHOULD NOT have any service delivery parameters
				if (SchemaVersion(props.namespace) >= SCHEMA_r5 && hasDeliveryParameters(ServiceInstance, props.prefix, props.schema)) {
					errs.addError({
						type: WARNING,
						code: "SI022",
						message: "Delivery parameters are ignored when application controls media playback",
						fragment: RelatedMaterial,
						key: "unnecessary delivery",
					});
				}
			}
		}
		if (controlApps.length > 1)
			controlApps.forEach((app) => {
				errs.addError({
					code: "SI021",
					message: "only a single service control application can be signalled in a service instance",
					fragment: app,
					key: "multi apps",
				});
			});

		// <ServiceInstance><ContentProtection>

		// <ServiceInstance><ContentAttributes>
		let ContentAttributes = ServiceInstance.get(xPath(props.prefix, dvbi.e_ContentAttributes), props.schema);
		if (ContentAttributes) {
			// Check ContentAttributes/AudioAttributes - other subelements are checked with schema based validation
			let cp = 0,
				conf;
			while ((conf = ContentAttributes.get(xPath(props.prefix, tva.e_AudioAttributes, ++cp), props.schema)) != null)
				if (conf.childNodes())
					conf.childNodes().forEachSubElement((child) => {
						switch (child.name()) {
							case tva.e_Coding:
								if (child.attr(dvbi.a_href) && !this.allowedAudioSchemes.isIn(child.attr(dvbi.a_href).value()))
									errs.addError({
										code: "SI052",
										message: `invalid ${dvbi.a_href.attribute(child.name())} value for (${child.attr(dvbi.a_href).value()}) ${this.allowedAudioSchemes.valuesRange()}`,
										fragment: child,
										key: "audio codec",
									});
								break;
							case tva.e_MixType:
								// taken from MPEG-7 AudioPresentationCS
								if (child.attr(dvbi.a_href) && !this.AudioPresentationCSvalues.isIn(child.attr(dvbi.a_href).value()))
									errs.addError({
										code: "SI055",
										message: `invalid ${dvbi.a_href.attribute(child.name())} value for (${child.attr(dvbi.a_href).value()}) ${this.AudioPresentationCSvalues.valuesRange()}`,
										fragment: child,
										key: "audio codec",
									});
								break;
						}
					});

			// Check @href of ContentAttributes/AudioConformancePoints
			cp = 0;
			while ((conf = ContentAttributes.get(xPath(props.prefix, dvbi.e_AudioConformancePoint, ++cp), props.schema)) != null) {
				if (SchemaVersion(props.namespace) > SCHEMA_r4)
					// Issue #10
					errs.addError({
						type: WARNING,
						code: "SI062",
						message: `use of ${dvbi.e_AudioConformancePoint.elementize()} is deprecated`,
						fragment: conf,
						key: "deprecated feature",
					});

				if (conf.attr(dvbi.a_href) && !this.allowedAudioConformancePoints.isIn(conf.attr(dvbi.a_href).value()))
					errs.addError({
						code: "SI061",
						message: `invalid ${dvbi.a_href.attribute(dvbi.e_AudioConformancePoint)} (${conf.attr(dvbi.a_href).value()}) ${this.allowedAudioConformancePoints.valuesRange()}`,
						fragment: conf,
						key: "audio conf point",
					});
			}

			// Check ContentAttributes/VideoAttributes - other subelements are checked with schema based validation
			cp = 0;
			while ((conf = ContentAttributes.get(xPath(props.prefix, tva.e_VideoAttributes, ++cp), props.schema)) != null)
				if (conf.childNodes())
					conf.childNodes().forEachSubElement((child) => {
						switch (child.name()) {
							case tva.e_Coding:
								if (child.attr(dvbi.a_href) && !this.allowedVideoSchemes.isIn(child.attr(dvbi.a_href).value()))
									errs.addError({
										code: "SI072",
										message: `invalid ${dvbi.a_href.attribute(tva.e_Coding)} (${child.attr(dvbi.a_href).value()}) ${this.allowedVideoSchemes.valuesRange()}`,
										fragment: child,
										key: "video codec",
									});
								break;
							case tva.e_PictureFormat:
								if (child.attr(dvbi.a_href) && !this.allowedPictureFormats.isIn(child.attr(dvbi.a_href).value()))
									errs.addError({
										code: "SI082",
										message: `invalid ${dvbi.a_href.attribute(tva.e_PictureFormat)} value (${child.attr(dvbi.a_href).value()}) ${this.allowedPictureFormats.valuesRange()}`,
										fragment: child,
										key: tva.e_PictureFormat,
									});
								break;
							case dvbi.e_Colorimetry:
								if (child.attr(dvbi.a_href) && !this.allowedColorimetry.isIn(child.attr(dvbi.a_href).value()))
									errs.addError({
										code: "SI084",
										message: `invalid ${dvbi.a_href.attribute(dvbi.e_Colorimetry)} value (${child.attr(dvbi.a_href).value()}) ${this.allowedColorimetry.valuesRange()}`,
										fragment: child,
										key: dvbi.e_Colorimetry,
									});
								break;
						}
					});

			// Check @href of ContentAttributes/VideoConformancePoints
			cp = 0;
			while ((conf = ContentAttributes.get(xPath(props.prefix, dvbi.e_VideoConformancePoint, ++cp), props.schema)) != null)
				if (conf.attr(dvbi.a_href) && !this.allowedVideoConformancePoints.isIn(conf.attr(dvbi.a_href).value()))
					errs.addError({
						code: "SI091",
						message: `invalid ${dvbi.a_href.attribute(dvbi.e_VideoConformancePoint)} value (${conf.attr(dvbi.a_href).value()}) ${this.allowedVideoConformancePoints.valuesRange()}`,
						fragment: conf,
						key: "video conf point",
					});

			// Check ContentAttributes/CaptionLanguage
			cp = 0;
			while ((conf = ContentAttributes.get(xPath(props.prefix, tva.e_CaptionLanguage, ++cp), props.schema)) != null)
				checkLanguage(this.knownLanguages, conf.text(), tva.e_CaptionLanguage.elementize(), conf, errs, "SI101");

			// Check ContentAttributes/SignLanguage
			cp = 0;
			while ((conf = ContentAttributes.get(xPath(props.prefix, tva.e_SignLanguage, ++cp), props.schema)) != null)
				checkLanguage(this.knownLanguages, conf.text(), tva.e_SignLanguage.elementize(), conf, errs, "SI111");
		}

		// <ServiceInstance><Availability>
		let Availability = ServiceInstance.get(xPath(props.prefix, dvbi.e_Availability), props.schema);
		if (Availability) {
			let Period,
				p = 0;
			while ((Period = Availability.get(xPath(props.prefix, dvbi.e_Period, ++p), props.schema)) != null)
				if (Period.attr(dvbi.a_validFrom) && Period.attr(dvbi.a_validTo)) {
					// validTo should be >= validFrom
					let fr = new Date(Period.attr(dvbi.a_validFrom).value()),
						to = new Date(Period.attr(dvbi.a_validTo).value());

					if (to.getTime() < fr.getTime())
						errs.addError({
							code: "SI124",
							message: `invalid availability period for service ${thisServiceId.quote()}. ${fr}>${to}`,
							fragment: Period,
							key: "period start>end",
						});
				}
		}

		// <ServiceInstance><SubscriptionPackage>
		checkXMLLangs(props, dvbi.e_SubscriptionPackage, ServiceInstance.name().elementize(), ServiceInstance, errs, "SI131", this.knownLanguages);
		let sp = 0,
			SubscriptionPackage;
		while ((SubscriptionPackage = ServiceInstance.get(xPath(props.prefix, dvbi.e_SubscriptionPackage, ++sp), props.schema)) != null) {
			if (SchemaVersion(props.namespace) >= SCHEMA_r3) {
				let pkg = localizedSubscriptionPackage(SubscriptionPackage);
				if (!declaredSubscriptionPackages.includes(pkg))
					errs.addError({
						code: "SI130",
						message: `${dvbi.e_SubscriptionPackage.elementize()}="${pkg}" is not declared in ${dvbi.e_SubscriptionPackageList.elementize()}`,
						fragment: SubscriptionPackage,
						key: `undeclared ${dvbi.e_SubscriptionPackage}`,
					});
			}
		}

		// <ServiceInstance><FTAContentManagement>

		// note that the <SourceType> element becomes optional and in A177v2, but if specified then the relevant
		// delivery parameters also need to be specified
		let SourceType = ServiceInstance.get(xPath(props.prefix, dvbi.e_SourceType), props.schema);
		if (SourceType) {
			let v1Params = false;
			switch (SourceType.text()) {
				case dvbi.DVBT_SOURCE_TYPE:
					if (!ServiceInstance.get(xPath(props.prefix, dvbi.e_DVBTDeliveryParameters), props.schema)) errs.addError(NoDeliveryParams("DVB-T", thisServiceId, SourceType, "SI151"));
					v1Params = true;
					break;
				case dvbi.DVBS_SOURCE_TYPE:
					if (!ServiceInstance.get(xPath(props.prefix, dvbi.e_DVBSDeliveryParameters), props.schema)) errs.addError(NoDeliveryParams("DVB-S", thisServiceId, SourceType, "SI152"));
					v1Params = true;
					break;
				case dvbi.DVBC_SOURCE_TYPE:
					if (!ServiceInstance.get(xPath(props.prefix, dvbi.e_DVBCDeliveryParameters), props.schema)) errs.addError(NoDeliveryParams("DVB-C", thisServiceId, SourceType, "SI153"));
					v1Params = true;
					break;
				case dvbi.DVBDASH_SOURCE_TYPE:
					if (!ServiceInstance.get(xPath(props.prefix, dvbi.e_DASHDeliveryParameters), props.schema))
						errs.addError(NoDeliveryParams("DVB-DASH", thisServiceId, SourceType, "SI154"));
					v1Params = true;
					break;
				case dvbi.DVBIPTV_SOURCE_TYPE:
					if (
						!ServiceInstance.get(xPath(props.prefix, dvbi.e_MulticastTSDeliveryParameters), props.schema) &&
						!ServiceInstance.get(xPath(props.prefix, dvbi.e_RTSPDeliveryParameters), props.schema)
					)
						errs.addError(NoDeliveryParams("Multicast or RTSP", thisServiceId, SourceType, "SI155"));
					v1Params = true;
					break;
				case dvbi.DVBAPPLICATION_SOURCE_TYPE:
					// there should not be any <xxxxDeliveryParameters> elements and there should be either a Service.RelatedMaterial or Service.ServiceInstance.RelatedMaterial signalling a service related application
					if (hasDeliveryParameters(ServiceInstance, props.prefix, props.schema)) {
						errs.addError({
							code: "SI156",
							message: `Delivery parameters are not permitted for Application service instance in Service ${thisServiceId.quote()}`,
							fragment: SourceType,
							key: "invalid application",
						});
						v1Params = true;
					} else {
						// no xxxxDeliveryParameters is signalled
						// check for appropriate Service.RelatedMaterial or Service.ServiceInstance.RelatedMaterial
						let service = ServiceInstance.parent();
						if (!this.hasSignalledApplication(props.schema, props.prefix, service) && !this.hasSignalledApplication(props.schema, props.prefix, ServiceInstance)) {
							errs.addError({
								code: "SI157a",
								message: `No Application is signalled for ${dvbi.e_SourceType}=${dvbi.DVBAPPLICATION_SOURCE_TYPE.quote()} in Service ${thisServiceId.quote()}`,
								line: service.line(),
								key: "no application",
							});
							errs.addError({
								code: "SI157b",
								message: `No Application is signalled for ${dvbi.e_SourceType}=${dvbi.DVBAPPLICATION_SOURCE_TYPE.quote()} in ServiceInstance ${thisServiceId.quote()}`,
								line: ServiceInstance.line(),
								key: "no application",
							});
						}
					}
					break;
				default:
					switch (SchemaVersion(props.namespace)) {
						case SCHEMA_r0:
							errs.addError({
								code: "SI158",
								message: `${dvbi.e_SourceType.elementize()} ${SourceType.text().quote()} is not valid in Service ${thisServiceId.quote()}`,
								fragment: SourceType,
								key: `invalid ${dvbi.e_SourceType}`,
							});
							break;
						case SCHEMA_r1:
						case SCHEMA_r2:
						case SCHEMA_r3:
						case SCHEMA_r4:
						case SCHEMA_r5:
							if (!ServiceInstance.get(xPath(props.prefix, dvbi.e_OtherDeliveryParameters), props.schema))
								errs.addError({
									code: "SI159",
									message: `${dvbi.e_OtherDeliveryParameters.elementize()} must be specified with user-defined ${dvbi.e_SourceType} ${SourceType.text().quote()}`,
									line: ServiceInstance.line(),
									key: `no ${dvbi.e_OtherDeliveryParameters}`,
								});
							break;
					}
			}
			if (v1Params && SchemaVersion(props.namespace) >= SCHEMA_r1)
				errs.addError({
					type: WARNING,
					code: "SI160",
					message: `${dvbi.e_SourceType.elementize()} is deprecated in this version (service ${thisServiceId.quote()})`,
					fragment: SourceType,
					key: "deprecated feature",
				});
		} else {
			if (SchemaVersion(props.namespace) == SCHEMA_r0)
				errs.addError({
					code: "SI161",
					message: `${dvbi.e_SourceType.elementize()} not specified in ${dvbi.e_ServiceInstance.elementize()} of service ${thisServiceId.quote()}`,
					key: `no ${dvbi.e_SourceType}`,
				});
		}

		// <ServiceInstance><AltServiceName>
		let alternateNames = [],
			altSN,
			alt = 0;
		while ((altSN = ServiceInstance.get(xPath(props.prefix, dvbi.e_AltServiceName, ++alt), props.schema)) != null) {
			if (alternateNames.includes(altSN.text()))
				errs.addError({
					type: WARNING,
					code: "SI165",
					fragment: altSN,
					message: `${dvbi.e_AltServiceName}=${altSN.text().quote} already specificed in ${dvbi.e_ServiceInstance.elementize()} of service ${thisServiceId.quote()}`,
					key: "duplicate name",
				});
			else alternateNames.push(altSN.text());
		}

		// <ServiceInstance><DASHDeliveryParameters>
		let DASHDeliveryParameters = ServiceInstance.get(xPath(props.prefix, dvbi.e_DASHDeliveryParameters), props.schema);
		if (DASHDeliveryParameters) {
			let URIBasedLocation = DASHDeliveryParameters.get(xPath(props.prefix, dvbi.e_UriBasedLocation), props.schema);
			if (URIBasedLocation) {
				let uriContentType = URIBasedLocation.attr(dvbi.a_contentType);
				if (uriContentType && !validDASHcontentType(uriContentType.value()))
					errs.addError({
						code: "SI173",
						fragment: URIBasedLocation,
						message: `${dvbi.a_contentType.attribute()}=${uriContentType.value().quote()} in service ${thisServiceId.quote()} is not valid`,
						key: `no ${dvbi.a_contentType.attribute()} for DASH`,
					});

				let uri = URIBasedLocation.get(xPath(props.prefix, dvbi.e_URI), props.schema);
				if (uri && !isHTTPURL(uri.text()))
					errs.addError({
						code: "SI174",
						message: `invalid URL ${uri.text().quote()} specified for ${dvbi.e_URI.elementize()} of service ${thisServiceId.quote()}`,
						fragment: uri,
						key: "invalid resource URL",
					});
			}

			// <DASHDeliveryParameters><MulticastTSDeliveryParameters>
			let MulticastTSDeliveryParameters = DASHDeliveryParameters.get(xPath(props.prefix, dvbi.e_MulticastTSDeliveryParameters), props.schema);
			if (MulticastTSDeliveryParameters) {
				checkMulticastDeliveryParams(MulticastTSDeliveryParameters, errs, "SI176");
			}

			// <DASHDeliveryParameters><Extension>
			let e = 0,
				Extension;
			while ((Extension = DASHDeliveryParameters.get(xPath(props.prefix, dvbi.e_Extension, ++e), props.schema)) != null) {
				this.CheckExtension(Extension, EXTENSION_LOCATION_DASH_INSTANCE, errs, "SI175");
			}
		}

		// <ServiceInstance><DVBTDeliveryParameters>
		let DVBTDeliveryParameters = ServiceInstance.get(xPath(props.prefix, dvbi.e_DVBTDeliveryParameters), props.schema);
		if (DVBTDeliveryParameters) {
			let DVBTtargetCountry = DVBTDeliveryParameters.get(xPath(props.prefix, dvbi.e_TargetCountry), props.schema);
			if (DVBTtargetCountry && !this.knownCountries.isISO3166code(DVBTtargetCountry.text()))
				errs.addError({
					code: "SI182",
					message: InvalidCountryCode(DVBTtargetCountry.text(), "DVB-T", `service ${thisServiceId.quote()}`),
					fragment: DVBTtargetCountry,
					key: "invalid country code",
				});
		}

		// <ServiceInstance><DVBCDeliveryParameters>
		let DVBCDeliveryParameters = ServiceInstance.get(xPath(props.prefix, dvbi.e_DVBCDeliveryParameters), props.schema);
		if (DVBCDeliveryParameters) {
			let DVBCtargetCountry = ServiceInstance.get(xPathM(props.prefix, [dvbi.e_DVBCDeliveryParameters, dvbi.e_TargetCountry]), props.schema);
			if (DVBCtargetCountry && !this.knownCountries.isISO3166code(DVBCtargetCountry.text()))
				errs.addError({
					code: "SI191",
					message: InvalidCountryCode(DVBCtargetCountry.text(), "DVB-C", `service ${thisServiceId.quote()}`),
					fragment: DVBCtargetCountry,
					key: "invalid country code",
				});
		}

		// <ServiceInstance><DVBSDeliveryParameters>
		// checked by schema validation

		// <ServiceInstance><SATIPDeliveryParameters>
		// SAT-IP Delivery Parameters can only exist if DVB-T or DVB-S delivery parameters are specified
		// checked by schema validation

		// <ServiceInstance><RTSPDeliveryParameters>
		let RTSPDeliveryParameters = ServiceInstance.get(xPath(props.prefix, dvbi.e_RTSPDeliveryParameters), props.schema);
		if (RTSPDeliveryParameters) {
			let RTSPURL = RTSPDeliveryParameters.get(xPath(props.prefix, dvbi.e_RTSPURL), props.schema);
			if (RTSPURL && !isRTSPURL(RTSPURL.text()))
				errs.addError({
					code: "SI223",
					message: `${RTSPURL.text().quote()} is not a valid RTSP URL`,
					fragment: RTSPURL,
					key: "invalid URL",
				});
		}

		// <ServiceInstance><MulticastTSDeliveryParameters>
		let MulticastTSDeliveryParameters = ServiceInstance.get(xPath(props.prefix, dvbi.e_MulticastTSDeliveryParameters), props.schema);
		if (MulticastTSDeliveryParameters) {
			checkMulticastDeliveryParams(MulticastTSDeliveryParameters, errs, "SI235");
		}

		// <ServiceInstance><OtherDeliveryParameters>
		let OtherDeliveryParameters = ServiceInstance.get(xPath(props.prefix, dvbi.e_OtherDeliveryParameters), props.schema);
		if (OtherDeliveryParameters) {
			this.CheckExtension(OtherDeliveryParameters, EXTENSION_LOCATION_OTHER_DELIVERY, errs, "SI237");
		}
	}

	/*private*/ CheckExtension(extn, extLoc, errs, errCode) {
		if (!extn) {
			errs.addError({
				type: APPLICATION,
				code: "CE000",
				message: "CheckExtension() called with extn=null",
			});
			return;
		}
		// extension type is checked in schema validation

		if (extn.attr(dvbi.a_extensionName)) {
			const where = (extension, location) => `${extension} extension only premitted in ${location}`;
			switch (extn.attr(dvbi.a_extensionName).value()) {
				case "DVB-HB":
					if (extLoc != EXTENSION_LOCATION_SERVICE_LIST_REGISTRY)
						errs.addError({
							code: `${errCode}-1`,
							message: where("DVB-HB", "Service List Registry"),
							fragment: extn,
							key: "extensability",
						});
					break;
				case "urn:hbbtv:dvbi:service:serviceIdentifierTriplet":
					if (extLoc != EXTENSION_LOCATION_SERVICE_ELEMENT)
						errs.addError({
							code: `${errCode}-2`,
							message: where("HbbTV", "Service List"),
							fragment: extn,
							key: "extensability",
						});
					break;
				case "vnd.apple.mpegurl":
					if (extLoc != EXTENSION_LOCATION_OTHER_DELIVERY)
						errs.addError({
							code: `${errCode}-3`,
							message: where("HLS", "Service List"),
							fragment: extn,
							key: "extensability",
						});
					break;
				default:
					errs.addError({
						type: WARNING,
						code: `${errCode}-100`,
						key: "unknown extension",
						fragment: extn,
						message: `extenstion "${extn.attr(dvbi.a_extensionName).value()}" is not known to this tool`,
					});
			}
		}
	}

	/**
	 * validate a Service or TestService element
	 *
	 * @param {object}  props                         Metadata of the XML document
	 * @param {XMLnode} SL                            the <ServiceList> being checked
	 * @param {XMLnode} service                       the service or testservice element to check
	 * @param {string}  thisServiceId                 the identifier of the service
	 * @param {array}   knownServices                 services found and checked thus far
	 * @param {array}   knownRegionIDs                regions identifiers from the RegionList
	 * @param {array}   declaredSubscriptionPackages  subscription packages that are declared in the service list
	 * @param {array}   ContentGuideSourceIDs         identifiers of content guide sources found in the service list
	 * @param {Class}   errs                          errors found in validaton
	 */
	/*private*/ validateService(props, SL, service, thisServiceId, knownServices, knownRegionIDs, declaredSubscriptionPackages, ContentGuideSourceIDs, errs) {
		// check <UniqueIdentifier>
		let uID = service.get(xPath(props.prefix, dvbi.e_UniqueIdentifier), props.schema);
		if (uID) {
			thisServiceId = uID.text();
			if (!validServiceIdentifier(thisServiceId))
				errs.addError({
					code: "SL110",
					message: `${thisServiceId.quote()} is not a valid service identifier`,
					fragment: uID,
					key: "invalid tag",
				});
			if (!uniqueServiceIdentifier(thisServiceId, knownServices))
				errs.addError({
					code: "SL111",
					message: `${thisServiceId.quote()} is not unique`,
					key: "non unique id",
					fragment: uID,
				});
			knownServices.push(thisServiceId);
		}

		//check <ServiceInstance>
		let si = 0,
			ServiceInstance;
		while ((ServiceInstance = service.get(xPath(props.prefix, dvbi.e_ServiceInstance, ++si), props.schema)) != null)
			this.validateServiceInstance(props, ServiceInstance, thisServiceId, declaredSubscriptionPackages, errs);

		//check <TargetRegion>
		let tr = 0,
			TargetRegion;
		while ((TargetRegion = service.get(xPath(props.prefix, dvbi.e_TargetRegion, ++tr), props.schema)) != null) {
			let found = knownRegionIDs.find((r) => r.region == TargetRegion.text());
			if (found == undefined) errs.addError(UnspecifiedTargetRegion(TargetRegion.text(), `service ${thisServiceId.quote()}`, "SL130"));
			else found.used = true;
		}

		//check <ServiceName>
		checkXMLLangs(props, dvbi.e_ServiceName, `service ${thisServiceId.quote()}`, service, errs, "SL140", this.knownLanguages);

		//check <ProviderName>
		checkXMLLangs(props, dvbi.e_ProviderName, `service ${thisServiceId.quote()}`, service, errs, "SL141", this.knownLanguages);

		//check <RelatedMaterial>
		let rm = 0,
			RelatedMaterial;
		while ((RelatedMaterial = service.get(xPath(props.prefix, tva.e_RelatedMaterial, ++rm), props.schema)) != null)
			this.validateRelatedMaterial(props, RelatedMaterial, errs, `service ${thisServiceId.quote()}`, SERVICE_RM, "SL150");

		//check <ServiceGenre>
		let ServiceGenre = service.get(xPath(props.prefix, dvbi.e_ServiceGenre), props.schema);
		if (ServiceGenre) {
			checkAttributes(ServiceGenre, [tva.a_href], [tva.a_type], tvaEA.Genre, errs, "SL160");
			if (ServiceGenre.attr(tva.a_type))
				if (!isIn(tva.ALL_GENRE_TYPES, ServiceGenre.attr(tva.a_type).value()))
					errs.addError({
						code: "SL161",
						message: `service ${thisServiceId.quote()} has an invalid ${dvbi.a_href.attribute(dvbi.e_ServiceGenre)} type ${ServiceGenre.attr(dvbi.a_href).value().quote()}`,
						fragment: ServiceGenre,
						key: `invalid ${dvbi.e_ServiceGenre} type`,
					});

			if (ServiceGenre.attr(dvbi.a_href)) {
				let genre = ServiceGenre.attr(dvbi.a_href).value();
				if (!this.allowedGenres.isIn(genre))
					errs.addError({
						code: "SL162",
						message: `service ${thisServiceId.quote()} has an invalid ${dvbi.a_href.attribute(dvbi.e_ServiceGenre)} value ${genre} (must be content genre)`,
						fragment: ServiceGenre,
						key: `invalid ${dvbi.e_ServiceGenre}`,
					});
			}
		}
		//check <ServiceType>
		let ServiceType = service.get(xPath(props.prefix, dvbi.e_ServiceType), props.schema);
		if (ServiceType && ServiceType.attr(dvbi.a_href) && !this.allowedServiceTypes.isIn(ServiceType.attr(dvbi.a_href).value()))
			errs.addError({
				code: "SL164",
				message: `service ${thisServiceId.quote()} has an invalid ${dvbi.e_ServiceType.elementize()} (${ServiceType.attr(dvbi.a_href).value()})`,
				fragment: ServiceType,
				key: `invalid ${dvbi.e_ServiceType}`,
			});

		// check <ServiceDescription>
		this.ValidateSynopsisType(
			props,
			service,
			dvbi.e_ServiceDescription,
			[],
			[tva.SYNOPSIS_BRIEF_LABEL, tva.SYNOPSIS_SHORT_LABEL, tva.SYNOPSIS_MEDIUM_LABEL, tva.SYNOPSIS_LONG_LABEL, tva.SYNOPSIS_EXTENDED_LABEL],
			"***",
			errs,
			"SL170"
		);

		// check <RecordingInfo>
		let RecordingInfo = service.get(xPath(props.prefix, dvbi.e_RecordingInfo), props.schema);
		if (RecordingInfo && RecordingInfo.attr(dvbi.a_href) && !this.RecordingInfoCSvalues.isIn(RecordingInfo.attr(dvbi.a_href).value()))
			errs.addError({
				code: "SL180",
				message: `invalid ${dvbi.e_RecordingInfo.elementize()} value ${RecordingInfo.attr(dvbi.a_href)
					.value()
					.quote()} for service ${thisServiceId} ${this.RecordingInfoCSvalues.valuesRange()}`,
				fragment: RecordingInfo,
				key: `invalid ${dvbi.e_RecordingInfo}`,
			});

		// check <ContentGuideSource>
		let sCG = service.get(xPath(props.prefix, dvbi.e_ContentGuideSource), props.schema);
		if (sCG) this.validateAContentGuideSource(props, sCG, errs, `${dvbi.e_ContentGuideSource.elementize()} in service ${thisServiceId}`, "SL190");

		//check <ContentGuideSourceRef>
		let sCGref = service.get(xPath(props.prefix, dvbi.e_ContentGuideSourceRef), props.schema);
		if (sCGref && !isIn(ContentGuideSourceIDs, sCGref.text()))
			errs.addError({
				code: "SL200",
				message: `content guide reference ${sCGref.text().quote()} for service ${thisServiceId.quote()} not specified`,
				fragment: sCGref,
				key: "unspecified content guide source",
			});

		// check <AdditionalServiceParameters>
		let ap = 0,
			AdditionalParams;
		while ((AdditionalParams = service.get(xPath(props.prefix, dvbi.e_AdditionalServiceParameters, ++ap), props.schema)) != null)
			this.CheckExtension(AdditionalParams, EXTENSION_LOCATION_SERVICE_ELEMENT, errs, "SL211");

		// check <NVOD>
		let NVOD = service.get(xPath(props.prefix, dvbi.e_NVOD), props.schema);
		if (NVOD) {
			if (NVOD.attr(dvbi.a_mode) && NVOD.attr(dvbi.a_mode).value() == dvbi.NVOD_MODE_REFERENCE) {
				if (NVOD.attr(dvbi.a_reference))
					errs.addError({
						code: "SL221",
						message: `${dvbi.a_reference.attribute()} is not permitted for ${dvbi.a_mode.attribute(dvbi.e_NVOD)}="${dvbi.NVOD_MODE_REFERENCE}"`,
						fragment: NVOD,
						key: "unallowed attribute",
					});
				if (NVOD.attr(dvbi.a_offset))
					errs.addError({
						code: "SL222",
						message: `${dvbi.a_offset.attribute()} is not permitted for ${dvbi.a_mode.attribute(dvbi.e_NVOD)}="${dvbi.NVOD_MODE_REFERENCE}"`,
						fragment: NVOD,
						key: "unallowed attribute",
					});
			}
			if (NVOD.attr(dvbi.a_mode) && NVOD.attr(dvbi.a_mode).value() == dvbi.NVOD_MODE_TIMESHIFTED) {
				checkAttributes(NVOD, [dvbi.a_mode, dvbi.a_reference], [dvbi.a_offset], dvbEA.NVOD, errs, "SL223");

				if (NVOD.attr(dvbi.a_reference)) {
					// check to see if there is a service whose <UniqueIdentifier> equals NVOD@reference and has a NVOD@mode==reference
					let s2 = 0,
						service2,
						referredService = null;

					while ((service2 = SL.get(xPath(props.prefix, dvbi.e_Service, ++s2), props.schema)) != null && !referredService) {
						let ui = service2.get(xPath(props.prefix, dvbi.e_UniqueIdentifier), props.schema);
						if (ui && ui.text() == NVOD.attr(dvbi.a_reference).value()) referredService = service2;
					}
					if (!referredService)
						errs.addError({
							code: "SL224",
							message: `no service found with ${dvbi.e_UniqueIdentifier.elementize()}="${NVOD.attr(dvbi.a_reference).value()}"`,
							fragment: NVOD,
							key: "NVOD timeshift",
						});
					else {
						let refNVOD = referredService.get(xPath(props.prefix, dvbi.e_NVOD), props.schema);
						if (!refNVOD)
							errs.addError({
								code: "SL225",
								message: `service ${NVOD.attr(dvbi.a_reference).value()} has no ${dvbi.e_NVOD.elementize()} information`,
								fragment: NVOD,
								key: "not NVOD",
							});
						else {
							if (refNVOD.attr(dvbi.a_mode) && refNVOD.attr(dvbi.a_mode).value() != dvbi.NVOD_MODE_REFERENCE)
								errs.addError({
									code: "SL226",
									message: `service ${NVOD.attr(dvbi.a_reference).value()} is not defined as an NVOD reference`,
									fragment: NVOD,
									key: "not NVOD",
								});
						}
					}
				}
			}
			let svcType = service.get(xPath(props.prefix, dvbi.e_ServiceType), props.schema);
			if (svcType && svcType.attr(dvbi.a_href) && !svcType.attr(dvbi.a_href).value().endsWith("linear"))
				// this is a biut of a hack, but sufficient to determine linear service type
				errs.addError({
					code: "SL227",
					message: `${dvbi.a_href.attribute(dvbi.e_ServiceType)} must be linear for NVOD reference or timeshifted services`,
					fragments: [NVOD, ServiceType],
					key: `invalid ${dvbi.e_ServiceType}`,
				});
		}

		// check <Prominence>
		let ProminenceList = service.get(xPath(props.prefix, dvbi.e_ProminenceList), props.schema);
		if (ProminenceList) {
			let p = 0,
				PE,
				known = [];
			while ((PE = ProminenceList.get(xPath(props.prefix, dvbi.e_Prominence, ++p), props.schema)) != null) {
				if (!PE.attr(dvbi.a_country) && !PE.attr(dvbi.a_region) && !PE.attr(dvbi.a_ranking)) {
					errs.addError({
						code: "SL228",
						message: `one of ${dvbi.a_country.attribute()},  ${dvbi.a_region.attribute()} or ${dvbi.a_ranking.attribute()} must be provided`,
						fragment: PE,
						key: `missing value`,
					});
				} else {
					// if @region is used, it must be in the RegionList
					if (PE.attr(dvbi.a_region)) {
						let prominenceRegion = PE.attr(dvbi.a_region).value();
						let found = knownRegionIDs.find((r) => r.region == prominenceRegion);
						if (found === undefined)
							errs.addError({
								code: "SL229",
								message: `regionID ${prominenceRegion.quote()} not specified in ${dvbi.e_RegionList.elementize()}`,
								fragment: PE,
								key: "invalid region",
							});
					}
					// if @country and @region are used, they must be per the regin list
					if (PE.attr(dvbi.a_country) && PE.attr(dvbi.a_region)) {
						let prominenceRegion = PE.attr(dvbi.a_region).value();
						let prominenceCountry = PE.attr(dvbi.a_country).value();
						let found = knownRegionIDs.find((r) => r.region == prominenceRegion);
						if (found !== undefined && Object.prototype.hasOwnProperty.call(found, "countries")) {
							if (found.countries.length) {
								if (found.countries.find((c) => c == prominenceCountry) === undefined)
									errs.addError({
										code: "SL230",
										message: `regionID ${prominenceRegion.quote()} not specified for country ${prominenceCountry.quote()} in ${dvbi.e_RegionList.elementize()}`,
										fragment: PE,
										key: "invalid region",
									});
								else found.used = true;
							}
						}
					}

					// if @country is specified, it must be valid
					if (PE.attr(dvbi.a_country) && !this.knownCountries.isISO3166code(PE.attr(dvbi.a_country).value())) {
						errs.addError({
							code: "SL244",
							message: InvalidCountryCode(PE.attr(dvbi.a_country).value(), null, `service ${thisServiceId.quote()}`),
							fragment: PE,
							key: "invalid country code",
						});
					}

					// for exact match
					let hash1 = `c:${PE.attr(dvbi.a_country) ? PE.attr(dvbi.a_country).value() : "**"} re:${PE.attr(dvbi.a_region) ? PE.attr(dvbi.a_region).value() : "**"}  ra:${
						PE.attr(dvbi.a_ranking) ? PE.attr(dvbi.a_ranking).value() : "**"
					}`;
					if (!isIn(known, hash1)) known.push(hash1);
					else {
						let country = `${PE.attr(dvbi.a_country) ? `country:${PE.attr(dvbi.a_country).value}` : ""}`,
							region = `${PE.attr(dvbi.a_region) ? `region:${PE.attr(dvbi.a_region).value}` : ""}`,
							ranking = `${PE.attr(dvbi.a_ranking) ? `ranking:${PE.attr(dvbi.a_ranking).value}` : ""}`;
						errs.addError({
							code: "SL245",
							message: `duplicate ${dvbi.e_Prominence.elementize()} for ${country} ${region} ${ranking}`,
							fragment: PE,
							key: `duplicate ${dvbi.e_Prominence}`,
						});
					}
					// for multiple @ranking in same country/region pair
					let hash2 = `c:${PE.attr(dvbi.a_country) ? PE.attr(dvbi.a_country).value() : "**"} re:${PE.attr(dvbi.a_region) ? PE.attr(dvbi.a_region).value() : "**"}`;
					if (!isIn(known, hash2)) known.push(hash2);
					else {
						let country = `${PE.attr(dvbi.a_country) ? `country:${PE.attr(dvbi.a_country).value}` : ""}`,
							region = `${PE.attr(dvbi.a_region) ? `region:${PE.attr(dvbi.a_region).value}` : ""}`;
						errs.addError({
							code: "SL246",
							message: `multiple ${dvbi.a_ranking.attribute()} ${country || region ? "for" : ""} ${country} ${region}`,
							fragment: PE,
							key: `duplicate ${dvbi.e_Prominence}`,
						});
					}
				}
			}
		}
	}

	/*private*/ doSchemaVerification(ServiceList, props, errs, errCode) {
		let rc = true;

		let x = SchemaVersions.find((s) => s.namespace == props.namespace);
		if (x && x.schema) {
			SchemaCheck(ServiceList, x.schema, errs, `${errCode}:${SchemaVersion(props.namespace)}`);
			SchemaVersionCheck(props, ServiceList, x.status, errs, `${errCode}a`);
		} else rc = false;

		return rc;
	}

	/**
	 * validate the service list and record any errors
	 *
	 * @param {String} SLtext      The service list text to be validated
	 * @param {Class}  errs        Errors found in validaton
	 * @param {String} log_prefix  the first part of the logging location (of null if no logging)
	 */
	/*public*/ doValidateServiceList(SLtext, errs, log_prefix) {
		if (!SLtext) {
			errs.addError({
				type: APPLICATION,
				code: "SL000",
				message: "doValidateServiceList() called with SLtext==null",
			});
			return;
		}

		let SL = SchemaLoad(SLtext, errs, "SL001");
		if (!SL) return;
		writeOut(errs, log_prefix, false);

		if (SL.root().name() !== dvbi.e_ServiceList) {
			errs.addError({
				code: "SL004",
				message: `Root element is not ${dvbi.e_ServiceList.elementize()}`,
				line: SL.root().line(),
				key: "XSD validation",
			});
			return;
		}

		if (!SL.root().namespace()) {
			errs.addError({
				code: "SL003",
				message: `namespace is not provided for ${dvbi.e_ServiceList.elementize()}`,
				line: SL.root().line(),
				key: "XSD validation",
			});
			return;
		}

		let SL_SCHEMA = {},
			SCHEMA_PREFIX = SL.root().namespace().prefix(),
			SCHEMA_NAMESPACE = SL.root().namespace().href();
		SL_SCHEMA[SCHEMA_PREFIX] = SCHEMA_NAMESPACE;

		let props = {
			schema: SL_SCHEMA,
			prefix: SCHEMA_PREFIX,
			namespace: SCHEMA_NAMESPACE,
		};

		if (!this.doSchemaVerification(SL, props, errs, "SL005")) {
			errs.addError({
				code: "SL010",
				message: `Unsupported namespace ${props.namespace.quote()}`,
				key: "XSD validation",
			});
			return;
		}

		let slRequiredAttributes = [dvbi.a_version];
		if (SchemaVersion(props.namespace) >= SCHEMA_r3) slRequiredAttributes.push(tva.a_lang);
		checkAttributes(SL.root(), slRequiredAttributes, [dvbi.a_responseStatus, "schemaLocation"], dvbEA.ServiceList, errs, "SL011");

		// check ServiceList@version
		// validated by schema

		// check ServiceList@lang
		if (SL.root().attr(tva.a_lang)) {
			let serviceListLang = SL.root().attr(tva.a_lang).value();
			if (this.knownLanguages) {
				let validatorResp = this.knownLanguages.isKnown(serviceListLang);
				if (validatorResp.resp != this.knownLanguages.languageKnown) {
					switch (validatorResp.resp) {
						case this.knownLanguages.languageUnknown:
							errs.addError({
								code: "SL012",
								message: `${dvbi.e_ServiceList} xml:${tva.a_lang} value ${serviceListLang.quote()} is invalid`,
								line: SL.root().line(),
								key: "invalid language",
							});
							break;
						case this.knownLanguages.languageRedundant:
							errs.addError({
								code: "SL013",
								message: `${dvbi.e_ServiceList} xml:${tva.a_lang} value ${serviceListLang.quote()} is deprecated (use ${validatorResp.pref.quote()} instead)`,
								line: SL.root().line(),
								key: "deprecated language",
							});
							break;
						case this.knownLanguages.languageNotSpecified:
							errs.addError({
								code: "SL014",
								message: `${dvbi.e_ServiceList} xml:${tva.a_lang} value is not provided`,
								line: SL.root().line(),
								key: "unspecified language",
							});
							break;
						case this.knownLanguages.languageInvalidType:
							errs.addError({
								code: "SL015",
								message: `${dvbi.e_ServiceList} xml:${tva.a_lang} value ${serviceListLang.quote()} is invalid`,
								line: SL.root().line(),
								key: "invalid language",
							});
							break;
					}
				}
			}
		}

		// check ServiceList@responseStatus
		// validated by schema

		//check <ServiceList><Name>
		checkXMLLangs(props, dvbi.e_Name, dvbi.e_ServiceList, SL, errs, "SL020", this.knownLanguages);

		//check <ServiceList><ProviderName>
		checkXMLLangs(props, dvbi.e_ProviderName, dvbi.e_ServiceList, SL, errs, "SL030", this.knownLanguages);

		//check <ServiceList><RelatedMaterial>
		let rm = 0,
			countControlApps = 0,
			RelatedMaterial;
		while ((RelatedMaterial = SL.get(xPath(props.prefix, tva.e_RelatedMaterial, ++rm), props.schema)) != null) {
			let foundHref = this.validateRelatedMaterial(props, RelatedMaterial, errs, "service list", SERVICE_LIST_RM, "SL040");
			if (foundHref != "" && validServiceControlApplication(foundHref)) countControlApps++;
		}

		if (countControlApps > 1)
			errs.addError({
				code: "SL041",
				message: "only a single service control application can be signalled in a service",
				key: "multi apps",
			});

		// check <ServiceList><RegionList> and remember regionID values
		let knownRegionIDs = [],
			RegionList = SL.get(xPath(props.prefix, dvbi.e_RegionList), props.schema);
		if (RegionList) {
			// recurse the regionlist - Regions can be nested in Regions
			let r = 0,
				Region;
			while ((Region = RegionList.get(xPath(props.prefix, dvbi.e_Region, ++r), props.schema)) != null) this.addRegion(props, Region, 0, knownRegionIDs, null, errs);
		}

		//check <ServiceList><TargetRegion>
		let tr = 0,
			TargetRegion;
		while ((TargetRegion = SL.get(xPath(props.prefix, dvbi.e_TargetRegion, ++tr), props.schema)) != null) {
			let found = knownRegionIDs.find((r) => r.region == TargetRegion.text());
			if (found == undefined) errs.addError(UnspecifiedTargetRegion(TargetRegion.text(), "service list", "SL060"));
			else if (!found.selectable)
				errs.addError({
					code: "SL051",
					message: `${dvbi.e_TargetRegion.elementize()} ${TargetRegion.text().quote()} in ${dvbi.e_ServiceList.elementize()} is not selectable`,
					fragment: TargetRegion,
					key: "unselectable region",
				});
			else found.used = true;
		}
		// check <ServiceList><SubscriptionPackageList>
		let declaredSubscriptionPackages = [];
		let SubscriptionPackageList = SL.get(xPath(props.prefix, dvbi.e_SubscriptionPackageList), props.schema);
		if (SubscriptionPackageList) {
			let sp = 0,
				SubscriptionPackage;
			while ((SubscriptionPackage = SubscriptionPackageList.get(xPath(props.prefix, dvbi.e_SubscriptionPackage, ++sp), props.schema)) != null) {
				let pkg = localizedSubscriptionPackage(SubscriptionPackage);

				if (declaredSubscriptionPackages.includes(pkg))
					errs.addError({
						code: "SL063",
						message: `duplicate subscription package definition for "${pkg}"`,
						key: "duplicate subscription package",
						fragment: SubscriptionPackage,
					});
				else declaredSubscriptionPackages.push(pkg);
			}
		}

		// <ServiceList><LCNTableList> is checked below, after the services are enumerated

		//check service list <ContentGuideSourceList>
		let ContentGuideSourceIDs = [],
			CGSourceList = SL.get(xPath(props.prefix, dvbi.e_ContentGuideSourceList), props.schema);
		if (CGSourceList) {
			let cgs = 0,
				CGSource;
			while ((CGSource = CGSourceList.get(xPath(props.prefix, dvbi.e_ContentGuideSource, ++cgs), props.schema)) != null) {
				this.validateAContentGuideSource(props, CGSource, errs, `${dvbi.e_ServiceList}.${dvbi.e_ContentGuideSourceList}.${dvbi.e_ContentGuideSource}[${cgs}]`, "SL070");

				if (CGSource.attr(dvbi.a_CGSID)) {
					if (isIn(ContentGuideSourceIDs, CGSource.attr(dvbi.a_CGSID).value()))
						errs.addError({
							code: "SL071",
							message: `duplicate ${dvbi.a_CGSID.attribute(dvbi.e_ContentGuideSource)} (${CGSource.attr(dvbi.a_CGSID).value()}) in service list`,
							key: `duplicate ${dvbi.a_CGSID.attribute()}`,
							fragment: CGSource,
						});
					else ContentGuideSourceIDs.push(CGSource.attr(dvbi.a_CGSID).value());
				}
			}
		}

		// check  elements in <ServiceList><ContentGuideSource>
		let slGCS = SL.get(xPath(props.prefix, dvbi.e_ContentGuideSource), props.schema);
		if (slGCS) this.validateAContentGuideSource(props, slGCS, errs, `${dvbi.e_ServiceList}.${dvbi.e_ContentGuideSource}`, "SL080");

		errs.setW("num services", 0);

		// check <Service>
		let s = 0,
			service,
			knownServices = [];
		while ((service = SL.get(xPath(props.prefix, dvbi.e_Service, ++s), props.schema)) != null) {
			// for each service
			errs.setW("num services", s);
			let thisServiceId = `service-${s}`; // use a default value in case <UniqueIdentifier> is not specified

			this.validateService(props, SL, service, thisServiceId, knownServices, knownRegionIDs, declaredSubscriptionPackages, ContentGuideSourceIDs, errs);
		}

		if (SchemaVersion(props.namespace) >= SCHEMA_r5) {
			errs.setW("num test services", 0);

			// check <TestService>
			let ts = 0,
				testService;
			while ((testService = SL.get(xPath(props.prefix, dvbi.e_TestService, ++ts), props.schema)) != null) {
				// for each service
				errs.setW("num test services", ts);
				let thisServiceId = `testservice-${ts}`; // use a default value in case <UniqueIdentifier> is not specified

				this.validateService(props, SL, testService, thisServiceId, knownServices, knownRegionIDs, declaredSubscriptionPackages, ContentGuideSourceIDs, errs);
			}
		}
		// check <Service><ContentGuideServiceRef>
		// issues a warning if this is a reference to self
		s = 0;
		while ((service = SL.get("//" + xPath(props.prefix, dvbi.e_Service, ++s), props.schema)) != null) {
			let CGSR = service.get(xPath(props.prefix, dvbi.e_ContentGuideServiceRef), props.schema);
			if (CGSR) {
				let uniqueID = service.get(xPath(props.prefix, dvbi.e_UniqueIdentifier), props.schema);
				if (uniqueID && CGSR.text() == uniqueID.text())
					errs.addError({
						type: WARNING,
						code: "SL270",
						message: `${dvbi.e_ContentGuideServiceRef.elementize()} is self`,
						fragments: [uniqueID, CGSR],
						key: `self ${dvbi.e_ContentGuideServiceRef.elementize()}`,
					});
			}
		}

		if (SchemaVersion(props.namespace) >= SCHEMA_r5) {
			// check <TestService><ContentGuideServiceRef>
			// issues a warning if this is a reference to self
			let ts = 0,
				testService;
			while ((testService = SL.get("//" + xPath(props.prefix, dvbi.e_TestService, ++ts), props.schema)) != null) {
				let CGSR = testService.get(xPath(props.prefix, dvbi.e_ContentGuideServiceRef), props.schema);
				if (CGSR) {
					let uniqueID = testService.get(xPath(props.prefix, dvbi.e_UniqueIdentifier), props.schema);
					if (uniqueID && CGSR.text() == uniqueID.text())
						errs.addError({
							type: WARNING,
							code: "SL231",
							message: `${dvbi.e_ContentGuideServiceRef.elementize()} is self`,
							fragments: [uniqueID, CGSR],
							key: `self ${dvbi.e_ContentGuideServiceRef.elementize()}`,
						});
				}
			}
		}
		// check <ServiceList><LCNTableList>
		let LCNtableList = SL.get("//" + xPath(props.prefix, dvbi.e_LCNTableList), props.schema);
		if (LCNtableList) {
			let l = 0,
				LCNTable,
				tableQualifiers = [];
			while ((LCNTable = LCNtableList.get(xPath(props.prefix, dvbi.e_LCNTable, ++l), props.schema)) != null) {
				// <LCNTable><TargetRegion>
				let tr = 0,
					TargetRegion,
					TargetRegions = [];
				while ((TargetRegion = LCNTable.get(xPath(props.prefix, dvbi.e_TargetRegion, ++tr), props.schema)) != null) {
					let targetRegionName = TargetRegion.text();
					let foundRegion = knownRegionIDs.find((r) => r.region == targetRegionName);
					if (foundRegion == undefined)
						errs.addError({
							code: "SL241",
							message: `${dvbi.e_TargetRegion.elementize()} ${TargetRegion.text().quote()} in ${dvbi.e_LCNTable.elementize()} is not defined`,
							fragment: TargetRegion,
							key: "undefined region",
						});
					else {
						if (foundRegion.selectable == false)
							errs.addError({
								code: "SL242",
								message: `${dvbi.e_TargetRegion.elementize()} ${TargetRegion.text().quote()} in ${dvbi.e_LCNTable.elementize()} is not selectable`,
								fragment: TargetRegion,
								key: "unselectable region",
							});
						foundRegion.used = true;
					}

					if (TargetRegions.includes(targetRegionName))
						errs.addError({
							code: "SL243",
							message: `respecification of ${dvbi.e_TargetRegion.elementize()}=${TargetRegion.text()}`,
							fragment: TargetRegion,
							key: "duplicate region",
						});
					else TargetRegions.push(targetRegionName);
				}

				// <LCNTable><SubscriptionPackage>
				let sp = 0,
					SubscriptionPackage,
					SubscriptionPackages = [];
				while ((SubscriptionPackage = LCNTable.get(xPath(props.prefix, dvbi.e_SubscriptionPackage, ++sp), props.schema)) != null) {
					let packageLanguage = null;
					if (SubscriptionPackage.attr(tva.a_lang)) {
						packageLanguage = SubscriptionPackage.attr(tva.a_lang).value();
						checkLanguage(this.knownLanguages, packageLanguage, `${dvbi.e_SubscriptionPackage} in ${dvbi.e_LCNTable}`, SubscriptionPackage, errs, "SL265");
					} else if (SchemaVersion(props.namespace) >= SCHEMA_r3) {
						packageLanguage = GetNodeLanguage(SubscriptionPackage, false, errs, "SL266", this.knownLanguages);
					}

					let localSubscriptionPackage = localizedSubscriptionPackage(SubscriptionPackage, packageLanguage);
					if (SubscriptionPackages.includes(localSubscriptionPackage))
						errs.addError({
							code: "SL267",
							message: `duplicated ${dvbi.e_SubscriptionPackage.elementize()}`,
							fragment: SubscriptionPackage,
							key: "duplicate package name",
						});
					else SubscriptionPackages.push(localSubscriptionPackage);

					if (SchemaVersion(props.namespace) >= SCHEMA_r3)
						if (!declaredSubscriptionPackages.includes(localSubscriptionPackage))
							errs.addError({
								code: "SL268",
								message: `${dvbi.e_SubscriptionPackage.elementize()}="${localSubscriptionPackage}" is not declared in ${dvbi.e_SubscriptionPackageList.elementize()}`,
								fragment: SubscriptionPackage,
								key: `undeclared ${dvbi.e_SubscriptionPackage}`,
							});
				}

				if (TargetRegions.length == 0) TargetRegions.push(LCN_TABLE_NO_TARGETREGION);
				if (SubscriptionPackages == 0) SubscriptionPackages.push(LCN_TABLE_NO_SUBSCRIPTION);

				TargetRegions.forEach((region) => {
					let displayRegion = region == LCN_TABLE_NO_TARGETREGION ? `unspecified ${dvbi.e_TargetRegion.elementize()}` : `${dvbi.e_TargetRegion.elementize()}="${region}"`;
					SubscriptionPackages.forEach((sPackage) => {
						let key = `${region}::${sPackage}`,
							displayPackage =
								sPackage == LCN_TABLE_NO_SUBSCRIPTION ? `unspecified ${dvbi.e_SubscriptionPackage.elementize()}` : `${dvbi.e_SubscriptionPackage.elementize()}="${sPackage}"`;
						if (tableQualifiers.includes(key))
							errs.addError({
								code: "SL251",
								message: `combination of ${displayRegion} and ${displayPackage} already used`,
								key: "reused region/package",
								line: LCNTable.line(),
							});
						else tableQualifiers.push(key);
					});
				});

				// <LCNTable><LCN>
				let LCNNumbers = [],
					e = 0,
					LCN;
				while ((LCN = LCNTable.get(xPath(props.prefix, dvbi.e_LCN, ++e), props.schema)) != null) {
					// LCN@channelNumber
					if (LCN.attr(dvbi.a_channelNumber)) {
						let chanNum = LCN.attr(dvbi.a_channelNumber).value();

						if (isIn(LCNNumbers, chanNum))
							errs.addError({
								code: "SL262",
								message: `duplicated channel number ${chanNum} for ${dvbi.e_LCNTable.elementize()}`,
								key: "duplicate channel number",
								fragment: LCN,
							});
						else LCNNumbers.push(chanNum);
					}

					// LCN@serviceRef
					if (LCN.attr(dvbi.a_serviceRef) && !isIn(knownServices, LCN.attr(dvbi.a_serviceRef).value()))
						errs.addError({
							code: "SL263",
							message: `LCN reference to unknown service ${LCN.attr(dvbi.a_serviceRef).value()}`,
							key: "LCN unknown services",
							fragment: LCN,
						});
				}
			}
		}

		// report any regionIDs that are defined but not used
		if (SchemaVersion(props.namespace) >= SCHEMA_r4) {
			knownRegionIDs.forEach((kr) => {
				if (!kr.used && kr.selectable)
					errs.addError({
						code: "SL281",
						type: WARNING,
						message: `${dvbi.a_regionID.attribute(dvbi.e_Region)}="${kr.region}" is defined but not used`,
						key: `unused ${dvbi.a_regionID.attribute()}`,
						line: kr.line,
					});
			});
		}
	}

	/**
	 * validate the service list and record any errors
	 *
	 * @param {String} SLtext  The service list text to be validated
	 * @returns {Class} Errors found in validaton
	 */
	/*public*/ validateServiceList(SLtext) {
		var errs = new ErrorList(SLtext);
		this.doValidateServiceList(SLtext, errs);

		return new Promise((resolve, reject /* eslint-disable-line no-unused-vars */) => {
			resolve(errs);
		});
	}
}
