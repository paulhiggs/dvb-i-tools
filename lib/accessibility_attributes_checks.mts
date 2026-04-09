/**
 * accessibility_attribites_checks.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Checks the value space of the <AccessibilityAttributes> element against the rules and
 * values provided in DVB A177.
 */

import { XmlElement } from "libxml2-wasm";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import{ countChildElements, documentNamespace, forEachNamedChildElement, forEachChildElement, hasChildren, hasChild, getAnyNs, attrAnyNsValueOrNull, attrAnyNsValueOr, attrAnyNs, doc_forEachNamedChildElement, doc_forEachChildElement, doc_hasChildren } from "../libxml2-wasm-extensions.mts";

import { datatypeIs, parameterCheck } from "./utils.mts";

import { tva, tvaEA, tvaEC, BaseAccessibilityAttributesType} from "./TVA_definitions.mts";
import { dvbi } from "./DVB-I_definitions.mts";

import { keys } from "./common_errors.mts";
import ErrorList, { APPLICATION, WARNING } from "./error_list.mts";
import { checkAttributes, checkTopElementsAndCardinality } from "./schema_checks.mts";
import type { ChildElement_type } from "./schema_checks.mts";
import ClassificationScheme, { CS_URI_DELIMITER } from "./classification_scheme.mts";

import IANALanguages, { isValidLangFormat } from "./IANA_languages.mts";

type ClassificationSchemes = {
	AccessibilityPurposeCS?: ClassificationScheme;
	VideoCodecCS?: ClassificationScheme;
	AudioCodecCS?: ClassificationScheme;
	SubtitleCarriageCS?: ClassificationScheme;
	SubtitleCodingFormatCS?: ClassificationScheme;
	SubtitlePurposeTypeCS?: ClassificationScheme;
	KnownLanguages?: IANALanguages;
	AudioPresentationCS?: ClassificationScheme;
};

