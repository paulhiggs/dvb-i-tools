/**
 * jws_checks.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Checks the signature of a response against a signature policy (A177r8 clauses 7.6 and 7.7): the detached JWS in the
 * X-JWS-Signature header (RFC 7515 appendix F, with an unencoded payload per RFC 7797) must verify over the response body,
 * the certificate chain of its signing certificate (x5c) must contain at least one CAFingerprint of the policy's
 * TrustAnchor, and the response must come from a host the policy's SubjectConstraint permits.
 *
 * A signature is evaluated when its response is retrieved (evaluateSignature()), without reference to any policy, so the
 * response body need not be kept. The evaluation is compared with the policy when the findings are reported
 * (reportSignature()).
 *
 * This check is separate from the check of the HTTPS connection's certificate chain (tls_checks.mts). It is enabled for the
 * server with the checkResponseSignatures fetch policy, and a request can turn it off (ValidationRequest.responseSignatures)
 */

import { X509Certificate, verify, constants } from "node:crypto"

import { chainHasFingerprint, chainProblems, enforcementSeverity, hostPermitted, summariseChain } from "./certificate_utils.mts"
import type { CertificateSummary, SignaturePolicy } from "./certificate_utils.mts"
import { INFORMATION } from "./error_list.mts"
import ErrorList from "./error_list.mts"

const JWS_KEY = "response signatures";

// the signature algorithms of A177r8 clause 7.7.2: the hash, and the key the signing certificate must have
const ALGORITHMS: Record<string, { hash: string | null; key: string; curve?: string; rsaBits?: number }> = {
	RS256: { hash: "sha256", key: "rsa", rsaBits: 4096 },
	RS512: { hash: "sha512", key: "rsa", rsaBits: 4096 },
	ES256: { hash: "sha256", key: "ec", curve: "prime256v1" },
	ES512: { hash: "sha512", key: "ec", curve: "secp521r1" },
	Ed25519: { hash: null, key: "ed25519" },
};

// the evaluation of the X-JWS-Signature of a response, before it is compared with a signature policy
export type SignatureEvaluation = {
	present: boolean; // the response has an X-JWS-Signature header
	problem?: { code: string; message: string }; // the header could not be decoded (JWS002) or its protected header is wrong (JWS003)
	algorithm?: string;
	chain?: CertificateSummary[]; // from x5c, leaf first
	verified?: boolean; // the signature verifies over the body with the leaf certificate's key
	keyProblem?: string; // the leaf certificate's key does not suit the algorithm
	reportingEndpoint: boolean; // a Reporting-Endpoints header names a dvbi-signature-validation endpoint
};

const base64url = (value: string): Buffer | undefined => (/^[A-Za-z0-9_-]*$/.test(value) ? Buffer.from(value, "base64url") : undefined);

// whether a Reporting-Endpoints header (an RFC 8941 dictionary) has a dvbi-signature-validation member (A177r8 7.6.2.5)
const hasReportingEndpoint = (header: string | null): boolean =>
	header != null && header.split(",").some((member) => member.split("=")[0].trim().toLowerCase() == "dvbi-signature-validation");

/**
 * evaluate the X-JWS-Signature of a response
 *
 * @param {string|null} header              the X-JWS-Signature header
 * @param {Buffer}      body                the response body, as delivered
 * @param {string|null} reportingEndpoints  the Reporting-Endpoints header
 * @returns {SignatureEvaluation} the evaluation
 */
