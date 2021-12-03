// RelatedMaterialChecks.js

import { dvbi } from "./DVB-I_definitions.js";
import { tva, tvaEA, tvaEC } from "./TVA_definitions.js";

import { APPLICATION, WARNING } from "./ErrorList.js";

import { checkLanguage } from './MultilingualElement.js';
import { checkAttributes, checkTopElementsAndCardinality} from "./schema_checks.js";
import { isJPEGmime, isPNGmime, isWebPmime } from "./MIME_checks.js";
import { isHTTPURL } from "./pattern_checks.js";

// orginally from cg-check.js
/**
 * verifies if the specified RelatedMaterial contains a Promotional Still Image
 *
 * @param {Object} RelatedMaterial   the <RelatedMaterial> element (a libxmls ojbect tree) to be checked
 * @param {Object} errs              The class where errors and warnings relating to the serivce list processing are stored 
 * @param {string} location          The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
 * @param {Object} languageValidator
 */
export function ValidatePromotionalStillImage(RelatedMaterial, errs, location, languageValidator=null) {
	
	if (!RelatedMaterial) {
		errs.addError({type:APPLICATION, code:"PS000", message:"ValidatePromotionalStillImage() called with RelatedMaterial==null"});
		return;
	}
	let HowRelated=null, MediaLocator=[];
	let children=RelatedMaterial.childNodes();
	if (children) children.forEachSubElement(elem => {
		switch (elem.name()) {
			case tva.e_HowRelated:
				HowRelated=elem;
				break;
			case tva.e_MediaLocator:
				MediaLocator.push(elem);
				break;
		}
	});

	checkTopElementsAndCardinality(RelatedMaterial, 
		[{name:tva.e_HowRelated},
		 {name:tva.e_MediaLocator, maxOccurs:Infinity}],
		tvaEC.RelatedMaterial, errs, "PS001");
	checkAttributes(HowRelated, [tva.a_href], [], tvaEA.HowRelated, errs, "PS002");

	if (HowRelated.attr(tva.a_href)) {
		if (HowRelated.attr(tva.a_href).value()!=tva.cs_PromotionalStillImage) 
			errs.addError({code:"PS010", message:`${tva.a_href.attribute(tva.e_HowRelated)}=${HowRelated.attr(tva.a_href).value().quote()} does not designate a Promotional Still Image`,
							fragment:HowRelated});
	}
	if (MediaLocator.length!=0) 
		MediaLocator.forEach(ml => {
			checkValidLogo(ml, RelatedMaterial, errs, location, languageValidator);
		});
}


// originally from sl-check.js
/**
 * verifies if the specified logo is valid according to specification
 *
 * @param {Object} MediaLocator  The <MediaLocator> subelement (a libxmls ojbect tree) of the <RelatedMaterial> element
 * @param {Object} Element       The <RelatedMaterial> element
 * @param {Object} errs          The class where errors and warnings relating to the service list processing are stored 
 * @param {string} location      The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
 * @param {Object} languageValidator
*/
export function  checkValidLogo(MediaLocator, RelatedMaterial, errs, location, languageValidator=null) {

	if (!MediaLocator)
		return;
	
	if (MediaLocator) {
		checkTopElementsAndCardinality(MediaLocator, [{name:tva.e_MediaLocator}], tvaEC.MediaLocator, errs, "VL020");

		if (languageValidator && MediaLocator.attr(dvbi.a_contentLanguage)) 
			checkLanguage(languageValidator, MediaLocator.attr(dvbi.a_contentLanguage).value(), location, MediaLocator, errs, "VL021");

		let subElems=MediaLocator.childNodes(), hasMediaURI=false;
		if (subElems) subElems.forEachSubElement(child => {
			if (child.name()==tva.e_MediaUri) {
				hasMediaURI=true;
				
				if (child.attr(tva.a_contentType)) {
					let contentType=child.attr(tva.a_contentType).value();
					if (!isJPEGmime(contentType) && !isPNGmime(contentType) && !isWebPmime(contentType))
						errs.addError({code:"VL022", type:WARNING,
							message:`non-standard ${tva.a_contentType.attribute()} ${contentType.quote()} specified for ${tva.e_RelatedMaterial.elementize()}${tva.e_MediaLocator.elementize()} in ${location}`, 
							key:`non-standard ${tva.a_contentType.attribute(tva.e_MediaUri)}`,
							fragment:child});
				}
				if (!isHTTPURL(child.text())) 
					errs.addError({code:"VL024", message:`invalid URL ${child.text().quote()} specified for ${child.name().elementize()}`, 
									fragment:child, key:"invalid resource URL"});
			}
		});
	}
	else 
		errs.addError({code:"VL026", message:`${tva.e_MediaLocator} not specified for ${tva.e_RelatedMaterial.elementize()} in ${location}`,
				fragment:RelatedMaterial, key:`no ${tva.e_MediaLocator}`});
}
