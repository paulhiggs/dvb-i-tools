/**
 * sl_check_helpers.mjs
 *
*  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
* static self contained helper fuctions for service list validation 
 */

import { isIn } from "./utils.mjs";
import { elementize, quote } from "./utils.mjs";
import { mlLanguage } from "./multilingual_element.mjs";
import { isTAGURI, isDomainName } from "./pattern_checks.mjs";
import { dvbi, validApplicationTypes } from "./DVB-I_definitions.mjs";
import { tva } from "./TVA_definitions.mjs";

export default class SL_helpers {

	/**
	 * determines if the identifer provided complies with the requirements for a service identifier
	 * at this stage only IETF RFC 4151 TAG URIs are permitted
	 *
	 * @param {String} identifier    The service identifier
	 * @returns {boolean} true if the service identifier complies with the specification otherwise false
	 */
	static validServiceIdentifier = (identifier) => isTAGURI(identifier);
	static validServiceListIdentifier = (identifier) => isTAGURI(identifier);

	/**
	 * determines if the identifer provided is unique against a list of known identifiers
	 *
	 * @param {String} identifier   The service identifier
	 * @param {Array}  identifiers  The list of known service identifiers
	 * @returns {boolean} true if the service identifier is unique otherwise false
	 */
	static uniqueServiceIdentifier = (identifier, identifiers) => !isIn(identifiers, identifier);

	/**
	 * Create a label for the optional language and value provided
	 * @param {XmlElement} pkg
	 * @param {String}     lang
	 * @returns {String}
	 */
	static localizedSubscriptionPackage = (pkg, lang = null) => `${pkg.content}/lang=${lang ? lang : mlLanguage(pkg)}`;

	/**
	 * Construct	 an error message an unspecifed target region is used
	 *
	 * @param {String} region      The unspecified target region
	 * @param {String} loc         The location of the element
	 * @param {String} errCode     The error code to be reported
	 * @param {XmlElement} element The element using an undefined region if
	 */
	static UnspecifiedTargetRegion = (region, loc, errCode, element) => ({
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
	static NoDeliveryParams = (source, serviceId, element, errCode) => ({
		code: errCode,
		message: `${source} delivery parameters not specified for service instance in service ${serviceId.quote()}`,
		fragment: element,
		key: "no delivery params",
	});

	static isValidApplicationType = (type) => validApplicationTypes.includes(type);

	static RMErrorDescription = (code, elem, table) => ({
		code: code,
		description: `The application type indicated by the specified ${dvbi.a_href.attribute()} value is not permitted in a ${elem.elementize()}. Refer to the semantic defintiion of ${dvbi.e_RelatedMaterial.elementize()} in table ${table} of A177.`,
	});

	static synopsisLengthError = (ElementName,label, length) => `length of ${elementize(`${tva.a_length.attribute(ElementName)}=${label.quote()}`)} exceeds ${length} characters`;
	static synopsisToShortError = (ElementName, label, length) => `length of ${elementize(`${tva.a_length.attribute(ElementName)}=${label.quote()}`)} is less than ${length} characters`;
	static singleLengthLangError = (ElementName, length, lang) => `only a single ${ElementName.elementize()} is permitted per length (${length}) and language (${lang})`;
	static requiredSynopsisError = (ElementName, length) => `a ${ElementName.elementize()} element with ${tva.a_length.attribute()}=${quote(length)} is required`;

	// HDR DMI terms are in the 2.3 series
	static isHDRDMISystem = (CSterm) => CSterm.substring(CSterm.lastIndexOf(":") + 1).startsWith("2.3.");

	static ZuluIfNeeded = (dt) => (dt.endsWith("Z") || dt.lastIndexOf("+") > 12 || dt.lastIndexOf("-") > 12) ? dt : `${dt}Z`; 

	static unzone = (time) => time.includes("Z") ? time.substring(0, time.indexOf("Z")) : time;

	static checkElement = (element, elementName, allowed, modulation, key, errs, errCode) => {
		if (element && !isIn(allowed, element.content))
			errs.addError({
				code: errCode,
				key: key,
				message: `${elementName}=${element.content.quote()} is not permitted for ${modulation} modulation system`,
				fragment: element,
			});
	};
	static DisallowedElement = (element, childElementName, modulation, key, errs, suffix = "-0") => {
		if (element.hasChild(childElementName))
			errs.addError({
				code: `SI204${suffix}`,
				key: key,
				message: `${childElementName.elementize()} is not permitted for ${dvbi.e_ModulationSystem}=${modulation.quote()}`,
				fragment: element.getAnyNs(childElementName),
			});
	};

	/**
	 * Check is any media specific delivery parameters are specified on the service instance
	 * 
	 * @param {XmlElement} instance  the service instance to check
	 * @returns {Boolean} true if at least one media delivery system is specified on the instance
	 */
	static deliveryParameters = (instance) =>
		instance.getAnyNs(dvbi.e_DVBTDeliveryParameters) ||
		instance.getAnyNs(dvbi.e_DVBSDeliveryParameters) ||
		instance.getAnyNs(dvbi.e_DVBCDeliveryParameters) ||
		instance.getAnyNs(dvbi.e_DASHDeliveryParameters) ||
		instance.getAnyNs(dvbi.e_SATIPDeliveryParameters) ||
		instance.getAnyNs(dvbi.e_MulticastTSDeliveryParameters) ||
		instance.getAnyNs(dvbi.e_RTSPDeliveryParameters);

	/**
	 * Verify the MulticastTSDeliveryParameters
	 * 
	 * @param {XmlElement} params  the MulticastTSDeliveryParameters element
	 * @param {*} errs             errors found in validaton
	 * @param {*} errCode          error code prefix to be used in reports
	 */
	static checkMulticastDeliveryParams = (params, errs, errCode) => {
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

	static {
		// initialise static variables here
	}
} 