export function evaluateSignature(header: string | null, body: Buffer, reportingEndpoints: string | null): SignatureEvaluation {
	const evaluation: SignatureEvaluation = { present: header != null && header.trim().length > 0, reportingEndpoint: hasReportingEndpoint(reportingEndpoints) };
	if (!evaluation.present) return evaluation;
	const fail = (code: string, message: string): SignatureEvaluation => ({ ...evaluation, problem: { code, message } });

	// a detached JWS in compact serialisation: BASE64URL(protected header) . (empty payload) . BASE64URL(signature)
	const parts = header!.trim().split(".");
	if (parts.length != 3) return fail("JWS002", `X-JWS-Signature has ${parts.length} parts, not the 3 of a compact JWS`);
	if (parts[1].length > 0) return fail("JWS002", "X-JWS-Signature is not a detached JWS: its payload part is not empty");
	const protectedBytes = base64url(parts[0]),
		signature = base64url(parts[2]);
	if (!protectedBytes || !signature || signature.length == 0) return fail("JWS002", "X-JWS-Signature is not valid base64url");
	let jwsHeader: Record<string, unknown>;
	try {
		jwsHeader = JSON.parse(protectedBytes.toString("utf8"));
		if (typeof jwsHeader != "object" || jwsHeader == null || Array.isArray(jwsHeader)) throw new Error("not an object");
	} catch {
		return fail("JWS002", "the protected header of X-JWS-Signature is not a JSON object");
	}

	// A177r8 clause 7.7.1.2: "alg", "crit" containing "b64", and "b64" set to false
	const alg = jwsHeader.alg;
	if (typeof alg != "string" || !Object.hasOwn(ALGORITHMS, alg))
		return fail("JWS003", `the JWS algorithm ${JSON.stringify(alg)} is not one of ${Object.keys(ALGORITHMS).join(", ")}`);
	evaluation.algorithm = alg;
	if (!Array.isArray(jwsHeader.crit) || !jwsHeader.crit.includes("b64")) return fail("JWS003", `the JWS "crit" header parameter does not include "b64"`);
	if (jwsHeader.b64 !== false) return fail("JWS003", `the JWS "b64" header parameter is not false`);

	// the signing certificate chain, leaf first, each a base64 (not base64url) DER certificate (RFC 7515 clause 4.1.6)
	if (!Array.isArray(jwsHeader.x5c) || jwsHeader.x5c.length == 0) return evaluation;
	let certificates: X509Certificate[];
	try {
		certificates = jwsHeader.x5c.map((c) => new X509Certificate(Buffer.from(String(c), "base64")));
	} catch {
		return fail("JWS002", `the "x5c" certificate chain of X-JWS-Signature cannot be read`);
	}
	evaluation.chain = summariseChain(certificates);

	const spec = ALGORITHMS[alg],
		key = certificates[0].publicKey,
		details = key.asymmetricKeyDetails;
	if (key.asymmetricKeyType != spec.key) evaluation.keyProblem = `the signing certificate has a ${key.asymmetricKeyType} key, but ${alg} needs ${spec.key}`;
	else if (spec.rsaBits && details?.modulusLength != spec.rsaBits) evaluation.keyProblem = `the signing certificate has a ${details?.modulusLength}-bit RSA key, but ${alg} needs ${spec.rsaBits} bits`;
	else if (spec.curve && details?.namedCurve != spec.curve) evaluation.keyProblem = `the signing certificate has a key on curve ${details?.namedCurve}, but ${alg} needs ${spec.curve}`;

	// RFC 7797: the signing input is the encoded protected header, a ".", and the payload bytes as they are
	const signingInput = Buffer.concat([Buffer.from(parts[0], "ascii"), Buffer.from("."), body]);
	try {
		evaluation.verified =
			spec.key == "rsa"
				? verify(spec.hash, signingInput, { key, padding: constants.RSA_PKCS1_PADDING }, signature)
				: spec.key == "ec"
					? verify(spec.hash, signingInput, { key, dsaEncoding: "ieee-p1363" }, signature)
					: verify(null, signingInput, key, signature);
	} catch {
		evaluation.verified = false;
	}
	return evaluation;
}

/**
 * report the signature of a response against a signature policy
 *
 * @param {SignatureEvaluation|undefined} evaluation  the evaluation of the response's signature, or undefined if the response could not be retrieved
 * @param {string}          url       the URL of the resource
 * @param {string}          finalURL  the URL the response came from, after any redirects
 * @param {SignaturePolicy} policy    the policy that applies to the response
 * @param {XmlElement}      element   the element that refers to the resource
 * @param {ErrorList}       errs      where findings are reported
 * @param {string}          retrievalError  why the response could not be retrieved, if it could not
 */
