/**
 * globals.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Useful globally applicable definitions
 */

export const HTTPPort = {
	csr: 3000,
	all_in_one: 3030,
};

export const CORSmanual : string = "manual",
	CORSlibrary : string = "library",
	CORSnone : string = "none";

export const CORSoptions : Array<string>= [CORSmanual, CORSlibrary, CORSnone];

export const StandardStatus = {
	DRAFT: 0x01,
	OLD: 0x02,
	ETSI: 0x04,
	CURRENT: 0x08,
};

export const fetch_options : Record<string, unknown> = {
	headers: {
		'User-Agent': 'DVB-I validator',
	},
}

export const GERMAN_A177r6_VARIANT = 0b0000000000000001;
