/**
 * slepr.mjs
 *
 * SLEPR - Service List End Point Resolver
 */
import { readFile } from "fs";

import chalk from "chalk";
import { XmlDocument } from "libxml2-wasm";

import qs from "qs";

import { datatypeIs } from "./utils.mjs";

import { tva } from "./TVA_definitions.mjs";
import { dvbi, dvbisld } from "./DVB-I_definitions.mjs";

import handleErrors from "./fetch_err_handler.mjs";
import { isIn, isIni } from "./utils.mjs";
import { IANA_Subtag_Registry, ISO3166, TVA_ContentCS, TVA_FormatCS, DVBI_ContentSubject } from "./data_locations.mjs";
import { isHTTPURL, isTVAAudioLanguageType } from "./pattern_checks.mjs";
import IANAlanguages from "./IANA_languages.mjs";
import ClassificationScheme from "./classification_scheme.mjs";
import ISOcountries from "./ISO_countries.mjs";

let masterSLEPR = "";
let EMPTY_SLEPR = (err = undefined) =>
	`<ServiceListEntryPoints xmlns="urn:dvb:metadata:servicelistdiscovery:2024">${err ? `\n<!--${err} -->\n` : ""}<ServiceListRegistryEntity><Name>EMPTY</Name></ServiceListRegistryEntity></ServiceListEntryPoints>`;
let REGISTRY_ERROR = (message, document) => `<Error><Message><![CDATA[${message}]]></Message>\n<SLRDocument><![CDATA[\n${document}]]>\n</SLRDocument></Error>`;

const RFC2397_PREFIX = "data:";

// permitted query parameters
const allowed_arguments = [dvbi.e_ProviderName, dvbisld.a_regulatorListFlag, dvbi.e_Language, dvbi.e_TargetCountry, dvbi.e_Genre, dvbi.e_Delivery, dvbisld.q_inlineImages];

const DVB_DASH_DELIVERY = "dvb-dash",
	DVB_T_DELIVERY = "dvb-t",
	DVB_S_DELIVERY = "dvb-s",
	DVB_C_DELIVERY = "dvb-c",
	DVB_IPTV_DELIVERY = "dvb-iptv",
	DVB_APPLICATION_DELIVERY = "application";

export const DEFAULT_PROCESSING = "default";
const ITALY_PROCESSING = "italy";
export const SLR_Processing_Modes = [DEFAULT_PROCESSING, ITALY_PROCESSING];


function parse_UAS_strict(uas) {
    const DVBi_UAS_Regexp = /(DVB\-I\/A177r)(\d+)( \(([^;]*);([^;]+);([^;]+);([^;]+);([^;]*);([^;]+);([^;]+)\))?/;
    const found=uas?.match(DVBi_UAS_Regexp);
    return found ? {ok: true, version: parseInt(found[2]), capabilities: found[4], vendorname: found[5], modelName: found[6], softwareVersion: found[7], hardwareVersion: found[8], family: found[9], reserved: found[10]} : {ok:false};
}

function parse_UAS_loose(uas) {
    const DVBi_UAS_Regexp = /(DVB\-I\/A177r)(\d+)( \(([^;]*);([^;]*);([^;]*);([^;]*);([^;]*);([^;]*);([^;]*)\))?/;
    const found=uas?.match(DVBi_UAS_Regexp);
    return found ? {ok: true, version: parseInt(found[2]), capabilities: found[4], vendorname: found[5], modelName: found[6], softwareVersion: found[7], hardwareVersion: found[8], family: found[9], reserved: found[10]} : {ok:false};
}


export default class SLEPR {
	#numRequests;
	#knownLanguages;
	#knownCountries;
	#knownGenres;
	#processingMode;
	#registryFilename;
	#readError;

	constructor(useURLs, SLRmode, preloadedLanguageValidator = null, preloadedCountries = null, preloadedGenres = null) {
		this.#numRequests = 0;
		this.#processingMode = SLRmode;
		this.#registryFilename = undefined;
		this.loadDataFiles(useURLs, preloadedLanguageValidator, preloadedCountries, preloadedGenres);
	}

