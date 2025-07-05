/**
 * sl_data_versions.mts
 *
 * version related checks
 * 
 */

import chalk from "chalk";
import { readFileSync } from "fs";
import { XmlDocument, XmlElement } from "libxml2-wasm";
import process from "process";

import { DVBI_ServiceListSchema } from "./data_locations.mts";
import { dvbi } from "./DVB-I_definitions.mts";
import { SpecificationState } from "./globals.mts";


export const ANY_NAMESPACE : string = "!!$%$!!";

export enum SchemaReleases {
	SCHEMA_unknown = -1,
	SCHEMA_r0 = 0,
	SCHEMA_r1 = 1,
	SCHEMA_r2 = 2,
	SCHEMA_r3 = 3,
	SCHEMA_r4 = 4,
	SCHEMA_r5 = 5,
	SCHEMA_r6 = 6,
	SCHEMA_r7 = 7,
}

export type SchemaReleaseVersion = {
	namespace : string,
	version : SchemaReleases,
	filename : string,
	schema : XmlDocument | null,
	status : SpecificationState,
	specVersion : string,
	URN? : string,
}

let SchemaVersions : Array<SchemaReleaseVersion> = [
	// schema property is loaded from specified filename
	{
		namespace: dvbi.A177r7_Namespace,
		version: SchemaReleases.SCHEMA_r7,
		filename: DVBI_ServiceListSchema.r7.file,
		schema: null,
		status: SpecificationState.DRAFT,
		specVersion: "A177r7",
		URN: "urn:dvb:metadata:dvbi:standardversion:7",
	},
	{
		namespace: dvbi.A177r6_Namespace,
		version: SchemaReleases.SCHEMA_r6,
		filename: DVBI_ServiceListSchema.r6.file,
		schema: null,
		status: SpecificationState.CURRENT,
		specVersion: "A177r6",
		URN: "urn:dvb:metadata:dvbi:standardversion:6",
	},
	{
		namespace: dvbi.A177r5_Namespace,
		version: SchemaReleases.SCHEMA_r5,
		filename: DVBI_ServiceListSchema.r5.file,
		schema: null,
		status: SpecificationState.OLD,
		specVersion: "A177r5",
	},
	{
		namespace: dvbi.A177r4_Namespace,
		version: SchemaReleases.SCHEMA_r4,
		filename: DVBI_ServiceListSchema.r4.file,
		schema: null,
		status: SpecificationState.OLD,
		specVersion: "A177r4",
	},
	{
		namespace: dvbi.A177r3_Namespace,
		version: SchemaReleases.SCHEMA_r3,
		filename: DVBI_ServiceListSchema.r3.file,
		schema: null,
		status: SpecificationState.OLD,
		specVersion: "A177r3",
	},
	{
		namespace: dvbi.A177r2_Namespace,
		version: SchemaReleases.SCHEMA_r2,
		filename: DVBI_ServiceListSchema.r2.file,
		schema: null,
		status: SpecificationState.OLD,
		specVersion: "A177r2",
	},
	{
		namespace: dvbi.A177r1_Namespace,
		version: SchemaReleases.SCHEMA_r1,
		filename: DVBI_ServiceListSchema.r1.file,
		schema: null,
		status: SpecificationState.ETSI,
		specVersion: "A177r1",
	},
	{
		namespace: dvbi.A177_Namespace,
		version: SchemaReleases.SCHEMA_r0,
		filename: DVBI_ServiceListSchema.r0.file,
		schema: null,
		status: SpecificationState.OLD,
		specVersion: "A177",
	},
];

type CSversion = {
	ver : SchemaReleases,
	val : string,
}

