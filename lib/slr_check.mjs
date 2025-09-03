/**
 * slr_check.mjs
 *
 * Check a service list registry response
 */
import chalk from "chalk";

import { DeprecatedAttribute } from "./common_errors.mjs";
import { LoadGenres, LoadCountries } from "./classification_scheme_loaders.mjs";
import { keys, InvalidCountryCode } from "./common_errors.mjs";
import { slVersions, dvbi, dvbiEA, dvbiEC, dvbisld, validApplicationTypes } from "./DVB-I_definitions.mjs";
import { APPLICATION, WARNING } from "./error_list.mjs";
import { CheckExtension, EXTENSION_LOCATION_SERVICE_LIST_REGISTRY } from "./extension_check.mjs";
import { ValidateLanguage } from "./IANA_languages.mjs";
import writeOut from "./logger.mjs";
import { mpeg7 } from "./MPEG7_definitions.mjs";
import { checkXMLLangs } from "./multilingual_element.mjs";
import { isHTTPURL, isTAGURI } from "./pattern_checks.mjs";
import { checkValidLogos } from "./related_material_checks.mjs";
import { checkAttributes, SchemaCheck, SchemaVersionCheck, SchemaLoad, checkTopElementsAndCardinality } from "./schema_checks.mjs";
import { validServiceListLogo, isA177specification_URN, a177versionFromURN } from "./sl_data_versions.mjs";
import { SLR_GetSchema, SLR_SchemaVersion } from "./slr_data_versions.mjs";
import { tva, tvaEA } from "./TVA_definitions.mjs";

export default class ServiceListRegistryCheck {
	#numRequests;
	#knownCountries;
	#allowedGenres;

	constructor(useURLs, opts, async = true) {
		this.#numRequests = 0;

		this.#knownCountries = opts?.countries ? opts.countries : LoadCountries(useURLs, async);

		console.log(chalk.yellow.underline("loading classification schemes..."));
		this.#allowedGenres = opts?.genres ? opts.genres : LoadGenres(useURLs, async);
	}

	stats() {
		return { numRequests: this.#numRequests };
	}

	/*private*/ #doSchemaVerification(ServiceListRegistry, errs, errCode, report_schema_version = true) {
		const x = SLR_GetSchema(ServiceListRegistry.root.documentNamespace());
		if (x && x.schema) {
			SchemaCheck(ServiceListRegistry, x.schema, x.filename, errs, `${errCode}:${SLR_SchemaVersion(ServiceListRegistry.root.documentNamespace())}`);
			if (report_schema_version) SchemaVersionCheck(ServiceListRegistry, x.status, errs, `${errCode}:`);
			return true;
		}
		return false;
	}

	/**
	 * validate the <Genre> elements specified
	 *
	 * @param {XmlElement} Offering  the element whose children should be checked
	 * @param {ErrorList}  errs      errors found in validaton
	 * @param {String}     errCode   error code prefix to be used in reports
	 */
	/* private */ #ValidateGenre(Offering, errs, errCode) {
		if (!Offering) {
			errs.addError({ type: APPLICATION, code: "GE000", message: "ValidateGenre() called with Offering=null" });
			return;
		}

		let g = 0,
			Genre;
		while ((Genre = Offering.getAnyNs(tva.e_Genre, ++g)) != null) {
			const genreValue = Genre.attrAnyNsValueOr(tva.a_href, null);
			if (genreValue && !this.#allowedGenres.isIn(genreValue))
				errs.addError({
					code: `${errCode}-2`,
					key: "invalid genre",
					message: `invalid ${tva.a_href.attribute()} value ${genreValue.quote()} for ${tva.e_Genre.elementize()}`,
					fragment: Genre,
				});
		}
	}

