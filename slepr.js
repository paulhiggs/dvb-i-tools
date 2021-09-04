/* jshint esversion: 8 */
// SLEPR - Service List End Point Resolver

const fs=require("fs");

// libxmljs - https://www.npmjs.com/package/libxmljs2
const libxml=require('libxmljs2');

// Fetch() API for node.js- https://www.npmjs.com/package/node-fetch
const fetch=require('node-fetch');
const fetcherr=require("./fetch-err-handler.js");

const {xPath, isIn}=require("./utils.js");

const dvbi=require("./DVB-I_definitions.js");

const locs=require("./data-locations.js");

var masterSLEPR="";
const EMPTY_SLEPR="<ServiceListEntryPoints xmlns=\"urn:dvb:metadata:servicelistdiscovery:2021\"></ServiceListEntryPoints>";


// permitted query parameters
const allowed_arguments=[dvbi.e_ProviderName, dvbi.a_regulatorListFlag, dvbi.e_Language, dvbi.e_TargetCountry, dvbi.e_Genre, dvbi.e_Delivery];

const patterns=require("./pattern_checks.js");

const IANAlanguages=require('./IANAlanguages.js');
const ClassificationScheme=require("./ClassificationScheme.js");
const ISOcountries=require("./ISOcountries.js");

const DVB_DASH_DELIVERY="dvb-dash",
      DVB_T_DELIVERY="dvb-t",
      DVB_S_DELIVERY="dvb-s", 
      DVB_C_DELIVERY="dvb-c",
      DVB_IPTV_DELIVERY="dvb-iptv",
      DVB_APPLICATION_DELIVERY="application";

class SLEPR {

    constructor(useURLs, preloadedLanguageValidator=null, preloadedCountries=null, preloadedGenres=null) {
        this.loadDataFiles(useURLs, preloadedLanguageValidator, preloadedCountries, preloadedGenres);
    }  

    /* public */ loadDataFiles(useURLs, preloadedLanguageValidator=null, preloadedCountries=null, preloadedGenres=null) {
        if (preloadedLanguageValidator) 
          this.knownLanguages=preloadedLanguageValidator;
        else {
            this.knownLanguages=new IANAlanguages();
            this.knownLanguages.loadLanguages(useURLs?{url: locs.IANA_Subtag_Registry.url, purge: true}:{file: locs.IANA_Subtag_Registry.file, purge: true});
        }

		if (preloadedCountries)
			this.knownCountries=preloadedCountries;
		else {
			this.knownCountries=new ISOcountries(false, true);
            this.knownCountries.loadCountries(useURLs?{url:locs.ISO3166.url}:{file:locs.ISO3166.file});
		}

        if (preloadedGenres)
            this.knownGenres=preloadedGenres;
        else {
			this.knownGenres=new ClassificationScheme();
            this.knownGenres.loadCS(useURLs?
                {urls:[locs.TVA_ContentCS.url, locs.TVA_FormatCS.url, locs.DVBI_ContentSubject.url]}:
                {files:[locs.TVA_ContentCS.file, locs.TVA_FormatCS.file, locs.DVBI_ContentSubject.file]});
        }
    }

    /**
     * read in the master XML document as text
     *
     * @param {string} filename   filename of the master XML document
     */
    /* public */ loadServiceListRegistry(filename) {
        console.log(`loading SLR from ${filename}`);

        if (patterns.isHTTPURL(filename)) {
            fetch(filename)
                .then(fetcherr.handleErrors)
                .then(response => response.text())
                .then(responseText => masterSLEPR=responseText.replace(/(\r\n|\n|\r|\t)/gm,""))
                .catch(error => {console.log(`error (${error}) retrieving ${filename}`); masterSLEPR=EMPTY_SLEPR;}); 
            masterSLEPR=fetch(filename);
        }
        else fs.readFile(filename, {encoding: 'utf-8'}, function(err,data) {
            if (!err) 
                masterSLEPR=data.replace(/(\r\n|\n|\r|\t)/gm,"");
             else 
                console.log(err);
        });	
    }