export default function CheckAccessibilityAttributes(AccessibilityAttributes : XmlElement, cs : ClassificationSchemes, errs: ErrorList, errCode: string) {
	if (!parameterCheck("CheckAccessibilityAttributes", AccessibilityAttributes, undefined, errs, "AA000")) return;

	const accessibilityParent = AccessibilityAttributes.parent?.name;

	const mediaAccessibilityElements = [
		{ name: tva.e_SubtitleAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_AudioDescriptionAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_SigningAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_DialogueEnhancementAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_SpokenSubtitlesAttributes, minOccurs: 0, maxOccurs: Infinity },
	];
	const applicationAccessibilityElement = [
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

	const checkPurpose = (elem: XmlElement, mainTerm: string, errNum: number) => {
		forEachNamedChildElement(elem, tva.e_Purpose, (purpose) => {
			const purposeTerm = attrAnyNsValueOrNull(purpose, tva.a_href);
			if (purposeTerm) {
				if (cs.AccessibilityPurposeCS && !cs.AccessibilityPurposeCS.isLeaf(purposeTerm))
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

	const checkAppInformation = (elem : XmlElement, errNum : number) => {
		const appInfo = getAnyNs(elem,tva.e_AppInformation);
		if (appInfo == null) return false; // AppInformation element is not present
		forEachNamedChildElement(appInfo, [tva.e_RequiredStandardVersion, tva.e_RequiredOptionalFeature], (child) => {
			switch (child.name) {
				case tva.e_RequiredStandardVersion:
					if (!dvbi.ApplicationStandards.includes(child.content))
						errs.addError({
							type: WARNING,
							code: `${errCode}-${errNum}a`,
							fragment: child,
							message: `${child.content.quote()} is not a known Standard Version`,
							key: keys.k_Accessibility,
						});
					break;
				case tva.e_RequiredOptionalFeature:
					if (!dvbi.ApplicationOptions.includes(child.content))
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

	const checkCS = (elem : XmlElement, childName: string, cs: ClassificationScheme, leafsOnly: boolean, errNum: number, storage?: string[]) => {
		let rc = true;
		forEachNamedChildElement(elem, childName, (child) => {
			const href = attrAnyNsValueOrNull(child, tva.a_href);
			if (href && (leafsOnly ? !cs.isLeaf(href) :!cs.isIn(href))) {
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

	 const checkSignLanguage = (elem : XmlElement, childName: string, errNum: number) => {
		forEachNamedChildElement(elem, childName, (child) => {
			const languageCode = child.content;
			if (cs.KnownLanguages && cs.KnownLanguages.checkSignLanguage(languageCode) != cs.KnownLanguages.languageKnown)
				errs.addError({
					code: `${errCode}-${errNum}b`,
					fragment: child,
					message: `${languageCode.quote()} is not a valid sign language for ${child.name.elementize()} in ${elem.name.elementize()}`,
					key: keys.k_Accessibility,
					description: `language used for ${child.name.elementize()} must be a sign language in the IANA language-subtag-registry`,
				});
		});
	};

	const checkLanguageFmt = (elem : XmlElement, childName: string, errNum: string | number) => {
		forEachNamedChildElement(elem, childName, (child) => {
			if (!isValidLangFormat(child.content))
				errs.addError({
					code: `${errCode}-${errNum}a`,
					key: "invalid lang format",
					fragment: child,
					message: `xml:${tva.a_lang} value ${child.content.quote()} does not match format for Language-Tag in BCP47`,
				});
		});
	};

	const checkLanguagePurpose = (elem : XmlElement, childName: string, errNum: string) => {
		forEachNamedChildElement(elem, childName, (child) => {
			// @purpose should not be specified for <AudioLanguage> when used in <AccessibilityAttributes>
			if (attrAnyNs(child, tva.a_purpose))
				errs.addError({
					code: `${errNum}1`,
					fragment: child,
					message: `${tva.a_purpose.attribute(child.name)} should not be specified for ${tva.e_AccessibilityAttributes.elementize()}`,
					key: keys.k_Accessibility,
					clause: "A177 table 56 (clause 6.10.10)",
				});
			checkAttributes(child, [], [], tvaEA.AudioLanguage, errs, `${errNum}2`);
		});
	};

	const checkAudioAttributes = (elem : XmlElement, childName: string, errNum: number, allowPurpose = false, disallowClause? : string) => {
		forEachNamedChildElement(elem, childName, (child) => {
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
			checkLanguageFmt(child, tva.e_AudioLanguage, `${errCode}-${errNum}b`);
			checkLanguagePurpose(child, tva.e_AudioLanguage, `${errCode}-${errNum}c`);
			forEachNamedChildElement(child, [tva.e_Coding, tva.e_MixType], (child2) => {
				const href = attrAnyNsValueOrNull(child2,tva.a_href);
				switch (child2.name) {
					case tva.e_Coding:
						// AccessibilityAttributes.*.AudioAttribites.Coding
						if (href && cs.AudioCodecCS && !cs.AudioCodecCS.isLeaf(href))
							errs.addError({
								code: `${errCode}-${errNum}d`,
								fragment: child2,
								message: `${href.quote()} is not valid for ${elem.name.elementize()}${child.name.elementize()}${child2.name.elementize()}`,
								key: keys.k_Accessibility,
							});
						break;
					case tva.e_MixType:
						// AccessibilityAttributes.*.AudioAttribites.MixType
						if (href && !cs.AudioPresentationCS.isIn(href))
							errs.addError({
								code: `${errCode}-${errNum}e`,
								fragment: child2,
								message: `${href.quote()} is not valid for ${elem.name.elementize()}${child.name.elementize()}${child2.name.elementize()}`,
								key: keys.k_Accessibility,
							});
						break;
					case tva.e_AudioLanguage:
						if (attrAnyNs(child2, tva.a_purpose) && allowPurpose == false) {
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

	const purposeChild: ChildElement_type = { name: tva.e_Purpose, maxOccurs: Infinity },
	  screenReaderLanguageChild: ChildElement_type = { name: tva.e_ScreenReaderLanguage, minOccurs: 0, maxOccurs: Infinity },
		appInformationElements : ChildElement_type[]= [
			{ name: tva.e_AppInformation, minOccurs: 0 },
			{ name: tva.e_Personalisation, minOccurs: 0 },
		];
	const allowedAppChildren : ChildElement_type[]= [purposeChild].concat(...appInformationElements);
	const allAppChildren = [tva.e_Purpose].concat(BaseAccessibilityAttributesType);

	const carriages : string[]= [],
		codings : string[] = [];
	let hasAppInformation = false;
	forEachChildElement(AccessibilityAttributes, (child) => {
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
				// eslint-disable-next-line no-case-declarations
				const ScreenReaderChildElements = [screenReaderLanguageChild].concat(...allowedAppChildren);
				checkTopElementsAndCardinality(child, ScreenReaderChildElements, tvaEC.ScreenReaderAttributes, false, errs, `${errCode}-31`);
				checkAppInformation(child, 32);
				checkPurpose(child, "3", 33);
				checkLanguageFmt(child, tva.e_ScreenReaderLanguage, 34);
				break;
			case tva.e_ResponseToUserActionAttributes:
				checkTopElementsAndCardinality(child, allowedAppChildren, allAppChildren, false, errs, `${errCode}-41`);
				checkAppInformation(child, 42);
				checkPurpose(child, "4", 43);
				break;
			case tva.e_SubtitleAttributes:
				checkTopElementsAndCardinality(
					child,
					appInformationElements.concat([
						{ name: tva.e_Carriage },
						{ name: tva.e_Coding, maxOccurs: Infinity },
						{ name: tva.e_SubtitleLanguage },
						{ name: tva.e_Purpose, minOccurs: 0, maxOccurs: Infinity },
						{ name: tva.e_SuitableForTTS },
					]),
					tvaEC.SubtitleAttributes,
					false,
					errs,
					`${errCode}-51`
				);
				hasAppInformation = checkAppInformation(child, 52);
				checkCS(child, tva.e_Carriage, cs.SubtitleCarriageCS, false, 53, carriages);
				checkCS(child, tva.e_Coding, cs.SubtitleCodingFormatCS, false, 54, codings);
				checkLanguageFmt(child, tva.e_SubtitleLanguage, 55);
				checkCS(child, tva.e_Purpose, cs.SubtitlePurposeTypeCS, false, 56);
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
				checkAppInformation(child, 62);
				checkAudioAttributes(child, tva.e_AudioAttributes, 63, false, "A177 clause 4.5.2.4");
				break;
			case tva.e_SigningAttributes:
				checkTopElementsAndCardinality(
					child,
					appInformationElements.concat([{ name: tva.e_Coding }, { name: tva.e_SignLanguage, minOccurs: 0 }, { name: tva.e_Closed, minOccurs: 0 }]),
					tvaEC.SigningAttributes,
					false,
					errs,
					`${errCode}-71`
				);
				checkAppInformation(child, 72);
				if (cs.VideoCodecCS && !checkCS(child, tva.e_Coding, cs.VideoCodecCS, true, 73))
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
