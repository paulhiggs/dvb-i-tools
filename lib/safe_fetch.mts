/**
 * safe_fetch.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * A single place to retrieve documents whose location is supplied by a client or found in a validated document.
 * The retrieval policy (allowed URL schemes, private/local addresses, response size, timeout) and the limits
 * on traversing into referenced documents are applied here, and network work is deferred until the synchronous
 * validation rules have run (see ValidationScope).
 */

import { BlockList, isIP } from "node:net"
import { AsyncLocalStorage } from "node:async_hooks"

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
 * read a response body, stopping if it grows beyond the policy limit
 */
async function readLimitedBody(response: Response, url: string): Promise<Buffer> {
	const declared = Number(response.headers.get("content-length"));
	if (declared > policy.maxResponseBytes) throw new Error(`content size at ${url} over limit: ${policy.maxResponseBytes}`);
	if (!response.body) return Buffer.alloc(0);
	const chunks: Uint8Array[] = [];
	let total = 0;
	for await (const chunk of response.body) {
		total += chunk.byteLength;
		if (total > policy.maxResponseBytes) throw new Error(`content size at ${url} over limit: ${policy.maxResponseBytes}`);
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}

/**
 * retrieve a resource, applying the fetch policy
 *
 * @param {string} url  the URL to retrieve
 * @returns {Promise<SafeFetchResult>} either the response (which may have a non-2xx status) or the reason the retrieval did not happen or failed
 */
export async function safeFetch(url: string): Promise<SafeFetchResult> {
	const refused = checkFetchURL(url);
	if (refused) return { error: refused };
	try {
		const resp = await fetch(url, { headers: fetch_options.headers as Record<string, string>, signal: AbortSignal.timeout(policy.timeout) });
		const body = await readLimitedBody(resp, url);
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
		const reason = error instanceof Error && error.name == "TimeoutError" ? `timeout after ${policy.timeout}ms retrieving ${url}` : `${error instanceof Error ? error.message : error}`;
		return { error: reason };
	}
}

/*
 * Validation scopes
 *
 * The validation rules are synchronous. Work that needs the network (traversing into referenced documents, checking
 * content digests of referenced resources) is registered with deferTask() while the rules run, and is performed when
 * the validation calls ValidationScope.finish(). Nested validations started by those tasks open their own scope, and
 * share the traversal limits of the validation they belong to.
 */
type TraversalBudget = {
	documents: number; // number of documents retrieved by traversal
	traversed: Set<string>; // URLs of the documents retrieved by traversal
};

/**
 * the reason a traversal is not performed
 */
export type TraversalRefusal = {
	duplicate: boolean; // true if the URL has already been traversed during this validation
	reason: string;
};

// compare URLs in their normalised form, so trivially different spellings of the same URL are treated as one
const normaliseURL = (url: string): string => {
	try {
		return new URL(url).href;
	} catch {
		return url;
	}
};

const runningScope = new AsyncLocalStorage<ValidationScope>(); // the scope whose deferred tasks are being performed
const openScopes: ValidationScope[] = []; // scopes whose synchronous rules are being checked (innermost last)

export class ValidationScope {
	readonly depth: number; // 0 for the document being validated, 1 for a document it references, ...
	readonly budget: TraversalBudget; // shared by all the scopes of one validation
	#tasks: (() => Promise<void>)[] = [];
	#open = true;

	private constructor(parent: ValidationScope | undefined) {
		this.depth = parent ? parent.depth + 1 : 0;
		this.budget = parent ? parent.budget : { documents: 0, traversed: new Set<string>() };
	}

	/**
	 * open a scope at the start of a validation. Use with "using" so it is closed on every exit from the validation
	 */
	static open(): ValidationScope {
		const scope = new ValidationScope(runningScope.getStore());
		openScopes.push(scope);
		return scope;
	}

	defer(task: () => Promise<void>): void {
		this.#tasks.push(task);
	}

	/**
	 * close the scope to new tasks and perform the deferred tasks (in the order they were registered)
	 */
	async finish(): Promise<void> {
		this.#close();
		while (this.#tasks.length > 0) {
			const task = this.#tasks.shift()!;
			await runningScope.run(this, task);
		}
	}

	#close(): void {
		if (!this.#open) return;
		this.#open = false;
		const ix = openScopes.lastIndexOf(this);
		if (ix != -1) openScopes.splice(ix, 1);
	}

	[Symbol.dispose](): void {
		this.#close();
	}
}

/**
 * register work to be done when the current validation finishes its synchronous rules
 */
export function deferTask(task: () => Promise<void>): void {
	const scope = openScopes.at(-1);
	if (!scope) throw new Error("deferTask() called outside a validation scope");
	scope.defer(task);
}

/**
 * check, when a traversal is requested by the validation rules, whether the current validation may traverse into
 * another document. Only the depth is checked here: the document is counted against the shared budget by
 * claimTraversal() when its retrieval is performed, so that documents referenced by traversed documents
 * (e.g. Program Information in a schedule) are not starved by the requests made by the outermost document
 *
 * @returns {string | null} null if the traversal can be scheduled, otherwise the reason it cannot
 */
export function allowTraversal(): string | null {
	const scope = openScopes.at(-1);
	if (!scope) return "traversal requested outside a validation";
	if (scope.depth + 1 > policy.maxTraversalDepth) return `maximum traversal depth (${policy.maxTraversalDepth}) reached`;
	return null;
}

/**
 * count a traversed document against the budget of the validation. Call from the deferred task, immediately before
 * the document is retrieved. A URL is only traversed once during a validation, and a repeated URL is not counted
 *
 * @param {string} url  the URL of the document to be retrieved
 * @returns {TraversalRefusal | null} null if the document can be retrieved, otherwise the reason it cannot
 */
export function claimTraversal(url: string): TraversalRefusal | null {
	const scope = runningScope.getStore();
	if (!scope) return { duplicate: false, reason: "traversal performed outside a validation" };
	const key = normaliseURL(url);
	if (scope.budget.traversed.has(key)) return { duplicate: true, reason: `${url} already validated` };
	if (scope.budget.documents >= policy.maxTraversalDocuments)
		return { duplicate: false, reason: `maximum number of traversed documents (${policy.maxTraversalDocuments}) reached` };
	scope.budget.documents++;
	scope.budget.traversed.add(key);
	return null;
}