export function reportSignature(evaluation: SignatureEvaluation | undefined, url: string, finalURL: string, policy: SignaturePolicy, element: XmlElement, errs: ErrorList, retrievalError?: string): void {
	const type = enforcementSeverity(policy),
		policyName = policy.policyId.quote();
	const report = (code: string, message: string, description: string, clause: string, severity = type) =>
		errs.addError({ code, type: severity, message: `${message} (${url})`, fragment: element, key: JWS_KEY, description, clause });

	if (!evaluation || !evaluation.present) {
		report("JWS001", evaluation ? `there is no X-JWS-Signature for signature policy ${policyName}` : `the signature for signature policy ${policyName} could not be checked: ${retrievalError ?? "the response was not retrieved"}`,
			"A resource that refers to a signature policy shall be provided with a signature in the X-JWS-Signature HTTP response header.", "A177r8 clause 7.6.2.1");
		return;
	}
	if (evaluation.problem) {
		report(evaluation.problem.code, evaluation.problem.message,
			evaluation.problem.code == "JWS003" ? `The JWS header shall contain "alg" (one of the algorithms of clause 7.7.2), "crit" including "b64", and "b64" set to false.` : "The X-JWS-Signature header shall contain a detached JWS in compact serialisation.",
			"A177r8 clause 7.7.1.2");
		return;
	}
	if (!hostPermitted(policy, new URL(finalURL).hostname))
		report("JWS009", `${new URL(finalURL).hostname} is not permitted by the SubjectConstraint of signature policy ${policyName} (${policy.commonNames.join(", ")})`,
			"The final document or data must come from one of the hosts listed in the policy's SubjectConstraint.", "A177r8 table 77d");
	if (!evaluation.reportingEndpoint)
		report("JWS010", `there is no Reporting-Endpoints header with a dvbi-signature-validation endpoint, so a client cannot report signature failures`,
			"An endpoint may include a Reporting-Endpoints header, to which signature verification issues are reported by the DVB-I client.", "A177r8 clause 7.6.2.5", INFORMATION);
	if (!evaluation.chain) {
		report("JWS004", `the X-JWS-Signature has no certificate chain (x5c), so its signature and trust anchor cannot be checked against signature policy ${policyName}`,
			"The signing certificate chain is needed to verify the signature and check it against the policy's TrustAnchor.", "A177r8 clause 7.6.2.3", INFORMATION);
		return;
	}
	if (evaluation.keyProblem) report("JWS006", evaluation.keyProblem, "The signature algorithms are RS256 and RS512 with a 4096-bit key, ES256, ES512 and Ed25519.", "A177r8 clause 7.7.2");
	if (!evaluation.verified) report("JWS005", `the ${evaluation.algorithm} signature in X-JWS-Signature does not verify over the response`, "The signature shall validate the document or data provided in the HTTP response.", "A177r8 clause 7.7.1.2");
	const checkable = policy.fingerprints.filter((f) => chainHasFingerprint(evaluation.chain!, f) !== undefined);
	if (!policy.fingerprints.some((f) => chainHasFingerprint(evaluation.chain!, f)))
		report("JWS007", `no certificate in the signing chain matches a CAFingerprint of signature policy ${policyName}${checkable.length < policy.fingerprints.length ? ` (${policy.fingerprints.length - checkable.length} use an algorithm that cannot be checked)` : ""}`,
			"The certificate of a Certificate Authority in the policy's TrustAnchor must be present in the signing certificate chain.", "A177r8 table 77d");
	for (const problem of chainProblems(evaluation.chain))
		report("JWS008", `in the signing certificate chain, ${problem}`, "The certificates of the signing chain must be valid, each issued by the next.", "A177r8 clause 7.6.2.3");
}
