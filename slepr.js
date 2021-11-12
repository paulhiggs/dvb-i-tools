// SLEPR - Service List End Point Resolver

import { readFile } from "fs";

// libxmljs - https://www.npmjs.com/package/libxmljs2
import { parseXmlString } from 'libxmljs2';

// Fetch() API for node.js- https://www.npmjs.com/package/node-fetch
/* jshint -W024 */
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)); /* jshint -W024 */
import { handleErrors } from "./fetch-err-handler.js";

import { xPath, isIn } from "./utils.js";

import { dvbi } from "./DVB-I_definitions.js";

import { IANA_Subtag_Registry, ISO3166, TVA_ContentCS, TVA_FormatCS, DVBI_ContentSubject } from "./data-locations.js";
import { hasChild } from "./schema_checks.js";

import { dataType } from "./phlib/phlib.js";

var masterSLEPR="";
const EMPTY_SLEPR="<ServiceListEntryPoints xmlns=\"urn:dvb:metadata:servicelistdiscovery:2021\"></ServiceListEntryPoints>";


// permitted query parameters
const allowed_arguments=[dvbi.e_ProviderName, dvbi.a_regulatorListFlag, dvbi.e_Language, dvbi.e_TargetCountry, dvbi.e_Genre, dvbi.e_Delivery];

import { isHTTPURL, isTVAAudioLanguageType } from "./pattern_checks.js";

import IANAlanguages from './IANAlanguages.js';
import ClassificationScheme from "./ClassificationScheme.js";
import ISOcountries from "./ISOcountries.js";

const DVB_DASH_DELIVERY="dvb-dash",
      DVB_T_DELIVERY="dvb-t",
      DVB_S_DELIVERY="dvb-s", 
      DVB_C_DELIVERY="dvb-c",
      DVB_IPTV_DELIVERY="dvb-iptv",
      DVB_APPLICATION_DELIVERY="application";
      
export default class SLEPR {

	constructor(useURLs, preloadedLanguageValidator=null, preloadedCountries=null, preloadedGenres=null) {
		this.loadDataFiles(useURLs, preloadedLanguageValidator, preloadedCountries, preloadedGenres);
	}  

	/* public */ loadDataFiles(useURLs, preloadedLanguageValidator=null, preloadedCountries=null, preloadedGenres=null) {
		if (preloadedLanguageValidator) 
			this.knownLanguages=preloadedLanguageValidator;
		else {
			this.knownLanguages=new IANAlanguages();
			this.knownLanguages.loadLanguages(useURLs?{url: IANA_Subtag_Registry.url, purge: true}:{file: IANA_Subtag_Registry.file, purge: true});
		}

		if (preloadedCountries)
			this.knownCountries=preloadedCountries;
		else {
			this.knownCountries=new ISOcountries(false, true);
			this.knownCountries.loadCountries(useURLs?{url:ISO3166.url}:{file:ISO3166.file});
		}

		if (preloadedGenres)
			this.knownGenres=preloadedGenres;
		else {
			this.knownGenres=new ClassificationScheme();
			this.knownGenres.loadCS(useURLs?
				{urls:[TVA_ContentCS.url, TVA_FormatCS.url, DVBI_ContentSubject.url]}:
				{files:[TVA_ContentCS.file, TVA_FormatCS.file, DVBI_ContentSubject.file]});
		}
	}

	/**
	 * read in the master XML document as text
	 *
	 * @param {string} filename   filename of the master XML document
	 */
	/* public */ loadServiceListRegistry(filename) {
		console.log(`loading SLR from ${filename}`);

		if (isHTTPURL(filename)) {
			fetch(filename)
				.then(handleErrors)
				.then(response => response.text())
				.then(responseText => masterSLEPR=responseText.replace(/(\r\n|\n|\r|\t)/gm,""))
				.catch(error => {console.log(`error (${error}) retrieving ${filename}`); masterSLEPR=EMPTY_SLEPR;}); 
			masterSLEPR=fetch(filename);
		}
		else readFile(filename, {encoding: 'utf-8'}, function(err,data) {
			if (!err) 
				masterSLEPR=data.replace(/(\r\n|\n|\r|\t)/gm,"");
			else 
				console.log(err);
		});	
	}


