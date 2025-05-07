/**
 * sl_data_versions.js
 *
 * version related checks (lifted from sl-check.js)
 */

import { readFileSync } from "fs";
import process from "process";

import chalk from "chalk";
import { XmlDocument } from 'libxml2-wasm';

import { OLD, DRAFT, ETSI, CURRENT } from "./globals.js";
import { dvbi } from "./DVB-I_definitions.js";
import { DVBI_ServiceListSchema, __dirname_linux } from "./data_locations.js";

export const ANY_NAMESPACE = "$%$!!";

export const SCHEMA_r0 = 0,
	SCHEMA_r1 = 1,
	SCHEMA_r2 = 2,
	SCHEMA_r3 = 3,
	SCHEMA_r4 = 4,
	SCHEMA_r5 = 5,
	SCHEMA_r6 = 6,
	SCHEMA_r7 = 7,
	SCHEMA_unknown = -1;

let SchemaVersions = [
	// schema property is loaded from specified filename
	{
		namespace: dvbi.A177r7_Namespace,
		version: SCHEMA_r7,
		filename: DVBI_ServiceListSchema.r7.file,
		schema: null,
		status: DRAFT,
		specVersion: "A177r7",
	},
	{
		namespace: dvbi.A177r6_Namespace,
		version: SCHEMA_r6,
		filename: DVBI_ServiceListSchema.r6.file,
		schema: null,
		status: CURRENT,
		specVersion: "A177r6",
	},
	{
		namespace: dvbi.A177r5_Namespace,
		version: SCHEMA_r5,
		filename: DVBI_ServiceListSchema.r5.file,
		schema: null,
		status: OLD,
		specVersion: "A177r5",
	},
	{
		namespace: dvbi.A177r4_Namespace,
		version: SCHEMA_r4,
		filename: DVBI_ServiceListSchema.r4.file,
		schema: null,
		status: OLD,
		specVersion: "A177r4",
	},
	{
		namespace: dvbi.A177r3_Namespace,
		version: SCHEMA_r3,
		filename: DVBI_ServiceListSchema.r3.file,
		schema: null,
		status: OLD,
		specVersion: "A177r3",
	},
	{
		namespace: dvbi.A177r2_Namespace,
		version: SCHEMA_r2,
		filename: DVBI_ServiceListSchema.r2.file,
		schema: null,
		status: OLD,
		specVersion: "A177r2",
	},
	{
		namespace: dvbi.A177r1_Namespace,
		version: SCHEMA_r1,
		filename: DVBI_ServiceListSchema.r1.file,
		schema: null,
		status: ETSI,
		specVersion: "A177r1",
	},
	{
		namespace: dvbi.A177_Namespace,
		version: SCHEMA_r0,
		filename: DVBI_ServiceListSchema.r0.file,
		schema: null,
		status: OLD,
		specVersion: "A177",
	},
];

