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
import type { SignaturePolicy } from "./certificate_utils.mts"

// the most documents a validation traverses, unless the validation sets its own limit
export const DEFAULT_MAX_TRAVERSAL = 100;

export type FetchPolicy = {
	allowPrivateAddresses: boolean // when false, URLs whose host is a loopback, private, link-local etc. address are refused
	maxResponseBytes: number // responses larger than this are rejected
	timeout: number // milliseconds
	maxTraversalDepth: number // maximum nesting of documents traversed from the document being validated
	maxTraversalDocuments: number // maximum number of documents traversed during a single validation
	fetchConcurrency: number // maximum number of retrievals in progress at once (across all validations), and how far each validation retrieves ahead
	checkImages: boolean // retrieve referenced images and check them (format, dimensions, server scaling). Each image is checked once per validation
	fetchesPerHost: number // maximum number of retrievals in progress at once from one host (within fetchConcurrency)
	checkConnectionCertificates: boolean // check the certificate chain of an HTTPS connection against a signature policy (tls_checks.mts)
	checkResponseSignatures: boolean // check the X-JWS-Signature of a response against a signature policy (jws_checks.mts)
};

const policy: FetchPolicy = {
	allowPrivateAddresses: true,
	maxResponseBytes: 10 * 1024 * 1024,
	timeout: fetch_options.timeout as number,
	maxTraversalDepth: 10,
	maxTraversalDocuments: DEFAULT_MAX_TRAVERSAL,
	fetchConcurrency: 8,
	checkImages: false,
	fetchesPerHost: 4,
	checkConnectionCertificates: false,
	checkResponseSignatures: false,
};

/*
 * limit on the number of retrievals in progress. Waiting for a slot does not count towards the retrieval timeout
 */
let activeFetches = 0;
const waitingFetches: (() => void)[] = [];

async function acquireFetchSlot(): Promise<void> {
	if (activeFetches < Math.max(1, policy.fetchConcurrency)) {
		activeFetches++;
		return;
	}
	await new Promise<void>((resolve) => waitingFetches.push(resolve));
}

function releaseFetchSlot(): void {
	const next = waitingFetches.shift();
	if (next) next(); // the slot passes directly to the next waiting retrieval
	else activeFetches--;
}

/*
 * limit on the number of retrievals in progress from one host, so that one server (e.g. an image server referenced by
 * every programme) is not sent more requests at once than it can answer within the timeout. A retrieval waits for its
 * host slot before taking one of the fetchConcurrency slots, so retrievals from other hosts are not held up
 */
const hostFetches = new Map<string, { active: number; waiting: (() => void)[] }>();

async function acquireHostSlot(host: string): Promise<void> {
	let state = hostFetches.get(host);
	if (!state) hostFetches.set(host, (state = { active: 0, waiting: [] }));
	if (state.active < Math.max(1, policy.fetchesPerHost)) {
		state.active++;
		return;
	}
	await new Promise<void>((resolve) => state.waiting.push(resolve));
}

function releaseHostSlot(host: string): void {
	const state = hostFetches.get(host);
	if (!state) return;
	const next = state.waiting.shift();
	if (next) next();
	else if (--state.active == 0) hostFetches.delete(host);
}

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
	contentType: string | null // the Content-Type response header
	url: string // the URL the response came from, after any redirects
	jwsSignature: string | null // the X-JWS-Signature response header (A177r8 clause 7.7.1.2)
	reportingEndpoints: string | null // the Reporting-Endpoints response header (A177r8 clause 7.6.2.5)
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
 * perform network work other than an HTTP retrieval (e.g. a TLS handshake) within the same limits as retrievals: the
 * host's slot (fetchesPerHost) and one of the fetchConcurrency slots
 *
 * @param {string} host           the host the work connects to
 * @param {() => Promise<T>} work the network work
 * @param {ValidationHandle} validation  the validation the work is counted in (see ValidationScope.timing())
 * @param {(result: T) => string} outcomeOf  whether the work succeeded, timed out or failed, for the timing
 * @returns {Promise<T>} the result of the work
 */
