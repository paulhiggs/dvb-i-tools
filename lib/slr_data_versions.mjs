/**
 * slr_data_versions.mjs
 *
 * version related check
 */

import { readFileSync } from "fs";
import process from "process";

import chalk from "chalk";
import { XmlDocument } from "libxml2-wasm";

import { OLD, DRAFT, ETSI, CURRENT } from "./globals.mjs";
import { slVersions, dvbisld } from "./DVB-I_definitions.mjs";
import { DVBI_ServiceListRegistrySchema } from "./data_locations.mjs";
import { readmyfile } from "./utils.mjs";

let SchemaVersions = [
	// schema property is loaded from specified filename
	{
		namespace: dvbisld.A177r8_Namespace,
		version: slVersions.r8,
		filename: DVBI_ServiceListRegistrySchema.r8.file,
		schema: null,
		status: DRAFT,
		specVersion: "A177r8",
		URN: "urn:dvb:metadata:dvbi:standardversion:8",
	},
	{
		namespace: dvbisld.A177r7_Namespace,
		version: slVersions.r7,
		filename: DVBI_ServiceListRegistrySchema.r7.file,
		schema: null,
		status: CURRENT,
		specVersion: "A177r7",
		URN: "urn:dvb:metadata:dvbi:standardversion:7",
	},
	{
		namespace: dvbisld.A177r6_Namespace,
		version: slVersions.r6,
		filename: DVBI_ServiceListRegistrySchema.r6.file,
		schema: null,
		status: OLD,
		specVersion: "A177r6",
		URN: "urn:dvb:metadata:dvbi:standardversion:6",
	},
	{
		namespace: dvbisld.A177r5_Namespace,
		version: slVersions.r5,
		filename: DVBI_ServiceListRegistrySchema.r5.file,
		schema: null,
		status: OLD,
		specVersion: "A177r5",
	},
	{
		namespace: dvbisld.A177r4_Namespace,
		version: slVersions.r4,
		filename: DVBI_ServiceListRegistrySchema.r4.file,
		schema: null,
		status: OLD,
		specVersion: "A177r4",
	},
	{
		namespace: dvbisld.A177r3_Namespace,
		version: slVersions.r3,
		filename: DVBI_ServiceListRegistrySchema.r3.file,
		schema: null,
		status: OLD,
		specVersion: "A177r3",
	},
	{
		namespace: dvbisld.A177r2_Namespace,
		version: slVersions.r2,
		filename: DVBI_ServiceListRegistrySchema.r2.file,
		schema: null,
		status: OLD,
		specVersion: "A177r2",
	},
	{
		namespace: dvbisld.A177r1_Namespace,
		version: slVersions.r1,
		filename: DVBI_ServiceListRegistrySchema.r1.file,
		schema: null,
		status: ETSI,
		specVersion: "A177r1",
	},
	{
		namespace: dvbisld.A177_Namespace,
		version: slVersions.r0,
		filename: DVBI_ServiceListRegistrySchema.r0.file,
		schema: null,
		status: OLD,
		specVersion: "A177",
	},
];

/**
 * determine the schema version (and hence the specificaion version) in use
 *
 * @param {String} namespace     The namespace used in defining the schema
 * @returns {integer} Representation of the schema version or error code if unknown
 */
export let SLR_SchemaVersion = (namespace) => {
	const x = SchemaVersions.find((ver) => ver.namespace == namespace);
	return x ? x.version : slVersions.unknown;
};

/**
 * determine the DVB Bluebook version for the specified schema namespace
 *
 * @param {String} namespace     The namespace used in defining the schema
 * @returns {integer} Version of the DVB A177 specification where namespace is defined
 */
export let SLR_SchemaSpecVersion = (namespace) => {
	const x = SchemaVersions.find((ver) => ver.namespace == namespace);
	return x ? x.specVersion : "r?";
};

/**
 * determine the DVB Bluebook version for the specified schema namespace
 *
 * @param {String} namespace     The schema namespace
 * @returns {XMLDocument} the schema corresponding to the namespace
 */
export let SLR_GetSchema = (namespace) => SchemaVersions.find((s) => s.namespace == namespace);

// TODO - change this to support sync/async and file/url reading
console.log(chalk.yellow.underline("loading service list registry schemas..."));
SchemaVersions.forEach((version) => {
	process.stdout.write(chalk.yellow(`..loading ${version.version} ${version.namespace} from ${version.filename} `));
	let buf = readmyfile(version.filename);
	if (buf) version.schema = XmlDocument.fromBuffer(buf);
	process.stdout.write(`${version.schema ? chalk.green("OK") : chalk.red.bold("FAIL")}\n`);
});
