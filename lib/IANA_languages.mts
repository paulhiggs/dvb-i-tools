/**
 * IANA_languages.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Load and check language identifiers
 */

import { readFile, readFileSync } from "fs";

import chalk from "chalk";
import * as fetchS from "sync-fetch";

import { tva } from "./TVA_definitions.mts";
import handleErrors from "./fetch_err_handler.mts";
import { datatypeIs, isIn, isIni } from "./utils.mts";
import { isHTTPURL, BCP47_Language_Tag } from "./pattern_checks.mts";
import ErrorList from "./error_list.mts";

type RedundantLanguageType = {
	tag?: string;
	preferred?: string;
};
type LanguageRangeType = {
	start: string;
	end: string;
};
type LookupResponseType = {
	resp: number;
	pref?: string;
};
export default class IANAlanguages {
	private languagesList : string[] = [];
	private redundantLanguagesList : RedundantLanguageType[] = [];
	private languageRanges : LanguageRangeType[] = [];
	private signLanguagesList : string[] = [];
	private regionsList : string[] = [];
	private languageFileDate	: string | null = null;

	languageKnown: number = 0;
	languageUnknown: number = 1;
	languageRedundant: number = 2;
	languageNotSpecified: number = 3;
	languageInvalidType: number = 4;

	constructor() {
	}

	empty() {
		this.languagesList = [];
		this.redundantLanguagesList = [];
		this.languageRanges = [];
		this.signLanguagesList = [];
		this.regionsList = [];
		this.languageFileDate = null;
	}

	count() {
		return `lang=${this.languagesList.length},sign=${this.signLanguagesList.length},redun=${this.redundantLanguagesList.length}`;
	}

	//eslint-disable-next-line @typescript-eslint/no-explicit-any
	stats(res : any) {
		res.numLanguages = this.languagesList.length;
		res.numRedundantLanguages = this.redundantLanguagesList.length;
		const t : string[] = [];
		this.redundantLanguagesList.forEach((lang) => t.push(`${lang.tag}${lang.preferred ? `~${lang.preferred}` : ""}`));
		res.RedundantLanguages = t.join(", ");
		res.numLanguageRanges = this.languageRanges.length;
		res.numSignLanguages = this.signLanguagesList.length;
		res.numRegions = this.regionsList.length;
		if (this.languageFileDate) res.languageFileDate = this.languageFileDate;
	}