export async function withFetchSlots<T>(host: string, work: () => Promise<T>, validation?: ValidationHandle, outcomeOf?: (result: T) => "ok" | "timeout" | "error"): Promise<T> {
	const key = host.toLowerCase();
	const budget = (validation as TraversalBudget | undefined) ?? (runningScope.getStore() ?? openScopes.at(-1))?.budget;
	await acquireHostSlot(key);
	await acquireFetchSlot();
	const started = performance.now();
	let outcome: "ok" | "timeout" | "error" = "error";
	try {
		const result = await work();
		outcome = outcomeOf ? outcomeOf(result) : "ok";
		return result;
	} finally {
		releaseFetchSlot();
		releaseHostSlot(key);
		// counted in the timing of the validation, like a retrieval
		if (budget) recordFetch(budget, key, performance.now() - started, outcome);
	}
}

/**
 * retrieve a resource, applying the fetch policy
 *
 * @param {string} url  the URL to retrieve
 * @returns {Promise<SafeFetchResult>} either the response (which may have a non-2xx status) or the reason the retrieval did not happen or failed
 */
export async function safeFetch(url: string, validation?: ValidationHandle): Promise<SafeFetchResult> {
	const refused = checkFetchURL(url);
	if (refused) return { error: refused };
	// the retrieval is counted in the timing of the validation it is made for
	const budget = (validation as TraversalBudget | undefined) ?? (runningScope.getStore() ?? openScopes.at(-1))?.budget;
	const host = new URL(url).host.toLowerCase(); // checkFetchURL() has parsed the URL
	await acquireHostSlot(host);
	await acquireFetchSlot();
	const started = performance.now();
	let outcome: "ok" | "timeout" | "error" = "error";
	try {
		const resp = await fetch(url, { headers: fetch_options.headers as Record<string, string>, signal: AbortSignal.timeout(policy.timeout) });
		const body = await readLimitedBody(resp, url);
		outcome = "ok";
		return {
			response: {
				ok: resp.ok,
				status: resp.status,
				statusText: resp.statusText,
				contentType: resp.headers.get("content-type"),
				url: resp.url || url,
				jwsSignature: resp.headers.get("x-jws-signature"),
				reportingEndpoints: resp.headers.get("reporting-endpoints"),
				text: () => body.toString("utf8"),
				buffer: () => body,
			},
		};
	} catch (error) {
		const timedOut = error instanceof Error && error.name == "TimeoutError";
		if (timedOut) outcome = "timeout";
		return { error: timedOut ? `timeout after ${policy.timeout}ms retrieving ${url}` : `${error instanceof Error ? error.message : error}` };
	} finally {
		releaseFetchSlot();
		releaseHostSlot(host);
		if (budget) recordFetch(budget, host, performance.now() - started, outcome);
	}
}

/*
 * Validation scopes
 *
 * The validation rules are synchronous. Work that needs the network (traversing into referenced documents, checking
 * content digests of referenced resources) is registered with deferRetrieval() or deferTask() while the rules run, and
 * is performed when the validation calls ValidationScope.finish(). Nested validations started by those tasks open their
 * own scope, and share the traversal limits of the validation they belong to.
 *
 * A deferred task has a retrieve part (the network work) and a complete part (validating what was retrieved).
 * finish() runs the retrieve parts of up to policy.fetchConcurrency tasks ahead of the task being completed, so
 * documents download while earlier ones are validated. The complete parts run one at a time, in the order the tasks
 * were registered, so the results are reported in the same order and nesting as when the tasks ran sequentially.
 */
type DeferredTask = {
	retrieve?: () => Promise<unknown>;
	complete: (retrieved: unknown) => Promise<void>;
};
type SettledRetrieval = { value: unknown } | { error: unknown };

// something that records the results of a requested traversal, and counts how many times the URL is referenced
export type TraversalRequest = { references?: number };

// the retrievals made from one host during a validation
type HostFetches = { durations: number[]; timeouts: number; errors: number };

function recordFetch(budget: TraversalBudget, host: string, duration: number, outcome: "ok" | "timeout" | "error"): void {
	let fetches = budget.fetches.get(host);
	if (!fetches) budget.fetches.set(host, (fetches = { durations: [], timeouts: 0, errors: 0 }));
	fetches.durations.push(duration);
	if (outcome == "timeout") fetches.timeouts++;
	else if (outcome == "error") fetches.errors++;
}

export type HostTiming = {
	host: string;
	requests: number;
	totalMs: number; // the time spent retrieving from the host (retrievals from different hosts overlap)
	averageMs: number;
	p95Ms: number; // 95% of the retrievals took this long or less
	maxMs: number;
	timeouts: number;
	errors: number; // network errors other than timeouts (an HTTP error status is not counted)
};