const OutOfScheduledHoursBanners = [
	{ ver: SCHEMA_r7, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v3 },
	{ ver: SCHEMA_r6, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v3 },
	{ ver: SCHEMA_r5, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v3 },
	{ ver: SCHEMA_r4, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v3 },
	{ ver: SCHEMA_r3, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v3 },
	{ ver: SCHEMA_r2, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v2 },
	{ ver: SCHEMA_r1, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v2 },
	{ ver: SCHEMA_r0, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v1 },
];
const ContentFinishedBanners = [
	{ ver: SCHEMA_r7, val: dvbi.BANNER_CONTENT_FINISHED_v3 },
	{ ver: SCHEMA_r6, val: dvbi.BANNER_CONTENT_FINISHED_v3 },
	{ ver: SCHEMA_r5, val: dvbi.BANNER_CONTENT_FINISHED_v3 },
	{ ver: SCHEMA_r4, val: dvbi.BANNER_CONTENT_FINISHED_v3 },
	{ ver: SCHEMA_r3, val: dvbi.BANNER_CONTENT_FINISHED_v3 },
	{ ver: SCHEMA_r2, val: dvbi.BANNER_CONTENT_FINISHED_v2 },
	{ ver: SCHEMA_r1, val: dvbi.BANNER_CONTENT_FINISHED_v2 },
];
const ServiceListLogos = [
	{ ver: SCHEMA_r7, val: dvbi.LOGO_SERVICE_LIST_v3 },
	{ ver: SCHEMA_r6, val: dvbi.LOGO_SERVICE_LIST_v3 },
	{ ver: SCHEMA_r5, val: dvbi.LOGO_SERVICE_LIST_v3 },
	{ ver: SCHEMA_r4, val: dvbi.LOGO_SERVICE_LIST_v3 },
	{ ver: SCHEMA_r3, val: dvbi.LOGO_SERVICE_LIST_v3 },
	{ ver: SCHEMA_r2, val: dvbi.LOGO_SERVICE_LIST_v2 },
	{ ver: SCHEMA_r1, val: dvbi.LOGO_SERVICE_LIST_v2 },
	{ ver: SCHEMA_r0, val: dvbi.LOGO_SERVICE_LIST_v1 },
];
const ServiceLogos = [
	{ ver: SCHEMA_r7, val: dvbi.LOGO_SERVICE_v3 },
	{ ver: SCHEMA_r6, val: dvbi.LOGO_SERVICE_v3 },
	{ ver: SCHEMA_r5, val: dvbi.LOGO_SERVICE_v3 },
	{ ver: SCHEMA_r4, val: dvbi.LOGO_SERVICE_v3 },
	{ ver: SCHEMA_r3, val: dvbi.LOGO_SERVICE_v3 },
	{ ver: SCHEMA_r2, val: dvbi.LOGO_SERVICE_v2 },
	{ ver: SCHEMA_r1, val: dvbi.LOGO_SERVICE_v2 },
	{ ver: SCHEMA_r0, val: dvbi.LOGO_SERVICE_v1 },
];
const ServiceBanners = [
	{ ver: SCHEMA_r7, val: dvbi.SERVICE_BANNER_v4 },
	{ ver: SCHEMA_r6, val: dvbi.SERVICE_BANNER_v4 },
	{ ver: SCHEMA_r5, val: dvbi.SERVICE_BANNER_v4 },
	{ ver: SCHEMA_r4, val: dvbi.SERVICE_BANNER_v4 },
	{ ver: SCHEMA_r3, val: dvbi.SERVICE_BANNER_v4 },
	{ ver: SCHEMA_r2, val: dvbi.SERVICE_BANNER_v4 },
];
const ContentGuideSourceLogos = [
	{ ver: SCHEMA_r7, val: dvbi.LOGO_CG_PROVIDER_v3 },
	{ ver: SCHEMA_r6, val: dvbi.LOGO_CG_PROVIDER_v3 },
	{ ver: SCHEMA_r5, val: dvbi.LOGO_CG_PROVIDER_v3 },
	{ ver: SCHEMA_r4, val: dvbi.LOGO_CG_PROVIDER_v3 },
	{ ver: SCHEMA_r3, val: dvbi.LOGO_CG_PROVIDER_v3 },
	{ ver: SCHEMA_r2, val: dvbi.LOGO_CG_PROVIDER_v2 },
	{ ver: SCHEMA_r1, val: dvbi.LOGO_CG_PROVIDER_v2 },
	{ ver: SCHEMA_r0, val: dvbi.LOGO_CG_PROVIDER_v1 },
];

/**
 * determine the schema version (and hence the specificaion version) in use
 *
 * @param {String} namespace     The namespace used in defining the schema
 * @returns {integer} Representation of the schema version or error code if unknown
 */
export let SchemaVersion = (namespace) => {
	const x = SchemaVersions.find((ver) => ver.namespace == namespace);
	return x ? x.version : SCHEMA_unknown;
};