	/**
	 * load the languages into knownLanguages global array from the specified text
	 * file is formatted according to www.iana.org/assignments/language-subtag-registry/language-subtag-registry
	 *
	 * @param {String} languageData the text of the language data
	 */
	private processLanguageData(languageData : string) {
		/**
		 * determines if provided language information relates to a sign language
		 *
		 * @param {Array} items the language subtag
		 * @return {boolean} true if the language subtag is a sign language
		 */
		function isSignLanguage(items : string[]) : boolean{
			for (let i = 0; i < items.length; i++) 
				if (items[i].startsWith("Description") && items[i].toLowerCase().includes("sign")) 
					return true;
			return false;
		}

		const entries = languageData.split("%%");
		entries.forEach((entry) => {
			const items = entry.replace(/(\r|\t)/gm, "").split("\n");

			if (items[0].startsWith("File-Date")) {
				const tl = items[0].split(":");
				this.languageFileDate = tl[1];
			}
			if (isIn(items, "Type: language") || isIn(items, "Type: extlang")) {
				for (let i = 0; i < items.length; i++)
					if (items[i].startsWith("Subtag:")) {
						const subtag = items[i].split(":")[1].trim();
						if (isIn(items, "Scope: private-use")) {
							if (subtag.indexOf("..") < 0) this.languagesList.push(subtag);
							else {
								const range = subtag.split("..");
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
			} else if (isIn(items, "Type: variant")) {
				let subtag = null;
				for (let i = 0; i < items.length; i++) if (items[i].startsWith("Subtag:")) subtag = items[i].split(":")[1].trim();
				if (subtag) {
					for (let i = 0; i < items.length; i++)
						if (items[i].startsWith("Prefix:")) {
							this.languagesList.push(items[i].split(":")[1].trim()); // prefix on its own is allowed
							this.languagesList.push(`${items[i].split(":")[1].trim()}-${subtag}`); // prefix-suffix is allowed
						}
				}
			} else if (isIn(items, "Type: redundant")) {
				const redund : RedundantLanguageType = {};
				for (let i = 0; i < items.length; i++) {
					if (items[i].startsWith("Tag:")) redund.tag = items[i].split(":")[1].trim();
					else if (items[i].startsWith("Preferred-Value:")) redund.preferred = items[i].split(":")[1].trim();
				}
				if (redund.tag) this.redundantLanguagesList.push(redund);
			} else if (isIn(items, "Type: region")) {
				for (let i = 0; i < items.length; i++) if (items[i].startsWith("Subtag:")) this.regionsList.push(items[i].split(":")[1].trim());
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
	 */
	private loadLanguagesFromFile(languagesFile : string, purge : boolean = false, async : boolean = true) {
		console.log(chalk.yellow(`reading languages from ${languagesFile}`));
		if (purge) this.empty();

		if (async) {
			readFile(
				languagesFile,
				{ encoding: "utf-8" },
				function (err : NodeJS.ErrnoException | null, data : string) {
					if (!err) {
						this.processLanguageData(data);
					} else console.log(chalk.red(`error loading languages ${err}`));
				}.bind(this)
			);
		} else {
			const langs : string = readFileSync(languagesFile, { encoding: "utf-8" }).toString();
			this.processLanguageData(langs);
		}
	}

	/**
	 * load the languages list into the knownLanguages global array from the specified URL
	 *
	 * @param {String}  languagesURL   the URL to load
	 * @param {boolean} purge          erase the existing values before loading new
	 * @param {boolean} async          use asynchronous loading (sync needed for command line execution)
	 */
	private loadLanguagesFromURL(languagesURL : string, purge : boolean = false, async : boolean = true) {
		const isHTTPurl = isHTTPURL(languagesURL);
		console.log(chalk.yellow(`${isHTTPurl ? "" : "--> NOT "}retrieving languages from ${languagesURL} using fetch()`));
		if (!isHTTPurl) return;

		if (purge) this.empty();

		if (async)
			fetch(languagesURL)
				.then(handleErrors)
				.then((response) => response.text())
				.then((responseText) => this.processLanguageData(responseText))
				.catch((error) => console.log(chalk.red(`error (${error}) retrieving ${languagesURL}`)));
		else {
			let resp = null;
			try {
				resp = fetchS(languagesURL);
			} catch (error) {
				console.log(chalk.red(error instanceof Error ? error.message : `error retrieving ${languagesURL}`));
			}
			if (resp) {
				if (resp.ok) this.processLanguageData(resp.text());
				else console.log(chalk.red(`error (${resp.error}) retrieving ${languagesURL}`));
			}
		}
	}

	loadLanguages(options, async = true) {
		if (!options) options = {};
		if (!Object.prototype.hasOwnProperty.call(options, "purge")) options.purge = false;

		if (options.file) this.loadLanguagesFromFile(options.file, options.purge, async);
		else if (options.url) this.loadLanguagesFromURL(options.url, options.purge, async);
	}

	/**
	 * determines if a language is known
	 *
	 * @param {String} value The value to check for existance
	 * @return {integer} indicating the "known" state of the language
	 */
	isKnown(value : string) : LookupResponseType {
		if (value === null || value === undefined) return { resp: this.languageNotSpecified };

		if (datatypeIs(value, "string")) {
			if (this.languageRanges.find((range) => range.start <= value && value <= range.end)) return { resp: this.languageKnown };

			const found = this.redundantLanguagesList.find((e) => e.tag.toLowerCase() == value.toLowerCase());
			if (found) {
				const res: LookupResponseType = { resp: this.languageRedundant };
				if (found?.preferred) res.pref = found.preferred;
				return res;
			}

			if (value.indexOf("-") != -1) {
				let matches = true;
				const parts : string[] = value.split("-");
				parts.forEach((part : string) => {
					matches &&= isIni(this.languagesList, part);
				});
				if (matches) return { resp: this.languageKnown };
			}

			return { resp: isIni(this.languagesList, value) ? this.languageKnown : this.languageUnknown };
		}
		return { resp: this.languageInvalidType };
	}

	/**
	 * determines if a signing language is known
	 *
	 * @param {String} value The value to check for existance in the list of known signing languages
	 * @return {integer} indicating the "known" state of the language
	 */
	checkSignLanguage(language : string) : number {
		return this.signLanguagesList.find((lang) => lang.toLowerCase() == language) ? this.languageKnown : this.languageUnknown;
	}

	isKnownSignLanguage(value : string) : number {
		const lcValue = value.toLowerCase();
		let res = this.checkSignLanguage(lcValue);
		if (res == this.languageUnknown) res = this.checkSignLanguage("sgn-" + lcValue);
		return res;
	}
}

// return true is @lang is formatted according to BCP47 Language-Tag
const BCP47langauetag_exp = new RegExp(`^${BCP47_Language_Tag}$`);
export const isValidLangFormat = (lang : string) => (datatypeIs(lang, "string") ? BCP47langauetag_exp.test(lang) : false);

export function ValidateLanguage(lang : string, errs : ErrorList, errCode : string, errLoc : number) {
	// language format check
	if (!isValidLangFormat(lang)) {
		errs.addError({
			code: `${errCode}-11`,
			key: "invalid language format",
			line: errLoc,
			message: `xml:${tva.a_lang} value ${lang.quote()} does not match format for Language-Tag in BCP47`,
		});
	}
}
