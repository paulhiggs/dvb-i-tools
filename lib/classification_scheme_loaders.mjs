/**
 * classification_scheme_loaders.mjs
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Load Classification Schemes and other File related resources
 */

import chalk from "chalk";

import IANAlanguages from "./IANA_languages.mjs";
import ISOcountries from "./ISO_countries.mjs";
import {
	IANA_Subtag_Registry,
	TVA_ContentCS,
	TVA_FormatCS,
	DVBI_ContentSubject,
	ISO3166,
	TVA_PictureFormatCS,
	DVBI_ServiceTypeCS,
	DVB_AudioCodecCS,
	DVB_AudioConformanceCS,
	DVB_VideoCodecCS,
	MPEG7_VisualCodingFormatCS,
	DVB_VideoConformanceCS,
	MPEG7_AudioCodingFormatCS,
	MPEG7_AudioPresentationCS,
	DVBI_RecordingInfoCS,
	DVB_ColorimetryCS,
	TVA_AccessibilityPurposeCS,
	TVA_AudioPurposeCS,
	TVA_SubitleCarriageCS,
	TVA_SubitleCodingFormatCS,
	TVA_SubitlePurposeCS,
	TVA_ContentAlertCS,
	DVBI_ParentalGuidanceCS,
	DVBI_CreditsItemRoles, 
	DVBIv2_CreditsItemRoles,
	DVBI_LinkedApplicationCS,
} from "./data_locations.mjs";
import { MPEG1_layer_2 } from "./MPEG7_definitions.mjs";
import ClassificationScheme from "./classification_scheme.mjs";
import Role from "./role.mjs";



/**
 * Load countries
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ISOcountries} class containing the loaded country values
 */
export function LoadCountries(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading countries..."));
	const c = new ISOcountries(false, true);
	c.loadCountries(opts.useURLs ? { url: ISO3166.url } : { file: ISO3166.file }, opts);
	return c;
}


/**
 * Load languages
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {IANAlanguages} class containing the loaded languages
 */
export function LoadLanguages(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading languages..."));
	const l = new IANAlanguages();
	l.loadLanguages(
		opts.useURLs
			? {
					url: IANA_Subtag_Registry.url,
					purge: true,
			  }
			: {
					file: IANA_Subtag_Registry.file,
					purge: true,
			  },
		opts
	);
	return l;
}


/**
 * Load video coding values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded video codec values
 */
export function LoadVideoCodecCS(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading Video Codecs..."));
	const cs = new ClassificationScheme();
	cs.loadCS(
		opts.useURLs
			? {
					urls: [
						DVB_VideoCodecCS.y2007.url, 
						DVB_VideoCodecCS.y2020.url, 
						DVB_VideoCodecCS.y2021.url, 
						DVB_VideoCodecCS.y2022.url, 
						MPEG7_VisualCodingFormatCS.url
					],
			  }
			: {
					files: [
						DVB_VideoCodecCS.y2007.file, 
						DVB_VideoCodecCS.y2020.file,
						DVB_VideoCodecCS.y2021.file,
						DVB_VideoCodecCS.y2022.file, 
						MPEG7_VisualCodingFormatCS.file
					],
			  },
		opts
	);
	return cs;
}


/**
 * Load audio coding values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded audio codec values
 */
export function LoadAudioCodecCS(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading Audio Codecs..."));
	const cs = new ClassificationScheme();
	cs.loadCS(
		opts.useURLs
			? {
					urls: [
						MPEG7_AudioCodingFormatCS.url, 
						DVB_AudioCodecCS.y2007.url, 
						DVB_AudioCodecCS.y2020.url,
						DVB_AudioCodecCS.y2024.url
					],
			  }
			: {
					files: [
						MPEG7_AudioCodingFormatCS.file, 
						DVB_AudioCodecCS.y2007.file, 
						DVB_AudioCodecCS.y2020.file, 
						DVB_AudioCodecCS.y2024.file
					],
			  },
		opts,
		[MPEG1_layer_2]
	);
	return cs;
}


/**
 * Load genre values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded genre values
 */
export function LoadGenres(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading Genres ..."));
	const cs = new ClassificationScheme();
	cs.loadCS(
		opts.useURLs
			? {
					urls: [TVA_ContentCS.url, TVA_FormatCS.url, DVBI_ContentSubject.url],
			  }
			: {
					files: [TVA_ContentCS.file, TVA_FormatCS.file, DVBI_ContentSubject.file],
			  },
		opts
	);
	return cs;
}


/**
 * Load values for accessibility purpose values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded purpose values
 */
export function LoadAccessibilityPurpose(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading Accessibility Purposes..."));
	const cs = new ClassificationScheme();
	cs.loadCS(opts.useURLs ? { url: TVA_AccessibilityPurposeCS.url } : { file: TVA_AccessibilityPurposeCS.file }, opts);
	return cs;
}


/**
 * Load audio purpose values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded audio purpose values
 */
export function LoadAudioPurpose(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading Audio Purposes..."));
	const cs = new ClassificationScheme();
	cs.loadCS(opts.useURLs ? { url: TVA_AudioPurposeCS.url } : { file: TVA_AudioPurposeCS.file }, opts);
	return cs;
}


/**
 * Load audio coding values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded audio codec values
 */