// how long a validation took, and the retrievals it made (including those of the documents it traversed)
export type ValidationTiming = {
	durationMs: number;
	documentsTraversed: number;
	resourcesRetrieved: number; // referenced resources (images, applications...) retrieved, each once
	imagesChecked: number;
	requests: number;
	timeouts: number;
	errors: number;
	hosts: HostTiming[]; // slowest (most time spent) first
};

// how referenced images are checked: not at all, retrieved and checked (the default), or also requested scaled to check
// that the server scales them (A177r8 clause 5.2.8.2.2), which doubles the image requests
export type ImageChecking = "no" | "yes" | "scaled";
export const IMAGE_CHECKING: ImageChecking[] = ["no", "yes", "scaled"];

/**
 * the choices made for a whole validation by the request that started it. They are set once, by the outermost validation,
 * and every document it traverses into uses the same choices (see currentRequest()). The field names are those of the
 * validators' options (e.g. SL_Validator_Options), which are the way a caller gives them
 */
export type ValidationRequest = {
	traverse: boolean; // validate the documents referenced from the document (default false)
	maxTraversal: number; // the most documents to traverse (Infinity for no limit; default the fetch policy's)
	maxTraversalDepth: number; // the deepest level of documents to traverse into: at most, and by default, the fetch policy's
	connectionCertificates: boolean; // check HTTPS certificate chains against signature policies, when the server does (default true)
	responseSignatures: boolean; // check X-JWS-Signature of responses against signature policies, when the server does (default true)
	images: ImageChecking; // how referenced images are checked (default "yes")
	variants: number; // A177 variants to validate against, e.g. GERMAN_A177r6_VARIANT (default 0)
	report_schema_version: boolean; // report the state of each document's schema (default true)
	log_prefix?: string; // where the outermost document is archived (default none); traversed documents are not archived
};

// the choices of a request, as a caller gives them: any that are left out take their default
export type ValidationOptions = Partial<ValidationRequest>;

/**
 * the choices for a validation, with defaults for any not given
 */
export const validationRequest = (options: ValidationOptions = {}): ValidationRequest => ({
	traverse: options.traverse ?? false,
	maxTraversal: options.maxTraversal ?? policy.maxTraversalDocuments,
	// a request can only lower the server's depth limit
	maxTraversalDepth: Math.min(options.maxTraversalDepth ?? policy.maxTraversalDepth, policy.maxTraversalDepth),
	connectionCertificates: options.connectionCertificates ?? true,
	responseSignatures: options.responseSignatures ?? true,
	images: options.images ?? "yes",
	variants: options.variants ?? 0,
	report_schema_version: options.report_schema_version ?? true,
	log_prefix: options.log_prefix,
});

/**
 * read a limit on the number of documents to traverse: a positive whole number, or "unlimited"
 *
 * @param {unknown} value  the value given, e.g. in a form field
 * @returns {number | undefined} the limit (Infinity for "unlimited"), or undefined if the value is not valid
 */
export function parseTraversalLimit(value: unknown): number | undefined {
	if (typeof value != "string") return undefined;
	const v = value.trim().toLowerCase();
	if (v == "unlimited") return Infinity;
	return /^[1-9][0-9]*$/.test(v) ? Number(v) : undefined;
}

type TraversalBudget = {
	request: ValidationRequest;
	started: number; // when the validation started (performance.now())
	fetches: Map<string, HostFetches>; // the retrievals made for the validation, by host
	documents: number; // number of documents retrieved by traversal
	traversed: Set<string>; // URLs of the documents retrieved by traversal
	requested: Map<string, TraversalRequest>; // the first request to traverse into each URL
	retrievals: Map<string, Promise<unknown>>; // retrievals shared by the checks of a validation, by key (see sharedRetrieval())
	referenced: Set<string>; // resources that have been checked, by kind and URL (see firstReference())
};

/**
 * the reason a traversal is not performed, as reported to the user
 *   TRAV000  traversal requested or performed outside a validation (application error)
 *   TRAV001  the URL has already been traversed during this validation (only if a repeated request was not caught
 *            by repeatedTraversal(), which counts it against the first request instead)
 *   TRAV002  the maximum traversal depth has been reached
 *   TRAV003  the maximum number of traversed documents has been reached
 */
export type TraversalRefusal = {
	code: string;
	message: string;
};

