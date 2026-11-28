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

// how long a shutdown (SIGTERM or SIGINT) waits for the requests in progress before the process exits, by default. It is
// less than the 10 s that "docker stop" waits before it kills the container. The server's own value is
// shutdownGraceMs() (server.shutdownGraceMs of the configuration file, issue #147)
export const SHUTDOWN_GRACE_MS = 8000;
export const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];

// the User-Agent of every request the validator makes, and the timeout of a retrieval (ms), unless the configuration
// gives others (fetch.userAgent and fetch.timeoutMs, issue #147)
export const DEFAULT_USER_AGENT = "DVB-I validator";
export const DEFAULT_FETCH_TIMEOUT_MS = 3000;

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

// the options of the retrievals of reference data (sync-fetch and fetch()). safe_fetch.mts uses the same User-Agent.
// setSystemSettings() changes them in place, so every module that imported them sees the configured values
export const fetch_options: Record<string, unknown> /* SyncRequestInit */ = {
	headers: {
		'User-Agent': DEFAULT_USER_AGENT,
	},
	timeout: DEFAULT_FETCH_TIMEOUT_MS,
}

// the settings of the process that its modules read when they need them, set once from the configuration (issue #147)
type SystemSettings = {
	shutdownGraceMs: number; // how long a shutdown waits for the requests in progress
	archiveFolder?: string; // where the documents validated are archived, when the folder exists (logger.mts)
	logFolder?: string; // where the request log is written, when the folder exists (request_logging.mts)
};
const systemSettings: SystemSettings = { shutdownGraceMs: SHUTDOWN_GRACE_MS };

/**
 * set the settings of the process from the configuration: the User-Agent and timeout of every retrieval, the shutdown
 * grace period, and the archive and log folders
 */
export function setSystemSettings(settings: Partial<SystemSettings> & { userAgent?: string; fetchTimeoutMs?: number }): void {
	const { userAgent, fetchTimeoutMs, ...rest } = settings;
	if (userAgent != undefined) (fetch_options.headers as Record<string, string>)["User-Agent"] = userAgent;
	if (fetchTimeoutMs != undefined) fetch_options.timeout = fetchTimeoutMs;
	Object.assign(systemSettings, rest);
}

export const userAgent = (): string => (fetch_options.headers as Record<string, string>)["User-Agent"];
export const shutdownGraceMs = (): number => systemSettings.shutdownGraceMs;
export const archiveFolder = (): string | undefined => systemSettings.archiveFolder;
export const logFolder = (): string | undefined => systemSettings.logFolder;

export type LoadOptions = {
	useURLs: boolean	// when true, load from network locations, else use local files
	async: boolean		// load asynchronously - OK for service, not NOT for command line validator
	verbose: boolean	// display verbose output
	purge?: boolean   // clear the storage before loading/reloading
}

export type StatsType = Record<string, string | number>

export const read_string_options: ReadFileSyncOptionsWithStringEncoding = { encoding: "utf-8" }