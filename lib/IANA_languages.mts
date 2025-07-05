/**
 * IANA_languages.mts
 *
 * Load and check language identifiers
 * 
 */
import chalk from "chalk";
import { readFile, readFileSync } from "fs";
import fetchS from "sync-fetch";

import { datatypeIs } from "../phlib/phlib.ts";

import ErrorList from "./error_list.mts";
import handleErrors from "./fetch_err_handler.mts";
import { isHTTPURL, BCP47_Language_Tag } from "./pattern_checks.mts";
import { tva } from "./TVA_definitions.mts";
import { isIn, isIni } from "./utils.mts";


type RedundantType = {
	tag : string | null;
	preferred? : string;
}

type RangeType = {
	start : string;
	end : string;
}

type LanguageCheckResult = {
	resp : LanguageCheckResponse;
	pref? : string | null;
}

export enum LanguageCheckResponse {
	languageUnknown = 0,
	languageKnown,
	languageRedundant,
	languageNotSpecified,
	languageInvalidType,
}

export default class IANAlanguages {
	private languagesList : Array<string>;
	private redundantLanguagesList : Array<RedundantType>;
	private languageRanges : Array<RangeType>;
	signLanguagesList : Array<string>;
	regionsList : Array<string>;
	private languageFileDate : string | undefined;

	constructor() {
		this.languageFileDate = undefined;
		this.empty();
	}

	empty() {
		this.languagesList = [];
		this.redundantLanguagesList = [];
		this.languageRanges = [];
		this.signLanguagesList = [];
		this.regionsList = [];
		this.languageFileDate = undefined;
	}

	count() {
		return `lang=${this.languagesList.length},sign=${this.signLanguagesList.length},redun=${this.redundantLanguagesList.length}`;
	}

	numLanguages() : number {
		return this.languagesList.length;
	}

	stats(res : any) {
		res.numLanguages = this.languagesList.length;
		res.numRedundantLanguages = this.redundantLanguagesList.length;
		let t : Array<string> = [];
		this.redundantLanguagesList.forEach((lang) => {
			let tmp : string = lang.tag ? lang.tag : "";
			if (lang.preferred) 
				tmp += `-->${lang.preferred}`
			t.push(tmp);
		});
		res.RedundantLanguages = t.join(", ");
		res.numLanguageRanges = this.languageRanges.length;
		res.numSignLanguages = this.signLanguagesList.length;
		res.numRegions = this.regionsList.length;
		if (this.languageFileDate) 
			res.languageFileDate = this.languageFileDate;
	}

	/**
	 * load the languages into knownLanguages global array from the specified text
	 * file is formatted according to www.iana.org/assignments/language-subtag-registry/language-subtag-registry
	 *
	 * @param {string} languageData the text of the language data
	 */
	private processLanguageData(languageData : string) {
		/**
		 * determines if provided language information relates to a sign language
		 *
		 * @param {Array} items the language subtag
		 * @return {boolean} true if the language subtag is a sign language
		 */
		function isSignLanguage(items : Array<string>) : boolean {
			for (let i = 0; i < items.length; i++) 
				if (items[i].startsWith("Description") && items[i].toLowerCase().includes("sign")) 
					return true;
			return false;
		}

		const entries : Array<string> = languageData.split("%%");
		entries.forEach((entry) => {
			const items : Array<string> = entry.replace(/(\r|\t)/gm, "").split("\n");

			if (items[0].startsWith("File-Date")) {
				const tl = items[0].split(":");
				this.languageFileDate = tl[1];
			}
			if (isIn(items, "Type: language") || isIn(items, "Type: extlang")) {
				for (let i = 0; i < items.length; i++)
					if (items[i].startsWith("Subtag:")) {
						const subtag = items[i].split(":")[1].trim();
						if (isIn(items, "Scope: private-use")) {
							if (subtag.indexOf("..") < 0) 
								this.languagesList.push(subtag);
							else {
								const range = subtag.split("..");
								if (range[0].length == range[1].length) {
									if (range[0] < range[1]) this.languageRanges.push({ start: range[0], end: range[1] });
									else this.languageRanges.push({ start: range[1], end: range[0] });
								}
							}
						} else {
							this.languagesList.push(subtag);
							if (isSignLanguage(items)) 
								this.signLanguagesList.push(subtag);
						}
					}
			} else if (isIn(items, "Type: variant")) {
				let subtag : string | null = null;
				for (let i = 0; i < items.length; i++) 
					if (items[i].startsWith("Subtag:")) 
						subtag = items[i].split(":")[1].trim();
				if (subtag) {
					for (let i = 0; i < items.length; i++)
						if (items[i].startsWith("Prefix:")) {
							this.languagesList.push(items[i].split(":")[1].trim()); // prefix on its own is allowed
							this.languagesList.push(`${items[i].split(":")[1].trim()}-${subtag}`); // prefix-suffix is allowed
						}
				}
			} else if (isIn(items, "Type: redundant")) {
				let redund : RedundantType = { tag:null };
				for (let i = 0; i < items.length; i++) {
					if (items[i].startsWith("Tag:")) redund.tag = items[i].split(":")[1].trim();
					else if (items[i].startsWith("Preferred-Value:")) redund.preferred = items[i].split(":")[1].trim();
				}
				if (redund.tag) this.redundantLanguagesList.push(redund);
			} else if (isIn(items, "Type: region")) {
				for (let i = 0; i < items.length; i++) 
					if (items[i].startsWith("Subtag:")) 
						this.regionsList.push(items[i].split(":")[1].trim());
			}
		});
	}

