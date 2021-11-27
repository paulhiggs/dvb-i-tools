// RelatedMaterialChecks.js

import { mpeg7 } from "./MPEG7_definitions.js";
import { dvbi } from "./DVB-I_definitions.js";
import { tva, tvaEA, tvaEC } from "./TVA_definitions.js";

import { APPLICATION } from "./ErrorList.js";

import { NoChildElement, cg_InvalidHrefValue, sl_InvalidHrefValue } from "./CommonErrors.js";
import { checkAttributes, checkTopElementsAndCardinality} from "./schema_checks.js";
import { isJPEGmime, isPNGmime } from "./MIME_checks.js";
import { isHTTPURL } from "./pattern_checks.js";

// orginally from cg-check.js
/**
 * verifies if the specified RelatedMaterial contains a Promotional Still Image
 *
 * @param {Object} RelatedMaterial   the <RelatedMaterial> element (a libxmls ojbect tree) to be checked
 * @param {Object} errs              The class where errors and warnings relating to the serivce list processing are stored 
 * @param {string} location          The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
 */
export function ValidatePromotionalStillImage(RelatedMaterial, errs, location) {
	
	if (!RelatedMaterial) {
		errs.addError({type:APPLICATION, code:"PS000", message:"ValidatePromotionalStillImage() called with RelatedMaterial==null"});
		return;
	}
	let HowRelated=null, Format=null, MediaLocator=[];
	let children=RelatedMaterial.childNodes();
	if (children) children.forEachSubElement(elem => {
		switch (elem.name()) {
			case tva.e_HowRelated:
				HowRelated=elem;
				break;
			case tva.e_Format:
				Format=elem;
				break;
			case tva.e_MediaLocator:
				MediaLocator.push(elem);
				break;
		}
	});

	if (!HowRelated) {
		NoChildElement(errs, tva.e_HowRelated.elementize(), RelatedMaterial, location, "PS001");
		return;
	}

	checkAttributes(HowRelated, [tva.a_href], [], tvaEA.HowRelated, errs, "PS002");
	if (HowRelated.attr(tva.a_href)) {
		if (HowRelated.attr(tva.a_href).value()!=tva.cs_PromotionalStillImage) 
			errs.addError({code:"PS010", message:`${tva.a_href.attribute(tva.e_HowRelated)}=${HowRelated.attr(tva.a_href).value().quote()} does not designate a Promotional Still Image`,
							fragment:HowRelated});
		else {
			let isJPEG=false, isPNG=false, StillPictureFormat=null;
			if (Format) {
				checkTopElementsAndCardinality(Format, 
					[{name:tva.e_StillPictureFormat}],
					tvaEC.Format, 
					false, errs, "PS023");
				
				let subElems=Format.childNodes();
				if (subElems) subElems.forEachSubElement(child => {
					if (child.name()==tva.e_StillPictureFormat) {
						StillPictureFormat=child;

						checkAttributes(child, [tva.a_horizontalSize, tva.a_verticalSize, tva.a_href], [], tvaEA.SillPictureFormat, errs, "PS021");
						
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
									cg_InvalidHrefValue(href, child, `${RelatedMaterial.name()}.${tva.e_Format}.${tva.e_StillPictureFormat}`, location, errs, "PS022");
							}
						}
					}
				});
			}

			if (MediaLocator.length!=0) 
				MediaLocator.forEach(ml => {
					let subElems=ml.childNodes(), hasMediaURI=false;
					if (subElems) subElems.forEachSubElement(child => {
						if (child.name()==tva.e_MediaUri) {
							hasMediaURI=true;
							checkAttributes(child, [tva.a_contentType], [], tvaEA.MediaUri, errs, "PS031");
							if (child.attr(tva.a_contentType)) {
								let contentType=child.attr(tva.a_contentType).value();
								if (!isJPEGmime(contentType) && !isPNGmime(contentType)) 
									errs.addError({code:"PS032", 
													message:`invalid ${tva.a_contentType.attribute(tva.e_MediaLocator)}=${contentType.quote()} specified for ${RelatedMaterial.name().elementize()} in ${location}`,
													fragment:child});
								if (StillPictureFormat && ((isJPEGmime(contentType) && !isJPEG) || (isPNGmime(contentType) && !isPNG))) {
									errs.addError({code:"PS033",
													message:`conflicting media types in ${tva.e_StillPictureFormat.elementize()} and ${tva.e_MediaUri.elementize()} for ${location}`, 
													fragments:[StillPictureFormat,child]});
								}
							}
							if (!isHTTPURL(child.text()))
								errs.addError({code:"PS034", message:`${tva.e_MediaUri.elementize()}=${child.text().quote()} is not a valid Image URL`, key:"invalid URL", fragment:child});
						}
					});
					if (!hasMediaURI)
						errs.addError({code:"PS035", 
								message:`${tva.e_MediaUri.elementize()} not specified for ${tva.e_MediaLocator.elementize()} logo in ${location}`, 
								fragment:MediaLocator, key:`no ${tva.e_MediaUri}`});
				});
			else 
				NoChildElement(errs, tva.e_MediaLocator, RelatedMaterial, location, "PS039");
		}
	}
}


