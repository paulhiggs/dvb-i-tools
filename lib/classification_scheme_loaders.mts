/**
 * classification_scheme_loaders.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Load Classification Schemes and other File related resources
 */

import chalk from "chalk";

import IANAlanguages from "./IANA_languages.mts";
import ISOcountries from "./ISO_countries.mts";
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
} from "./data_locations.mts";
import { MPEG1_layer_2 } from "./MPEG7_definitions.mts";
import ClassificationScheme from "./classification_scheme.mts";

export function LoadCountries(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading countries..."));
	const c = new ISOcountries(false, true);
	c.loadCountries(useURLs ? { url: ISO3166.url } : { file: ISO3166.file }, async);
	return c;
}

export function LoadLanguages(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading languages..."));
	const l = new IANAlanguages();
	l.loadLanguages(
		useURLs
			? {
					url: IANA_Subtag_Registry.url,
					purge: true,
			  }
			: {
					file: IANA_Subtag_Registry.file,
					purge: true,
			  },
		async
	);
	return l;
}

export function LoadVideoCodecCS(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading Video Codecs..."));
	const cs = new ClassificationScheme();
	cs.loadCS(
		useURLs
			? {
					urls: [DVB_VideoCodecCS.y2007.url, DVB_VideoCodecCS.y2021.url, DVB_VideoCodecCS.y2022.url, MPEG7_VisualCodingFormatCS.url],
			  }
			: {
					files: [DVB_VideoCodecCS.y2007.file, DVB_VideoCodecCS.y2021.file, DVB_VideoCodecCS.y2022.file, MPEG7_VisualCodingFormatCS.file],
			  },
		async
	);
	return cs;
}

export function LoadAudioCodecCS(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading Audio Codecs..."));
	const cs = new ClassificationScheme();
	cs.loadCS(
		useURLs
			? {
					urls: [DVB_AudioCodecCS.y2007.url, DVB_AudioCodecCS.y2020.url, DVB_AudioCodecCS.y2024.url],
			  }
			: {
					files: [DVB_AudioCodecCS.y2007.file, DVB_AudioCodecCS.y2020.file, DVB_AudioCodecCS.y2024.file],
			  },
		async,
		[MPEG1_layer_2]
	);
	return cs;
}

export function LoadGenres(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading Genres ..."));
	const cs = new ClassificationScheme();
	cs.loadCS(
		useURLs
			? {
					urls: [TVA_ContentCS.url, TVA_FormatCS.url, DVBI_ContentSubject.url],
			  }
			: {
					files: [TVA_ContentCS.file, TVA_FormatCS.file, DVBI_ContentSubject.file],
			  },
		async
	);
	return cs;
}

export function LoadAccessibilityPurpose(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading Accessibility Purposes..."));
	const cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: TVA_AccessibilityPurposeCS.url } : { file: TVA_AccessibilityPurposeCS.file }, async);
	return cs;
}

export function LoadAudioPurpose(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading Audio Purposes..."));
	const cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: TVA_AudioPurposeCS.url } : { file: TVA_AudioPurposeCS.file }, async);
	return cs;
}

export function LoadSubtitleCarriages(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading Subtitle Carriages..."));
	const cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: TVA_SubitleCarriageCS.url } : { file: TVA_SubitleCarriageCS.file }, async);
	return cs;
}

export function LoadSubtitleCodings(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading Subtitle Codings..."));
	const cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: TVA_SubitleCodingFormatCS.url } : { file: TVA_SubitleCodingFormatCS.file }, async);
	return cs;
}

export function LoadSubtitlePurposes(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading Subtitle Purposes..."));
	const cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: TVA_SubitlePurposeCS.url } : { file: TVA_SubitlePurposeCS.file }, async);
	return cs;
}

export function LoadAudioConformanceCS(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading Audio Conformance Points..."));
	const cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: DVB_AudioConformanceCS.url } : { file: DVB_AudioConformanceCS.file}, async);
	return cs;
}

export function LoadVideoConformanceCS(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading Video Conformance Points..."));
	const cs = new ClassificationScheme();
	cs.loadCS(
		useURLs
			? {
					urls: [DVB_VideoConformanceCS.y2017.url, DVB_VideoConformanceCS.y2021.url, DVB_VideoConformanceCS.y2022.url, DVB_VideoConformanceCS.y2024.url],
				}
			: {
					files: [DVB_VideoConformanceCS.y2017.file, DVB_VideoConformanceCS.y2021.file, DVB_VideoConformanceCS.y2022.file, DVB_VideoConformanceCS.y2024.file],
			  },
		async
	);
	return cs;
}

export function LoadAudioPresentationCS(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading AudioPresentation..."));
	const cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: MPEG7_AudioPresentationCS.url } : { file: MPEG7_AudioPresentationCS.file }, async);
	return cs;
}

export function LoadRecordingInfoCS(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading Recording Info..."));
	const cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: DVBI_RecordingInfoCS.url } : { file: DVBI_RecordingInfoCS.file }, async);
	return cs;
}

export function LoadPictureFormatCS(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading PictureFormats..."));
	const cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: TVA_PictureFormatCS.url } : { file: TVA_PictureFormatCS.file }, async);
	return cs;
}

export function LoadColorimetryCS(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading Colorimetry..."));
	const cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: DVB_ColorimetryCS.y2020.url } : { file: DVB_ColorimetryCS.y2020.file }, async);
	return cs;
}

export function LoadServiceTypeCS(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading ServiceTypes..."));
	const cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: DVBI_ServiceTypeCS.url } : { file: DVBI_ServiceTypeCS.file }, async);
	return cs;
}

export function LoadRatings(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading Ratings..."));
	const cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { urls: [TVA_ContentAlertCS.url, DVBI_ParentalGuidanceCS.url] } : { files: [TVA_ContentAlertCS.file, DVBI_ParentalGuidanceCS.file] }, async);
	return cs;
}
