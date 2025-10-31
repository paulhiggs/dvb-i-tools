/**
 * cg_check.mjs
 *
 * Validate content guide metadata
 */
import process from "process";
import { readFileSync } from "fs";

import chalk from "chalk";
import { XmlDocument, XmlElement } from "libxml2-wasm";

import { attribute, elementize, quote } from "../phlib/phlib.js";

import { Array_extension_init } from "./Array-extensions.mjs";
Array_extension_init();

import { mpeg7 } from "./MPEG7_definitions.mjs";
import { tva, tvaEA, tvaEC } from "./TVA_definitions.mjs";
import { cgVersions, dvbi } from "./DVB-I_definitions.mjs";

import { TVAschema, __dirname_linux } from "./data_locations.mjs";

import ErrorList, { WARNING, APPLICATION } from "./error_list.mjs";
import { isIn, isIni, unEntity, parseISOduration, CountChildElements, DuplicatedValue } from "./utils.mjs";
import { isHTTPURL, isDVBLocator, isUTCDateTime, isCRIDURI, isTAGURI } from "./pattern_checks.mjs";
import { ValidatePromotionalStillImage } from "./related_material_checks.mjs";
import { cg_InvalidHrefValue, NoChildElement, keys } from "./common_errors.mjs";
import { checkAttributes, checkTopElementsAndCardinality, SchemaCheck, SchemaLoad, SchemaVersionCheck } from "./schema_checks.mjs";
import { checkLanguage, GetNodeLanguage, checkXMLLangs } from "./multilingual_element.mjs";
import writeOut from "./logger.mjs";
import { CURRENT, OLD } from "./globals.mjs";
import {
	LoadGenres,
	LoadRatings,
	LoadVideoCodecCS,
	LoadAudioCodecCS,
	LoadAudioPresentationCS,
	LoadAccessibilityPurpose,
	LoadAudioPurpose,
	LoadSubtitleCarriages,
	LoadSubtitleCodings,
	LoadSubtitlePurposes,
	LoadLanguages,
	LoadCountries,
} from "./classification_scheme_loaders.mjs";
import { LoadCredits } from "./credits_loader.mjs";
import CheckAccessibilityAttributes from "./accessibility_attributes_checks.mjs";

// convenience/readability values
const DEFAULT_LANGUAGE = "***";
const CATEGORY_GROUP_NAME = '"category group"';

const CG_REQUEST_SCHEDULE_TIME = "Time";
const CG_REQUEST_SCHEDULE_NOWNEXT = "NowNext";
const CG_REQUEST_SCHEDULE_WINDOW = "Window";
const CG_REQUEST_PROGRAM = "ProgInfo";
const CG_REQUEST_MORE_EPISODES = "MoreEpisodes";
const CG_REQUEST_BS_CATEGORIES = "bsCategories";
const CG_REQUEST_BS_LISTS = "bsLists";
const CG_REQUEST_BS_CONTENTS = "bsContents";

const supportedRequests = [
	{ value: CG_REQUEST_SCHEDULE_TIME, label: "Schedule Info (time stamp)" },
	{ value: CG_REQUEST_SCHEDULE_NOWNEXT, label: "Schedule Info (now/next)" },
	{ value: CG_REQUEST_SCHEDULE_WINDOW, label: "Schedule Info (window)" },
	{ value: CG_REQUEST_PROGRAM, label: "Program Info" },
	{ value: CG_REQUEST_MORE_EPISODES, label: "More Episodes" },
	{ value: CG_REQUEST_BS_CATEGORIES, label: "Box Set Categories" },
	{ value: CG_REQUEST_BS_LISTS, label: "Box Set Lists" },
	{ value: CG_REQUEST_BS_CONTENTS, label: "Box Set Contents" },
];

const SchemaVersions = [
	{
		namespace: TVAschema.v2024.namespace,
		version: cgVersions.r2,
		filename: TVAschema.v2024.file,
		schema: null,
		status: CURRENT,
	},
	{
		namespace: TVAschema.v2023.namespace,
		version: cgVersions.r1,
		filename: TVAschema.v2023.file,
		schema: null,
		status: OLD,
	},
	{
		namespace: TVAschema.v2019.namespace,
		version: cgVersions.r0,
		filename: TVAschema.v2019.file,
		schema: null,
		status: OLD,
	},
];

/**
 * determine the schema version (and hence the specificaion version) in use
 *
 * @param {String} namespace  The namespace used in defining the schema
 * @returns {integer} Representation of the schema version or error code if unknown
 */
let CG_SchemaVersion = (namespace) => {
	const x = SchemaVersions.find((ver) => ver.namespace == namespace);
	return x ? x.version : cgVersions.unknown;
};

/**
 * converts a decimal representation of a string to a number
 *
 * @param {String} str    string contining the decimal value
 * @returns {integer}  the decimal representation of the string, or 0 if non-digits are included
 */
let valUnsignedInt = (str) => {
	const intRegex = /[\d]+/;
	const s = str.match(intRegex);
	return s[0] === str ? parseInt(str, 10) : 0;
};

/**
 * checks is the specified element (elem) has an attribute named attrName and that its value is on the given list)
 *
 * @param {XmlElement} elem       the XML element to be checked
 * @param {String}     attrName   the name of the attribute carrying the boolean value
 * @param {Array}      allowed    the set or permitted values
 * @param {ErrorList}  errs       errors found in validaton
 * @param {String}     errCode    the error number used as a prefix for reporting errors
 * @param {boolean}    isRequired true if the specified attribute is required to be specified for the element
 */
function AllowedValue(elem, attrName, allowed, errs, errCode, isRequired = true) {
	if (!elem) {
		errs.addError({ type: APPLICATION, code: `${errCode}-0`, message: "AllowedValue() called with elem==null" });
		return;
	}

	if (elem.attrAnyNs(attrName)) {
		if (!isIn(allowed, elem.attrAnyNs(attrName).value))
			errs.addError({
				code: `${errCode}-1`,
				message: `${attrName.attribute(`${elem.parent.name}.${elem.name}`)} must be ${allowed.joinn(" or ")}`,
				fragment: elem,
			});
	} else if (isRequired)
		errs.addError({
			code: `${errCode}-2`,
			message: `${attrName.attribute()} must be specified for ${elem.parent.name}.${elem.name}`,
			fragment: elem,
		});
}

/**
 * checks is the specified element (elem) has an attribute named attrName and that its value is "true" or "false"
 *
 * @param {XmlElement} elem       the XML element to be checked
 * @param {String}     attrName   the name of the attribute carrying the boolean value
 * @param {ErrorList}  errs       errors found in validaton
 * @param {String}     errCode    the error number used as a prefix for reporting errors
 * @param {boolean}    isRequired true if the specified attribute is required to be specified for the element
 */
let BooleanValue = (elem, attrName, errs, errCode, isRequired = true) => AllowedValue(elem, attrName, ["true", "false"], errs, errCode, isRequired);

/**
 * checks is the specified element (elem) has an attribute named attrName and that its value is "true"
 *
 * @param {XmlElement} elem       the XML element to be checked
 * @param {String}     attrName   the name of the attribute carrying the boolean value
 * @param {ErrorList}  errs       errors found in validaton
 * @param {String}     errCode    the error number used as a prefix for reporting errors
 * @param {boolean}    isRequired true if the specified attribute is required to be specified for the element
 */
let TrueValue = (elem, attrName, errs, errCode, isRequired = true) => AllowedValue(elem, attrName, ["true"], errs, errCode, isRequired);

/**
 * checks is the specified element (elem) has an attribute named attrName and that its value is "false"
 *
 * @param {XmlElement} elem       the XML element to be checked
 * @param {String}     attrName   the name of the attribute carrying the boolean value
 * @param {ErrorList}  errs       errors found in validaton
 * @param {String}     errCode    the error number used as a prefix for reporting errors
 * @param {boolean}    isRequired true if the specified attribute is required to be specified for the element
 */
let FalseValue = (elem, attrName, errs, errCode, isRequired = true) => AllowedValue(elem, attrName, ["false"], errs, errCode, isRequired);

/**
 * @param {String} genre the value to check as being a restart availability genre
 * @returns {boolean} true if the value provided is a valid restart availability genre
 */
export let isRestartAvailability = (genre) => [dvbi.RESTART_AVAILABLE, dvbi.RESTART_CHECK, dvbi.RESTART_PENDING].includes(genre);

export default class ContentGuideCheck {
	#numRequests;
	#knownLanguages;
	#allowedGenres;
	#allowedVideoSchemes;
	#allowedAudioSchemes;
	#audioPresentationCSvalues;
	#allowedCreditItemRoles;
	#allowedRatings;
	#knownCountries;
	#accessibilityPurposes;
	#audioPurposes;
	#subtitleCarriages;
	#subtitleCodings;
	#subtitlePurposes;

	constructor(useURLs, opts, async = true) {
		this.#numRequests = 0;
		this.supportedRequests = supportedRequests;

		this.#knownLanguages = opts?.languages ? opts.languages : LoadLanguages(useURLs, async);
		this.#allowedGenres = opts?.genres ? opts.genres : LoadGenres(useURLs, async);
		this.#allowedVideoSchemes = opts?.videofmts ? opts.videofmts : LoadVideoCodecCS(useURLs, async);
		this.#allowedAudioSchemes = opts?.audiofmts ? opts.audiofmts : LoadAudioCodecCS(useURLs, async);

		this.#audioPresentationCSvalues = opts?.audiopres ? opts?.audiopres : LoadAudioPresentationCS(useURLs, async);
		this.#allowedCreditItemRoles = opts?.credits ? opts.credits : LoadCredits(useURLs, async);
		this.#allowedRatings = opts?.ratings ? opts.ratings : LoadRatings(useURLs, async);
		this.#knownCountries = opts?.countries ? opts.countries : LoadCountries(useURLs, async);
		this.#accessibilityPurposes = opts?.accessibilities ? opts.accessibilities : LoadAccessibilityPurpose(useURLs, async);
		this.#audioPurposes = opts?.audiopurps ? opts.audiopurps : LoadAudioPurpose(useURLs, async);
		this.#subtitleCarriages = opts?.stcarriage ? opts.stcarriage : LoadSubtitleCarriages(useURLs, async);
		this.#subtitleCodings = opts?.stcodings ? opts.stcodings : LoadSubtitleCodings(useURLs, async);
		this.#subtitlePurposes = opts?.stpurposes ? opts.stpurposes : LoadSubtitlePurposes(useURLs, async);

		// TODO - change this to support sync/asyna and file/url reading
		console.log(chalk.yellow.underline("loading content guide schemas..."));
		SchemaVersions.forEach((version) => {
			process.stdout.write(chalk.yellow(`..loading ${version.version} ${version.namespace} from ${version.filename} `));
			let schema = readFileSync(version.filename);
			if (schema) version.schema = XmlDocument.fromBuffer(schema, { url: version.filename });
			console.log(version.schema ? chalk.green("OK") : chalk.red.bold("FAIL"));
		});
	}

	stats() {
		let res = {};
		res.numRequests = this.#numRequests;
		this.#knownLanguages.stats(res);
		res.numAllowedGenres = this.#allowedGenres.count();
		res.numCreditItemRoles = this.#allowedCreditItemRoles.count();
		res.numRatings = this.#allowedRatings.count();
		res.numAudioPurposes = this.#audioPurposes.count();
		return res;
	}

	/*private*/ #doSchemaVerification(TVAdoc, errs, errCode, report_schema_version = true) {
		let _rc = true;

		const x = SchemaVersions.find((s) => s.namespace == TVAdoc.root.documentNamespace());
		if (x && x.schema) {
			SchemaCheck(TVAdoc, x.schema, x.filename, errs, `${errCode}:${CG_SchemaVersion(TVAdoc.root.documentNamespace())}`);
			if (report_schema_version) SchemaVersionCheck(TVAdoc, x.status, errs, `${errCode}a`);
		} else _rc = false;

