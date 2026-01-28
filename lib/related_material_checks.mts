/**
 * related_material_checks.mts
 *
 * Checks performed in <RelatedMaterial> elements for based on their use in DVB-I
 */
//import { Array_extension_init } from "./Array-extensions.mts";
//Array_extension_init();

import { mpeg7 } from "./MPEG7_definitions.mts";
import { tva, tvaEA, tvaEC } from "./TVA_definitions.mts";
import { dvbi, dvbiEA } from "./DVB-I_definitions.mts";

import { APPLICATION, WARNING } from "./error_list.mts";
import ErrorList from "./error_list.mts";
import { checkLanguage } from "./multilingual_element.mts";
import { checkAttributes, checkTopElementsAndCardinality } from "./schema_checks.mts";
import { isJPEGmime, isPNGmime, validImageSet, isAllowedImageMime } from "./MIME_checks.mts";
import { isHTTPURL, isInlineImage } from "./pattern_checks.mts";
import { cg_InvalidHrefValue, InvalidURL, keys } from "./common_errors.mts";

/**
 * verifies if the specified RelatedMaterial contains a image of the specified type(s). Only a single image is permitted and the format
 * specified in <MediaLocator><MediaURI> must match that specified in <Format>
 *
 * @param {XmlElement} RelatedMaterial   the <RelatedMaterial> element (a libxmls ojbect tree) to be checked
 * @param {String}     location          The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
 * @param {Array}      allowedHowRelated The set of permitted
 * @param {ErrorList}  errs              The class where errors and warnings relating to the serivce list processing are stored
 * @param {String}     errcode           Error code prefix for reporting
 */
function validateImageRelatedMaterial(RelatedMaterial : XmlElement, location : string, allowedHowRelated : Array<string>, errs : ErrorList, errCode : string) {
	if (RelatedMaterial.name != tva.e_RelatedMaterial) {
		errs.addError({ type: APPLICATION, code: "PS000", message: `validateImageRelatedMaterial() called with ${RelatedMaterial.name} not ${tva.e_RelatedMaterial}` });
		return;
	}

	checkTopElementsAndCardinality(
		RelatedMaterial,
		[{ name: tva.e_HowRelated }, { name: tva.e_Format, minOccurs: 0 }, { name: tva.e_MediaLocator }],
		tvaEC.RelatedMaterial,
		false,
		errs,
		`${errCode}-1`
	);

	let HowRelated : XmlElement | null = null,
		Format : XmlElement | null = null,
		MediaLocator : XmlElement | null = null;
	// just use the first instance of any specified element
	RelatedMaterial.forEachSubElement((child) => {
		switch (child.name) {
			case tva.e_HowRelated:
				if (!HowRelated) HowRelated = child;
				break;
			case tva.e_Format:
				if (!Format) Format = child;
				break;
			case tva.e_MediaLocator:
				if (!MediaLocator) MediaLocator = child;
				break;
		}
	});

	if (!HowRelated || !MediaLocator) return;
	checkAttributes(HowRelated, [tva.a_href], [], tvaEA.HowRelated, errs, `${errCode}-2`);

	const hrHref = (HowRelated as XmlElement).attrAnyNsValueOrNull(tva.a_href);
	if (hrHref && !allowedHowRelated.includes(hrHref)) {
		errs.addError({
			code: `${errCode}-10`,
			message: `${tva.a_href.attribute(tva.e_HowRelated)}=${hrHref.quote()} ius not valid for this use`,
			fragment: HowRelated,
			key: keys.k_InvalidHRef,
		});
		return;
	}

	let isJPEG : boolean = false,
		isPNG : boolean = false,
		StillPictureFormat : XmlElement | null = null;
	if (Format) {
		checkTopElementsAndCardinality(Format, [{ name: tva.e_StillPictureFormat }], tvaEC.Format, false, errs, `${errCode}-11`);
		errs.errorDescription({code: `${errCode}-11`, description: "Only the StillPictureFormat sub-element is permitted.", clause: "A177 Table 59"});
		(Format as XmlElement).forEachNamedSubElement(tva.e_StillPictureFormat, (StillPicture) => {
			StillPictureFormat = StillPicture;
			checkAttributes(StillPicture, [tva.a_horizontalSize, tva.a_verticalSize, tva.a_href], [], tvaEA.StillPictureFormat, errs, `${errCode}-12`);
			const childHref = StillPicture.attrAnyNsValueOrNull(tva.a_href);
			if (childHref)
				switch (childHref) {
					case mpeg7.JPEG_IMAGE_CS_VALUE:
						isJPEG = true;
						break;
					case mpeg7.PNG_IMAGE_CS_VALUE:
						isPNG = true;
						break;
					default:
						errs.addError(cg_InvalidHrefValue(childHref, StillPicture, `${RelatedMaterial.name}.${tva.e_Format}.${tva.e_StillPictureFormat}`, `${errCode}-13`));
				}
		});
	}

	checkTopElementsAndCardinality(MediaLocator, [{ name: tva.e_MediaUri }], tvaEC.MediaLocator, false, errs, `${errCode}-21`);

	let hasMediaURI = false;
	(MediaLocator as XmlElement).forEachNamedSubElement(tva.e_MediaUri, (MediaUri) => {
		hasMediaURI = true;
		checkAttributes(MediaUri, [tva.a_contentType], [], tvaEA.MediaUri, errs, `${errCode}-22`);
		const MediaUri_contentType = MediaUri.attrAnyNsValueOrNull(tva.a_contentType);
		if (MediaUri_contentType) {
			if (!isAllowedImageMime(MediaUri_contentType))
				errs.addError({
					code: `${errCode}-23`,
					message: `invalid ${tva.a_contentType.attribute(tva.e_MediaLocator)}=${MediaUri_contentType.quote()} specified for ${RelatedMaterial.name.elementize()} in ${location}`,
					fragment: MediaUri,
					key: "invalid format",
				});
			if (StillPictureFormat && ((isJPEGmime(MediaUri_contentType) && !isJPEG) || (isPNGmime(MediaUri_contentType) && !isPNG))) {
				errs.addError({
					code: `${errCode}-24`,
					message: `conflicting media types in ${tva.e_StillPictureFormat.elementize()} and ${tva.e_MediaUri.elementize()} for ${location}`,
					fragments: [StillPictureFormat, MediaUri],
					key: "invalid format",
				});
			}
		}
		if (!isHTTPURL(MediaUri.content))
			errs.addError({
				code: `${errCode}-25`,
				message: `${tva.e_MediaUri.elementize()}=${MediaUri.content.quote()} is not a valid Image URL`,
				key: keys.k_InvalidURL,
				fragment: MediaUri,
			});
	});
	const MediaLocator_contentLanguage = (MediaLocator as XmlElement).attrAnyNsValueOrNull(dvbi.a_contentLanguage)
	if (MediaLocator_contentLanguage) 
		checkLanguage(MediaLocator_contentLanguage, MediaLocator, errs, `${errCode}-27`);
	if (!hasMediaURI)
		errs.addError({
			code: `${errCode}-26`,
			message: `${tva.e_MediaUri.elementize()} not specified for ${tva.e_MediaLocator.elementize()} logo in ${location}`,
			fragment: MediaLocator,
			key: `no ${tva.e_MediaUri}`,
		});
}