	/* private */ checkQuery(req) {

		/**
		 * checks the possible values used in the &Delivery query parameter
		 * @param {string} DeliverySystem the query value provided
		 * @returns {Boolean} true if DeliverySystem is valid, otherwise false
		 */
		function isValidDelivery(DeliverySystem) {
			return [DVB_DASH_DELIVERY, DVB_T_DELIVERY, DVB_S_DELIVERY, DVB_C_DELIVERY, 
				DVB_IPTV_DELIVERY, DVB_APPLICATION_DELIVERY].includes(DeliverySystem);
		}
    
		/* function isProvider(provider) {
			return true;
		} */

		req.parseErr=[];

		if (req.query) {

			// check for any erronous arguments
			for (var key in req.query)
				if (!isIn(allowed_arguments, key, false)) 
					req.parseErr.push(`invalid argument [${key}]`);
            
			//regulatorListFlag needs to be a boolean, "true" or "false" only
			if (req.query.regulatorListFlag) {
				if (!(typeof req.query.regulatorListFlag=="string" || req.query.regulatorListFlag instanceof String)) 
					req.parseErr.push(`invalid type for regulatorListFlag [${typeof(req.query.regulatorListFlag)}]`);

				if (!["true","false"].includes(req.query.regulatorListFlag.toLowerCase())) 
					req.parseErr.push(`invalid value for regulatorListFlag [${req.query.regulatorListFlag}]`);
			}

			//TargetCountry(s)
			if (req.query.TargetCountry)
				switch (dataType(req.query.TargetCountry)) {
					case 'string':
						if (!this.knownCountries.isISO3166code(req.query.TargetCountry,false)) 
							req.parseErr.push(`invalid ${dvbi.e_TargetCountry} [${req.query.TargetCountry}]`);				
						break;
					case 'array':
						req.query.TargetCountry.forEach(country => {
							if (!this.knownCountries.isISO3166code(country, false)) 
								req.parseErr.push(`invalid ${dvbi.e_TargetCountry} [${country}]`);
						});
						break;
					default:
						req.parseErr.push(`invalid type [${typeof(req.query.Language)}] for ${dvbi.e_TargetCountry}`);	
						break;
				}

			//Language(s)
			if (req.query.Language) 
				switch (dataType(req.query.Language)) {
					case 'string':
						if (!isTVAAudioLanguageType(req.query.Language, false)) 
							req.parseErr.push(`invalid ${dvbi.e_Language} [${req.query.Language}]`);
						break;
					case 'array':
						req.query.Language.forEach(language => {
							if (!isTVAAudioLanguageType(language, false)) 
								req.parseErr.push(`invalid ${dvbi.e_Language} [${language}]`);
						});
						break;
					default:
						req.parseErr.push(`invalid type [${typeof(req.query.Language)}] for ${dvbi.e_Language}`);
						break;
				}

			//DeliverySystems(s)
			if (req.query.Delivery)
				switch (dataType(req.query.Delivery)) {
					case 'string':
						if (!!isValidDelivery(req.query.Delivery)) 
							req.parseErr.push(`invalid ${dvbi.e_Delivery} system [${req.query.Delivery}]`);	
						break;
					case 'array':
						req.query.Delivery.forEach(delivery => {
							if (!isValidDelivery(delivery)) 
								req.parseErr.push(`ivalid ${dvbi.e_Delivery} system [${delivery}]`);
						});
						break;
					default:
						req.parseErr.push(`invalid type [${typeof(req.query.Delivery)}] for ${dvbi.e_Delivery}`);
						break;
				}


			// Genre(s)
			if (req.query.Genre) 
				switch (dataType(Genre)) {
					case 'string':
						if (!this.knownGenres.isIn(req.query.Genre)) 
							req.parseErr.push(`invalid ${dvbi.e_Genre} [${req.query.Genre}]`);	
						break;
					case 'array':
						req.query.Genre.forEach(genre => {
							if (!this.knownGenres.isIn(genre)) 
								req.parseErr.push(`invalid ${dvbi.e_Genre} [${genre}]`);
						});
						break;
					default:
						req.parseErr.push(`invalid type [${typeof(req.query.Genre)}] for ${dvbi.e_Genre}`);
						break;
				}

/* value space of this argument is not checked 
			//Provider Name(s)
			if (req.query.ProviderName) {
				if (typeof req.query.ProviderName=="string" || req.query.ProviderName instanceof String) {
					if (!isProvider(req.query.ProviderName)) 
						req.parseErr.push(`invalid provider [${req.query.ProviderName}]`);
				}	
				else if (Array.isArray(req.query.ProviderName)) {
					req.query.ProviderName.forEach(provider => {
						if (!isProvider(provider))
							req.parseErr.push(`invalid provider [${provider}]`);
					});
				}
				else 
					req.parseErr.push(`invalid type [${typeof(req.query.ProviderName)}] for provider`);
			}			
*/
		}	
		return req.parseErr.length==0;
	}


