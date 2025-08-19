/**
 * slr_check.mjs
 *
 * Check a service list registry response
 */
import chalk from "chalk";
import { MakeDocumentProperties } from "../libxml2-wasm-extensions.mjs";

// dummy to load the module
import { initialise } from "./slr_data_versions.mjs";

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
import { sl_InvalidHrefValue, InvalidURL, DeprecatedElement, keys } from "./common_errors.mjs";
import { dvbi, dvbiEA, dvbisld } from "./DVB-I_definitions.mjs";
import writeOut from "./logger.mjs";
import { checkAttributes, checkTopElementsAndCardinality, hasChild, SchemaCheck, SchemaVersionCheck, SchemaLoad } from "./schema_checks.mjs";
import { SCHEMA_r0, SCHEMA_r1, SCHEMA_r2, SCHEMA_r3, SCHEMA_r4, SCHEMA_r5, SCHEMA_r6, SCHEMA_r7, SCHEMA_r8, SCHEMA_unknown } from "./sl_data_versions.mjs";
import { GetSchema, SchemaVersion, SchemaSpecVersion } from "./slr_data_versions.mjs";
import { tva } from "./TVA_definitions.mjs";

export default class ServiceListRegistryCheck {
	#numRequests;
	#knownLanguages;
	#knownCountries;
	#allowedGenres;

	constructor(useURLs, opts, async = true) {
		this.#numRequests = 0;

		this.#knownLanguages = opts?.languages ? opts.languages : LoadLanguages(useURLs, async);
		this.#knownCountries = opts?.countries ? opts.countries : LoadCountries(useURLs, async);

		console.log(chalk.yellow.underline("loading classification schemes..."));
		this.#allowedGenres = opts?.genres ? opts.genres : LoadGenres(useURLs, async);
	}

	stats() {
		let res = {};
		res.numRequests = this.#numRequests;
		return res;
	}

	/*private*/ #doSchemaVerification(ServiceListRegistry, props, errs, errCode, report_schema_version = true) {
		const x = GetSchema(props.namespace);
		if (x && x.schema) {
			SchemaCheck(ServiceListRegistry, x.schema, errs, `${errCode}:${SchemaVersion(props.namespace)}`);
			if (report_schema_version) SchemaVersionCheck(props, ServiceListRegistry, x.status, errs, `${errCode}:`);
			return true;
		}
		return false;
	}

	/**
	 * validate the service list and record any errors
	 *
	 * @param {String}    SLRtext     The service list registry text to be validated
	 * @param {ErrorList} errs        Errors found in validaton
	 * @param {Object}    options
	 *                      log_prefix            the first part of the logging location (or null if no logging)
	 *                      report_schema_version report the state of the schema in the error/warning list
	 */
	/*public*/ doValidateServiceListRegistry(SLRtext, errs, options = {}) {
		this.#numRequests++;

		if (!SLRtext) {
			errs.addError({
				type: APPLICATION,
				code: "SR000",
				message: "doValidateServiceListRegistry() called with SLRtext==null",
			});
			return;
		}

		if (!Object.prototype.hasOwnProperty.call(options, "log_prefix")) options.log_prefix = null;
		if (!Object.prototype.hasOwnProperty.call(options, "report_schema_version")) options.report_schema_version = true;

		const SLR = SchemaLoad(SLRtext, errs, "SR001");
		if (!SLR) return;
		writeOut(errs, options.log_prefix, false);

		if (SLR.root.name !== dvbisld.e_ServiceListEntryPoints) {
			errs.addError({
				code: "SL004",
				message: `Root element is not ${dvbisld.e_ServiceListEntryPoints.elementize()}`,
				line: SL.root.line,
				key: keys.k_XSDValidation,
				clause: "A177 clause 5.3.1",
				description: `the root element of the service list registry XML instance document must be ${dvbisld.e_ServiceListEntryPoints.elementize()}`,
			});
			return;
		}
		if (!SLR.root.namespaceUri) {
			errs.addError({
				code: "SR003",
				message: `namespace is not provided for ${dvbi.e_ServiceListEntryPoints.elementize()}`,
				line: SLR.root.line,
				key: keys.k_XSDValidation,
				clause: "A177 clause 5.3.1",
				description: `the namespace for ${dvbi.e_ServiceListEntryPoints.elementize()} is required to ensure appropriate syntax and semantic checking`,
			});
			return;
		}

		const props = MakeDocumentProperties(SLR.root);
		if (!this.#doSchemaVerification(SLR, props, errs, "SR005", options.report_schema_version)) {
			errs.addError({
				code: "SR010",
				message: `Unsupported namespace ${props.namespace.quote()}`,
				key: keys.k_XSDValidation,
			});
			return;
		}

		const ServiceListRegistry = SLR.root;
		let slrRequiredAttributes = [],
			slrOptionalAttributes = ["schemaLocation"];
		if (SchemaVersion(props.namespace) >= SCHEMA_r3) slrRequiredAttributes.push(tva.a_lang);
		if (SchemaVersion(props.namespace) >= SCHEMA_r6) slrOptionalAttributes.push(dvbi.a_version);
		checkAttributes(ServiceListRegistry, slrRequiredAttributes, slrOptionalAttributes, dvbiEA.ServiceListEntryPoints, errs, "SR011");

		/* TODO: add more service list registry checks */
	}

	/**
	 * validate the service list and record any errors
	 *
	 * @param {String} SLRtext  The service list text to be validated
	 * @returns {Class} Errors found in validaton
	 */
	/*public*/ validateServiceListRegistry(SLRtext) {
		var errs = new ErrorList(SLRtext);
		this.doValidateServiceListRegistry(SLRtext, errs);

		return new Promise((resolve, /* eslint-disable no-unused-vars*/ reject /* eslint-enable */) => {
			resolve(errs);
		});
	}
}
