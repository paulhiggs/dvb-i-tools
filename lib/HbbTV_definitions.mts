/**
 * HbbTV_defintions.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Defintions made in the HbbTV Specification, ETSI TS 102 796
 */

export const HBBTV_APP_TYPE: string = "application/vnd.hbbtv.xhtml+xml";

export const hbbtv: Record<string, string> = {
	serviceIdentifierTriplet_extension : "urn:hbbtv:dvbi:service:serviceIdentifierTriplet",
};

const HbbTVStandardPrefix: string = "urn:hbbtv:appinformation:standardversion:hbbtv";
const HbbTVFeaturePrefix: string = "urn:hbbtv:appinformation:optionalfeature:hbbtv";

export const HbbTV_Standard_versions: string[] = [
		`${HbbTVStandardPrefix}:1.2.1`,
		`${HbbTVStandardPrefix}:1.4.1`,
		`${HbbTVStandardPrefix}:1.5.1`,
		`${HbbTVStandardPrefix}:1.6.1`,
		`${HbbTVStandardPrefix}:1.7.1`,
 		`${HbbTVStandardPrefix}:1.8.1`,
]

export const HbbTV_Features: string[] = [
		`${HbbTVFeaturePrefix}:2decoder`,
		`${HbbTVFeaturePrefix}:2html`,
		`${HbbTVFeaturePrefix}:graphics_01`,
		`${HbbTVFeaturePrefix}:graphics_02`,
		`${HbbTVFeaturePrefix}:screader`,
]
