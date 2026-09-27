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
import { DuplicatedValue } from "./utils.mts"
import { keys } from "./common_errors.mts"
import ErrorList from "./error_list.mts"

export function ValidateSignaturePolicies(element: XmlElement, errs: ErrorList, errCode: string) {
	const policies_found = new Set<string>();

	const SignaturePolicies = element.getAnyNs(dvbi.e_SignaturePolicies);
	if (SignaturePolicies) {
		SignaturePolicies.forEachNamedChildElement(dvbi.e_SignaturePolicy, (SignaturePolicy) => {
			const policyID = SignaturePolicy.attrAnyNsValueOr(dvbi.a_policyId);
			if (policyID && DuplicatedValue(policies_found, policyID))
				errs.addError({
					code: `${errCode}-01`,
					message: `Duplicate policy ID found: ${policyID}`,
					key: keys.k_SignaturePolicies,
					fragment: SignaturePolicy,
				});

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
				});
		});
	}
	return policies_found;
}