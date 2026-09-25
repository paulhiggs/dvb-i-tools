/**
 * accessibility_attributes_checks.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Checks the value space of the <AccessibilityAttributes> element against the rules and
 * values provided in DVB A177.
 */

import { datatypeIs, parameterCheck } from "./utils.mts"

import { tva, tvaEA, tvaEC, BaseAccessibilityAttributesType } from "./TVA_definitions.mts"
import { dvbi, cgVersions } from "./DVB-I_definitions.mts"

import { keys } from "./common_errors.mts"

import { checkAttributes, checkTopElementsAndCardinality } from "./schema_checks.mts"
import type { ElementCardinalityType } from "./schema_checks.mts"
import { CS_URI_DELIMITER } from "./classification_scheme.mts"
import { CG_SchemaVersion } from "./cg_check.mts"

import IANAlanguages, { ValidateLanguage } from "./IANA_languages.mts"
import { APPLICATION, WARNING } from "./error_list.mts"
import ErrorList from "./error_list.mts"
import ClassificationScheme from "./classification_scheme.mts"


const mediaAccessibilityElements: ElementCardinalityType[] = [
	{ name: tva.e_SubtitleAttributes, minOccurs: 0, maxOccurs: Infinity },
	{ name: tva.e_AudioDescriptionAttributes, minOccurs: 0, maxOccurs: Infinity },
	{ name: tva.e_SigningAttributes, minOccurs: 0, maxOccurs: Infinity },
	{ name: tva.e_DialogueEnhancementAttributes, minOccurs: 0, maxOccurs: Infinity },
	{ name: tva.e_SpokenSubtitlesAttributes, minOccurs: 0, maxOccurs: Infinity },
];
const applicationAccessibilityElement: ElementCardinalityType[] = [
	{ name: tva.e_MagnificationUIAttributes, minOccurs: 0, maxOccurs: Infinity },
	{ name: tva.e_HighContrastUIAttributes, minOccurs: 0, maxOccurs: Infinity },
	{ name: tva.e_ScreenReaderAttributes, minOccurs: 0, maxOccurs: Infinity },
	{ name: tva.e_ResponseToUserActionAttributes, minOccurs: 0, maxOccurs: Infinity },
];

const checkPurpose = (elem: XmlElement, mainTerm: string, cs: ClassificationScheme, errs: ErrorList, errCode: string, errNum: number) => {
	elem?.forEachNamedChildElement(tva.e_Purpose, (purpose: XmlElement) => {
		const purposeTerm = purpose.attrAnyNsValueOr(tva.a_href);
		if (purposeTerm) {
			if (!cs.isLeaf(purposeTerm))
				errs.addError({
					code: `${errCode}-${errNum}a`,
					message: `${purposeTerm.quote()} is not a valid accessibility purpose`,
					fragment: purpose,
					key: keys.k_Accessibility,
				});
			const li = purposeTerm.lastIndexOf(CS_URI_DELIMITER);
			if (li != -1) {
				if (purposeTerm.charAt(li + 1) != mainTerm)
					errs.addError({
						code: `${errCode}-${errNum}b`,
						fragment: purpose,
						message: `${purposeTerm.quote()} is not valid for ${elem.name.elementize()}`,
						key: keys.k_Accessibility,
					});
			}
		}
	});
};

const checkAppInformation = (elem: XmlElement, errs: ErrorList, errCode: string, errNum: number) => {
	const appInfo = elem.getAnyNs(tva.e_AppInformation);
	if (appInfo == null) return false; // AppInformation element is not present
	appInfo?.forEachNamedChildElement([tva.e_RequiredStandardVersion, tva.e_RequiredOptionalFeature], (child: XmlElement) => {
		switch (child.name) {
			case tva.e_RequiredStandardVersion:
				if (!(dvbi.ApplicationStandards as string[]).includes(child.content))
					errs.addError({
						type: WARNING,
						code: `${errCode}-${errNum}a`,
						fragment: child,
						message: `${child.content.quote()} is not a known Standard Version`,
						key: keys.k_Accessibility,
					});
				break;
			case tva.e_RequiredOptionalFeature:
				if (!(dvbi.ApplicationOptions as string[]).includes(child.content))
					errs.addError({
						type: WARNING,
						code: `${errCode}-${errNum}b`,
						fragment: child,
						message: `${child.content.quote()} is not a known Optional Feature`,
						key: keys.k_Accessibility,
					});
				break;
		}
	});
	return true; // AppInformation element is present
};

