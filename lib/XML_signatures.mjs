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

		// TODO: check the XML SIgnature
	}

}

