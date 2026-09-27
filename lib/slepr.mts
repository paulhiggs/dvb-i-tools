/**
 * slepr.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * SLEPR - Service List End Point Resolver
 */

import { readFile } from "fs"
import chalk from "chalk"
import { XmlDocument, XmlError } from "libxml2-wasm"
import express from "express"

import { datatypeIs, HasProperty } from "./utils.mts"
import { tva } from "./TVA_definitions.mts"
import { dvbi, dvbisld } from "./DVB-I_definitions.mts"

import { fetch_options } from "./globals.mts"
import handleErrors from "./fetch_err_handler.mts"
import { isHTTPURL, isTVAAudioLanguageType } from "./pattern_checks.mts"
import { LoadLanguages, LoadCountries, LoadGenres } from "./classification_scheme_loaders.mts"
import IANAlanguages from "./IANA_languages.mts"
import ISOcountries from "./ISO_countries.mts"
import ClassificationScheme from "./classification_scheme.mts"

let masterSLEPR = "";
const EMPTY_SLEPR = (err?: string) =>
	`<ServiceListEntryPoints xmlns="urn:dvb:metadata:servicelistdiscovery:2024">${err ? `\n<!--${err} -->\n` : ""}<ServiceListRegistryEntity><Name>EMPTY</Name></ServiceListRegistryEntity></ServiceListEntryPoints>`;
const REGISTRY_ERROR = (message: string, document: string) => `<Error><Message><![CDATA[${message}]]></Message>\n<SLRDocument><![CDATA[\n${document}]]>\n</SLRDocument></Error>`;

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

//function parse_UAS_strict(uas) {
//    const DVBi_UAS_Regexp = /(DVB\-I\/A177r)(\d+)( \(([^;]*);([^;]+);([^;]+);([^;]+);([^;]*);([^;]+);([^;]+)\))?/;
//    const found=uas?.match(DVBi_UAS_Regexp);
//    return found ? {ok: true, version: parseInt(found[2]), capabilities: found[4], vendorname: found[5], modelName: found[6], softwareVersion: found[7], hardwareVersion: found[8], family: found[9], reserved: found[10]} : {ok:false};
//}

type parsedUAS = {
	ok: boolean
	version?: number
	capabilities?: string
	vendorName?: string
	modelName?: string
	softwareVersion?: string
	hardwareVersion?: string
	family?: string
	reserved?: string
}
const DVBi_UAS_Regexp = /(DVB-I\/A177r)(\d+)( \(([^;]*);([^;]*);([^;]*);([^;]*);([^;]*);([^;]*);([^;]*)\))?/;
function parse_UAS_loose(uas?: string): parsedUAS {
    const found=uas?.match(DVBi_UAS_Regexp);
    return found 
		? {ok: true, version: parseInt(found[2]), capabilities: found[4], vendorName: found[5], modelName: found[6], softwareVersion: found[7], hardwareVersion: found[8], family: found[9], reserved: found[10]} 
		: {ok: false};
}


export default class SLEPR {
	#numRequests: number
	#knownLanguages: IANAlanguages
	#knownCountries: ISOcountries
	#knownGenres: ClassificationScheme
	#processingMode: string
	#registryFilename: string | undefined
	#readError: string | undefined

	constructor(useURLs: boolean, SLRmode: string,
			preloadedLanguageValidator : IANAlanguages | null = null, 
			preloadedCountries : ISOcountries | null= null, 
			preloadedGenres: ClassificationScheme | null  = null) {
		this.#numRequests = 0;
		this.#processingMode = SLRmode;
		this.#registryFilename = undefined;
		this.loadDataFiles(useURLs, preloadedLanguageValidator, preloadedCountries, preloadedGenres);
	}

