/**
 * signature_policies.mts
 *
*  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
* Validate and check defined sigmature policies
 */


import { dvbi } from "./DVB-I_definitions.mts"
import { keys } from "./common_errors.mts"
import ErrorList from "./error_list.mts"
import { normaliseFingerprint } from "./certificate_utils.mts"
import type { SignaturePolicy } from "./certificate_utils.mts"

/**
 * check the <SignaturePolicies> of a service list or service list registry, and collect the policies it defines
 *
 * @param {XmlElement} element  the element that may contain <SignaturePolicies>
 * @param {ErrorList}  errs     where findings are reported
 * @param {string}     errCode  error code prefix for reporting
 * @returns {Map<string, SignaturePolicy>} the policies, by @policyId. When an ID is defined more than once, the first
 *                                         definition is used
 */
export function ValidateSignaturePolicies(element: XmlElement, errs: ErrorList, errCode: string): Map<string, SignaturePolicy> {
	const policies = new Map<string, SignaturePolicy>();

	const SignaturePolicies = element.getAnyNs(dvbi.e_SignaturePolicies);
	if (SignaturePolicies) {
		SignaturePolicies.forEachNamedChildElement(dvbi.e_SignaturePolicy, (SignaturePolicy) => {
			const policyID = SignaturePolicy.attrAnyNsValueOr(dvbi.a_policyId);
			const policy: SignaturePolicy = {
				policyId: policyID ?? "",
				enforcement: SignaturePolicy.getAnyNs(dvbi.e_Enforcement)?.content.trim() ?? "",
				fingerprints: [],
				commonNames: [],
			};

			const TrustAnchor = SignaturePolicy.getAnyNs(dvbi.e_TrustAnchor);
			if (TrustAnchor)
				TrustAnchor.forEachNamedChildElement(dvbi.e_CAFingerprint, (CAFingerprint) => {
					const Fingerprint_algorithm = CAFingerprint.attrAnyNsValueOr(dvbi.a_algorithm);
					if (Fingerprint_algorithm && dvbi.ALLOWED_FINGERPRINT_ALGOS.length > 0 && !dvbi.ALLOWED_FINGERPRINT_ALGOS.includes(Fingerprint_algorithm))
						errs.addError({
							code: `${errCode}-02`,
							message: `${Fingerprint_algorithm} is not a valid algorithm for ${dvbi.e_CAFingerprint.elementize()}`,
							key: keys.k_SignaturePolicies,
							fragment: CAFingerprint,
						})
					if (Fingerprint_algorithm) policy.fingerprints.push({ algorithm: Fingerprint_algorithm, value: normaliseFingerprint(CAFingerprint.content) });
				});

			SignaturePolicy.getAnyNs(dvbi.e_SubjectConstraint)?.forEachNamedChildElement(dvbi.e_CN, (CN) => {
				if (CN.content.trim().length > 0) policy.commonNames.push(CN.content.trim());
			});

			if (!policyID) return;
			if (policies.has(policyID))
				errs.addError({
					code: `${errCode}-01`,
					message: `Duplicate policy ID found: ${policyID}`,
					key: keys.k_SignaturePolicies,
					fragment: SignaturePolicy,
				});
			else policies.set(policyID, policy);
		});
	}
	return policies;
}
