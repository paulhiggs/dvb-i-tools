/**
 * certificate_utils.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Functions shared by the checks of a signature policy (A177r8 clause 7.6) against the certificate chain of an HTTPS
 * connection (tls_checks.mts) and against the certificate chain of a response signature (jws_checks.mts)
 */

import { X509Certificate } from "node:crypto"

import { WARNING, INFORMATION, ERROR } from "./error_list.mts"

// a signature policy defined in <SignaturePolicies> of a service list or service list registry (A177r8 table 77d)
export type SignaturePolicy = {
	policyId: string;
	enforcement: string; // "required", "warn" or "vendor"
	fingerprints: { algorithm: string; value: string }[]; // CAFingerprint, the value normalised with normaliseFingerprint()
	commonNames: string[]; // SubjectConstraint/CN, empty when there is no SubjectConstraint
};

/**
 * the severity of a finding about a resource covered by a signature policy, which follows the policy's Enforcement
 * (A177r8 table 77d): the document or data must validate (required), may be used but the failure reported (warn), or the
 * client decides (vendor)
 */
export const enforcementSeverity = (policy: SignaturePolicy): string =>
	policy.enforcement == "required" ? ERROR : policy.enforcement == "warn" ? WARNING : INFORMATION;

// a fingerprint as hex digits without separators, in upper case: "12:34:ab" and "1234AB" are the same fingerprint
export const normaliseFingerprint = (fingerprint: string): string => fingerprint.replace(/[\s:]/g, "").toUpperCase();

// the fingerprint algorithms that can be computed for a certificate
export const FINGERPRINT_ALGORITHMS = ["sha1", "sha256", "sha512"];

// the properties of a certificate that the checks need
export type CertificateSummary = {
	subject: string;
	issuer: string;
	validFrom: Date;
	validTo: Date;
	fingerprints: Record<string, string>; // by algorithm, normalised
	issuedByNext: boolean | null; // issued (signed) by the next certificate in the chain, or null for the last certificate
};

export const describeCertificate = (cert: CertificateSummary): string => cert.subject.replace(/\n/g, ", ");

/**
 * summarise a certificate chain, leaf first
 *
 * @param {X509Certificate[]} chain  the chain, leaf first, each certificate followed by its issuer
 * @returns {CertificateSummary[]} the summary of each certificate
 */
export function summariseChain(chain: X509Certificate[]): CertificateSummary[] {
	return chain.map((cert, i) => ({
		subject: cert.subject,
		issuer: cert.issuer,
		validFrom: new Date(cert.validFrom),
		validTo: new Date(cert.validTo),
		fingerprints: {
			sha1: normaliseFingerprint(cert.fingerprint),
			sha256: normaliseFingerprint(cert.fingerprint256),
			sha512: normaliseFingerprint(cert.fingerprint512),
		},
		issuedByNext: i + 1 < chain.length ? cert.checkIssued(chain[i + 1]) && cert.verify(chain[i + 1].publicKey) : null,
	}));
}

/**
 * whether a certificate in a chain has the fingerprint
 *
 * @returns {boolean | undefined} whether a certificate matches, or undefined if the algorithm cannot be computed
 */
export function chainHasFingerprint(chain: CertificateSummary[], fingerprint: { algorithm: string; value: string }): boolean | undefined {
	const algorithm = fingerprint.algorithm.toLowerCase();
	if (!FINGERPRINT_ALGORITHMS.includes(algorithm)) return undefined;
	return chain.some((cert) => cert.fingerprints[algorithm] == fingerprint.value);
}

/**
 * describe the certificates of a chain that are not valid at a time, or not issued by the next certificate
 *
 * @returns {string[]} a description of each problem
 */
export function chainProblems(chain: CertificateSummary[], at: Date = new Date()): string[] {
	const problems: string[] = [];
	for (const cert of chain) {
		if (at < cert.validFrom) problems.push(`the certificate for ${describeCertificate(cert)} is not valid until ${cert.validFrom.toISOString()}`);
		if (at > cert.validTo) problems.push(`the certificate for ${describeCertificate(cert)} expired on ${cert.validTo.toISOString()}`);
		if (cert.issuedByNext === false) problems.push(`the certificate for ${describeCertificate(cert)} is not issued by the next certificate in the chain`);
	}
	return problems;
}

// the host name in a SubjectConstraint/CN, which is an anyURI: a host name, a wildcarded host name, or a URL
const hostOf = (cn: string): string => {
	const value = cn.trim();
	if (/^[a-z][a-z\d+.-]*:\/\//i.test(value))
		try {
			return new URL(value).hostname.toLowerCase();
		} catch {
			/* not a URL after all */
		}
	return value.toLowerCase();
};

/**
 * whether a host is permitted by a SubjectConstraint/CN value. A leading "*." matches exactly one label, as for the
 * host name in a certificate, so "*.example.com" matches "www.example.com" but not "example.com" or "a.b.example.com"
 */
export function hostMatchesCN(host: string, cn: string): boolean {
	const h = host.toLowerCase().replace(/\.$/, ""),
		pattern = hostOf(cn).replace(/\.$/, "");
	if (pattern.startsWith("*.")) {
		const suffix = pattern.slice(1); // ".example.com"
		return h.endsWith(suffix) && h.length > suffix.length && !h.slice(0, h.length - suffix.length).includes(".");
	}
	return h == pattern;
}

/**
 * whether a host is permitted by a policy's SubjectConstraint. A policy without a SubjectConstraint permits any host
 */
export const hostPermitted = (policy: SignaturePolicy, host: string): boolean =>
	policy.commonNames.length == 0 || policy.commonNames.some((cn) => hostMatchesCN(host, cn));