const checkCS = (elem: XmlElement, childName: string, cs: ClassificationScheme, leafsOnly: boolean, errs: ErrorList, errCode: string, errNum: number, storage: string[] | null = null): boolean => {
	let rc = true;
	elem?.forEachNamedChildElement(childName, (child) => {
		const href = child.attrAnyNsValueOr(tva.a_href);
		if (href && (leafsOnly ? !cs.isLeaf(href) : !cs.has(href))) {
			errs.addError({
				code: `${errCode}-${errNum}`,
				fragment: child,
				message: `${href.quote()} is not valid for ${child.name.elementize()} in ${elem.name.elementize()}`,
				key: keys.k_Accessibility,
			});
			rc = false;
		}
		if (storage && datatypeIs(storage, "array") && href) storage.push(href);
	});
	return rc;
};

const checkSignLanguage = (elem: XmlElement, childName: string, cs: IANAlanguages, errs: ErrorList, errCode: string, errNum: number): void => {
	elem?.forEachNamedChildElement(childName, (child) => {
		const languageCode = child.content;
		if (cs.checkSignLanguage(languageCode) != cs.languageKnown)
			errs.addError({
				code: `${errCode}-${errNum}b`,
				fragment: child,
				message: `${languageCode.quote()} is not a valid sign language for ${child.name.elementize()} in ${elem.name.elementize()}`,
				key: keys.k_Accessibility,
				description: `language used for ${child.name.elementize()}} must be a sign language in the IANA language-subtag-registry`,
			});
	});
};

const checkLanguageFmt = (elem: XmlElement, childName: string, errs: ErrorList, errCode: string, errNum: number | string) => {
	elem?.forEachNamedChildElement(childName, (child) => {
		ValidateLanguage(child.content, errs, `${errCode}-${errNum}`, child.line);
	});
};

const checkLanguageAttributes = (elem: XmlElement, childName: string, errs: ErrorList, errCode: string, errNum: string) => {
	elem?.forEachNamedChildElement(childName, (child) => {
		checkAttributes(child, [], [], tvaEA.AudioLanguage, errs, `${errCode}-${errNum}`);
		if (child.attrAnyNs(tva.a_purpose)) 
			errs.errorDescription({
				code: `${errCode}-${errNum}`,
				clause: "A177 table 56 (clause 6.10.10)",
				description: "The @purpose attribute shall not be used when signalling the audio language of an accessibility feature."
			});
	});
};

const checkAudioAttributes = (elem: XmlElement, childName: string, csCodec: ClassificationScheme, csPresentation: ClassificationScheme, errs: ErrorList, errCode: string, errNum: number, allowPurpose: boolean = false, disallowClause: string | null = null) => {
	elem?.forEachNamedChildElement(childName, (child) => {
		checkTopElementsAndCardinality(
			child,
			[
				{ name: tva.e_Coding, minOccurs: 0 },
				{ name: tva.e_MixType, minOccurs: 0 },
				{ name: tva.e_AudioLanguage, minOccurs: 0 },
			],
			tvaEC.AudioAttributes,
			false,
			errs,
			`${errCode}-${errNum}a`
		);
		// AccessibilityAttributes.*.AudioAttribites.AudioLanguage
		checkLanguageFmt(child, tva.e_AudioLanguage, errs, errCode, `${errNum}b`);
		checkLanguageAttributes(child, tva.e_AudioLanguage, errs, errCode, `${errNum}c`);
		child?.forEachNamedChildElement([tva.e_Coding, tva.e_MixType], (child2) => {
			const href = child2.attrAnyNsValueOr(tva.a_href);
			switch (child2.name) {
				case tva.e_Coding:
					// AccessibilityAttributes.*.AudioAttribites.Coding
					if (href && !csCodec.isLeaf(href))
						errs.addError({
							code: `${errCode}-${errNum}d`,
							fragment: child2,
							message: `${href.quote()} is not valid for ${elem.name.elementize()}${child.name.elementize()}${child2.name.elementize()}`,
							key: keys.k_Accessibility,
						});
					break;
				case tva.e_MixType:
					// AccessibilityAttributes.*.AudioAttribites.MixType
					if (href && !csPresentation.has(href))
						errs.addError({
							code: `${errCode}-${errNum}e`,
							fragment: child2,
							message: `${href.quote()} is not valid for ${elem.name.elementize()}${child.name.elementize()}${child2.name.elementize()}`,
							key: keys.k_Accessibility,
						});
					break;
				case tva.e_AudioLanguage:
					if (child2.attrAnyNs(tva.a_purpose) && allowPurpose == false) {
						errs.addError({
							code: `${errCode}-${errNum}f`,
							fragment: child2,
							message: `${tva.a_purpose.attribute(child2.name).quote()} is not permitted for ${elem.name.elementize()}${child.name.elementize()}`,
							key: keys.k_Accessibility,
						});
						if (disallowClause) {
							errs.errorDescription({
								code: `${errCode}-${errNum}f`,
								clause: disallowClause,
								description: "The @purpose attribute of the AudioAttributes.AudioLanguage element shall not be used.",
							})
						}
					}
					break;
			}
		});
	});
};

