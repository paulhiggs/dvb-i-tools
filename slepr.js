// SLEPR - Service List End Point Resolver

import chalk from "chalk";
import { readFile } from "fs";

// libxmljs - https://www.npmjs.com/package/libxmljs2
import { parseXmlString } from "libxmljs2";

import { handleErrors } from "./fetch-err-handler.js";

import { xPath, isIn } from "./utils.js";

import { dvbi } from "./DVB-I_definitions.js";
import { tva } from "./TVA_definitions.js";

import { IANA_Subtag_Registry, ISO3166, TVA_ContentCS, TVA_FormatCS, DVBI_ContentSubject } from "./data-locations.js";
import { hasChild } from "./schema_checks.js";

import { datatypeIs } from "./phlib/phlib.js";

var masterSLEPR = "";
const EMPTY_SLEPR = '<ServiceListEntryPoints xmlns="urn:dvb:metadata:servicelistdiscovery:2021"></ServiceListEntryPoints>';

const RFC2397_PREFIX = "data:";

// permitted query parameters
const allowed_arguments = [dvbi.e_ProviderName, dvbi.a_regulatorListFlag, dvbi.e_Language, dvbi.e_TargetCountry, dvbi.e_Genre, dvbi.e_Delivery, dvbi.q_inlineImages];

import { isHTTPURL, isTVAAudioLanguageType } from "./pattern_checks.js";

import IANAlanguages from "./IANAlanguages.js";
import ClassificationScheme from "./ClassificationScheme.js";
import ISOcountries from "./ISOcountries.js";

const DVB_DASH_DELIVERY = "dvb-dash",
	DVB_T_DELIVERY = "dvb-t",
	DVB_S_DELIVERY = "dvb-s",
	DVB_C_DELIVERY = "dvb-c",
	DVB_IPTV_DELIVERY = "dvb-iptv",
	DVB_APPLICATION_DELIVERY = "application";

function GetChild(element, childName, index) {
	let rc = null,
		i = 0;

	element.childNodes().forEachSubElement((e) => {
		if (e.name().endsWith(childName)) {
			i++;
			if (index == i) rc = e;
		}
	});

	return rc;
}

export default class SLEPR {
	#numRequests;
	#knownLanguages;
	#knownCountries;
	#knownGenres;

	constructor(useURLs, preloadedLanguageValidator = null, preloadedCountries = null, preloadedGenres = null) {
		this.#numRequests = 0;
		this.loadDataFiles(useURLs, preloadedLanguageValidator, preloadedCountries, preloadedGenres);
	}

