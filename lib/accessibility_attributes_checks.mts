/**
 * accessibility_attribites_checks.mts
 *
 * Checks the value space of the <AccessibilityAttributes> element against the rules and
 * values provided in DVB A177.
 */

//import type { XmlElement } from "../libxml2-wasm-extensions.d.ts";

//import { Array_extension_init } from "./Array-extensions.mts";
//Array_extension_init();

import { tva, tvaEA, tvaEC, BaseAccessibilityAttributesType } from "./TVA_definitions.mts";
import { dvbi } from "./DVB-I_definitions.mts";

import { keys } from "./common_errors.mts";
import ErrorList  from "./error_list.mts";
import { APPLICATION, WARNING } from "./error_list.mts";
import { checkAttributes, checkTopElementsAndCardinality } from "./schema_checks.mts";
import type { element_cardinality } from "./schema_checks.mts";
import { CS_URI_DELIMITER } from "./classification_scheme.mts";

import { isValidLangFormat } from "./IANA_languages.mts";

import IANAlanguages from "./IANA_languages.mts";
import ClassificationScheme from "./classification_scheme.mjs";
type classification_schemes = {
	AccessibilityPurposeCS : ClassificationScheme;
	VideoCodecCS : ClassificationScheme;
	AudioCodecCS : ClassificationScheme;
	SubtitleCarriageCS : ClassificationScheme;
	SubtitleCodingFormatCS : ClassificationScheme;
	SubtitlePurposeTypeCS : ClassificationScheme;
	KnownLanguages : IANAlanguages;
	AudioPresentationCS : ClassificationScheme;
};

