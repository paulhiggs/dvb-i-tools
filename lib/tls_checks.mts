/**
 * tls_checks.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Checks the certificate chain of an HTTPS connection against a signature policy (A177r8 clause 7.6): the chain presented
 * by the server must contain every CAFingerprint of the policy's TrustAnchor, its certificates must be valid, and the host
 * must be one the policy's SubjectConstraint permits. The chain of each host:port is obtained once per validation.
 *
 * This check is separate from the check of a response's X-JWS-Signature (jws_checks.mts), and is enabled with the
 * checkConnectionCertificates fetch policy
 */

import { connect, checkServerIdentity } from "node:tls"
import type { DetailedPeerCertificate, PeerCertificate } from "node:tls"
import { X509Certificate } from "node:crypto"
import { isIP } from "node:net"

import { checkFetchURL, currentFetchPolicy, currentValidation, deferRetrieval, firstReference, sharedRetrieval, withFetchSlots } from "./safe_fetch.mts"
import type { ValidationHandle } from "./safe_fetch.mts"
import { chainHasFingerprint, chainProblems, enforcementSeverity, hostPermitted, summariseChain } from "./certificate_utils.mts"
import type { CertificateSummary, SignaturePolicy } from "./certificate_utils.mts"
import ErrorList from "./error_list.mts"

const TLS_KEY = "connection certificates";
const CLAUSE = "A177r8 table 77d";

// the certificate chain presented by a server, or why it could not be obtained
export type ConnectionChain = {
	error?: string;
	chain?: CertificateSummary[]; // leaf first, ending with the root when the chain can be completed from the trust store
	identityProblem?: string; // the leaf certificate is not valid for the host
};

// the host and port of an https: URL, or undefined for any other URL
function endpointOf(url: string): { host: string; port: number } | undefined {
	try {
		const u = new URL(url);
		if (u.protocol != "https:") return undefined;
		return { host: u.hostname.replace(/^\[|\]$/g, ""), port: u.port ? Number(u.port) : 443 };
	} catch {
		return undefined;
	}
}

/**
 * connect to a server and read the certificate chain it presents. The connection does not reject an untrusted or invalid
 * certificate, so that the validator can report it
 */
function readChain(host: string, port: number, validation?: ValidationHandle): Promise<ConnectionChain> {
	const refused = checkFetchURL(`https://${isIP(host) == 6 ? `[${host}]` : host}:${port}/`);
	if (refused) return Promise.resolve({ error: refused });
	return withFetchSlots(
		host,
		() =>
			new Promise<ConnectionChain>((resolve) => {
				let settled = false;
				const finish = (result: ConnectionChain) => {
					if (settled) return;
					settled = true;
					socket.destroy();
					resolve(result);
				};
				const socket = connect({ host, port, servername: isIP(host) ? undefined : host, rejectUnauthorized: false });
				socket.setTimeout(currentFetchPolicy().timeout, () => finish({ error: `timeout after ${currentFetchPolicy().timeout}ms connecting to ${host}:${port}` }));
				socket.once("error", (err) => finish({ error: `connection to ${host}:${port} failed: ${err.message}` }));
				socket.once("secureConnect", () => {
					const peer = socket.getPeerCertificate(true) as DetailedPeerCertificate;
					if (!peer?.raw) {
						finish({ error: `${host}:${port} did not present a certificate` });
						return;
					}
					const certificates: X509Certificate[] = [];
					const seen = new Set<string>();
					for (let c: DetailedPeerCertificate | undefined = peer; c?.raw && !seen.has(c.fingerprint256); c = c.issuerCertificate) {
						seen.add(c.fingerprint256);
						certificates.push(new X509Certificate(c.raw));
					}
					const identity = isIP(host) ? undefined : checkServerIdentity(host, peer as PeerCertificate);
					finish({ chain: summariseChain(certificates), identityProblem: identity?.message });
				});
			}),
		validation,
		(result) => (!result.error ? "ok" : result.error.startsWith("timeout") ? "timeout" : "error")
	);
}

/**
 * the certificate chain of a server, obtained once per validation
 */
const connectionChain = (host: string, port: number, validation?: ValidationHandle): Promise<ConnectionChain> =>
	sharedRetrieval(`tls ${host.toLowerCase()}:${port}`, () => readChain(host, port, validation), validation);

/**
 * report the certificate chain of a server against a policy
 */