	/**
	 * validate the <RelatedMaterial> element
	 *
	 * @param {XmlElement} RelatedMaterial  the element whose children should be checked
	 * @param {ErrorList}  errs              errors found in validaton
	 * @param {String}     errCode           error code prefix to be used in reports
	 */
	/* private */ #ValidateRelatedMaterial(RelatedMaterial, errs, errCode) {
		const HowRelated = RelatedMaterial.getAnyNs(tva.e_HowRelated);
		if (!HowRelated) {
			errs.addError({
				code: `${errCode}-2`,
				message: `${tva.e_HowRelated.elementize()} not specified for ${tva.e_RelatedMaterial.elementize()}`,
				line: RelatedMaterial.line,
				key: `no ${tva.e_HowRelated}`,
			});
			return;
		}
		checkAttributes(HowRelated, [tva.a_href], [], tvaEA.HowRelated, errs, `${errCode}-5`);
		if (HowRelated.attrAnyNs(tva.a_href) && !validServiceListLogo(HowRelated))
			errs.addError({
				code: `${errCode}-6`,
				fragment: HowRelated,
				message: `Value of ${tva.e_HowRelated.elementize()} does not specify a Service List Logo`,
				key: keys.k_InvalidHRef,
				clause: "A177 Table 12 and clause 5.2.6.1",
				description: "Additional material related to the service. Use to signal the following: Service list logos",
			});
		checkValidLogos(RelatedMaterial, "Service List Registry", errs, `${errCode}-7`);
	}

	/* private */ #CheckOrganisationType(Organisation, errs, errCode) {
		/**
		 * A DVB OrganisationType is a reduced set of the elements defined in mpeg7:OrganisationType (ISO/IEC 15938-5: 7.4.5)
		 */
		// OrganisationType @regulatorListFlag checked by schema
		// OrganisationType <Name> checked by schema
		// OrganisationType <Kind> checked by schema
		// OrganisationType <ContactName> checked by schema
		// OrganisationType <Jurisdiction> checked by schema
		// OrganisationType <Address> checked by schema
		// OrganisationType <ElectronicAddress> checked by schema

		checkAttributes(Organisation, [], [dvbisld.a_regulatorFlag], [dvbisld.a_regulatorFlag], errs, `${errCode}-10`);
		checkTopElementsAndCardinality(
			Organisation,
			[
				{ name: mpeg7.e_Name, maxOccurs: Infinity },
				{ name: mpeg7.e_Kind, minOccurs: 0 },
				{ name: mpeg7.e_ContactName, minOccurs: 0 },
				{ name: mpeg7.e_Jurisdiction, minOccurs: 0 },
				{ name: mpeg7.e_Address, minOccurs: 0 },
				{ name: mpeg7.e_ElectronicAddress, minOccurs: 0 },
			],
			dvbiEC.OrganizationType,
			false,
			errs,
			`${errCode}-20`
		);
	}

	/* private */ #CheckServiceListOffering(Offering, errs, errCode) {
		const offeringNamespace = Offering.documentNamespace();
		// ServiceListOfferingType @regulatorListFlag checked by schema

		// check ServiceListOfferingType@lang
		const Offering_lang = Offering.attrAnyNsValueOr(tva.a_lang, null);
		if (Offering_lang) ValidateLanguage(Offering_lang, errs, `${errCode}-10`, Offering.line);

		//check <ServiceListName>
		checkXMLLangs(dvbisld.e_ServiceListName, dvbisld.e_ServiceListOffering, Offering, errs, `${errCode}-20`);

		// check <ServiceListOffering><ServiceListURI>
		let u = 0,
			ListURI,
			lowest_version = -10,
			first_uri = true;
		while ((ListURI = Offering.getAnyNs(dvbisld.e_ServiceListURI, ++u)) != null) {
			// check ServiceListURI
			let versionFound = slVersions.unknown;
			if (SLR_SchemaVersion(offeringNamespace) >= slVersions.r7) {
				// check @standardVersion
				if (!ListURI.attrAnyNs(dvbisld.a_standardVersion) && !first_uri) {
					errs.addError({
						code: `${errCode}-31`,
						message: `a ${dvbisld.e_ServiceListURI} element without ${dvbisld.a_standardVersion.attribute} must be first in the list of URIs`,
						fragment: ListURI,
						keys: "improper semantics",
						clause: "A177 Table 12",
					});
				}
				const ListURI_standardVersion = ListURI.attrAnyNsValueOr(dvbisld.a_standardVersion, null);
				if (ListURI_standardVersion) {
					if (isA177specification_URN(ListURI_standardVersion)) {
						versionFound = a177versionFromURN(ListURI_standardVersion);
						// check the values are incrementing
						if (versionFound != slVersions.unknown) {
							if (versionFound < lowest_version)
								errs.addError({
									code: `${errCode}-32`,
									message: `values specified for ${dvbisld.a_standardVersion.attribute(dvbisld.e_ServiceListURI)} should be in increasing order`,
									fragment: ListURI,
									keys: "invalid value",
									clause: "A177 Table 12",
								});
							lowest_version = versionFound;
						}
					} else
						errs.addError({
							code: `${errCode}-33`,
							message: `value specified for ${dvbisld.a_standardVersion.attribute(dvbisld.e_ServiceListURI)} is not a valid specification version URN`,
							fragment: ListURI,
							keys: "invalid value",
							clause: "A177 Table 1c",
						});
				}
			}
			const ListURI_contentType = ListURI.attrAnyNsValueOr(dvbisld.a_contentType, null); // its a required attribute so should always exist
			if (ListURI_contentType && SLR_SchemaVersion(offeringNamespace) <= slVersions.r6 && ListURI_contentType != "application/vnd.dvb.dvbisl+xml") {
				errs.addError({
					type: WARNING,
					code: `${errCode}-34`,
					message: `${dvbisld.a_contentType.attribute()} should be "application/vnd.dvb.dvbisl+xml" for A177r6 and below`,
					fragment: ListURI,
					keys: "invalid value",
					clause: "A177 Table 12",
				});
			}
			if (ListURI_contentType && SLR_SchemaVersion(offeringNamespace) >= slVersions.r7 && ListURI_contentType != "application/xml") {
				errs.addError({
					code: `${errCode}-35`,
					message: `${dvbisld.a_contentType.attribute()} must be "application/xml" for A177r7 and above`,
					fragment: ListURI,
					keys: "invalid value",
					clause: "A177 Table 12",
				});
			}

			// check <ServiceListURI><URI>
			const URI = ListURI.getAnyNs(dvbisld.e_URI);
			if (URI) {
				if (!isHTTPURL(URI.content))
					errs.addError({
						code: `${errCode}-36`,
						message: `${dvbisld.e_URI.elementize()}=${URI.content.quote()} is not a valid HTTP URL`,
						key: keys.k_InvalidURL,
						fragment: URI,
					});
			}
			first_uri = false;
		}

		// check <ServiceListOffering><Delivery>
		const Delivery = Offering.getAnyNs(dvbisld.e_Delivery);
		if (Delivery) {
			let dt = 0,
				DVBTDelivery;
			while ((DVBTDelivery = Delivery.getAnyNs(dvbisld.e_DVBTDelivery, ++dt)) != null)
				if (DVBTDelivery.attr(dvbisld.a_originalNetworkID) && SLR_SchemaVersion(offeringNamespace) >= slVersions.r6) {
					errs.addError(DeprecatedAttribute(DVBTDelivery.attr(dvbisld.a_originalNetworkID), "A177r6", `${errCode}-41`));
				}
			let ds = 0,
				DVBSDelivery;
			while ((DVBSDelivery = Delivery.getAnyNs(dvbisld.e_DVBSDelivery, ++ds)) != null)
				if (DVBSDelivery.attr(dvbisld.a_originalNetworkID) && SLR_SchemaVersion(offeringNamespace) >= slVersions.r6) {
					errs.addError(DeprecatedAttribute(DVBSDelivery.attr(dvbisld.a_originalNetworkID), "A177r6", `${errCode}-42`));
				}
			const ApplicationDelivery = Delivery.getAnyNs(dvbisld.e_ApplicationDelivery);
			if (ApplicationDelivery) {
				let at = 0,
					ApplicationType;
				while ((ApplicationType = ApplicationDelivery.getAnyNs(dvbisld.e_ApplicationType, ++at)) != null) {
					const Application_contentType = ApplicationType.attrAnyNsValueOr(dvbisld.a_contentType, null);
					if (Application_contentType) {
						if (!validApplicationTypes.includes(Application_contentType)) {
							errs.addError({
								code: `${errCode}-45`,
								message: `${Application_contentType.quote()} is not a valid application type`,
								fragment: ApplicationType,
								key: `invalid ${tva.a_contentType.attribute(dvbisld.e_ApplicationType)}`,
								clause: "A177 Table 12i",
								description: "The MIME type of the application or application signalling, as defined in clause 5.2.3, table 7.",
							});
						}
						if (Application_contentType == dvbi.XML_AIT_CONTENT_TYPE) {
							const xmlAitApplicationType = ApplicationType.attrAnyNsValueOr(dvbisld.a_xmlAitApplicationType, null);
							if (!xmlAitApplicationType)
								errs.addError({
									code: `${errCode}-48`,
									message: `${dvbisld.a_xmlAitApplicationType.attribute()} must be specified when ${dvbisld.a_contentType.attribute()}="${dvbi.XML_AIT_CONTENT_TYPE}"`,
									fragment: ApplicationType,
									key: `missing ${dvbisld.a_xmlAitApplicationType.attribute(dvbisld.e_ApplicationType)}`,
									clause: "A177 Table 12h",
									description: `If @contentType="application/vnd.dvb.ait+xml", the @xmlAitApplicationType attribute shall be included ...`,
								});
							if (xmlAitApplicationType && !["DVB-J", "DVB-HTML"].includes(xmlAitApplicationType))
								errs.addError({
									code: `${errCode}-49`,
									message: `incorrect value for ${dvbisld.a_xmlAitApplicationType.attribute(dvbisld.e_ApplicationType)}`,
									fragment: ApplicationType,
									key: "invalid value",
									clause: "A177 Table 12h",
									description: `If @contentType="application/vnd.dvb.ait+xml", the @xmlAitApplicationType attribute shall be included with a value as defined in ETSI TS 102 809, clauses 5.2.2, 5.4.4.4 and 5.4.4.11.`,
								});
						}
					}
				}
			}
		}

		// check <ServiceListOffering><Language>
		let l = 0,
			Language;
		while ((Language = Offering.getAnyNs(dvbisld.e_Language, ++l)) != null) ValidateLanguage(Language.content, errs, `${errCode}l`, Language.line);

		// check <ServiceListOffering><Genre>
		this.#ValidateGenre(Offering, errs, `${errCode}g`);

		// check <ServiceListOffering><TargetCountry>
		let c = 0,
			TargetCountry;
		while ((TargetCountry = Offering.getAnyNs(dvbisld.e_TargetCountry, ++c)) != null)
			if (!this.#knownCountries.isISO3166code(TargetCountry.content))
				errs.addError({
					code: `${errCode}-50`,
					message: InvalidCountryCode(TargetCountry.content, null, dvbisld.e_ServiceListOffering.elementize()),
					fragment: TargetCountry,
					key: keys.k_InvalidCountryCode,
				});

		// check <ServiceListOffering><RelatedMaterial>
		let rm = 0,
			RelatedMaterial;
		while ((RelatedMaterial = Offering.getAnyNs(dvbisld.e_RelatedMaterial, ++rm)) != null) {
			this.#ValidateRelatedMaterial(RelatedMaterial, errs, `${errCode}-60`);
		}

		// <ServiceListOffering><SRSSupport> validated by schema

		// check <ServiceListOffering><ServiceListId>
		const ServiceListId = Offering.getAnyNs(dvbisld.e_ServiceListId);
		if (ServiceListId && !isTAGURI(ServiceListId.content))
			errs.addError({
				code: `${errCode}-70`,
				message: `${ServiceListId.content.quote()} is not a valid service list identifier`,
				fragment: ServiceListId,
				key: keys.k_InvalidTag,
				clause: "A177 Table 12 and clause 5.2.2",
				description: "service list identifier should be a tag: URI according to IETF RFC 4151",
			});
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
				code: "SR003",
				message: `Root element is not ${dvbisld.e_ServiceListEntryPoints.elementize()}`,
				line: SLR.root.line,
				key: keys.k_XSDValidation,
				clause: "A177 clause 5.3.1",
				description: `the root element of the service list registry XML instance document must be ${dvbisld.e_ServiceListEntryPoints.elementize()}`,
			});
			return;
		}
		if (!SLR.root.namespaceUri) {
			errs.addError({
				code: "SR005",
				message: `namespace is not provided for ${dvbisld.e_ServiceListEntryPoints.elementize()}`,
				line: SLR.root.line,
				key: keys.k_XSDValidation,
				clause: "A177 clause 5.3.1",
				description: `the namespace for ${dvbisld.e_ServiceListEntryPoints.elementize()} is required to ensure appropriate syntax and semantic checking`,
			});
			return;
		}

		if (!this.#doSchemaVerification(SLR, errs, "SR005", options.report_schema_version)) {
			errs.addError({
				code: "SR010",
				message: `Unsupported namespace ${SLR.root.documentNamespace().quote()}`,
				key: keys.k_XSDValidation,
			});
			return;
		}

		const ServiceListRegistry = SLR.root;
		let slrRequiredAttributes = [],
			slrOptionalAttributes = ["schemaLocation"];
		if (SLR_SchemaVersion(ServiceListRegistry.documentNamespace()) >= slVersions.r3) slrRequiredAttributes.push(tva.a_lang);
		if (SLR_SchemaVersion(ServiceListRegistry.documentNamespace()) >= slVersions.r6) slrOptionalAttributes.push(dvbi.a_version);
		checkAttributes(ServiceListRegistry, slrRequiredAttributes, slrOptionalAttributes, dvbiEA.ServiceListEntryPoints, errs, "SR011");

		// check ServiceListEntryPoints@lang
		const SLRlang = ServiceListRegistry.attrAnyNsValueOr(tva.a_lang, null);
		if (SLRlang) ValidateLanguage(SLRlang, errs, "SR012", ServiceListRegistry.line);

		//<ServiceListEntryPoints><ServiceListRegistryEntry>
		const RegistryEntity = ServiceListRegistry.getAnyNs(dvbisld.e_ServiceListRegistryEntity);
		if (RegistryEntity) this.#CheckOrganisationType(RegistryEntity, errs, "SR051");

		//<ServiceListEntryPoints><ProviderOffering>
		let p = 0,
			ProviderOffering;
		while ((ProviderOffering = ServiceListRegistry.getAnyNs(dvbisld.e_ProviderOffering, ++p)) != null) {
			const Provider = ProviderOffering.getAnyNs(dvbisld.e_Provider);
			if (Provider) this.#CheckOrganisationType(Provider, errs, "SR081");

			let slo = 0,
				ServiceListOffering;
			while ((ServiceListOffering = ProviderOffering.getAnyNs(dvbisld.e_ServiceListOffering, ++slo)) != null) this.#CheckServiceListOffering(ServiceListOffering, errs, "SR082");
		}

		//<ServiceListEntryPoints><Extension>
		let e = 0,
			Extension;
		while ((Extension = ServiceListRegistry.getAnyNs(dvbi.e_Extension, ++e)) != null) CheckExtension(Extension, EXTENSION_LOCATION_SERVICE_LIST_REGISTRY, errs, "SR089");
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