const refusal = (code: string, url: string, reason: string): TraversalRefusal => ({ code, message: `traversal into ${url} skipped, ${reason}` });

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
	// the signature policies that @verificationPolicy references are resolved against: those defined by the document being
	// validated (a service list or registry), or else those of the document that traversed into it
	signaturePolicies: ReadonlyMap<string, SignaturePolicy> | undefined;
	#tasks: DeferredTask[] = [];
	#open = true;

	private constructor(parent: ValidationScope | undefined, options: ValidationOptions) {
		this.depth = parent ? parent.depth + 1 : 0;
		this.signaturePolicies = parent?.signaturePolicies;
		this.budget = parent
			? parent.budget
			: { request: validationRequest(options), started: performance.now(), fetches: new Map<string, HostFetches>(), documents: 0, traversed: new Set<string>(), requested: new Map<string, TraversalRequest>(), retrievals: new Map<string, Promise<unknown>>(), referenced: new Set<string>() };
	}

	/**
	 * open a scope at the start of a validation. Use with "using" so it is closed on every exit from the validation
	 *
	 * @param {ValidationOptions} options  the choices of the request, for the outermost validation. A nested validation (of a
	 *                                     traversed document) uses the choices of the validation it belongs to, and ignores these
	 */
	static open(options: ValidationOptions = {}): ValidationScope {
		const scope = new ValidationScope(runningScope.getStore(), options);
		openScopes.push(scope);
		return scope;
	}

	defer(task: DeferredTask): void {
		this.#tasks.push(task);
	}

	/**
	 * close the scope to new tasks and perform the deferred tasks. Retrievals run ahead, up to policy.fetchConcurrency
	 * tasks, and the tasks are completed in the order they were registered
	 */
	async finish(): Promise<void> {
		this.#close();
		const started: { task: DeferredTask; retrieval: Promise<SettledRetrieval> }[] = [];
		const startAhead = () => {
			while (started.length < Math.max(1, policy.fetchConcurrency) && this.#tasks.length > 0) {
				const task = this.#tasks.shift()!;
				// the retrieve part is started in this scope, so claimTraversal() counts it against this validation.
				// Its synchronous start (e.g. claiming the budget) runs now, so claims are made in registration order
				const retrieval: Promise<SettledRetrieval> = task.retrieve
					? runningScope.run(this, task.retrieve).then(
							(value) => ({ value }),
							(error) => ({ error })
						)
					: Promise.resolve({ value: undefined });
				started.push({ task, retrieval });
			}
		};
		startAhead();
		while (started.length > 0) {
			const { task, retrieval } = started.shift()!;
			const settled = await retrieval;
			startAhead(); // keep the window full while this task is completed
			if ("error" in settled) throw settled.error;
			await runningScope.run(this, () => task.complete(settled.value));
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

	/**
	 * how long the validation has taken so far, and the retrievals it has made, including those of the documents it
	 * traversed. Call after finish() of the validation's own (outermost) scope
	 */
	timing(): ValidationTiming {
		const budget = this.budget;
		const hosts: HostTiming[] = [...budget.fetches].map(([host, f]) => {
			const sorted = [...f.durations].sort((a, b) => a - b);
			const total = sorted.reduce((a, b) => a + b, 0);
			return {
				host,
				requests: sorted.length,
				totalMs: Math.round(total),
				averageMs: Math.round(total / sorted.length),
				p95Ms: Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]),
				maxMs: Math.round(sorted[sorted.length - 1]),
				timeouts: f.timeouts,
				errors: f.errors,
			};
		});
		hosts.sort((a, b) => b.totalMs - a.totalMs);
		const keys = (set: Iterable<string>, prefix: string) => [...set].filter((k) => k.startsWith(prefix)).length;
		return {
			durationMs: Math.round(performance.now() - budget.started),
			documentsTraversed: budget.documents,
			resourcesRetrieved: keys(budget.retrievals.keys(), "resource "),
			imagesChecked: keys(budget.referenced, "image "),
			requests: hosts.reduce((n, h) => n + h.requests, 0),
			timeouts: hosts.reduce((n, h) => n + h.timeouts, 0),
			errors: hosts.reduce((n, h) => n + h.errors, 0),
			hosts,
		};
	}
}

/**
 * register work to be done when the current validation finishes its synchronous rules
 */
export function deferTask(task: () => Promise<void>): void {
	const scope = openScopes.at(-1);
	if (!scope) throw new Error("deferTask() called outside a validation scope");
	scope.defer({ complete: task });
}

