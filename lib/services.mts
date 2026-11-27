/**
 * services.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Builds the services the routes use: the reference data (classification schemes, languages, countries), the document
 * checkers and the service list registry (SLEPR). They are built once, as their constructors load the reference data and
 * schemas, and shared by every request
 */

import {
	LoadDeviceTypes,
	LoadGenres,
	LoadRatings,
	LoadVideoCodecCS,
	LoadAudioCodecCS,
	LoadAudioPresentationCS,
	LoadAccessibilityPurpose,
	LoadAudioPurpose,
	LoadSubtitleCodings,
	LoadSubtitlePurposes,
	LoadLanguages,
	LoadCountries,
	LoadSubtitleCarriages,
	LoadLinkedApplicationCS,
} from "./classification_scheme_loaders.mts"
import ServiceListCheck from "./sl_check.mts"
import PlaylistCheck from "./playlist_check.mts"
import ContentGuideCheck from "./cg_check.mts"
import ServiceListRegistryCheck from "./slr_check.mts"
import XmlAitCheck from "./ait_check.mts"
import SLEPR from "./slepr.mts"
import type { ValidatorConfig } from "./config.mts"

export type ValidatorServices = Readonly<{
	slcheck?: ServiceListCheck;
	plcheck?: PlaylistCheck;
	cgcheck?: ContentGuideCheck;
	slrcheck?: ServiceListRegistryCheck;
	aitcheck?: XmlAitCheck;
	csr?: SLEPR; // answers /query from the master SLEPR document
}>;

/**
 * build the checkers and the service list registry that the configuration enables
 *
 * @param {ValidatorConfig} config  the configuration
 * @returns {ValidatorServices} the services
 */
export function createServices(config: ValidatorConfig): ValidatorServices {
	const load = { useURLs: config.useURLs, async: false, verbose: true };
	const { sl, pl, cg, slr, ait, csr: offerCSR } = config.features;

	const knownLanguages = LoadLanguages(load);
	const isoCountries = LoadCountries(load);
	const knownGenres = LoadGenres(load);

	// the XML AIT checker needs only its schemas. The service list and content guide checkers use it for the AITs that
	// their documents refer to
	const aitcheck = ait ? new XmlAitCheck(load) : undefined;

	let slcheck: ServiceListCheck | undefined = undefined,
		plcheck: PlaylistCheck | undefined = undefined,
		cgcheck: ContentGuideCheck | undefined = undefined,
		slrcheck: ServiceListRegistryCheck | undefined = undefined;

	if (sl || pl || cg || slr) {
		const knownRatings = LoadRatings(load);
		const accessibilityPurposes = LoadAccessibilityPurpose(load);
		const audioPurposes = LoadAudioPurpose(load);
		const subtitleCarriages = LoadSubtitleCarriages(load);
		const subtitleCodings = LoadSubtitleCodings(load);
		const subtitlePurposes = LoadSubtitlePurposes(load);
		const videoFormats = LoadVideoCodecCS(load);
		const audioFormats = LoadAudioCodecCS(load);
		const audioPresentation = LoadAudioPresentationCS(load);
		const linkedApplicationTypes = LoadLinkedApplicationCS(load);
		const deviceTypes = LoadDeviceTypes(load);

		if (cg)
			cgcheck = new ContentGuideCheck({
				...load,
				accessibilities: accessibilityPurposes,
				audiofmts: audioFormats,
				audiopres: audioPresentation,
				audiopurps: audioPurposes,
				countries: isoCountries,
				genres: knownGenres,
				languages: knownLanguages,
				ratings: knownRatings,
				stcarriage: subtitleCarriages,
				stcodings: subtitleCodings,
				stpurposes: subtitlePurposes,
				videofmts: videoFormats,
				devicetypes: deviceTypes,
				aitcheck,
			});

		// the service list checker traverses into content guide documents with the content guide checker
		if (sl)
			slcheck = new ServiceListCheck(
				{
					...load,
					accessibilities: accessibilityPurposes,
					audiofmts: audioFormats,
					audiopres: audioPresentation,
					audiopurps: audioPurposes,
					countries: isoCountries,
					genres: knownGenres,
					languages: knownLanguages,
					stcarriage: subtitleCarriages,
					stcodings: subtitleCodings,
					stpurposes: subtitlePurposes,
					videofmts: videoFormats,
					appfmts: linkedApplicationTypes,
					devicetypes: deviceTypes,
					aitcheck,
				},
				cgcheck
			);

		if (pl) plcheck = new PlaylistCheck(load);

		// the registry checker traverses into service lists with the service list checker
		if (slr)
			slrcheck = new ServiceListRegistryCheck(
				{
					...load,
					countries: isoCountries,
					genres: knownGenres,
					languages: knownLanguages,
					appfmts: linkedApplicationTypes,
				},
				slcheck
			);
	}

	let csr: SLEPR | undefined = undefined;
	if (offerCSR) {
		csr = new SLEPR(config.useURLs, config.slrMode, knownLanguages, isoCountries, knownGenres);
		csr.loadServiceListRegistry(config.csrFile);
	}

	return Object.freeze({ slcheck, plcheck, cgcheck, slrcheck, aitcheck, csr });
}
