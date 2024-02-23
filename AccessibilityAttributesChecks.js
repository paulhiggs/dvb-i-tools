// AccessibilityAttribitesChecks.js

import { APPLICATION, WARNING } from "./ErrorList.js";
import { dvbi } from "./DVB-I_definitions.js";
import { tva, tvaEC, BaseAccessibilityAttributesType } from "./TVA_definitions.js";

import { checkTopElementsAndCardinality } from "./schema_checks.js";
import { CS_URI_DELIMITER } from "./ClassificationScheme.js";

import { datatypeIs } from "./phlib/phlib.js";

export function CheckAccessibilityAttributes(props, AccessibilityAttributes, cs, errs, errCode) {
	const ACCESSIBILITY_CHECK_KEY = "accessibility attributes";

	if (!AccessibilityAttributes) {
		errs.addError({
			type: APPLICATION,
			code: "AA000",
			message: "CheckAccessibilityAttributes() called with AccessibilityAttributes==null",
		});
		return;
	}

	let accessibilityParent = AccessibilityAttributes.parent().name();

	let mediaAccessibilityElements = [
		{ name: tva.e_SubtitleAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_AudioDescriptionAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_SigningAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_DialogueEnhancementAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_SpokenSubtitlesAttributes, minOccurs: 0, maxOccurs: Infinity },
	];
	let applicationAccessibilityElement = [
		{ name: tva.e_MagnificationUIAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_HighContrastUIAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_ScreenReaderAttributes, minOccurs: 0, maxOccurs: Infinity },
		{ name: tva.e_ResponseToUserActionAttributes, minOccurs: 0, maxOccurs: Infinity },
	];

	if (accessibilityParent == tva.e_RelatedMaterial) {
		checkTopElementsAndCardinality(
			AccessibilityAttributes,
			mediaAccessibilityElements.concat(applicationAccessibilityElement),
			tvaEC.AccessibilityAttributes,
			false,
			errs,
			`${errCode}-1`
		);
	} else if ([tva.e_AVAttributes, dvbi.e_ContentAttributes].includes(accessibilityParent)) {
		checkTopElementsAndCardinality(AccessibilityAttributes, mediaAccessibilityElements, tvaEC.AccessibilityAttributes, false, errs, `${errCode}-2`);
	} else {
		errs.addError({
			type: APPLICATION,
			code: "AA001",
			message: `Invalid parent element for ${tva.e_AccessibilityAttributes}`,
			key: ACCESSIBILITY_CHECK_KEY,
		});
		return;
	}

	let checkPurpose = (elem, mainTerm, errNum) => {
		let children = elem.childNodes();
		if (children)
			children.forEachSubElement((e) => {
				if (e.name() == tva.e_Purpose) {
					let href = e.attr(tva.a_href);
					if (href) {
						let purposeTerm = href.value();
						if (!cs.AccessibilityPurposeCS.isIn(purposeTerm))
							errs.addError({
								code: `${errCode}-${errNum}a`,
								message: `"${purposeTerm}" is not a valid accessibility purpose`,
								fragment: e,
								key: ACCESSIBILITY_CHECK_KEY,
							});
						let li = purposeTerm.lastIndexOf(CS_URI_DELIMITER);
						if (li != -1) {
							if (purposeTerm.charAt(li + 1) != mainTerm)
								errs.addError({
									code: `${errCode}-${errNum}b`,
									fragment: e,
									message: `"${purposeTerm}" is not valid for ${elem.name().elementize()}`,
									key: ACCESSIBILITY_CHECK_KEY,
								});
						}
					}
				}
			});
	};

	let checkAppInformation = (elem, errNum) => {
		let appInfo = elem.childNodes().find((el) => el.type() == "element" && el.name().endsWith(tva.e_AppInformation));
		if (appInfo == undefined) return false; // AppInformation element is not present
		let children = appInfo.childNodes();
		if (children)
			children.forEachSubElement((e) => {
				switch (e.name()) {
					case tva.e_RequiredStandardVersion:
						if (!dvbi.ApplicationStandards.includes(e.text()))
							errs.addError({
								type: WARNING,
								code: `${errCode}-${errNum}a`,
								fragment: e,
								message: `"${e.text()}" is not a known Standard Version`,
								key: ACCESSIBILITY_CHECK_KEY,
							});
						break;
					case tva.e_RequiredOptionalFeature:
						if (!dvbi.ApplicationOptions.includes(e.text()))
							errs.addError({
								type: WARNING,
								code: `${errCode}-${errNum}b`,
								fragment: e,
								message: `"${e.text()}" is not a known Optional Feature`,
								key: ACCESSIBILITY_CHECK_KEY,
							});
						break;
				}
			});
		return true; // AppInformation element is present
	};

	let checkCS = (elem, childName, cs, errNum, storage = null) => {
		let children = elem.childNodes();
		if (children)
			children.forEachSubElement((e) => {
				if (e.name() == childName) {
					let href = e.attr(tva.a_href) ? e.attr(tva.a_href).value() : null;
					if (href && !cs.isIn(href))
						errs.addError({
							code: `${errCode}-${errNum}`,
							fragment: e,
							message: `"${href}" is not valid for ${e.name().elementize()} in ${elem.name().elementize()}`,
							key: ACCESSIBILITY_CHECK_KEY,
						});
					if (storage && datatypeIs(storage, "array") && href) {
						storage.push(href);
					}
				}
			});
	};

	let checkSignLanguage = (elem, childName, errNum) => {
		let children = elem.childNodes();
		if (children)
			children.forEachSubElement((e) => {
				if (e.name() == childName) {
					if (cs.KnownLanguages.checkSignLanguage(e.text()) != cs.KnownLanguages.languageKnown)
						errs.addError({
							code: `${errCode}-${errNum}`,
							fragment: e,
							message: `"${e.text()}" is not a valid sign language for ${e.name().elementize()} in ${elem.name().elementize()}`,
							key: ACCESSIBILITY_CHECK_KEY,
						});
				}
			});
	};

	let checkLanguage = (elem, childName, errNum) => {
		if (!cs.KnownLanguages) return;
		let children = elem.childNodes();
		if (children)
			children.forEachSubElement((e) => {
				if (e.name() == childName) {
					let res = cs.KnownLanguages.isKnown(e.text()).resp;
					if (res == cs.KnownLanguages.languageRedundant) {
						let msg = `language value ${e.text().quote()} is deprecated`;
						if (res?.pref) msg += ` (use ${res.pref.quote()} instead)`;
						errs.addError({
							code: `${errCode}-${errNum}a`,
							fragment: e,
							message: msg,
							key: ACCESSIBILITY_CHECK_KEY,
							type: WARNING,
						});
					} else if (res != cs.KnownLanguages.languageKnown)
						errs.addError({
							code: `${errCode}-${errNum}b`,
							fragment: e,
							message: `"${e.text()}" is not a valid language for ${e.name().elementize()} in ${elem.name().elementize()} (res=${res})`,
							key: ACCESSIBILITY_CHECK_KEY,
						});
				}
			});
	};

	let checkLanguagePurpose = (elem, childName, errNum) => {
		if (!cs.AudioPurposeCS) return;
		let children = elem.childNodes();
		if (children)
			children.forEachSubElement((e) => {
				if (e.name() == childName) {
					if (e.attr(tva.a_purpose) && !cs.AudioPurposeCS.isIn(e.attr(tva.a_purpose).value()))
						errs.addError({
							code: errNum,
							fragment: e,
							message: `"${e.attr(tva.a_purpose).value()}" not not valid for ${elem.name().elementize()}${e.name().elementize()}`,
							key: ACCESSIBILITY_CHECK_KEY,
						});
				}
			});
	};

	let checkAudioAttributes = (elem, childName, errNum) => {
		let children = elem.childNodes();
		if (children)
			children.forEachSubElement((e) => {
				if (e.name() == childName) {
					// AccessibilityAttributes.*.AudioAttribites.AudioLanguage
					checkLanguage(e, tva.e_AudioLanguage, `${errNum}a`);
					checkLanguagePurpose(e, tva.e_AudioLanguage, `${errNum}b`);
					let c2 = e.childNodes();
					if (c2)
						c2.forEachSubElement((e2) => {
							switch (e2.name()) {
								case tva.e_Coding:
									// AccessibilityAttributes.*.AudioAttribites.Coding
									if (e2.attr(tva.a_href) && !cs.AudioCodecCS.isIn(e2.attr(tva.a_href).value()))
										errs.addError({
											code: `${errCode}-${errNum}c`,
											fragment: e2,
											message: `"${e2.attr(tva.a_href).value()}" not not valid for ${elem.name().elementize()}${e.name().elementize()}${e2.name().elementize()}`,
											key: ACCESSIBILITY_CHECK_KEY,
										});
									break;
								case tva.e_MixType:
									// AccessibilityAttributes.*.AudioAttribites.MixType
									if (e2.attr(tva.a_href) && !cs.AudioPresentationCS.isIn(e2.attr(tva.a_href).value()))
										errs.addError({
											code: `${errCode}-${errNum}d`,
											fragment: e2,
											message: `"${e2.attr(tva.a_href).value()}" not not valid for ${elem.name().elementize()}${e.name().elementize()}${e2.name().elementize()}`,
											key: ACCESSIBILITY_CHECK_KEY,
										});
									break;
							}
						});
				}
			});
	};

	const appInformationElements = [
		{ name: tva.e_AppInformation, minOccurs: 0 },
		{ name: tva.e_Personalisation, minOccurs: 0 },
	];
	let allowedAppChildren = [{ name: tva.e_Purpose, maxOccurs: Infinity }].concat(appInformationElements);
	let allAppChildren = [tva.e_Purpose].concat(BaseAccessibilityAttributesType);

	let children = AccessibilityAttributes.childNodes();
	let carriages = [],
		codings = [],
		hasAppInformation = false;
	if (children)
		children.forEachSubElement((elem) => {
			switch (elem.name()) {
				case tva.e_MagnificationUIAttributes:
					checkTopElementsAndCardinality(elem, allowedAppChildren, allAppChildren, false, errs, `${errCode}-11`);
					checkAppInformation(elem, 12);
					checkPurpose(elem, "1", 13);
					break;
				case tva.e_HighContrastUIAttributes:
					checkTopElementsAndCardinality(elem, allowedAppChildren, allAppChildren, false, errs, `${errCode}-21`);
					checkAppInformation(elem, 22);
					checkPurpose(elem, "2", 23);
					break;
				case tva.e_ScreenReaderAttributes:
					let ScreenReaderChildElements = [{ name: tva.e_ScreenReaderLanguage, minOccurs: 0, maxOccurs: Infinity }].concat(allowedAppChildren);
					checkTopElementsAndCardinality(elem, ScreenReaderChildElements, tvaEC.ScreenReaderAttributes, false, errs, `${errCode}-31`);
					checkAppInformation(elem, 32);
					checkPurpose(elem, "3", 33);
					checkLanguage(elem, tva.e_ScreenReaderLanguage, 34);
					break;
				case tva.e_ResponseToUserActionAttributes:
					checkTopElementsAndCardinality(elem, allowedAppChildren, allAppChildren, false, errs, `${errCode}-41`);
					checkAppInformation(elem, 42);
					checkPurpose(elem, "4", 43);
					break;
				case tva.e_SubtitleAttributes:
					checkTopElementsAndCardinality(
						elem,
						[
							{ name: tva.e_Carriage },
							{ name: tva.e_Coding, maxOccurs: Infinity },
							{ name: tva.e_SubtitleLanguage },
							{ name: tva.e_Purpose, minOccurs: 0 },
							{ name: tva.e_SuitableForTTS },
						].concat(appInformationElements),
						tvaEC.SubtitleAttributes,
						false,
						errs,
						`${errCode}-51`
					);
					hasAppInformation = checkAppInformation(elem, 52);
					checkCS(elem, tva.e_Carriage, cs.SubtitleCarriageCS, 53, carriages);
					checkCS(elem, tva.e_Coding, cs.SubtitleCodingFormatCS, 54, codings);
					checkLanguage(elem, tva.e_SubtitleLanguage, 55);
					checkCS(elem, tva.e_Purpose, cs.SubtitlePurposeTypeCS, 56);
					break;
				case tva.e_AudioDescriptionAttributes:
					checkTopElementsAndCardinality(
						elem,
						[{ name: tva.e_AudioAttributes }, { name: tva.e_ReceiverMix, minOccurs: 0 }].concat(appInformationElements),
						tvaEC.AudioDescriptionAttributes,
						false,
						errs,
						`${errCode}-61`
					);
					checkAppInformation(elem, 62);
					checkAudioAttributes(elem, tva.e_AudioAttributes, 63);
					break;
				case tva.e_SigningAttributes:
					checkTopElementsAndCardinality(
						elem,
						[{ name: tva.e_Coding }, { name: tva.e_SignLanguage, minOccurs: 0 }, { name: tva.e_Closed, minOccurs: 0 }].concat(appInformationElements),
						tvaEC.SigningAttributes,
						false,
						errs,
						`${errCode}-71`
					);
					checkAppInformation(elem, 72);
					checkCS(elem, tva.e_Coding, cs.VideoCodecCS, 73);
					checkSignLanguage(elem, tva.e_SignLanguage, 74);
					break;
				case tva.e_DialogueEnhancementAttributes:
					checkTopElementsAndCardinality(elem, [{ name: tva.e_AudioAttributes }].concat(appInformationElements), tvaEC.DialogEnhancementAttributes, false, errs, `${errCode}-81`);
					checkAppInformation(elem, 82);
					checkAudioAttributes(elem, tva.e_AudioAttributes, 83);
					break;
				case tva.e_SpokenSubtitlesAttributes:
					checkTopElementsAndCardinality(elem, [{ name: tva.e_AudioAttributes }].concat(appInformationElements), tvaEC.SpokenSubtitlesAttributes, false, errs, `${errCode}-91`);
					checkAppInformation(elem, 92);
					checkAudioAttributes(elem, tva.e_AudioAttributes, 93);
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
				key: ACCESSIBILITY_CHECK_KEY,
			});
		}
	}
}