	/**
	 * load the languages list into the knownLanguages global array from the specified file
	 * file is formatted according to www.iana.org/assignments/language-subtag-registry/language-subtag-registry
	 *
	 * @param {string} languagesFile  the file name to load
	 * @param {boolean} purge         erase the existing values before loading new
	 * @param {boolean} async         use asynchronous loading (sync needed for command line execution)
	 */
	private loadLanguagesFromFile(languagesFile : string, purge : boolean = false, async : boolean = true) {
		console.log(chalk.yellow(`reading languages from ${languagesFile}`));
		if (purge) this.empty();

		if (async) {
			readFile(
				languagesFile,
				{ encoding: "utf-8" },
				function (err, data) {
					if (!err) {
						this.processLanguageData(data);
					} else console.log(chalk.red(`error loading languages ${err}`));
				}.bind(this)
			);
		} else {
			const langs = readFileSync(languagesFile, { encoding: "utf-8" }).toString();
			this.processLanguageData(langs);
		}
	}

	/**
	 * load the languages list into the knownLanguages global array from the specified URL
	 *
	 * @param {string} languagesURL  the URL to load
	 * @param {boolean} purge        erase the existing values before loading new
	 * @param {boolean} async        use asynchronous loading (sync needed for command line execution)
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
			let resp : any /* SyyncResponse */ | null = null;
			try {
				resp = fetchS(languagesURL);
			} catch (error) {
				console.log(chalk.red(error.message));
			}
			if (resp) {
				if (resp.ok) this.processLanguageData(resp.text);
				else console.log(chalk.red(`error (${resp.error}) retrieving ${languagesURL}`));
			}
		}
	}

	loadLanguages(options, async = true) {
		if (!options) options = {};
		if (!Object.prototype.hasOwnProperty.call(options, "purge")) options.purge = false;

		if (options.file) 
			this.loadLanguagesFromFile(options.file, options.purge, async);
		else if (options.url) 
			this.loadLanguagesFromURL(options.url, options.purge, async);
	}

	/**
	 * determines if a language is known
	 *
	 * @param {string} language  The value to check for existance
	 * @return {LanguageCheckResult} indicating the "known" state of the language
	 */
	isKnown(language? : string) : LanguageCheckResult {
		if (language === null || language === undefined) return { resp: LanguageCheckResponse.languageNotSpecified };

		if (datatypeIs(language, "string")) {
			if (this.languageRanges.find((range) => range.start <= language && language <= range.end)) return { resp: LanguageCheckResponse.languageKnown };

			const found = this.redundantLanguagesList.find((e) => e.tag &&  e.tag.toLowerCase() == language.toLowerCase());
			if (found) {
				let res : LanguageCheckResult = { resp: LanguageCheckResponse.languageRedundant, pref: null };
				if (found?.preferred) res.pref = found.preferred;
				return res;
			}

			if (language.indexOf("-") != -1) {
				let matches : boolean = true;
				const parts = language.split("-");
				parts.forEach((part) => {
					matches = matches && isIni(this.languagesList, part);
				});
				if (matches) return { resp: LanguageCheckResponse.languageKnown };
			}

			return { resp: isIni(this.languagesList, language) ? LanguageCheckResponse.languageKnown : LanguageCheckResponse.languageUnknown };
		}
		return { resp: LanguageCheckResponse.languageInvalidType };
	}

	/**
	 * determines if a signing language is known
	 *
	 * @param {string} language  The value to check for existance in the list of known signing languages
	 * @return {LanguageCheckResponse} indicating the "known" state of the language
	 */
	checkSignLanguage(language : string) : LanguageCheckResponse {
		return this.signLanguagesList.find((lang) => lang.toLowerCase() === language) ? LanguageCheckResponse.languageKnown : LanguageCheckResponse.languageUnknown;
	}

		/**
	 * determines if the specified language is a signing language
	 *
	 * @param {string} language  The value to check 
	 * @return {LanguageCheckResponse} indicating the "known" state of the language
	 */
	isKnownSignLanguage(language : string) : LanguageCheckResponse {
		const lcValue = language.toLowerCase();
		let res = this.checkSignLanguage(lcValue);
		if (res === LanguageCheckResponse.languageUnknown) 
			res = this.checkSignLanguage("sgn-" + lcValue);
		return res;
	}
}

// return true is @lang is formatted according to BCP47 Language-Tag
const BCP47langauetag_exp = new RegExp(`^${BCP47_Language_Tag}$`);
export let isValidLangFormat = (language : string ) : boolean => BCP47langauetag_exp.test(language);

export function ValidateLanguage(language : string, errs : ErrorList, errCode : string, errLine : number) {
	// language format check
	if (!isValidLangFormat(language)) {
		errs.addError({
			code: `${errCode}-11`,
			key: "invalid lang format",
			line: errLine,
			message: `xml:${tva.a_lang} value ${language.quote()} does not match format for Language-Tag in BCP47`,
		});
	}
}