// originally from sl-check.js
/**
 * verifies if the specified logo is valid according to specification
 *
 * @param {Object} HowRelated    The <HowRelated> subelement (a libxmls ojbect tree) of the <RelatedMaterial> element
 * @param {Object} Format        The <Format> subelement (a libxmls ojbect tree) of the <RelatedMaterial> element
 * @param {Object} MediaLocator  The <MediaLocator> subelement (a libxmls ojbect tree) of the <RelatedMaterial> element
 * @param {Object} Element       The <RelatedMaterial> element
 * @param {Object} errs          The class where errors and warnings relating to the service list processing are stored 
 * @param {string} Location      The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
*/
export function  checkValidLogo(HowRelated, Format, MediaLocator, RelatedMaterial, errs, location) {
	// irrespective of the HowRelated@href, all logos have specific requirements
	if (!HowRelated)
		return;

	let isJPEG=false, isPNG=false; 
	// if <Format> is specified, then it must be per A177 5.2.6.1, 5.2.6.2 or 5.2.6.3 -- which are all the same
	if (Format) {
		let subElems=Format.childNodes(), hasStillPictureFormat=false;
		if (subElems) subElems.forEachSubElement(child => {
			if (child.name()==dvbi.e_StillPictureFormat) {
				hasStillPictureFormat=true;
				if (!child.attr(dvbi.a_horizontalSize)) 
					errs.addError({code:"VL010", 
						message:`${dvbi.a_horizontalSize.attribute()} not specified for ${tva.e_RelatedMaterial.elementize()}${tva.e_Format.elementize()}${dvbi.e_StillPictureFormat.elementize()} in ${location}`, 
						fragment:child, key:`no ${dvbi.a_horizontalSize.attribute()}`});
				if (!child.attr(dvbi.a_verticalSize)) 
					errs.addError({code:"VL011", 
						message:`${dvbi.a_verticalSize.attribute()} not specified for ${tva.e_RelatedMaterial.elementize()}${tva.e_Format.elementize()}${dvbi.e_StillPictureFormat.elementize()} in ${location}`, 
						fragment:child, key:`no ${dvbi.a_verticalSize.attribute()}`});
				if (child.attr(dvbi.a_href)) {
					let href=child.attr(dvbi.a_href).value();
					switch (href) {
						case mpeg7.JPEG_IMAGE_CS_VALUE:
							isJPEG=true;
							break;
						case mpeg7.PNG_IMAGE_CS_VALUE:
							isPNG=true;
							break;
						default:
							sl_InvalidHrefValue(href, child, `${tva.e_RelatedMaterial.elementize()}${tva.e_Format.elementize()}${dvbi.e_StillPictureFormat.elementize()}`, location, errs, "VL012");
					}
				} 
			}
		});
		if (!hasStillPictureFormat) 
			errs.addError({code:"VL014", message:`${dvbi.e_StillPictureFormat.elementize()} not specified for ${tva.e_Format.elementize()} in ${location}`, 
							fragment:Format, key:"no StillPictureFormat"});
	}

	if (MediaLocator) {
		let subElems=MediaLocator.childNodes(), hasMediaURI=false;
		if (subElems) subElems.forEachSubElement(child => {
			if (child.name()==tva.e_MediaUri) {
				hasMediaURI=true;
				
				if (child.attr(tva.a_contentType)) {
					let contentType=child.attr(tva.a_contentType).value();
					if (!isJPEGmime(contentType) && !isPNGmime(contentType))
						errs.addError({code:"VL022", 
							message:`invalid ${tva.a_contentType.attribute()} ${contentType.quote()} specified for ${tva.e_RelatedMaterial.elementize()}${tva.e_MediaLocator.elementize()} in ${location}`, 
							key:`invalid ${tva.a_contentType.attribute(tva.e_MediaUri)}`,
							fragment:child});
					if (Format && ((isJPEGmime(contentType) && !isJPEG) || (isPNGmime(contentType) && !isPNG))) 
						errs.addError({code:"VL023", message:`conflicting media types in ${tva.e_Format.elementize()} and ${tva.e_MediaUri.elementize()} for ${location}`, 
										fragment:child, key:"conflicting mime types"});
				}
				if (!isHTTPURL(child.text())) 
					errs.addError({code:"VL024", message:`invalid URL ${child.text().quote()} specified for ${child.name().elementize()}`, 
									fragment:child, key:"invalid resource URL"});
			}
		});
		if (!hasMediaURI) 
			errs.addError({code:"VL025", 
				message:`${tva.e_MediaUri.elementize()} not specified for logo ${tva.e_MediaLocator.elementize()} in ${location}`, 
				fragment:MediaLocator, key:`no ${tva.e_MediaUri}`});
	}
	else 
		errs.addError({code:"VL026", message:`${tva.e_MediaLocator} not specified for ${tva.e_RelatedMaterial.elementize()} in ${location}`,
				fragment:RelatedMaterial, key:`no ${tva.e_MediaLocator}`});
}
