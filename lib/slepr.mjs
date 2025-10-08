/**
 * slepr.mjs
 *
 * SLEPR - Service List End Point Resolver
 */
import { readFile } from "fs";

import chalk from "chalk";
import { XmlDocument } from "libxml2-wasm";

import { datatypeIs } from "../phlib/phlib.js";

import { tva } from "./TVA_definitions.mjs";
import { dvbi, dvbisld } from "./DVB-I_definitions.mjs";

import handleErrors from "./fetch_err_handler.mjs";
import { isIn } from "./utils.mjs";
import { IANA_Subtag_Registry, ISO3166, TVA_ContentCS, TVA_FormatCS, DVBI_ContentSubject } from "./data_locations.mjs";
import { isHTTPURL, isTVAAudioLanguageType } from "./pattern_checks.mjs";
import IANAlanguages from "./IANA_languages.mjs";
import ClassificationScheme from "./classification_scheme.mjs";
import ISOcountries from "./ISO_countries.mjs";

var masterSLEPR = "";
const EMPTY_SLEPR = '<ServiceListEntryPoints xmlns="urn:dvb:metadata:servicelistdiscovery:2024"></ServiceListEntryPoints>';

const RFC2397_PREFIX = "data:";

// permitted query parameters
const allowed_arguments = [dvbi.e_ProviderName, dvbisld.a_regulatorListFlag, dvbi.e_Language, dvbi.e_TargetCountry, dvbi.e_Genre, dvbi.e_Delivery, dvbisld.q_inlineImages];

const DVB_DASH_DELIVERY = "dvb-dash",
	DVB_T_DELIVERY = "dvb-t",
	DVB_S_DELIVERY = "dvb-s",
	DVB_C_DELIVERY = "dvb-c",
	DVB_IPTV_DELIVERY = "dvb-iptv",
	DVB_APPLICATION_DELIVERY = "application";

function GetChild(element, childName, index) {
	let rc = null,
		i = 0;

	element.childNodes().forEachSubElement((child) => {
		if (child.name.endsWith(childName)) {
			i++;
			if (index == i) rc = child;
		}
	});

	return rc;
}

export const DEFAULT_PROCESSING = "default";
const ITALY_PROCESSING = "italy";
export const SLR_Processing_Modes = [DEFAULT_PROCESSING, ITALY_PROCESSING];

export default class SLEPR {
	#numRequests;
	#knownLanguages;
	#knownCountries;
	#knownGenres;
	#processingMode;
	#registryFilename;

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

