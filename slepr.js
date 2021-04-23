/*jshint esversion: 6 */
// SLEPR - Service List End Point Resolver

//const cluster = require('cluster');
//const totalCPUs = require('os').cpus().length;

const fs=require("fs"), path=require("path");

// libxmljs - https://www.npmjs.com/package/libxmljs2
const libxml=require('libxmljs2');

const SLEPR_data=require('./slepr-data.js');
const {xPath, xPathM, isIn}=require("./utils.js");

const ISOcountries=require("./ISOcountries.js");
const dvbi=require("./DVB-I_definitions.js");

const locs=require("./data-locations.js");

var masterSLEPR="";
const EMPTY_SLEPR="<ServiceListEntryPoints xmlns=\"urn:dvb:metadata:servicelistdiscovery:2019\"></ServiceListEntryPoints>";


// permitted query parameters
const allowed_arguments=[dvbi.e_ProviderName, dvbi.a_regulatorListFlag, dvbi.e_Language, dvbi.e_TargetCountry, dvbi.e_Genre];

const patterns=require("./pattern_checks.js");
const IANAlanguages=require('./IANAlanguages.js');

module.exports = class SLEPR {

    constructor(useURLs, preloadedLanguageValidator=null, preloadedCountries=null) {

        if (preloadedLanguageValidator) 
          this.knownLanguages=preloadedLanguageValidator;
        else {
            this.knownLanguages=new IANAlanguages();
            console.log("loading languages...");
            if (useURLs) 
                this.knownLanguages.loadLanguages({url: locs.IANA_Subtag_Registry_URL, purge: true});
            else this.knownLanguages.loadLanguages({file: locs.IANA_Subtag_Registry_Filename, purge: true});
        }

		if (preloadedCountries)
			this.knownCountries=preloadedCountries;
		else {
			this.knownCountries=new ISOcountries(false, true);
			if (useURLs) 
				this.knownCountries.loadCountries({url:locs.ISO3166_URL, purge:true});
			else this.knownCountries.loadCountries({file:locs.ISO3166_Filename, purge:true});
		}
    }  

    /**
     * read in the master XML document as text
     *
     * @param {string} filename   filename of the master XML document
     */
    /* public */ loadServiceListRegistry(filename) {

        console.log(`loading SLR from ${filename}`);

        function handleErrors(response) {
            if (!response.ok) {
                throw Error(response.statusText);
            }
            return response;
        }

        if (patterns.isHTTPURL(filename)) {
            fetch(filename)
                .then(handleErrors)
                .then(response => response.text())
                .then(responseText => masterSLEPR=responseText.replace(/(\r\n|\n|\r|\t)/gm,""))
                .catch(error => {console.log(`error (${error}) retrieving ${filename}`); masterSLEPR=EMPTY_SLEPR;});
        }
        else fs.readFile(filename, {encoding: 'utf-8'}, function(err,data){
            if (!err) {
                masterSLEPR=data.replace(/(\r\n|\n|\r|\t)/gm,"");
            } else
                console.log(err);
        });	
    }

    /* private */ checkQuery(req) {
	
        /*	function isGenre(genre) {
                // DVB-I Genre is defined through classification schemes
                // permitted values through TVA:ContentCS, TVA:FormatCS, DVB-I:ContentSubject 
                return true;
            }
        
            function isProvider(provider) {
                return true;
            } */
            
            if (req.query) {
                
                // check for any erronous arguments
                for (var key in req.query) {
                    if (!isIn(allowed_arguments, key, false)) {
                        req.parseErr=`invalid argument [${key}]`;
                        return false;
                    }
                }
                
                //regulatorListFlag needs to be a boolean, "true" or "false" only
                if (req.query.regulatorListFlag) {
                    if (!(typeof req.query.regulatorListFlag=="string" || req.query.regulatorListFlag instanceof String)) {
                        req.parseErr=`invalid type for regulatorListFlag [${typeof(req.query.regulatorListFlag)}]`;
                        return false;
                    }
                    if (!["true","false"].includes(req.query.regulatorListFlag.toLowerCase())) {
                        req.parseErr=`invalid value for regulatorListFlag [${req.query.regulatorListFlag}]`;
                        return false;				
                    }
                }
                
                //TargetCountry(s)
                if (req.query.TargetCountry) {
                    if (typeof req.query.TargetCountry=="string" || req.query.TargetCountry instanceof String) {
                        if (!this.knownCountries.isISO3166code(req.query.TargetCountry,false)) {
                            req.parseErr=`incorrect country [${req.query.TargetCountry}]`;
                            return false;
                        }					
                    }	
                    else if (Array.isArray(req.query.TargetCountry)) {
                        for (let i=0; i<req.query.TargetCountry.length; i++ ) {
                            if (!this.knownCountries.isISO3166code(req.query.TargetCountry[i], false)) {
                                req.parseErr=`incorrect country [${req.query.TargetCountry[i]}]`;
                                return false;
                            }
                        }
                    }
                    else {
                        req.parseErr=`invalid type [${typeof(req.query.Language)}] for country`;
                        return false;
                    }			
                }
        
                //Language(s)
                if (req.query.Language) {
                    if (typeof req.query.Language=="string" || req.query.Language instanceof String) {
                        if (!patterns.isTVAAudioLanguageType(req.query.Language, false)) {
                            req.parseErr=`incorrect language [${req.query.Language}]`;
                            return false;
                        }					
                    }	
                    else if (Array.isArray(req.query.Language)) {
                        for (let i=0; i<req.query.Language.length; i++ ) {
                            if (!patterns.isTVAAudioLanguageType(req.query.Language[i], false)) {
                                req.parseErr=`incorrect language [${req.query.Language[i]}]`;
                                return false;
                            }
                        }
                    }
                    else {
                        req.parseErr=`invalid type [${typeof(req.query.Language)}] for language`;
                        return false;
                    }
                }
        /* value space of these arguments is not checked
                // Genre(s)
                if (req.query.Genre) {
                    if (typeof req.query.Genre=="string" || req.query.Genre instanceof String){
                        if (!isGenre(req.query.Genre)) {
                            req.parseErr=`invalid genre [${req.query.Genre}]`
                            return false;
                        }					
                    }	
                    else if (Array.isArray(req.query.Genre)) {
                        for (let i=0; i<req.query.Genre.length; i++ ) {
                            if (!isGenre(req.query.Genre[i])) {
                                req.parseErr=`invalid genre [${req.query.Genre[i]}]`
                                return false;
                            }
                        }
                    }
                    else {
                        req.parseErr=`invalid type [${typeof(req.query.Genre)}] for genre`
                        return false
                    }
                }		
                //Provider Name(s)
                if (req.query.ProviderName) {
                    if (typeof req.query.ProviderName=="string" || req.query.ProviderName instanceof String){
                        if (!isProvider(req.query.ProviderName)) {
                            return false;
                        }					
                    }	
                    else if (Array.isArray(req.query.ProviderName)) {
                        for (let i=0; i<req.query.ProviderName.length; i++ ) {
                            if (!isProvider(req.query.ProviderName[i])) {
                                return false;
                            }
                        }
                    }
                }			
        */
            }	
            return true;
        }
        

    /* public */ processServiceListRequest(req, res) {

		if (!this.checkQuery(req)) {
			res.status(400);
		}
		else {
			let slepr=libxml.parseXmlString(masterSLEPR);
	
			let SLEPR_SCHEMA={}, SCHEMA_PREFIX=slepr.root().namespace().prefix();
			SLEPR_SCHEMA[SCHEMA_PREFIX]=slepr.root().namespace().href();

			if (req.query.ProviderName) {
				// if ProviderName is specified, remove any ProviderOffering entries that do not match the name
				let prov, p=0, providerCleanup=[];
				while ((prov=slepr.get('//'+xPath(SCHEMA_PREFIX, dvbi.e_ProviderOffering, ++p), SLEPR_SCHEMA))!=null) {
					let provName, n=0, matchedProvider=false;
					while ((provName=prov.get(xPath(SCHEMA_PREFIX, dvbi.e_Provider)+'/'+xPath(SCHEMA_PREFIX, dvbi.e_Name, ++n), SLEPR_SCHEMA)) && !matchedProvider) {
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
							if (req.query.regulatorListFlag!=flag ) 
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
		}
		res.end();
    }
};