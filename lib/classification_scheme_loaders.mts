/**
 * classification_scheme_loaders.mts

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

export function LoadCountries(useURLs : boolean, async : boolean = true) : ISOcountries {
	console.log(chalk.yellow.underline("loading countries..."));
	let c = new ISOcountries(false, true);
	c.loadCountries(useURLs ? { url: ISO3166.url } : { file: ISO3166.file }, async);
	return c;
}

export function LoadLanguages(useURLs : boolean, async : boolean = true) : IANAlanguages {
	console.log(chalk.yellow.underline("loading languages..."));
	let l = new IANAlanguages();
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

export function LoadVideoCodecCS(useURLs : boolean, async : boolean = true) : ClassificationScheme {
	console.log(chalk.yellow.underline("loading Video Codecs..."));
	let cs = new ClassificationScheme();
	cs.loadCS(
		useURLs
			? {
					urls: [DVB_VideoCodecCS.y2007.url, DVB_VideoCodecCS.y2021.url, DVB_VideoCodecCS.y2022.url, MPEG7_VisualCodingFormatCS.url],
					leafNodesOnly: true,
			  }
			: {
					files: [DVB_VideoCodecCS.y2007.file, DVB_VideoCodecCS.y2021.file, DVB_VideoCodecCS.y2022.file, MPEG7_VisualCodingFormatCS.file],
					leafNodesOnly: true,
			  },
		async
	);
	return cs;
}

export function LoadAudioCodecCS(useURLs : boolean, async : boolean  = true) : ClassificationScheme {
	console.log(chalk.yellow.underline("loading Audio Codecs..."));
	let cs = new ClassificationScheme();
	cs.loadCS(
		useURLs
			? {
					urls: [DVB_AudioCodecCS.y2007.url, DVB_AudioCodecCS.y2020.url, DVB_AudioCodecCS.y2024.url],
					leafNodesOnly: true,
			  }
			: {
					files: [DVB_AudioCodecCS.y2007.file, DVB_AudioCodecCS.y2020.file, DVB_AudioCodecCS.y2024.file],
					leafNodesOnly: true,
			  },
		async,
		[MPEG1_layer_2]
	);
	return cs;
}

export function LoadGenres(useURLs : boolean, async : boolean = true) : ClassificationScheme {
	console.log(chalk.yellow.underline("loading Genres ..."));
	let cs = new ClassificationScheme();
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

export function LoadAccessibilityPurpose(useURLs : boolean, async : boolean = true) : ClassificationScheme{
	console.log(chalk.yellow.underline("loading Accessibility Purposes..."));
	let cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: TVA_AccessibilityPurposeCS.url, leafNodesOnly: true } : { file: TVA_AccessibilityPurposeCS.file, leafNodesOnly: true }, async);
	return cs;
}

export function LoadAudioPurpose(useURLs : boolean, async : boolean = true) : ClassificationScheme {
	console.log(chalk.yellow.underline("loading Audio Purposes..."));
	let cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: TVA_AudioPurposeCS.url, leafNodesOnly: true } : { file: TVA_AudioPurposeCS.file, leafNodesOnly: true }, async);
	return cs;
}

export function LoadSubtitleCarriages(useURLs : boolean, async : boolean = true) : ClassificationScheme {
	console.log(chalk.yellow.underline("loading Subtitle Carriages..."));
	let cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: TVA_SubitleCarriageCS.url } : { file: TVA_SubitleCarriageCS.file }, async);
	return cs;
}

export function LoadSubtitleCodings(useURLs : boolean, async : boolean = true) : ClassificationScheme {
	console.log(chalk.yellow.underline("loading Subtitle Codings..."));
	let cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: TVA_SubitleCodingFormatCS.url } : { file: TVA_SubitleCodingFormatCS.file }, async);
	return cs;
}

export function LoadSubtitlePurposes(useURLs : boolean, async : boolean = true) : ClassificationScheme {
	console.log(chalk.yellow.underline("loading Subtitle Purposes..."));
	let cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: TVA_SubitlePurposeCS.url } : { file: TVA_SubitlePurposeCS.file }, async);
	return cs;
}

export function LoadAudioConformanceCS(useURLs : boolean, async : boolean = true) : ClassificationScheme {
	console.log(chalk.yellow.underline("loading Audio Conformance Points..."));
	let cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: DVB_AudioConformanceCS.url, leafNodesOnly: true } : { file: DVB_AudioConformanceCS.file, leafNodesOnly: true }, async);
	return cs;
}

export function LoadVideoConformanceCS(useURLs : boolean, async : boolean = true) : ClassificationScheme {
	console.log(chalk.yellow.underline("loading Video Conformance Points..."));
	let cs = new ClassificationScheme();
	cs.loadCS(
		useURLs
			? {
					urls: [DVB_VideoConformanceCS.y2017.url, DVB_VideoConformanceCS.y2021.url, DVB_VideoConformanceCS.y2022.url, DVB_VideoConformanceCS.y2024.url],
					leafNodesOnly: true,
			  }
			: {
					files: [DVB_VideoConformanceCS.y2017.file, DVB_VideoConformanceCS.y2021.file, DVB_VideoConformanceCS.y2022.file, DVB_VideoConformanceCS.y2024.file],
					leafNodesOnly: true,
			  },
		async
	);
	return cs;
}

export function LoadAudioPresentationCS(useURLs : boolean, async : boolean = true) : ClassificationScheme {
	console.log(chalk.yellow.underline("loading AudioPresentation..."));
	let cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: MPEG7_AudioPresentationCS.url } : { file: MPEG7_AudioPresentationCS.file }, async);
	return cs;
}

export function LoadRecordingInfoCS(useURLs : boolean, async : boolean = true) : ClassificationScheme {
	console.log(chalk.yellow.underline("loading Recording Info..."));
	let cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: DVBI_RecordingInfoCS.url } : { file: DVBI_RecordingInfoCS.file }, async);
	return cs;
}

export function LoadPictureFormatCS(useURLs : boolean, async : boolean = true) : ClassificationScheme {
	console.log(chalk.yellow.underline("loading PictureFormats..."));
	let cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: TVA_PictureFormatCS.url } : { file: TVA_PictureFormatCS.file }, async);
	return cs;
}

export function LoadColorimetryCS(useURLs : boolean, async : boolean = true) : ClassificationScheme {
	console.log(chalk.yellow.underline("loading Colorimetry..."));
	let cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: DVB_ColorimetryCS.y2020.url, leafNodesOnly: true } : { file: DVB_ColorimetryCS.y2020.file, leafNodesOnly: true }, async);
	return cs;
}

export function LoadServiceTypeCS(useURLs : boolean, async : boolean = true) : ClassificationScheme {
	console.log(chalk.yellow.underline("loading ServiceTypes..."));
	let cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { url: DVBI_ServiceTypeCS.url } : { file: DVBI_ServiceTypeCS.file }, async);
	return cs;
}

export function LoadRatings(useURLs : boolean, async : boolean = true) : ClassificationScheme {
	console.log(chalk.yellow.underline("loading Ratings..."));
	let cs = new ClassificationScheme();
	cs.loadCS(useURLs ? { urls: [TVA_ContentAlertCS.url, DVBI_ParentalGuidanceCS.url] } : { files: [TVA_ContentAlertCS.file, DVBI_ParentalGuidanceCS.file] }, async);
	return cs;
}
