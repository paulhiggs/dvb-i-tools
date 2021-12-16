// RelatedMaterialChecks.js

import { dvbi, dvbEA } from "./DVB-I_definitions.js";
import { tva, tvaEA, tvaEC } from "./TVA_definitions.js";

import { APPLICATION, WARNING } from "./ErrorList.js";

import { checkLanguage, ancestorLanguage } from './MultilingualElement.js';
import { checkAttributes, checkTopElementsAndCardinality} from "./schema_checks.js";
import { isJPEGmime, isPNGmime, isWebPmime, validImageSet } from "./MIME_checks.js";
import { isHTTPURL } from "./pattern_checks.js";

// orginally from cg-check.js
/**
 * verifies if the specified RelatedMaterial contains a Promotional Still Image
 *
 * @param {Object} RelatedMaterial   the <RelatedMaterial> element (a libxmls ojbect tree) to be checked
 * @param {Object} errs              The class where errors and warnings relating to the serivce list processing are stored
 * @param {String} errcode			 Error code prefix for reporting
 * @param {string} location          The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
 * @param {Object} languageValidator
 */
export function ValidatePromotionalStillImage(RelatedMaterial, errs, errCode, location, languageValidator=null) {
	
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
		tvaEC.RelatedMaterial, false, errs, `${errCode}-1`);
	checkAttributes(HowRelated, [tva.a_href], [], tvaEA.HowRelated, errs, `${errCode}-2`);

	if (HowRelated.attr(tva.a_href) && (HowRelated.attr(tva.a_href).value()!=tva.cs_PromotionalStillImage) )
		errs.addError({code:`${errCode}-10`, message:`${tva.a_href.attribute(tva.e_HowRelated)}=${HowRelated.attr(tva.a_href).value().quote()} does not designate a Promotional Still Image`,
						fragment:HowRelated});

	checkValidLogos(RelatedMaterial, errs, `${errCode}-11`, location, languageValidator);

}



/**
 * verifies if the images provided in <MediaLocator> elments are valid according to specification
 *
 * @param {Object} Element       The <RelatedMaterial> element
 * @param {Object} errs          The class where errors and warnings relating to the service list processing are stored 
 * @param {String} errCode       Error code prefix for reporting
 * @param {string} location      The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
 * @param {Object} languageValidator
*/
export function  checkValidLogos(RelatedMaterial, errs, errCode, location, languageValidator=null) {

	if (!RelatedMaterial)
		return;
	
	let RMchildren=RelatedMaterial.childNodes(), specifiedMediaTypes=[];
	if (RMchildren) RMchildren.forEachSubElement(MediaLocator => {
		if (MediaLocator.name()==tva.e_MediaLocator) {

			checkTopElementsAndCardinality(MediaLocator, [{name:tva.e_MediaUri}], tvaEC.MediaLocator, false, errs, `${errCode}-1`);
			checkAttributes(MediaLocator, [], [dvbi.a_contentLanguage], dvbEA.MediaLocator, errs, `${errCode}-2`);

			if (languageValidator && MediaLocator.attr(dvbi.a_contentLanguage)) 
				checkLanguage(languageValidator, MediaLocator.attr(dvbi.a_contentLanguage).value(), location, MediaLocator, errs, `${errCode}-3`);

			let MLlanguage=ancestorLanguage(MediaLocator);

			let subElems=MediaLocator.childNodes();
			if (subElems) subElems.forEachSubElement(MediaUri => {
				if (MediaUri.name()==tva.e_MediaUri) {

					checkAttributes(MediaUri, [tva.a_contentType], [], tvaEA.MediaUri, errs, `${errCode}-4`);
					
					if (MediaUri.attr(tva.a_contentType)) {
						let contentType=MediaUri.attr(tva.a_contentType).value();

						if (!isJPEGmime(contentType) && !isPNGmime(contentType) && !isWebPmime(contentType))
							errs.addError({code:`${errCode}-5`, type:WARNING,
								message:`non-standard ${tva.a_contentType.attribute()} ${contentType.quote()} specified for ${tva.e_RelatedMaterial.elementize()}${tva.e_MediaLocator.elementize()} in ${location}`, 
								key:`non-standard ${tva.a_contentType.attribute(tva.e_MediaUri)}`,
								fragment:MediaUri});	
						
						specifiedMediaTypes.push(contentType);
					}

					if (!isHTTPURL(MediaUri.text())) 
						errs.addError({code:`${errCode}-6`, message:`invalid URL ${MediaUri.text().quote()} specified for ${tva.e_MediaUri.elementize()}`, 
										fragment:MediaUri, key:"invalid resource URL"});
				}
			});				
		}
	});

	if (specifiedMediaTypes.length!=0 && !validImageSet(specifiedMediaTypes)) {
		errs.addError({code:`${errCode}-7`, message:'A PNG or JPG image must be specified with other MIME types are used', 
			key:'invalif image set', line:RelatedMaterial.line()});
	}
}