/**
 * verifies if the specified RelatedMaterial contains a Promotional Still Image (per A177 clause 6.10.13). Only a single image is permitted and the format
 * specified in <MediaLocator><MediaURI> must match that specified in <Format>
 *
 * @param {XmlElement} RelatedMaterial   the <RelatedMaterial> element (a libxmls ojbect tree) to be checked
 * @param {String}     location          The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
 * @param {ErrorList}  errs              The class where errors and warnings relating to the serivce list processing are stored
 * @param {String}     errcode           Error code prefix for reporting
 */
export function ValidatePromotionalStillImage(RelatedMaterial : XmlElement, location : string, errs : ErrorList, errCode : string) {
	validateImageRelatedMaterial(RelatedMaterial, location, [tva.cs_PromotionalStillImage], errs, errCode);
}

/**
 * verifies if the images provided in <MediaLocator> elments are valid according to specification
 *
 * @param {XmlElement} RelatedMaterial    The <RelatedMaterial> element
 * @param {String}     location           The printable name used to indicate the location of the <RelatedMaterial> element being checked. used for error reporting
 * @param {ErrorList}  errs               The class where errors and warnings relating to the service list processing are stored
 * @param {String}     errCode            Error code prefix for reporting
 */
export function checkValidLogos(RelatedMaterial : XmlElement, location : string, errs : ErrorList, errCode : string) {
	if (!RelatedMaterial) return;

	let specifiedMediaTypes : Array<string> = [];
	RelatedMaterial.forEachNamedSubElement(tva.e_MediaLocator, (MediaLocator) => {
		checkTopElementsAndCardinality(MediaLocator, [{ name: tva.e_MediaUri }], tvaEC.MediaLocator, false, errs, `${errCode}-1`);
		checkAttributes(MediaLocator, [], [dvbi.a_contentLanguage], dvbiEA.MediaLocator, errs, `${errCode}-2`);

		const MediaLocator_language = MediaLocator.attrAnyNsValueOrNull(dvbi.a_contentLanguage);
		if (MediaLocator_language) checkLanguage(MediaLocator_language, MediaLocator, errs, `${errCode}-3`);
		MediaLocator.forEachNamedSubElement(tva.e_MediaUri, (MediaUri) => {
			checkAttributes(MediaUri, [tva.a_contentType], [], tvaEA.MediaUri, errs, `${errCode}-4`);
			const MediaURI_contentType = MediaUri.attrAnyNsValueOrNull(tva.a_contentType);
			if (MediaURI_contentType) {
				if (!isAllowedImageMime(MediaURI_contentType))
					errs.addError({
						code: `${errCode}-5`,
						type: WARNING,
						message: `non-standard ${tva.a_contentType.attribute()} ${MediaURI_contentType.quote()} specified for ${tva.e_RelatedMaterial.elementize()}${tva.e_MediaLocator.elementize()} in ${location}`,
						key: `non-standard ${tva.a_contentType.attribute(tva.e_MediaUri)}`,
						fragment: MediaUri,
					});
				specifiedMediaTypes.push(MediaURI_contentType);
			}
			if (!isHTTPURL(MediaUri.content) && !isInlineImage(MediaUri.content)) errs.addError(InvalidURL(MediaUri.content, MediaUri, tva.e_MediaUri.elementize(), `${errCode}-6`));
		});
	});

	if (specifiedMediaTypes.length != 0 && !validImageSet(specifiedMediaTypes)) {
		errs.addError({
			code: `${errCode}-7`,
			message: "A PNG or JPG image must be specified when other MIME types are used",
			key: "invalid image set",
			line: RelatedMaterial.line,
			description: "At least one image shall be provided with the Media Type image/jpeg or image/png for compatibility purposes",
		});
	}
}