export let SchemaSpecVersion = (namespace) => {
	const x = SchemaVersions.find((ver) => ver.namespace == namespace);
	return x ? x.specVersion : "r?";
};

export let GetSchema = (namespace) => SchemaVersions.find((s) => s.namespace == namespace);

/**
 * determines if the identifer provided refers to a valid application being used with the service
 *
 * @param {String}  hrefType       The type of the service application
 * @param {integer} schemaVersion  The schema version of the XML document
 * @returns {boolean} true if this is a valid application being used with the service else false
 */
export let validServiceControlApplication = (hrefType, schemaVersion) => {
	let appTypes = [dvbi.APP_IN_PARALLEL, dvbi.APP_IN_CONTROL];
	if (schemaVersion >= SCHEMA_r6) appTypes.push(dvbi.APP_SERVICE_PROVIDER);
	if (schemaVersion >= SCHEMA_r7) appTypes.push(dvbi.APP_IN_SERIES);
	return appTypes.includes(hrefType);
};

/**
 * determines if the identifer provided refers to a validconsent application type
 *
 * @param {String}  hrefType       The type of the service application
 * @param {integer} schemaVersion  The schema version of the XML document
 * @returns {boolean} true if this is a valid application being used with the service else false
 */
export let validAgreementApplication = (hrefType, schemaVersion) => {
	let appTypes = [dvbi.APP_LIST_INSTALLATION, dvbi.APP_WITHDRAW_AGREEMENT, dvbi.APP_RENEW_AGREEMENT];
	return schemaVersion >= SCHEMA_r7 && appTypes.includes(hrefType);
};

/**
 * determines if the identifer provided refers to a valid application being used with the service instance
 *
 * @param {String} hrefType  The type of the service application
 * @param {integer} schemaVersion  The schema version of the XML document
 * @returns {boolean} true if this is a valid application being used with the service else false
 */
export let validServiceInstanceControlApplication = (hrefType, schemaVersion) => {
	let appTypes = [dvbi.APP_IN_PARALLEL, dvbi.APP_IN_CONTROL];
	if (schemaVersion >= SCHEMA_r7) appTypes.push(dvbi.APP_IN_SERIES);
	return appTypes.includes(hrefType);
};

/**
 * determines if the identifer provided refers to a valid application to be launched when a service is unavailable
 *
 * @param {String} hrefType  The type of the service application
 * @returns {boolean} true if this is a valid application to be launched when a service is unavailable else false
 */
export let validServiceUnavailableApplication = (hrefType) => hrefType == dvbi.APP_OUTSIDE_AVAILABILITY;

/**
 * determines if the identifer provided refers to a valid DASH media type (single MPD or MPD playlist)
 * per A177 clause 5.2.7.2
 *
 * @param {String} contentType  The contentType for the file
 * @returns {boolean} true if this is a valid MPD or playlist identifier
 */
export let validDASHcontentType = (contentType) => [dvbi.CONTENT_TYPE_DASH_MPD, dvbi.CONTENT_TYPE_DVB_PLAYLIST].includes(contentType);

/**
 * looks for the {index, value} pair within the array of permitted values
 *
 * @param {array} permittedValues  array of allowed value pairs {ver: , val:}
 * @param {any}   value            value to match with val: in the allowed values
 * @param {any}   version          value to match with ver: in the allowed values or ANY_NAMESPACE
 * @returns {boolean} true if {index, value} pair exists in the list of allowed values when namespace is specific or if any val: equals value with namespace is ANY_NAMESPACE, else false
 */
