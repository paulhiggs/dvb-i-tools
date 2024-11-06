/**
 * ISO_countries.js
 *
 * Load and check country codes
 */
import { readFile, readFileSync } from "fs";

import chalk from "chalk";
import fetchS from "sync-fetch";

import handleErrors from "./fetch_err_handler.js";
import { isHTTPURL } from "./pattern_checks.js";

/**
 * load the countries list into the allowedCountries global array from the specified text
 *
 * @param {String} countryData the text of the country JSON data
 * @returns {object} processed JSON object of countries
 */
function loadCountryData(countryData) {
	return JSON.parse(countryData, function (key, value) {
		if (key == "numeric") return Number(value);
		else if (key == "alpha2") {
			if (value.length != 2) return "**";
			else return value;
		} else if (key == "alpha3") {
			if (value.length != 3) return "***";
			else return value;
		} else return value;
	});
}

export default class ISOcountries {
	#countriesList;
	#use2CharCountries;
	#use3CharCountries;

	/**
	 * constructor
	 *
	 * @param {boolean} use2 allow the 2 digit country codes to be searched
	 * @param {boolean} use3 allow the 3 digit country codes to be searched
	 */
	constructor(use2 = true, use3 = false) {
		loadCountryData.bind(this);
		this.#countriesList = [];
		this.#use2CharCountries = use2;
		this.#use3CharCountries = use3;
	}

	/**
	 * load the countries list into the allowedCountries global array from the specified JSON file
	 *
	 * @param {String}  countriesFile   the file name to load
	 * @param {boolean} purge           erase the existing values before loading new
	 */
	#loadCountriesFromFile(countriesFile, purge = false, async = true) {
		console.log(chalk.yellow(`reading countries from ${countriesFile}`));
		if (purge) this.reset();
		if (async)
			readFile(
				countriesFile,
				{ encoding: "utf-8" },
				function (err, data) {
					if (!err) this.#countriesList = loadCountryData(data);
					else console.log(chalk.red(err.error));
				}.bind(this)
			);
		else {
			let langs = readFileSync(countriesFile, { encoding: "utf-8" }).toString();
			this.#countriesList = loadCountryData(langs);
		}
	}

	/**
	 * load the countries list into the allowedCountries global array from the specified JSON file
	 *
	 * @param {String}  countriesURL  the URL to the file to load
	 * @param {boolean} purge         erase the existing values before loading new
	 */
	#loadCountriesFromURL(countriesURL, purge = false, async = true) {
		let isHTTPurl = isHTTPURL(countriesURL);
		console.log(chalk.yellow(`${isHTTPurl ? "" : "--> NOT "}retrieving countries from ${countriesURL} using fetch()`));
		if (!isHTTPurl) return;

		if (purge) this.reset();
		if (async)
			fetch(countriesURL)
				.then(handleErrors)
				.then((response) => response.text())
				.then((responseText) => (this.#countriesList = loadCountryData(responseText)))
				.catch((error) => console.log(chalk.red(`error (${error}) retrieving ${countriesURL}`)));
		else {
			let resp = null;
			try {
				resp = fetchS(countriesURL);
			} catch (error) {
				console.log(chalk.red(error.message));
			}
			if (resp) {
				if (resp.ok) this.#countriesList = loadCountryData(response.text);
				else console.log(chalk.red(`error (${error}) retrieving ${languagesURL}`));
			}
		}
	}

	loadCountries(options, async = true) {
		if (!options) options = {};
		if (!options.purge) options.purge = true;

		if (options.file) this.#loadCountriesFromFile(options.file, options.purge, async);
		else if (options.url) this.#loadCountriesFromURL(options.url, options.purge, async);
	}

	reset() {
		this.#countriesList.length = 0;
	}

	count() {
		return this.#countriesList.length;
	}

	/**
	 * determine if the argument contains a valid ISO 3166 country code
	 *
	 * @param {String}  countryCode     the country code to be checked for validity
	 * @param {Boolean} caseSensitive   ignore case
	 * @return {boolean} true if countryCode is known else false
	 */
	isISO3166code(countryCode, caseSensitive = true) {
		let found = false;
		const countryCode_lc = countryCode.toLowerCase();

		if (this.#use3CharCountries && countryCode.length == 3) {
			if (caseSensitive ? this.#countriesList.find((elem) => elem.alpha3 == countryCode) : this.#countriesList.find((elem) => elem.alpha3.toLowerCase() == countryCode_lc))
				found = true;
		} else if (this.#use2CharCountries && countryCode.length == 2) {
			if (caseSensitive ? this.#countriesList.find((elem) => elem.alpha2 == countryCode) : this.#countriesList.find((elem) => elem.alpha2.toLowerCase() == countryCode_lc))
				found = true;
		}
		return found;
	}
}