		if (isHTTPURL(filename)) {
			fetch(filename)
				.then(handleErrors)
				.then((response) => response.text())
				.then((responseText) => (masterSLEPR = responseText.replace(/(\r\n|\n|\r|\t)/gm, "")))
				.catch((error) => {
					console.log(chalk.red(`error (${error}) retrieving ${filename}`));
					masterSLEPR = EMPTY_SLEPR;
				});
		} else
			readFile(filename, { encoding: "utf-8" }, function (err, data) {
				if (!err) masterSLEPR = data;
				else console.log(chalk.red(err));
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

			let update = (obj, key, value) => {
				if (!Object.prototype.hasOwnProperty.call(obj, key)) obj[key] = [];
				switch (datatypeIs(value)) {
					case "string":
						obj[key].push(value);
						break;
					case "array":
						obj[key] = obj[key].concat(value);
						break;
				}
			};

			// check for any erronous arguments
			for (let key in req.query) {
				const target_key = key.includes("[") ? key.slice(0, key.indexOf("[")) : key;
				if (isIn(allowed_arguments, target_key, false)) {
					update(params, target_key, req.query[key]);
				} else req.parseErr.push(`invalid argument - ${key}`);
			}
			let checkBoolean = (bool) => ["true", "false"].includes(bool);
			checkIt(params.regulatorListFlag, dvbisld.a_regulatorListFlag, checkBoolean);

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

			checkIt(params.inlineImages, dvbisld.q_inlineImages, checkBoolean);

			if (params.inlineImages && !datatypeIs(params.inlineImages, "string")) req.parseErr.push(`invalid type for ${dvbisld.q_inlineImages} [${typeof req.query.inlineImages}]`);

			/* value space of this argument is not checked
			//Provider Name(s)
			var checkProvider = (provider) => true;
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

		res.varyOn = [];
		const uas = req.headers["user-agent"];
		const DVBIuasPrefix = "DVB-I/A177r";
		let requestedVersion = -1, // no explict DVB-I version is requested
			ix = uas.indexOf(DVBIuasPrefix);
		if (ix != -1) {
			requestedVersion = Number.parseInt(uas.substring(ix + DVBIuasPrefix.length));
			if (requestedVersion < 6) requestedVersion = -1;
		}

		let queryParams = {};
		if (!this.#checkQuery(req, queryParams)) {
			if (req.parseErr) res.write(`[${req.parseErr.join(",\n\t")}]`);
			res.status(400);
			return false;
		}

		const slepr = XmlDocument.fromString(masterSLEPR);

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

		let bestSLRversion = 0;
		if (this.#processingMode == ITALY_PROCESSING && requestedVersion != -1) {
			// find the best matched version, highest version less than or equal to requestedVersion
			slepr.root.childNodes().forEachNamedSubElement(dvbisld.e_ProviderOffering, (prov) => {
				prov.childNodes().forEachNamedSubElement(dvbisld.e_ServiceListOffering, (serv) => {
					serv.childNodes().forEachNamedSubElement(dvbisld.e_ServiceListURI, (uri) => {
						const vers = uri.attrAnyNsValueOr(dvbisld.a_standardVersion, null);
						if (vers && vers.lastIndexOf(":") != -1) {
							const uri_version = Number.parseInt(vers.substring(1 + vers.lastIndexOf(":")));
							if (uri_version > bestSLRversion && uri_version <= requestedVersion) bestSLRversion = uri_version;
						}
					});
				});
			});
		}

		if (this.#processingMode == ITALY_PROCESSING) {
			// if the UAS is not specified then remove any <ServiceListURI> elements that have the @standardVersion attribute specified
			// and then any ServiceListOffering elements that have no remaining ServiceListURI elements
			// and then any ProviderOffering elements that have no remaining ServiceListOffering elements
			let prov,
				p = 0;
			while ((prov = slepr.root.getAnyNs(dvbisld.e_ProviderOffering, ++p)) != null) {
				let serv,
					s = 0;
				while ((serv = prov.getAnyNs(dvbisld.e_ServiceListOffering, ++s)) != null) {
					let uri,
						u = 0;
					while ((uri = serv.getAnyNs(dvbisld.e_ServiceListURI, ++u)) != null) {
						let remove_uri = false;
						if (requestedVersion == -1 && uri.attrAnyNs(dvbisld.a_standardVersion)) remove_uri = true;
						if (requestedVersion != -1) {
							const vers = uri.attrAnyNsValueOr(dvbisld.a_standardVersion, null);
							if (!vers) remove_uri = true;
							if (vers && vers.lastIndexOf(":") != -1) {
								const uri_version = Number.parseInt(vers.substring(1 + vers.lastIndexOf(":")));
								if (uri_version != bestSLRversion) remove_uri = true;
							}
						}
						if (remove_uri) {
							uri.remove();
							u--;
							res.vary("User-Agent");
							res.varyOn.push("UAS");
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
						if (queryParams.regulatorListFlag != flag) removeService = true;
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
							res.varyOn.push("UAS");
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

		const removeImages = queryParams?.inlineImages?.toLowerCase() == "true" ? true : false;
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
						while ((mediaLocator = GetChild(relatedMaterial, tva.e_MediaLocator, ++ml)) != null) {
							let mediaUri,
								mu = 0;
							let discardURIs = [];
							while ((mediaUri = GetChild(mediaLocator, tva.e_MediaUri, ++mu)) != null)
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
