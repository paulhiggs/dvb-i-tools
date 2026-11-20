/**
 * safe_fetch.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * A single place to retrieve documents whose location is supplied by a client or found in a validated document.
 * The retrieval policy (allowed URL schemes, private/local addresses, response size, timeout) and the limits
 * on traversing into referenced documents are applied here.
 */

import { BlockList, isIP } from "node:net"
import fetchS from "sync-fetch"

import { fetch_options } from "./globals.mts"

export type FetchPolicy = {
	allowPrivateAddresses: boolean // when false, URLs whose host is a loopback, private, link-local etc. address are refused
	maxResponseBytes: number // responses larger than this are rejected
	timeout: number // milliseconds
	maxTraversalDepth: number // maximum nesting of documents traversed from the document being validated
	maxTraversalDocuments: number // maximum number of documents traversed during a single validation
};

const policy: FetchPolicy = {
	allowPrivateAddresses: true,
	maxResponseBytes: 10 * 1024 * 1024,
	timeout: fetch_options.timeout as number,
	maxTraversalDepth: 10,
	maxTraversalDocuments: 100,
};

/**
 * update the fetch policy - unspecified values are unchanged
 */
export function configureFetchPolicy(update: Partial<FetchPolicy>): void {
	Object.assign(policy, update);
}

export const currentFetchPolicy = (): Readonly<FetchPolicy> => ({ ...policy });

// address ranges that should not be reachable from a public validator
const privateRanges = new BlockList();
[
	["0.0.0.0", 8], // "this" network
	["10.0.0.0", 8], // RFC 1918
	["100.64.0.0", 10], // carrier grade NAT
	["127.0.0.0", 8], // loopback
	["169.254.0.0", 16], // link-local, includes cloud metadata services
	["172.16.0.0", 12], // RFC 1918
	["192.0.0.0", 24], // IETF protocol assignments
	["192.168.0.0", 16], // RFC 1918
	["198.18.0.0", 15], // benchmarking
	["224.0.0.0", 4], // multicast
	["240.0.0.0", 4], // reserved, includes broadcast
].forEach(([net, prefix]) => privateRanges.addSubnet(net as string, prefix as number, "ipv4"));
[
	["::", 128], // unspecified
	["::1", 128], // loopback
	["fc00::", 7], // unique local
	["fe80::", 10], // link-local
	["ff00::", 8], // multicast
].forEach(([net, prefix]) => privateRanges.addSubnet(net as string, prefix as number, "ipv6"));

// IPv4-mapped IPv6 addresses, as written (::ffff:127.0.0.1) or as normalised by URL (::ffff:7f00:1)
const IPV4_MAPPED = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i,
	IPV4_MAPPED_HEX = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;

/**
 * determine if the host part of a URL names this machine or a private/local network address.
 * Only literal addresses and "localhost" are recognised - names that resolve to private addresses through DNS are not detected.
 *
 * @param {string} hostname  the hostname from a URL object (IPv6 addresses may be enclosed in [])
 * @returns {boolean} true if the host is a local or private address
 */
export function isPrivateHost(hostname: string): boolean {
	let host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
	if (host == "localhost" || host.endsWith(".localhost")) return true;
	const mapped = host.match(IPV4_MAPPED);
	if (mapped) host = mapped[1];
	const mappedHex = host.match(IPV4_MAPPED_HEX);
	if (mappedHex) {
		const hi = parseInt(mappedHex[1], 16),
			lo = parseInt(mappedHex[2], 16);
		host = `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
	}
	switch (isIP(host)) {
		case 4:
			return privateRanges.check(host, "ipv4");
		case 6:
			return privateRanges.check(host, "ipv6");
	}
	return false;
}

/**
 * check if a URL may be fetched under the current policy
 *
 * @param {unknown} url  the URL to check
 * @returns {string | null} null if the URL can be fetched, otherwise the reason it cannot
 */
export function checkFetchURL(url: unknown): string | null {
	if (typeof url != "string" || url.length == 0) return "URL not specified";
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return `${url} is not a valid URL`;
	}
	if (!["http:", "https:"].includes(parsed.protocol)) return `${url} is not an HTTP(S) URL`;
	if (!policy.allowPrivateAddresses && isPrivateHost(parsed.hostname)) return `retrieval from local or private addresses is not permitted (${parsed.hostname})`;
	return null;
}

export type FetchedResponse = {
	ok: boolean
	status: number
	statusText: string
	text(): string
	buffer(): Buffer
};
export type SafeFetchResult = { response?: FetchedResponse; error?: string };

/**
 * synchronously retrieve a resource, applying the fetch policy
 *
 * @param {string} url  the URL to retrieve
 * @returns {SafeFetchResult} either the response (which may have a non-2xx status) or the reason the retrieval did not happen or failed
 */
export function safeFetch(url: string): SafeFetchResult {
	const refused = checkFetchURL(url);
	if (refused) return { error: refused };
	try {
		const resp = fetchS(url, { ...fetch_options, timeout: policy.timeout, size: policy.maxResponseBytes });
		// sync-fetch reports body errors (such as exceeding the size limit) when the body is read, and the body can only be read once
		const body = resp.buffer();
		return {
			response: {
				ok: resp.ok,
				status: resp.status,
				statusText: resp.statusText,
				text: () => body.toString("utf8"),
				buffer: () => body,
			},
		};
	} catch (error) {
		return { error: `${error}` };
	}
}

/*
 * Traversal limits
 *
 * Validation (including the retrieval of referenced documents) is fully synchronous, so a module level counter
 * reflects the validation in progress. This will need to become per-validation state if validation becomes asynchronous.
 */
let traversalDepth = 0,
	traversedDocuments = 0;

/**
 * start the traversal budget for a new top level validation. Has no effect when called for a nested (traversed) document
 */
export function resetTraversalBudget(): void {
	if (traversalDepth == 0) traversedDocuments = 0;
}

/**
 * record entry into a referenced document
 *
 * @returns {string | null} null if the traversal can proceed (exitTraversal() must then be called), otherwise the reason it cannot
 */
export function enterTraversal(): string | null {
	if (traversalDepth >= policy.maxTraversalDepth) return `maximum traversal depth (${policy.maxTraversalDepth}) reached`;
	if (traversedDocuments >= policy.maxTraversalDocuments) return `maximum number of traversed documents (${policy.maxTraversalDocuments}) reached`;
	traversalDepth++;
	traversedDocuments++;
	return null;
}

/**
 * record exit from a referenced document
 */
export function exitTraversal(): void {
	if (traversalDepth > 0) traversalDepth--;
}