		return _rc;
	}

	/**
	 * check if the specificed element has the named child element
	 *
	 * @param {XmlElement} node         the node to check
	 * @param {String}     elementName  the name of the child element
	 * @returns {boolean} true if an element named node.elementName exists, else false
	 */
	/* private */ #hasElement(node, elementName) {
		if (!node) return false;
		return node.childNodes().find((c) => c instanceof XmlElement && c.name == elementName);
	}

	/**
	 * check that the serviceIdRef attribute is a TAG URI and report warnings
	 *
	 * @param {XmlElement} elem     the node containing the element being checked
	 * @param {ErrorList}  errs     errors found in validaton
	 * @param {String}     errCode  error code prefix to be used in reports
	 * @returns {String} the serviceIdRef, whether it is valid of not
	 */
	/* private */ #checkTAGUri(elem, errs, errCode) {
		if (elem && elem.attrAnyNs(tva.a_serviceIDRef)) {
			const svcID = elem.attrAnyNs(tva.a_serviceIDRef).value;
			if (!isTAGURI(svcID))
				errs.addError({
					type: WARNING,
					code: errCode,
					key: keys.k_InvalidTag,
					message: `${tva.a_serviceIDRef.attribute(elem.name)} ${svcID.quote()} is not a TAG URI`,
					line: elem.line,
				});
			return svcID;
		}
		return "";
	}

	/**
	 * validate the <Synopsis> elements
	 *
	 * @param {XmlElement} BasicDescription    the element whose children should be checked
	 * @param {Array}      requiredLengths	   @length attributes that are required to be present
	 * @param {Array}      optionalLengths	   @length attributes that can optionally be present
	 * @param {ErrorList}  errs                errors found in validaton
	 * @param {String}     errCode             error code prefix to be used in reports
	 */
	/* private */ #ValidateSynopsis(BasicDescription, requiredLengths, optionalLengths, errs, errCode) {
		if (!BasicDescription) {
			errs.addError({
				type: APPLICATION,
				code: "SY000",
				message: "ValidateSynopsis() called with BasicDescription==null",
			});
			return;
		}

		let synopsisLengthError = (label, length, actual) => `length of ${tva.a_length.attribute(tva.e_Synopsis)}=${label.quote()} exceeds ${length} characters, measured(${actual})`;
		let singleLengthLangError = (length, lang) => `only a single ${tva.e_Synopsis.elementize()} is permitted per length (${length}) and language (${lang})`;
		let requiredSynopsisError = (length) => `a ${tva.e_Synopsis.elementize()} with ${tva.a_length.attribute()}=${length.quote()} is required`;

		let s = 0,
			Synopsis,
			hasShort = false,
			hasMedium = false,
			hasLong = false;
		let shortLangs = [],
			mediumLangs = [],
			longLangs = [];
		while ((Synopsis = BasicDescription.getAnyNs(tva.e_Synopsis, ++s)) != null) {
			checkAttributes(Synopsis, [tva.a_length], [tva.a_lang], tvaEA.Synopsis, errs, `${errCode}-1`);

			const synopsisLang = GetNodeLanguage(Synopsis, false, errs, `${errCode}-2`);
			const synopsisLength = Synopsis.attrAnyNs(tva.a_length) ? Synopsis.attrAnyNs(tva.a_length).value : null;

			if (synopsisLength) {
				if (isIn(requiredLengths, synopsisLength) || isIn(optionalLengths, synopsisLength)) {
					const _len = unEntity(Synopsis.content).length;
					switch (synopsisLength) {
						case tva.SYNOPSIS_SHORT_LABEL:
							if (_len > tva.SYNOPSIS_SHORT_LENGTH)
								errs.addError({
									code: `${errCode}-11`,
									message: synopsisLengthError(tva.SYNOPSIS_SHORT_LABEL, tva.SYNOPSIS_SHORT_LENGTH, _len),
									fragment: Synopsis,
									key: keys.k_LengthError,
								});
							hasShort = true;
							break;
						case tva.SYNOPSIS_MEDIUM_LABEL:
							if (_len > tva.SYNOPSIS_MEDIUM_LENGTH)
								errs.addError({
									code: `${errCode}-12`,
									message: synopsisLengthError(tva.SYNOPSIS_MEDIUM_LABEL, tva.SYNOPSIS_MEDIUM_LENGTH, _len),
									fragment: Synopsis,
									key: keys.k_LengthError,
								});
							hasMedium = true;
							break;
						case tva.SYNOPSIS_LONG_LABEL:
							if (_len > tva.SYNOPSIS_LONG_LENGTH)
								errs.addError({
									code: `${errCode}-13`,
									message: synopsisLengthError(tva.SYNOPSIS_LONG_LABEL, tva.SYNOPSIS_LONG_LENGTH, _len),
									fragment: Synopsis,
									key: keys.k_LengthError,
								});
							hasLong = true;
							break;
					}
				} else
					errs.addError({
						code: `${errCode}-14`,
						message: `${tva.a_length.attribute()}=${synopsisLength.quote()} is not permitted for this request type`,
						fragment: Synopsis,
						key: "unexpected length",
					});
			}

			if (synopsisLang && synopsisLength) {
				switch (synopsisLength) {
					case tva.SYNOPSIS_SHORT_LABEL:
						if (isIn(shortLangs, synopsisLang))
							errs.addError({
								code: `${errCode}-16`,
								message: singleLengthLangError(synopsisLength, synopsisLang),
								fragment: Synopsis,
								key: keys.k_DuplicatedSynopsisLength,
							});
						else shortLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_MEDIUM_LABEL:
						if (isIn(mediumLangs, synopsisLang))
							errs.addError({
								code: `${errCode}-17`,
								message: singleLengthLangError(synopsisLength, synopsisLang),
								fragment: Synopsis,
								key: keys.k_DuplicatedSynopsisLength,
							});
						else mediumLangs.push(synopsisLang);
						break;
					case tva.SYNOPSIS_LONG_LABEL:
						if (isIn(longLangs, synopsisLang))
							errs.addError({
								code: `${errCode}-18`,
								message: singleLengthLangError(synopsisLength, synopsisLang),
								fragment: Synopsis,
								key: keys.k_DuplicatedSynopsisLength,
							});
						else longLangs.push(synopsisLang);
						break;
				}
			}
		}

		if (isIn(requiredLengths, tva.SYNOPSIS_SHORT_LABEL) && !hasShort)
			errs.addError({
				code: `${errCode}-19`,
				message: requiredSynopsisError(tva.SYNOPSIS_SHORT_LABEL),
				line: BasicDescription.line,
				key: keys.k_MissingSynopsisLength,
			});
		if (isIn(requiredLengths, tva.SYNOPSIS_MEDIUM_LABEL) && !hasMedium)
			errs.addError({
				code: `${errCode}-20`,
				message: requiredSynopsisError(tva.SYNOPSIS_MEDIUM_LABEL),
				line: BasicDescription.line,
				key: keys.k_MissingSynopsisLength,
			});
		if (isIn(requiredLengths, tva.SYNOPSIS_LONG_LABEL) && !hasLong)
			errs.addError({
				code: `${errCode}-21`,
				message: requiredSynopsisError(tva.SYNOPSIS_LONG_LABEL),
				line: BasicDescription.line,
				key: keys.k_MissingSynopsisLength,
			});
	}

	/**
	 * validate the <Keyword> elements specified
	 *
	 * @param {XmlElement} BasicDescription  the element whose children should be checked
	 * @param {integer}    minKeywords       the minimum number of keywords
	 * @param {integer}	   maxKeywords       the maximum number of keywords
	 * @param {ErrorList}  errs              errors found in validaton
	 * @param {String}     errCode           error code prefix to be used in reports
	 */
	/* private */ #ValidateKeyword(BasicDescription, minKeywords, maxKeywords, errs, errCode) {
		if (!BasicDescription) {
			errs.addError({
				type: APPLICATION,
				code: "KW000",
				message: "ValidateKeyword() called with BasicDescription=null",
			});
			return;
		}
		let k = 0,
			Keyword,
			counts = [];
		while ((Keyword = BasicDescription.getAnyNs(tva.e_Keyword, ++k)) != null) {
			checkAttributes(Keyword, [], [tva.a_lang, tva.a_type], tvaEA.Keyword, errs, `${errCode}-1`);

			const keywordType = Keyword.attrAnyNs(tva.a_type) ? Keyword.attrAnyNs(tva.a_type).value : tva.DEFAULT_KEYWORD_TYPE;
			const keywordLang = GetNodeLanguage(Keyword, false, errs, `${errCode}-2`);

			if (counts[keywordLang] === undefined) counts[keywordLang] = [Keyword];
			else counts[keywordLang].push(Keyword);

			if (keywordType != tva.KEYWORD_TYPE_MAIN && keywordType != tva.KEYWORD_TYPE_OTHER)
				errs.addError({
					code: `${errCode}-11`,
					key: keys.k_InvalidKeywordType,
					message: `${tva.a_type.attribute()}=${keywordType.quote()} not permitted for ${tva.e_Keyword.elementize()}`,
					fragment: Keyword,
				});
			if (unEntity(Keyword.content).length > dvbi.MAX_KEYWORD_LENGTH)
				errs.addError({
					code: `${errCode}-12`,
					message: `length of ${tva.e_Keyword.elementize()} is greater than ${dvbi.MAX_KEYWORD_LENGTH}`,
					fragment: Keyword,
					key: keys.k_InvalidKeywordType,
				});
		}

		for (let i in counts) {
			if (counts[i].length != 0 && counts[i].length > maxKeywords)
				errs.addError({
					code: `${errCode}-13`,
					key: "excess keywords",
					message: `More than ${maxKeywords} ${tva.e_Keyword.elementize()} element${maxKeywords > 1 ? "s" : ""} specified${
						i == DEFAULT_LANGUAGE ? "" : " for language " + i.quote()
					}`,
					multiElementError: counts[i],
				});
		}
	}

	/**
	 * validate the <Genre> elements specified
	 *
	 * @param {XmlElement} BasicDescription  the element whose children should be checked
	 * @param {ErrorList}  errs              errors found in validaton
	 * @param {String}     errCode           error code prefix to be used in reports
	 */
	/* private */ #ValidateGenre(BasicDescription, errs, errCode) {
		if (!BasicDescription) {
			errs.addError({ type: APPLICATION, code: "GE000", message: "ValidateGenre() called with BasicDescription=null" });
			return;
		}

		let g = 0,
			Genre;
		while ((Genre = BasicDescription.getAnyNs(tva.e_Genre, ++g)) != null) {
			const genreType = Genre.attrAnyNs(tva.a_type) ? Genre.attrAnyNs(tva.a_type).value : tva.DEFAULT_GENRE_TYPE;
			if (genreType != tva.GENRE_TYPE_MAIN)
				errs.addError({
					code: `${errCode}-1`,
					key: "disallowed genre type",
					message: `${tva.a_type.attribute(tva.e_Genre)}=${genreType.quote()} not permitted for ${tva.e_Genre.elementize()}`,
					fragment: Genre,
					clause: "A177 clause 6.10.5",
					description: `${tva.a_type.attribute(tva.e_Genre)} must be "${tva.GENRE_TYPE_MAIN}", semantic definitions of ${tva.e_Genre.elementize()}`,
				});

			const genreValue = Genre.attrAnyNs(tva.a_href) ? Genre.attrAnyNs(tva.a_href).value : "";
			if (!this.#allowedGenres.isIn(genreValue))
				errs.addError({
					code: `${errCode}-2`,
					key: "invalid genre",
					message: `invalid ${tva.a_href.attribute()} value ${genreValue.quote()} for ${tva.e_Genre.elementize()}`,
					fragment: Genre,
					clause: "A177 clause 6.10.5",
					description: `The value of ${tva.a_href.attribute(tva.e_Genre)} must be as specified in the semantic definitions of ${tva.e_Genre.elementize()}`,
				});
		}
	}

	/**
	 * validate the <ParentalGuidance> elements specified.
	 *
	 * @param {XmlElement} BasicDescription  the element whose children should be checked
	 * @param {ErrorList}  errs              errors found in validaton
	 * @param {String}     errCode           error code prefix to be used in reports
	 */
	/* private */ #ValidateParentalGuidance(BasicDescription, errs, errCode) {
		if (!BasicDescription) {
			errs.addError({
				type: APPLICATION,
				code: "PG000",
				message: "Validate_ParentalGuidance() called with BasicDescription=null",
			});
			return;
		}

		const UNSPECIFIED_COUNTRY = "*!*";
		let foundCountries = [];
		let pg = 0,
			ParentalGuidance;
		while ((ParentalGuidance = BasicDescription.getAnyNs(tva.e_ParentalGuidance, ++pg)) != null) {
			let pgCountries = UNSPECIFIED_COUNTRY;
			if (ParentalGuidance.hasChild(tva.e_CountryCodes)) pgCountries = ParentalGuidance.getAnyNs(tva.e_CountryCodes).content;

			const pgCountriesList = pgCountries.split(",");
			pgCountriesList.forEach((pgCountry) => {
				let thisCountry = foundCountries.find((c) => c.country == pgCountry);
				if (!thisCountry) {
					thisCountry = { country: pgCountry, pgCount: 0, MinimumAge: null, ParentalRating: null };
					foundCountries.push(thisCountry);
				}

				if (pgCountry != UNSPECIFIED_COUNTRY && !this.#knownCountries.isISO3166code(pgCountry))
					errs.addError({
						code: `${errCode}-5`,
						key: keys.k_ParentalGuidance,
						message: `invalid country code (${pgCountry}) specified`,
						fragment: ParentalGuidance.getAnyNs(tva.e_CountryCodes),
					});

				// first <ParentalGuidance> element must contain an <mpeg7:MinimumAge> element
				if (ParentalGuidance.childNodes())
					ParentalGuidance.childNodes().forEachSubElement((pgChild) => {
						switch (pgChild.name) {
							case tva.e_MinimumAge:
								checkAttributes(pgChild, [], [], tvaEA.MinimumAge, errs, `${errCode}-10`);
								if (thisCountry.MinimumAge) {
									// only one minimum age value is permitted per country
									errs.addError({
										code: `${errCode}-11`,
										key: keys.k_ParentalGuidance,
										message: `only a single ${tva.e_ParentalGuidance.elementize()} containing ${tva.e_MinimumAge.elementize()} can be specified per country ${
											pgCountry == UNSPECIFIED_COUNTRY ? "" : `(${pgCountry})`
										}`,
										fragment: pgChild,
									});
								}
								thisCountry.MinimumAge = pgChild;
								/* eslint-disable no-case-declarations */
								const age = parseInt(pgChild.content);
								/* eslint-enable */
								if ((age < 4 || age > 18) && age != 255)
									errs.addError({
										code: `${errCode}-12`,
										key: keys.k_ParentalGuidance,
										message: `value of ${tva.e_MinimumAge.elementize()} must be between 4 and 18 (to align with parental_rating_descriptor) or be 255`,
										fragment: pgChild,
									});
								break;
							case tva.e_ParentalRating:
								checkAttributes(pgChild, [tva.a_href], [], tvaEA.ParentalRating, errs, `${errCode}-20`);
								if (thisCountry.ParentalRating) {
									// only one parental rating value is permitted per country
									errs.addError({
										code: `${errCode}-21`,
										key: keys.k_ParentalGuidance,
										message: `only a single ${tva.e_ParentalGuidance.elementize()} containing ${tva.e_ParentalRating.elementize()} can be specified per country ${
											pgCountry == UNSPECIFIED_COUNTRY ? "" : `(${pgCountry})`
										}`,
										fragment: pgChild,
									});
								}
								if (pgChild.attrAnyNs(tva.a_href)) {
									const rating = pgChild.attrAnyNs(tva.a_href).value;
									if (this.#allowedRatings.hasScheme(rating)) {
										if (!this.#allowedRatings.isIn(rating))
											errs.addError({
												code: `${errCode}-22`,
												key: keys.k_ParentalGuidance,
												fragment: pgChild,
												message: `invalid rating term "${rating}"`,
											});
									} else
										errs.addError({
											type: WARNING,
											code: `${errCode}-23`,
											key: keys.k_ParentalGuidance,
											message: "foreign (non DVB or TVA) parental rating scheme used",
											fragment: pgChild,
										});
									if (rating.startsWith(dvbi.DTG_CONTENT_WARNING_CS_SCHEME)) {
										// <ExplanatoryText> is required for DTG Content Warning CS
										if (!ParentalGuidance.hasChild(tva.e_ExplanatoryText))
											errs.addError({
												code: `${errCode}-24`,
												key: keys.k_ParentalGuidance,
												message: `${tva.e_ExplanatoryText.elementize()} is required for DTGContentWarningCS`,
												fragment: ParentalGuidance,
											});
									}
								}
								thisCountry.ParentalRating = pgChild;
								break;
							case tva.e_ExplanatoryText:
								checkAttributes(pgChild, [tva.a_length], [tva.a_lang], tvaEA.ExplanatoryText, errs, `${errCode}-30`);
								/* eslint-disable no-case-declarations */
								const lengthAttr = pgChild.attrAnyNs(tva.a_length);
								/* eslint-enable */
								if (lengthAttr && lengthAttr.value != tva.v_lengthLong)
									errs.addError({
										code: `${errCode}-31`,
										message: `${tva.a_length.attribute()}=${lengthAttr.value.quote()} is not allowed for ${tva.e_ExplanatoryText.elementize()}`,
										fragment: pgChild,
										key: keys.k_LengthError,
									});
								if (unEntity(pgChild.content).length > dvbi.MAX_EXPLANATORY_TEXT_LENGTH)
									errs.addError({
										code: `${errCode}-32`,
										message: `length of ${tva.e_ExplanatoryText.elementize()} cannot exceed ${dvbi.MAX_EXPLANATORY_TEXT_LENGTH} characters`,
										fragment: pgChild,
										key: keys.k_LengthError,
									});
								break;
						}
					});
				checkXMLLangs(tva.e_ExplanatoryText, `${BasicDescription.name}.${tva.e_ParentalGuidance}`, ParentalGuidance, errs, `${errCode}-50`);
			});
		}

		// now check that for each country, there is a MinimumAge element specified
		foundCountries.forEach((pgCountry) => {
			if (pgCountry.ParentalRating && !pgCountry.MinimumAge)
				errs.addError({
					code: `${errCode}-60`,
					key: keys.k_ParentalGuidance,
					message: `a ${tva.e_ParentalGuidance.elementize()} element contining ${tva.e_MinimumAge.elementize()} is not specified for ${
						pgCountry.country == UNSPECIFIED_COUNTRY ? "default country" : pgCountry.country
					}`,
					fragment: pgCountry.ParentalRating,
					description: "Mandatory for the first ParentalGuidance element defined",
					clause: "A177 table 61",
				});
		});
	}

	/**
	 * validate the <CreditsList> elements specified
	 *
	 * @param {XmlElement} BasicDescription   the element whose children should be checked
	 * @param {ErrorList}  errs               errors found in validaton
	 * @param {String}     errCode            error code prefix to be used in reports
	 */
	/* private */ #ValidateCreditsList(BasicDescription, errs, errCode) {
		if (!BasicDescription) {
			errs.addError({
				type: APPLICATION,
				code: "CL000",
				message: "ValidateCreditsList() called with BasicDescription==null",
			});
			return;
		}

		/**
		 * validate a name (either PersonName of Character) to ensure a single GivenName is present with a single optional FamilyName
		 *
		 * @param {XmlElement} elem      the element whose children should be checked
		 * @param {ErrorList}  errs      errors found in validaton
		 * @param {String}     errCode   error code prefix to be used in reports
		 */
		function ValidateName(elem, errs, errCode) {
			function checkNamePart(elem, errs, errCode) {
				if (unEntity(elem.content).length > dvbi.MAX_NAME_PART_LENGTH)
					errs.addError({
						code: errCode,
						fragment: elem,
						message: `${elem.name.elementize()} in ${elem.parent.name.elementize()} is longer than ${dvbi.MAX_NAME_PART_LENGTH} characters`,
						key: keys.k_LengthError,
					});
			}

			if (!elem) {
				errs.addError({ type: APPLICATION, code: "VN000", message: "ValidateName() called with elem==null" });
				return;
			}
			let familyNameCount = [],
				givenNameCount = 0;
			if (elem.childNodes())
				elem.childNodes().forEachSubElement((child) => {
					switch (child.name) {
						case tva.e_GivenName:
							givenNameCount++;
							checkNamePart(child, errs, `${errCode}-2`);
							break;
						case tva.e_FamilyName:
							familyNameCount.push(child);
							checkNamePart(child, errs, `${errCode}-3`);
							break;
					}
				});

			if (givenNameCount == 0)
				errs.addError({
					code: `${errCode}-4`,
					message: `${tva.e_GivenName.elementize()} is mandatory in ${elem.name.elementize()}`,
					line: elem.line,
					key: "missing element",
				});
			if (familyNameCount.length > 1)
				errs.addError({
					code: `${errCode}-5`,
					message: `only a single ${tva.e_FamilyName.elementize()} is permitted in ${elem.name.elementize()}`,
					multiElementError: familyNameCount,
					key: "multiple element",
				});
		}

		const CreditsList = BasicDescription.getAnyNs(tva.e_CreditsList);
		if (CreditsList) {
			let ci = 0,
				numCreditsItems = 0,
				CreditsItem;
			while ((CreditsItem = CreditsList.getAnyNs(tva.e_CreditsItem, ++ci)) != null) {
				numCreditsItems++;
				checkAttributes(CreditsItem, [tva.a_role], [], tvaEA.CreditsItem, errs, `${errCode}-1`);
				if (CreditsItem.attrAnyNs(tva.a_role)) {
					const CreditsItemRole = CreditsItem.attrAnyNs(tva.a_role).value;
					if (!this.#allowedCreditItemRoles.isIn(CreditsItemRole))
						errs.addError({
							code: `${errCode}-2`,
							message: `${CreditsItemRole.quote()} is not valid for ${tva.a_role.attribute(tva.e_CreditsItem)}`,
							fragment: CreditsItem,
							key: keys.k_InvalidValue,
						});
				}

				let foundPersonName = [],
					foundCharacter = [],
					foundOrganizationName = [];
				if (CreditsItem.childNodes())
					CreditsItem.childNodes().forEachSubElement((child) => {
						switch (child.name) {
							case tva.e_PersonName:
								foundPersonName.push(child);
								// required to have a GivenName optionally have a FamilyName
								ValidateName(child, errs, `${errCode}-11`);
								checkXMLLangs(tva.e_GivenName, tva.e_PersonName, child, errs, `${errCode}-12`);
								checkXMLLangs(tva.e_FamilyName, tva.e_PersonName, child, errs, `${errCode}-13`);
								break;
							case tva.e_Character:
								foundCharacter.push(child);
								// required to have a GivenName optionally have a FamilyName
								ValidateName(child, errs, `${errCode}-21`);
								checkXMLLangs(tva.e_GivenName, tva.e_Character, child, errs, `${errCode}-22`);
								checkXMLLangs(tva.e_FamilyName, tva.e_Character, child, errs, `${errCode}-23`);
								break;
							case tva.e_OrganizationName:
								foundOrganizationName.push(child);
								if (unEntity(child.content).length > dvbi.MAX_ORGANIZATION_NAME_LENGTH)
									errs.addError({
										code: `${errCode}-31`,
										message: `length of ${tva.e_OrganizationName.elementize()} in ${tva.e_CreditsItem.elementize()} exceeds ${dvbi.MAX_ORGANIZATION_NAME_LENGTH} characters`,
										fragment: child,
										key: keys.k_LengthError,
									});
								break;
							default:
								if (child.name != "text")
									errs.addError({
										code: `${errCode}-91`,
										message: `extra element ${child.name.elementize()} found in ${tva.e_CreditsItem.elementize()}`,
										fragment: child,
										key: "unexpected element",
									});
						}
					});
				let singleElementError = (elementName, parentElementName) => `only a single ${elementName.elementize()} is permitted in ${parentElementName.elementize()}`;
				checkXMLLangs(tva.e_OrganizationName, tva.e_CreditsItem, CreditsItem, errs, `${errCode}-11`);
				if (foundPersonName.length > 1)
					errs.addError({
						code: `${errCode}-51`,
						message: singleElementError(tva.e_PersonName, tva.e_CreditsItem),
						multiElementError: foundPersonName,
						key: keys.k_InvalidElement,
					});
				if (foundCharacter.length > 1)
					errs.addError({
						code: `${errCode}-52`,
						message: singleElementError(tva.e_Character, tva.e_CreditsItem),
						multiElementError: foundCharacter,
						key: keys.k_InvalidElement,
					});
				if (foundOrganizationName.length > 1)
					errs.addError({
						code: `${errCode}-53`,
						message: singleElementError(tva.e_OrganizationName, tva.e_CreditsItem),
						multiElementError: foundOrganizationName,
						key: keys.k_InvalidElement,
					});
				if (foundCharacter.length > 0 && foundPersonName.length == 0)
					errs.addError({
						code: `${errCode}-54`,
						message: `${tva.e_Character.elementize()} in ${tva.e_CreditsItem.elementize()} requires ${tva.e_PersonName.elementize()}`,
						line: CreditsItem.line,
						key: keys.k_InvalidElement,
					});
				if (foundOrganizationName.length > 0 && (foundPersonName.length > 0 || foundCharacter.length > 0))
					errs.addError({
						code: `${errCode}-55`,
						message: `${tva.e_OrganizationName.elementize()} can only be present when ${tva.e_PersonName.elementize()} and ${tva.e_OrganizationName.elementize()} are absent in ${tva.e_CreditsItem.elementize()}`,
						line: CreditsItem.line,
						key: keys.k_InvalidElement,
					});
			}
			if (numCreditsItems > dvbi.MAX_CREDITS_ITEMS)
				errs.addError({
					code: `${errCode}-16`,
					message: `a maximum of ${dvbi.MAX_CREDITS_ITEMS} ${tva.e_CreditsItem.elementize()} elements are permitted in ${tva.e_CreditsList.elementize()}`,
					line: CreditsList.line,
					key: `excess ${tva.e_CreditsItem.elementize()}`,
				});
		}
	}

	/**
	 * validate the <RelatedMaterial> elements specified
	 *
	 * @param {XmlElement} BasicDescription  the element whose children should be checked
	 * @param {ErrorList}  errs              errors found in validaton
	 */
	/* private */ #ValidateRelatedMaterial_PromotionalStillImage(BasicDescription, errs) {
		if (!BasicDescription) {
			errs.addError({
				type: APPLICATION,
				code: "RMPSI000",
				message: "ValidateRelatedMaterial_PromotionalStillImage() called with BasicDescription==null",
			});
			return;
		}
		let rm = 0,
			RelatedMaterial;
		while ((RelatedMaterial = BasicDescription.getAnyNs(tva.e_RelatedMaterial, ++rm)) != null)
			ValidatePromotionalStillImage(RelatedMaterial, BasicDescription.name.elementize(), errs, "RMPSI001");
	}

	/**
	 * validate the <RelatedMaterial> elements containing pagination links
	 *
	 * @param {XmlElement} BasicDescription   the element whose children should be checked
	 * @param {String}     Location           The location of the Basic Description element
	 * @param {ErrorList}  errs               errors found in validaton
	 */
	/* private */ #ValidateRelatedMaterial_Pagination(BasicDescription, Location, errs) {
		if (!BasicDescription) {
			errs.addError({
				type: APPLICATION,
				code: "VP000",
				message: "ValidateRelatedMaterial_Pagination() called with BasicDescription==null",
			});
			return;
		}

		function checkLinkCounts(elements, label, errs, errCode) {
			if (elements.length > 1) {
				errs.addError({
					code: errCode,
					message: `more than 1 ${quote(`${label} pagination`)} link is specified`,
					multiElementError: elements,
				});
				return true;
			}
			return false;
		}

		let countPaginationFirst = [],
			countPaginationPrev = [],
			countPaginationNext = [],
			countPaginationLast = [];
		let rm = 0,
			RelatedMaterial;
		while ((RelatedMaterial = BasicDescription.getAnyNs(tva.e_RelatedMaterial, ++rm)) != null) {
			const HowRelated = RelatedMaterial.getAnyNs(tva.e_HowRelated);
			if (!HowRelated) errs.addError(NoChildElement(tva.e_HowRelated.elementize(), RelatedMaterial, Location, "VP001"));
			else {
				checkAttributes(HowRelated, [tva.a_href], [], tvaEA.HowRelated, errs, "VP002");
				if (HowRelated.attrAnyNs(tva.a_href))
					switch (HowRelated.attrAnyNs(tva.a_href).value) {
						case dvbi.PAGINATION_FIRST_URI:
							countPaginationFirst.push(HowRelated);
							break;
						case dvbi.PAGINATION_PREV_URI:
							countPaginationPrev.push(HowRelated);
							break;
						case dvbi.PAGINATION_NEXT_URI:
							countPaginationNext.push(HowRelated);
							break;
						case dvbi.PAGINATION_LAST_URI:
							countPaginationLast.push(HowRelated);
							break;
					}
				const MediaLocator = RelatedMaterial.getAnyNs(tva.e_MediaLocator);
				const MediaURI = MediaLocator ? MediaLocator.getAnyNs(tva.e_MediaUri) : null;
				if (MediaURI) {
					if (!isHTTPURL(MediaURI.content))
						errs.addError({
							code: "VP011",
							message: `${tva.e_MediaUri.elementize()}=${MediaURI.content.quote()} is not a valid Pagination URL`,
							key: keys.k_InvalidURL,
							fragment: MediaURI,
						});
				} else
					errs.addError({
						code: "VP010",
						message: `${tva.e_MediaLocator.elementize()}${tva.e_MediaUri.elementize()} not specified for pagination link`,
						fragment: RelatedMaterial,
						key: keys.k_MissingElement,
					});
			}
		}

		let linkCountErrs = false;
		if (checkLinkCounts(countPaginationFirst, "first", errs, "VP011")) linkCountErrs = true;
		if (checkLinkCounts(countPaginationPrev, "previous", errs, "VP012")) linkCountErrs = true;
		if (checkLinkCounts(countPaginationNext, "next", errs, "VP013")) linkCountErrs = true;
		if (checkLinkCounts(countPaginationLast, "last", errs, "VP014")) linkCountErrs = true;

		if (!linkCountErrs) {
			const numPaginations = countPaginationFirst.length + countPaginationPrev.length + countPaginationNext.length + countPaginationLast.length;
			if (numPaginations != 0 && numPaginations != 2 && numPaginations != 4)
				errs.addError({
					code: "VP020",
					message: `only 0, 2 or 4 paginations links may be signalled in ${tva.e_RelatedMaterial.elementize()} elements for ${Location}`,
					multiElementError: countPaginationFirst.concat(countPaginationPrev).concat(countPaginationNext).concat(countPaginationLast),
				});
			else if (numPaginations == 2) {
				if (countPaginationPrev.length == 1 && countPaginationLast.length == 1)
					errs.addError({
						code: "VP021",
						message: `"previous" and "last" links cannot be specified alone`,
						multiElementError: countPaginationPrev.concat(countPaginationLast),
					});
				if (countPaginationFirst.length == 1 && countPaginationNext.length == 1)
					errs.addError({
						code: "VP022",
						message: `"first" and "next" links cannot be specified alone`,
						multiElementError: countPaginationFirst.concat(countPaginationNext),
					});
			}
		}
	}

	/**
	 * validate the <RelatedMaterial> elements in  More Episodes response
	 *
	 * @param {XmlElement} BasicDescription   the element whose children should be checked
	 * @param {ErrorList}  errs               errors found in validaton
	 */
	/* private */ #ValidateRelatedMaterial_MoreEpisodes(BasicDescription, errs) {
		if (!BasicDescription) {
			errs.addError({
				type: APPLICATION,
				code: "RMME000",
				message: "ValidateRelatedMaterial_MoreEpisodes() called with BasicDescription==null",
			});
			return;
		}
		switch (BasicDescription.parent.name) {
			case tva.e_ProgramInformation:
				/* eslint-disable no-case-declarations */
				let rm = 0,
					RelatedMaterial;
				/* eslint-enable */
				while ((RelatedMaterial = BasicDescription.getAnyNs(tva.e_RelatedMaterial, ++rm)) != null)
					ValidatePromotionalStillImage(RelatedMaterial, BasicDescription.name, errs, "RMME001");
				break;
			case tva.e_GroupInformation:
				this.#ValidateRelatedMaterial_Pagination(BasicDescription, "More Episodes", errs);
				break;
		}
	}

	/** TemplateAITPromotional Still Image
	 *
	 * @param {XmlElement} RelatedMaterial  the <RelatedMaterial> element (a libxmls ojbect tree) to be checked
	 * @param {String}     Location         the printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
	 * @param {ErrorList}  errs             the class where errors and warnings relating to the serivce list processing are stored
	 */
	/* private */ #ValidateTemplateAIT(RelatedMaterial, Location, errs) {
		if (!RelatedMaterial) {
			errs.addError({
				type: APPLICATION,
				code: "TA000",
				message: "ValidateTemplateAIT() called with RelatedMaterial==null",
			});
			return;
		}
		let HowRelated = null,
			MediaLocator = [];

		if (RelatedMaterial.childNodes())
			RelatedMaterial.childNodes().forEachSubElement((child) => {
				switch (child.name) {
					case tva.e_HowRelated:
						HowRelated = child;
						break;
					case tva.e_MediaLocator:
						MediaLocator.push(child);
						break;
				}
			});

		if (!HowRelated) {
			errs.addError(NoChildElement(tva.e_HowRelated.elementize(), RelatedMaterial, Location, "TA001"));
			return;
		}

		checkAttributes(HowRelated, [tva.a_href], [], tvaEA.HowRelated, errs, "TA002");
		if (HowRelated.attrAnyNs(tva.a_href)) {
			if (HowRelated.attrAnyNs(tva.a_href).value != dvbi.TEMPLATE_AIT_URI)
				errs.addError({
					code: "TA003",
					message: `${tva.a_href.attribute(tva.e_HowRelated)}=${HowRelated.attrAnyNs(tva.a_href).value.quote()} does not designate a Template AIT`,
					fragment: HowRelated,
					key: "not template AIT",
				});
			else {
				if (MediaLocator.length != 0)
					MediaLocator.forEach((locator) => {
						let hasAuxiliaryURI = false;
						locator.childNodes()?.forEachNamedSubElement(tva.e_AuxiliaryURI, (AuxiliaryURI) => {
							hasAuxiliaryURI = true;
							checkAttributes(AuxiliaryURI, [tva.a_contentType], [], tvaEA.AuxiliaryURI, errs, "TA010");
							const contentType = AuxiliaryURI.attrAnyNsValueOr(tva.a_contentType, null);
							if (contentType && contentType != dvbi.XML_AIT_CONTENT_TYPE)
								errs.addError({
									code: "TA011",
									message: `invalid ${tva.a_contentType.attribute()}=${contentType.quote()} specified for ${RelatedMaterial.name.elementize()}${tva.e_MediaLocator.elementize()} in ${Location}`,
									fragment: AuxiliaryURI,
									key: keys.k_InvalidValue,
								});
						});
						if (!hasAuxiliaryURI) errs.addError(NoChildElement(tva.e_AuxiliaryURI.elementize(), locator, Location, "TA012"));
					});
				else errs.addError(NoChildElement(tva.e_MediaLocator.elementize(), RelatedMaterial, Location, "TA013"));
			}
		}
	}

	/**
	 * validate the <RelatedMaterial> elements specified in a Box Set List
	 *
	 * @param {XmlElement} BasicDescription   the element whose children should be checked
	 * @param {ErrorList}  errs               errors found in validaton
	 */
	/* private */ #ValidateRelatedMaterial_BoxSetList(BasicDescription, errs) {
		if (!BasicDescription) {
			errs.addError({
				type: APPLICATION,
				code: "RM-BSL000",
				message: "ValidateRelatedMaterial_BoxSetList() called with BasicDescription==null",
			});
			return;
		}

		let countImage = [],
			countTemplateAIT = [],
			hasPagination = false;
		let rm = 0,
			RelatedMaterial;

		while ((RelatedMaterial = BasicDescription.getAnyNs(tva.e_RelatedMaterial, ++rm)) != null) {
			const HowRelated = RelatedMaterial.getAnyNs(tva.e_HowRelated);
			if (!HowRelated) errs.addError(NoChildElement(tva.e_HowRelated.elementize(), RelatedMaterial, null, "MB009"));
			else {
				checkAttributes(HowRelated, [tva.a_href], [], tvaEA.HowRelated, errs, "MB010");
				if (HowRelated.attrAnyNs(tva.a_href)) {
					const hrHref = HowRelated.attrAnyNs(tva.a_href).value;
					switch (hrHref) {
						case dvbi.TEMPLATE_AIT_URI:
							countTemplateAIT.push(HowRelated);
							this.#ValidateTemplateAIT(RelatedMaterial, BasicDescription.name.elementize(), errs);
							break;
						case dvbi.PAGINATION_FIRST_URI:
						case dvbi.PAGINATION_PREV_URI:
						case dvbi.PAGINATION_NEXT_URI:
						case dvbi.PAGINATION_LAST_URI:
							// pagination links are allowed, but checked in ValidateRelatedMaterial_Pagination()
							hasPagination = true;
							break;
						case tva.cs_PromotionalStillImage:
							countImage.push(HowRelated);
							ValidatePromotionalStillImage(RelatedMaterial, BasicDescription.name.elementize(), errs, "MB012");
							break;
						default:
							errs.addError(cg_InvalidHrefValue(hrHref, HowRelated, `${tva.e_RelatedMaterial.elementize()} in Box Set List`, "MB011"));
					}
				}
			}
		}
		if (countTemplateAIT.length == 0)
			errs.addError({
				code: "MB021",
				message: `a ${tva.e_RelatedMaterial.elementize()} element signalling the Template XML AIT must be specified for a Box Set List`,
				multiElementError: countTemplateAIT,
			});
		if (countTemplateAIT.length > 1)
			errs.addError({
				code: "MB022",
				message: `only one ${tva.e_RelatedMaterial.elementize()} element signalling the Template XML AIT can be specified for a Box Set List`,
				multiElementError: countTemplateAIT,
			});
		if (countImage.length > 1)
			errs.addError({
				code: "MB023",
				message: `only one ${tva.e_RelatedMaterial.elementize()} element signalling the promotional still image can be specified for a Box Set List`,
				multiElementError: countImage,
			});

		if (hasPagination) this.#ValidateRelatedMaterial_Pagination(BasicDescription, "Box Set List", errs);
	}

	/**
	 * validate the <RelatedMaterial> elements specified in a Box Set Contents
	 *
	 * @param {XmlElement} BasicDescription   the element whose children should be checked
	 * @param {ErrorList}  errs               errors found in validaton
	 */
	/* private */ #ValidateRelatedMaterial_BoxSetContents(BasicDescription, errs) {
		if (!BasicDescription) {
			errs.addError({
				type: APPLICATION,
				code: "RM-BSC000",
				message: "ValidateRelatedMaterial_BoxSetContents() called with BasicDescription==null",
			});
			return;
		}

		let countImage = [],
			hasPagination = false;
		let rm = 0,
			RelatedMaterial;

		while ((RelatedMaterial = BasicDescription.getAnyNs(tva.e_RelatedMaterial, ++rm)) != null) {
			const HowRelated = RelatedMaterial.getAnyNs(tva.e_HowRelated);
			if (!HowRelated) errs.addError(NoChildElement(tva.e_HowRelated.elementize(), RelatedMaterial, null, "MC009"));
			else {
				checkAttributes(HowRelated, [tva.a_href], [], tvaEA.HowRelated, errs, "MC010");
				if (HowRelated.attrAnyNs(tva.a_href)) {
					const hrHref = HowRelated.attrAnyNs(tva.a_href).value;
					switch (hrHref) {
						case dvbi.TEMPLATE_AIT_URI:
							errs.addError({
								code: "MC013",
								message: `${tva.e_RelatedMaterial.elementize()} for TemplateAIT is not allowed in Box Set Contents responses`,
								fragment: RelatedMaterial,
								key: keys.k_InvalidHRef,
								clause: "A177r8 Table 47a",
							});
							break;
						case dvbi.PAGINATION_FIRST_URI:
						case dvbi.PAGINATION_PREV_URI:
						case dvbi.PAGINATION_NEXT_URI:
						case dvbi.PAGINATION_LAST_URI:
							// pagination links are allowed, but checked in ValidateRelatedMaterial_Pagination()
							hasPagination = true;
							break;
						case tva.cs_PromotionalStillImage:
							countImage.push(HowRelated);
							ValidatePromotionalStillImage(RelatedMaterial, BasicDescription.name.elementize(), errs, "MC012");
							break;
						default:
							errs.addError(cg_InvalidHrefValue(hrHref, HowRelated, `${tva.e_RelatedMaterial.elementize()} in Box Set List`, "MC011"));
					}
				}
			}
		}
		if (countImage.length > 1)
			errs.addError({
				code: "MC023",
				message: `only one ${tva.e_RelatedMaterial.elementize()} element signalling the promotional still image can be specified for a Box Set Box Set Contents`,
				multiElementError: countImage,
			});

		if (hasPagination) this.#ValidateRelatedMaterial_Pagination(BasicDescription, "Box Set List", errs);
	}

	/**
	 * validate the <Title> elements specified
	 *
	 * @param {XmlElement} containingNode   the element whose children should be checked
	 * @param {boolean}    allowSecondary   indicates if  Title with @type="secondary" is permitted
	 * @param {boolean}    TypeIsRequired   true is the @type is a required attribute in this use of <Title>
	 * @param {ErrorList}  errs             errors found in validaton
	 * @param {String}     errCode          error code prefix to be used in reports
	 */
	/* private */ #ValidateTitle(containingNode, allowSecondary, TypeIsRequired, errs, errCode) {
		if (!containingNode) {
			errs.addError({ type: APPLICATION, code: "VT000", message: "ValidateTitle() called with containingNode==null" });
			return;
		}

		let mainTitles = [],
			secondaryTitles = [];
		let t = 0,
			Title,
			requiredAttributes = [],
			optionalAttributes = [tva.a_lang];

		if (TypeIsRequired) requiredAttributes.push(tva.a_type);
		else optionalAttributes.push(tva.a_type);

		while ((Title = containingNode.getAnyNs(tva.e_Title, ++t)) != null) {
			checkAttributes(Title, requiredAttributes, optionalAttributes, tvaEA.Title, errs, `${errCode}-1`);

			const titleType = Title.attrAnyNsValueOr(tva.a_type, mpeg7.DEFAULT_TITLE_TYPE);
			const titleLang = GetNodeLanguage(Title, false, errs, `${errCode}-2`);
			const titleStr = unEntity(Title.content);

			if (titleStr.length > dvbi.MAX_TITLE_LENGTH)
				errs.addError({
					code: `${errCode}-11`,
					message: `${tva.e_Title.elementize()} length exceeds ${dvbi.MAX_TITLE_LENGTH} characters`,
					fragment: Title,
					description: "refer clause 6.10.5 in A177",
				});
			switch (titleType) {
				case mpeg7.TITLE_TYPE_MAIN:
					if (mainTitles.find((e) => e.lang == titleLang))
						errs.addError({
							code: `${errCode}-12`,
							message: `only a single language (${titleLang}) is permitted for ${tva.a_type.attribute(tva.e_Title)}=${mpeg7.TITLE_TYPE_MAIN.quote()}`,
						});
					else mainTitles.push({ lang: titleLang, elem: Title });
					break;
				case mpeg7.TITLE_TYPE_SECONDARY:
					if (allowSecondary) {
						if (secondaryTitles.find((e) => e.lang == titleLang))
							errs.addError({
								code: `${errCode}-13`,
								message: `only a single language (${titleLang}) is permitted for ${tva.a_type.attribute(tva.e_Title)}=${mpeg7.TITLE_TYPE_SECONDARY.quote()}`,
							});
						else secondaryTitles.push({ lang: titleLang, elem: Title });
					} else
						errs.addError({
							code: `${errCode}-14`,
							message: `${tva.a_type.attribute(tva.e_Title)}=${mpeg7.TITLE_TYPE_SECONDARY.quote()} is not permitted for this ${containingNode.name.elementize()}`,
							fragment: Title,
						});
					break;
				default:
					errs.addError({
						code: `${errCode}-15`,
						message: `${tva.a_type.attribute()} must be ${mpeg7.TITLE_TYPE_MAIN.quote()} or ${mpeg7.TITLE_TYPE_SECONDARY.quote()} for ${tva.e_Title.elementize()}`,
						fragment: Title,
						description: "refer to the relevant subsection of clause 6.10.5 in A177",
					});
					break;
			}
		}
		secondaryTitles.forEach((title) => {
			if (!mainTitles.find((e) => e.lang == title.lang)) {
				const tLoc = title.lang != DEFAULT_LANGUAGE ? ` for @xml:${tva.a_lang}=${title.lang.quote()}` : "";
				errs.addError({
					code: `${errCode}-16`,
					message: `${tva.a_type.attribute()}=${mpeg7.TITLE_TYPE_SECONDARY.quote()} specified without ${tva.a_type.attribute()}=${mpeg7.TITLE_TYPE_MAIN.quote()}${tLoc}`,
					fragment: title.elem,
				});
			}
		});
	}

	/**
	 * validate the <ReleaseInformation> elements specified.
	 *
	 * @param {XmlElement} BasicDescription  the element whose children should be checked
	 * @param {ErrorList}  errs              errors found in validaton
	 * @param {String}     errCode           error code prefix to be used in reports
	 */
	/* private */ #ValidateReleaseInformation(BasicDescription, errs, errCode) {
		if (!BasicDescription) {
			errs.addError({
				type: APPLICATION,
				code: "RI000",
				message: "ValidateReleaseInformation() called with BasicDescription=null",
			});
			return;
		}
		const defaultLocation = "##default##";
		let locations = [];
		let release,
			ri = 0;
		while ((release = BasicDescription.getAnyNs(tva.e_ReleaseInformation, ++ri)) != null) {
			if (!release.hasChild(tva.e_ReleaseDate) && !release.hasChild(tva.e_ReleaseLocation)) {
				errs.addError({
					code: `${errCode}-11`,
					type: WARNING,
					message: `${tva.e_ReleaseDate.elementize()} and/or ${tva.e_ReleaseLocation.elementize()} should be specified`,
					fragment: release,
					key: "empty element",
				});
			} else {
				const location = release.getAnyNs(tva.e_ReleaseLocation);
				const ReleaseLocation = location ? location.content : defaultLocation;
				if (isIn(locations, ReleaseLocation))
					errs.addError({
						code: `${errCode}-21`,
						type: WARNING,
						message:
							ReleaseLocation == defaultLocation
								? `${tva.e_ReleaseInformation} for all regions already specified.`
								: `${tva.e_ReleaseInformation} for region ${ReleaseLocation.quote()} already specified.`,
						key: "duplicate release location",
						fragment: location, // addError will use @line if @fragment is null or not specified
						line: release.line,
					});
				else locations.push(ReleaseLocation);
			}
		}
	}

	/**
	 * validate the <BasicDescription> element against the profile for the given request/response type
	 *
	 * @param {XmlElement} parentElement   the element whose children should be checked
	 * @param {String}     requestType     the type of content guide request being checked
	 * @param {XmlElement} categoryGroup   the GroupInformation element that others must refer to through <MemberOf>
	 * @param {ErrorList}  errs            errors found in validaton
	 */
	/* private */ #ValidateBasicDescription(parentElement, requestType, categoryGroup, errs) {
		if (!parentElement) {
			errs.addError({
				type: APPLICATION,
				code: "BD000",
				message: "ValidateBasicDescription() called with parentElement==null",
			});
			return;
		}

		const isParentGroup = categoryGroup ? parentElement.line == categoryGroup.line : null;
		const BasicDescription = parentElement.getAnyNs(tva.e_BasicDescription);
		if (!BasicDescription) {
			errs.addError(NoChildElement(tva.e_BasicDescription.elementize(), parentElement, null, "BD001"));
			return;
		}

		switch (parentElement.name) {
			case tva.e_ProgramInformation:
				switch (requestType) {
					case CG_REQUEST_SCHEDULE_NOWNEXT: //6.10.5.2
					case CG_REQUEST_SCHEDULE_WINDOW:
					case CG_REQUEST_SCHEDULE_TIME:
						checkTopElementsAndCardinality(
							BasicDescription,
							[
								{ name: tva.e_Title, maxOccurs: Infinity },
								{ name: tva.e_Synopsis, maxOccurs: Infinity },
								{ name: tva.e_Genre, minOccurs: 0 },
								{ name: tva.e_ParentalGuidance, minOccurs: 0, maxOccurs: Infinity },
								{ name: tva.e_RelatedMaterial, minOccurs: 0 },
							],
							tvaEC.BasicDescription,
							false,
							errs,
							"BD010"
						);
						this.#ValidateTitle(BasicDescription, true, true, errs, "BD011");
						this.#ValidateSynopsis(BasicDescription, [tva.SYNOPSIS_MEDIUM_LABEL], [tva.SYNOPSIS_SHORT_LABEL], errs, "BD012");
						this.#ValidateGenre(BasicDescription, errs, "BD013");
						this.#ValidateParentalGuidance(BasicDescription, errs, "BD014");
						this.#ValidateRelatedMaterial_PromotionalStillImage(BasicDescription, errs);
						break;
					case CG_REQUEST_PROGRAM: // 6.10.5.3
						checkTopElementsAndCardinality(
							BasicDescription,
							[
								{ name: tva.e_Title, maxOccurs: Infinity },
								{ name: tva.e_Synopsis, maxOccurs: Infinity },
								{ name: tva.e_Keyword, minOccurs: 0, maxOccurs: Infinity },
								{ name: tva.e_Genre, minOccurs: 0 },
								{ name: tva.e_ParentalGuidance, minOccurs: 0, maxOccurs: Infinity },
								{ name: tva.e_CreditsList, minOccurs: 0 },
								{ name: tva.e_RelatedMaterial, minOccurs: 0 },
								{ name: tva.e_ReleaseInformation, minOccurs: 0, maxOccurs: Infinity },
							],
							tvaEC.BasicDescription,
							false,
							errs,
							"BD020"
						);
						this.#ValidateTitle(BasicDescription, true, true, errs, "BD021");
						this.#ValidateSynopsis(BasicDescription, [tva.SYNOPSIS_MEDIUM_LABEL], [tva.SYNOPSIS_SHORT_LABEL, tva.SYNOPSIS_LONG_LABEL], errs, "BD022");
						this.#ValidateKeyword(BasicDescription, 0, 20, errs, "BD023");
						this.#ValidateGenre(BasicDescription, errs, "BD024");
						this.#ValidateParentalGuidance(BasicDescription, errs, "BD025");
						this.#ValidateCreditsList(BasicDescription, errs, "BD026");
						this.#ValidateRelatedMaterial_PromotionalStillImage(BasicDescription, errs);
						this.#ValidateReleaseInformation(BasicDescription, errs, "BD027");
						break;
					case CG_REQUEST_BS_CONTENTS: // 6.10.5.4
						checkTopElementsAndCardinality(
							BasicDescription,
							[
								{ name: tva.e_Title, maxOccurs: Infinity },
								{ name: tva.e_Synopsis, minOccurs: 0, maxOccurs: Infinity },
								{ name: tva.e_ParentalGuidance, minOccurs: 0, maxOccurs: Infinity },
								{ name: tva.e_RelatedMaterial, minOccurs: 0 },
								{ name: tva.e_ReleaseInformation, minOccurs: 0, maxOccurs: Infinity },
							],
							tvaEC.BasicDescription,
							false,
							errs,
							"BD030"
						);
						this.#ValidateTitle(BasicDescription, true, true, errs, "BD031");
						this.#ValidateSynopsis(BasicDescription, [], [tva.SYNOPSIS_MEDIUM_LABEL], errs, "BD032");
						this.#ValidateParentalGuidance(BasicDescription, errs, "BD033");
						this.#ValidateRelatedMaterial_PromotionalStillImage(BasicDescription, errs);
						this.#ValidateRelatedMaterial_Pagination(BasicDescription, "Box Set Contents", errs);
						this.#ValidateReleaseInformation(BasicDescription, errs, "BD034");
						break;
					case CG_REQUEST_MORE_EPISODES: // 6.10.5.5
						checkTopElementsAndCardinality(
							BasicDescription,
							[
								{ name: tva.e_Title, maxOccurs: Infinity },
								{ name: tva.e_RelatedMaterial, minOccurs: 0 },
							],
							tvaEC.BasicDescription,
							false,
							errs,
							"BD040"
						);
						this.#ValidateTitle(BasicDescription, true, true, errs, "BD041");
						this.#ValidateRelatedMaterial_MoreEpisodes(BasicDescription, errs);
						break;
					default:
						errs.addError({
							type: APPLICATION,
							code: "BD050",
							message: `ValidateBasicDescription() called with invalid requestType/element (${requestType}/${parentElement.name})`,
						});
				}
				break;

			case tva.e_GroupInformation:
				switch (requestType) {
					case CG_REQUEST_SCHEDULE_NOWNEXT: //6.10.17.3 - BasicDescription for NowNext should be empty
					case CG_REQUEST_SCHEDULE_WINDOW:
					case CG_REQUEST_SCHEDULE_TIME:
						checkTopElementsAndCardinality(BasicDescription, [], tvaEC.BasicDescription, false, errs, "BD050");
						break;
					case CG_REQUEST_BS_CONTENTS: // clause 6.10.5.6 table 47a
						checkTopElementsAndCardinality(
							BasicDescription,
							[
								{ name: tva.e_Title, minOccurs: 0, maxOccurs: Infinity },
								{ name: tva.e_Synopsis, minOccurs: 0, maxOccurs: Infinity },
								{ name: tva.e_Keyword, minOccurs: 0, maxOccurs: Infinity },
								{ name: tva.e_RelatedMaterial, minOccurs: 0, maxOccurs: Infinity },
							],
							tvaEC.BasicDescription,
							false,
							errs,
							"BD090"
						);
						this.#ValidateTitle(BasicDescription, false, false, errs, "BD091");
						this.#ValidateSynopsis(BasicDescription, [tva.SYNOPSIS_MEDIUM_LABEL], [], errs, "BD092");
						this.#ValidateKeyword(BasicDescription, 0, 20, errs, "BD093");
						this.#ValidateRelatedMaterial_BoxSetContents(BasicDescription, errs);
						break;
					case CG_REQUEST_BS_LISTS: // clause 6.10.5.6 table 47
						if (isParentGroup) checkTopElementsAndCardinality(BasicDescription, [{ name: tva.e_Title, maxOccurs: Infinity }], tvaEC.BasicDescription, false, errs, "BD061");
						else
							checkTopElementsAndCardinality(
								BasicDescription,
								[
									{ name: tva.e_Title, maxOccurs: Infinity },
									{ name: tva.e_Synopsis, maxOccurs: Infinity },
									{ name: tva.e_Keyword, minOccurs: 0, maxOccurs: Infinity },
									{ name: tva.e_RelatedMaterial, minOccurs: 0, maxOccurs: Infinity },
								],
								tvaEC.BasicDescription,
								false,
								errs,
								"BD062"
							);

						this.#ValidateTitle(BasicDescription, false, false, errs, "BD063");
						if (!isParentGroup) {
							this.#ValidateSynopsis(BasicDescription, [tva.SYNOPSIS_MEDIUM_LABEL], [], errs, "BD064");
							this.#ValidateKeyword(BasicDescription, 0, 20, errs, "BD065");
							this.#ValidateRelatedMaterial_BoxSetList(BasicDescription, errs);
						}
						break;
					case CG_REQUEST_MORE_EPISODES: // clause 6.10.5.7
						checkTopElementsAndCardinality(BasicDescription, [{ name: tva.e_RelatedMaterial, maxOccurs: 4 }], tvaEC.BasicDescription, false, errs, "BD070");
						this.#ValidateRelatedMaterial_MoreEpisodes(BasicDescription, errs);
						break;
					case CG_REQUEST_BS_CATEGORIES: // clause 6.10.5.8
						if (isParentGroup) checkTopElementsAndCardinality(BasicDescription, [{ name: tva.e_Title, maxOccurs: Infinity }], tvaEC.BasicDescription, false, errs, "BD080");
						else
							checkTopElementsAndCardinality(
								BasicDescription,
								[
									{ name: tva.e_Title, maxOccurs: Infinity },
									{ name: tva.e_Synopsis, maxOccurs: Infinity },
									{ name: tva.e_Genre, minOccurs: 0 },
									{ name: tva.e_RelatedMaterial, minOccurs: 0 },
								],
								tvaEC.BasicDescription,
								false,
								errs,
								"BD081"
							);
						this.#ValidateTitle(BasicDescription, false, false, errs, "BD082");
						if (!isParentGroup) this.#ValidateSynopsis(BasicDescription, [tva.SYNOPSIS_SHORT_LABEL], [], errs, "BD083");
						this.#ValidateGenre(BasicDescription, errs, "BD084");
						this.#ValidateRelatedMaterial_PromotionalStillImage(BasicDescription, errs);
						this.#ValidateRelatedMaterial_Pagination(BasicDescription, "Box Set Categories", errs);
						break;
					default:
						errs.addError({
							type: APPLICATION,
							code: "BD100",
							message: `ValidateBasicDescription() called with invalid requestType/element (${requestType}/${parentElement.name})`,
						});
				}
				break;
			default:
				errs.addError({
					type: APPLICATION,
					code: "BD003",
					message: `ValidateBasicDescription() called with invalid element (${parentElement.name})`,
				});
		}
	}

	/*private*/ #NotCRIDFormat(errs, error) {
		error.description = "format of a CRID is defined in clause 8 of ETSI TS 102 822";
		errs.addError(error);
	}

	/**
	 * validate the <ProgramInformation> element against the profile for the given request/response type
	 *
	 * @param {XmlElement} ProgramInformation  the element whose children should be checked
	 * @param {Array}      programCRIDs        array to record CRIDs for later use
	 * @param {Array}      groupCRIDs          array of CRIDs found in the GroupInformationTable (null if not used)
	 * @param {String}     requestType         the type of content guide request being checked
	 * @param {Array}      indexes             array of @index values from other elements in the same table - for duplicate detection
	 * @param {ErrorList}  errs                errors found in validaton
	 * @returns {String} 	CRID of the current program, if this is it
	 */
	/* private */ #ValidateProgramInformation(ProgramInformation, programCRIDs, groupCRIDs, requestType, indexes, errs) {
		if (!ProgramInformation) {
			errs.addError({
				type: APPLICATION,
				code: "PIV000",
				message: "ValidateProgramInformation() called with ProgramInformation==null",
			});
			return null;
		}

		checkTopElementsAndCardinality(
			ProgramInformation,
			[
				{ name: tva.e_BasicDescription },
				{ name: tva.e_OtherIdentifier, minOccurs: 0, maxOccurs: Infinity },
				{ name: tva.e_MemberOf, minOccurs: 0, maxOccurs: Infinity },
				{ name: tva.e_EpisodeOf, minOccurs: 0, maxOccurs: Infinity },
			],
			tvaEC.ProgramInformation,
			false,
			errs,
			"PI001"
		);
		checkAttributes(
			ProgramInformation,
			[tva.a_programId],
			[tva.a_lang],
			[tva.a_metadataOriginIDRef, tva.a_fragmentId, tva.a_fragmentVersion, tva.a_fragmentExpirationDate],
			errs,
			"PI002"
		);

		GetNodeLanguage(ProgramInformation, false, errs, "PI010");
		let isCurrentProgram = false,
			programCRID = null;

		if (ProgramInformation.attrAnyNs(tva.a_programId)) {
			programCRID = ProgramInformation.attrAnyNs(tva.a_programId).value;
			if (!isCRIDURI(programCRID))
				this.#NotCRIDFormat(errs, {
					code: "PI011",
					message: `${tva.a_programId.attribute(ProgramInformation.name)} is not a valid CRID (${programCRID})`,
					line: ProgramInformation.line,
				});
			if (isIni(programCRIDs, programCRID))
				errs.addError({
					code: "PI012",
					message: `${tva.a_programId.attribute(ProgramInformation.name)}=${programCRID.quote()} is already used`,
					line: ProgramInformation.line,
				});
			else programCRIDs.push(programCRID);
		}

		// <ProgramInformation><BasicDescription>
		this.#ValidateBasicDescription(ProgramInformation, requestType, null, errs);
		let foundCRID = null;

		ProgramInformation.childNodes()?.forEachSubElement((child) => {
			switch (child.name) {
				case tva.e_OtherIdentifier: // <ProgramInformation><OtherIdentifier>
					checkAttributes(child, [], [], tvaEA.OtherIdentifier, errs, "PI021");
					if (requestType == CG_REQUEST_MORE_EPISODES)
						errs.addError({
							code: "PI022",
							message: `${tva.e_OtherIdentifier.elementize()} is not permitted in this request type`,
							fragment: child,
							description: `The ${tva.e_OtherIdentifier.elementize()} element shall not be present in More Episodes responses.`,
							clause: "A177 table 41",
						});
					break;
				case tva.e_EpisodeOf: // <ProgramInformation><EpisodeOf>
					checkAttributes(child, [tva.a_crid], [tva.a_index], tvaEA.EpisodeOf, errs, "PI031");
					// <ProgramInformation><EpisodeOf>@crid
					foundCRID = child.attrAnyNsValueOr(tva.a_crid, null);
					if (foundCRID) {
						if (groupCRIDs && !isIni(groupCRIDs, foundCRID))
							errs.addError({
								code: "PI032",
								message: `${tva.a_crid.attribute(
									`${ProgramInformation.name}.${tva.e_EpisodeOf}`
								)}=${foundCRID.quote()} is not a defined Group CRID for ${tva.e_EpisodeOf.elementize()}`,
								fragment: child,
							});
						else if (!isCRIDURI(foundCRID))
							this.#NotCRIDFormat(errs, {
								code: "PI033",
								message: `${tva.a_crid.attribute(`${ProgramInformation.name}.${tva.e_EpisodeOf}`)}=${foundCRID.quote()} is not a valid CRID`,
								fragment: child,
							});
					}
					break;
				case tva.e_MemberOf: // <ProgramInformation><MemberOf>
					if ([CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_WINDOW].includes(requestType)) {
						// xsi:type is optional for Now/Next
						checkAttributes(child, [tva.a_index, tva.a_crid], [tva.a_type], tvaEA.MemberOf, errs, "PI041");
						if (child.attrAnyNs(tva.a_crid) && child.attrAnyNs(tva.a_crid).value == dvbi.CRID_NOW) isCurrentProgram = true;
					} else checkAttributes(child, [tva.a_type, tva.a_index, tva.a_crid], [], tvaEA.MemberOf, errs, "PI042");
					// <ProgramInformation><MemberOf>@xsi:type
					if (child.attrAnyNs(tva.a_type) && child.attrAnyNs(tva.a_type).value != tva.t_MemberOfType)
						errs.addError({
							code: "PI043",
							message: `${attribute(`xsi:${tva.a_type}`)} must be ${tva.t_MemberOfType.quote()} for ${ProgramInformation.name}.${tva.e_MemberOf}`,
							fragment: child,
							description: "The @xsi:type attribute shall always be set to MemberOfType.",
							clause: "A177 table 41",
						});
					// <ProgramInformation><MemberOf>@crid
					foundCRID = child.attrAnyNsValueOr(tva.a_crid, null);
					if (foundCRID) {
						if (groupCRIDs && !isIni(groupCRIDs, foundCRID))
							errs.addError({
								code: "PI044",
								message: `${tva.a_crid.attribute(
									`${ProgramInformation.name}.${tva.e_MemberOf}`
								)}=${foundCRID.quote()} is not a defined Group CRID for ${tva.e_MemberOf.elementize()}`,
								fragment: child,
							});
						else if (!isCRIDURI(foundCRID))
							this.#NotCRIDFormat(errs, {
								code: "PI045",
								message: `${tva.a_crid.attribute(`${ProgramInformation.name}.${tva.e_MemberOf}`)}=${foundCRID.quote()} is not a valid CRID`,
								fragment: child,
							});
					}
					// <ProgramInformation><MemberOf>@index
					/* eslint-disable no-case-declarations */
					const MO_index = child.attrAnyNsValueOr(tva.a_index, null);
					/* eslint-enable */
					if (MO_index) {
						const index = valUnsignedInt(MO_index);
						const indexInCRID = `${foundCRID ? foundCRID : "noCRID"}(${index})`;
						if (isIni(indexes, indexInCRID))
							errs.addError({
								code: "PI046",
								message: `${tva.a_index.attribute(tva.e_MemberOf)}=${index} is in use by another ${ProgramInformation.name} element`,
								fragment: child,
							});
						else indexes.push(indexInCRID);
					}
					break;
			}
		});

		return isCurrentProgram ? programCRID : null;
	}

	/**
	 * find and validate any <ProgramInformation> elements in the <ProgramInformationTable>
	 *
	 * @param {XmlElement} ProgramDescription  the element containing the <ProgramInformationTable>
	 * @param {Array}      programCRIDs        array to record CRIDs for later use
	 * @param {Array}      groupCRIDs          array of CRIDs found in the GroupInformationTable (null if not used)
	 * @param {String}     requestType         the type of content guide request being checked
	 * @param {ErrorList}  errs                errors found in validaton
	 * @param {integer}    o.childCount        the number of child elements to be present (to match GroupInformation@numOfItems)
	 * @returns {String} the CRID of the currently airing program (that which is a member of the "now" structural crid)
	 */
	/* private */ #CheckProgramInformation(ProgramDescription, programCRIDs, groupCRIDs, requestType, errs, o = null) {
		if (!ProgramDescription) {
			errs.addError({
				type: APPLICATION,
				code: "CPI000",
				message: "CheckProgramInformation() called with ProgramDescription==null",
			});
			return null;
		}

		const ProgramInformationTable = ProgramDescription.getAnyNs(tva.e_ProgramInformationTable);
		if (!ProgramInformationTable) {
			errs.addError({
				code: "PI101",
				message: `${tva.e_ProgramInformationTable.elementize()} not specified in ${ProgramDescription.name.elementize()}, line:ProgramDescription.line`,
			});
			return null;
		}
		checkAttributes(ProgramInformationTable, [], [tva.a_lang], tvaEA.ProgramInformationTable, errs, "PI102");
		GetNodeLanguage(ProgramInformationTable, false, errs, "PI103");

		let pi = 0,
			ProgramInformation,
			cnt = 0,
			indexes = [],
			currentProgramCRID = null;
		while ((ProgramInformation = ProgramInformationTable.getAnyNs(tva.e_ProgramInformation, ++pi)) != null) {
			const t = this.#ValidateProgramInformation(ProgramInformation, programCRIDs, groupCRIDs, requestType, indexes, errs);
			if (t) currentProgramCRID = t;
			cnt++;
		}

		if (o && o.childCount != 0) {
			if (o.childCount != cnt)
				errs.addError({
					code: "PI110",
					message: `number of items (${cnt}) in the ${tva.e_ProgramInformationTable.elementize()} does not match ${tva.a_numOfItems.attribute(
						tva.e_GroupInformation
					)} specified in ${CATEGORY_GROUP_NAME} (${o.childCount})`,
					line: ProgramInformationTable.line,
				});
		}
		return currentProgramCRID;
	}

	/**
	 * validate the <GroupInformation> element for Box Set related requests
	 *
	 * @param {XmlElement} GroupInformation   the element whose children should be checked
	 * @param {String}     requestType        the type of content guide request being checked
	 * @param {XmlElement} categoryGroup      the GroupInformationElement that others must refer to through <MemberOf>
	 * @param {Array}      indexes            an accumulation of the @index values found
	 * @param {Array}      groupsFound        groupId values found (null if not needed)
	 * @param {ErrorList}  errs               errors found in validaton
	 */
	/* private */ #ValidateGroupInformationBoxSets(GroupInformation, requestType, categoryGroup, indexes, groupsFound, errs) {
		if (!GroupInformation) {
			errs.addError({
				type: APPLICATION,
				code: "GIB000",
				message: "ValidateGroupInformationBoxSets() called with GroupInformation==null",
			});
			return;
		}
		const isParentGroup = GroupInformation.line == categoryGroup?.line;

		switch (requestType) {
			case CG_REQUEST_BS_CATEGORIES:
				if (isParentGroup) {
					checkAttributes(GroupInformation, [tva.a_groupId], [tva.a_lang, tva.a_ordered, tva.a_numOfItems], tvaEA.GroupInformation, errs, "GIB001");
					checkTopElementsAndCardinality(
						GroupInformation,
						[{ name: tva.e_GroupType }, { name: tva.e_BasicDescription, minOccurs: 0 }],
						tvaEC.GroupInformation,
						false,
						errs,
						"GIB002"
					);
				} else {
					checkAttributes(GroupInformation, [tva.a_groupId], [tva.a_lang], tvaEA.GroupInformation, errs, "GIB003");
					checkTopElementsAndCardinality(
						GroupInformation,
						[{ name: tva.e_GroupType }, { name: tva.e_BasicDescription, minOccurs: 0 }, { name: tva.e_MemberOf }],
						tvaEC.GroupInformation,
						false,
						errs,
						"GIB004"
					);
				}
				break;
			case CG_REQUEST_BS_LISTS:
				if (isParentGroup) {
					checkAttributes(GroupInformation, [tva.a_groupId], [tva.a_lang, tva.a_ordered, tva.a_numOfItems], tvaEA.GroupInformation, errs, "GIB005");
					checkTopElementsAndCardinality(
						GroupInformation,
						[{ name: tva.e_GroupType }, { name: tva.e_BasicDescription, minOccurs: 0 }],
						tvaEC.GroupInformation,
						false,
						errs,
						"GIB006"
					);
				} else {
					checkAttributes(GroupInformation, [tva.a_groupId], [tva.a_lang, tva.a_serviceIDRef], tvaEA.GroupInformation, errs, "GIB007");
					checkTopElementsAndCardinality(
						GroupInformation,
						[{ name: tva.e_GroupType }, { name: tva.e_BasicDescription, minOccurs: 0 }, { name: tva.e_MemberOf }],
						tvaEC.GroupInformation,
						false,
						errs,
						"GIB008"
					);
				}
				break;
			case CG_REQUEST_BS_CONTENTS:
				checkAttributes(GroupInformation, [tva.a_groupId], [tva.a_lang, tva.a_ordered, tva.a_numOfItems, tva.a_serviceIDRef], tvaEA.GroupInformation, errs, "GIB009");
				checkTopElementsAndCardinality(
					GroupInformation,
					[{ name: tva.e_GroupType }, { name: tva.e_BasicDescription, minOccurs: 0 }, { name: tva.e_MemberOf, minOccurs: 0 }],
					tvaEC.GroupInformation,
					false,
					errs,
					"GIB010"
				);
				break;
		}

		const groupId = GroupInformation.attrAnyNsValueOr(tva.a_groupId, null);
		if (groupId && isCRIDURI(groupId) && groupsFound) groupsFound.push(groupId);

		const categoryCRID = categoryGroup ? categoryGroup.attrAnyNsValueOr(tva.a_groupId, "") : "";

		if (!isParentGroup) {
			const MemberOf = GroupInformation.getAnyNs(tva.e_MemberOf);
			if (MemberOf) {
				checkAttributes(MemberOf, [tva.a_type, tva.a_index, tva.a_crid], [], tvaEA.MemberOf, errs, "GIB041");
				const member = MemberOf.attrAnyNsValueOr(tva.a_type, null);
				if (member && member != tva.t_MemberOfType)
					errs.addError({
						code: "GIB042",
						message: `${GroupInformation.name}.${tva.e_MemberOf}@xsi:${tva.a_type} is invalid (${MemberOf.attrAnyNs(tva.a_type).value.quote()})`,
						fragment: MemberOf,
					});
				if (MemberOf.attrAnyNs(tva.a_index)) {
					const index = valUnsignedInt(MemberOf.attrAnyNs(tva.a_index).value);
					if (index >= 1) {
						if (indexes) {
							if (DuplicatedValue(indexes, index))
								errs.addError({
									code: "GI043",
									message: `duplicated ${tva.a_index.attribute(`${GroupInformation.name}.${tva.e_MemberOf}`)} values (${index})`,
									fragment: MemberOf,
								});
						}
					} else
						errs.addError({
							code: "GIB44",
							message: `${tva.a_index.attribute(`${GroupInformation.name}.${tva.e_MemberOf}`)} must be an integer >= 1 (parsed ${index})`,
							fragment: MemberOf,
						});
				}
				const crid = MemberOf.attrAnyNsValueOr(tva.a_crid, null);
				if (crid && crid != categoryCRID)
					errs.addError({
						code: "GIB045",
						message: `${tva.a_crid.attribute(`${GroupInformation.name}.${tva.e_MemberOf}`)} (${crid}) does not match the ${CATEGORY_GROUP_NAME} crid (${categoryCRID})`,
						fragment: MemberOf,
					});
			} else
				errs.addError({
					code: "GIB046",
					message: `${GroupInformation.name} requires a ${tva.e_MemberOf.elementize()} element referring to the ${CATEGORY_GROUP_NAME} (${categoryCRID})`,
					line: GroupInformation.line,
				});
		}

		this.#checkTAGUri(GroupInformation, errs, "GIB51");

		// <GroupInformation><BasicDescription>
		this.#ValidateBasicDescription(GroupInformation, requestType, categoryGroup, errs);
	}

	/**
	 * validate the <GroupInformation> element for Schedules related requests
	 *
	 * @param {XmlElement} GroupInformation   the element whose children should be checked
	 * @param {String}     requestType        the type of content guide request being checked
	 * @param {XmlElement} categoryGroup      the GroupInformationElement that others must refer to through <MemberOf>
	 * @param {ErrorList}  errs               errors found in validaton
	 */
	/* private */ #ValidateGroupInformationSchedules(GroupInformation, requestType, categoryGroup, errs) {
		if (!GroupInformation) {
			errs.addError({
				type: APPLICATION,
				code: "GIS000",
				message: "ValidateGroupInformationSchedules() called with GroupInformation==null",
			});
			return;
		}
		checkAttributes(GroupInformation, [tva.a_groupId, tva.a_ordered, tva.a_numOfItems], [tva.a_lang], tvaEA.GroupInformation, errs, "GIS001");

		const groupId = GroupInformation.attrAnyNsValueOr(tva.a_groupId, null);
		if (groupId && [CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_WINDOW].includes(requestType))
			if (![dvbi.CRID_NOW, dvbi.CRID_LATER, dvbi.CRID_EARLIER].includes(groupId))
				errs.addError({
					code: "GIS011",
					message: `${tva.a_groupId.attribute(GroupInformation.name)} value ${groupId.quote()} is not valid for this request type`,
					line: GroupInformation.line,
				});

		if ([CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_WINDOW].includes(requestType)) {
			TrueValue(GroupInformation, tva.a_ordered, errs, "GIS013");
			if (!GroupInformation.attrAnyNs(tva.a_numOfItems))
				errs.addError({
					code: "GIS015",
					message: `${tva.a_numOfItems.attribute(GroupInformation.name)} is required for this request type`,
					line: GroupInformation.line,
				});
		}

		// <GroupInformation><BasicDescription>
		this.#ValidateBasicDescription(GroupInformation, requestType, categoryGroup, errs);
	}

	/**
	 * validate the <GroupInformation> element for More Episodes requests
	 *
	 * @param {XmlElement} GroupInformation    the element whose children should be checked
	 * @param {String}     requestType         the type of content guide request being checked
	 * @param {XmlElement} categoryGroup       the GroupInformationElement that others must refer to through <MemberOf>
	 * @param {Array}      groupsFound         groupId values found (null if not needed)
	 * @param {ErrorList}  errs                errors found in validaton
	 */
	/* private */ #ValidateGroupInformationMoreEpisodes(GroupInformation, requestType, categoryGroup, groupsFound, errs) {
		if (!GroupInformation) {
			errs.addError({
				type: APPLICATION,
				code: "GIM000",
				message: "ValidateGroupInformationMoreEpisodes() called with GroupInformation==null",
			});
			return;
		}
		if (categoryGroup)
			errs.addError({
				code: "GIM001",
				message: `${CATEGORY_GROUP_NAME} should not be specified for this request type`,
				line: GroupInformation.line,
			});

		checkAttributes(GroupInformation, [tva.a_groupId, tva.a_ordered, tva.a_numOfItems], [tva.a_lang], tvaEA.GroupInformation, errs, "GIM002");

		if (GroupInformation.attrAnyNs(tva.a_groupId)) {
			const groupId = GroupInformation.attrAnyNs(tva.a_groupId).value;
			if (!isCRIDURI(groupId))
				this.#NotCRIDFormat(errs, {
					code: "GIM003",
					message: `${tva.a_groupId.attribute(GroupInformation.name)} value ${groupId.quote()} is not a valid CRID`,
					line: GroupInformation.line,
				});
			else groupsFound.push(groupId);
		}

		TrueValue(GroupInformation, tva.a_ordered, errs, "GIM004", false);

		const GroupType = GroupInformation.getAnyNs(tva.e_GroupType);
		if (GroupType) {
			checkAttributes(GroupType, [tva.a_type, tva.a_value], [], tvaEA.GroupType, errs, "GIM011");

			const GroupType_type = GroupType.attrAnyNsValueOr(tva.a_type, null);
			if (GroupType_type && GroupType_type != tva.t_ProgramGroupTypeType)
				errs.addError({
					code: "GIM012",
					message: `${tva.e_GroupType}@xsi:${tva.a_type} must be ${tva.t_ProgramGroupTypeType.quote()}`,
					fragment: GroupType,
				});
			const GroupTYpe_value = GroupType.attrAnyNsValueOr(tva.a_value, null);
			if (GroupTYpe_value && GroupTYpe_value != tva.v_otherCollection)
				errs.addError({
					code: "GIM013",
					message: `${tva.a_value.attribute(tva.e_GroupType)} must be ${tva.v_otherCollection.quote()}`,
					fragment: GroupType,
				});
		} else
			errs.addError({
				code: "GIM014",
				message: `${tva.e_GroupType.elementize()} is required in ${GroupInformation.name.elementize()}`,
				line: GroupInformation.line,
			});

		// <GroupInformation><BasicDescription>
		this.#ValidateBasicDescription(GroupInformation, requestType, categoryGroup, errs);
	}

	/**
	 * validate the <GroupInformation> element against the profile for the given request/response type
	 *
	 * @param {XmlElement} GroupInformation   the element whose children should be checked
	 * @param {String}     requestType        the type of content guide request being checked
	 * @param {XmlElement} categoryGroup      the GroupInformationElement that others must refer to through <MemberOf>
	 * @param {Array}      indexes            an accumulation of the @index values found
	 * @param {Array}      groupsFound        groupId values found (null if not needed)
	 * @param {ErrorList}  errs               errors found in validaton
	 */
	/* private */ #ValidateGroupInformation(GroupInformation, requestType, categoryGroup, indexes, groupsFound, errs) {
		if (!GroupInformation) {
			errs.addError({
				type: APPLICATION,
				code: "GI000",
				message: "ValidateGroupInformation() called with GroupInformation==null",
			});
			return;
		}

		GetNodeLanguage(GroupInformation, false, errs, "GI001");

		switch (requestType) {
			case CG_REQUEST_SCHEDULE_NOWNEXT:
			case CG_REQUEST_SCHEDULE_WINDOW:
				this.#ValidateGroupInformationSchedules(GroupInformation, requestType, categoryGroup, errs);
				break;
			case CG_REQUEST_BS_CATEGORIES:
			case CG_REQUEST_BS_LISTS:
			case CG_REQUEST_BS_CONTENTS:
				this.#ValidateGroupInformationBoxSets(GroupInformation, requestType, categoryGroup, indexes, groupsFound, errs);
				break;
			case CG_REQUEST_MORE_EPISODES:
				this.#ValidateGroupInformationMoreEpisodes(GroupInformation, requestType, categoryGroup, groupsFound, errs);
				break;
		}

		const GroupType = GroupInformation.getAnyNs(tva.e_GroupType);
		if (GroupType) {
			const _type = GroupType.attrAnyNs(tva.a_type);
			if (!(_type && _type.value == tva.t_ProgramGroupTypeType))
				errs.addError({
					code: "GI011",
					message: `${tva.e_GroupType}@xsi:${tva.a_type}=${tva.t_ProgramGroupTypeType.quote()} is required`,
					fragment: GroupType,
				});
			if (!(GroupType.attrAnyNs(tva.a_value) && GroupType.attrAnyNs(tva.a_value).value == tva.v_otherCollection))
				errs.addError({
					code: "GI022",
					message: `${tva.a_value.attribute(tva.e_GroupType)}=${tva.v_otherCollection.quote()} is required`,
					fragment: GroupType,
				});
		} else
			errs.addError({
				code: "GI014",
				message: `${tva.e_GroupType.elementize()} is required in ${GroupInformation.name.elementize()}`,
				line: GroupInformation.line,
			});
	}

	/**
	 * find and validate any <GroupInformation> elements in the <GroupInformationTable>
	 *
	 * @param {XmlElement} ProgramDescription  the element containing the <ProgramInformationTable>
	 * @param {String}     requestType         the type of content guide request being checked
	 * @param {Array}      groupIds            buffer to recieve the group ids parsed (null if not needed)
	 * @param {ErrorList}  errs                errors found in validaton
	 * @param {integer}    o.childCount        the value from the @numItems attribute of the "category group"
	 */
	/* private */ #CheckGroupInformation(ProgramDescription, requestType, groupIds, errs, o) {
		if (requestType == CG_REQUEST_BS_CONTENTS) {
			this.#CheckGroupInformationBoxsetContents(ProgramDescription, requestType, groupIds, errs, o);
			return;
		}
		if (!ProgramDescription) {
			errs.addError({
				type: APPLICATION,
				code: "GI000",
				message: "CheckGroupInformation() called with ProgramDescription==null",
			});
			return;
		}

		const GroupInformationTable = ProgramDescription.getAnyNs(tva.e_GroupInformationTable);
		if (!GroupInformationTable) {
			//errs.addError({code:"GI101", message:`${tva.e_GroupInformationTable.elementize()} not specified in ${ProgramDescription.name.elementize()}`, line:ProgramDescription.line});
			return;
		}

		GetNodeLanguage(GroupInformationTable, false, errs, "GI102");

		let gi, GroupInformation;
		// find which GroupInformation element is the "category group"
		let categoryGroup = null;
		if ([CG_REQUEST_BS_LISTS, CG_REQUEST_BS_CATEGORIES].includes(requestType)) {
			gi = 0;
			while ((GroupInformation = GroupInformationTable.getAnyNs(tva.e_GroupInformation, ++gi)) != null) {
				// this GroupInformation element is the "category group" if it does not contain a <MemberOf> element
				if (CountChildElements(GroupInformation, tva.e_MemberOf) == 0) {
					// this GroupInformation element is not a member of another GroupInformation so it must be the "category group"
					if (categoryGroup)
						errs.addError({
							code: "GI111",
							message: `only a single ${CATEGORY_GROUP_NAME} can be present in ${tva.e_GroupInformationTable.elementize()}`,
							line: GroupInformation.line,
						});
					else categoryGroup = GroupInformation;
				}
			}
			if (!categoryGroup)
				errs.addError({
					code: "GI112",
					message: `a ${CATEGORY_GROUP_NAME} must be specified in ${tva.e_GroupInformationTable.elementize()} for this request type`,
					line: GroupInformationTable.line,
				});
		}

		let indexes = [],
			giCount = 0;
		gi = 0;
		while ((GroupInformation = GroupInformationTable.getAnyNs(tva.e_GroupInformation, ++gi)) != null) {
			this.#ValidateGroupInformation(GroupInformation, requestType, categoryGroup, indexes, groupIds, errs);
			if (categoryGroup && GroupInformation.line != categoryGroup.line) giCount++;
		}
		if (categoryGroup) {
			const numOfItems = categoryGroup.attrAnyNs(tva.a_numOfItems) ? valUnsignedInt(categoryGroup.attrAnyNs(tva.a_numOfItems).value) : 0;
			if (requestType != CG_REQUEST_BS_CONTENTS && numOfItems != giCount)
				errs.addError({
					code: "GI113",
					message: `${tva.a_numOfItems.attribute(tva.e_GroupInformation)} specified in ${CATEGORY_GROUP_NAME} (${numOfItems}) does match the number of items (${giCount})`,
					line: categoryGroup.line,
					key: "mismatch count",
				});
			if (o) o.childCount = numOfItems;
		}

		if (requestType == CG_REQUEST_MORE_EPISODES && giCount > 1)
			errs.addError({
				code: "GI114",
				message: `only one ${tva.e_GroupInformation.elementize()} element is premitted for this request type`,
				line: GroupInformationTable.line,
			});
	}

	/**
	 * find and validate any <GroupInformation> elements in the <GroupInformationTable> for a Boxset Contents response
	 *
	 * @param {XmlElement} ProgramDescription  the element containing the <ProgramInformationTable>
	 * @param {String}     requestType         the type of content guide request being checked
	 * @param {Array}      groupIds            buffer to recieve the group ids parsed (null if not needed)
	 * @param {ErrorList}  errs                errors found in validaton
	 * @param {integer}    o.childCount        the value from the @numItems attribute of the "category group"
	 */
	/* private */ #CheckGroupInformationBoxsetContents(ProgramDescription, requestType, groupIds, errs, o) {
		if (!ProgramDescription) {
			errs.addError({
				type: APPLICATION,
				code: "GIC000",
				message: "CheckGroupInformationBoxsetContents() called with ProgramDescription==null",
			});
			return;
		}
		if (requestType != CG_REQUEST_BS_CONTENTS) {
			errs.addError({
				type: APPLICATION,
				code: "GIC001",
				message: `CheckGroupInformationBoxsetContents() called invalid requestType (${requestType})`,
			});
			return;
		}
		const GroupInformationTable = ProgramDescription.getAnyNs(tva.e_GroupInformationTable);
		if (!GroupInformationTable) {
			//errs.addError({code:"GIC101", message:`${tva.e_GroupInformationTable.elementize()} not specified in ${ProgramDescription.name.elementize()}`, line:ProgramDescription.line});
			return;
		}
		const ERROR_KEY = "boxset contents";

		GetNodeLanguage(GroupInformationTable, false, errs, "GIC102");

		// Check all category groups (main and descendant)
		// find which GroupInformation element is the "category group"
		let contentsGroup = null,
			gi = 0,
			GroupInformation;
		while ((GroupInformation = GroupInformationTable.getAnyNs(tva.e_GroupInformation, ++gi)) != null) {
			// this GroupInformation element is the "contents group" if it does not contain a <MemberOf> element
			if (CountChildElements(GroupInformation, tva.e_MemberOf) == 0) {
				// this GroupInformation element is not a member of another GroupInformation so it must be the "contents group"
				checkTopElementsAndCardinality(GroupInformation, [{ name: tva.e_GroupType }, { name: tva.e_BasicDescription }], tvaEC.GroupInformation, false, errs, "GIC111");
				if (contentsGroup)
					errs.addError({
						code: "GIC112",
						message: `only a single Contents group (a ${tva.e_GroupInformation} without a ${tva.e_MemberOf} child element) can be present in ${tva.e_GroupInformationTable.elementize()}`,
						line: GroupInformation.line,
						key: ERROR_KEY,
					});
				else contentsGroup = GroupInformation;
			} else
				checkTopElementsAndCardinality(
					GroupInformation,
					[{ name: tva.e_GroupType }, { name: tva.e_BasicDescription }, { name: tva.e_MemberOf }],
					tvaEC.GroupInformation,
					false,
					errs,
					"GIC113"
				);
			if (GroupInformation.attrAnyNs(tva.a_groupId)) groupIds.push(GroupInformation.attrAnyNs(tva.a_groupId).value);
		}
		if (!contentsGroup)
			errs.addError({
				code: "GIC115",
				message: `a Contents group (a ${tva.e_GroupInformation} element without a ${tva.e_MemberOf} child element) must be specified in ${tva.e_GroupInformationTable.elementize()} for this request type`,
				line: GroupInformationTable.line,
				key: ERROR_KEY,
			});

		// each series group (GroupInformation that includes a <Memberof> child element) must descend from the Contents group
		if (contentsGroup) {
			const cgCRID = contentsGroup.attrAnyNs(tva.a_groupId) ? contentsGroup.attrAnyNs(tva.a_groupId).value : "none";
			gi = 0;
			while ((GroupInformation = GroupInformationTable.getAnyNs(tva.e_GroupInformation, ++gi)) != null) {
				if (GroupInformation.line != contentsGroup.line) {
					const MemberOf = GroupInformation.getAnyNs(tva.e_MemberOf);
					if (MemberOf) {
						const MemberOf_crid = MemberOf.attrAnyNsValueOr(tva.a_crid, null);
						if (MemberOf_crid && MemberOf_crid != cgCRID)
							errs.addError({
								code: "GIC120",
								message: `series group must have ${tva.a_crid.attribute(tva.e_MemberOf)} referring to the category group`,
								fragment: MemberOf,
								key: ERROR_KEY,
							});
						const MemberOf_type = MemberOf.attrAnyNsValueOr(tva.a_type, null);
						if (MemberOf_type && MemberOf_type != tva.t_MemberOfType)
							errs.addError({
								code: "GIC121",
								message: `${attribute(`xsi:${tva.a_type}`)} must be ${tva.t_MemberOfType.quote()} for ${GroupInformation.name}.${MemberOf.name}`,
								fragment: MemberOf,
							});
					}
				}
			}
		}
	}

	/**
	 * validate the <GroupInformation> element against the profile for the given request/response type
	 *
	 * @param {XmlElement} GroupInformation    the element whose children should be checked
	 * @param {String}     requestType         the type of content guide request being checked
	 * @param {integer}    numEarlier          maximum number of <GroupInformation> elements that are earlier
	 * @param {integer}    numNow              maximum number of <GroupInformation> elements that are now
	 * @param {integer}    numLater            maximum number of <GroupInformation> elements that are later
	 * @param {Array}      groupCRIDsFound     list of structural crids already found in this response
	 * @param {ErrorList}  errs                errors found in validaton
	 */
	/* private */ #ValidateGroupInformationNowNext(GroupInformation, requestType, numEarlier, numNow, numLater, groupCRIDsFound, errs) {
		function validValues(errs, numOfItems, numAllowed, grp, element) {
			if (numOfItems <= 0)
				errs.addError({
					code: "VNN101",
					message: `${tva.a_numOfItems.attribute(tva.e_GroupInformation)} must be > 0 for ${grp.quote()}`,
					line: element.line,
				});
			if (numOfItems > numAllowed)
				errs.addError({
					code: "VNN102",
					message: `${tva.a_numOfItems.attribute(tva.e_GroupInformation)} must be <= ${numAllowed} for ${grp.quote()}`,
					line: element.line,
				});
		}

		if (!GroupInformation) {
			errs.addError({
				type: APPLICATION,
				code: "VNN000",
				message: "ValidateGroupInformationNowNext() called with GroupInformation==null",
			});
			return;
		}

		// NOWNEXT and WINDOW GroupInformationElements contains the same syntax as other GroupInformationElements
		this.#ValidateGroupInformation(GroupInformation, requestType, null, null, null, errs);

		const GroupInformation_groupId = GroupInformation.attrAnyNsValueOr(tva.a_groupId, null);
		if (GroupInformation_groupId) {
			if (
				(GroupInformation_groupId == dvbi.CRID_EARLIER && numEarlier > 0) ||
				(GroupInformation_groupId == dvbi.CRID_NOW && numNow > 0) ||
				(GroupInformation_groupId == dvbi.CRID_LATER && numLater > 0)
			) {
				const numOfItems = GroupInformation.attrAnyNs(tva.a_numOfItems) ? valUnsignedInt(GroupInformation.attrAnyNs(tva.a_numOfItems).value) : -1;
				switch (GroupInformation_groupId) {
					case dvbi.CRID_EARLIER:
						validValues(errs, numOfItems, numEarlier, GroupInformation_groupId, GroupInformation);
						break;
					case dvbi.CRID_NOW:
						validValues(errs, numOfItems, numNow, GroupInformation_groupId, GroupInformation);
						break;
					case dvbi.CRID_LATER:
						validValues(errs, numOfItems, numLater, GroupInformation_groupId, GroupInformation);
						break;
				}
				if (isIni(groupCRIDsFound, GroupInformation_groupId))
					errs.addError({
						code: "VNN001",
						message: `only a single ${GroupInformation_groupId.quote()} structural CRID is premitted in this request`,
						line: GroupInformation.line,
					});
				else groupCRIDsFound.push(GroupInformation_groupId);
			} else
				errs.addError({
					code: "VNN002",
					message: `${tva.e_GroupInformation.elementize()} for ${GroupInformation_groupId.quote()} is not permitted for this request type`,
					line: GroupInformation.line,
				});
		}
	}

	/**
	 * find and validate any <GroupInformation> elements used for now/next in the <GroupInformationTable>
	 *
	 * @param {XmlElement} ProgramDescription  the element containing the <ProgramInformationTable>
	 * @param {Array}      groupIds            array of GroupInformation@CRID values found
	 * @param {String}     requestType         the type of content guide request being checked
	 * @param {ErrorList}  errs                errors found in validaton
	 */
	/* private */ #CheckGroupInformationNowNext(ProgramDescription, groupIds, requestType, errs) {
		if (!ProgramDescription) {
			errs.addError({
				type: APPLICATION,
				code: "NN000",
				message: "CheckGroupInformationNowNext() called with ProgramDescription==null",
			});
			return;
		}

		const GroupInformationTable = ProgramDescription.getAnyNs(tva.e_GroupInformationTable);
		if (!GroupInformationTable) {
			errs.addError({
				code: "NN001",
				message: `${tva.e_GroupInformationTable.elementize()} not specified in ${ProgramDescription.name.elementize()}`,
				line: ProgramDescription.line,
			});
			return;
		}
		GetNodeLanguage(GroupInformationTable, false, errs, "NM002");

		let gi = 0,
			GroupInformation;
		while ((GroupInformation = GroupInformationTable.getAnyNs(tva.e_GroupInformation, ++gi)) != null) {
			switch (requestType) {
				case CG_REQUEST_SCHEDULE_NOWNEXT:
					this.#ValidateGroupInformationNowNext(GroupInformation, requestType, 0, 1, 1, groupIds, errs);
					break;
				case CG_REQUEST_SCHEDULE_WINDOW:
					this.#ValidateGroupInformationNowNext(GroupInformation, requestType, 10, 1, 10, groupIds, errs);
					break;
				default:
					errs.addError({
						code: "NN003",
						message: `${tva.e_GroupInformation.elementize()} not processed for this request type`,
						line: GroupInformation.line,
					});
			}
		}
	}

	/**
	 * validate any <AVAttributes> elements in <InstanceDescription> elements
	 *
	 * @param {XmlElement} AVAttributes            the <AVAttributes> node to be checked
	 * @param {ClassificationScheme} AudioCodecCS  loaded classification scheme terms
	 * @param {ErrorList}  errs                    errors found in validaton
	 */
	/* private */ #ValidateAVAttributes(AVAttributes, AudioCodecCS, errs) {
		if (!AVAttributes) {
			errs.addError({
				type: APPLICATION,
				code: "AV000",
				message: "ValidateAVAttributes() called with AVAttributes==null",
			});
			return;
		}

		let isValidAudioMixType = (mixType) => [mpeg7.AUDIO_MIX_MONO, mpeg7.AUDIO_MIX_STEREO, mpeg7.AUDIO_MIX_5_1].includes(mixType);

		let profiledAudioPurposeCS = [dvbi.AUDIO_PURPOSE_MAIN];
		if (CG_SchemaVersion(AVAttributes.documentNamespace()) < cgVersions.r2)
			profiledAudioPurposeCS.push(dvbi.AUDIO_PURPOSE_VISUAL_IMPAIRED, dvbi.AUDIO_PURPOSE_HEARING_IMPAIRED, dvbi.AUDIO_PURPOSE_DIALOGUE_ENHANCEMENT);
		let isValidAudioLanguagePurpose = (purpose) => profiledAudioPurposeCS.includes(purpose);

		checkTopElementsAndCardinality(
			AVAttributes,
			CG_SchemaVersion(AVAttributes.documentNamespace()) >= cgVersions.r2
				? [
						{ name: tva.e_AudioAttributes, minOccurs: 0, maxOccurs: Infinity },
						{ name: tva.e_VideoAttributes, minOccurs: 0, maxOccurs: Infinity },
						{ name: tva.e_AccessibilityAttributes, minOccurs: 0 },
					]
				: [
						{ name: tva.e_AudioAttributes, minOccurs: 0, maxOccurs: Infinity },
						{ name: tva.e_VideoAttributes, minOccurs: 0, maxOccurs: Infinity },
						{ name: tva.e_CaptioningAttributes, minOccurs: 0, maxOccurs: Infinity },
					],
			tvaEC.AVAttributes,
			false,
			errs,
			"AV001"
		);

		// <AudioAttributes>
		let aa = 0,
			AudioAttributes,
			foundAttributes = [],
			audioCounts = [];
		while ((AudioAttributes = AVAttributes.getAnyNs(tva.e_AudioAttributes, ++aa)) != null) {
			checkTopElementsAndCardinality(
				AudioAttributes,
				[
					{ name: tva.e_Coding, minOccurs: 0 },
					{ name: tva.e_MixType, minOccurs: 0 },
					{ name: tva.e_AudioLanguage, minOccurs: 0 },
				],
				tvaEC.AudioAttributes,
				false,
				errs,
				"AV010"
			);

			const Coding = AudioAttributes.getAnyNs(tva.e_Coding);
			let Coding_val = undefined;
			if (Coding) {
				checkAttributes(MixType, [tva.a_href], [], tvaEA.MixType, errs, "AV006");
				if (Coding.attrAnyNs(tva.a_href)) {
					Coding_val = Coding.attrAnyNs(tva.a_href).value;
					if (AudioCodecCS.count() && !AudioCodecCS.isIn(Coding_val))
						errs.addError({
							code: "AV007",
							message: `${tva.e_AudioAttributes}.${tva.e_Coding} is not valid`,
							fragment: Coding,
						});
				}
			}

			const MixType = AudioAttributes.getAnyNs(tva.e_MixType);
			let MixType_val = undefined;
			if (MixType) {
				checkAttributes(MixType, [tva.a_href], [], tvaEA.MixType, errs, "AV011");
				if (MixType.attrAnyNs(tva.a_href)) {
					MixType_val = MixType.attrAnyNs(tva.a_href).value;
					if (!isValidAudioMixType(MixType_val))
						errs.addError({
							code: "AV012",
							message: `${tva.e_AudioAttributes}.${tva.e_MixType} is not valid`,
							fragment: MixType,
						});
				}
			}

			const AudioLanguage = AudioAttributes.getAnyNs(tva.e_AudioLanguage);
			if (AudioLanguage) {
				checkAttributes(AudioLanguage, [tva.a_purpose], [], tvaEA.AudioLanguage, errs, "AV013");
				let validLanguage = false,
					validPurpose = false,
					audioLang = AudioLanguage.content;
				if (AudioLanguage.attrAnyNs(tva.a_purpose)) {
					if (!(validPurpose = isValidAudioLanguagePurpose(AudioLanguage.attrAnyNs(tva.a_purpose).value)))
						errs.addError({
							code: "AV014",
							message: `${tva.a_purpose.attribute(tva.e_AudioLanguage)} is not valid`,
							fragment: AudioLanguage,
						});
				}

				validLanguage = checkLanguage(audioLang, AudioLanguage, errs, "AV015");

				if (validLanguage && validPurpose) {
					if (audioCounts[audioLang] === undefined) audioCounts[audioLang] = [AudioLanguage];
					else audioCounts[audioLang].push(AudioLanguage);

					const combo = `${Coding_val ? Coding_val : "dflt"}!--!${MixType_val ? MixType_val : "dflt"}!--!${audioLang}!--!${AudioLanguage.attrAnyNs(tva.a_purpose).value}`;
					if (isIn(foundAttributes, combo))
						errs.addError({
							code: "AV016",
							message: `audio ${tva.a_purpose.attribute()} ${AudioLanguage.attrAnyNs(tva.a_purpose).value.quote()} already specified for language ${audioLang.quote()}`,
							fragment: AudioLanguage,
						});
					else foundAttributes.push(combo);
				}
			}
		}
		audioCounts.forEach((audioLanguage) => {
			if (audioCounts[audioLanguage].length > 2)
				errs.addError({
					code: "AV020",
					message: `more than 2 ${tva.e_AudioAttributes.elementize()} elements for language ${audioLanguage.quote()}`,
					multiElementError: audioCounts[audioLanguage],
				});
		});

		// <VideoAttributes>
		let va = 0,
			VideoAttributes;
		while ((VideoAttributes = AVAttributes.getAnyNs(tva.e_VideoAttributes, ++va)) != null) {
			checkTopElementsAndCardinality(
				VideoAttributes,
				[
					{ name: tva.e_HorizontalSize, minOccurs: 0 },
					{ name: tva.e_VerticalSize, minOccurs: 0 },
					{ name: tva.e_AspectRatio, minOccurs: 0 },
				],
				tvaEC.VideoAttributes,
				false,
				errs,
				"AV030"
			);
		}

		// <CaptioningAttributes>
		const CaptioningAttributes = AVAttributes.getAnyNs(tva.e_CaptioningAttributes);
		if (CaptioningAttributes) {
			checkTopElementsAndCardinality(CaptioningAttributes, [{ name: tva.e_Coding, minOccurs: 0 }], tvaEC.CaptioningAttributes, false, errs, "AV040");

			const Coding = CaptioningAttributes.getAnyNs(tva.e_Coding);
			if (Coding) {
				checkAttributes(Coding, [tva.a_href], [], tvaEA.Coding, errs, "AV041");
				const codingHref = Coding.attrAnyNsValueOr(tva.a_href, null);
				if (codingHref && ![dvbi.DVB_BITMAP_SUBTITLES, dvbi.DVB_CHARACTER_SUBTITLES, dvbi.EBU_TT_D].includes(codingHref))
					errs.addError({
						code: "AV042",
						message: `${tva.a_href.attribute(`${tva.e_CaptioningAttributes}.${tva.e_Coding}`)} is not valid - should be DVB (bitmap or character) or EBU TT-D`,
						fragment: Coding,
					});
			}
		}

		// <AccessibilityAttributes>
		const AccessibilityAttributes = AVAttributes.getAnyNs(tva.e_AccessibilityAttributes);
		if (AccessibilityAttributes) {
			CheckAccessibilityAttributes(
				AccessibilityAttributes,
				{
					AccessibilityPurposeCS: this.#accessibilityPurposes,
					RequiredStandardVersionCS: this.RequiredStandardVersionCS,
					RequiredOptionalFeatureCS: this.RequiredOptionalFeatureCS,
					VideoCodecCS: this.#allowedVideoSchemes,
					AudioCodecCS: this.#allowedAudioSchemes,
					SubtitleCarriageCS: this.#subtitleCarriages,
					SubtitleCodingFormatCS: this.#subtitleCodings,
					SubtitlePurposeTypeCS: this.#subtitlePurposes,
					KnownLanguages: this.#knownLanguages,
					AudioPresentationCS: this.#audioPresentationCSvalues,
				},
				errs,
				"AV051"
			);
		}
	}

	/**
	 * validate a <RelatedMaterial> element conforms to the Restart Application Linking rules (A177r1 clause 6.5.5)
	 *
	 * @param {XmlElement} RelatedMaterial  the <RelatedMaterial> node to be checked
	 * @param {ErrorList}  errs             errors found in validaton
	 * @returns {boolean}	true if this RelatedMaterial element contains a restart link (proper HowRelated@href and MediaLocator.MediaUri and MediaLocator.AuxiliaryURI)
	 */
	/* private */ #ValidateRestartRelatedMaterial(RelatedMaterial, errs) {
		if (!RelatedMaterial) {
			errs.addError({
				type: APPLICATION,
				code: "RR000",
				message: "ValidateRestartRelatedMaterial() called with RelatedMaterial==null",
			});
			return false;
		}

		let isRestartLink = (str) => str == dvbi.RESTART_LINK;

		let isRestart = checkTopElementsAndCardinality(RelatedMaterial, [{ name: tva.e_HowRelated }, { name: tva.e_MediaLocator }], tvaEC.RelatedMaterial, false, errs, "RR001");

		let HowRelated = RelatedMaterial.getAnyNs(tva.e_HowRelated);
		if (HowRelated) {
			checkAttributes(HowRelated, [tva.a_href], [], tvaEA.HowRelated, errs, "RR002");
			const HowRelated_href = HowRelated.attrAnyNsValueOr(tva.a_href, null);
			if (HowRelated_href) {
				if (!isRestartLink(HowRelated_href)) {
					errs.addError({
						code: "RR003",
						message: `invalid ${tva.a_href.attribute(tva.e_HowRelated)} (${HowRelated_href}) for Restart Application Link`,
						fragment: HowRelated,
					});
					isRestart = false;
				}
			}
		}

		const MediaLocator = RelatedMaterial.getAnyNs(tva.e_MediaLocator);
		if (MediaLocator)
			if (!checkTopElementsAndCardinality(MediaLocator, [{ name: tva.e_MediaUri }, { name: tva.e_AuxiliaryURI }], tvaEC.MediaLocator, true, errs, "RR003")) isRestart = false;

		return isRestart;
	}

	/**
	 * validate any <InstanceDescription> elements in the <ScheduleEvent> and <OnDemandProgram> elements
	 *
	 * @param {String}     VerifyType            the type of verification to perform (OnDemandProgram | ScheduleEvent)
	 * @param {XmlElement} InstanceDescription   the <InstanceDescription> node to be checked
	 * @param {boolean}    isCurrentProgram      indicates if this <InstanceDescription> element is for the currently airing program
	 * @param {ErrorList}  errs                  errors found in validaton
	 */
	/* private */ #ValidateInstanceDescription(VerifyType, InstanceDescription, isCurrentProgram, errs) {
		if (!InstanceDescription) {
			errs.addError({
				type: APPLICATION,
				code: "ID000",
				message: "ValidateInstanceDescription() called with InstanceDescription==null",
			});
			return;
		}

		function checkGenre(genre, errs, errcode) {
			if (!genre) return null;
			checkAttributes(genre, [tva.a_href], [tva.a_type], tvaEA.Genre, errs, `${errcode}-1`);
			const GenreType = genre.attrAnyNsValueOr(tva.a_type, tva.DEFAULT_GENRE_TYPE);
			if (GenreType != tva.GENRE_TYPE_OTHER)
				errs.addError({
					code: `${errcode}-2`,
					message: `${tva.a_type.attribute(`${genre.parent.name}.${genre.name}`)} must contain ${tva.GENRE_TYPE_OTHER.quote()}`,
					fragment: genre,
				});
			return genre.attrAnyNsValueOr(tva.a_href, null);
		}

		let isMediaAvailability = (str) => [dvbi.MEDIA_AVAILABLE, dvbi.MEDIA_UNAVAILABLE].includes(str);
		let isEPGAvailability = (str) => [dvbi.FORWARD_EPG_AVAILABLE, dvbi.FORWARD_EPG_UNAVAILABLE].includes(str);
		let isAvailability = (str) => isMediaAvailability(str) || isEPGAvailability(str);

		switch (VerifyType) {
			case tva.e_OnDemandProgram:
				/* eslint-disable no-case-declarations */
				const allowedODChildren =
					CG_SchemaVersion(InstanceDescription.documentNamespace()) < cgVersions.r2
						? [
								{ name: tva.e_Genre, minOccurs: 2, maxOccurs: 2 },
								{ name: tva.e_CaptionLanguage, minOccurs: 0 },
								{ name: tva.e_SignLanguage, minOccurs: 0 },
								{ name: tva.e_AVAttributes, minOccurs: 0 },
								{ name: tva.e_OtherIdentifier, minOccurs: 0, maxOccurs: Infinity },
							]
						: [
								{ name: tva.e_Genre, minOccurs: 2, maxOccurs: 2 },
								{ name: tva.e_AVAttributes, minOccurs: 0 },
								{ name: tva.e_OtherIdentifier, minOccurs: 0, maxOccurs: Infinity },
							];
				/* eslint-enable */
				checkTopElementsAndCardinality(InstanceDescription, allowedODChildren, tvaEC.InstanceDescription, false, errs, "ID001");
				break;
			case tva.e_ScheduleEvent:
				/* eslint-disable no-case-declarations */
				const allowedSEChildren =
					CG_SchemaVersion(InstanceDescription.documentNamespace()) < cgVersions.r2
						? [
								{ name: tva.e_Genre, minOccurs: 0 },
								{ name: tva.e_CaptionLanguage, minOccurs: 0 },
								{ name: tva.e_SignLanguage, minOccurs: 0 },
								{ name: tva.e_AVAttributes, minOccurs: 0 },
								{ name: tva.e_OtherIdentifier, minOccurs: 0, maxOccurs: Infinity },
								{ name: tva.e_RelatedMaterial, minOccurs: 0 },
							]
						: [
								{ name: tva.e_Genre, minOccurs: 0 },
								{ name: tva.e_AVAttributes, minOccurs: 0 },
								{ name: tva.e_OtherIdentifier, minOccurs: 0, maxOccurs: Infinity },
								{ name: tva.e_RelatedMaterial, minOccurs: 0 },
							];
				/* eslint-enable */
				checkTopElementsAndCardinality(InstanceDescription, allowedSEChildren, tvaEC.InstanceDescription, false, errs, "ID002");
				break;
			default:
				errs.addError({
					type: APPLICATION,
					code: "ID003",
					message: `message:ValidateInstanceDescription() called with VerifyType=${VerifyType}`,
				});
		}

		// @serviceInstanceId
		if (InstanceDescription.attrAnyNs(tva.a_serviceInstanceID) && InstanceDescription.attrAnyNs(tva.a_serviceInstanceID).value.length == 0)
			errs.addError({
				code: "ID009",
				message: `${tva.a_serviceInstanceID.attribute()} should not be empty is specified`,
				line: InstanceDescription.line,
				key: "empty ID",
			});

		let restartGenre = null,
			restartRelatedMaterial = null;
		// <Genre>
		switch (VerifyType) {
			case tva.e_OnDemandProgram:
				// A177r1 Table 54 - must be 2 elements

				/* eslint-disable no-case-declarations */
				const Genre1 = InstanceDescription.getAnyNs(tva.e_Genre, 1),
					Genre2 = InstanceDescription.getAnyNs(tva.e_Genre, 2);

				const g1href = checkGenre(Genre1, errs, "ID011");
				/* eslint-enable */
				if (g1href && !isAvailability(g1href))
					errs.addError({
						code: "ID012",
						message: `first ${elementize(`${InstanceDescription.name}.+${tva.e_Genre}`)} must contain a media or fepg availability indicator`,
						fragment: Genre1,
					});

				/* eslint-disable no-case-declarations */
				const g2href = checkGenre(Genre2, errs, "ID013");
				/* eslint-enable */
				if (g2href && !isAvailability(g2href))
					errs.addError({
						code: "ID014",
						message: `second ${elementize(`${InstanceDescription.name}.+${tva.e_Genre}`)} must contain a media or fepg availability indicator`,
						fragment: Genre2,
					});

				if (Genre1 && Genre2) {
					if ((isMediaAvailability(g1href) && isMediaAvailability(g2href)) || (isEPGAvailability(g1href) && isEPGAvailability(g2href))) {
						errs.addError({
							code: "ID015-1",
							message: `${elementize(`${InstanceDescription.name}.+${tva.e_Genre}`)} elements must indicate different availabilities`,
							fragments: [Genre1, Genre2],
						});
					}
				}
				break;
			case tva.e_ScheduleEvent:
				/* eslint-disable no-case-declarations */
				const Genre = InstanceDescription.getAnyNs(tva.e_Genre);
				/* eslint-enable */
				if (Genre) {
					checkAttributes(Genre, [tva.a_href], [tva.a_type], tvaEA.Genre, errs, "ID016");
					if (Genre.attrAnyNs(tva.a_href)) {
						if (isRestartAvailability(Genre.attrAnyNs(tva.a_href).value)) {
							restartGenre = Genre;
							if (Genre.attrAnyNs(tva.a_type) && Genre.attrAnyNs(tva.a_type).value != tva.GENRE_TYPE_OTHER)
								errs.addError({
									code: "ID018",
									message: `${tva.a_type.attribute(Genre.name)} must be ${tva.GENRE_TYPE_OTHER.quote()}`,
									fragment: Genre,
								});
						} else
							errs.addError({
								code: "ID017",
								message: `${elementize(`${InstanceDescription.name}.${tva.e_Genre}`)} must contain a restart link indicator`,
								line: InstanceDescription.line,
							});
					}
				}
				break;
		}

		// <CaptionLanguage>
		const CaptionLanguage = InstanceDescription.getAnyNs(tva.e_CaptionLanguage);
		if (CaptionLanguage) {
			checkLanguage(CaptionLanguage.content, CaptionLanguage, errs, "ID021");
			BooleanValue(CaptionLanguage, tva.a_closed, errs, "ID022");
		}

		// <SignLanguage>
		const SignLanguage = InstanceDescription.getAnyNs(tva.e_SignLanguage);
		if (SignLanguage) {
			checkLanguage(SignLanguage.content, SignLanguage, errs, "ID031");
			FalseValue(SignLanguage, tva.a_closed, errs, "ID032");
			// check value is "sgn" according to ISO 639-2 or a sign language listed in ISO 639-3
			if (SignLanguage.content != "sgn" && !this.#knownLanguages.isKnownSignLanguage(SignLanguage.content))
				errs.addError({
					code: "ID033",
					message: `invalid ${tva.e_SignLanguage.elementize()} ${SignLanguage.content.quote()} in ${InstanceDescription.name.elementize()}`,
					fragment: SignLanguage,
				});
		}

		// <AVAttributes>
		const AVAttributes = InstanceDescription.getAnyNs(tva.e_AVAttributes);
		if (AVAttributes) this.#ValidateAVAttributes(AVAttributes, this.#allowedAudioSchemes, errs);

		// <OtherIdentifier>
		let oi = 0,
			OtherIdentifier;
		while ((OtherIdentifier = InstanceDescription.getAnyNs(tva.e_OtherIdentifier, ++oi)) != null) {
			checkAttributes(OtherIdentifier, [tva.a_type], [], tvaEA.OtherIdentifier, errs, "VID052");
			if (OtherIdentifier.attrAnyNs(tva.a_type)) {
				const oiType = OtherIdentifier.attrAnyNs(tva.a_type).value;

				if (
					(VerifyType == tva.e_ScheduleEvent && ["CPSIndex", dvbi.EIT_PROGRAMME_CRID_TYPE, dvbi.EIT_SERIES_CRID_TYPE].includes(oiType)) ||
					(VerifyType == tva.e_OnDemandProgram && oiType == "CPSIndex")
				) {
					// all good
				} else {
					if (!OtherIdentifier.attrAnyNs(mpeg7.a_organization))
						// don't throw errors for other organisations <OtherIdentifier> values
						errs.addError({
							code: "ID050",
							message: `${tva.a_type.attribute(tva.e_OtherIdentifier)}=${oiType.quote()} is not valid for ${VerifyType}.${InstanceDescription.name}`,
							fragment: OtherIdentifier,
						});
				}
				if ([dvbi.EIT_PROGRAMME_CRID_TYPE, dvbi.EIT_SERIES_CRID_TYPE].includes(oiType))
					if (!isCRIDURI(OtherIdentifier.content))
						errs.addError({
							code: "ID051",
							message: `${tva.e_OtherIdentifier} must be a CRID for ${tva.a_type.attribute()}=${oiType.quote()}`,
							fragment: OtherIdentifier,
						});
			}
		}

		// <RelatedMaterial>
		const RelatedMaterial = InstanceDescription.getAnyNs(tva.e_RelatedMaterial);
		if (RelatedMaterial) {
			if (this.#ValidateRestartRelatedMaterial(RelatedMaterial, errs)) restartRelatedMaterial = RelatedMaterial; //THIS
		}

		// Genre and RelatedMaterial for restart capability should only be specified for the "current" (ie. 'now') program
		if (!isCurrentProgram && restartGenre)
			errs.addError({
				code: "ID061",
				message: `restart ${tva.e_Genre.elementize()} is only permitted for the current ("now") program`,
				fragment: restartGenre,
			});
		if (!isCurrentProgram && restartRelatedMaterial)
			errs.addError({
				code: "ID062",
				message: `restart ${tva.e_RelatedMaterial.elementize()} is only permitted for the current ("now") program`,
				fragment: restartRelatedMaterial,
			});

		if ((restartGenre && !restartRelatedMaterial) || (restartRelatedMaterial && !restartGenre))
			errs.addError({
				code: "ID063",
				message: `both ${tva.e_Genre.elementize()} and ${tva.e_RelatedMaterial.elementize()} are required together for ${VerifyType}`,
				multiElementError: [restartGenre, restartRelatedMaterial],
			});
	}

	/**
	 * validate a <ProgramURL> or <AuxiliaryURL> element to see if it signals a Template XML AIT
	 *
	 * @param {XmlElement} node                 the element node containing the an XML AIT reference
	 * @param {Array}      allowedContentTypes  the contentTypes that can be signalled in the node@contentType attribute
	 * @param {ErrorList}  errs                 errors found in validaton
	 * @param {String}     errcode              error code to be used with any errors found
	 */
	/* private */ #CheckPlayerApplication(node, allowedContentTypes, errs, errcode) {
		if (!node) {
			errs.addError({ type: APPLICATION, code: "PA000", message: "CheckPlayerApplication() called with node==null" });
			return;
		}
		const allowedTypes = Array.isArray(allowedContentTypes) ? allowedContentTypes : [].concat(allowedContentTypes);
		if (!node.attrAnyNs(tva.a_contentType)) {
			errs.addError({
				code: `${errcode}-1`,
				message: `${tva.a_contentType.attribute()} attribute is required when signalling a player in ${node.name.elementize()}`,
				key: `missing ${tva.a_contentType.attribute()}`,
				fragment: node,
			});
			return;
		}

		if (allowedTypes.includes(node.attrAnyNs(tva.a_contentType).value)) {
			switch (node.attrAnyNs(tva.a_contentType).value) {
				case dvbi.XML_AIT_CONTENT_TYPE:
					if (!isHTTPURL(node.content))
						errs.addError({
							code: `${errcode}-2`,
							message: `${node.name.elementize()}=${node.content.quote()} is not a valid HTTP or HTTP URL`,
							key: keys.k_InvalidURL,
							fragment: node,
						});
					break;
				/*			case dvbi.HTML5_APP:
				case dvbi.XHTML_APP:
					if (!isHTTPURL(node.content))
						errs.addError({code:`${errcode}-3`, message:`${node.name.elementize()}=${node.content.quote()} is not a valid URL`, key:"invalid URL", fragment:node});		
					break;
				*/
			}
		} else
			errs.addError({
				code: `${errcode}-4`,
				message: `${tva.a_contentType.attribute(node.name)}=${node.attrAnyNs(tva.a_contentType).value.quote()} is not valid for a player`,
				fragment: node,
				key: `invalid ${tva.a_contentType}`,
			});
	}

	/**
	 * validate an <OnDemandProgram> elements in the <ProgramLocationTable>
	 *
	 * @param {XmlElement} OnDemandProgram    the node containing the <OnDemandProgram> being checked
	 * @param {Array}      programCRIDs       array of program crids defined in <ProgramInformationTable>
	 * @param {Array}      plCRIDs            array of program crids defined in <ProgramLocationTable>
	 * @param {String}     requestType        the type of content guide request being checked
	 * @param {ErrorList}  errs               errors found in validaton
	 */
	/* private */ #ValidateOnDemandProgram(OnDemandProgram, programCRIDs, plCRIDs, requestType, errs) {
		if (!OnDemandProgram) {
			errs.addError({
				type: APPLICATION,
				code: "OD000",
				message: "ValidateOnDemandProgram() called with OnDemandProgram==null",
			});
			return;
		}
		let validRequest = true;
		switch (requestType) {
			case CG_REQUEST_BS_CONTENTS:
				checkTopElementsAndCardinality(
					OnDemandProgram,
					[
						{ name: tva.e_Program },
						{ name: tva.e_ProgramURL },
						{ name: tva.e_AuxiliaryURL, minOccurs: 0 },
						{ name: tva.e_InstanceDescription, minOccurs: 0 },
						{ name: tva.e_PublishedDuration },
						{ name: tva.e_StartOfAvailability },
						{ name: tva.e_EndOfAvailability },
						{ name: tva.e_Free },
					],
					tvaEC.OnDemandProgram,
					false,
					errs,
					"OD001"
				);
				break;
			case CG_REQUEST_MORE_EPISODES:
				checkTopElementsAndCardinality(
					OnDemandProgram,
					[
						{ name: tva.e_Program },
						{ name: tva.e_ProgramURL },
						{ name: tva.e_AuxiliaryURL, minOccurs: 0 },
						{ name: tva.e_PublishedDuration },
						{ name: tva.e_StartOfAvailability },
						{ name: tva.e_EndOfAvailability },
						{ name: tva.e_Free },
					],
					tvaEC.OnDemandProgram,
					false,
					errs,
					"OD002"
				);
				break;
			case CG_REQUEST_SCHEDULE_NOWNEXT:
			case CG_REQUEST_SCHEDULE_TIME:
			case CG_REQUEST_SCHEDULE_WINDOW:
			case CG_REQUEST_PROGRAM:
				checkTopElementsAndCardinality(
					OnDemandProgram,
					[
						{ name: tva.e_Program },
						{ name: tva.e_ProgramURL },
						{ name: tva.e_AuxiliaryURL, minOccurs: 0 },
						{ name: tva.e_InstanceDescription },
						{ name: tva.e_PublishedDuration },
						{ name: tva.e_StartOfAvailability },
						{ name: tva.e_EndOfAvailability },
						{ name: tva.e_DeliveryMode },
						{ name: tva.e_Free },
					],
					tvaEC.OnDemandProgram,
					false,
					errs,
					"OD003"
				);
				break;
			default:
				errs.addError({
					code: "OD004",
					message: `requestType=${requestType} is not valid for ${OnDemandProgram.name}`,
				});
				validRequest = false;
		}

		checkAttributes(OnDemandProgram, [tva.a_serviceIDRef], [tva.a_lang], tvaEA.OnDemandProgram, errs, "OD005");
		GetNodeLanguage(OnDemandProgram, false, errs, "OD006");
		this.#checkTAGUri(OnDemandProgram, errs, "OD007");

		// <Program>
		const Program = OnDemandProgram.getAnyNs(tva.e_Program);
		if (Program) {
			checkAttributes(Program, [tva.a_crid], [], tvaEA.Program, errs, "OD012");
			const programCRID = Program.attrAnyNsValueOr(tva.a_crid, null);
			if (programCRID) {
				if (!isCRIDURI(programCRID))
					errs.addError({
						code: "OD010",
						message: `${tva.a_crid.attribute(`${OnDemandProgram.name}.${tva.e_Program}`)} is not a CRID URI`,
						line: Program.line,
					});
				else {
					if (!isIni(programCRIDs, programCRID))
						errs.addError({
							code: "OD011",
							message: `${tva.a_crid.attribute(
								`${OnDemandProgram.name}.${tva.e_Program}`
							)}=${programCRID.quote()} does not refer to a program in the ${tva.e_ProgramInformationTable.elementize()}`,
							line: Program.line,
						});
				}
				plCRIDs.push(programCRID);
			}
		}

		// <ProgramURL>
		const ProgramURL = OnDemandProgram.getAnyNs(tva.e_ProgramURL);
		if (ProgramURL) this.#CheckPlayerApplication(ProgramURL, dvbi.XML_AIT_CONTENT_TYPE, errs, "OD020");

		// <AuxiliaryURL>
		const AuxiliaryURL = OnDemandProgram.getAnyNs(tva.e_AuxiliaryURL);
		if (AuxiliaryURL) this.#CheckPlayerApplication(AuxiliaryURL, [dvbi.XML_AIT_CONTENT_TYPE /*, dvbi.HTML5_APP, dvbi.XHTML_APP, dvbi.iOS_APP, dvbi.ANDROID_APP*/], errs, "OD030");

		// <InstanceDescription>
		if (validRequest && [CG_REQUEST_BS_CONTENTS, CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_TIME, CG_REQUEST_SCHEDULE_WINDOW, CG_REQUEST_PROGRAM].includes(requestType)) {
			const InstanceDescription = OnDemandProgram.getAnyNs(tva.e_InstanceDescription);
			if (InstanceDescription) this.#ValidateInstanceDescription(OnDemandProgram.name, InstanceDescription, false, errs);
		}

		// <PublishedDuration>

		// <StartOfAvailability> and <EndOfAvailability>
		const soa = OnDemandProgram.getAnyNs(tva.e_StartOfAvailability),
			eoa = OnDemandProgram.getAnyNs(tva.e_EndOfAvailability);

		if (soa && eoa) {
			const fr = new Date(soa.content),
				to = new Date(eoa.content);
			if (to.getTime() < fr.getTime())
				errs.addError({
					code: "OD062",
					message: `${tva.e_StartOfAvailability.elementize()} must be earlier than ${tva.e_EndOfAvailability.elementize()}`,
					multiElementError: [soa, eoa],
					key: "bad timing",
				});
		}

		// <DeliveryMode>
		if ([CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_TIME, CG_REQUEST_SCHEDULE_WINDOW, CG_REQUEST_PROGRAM].includes(requestType)) {
			const DeliveryMode = OnDemandProgram.getAnyNs(tva.e_DeliveryMode);
			if (DeliveryMode && DeliveryMode.content != tva.DELIVERY_MODE_STREAMING)
				errs.addError({
					code: "OD070",
					message: `${OnDemandProgram.name}.${tva.e_DeliveryMode} must be ${tva.DELIVERY_MODE_STREAMING.quote()}`,
					fragment: DeliveryMode,
				});
		}

		// <Free>
		const Free = OnDemandProgram.getAnyNs(tva.e_Free);
		if (Free) TrueValue(Free, tva.a_value, errs, "OD080");
	}

	/**
	 * validate any <ScheduleEvent> or <BroadcastEvent> elements
	 *
	 * @param {XmlElement} Event               the <BroadcastEvent> or <ScheduleEvent> element to be checked
	 * @param {Array}      programCRIDs        array of program crids defined in <ProgramInformationTable>
	 * @param {Array}      plCRIDs             array of program crids defined in <ProgramLocationTable>
	 * @param {String}     currentProgramCRID  CRID of the currently airing program
	 * @param {XmlElement} Schedule            the parent node of a <ScheduleEvent>
	 * @param {ErrorList}  errs                errors found in validaton
	 */
	/* private */ #ValidateEvent(Event, programCRIDs, plCRIDs, currentProgramCRID, Schedule, errs) {
		let prefix = "";
		if (Event.name == tva.e_BroadcastEvent) prefix = "BE";
		else if (Event.name == tva.e_ScheduleEvent) prefix = "SE";
		else {
			errs.addError({
				type: APPLICATION,
				code: "VE000",
				message: "ValidateEvent() called with something other than a BroadcastEvent or ScheduleEvent",
			});
			return;
		}

		let startSchedule = Schedule ? Schedule.attrAnyNs(tva.a_start) : null,
			start_schedule_period = null,
			endSchedule = Schedule ? Schedule.attrAnyNs(tva.a_end) : null,
			end_schedule_period = null;
		if (startSchedule) start_schedule_period = new Date(startSchedule.value);
		if (endSchedule) end_schedule_period = new Date(endSchedule.value);

		let isCurrentProgram = false;
		GetNodeLanguage(Event, false, errs, `${prefix}001`);
		checkAttributes(Event, prefix == "BE" ? [tva.a_serviceIDRef] : [], [], tvaEA.ScheduleEvent, errs, `${prefix}002`);
		checkTopElementsAndCardinality(
			Event,
			prefix == "BE"
				? [
						{ name: tva.e_Program },
						{ name: tva.e_ProgramURL, minOccurs: 0 },
						{ name: tva.e_InstanceDescription, minOccurs: 0, maxOccurs: Infinity },
						{ name: tva.e_PublishedStartTime, minOccurs: 0 },
						{ name: tva.e_PublishedDuration, minOccurs: 0 },
						{ name: tva.e_ActualStartTime, minOccurs: 0 },
						{ name: tva.e_ActualDuration, minOccurs: 0 },
						{ name: tva.e_FirstShowing, minOccurs: 0 },
						{ name: tva.e_Free, minOccurs: 0 },
					]
				: [
						{ name: tva.e_Program },
						{ name: tva.e_ProgramURL, minOccurs: 0 },
						{ name: tva.e_InstanceDescription, minOccurs: 0, maxOccurs: Infinity },
						{ name: tva.e_PublishedStartTime },
						{ name: tva.e_PublishedDuration },
						{ name: tva.e_ActualStartTime, minOccurs: 0 },
						{ name: tva.e_ActualDuration, minOccurs: 0 },
						{ name: tva.e_FirstShowing, minOccurs: 0 },
						{ name: tva.e_Free, minOccurs: 0 },
					],
			prefix == "BE" ? tvaEC.BroadcastEvent : tvaEC.ScheduleEvent,
			false,
			errs,
			`${prefix}003`
		);

		// <Program>
		const Program = Event.getAnyNs(tva.e_Program);
		if (Program) {
			checkAttributes(Program, [tva.a_crid], [], tvaEA.Program, errs, `${prefix}010`);

			const ProgramCRID = Program.attrAnyNsValueOr(tva.a_crid, null);
			if (ProgramCRID) {
				if (!isCRIDURI(ProgramCRID)) {
					this.#NotCRIDFormat(errs, {
						code: `${prefix}011`,
						message: `${tva.a_crid.attribute(tva.e_Program)} is not a valid CRID (${ProgramCRID})`,
						fragment: Program,
					});
				}
				if (!isIni(programCRIDs, ProgramCRID))
					errs.addError({
						code: `${prefix}012`,
						message: `${tva.a_crid.attribute(tva.e_Program)}=${ProgramCRID.quote()} does not refer to a program in the ${tva.e_ProgramInformationTable.elementize()}`,
						fragment: Program,
					});
				plCRIDs.push(ProgramCRID);
				isCurrentProgram = ProgramCRID == currentProgramCRID;
			}
		}

		// <ProgramURL>
		const ProgramURL = Event.getAnyNs(tva.e_ProgramURL);
		if (ProgramURL)
			if (!isDVBLocator(ProgramURL.content))
				errs.addError({
					code: `${prefix}021`,
					message: `${Event.name}.${tva.e_ProgramURL} (${ProgramURL.content}) is not a valid DVB locator`,
					fragment: ProgramURL,
				});

		// <InstanceDescription>
		let id = 0,
			thisInstanceDescription,
			serviceIDs = [];
		while ((thisInstanceDescription = Event.getAnyNs(tva.e_InstanceDescription, ++id)) != null) {
			this.#ValidateInstanceDescription(Event.name, thisInstanceDescription, isCurrentProgram, errs);
			const instanceServiceID = thisInstanceDescription.attrAnyNsValueOr(tva.a_serviceInstanceID, "dflt");
			if (isIn(serviceIDs, instanceServiceID))
				errs.addError({
					code: instanceServiceID == "dflt" ? `${prefix}031` : `${prefix}032`,
					line: thisInstanceDescription.line,
					message: instanceServiceID == "dflt" ? "Default instance description is already specified" : `Instance description for ${instanceServiceID} is already specified`,
					key: "duplicate instance",
				});
			else serviceIDs.push(instanceServiceID);
		}

		// <PublishedStartTime> and <PublishedDuration>
		const pstElem = Event.getAnyNs(tva.e_PublishedStartTime);
		if (pstElem) {
			if (isUTCDateTime(pstElem.content)) {
				const PublishedStartTime = new Date(pstElem.content);

				if (start_schedule_period && PublishedStartTime < start_schedule_period)
					errs.addError({
						code: `${prefix}041`,
						message: `${tva.e_PublishedStartTime.elementize()} (${PublishedStartTime.toString()}) is earlier than ${tva.a_start.attribute(tva.e_Schedule)}`,
						multiElementError: [Schedule, pstElem],
					});
				if (end_schedule_period && PublishedStartTime > end_schedule_period)
					errs.addError({
						code: `${prefix}042`,
						message: `${tva.e_PublishedStartTime.elementize()} (${PublishedStartTime.toString()}) is after ${tva.a_end.attribute(tva.e_Schedule)}`,
						multiElementError: [Schedule, pstElem],
					});

				const pdElem = Event.getAnyNs(tva.e_PublishedDuration);
				if (endSchedule && pdElem) {
					const parsedPublishedDuration = parseISOduration(pdElem.content);
					if (parsedPublishedDuration.add(PublishedStartTime) > end_schedule_period)
						errs.addError({
							code: `${prefix}043`,
							message: `${tva.e_PublishedStartTime}+${tva.e_PublishedDuration} of event is after ${tva.a_end.attribute(tva.e_Schedule)}`,
							multiElementError: [Schedule, pdElem],
						});
				}
			} else
				errs.addError({
					code: `${prefix}049`,
					message: `${tva.e_PublishedStartTime.elementize()} is not expressed in UTC format (${pstElem.content})`,
					fragment: pstElem,
				});
		}

		// <ActualStartTime>
		const astElem = Event.getAnyNs(tva.e_ActualStartTime);
		if (astElem && !isUTCDateTime(astElem.content))
			errs.addError({
				code: `${prefix}051`,
				message: `${tva.e_ActualStartTime.elementize()} is not expressed in UTC format (${astElem.content})`,
				fragment: astElem,
			});

		// <FirstShowing>
		const FirstShowing = Event.getAnyNs(tva.e_FirstShowing);
		if (FirstShowing) BooleanValue(FirstShowing, tva.a_value, errs, `${prefix}061`);

		// <Free>
		const Free = Event.getAnyNs(tva.e_Free);
		if (Free) BooleanValue(Free, tva.a_value, errs, `${prefix}071`);
	}

	/**
	 * validate a <BroadcastEvent> elements in the <ProgramLocationTable>
	 *
	 * @param {XmlElement} BroadcastEvent       the node containing the <BroadcastEvent> being checked
	 * @param {Array}      programCRIDs         array of program crids defined in <ProgramInformationTable>
	 * @param {Array}      plCRIDs              array of program crids defined in <ProgramLocationTable>
	 * @param {String}     currentProgramCRID   CRID of the currently airing program
	 * @param {String}     requestType          the type of content guide request being checked
	 * @param {ErrorList}  errs                 errors found in validaton
	 */
	/* private */ #ValidateBroadcastEvent(BroadcastEvent, programCRIDs, plCRIDs, currentProgramCRID, requestType, errs) {
		if (!BroadcastEvent) {
			errs.addError({
				type: APPLICATION,
				code: "BE000",
				message: "ValidateBroadcastEvent() called with BroadcastEvent==null",
			});
			return;
		}
		this.#checkTAGUri(BroadcastEvent, errs, "BE999");
		this.#ValidateEvent(BroadcastEvent, programCRIDs, plCRIDs, currentProgramCRID, null, errs);
	}

	/**
	 * validate any <ScheduleEvent> elements in the <ProgramLocationTable.Schedule>
	 *
	 * @param {XmlElement} Schedule            the <Schedule> node containing the <ScheduleEvent> element to be checked
	 * @param {Array}      programCRIDs        array of program crids defined in <ProgramInformationTable>
	 * @param {Array}      plCRIDs             array of program crids defined in <ProgramLocationTable>
	 * @param {String}     currentProgramCRID  CRID of the currently airing program
	 * @param {ErrorList}  errs                errors found in validaton
	 */
	/* private */ #ValidateScheduleEvents(Schedule, programCRIDs, plCRIDs, currentProgramCRID, errs) {
		if (!Schedule) {
			errs.addError({
				type: APPLICATION,
				code: "SE000",
				message: "ValidateScheduleEvents() called with Schedule==null",
			});
			return;
		}

		let se = 0,
			ScheduleEvent;
		while ((ScheduleEvent = Schedule.getAnyNs(tva.e_ScheduleEvent, ++se)) != null) {
			this.#ValidateEvent(ScheduleEvent, programCRIDs, plCRIDs, currentProgramCRID, Schedule, errs);
		}
	}

	/**
	 * validate a <Schedule> elements in the <ProgramLocationTable>
	 *
	 * @param {XmlElement} Schedule             the node containing the <Schedule> being checked
	 * @param {Array}      programCRIDs         array of program crids defined in <ProgramInformationTable>
	 * @param {Array}      plCRIDs              array of program crids defined in <ProgramLocationTable>
	 * @param {String}     currentProgramCRID   CRID of the currently airing program
	 * @param {String}     requestType          the type of content guide request being checked
	 * @param {ErrorList}  errs                 errors found in validaton
	 * @returns {String}	the serviceIdRef for this <Schedule> element
	 */
	/* private */ #ValidateSchedule(Schedule, programCRIDS, plCRIDs, currentProgramCRID, requestType, errs) {
		if (!Schedule) {
			errs.addError({ type: APPLICATION, code: "VS000", message: "ValidateSchedule() called with Schedule==null" });
			return null;
		}

		checkTopElementsAndCardinality(Schedule, [{ name: tva.e_ScheduleEvent, minOccurs: 0, maxOccurs: Infinity }], tvaEC.Schedule, false, errs, "VS001");
		checkAttributes(Schedule, [tva.a_serviceIDRef, tva.a_start, tva.a_end], [], tvaEA.Schedule, errs, "VS002");

		GetNodeLanguage(Schedule, false, errs, "VS003");
		const serviceIdRef = this.#checkTAGUri(Schedule, errs, "VS004");
		let startSchedule = Schedule.attrAnyNs(tva.a_start),
			fr = null,
			endSchedule = Schedule.attrAnyNs(tva.a_end),
			to = null;
		if (startSchedule) fr = new Date(startSchedule.value);

		if (endSchedule) to = new Date(endSchedule.value);

		if (startSchedule && endSchedule)
			if (to.getTime() <= fr.getTime())
				errs.addError({
					code: "VS012",
					message: `${tva.a_start.attribute(Schedule.name)} must be earlier than ${tva.a_end.attribute()}`,
					fragment: Schedule,
				});

		this.#ValidateScheduleEvents(Schedule, programCRIDS, plCRIDs, currentProgramCRID, errs);

		return serviceIdRef;
	}

	/**
	 * find and validate any <ProgramLocation> elements in the <ProgramLocationTable>
	 *
	 * @param {XmlElement} ProgramDescription  the element containing the <ProgramInformationTable>
	 * @param {Array}      programCRIDs        array to record CRIDs for later use
	 * @param {String}     currentProgramCRID  CRID of the currently airing program
	 * @param {String}     requestType         the type of content guide request being checked
	 * @param {ErrorList}  errs                errors found in validaton
	 * @param {integer}    o.childCount        the number of child elements to be present (to match GroupInformation@numOfItems)
	 */
	/* private */ #CheckProgramLocation(ProgramDescription, programCRIDs, currentProgramCRID, requestType, errs, o = null) {
		if (!ProgramDescription) {
			errs.addError({
				type: APPLICATION,
				code: "PL000",
				message: "CheckProgramLocation() called with ProgramDescription==null",
			});
			return;
		}

		const ProgramLocationTable = ProgramDescription.getAnyNs(tva.e_ProgramLocationTable);
		if (!ProgramLocationTable) {
			//errs.addError({code:"PL001", message:`${tva.e_ProgramLocationTable.elementize()} is not specified`, line:ProgramDescription.line});
			return;
		}

		let allowedElements = [{ name: tva.e_OnDemandProgram, minOccurs: 0, maxOccurs: Infinity }];
		switch (requestType) {
			case CG_REQUEST_SCHEDULE_NOWNEXT:
			case CG_REQUEST_SCHEDULE_TIME:
			case CG_REQUEST_SCHEDULE_WINDOW:
			case CG_REQUEST_PROGRAM:
				allowedElements.push({ name: tva.e_Schedule, minOccurs: 0, maxOccurs: Infinity });
				break;
			case CG_REQUEST_BS_CONTENTS:
				allowedElements.push({ name: tva.e_BroadcastEvent, minOccurs: 0, maxOccurs: Infinity });
				break;
			case CG_REQUEST_BS_LISTS:
			case CG_REQUEST_BS_CATEGORIES:
				// ProgramLocationTable is not included in these response types
				break;
			case CG_REQUEST_MORE_EPISODES:
				// only OnDemandProgram elements are permitted in More Episodes response
				break;
		}

		checkTopElementsAndCardinality(ProgramLocationTable, allowedElements, tvaEC.ProgramLocationTable, false, errs, "PL010");
		checkAttributes(ProgramLocationTable, [], [tva.a_lang], tvaEA.ProgramLocationTable, errs, "PL011");

		GetNodeLanguage(ProgramLocationTable, false, errs, "PL012");

		let cntODP = 0,
			cntSE = 0,
			cntBE = 0,
			foundServiceIds = [],
			plCRIDs = [];

		ProgramLocationTable?.childNodes().forEachSubElement((child) => {
			switch (child.name) {
				case tva.e_OnDemandProgram:
					this.#ValidateOnDemandProgram(child, programCRIDs, plCRIDs, requestType, errs);
					cntODP++;
					break;
				case tva.e_BroadcastEvent:
					this.#ValidateBroadcastEvent(child, programCRIDs, plCRIDs, currentProgramCRID, requestType, errs);
					cntBE++;
					break;
				case tva.e_Schedule:
					/* eslint-disable no-case-declarations */
					const thisServiceIdRef = this.#ValidateSchedule(child, programCRIDs, plCRIDs, currentProgramCRID, requestType, errs);
					/* eslint-enable */
					if (thisServiceIdRef.length)
						if (isIni(foundServiceIds, thisServiceIdRef))
							errs.addError({
								code: "PL020",
								message: `A ${tva.e_Schedule.elementize()} element with ${tva.a_serviceIDRef.attribute()}=${thisServiceIdRef.quote()} is already specified`,
							});
						else foundServiceIds.push(thisServiceIdRef);
					cntSE++;
					break;
			}
		});

		if (o && o.childCount != 0) {
			if (o.childCount != cntODP + cntBE + cntSE)
				errs.addError({
					code: "PL021",
					message: `number of items (${cntODP + cntBE + cntSE}) in the ${tva.e_ProgramLocationTable.elementize()} does not match ${tva.a_numOfItems.attribute(
						tva.e_GroupInformation
					)} specified in ${CATEGORY_GROUP_NAME} (${o.childCount})`,
				});
		}

		if (requestType == CG_REQUEST_PROGRAM) {
			if (cntODP > 1 || cntSE != 0)
				errs.addError({
					code: "PL023",
					message: `The ${tva.e_ProgramLocationTable.elementize()} may only contain a single OnDemandProgram element representing the current On Demand availability of this programme`,
				});
		}

		if ((requestType == CG_REQUEST_PROGRAM && cntODP != 0) || requestType != CG_REQUEST_PROGRAM)
			programCRIDs.forEach((programCRID) => {
				if (!isIni(plCRIDs, programCRID))
					errs.addError({
						code: "PL022",
						message: `CRID ${programCRID.quote()} specified in ${tva.e_ProgramInformationTable.elementize()} is not specified in ${tva.e_ProgramLocationTable.elementize()}`,
					});
			});
	}

	/**
	 * validate the content guide and record any errors
	 *
	 * @param {String}    CGtext       the service list text to be validated
	 * @param {String}    requestType  the type of CG request/response (specified in the form/query as not possible to deduce from metadata)
	 * @param {ErrorList} errs         errors found in validaton
	 * @param {Object} options
	 *                   options.log_prefix            the first part of the logging location (or null if no logging)
	 *                   options.report_schema_version report the state of the schema in the error/warning list
	 */
	doValidateContentGuide(CGtext, requestType, errs, options = {}) {
		this.#numRequests++;

		if (!CGtext) {
			errs.addError({ type: APPLICATION, code: "CG000", message: "doValidateContentGuide() called with CGtext==null" });
			return;
		}

		if (!Object.prototype.hasOwnProperty.call(options, "log_prefix")) options.log_prefix = null;
		if (!Object.prototype.hasOwnProperty.call(options, "report_schema_version")) options.report_schema_version = true;

		let CG = SchemaLoad(CGtext, errs, "CG001");
		if (!CG) return;

		writeOut(errs, options.log_prefix, false);

		if (CG.root.name != tva.e_TVAMain) {
			errs.addError({
				code: "CG002",
				message: `Root element is not ${tva.e_TVAMain.elementize()}`,
				key: keys.k_XSDValidation,
			});
			return;
		}

		this.#doSchemaVerification(CG, errs, "CG003", options.report_schema_version);

		const TVAMain = CG.root;
		GetNodeLanguage(TVAMain, true, errs, "CG005");
		const ProgramDescription = TVAMain.getAnyNs(tva.e_ProgramDescription);
		if (!ProgramDescription) {
			errs.addError({ code: "CG006", message: `No ${tva.e_ProgramDescription.elementize()} element specified.` });
			return;
		}

		let programCRIDs = [],
			groupIds = [],
			o = { childCount: 0 };

		switch (requestType) {
			case CG_REQUEST_SCHEDULE_TIME:
				// schedule response (6.5.4.1) has <ProgramLocationTable> and <ProgramInformationTable> elements
				checkTopElementsAndCardinality(
					ProgramDescription,
					[{ name: tva.e_ProgramLocationTable }, { name: tva.e_ProgramInformationTable }],
					tvaEC.ProgramDescription,
					false,
					errs,
					"CG011"
				);
				this.#CheckProgramInformation(ProgramDescription, programCRIDs, null, requestType, errs);
				this.#CheckProgramLocation(ProgramDescription, programCRIDs, null, requestType, errs);
				break;
			case CG_REQUEST_SCHEDULE_NOWNEXT:
				// schedule response (6.5.4.1) has <ProgramLocationTable> and <ProgramInformationTable> elements
				checkTopElementsAndCardinality(
					ProgramDescription,
					[{ name: tva.e_ProgramLocationTable }, { name: tva.e_ProgramInformationTable }, { name: tva.e_GroupInformationTable }],
					tvaEC.ProgramDescription,
					false,
					errs,
					"CG021"
				);
				// <GroupInformation> may become optional for now/next, the program sequence should be determined by ScheduleEvent.PublishedStartTime
				if (this.#hasElement(ProgramDescription, tva.e_GroupInformationTable)) this.#CheckGroupInformationNowNext(ProgramDescription, groupIds, requestType, errs);
				/* eslint-disable no-case-declarations */
				const currentProgramCRIDnn = this.#CheckProgramInformation(ProgramDescription, programCRIDs, groupIds, requestType, errs);
				/* eslint-enable */
				this.#CheckProgramLocation(ProgramDescription, programCRIDs, currentProgramCRIDnn, requestType, errs);
				break;
			case CG_REQUEST_SCHEDULE_WINDOW:
				checkTopElementsAndCardinality(
					ProgramDescription,
					[{ name: tva.e_ProgramLocationTable }, { name: tva.e_ProgramInformationTable }, { name: tva.e_GroupInformationTable }],
					tvaEC.ProgramDescription,
					false,
					errs,
					"CG031"
				);
				// <GroupInformation> may become optional for now/next, the program sequence should be determined by ScheduleEvent.PublishedStartTime
				if (this.#hasElement(ProgramDescription, tva.e_GroupInformationTable)) this.#CheckGroupInformationNowNext(ProgramDescription, groupIds, requestType, errs);
				/* eslint-disable no-case-declarations */
				const currentProgramCRIDsw = this.#CheckProgramInformation(ProgramDescription, programCRIDs, groupIds, requestType, errs);
				/* eslint-enable */
				this.#CheckProgramLocation(ProgramDescription, programCRIDs, currentProgramCRIDsw, requestType, errs);
				break;
			case CG_REQUEST_PROGRAM:
				// program information response (6.6.2) has <ProgramLocationTable> and <ProgramInformationTable> elements
				checkTopElementsAndCardinality(
					ProgramDescription,
					[{ name: tva.e_ProgramLocationTable }, { name: tva.e_ProgramInformationTable }],
					tvaEC.ProgramDescription,
					false,
					errs,
					"CG041"
				);
				this.#CheckProgramInformation(ProgramDescription, programCRIDs, null, requestType, errs);
				this.#CheckProgramLocation(ProgramDescription, programCRIDs, null, requestType, errs);
				break;
			case CG_REQUEST_MORE_EPISODES:
				// more episodes response (6.7.3) has <ProgramInformationTable>, <GroupInformationTable> and <ProgramLocationTable> elements
				checkTopElementsAndCardinality(
					ProgramDescription,
					[{ name: tva.e_ProgramLocationTable }, { name: tva.e_ProgramInformationTable }, { name: tva.e_GroupInformationTable }],
					tvaEC.ProgramDescription,
					false,
					errs,
					"CG051"
				);
				this.#CheckGroupInformation(ProgramDescription, requestType, groupIds, errs, o);
				this.#CheckProgramInformation(ProgramDescription, programCRIDs, groupIds, requestType, errs, o);
				this.#CheckProgramLocation(ProgramDescription, programCRIDs, null, requestType, errs, o);
				break;
			case CG_REQUEST_BS_CATEGORIES:
				// box set categories response (6.8.2.3) has <GroupInformationTable> element
				checkTopElementsAndCardinality(ProgramDescription, [{ name: tva.e_GroupInformationTable }], tvaEC.ProgramDescription, false, errs, "CG061");
				this.#CheckGroupInformation(ProgramDescription, requestType, null, errs, null);
				break;
			case CG_REQUEST_BS_LISTS:
				// box set lists response (6.8.3.3) has <GroupInformationTable> element
				checkTopElementsAndCardinality(ProgramDescription, [{ name: tva.e_GroupInformationTable }], tvaEC.ProgramDescription, false, errs, "CG071");
				this.#CheckGroupInformation(ProgramDescription, requestType, null, errs, null);
				break;
			case CG_REQUEST_BS_CONTENTS:
				// box set contents response (6.8.4.3) has <ProgramInformationTable>, <GroupInformationTable> and <ProgramLocationTable> elements
				if (
					!checkTopElementsAndCardinality(
						ProgramDescription,
						[{ name: tva.e_ProgramLocationTable }, { name: tva.e_ProgramInformationTable }, { name: tva.e_GroupInformationTable }],
						tvaEC.ProgramDescription,
						false,
						errs,
						"CG081"
					)
				)
					errs.errorDescription({
						code: "CG081",
						clause: "A177 clause 6.8.4.3",
						description: `the required child elements of ${tva.e_ProgramDescription.elementize()} for Box Set Contents need to be provied`,
					});
				this.#CheckGroupInformation(ProgramDescription, requestType, groupIds, errs, o);
				this.#CheckProgramInformation(ProgramDescription, programCRIDs, groupIds, requestType, errs, o);
				this.#CheckProgramLocation(ProgramDescription, programCRIDs, null, requestType, errs, o);
				break;
		}

		CG.dispose();
	}

	/**
	 * validate the content guide and record any errors
	 *
	 * @param {String} CGtext        the service list text to be validated
	 * @param {String} requestType   the type of CG request/response (specified in the form/query as not possible to deduce from metadata)
	 * @returns {ErrorList} errs errors found in validaton
	 */
	validateContentGuide(CGtext, requestType) {
		var errs = new ErrorList();
		this.doValidateContentGuide(CGtext, requestType, errs, { report_schema_version: true });

		return new Promise((resolve, /* eslint-disable no-unused-vars*/ reject /* eslint-enable */) => {
			resolve(errs);
		});
	}
}
