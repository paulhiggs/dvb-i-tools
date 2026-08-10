/**
 * IANA_languages.mjs
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Load and check language identifiers
 */

import { readFile, readFileSync } from "fs";

import chalk from "chalk";
import fetchS from "sync-fetch";

import { fetch_options } from "./globals.mjs";

import { datatypeIs } from "./utils.mjs";

import { tva } from "./TVA_definitions.mjs";
import handleErrors from "./fetch_err_handler.mjs";
import { isIn, isIni } from "./utils.mjs";
import { isHTTPURL, BCP47_Language_Tag } from "./pattern_checks.mjs";

export default class IANAlanguages {
	#languagesList;
	#redundantLanguagesList;
	#languageRanges;
	#signLanguagesList;
	#regionsList;
	#languageFileDate;

	constructor() {
		this.languageUnknown = 0;
		this.languageKnown = 1;
		this.languageRedundant = 2;
		this.languageNotSpecified = 3;
		this.languageInvalidType = 4;
		this.#languageFileDate = null;
		this.empty();
	}

	empty() {
		this.#languagesList = new Set;
		this.#redundantLanguagesList = [];
		this.#languageRanges = [];
		this.#signLanguagesList = new Set();
		this.#regionsList = new Set();				// we parse regions from the source location but dont use them in DVB-I validation
		this.#languageFileDate = null;
	}

	count() {
		return `lang=${this.#languagesList.size},sign=${this.#signLanguagesList.size},redun=${this.#redundantLanguagesList.length}`;
	}