function match(permittedValues, value, version = ANY_NAMESPACE) {
	if (permittedValues && value) {
		if (version == ANY_NAMESPACE) return permittedValues.find((elem) => elem.val == value) != undefined;
		else {
			let _ver = SchemaVersion(version);
			let i = permittedValues.find((elem) => elem.ver == _ver);
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
export function validOutScheduleHours(HowRelated, namespace) {
	// return true if val is a valid CS value for Out of Service Banners (A177 5.2.5.3)
	return match(OutOfScheduledHoursBanners, HowRelated.attr(dvbi.a_href) ? HowRelated.attr(dvbi.a_href).value : null, namespace);
}

/**
 * determines if the identifer provided refers to a valid banner for content-finished presentation
 *
 * @since DVB A177r1
 * @param {XMLnode} HowRelated  The banner identifier
 * @param {String}  namespace   The namespace being used in the XML document
 * @returns {boolean} true if this is a valid banner for content-finished presentation else false
 */
export function validContentFinishedBanner(HowRelated, namespace) {
	// return true if val is a valid CS value for Content Finished Banner (A177 5.2.7.3)
	return match(ContentFinishedBanners, HowRelated.attr(dvbi.a_href) ? HowRelated.attr(dvbi.a_href).value : null, namespace);
}

/**
 * determines if the identifer provided refers to a valid service list logo
 *
 * @param {XMLnode} HowRelated  The logo identifier
 * @param {String}  namespace   The namespace being used in the XML document
 * @returns {boolean} true if this is a valid logo for a service list else false
 */
export function validServiceListLogo(HowRelated, namespace) {
	// return true if HowRelated@href is a valid CS value Service List Logo (A177 5.2.6.1)
	return match(ServiceListLogos, HowRelated.attr(dvbi.a_href) ? HowRelated.attr(dvbi.a_href).value : null, namespace);
}

export function validServiceAgreementApp(HowRelated, namespace) {
	return HowRelated.attr(dvbi.a_href) ? validAgreementApplication(HowRelated.attr(dvbi.a_href).value, SchemaVersion(namespace)) : false;
}

/**
 * determines if the identifer provided refers to a valid service logo
 *
 * @param {XMLnode} HowRelated  The logo identifier
 * @param {String}  namespace   The namespace being used in the XML document
 * @returns {boolean} true if this is a valid logo for a service  else false
 */
export function validServiceLogo(HowRelated, namespace) {
	// return true if val is a valid CS value Service Logo (A177 5.2.6.2)
	return match(ServiceLogos, HowRelated.attr(dvbi.a_href) ? HowRelated.attr(dvbi.a_href).value : null, namespace);
}

/**
 * determines if the identifer provided refers to a valid service banner
 *
 * @param {XMLnode} HowRelated  The logo identifier
 * @param {String}  namespace   The namespace being used in the XML document
 * @returns {boolean} true if this is a valid banner for a service  else false
 */
export function validServiceBanner(HowRelated, namespace) {
	// return true if val is a valid CS value Service Banner (A177 5.2.6.x)
	return match(ServiceBanners, HowRelated.attr(dvbi.a_href) ? HowRelated.attr(dvbi.a_href).value : null, namespace);
}

/**
 * determines if the identifer provided refers to a valid content guide source logo
 *
 * @param {XMLnode} HowRelated  The logo identifier
 * @param {String}  namespace   The namespace being used in the XML document
 * @returns {boolean} true if this is a valid logo for a content guide source else false
 */
export function validContentGuideSourceLogo(HowRelated, namespace) {
	// return true if val is a valid CS value Service Logo (A177 5.2.6.3)
	return match(ContentGuideSourceLogos, HowRelated.attr(dvbi.a_href) ? HowRelated.attr(dvbi.a_href).value : nul, namespace);
}

// TODO - change this to support sync/async and file/url reading
console.log(chalk.yellow.underline("loading service list schemas..."));
SchemaVersions.forEach((version) => {
	process.stdout.write(chalk.yellow(`..loading ${version.version} ${version.namespace} from ${version.filename} `));
	let schema = readFileSync(version.filename).toString().replace(`schemaLocation="./`, `schemaLocation="${__dirname_linux}/`);
	version.schema = XmlDocument.fromString(schema);
	console.log(version.schema ? chalk.green("OK") : chalk.red.bold("FAIL"));
});