	stats() {
		let res = {};
		res.numRequests = this.#numRequests;
		res.mumGenres = this.#knownGenres.count();
		this.#knownLanguages.stats(res);
		res.numCountries = this.#knownCountries.count();
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
	 * @param {string} filename   filename of the master XML document
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
			masterSLEPR = fetch(filename);
		} else
			readFile(filename, { encoding: "utf-8" }, function (err, data) {
				if (!err) masterSLEPR = data.replace(/(\r\n|\n|\r|\t)/gm, "");
				else console.log(chalk.red(err));
			});
	}

	/* private */ checkQuery(req) {
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

			// check for any erronous arguments
			for (var key in req.query) if (!isIn(allowed_arguments, key, false)) req.parseErr.push(`invalid argument [${key}]`);

			//regulatorListFlag needs to be a boolean, "true" or "false" only
			if (req.query.regulatorListFlag) {
				if (!datatypeIs(req.query.regulatorListFlag, "string")) req.parseErr.push(`invalid type for ${dvbi.a_regulatorListFlag} [${typeof req.query.regulatorListFlag}]`);

				if (!["true", "false"].includes(req.query.regulatorListFlag.toLowerCase()))
					req.parseErr.push(`invalid value for ${dvbi.a_regulatorListFlag} [${req.query.regulatorListFlag}]`);
			}

			//TargetCountry(s)
			var checkTargetCountry = (country) => this.#knownCountries.isISO3166code(country, false);
			checkIt(req.query.TargetCountry, dvbi.e_TargetCountry, checkTargetCountry);

			//Language(s)
			var checkLanguage = (language) => isTVAAudioLanguageType(language, false);
			checkIt(req.query.Language, dvbi.e_Language, checkLanguage);

			//DeliverySystems(s)
			var checkDelivery = (system) => [DVB_DASH_DELIVERY, DVB_T_DELIVERY, DVB_S_DELIVERY, DVB_C_DELIVERY, DVB_IPTV_DELIVERY, DVB_APPLICATION_DELIVERY].includes(system);
			checkIt(req.query.Delivery, dvbi.e_Delivery, checkDelivery);

			// Genre(s)
			var checkGenre = (genre) => this.#knownGenres.isIn(genre);
			checkIt(req.query.Genre, dvbi.e_Genre, checkGenre);

			if (req.query.inlineImages) {
				if (!datatypeIs(req.query.inlineImages, "string")) req.parseErr.push(`invalid type for ${dvbi.q_inlineImages} [${typeof req.query.inlineImages}]`);

				if (!["true", "false"].includes(req.query.inlineImages.toLowerCase())) req.parseErr.push(`invalid value for  ${dvbi.q_inlineImages} [${req.query.inlineImages}]`);
			}
			/* value space of this argument is not checked
			//Provider Name(s)
			var checkProvider = (provider) => true;
			checkIt(req.query.ProviderName, dvbi.e_ProviderName, checkProvider) 
			*/
		}
		return req.parseErr.length == 0;
	}

	/* public */ processServiceListRequest(req, res) {
		this.#numRequests++;
		if (!this.checkQuery(req)) {
			if (req.parseErr) res.write(`[${req.parseErr.join(",\n\t")}]`);
			res.status(400);
			return false;
		}
		let slepr = parseXmlString(masterSLEPR);

		let SLEPR_SCHEMA = {},
			SCHEMA_PREFIX = slepr.root().namespace().prefix(),
			SCHEMA_NAMESPACE = slepr.root().namespace().href();
		SLEPR_SCHEMA[SCHEMA_PREFIX] = SCHEMA_NAMESPACE;

		let props = {
			schema: SLEPR_SCHEMA,
			prefix: SCHEMA_PREFIX,
			namespace: SCHEMA_NAMESPACE,
		};

		if (req.query.ProviderName) {
			// if ProviderName is specified, remove any ProviderOffering entries that do not match the name
			let prov,
				p = 0,
				providerCleanup = [];
			while ((prov = slepr.get("//" + xPath(props.prefix, dvbi.e_ProviderOffering, ++p), props.schema)) != null) {
				let provName,
					n = 0,
					matchedProvider = false;
				while (!matchedProvider && (provName = prov.get(xPath(props.prefix, dvbi.e_Provider) + "/" + xPath(props.prefix, dvbi.e_Name, ++n), props.schema)))
					if (isIn(req.query.ProviderName, provName.text())) matchedProvider = true;
				if (!matchedProvider) providerCleanup.push(prov);
			}
			providerCleanup.forEach((provider) => provider.remove());
		}

		if (req.query.regulatorListFlag || req.query.Language || req.query.TargetCountry || req.query.Genre) {
			let prov,
				p = 0,
				servicesToRemove = [];
			while ((prov = slepr.get("//" + xPath(props.prefix, dvbi.e_ProviderOffering, ++p), props.schema)) != null) {
				let serv,
					s = 0;
				while ((serv = prov.get(xPath(props.prefix, dvbi.e_ServiceListOffering, ++s), props.schema)) != null) {
					let removeService = false;

					// remove services that do not match the specified regulator list flag
					if (req.query.regulatorListFlag) {
						// The regulatorListFlag has been specified in the query, so it has to match. Default in instance document is "false"
						let flag = serv.attr(dvbi.a_regulatorListFlag) ? serv.attr(dvbi.a_regulatorListFlag).value() : "false";
						if (req.query.regulatorListFlag != flag) removeService = true;
					}

					// remove remaining services that do not match the specified language
					if (!removeService && req.query.Language) {
						let lang,
							l = 0,
							keepService = false,
							hasLanguage = false;
						while (!keepService && (lang = serv.get(xPath(props.prefix, dvbi.e_Language, ++l), props.schema))) {
							if (isIn(req.query.Language, lang.text())) keepService = true;
							hasLanguage = true;
						}
						if (hasLanguage && !keepService) removeService = true;
					}

					// remove remaining services that do not match the specified target country
					if (!removeService && req.query.TargetCountry) {
						let targetCountry,
							c = 0,
							keepService = false,
							hasCountry = false;
						while (!keepService && (targetCountry = serv.get(xPath(props.prefix, dvbi.e_TargetCountry, ++c), props.schema))) {
							// note that the <TargetCountry> element can signal multiple values. Its XML pattern is "\c\c\c(,\c\c\c)*"
							let countries = targetCountry.text().split(",");
							/* jslint -W083 */
							countries.forEach((country) => {
								if (isIn(req.query.TargetCountry, country)) keepService = true;
							});
							/* jslint +W083 */
							hasCountry = true;
						}
						if (hasCountry && !keepService) removeService = true;
					}

					// remove remaining services that do not match the specified genre
					if (!removeService && req.query.Genre) {
						let genre,
							g = 0,
							keepService = false,
							hasGenre = false;
						while (!keepService && (genre = serv.get(xPath(props.prefix, dvbi.e_Genre, ++g), props.schema))) {
							if (isIn(req.query.Genre, genre.text())) keepService = true;
							hasGenre = true;
						}
						if (hasGenre && !keepService) removeService = true;
					}

					// remove remaining services that do not have the requested delivery modes
					if (!removeService && req.query.Delivery) {
						let delivery = serv.get(xPath(props.prefix, dvbi.e_Delivery), props.schema);

						if (!delivery) removeService = true;
						else {
							// check that there is a 'delivery system' for at least one of those requested
							let keepService = false;

							if (
								(isIn(req.query.Delivery, DVB_DASH_DELIVERY) && hasChild(delivery, dvbi.e_DASHDelivery)) ||
								(isIn(req.query.Delivery, DVB_T_DELIVERY) && hasChild(delivery, dvbi.e_DVBTDelivery)) ||
								(isIn(req.query.Delivery, DVB_C_DELIVERY) && hasChild(delivery, dvbi.e_DVBCDelivery)) ||
								(isIn(req.query.Delivery, DVB_S_DELIVERY) && hasChild(delivery, dvbi.e_DVBSDelivery)) ||
								(isIn(req.query.Delivery, DVB_IPTV_DELIVERY) && (hasChild(delivery, dvbi.e_RTSPDelivery) || hasChild(delivery, dvbi.e_MulticastTSDelivery))) ||
								(isIn(req.query.Delivery, DVB_APPLICATION_DELIVERY) && hasChild(delivery, dvbi.e_ApplicationDelivery))
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
		while ((prov = slepr.get("//" + xPath(props.prefix, dvbi.e_ProviderOffering, ++p), props.schema)) != null) {
			if (!prov.get(xPath(props.prefix, dvbi.e_ServiceListOffering, 1), props.schema)) providersToRemove.push(prov);
		}
		providersToRemove.forEach((provider) => provider.remove());

		let removeImages = req.query?.inlineImages?.toLowerCase() == "true" ? true : false;
		if (!removeImages) {
			// remove any 'data:' URLs from RelatedMaterial elements. if there are no remaining MediaLocator elements, then remove the RelatedMaterial
			let prov,
				p = 0;
			while ((prov = slepr.get("//" + xPath(props.prefix, dvbi.e_ProviderOffering, ++p), props.schema)) != null) {
				let serv,
					s = 0;
				while ((serv = prov.get(xPath(props.prefix, dvbi.e_ServiceListOffering, ++s), props.schema)) != null) {
					let relatedMaterial,
						rm = 0;
					let discardRelatedMaterial = [];
					while ((relatedMaterial = serv.get(xPath(props.prefix, dvbi.e_RelatedMaterial, ++rm), props.schema)) != null) {
						let mediaLocator,
							ml = 0;
						let discardLocators = [];
						while ((mediaLocator = GetChild(relatedMaterial, tva.e_MediaLocator, ++ml)) != null) {
							let mediaUri,
								mu = 0;
							let discardURIs = [];
							while ((mediaUri = GetChild(mediaLocator, tva.e_MediaUri, ++mu)) != null)
								if (mediaUri.text().toLowerCase().startsWith(RFC2397_PREFIX.toLowerCase())) discardURIs.push(mediaUri);

							discardURIs.forEach((uri) => uri.remove());

							if (!hasChild(mediaLocator, tva.e_MediaUri)) discardLocators.push(mediaLocator);
						}
						discardLocators.forEach((locator) => locator.remove());
						if (!hasChild(relatedMaterial, tva.e_MediaLocator)) discardRelatedMaterial.push(relatedMaterial);
					}
					discardRelatedMaterial.forEach((rm) => rm.remove());
				}
			}
		}

		res.type("text/xml");
		res.send(slepr.toString());

		return true;
	}
}