    /**
     * check if the element contains the named child element
     *
     * @param {Object} elem the element to check
     * @param {string} childElementName the name of the child element to look for
     * @returns {boolean} true of the element contains the named child element(s) otherwise false
     */
    hasChild(elem, childElementName) { 
        if (elem)
            return elem.childNodes().find(el => el.type()=='element' && el.name()==childElementName) != undefined;
        return false;
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
            for (var key in req.query) {
                if (!isIn(allowed_arguments, key, false)) 
                    req.parseErr.push(`invalid argument [${key}]`);
            }
            
            //regulatorListFlag needs to be a boolean, "true" or "false" only
            if (req.query.regulatorListFlag) {
                if (!(typeof req.query.regulatorListFlag=="string" || req.query.regulatorListFlag instanceof String)) 
                    req.parseErr.push(`invalid type for regulatorListFlag [${typeof(req.query.regulatorListFlag)}]`);

                if (!["true","false"].includes(req.query.regulatorListFlag.toLowerCase())) 
                    req.parseErr.push(`invalid value for regulatorListFlag [${req.query.regulatorListFlag}]`);
            }
            
            //TargetCountry(s)
            if (req.query.TargetCountry) {
                if (typeof req.query.TargetCountry=="string" || req.query.TargetCountry instanceof String) {
                    if (!this.knownCountries.isISO3166code(req.query.TargetCountry,false)) 
                        req.parseErr.push(`invalid TargetCountry [${req.query.TargetCountry}]`);				
                }	
                else if (Array.isArray(req.query.TargetCountry)) {
                    for (let i=0; i<req.query.TargetCountry.length; i++ ) 
                        if (!this.knownCountries.isISO3166code(req.query.TargetCountry[i], false)) 
                            req.parseErr.push(`invalid TargetCountry [${req.query.TargetCountry[i]}]`);
                }
                else
                    req.parseErr.push(`invalid type [${typeof(req.query.Language)}] for TargetCountry`);	
            }
    
            //Language(s)
            if (req.query.Language) {
                if (typeof req.query.Language=="string" || req.query.Language instanceof String) {
                    if (!patterns.isTVAAudioLanguageType(req.query.Language, false)) 
                        req.parseErr.push(`invalid Language [${req.query.Language}]`);			
                }	
                else if (Array.isArray(req.query.Language)) {
                    for (let i=0; i<req.query.Language.length; i++ ) 
                        if (!patterns.isTVAAudioLanguageType(req.query.Language[i], false)) 
                            req.parseErr.push(`invalid Language [${req.query.Language[i]}]`);
                }
                else
                    req.parseErr.push(`invalid type [${typeof(req.query.Language)}] for Language`);
            }

            //DeliverySystems(s)
            if (req.query.Delivery) {
                if (typeof req.query.Delivery=="string" || req.query.Delivery instanceof String) {
                    if (!!isValidDelivery(req.query.Delivery)) 
                        req.parseErr.push(`invalid Delivery system [${req.query.Delivery}]`);			
                }	
                else if (Array.isArray(req.query.Delivery)) {
                    for (let i=0; i<req.query.Delivery.length; i++ ) 
                        if (!isValidDelivery(req.query.Delivery[i])) 
                            req.parseErr.push(`ivalid Delivery system [${req.query.Delivery[i]}]`);
                }
                else 
                    req.parseErr.push(`invalid type [${typeof(req.query.Delivery)}] for Delivery`);
            }	

            // Genre(s)
            if (req.query.Genre) {
                if (typeof req.query.Genre=="string" || req.query.Genre instanceof String) {
                    if (!this.knownGenres.isIn(req.query.Genre)) 
                        req.parseErr.push(`invalid Genre [${req.query.Genre}]`);			
                }	
                else if (Array.isArray(req.query.Genre)) {
                    for (let i=0; i<req.query.Genre.length; i++ ) 
                        if (!this.knownGenres.isIn(req.query.Genre[i])) 
                            req.parseErr.push(`invalid Genre [${req.query.Genre[i]}]`);
                }
                else 
                    req.parseErr.push(`invalid type [${typeof(req.query.Genre)}] for Genre`);

            }		
/* value space of these arguments is not checked
            //Provider Name(s)
            if (req.query.ProviderName) {
                if (typeof req.query.ProviderName=="string" || req.query.ProviderName instanceof String) {
                    if (!isProvider(req.query.ProviderName)) 
                        req.parseErr.push(`invalid provider [${req.query.ProviderName}]`);
                }	
                else if (Array.isArray(req.query.ProviderName)) {
                    for (let i=0; i<req.query.ProviderName.length; i++ )
                        if (!isProvider(req.query.ProviderName[i]))
                            req.parseErr.push(`invalid provider [${req.query.ProviderName[i]}]`);
                }
                else 
                    req.parseErr.push(`invalid type [${typeof(req.query.ProviderName)}] for provider`);
            }			
*/
        }	
        return req.parseErr.length==0;
    }


    /* public */ processServiceListRequest(req, res) {

        function prettyPrintArray(arr) {
            let _first=true, resstr="[";
            arr.forEach(entry => {
                if (!_first) resstr+=",";
                resstr+=`\n\t"${entry}"`;
                _first=false;
            });
            resstr+=`${_first?"":"\n"}]`;
            return resstr;
        }

 		if (!this.checkQuery(req)) {
            if (req.parseErr) 
                res.write(prettyPrintArray(req.parseErr));
			res.status(400);
            return false;
		}
        let slepr=libxml.parseXmlString(masterSLEPR);

        let SLEPR_SCHEMA={}, SCHEMA_PREFIX=slepr.root().namespace().prefix();
        SLEPR_SCHEMA[SCHEMA_PREFIX]=slepr.root().namespace().href();

        if (req.query.ProviderName) {
            // if ProviderName is specified, remove any ProviderOffering entries that do not match the name
            let prov, p=0, providerCleanup=[];
            while ((prov=slepr.get('//'+xPath(SCHEMA_PREFIX, dvbi.e_ProviderOffering, ++p), SLEPR_SCHEMA))!=null) {
                let provName, n=0, matchedProvider=false;
                while (!matchedProvider && (provName=prov.get(xPath(SCHEMA_PREFIX, dvbi.e_Provider)+'/'+xPath(SCHEMA_PREFIX, dvbi.e_Name, ++n), SLEPR_SCHEMA))) {
                    if (isIn(req.query.ProviderName, provName.text())) 
                        matchedProvider=true;					
                }
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

module.exports = SLEPR;

