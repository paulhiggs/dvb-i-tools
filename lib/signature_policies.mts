/**
 * signature_policies.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Validate and check defined signature policies, accumulating values for later use
 */


import { dvbi } from "./DVB-I_definitions.mts"
import { DuplicatedValue } from "./utils.mts"
import { keys } from "./common_errors.mts"
import ErrorList from "./error_list.mts"
import type { SignaturePolicy } from "./sl_check.mts"

export function ValidateSignaturePolicies(element: XmlElement, errs: ErrorList, errCode: string) : SignaturePolicy[] {
	const policies_found: SignaturePolicy[] = [];

	const SignaturePolicies = element.getAnyNs(dvbi.e_SignaturePolicies);
	if (SignaturePolicies) {
		SignaturePolicies.forEachNamedChildElement(dvbi.e_SignaturePolicy, (SignaturePolicy) => {
			const policyID = SignaturePolicy.attrAnyNsValueOr(dvbi.a_policyId);
			if (policyID) {
				const exists = policies_found.find((p) => p.policyId = policyID)
				if (exists)
					errs.addError({
						code: `${errCode}-01`,
						message: `Duplicate policy ID found: ${policyID}`,
						key: keys.k_SignaturePolicies,
						fragment: SignaturePolicy,
					});
				else {
					const new_policy: SignaturePolicy = {policyId: policyID, CAfingerprint: [], CN: []} 
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
							else {
								new_policy.CAfingerprint.push({
									algorithm: Fingerprint_algorithm as string,
									fingerprint: CAFingerprint.content
								})
							}
						});
					const SubjectConstraint = SignaturePolicy.getAnyNs(dvbi.e_SubjectConstraint)
					if (SubjectConstraint) {
						SubjectConstraint.forEachNamedChildElement(dvbi.e_CN, (CN) => {
							new_policy.CN.push(CN.content)
						});
					}
					policies_found.push(new_policy)
				}
			}
		});
	}
	return policies_found;
}