/**
 * register a retrieval, and the work that uses its result, to be done when the current validation finishes its
 * synchronous rules. The retrieval may run concurrently with other tasks' retrievals and completions; the completions
 * run one at a time in registration order
 *
 * @param {() => Promise<T>} retrieve           network work - must not report errors or start nested validations
 * @param {(retrieved: T) => Promise<void>} complete  uses the retrieved result (validation, error reporting)
 */
export function deferRetrieval<T>(retrieve: () => Promise<T>, complete: (retrieved: T) => Promise<void>): void {
	const scope = openScopes.at(-1);
	if (!scope) throw new Error("deferRetrieval() called outside a validation scope");
	scope.defer({ retrieve, complete: complete as (retrieved: unknown) => Promise<void> });
}

/**
 * check, when a traversal is requested by the validation rules, whether the current validation may traverse into
 * another document. Only the depth is checked here: the document is counted against the shared budget by
 * claimTraversal() when its retrieval is performed, so that documents referenced by traversed documents
 * (e.g. Program Information in a schedule) are not starved by the requests made by the outermost document
 *
 * @param {string} url  the URL of the document to be traversed into
 * @returns {TraversalRefusal | null} null if the traversal can be scheduled, otherwise the reason it cannot
 */
export function allowTraversal(url: string): TraversalRefusal | null {
	const scope = openScopes.at(-1);
	if (!scope) return refusal("TRAV000", url, "traversal requested outside a validation");
	const depth = scope.budget.request.maxTraversalDepth;
	if (scope.depth + 1 > depth) return refusal("TRAV002", url, `maximum traversal depth (${depth}) reached`);
	return null;
}

/**
 * check, when a traversal is requested by the validation rules, whether the same URL has already been requested during
 * this validation. If it has, the repeat is counted against the first request (whose results are reported once) and
 * the caller should not traverse again
 *
 * @param {string} url  the URL of the document to be traversed into
 * @returns {TraversalRequest | undefined} the first request for the URL, with its count of references increased, or
 *                                         undefined if the URL has not been requested before
 */
export function repeatedTraversal(url: string): TraversalRequest | undefined {
	const scope = openScopes.at(-1);
	if (!scope) return undefined;
	const first = scope.budget.requested.get(normaliseURL(url));
	if (first) first.references = (first.references ?? 1) + 1;
	return first;
}

/**
 * record the first request to traverse into a URL, so that later requests for it are counted by repeatedTraversal().
 * A request that is refused because of the traversal depth is not recorded, so the URL can still be traversed when it
 * is referenced from a shallower document
 *
 * @param {string}           url      the URL of the document to be traversed into
 * @param {TraversalRequest} request  records the results of the traversal
 */
export function recordTraversal(url: string, request: TraversalRequest): void {
	const scope = openScopes.at(-1);
	if (!scope || allowTraversal(url)) return;
	request.references = 1;
	scope.budget.requested.set(normaliseURL(url), request);
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
	if (!scope) return refusal("TRAV000", url, "traversal performed outside a validation");
	const key = normaliseURL(url);
	if (scope.budget.traversed.has(key)) return { code: "TRAV001", message: `skipped - ${url} already validated` };
	const limit = scope.budget.request.maxTraversal;
	if (scope.budget.documents >= limit) return refusal("TRAV003", url, `maximum number of traversed documents (${limit}) reached`);
	scope.budget.documents++;
	scope.budget.traversed.add(key);
	return null;
}

export type TraversalRetrieval = SafeFetchResult & { refused?: TraversalRefusal };

/**
 * perform a retrieval once per validation: the first call with a key starts it, and later calls with the same key (in
 * the same validation, including its nested validations) get the same result without retrieving again. Use from the
 * retrieve part of deferRetrieval(). Outside a validation, the retrieval is performed every time
 *
 * @param {string} key                 identifies the retrieval, e.g. a normalised URL
 * @param {() => Promise<T>} retrieve  performs the retrieval. The result is kept until the validation finishes, so it
 *                                     should be small (e.g. digests rather than the content)
 * @param {ValidationHandle} validation the validation the retrieval belongs to, from currentValidation(). Needed when
 *                                     the call is made after the rule that requested it (e.g. once another retrieval
 *                                     has completed), when the current scope may belong to a different validation
 * @returns {Promise<T>} the result of the retrieval
 */
export function sharedRetrieval<T>(key: string, retrieve: () => Promise<T>, validation?: ValidationHandle): Promise<T> {
	const budget = (validation as TraversalBudget | undefined) ?? (runningScope.getStore() ?? openScopes.at(-1))?.budget;
	if (!budget) return retrieve();
	let retrieval = budget.retrievals.get(key) as Promise<T> | undefined;
	if (!retrieval) {
		retrieval = retrieve();
		budget.retrievals.set(key, retrieval);
	}
	return retrieval;
}