export function LoadSubtitleCarriages(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading Subtitle Carriages..."));
	const cs = new ClassificationScheme();
	cs.loadCS(opts.useURLs ? { url: TVA_SubitleCarriageCS.url } : { file: TVA_SubitleCarriageCS.file }, opts);
	return cs;
}

/**
 * Load subtitle coding/format values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded subtitle coding/format values
 */
export function LoadSubtitleCodings(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading Subtitle Codings..."));
	const cs = new ClassificationScheme();
	cs.loadCS(opts.useURLs ? { url: TVA_SubitleCodingFormatCS.url } : { file: TVA_SubitleCodingFormatCS.file }, opts);
	return cs;
}


/**
 * Load subtitle purpose values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded subtitle purpose values
 */
export function LoadSubtitlePurposes(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading Subtitle Purposes..."));
	const cs = new ClassificationScheme();
	cs.loadCS(opts.useURLs ? { url: TVA_SubitlePurposeCS.url } : { file: TVA_SubitlePurposeCS.file }, opts);
	return cs;
}


/**
 * Load audio conformance point values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded audio conformance point values
 */
export function LoadAudioConformanceCS(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading Audio Conformance Points..."));
	const cs = new ClassificationScheme();
	cs.loadCS(opts.useURLs ? { url: DVB_AudioConformanceCS.url } : { file: DVB_AudioConformanceCS.file}, opts);
	return cs;
}


/**
 * Load video conformance point values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded video conformance point values
 */
export function LoadVideoConformanceCS(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading Video Conformance Points..."));
	const cs = new ClassificationScheme();
	cs.loadCS(
		opts.useURLs
			? {
					urls: [
						DVB_VideoConformanceCS.y2017.url, 
						DVB_VideoConformanceCS.y2021.url, 
						DVB_VideoConformanceCS.y2022.url, 
						DVB_VideoConformanceCS.y2024.url
					],
				}
			: {
					files: [
						DVB_VideoConformanceCS.y2017.file, 
						DVB_VideoConformanceCS.y2021.file, 
						DVB_VideoConformanceCS.y2022.file, 
						DVB_VideoConformanceCS.y2024.file
					],
			  },
		opts
	);
	return cs;
}

/**
 * Load audio presentation values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded audio presentation values
 */
export function LoadAudioPresentationCS(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading AudioPresentation..."));
	const cs = new ClassificationScheme();
	cs.loadCS(opts.useURLs ? { url: MPEG7_AudioPresentationCS.url } : { file: MPEG7_AudioPresentationCS.file }, opts);
	return cs;
}


/**
 * Load recording status values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded recording status values
 */
export function LoadRecordingInfoCS(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading Recording Info..."));
	const cs = new ClassificationScheme();
	cs.loadCS(opts.useURLs ? { url: DVBI_RecordingInfoCS.url } : { file: DVBI_RecordingInfoCS.file }, opts);
	return cs;
}


/**
 * Load picture formt values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded picture format values
 */
export function LoadPictureFormatCS(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading Picture Formats..."));
	const cs = new ClassificationScheme();
	cs.loadCS(opts.useURLs ? { url: TVA_PictureFormatCS.url } : { file: TVA_PictureFormatCS.file }, opts);
	return cs;
}


/**
 * Load colorimetry values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded colorimetry values
 */
export function LoadColorimetryCS(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading Colorimetry..."));
	const cs = new ClassificationScheme();
	cs.loadCS(opts.useURLs ? { url: DVB_ColorimetryCS.y2020.url } : { file: DVB_ColorimetryCS.y2020.file }, opts);
	return cs;
}


/**
 * Load service type values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded service type values
 */
export function LoadServiceTypeCS(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading Service Types..."));
	const cs = new ClassificationScheme();
	cs.loadCS(opts.useURLs ? { url: DVBI_ServiceTypeCS.url } : { file: DVBI_ServiceTypeCS.file }, opts);
	return cs;
}


/**
 * Load content ratings values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded content ratings values
 */
export function LoadRatings(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading Ratings..."));
	const cs = new ClassificationScheme();
	cs.loadCS(opts.useURLs 
			? { urls: [TVA_ContentAlertCS.url, DVBI_ParentalGuidanceCS.url] } 
			: { files: [TVA_ContentAlertCS.file, DVBI_ParentalGuidanceCS.file] }, 
		opts
	);
	return cs;
}


/**
 * Load program credits values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {Role} class containing the loaded credits values
 */
export function LoadCredits(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading CreditsItem roles..."));
	const credits = new Role();
	credits.loadRoles(opts.useURLs ? { urls: [DVBI_CreditsItemRoles.url, DVBIv2_CreditsItemRoles.url] } : { files: [DVBI_CreditsItemRoles.file, DVBIv2_CreditsItemRoles.file] }, opts);
	return credits;
}

/**
 * Load linked application type values
 * 
 * @param {Boolean} opts.useURLs  when true, load from network locations, else use local files
 * @param {Boolean} opts.async    load asynchronously - OK for service, not NOT for command line validator
 * @param {boolean} opts.verbose  display verbose output
 * @returns {ClassificationScheme} class containing the loaded linked application type values
 */
export function LoadLinkedApplicationCS(opts) {
	if (opts.verbose) console.log(chalk.yellow.underline("loading Linked Application Types..."));
	const cs = new ClassificationScheme();
	cs.loadCS(opts.useURLs ? { url: DVBI_LinkedApplicationCS.url } : { file: DVBI_LinkedApplicationCS.file }, opts);
	return cs;
}