export default function CheckAccessibilityAttributes(AccessibilityAttributes : XmlElement, cs : classification_schemes, errs : ErrorList, errCode : string) {
	if (!AccessibilityAttributes) {
		errs.addError({
			type: APPLICATION,
			code: "AA000",
			message: "CheckAccessibilityAttributes() called with AccessibilityAttributes==null",
		});
		return;
	}

	const accessibilityParent = AccessibilityAttributes.parent?.name || `${AccessibilityAttributes.name}-parent`;

	const mediaAccessibilityElements : Array<element_cardinality> = [
		{ name: tva.e_SubtitleAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_AudioDescriptionAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_SigningAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_DialogueEnhancementAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_SpokenSubtitlesAttributes, minOccurs: 0, maxOccurs: Infinity },
	];
	const applicationAccessibilityElement : Array<element_cardinality> = [
		{ name: tva.e_MagnificationUIAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_HighContrastUIAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_ScreenReaderAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_ResponseToUserActionAttributes, minOccurs: 0, maxOccurs: Infinity },
	];

	switch (accessibilityParent) {
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

	let checkPurpose = (elem : XmlElement, mainTerm : string, errNum : number) => {
		elem?.forEachNamedSubElement(tva.e_Purpose, (purpose : XmlElement) => {
			const purposeTerm = purpose.attrAnyNsValueOrNull(tva.a_href);
			if (purposeTerm) {
				if (!cs.AccessibilityPurposeCS.isIn(purposeTerm))
					errs.addError({
						code: `${errCode}-${errNum}a`,
						message: `"${purposeTerm}" is not a valid accessibility purpose`,
						fragment: purpose,
						key: keys.k_Accessibility,
					});
				const li = purposeTerm.lastIndexOf(CS_URI_DELIMITER);
				if (li != -1) {
					if (purposeTerm.charAt(li + 1) != mainTerm)
						errs.addError({
							code: `${errCode}-${errNum}b`,
							fragment: purpose,
							message: `"${purposeTerm}" is not valid for ${elem.name.elementize()}`,
							key: keys.k_Accessibility,
						});
				}
			}
		});
	};

	let checkAppInformation = (elem : XmlElement, errNum : number) : boolean => {
		const appInfo = elem.getAnyNs(tva.e_AppInformation);
		if (appInfo == null) return false; // AppInformation element is not present
		appInfo?.forEachNamedSubElement([tva.e_RequiredStandardVersion, tva.e_RequiredOptionalFeature], (child : XmlElement) => {
			switch (child.name) {
				case tva.e_RequiredStandardVersion:
					if (!dvbi.ApplicationStandards.includes(child.content))
						errs.addError({
							type: WARNING,
							code: `${errCode}-${errNum}a`,
							fragment: child,
							message: `"${child.content}" is not a known Standard Version`,
							key: keys.k_Accessibility,
						});
					break;
				case tva.e_RequiredOptionalFeature:
					if (!dvbi.ApplicationOptions.includes(child.content))
						errs.addError({
							type: WARNING,
							code: `${errCode}-${errNum}b`,
							fragment: child,
							message: `"${child.content}" is not a known Optional Feature`,
							key: keys.k_Accessibility,
						});
					break;
			}
		});
		return true; // AppInformation element is present
	};

	let checkCS = (elem : XmlElement, childName : string, cs : ClassificationScheme, errNum : number, storage? : Array<string>) : boolean => {
		let rc = true;
		elem?.forEachNamedSubElement(childName, (child : XmlElement) => {
			const href = child.attrAnyNsValueOrNull(tva.a_href);
			if (href && !cs.isIn(href)) {
				errs.addError({
					code: `${errCode}-${errNum}`,
					fragment: child,
					message: `"${href}" is not valid for ${child.name.elementize()} in ${elem.name.elementize()}`,
					key: keys.k_Accessibility,
				});
				rc = false;
			}
			if (storage && datatypeIs(storage, "array") && href) storage.push(href);
		});
		return rc;
	};

	let checkSignLanguage = (elem : XmlElement, childName : string, errNum : number) => {
		elem?.forEachNamedSubElement(childName, (child : XmlElement) => {
			const languageCode = child.content;
			if (cs.KnownLanguages.checkSignLanguage(languageCode) != cs.KnownLanguages.languageKnown)
				errs.addError({
					code: `${errCode}-${errNum}b`,
					fragment: child,
					message: `${languageCode.quote()} is not a valid sign language for ${child.name.elementize()} in ${elem.name.elementize()}`,
					key: keys.k_Accessibility,
					description: `language used for ${child.name.elementize()}} must be a sign language in the IANA language-subtag-registry`,
				});
		});
	};

	let checkLanguageFmt = (elem : XmlElement, childName : string, errNum : string) => {
		elem?.forEachNamedSubElement(childName, (child : XmlElement) => {
			if (!isValidLangFormat(child.content))
				errs.addError({
					code: `${errCode}-${errNum}a`,
					key: "invalid lang format",
					fragment: child,
					message: `xml:${tva.a_lang} value ${child.content.quote()} does not match format for Language-Tag in BCP47`,
				});
		});
	};

	let checkLanguagePurpose = (elem : XmlElement, childName : string, errNum : string) => {
		elem?.forEachNamedSubElement(childName, (child : XmlElement) => {
			// @purpose should not be specified for <AudioLanguage> when used in <AccessibilityAttributes>
			if (child.attrAnyNs(tva.a_purpose))
				errs.addError({
					code: `${errCode}-${errNum}1`,
					fragment: child,
					message: `${tva.a_purpose.attribute(child.name)} should not be specified for ${tva.e_AccessibilityAttributes.elementize()}`,
					key: keys.k_Accessibility,
					clause: "A177 table 56 (clause 6.10.10)",
				});
			checkAttributes(child, [], [], tvaEA.AudioLanguage, errs, `${errNum}2`);
		});
	};

	let checkAudioAttributes = (elem : XmlElement, childName : string, errNum : number, allowPurpose : boolean = false, disallowClause? : string) => {
		elem?.forEachNamedSubElement(childName, (child : XmlElement) => {
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
			checkLanguageFmt(child, tva.e_AudioLanguage, `${errNum}b`);
			checkLanguagePurpose(child, tva.e_AudioLanguage, `${errNum}c`);
			child?.forEachNamedSubElement([tva.e_Coding, tva.e_MixType], (child2 : XmlElement) => {
				const href = child2.attrAnyNsValueOrNull(tva.a_href);
				switch (child2.name) {
					case tva.e_Coding:
						// AccessibilityAttributes.*.AudioAttribites.Coding
						if (href && !cs.AudioCodecCS.isIn(href))
							errs.addError({
								code: `${errCode}-${errNum}d`,
								fragment: child2,
								message: `"${href}" is not valid for ${elem.name.elementize()}${child.name.elementize()}${child2.name.elementize()}`,
								key: keys.k_Accessibility,
							});
						break;
					case tva.e_MixType:
						// AccessibilityAttributes.*.AudioAttribites.MixType
						if (href && !cs.AudioPresentationCS.isIn(href))
							errs.addError({
								code: `${errCode}-${errNum}e`,
								fragment: child2,
								message: `"${href}" is not valid for ${elem.name.elementize()}${child.name.elementize()}${child2.name.elementize()}`,
								key: keys.k_Accessibility,
							});
						break;
					case tva.e_AudioLanguage:
						if (child2.attrAnyNs(tva.a_purpose) && allowPurpose == false) {
							errs.addError({
								code: `${errCode}-${errNum}f`,
								fragment: child2,
								message: `"${tva.a_purpose.attribute(child2.name)}" is not permitted for ${elem.name.elementize()}${child.name.elementize()}`,
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

	const appInformationElements : Array<element_cardinality> = [
		{ name: tva.e_AppInformation, minOccurs: 0 },
		{ name: tva.e_Personalisation, minOccurs: 0 },
	];
	const baseAppChildren : Array<element_cardinality> = [{ name: tva.e_Purpose, maxOccurs: Infinity }];
	const allowedAppChildren = baseAppChildren.concat(appInformationElements);
	const allAppChildren = [tva.e_Purpose].concat(BaseAccessibilityAttributesType);

	let carriages : Array<string> = [],
		codings : Array<string> = [],
		hasAppInformation = false;
	AccessibilityAttributes?.forEachSubElement((child : XmlElement) => {
		switch (child.name) {
			case tva.e_MagnificationUIAttributes:
				checkTopElementsAndCardinality(child, allowedAppChildren, allAppChildren, false, errs, `${errCode}-11`);
				checkAppInformation(child, 12);
				checkPurpose(child, "1", 13);
				break;
			case tva.e_HighContrastUIAttributes:
				checkTopElementsAndCardinality(child, allowedAppChildren, allAppChildren, false, errs, `${errCode}-21`);
				checkAppInformation(child, 22);
				checkPurpose(child, "2", 23);
				break;
			case tva.e_ScreenReaderAttributes:
				/* eslint-disable no-case-declarations*/
				const base1 : Array<element_cardinality> = [{ name: tva.e_ScreenReaderLanguage, minOccurs: 0, maxOccurs: Infinity }];
				const ScreenReaderChildElements = base1.concat(allowedAppChildren);
				/* eslint-enable */
				checkTopElementsAndCardinality(child, ScreenReaderChildElements, tvaEC.ScreenReaderAttributes, false, errs, `${errCode}-31`);
				checkAppInformation(child, 32);
				checkPurpose(child, "3", 33);
				checkLanguageFmt(child, tva.e_ScreenReaderLanguage, "34");
				break;
			case tva.e_ResponseToUserActionAttributes:
				checkTopElementsAndCardinality(child, allowedAppChildren, allAppChildren, false, errs, `${errCode}-41`);
				checkAppInformation(child, 42);
				checkPurpose(child, "4", 43);
				break;
			case tva.e_SubtitleAttributes:
				/* eslint-disable no-case-declarations*/
				const base2 : Array<element_cardinality> = [
						{ name: tva.e_Carriage },
						{ name: tva.e_Coding, maxOccurs: Infinity },
						{ name: tva.e_SubtitleLanguage },
						{ name: tva.e_Purpose, minOccurs: 0, maxOccurs: Infinity },
						{ name: tva.e_SuitableForTTS },
					];
				const SubtitleAttributeElements = base2.concat(appInformationElements);
				/* eslint-enable */
				checkTopElementsAndCardinality(
					child,
					SubtitleAttributeElements,
					tvaEC.SubtitleAttributes,
					false,
					errs,
					`${errCode}-51`
				);
				hasAppInformation = checkAppInformation(child, 52);
				checkCS(child, tva.e_Carriage, cs.SubtitleCarriageCS, 53, carriages);
				checkCS(child, tva.e_Coding, cs.SubtitleCodingFormatCS, 54, codings);
				checkLanguageFmt(child, tva.e_SubtitleLanguage, "55");
				checkCS(child, tva.e_Purpose, cs.SubtitlePurposeTypeCS, 56);
				break;
			case tva.e_AudioDescriptionAttributes:
				checkTopElementsAndCardinality(
					child,
					[{ name: tva.e_AudioAttributes }, { name: tva.e_ReceiverMix, minOccurs: 0 }].concat(appInformationElements),
					tvaEC.AudioDescriptionAttributes,
					false,
					errs,
					`${errCode}-61`
				);
				checkAppInformation(child, 62);
				checkAudioAttributes(child, tva.e_AudioAttributes, 63, false, "A177 clause 4.5.2.3");
				break;
			case tva.e_SigningAttributes:
				checkTopElementsAndCardinality(
					child,
					[{ name: tva.e_Coding }, { name: tva.e_SignLanguage, minOccurs: 0 }, { name: tva.e_Closed, minOccurs: 0 }].concat(appInformationElements),
					tvaEC.SigningAttributes,
					false,
					errs,
					`${errCode}-71`
				);
				checkAppInformation(child, 72);
				if (!checkCS(child, tva.e_Coding, cs.VideoCodecCS, 73))
					errs.errorDescription({ code: `${errCode}-73`, description: `value for ${tva.e_Coding.elementize()} is not taken from the VideoCodecCS` });
				checkSignLanguage(child, tva.e_SignLanguage, 74);
				break;
			case tva.e_DialogueEnhancementAttributes:
				checkTopElementsAndCardinality(child, [{ name: tva.e_AudioAttributes }].concat(appInformationElements), tvaEC.DialogEnhancementAttributes, false, errs, `${errCode}-81`);
				checkAppInformation(child, 82);
				checkAudioAttributes(child, tva.e_AudioAttributes, 83, false, "A177 clause 4.5.2.5");
				break;
			case tva.e_SpokenSubtitlesAttributes:
				checkTopElementsAndCardinality(child, [{ name: tva.e_AudioAttributes }].concat(appInformationElements), tvaEC.SpokenSubtitlesAttributes, false, errs, `${errCode}-91`);
				checkAppInformation(child, 92);
				checkAudioAttributes(child, tva.e_AudioAttributes, 93, false, "A177 clause 4.5.2.6");
				break;
		}
	});
	if (carriages.includes(tva.APPLICATION_SUBTITLE_CARRIAGE) && codings.includes(tva.APPLICATION_SUBTITLE_CODING)) {
		// A177r6 clause 4.5.2.3 - When the SubtitlesAttributes.Carriage element is set to “Application Subtitles” and/or the
		// SubtitlesAttributes.Coding element is set to “Application - defined Subtitle Format”, the SubtitlesAttributes.AppInformation
		// should be defined, as subtitle availability depends on whether the application is supported by the DVB - I client.
		if (!hasAppInformation) {
			errs.addError({
				code: `${errCode}-99`,
				fragment: AccessibilityAttributes,
				message: `${tva.e_AppInformation.elementize()} must be provided for application defined subtitles`,
				key: keys.k_Accessibility,
			});
		}
	}
}