	stats() {
		let res = {
			numRequests: this.#numRequests,
			SLRfile: this.#registryFilename ? this.#registryFilename : "not set",
			SLRreadError: this.#readError ? this.#readError : "",
			mumGenres: this.#knownGenres.count(),
			numCountries: this.#knownCountries.count(),
			processing: this.#processingMode,
		};
		this.#knownLanguages.stats(res);
		return res;
	}

	/* public */ loadDataFiles(useURLs, preloadedLanguageValidator = null, preloadedCountries = null, preloadedGenres = null) {
		if (preloadedLanguageValidator) this.#knownLanguages = preloadedLanguageValidator;
		else {
			this.#knownLanguages = new IANAlanguages();
			this.#knownLanguages.loadLanguages(useURLs ? { url: IANA_Subtag_Registry.url, purge: true } : { file: IANA_Subtag_Registry.file, purge: true });
		}

		if (preloadedCountries) this.#knownCountries = preloadedCountries;
		else {
			this.#knownCountries = new ISOcountries(false, true);
			this.#knownCountries.loadCountries(useURLs ? { url: ISO3166.url } : { file: ISO3166.file });
		}

		if (preloadedGenres) this.#knownGenres = preloadedGenres;
		else {
			this.#knownGenres = new ClassificationScheme();
			this.#knownGenres.loadCS(
				useURLs ? { urls: [TVA_ContentCS.url, TVA_FormatCS.url, DVBI_ContentSubject.url] } : { files: [TVA_ContentCS.file, TVA_FormatCS.file, DVBI_ContentSubject.file] }
			);
		}
	}

	/**
	 * read in the master XML document as text
	 *
	 * @param {String} filename   filename or URL of the master XML document
	 */
	/* public */ loadServiceListRegistry(filename) {
		console.log(chalk.yellow(`loading SLR from ${filename}`));
		this.#readError = undefined;

		if (isHTTPURL(filename)) {
			fetch(filename)
				.then(handleErrors)
				.then((response) => response.text())
				.then((responseText) => (masterSLEPR = responseText.replace(/(\r\n|\n|\r|\t)/gm, "")))
				.catch((error) => {
					this.#readError = `error (${error}) retrieving ${filename}`;
					console.log(chalk.red(this.#readError));
					masterSLEPR = EMPTY_SLEPR(this.#readError);
				});
		} else
			readFile(filename, { encoding: "utf-8" }, function (err, data) {
				if (!err) masterSLEPR = data;
				else {
					this.#readError = err;
					console.log(chalk.red(this.#readError));
					masterSLEPR = EMPTY_SLEPR(this.#readError);
				}
			});
		this.#registryFilename = filename;
	}

	/* private */ #checkQuery(req, params) {
		req.parseErr = [];
		if (req.query) {
			let checkIt = (argument, argName, checkFunction) => {
				if (argument)
					switch (datatypeIs(argument)) {
						case "string":
							if (!checkFunction(argument)) req.parseErr.push(`invalid ${argName} [${argument}]`);
							break;
						case "array":
							argument.forEach((item) => {
								if (!checkFunction(item, false)) req.parseErr.push(`invalid ${argName} [${item}]`);
							});
							break;
						default:
							req.parseErr.push(`invalid type [${datatypeIs(argument)}] for ${argName}`);
							break;
					}
			};

			const queryParams = qs.parse(req.query);
			for (let key in queryParams) {
				if (isIn(allowed_arguments, key)) 
					params[key] = datatypeIs(queryParams[key], "array") ? queryParams[key] : [queryParams[key]];
				else req.parseErr.push(`invalid argument - ${key}`);
			}


			let checkBoolean = (bool) => ["true", "false"].includes(bool);
			checkIt(params.regulatorListFlag, dvbisld.a_regulatorListFlag, checkBoolean);
			if (params.regulatorListFlag?.length > 1)
				req.parseErr.push(`only a single &regulatorListFlag can be specified`);

			checkIt(params.inlineImages, dvbisld.q_inlineImages, checkBoolean);
			if (params.inlineImages?.length > 1)
				req.parseErr.push(`only a single &inlineImages can be specified`);

			//TargetCountry(s)
			let checkTargetCountry = (country) => this.#knownCountries.isISO3166code(country, false);
			checkIt(params.TargetCountry, dvbi.e_TargetCountry, checkTargetCountry);

			//Language(s)
			let checkLanguage = (language) => isTVAAudioLanguageType(language, false);
			checkIt(params.Language, dvbi.e_Language, checkLanguage);

			//DeliverySystems(s)
			let checkDelivery = (system) => [DVB_DASH_DELIVERY, DVB_T_DELIVERY, DVB_S_DELIVERY, DVB_C_DELIVERY, DVB_IPTV_DELIVERY, DVB_APPLICATION_DELIVERY].includes(system);
			checkIt(params.Delivery, dvbi.e_Delivery, checkDelivery);

			// Genre(s)
			let checkGenre = (genre) => this.#knownGenres.isIn(genre);
			checkIt(params.Genre, dvbi.e_Genre, checkGenre);

			if (params.inlineImages && !datatypeIs(params.inlineImages, "string")) req.parseErr.push(`invalid type for ${dvbisld.q_inlineImages} [${typeof req.query.inlineImages}]`);

			/* value space of this argument is not checked
			//Provider Name(s)
			let checkProvider = (provider) => true;
			checkIt(params.ProviderName, dvbi.e_ProviderName, checkProvider) 
			*/
		}
		return req.parseErr.length == 0;
	}

	/* public */ processServiceListRequest(req, res) {
		this.#numRequests++;
		if (Object.prototype.hasOwnProperty.call(req?.query, "queryCapabilities")) {
			res.type("text/plain");
			res.write("urn:paulhiggs,2024-06:BabelFish#ja,zh,mi\nurn:ibm.com,1981:CTrlAtlDel\n");
			res.status(200);
			return true;
		}

		res.varyOn = new Set();
		const UASinfo = parse_UAS_loose(req.get("user-agent")); // we only care about the A177 version
		const requestedVersion = (UASinfo.ok && UASinfo.version >= 6) ? UASinfo.version : -1;
		let queryParams = {};
		if (!this.#checkQuery(req, queryParams)) {
			if (req.parseErr) res.write(`[${req.parseErr.join(",\n\t")}]`);
			res.status(400);
			return false;
		}

		let slepr = undefined;
		try {
			slepr = XmlDocument.fromString(masterSLEPR);
		} catch (err) {
			res.type("application/xml");
			res.status(500);
			res.send(REGISTRY_ERROR(err.message, masterSLEPR));
			return false;
		}
		if (queryParams.ProviderName) {
			// if ProviderName is specified, remove any ProviderOffering entries that do not match the name
			let prov,
				p = 0,
				providerCleanup = [];
			while ((prov = slepr.root.getAnyNs(dvbisld.e_ProviderOffering, ++p)) != null) {
				let Provider = prov.getAnyNs(dvbisld.e_Provider),
					provName,
					n = 0,
					matchedProvider = false;
				while (!matchedProvider && Provider && (provName = Provider.getAnyNs(dvbi.e_Name, ++n)) != null)
					if (isIn(queryParams.ProviderName, provName.content)) matchedProvider = true;
				if (!matchedProvider) providerCleanup.push(prov);
			}
			providerCleanup.forEach((provider) => provider.remove());
		}

		if (this.#processingMode == ITALY_PROCESSING) {
			// <ServiceListURI> elements must match the requested version
			// no UAS --> remove elements with @standardVersion
			// with UAS --> remove with mismatching @standardVersion

			let hasURIfor = (offering, version) => {
				let rc = false;
				offering.childNodes()?.forEachNamedSubElement(dvbisld.e_ServiceListURI, (uri) => {
					const vers = uri.attrAnyNsValueOr(dvbisld.a_standardVersion, null);
					if (vers && vers.lastIndexOf(":") != -1) {
						const uri_version = Number.parseInt(vers.substring(1 + vers.lastIndexOf(":")));
						if (uri_version == version) rc = true;
					}
				});
				return rc;
			};
			let prov,
				p = 0;
			while ((prov = slepr.root.getAnyNs(dvbisld.e_ProviderOffering, ++p)) != null) {
				let serv,
					s = 0;
				while ((serv = prov.getAnyNs(dvbisld.e_ServiceListOffering, ++s)) != null) {
					let uri,
						u = 0;
					let explicitUri = hasURIfor(serv, requestedVersion);
					while ((uri = serv.getAnyNs(dvbisld.e_ServiceListURI, ++u)) != null) {
						let remove_uri = false;
						// UAS is unspecified, remove version specific URI
						if (requestedVersion == -1 && uri.attrAnyNs(dvbisld.a_standardVersion)) remove_uri = true;

						// UAS is specified
						if (requestedVersion != -1) {
							const vers = uri.attrAnyNsValueOr(dvbisld.a_standardVersion, null);
							if (explicitUri && !vers) remove_uri = true;
							if (vers && vers.lastIndexOf(":") != -1) {
								const uri_version = Number.parseInt(vers.substring(1 + vers.lastIndexOf(":")));
								if (uri_version != requestedVersion) remove_uri = true;
							}
						}
						if (remove_uri) {
							uri.remove();
							u--;
							res.vary("User-Agent");
							res.varyOn.add("UAS");
						}
					}
					if (!serv.hasChild(dvbisld.e_ServiceListURI)) {
						serv.remove();
						s--;
					}
				}
				if (!prov.hasChild(dvbisld.e_ServiceListOffering)) {
					prov.remove();
					p--;
				}
			}
		}

		if (queryParams.regulatorListFlag || queryParams.Language || queryParams.TargetCountry || queryParams.Genre || requestedVersion != -1) {
			let prov,
				p = 0,
				servicesToRemove = [];
			while ((prov = slepr.root.getAnyNs(dvbisld.e_ProviderOffering, ++p)) != null) {
				let serv,
					s = 0;
				while ((serv = prov.getAnyNs(dvbisld.e_ServiceListOffering, ++s)) != null) {
					let removeService = false;

					// remove services that do not match the specified regulator list flag
					if (queryParams.regulatorListFlag) {
						// The regulatorListFlag has been specified in the query, so it has to match. Default in instance document is "false"
						let flag = serv.attrAnyNs(dvbisld.a_regulatorListFlag) ? serv.attrAnyNs(dvbisld.a_regulatorListFlag).value : "false";
						if (queryParams.regulatorListFlag[0] != flag) removeService = true;
					}

					if (!removeService && this.#processingMode == DEFAULT_PROCESSING && requestedVersion != -1) {
						const versionURI = `urn:dvb:metadata:dvbi:standardversion:${requestedVersion}`;
						let ServiceListURI,
							u = 0,
							keepService = false;
						while (!keepService && (ServiceListURI = serv.getAnyNs(dvbisld.e_ServiceListURI, ++u)) != null) {
							const specifiedVersion = ServiceListURI.attrAnyNs(dvbisld.a_standardVersion);
							if (!specifiedVersion) keepService = true;
							else {
								if (specifiedVersion.value == versionURI) keepService = true;
							}
						}
						if (!keepService) {
							removeService = true;
							res.vary("User-Agent");
							res.varyOn.add("UAS");
						}
					}

					// remove remaining services that do not match the specified language
					if (!removeService && queryParams.Language) {
						let lang,
							l = 0,
							keepService = false,
							hasLanguage = false;
						while (!keepService && (lang = serv.getAnyNs(dvbi.e_Language, ++l)) != null) {
							if (isIn(queryParams.Language, lang.content)) keepService = true;
							hasLanguage = true;
						}
						if (hasLanguage && !keepService) removeService = true;
					}

					// remove remaining services that do not match the specified target country
					if (!removeService && queryParams.TargetCountry) {
						let targetCountry,
							c = 0,
							keepService = false,
							hasCountry = false;
						while (!keepService && (targetCountry = serv.getAnyNs(dvbi.e_TargetCountry, ++c))) {
							// note that the <TargetCountry> element can signal multiple values. Its XML pattern is "\c\c\c(,\c\c\c)*"
							/* jslint -W083 */
							targetCountry.content.split(",").forEach((country) => {
								if (isIn(queryParams.TargetCountry, country)) keepService = true;
							});
							/* jslint +W083 */
							hasCountry = true;
						}
						if (hasCountry && !keepService) removeService = true;
					}

					// remove remaining services that do not match the specified genre
					if (!removeService && queryParams.Genre) {
						let genre,
							g = 0,
							keepService = false,
							hasGenre = false;
						while (!keepService && (genre = serv.getAnyNs(dvbi.e_Genre, ++g))) {
							if (isIn(queryParams.Genre, genre.content)) keepService = true;
							hasGenre = true;
						}
						if (hasGenre && !keepService) removeService = true;
					}

					// remove remaining services that do not have the requested delivery modes
					if (!removeService && queryParams.Delivery) {
						const delivery = serv.getAnyNs(dvbi.e_Delivery);

						if (!delivery) removeService = true;
						else {
							// check that there is a 'delivery system' for at least one of those requested
							let keepService = false;

							if (
								(isIn(queryParams.Delivery, DVB_DASH_DELIVERY) && delivery.hasChild(dvbisld.e_DASHDelivery)) ||
								(isIn(queryParams.Delivery, DVB_T_DELIVERY) && delivery.hasChild(dvbisld.e_DVBTDelivery)) ||
								(isIn(queryParams.Delivery, DVB_C_DELIVERY) && delivery.hasChild(dvbisld.e_DVBCDelivery)) ||
								(isIn(queryParams.Delivery, DVB_S_DELIVERY) && delivery.hasChild(dvbisld.e_DVBSDelivery)) ||
								(isIn(queryParams.Delivery, DVB_IPTV_DELIVERY) && (delivery.hasChild(dvbisld.e_RTSPDelivery) || delivery.hasChild(dvbisld.e_MulticastTSDelivery))) ||
								(isIn(queryParams.Delivery, DVB_APPLICATION_DELIVERY) && delivery.hasChild(dvbisld.e_ApplicationDelivery))
							) {
								keepService = true;
							}

							if (!keepService) removeService = true;
						}
					}

					if (removeService) servicesToRemove.push(serv);
				}
			}
			servicesToRemove.forEach((service) => service.remove());
		}

		// remove any <ProviderOffering> elements that no longer have any <ServiceListOffering>
		let prov,
			p = 0,
			providersToRemove = [];
		while ((prov = slepr.root.getAnyNs(dvbisld.e_ProviderOffering, ++p)) != null) {
			if (!prov.getAnyNs(dvbisld.e_ServiceListOffering)) providersToRemove.push(prov);
		}
		providersToRemove.forEach((provider) => provider.remove());

		const removeImages = queryParams.inlineImages && queryParams.inlineImages[0].toLowerCase() == "true" ? true : false;
		if (!removeImages) {
			// remove any 'data:' URLs from RelatedMaterial elements. if there are no remaining MediaLocator elements, then remove the RelatedMaterial
			let prov,
				p = 0;
			while ((prov = slepr.root.getAnyNs(dvbisld.e_ProviderOffering, ++p)) != null) {
				let serv,
					s = 0;
				while ((serv = prov.getAnyNs(dvbisld.e_ServiceListOffering, ++s)) != null) {
					let relatedMaterial,
						rm = 0;
					let discardRelatedMaterial = [];
					while ((relatedMaterial = serv.getAnyNs(dvbi.e_RelatedMaterial, ++rm)) != null) {
						let mediaLocator,
							ml = 0;
						let discardLocators = [];
						while ((mediaLocator = relatedMaterial.getAnyNs(tva.e_MediaLocator, ++ml)) != null) {
							let mediaUri,
								mu = 0;
							let discardURIs = [];
							while ((mediaUri = mediaLocator.getAnyNs(tva.e_MediaUri, ++mu)) != null)
								if (mediaUri.content.toLowerCase().startsWith(RFC2397_PREFIX.toLowerCase())) discardURIs.push(mediaUri);

							discardURIs.forEach((uri) => uri.remove());

							if (!mediaLocator.hasChild(tva.e_MediaUri)) discardLocators.push(mediaLocator);
						}
						discardLocators.forEach((locator) => locator.remove());
						if (!relatedMaterial.hasChild(tva.e_MediaLocator)) discardRelatedMaterial.push(relatedMaterial);
					}
					discardRelatedMaterial.forEach((rm) => rm.remove());
				}
			}
		}

		res.type("application/xml");
		res.send(slepr.toString());

		return true;
	}
}