const OutOfScheduledHoursBanners : Array<CSversion> = [
	{ ver: SchemaReleases.SCHEMA_r7, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v3 },
	{ ver: SchemaReleases.SCHEMA_r6, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v3 },
	{ ver: SchemaReleases.SCHEMA_r5, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v3 },
	{ ver: SchemaReleases.SCHEMA_r4, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v3 },
	{ ver: SchemaReleases.SCHEMA_r3, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v3 },
	{ ver: SchemaReleases.SCHEMA_r2, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v2 },
	{ ver: SchemaReleases.SCHEMA_r1, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v2 },
	{ ver: SchemaReleases.SCHEMA_r0, val: dvbi.BANNER_OUTSIDE_AVAILABILITY_v1 },
];
const ContentFinishedBanners : Array<CSversion> = [
	{ ver: SchemaReleases.SCHEMA_r7, val: dvbi.BANNER_CONTENT_FINISHED_v3 },
	{ ver: SchemaReleases.SCHEMA_r6, val: dvbi.BANNER_CONTENT_FINISHED_v3 },
	{ ver: SchemaReleases.SCHEMA_r5, val: dvbi.BANNER_CONTENT_FINISHED_v3 },
	{ ver: SchemaReleases.SCHEMA_r4, val: dvbi.BANNER_CONTENT_FINISHED_v3 },
	{ ver: SchemaReleases.SCHEMA_r3, val: dvbi.BANNER_CONTENT_FINISHED_v3 },
	{ ver: SchemaReleases.SCHEMA_r2, val: dvbi.BANNER_CONTENT_FINISHED_v2 },
	{ ver: SchemaReleases.SCHEMA_r1, val: dvbi.BANNER_CONTENT_FINISHED_v2 },
];
const ServiceListLogos : Array<CSversion> = [
	{ ver: SchemaReleases.SCHEMA_r7, val: dvbi.LOGO_SERVICE_LIST_v3 },
	{ ver: SchemaReleases.SCHEMA_r6, val: dvbi.LOGO_SERVICE_LIST_v3 },
	{ ver: SchemaReleases.SCHEMA_r5, val: dvbi.LOGO_SERVICE_LIST_v3 },
	{ ver: SchemaReleases.SCHEMA_r4, val: dvbi.LOGO_SERVICE_LIST_v3 },
	{ ver: SchemaReleases.SCHEMA_r3, val: dvbi.LOGO_SERVICE_LIST_v3 },
	{ ver: SchemaReleases.SCHEMA_r2, val: dvbi.LOGO_SERVICE_LIST_v2 },
	{ ver: SchemaReleases.SCHEMA_r1, val: dvbi.LOGO_SERVICE_LIST_v2 },
	{ ver: SchemaReleases.SCHEMA_r0, val: dvbi.LOGO_SERVICE_LIST_v1 },
];
const ServiceLogos : Array<CSversion> = [
	{ ver: SchemaReleases.SCHEMA_r7, val: dvbi.LOGO_SERVICE_v3 },
	{ ver: SchemaReleases.SCHEMA_r6, val: dvbi.LOGO_SERVICE_v3 },
	{ ver: SchemaReleases.SCHEMA_r5, val: dvbi.LOGO_SERVICE_v3 },
	{ ver: SchemaReleases.SCHEMA_r4, val: dvbi.LOGO_SERVICE_v3 },
	{ ver: SchemaReleases.SCHEMA_r3, val: dvbi.LOGO_SERVICE_v3 },
	{ ver: SchemaReleases.SCHEMA_r2, val: dvbi.LOGO_SERVICE_v2 },
	{ ver: SchemaReleases.SCHEMA_r1, val: dvbi.LOGO_SERVICE_v2 },
	{ ver: SchemaReleases.SCHEMA_r0, val: dvbi.LOGO_SERVICE_v1 },
];
const ServiceBanners : Array<CSversion> = [
	{ ver: SchemaReleases.SCHEMA_r7, val: dvbi.SERVICE_BANNER_v4 },
	{ ver: SchemaReleases.SCHEMA_r6, val: dvbi.SERVICE_BANNER_v4 },
	{ ver: SchemaReleases.SCHEMA_r5, val: dvbi.SERVICE_BANNER_v4 },
	{ ver: SchemaReleases.SCHEMA_r4, val: dvbi.SERVICE_BANNER_v4 },
	{ ver: SchemaReleases.SCHEMA_r3, val: dvbi.SERVICE_BANNER_v4 },
	{ ver: SchemaReleases.SCHEMA_r2, val: dvbi.SERVICE_BANNER_v4 },
];
const ContentGuideSourceLogos : Array<CSversion> = [
	{ ver: SchemaReleases.SCHEMA_r7, val: dvbi.LOGO_CG_PROVIDER_v3 },
	{ ver: SchemaReleases.SCHEMA_r6, val: dvbi.LOGO_CG_PROVIDER_v3 },
	{ ver: SchemaReleases.SCHEMA_r5, val: dvbi.LOGO_CG_PROVIDER_v3 },
	{ ver: SchemaReleases.SCHEMA_r4, val: dvbi.LOGO_CG_PROVIDER_v3 },
	{ ver: SchemaReleases.SCHEMA_r3, val: dvbi.LOGO_CG_PROVIDER_v3 },
	{ ver: SchemaReleases.SCHEMA_r2, val: dvbi.LOGO_CG_PROVIDER_v2 },
	{ ver: SchemaReleases.SCHEMA_r1, val: dvbi.LOGO_CG_PROVIDER_v2 },
	{ ver: SchemaReleases.SCHEMA_r0, val: dvbi.LOGO_CG_PROVIDER_v1 },
];

/**
 * determine the schema version (and hence the specificaion version) in use
 *
 * @param {string} namespace     The namespace used in defining the schema
 * @returns {SchemaReleases} Representation of the schema version or error code if unknown
 */
