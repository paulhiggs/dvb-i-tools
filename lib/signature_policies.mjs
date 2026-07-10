/**
 * signature_policies.mjs
 *
*  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
* Validate check defined sigmature policies
 */


import { dvbi } from "./DVB-I_definitions.mjs";
import { isIn } from "./utils.mjs";
import { keys } from "./common_errors.mjs";

export function  ValidateSignaturePolicies(element, errs, errCode) {
	const policies_found = [];

	const SignaturePolicies = element.getAnyNs(dvbi.e_SignaturePolicies);
	if (SignaturePolicies) {
		SignaturePolicies.forEachNamedChildElement(dvbi.e_SignaturePolicy, (SignaturePolicy) => {
			const policyID = SignaturePolicy.attrAnyNsValueOr(dvbi.a_policyId);
			if (isIn(policies_found, policyID))
				errs.addError({
					code: `${errCode}-01`,
					message: `Duplicate policy ID found: ${policyID}`,
					key: keys.k_SignaturePolicies,
					fragment: SignaturePolicy,
				});
			policies_found.push(policyID);

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