function reportChain(endpoint: { host: string; port: number }, result: ConnectionChain, policy: SignaturePolicy, element: XmlElement, errs: ErrorList): void {
	const where = `${endpoint.host}:${endpoint.port}`,
		type = enforcementSeverity(policy),
		policyName = policy.policyId.quote();
	const report = (code: string, message: string, description: string) =>
		errs.addError({ code, type, message, fragment: element, key: TLS_KEY, description, clause: CLAUSE });

	if (result.error || !result.chain) {
		report("TLS002", `the certificate chain of ${where} could not be obtained for signature policy ${policyName}: ${result.error ?? "no certificates"}`, "The certificate chain of the HTTPS connection is needed to check it against the signature policy.");
		return;
	}
	for (const fingerprint of policy.fingerprints) {
		const found = chainHasFingerprint(result.chain, fingerprint);
		if (found === undefined)
			report("TLS001", `the ${fingerprint.algorithm} CAFingerprint of signature policy ${policyName} cannot be checked against the certificate chain of ${where}`, "Every CAFingerprint of the policy must be present in the certificate chain of the HTTPS connection.");
		else if (!found)
			report("TLS001", `the certificate chain of ${where} has no certificate with the ${fingerprint.algorithm} fingerprint ${fingerprint.value} of signature policy ${policyName}`, "Every CAFingerprint of the policy must be present in the certificate chain of the HTTPS connection.");
	}
	for (const problem of chainProblems(result.chain)) report("TLS003", `in the certificate chain of ${where}, ${problem}`, "The certificates of the HTTPS connection must be valid.");
	if (result.identityProblem) report("TLS003", `the certificate of ${where} is not valid for the host: ${result.identityProblem}`, "The certificates of the HTTPS connection must be valid.");
	if (!hostPermitted(policy, endpoint.host))
		report("TLS004", `${endpoint.host} is not permitted by the SubjectConstraint of signature policy ${policyName} (${policy.commonNames.join(", ")})`, "The final document or data must come from one of the hosts listed in the policy's SubjectConstraint.");
}

/**
 * check the certificate chain of the server of a URL against a signature policy, once per policy and host:port in the
 * validation. Call while the rules of a document are checked; the connection is made straight away and the findings are
 * reported with the validation's deferred work. Use for a reference that is not otherwise retrieved (e.g. an endpoint
 * when not traversing). When a response is retrieved, also call reportConnection() with its final URL
 *
 * @param {XmlElement}      element  the element whose content is the URL, and which carries @verificationPolicy
 * @param {string}          url      the URL
 * @param {SignaturePolicy} policy   the policy the element refers to
 * @param {ErrorList}       errs     where findings are reported
 */
export function checkConnection(element: XmlElement, url: string, policy: SignaturePolicy, errs: ErrorList): void {
	if (!currentFetchPolicy().checkConnectionCertificates) return;
	const endpoint = endpointOf(url);
	if (!endpoint || !firstReference(`tls ${policy.policyId}`, `https://${endpoint.host}:${endpoint.port}/`)) return;
	const chain = connectionChain(endpoint.host, endpoint.port, currentValidation());
	deferRetrieval(
		() => chain,
		async (result) => reportChain(endpoint, result, policy, element, errs)
	);
}

/**
 * start obtaining the certificate chain of the server of a URL, so it is ready when reportConnection() needs it
 */
export function prefetchConnection(url: string, validation?: ValidationHandle): void {
	if (!currentFetchPolicy().checkConnectionCertificates) return;
	const endpoint = endpointOf(url);
	if (endpoint) void connectionChain(endpoint.host, endpoint.port, validation);
}

/**
 * check the certificate chain of the server a response came from (its final URL, after any redirects) against a signature
 * policy, once per policy and host:port in the validation. Call when the response has been retrieved, e.g. from the
 * complete part of deferRetrieval()
 *
 * @param {XmlElement}       element     the element that refers to the resource, and which carries @verificationPolicy
 * @param {string}           finalURL    the URL the response came from
 * @param {SignaturePolicy}  policy      the policy the element refers to
 * @param {ErrorList}        errs        where findings are reported
 * @param {ValidationHandle} validation  the validation the response belongs to
 */
export async function reportConnection(element: XmlElement, finalURL: string, policy: SignaturePolicy, errs: ErrorList, validation?: ValidationHandle): Promise<void> {
	if (!currentFetchPolicy().checkConnectionCertificates) return;
	const endpoint = endpointOf(finalURL);
	if (!endpoint || !firstReference(`tls ${policy.policyId}`, `https://${endpoint.host}:${endpoint.port}/`, validation)) return;
	reportChain(endpoint, await connectionChain(endpoint.host, endpoint.port, validation), policy, element, errs);
}