	stats(res) {
		res.numLanguages = this.#languagesList.size;
		res.numRedundantLanguages = this.#redundantLanguagesList.length;
		const t = [];
		this.#redundantLanguagesList.forEach((lang) => t.push(`${lang.tag}${lang.preferred ? `~${lang.preferred}` : ""}`));
		res.RedundantLanguages = t.join(", ");
		res.numLanguageRanges = this.#languageRanges.length;
		res.numSignLanguages = this.#signLanguagesList.size;
		res.numRegions = this.#regionsList.size;
		if (this.#languageFileDate) res.languageFileDate = this.#languageFileDate;
	}


	loadedLanguages(sort) {
		let res = {};

		if (this.#languagesList.size) {
			res.languages = Array.from(this.#languagesList);
			if (sort) res.languages.sort();
		}

		if (this.#redundantLanguagesList.length) {
			res.redundant = this.#redundantLanguagesList.map((r) => `${r.tag}${r.preferred ? ` &rarr; ${r.preferred}` : ""}`)
			if (sort) res.redundant.sort();
		}

		if (this.#signLanguagesList.size) {
			res.sign = Array.from(this.#signLanguagesList);
			if (sort) res.sign.sort();
		}

		if (this.#languageRanges.length) {
			res.ranges = this.#languageRanges.map((r) => `${r.start}-${r.end}`);
			if (sort) res.ranges.sort();
		}

		if (this.#regionsList.size) {
			res.regions = Array.from(this.#regionsList);
			if (sort) res.regions.sort();
		}

		return res;
	}

	/**
	 * load the languages into knownLanguages global array from the specified text
	 * file is formatted according to www.iana.org/assignments/language-subtag-registry/language-subtag-registry
	 *
	 * @param {String} languagesData the text of the language data
	 */
	/* private method */
	#processLanguageData(languageData) {
		/**
		 * determines if provided language information relates to a sign language
		 *
		 * @param {Array} items the language subtag
		 * @return {boolean} true if the language subtag is a sign language
		 */
		function isSignLanguage(items) {
			for (let i = 0; i < items.length; i++) if (items[i].startsWith("Description") && items[i].toLowerCase().includes("sign")) return true;
			return false;
		}

		const entries = languageData.split("%%");
		entries.forEach((entry) => {
			const items = entry.replace(/(\r|\t)/gm, "").split("\n");

			if (items[0].startsWith("File-Date")) {
				const tl = items[0].split(":");
				this.#languageFileDate = tl[1];
			}
			if (isIn(items, "Type: language") || isIn(items, "Type: extlang")) {
				for (let i = 0; i < items.length; i++)
					if (items[i].startsWith("Subtag:")) {
						const subtag = items[i].split(":")[1].trim();
						if (isIn(items, "Scope: private-use")) {
							if (subtag.indexOf("..") < 0) this.#languagesList.add(subtag);
							else {
								const range = subtag.split("..");
								if (range[0].length == range[1].length) {
									if (range[0] < range[1]) this.#languageRanges.push({ start: range[0], end: range[1] });
									else this.#languageRanges.push({ start: range[1], end: range[0] });
								}
							}
						} else {
							this.#languagesList.add(subtag);
							if (isSignLanguage(items)) this.#signLanguagesList.add(subtag.toLowerCase());
						}
					}
			} else if (isIn(items, "Type: variant")) {
				let subtag = null;
				items.forEach((item) => { if (item.startsWith("Subtag:")) subtag = item.split(":")[1].trim() });
				if (subtag) {
					for (let i = 0; i < items.length; i++)
					items.forEach((item) => {
						if (item.startsWith("Prefix:")) {
							this.#languagesList.add(item.split(":")[1].trim()); // prefix on its own is allowed
							this.#languagesList.add(`${item.split(":")[1].trim()}-${subtag}`); // prefix-suffix is allowed
						}
					});
				}
			} else if (isIn(items, "Type: redundant")) {
				const redund = {};
				items.forEach((item) => {
					if (item.startsWith("Tag:")) redund.tag = item.split(":")[1].trim();
					else if (item.startsWith("Preferred-Value:")) redund.preferred = item.split(":")[1].trim();
				});
				if (redund.tag) this.#redundantLanguagesList.push(redund);
			} else if (isIn(items, "Type: region")) {
				items.forEach((item) => { if (item.startsWith("Subtag:")) this.#regionsList.add(item.split(":")[1].trim()) });
			}
		});
	}

	/**
	 * load the languages list into the knownLanguages global array from the specified file
	 * file is formatted according to www.iana.org/assignments/language-subtag-registry/language-subtag-registry
	 *
	 * @param {String}  languagesFile   the file name to load
	 * @param {boolean} purge           erase the existing values before loading new
	 * @param {boolean} async           use asynchronous loading (sync needed for command line execution)
	 * @param {boolean} verbose         display verbose output
	 */
	/* private method */
	#loadLanguagesFromFile(languagesFile, purge = false, async = true, verbose = true) {
		if (verbose) console.log(chalk.yellow(`reading languages from ${languagesFile}`));
		if (purge) this.empty();

		if (async) {
			readFile(
				languagesFile,
				{ encoding: "utf-8" },
				function (err, data) {
					if (!err) {
						this.#processLanguageData(data);
					} else console.log(chalk.red(`error loading languages ${err}`));
				}.bind(this)
			);
		} else {
			const langs = readFileSync(languagesFile, { encoding: "utf-8" }).toString();
			this.#processLanguageData(langs);
		}
	}

	/**
	 * load the languages list into the knownLanguages global array from the specified URL
	 *
	 * @param {String}  languagesURL   the URL to load
	 * @param {boolean} purge          erase the existing values before loading new
	 * @param {boolean} async          use asynchronous loading (sync needed for command line execution)
	 * @param {boolean} verbose         display verbose output
	 */
	/* private method */
	#loadLanguagesFromURL(languagesURL, purge = false, async = true, verbose = true) {
		const isHTTPurl = isHTTPURL(languagesURL);
		if (verbose) console.log(chalk.yellow(`${isHTTPurl ? "" : "--> NOT "}retrieving languages from ${languagesURL} using fetch()`));
		if (!isHTTPurl) return;

		if (purge) this.empty();

		if (async)
			fetch(languagesURL, fetch_options)
				.then(handleErrors)
				.then((response) => response.text())
				.then((responseText) => this.#processLanguageData(responseText))
				.catch((error) => console.log(chalk.red(`error (${error}) retrieving ${languagesURL}`)));
		else {
			let resp = null;
			try {
				resp = fetchS(languagesURL, fetch_options);
			} catch (error) {
				console.log(chalk.red(error.message));
			}
			if (resp) {
				if (resp.ok) this.#processLanguageData(resp.text());
				else console.log(chalk.red(`error (${resp.error}) retrieving ${languagesURL}`));
			}
		}
	}

	loadLanguages(source, options) {
		if (!Object.prototype.hasOwnProperty.call(source, "purge")) source.purge = false;

		if (source.file) this.#loadLanguagesFromFile(source.file, source.purge, options.async, options.verbose);
		else if (source.url) this.#loadLanguagesFromURL(source.url, source.purge, options.async, options.verbose);
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
			if (this.#languageRanges.find((range) => range.start <= value && value <= range.end)) return { resp: this.languageKnown };

			const found = this.#redundantLanguagesList.find((e) => e.tag.toLowerCase() == value.toLowerCase());
			if (found) {
				const res = { resp: this.languageRedundant };
				if (found?.preferred) res.pref = found.preferred;
				return res;
			}

			if (value.indexOf("-") != -1) {
				let matches = true;
				const parts = value.split("-");
				parts.forEach((part) => {
					matches &= this.#languagesList.has(part);
				});
				if (matches) return { resp: this.languageKnown };
			}

			return { resp: this.#languagesList.has(value) ? this.languageKnown : this.languageUnknown };
		}
		return { resp: this.languageInvalidType };
	}

	/**
	 * determines if a signing language is known
	 *
	 * @param {String} value The value to check for existance in the list of known signing languages
	 * @return {integer} indicating the "known" state of the language
	 */
	checkSignLanguage(language) {
		return this.#signLanguagesList.has(language.toLowerCase()) ? this.languageKnown : this.languageUnknown;
	}

	isKnownSignLanguage(value) {
		const lcValue = value.toLowerCase();
		let res = this.checkSignLanguage(lcValue);
		if (res == this.languageUnknown) res = this.checkSignLanguage("sgn-" + lcValue);
		return res;
	}
}

// return true is @lang is formatted according to BCP47 Language-Tag
const BCP47langaugetag_exp = new RegExp(`^${BCP47_Language_Tag}$`);
const isValidLangFormat = (lang) => (datatypeIs(lang, "string") ? BCP47langaugetag_exp.test(lang) : false);

export function ValidateLanguage(lang, errs, errCode, errLoc) {
	// language format check
	const valid = isValidLangFormat(lang);
	if (!valid)
		errs.addError({
			code: `${errCode}a`,
			key: "invalid language format",
			line: errLoc,
			message: `xml:${tva.a_lang} value ${lang.quote()} does not match format for Language-Tag in BCP47`,
		});
	return valid;
}
