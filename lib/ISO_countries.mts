/**
 * ISO_countries.mts
 *
 * Load and check country codes
 */
import { readFile, readFileSync } from "fs";

import chalk from "chalk";
import syncFetch from "sync-fetch";

import handleErrors from "./fetch_err_handler.mts";
import { isHTTPURL } from "./pattern_checks.mts";

/**
 * load the countries list into the allowedCountries global array from the specified text
 *
 * @param {String} countryData the text of the country JSON data
 * @returns {Object} processed JSON object of countries
 */
function loadCountryData(countryData : string) {
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

type country_code = {
	numeric? : number;
	alpha2? : string;
	alpha3? : string;
}

export default class ISOcountries {
	#countriesList : Array<country_code>;
	#use2CharCountries : boolean;
	#use3CharCountries : boolean;

	/**
	 * constructor
	 *
	 * @param {boolean} use2 allow the 2 digit country codes to be searched
	 * @param {boolean} use3 allow the 3 digit country codes to be searched
	 */
	constructor(use2 : boolean = true, use3 : boolean = false) {
		loadCountryData.bind(this);
		this.#countriesList = [];
		this.#use2CharCountries = use2;
		this.#use3CharCountries = use3;
	}

	/**
	 * load the countries list into the allowedCountries global array from the specified JSON file
	 *
	 * @param {string} countriesFile  the file name to load
	 * @param {boolean} purge         erase the existing values before loading new
	 * @param {boolean} async
	 */
	#loadCountriesFromFile(countriesFile : string, purge : boolean = false, async : boolean = true) {
		console.log(chalk.yellow(`reading countries from ${countriesFile}`));
		if (purge) this.reset();
		if (async)
			readFile(
				countriesFile,
				{ encoding: "utf-8" },
				function (err: NodeJS.ErrnoException | null, data: string) {
					if (!err) this.#countriesList = loadCountryData(data);
					else console.log(chalk.red(err.message));
				}.bind(this)
			);
		else {
			const langs = readFileSync(countriesFile, { encoding: "utf-8" }).toString();
			this.#countriesList = loadCountryData(langs);
		}
	}

	/**
	 * load the countries list into the allowedCountries global array from the specified JSON file
	 *
	 * @param {string} countriesURL  the URL to the file to load
	 * @param {boolean} purge        erase the existing values before loading new
	 * @param {boolean} async
	 */
	#loadCountriesFromURL(countriesURL : string, purge : boolean = false, async : boolean = true) {
		const isHTTPurl = isHTTPURL(countriesURL);
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
				resp = syncFetch(countriesURL);
			} catch (error) {
				console.log(chalk.red(error.message));
			}
			if (resp) {
				if (resp.ok) this.#countriesList = loadCountryData(resp.text);
				else console.log(chalk.red(`error (${resp.error()}) retrieving ${countriesURL}`));
			}
		}
	}

	loadCountries(options : any, async : boolean = true) {
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
	 * @param {string}  countryCode     the country code to be checked for validity
	 * @param {boolean} caseSensitive   ignore case
	 * @return {boolean} true if countryCode is known else false
	 */
	isISO3166code(countryCode : string, caseSensitive : boolean = true) : boolean {
		let found = false;
		const countryCode_lc = countryCode.toLowerCase();

		if (this.#use3CharCountries && countryCode.length == 3) {
			if (caseSensitive ? this.#countriesList.find((elem) => elem.alpha3 == countryCode) : this.#countriesList.find((elem) => elem.alpha3?.toLowerCase() == countryCode_lc))
				found = true;
		} else if (this.#use2CharCountries && countryCode.length == 2) {
			if (caseSensitive ? this.#countriesList.find((elem) => elem.alpha2 == countryCode) : this.#countriesList.find((elem) => elem.alpha2?.toLowerCase() == countryCode_lc))
				found = true;
		}
		return found;
	}
}
