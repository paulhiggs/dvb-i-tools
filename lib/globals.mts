/**
 * globals.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Useful globally applicable definitions
 */

import type { ReadFileSyncOptionsWithStringEncoding } from "fs"

export const HTTPPort: Record<string, number> = {
	csr: 3000,
	all_in_one: 3030,
};

// how long a shutdown (SIGTERM or SIGINT) waits for the requests in progress before the process exits. It is less than the
// 10 s that "docker stop" waits before it kills the container
export const SHUTDOWN_GRACE_MS = 8000;
export const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];

export const CORSmanual: string = "manual",
	CORSlibrary: string = "library",
	CORSnone: string = "none";

export const CORSoptions: string[]= [CORSmanual, CORSlibrary, CORSnone];

export const StandardStatus = new class {
	DRAFT: number = 0x01
	OLD: number = 0x02
	ETSI: number = 0x04
	CURRENT: number = 0x08
};

export const fetch_options: Record<string, unknown> /* SyncRequestInit */ = {
	headers: {
		'User-Agent': 'DVB-I validator',
	},
	timeout: 3000,
}

export type LoadOptions = {
	useURLs: boolean	// when true, load from network locations, else use local files
	async: boolean		// load asynchronously - OK for service, not NOT for command line validator
	verbose: boolean	// display verbose output
	purge?: boolean   // clear the storage before loading/reloading
}

export type StatsType = Record<string, string | number>

export const read_string_options: ReadFileSyncOptionsWithStringEncoding = { encoding: "utf-8" }