	/* public */ processServiceListRequest(req, res) {

		if (!this.checkQuery(req)) {
			if (req.parseErr) 
				res.write(`[${req.parseErr.join(',\n\t')}]`);
			res.status(400);
			return false;
		}
		let slepr=parseXmlString(masterSLEPR);

		let SLEPR_SCHEMA={}, SCHEMA_PREFIX=slepr.root().namespace().prefix();
		SLEPR_SCHEMA[SCHEMA_PREFIX]=slepr.root().namespace().href();

		if (req.query.ProviderName) {
			// if ProviderName is specified, remove any ProviderOffering entries that do not match the name
			let prov, p=0, providerCleanup=[];
			while ((prov=slepr.get('//'+xPath(SCHEMA_PREFIX, dvbi.e_ProviderOffering, ++p), SLEPR_SCHEMA))!=null) {
				let provName, n=0, matchedProvider=false;
				while (!matchedProvider && (provName=prov.get(xPath(SCHEMA_PREFIX, dvbi.e_Provider)+'/'+xPath(SCHEMA_PREFIX, dvbi.e_Name, ++n), SLEPR_SCHEMA))) 
					if (isIn(req.query.ProviderName, provName.text())) 
						matchedProvider=true;
				if (!matchedProvider) 
					providerCleanup.push(prov);
			}
			providerCleanup.forEach(provider => provider.remove());
		}

		if (req.query.regulatorListFlag || req.query.Language || req.query.TargetCountry || req.query.Genre) {
			let prov, p=0, servicesToRemove=[];
			while ((prov=slepr.get('//'+xPath(SCHEMA_PREFIX, dvbi.e_ProviderOffering, ++p), SLEPR_SCHEMA))!=null) {
				let serv, s=0;
				while ((serv=prov.get(xPath(SCHEMA_PREFIX, dvbi.e_ServiceListOffering, ++s), SLEPR_SCHEMA))!=null) {
					let removeService=false;
                
					// remove services that do not match the specified regulator list flag
					if (req.query.regulatorListFlag) {
						// The regulatorListFlag has been specified in the query, so it has to match. Default in instance document is "false"
						let flag=serv.attr(dvbi.a_regulatorListFlag)?serv.attr(dvbi.a_regulatorListFlag).value():"false";
						if (req.query.regulatorListFlag!=flag) 
							removeService=true;
					}

					// remove remaining services that do not match the specified language
					if (!removeService && req.query.Language) {
						let lang, l=0, keepService=false, hasLanguage=false;
						while (!keepService && (lang=serv.get(xPath(SCHEMA_PREFIX, dvbi.e_Language, ++l), SLEPR_SCHEMA))) {
							if (isIn(req.query.Language, lang.text())) keepService=true;
							hasLanguage=true;
						}
						if (hasLanguage && !keepService) removeService=true;
					}

					// remove remaining services that do not match the specified target country
					if (!removeService && req.query.TargetCountry) {
						let targetCountry, c=0, keepService=false, hasCountry=false;
						while (!keepService && (targetCountry=serv.get(xPath(SCHEMA_PREFIX, dvbi.e_TargetCountry, ++c), SLEPR_SCHEMA))) {	
							// note that the <TargetCountry> element can signal multiple values. Its XML pattern is "\c\c\c(,\c\c\c)*"
							let countries=targetCountry.text().split(",");
							/* jslint -W083 */
							countries.forEach(country => {
								if (isIn(req.query.TargetCountry, country)) keepService=true;
							});
							/* jslint +W083 */
							hasCountry=true;
						}
						if (hasCountry && !keepService) removeService=true;
					}

                    // remove remaining services that do not match the specified genre
					if (!removeService && req.query.Genre) {
						let genre, g=0, keepService=false, hasGenre=false;
						while (!keepService && (genre=serv.get(xPath(SCHEMA_PREFIX, dvbi.e_Genre, ++g), SLEPR_SCHEMA))) {			
							if (isIn(req.query.Genre, genre.text())) keepService=true;
							hasGenre=true;
						}
						if (hasGenre && !keepService) removeService=true;
					}

					// remove remaining services that do not have the requested delivery modes
					if (!removeService && req.query.Delivery) {
						let delivery=serv.get(xPath(SCHEMA_PREFIX, dvbi.e_Delivery), SLEPR_SCHEMA);

						if (!delivery)
							removeService=true;
						else {
							// check that there is a 'delivery system' for at least one of those requested
							let keepService=false;

							if ((isIn(req.query.Delivery, DVB_DASH_DELIVERY) && hasChild(delivery, dvbi.e_DASHDelivery)) ||
								(isIn(req.query.Delivery, DVB_T_DELIVERY) && hasChild(delivery, dvbi.e_DVBTDelivery)) ||
								(isIn(req.query.Delivery, DVB_C_DELIVERY) && hasChild(delivery, dvbi.e_DVBCDelivery)) ||
								(isIn(req.query.Delivery, DVB_S_DELIVERY) && hasChild(delivery, dvbi.e_DVBSDelivery)) ||
								(isIn(req.query.Delivery, DVB_IPTV_DELIVERY) && (hasChild(delivery, dvbi.e_RTSPDelivery) || hasChild(delivery, dvbi.e_MulticastTSDelivery))) ||
								(isIn(req.query.Delivery, DVB_APPLICATION_DELIVERY) && hasChild(delivery, dvbi.e_ApplicationDelivery))
							) {
								keepService=true;
							}

							if (!keepService) removeService=true;
						}
					}

					if (removeService) servicesToRemove.push(serv);						
				}
			}
			servicesToRemove.forEach(service => service.remove());
		}
            
		// remove any <ProviderOffering> elements that no longer have any <ServiceListOffering>
		let prov, p=0, providersToRemove=[];
		while ((prov=slepr.get('//'+xPath(SCHEMA_PREFIX, dvbi.e_ProviderOffering, ++p), SLEPR_SCHEMA))!=null) {
			if (!prov.get(xPath(SCHEMA_PREFIX, dvbi.e_ServiceListOffering, 1), SLEPR_SCHEMA)) 
				providersToRemove.push(prov);
		}
		providersToRemove.forEach(provider => provider.remove());

		res.type('text/xml');
		res.send(slepr.toString());

		return true;
	}

}