export let SchemaVersion = (namespace : string) : SchemaReleases => {
	const x = SchemaVersions.find((ver) => ver.namespace == namespace);
	return x ? x.version : SchemaReleases.SCHEMA_unknown;
};

/**
 * determine the DVB Bluebook version for the specified schema namespace
 *
 * @param {string} namespace     The namespace used in defining the schema
 * @returns {string} Version of the DVB A177 specification where namespace is defined
 */
export let SchemaSpecVersion = (namespace : string) : string => {
	const x = SchemaVersions.find((ver) => ver.namespace == namespace);
	return x ? x.specVersion : "r?";
};

/**
 * determine the DVB Bluebook version for the specified schema namespace
 *
 * @param {string} namespace     The schema namespace
 * @returns {XMLDocument} the schema corresponding to the namespace
 */
export let GetSchema = (namespace : string) : SchemaReleaseVersion | null => {
	const x = SchemaVersions.find((s) => s.namespace == namespace);
	return x ? x : null; 
}

/**
 * determines if the identifer provided refers to a valid application being used with the service
 *
 * @param {string} hrefType               The type of the service application
 * @param {SchemaReleases} schemaVersion  The schema version of the XML document
 * @returns {boolean} true if this is a valid application being used with the service else false
 */
export let validServiceControlApplication = (hrefType : string, schemaVersion : SchemaReleases) : boolean => {
	let appTypes = [dvbi.APP_IN_PARALLEL, dvbi.APP_IN_CONTROL];
	if (schemaVersion >= SchemaReleases.SCHEMA_r6) appTypes.push(dvbi.APP_SERVICE_PROVIDER);
	if (schemaVersion >= SchemaReleases.SCHEMA_r7) appTypes.push(dvbi.APP_IN_SERIES);
	return appTypes.includes(hrefType);
};

/**
 * determines if the identifer provided refers to a validconsent application type
 *
 * @since DVB A177r7
 * @param {string} hrefType               The type of the service application
 * @param {SchemaReleases} schemaVersion  The schema version of the XML document
 * @returns {boolean} true if this is a valid application being used with the service else false
 */
const appTypes = [dvbi.APP_LIST_INSTALLATION, dvbi.APP_WITHDRAW_AGREEMENT, dvbi.APP_RENEW_AGREEMENT];
export let validAgreementApplication = (hrefType : string, schemaVersion : SchemaReleases) : boolean => 
		schemaVersion >= SchemaReleases.SCHEMA_r7 && appTypes.includes(hrefType);

/**
 * determines if the identifer provided refers to a valid application being used with the service instance
 *
 * @since DVB A177r7
 * @param {string} hrefType               The type of the service application
 * @param {SchemaReleases} schemaVersion  The schema version of the XML document
 * @returns {boolean} true if this is a valid application being used with the service else false
 */
export let validServiceInstanceControlApplication = (hrefType : string, schemaVersion : SchemaReleases) : boolean => {
	let appTypes = [dvbi.APP_IN_PARALLEL, dvbi.APP_IN_CONTROL];
	if (schemaVersion >= SchemaReleases.SCHEMA_r7) appTypes.push(dvbi.APP_IN_SERIES);
	return appTypes.includes(hrefType);
};

/**
 * determines if the identifer provided refers to a valid application to be launched when a service is unavailable
 *
 * @param {string} hrefType  The type of the service application
 * @returns {boolean} true if this is a valid application to be launched when a service is unavailable else false
 */
export let validServiceUnavailableApplication = (hrefType : string) : boolean => hrefType == dvbi.APP_OUTSIDE_AVAILABILITY;

/**
 * determines if the identifer provided refers to a valid DASH media type (single MPD or MPD playlist)
 * per A177 clause 5.2.7.2
 *
 * @param {string} contentType  The contentType for the file
 * @returns {boolean} true if this is a valid MPD or playlist identifier
 */
export let validDASHcontentType = (contentType : string) : boolean => [dvbi.CONTENT_TYPE_DASH_MPD, dvbi.CONTENT_TYPE_DVB_PLAYLIST].includes(contentType);

/**
 * looks for the {version, value} pair within the array of permitted values
 *
 * @param {Array<CSversion>} permittedValues  array of allowed value pairs {ver: , val:}
 * @param {string} value                      value to match with val: in the allowed values
 * @param {string} version                    value to match with ver: in the allowed values or ANY_NAMESPACE
 * @returns {boolean} true if {version, value} pair exists in the list of allowed values when namespace is specific or if any val: equals value with namespace is ANY_NAMESPACE, else false
 */
