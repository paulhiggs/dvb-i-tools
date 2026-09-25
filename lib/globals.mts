/**
 * globals.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Useful globally applicable definitions
 */

export const HTTPPort: Record<string, number> = {
	csr: 3000,
	all_in_one: 3030,
};

export const CORSmanual: string = "manual",
	CORSlibrary: string = "library",
	CORSnone: string = "none";

export const CORSoptions: string[]= [CORSmanual, CORSlibrary, CORSnone];

export const StandardStatus: Record<string, number> = {
	DRAFT: 0x01,
	OLD: 0x02,
	ETSI: 0x04,
	CURRENT: 0x08,
};

export const fetch_options: Record<string, unknown> = {
	headers: {
		'User-Agent': 'DVB-I validator',
	},
}

export const GERMAN_A177r6_VARIANT: number = 0b0000000000000001;

export type LoadOptions = {
	useURLs: boolean	// when true, load from network locations, else use local files
	async: boolean		// load asynchronously - OK for service, not NOT for command line validator
	verbose: boolean	// display verbose output
	purge?: boolean   // clear the storage before loading/reloading
}

export type StatsType = Record<string, string | number>