/**
 * validate TV Anytime <AccessibilityAttribites> element according to DVB A177
 * 
 * @param {XmlElement} AccessibilityAttributes  the <AccessibilityAttribitues> element to check
 * @param {*} cs                                a set of classification schemes for value checks
 * @param {ErrorList} errs                      the class where errors and warnings relating to the service list processing are stored
 * @param {string} errCode                      the prefix to use for any errors found
 * 
 * cs contains relevant classification schemes and validators in its properties
 *   cs.AccessibilityPurposeCS
 *   cs.VideoCodecCS
 *   cs.AudioCodecCS
 *   cs.SubtitleCarriageCS
 *   cs.SubtitleCodingFormatCS 
 *   cs.SubtitlePurposeTypeCS 
 *   cs.AudioPresentationCS 
 *   cs.KnownLanguages 
 */

export type AccessibilityRequiredSchemes = {
	AccessibilityPurposeCS: ClassificationScheme
	VideoCodecCS: ClassificationScheme
	AudioCodecCS: ClassificationScheme
	SubtitleCarriageCS: ClassificationScheme
	SubtitleCodingFormatCS: ClassificationScheme
	SubtitlePurposeTypeCS: ClassificationScheme
	AudioPresentationCS: ClassificationScheme
	KnownLanguages: IANAlanguages
}