function match(permittedValues : Array<CSversion>, value : string, version : string = ANY_NAMESPACE) : boolean {
	if (permittedValues && value) {
		if (version == ANY_NAMESPACE) 
			return permittedValues.find((elem) => elem.val == value) != undefined;
		else {
			const _ver = SchemaVersion(version);
			const i = permittedValues.find((elem) => elem.ver == _ver);
			return i ? i.val == value : false;
		}
	}
	return false;
}

/**
 * determines if the identifer provided refers to a valid banner for out-of-servce-hours presentation
 *
 * @param {XmlElement} HowRelated  The banner identifier
 * @param {string} namespace       The namespace being used in the XML document
 * @returns {boolean} true if this is a valid banner for out-of-servce-hours presentation (A177 5.2.5.3) else false
 */
export let validOutScheduleHours = (HowRelated : XmlElement, namespace : string) : boolean => 
	match(OutOfScheduledHoursBanners, HowRelated.attrAnyNsValueOr(dvbi.a_href, null), namespace);

/**
 * determines if the identifer provided refers to a valid banner for content-finished presentation
 *
 * @since DVB A177r1
 * @param {XmlElement} HowRelated  The banner identifier
 * @param {string} namespace       The namespace being used in the XML document
 * @returns {boolean} true if this is a valid banner for content-finished presentation (A177 5.2.7.3) else false
 */
export let validContentFinishedBanner = (HowRelated : XmlElement, namespace : string) : boolean => 
	match(ContentFinishedBanners, HowRelated.attrAnyNsValueOr(dvbi.a_href, null), namespace);

/**
 * determines if the identifer provided refers to a valid service list logo
 *
 * @param {XmlElement} HowRelated  The logo identifier
 * @param {string} namespace       The namespace being used in the XML document
 * @returns {boolean} true if this is a valid logo for a service list (A177 5.2.6.1) else false
 */
export let validServiceListLogo = (HowRelated : XmlElement, namespace : string) : boolean => 
	match(ServiceListLogos, HowRelated.attrAnyNsValueOr(dvbi.a_href, null), namespace);

/**
 * determines if the identifer provided refers to a valid service logo
 *
 * @param {XmlElement} HowRelated  The logo identifier
 * @param {string} namespace       The namespace being used in the XML document
 * @returns {boolean} true if this is a valid logo for a service (A177 5.2.6.2) else false
 */
export let validServiceLogo = (HowRelated : XmlElement, namespace : string) : boolean => 
	match(ServiceLogos, HowRelated.attrAnyNsValueOr(dvbi.a_href, null), namespace);

/**
 * determines if the identifer provided refers to a valid service banner
 *
 * @param {XmlElement} HowRelated  The logo identifier
 * @param {string} namespace       The namespace being used in the XML document
 * @returns {boolean} true if this is a valid banner for a service (A177 5.2.6.4) else false
 */
export let validServiceBanner = (HowRelated : XmlElement, namespace : string) : boolean => 
	match(ServiceBanners, HowRelated.attrAnyNsValueOr(dvbi.a_href, null), namespace);

/**
 * determines if the identifer provided refers to a valid content guide source logo
 *
 * @param {XmlElement} HowRelated  The logo identifier
 * @param {string} namespace       The namespace being used in the XML document
 * @returns {boolean} true if this is a valid  logo for a content guide source (A177 5.2.6.3) else false
 */
export let validContentGuideSourceLogo = (HowRelated : XmlElement, namespace : string) : boolean => 
	match(ContentGuideSourceLogos, HowRelated.attrAnyNsValueOr(dvbi.a_href, null), namespace);

/**
 * determines if the identifer provided refers to a valid agreement app
 *
 * @param {XmlElement} HowRelated  The logo identifier
 * @param {string} namespace       The namespace being used in the XML document
 * @returns {boolean} true if this is a valid agreement app (A177 5.2.3.6) else false
 */
export function validServiceAgreementApp(HowRelated : XmlElement, namespace : string) : boolean {
	const HRhref = HowRelated.attrAnyNsValueOr(dvbi.a_href, null);
	return HRhref ? validAgreementApplication(HRhref, SchemaVersion(namespace)) : false;
}

/**
 * determines if the provided URN is associated with a A177 specification verison
 *
 * @param {string} urn  The URN to check
 * @returns {boolean} true is the specified URN is used to identify an A177 specification version, else false
 */
export let isA177specification_URN = (urn : string) : boolean => 
	SchemaVersions.find((v) => v?.URN == urn) != undefined;

// TODO - change this to support sync/async and file/url reading
console.log(chalk.yellow.underline("loading service list schemas..."));
SchemaVersions.forEach((version) => {
	process.stdout.write(chalk.yellow(`..loading ${version.version} ${version.namespace} from ${version.filename} `));
	version.schema = XmlDocument.fromBuffer(readFileSync(version.filename));
	console.log(version.schema ? chalk.green("OK") : chalk.red.bold("FAIL"));
});