	stats() {
		const res = {
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

	
	/* public */ loadDataFiles(useURLs: boolean, 
			preloadedLanguageValidator: IANAlanguages | null = null, 
			preloadedCountries: ISOcountries | null = null, 
			preloadedGenres: ClassificationScheme | null = null) {
		this.#knownLanguages = preloadedLanguageValidator || LoadLanguages({useURLs: useURLs, async: true, verbose: true});
		this.#knownCountries = preloadedCountries || LoadCountries({useURLs: useURLs, async: true, verbose: true});
		this.#knownGenres = preloadedGenres || LoadGenres({useURLs: useURLs, async: true, verbose: true});
	}

	/**
	 * read in the master XML document as text
	 *
	 * @param {string} filename   filename or URL of the master XML document
	 */
	/* public */ loadServiceListRegistry(filename: string) {
		console.log(chalk.yellow(`loading SLR from ${filename}`));
		this.#readError = undefined;

		if (isHTTPURL(filename)) {
			fetch(filename, fetch_options)
				.then(handleErrors)
				.then((response) => response.text())
				.then((responseText) => (masterSLEPR = responseText.replace(/(\r\n|\n|\r|\t)/gm, "")))
				.catch((error) => {
					this.#readError = `error (${error}) retrieving ${filename}`;
					console.log(chalk.red(this.#readError));
					masterSLEPR = EMPTY_SLEPR(this.#readError);
				});
		} else
			readFile(filename, { encoding: "utf-8" }, (err: NodeJS.ErrnoException | null, data: string) => {
				if (!err) masterSLEPR = data;
				else {
					this.#readError = `readfile error: errno=${err.errno}, code=${err.code}`
					console.log(chalk.red(this.#readError));
					masterSLEPR = EMPTY_SLEPR(this.#readError);
				}
			});
		this.#registryFilename = filename;
	}

	/* private */ #checkQuery(req: express.Request, params: Record<string, string | string[]>) {
		req.parseErr = [];
		if (req.query) {

		type checkFn = (value: string) => boolean

			const checkIt = (argument: string | string[], argName: string, checkFunction: checkFn) => {
				if (argument)
					switch (datatypeIs(argument)) {
						case "string":
							if (!checkFunction(argument as string)) 
								req.parseErr!.push(`invalid ${argName} [${argument}]`);
							break;
						case "array":
							(argument as string[]).forEach((item: string) => {
								if (!checkFunction(item)) 
									req.parseErr!.push(`invalid ${argName} [${item}]`);
							});
							break;
						default:
							req.parseErr!.push(`invalid type [${datatypeIs(argument)}] for ${argName}`);
							break;
					}
			};

			//const queryParams = qs.parse(req.query) as qs.ParsedQs;
			const queryParams = req.query
			for (const key in queryParams) {
				if (allowed_arguments.includes(key)) 
					params[key] = datatypeIs(queryParams[key], "array") as boolean ? queryParams[key] as string : [queryParams[key]] as string[];
				else req.parseErr.push(`invalid argument - ${key}`);
			}


			const checkBoolean = (bool: string) => ["true", "false"].includes(bool);
			checkIt(params.regulatorListFlag, dvbisld.a_regulatorListFlag, checkBoolean);
			if (params.regulatorListFlag?.length > 1)
				req.parseErr.push(`only a single &regulatorListFlag can be specified`);

			checkIt(params.inlineImages, dvbisld.q_inlineImages, checkBoolean);
			if (params.inlineImages?.length > 1)
				req.parseErr.push(`only a single &inlineImages can be specified`);

			//TargetCountry(s)
			const checkTargetCountry: checkFn = (country) => this.#knownCountries.isISO3166code(country, false);
			checkIt(params.TargetCountry, dvbi.e_TargetCountry, checkTargetCountry);

			//Language(s)
			const checkLanguage: checkFn = (language) => isTVAAudioLanguageType(language);
			checkIt(params.Language, dvbi.e_Language, checkLanguage);

			//DeliverySystems(s)
			const checkDelivery: checkFn = (system) => [DVB_DASH_DELIVERY, DVB_T_DELIVERY, DVB_S_DELIVERY, DVB_C_DELIVERY, DVB_IPTV_DELIVERY, DVB_APPLICATION_DELIVERY].includes(system);
			checkIt(params.Delivery, dvbi.e_Delivery, checkDelivery);

			// Genre(s)
			const checkGenre: checkFn = (genre) => this.#knownGenres.has(genre);
			checkIt(params.Genre, dvbi.e_Genre, checkGenre);

			if (params.inlineImages && !datatypeIs(params.inlineImages, "string")) req.parseErr.push(`invalid type for ${dvbisld.q_inlineImages} [${typeof req.query.inlineImages}]`);

			/* value space of this argument is not checked
			//Provider Name(s)
			const checkProvider: checkFn = (provider) => true;
			checkIt(params.ProviderName, dvbi.e_ProviderName, checkProvider) 
			*/
		}
		return req.parseErr.length == 0;
	}

	/* public */ processServiceListRequest(req: express.Request, res: express.Response) {
		this.#numRequests++;
		if (HasProperty(req?.query, "queryCapabilities")) {
			res.type("text/plain");
			res.write("urn:paulhiggs,2024-06:BabelFish#ja,zh,mi\nurn:ibm.com,1981:CTrlAtlDel\n");
			res.status(200);
			return true;
		}

		res.varyOn = new Set();
		const UASinfo = parse_UAS_loose(req.get("user-agent")); // we only care about the A177 version
		const requestedVersion = (UASinfo.ok && UASinfo.version! >= 6) ? UASinfo.version! : -1;
		const queryParams: Record<string, string> = {};
		if (!this.#checkQuery(req, queryParams)) {
			if (req.parseErr) res.write(`[${req.parseErr.join(",\n\t")}]`);
			res.status(400);
			return false;
		}

		// eslint-disable-next-line no-useless-assignment
		let slepr = undefined;
		try {
			slepr = XmlDocument.fromString(masterSLEPR);
		} catch (err) {
			res.type("application/xml");
			res.status(500);
			const message = (err instanceof XmlError) ? err.message : "sometghign bad happened"
			res.send(REGISTRY_ERROR(message, masterSLEPR));
			return false;
		}
		if (queryParams.ProviderName) {
			// if ProviderName is specified, remove any ProviderOffering entries that do not match the name
			let prov,
				p = 0
			const providerCleanup: XmlElement[] = []
			while ((prov = (slepr.root as XmlElement).getAnyNs(dvbisld.e_ProviderOffering, ++p)) != null) {
				const Provider: XmlElement | null = prov.getAnyNs(dvbisld.e_Provider)
				let provName,
					n = 0,
					matchedProvider = false;
				while (!matchedProvider && Provider && (provName = Provider.getAnyNs(dvbi.e_Name, ++n)) != null)
					if (queryParams.ProviderName.includes(provName.content)) matchedProvider = true;
				if (!matchedProvider) providerCleanup.push(prov);
			}
			providerCleanup.forEach((provider) => provider.remove());
		}

		if (this.#processingMode == ITALY_PROCESSING) {
			// <ServiceListURI> elements must match the requested version
			// no UAS --> remove elements with @standardVersion
			// with UAS --> remove with mismatching @standardVersion

			const hasURIfor = (offering: XmlElement, version: number): boolean => {
				let rc = false;
				offering?.forEachNamedChildElement(dvbisld.e_ServiceListURI, (uri) => {
					const vers = uri.attrAnyNsValueOr(dvbisld.a_standardVersion);
					if (vers && vers.lastIndexOf(":") != -1) {
						const uri_version = Number.parseInt(vers.substring(1 + vers.lastIndexOf(":")));
						if (uri_version == version) rc = true;
					}
				});
				return rc;
			};
			
			let prov,
				p = 0;
			while ((prov = (slepr.root as XmlElement).getAnyNs(dvbisld.e_ProviderOffering, ++p)) != null) {
				let serv,
					s = 0;
				while ((serv = prov.getAnyNs(dvbisld.e_ServiceListOffering, ++s)) != null) {
					let uri,
						u = 0;
					const explicitUri = hasURIfor(serv, requestedVersion);
					while ((uri = serv.getAnyNs(dvbisld.e_ServiceListURI, ++u)) != null) {
						let remove_uri = false;
						// UAS is unspecified, remove version specific URI
						if (requestedVersion == -1 && uri.attrAnyNs(dvbisld.a_standardVersion)) remove_uri = true;

						// UAS is specified
						if (requestedVersion != -1) {
							const vers = uri.attrAnyNsValueOr(dvbisld.a_standardVersion);
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
				p = 0
			const servicesToRemove = [];
			while ((prov = (slepr.root as XmlElement).getAnyNs(dvbisld.e_ProviderOffering, ++p)) != null) {
				let serv,
					s = 0;
				while ((serv = prov.getAnyNs(dvbisld.e_ServiceListOffering, ++s)) != null) {
					let removeService = false;

					// remove services that do not match the specified regulator list flag
					if (queryParams.regulatorListFlag) {
						// The regulatorListFlag has been specified in the query, so it has to match. Default in instance document is "false"
						const flag = serv.attrAnyNsValueOr(dvbisld.a_regulatorListFlag, "false") as string;
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
							if (queryParams.Language.includes(lang.content)) keepService = true;
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
								if (queryParams.TargetCountry.includes(country)) keepService = true;
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
							if (queryParams.Genre.includes(genre.content)) keepService = true;
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
								(queryParams.Delivery.includes(DVB_DASH_DELIVERY) && delivery.hasChild(dvbisld.e_DASHDelivery)) ||
								(queryParams.Delivery.includes(DVB_T_DELIVERY) && delivery.hasChild(dvbisld.e_DVBTDelivery)) ||
								(queryParams.Delivery.includes(DVB_C_DELIVERY) && delivery.hasChild(dvbisld.e_DVBCDelivery)) ||
								(queryParams.Delivery.includes(DVB_S_DELIVERY) && delivery.hasChild(dvbisld.e_DVBSDelivery)) ||
								(queryParams.Delivery.includes( DVB_IPTV_DELIVERY) && (delivery.hasChild(dvbisld.e_RTSPDelivery) || delivery.hasChild(dvbisld.e_MulticastTSDelivery))) ||
								(queryParams.Delivery.includes( DVB_APPLICATION_DELIVERY) && delivery.hasChild(dvbisld.e_ApplicationDelivery))
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
			p = 0
		const providersToRemove = []
		while ((prov = (slepr.root as XmlElement).getAnyNs(dvbisld.e_ProviderOffering, ++p)) != null) {
			if (!prov.getAnyNs(dvbisld.e_ServiceListOffering)) providersToRemove.push(prov);
		}
		providersToRemove.forEach((provider) => provider.remove());

		const removeImages = queryParams.inlineImages && queryParams.inlineImages[0].toLowerCase() == "true" ? true : false;
		if (!removeImages) {
			// remove any 'data:' URLs from RelatedMaterial elements. if there are no remaining MediaLocator elements, then remove the RelatedMaterial
			let prov,
				p = 0;
			while ((prov = (slepr.root as XmlElement).getAnyNs(dvbisld.e_ProviderOffering, ++p)) != null) {
				let serv,
					s = 0;
				while ((serv = prov.getAnyNs(dvbisld.e_ServiceListOffering, ++s)) != null) {
					let relatedMaterial,
						rm = 0;
					const discardRelatedMaterial = [];
					while ((relatedMaterial = serv.getAnyNs(dvbi.e_RelatedMaterial, ++rm)) != null) {
						let mediaLocator,
							ml = 0;
						const discardLocators = [];
						while ((mediaLocator = relatedMaterial.getAnyNs(tva.e_MediaLocator, ++ml)) != null) {
							let mediaUri,
								mu = 0;
							const discardURIs = [];
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