export default function CheckAccessibilityAttributes(AccessibilityAttributes: XmlElement, cs: AccessibilityRequiredSchemes, errs: ErrorList, errCode: string) {
	if (!parameterCheck("CheckAccessibilityAttributes", AccessibilityAttributes, null, errs, "AA000")) return;

	switch (AccessibilityAttributes.parent?.name) {
		case tva.e_RelatedMaterial:
			checkTopElementsAndCardinality(
				AccessibilityAttributes,
				mediaAccessibilityElements.concat(applicationAccessibilityElement),
				tvaEC.AccessibilityAttributes,
				false,
				errs,
				`${errCode}-1`
			);
			break;
		case tva.e_AVAttributes:
			// AccessibilityAttributes in a Content Guide <AVAttributes> element
			checkTopElementsAndCardinality(AccessibilityAttributes, mediaAccessibilityElements, tvaEC.AccessibilityAttributes, false, errs, `${errCode}-2`);
			break;
		case dvbi.e_ContentAttributes:
			// AccessibilityAttributes in a Service List <ContentAttributes> element
			checkTopElementsAndCardinality(AccessibilityAttributes, mediaAccessibilityElements, tvaEC.AccessibilityAttributes, false, errs, `${errCode}-3`);
			break;
		default:
			errs.addError({
				type: APPLICATION,
				code: "AA001",
				message: `Invalid parent element for ${tva.e_AccessibilityAttributes}`,
				key: keys.k_Accessibility,
			});
			return;
	}

	const appInformationElements: ElementCardinalityType[] = [
		{ name: tva.e_AppInformation, minOccurs: 0 },
		{ name: tva.e_Personalisation, minOccurs: 0 },
	];
//	const allowedAppChildren: ElementCardinalityType[] = [{ name: tva.e_Purpose, maxOccurs: Infinity }].concat(appInformationElements);
	const allowedAppChildren: ElementCardinalityType[] = appInformationElements.concat({ name: tva.e_Purpose, maxOccurs: Infinity });
	const allAppChildren: string[] = [tva.e_Purpose].concat(BaseAccessibilityAttributesType);

	AccessibilityAttributes?.forEachChildElement((child: XmlElement) => {
		switch (child.name) {
			case tva.e_MagnificationUIAttributes:
				checkTopElementsAndCardinality(child, allowedAppChildren, allAppChildren, false, errs, `${errCode}-11`);
				checkAppInformation(child, errs, errCode, 12);
				checkPurpose(child, "1", cs.AccessibilityPurposeCS, errs, errCode, 13);
				break;
			case tva.e_HighContrastUIAttributes:
				checkTopElementsAndCardinality(child, allowedAppChildren, allAppChildren, false, errs, `${errCode}-21`);
				checkAppInformation(child, errs, errCode, 22);
				checkPurpose(child, "2", cs.AccessibilityPurposeCS, errs, errCode, 23);
				break;
			case tva.e_ScreenReaderAttributes:
				// eslint-disable-next-line no-case-declarations
				const ScreenReaderChildElements = allowedAppChildren.concat({ name: tva.e_ScreenReaderLanguage, minOccurs: 0, maxOccurs: Infinity });
				checkTopElementsAndCardinality(child, ScreenReaderChildElements, tvaEC.ScreenReaderAttributes, false, errs, `${errCode}-31`);
				checkAppInformation(child, errs, errCode, 32);
				checkPurpose(child, "3", cs.AccessibilityPurposeCS, errs, errCode, 33);
				checkLanguageFmt(child, tva.e_ScreenReaderLanguage, errs, errCode, 34);
				break;
			case tva.e_ResponseToUserActionAttributes:
				checkTopElementsAndCardinality(child, allowedAppChildren, allAppChildren, false, errs, `${errCode}-41`);
				checkAppInformation(child, errs, errCode, 42);
				checkPurpose(child, "4", cs.AccessibilityPurposeCS, errs, errCode, 43);
				break;
			case tva.e_SubtitleAttributes:
				// eslint-disable-next-line no-case-declarations
				const carriages: string[] = [],	codings: string[] = [];
				checkTopElementsAndCardinality(
					child,
					appInformationElements.concat([
						{ name: tva.e_Carriage },
						{ name: tva.e_Coding, maxOccurs: Infinity },
						{ name: tva.e_SubtitleLanguage },
						{ name: tva.e_Purpose, minOccurs: 0, maxOccurs: Infinity },
						CG_SchemaVersion(child.documentNamespace()) < cgVersions.r3 
							? { name: tva.e_SuitableForTTS } : { name: tva.e_SuitableForTTS, minOccurs: 0 },
					]),
					tvaEC.SubtitleAttributes,
					false,
					errs,
					`${errCode}-51`
				);
				// eslint-disable-next-line no-case-declarations
				const hasAppInformation = checkAppInformation(child, errs, errCode, 52);
				checkCS(child, tva.e_Carriage, cs.SubtitleCarriageCS, false, errs, errCode, 53, carriages);
				checkCS(child, tva.e_Coding, cs.SubtitleCodingFormatCS, false, errs, errCode, 54, codings);
				checkLanguageFmt(child, tva.e_SubtitleLanguage, errs, errCode, 55);
				checkCS(child, tva.e_Purpose, cs.SubtitlePurposeTypeCS, false, errs, errCode, 56);
				if (carriages.includes(tva.APPLICATION_SUBTITLE_CARRIAGE) || codings.includes(tva.APPLICATION_SUBTITLE_CODING)) {
					// A177r6 clause 4.5.2.3 - When the SubtitlesAttributes.Carriage element is set to “Application Subtitles” and/or the
					// SubtitlesAttributes.Coding element is set to “Application - defined Subtitle Format”, the SubtitlesAttributes.AppInformation
					// should be defined, as subtitle availability depends on whether the application is supported by the DVB - I client.
					if (!hasAppInformation) {
						errs.addError({
							code: `${errCode}-59`,
							fragment: child,
							message: `${tva.e_AppInformation.elementize()} must be provided for application defined subtitles`,
							key: keys.k_Accessibility,
							clause: "A177 clause 4.5.2.3",
							description: `When the SubtitlesAttributes.Carriage element is set to "Application Subtitles" and/or the SubtitlesAttributes.Coding element is set to "Application - defined Subtitle Format", the SubtitlesAttributes.AppInformation should be defined, as subtitle availability depends on whether the application is supported by the DVB - I client.`
						});
					}
				}
				break;
			case tva.e_AudioDescriptionAttributes:
				checkTopElementsAndCardinality(
					child,
					appInformationElements.concat([{ name: tva.e_AudioAttributes }, { name: tva.e_ReceiverMix, minOccurs: 0 }]),
					tvaEC.AudioDescriptionAttributes,
					false,
					errs,
					`${errCode}-61`
				);
				checkAppInformation(child, errs, errCode, 62);
				checkAudioAttributes(child, tva.e_AudioAttributes, cs.AudioCodecCS, cs.AudioPresentationCS , errs, errCode, 63, false, "A177 clause 4.5.2.4");
				break;
			case tva.e_SigningAttributes:
				checkTopElementsAndCardinality(
					child,
					appInformationElements.concat([
						{ name: tva.e_Coding, minOccurs: 0 }, 
						{ name: tva.e_SignLanguage, minOccurs: 0 }, 
						{ name: tva.e_Closed, minOccurs: 0 }
					]),
					tvaEC.SigningAttributes,
					false,
					errs,
					`${errCode}-71`
				);
				checkAppInformation(child, errs, errCode, 72);
				if (child.hasChild(tva.e_Coding)) {
					if (!checkCS(child, tva.e_Coding, cs.VideoCodecCS, true, errs, errCode, 73))
						errs.errorDescription({ code: `${errCode}-73`, description: `value for ${tva.e_Coding.elementize()} is not taken from the VideoCodecCS` });
					const AVparent = AccessibilityAttributes.parent;
					const Signing_closed = child.getAnyNs(tva.e_Closed);
					const ClosedSigning = Signing_closed ? Signing_closed.content : "false";
					if (AVparent && (AVparent as XmlElement).hasChild(tva.e_VideoAttributes) && ClosedSigning == "false") {
						// Bugzilla 3387: warn if differnet coding values specified for video and burned in signer
						const Signer_format = child.getAnyNs(tva.e_Coding)?.attrAnyNsValueOr(tva.a_href);
						const Video_format = (AVparent as XmlElement).getAnyNs(tva.e_VideoAttributes)?.getAnyNs(tva.e_Coding)?.attrAnyNsValueOr(tva.a_href);
						if (Signer_format && Video_format && Signer_format != Video_format) {
							const frags = [child.getAnyNs(tva.e_Coding)];
							const vidAttributes = (AVparent as XmlElement).getAnyNs(tva.e_VideoAttributes);
							if (vidAttributes && vidAttributes.getAnyNs(tva.e_Coding))
								frags.push(vidAttributes.getAnyNs(tva.e_Coding))
							errs.addError({
								type: WARNING,
								code: `${errCode}-74`,
								key: keys.k_Accessibility,
								message: `For open signing, same video format shoud be used for ${tva.e_VideoAttributes.elementize()} and ${tva.e_SigningAttributes.elementize()}`,
								fragments: frags as XmlElement[],
							});
						}
					}
				}
				checkSignLanguage(child, tva.e_SignLanguage, cs.KnownLanguages, errs, errCode, 75);
				break;
			case tva.e_DialogueEnhancementAttributes:
				checkTopElementsAndCardinality(child, 
					appInformationElements.concat([{ name: tva.e_AudioAttributes }]), 
					tvaEC.DialogEnhancementAttributes, false, errs, `${errCode}-81`);
				checkAppInformation(child,errs, errCode,  82);
				checkAudioAttributes(child, tva.e_AudioAttributes, cs.AudioCodecCS, cs.AudioPresentationCS, errs, errCode, 83, false, "A177 clause 4.5.2.5");
				break;
			case tva.e_SpokenSubtitlesAttributes:
				checkTopElementsAndCardinality(child, 
					appInformationElements.concat([{ name: tva.e_AudioAttributes }]), 
					tvaEC.SpokenSubtitlesAttributes, false, errs, `${errCode}-91`);
				checkAppInformation(child, errs, errCode, 92);
				checkAudioAttributes(child, tva.e_AudioAttributes, cs.AudioCodecCS, cs.AudioPresentationCS, errs, errCode, 93, false, "A177 clause 4.5.2.6");
				break;
		}
	});
}
