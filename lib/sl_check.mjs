/**
 * sl_check.mjs
 *
 * Check a service list
 */
import chalk from "chalk";

import { elementize, quote } from "../phlib/phlib.js";

import { Array_extension_init } from "./Array-extensions.mjs";
Array_extension_init();

import { tva, tvaEA } from "./TVA_definitions.mjs";
import { sats } from "./DVB_definitions.mjs";
import { slVersions, dvbi, dvbiEC, dvbiEA, XMLdocumentType, validApplicationTypes } from "./DVB-I_definitions.mjs";

import ErrorList, { WARNING, APPLICATION } from "./error_list.mjs";
import { isIn, unEntity, DuplicatedValue } from "./utils.mjs";
import { isPostcode, isASCII, isHTTPURL, isHTTPPathURL, isDomainName, isRTSPURL, isTAGURI, hasNonPrintableChars } from "./pattern_checks.mjs";
import { checkValidLogos } from "./related_material_checks.mjs";
import { sl_InvalidHrefValue, InvalidURL, DeprecatedElement, DeprecatedAttribute, keys, InvalidCountryCode } from "./common_errors.mjs";
import { mlLanguage, checkLanguage, checkXMLLangs, GetNodeLanguage } from "./multilingual_element.mjs";
import { checkAttributes, checkTopElementsAndCardinality, SchemaCheck, SchemaVersionCheck, SchemaLoad } from "./schema_checks.mjs";
import writeOut from "./logger.mjs";
import { ValidateLanguage } from "./IANA_languages.mjs";
import {
	LoadGenres,
	LoadVideoCodecCS,
	LoadAudioCodecCS,
	LoadAccessibilityPurpose,
	LoadAudioPurpose,
	LoadSubtitleCarriages,
	LoadSubtitleCodings,
	LoadSubtitlePurposes,
	LoadAudioConformanceCS,
	LoadVideoConformanceCS,
	LoadAudioPresentationCS,
	LoadRecordingInfoCS,
	LoadPictureFormatCS,
	LoadColorimetryCS,
	LoadServiceTypeCS,
	LoadLanguages,
	LoadCountries,
} from "./classification_scheme_loaders.mjs";
import CheckAccessibilityAttributes from "./accessibility_attributes_checks.mjs";
import { DASH_IF_Content_Protection_List, ContentProtectionIDs, CA_SYSTEM_ID_REGISTRY, CASystemIDs } from "./identifiers.mjs";

import { GetSchema, SL_SchemaVersion, SchemaSpecVersion, isA177specification_URN, isContentFinishedBanner, isOutScheduleHours } from "./sl_data_versions.mjs";
import { validServiceControlApplication, validServiceInstanceControlApplication, validServiceUnavailableApplication, validDASHcontentType } from "./sl_data_versions.mjs";
import {
	validOutScheduleHours,
	validContentFinishedBanner,
	validServiceListLogo,
	validServiceAgreementApp,
	validServiceLogo,
	validServiceBanner,
	validContentGuideSourceLogo,
} from "./sl_data_versions.mjs";
import { ValidateCMCDinDASH } from "./CMCD.mjs";
import { CheckExtension, EXTENSION_LOCATION_SERVICE_ELEMENT, EXTENSION_LOCATION_DASH_INSTANCE, EXTENSION_LOCATION_OTHER_DELIVERY } from "./extension_check.mjs";

const LCN_TABLE_NO_TARGETREGION = "unspecifiedRegion",
	LCN_TABLE_NO_SUBSCRIPTION = "unspecifiedPackage";

const SERVICE_LIST_RM = "service list";
const SERVICE_RM = "service";
const SERVICE_INSTANCE_RM = "service instance";
const CONTENT_GUIDE_RM = "content guide";

/**
 * determines if the identifer provided complies with the requirements for a service identifier
 * at this stage only IETF RFC 4151 TAG URIs are permitted
 *
 * @param {String} identifier    The service identifier
 * @returns {boolean} true if the service identifier complies with the specification otherwise false
 */
let validServiceIdentifier = (identifier) => isTAGURI(identifier);
let validServiceListIdentifier = (identifier) => isTAGURI(identifier);

/**
 * determines if the identifer provided is unique against a list of known identifiers
 *
 * @param {String} identifier   The service identifier
 * @param {Array}  identifiers  The list of known service identifiers
 * @returns {boolean} true if the service identifier is unique otherwise false
 */
let uniqueServiceIdentifier = (identifier, identifiers) => !isIn(identifiers, identifier);

/**
 * Create a label for the optional language and value provided
 * @param {XmlElement} pkg
 * @param {String}     lang
 * @returns {String}
 */
let localizedSubscriptionPackage = (pkg, lang = null) => `${pkg.content}/lang=${lang ? lang : mlLanguage(pkg)}`;

/**
 * Construct	 an error message an unspecifed target region is used
 *
 * @param {String} region      The unspecified target region
 * @param {String} loc         The location of the element
 * @param {String} errCode     The error code to be reported
 * @param {XmlElement} element The element using an undefined region if
 */
let UnspecifiedTargetRegion = (region, loc, errCode, element) => ({
	code: errCode,
	message: `${loc} has an unspecified ${dvbi.e_TargetRegion.elementize()} ${region.quote()}`,
	key: "target region",
	fragment: element,
});

/**
 * Construct an error message for missing <xxxDeliveryParameters>
 *
 * @param {String}     source     The missing source type
 * @param {String}     serviceId  The serviceId whose instance is missing delivery parameters
 * @param {XmlElement} element    The <SourceType> element for which delivery parameters are not specified
 * @param {String}     errCode    The error code to be reported
 */
let NoDeliveryParams = (source, serviceId, element, errCode) => ({
	code: errCode,
	message: `${source} delivery parameters not specified for service instance in service ${serviceId.quote()}`,
	fragment: element,
	key: "no delivery params",
});

export default class ServiceListCheck {
	#numRequests;
	#knownLanguages;
	#allowedGenres;
	#allowedVideoSchemes;
	#allowedAudioSchemes;
	#knownCountries;
	#audioPresentations;
	#accessibilityPurposes;
	#audioPurposes;
	#subtitleCarriages;
	#subtitleCodings;
	#subtitlePurposes;
	#allowedPictureFormats;
	#allowedColorimetry;
	#allowedServiceTypes;
	#allowedAudioConformancePoints;
	#allowedVideoConformancePoints;
	#RecordingInfoCSvalues;

	constructor(useURLs, opts, async = true) {
		this.#numRequests = 0;

		this.#knownLanguages = opts?.languages ? opts.languages : LoadLanguages(useURLs, async);
		this.#knownCountries = opts?.countries ? opts.countries : LoadCountries(useURLs, async);

		console.log(chalk.yellow.underline("loading classification schemes..."));
		this.#allowedGenres = opts?.genres ? opts.genres : LoadGenres(useURLs, async);
		this.#allowedVideoSchemes = opts?.videofmts ? opts.videofmts : LoadVideoCodecCS(useURLs, async);
		this.#allowedAudioSchemes = opts?.audiofmts ? opts.audiofmts : LoadAudioCodecCS(useURLs, async);
		this.#audioPresentations = opts?.audiopres ? opts?.audiopres : LoadAudioPresentationCS(useURLs, async);
		this.#accessibilityPurposes = opts?.accessibilities ? opts.accessibilities : LoadAccessibilityPurpose(useURLs, async);
		this.#audioPurposes = opts?.audiopurps ? opts.audiopurps : LoadAudioPurpose(useURLs, async);
		this.#subtitleCarriages = opts?.stcarriage ? opts.stcarriage : LoadSubtitleCarriages(useURLs, async);
		this.#subtitleCodings = opts?.stcodings ? opts.stcodings : LoadSubtitleCodings(useURLs, async);
		this.#subtitlePurposes = opts?.stpurposes ? opts.stpurposes : LoadSubtitlePurposes(useURLs, async);

		this.#allowedPictureFormats = LoadPictureFormatCS(useURLs, async);
		this.#allowedColorimetry = LoadColorimetryCS(useURLs, async);
		this.#allowedServiceTypes = LoadServiceTypeCS(useURLs, async);

		this.#allowedAudioConformancePoints = LoadAudioConformanceCS(useURLs, async);
		this.#allowedVideoConformancePoints = LoadVideoConformanceCS(useURLs, async);
		this.#RecordingInfoCSvalues = LoadRecordingInfoCS(useURLs, async);
	}

	stats() {
		let res = {};
		res.numRequests = this.#numRequests;
		res.numAllowedGenres = this.#allowedGenres?.count();
		res.numKnownCountries = this.#knownCountries?.count();
		this.#knownLanguages?.stats(res);
		res.numAllowedPictureFormats = this.#allowedPictureFormats?.count();
		res.numAllowedColorimetry = this.#allowedColorimetry?.count();
		res.numAllowedServiceTypes = this.#allowedServiceTypes?.count();
		res.numAllowedAudioSchemes = this.#allowedAudioSchemes?.count();
		res.numAllowedVideoSchemes = this.#allowedVideoSchemes?.count();
		res.numAllowedVideoConformancePoints = this.#allowedVideoConformancePoints?.count();
		res.numAllowedAudioConformancePoints = this.#allowedAudioConformancePoints?.count();
		res.numAudioPresentations = this.#audioPresentations?.count();
		res.numAudioPurporses = this.#audioPurposes?.count();
		res.numRecordingInfoValues = this.#RecordingInfoCSvalues?.count();
		return res;
	}

	/**
	 * parses the region element, checks the values and adds it and its children (through recursion) to the linear list of region ids
	 *
	 * @param {XmlElement} Region           The <Region> element to process
	 * @param {integer}    depth            The current depth in the hierarchial structure of regions
	 * @param {Array}      knownRegionIDs   The list of region IDs that have been found
	 * @param {Array}      countries
	 * @param {ErrorList}  errs             The class where errors and warnings relating to the service list processing are stored
	 */
	/*private*/ #addRegion(Region, depth, knownRegionIDs, countries, errs) {
		if (!Region) {
			errs.addError({
				type: APPLICATION,
				code: "AR000",
				message: "addRegion() called with Region==null",
			});
			return;
		}
		const schemaVersion = SL_SchemaVersion(Region.documentNamespace());
		const regionID = Region.attrAnyNs(dvbi.a_regionID) ? Region.attrAnyNs(dvbi.a_regionID).value : null;
		const displayRegionID = regionID ? regionID.quote() : '"noID"';
		let countriesSpecified = [];
		const countryCodesSpecified = Region.attrAnyNs(dvbi.a_countryCodes);

		// this check should not happen with schema version 5 or greater, as this becomes part of the syntax
		if (depth != 0 && countryCodesSpecified)
			errs.addError({
				code: "AR032",
				message: `${dvbi.a_countryCodes.attribute(Region.name)} not permitted for sub-region ${displayRegionID}`,
				key: "ccode in subRegion",
				line: Region.line,
			});

		if (countryCodesSpecified) {
			countriesSpecified = countryCodesSpecified.value.split(",");
			if (countriesSpecified)
				countriesSpecified.forEach((country) => {
					if (!this.#knownCountries.isISO3166code(country))
						errs.addError({
							code: "AR033",
							message: `invalid country code (${country}) for region ${displayRegionID}`,
							key: keys.k_InvalidCountryCode,
							line: Region.line,
						});
				});
		} else countriesSpecified = countries;

		if (schemaVersion >= slVersions.r4) {
			const selectable = Region.attrAnyNs(dvbi.a_selectable) ? Region.attrAnyNs(dvbi.a_selectable).value == "true" : true;

			if (!selectable && depth == dvbi.MAX_SUBREGION_LEVELS)
				errs.addError({
					code: "AR010",
					message: "Tertiary (leaf) subregion must be selectable",
					key: "not selectable",
					line: Region.line,
					description: "As a tertiary region in which no sub-regions exist, this value shall always be true",
					clause: "A177 Table 38",
				});

			if (!selectable && !Region.hasChild(dvbi.e_Region))
				errs.addError({
					code: "AR011",
					message: "leaf subregion must be selectable",
					key: "not selectable",
					line: Region.line,
				});

			if (regionID) {
				if (knownRegionIDs.find((r) => r.region == regionID) != undefined)
					errs.addError({
						code: "AR012",
						message: `Duplicate ${dvbi.a_regionID.attribute()} ${displayRegionID}`,
						key: `duplicate ${dvbi.a_regionID.attribute()}`,
						line: Region.line,
					});
				else
					knownRegionIDs.push({
						countries: countriesSpecified,
						region: regionID,
						selectable: selectable,
						used: false,
						line: Region.line,
					});
			} else
				errs.addError({
					code: "AR013",
					message: `${dvbi.a_regionID.attribute()} is required`,
					key: `no ${dvbi.a_regionID.attribute()}`,
					line: Region.line,
				});
		} else {
			if (regionID) {
				if (knownRegionIDs.find((r) => r.region == regionID) != undefined)
					errs.addError({
						code: "AR021",
						message: `Duplicate ${dvbi.a_regionID.attribute()} ${displayRegionID}`,
						key: `duplicate ${dvbi.a_regionID.attribute()}`,
						line: Region.line,
					});
				else
					knownRegionIDs.push({
						countries: countriesSpecified,
						region: regionID,
						used: false,
						line: Region.line,
					});
			} else
				errs.addError({
					code: "AR020",
					message: `${dvbi.a_regionID.attribute()} is required`,
					key: `no ${dvbi.a_regionID.attribute()}`,
					line: Region.line,
				});
		}

		if (depth > dvbi.MAX_SUBREGION_LEVELS)
			errs.addError({
				code: "AR031",
				message: `${dvbi.e_Region.elementize()} depth exceeded (>${dvbi.MAX_SUBREGION_LEVELS}) for sub-region ${displayRegionID}`,
				key: "region depth exceeded",
				line: Region.line,
			});

		checkXMLLangs(dvbi.e_RegionName, `${dvbi.a_regionID.attribute(dvbi.e_Region)}=${displayRegionID}`, Region, errs, "AR041");

		// <Region><Postcode>
		let pc = 0,
			Postcode;
		while ((Postcode = Region.getAnyNs(dvbi.e_Postcode, ++pc)) != null)
			if (!isPostcode(Postcode.content))
				// this should not happen as <Postcode> value is checked in the schema
				errs.addError({
					code: "AR051",
					message: `${Postcode.content.quote()} is not a valid postcode`,
					key: "invalid postcode",
					fragment: Postcode,
				});

		let rc = 0,
			RegionChild;
		while ((RegionChild = Region.getAnyNs(dvbi.e_Region, ++rc)) != null) this.#addRegion(RegionChild, depth + 1, knownRegionIDs, countriesSpecified, errs);
	}

