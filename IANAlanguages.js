import { handleErrors } from "./fetch-err-handler.js";

import { readFile } from "fs";

import { isIn, isIni } from "./utils.js";
import { isHTTPURL } from "./pattern_checks.js";
import { datatypeIs } from "./phlib/phlib.js";

export default class IANAlanguages {
	constructor() {
		this.languageUnknown = 0;
		this.languageKnown = 1;
		this.languageRedundant = 2;
		this.languageNotSpecified = 3;
		this.languageInvalidType = 4;
		this.languageFileDate = null;
		this.empty();
	}

	empty() {
		this.languagesList = [];
		this.redundantLanguagesList = [];
		this.languageRanges = [];
		this.signLanguagesList = [];
	}

	stats(res) {
		res.numLanguages = this.languagesList.length;
		res.numRedundantLanguages = this.redundantLanguagesList.length;
		res.numLanguageRanges = this.languageRanges.length;
		res.numSignLanguages = this.signLanguagesList.length;
		if (this.languageFileDate) res.languageFileDate = this.languageFileDate;
	}

	/**
	 * load the languages into knownLanguages global array from the specified text
	 * file is formatted according to www.iana.org/assignments/language-subtag-registry/language-subtag-registry
	 *
	 * @param {String} languagesData the text of the language data
	 */
	/* private function */
	processLanguageData(languageData) {
		/**
		 * determines if provided language information relates to a sign language
		 *
		 * @param {Array} items the language subtag
		 * @return {boolean} true if the language subtag is a sign language
		 */
		function isSignLanguage(items) {
			let isSign = false;
			for (let i = 0; i < items.length; i++) if (items[i].startsWith("Description") && items[i].toLowerCase().includes("sign")) isSign = true;

			return isSign;
		}

		let entries = languageData.split("%%");
		entries.forEach((entry) => {
			let items = entry.replace(/(\r|\t)/gm, "").split("\n");

			if (items[0].startsWith("File-Date")) {
				let tl = items[0].split(":");
				this.languageFileDate = tl[1];
			}
			if (isIn(items, "Type: language") || isIn(items, "Type: extlang"))
				for (let i = 0; i < items.length; i++)
					if (items[i].startsWith("Subtag:")) {
						let subtag = items[i].split(":")[1].trim();
						if (isIn(items, "Scope: private-use")) {
							if (subtag.indexOf("..") < 0) this.languagesList.push(subtag);
							else {
								let range = subtag.split("..");
								if (range[0].length == range[1].length) {
									if (range[0] < range[1]) this.languageRanges.push({ start: range[0], end: range[1] });
									else this.languageRanges.push({ start: range[1], end: range[0] });
								}
							}
						} else {
							this.languagesList.push(subtag);
							if (isSignLanguage(items)) this.signLanguagesList.push(subtag);
						}
					}
			if (isIn(items, "Type: variant")) {
				let subtag = null;
				for (let i = 0; i < items.length; i++) if (items[i].startsWith("Subtag:")) subtag = items[i].split(":")[1].trim();
				if (subtag) for (let i = 0; i < items.length; i++) if (items[i].startsWith("Prefix:")) this.languagesList.push(`${items[i].split(":")[1].trim()}-${subtag}`);
			}
			if (isIn(items, "Type: redundant")) {
				let redund = {};
				for (let i = 0; i < items.length; i++) {
					if (items[i].startsWith("Tag:")) redund.tag = items[i].split(":")[1].trim();
					else if (items[i].startsWith("Preferred-Value:")) redund.preferred = items[i].split(":")[1].trim();
				}
				if (redund.tag && redund.preferred) this.redundantLanguagesList.push(redund);
			}
		});
	}

	/**
	 * load the languages list into the knownLanguages global array from the specified file
	 * file is formatted according to www.iana.org/assignments/language-subtag-registry/language-subtag-registry
	 *
	 * @param {String}  languagesFile   the file name to load
	 * @param {boolean} purge           erase the existing values before loading new
	 */
	loadLanguagesFromFile(languagesFile, purge = false) {
		console.log(`reading languages from ${languagesFile}`.yellow);
		if (purge) this.empty();

		readFile(
			languagesFile,
			{ encoding: "utf-8" },
			function (err, data) {
				if (!err) {
					this.processLanguageData(data);
				} else console.log(`error loading languages ${err}`.red);
			}.bind(this)
		);
	}

	/**
	 * load the languages list into the knownLanguages global array from the specified URL
	 *
	 * @param {String}  languagesURL   the URL to load
	 * @param {boolean} purge          erase the existing values before loading new
	 */
	loadLanguagesFromURL(languagesURL, purge = false) {
		let isHTTPurl = isHTTPURL(languagesURL);
		console.log(`${isHTTPurl ? "" : "--> NOT "}retrieving languages from ${languagesURL} using fetch()`.yellow);
		if (!isHTTPurl) return;

		if (purge) this.empty();
		fetch(languagesURL)
			.then(handleErrors)
			.then((response) => response.text())
			.then((responseText) => this.processLanguageData(responseText))
			.catch((error) => console.log(`error (${error}) retrieving ${languagesURL}`.red));
	}

	loadLanguages(options) {
		if (!options) options = {};
		if (!Object.prototype.hasOwnProperty.call(options, "purge")) options.purge = false;

		if (options.file) this.loadLanguagesFromFile(options.file, options.purge);
		else if (options.url) this.loadLanguagesFromURL(options.url, options.purge);
	}

	/**
	 * determines if a language is known
	 *
	 * @param {String} value The value to check for existance
	 * @return {integer} indicating the "known" state of the language
	 */
	isKnown(value) {
		if (value === null || value === undefined) return { resp: this.languageNotSpecified };

		if (datatypeIs(value, "string")) {
			if (this.languageRanges.find((range) => range.start <= value && value <= range.end)) return { resp: this.languageKnown };

			if (isIni(this.languagesList, value)) return { resp: this.languageKnown };

			let lc = value.toLowerCase();
			let found = this.redundantLanguagesList.find((e) => e.tag.toLowerCase() == lc);
			if (found) return { resp: this.languageRedundant, pref: found.preferred };

			return { resp: this.languageUnknown };
		}
		return { resp: this.languageInvalidType };
	}

	/**
	 * determines if a signing language is known
	 *
	 * @param {String} value The value to check for existance in the list of known signing languages
	 * @return {integer} indicating the "known" state of the language
	 */
	/* private function */
	checkSignLanguage(language) {
		if (this.signLanguagesList.find((lang) => lang.toLowerCase() == language)) return this.languageKnown;

		return this.languageUnknown;
	}

	isKnownSignLanguage(value) {
		let lcValue = value.toLowerCase();
		let res = this.checkSignLanguage(lcValue);

		if (res == this.languageUnknown) res = this.checkSignLanguage("sgn-" + lcValue);

		return res;
	}
}
