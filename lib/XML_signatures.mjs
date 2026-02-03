/**
 * XML_signatures.mjs
 *
 * Validation of  XML Digital Signatures
 */

import { xmlsig } from "./W3C_defintions.mjs"

/**
 * validates any XML Signature elements preseng in the elemeny
 *  
 * @param {Xmlelement} element  The XML element possibly containing XML Signature elements
 * @param {ErrorList}  errs     The class where errors and warnings relating to the serivce list processing are stored
 * @param {String}     errCode rror code prefix for reporting
 */
export function ValidateAnyXMLSignatures(element, errs, errCode) {

	let Signature, s=0;
	while ((Signature = element.getAnyNS(xmlsig.e_Signature, ++s)) != null) {

		// TODO: check the XML Signature

		const SignedInfo = Signature.getAnyNS(xmlsig.e_SignedInfo);
		if (SignedInfo) {
			const CanonicalizationMethod = SignedInfo.getAnyNS(xmlsig.e_CanonicalizationMethod);
			if (CanonicalizationMethod) {
				const cm_Algorithm = CanonicalizationMethod.attrAnyNsValueOr(xmlsig.a_Algorithm, null);
			}

			const SignatureMethod = SignedInfo.getAnyNS(xmlsig.e_SignatureMethod);
			if (SignatureMethod) {
				const sm_Algorithm = SignatureMethod.attrAnyNsValueOr(xmlsig.a_Algorithm, null);
			}

		}

	}

}