	/**
	 * verifies if the specified application is valid according to specification
	 *
	 * @param {XmlElement} MediaLocator  The <MediaLocator> subelement (a libxmls object tree) of the <RelatedMaterial> element
	 * @param {String}     Location      The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
	 * @param {String}     AppType       The type of application being checked, from HowRelated@href
	 * @param {ErrorList}  errs          The class where errors and warnings relating to the service list processing are stored
	 */
	/*private*/ #checkSignalledApplication(MediaLocator, Location, AppType, errs) {
		let isValidApplicationType = (type) => validApplicationTypes.includes(type);

		if (!MediaLocator)
			errs.addError({
				code: "SA001",
				message: `${tva.e_MediaLocator.elementize()} not specified for application ${tva.e_RelatedMaterial.elementize()} in ${Location}`,
				key: `no ${tva.e_MediaUri}`,
			});
		else {
			let hasMediaURI = false;
			MediaLocator.childNodes().forEachNamedSubElement(tva.e_MediaUri, (MediaUri) => {
				hasMediaURI = true;
				if (MediaUri.attrAnyNs(tva.a_contentType) && !isValidApplicationType(MediaUri.attrAnyNs(tva.a_contentType).value))
					errs.addError({
						code: "SA003",
						message: `${tva.a_contentType.attribute()} ${MediaUri.attrAnyNs(tva.a_contentType).value.quote()} is not supported application type for ${tva.e_RelatedMaterial.elementize()}${tva.e_MediaLocator.elementize()} in ${Location}`,
						fragment: MediaUri,
						key: `invalid ${tva.a_contentType.attribute(tva.e_MediaUri)}`,
					});
				if (!isASCII(MediaUri.content))
					errs.addError({
						code: "SA014",
						message: `URL ${MediaUri.content.quote()} contains non-ASCII characters in ${MediaUri.name.elementize()}`,
						fragment: MediaUri,
						key: "invalid resource URL",
					});
				if (!isHTTPURL(MediaUri.content))
					errs.addError({
						code: "SA004",
						message: `invalid URL ${MediaUri.content.quote()} specified for ${MediaUri.name.elementize()}`,
						fragment: MediaUri,
						key: "invalid resource URL",
					});
				const MediaUri_contentType = MediaUri.attrAnyNsValueOr(tva.a_contentType, null);
				if (AppType == dvbi.APP_SERVICE_PROVIDER && MediaUri_contentType && MediaUri_contentType != dvbi.XML_AIT_CONTENT_TYPE)
					errs.addError({
						code: "SA006",
						message: `invalid application type ${MediaUri_contentType.quote()} for Serivce Provider Application (only XMLAIT allowed)`,
						fragment: MediaUri,
						key: "invalid app type",
					});
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
	 * determines if the identifer provided refers to a valid application launching method signalled in a service
	 *
	 * @param {XmlElement} HowRelated     The service identifier
	 * @param {integer}    schemaVersion  The schema version of the XML document
	 * @returns {boolean} true if this is a valid application launching method else false
	 */
	/*private*/ #validServiceApplication(HowRelated, schemaVersion) {
		// return true if the HowRelated element has a valid CS value for Service Related Applications (A177 5.2.3)
		// urn:dvb:metadata:cs:LinkedApplicationCS:2019
		if (!HowRelated) return false;
		const val = HowRelated.attrAnyNsValueOr(dvbi.a_href, null);
		return val ? validServiceControlApplication(val, schemaVersion) || validServiceUnavailableApplication(val) : false;
	}

	/**
	 * determines if the identifer provided refers to a valid application launching method signalled in a service instance
	 *
	 * @param {XmlElement} HowRelated     The service identifier
	 * @param {integer}    schemaVersion  The schema version of the XML document
	 * @returns {boolean} true if this is a valid application launching method else false
	 */
	/*private*/ #validServiceInstanceApplication(HowRelated, schemaVersion) {
		// return true if the HowRelated element has a valid CS value for Service Related Applications (A177 5.2.3)
		// urn:dvb:metadata:cs:LinkedApplicationCS:2019
		if (!HowRelated) return false;
		const val = HowRelated.attrAnyNsValueOr(dvbi.a_href, null);
		return val ? validServiceControlApplication(val, schemaVersion) : false;
	}

	/**
	 * verifies if the specified RelatedMaterial element is valid according to specification (contents and location)
	 *
	 * @param {XmlElement} RelatedMaterial   The <RelatedMaterial> element (a libxmls object tree) to be checked
	 * @param {String}     Location          The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
	 * @param {String}     LocationType      The type of element containing the <RelatedMaterial> element. Different validation rules apply to different location types
	 * @param {ErrorList}  errs              The class where errors and warnings relating to the service list processing are stored
	 * @param {String}     errCode           The prefix to use for any errors found
	 * @returns {String} an href value if valid, else ""
	 */
	/*private*/ #validateRelatedMaterial(RelatedMaterial, Location, LocationType, errs, errCode) {
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
		const documentNamespace = RelatedMaterial.documentNamespace();
		checkTopElementsAndCardinality(
			RelatedMaterial,
			[{ name: tva.e_HowRelated }, { name: tva.e_MediaLocator, maxOccurs: Infinity }, { name: tva.e_AccessibilityAttributes, minOccurs: 0 }],
			dvbiEC.RelatedMaterial,
			false,
			errs,
			`${errCode}-1`
		);

		let HowRelated = null,
			MediaLocator = [],
			AccessibilityAttribiutes = [];
		RelatedMaterial.childNodes().forEachSubElement((child) => {
			switch (child.name) {
				case tva.e_HowRelated:
					HowRelated = child;
					break;
				case tva.e_MediaLocator:
					MediaLocator.push(child);
					break;
				case tva.e_AccessibilityAttributes:
					AccessibilityAttribiutes.push(child);
					break;
			}
		});

		if (!HowRelated) {
			errs.addError({
				code: `${errCode}-2`,
				message: `${tva.e_HowRelated.elementize()} not specified for ${tva.e_RelatedMaterial.elementize()} in ${Location}`,
				line: RelatedMaterial.line,
				key: `no ${tva.e_HowRelated}`,
			});
			return rc;
		}

		checkAttributes(HowRelated, [dvbi.a_href], [], tvaEA.HowRelated, errs, `${errCode}-5`);

		if (HowRelated.attrAnyNs(dvbi.a_href)) {
			let RMErrorDescription = (_code, _elem, _table) => ({
				code: _code,
				desciption: `The application type indicated by the specified ${dvbi.a_href.attribute()} value is not permitted in a ${_elem.elementize()}. Refer to the semantic defintiion of ${dvbi.e_RelatedMaterial.elementize()} in table ${_table} of A177.`,
			});
			switch (LocationType) {
				case SERVICE_LIST_RM:
					if (validServiceListLogo(HowRelated)) {
						rc = HowRelated.attrAnyNs(dvbi.a_href).value;
						checkValidLogos(RelatedMaterial, Location, errs, `${errCode}-10`);
					} else if (validServiceAgreementApp(HowRelated)) {
						rc = HowRelated.attrAnyNs(dvbi.a_href).value;
						MediaLocator.forEach((locator) => this.#checkSignalledApplication(locator, Location, rc, errs));
					} else {
						errs.addError(sl_InvalidHrefValue(HowRelated.attrAnyNs(dvbi.a_href).value, HowRelated, tva.e_RelatedMaterial.elementize(), Location, `${errCode}-11`));
						errs.errorDescription(RMErrorDescription(`${errCode}-11`, dvbi.e_ServiceList, 14));
					}
					break;

				case SERVICE_RM:
					if (isContentFinishedBanner(HowRelated) && SL_SchemaVersion(documentNamespace) == slVersions.r0)
						errs.addError({
							code: `${errCode}-21`,
							message: `${HowRelated.attrAnyNs(dvbi.href).value.quote()} not permitted for ${documentNamespace.quote()} in ${Location}`,
							key: "invalid CS value",
							fragment: HowRelated,
						});
					if (validOutScheduleHours(HowRelated) || validContentFinishedBanner(HowRelated) || validServiceLogo(HowRelated) || validServiceBanner(HowRelated)) {
						rc = HowRelated.attrAnyNs(dvbi.a_href).value;
						checkValidLogos(RelatedMaterial, Location, errs, `${errCode}-22`);
					} else if (this.#validServiceApplication(HowRelated, SL_SchemaVersion(documentNamespace))) {
						rc = HowRelated.attrAnyNs(dvbi.a_href).value;
						MediaLocator.forEach((locator) => this.#checkSignalledApplication(locator, Location, rc, errs));
					} else {
						errs.addError(sl_InvalidHrefValue(HowRelated.attrAnyNs(dvbi.a_href).value, HowRelated, tva.e_RelatedMaterial.elementize(), Location, `${errCode}-24`));
						errs.errorDescription(RMErrorDescription(`${errCode}-24`, dvbi.e_Service, 15));
					}
					break;

				case SERVICE_INSTANCE_RM:
					if (isContentFinishedBanner(HowRelated) && SL_SchemaVersion(documentNamespace) == slVersions.r0)
						errs.addError({
							code: `${errCode}-31`,
							message: `${HowRelated.attrAnyNs(dvbi.href).value.quote()} not permitted for ${documentNamespace.quote()} in ${Location}`,
							key: "invalid CS value",
							fragment: HowRelated,
						});
					else if (validContentFinishedBanner(HowRelated) || validServiceLogo(HowRelated)) {
						rc = HowRelated.attrAnyNs(dvbi.a_href).value;
						checkValidLogos(RelatedMaterial, Location, errs, `${errCode}-32`);
					} else if (isOutScheduleHours(HowRelated) && SL_SchemaVersion(documentNamespace) >= slVersions.r6)
						errs.addError({
							code: `${errCode}-35`,
							message: "Out of Service Banner is not permitted in a Service Instance from A177r6",
							key: "misplaced image type",
							fragment: HowRelated,
							clause: "A177 table 16",
							description: `Out of Service banner is not permitted in the ${tva.e_RelatedMaterial.elementize()} element of a ${dvbi.e_ServiceInstance.elementize()}`,
						});
					else if (validServiceBanner(HowRelated))
						errs.addError({
							code: `${errCode}-33`,
							message: "Service Banner is not permitted in a Service Instance",
							key: "misplaced image type",
							fragment: HowRelated,
							clause: "A177 table 16",
							description: `Service banner is not permitted in the ${tva.e_RelatedMaterial.elementize()} element of a ${dvbi.e_ServiceInstance.elementize()}`,
						});
					else if (this.#validServiceInstanceApplication(HowRelated, SL_SchemaVersion(documentNamespace))) {
						rc = HowRelated.attrAnyNs(dvbi.a_href).value;
						MediaLocator.forEach((locator) => this.#checkSignalledApplication(locator, Location, rc, errs));
					} else {
						errs.addError(sl_InvalidHrefValue(HowRelated.attrAnyNs(dvbi.a_href).value, HowRelated, tva.e_RelatedMaterial.elementize(), Location, `${errCode}-34`));
						errs.errorDescription(RMErrorDescription(`${errCode}-34`, dvbi.e_ServiceInstance, 16));
					}
					break;

				case CONTENT_GUIDE_RM:
					if (validContentGuideSourceLogo(HowRelated)) {
						rc = HowRelated.attrAnyNs(dvbi.a_href).value;
						checkValidLogos(RelatedMaterial, Location, errs, `${errCode}-41`);
					} else {
						errs.addError(sl_InvalidHrefValue(HowRelated.attrAnyNs(dvbi.a_href).value, HowRelated, tva.e_RelatedMaterial.elementize(), Location, `${errCode}-42`));
						errs.errorDescription(RMErrorDescription(`${errCode}-42`, dvbi.e_ContentGuideSource, 20));
					}
					break;
			}
		}

		AccessibilityAttribiutes.forEach((aa) => {
			CheckAccessibilityAttributes(
				aa,
				{
					AccessibilityPurposeCS: this.#accessibilityPurposes,
					VideoCodecCS: this.#allowedVideoSchemes,
					AudioCodecCS: this.#allowedAudioSchemes,
					SubtitleCarriageCS: this.#subtitleCarriages,
					SubtitleCodingFormatCS: this.#subtitleCodings,
					SubtitlePurposeTypeCS: this.#subtitlePurposes,
					KnownLanguages: this.#knownLanguages,
					AudioPresentationCS: this.#audioPresentations,
				},
				errs,
				`${errCode}-51`
			);
		});
		return rc;
	}

	/**
	 * check if the node provided contains an RelatedMaterial element for a signalled application
	 *
	 * @param {XmlElement} node      The XML tree node (either a <Service>, <TestService> or a <ServiceInstance>) to be checked
	 * @returns {boolean} true if the node contains a <RelatedMaterial> element which signals an application else false
	 */
	/*private*/ #hasSignalledApplication(node) {
		if (node) {
			let i = 0,
				elem;
			while ((elem = node.getAnyNs(tva.e_RelatedMaterial, ++i)) != null) {
				let hr = elem.get(tva.e_HowRelated);
				if (hr && this.#validServiceApplication(hr, SL_SchemaVersion(node.documentNamespace()))) return true;
			}
		}
		return false;
	}

	/**
	 * perform any validation on a ContentTypeSourceType element
	 *
	 * @param {XmlElement} source        The <ContentGuideSource> element to be checked
	 * @param {XmlElement} loc           The 'location' in the XML document of the element being checked, if unspecified then this is set to be the name of the parent element
	 * @param {ErrorList}  errs          Errors found in validaton
	 * @param {String}     errCode       Error code prefix to be used in reports
	 */
	/*private*/ #validateAContentGuideSource(source, loc, errs, errCode) {
		if (!source) {
			errs.addError({
				type: APPLICATION,
				code: "GS000",
				message: "validateAContentGuideSource() called with source==null",
			});
			return;
		}

		let CheckEndpoint = (elementName, suffix, MustEndWithSlash = false) => {
			const ep = source.getAnyNs(elementName);
			if (ep) {
				const epURL = ep.getAnyNs(dvbi.e_URI);
				if (epURL) {
					if (!MustEndWithSlash && !isHTTPURL(epURL.content)) errs.addError(InvalidURL(epURL.content, ep, elementName.elementize(), `${errCode}-${suffix}a`));

					if (MustEndWithSlash && !isHTTPPathURL(epURL.content))
						errs.addError({
							type: WARNING,
							code: `${errCode}-${suffix}b`,
							message: `"${epURL.content}" should end with a slash '/' for ${elementName.elementize()}`,
							fragment: ep,
							key: "not URL path",
						});
				}
				if (ep.attrAnyNs(dvbi.a_contentType) && ep.attrAnyNs(dvbi.a_contentType).value != XMLdocumentType)
					errs.addError({
						type: WARNING,
						code: `${errCode}-${suffix + 1}`,
						message: `${dvbi.a_contentType.attribute(elementName).elementize()} should contain ${XMLdocumentType}`,
						fragment: ep,
						key: `invalid @${dvbi.a_contentType}`,
					});
			}
		};
		loc = loc ? loc : source.parent.name.elementize();

		checkXMLLangs(dvbi.e_Name, loc, source, errs, `${errCode}-1`);
		checkXMLLangs(dvbi.e_ProviderName, loc, source, errs, `${errCode}-2`);

		let rm = 0,
			RelatedMaterial;
		while ((RelatedMaterial = source.getAnyNs(tva.e_RelatedMaterial, ++rm)) != null) this.#validateRelatedMaterial(RelatedMaterial, loc, CONTENT_GUIDE_RM, errs, `${errCode}-3`);

		// ContentGuideSourceType::ScheduleInfoEndpoint - should be a URL
		CheckEndpoint(dvbi.e_ScheduleInfoEndpoint, 14);

		// ContentGuideSourceType::ProgramInfoEndpoint - should be a URL
		CheckEndpoint(dvbi.e_ProgramInfoEndpoint, 16);

		// ContentGuideSourceType::GroupInfoEndpoint - should be a URL and should end with a /
		CheckEndpoint(dvbi.e_GroupInfoEndpoint, 18, SL_SchemaVersion(source.documentNamespace()) >= slVersions.r5);

		// ContentGuideSourceType::MoreEpisodesEndpoint - should be a URL
		CheckEndpoint(dvbi.e_MoreEpisodesEndpoint, 20);
	}

	/**
	 * validate the language specified record any errors
	 *
	 * @param {XmlElement} node       the XML node whose @lang attribute should be checked
	 * @param {String}     parentLang the language of the XML element which is the parent of node
	 * @param {boolean}    isRequired report an error if @lang is not explicitly stated
	 * @param {ErrorList}  errs       errors found in validaton
	 * @param {String}     errCode    error number to use instead of local values
	 * @returns {String} the @lang attribute of the node element of the parentLang if it does not exist of is not specified
	 */
	/* private */ #GetLanguage(node, parentLang, isRequired, errs, errCode) {
		if (!node) return parentLang;
		if (!node.attrAnyNs(tva.a_lang) && isRequired) {
			errs.addError({
				code: errCode,
				message: `${tva.a_lang.attribute()} is required for ${node.name.quote()}`,
				key: keys.k_UnspecifiedLanguage,
				line: node.line,
			});
			return parentLang;
		}

		if (!node.attrAnyNs(tva.a_lang)) return parentLang;

		const localLang = node.attrAnyNs(tva.a_lang).value;
		if (localLang) checkLanguage(localLang, node, errs, errCode);
		return localLang;
	}

	/**
	 * validate the SynopsisType elements
	 *
	 * @param {XmlElement} Element            the element whose children should be checked
	 * @param {String}     ElementName        the name of the child element to be checked
	 * @param {Array}      requiredLengths    @length attributes that are required to be present
	 * @param {Array}      optionalLengths    @length attributes that can optionally be present
	 * @param {String}     parentLanguage	   the xml:lang of the parent element
	 * @param {ErrorList}  errs               errors found in validaton
	 * @param {String}     errCode            error code prefix to be used in reports
	 */
	/*private*/ #ValidateSynopsisType(Element, ElementName, requiredLengths, optionalLengths, parentLanguage, errs, errCode) {
		if (!Element) {
			errs.addError({
				type: APPLICATION,
				code: "SY000",
				message: "ValidateSynopsisType() called with Element==null",
			});
			return;
		}

		let synopsisLengthError = (label, length) => `length of ${elementize(`${tva.a_length.attribute(ElementName)}=${label.quote()}`)} exceeds ${length} characters`;
		let synopsisToShortError = (label, length) => `length of ${elementize(`${tva.a_length.attribute(ElementName)}=${label.quote()}`)} is less than ${length} characters`;
		let singleLengthLangError = (length, lang) => `only a single ${ElementName.elementize()} is permitted per length (${length}) and language (${lang})`;
		let requiredSynopsisError = (length) => `a ${ElementName.elementize()} element with ${tva.a_length.attribute()}=${quote(length)} is required`;

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
		const ERROR_KEY = "synopsis";
		while ((ste = Element.getAnyNs(ElementName, ++s)) != null) {
			const synopsisLang = this.#GetLanguage(ste, parentLanguage, false, errs, `${errCode}-2`);
			const synopsisLength = ste.attrAnyNs(tva.a_length) ? ste.attrAnyNs(tva.a_length).value : null;

			if (synopsisLength) {
				const cleanSynopsisLength = unEntity(ste.content).length; // replace ENTITY strings with a generic character
				if (isIn(requiredLengths, synopsisLength) || isIn(optionalLengths, synopsisLength)) {
					switch (synopsisLength) {
						case tva.SYNOPSIS_BRIEF_LABEL:
							if (cleanSynopsisLength > tva.SYNOPSIS_BRIEF_LENGTH)
								errs.addError({
									code: `${errCode}-10`,
									message: synopsisLengthError(tva.SYNOPSIS_BRIEF_LABEL, tva.SYNOPSIS_BRIEF_LENGTH),
									fragment: ste,
									key: ERROR_KEY,
								});
							hasBrief = true;
							break;
						case tva.SYNOPSIS_SHORT_LABEL:
							if (cleanSynopsisLength > tva.SYNOPSIS_SHORT_LENGTH)
								errs.addError({
									code: `${errCode}-11`,
									message: synopsisLengthError(tva.SYNOPSIS_SHORT_LABEL, tva.SYNOPSIS_SHORT_LENGTH),
									fragment: ste,
									key: ERROR_KEY,
								});
							hasShort = true;
							break;
						case tva.SYNOPSIS_MEDIUM_LABEL:
							if (cleanSynopsisLength > tva.SYNOPSIS_MEDIUM_LENGTH)
								errs.addError({
									code: `${errCode}-12`,
									message: synopsisLengthError(tva.SYNOPSIS_MEDIUM_LABEL, tva.SYNOPSIS_MEDIUM_LENGTH),
									fragment: ste,
									key: ERROR_KEY,
								});
							hasMedium = true;
							break;
						case tva.SYNOPSIS_LONG_LABEL:
							if (cleanSynopsisLength > tva.SYNOPSIS_LONG_LENGTH)
								errs.addError({
									code: `${errCode}-13`,
									message: synopsisLengthError(tva.SYNOPSIS_LONG_LABEL, tva.SYNOPSIS_LONG_LENGTH),
									fragment: ste,
									key: ERROR_KEY,
								});
							hasLong = true;
							break;
						case tva.SYNOPSIS_EXTENDED_LABEL:
							if (cleanSynopsisLength < tva.SYNOPSIS_EXTENDED_MIN_LENGTH)
								errs.addError({
									code: `${errCode}-14`,
									message: synopsisToShortError(tva.SYNOPSIS_EXTENDED_LABEL, tva.SYNOPSIS_EXTENDED_MIN_LENGTH),
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
								message: singleLengthLangError(synopsisLength, synopsisLang),
								fragment: ste,
								key: ERROR_KEY,
							});
						else briefLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_SHORT_LABEL:
						if (isIn(shortLangs, synopsisLang))
							errs.addError({
								code: `${errCode}-22`,
								message: singleLengthLangError(synopsisLength, synopsisLang),
								fragment: ste,
								key: ERROR_KEY,
							});
						else shortLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_MEDIUM_LABEL:
						if (isIn(mediumLangs, synopsisLang))
							errs.addError({
								code: `${errCode}-23`,
								message: singleLengthLangError(synopsisLength, synopsisLang),
								fragment: ste,
								key: ERROR_KEY,
							});
						else mediumLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_LONG_LABEL:
						if (isIn(longLangs, synopsisLang))
							errs.addError({
								code: `${errCode}-24`,
								message: singleLengthLangError(synopsisLength, synopsisLang),
								fragment: ste,
								key: ERROR_KEY,
							});
						else longLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_EXTENDED_LABEL:
						if (isIn(extendedLangs, synopsisLang))
							errs.addError({
								code: `${errCode}-25`,
								message: singleLengthLangError(synopsisLength, synopsisLang),
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
	 * Determine if the specified node includes a RelatedMaterial element with the provided application type and format
	 * @param {XmlElement} node         The elements whose <RelatedMaterial> elements are to be checked
	 * @param {String}     href         The type of application to look for
	 * @param {String}     contentType  The format of the application to look for
	 * @returns true if the node contains an application with the indicated type, otherwise false
	 */
	/*private*/ #hasServiceApplication(node, href, contentType) {
		let rc = false;
		let rm = 0,
			RelatedMaterial;
		while (!rc && (RelatedMaterial = node.getAnyNs(tva.e_RelatedMaterial, ++rm)) != null) {
			const HowRelated = RelatedMaterial.getAnyNs(tva.e_HowRelated);
			if (HowRelated && HowRelated.attrAnyNsValueOr(tva.a_href, null) == href) {
				let ml = 0,
					MediaLocator;
				while (!rc && (MediaLocator = RelatedMaterial.getAnyNs(tva.e_MediaLocator, ++ml)) != null) {
					const MediaUri = MediaLocator.getAnyNs(tva.e_MediaUri);
					if (MediaUri && MediaUri.attrAnyNsValueOr(tva.a_contentType, null) == contentType) rc = true;
				}
			}
		}
		return rc;
	}

	/**
	 * validate a ServiceInstance element
	 *
	 * @param {XmlElement} ServiceInstance               the service instance element to check
	 * @param {String}     thisServiceId                 the identifier of the service
	 * @param {Array}      declaredSubscriptionPackages  subscription packages that are declared in the service list
	 * @param {ErrorList}  errs                          errors found in validaton
	 */
	/*private*/ #validateServiceInstance(ServiceInstance, thisServiceId, declaredSubscriptionPackages, declaredAudioLanguages, errs) {
		if (!ServiceInstance) {
			errs.addError({
				type: APPLICATION,
				code: "SI000",
				message: "validateServiceInstance() called with ServiceInstance==null",
			});
			return;
		}

		function checkMulticastDeliveryParams(params, errs, errCode) {
			const IPMulticastAddress = params.getAnyNs(dvbi.e_IPMulticastAddress);
			if (IPMulticastAddress) {
				const CNAME = IPMulticastAddress.getAnyNs(dvbi.e_CNAME);
				if (CNAME && !isDomainName(CNAME.content))
					errs.addError({
						code: `${errCode}-1`,
						message: `${dvbi.e_IPMulticastAddress.elementize()}${dvbi.e_CNAME.elementize()} is not a valid domain name for use as a CNAME`,
						fragment: CNAME,
						key: "invalid CNAME",
					});
			}
		}

		const documentNamespace = ServiceInstance.documentNamespace();
		let hasDeliveryParameters = (instance) =>
			instance.hasChild(dvbi.e_DVBTDeliveryParameters) ||
			instance.hasChild(dvbi.e_DVBSDeliveryParameters) ||
			instance.hasChild(dvbi.e_DVBCDeliveryParameters) ||
			instance.hasChild(dvbi.e_DASHDeliveryParameters) ||
			instance.hasChild(dvbi.e_SATIPDeliveryParameters) ||
			instance.hasChild(dvbi.e_MulticastTSDeliveryParameters) ||
			instance.hasChild(dvbi.e_RTSPDeliveryParameters);

		let deliveryParameters = (instance) =>
			instance.getAnyNs(dvbi.e_DVBTDeliveryParameters) ||
			instance.getAnyNs(dvbi.e_DVBSDeliveryParameters) ||
			instance.getAnyNs(dvbi.e_DVBCDeliveryParameters) ||
			instance.getAnyNs(dvbi.e_DASHDeliveryParameters) ||
			instance.getAnyNs(dvbi.e_SATIPDeliveryParameters) ||
			instance.getAnyNs(dvbi.e_MulticastTSDeliveryParameters) ||
			instance.getAnyNs(dvbi.e_RTSPDeliveryParameters);

		checkAttributes(ServiceInstance, [], [dvbi.a_priority, dvbi.a_id, tva.a_lang], dvbiEA.ServiceInstanceType, errs, "SI005");
		checkTopElementsAndCardinality(
			ServiceInstance,
			[
				{ name: dvbi.e_DisplayName, minOccurs: 0, maxOccurs: Infinity },
				{ name: dvbi.e_RelatedMaterial, minOccurs: 0, maxOccurs: Infinity },
				{ name: dvbi.e_ContentProtection, minOccurs: 0, maxOccurs: Infinity },
				{ name: dvbi.e_ContentAttributes, minOccurs: 0 },
				{ name: dvbi.e_Availability, minOccurs: 0 },
				{ name: dvbi.e_SubscriptionPackage, minOccurs: 0, maxOccurs: Infinity },
				{ name: dvbi.e_FTAContentManagement, minOccurs: 0 },
				{ name: dvbi.e_SourceType, minOccurs: 0 },
				SL_SchemaVersion(documentNamespace) >= slVersions.r3 ? { name: dvbi.e_AltServiceName, minOccurs: 0, maxOccurs: Infinity } : {},
				{ name: dvbi.e_DVBTDeliveryParameters, minOccurs: 0 }, // TODO: these are wrapped in an xsd:choice that is currently not implemented
				{ name: dvbi.e_DVBSDeliveryParameters, minOccurs: 0 },
				{ name: dvbi.e_DVBCDeliveryParameters, minOccurs: 0 },
				{ name: dvbi.e_RTSPDeliveryParameters, minOccurs: 0 },
				{ name: dvbi.e_MulticastTSDeliveryParameters, minOccurs: 0 },
				{ name: dvbi.e_DASHDeliveryParameters, minOccurs: 0 },
				{ name: dvbi.e_OtherDeliveryParameters, minOccurs: 0 },
				SL_SchemaVersion(documentNamespace) >= slVersions.r6 ? { name: dvbi.e_IdentifierBasedDeliveryParameters, minOccurs: 0 } : {},
				{ name: dvbi.e_SATIPDeliveryParameters, minOccurs: 0, maxOccurs: Infinity },
			],
			dvbiEC.ServiceInstanceType,
			false,
			errs,
			"SI006"
		);

		//<ServiceInstance@priority>
		if (SL_SchemaVersion(documentNamespace) <= slVersions.r4) {
			if (ServiceInstance.attrAnyNs(dvbi.a_priority) && ServiceInstance.attrAnyNs(dvbi.a_priority).value < 0)
				errs.addError({
					code: "SI011",
					message: `${dvbi.a_priority.attribute(dvbi.e_ServiceInstance)} should not be negative`,
					line: ServiceInstance.attrAnyNs(dvbi.a_priority).line,
					key: `negative ${dvbi.a_priority.attribute()}`,
				});
		}

		//<ServiceInstance@id>
		if (ServiceInstance.attrAnyNs(dvbi.a_id) && ServiceInstance.attrAnyNs(dvbi.a_id).value.length == 0)
			errs.addError({
				code: "SI012",
				message: `${dvbi.a_id.attribute()} should not be empty is specified`,
				line: ServiceInstance.line,
				key: "empty ID",
			});

		//<ServiceInstance><DisplayName>
		checkXMLLangs(dvbi.e_DisplayName, `service instance in service=${thisServiceId.quote()}`, ServiceInstance, errs, "SI010");

		// check @href of <ServiceInstance><RelatedMaterial>
		let rm = 0,
			controlApps = [],
			RelatedMaterial;
		while ((RelatedMaterial = ServiceInstance.getAnyNs(tva.e_RelatedMaterial, ++rm)) != null) {
			const foundHref = this.#validateRelatedMaterial(RelatedMaterial, `service instance of ${thisServiceId.quote()}`, SERVICE_INSTANCE_RM, errs, "SI020");
			if (foundHref != "" && validServiceInstanceControlApplication(foundHref, SL_SchemaVersion(documentNamespace))) controlApps.push(RelatedMaterial);
			if (foundHref == dvbi.APP_IN_CONTROL) {
				// Application controlling playback SHOULD NOT have any service delivery parameters
				const foundDeliveryParams = deliveryParameters(ServiceInstance);
				if (SL_SchemaVersion(documentNamespace) >= slVersions.r5 && foundDeliveryParams != null)
					errs.addError({
						type: WARNING,
						code: "SI022",
						message: "Delivery parameters are ignored when application controls media playback",
						fragments: [RelatedMaterial, foundDeliveryParams],
						key: "unnecessary delivery",
					});
			} else if (foundHref == dvbi.APP_SERVICE_PROVIDER)
				errs.addError({
					code: "SI023",
					message: "Service Provider app not permitted for Service Instance",
					fragment: RelatedMaterial,
					key: "disallowed app",
				});
			if ([dvbi.APP_IN_PARALLEL, dvbi.APP_IN_CONTROL, dvbi.APP_IN_SERIES].includes(foundHref)) {
				// since:r8 these apps can only be signalled in a service instance if it is not signalled at the service level or
				// if signalled at the service level with a different @contentType
				// see Table 7a and note 3
				// TODO:: find MediaLocator.MediaUri@contentType and check that parent <Service> does not have the same
				let ml = 0,
					MediaLocator;
				while ((MediaLocator = RelatedMaterial.getAnyNs(tva.e_MediaLocator, ++ml)) != null) {
					const MediaUri = MediaLocator.getAnyNs(tva.e_MediaUri);
					if (MediaUri) {
						const contentType = MediaUri.attrAnyNsValueOr(tva.a_contentType, null);
						if (contentType && this.#hasServiceApplication(ServiceInstance.parent, foundHref, contentType))
							errs.addError({
								code: "SI024",
								message: "same application type can only be signalled at the service or service instance level, not both",
								fragment: RelatedMaterial,
								key: "app signalling",
								clause: "A177 table 7a note 3",
								description: `Applications that are allowed to be signalled at either the service or service instance level shall be signalled at either one or the other but not both unless ${tva.a_contentType.attribute(tva.e_MediaUri)} is different`,
							});
					}
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
		let cp = 0,
			ContentProtection;
		while ((ContentProtection = ServiceInstance.getAnyNs(dvbi.e_ContentProtection, ++cp)) != null) {
			let ca = 0,
				CASystemID;

			checkTopElementsAndCardinality(
				ContentProtection,
				[
					{ name: dvbi.e_CASystemId, minOccurs: 0, maxOccurs: Infinity },
					{ name: dvbi.e_DRMSystemId, minOccurs: 0, maxOccurs: Infinity },
				],
				dvbiEC.ContentProtectionType,
				false,
				errs,
				"SI031"
			);
			while ((CASystemID = ContentProtection.getAnyNs(dvbi.e_CASystemId, ++ca)) != null) {
				checkAttributes(CASystemID, [], [dvbi.a_cpsIndex], [dvbi.a_cpsIndex], errs, "SI031");
				let CASystemID_value = null;
				if (SL_SchemaVersion(documentNamespace) <= slVersions.r1) {
					// first two versions of the schema were 'incorrect' - has nested <CASystemId> elements.
					const nestedCAsystemid = CASystemID.getAnyNs(dvbi.e_CASystemId);
					if (nestedCAsystemid) {
						CASystemID_value = nestedCAsystemid.content;
					}
				} else CASystemID_value = CASystemID.content;
				if (CASystemID_value) {
					let CASid_value = parseInt(CASystemID_value, 10);
					if (isNaN(CASid_value)) {
						CASid_value = parseInt(CASystemID_value, 16);
					}
					if (isNaN(CASid_value)) {
						errs.addError({
							code: "SI032",
							message: `${dvbi.e_CASystemId.elementize()} value (${CASystemID_value}) must me expressed in decimal or hexadecimal`,
							fragment: CASystemID,
							key: keys.k_InvalidIdentifier,
						});
					} else {
						if (CASystemIDs.find((el) => CASid_value >= el.id_from && CASid_value <= el.id_to) == undefined) {
							errs.addError({
								code: "SI033",
								message: `${dvbi.e_CASystemId.elementize()} value (${CASystemID_value}) is not found in ${CA_SYSTEM_ID_REGISTRY}`,
								fragment: CASystemID,
								key: keys.k_InvalidIdentifier,
								description: "The value shall consist of CA System ID as defined in clause 5.2 of ETSI TS 101 162",
								clause: "A177 Table 35",
							});
						}
					}
				}
			}
			let ds = 0,
				DRMSystemID;
			while ((DRMSystemID = ContentProtection.getAnyNs(dvbi.e_DRMSystemId, ++ds)) != null) {
				checkAttributes(DRMSystemID, [], [dvbi.a_encryptionScheme, dvbi.a_cpsIndex], [dvbi.a_encryptionScheme, dvbi.a_cpsIndex], errs, "SI041");
				let DRMSystemID_value = null;
				if (SL_SchemaVersion(documentNamespace) <= slVersions.r1) {
					// first two versions of the schema were 'incorrect' - has nested <DRMSystemId> elements.
					const nestedDRMsystemid = DRMSystemID.getAnyNs(dvbi.e_DRMSystemId);
					if (nestedDRMsystemid) {
						DRMSystemID_value = nestedDRMsystemid.content.toLowerCase();
					}
				} else DRMSystemID_value = DRMSystemID.content.toLowerCase();
				if (DRMSystemID_value && ContentProtectionIDs.find((el) => el.id == DRMSystemID_value || el.id.substring(el.id.lastIndexOf(":") + 1) == DRMSystemID_value) == undefined) {
					errs.addError({
						code: "SI042",
						message: `${dvbi.e_DRMSystemId.elementize()} value (${DRMSystemID_value}) is not found in ${DASH_IF_Content_Protection_List}`,
						fragment: DRMSystemID,
						key: keys.k_InvalidIdentifier,
						description: "The value shall consist of DRM SystemID values as described in clause 8.2 of ETSI TS 103 285",
						clause: "A177 Table 35",
					});
				}
			}
		}

		// <ServiceInstance><ContentAttributes>
		const ContentAttributes = ServiceInstance.getAnyNs(dvbi.e_ContentAttributes);
		if (ContentAttributes) {
			// Check ContentAttributes/AudioAttributes - other subelements are checked with schema based validation
			let cp = 0,
				conf;
			while ((conf = ContentAttributes.getAnyNs(tva.e_AudioAttributes, ++cp)) != null)
				conf.childNodes().forEachSubElement((child) => {
					switch (child.name) {
						case tva.e_Coding:
							if (child.attrAnyNs(dvbi.a_href) && !this.#allowedAudioSchemes.isIn(child.attrAnyNs(dvbi.a_href).value))
								errs.addError({
									code: "SI052",
									message: `invalid ${dvbi.a_href.attribute(child.name)} value for (${child.attrAnyNs(dvbi.a_href).value}) ${this.#allowedAudioSchemes.valuesRange()}`,
									fragment: child,
									key: "audio codec",
									description: `The value specified for ${dvbi.a_href.attribute(child.name)} is constrained in DVB-I.`,
									clause: "A177 Table 56",
								});
							break;
						case tva.e_MixType:
							// taken from MPEG-7 AudioPresentationCS
							if (child.attrAnyNs(dvbi.a_href) && !this.#audioPresentations.isIn(child.attrAnyNs(dvbi.a_href).value))
								errs.addError({
									code: "SI055",
									message: `invalid ${dvbi.a_href.attribute(child.name)} value for (${child.attrAnyNs(dvbi.a_href).value}) ${this.#audioPresentations.valuesRange()}`,
									fragment: child,
									key: "audio codec",
								});
							break;
						case tva.e_AudioLanguage:
							// check if the specificed audio language is included in the LanguageList for the Service List
							if (declaredAudioLanguages.length != 0) {
								const audioLanguage = child.content.toLowerCase();
								const found = declaredAudioLanguages.find((el) => (el.language = audioLanguage));
								if (found == undefined) {
									errs.addError({
										type: WARNING,
										code: "SI053",
										message: `audio language "${child.content}" is not defined in ${dvbi.e_LanguageList.elementize()}`,
										fragment: child,
										key: "audio language",
									});
								} else found.used = true;
							}
							const AudioLanguage_purpose = child.attrAnyNsValueOr(tva.a_purpose, null);
							if (AudioLanguage_purpose) {
								// Since A177r6, only AudioLanguage@purpose=main is premitted in the Content Guide metadata. Language os accessibility services is signned
								// in explicitly in each service definition
								let profiledAudioPurposeCS = [dvbi.AUDIO_PURPOSE_MAIN];
								if (SL_SchemaVersion(child.documentNamespace()) < slVersions.r6)
									profiledAudioPurposeCS.push(dvbi.AUDIO_PURPOSE_VISUAL_IMPAIRED, dvbi.AUDIO_PURPOSE_HEARING_IMPAIRED, dvbi.AUDIO_PURPOSE_DIALOGUE_ENHANCEMENT);
								if (!profiledAudioPurposeCS.includes(AudioLanguage_purpose)) {
									errs.addError({
										code: "SI054",
										message: `the value "${AudioLanguage_purpose}" is not permitted for ${tva.a_purpose.attribute(tva.e_AudioLanguage)}.`,
										fragment: child,
										key: "audio purpose",
										clause: "A177 Table 67 (clause 6.11.3)",
										description: `The allowed set of values for ${tva.a_purpose.attribute(tva.e_AudioLanguage)} was reduced wih the introduction of ${tva.e_AccessibilityAttributes.elementize()} in A177r${slVersions.r6}`,
									});
								}
							}
							break;
					}
				});

			// Check @href of ContentAttributes/AudioConformancePoints
			cp = 0;
			while ((conf = ContentAttributes.getAnyNs(dvbi.e_AudioConformancePoint, ++cp)) != null) {
				if (SL_SchemaVersion(documentNamespace) > slVersions.r4) 
					errs.addError(DeprecatedElement(conf, SchemaSpecVersion(slVersions.r4), "SI062"));
				if (conf.attrAnyNs(dvbi.a_href) && !this.#allowedAudioConformancePoints.isIn(conf.attrAnyNs(dvbi.a_href).value))
					errs.addError({
						code: "SI061",
						message: `invalid ${dvbi.a_href.attribute(dvbi.e_AudioConformancePoint)} (${conf.attrAnyNs(dvbi.a_href).value}) ${this.#allowedAudioConformancePoints.valuesRange()}`,
						fragment: conf,
						key: "audio conf point",
					});
			}

			// Check ContentAttributes/VideoAttributes - other subelements are checked with schema based validation
			cp = 0;
			while ((conf = ContentAttributes.getAnyNs(tva.e_VideoAttributes, ++cp)) != null)
				conf.childNodes().forEachSubElement((child) => {
					switch (child.name) {
						case tva.e_Coding:
							if (child.attrAnyNs(dvbi.a_href) && !this.#allowedVideoSchemes.isIn(child.attrAnyNs(dvbi.a_href).value))
								errs.addError({
									code: "SI072",
									message: `invalid ${dvbi.a_href.attribute(tva.e_Coding)} (${child.attrAnyNs(dvbi.a_href).value}) ${this.#allowedVideoSchemes.valuesRange()}`,
									fragment: child,
									key: "video codec",
								});
							break;
						case tva.e_PictureFormat:
							if (child.attrAnyNs(dvbi.a_href) && !this.#allowedPictureFormats.isIn(child.attrAnyNs(dvbi.a_href).value))
								errs.addError({
									code: "SI082",
									message: `invalid ${dvbi.a_href.attribute(tva.e_PictureFormat)} value (${child.attrAnyNs(dvbi.a_href).value}) ${this.#allowedPictureFormats.valuesRange()}`,
									fragment: child,
									key: tva.e_PictureFormat,
								});
							break;
						case dvbi.e_Colorimetry:
							if (child.attrAnyNs(dvbi.a_href) && !this.#allowedColorimetry.isIn(child.attrAnyNs(dvbi.a_href).value))
								errs.addError({
									code: "SI084",
									message: `invalid ${dvbi.a_href.attribute(dvbi.e_Colorimetry)} value (${child.attrAnyNs(dvbi.a_href).value}) ${this.#allowedColorimetry.valuesRange()}`,
									fragment: child,
									key: dvbi.e_Colorimetry,
								});
							break;
					}
				});

			// HDR DMI terms are in the 2.3 series
			let isHDRDMISystem = (CSterm) => CSterm.substring(CSterm.lastIndexOf(":") + 1).startsWith("2.3.");

			// Check @href of ContentAttributes/VideoConformancePoints
			cp = 0;
			let codec_count = 0,
				conf_points = [];
			while ((conf = ContentAttributes.getAnyNs(dvbi.e_VideoConformancePoint, ++cp)) != null) {
				if (conf.attrAnyNs(dvbi.a_href)) {
					const conformanceVal = conf.attrAnyNs(dvbi.a_href).value;
					if (!this.#allowedVideoConformancePoints.isIn(conformanceVal))
						errs.addError({
							code: "SI091",
							message: `invalid ${dvbi.a_href.attribute(dvbi.e_VideoConformancePoint)} value (${conformanceVal}) ${this.#allowedVideoConformancePoints.valuesRange()}`,
							fragment: conf,
							key: "video conf point",
						});
					else if (!isHDRDMISystem(conformanceVal)) {
						codec_count++;
						if (codec_count > 1)
							errs.addError({
								code: "SI092",
								message: "only a single conformance point for the codec can be specified",
								fragment: conf,
								key: "video conf point",
							});
					}
					if (isIn(conf_points, conformanceVal))
						errs.addError({
							code: "SI093",
							message: `duplicated value for ${dvbi.e_VideoConformancePoint.elementize()}`,
							fragment: conf,
							key: "duplicate conformance point",
						});
					else conf_points.push(conformanceVal);
				}
			}

			// Check ContentAttributes/CaptionLanguage
			cp = 0;
			while ((conf = ContentAttributes.getAnyNs(tva.e_CaptionLanguage, ++cp)) != null) checkLanguage(conf.content, conf, errs, "SI101");

			// Check ContentAttributes/SignLanguage
			cp = 0;
			while ((conf = ContentAttributes.getAnyNs(tva.e_SignLanguage, ++cp)) != null) checkLanguage(conf.content, conf, errs, "SI111");

			// Check ContentAttributes/AccessibilityAttributes
			const aa = ContentAttributes.getAnyNs(tva.e_AccessibilityAttributes);
			if (aa) {
				CheckAccessibilityAttributes(
					aa,
					{
						AccessibilityPurposeCS: this.#accessibilityPurposes,
						VideoCodecCS: this.#allowedVideoSchemes,
						AudioCodecCS: this.#allowedAudioSchemes,
						SubtitleCarriageCS: this.#subtitleCarriages,
						SubtitleCodingFormatCS: this.#subtitleCodings,
						SubtitlePurposeTypeCS: this.#subtitlePurposes,
						KnownLanguages: this.#knownLanguages,
						AudioPresentationCS: this.#audioPresentations,
					},
					errs,
					"SI112"
				);
			}
		}

		// <ServiceInstance><Availability>
		const Availability = ServiceInstance.getAnyNs(dvbi.e_Availability);
		if (Availability) {
			let Period,
				p = 0;
			while ((Period = Availability.getAnyNs(dvbi.e_Period, ++p)) != null)
				if (Period.attrAnyNs(dvbi.a_validFrom) && Period.attrAnyNs(dvbi.a_validTo)) {
					// validTo should be >= validFrom
					const fr = new Date(Period.attrAnyNs(dvbi.a_validFrom).value),
						to = new Date(Period.attrAnyNs(dvbi.a_validTo).value);

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
		let sp = 0,
			SubscriptionPackage,
			packages_found = [];
		while ((SubscriptionPackage = ServiceInstance.getAnyNs(dvbi.e_SubscriptionPackage, ++sp)) != null) {
			const pkg_lang = mlLanguage(SubscriptionPackage);
			const pkg = localizedSubscriptionPackage(SubscriptionPackage, pkg_lang);
			if (SL_SchemaVersion(documentNamespace) >= slVersions.r3) {
				if (!declaredSubscriptionPackages.includes(pkg))
					errs.addError({
						code: "SI130",
						message: `${dvbi.e_SubscriptionPackage.elementize()} "${SubscriptionPackage.content}" with language "${pkg_lang}" is not declared in ${dvbi.e_SubscriptionPackageList.elementize()}`,
						fragment: SubscriptionPackage,
						key: `undeclared ${dvbi.e_SubscriptionPackage}`,
					});
			}
			if (isIn(packages_found, pkg)) {
				errs.addError({
					type: WARNING,
					code: "SI131",
					message: `${dvbi.e_SubscriptionPackage.elementize()} "${SubscriptionPackage.content}" with language "${pkg_lang}" is already defined in this service instance`,
					fragment: SubscriptionPackage,
					key: `duplicate ${dvbi.e_SubscriptionPackage}`,
				});
			} else packages_found.push(pkg);
		}

		// <ServiceInstance><FTAContentManagement>

		// note that the <SourceType> element becomes optional and in A177r1, but if specified then the relevant
		// delivery parameters also need to be specified
		const SourceType = ServiceInstance.getAnyNs(dvbi.e_SourceType);
		if (SourceType) {
			let v1Params = false;
			switch (SourceType.content) {
				case dvbi.DVBT_SOURCE_TYPE:
					if (!ServiceInstance.hasChild(dvbi.e_DVBTDeliveryParameters)) errs.addError(NoDeliveryParams("DVB-T", thisServiceId, SourceType, "SI151"));
					v1Params = true;
					break;
				case dvbi.DVBS_SOURCE_TYPE:
					if (!ServiceInstance.hasChild(dvbi.e_DVBSDeliveryParameters)) errs.addError(NoDeliveryParams("DVB-S", thisServiceId, SourceType, "SI152"));
					v1Params = true;
					break;
				case dvbi.DVBC_SOURCE_TYPE:
					if (!ServiceInstance.hasChild(dvbi.e_DVBCDeliveryParameters)) errs.addError(NoDeliveryParams("DVB-C", thisServiceId, SourceType, "SI153"));
					v1Params = true;
					break;
				case dvbi.DVBDASH_SOURCE_TYPE:
					if (!ServiceInstance.hasChild(dvbi.e_DASHDeliveryParameters)) errs.addError(NoDeliveryParams("DVB-DASH", thisServiceId, SourceType, "SI154"));
					v1Params = true;
					break;
				case dvbi.DVBIPTV_SOURCE_TYPE:
					if (!ServiceInstance.hasChild(dvbi.e_MulticastTSDeliveryParameters) && !ServiceInstance.hasChild(dvbi.e_RTSPDeliveryParameters))
						errs.addError(NoDeliveryParams("Multicast or RTSP", thisServiceId, SourceType, "SI155"));
					v1Params = true;
					break;
				case dvbi.DVBAPPLICATION_SOURCE_TYPE:
					// there should not be any <xxxxDeliveryParameters> elements and there should be either a Service.RelatedMaterial or Service.ServiceInstance.RelatedMaterial signalling a service related application
					const foundDeliveryParameters = deliveryParameters(ServiceInstance);
					if (foundDeliveryParameters) {
						errs.addError({
							code: "SI156",
							message: `Delivery parameters are not permitted for Application service instance in Service ${thisServiceId.quote()}`,
							fragments: [SourceType, foundDeliveryParameters],
							key: "invalid application",
						});
						v1Params = true;
					} else {
						// no xxxxDeliveryParameters is signalled
						// check for appropriate Service.RelatedMaterial or Service.ServiceInstance.RelatedMaterial
						const service = ServiceInstance.parent;
						if (!this.#hasSignalledApplication(service) && !this.#hasSignalledApplication(ServiceInstance)) {
							errs.addError({
								code: "SI157a",
								message: `No Application is signalled for ${dvbi.e_SourceType}=${dvbi.DVBAPPLICATION_SOURCE_TYPE.quote()} in Service ${thisServiceId.quote()}`,
								line: service.line,
								key: "no application",
							});
							errs.addError({
								code: "SI157b",
								message: `No Application is signalled for ${dvbi.e_SourceType}=${dvbi.DVBAPPLICATION_SOURCE_TYPE.quote()} in ServiceInstance ${thisServiceId.quote()}`,
								line: ServiceInstance.line,
								key: "no application",
							});
						}
					}
					break;
				default:
					switch (SL_SchemaVersion(documentNamespace)) {
						case slVersions.r0:
							errs.addError({
								code: "SI158",
								message: `${dvbi.e_SourceType.elementize()} ${SourceType.content.quote()} is not valid in Service ${thisServiceId.quote()}`,
								fragment: SourceType,
								key: `invalid ${dvbi.e_SourceType}`,
							});
							break;
						case slVersions.r1:
						case slVersions.r2:
						case slVersions.r3:
						case slVersions.r4:
						case slVersions.r5:
							if (!ServiceInstance.hasChild(dvbi.e_OtherDeliveryParameters))
								errs.addError({
									code: "SI159",
									message: `${dvbi.e_OtherDeliveryParameters.elementize()} must be specified with user-defined ${dvbi.e_SourceType} ${SourceType.content.quote()}`,
									line: ServiceInstance.line,
									key: `no ${dvbi.e_OtherDeliveryParameters}`,
								});
							break;
					}
			}
			if (v1Params && SL_SchemaVersion(documentNamespace) >= slVersions.r1) 
				errs.addError(DeprecatedElement(SourceType, SchemaSpecVersion(slVersions.r1), "SI160"));
		} else {
			if (SL_SchemaVersion(documentNamespace) == slVersions.r0)
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
		while ((altSN = ServiceInstance.getAnyNs(dvbi.e_AltServiceName, ++alt)) != null) {
			if (DuplicatedValue(alternateNames, altSN.content))
				errs.addError({
					type: WARNING,
					code: "SI165",
					fragment: altSN,
					message: `${dvbi.e_AltServiceName}=${altSN.content.quote()} already specified in ${dvbi.e_ServiceInstance.elementize()} of service ${thisServiceId.quote()}`,
					key: "duplicate name",
				});
		}

		// <ServiceInstance><DASHDeliveryParameters>
		const DASHDeliveryParameters = ServiceInstance.getAnyNs(dvbi.e_DASHDeliveryParameters);
		if (DASHDeliveryParameters) {
			const URIBasedLocation = DASHDeliveryParameters.getAnyNs(dvbi.e_UriBasedLocation);
			if (URIBasedLocation) {
				const uriContentType = URIBasedLocation.attrAnyNs(dvbi.a_contentType);
				if (uriContentType && !validDASHcontentType(uriContentType.value))
					errs.addError({
						code: "SI173",
						fragment: URIBasedLocation,
						message: `${dvbi.a_contentType.attribute()}=${uriContentType.value.quote()} in service ${thisServiceId.quote()} is not valid`,
						key: `no ${dvbi.a_contentType.attribute()} for DASH`,
					});

				const uri = URIBasedLocation.getAnyNs(dvbi.e_URI);
				if (uri && !isHTTPURL(uri.content))
					errs.addError({
						code: "SI174",
						message: `invalid URL ${uri.content.quote()} specified for ${dvbi.e_URI.elementize()} of service ${thisServiceId.quote()}`,
						fragment: uri,
						key: "invalid resource URL",
					});
			}

			// <DASHDeliveryParameters><CMCD>
			ValidateCMCDinDASH(DASHDeliveryParameters, errs, "SI175");

			// <DASHDeliveryParameters><Extension>
			let e = 0,
				Extension;
			while ((Extension = DASHDeliveryParameters.getAnyNs(dvbi.e_Extension, ++e)) != null) {
				CheckExtension(Extension, EXTENSION_LOCATION_DASH_INSTANCE, errs, "SI179");
			}
		}

		// <ServiceInstance><DVBTDeliveryParameters>
		const DVBTDeliveryParameters = ServiceInstance.getAnyNs(dvbi.e_DVBTDeliveryParameters);
		if (DVBTDeliveryParameters) {
			const DVBTtargetCountry = DVBTDeliveryParameters.getAnyNs(dvbi.e_TargetCountry);
			if (DVBTtargetCountry) {
				if (!this.#knownCountries.isISO3166code(DVBTtargetCountry.content))
					errs.addError({
						code: "SI182",
						message: InvalidCountryCode(DVBTtargetCountry.content, "DVB-T", `service ${thisServiceId.quote()}`),
						fragment: DVBTtargetCountry,
						key: keys.k_InvalidCountryCode,
					});
				if (SL_SchemaVersion(documentNamespace) >= slVersions.r6) 
					errs.addError(DeprecatedElement(DVBTtargetCountry, SchemaSpecVersion(slVersions.r6), "SI183"));
			}
		}

		// <ServiceInstance><DVBCDeliveryParameters>
		const DVBCDeliveryParameters = ServiceInstance.getAnyNs(dvbi.e_DVBCDeliveryParameters);
		if (DVBCDeliveryParameters) {
			const DVBCtargetCountry = DVBCDeliveryParameters.getAnyNs(dvbi.e_TargetCountry);
			if (DVBCtargetCountry) {
				if (!this.#knownCountries.isISO3166code(DVBCtargetCountry.content))
					errs.addError({
						code: "SI191",
						message: InvalidCountryCode(DVBCtargetCountry.content, "DVB-C", `service ${thisServiceId.quote()}`),
						fragment: DVBCtargetCountry,
						key: keys.k_InvalidCountryCode,
					});
				if (SL_SchemaVersion(documentNamespace) >= slVersions.r6) 
					errs.addError(DeprecatedElement(DVBCtargetCountry, SchemaSpecVersion(slVersions.r6), "SI192"));
			}
			if (SL_SchemaVersion(documentNamespace) >= slVersions.r7) {
				// prior to A177r7 only a single value for <DVBCDeliveryParameters><NetworkID> was specified
				let n = 0,
					NetworkID,
					knownIDs = [];
				while ((NetworkID = DVBCDeliveryParameters.getAnyNs(dvbi.e_NetworkID, ++n)) != null) {
					const nid = NetworkID.value;
					if (isIn(knownIDs, nid)) {
						errs.addError({
							code: "SI193",
							type: WARNING,
							key: keys.k_DuplicateValue,
							fragment: NetworkID,
							message: "duplicated Network ID value",
						});
					} else knownIDs.push(nid);
				}
			}
		}

		// <ServiceInstance><DVBSDeliveryParameters>
		const DVBSDeliveryParameters = ServiceInstance.getAnyNs(dvbi.e_DVBSDeliveryParameters);
		if (DVBSDeliveryParameters) {
			const ERROR_KEY = "satellite tuning";
			const ModulationSystem = DVBSDeliveryParameters.getAnyNs(dvbi.e_ModulationSystem);
			const RollOff = DVBSDeliveryParameters.getAnyNs(dvbi.e_RollOff);
			const ModulationType = DVBSDeliveryParameters.getAnyNs(dvbi.e_ModulationType);
			const FEC = DVBSDeliveryParameters.getAnyNs(dvbi.e_FEC);

			if (ModulationSystem) {
				let checkElement = (element, elementName, allowed, modulation, errCode) => {
					if (element && !isIn(allowed, element.content))
						errs.addError({
							code: errCode,
							key: ERROR_KEY,
							message: `${elementName}=${element.content.quote()} is not permitted for ${modulation} modulation system`,
							fragment: element,
						});
				};
				let DisallowedElement = (element, childElementName, modulation, suffix = "-0") => {
					if (element.hasChild(childElementName))
						errs.addError({
							code: `SI204${suffix}`,
							key: ERROR_KEY,
							message: `${childElementName.elementize()} is not permitted for ${dvbi.e_ModulationSystem}="${modulation}"`,
							fragment: element.getAnyNs(childElementName),
						});
				};

				switch (ModulationSystem.content) {
					case sats.MODULATION_S:
						checkElement(RollOff, dvbi.e_RollOff, sats.S_RollOff, sats.MODULATION_S, "SI201a");
						checkElement(ModulationType, dvbi.e_ModulationType, sats.S_Modulation, sats.MODULATION_S, "SI202a");
						checkElement(FEC, dvbi.e_FEC, sats.S_FEC, sats.MODULATION_S, "SI203a");
						DisallowedElement(DVBSDeliveryParameters, dvbi.e_ModcodMode, sats.MODULATION_S, "a");
						DisallowedElement(DVBSDeliveryParameters, dvbi.e_InputStreamIdentifier, sats.MODULATION_S, "b");
						DisallowedElement(DVBSDeliveryParameters, dvbi.e_ChannelBonding, sats.MODULATION_S, "c");
						break;
					case sats.MODULATION_S2:
						checkElement(RollOff, dvbi.e_RollOff, sats.S2_RollOff, sats.MODULATION_S2, "SI201b");
						checkElement(ModulationType, dvbi.e_ModulationType, sats.S2_Modulation, sats.MODULATION_S2, "SI202b");
						checkElement(FEC, dvbi.e_FEC, sats.S2_FEC, sats.MODULATION_S2, "SI203b");
						DisallowedElement(DVBSDeliveryParameters, dvbi.e_ModcodMode, sats.MODULATION_S2, "k");
						DisallowedElement(DVBSDeliveryParameters, dvbi.e_InputStreamIdentifier, sats.MODULATION_S2, "l");
						DisallowedElement(DVBSDeliveryParameters, dvbi.e_ChannelBonding, sats.MODULATION_S2, "m");
						break;
					case sats.MODULATION_S2X:
						checkElement(RollOff, dvbi.e_RollOff, sats.S2X_RollOff, sats.MODULATION_S2X, "SI201c");
						checkElement(ModulationType, dvbi.e_ModulationType, sats.S2X_Modulation, sats.MODULATION_S2X, "SI202c");
						checkElement(FEC, dvbi.e_FEC, sats.S2X_FEC, sats.MODULATION_S2X, "SI203c");
						// <ModcodMode> is value checked in schema verification
						// <InputStreamIdentifier> is ranfe checked in schema verification
						/* eslint-disable no-case-declarations */
						const ChannelBonding = DVBSDeliveryParameters.getAnyNs(dvbi.e_ChannelBonding);
						/* eslint-enable */
						if (ChannelBonding) {
							let fq = 0,
								Frequency,
								freqs = [],
								primarySpecified = false;
							while ((Frequency = ChannelBonding.getAnyNs(dvbi.e_Frequency, ++fq)) != null) {
								if (isIn(freqs, Frequency.content))
									errs.addError({
										code: "SI205",
										key: ERROR_KEY,
										message: `${dvbi.e_Frequency.elementize()} value ${Frequency.content.quote()} already specified`,
										fragment: Frequency,
									});
								else freqs.push(Frequency.content);
								if (Frequency.attrAnyNs(dvbi.a_primary) && isIn(["true"], Frequency.attrAnyNs(dvbi.a_primary).value, false)) {
									if (primarySpecified)
										errs.addError({
											code: "SI206",
											key: ERROR_KEY,
											message: `${dvbi.e_Frequency.elementize()} already specified with ${dvbi.a_primary.attribute()}=true`,
											fragment: Frequency,
										});
									else primarySpecified = true;
								}
							}
						}
						break;
				}
			}
		}

		// <ServiceInstance><SATIPDeliveryParameters>
		// SAT-IP Delivery Parameters can only exist if DVB-T or DVB-S delivery parameters are specified
		// checked by schema validation

		// <ServiceInstance><RTSPDeliveryParameters>
		const RTSPDeliveryParameters = ServiceInstance.getAnyNs(dvbi.e_RTSPDeliveryParameters);
		if (RTSPDeliveryParameters) {
			const RTSPURL = RTSPDeliveryParameters.getAnyNs(dvbi.e_RTSPURL);
			if (RTSPURL && !isRTSPURL(RTSPURL.content)) errs.addError(InvalidURL(RTSPURL.content, RTSPURL, dvbi.e_RTSPURL.elementize(), "SI223"));
		}

		// <ServiceInstance><MulticastTSDeliveryParameters>
		const MulticastTSDeliveryParameters = ServiceInstance.getAnyNs(dvbi.e_MulticastTSDeliveryParameters);
		if (MulticastTSDeliveryParameters) checkMulticastDeliveryParams(MulticastTSDeliveryParameters, errs, "SI235");

		// <ServiceInstance><OtherDeliveryParameters>
		const OtherDeliveryParameters = ServiceInstance.getAnyNs(dvbi.e_OtherDeliveryParameters);
		if (OtherDeliveryParameters) CheckExtension(OtherDeliveryParameters, EXTENSION_LOCATION_OTHER_DELIVERY, errs, "SI237");
	}

	/**
	 * validate a Service or TestService element
	 *
	 * @param {XmlElement} service                       the service or testservice element to check
	 * @param {String}     thisServiceId                 the identifier of the service
	 * @param {Array}      knownServices                 services found and checked thus far
	 * @param {Array}      knownRegionIDs                regions identifiers from the RegionList
	 * @param {Array}      declaredSubscriptionPackages  subscription packages that are declared in the service list
	 * @param {Array}      declaredAudioLanguages        language values declared in the <LanguageList> of the service list
	 * @param {Array}      ContentGuideSourceIDs         identifiers of content guide sources found in the service list
	 * @param {ErrorList}  errs                          errors found in validaton
	 */
	/*private*/ #validateService(service, thisServiceId, knownServices, knownRegionIDs, declaredSubscriptionPackages, declaredAudioLanguages, ContentGuideSourceIDs, errs) {
		checkAttributes(service, [], [dvbi.a_dynamic, dvbi.a_version, dvbi.a_replayAvailable, tva.a_lang], dvbiEA.ServiceType, errs, "SL104");
		checkTopElementsAndCardinality(
			service,
			[
				{ name: dvbi.e_UniqueIdentifier },
				{ name: dvbi.e_ServiceInstance, minOccurs: 0, maxOccurs: Infinity },
				{ name: dvbi.e_TargetRegion, minOccurs: 0, maxOccurs: Infinity },
				{ name: dvbi.e_ServiceName, maxOccurs: Infinity },
				{ name: dvbi.e_ProviderName, maxOccurs: Infinity },
				{ name: dvbi.e_RelatedMaterial, minOccurs: 0, maxOccurs: Infinity },
				{ name: dvbi.e_ServiceGenre, minOccurs: 0, maxOccurs: Infinity },
				{ name: dvbi.e_ServiceType, minOccurs: 0 },
				{ name: dvbi.e_ServiceDescription, minOccurs: 0, maxOccurs: Infinity },
				{ name: dvbi.e_RecordingInfo, minOccurs: 0 },
				{ name: dvbi.e_ContentGuideSource, minOccurs: 0 }, // TODO it is a choice of ContentGuideSource or ContentGuideSourceRef. Fix this later
				{ name: dvbi.e_ContentGuideSourceRef, minOccurs: 0 },
				{ name: dvbi.e_ContentGuideServiceRef, minOccurs: 0 },
				{ name: dvbi.e_AdditionalServiceParameters, minOccurs: 0, maxOccurs: Infinity },
				{ name: dvbi.e_NVOD, minOccurs: 0 },
				{ name: dvbi.e_ProminenceList, minOccurs: 0 },
				{ name: dvbi.e_ParentalRating, minOccurs: 0 },
			],
			dvbiEC.ServiceType,
			false,
			errs,
			"SL105"
		);

		// check <UniqueIdentifier>
		const uID = service.getAnyNs(dvbi.e_UniqueIdentifier);
		if (uID) {
			thisServiceId = uID.content;
			if (!validServiceIdentifier(thisServiceId))
				errs.addError({
					code: "SL110",
					message: `${thisServiceId.quote()} is not a valid service identifier`,
					fragment: uID,
					key: keys.k_InvalidTag,
					description: "service identifier should be a tag: URI according to IETF RFC 4151",
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
		while ((ServiceInstance = service.getAnyNs(dvbi.e_ServiceInstance, ++si)) != null)
			this.#validateServiceInstance(ServiceInstance, thisServiceId, declaredSubscriptionPackages, declaredAudioLanguages, errs);

		//check <TargetRegion>
		let tr = 0,
			TargetRegion,
			rBuf = [];
		while ((TargetRegion = service.getAnyNs(dvbi.e_TargetRegion, ++tr)) != null) {
			const found = knownRegionIDs.find((r) => r.region == TargetRegion.content);
			if (found == undefined) errs.addError(UnspecifiedTargetRegion(TargetRegion.content, `service ${thisServiceId.quote()}`, "SL130", TargetRegion));
			else found.used = true;
			if (DuplicatedValue(rBuf, TargetRegion.content)) {
				errs.addError({
					type: WARNING,
					code: "SL131",
					key: "duplicate value",
					message: `duplicate value (${TargetRegion.content}) specified for ${dvbi.e_TargetRegion.elementize()}`,
					fragment: TargetRegion,
				});
			}
		}

		//check <ServiceName>
		checkXMLLangs(dvbi.e_ServiceName, `service ${thisServiceId.quote()}`, service, errs, "SL140");

		//check <ProviderName>
		checkXMLLangs(dvbi.e_ProviderName, `service ${thisServiceId.quote()}`, service, errs, "SL141");

		//check <RelatedMaterial>
		let rm = 0,
			RelatedMaterial;
		while ((RelatedMaterial = service.getAnyNs(tva.e_RelatedMaterial, ++rm)) != null)
			this.#validateRelatedMaterial(RelatedMaterial, `service ${thisServiceId.quote()}`, SERVICE_RM, errs, "SL150");

		//check <ServiceGenre>
		let sg = 0,
			ServiceGenre;
		while ((ServiceGenre = service.getAnyNs(dvbi.e_ServiceGenre, ++sg)) != null) {
			checkAttributes(ServiceGenre, [tva.a_href], [tva.a_type], tvaEA.Genre, errs, "SL160");
			const Genre_type = ServiceGenre.attrAnyNsValueOr(tva.a_type, null);
			if (Genre_type && !isIn(tva.ALL_GENRE_TYPES, Genre_type))
				errs.addError({
					code: "SL161",
					message: `service ${thisServiceId.quote()} has an invalid ${tva.a_type.attribute(dvbi.e_ServiceGenre)} type ${Genre_type.quote()}`,
					fragment: ServiceGenre,
					key: `invalid ${tva.a_type.attribute(dvbi.e_ServiceGenre)}`,
				});

			const Genre_href = ServiceGenre.attrAnyNsValueOr(dvbi.a_href, null);
			if (Genre_href && !this.#allowedGenres.isIn(Genre_href))
				errs.addError({
					code: "SL162",
					message: `service ${thisServiceId.quote()} has an invalid ${dvbi.a_href.attribute(dvbi.e_ServiceGenre)} value ${Genre_href.quote()} (must be content genre)`,
					fragment: ServiceGenre,
					key: `invalid ${dvbi.a_href.attribute(dvbi.e_ServiceGenre)}`,
				});
		}
		//check <ServiceType>
		const ServiceType = service.getAnyNs(dvbi.e_ServiceType);
		if (ServiceType) {
			const ServiceType_href = ServiceType.attrAnyNsValueOr(dvbi.a_href, null);
			if (ServiceType_href && !this.#allowedServiceTypes.isIn(ServiceType_href))
				errs.addError({
					code: "SL164",
					message: `service ${thisServiceId.quote()} has an invalid ${dvbi.e_ServiceType.elementize()} (${ServiceType_href})`,
					fragment: ServiceType,
					key: `invalid ${dvbi.a_href.attribute(dvbi.e_ServiceType)}`,
				});
		}

		// check <ServiceDescription>
		this.#ValidateSynopsisType(
			service,
			dvbi.e_ServiceDescription,
			[],
			[tva.SYNOPSIS_BRIEF_LABEL, tva.SYNOPSIS_SHORT_LABEL, tva.SYNOPSIS_MEDIUM_LABEL, tva.SYNOPSIS_LONG_LABEL, tva.SYNOPSIS_EXTENDED_LABEL],
			"***",
			errs,
			"SL170"
		);

		// check <RecordingInfo>
		const RecordingInfo = service.getAnyNs(dvbi.e_RecordingInfo);
		if (RecordingInfo) {
			const RI_href = RecordingInfo.attrAnyNsValueOr(dvbi.a_href, null);
			if (RI_href && !this.#RecordingInfoCSvalues.isIn(RI_href))
			errs.addError({
				code: "SL180",
				message: `invalid ${dvbi.e_RecordingInfo.elementize()} value ${RI_href.quote()} for service ${thisServiceId} ${this.#RecordingInfoCSvalues.valuesRange()}`,
				fragment: RecordingInfo,
				key: `invalid ${dvbi.a_href.attribute(dvbi.e_RecordingInfo)}`,
			});
		}

		// check <ContentGuideSource>
		const sCG = service.getAnyNs(dvbi.e_ContentGuideSource);
		if (sCG) this.#validateAContentGuideSource(sCG, `${dvbi.e_ContentGuideSource.elementize()} in service ${thisServiceId}`, errs, "SL190");

		//check <ContentGuideSourceRef>
		const sCGref = service.getAnyNs(dvbi.e_ContentGuideSourceRef);
		if (sCGref && !isIn(ContentGuideSourceIDs, sCGref.content))
			errs.addError({
				code: "SL200",
				message: `content guide reference ${sCGref.content.quote()} for service ${thisServiceId.quote()} not specified`,
				fragment: sCGref,
				key: "unspecified content guide source",
			});

		// check <AdditionalServiceParameters>
		let ap = 0,
			AdditionalParams;
		while ((AdditionalParams = service.getAnyNs(dvbi.e_AdditionalServiceParameters, ++ap)) != null)
			CheckExtension(AdditionalParams, EXTENSION_LOCATION_SERVICE_ELEMENT, errs, "SL211");

		// check <NVOD>
		const NVOD = service.getAnyNs(dvbi.e_NVOD);
		if (NVOD) {
			const NVOD_mode = NVOD.attrAnyNsValueOr(dvbi.a_mode, null);
			if (NVOD_mode && NVOD_mode == dvbi.NVOD_MODE_REFERENCE) {
				if (NVOD.attrAnyNs(dvbi.a_reference))
					errs.addError({
						code: "SL221",
						message: `${dvbi.a_reference.attribute()} is not permitted for ${dvbi.a_mode.attribute(dvbi.e_NVOD)}="${dvbi.NVOD_MODE_REFERENCE}"`,
						fragment: NVOD,
						key: "unallowed attribute",
					});
				if (NVOD.attrAnyNs(dvbi.a_offset))
					errs.addError({
						code: "SL222",
						message: `${dvbi.a_offset.attribute()} is not permitted for ${dvbi.a_mode.attribute(dvbi.e_NVOD)}="${dvbi.NVOD_MODE_REFERENCE}"`,
						fragment: NVOD,
						key: "unallowed attribute",
					});
			}
			if (NVOD_mode && NVOD_mode == dvbi.NVOD_MODE_TIMESHIFTED) {
				checkAttributes(NVOD, [dvbi.a_mode, dvbi.a_reference], [dvbi.a_offset], dvbiEA.NVOD, errs, "SL223");

				const ServiceList = service.parent;

				const NVOD_reference = NVOD.attrAnyNsValueOr(dvbi.a_reference, null);
				if (NVOD_reference) {
					if (!isTAGURI(NVOD_reference)) {
						errs.addError({
							code: "SL224a",
							message: `${NVOD_reference.quote()} is not a TAG URI`,
							fragment: NVOD,
							key: "NVOD timeshift",
						});
					}
					if (hasNonPrintableChars(NVOD_reference)) {
						errs.addError({
							code: "SL224b",
							message: `${dvbi.a_reference.attribute(NVOD.name)} contains non-ASCII characters`,
							fragment: NVOD,
							key: "NVOD timeshift",
						});
					}

					// check to see if there is a service whose <UniqueIdentifier> equals NVOD@reference and has a NVOD@mode==reference
					let s2 = 0,
						service2,
						referredService = null;
					const referenced_service = NVOD.attrAnyNs(dvbi.a_reference).value;

					while ((service2 = ServiceList.getAnyNs(dvbi.e_Service, ++s2)) != null && !referredService) {
						const ui = service2.getAnyNs(dvbi.e_UniqueIdentifier);
						if (ui?.content == NVOD_reference) {
							referredService = service2;
						}
					}
					if (!referredService)
						errs.addError({
							code: "SL225a",
							message: `no service found with ${dvbi.e_UniqueIdentifier.elementize()}="${NVOD_reference}"`,
							fragment: NVOD,
							key: "NVOD timeshift",
						});
					else {
						const refNVOD = referredService.getAnyNs(dvbi.e_NVOD);
						if (!refNVOD)
							errs.addError({
								code: "SL225b",
								message: `service ${referenced_service} has no ${dvbi.e_NVOD.elementize()} information`,
								fragment: NVOD,
								key: "not NVOD",
							});
						else {
							if (refNVOD.attrAnyNs(dvbi.a_mode) && refNVOD.attrAnyNs(dvbi.a_mode).value != dvbi.NVOD_MODE_REFERENCE)
								errs.addError({
									code: "SL225c",
									message: `service ${referenced_service} is not defined as an NVOD reference`,
									fragment: NVOD,
									key: "not NVOD",
								});
						}
					}
				}
			}
			const svcType = service.getAnyNs(dvbi.e_ServiceType);
			if (svcType && svcType.attrAnyNs(dvbi.a_href) && !svcType.attrAnyNs(dvbi.a_href).value.endsWith("linear"))
				// this is a but of a hack, but sufficient to determine linear service type
				errs.addError({
					code: "SL227",
					message: `${dvbi.a_href.attribute(dvbi.e_ServiceType)} must be linear for NVOD reference or timeshifted services`,
					fragments: [NVOD, svcType],
					key: `invalid ${dvbi.e_ServiceType}`,
				});
		}

		// check <Prominence>
		const ProminenceList = service.getAnyNs(dvbi.e_ProminenceList);
		if (ProminenceList) {
			let p = 0,
				PE,
				known = [];
			while ((PE = ProminenceList.getAnyNs(dvbi.e_Prominence, ++p)) != null) {
				// if @region is used, it must be in the RegionList
				const PE_region = PE.attrAnyNsValueOr(dvbi.a_region, null);
				if (PE_region) {
					const found = knownRegionIDs.find((r) => r.region == PE_region);
					if (found === undefined)
						errs.addError({
							code: "SL229",
							message: `regionID ${PE_region.quote()} not specified in ${dvbi.e_RegionList.elementize()}`,
							fragment: PE,
							key: keys.k_InvalidRegion,
						});
					else found.used = true;
				}
				// if @country and @region are used, they must be per the region list

				const PE_country = PE.attrAnyNsValueOr(dvbi.a_country, null);
				if (PE_country && PE_region) {
					const found = knownRegionIDs.find((r) => r.region == PE_region);
					if (found !== undefined && Object.prototype.hasOwnProperty.call(found, "countries")) {
						if (found.countries.length) {
							if (found.countries.find((c) => c == PE_country) === undefined)
								errs.addError({
									code: "SL230",
									message: `regionID ${PE_region.quote()} not specified for country ${PE_country.quote()} in ${dvbi.e_RegionList.elementize()}`,
									fragment: PE,
									key: keys.k_InvalidRegion,
								});
							else found.used = true;
						}
					}
				}
				// if @country is specified, it must be valid
				if (PE_country && !this.#knownCountries.isISO3166code(PE_country)) {
					errs.addError({
						code: "SL244",
						message: InvalidCountryCode(PE_country, null, `service ${thisServiceId.quote()}`),
						fragment: PE,
						key: keys.k_InvalidCountryCode,
					});
				}
				// for exact match
				const PE_ranking = PE.attrAnyNsValueOr(dvbi.a_ranking, null);
				const hash1 = `c:${PE_country || "**"} re:${PE_region|| "**"}  ra:${PE_ranking|| "**"}`;
				if (!isIn(known, hash1)) known.push(hash1);
				else {
					const country = `${PE_country ? `country:${PE_country}` : ""}`,
						region = `${PE_region ? `region:${PE_region}` : ""}`,
						ranking = `${PE_ranking ? `ranking:${PE_ranking}` : ""}`;
					errs.addError({
						code: "SL245",
						message: `duplicate ${dvbi.e_Prominence.elementize()} ${country.length || region.length || ranking.length ? "for" : ""} ${country} ${region} ${ranking}`,
						fragment: PE,
						key: `duplicate ${dvbi.e_Prominence}`,
					});
				}
				// for multiple @ranking in same country/region pair
				if (PE_ranking) {
					const hash2 = `c:${PE_country || "**"} re:${PE_region || "**"}`;
					if (!isIn(known, hash2)) known.push(hash2);
					else {
						const country = `${PE_country ? `country:${PE_country}` : ""}`,
							region = `${PE_region ? `region:${PE_region}` : ""}`;
						errs.addError({
							code: "SL246",
							message: `multiple ${dvbi.a_ranking.attribute()} ${country.length || region.length ? "for" : ""} ${country} ${region}`,
							fragment: PE,
							key: `duplicate ${dvbi.e_Prominence}`,
						});
					}
				}
			}
		}

		// check <ParentalRating>
		const ParentalRating = service.getAnyNs(dvbi.e_ParentalRating);
		if (ParentalRating) {
			let ma = 0,
				MinimumAge,
				foundCountries = [],
				noCountrySpecified = false;
			while ((MinimumAge = ParentalRating.getAnyNs(dvbi.e_MinimumAge, ++ma)) != null) {
				const MinimumAge_countryCodes = MinimumAge.attrAnyNsValueOr(dvbi.a_countryCodes, null);
				if (MinimumAge_countryCodes) {
					MinimumAge_countryCodes.toUpperCase().split(",")
						.forEach((country) => {
							if (!this.#knownCountries.isISO3166code(country))
								errs.addError({
									code: "SL251",
									message: `invalid country code (${country}) specified`,
									key: keys.k_InvalidCountryCode,
									fragment: MinimumAge,
								});
							if (isIn(foundCountries, country))
								errs.addError({
									code: "SL252",
									message: `duplicate country code (${country}) specified`,
									key: "duplicate country",
									fragment: MinimumAge,
									clause: "A177 Table 37f",
									desciption: `A maximum of one ${dvbi.e_MinimumAge} shall be defined per country`,
								});
							else foundCountries.push(country);
						});
				} else {
					if (noCountrySpecified)
						errs.addError({
							code: "SL253",
							key: "duplicated country",
							fragment: MinimumAge,
							message: "a default minimum age is already specified for this service",
						});
					else noCountrySpecified = true;
				}
			}
		}
	}

	/*private*/ #doSchemaVerification(ServiceList, errs, errCode, report_schema_version = true) {
		const x = GetSchema(ServiceList.root.namespaceUri);
		if (x && x.schema) {
			SchemaCheck(ServiceList, x.schema, x.filename, errs, `${errCode}:${SL_SchemaVersion(ServiceList.root.namespaceUri)}`);
			if (report_schema_version) SchemaVersionCheck(ServiceList, x.status, errs, `${errCode}:`);
			return true;
		}
		return false;
	}

	/**
	 * validate the service list and record any errors
	 *
	 * @param {String}    SLtext      The service list text to be validated
	 * @param {ErrorList} errs        Errors found in validaton
	 * @param {Object}    options
	 *                      log_prefix            the first part of the logging location (or null if no logging)
	 *                      report_schema_version report the state of the schema in the error/warning list
	 */
	/*public*/ doValidateServiceList(SLtext, errs, options = {}) {
		this.#numRequests++;
		if (!SLtext) {
			errs.addError({
				type: APPLICATION,
				code: "SL000",
				message: "doValidateServiceList() called with SLtext==null",
			});
			return;
		}

		if (!Object.prototype.hasOwnProperty.call(options, "log_prefix")) options.log_prefix = null;
		if (!Object.prototype.hasOwnProperty.call(options, "report_schema_version")) options.report_schema_version = true;

		const SL = SchemaLoad(SLtext, errs, "SL001");
		if (!SL) return;
		writeOut(errs, options.log_prefix, false);

		if (SL.root.name !== dvbi.e_ServiceList) {
			errs.addError({
				code: "SL004",
				message: `Root element is not ${dvbi.e_ServiceList.elementize()}`,
				line: SL.root.line,
				key: keys.k_XSDValidation,
				clause: "A177 clause 5.5.1",
				description: `the root element of the service list XML instance document must be ${dvbi.e_ServiceList.elementize()}`,
			});
			return;
		}

		if (!SL.root.namespaceUri) {
			errs.addError({
				code: "SL003",
				message: `namespace is not provided for ${dvbi.e_ServiceList.elementize()}`,
				line: SL.root.line,
				key: keys.k_XSDValidation,
				clause: "A177 clause 5.4.1",
				description: `the namespace for ${dvbi.e_ServiceList.elementize()} is required to ensure appropriate syntax and semantic checking`,
			});
			return;
		}

		const ns = SL.root.namespaceUri;

		if (!this.#doSchemaVerification(SL, errs, "SL005", options.report_schema_version)) {
			errs.addError({
				code: "SL010",
				message: `Unsupported namespace ${ns.quote()}`,
				key: keys.k_XSDValidation,
			});
			return;
		}
		const ServiceList = SL.root;
		let slRequiredAttributes = [dvbi.a_version];
		if (SL_SchemaVersion(ns) >= slVersions.r3) slRequiredAttributes.push(tva.a_lang);
		if (SL_SchemaVersion(ns) >= slVersions.r6) slRequiredAttributes.push(dvbi.a_id);
		checkAttributes(ServiceList, slRequiredAttributes, [dvbi.a_responseStatus, "schemaLocation"], dvbiEA.ServiceList, errs, "SL011");

		// check ServiceList@version
		// validated by schema

		// check ServiceList@lang
		if (ServiceList.attrAnyNs(tva.a_lang)) {
			ValidateLanguage(ServiceList.attrAnyNs(tva.a_lang).value, errs, "SL012", ServiceList.line);
		}

		// check ServiceList@responseStatus
		// validated by schema

		// check ServiceList@id
		if (ServiceList.attrAnyNs(dvbi.a_id)) {
			const thisServiceListId = ServiceList.attrAnyNs(dvbi.a_id).value;
			if (!validServiceListIdentifier(thisServiceListId))
				errs.addError({
					code: "SL016",
					message: `${thisServiceListId.quote()} is not a valid service list identifier`,
					key: keys.k_InvalidTag,
					clause: "A177 clause 5.2.2",
					description: "Service identifiers should use a registered URI scheme, such as the 'tag' URI scheme defined in IETF RFC 4151",
				});
		}

		//check <ServiceList><StandardVersion>
		let sv = 0,
			StandardVersion;
		while ((StandardVersion = ServiceList.getAnyNs(dvbi.e_StandardVersion, ++sv)) != null) {
			if (!isA177specification_URN(StandardVersion.content))
				errs.addError({
					code: "SL017",
					message: `"${StandardVersion.content}" is not a recognised URN for an A177 specification version`,
					key: keys.k_InvalidIdentifier,
					fragment: StandardVersion,
					clause: "A177 clause 4.6.1.1",
					description: "Specification URN that is used to indicate a compatable specification version for this service list",
				});
		}

		//check <ServiceList><Name>
		checkXMLLangs(dvbi.e_Name, dvbi.e_ServiceList, ServiceList, errs, "SL020");

		//check <ServiceList><ProviderName>
		checkXMLLangs(dvbi.e_ProviderName, dvbi.e_ServiceList, ServiceList, errs, "SL021");

		//check <ServiceList><LanguageList>
		let announcedAudioLanguages = [];
		const LanguageList = ServiceList.getAnyNs(dvbi.e_LanguageList);
		if (LanguageList) {
			let l = 0,
				Language;
			while ((Language = LanguageList.getAnyNs(tva.e_Language, ++l)) != null) {
				checkLanguage(Language.content, Language, errs, "SL030");
				checkAttributes(Language, [], [], tvaEA.AudioLanguage, errs, "SL031");
				const lang_lower = Language.content.toLowerCase();
				const found = announcedAudioLanguages.find((el) => (el.language == lang_lower));
				if (found != undefined)
					errs.addError({
						code: "SL032",
						message: `language ${Language.content} is already included in ${dvbi.e_LanguageList.elementize()}`,
						fragment: Language,
						key: "duplicate language",
					});
				else announcedAudioLanguages.push({ language: lang_lower, used: false, fragment: Language });
			}
		}

		//check <ServiceList><RelatedMaterial>
		let rm = 0,
			countControlApps = 0,
			RelatedMaterial;
		while ((RelatedMaterial = ServiceList.getAnyNs(tva.e_RelatedMaterial, ++rm)) != null) {
			const foundHref = this.#validateRelatedMaterial(RelatedMaterial, "service list", SERVICE_LIST_RM, errs, "SL040");
			if (foundHref != "" && validServiceControlApplication(foundHref, SL_SchemaVersion(ns))) countControlApps++;
		}

		if (countControlApps > 1)
			errs.addError({
				code: "SL042",
				message: "only a single service control application can be signalled in a service",
				key: "multi apps",
			});

		// check <ServiceList><RegionList> and remember regionID values
		let knownRegionIDs = [],
			RegionList = ServiceList.getAnyNs(dvbi.e_RegionList);
		if (RegionList) {
			// recurse the regionlist - Regions can be nested in Regions
			let r = 0,
				Region;
			while ((Region = RegionList.getAnyNs(dvbi.e_Region, ++r)) != null) this.#addRegion(Region, 0, knownRegionIDs, null, errs);
		}

		//check <ServiceList><TargetRegion>
		let tr = 0,
			TargetRegion,
			rBuf = [];
		while ((TargetRegion = ServiceList.getAnyNs(dvbi.e_TargetRegion, ++tr)) != null) {
			const found = knownRegionIDs.find((r) => r.region == TargetRegion.content);
			if (found == undefined) errs.addError(UnspecifiedTargetRegion(TargetRegion.content, "service list", "SL051", TargetRegion));
			else if (!found.selectable)
				errs.addError({
					code: "SL052",
					message: `${dvbi.e_TargetRegion.elementize()} ${TargetRegion.content.quote()} in ${dvbi.e_ServiceList.elementize()} is not selectable`,
					fragment: TargetRegion,
					key: "unselectable region",
				});
			else found.used = true;
			if (DuplicatedValue(rBuf, TargetRegion.content)) {
				errs.addError({
					type: WARNING,
					code: "SL053",
					key: "duplicate value",
					message: `duplicate value (${TargetRegion.value}) specified for ${dvbi.e_TargetRegion.elementize()}`,
					fragment: TargetRegion,
				});
			}
		}

		// check <ServiceList><SubscriptionPackageList>
		let declaredSubscriptionPackages = [];
		const SubscriptionPackageList = ServiceList.getAnyNs(dvbi.e_SubscriptionPackageList);
		if (SubscriptionPackageList) {
			let sp = 0,
				SubscriptionPackage;
			while ((SubscriptionPackage = SubscriptionPackageList.getAnyNs(dvbi.e_SubscriptionPackage, ++sp)) != null) {
				const pkg = localizedSubscriptionPackage(SubscriptionPackage);

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
		let ContentGuideSourceIDs = [];
		const CGSourceList = ServiceList.getAnyNs(dvbi.e_ContentGuideSourceList);
		if (CGSourceList) {
			let cgs = 0,
				CGSource;
			while ((CGSource = CGSourceList.getAnyNs(dvbi.e_ContentGuideSource, ++cgs)) != null) {
				this.#validateAContentGuideSource(CGSource, `${dvbi.e_ServiceList}.${dvbi.e_ContentGuideSourceList}.${dvbi.e_ContentGuideSource}[${cgs}]`, errs, "SL070");

				if (CGSource.attrAnyNs(dvbi.a_CGSID)) {
					if (isIn(ContentGuideSourceIDs, CGSource.attrAnyNs(dvbi.a_CGSID).value))
						errs.addError({
							code: "SL071",
							message: `duplicate ${dvbi.a_CGSID.attribute(dvbi.e_ContentGuideSource)} (${CGSource.attrAnyNs(dvbi.a_CGSID).value}) in service list`,
							key: `duplicate ${dvbi.a_CGSID.attribute()}`,
							fragment: CGSource,
						});
					else ContentGuideSourceIDs.push(CGSource.attrAnyNs(dvbi.a_CGSID).value);
				}
			}
		}

		// check  elements in <ServiceList><ContentGuideSource>
		const slGCS = ServiceList.getAnyNs(dvbi.e_ContentGuideSource);
		if (slGCS) this.#validateAContentGuideSource(slGCS, `${dvbi.e_ServiceList}.${dvbi.e_ContentGuideSource}`, errs, "SL080");

		errs.setW("num services", 0);

		// check <Service>
		let s = 0,
			service,
			knownServices = [];
		while ((service = ServiceList.getAnyNs(dvbi.e_Service, ++s)) != null) {
			// for each service
			errs.setW("num services", s);
			this.#validateService(
				service,
				`service-${s}`, // use a default value in case <UniqueIdentifier> is not specified
				knownServices,
				knownRegionIDs,
				declaredSubscriptionPackages,
				announcedAudioLanguages,
				ContentGuideSourceIDs,
				errs
			);
		}

		if (SL_SchemaVersion(ns) >= slVersions.r5) {
			errs.setW("num test services", 0);

			// check <TestService>
			let ts = 0,
				testService;
			while ((testService = ServiceList.getAnyNs(dvbi.e_TestService, ++ts)) != null) {
				// for each service
				errs.setW("num test services", ts);
				this.#validateService(
					testService,
					`testservice-${ts}`, // use a default value in case <UniqueIdentifier> is not specified,
					knownServices,
					knownRegionIDs,
					declaredSubscriptionPackages,
					announcedAudioLanguages,
					ContentGuideSourceIDs,
					errs
				);
			}
		}

		// check <Service><ContentGuideServiceRef>
		// issues a warning if this is a reference to self
		s = 0;
		while ((service = ServiceList.getAnyNs(dvbi.e_Service, ++s)) != null) {
			const CGSR = service.getAnyNs(dvbi.e_ContentGuideServiceRef);
			if (CGSR) {
				const uniqueID = service.getAnyNs(dvbi.e_UniqueIdentifier);
				if (uniqueID && CGSR.content == uniqueID.content)
					errs.addError({
						type: WARNING,
						code: "SL270",
						message: `${dvbi.e_ContentGuideServiceRef.elementize()} is self`,
						fragments: [uniqueID, CGSR],
						key: `self ${dvbi.e_ContentGuideServiceRef.elementize()}`,
					});
			}
		}

		if (SL_SchemaVersion(ns) >= slVersions.r5) {
			// check <TestService><ContentGuideServiceRef>
			// issues a warning if this is a reference to self
			let ts = 0,
				testService;
			while ((testService = ServiceList.getAnyNs(dvbi.e_TestService, ++ts)) != null) {
				const CGSR = testService.getAnyNs(dvbi.e_ContentGuideServiceRef);
				if (CGSR) {
					const uniqueID = testService.getAnyNs(dvbi.e_UniqueIdentifier);
					if (uniqueID && CGSR.content == uniqueID.content)
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
		const LCNtableList = ServiceList.getAnyNs(dvbi.e_LCNTableList);
		if (LCNtableList) {
			let l = 0,
				LCNTable,
				tableQualifiers = [];
			while ((LCNTable = LCNtableList.getAnyNs(dvbi.e_LCNTable, ++l)) != null) {
				// <LCNTable><TargetRegion>
				let tr = 0,
					TargetRegion,
					TargetRegions = [];
				while ((TargetRegion = LCNTable.getAnyNs(dvbi.e_TargetRegion, ++tr)) != null) {
					const targetRegionID = TargetRegion.content;
					const foundRegion = knownRegionIDs.find((r) => r.region == targetRegionID);
					if (foundRegion == undefined)
						errs.addError({
							code: "SL241",
							message: `${dvbi.e_TargetRegion.elementize()} ${TargetRegion.content.quote()} in ${dvbi.e_LCNTable.elementize()} is not defined`,
							fragment: TargetRegion,
							key: "undefined region",
						});
					else {
						if (foundRegion.selectable == false)
							errs.addError({
								code: "SL242",
								message: `${dvbi.e_TargetRegion.elementize()} ${TargetRegion.content.quote()} in ${dvbi.e_LCNTable.elementize()} is not selectable`,
								fragment: TargetRegion,
								key: "unselectable region",
								description: `the region ID specified in the ${dvbi.e_TargetRegion.elementize()} is defined with ${dvbi.a_selectable.attribute()}=false in the ${dvbi.e_RegionList.elementize()} `,
							});
						foundRegion.used = true;
					}

					if (DuplicatedValue(TargetRegions, targetRegionID))
						errs.addError({
							code: "SL243",
							message: `respecification of ${dvbi.e_TargetRegion.elementize()}=${TargetRegion.content}`,
							fragment: TargetRegion,
							key: "duplicate region",
						});
				}

				// <LCNTable><SubscriptionPackage>
				let sp = 0,
					SubscriptionPackage,
					SubscriptionPackages = [];
				while ((SubscriptionPackage = LCNTable.getAnyNs(dvbi.e_SubscriptionPackage, ++sp)) != null) {
					let packageLanguage = null;
					if (SL_SchemaVersion(ns) >= slVersions.r5) {
						errs.addError(DeprecatedElement(SubscriptionPackage, SchemaSpecVersion(slVersions.r5), "SL244"));
					}
					if (SubscriptionPackage.attrAnyNs(tva.a_lang)) {
						packageLanguage = SubscriptionPackage.attrAnyNs(tva.a_lang).value;
						checkLanguage(packageLanguage, SubscriptionPackage, errs, "SL245");
					} else if (SL_SchemaVersion(ns) >= slVersions.r3) {
						packageLanguage = GetNodeLanguage(SubscriptionPackage, false, errs, "SL246");
					}

					const localSubscriptionPackage = localizedSubscriptionPackage(SubscriptionPackage, packageLanguage);
					if (DuplicatedValue(SubscriptionPackages, localSubscriptionPackage))
						errs.addError({
							code: "SL247",
							message: `duplicated ${dvbi.e_SubscriptionPackage.elementize()}`,
							fragment: SubscriptionPackage,
							key: "duplicate package name",
						});

					if (SL_SchemaVersion(ns) >= slVersions.r3)
						if (!declaredSubscriptionPackages.includes(localSubscriptionPackage))
							errs.addError({
								code: "SL248",
								message: `${dvbi.e_SubscriptionPackage.elementize()}="${localSubscriptionPackage}" is not declared in ${dvbi.e_SubscriptionPackageList.elementize()}`,
								fragment: SubscriptionPackage,
								key: `undeclared ${dvbi.e_SubscriptionPackage}`,
							});
				}

				if (TargetRegions.length == 0) TargetRegions.push(LCN_TABLE_NO_TARGETREGION);
				if (SubscriptionPackages.length == 0) SubscriptionPackages.push(LCN_TABLE_NO_SUBSCRIPTION);

				TargetRegions.forEach((region) => {
					const displayRegion = region == LCN_TABLE_NO_TARGETREGION ? `unspecified ${dvbi.e_TargetRegion.elementize()}` : `${dvbi.e_TargetRegion.elementize()}="${region}"`;
					SubscriptionPackages.forEach((sPackage) => {
						const key = `${region}::${sPackage}`,
							displayPackage =
								sPackage == LCN_TABLE_NO_SUBSCRIPTION ? `unspecified ${dvbi.e_SubscriptionPackage.elementize()}` : `${dvbi.e_SubscriptionPackage.elementize()}="${sPackage}"`;
						if (DuplicatedValue(tableQualifiers, key))
							errs.addError({
								code: "SL251",
								message: `combination of ${displayRegion} and ${displayPackage} already used`,
								key: "reused region/package",
								line: LCNTable.line,
							});
					});
				});

				// <LCNTable><LCN>
				let LCNNumbers = [],
					e = 0,
					LCN;
				while ((LCN = LCNTable.getAnyNs(dvbi.e_LCN, ++e)) != null) {
					// LCN@channelNumber
					if (LCN.attrAnyNs(dvbi.a_channelNumber)) {
						const chanNum = LCN.attrAnyNs(dvbi.a_channelNumber).value;

						if (isIn(LCNNumbers, chanNum))
							errs.addError({
								code: "SL262",
								message: `duplicated channel number ${chanNum} for ${dvbi.e_LCNTable.elementize()}`,
								key: "duplicate channel number",
								fragment: LCN,
							});
						else LCNNumbers.push(chanNum);
						const chanNumV = parseInt(chanNum, 10);
						if (chanNumV < 1 || chanNumV > 9999) {
							errs.addError({
								code: "SL264",
								message: `Channel number must be in the range 1..9999, found ${chanNumV}`,
								key: "invalid value",
								fragment: LCN,
								clause: "A177 table 23",
								description: `${dvbi.a_channelNumber.attribute()} has the same semantics as logical_channel_number in ciplus_service_descriptor`,
							});
						}
					}

					// LCN@serviceRef
					if (LCN.attrAnyNs(dvbi.a_serviceRef) && !isIn(knownServices, LCN.attrAnyNs(dvbi.a_serviceRef).value)) {
						errs.addError({
							code: "SL263",
							message: `LCN reference to unknown service ${LCN.attrAnyNs(dvbi.a_serviceRef).value}`,
							key: "LCN unknown services",
							fragment: LCN,
							clause: "A177 table 23",
							description: `The value of ${dvbi.a_serviceRef.attribute(
								dvbi.e_LCN
							)} needs to refer to the ${dvbi.e_UniqueIdentifier.elementize()} of a ${dvbi.e_Service.elementize()}`,
						});
					}
				}

				// <LCNTable><LCNRange>
				let r = 0,
					LCNRange;
				const schemaVersion = SL_SchemaVersion(LCNTable.documentNamespace());
				while ((LCNRange = LCNTable.getAnyNs(dvbi.e_LCNRange, ++r)) != null) {
					//<LCNRange@start>, <LCNRange@end>, <LCNRange@priority> - checked by schema
					//<LCNRange@fillMethod>, <LCNRange@serviceOrigin> - checked by schema
					//<LCNRange@serviceType>
					const serviceType = LCNRange.attrAnyNsValueOr(dvbi.a_serviceType, null);
					if (serviceType) {
						if (!this.#allowedServiceTypes.isIn(serviceType)) 
							errs.addError({
								code: "SL265",
								message: `Invalid value for ${dvbi.a_serviceType.attribute(dvbi.e_LCNRange)} (${serviceType})`,
								fragment: LCNRange,
								key: keys.k_InvalidValue,
							});
					}

					//<LCNRange@serviceGenre>
					const serviceGenre = LCNRange.attrAnyNsValueOr(dvbi.a_serviceGenre, null);
					if (serviceGenre && !this.#allowedGenres.isIn(serviceGenre))
							errs.addError({
								code: "SL267",
								message: `Invalid value for ${dvbi.a_serviceGenre.attribute(dvbi.e_LCNRange)} (${serviceGenre})`,
								fragment: LCNRange,
								key: keys.k_InvalidValue,
							});
				}
			}
		}

		// report any regionIDs that are defined but not used
		if (SL_SchemaVersion(ns) >= slVersions.r4) {
			knownRegionIDs.forEach((region) => {
				if (!region.used && region.selectable)
					errs.addError({
						code: "SL281",
						type: WARNING,
						message: `${dvbi.a_regionID.attribute(dvbi.e_Region)}="${region.region}" is defined but not used`,
						key: `unused ${dvbi.a_regionID.attribute()}`,
						line: region.line,
					});
			});
		}

		// report any languages in the <LanguageList> that are not used
		announcedAudioLanguages.forEach((language) => {
			if (!language.used)
				errs.addError({
					code: "SL282",
					type: WARNING,
					message: `audio language "${language.language}" is defined in ${dvbi.e_LanguageList.elementize()} but not used`,
					key: `unused ${dvbi.e_Language}`,
					fragment: language.fragment,
					clause: "see A177 table 14",
					description: `only lanugages used in ${tva.e_AudioAttributes.elementize()}${tva.e_AudioLanguage.elementize()} should be announced in ${dvbi.e_LanguageList.elementize()}`,
				});
		});

		SL.dispose();
	}

	/**
	 * validate the service list and record any errors
	 *
	 * @param {String} SLtext  The service list text to be validated
	 * @returns {Class} Errors found in validaton
	 */
	/*public*/ validateServiceList(SLtext) {
		let errs = new ErrorList(SLtext);
		this.doValidateServiceList(SLtext, errs);

		return new Promise((resolve, /* eslint-disable no-unused-vars*/ reject /* eslint-enable */) => {
			resolve(errs);
		});
	}
}
