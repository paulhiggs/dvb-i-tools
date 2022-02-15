import fetch from 'node-fetch';
import { handleErrors } from "./fetch-err-handler.js";

import { readFile } from "fs";

import { isHTTPURL } from "./pattern_checks.js";

/**
 * load the countries list into the allowedCountries global array from the specified text
 *
 * @param {String} countryData the text of the country JSON data
 * @returns {object} processed JSON object of countries
 */
function loadCountryData(countryData) {

	return JSON.parse(countryData, function (key, value) {
		if (key == "numeric") {
			return Number(value);
		} else if (key == "alpha2") {
			if (value.length!=2) return "**"; else return value;
		} else if (key == "alpha3") {
			if (value.length!=3) return "***"; else return value;
		}
		else {
			return value;
		}
	});
}


export default class ISOcountries {
	
	/**
	 * constructor
	 *
	 * @param {boolean} use2 allow the 2 digit country codes to be searched
	 * @param {boolean} use3 allow the 3 digit country codes to be searched
	 */
	constructor(use2=true, use3=false) {
		loadCountryData.bind(this);
		this.countriesList=[];
		this.use2CharCountries=use2;
		this.use3CharCountries=use3;
	}
	
	/**
	 * load the countries list into the allowedCountries global array from the specified JSON file
	 *
	 * @param {String} countriesFile the file name to load
	 * @param {boolean} purge  erase the existing values before loading new
	 */
	loadCountriesFromFile(countriesFile, purge=false) {
		console.log(`reading countries from ${countriesFile}`);
		if (purge) this.reset();
		readFile(countriesFile, {encoding: "utf-8"}, function(err,data) {
			if (!err) {
				this.countriesList=loadCountryData(data);
			} else {
				console.log(err);
			}
		}.bind(this));
	}
	
	/**
	 * load the countries list into the allowedCountries global array from the specified JSON file
	 *
	 * @param {String} countriesURL the URL to the file to load
	 * @param {boolean} purge  erase the existing values before loading new
	 */
	loadCountriesFromURL(countriesURL, purge=false) {
		let isHTTPurl=isHTTPURL(countriesURL);
		console.log(`${isHTTPurl?"":"--> NOT "}retrieving countries from ${countriesURL} using fetch()`);
		if (!isHTTPurl) return;

		if (purge) this.reset();
		fetch(countriesURL)
			.then(handleErrors)
			.then(response => response.text())
			.then(responseText => this.countriesList=loadCountryData(responseText))
			.catch(error => console.log(`error (${error}) retrieving ${countriesURL}`));
	}

	loadCountries(options) {
		if (!options) options={};
		if (!options.purge) options.purge=true;

		if (options.file)
			this.loadCountriesFromFile(options.file, options.purge);
		else if (options.url)
			this.loadCountriesFromURL(options.url, options.purge);
	}

	reset() {
		this.countriesList.length=0;
	}
	
	count() {
		return this.countriesList.length;
	}
	
	/**
	 * determine if the argument contains a valid ISO 3166 country code
	 *
	 * @param {String} countryCode the country code to be checked for validity
	 * @param {Boolean} caseSensitive ignofe case
	 * @return {boolean} true if countryCode is known else false
	 */
	isISO3166code(countryCode, caseSensitive=true) {
		let found=false, countryCode_lc=countryCode.toLowerCase();
		
		if (this.use3CharCountries && countryCode.length==3) {
			if (caseSensitive?this.countriesList.find(elem => elem.alpha3==countryCode):this.countriesList.find(elem => elem.alpha3.toLowerCase()==countryCode_lc))
				found=true;
		}
		else if (this.use2CharCountries && countryCode.length==2) {
			if (caseSensitive?this.countriesList.find(elem => elem.alpha2==countryCode):this.countriesList.find(elem => elem.alpha2.toLowerCase()==countryCode_lc))
				found=true;
		}
		return found;
	}
}