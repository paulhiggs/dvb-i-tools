// RelatedMaterialChecks.js

import { mpeg7 } from "./MPEG7_definitions.js";
import { dvbi, dvbEA } from "./DVB-I_definitions.js";
import { tva, tvaEA, tvaEC } from "./TVA_definitions.js";

import { APPLICATION, WARNING } from "./ErrorList.js";

import { checkLanguage, mlLanguage } from './MultilingualElement.js';
import { checkAttributes, checkTopElementsAndCardinality} from "./schema_checks.js";
import { isJPEGmime, isPNGmime, isWebPmime, validImageSet } from "./MIME_checks.js";
import { isHTTPURL } from "./pattern_checks.js";
import { cg_InvalidHrefValue } from "./CommonErrors.js";

/**
 * verifies if the specified RelatedMaterial contains a Promotional Still Image (per A177 clause 6.10.13). Only a single image is permitted and the format
* specified in <MediaLocator><MediaURI> must match that specified in <Format>
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

	checkTopElementsAndCardinality(RelatedMaterial, 
		[{name:tva.e_HowRelated},
		 {name:tva.e_Format, minOccurs:0},
		 {name:tva.e_MediaLocator}],
		tvaEC.RelatedMaterial, false, errs, `${errCode}-1`);

	let HowRelated=null, Format=null, MediaLocator=null;
	// just use the first instance of any specified element
	if (RelatedMaterial.childNodes()) RelatedMaterial.childNodes().forEachSubElement(elem => {
		switch (elem.name()) {
			case tva.e_HowRelated:
				if (!HowRelated) HowRelated=elem;
				break;
			case tva.e_Format:
				if (!Format) Format=elem;
				break;
			case tva.e_MediaLocator:
				if (!MediaLocator) MediaLocator=elem;
				break;
		}
	});

	if (!HowRelated || !MediaLocator)
		return;
	checkAttributes(HowRelated, [tva.a_href], [], tvaEA.HowRelated, errs, `${errCode}-2`);

	if (HowRelated.attr(tva.a_href) && (HowRelated.attr(tva.a_href).value()!=tva.cs_PromotionalStillImage) ) {
		errs.addError({code:`${errCode}-10`, message:`${tva.a_href.attribute(tva.e_HowRelated)}=${HowRelated.attr(tva.a_href).value().quote()} does not designate a Promotional Still Image`,
						fragment:HowRelated});
		return;
	}

	let isJPEG=false, isPNG=false, StillPictureFormat=null;
	if (Format) {
		checkTopElementsAndCardinality(Format,
			[{name:tva.e_StillPictureFormat}],
			tvaEC.Format, false, errs, `${errCode}-11`);

		if (Format.childNodes()) Format.childNodes().forEachSubElement(child => {
			if (child.name()==tva.e_StillPictureFormat) {
				StillPictureFormat=child;

				checkAttributes(child, [tva.a_horizontalSize, tva.a_verticalSize, tva.a_href], [], tvaEA.SillPictureFormat, errs, `${errCode}-12`);

				if (child.attr(tva.a_href)) {
					let href=child.attr(tva.a_href).value();
					switch (href) {
						case mpeg7.JPEG_IMAGE_CS_VALUE:
							isJPEG=true;
							break;
						case mpeg7.PNG_IMAGE_CS_VALUE:
							isPNG=true;
							break;
						default:
							cg_InvalidHrefValue(href, child, `${RelatedMaterial.name()}.${tva.e_Format}.${tva.e_StillPictureFormat}`, location, errs, `${errCode}-13`);
					}
				}
			}
		});

	}

	checkTopElementsAndCardinality(MediaLocator,
		[{name:tva.e_MediaUri}],
		tvaEC.MediaLocator, false, errs, `${errCode}-21`);

	let hasMediaURI=false;
	if (MediaLocator.childNodes()) MediaLocator.childNodes().forEachSubElement(child => {
		if (child.name()==tva.e_MediaUri) {
			hasMediaURI=true;
			checkAttributes(child, [tva.a_contentType], [], tvaEA.MediaUri, errs, `${errCode}-22`);
			if (child.attr(tva.a_contentType)) {
				let contentType=child.attr(tva.a_contentType).value();
				if (!isJPEGmime(contentType) && !isPNGmime(contentType)) 
					errs.addError({code:`${errCode}-23`, 
									message:`invalid ${tva.a_contentType.attribute(tva.e_MediaLocator)}=${contentType.quote()} specified for ${RelatedMaterial.name().elementize()} in ${location}`,
									fragment:child});
				if (StillPictureFormat && ((isJPEGmime(contentType) && !isJPEG) || (isPNGmime(contentType) && !isPNG))) {
					errs.addError({code:`${errCode}-24`,
									message:`conflicting media types in ${tva.e_StillPictureFormat.elementize()} and ${tva.e_MediaUri.elementize()} for ${location}`, 
									fragments:[StillPictureFormat,child]});
				}
			}
			if (!isHTTPURL(child.text()))
				errs.addError({code:`${errCode}-25`, message:`${tva.e_MediaUri.elementize()}=${child.text().quote()} is not a valid Image URL`, key:"invalid URL", fragment:child});
		}
	});
	if (!hasMediaURI)
		errs.addError({code:`${errCode}-26`, 
				message:`${tva.e_MediaUri.elementize()} not specified for ${tva.e_MediaLocator.elementize()} logo in ${location}`, 
				fragment:MediaLocator, key:`no ${tva.e_MediaUri}`});
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
	
	let specifiedMediaTypes=[];
	if (RelatedMaterial.childNodes()) RelatedMaterial.childNodes().forEachSubElement(MediaLocator => {
		if (MediaLocator.name()==tva.e_MediaLocator) {

			checkTopElementsAndCardinality(MediaLocator, [{name:tva.e_MediaUri}], tvaEC.MediaLocator, false, errs, `${errCode}-1`);
			checkAttributes(MediaLocator, [], [dvbi.a_contentLanguage], dvbEA.MediaLocator, errs, `${errCode}-2`);

			if (languageValidator && MediaLocator.attr(dvbi.a_contentLanguage)) 
				checkLanguage(languageValidator, MediaLocator.attr(dvbi.a_contentLanguage).value(), location, MediaLocator, errs, `${errCode}-3`);

			let MLlanguage=mlLanguage(MediaLocator);

			if (MediaLocator.childNodes()) MediaLocator.childNodes().forEachSubElement(MediaUri => {
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
			key:'invalid image set', line:RelatedMaterial.line()});
	}
}