/**
 * check, while the validation rules are checked, whether a resource is referenced for the first time in this validation
 * (including its nested validations), so that its checks are reported only once
 *
 * @param {string} kind  the kind of check, e.g. "image"
 * @param {string} url   the URL of the resource
 * @param {ValidationHandle} validation  the validation, when the call is not made while its rules are checked
 * @returns {boolean} true for the first reference to the URL (and outside a validation), false for a repeat
 */
export function firstReference(kind: string, url: string, validation?: ValidationHandle): boolean {
	const budget = (validation as TraversalBudget | undefined) ?? openScopes.at(-1)?.budget;
	if (!budget) return true;
	const key = `${kind} ${normaliseURL(url)}`;
	if (budget.referenced.has(key)) return false;
	budget.referenced.add(key);
	return true;
}

export { normaliseURL };

/**
 * set the signature policies defined by the document whose rules are being checked (a service list or service list
 * registry). They replace any policies of the document that traversed into it, and are used by the documents it traverses
 * into
 */
export function setSignaturePolicies(policies: ReadonlyMap<string, SignaturePolicy>): void {
	const scope = openScopes.at(-1);
	if (scope) scope.signaturePolicies = policies;
}

/**
 * the signature policies in effect for the document whose rules are being checked: its own, or those of the document that
 * traversed into it
 *
 * @returns {ReadonlyMap<string, SignaturePolicy> | undefined} the policies, or undefined if there are none in effect
 */
export function signaturePoliciesInEffect(): ReadonlyMap<string, SignaturePolicy> | undefined {
	return (openScopes.at(-1) ?? runningScope.getStore())?.signaturePolicies;
}

// identifies a validation (with its nested validations), for sharedRetrieval()
export type ValidationHandle = object;

/**
 * the validation whose rules are being checked, or whose deferred work is being performed
 *
 * @returns {ValidationHandle | undefined} the validation, or undefined outside a validation
 */
export function currentValidation(): ValidationHandle | undefined {
	return (openScopes.at(-1) ?? runningScope.getStore())?.budget;
}

/**
 * the choices of the validation whose rules are being checked, or whose deferred work is being performed. Every document
 * of a validation, including those it traverses into, has the same choices
 *
 * @returns {Readonly<ValidationRequest>} the choices, which are the defaults outside a validation
 */
export function currentRequest(): Readonly<ValidationRequest> {
	return (openScopes.at(-1) ?? runningScope.getStore())?.budget.request ?? validationRequest();
}

/**
 * the choices of a validation, given its handle (from currentValidation()), or else of the validation whose rules are being
 * checked. Use when the call is made after the rule that requested it, e.g. when a retrieval has completed
 */
export const requestFor = (validation?: ValidationHandle): Readonly<ValidationRequest> =>
	(validation as TraversalBudget | undefined)?.request ?? currentRequest();

/**
 * whether HTTPS certificate chains are checked against signature policies for a validation: the server must enable the
 * check (checkConnectionCertificates), and the request must not turn it off
 */
export const connectionCertificatesChecked = (validation?: ValidationHandle): boolean =>
	policy.checkConnectionCertificates && requestFor(validation).connectionCertificates;

/**
 * whether response signatures (X-JWS-Signature) are checked against signature policies for a validation: the server must
 * enable the check (checkResponseSignatures), and the request must not turn it off
 */
export const responseSignaturesChecked = (validation?: ValidationHandle): boolean =>
	policy.checkResponseSignatures && requestFor(validation).responseSignatures;

/**
 * whether the document whose rules are being checked is the one the validation was requested for, rather than one it
 * traversed into. Only that document is archived (log_prefix)
 */
export const isOutermostDocument = (): boolean => (openScopes.at(-1)?.depth ?? 0) == 0;

/**
 * the retrieve part of a traversal (for deferRetrieval): claim the document against the validation's budget, then
 * retrieve it
 *
 * @param {string} url  the URL of the document to be traversed into
 * @returns {Promise<TraversalRetrieval>} the refusal, or the result of the retrieval
 */
export async function retrieveTraversal(url: string): Promise<TraversalRetrieval> {
	const refused = claimTraversal(url);
	if (refused) return { refused };
	return await safeFetch(url);
}
