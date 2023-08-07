import { DOMParser } from "@xmldom/xmldom";

import { datatypeIs } from "./phlib/phlib.js";
import { mpeg7 } from "./MPEG7_definitions.js";
import { tva } from "./TVA_definitions.js";
import { dvbi } from "./DVB-I_definitions.js";

import { /*xPath,  hasElement,*/ isEmpty } from "./utils.js";
/**
 * check if the specificed element has the named child element
 *
 * @param {XMLnode} node         the node to check
 * @param {string}  elementName  the name of the child element
 * @returns {boolean} an element named node.elementName if it exists exists, else false
 */
function hasElement(node, elementName) {
	if (!node) return false;
	let t = node.getElementsByTagName(elementName);
	return t.length == 0 ? false : t[0];
}

/**
 * DOMParser extension
 */
function getNamedChildren(node, ...elementNames) {
	let ls = [];
	if (node.hasChildNodes()) {
		let children = node.childNodes;
		for (let i = 0; i < children.length; i++) if (elementNames.includes(children[i].nodeName)) ls.push(children[i]);
	}
	return ls;
}

/**
 * Core features
 */
const NUMBER = 999,
	BOOLEAN = 998,
	STRING = 997;

let convertType = (strVal, type) => {
	if (!strVal) return null;
	else if (type == NUMBER) return Number(strVal);
	else if (type == BOOLEAN) return String(strVal).toLowerCase() === "true";
	else return strVal;
};

let parseTextValue = (node) => (node ? node.textContent : null);

let addElements = (res, node, elementName, parserFunc) => {
	if (!hasElement(node, elementName)) return;
	if (!Object.prototype.hasOwnProperty.call(res, elementName)) res[elementName] = [];
	let t = getNamedChildren(node, elementName);
	for (let i = 0; i < t.length; i++) res[elementName].push(parserFunc(t[i]));
};

let addElement = (res, node, elementNme, parserFunc) => {
	let tmp = hasElement(node, elementNme);
	if (tmp) res[elementNme] = parserFunc(tmp);
};

/**
 * XML Parsing
 */
let addAttribute = (res, node, attrName, opts = { type: STRING, default: null }) => {
	console.log(`${node.tagName}@${attrName} is ${node.hasAttribute(attrName)}`);
	if (node && node.hasAttribute(attrName)) res[attrName] = convertType(node.getAttribute(attrName), opts.type);
	else if (opts.default) res[attrName] = opts.default;
};

let addSimpleElement = (res, node, elementName, opts = { type: STRING }) => {
	if (!hasElement(node, elementName)) return;
	res[elementName] = convertType(parseTextValue(hasElement(node, elementName)), opts.type);
};

let addSimpleElements = (res, node, elementName, opts = { type: STRING }) => {
	if (!hasElement(node, elementName)) return;
	if (!Object.prototype.hasOwnProperty.call(res, elementName)) res[elementName] = [];
	let t = node.getElementsByTagName(elementName);
	for (let i = 0; i < t.length; i++) res[elementName].push(convertType(parseTextValue(t[i]), opts.type));
};

let addElementBase = (res, node, opts = { type: STRING }) => {
	res.text = parseTextValue(node);
	if (res.text) {
		if (opts.type == NUMBER) res.text = Number(res.text);
		else if (opts.type == BOOLEAN) res.text = String(res.text).toLowerCase() === "true";
	}
};

let addXMLElement = (res, node, elementName) => {
	if (!hasElement(node, elementName)) return;
	res[elementName] = node.toString({ declaration: false, format: true });
};

let addXMLElements = (res, node, elementName) => {
	if (!hasElement(node, elementName)) return;
	if (!Object.prototype.hasOwnProperty.call(res, elementName)) res[elementName] = [];
	let t = node.getElementsByTagName(elementName);
	for (let i = 0; i < t.length; i++) res[elementName].push(t[i].toString({ declaration: false, format: true }));
};

/**
 * MPEG-7 Parsing
 */
let parseUniqueIDType = (node) => {
	let id = {};
	addElementBase(id, node);
	addAttribute(id, node, mpeg7.a_type, { default: "URI" });
	addAttribute(id, node, mpeg7.a_organization);
	addAttribute(id, node, mpeg7.a_authority);
	addAttribute(id, node, mpeg7.a_encoding, { default: mpeg7.ID_ENCODING_TEXT });
	return id;
};

let parseTextualBaseType = (node) => {
	let tbt = {};
	addElementBase(tbt, node);
	addLangAttribute(tbt, node);
	return tbt;
};

let parseTextualType = (node) => parseTextualBaseType(node);

let parseTitleType = (node) => {
	let tt = parseTextualType(node);
	addAttribute(tt, node, mpeg7.a_type, { default: mpeg7.TITLE_TYPE_MAIN });
	return tt;
};

let parseExtendedLanguageType = (node) => {
	let lang = {};
	addElementBase(lang, node);
	addAttribute(lang, node, mpeg7.a_type, { default: "original" });
	addAttribute(lang, node, mpeg7.a_supplemental, { type: BOOLEAN, default: false });
	return lang;
};

let parseInlineMediaType = (node) => {
	let im = {};
	addSimpleElement(im, node, mpeg7.e_MediaData16);
	addSimpleElement(im, node, mpeg7.e_MediaData64);
	addAttribute(im, node, mpeg7.a_type);
	return im;
};

let parseMediaLocatorType = (node) => {
	let ml = {};
	addSimpleElement(ml, node, mpeg7.e_MediaUri);
	addElement(ml, node, mpeg7.e_InlineMedia, parseInlineMediaType);
	return ml;
};

let parseBytePosition = (node) => {
	let bp = {};
	addAttribute(bp, node, mpeg7.a_offset, { type: NUMBER });
	addAttribute(bp, node, mpeg7.a_length, { type: NUMBER });
	return bp;
};

let parseImageLocatorType = (node) => {
	let il = parseMediaLocatorType(node);
	addSimpleElement(il, node, mpeg7.e_MediaTimePoint);
	addElement(il, node, mpeg7.e_BytePosition, parseBytePosition);
	return il;
};

let parseTemporalSegmentLocatorType = (node) => {
	let ts = parseMediaLocatorType(node);
	addSimpleElement(ts, node, mpeg7.e_MediaTimePoint);
	addElement(ts, node, mpeg7.e_BytePosition, parseBytePosition);
	return ts;
};

let parseTitleMediaType = (node) => {
	let tm = {};
	addElement(tm, node, mpeg7.e_TitleImage, parseImageLocatorType);
	addElement(tm, node, mpeg7.e_TitleVideo, parseTemporalSegmentLocatorType);
	addElement(tm, node, mpeg7.e_TitleAudio, parseTemporalSegmentLocatorType);
	return tm;
};

let parseMPEG7ParentalGuidanceType = (node) => {
	let pg = {};
	addControlledTermType(pg, node, mpeg7.e_ParentalRating);
	addSimpleElement(pg, node, mpeg7.e_MinimumAge, { type: NUMBER });
	addSimpleElements(pg, node, mpeg7.e_Region);
	return pg;
};

let parseMPEG7PersonNameType = (node) => {
	let person = {};
	let parseNameComponentType = (node) => {
		let nc = parseTextualBaseType(node);
		addAttribute(nc, node, mpeg7.a_initial);
		addAttribute(nc, node, mpeg7.a_abbrev);
		return nc;
	};
	for (const c of node.children) {
		switch (c.tagName) {
			case mpeg7.e_GivenName:
				if (!Object.prototype.hasOwnProperty.call(person, mpeg7.e_GivenName)) person[mpeg7.e_GivenName] = [];
				person[mpeg7.e_GivenName].push(parseNameComponentType(c));
				break;
			case mpeg7.e_LinkingName:
				if (!Object.prototype.hasOwnProperty.call(person, mpeg7.e_LinkingName)) person[mpeg7.e_LinkingName] = [];
				person[mpeg7.e_LinkingName].push(parseNameComponentType(c));
				break;
			case mpeg7.e_FamilyName:
				if (!Object.prototype.hasOwnProperty.call(person, mpeg7.e_FamilyName)) person[mpeg7.e_FamilyName] = [];
				person[mpeg7.e_FamilyName].push(parseNameComponentType(c));
				break;
			case mpeg7.e_Title:
				if (!Object.prototype.hasOwnProperty.call(person, mpeg7.e_Title)) person[mpeg7.e_Title] = [];
				person[mpeg7.e_Title].push(parseNameComponentType(c));
				break;
			case mpeg7.e_Salutation:
				if (!Object.prototype.hasOwnProperty.call(person, mpeg7.e_Salutation)) person[mpeg7.e_Salutation] = [];
				person[mpeg7.e_Salutation].push(parseNameComponentType(c));
				break;
			case mpeg7.e_Numeration:
				if (!Object.prototype.hasOwnProperty.call(person, mpeg7.e_Numeration)) person[mpeg7.e_Numeration] = [];
				person[mpeg7.e_Numeration].push(parseNameComponentType(c));
				break;
		}
	}
	addAttribute(person, node, mpeg7.a_dateFrom);
	addAttribute(person, node, mpeg7.a_dateTo);
	addAttribute(person, node, mpeg7.a_type);
	addLangAttribute(person, node);
	return person;
};

/**
 * TV-Anytime Parsing
 */

function ansectorLanguage(node) {
	if (node.nodeType != 1) return "**";
	if (node.hasAttribute(tva.a_lang)) return node.getAttribute(tva.a_lang);
	return ansectorLanguage(node.parentNode);
}

let addLangAttribute = (res, node) => {
	addAttribute(res, node, tva.a_lang);
	if (!res[tva.a_lang]) res[tva.a_lang] = ansectorLanguage(node);
};

let parseTermNameType = (node) => {
	let tnt = parseTextualType(node);
	addAttribute(tnt, node, tva.a_preferred);
	return tnt;
};

let parseControlledTermType = (node) => {
	let ct = {};
	addAttribute(ct, node, tva.a_href);
	addElement(ct, node, tva.e_Name, parseTermNameType);
	addElement(ct, node, tva.e_Definition, parseTextualType);
	return ct;
};

let addControlledTermType = (res, node, elementName) => {
	addElement(res, node, elementName, parseControlledTermType);
};

let addMultiLingual = (res, node, elementName) => {
	addElements(res, node, elementName, parseTextualType);
};

let parseBitRateType = (node) => {
	let br = {};
	addElementBase(br, node, { type: NUMBER });
	addAttribute(br, node, tva.a_variable, { type: BOOLEAN, default: false });
	addAttribute(br, node, tva.a_minimum, { type: NUMBER });
	addAttribute(br, node, tva.a_average, { type: NUMBER });
	addAttribute(br, node, tva.a_maximum, { type: NUMBER });
	return br;
};

let parseAudioLanguageType = (node) => {
	let alang = parseExtendedLanguageType(node);
	addAttribute(alang, node, tva.a_purpose);
	return alang;
};

let parseAudioAttributesType = (node) => {
	let newAA = {};
	addControlledTermType(newAA, node, tva.e_Coding);
	addSimpleElement(newAA, node, tva.e_NumOfChannels, { type: NUMBER });
	addControlledTermType(newAA, node, tva.e_MixType);
	addElement(newAA, node, tva.e_AudioLanguage, parseAudioLanguageType);
	addSimpleElement(newAA, node, tva.e_SampleFrequency, { type: NUMBER });
	addSimpleElement(newAA, node, tva.e_BitsPerSample, { type: NUMBER });
	addElement(newAA, node, tva.e_BitRate, parseBitRateType);
	return newAA;
};

let parseTVAVideoAttributesType = (node) => {
	let newVA = {};
	addControlledTermType(newVA, node, tva.e_Coding);
	addSimpleElement(newVA, node, tva.e_Scan);
	addSimpleElement(newVA, node, tva.e_HorizontalSize, { type: NUMBER });
	addSimpleElement(newVA, node, tva.e_VerticalSize, { type: NUMBER });
	addSimpleElement(newVA, node, tva.e_AspectRatio);
	addElement(newVA, node, tva.e_Color, parseColorType);
	addSimpleElement(newVA, node, tva.e_FrameRate);
	addElement(newVA, node, tva.e_BitRate, parseBitRateType);
	addControlledTermType(newVA, node, tva.e_PictureFormat);
	addControlledTermType(newVA, node, dvbi.e_Colorimetry);
	return newVA;
};

let parseCaptioningAttributesType = (node) => {
	let ca = {};
	addControlledTermType(ca, node, tva.e_Coding);
	addElement(ca, node, tva.e_BitRate, parseBitRateType);
	return ca;
};

let parseAVAttributesType = (node) => {
	let avattr = {};
	addControlledTermType(avattr, node, tva.e_FileFormat);
	addSimpleElement(avattr, node, tva.e_FileSize, { type: NUMBER });
	addControlledTermType(avattr, node, tva.e_System);
	addElements(avattr, node, tva.e_BitRate, parseBitRateType);
	addElements(avattr, node, tva.e_AudioAttributes, parseAudioAttributesType);
	addElement(avattr, node, tva.e_VideoAttributes, parseTVAVideoAttributesType);
	addElements(avattr, node, tva.e_CaptioningAttributes, parseCaptioningAttributesType);
	return avattr;
};

let parseColorType = (node) => {
	let ct = {};
	addAttribute(ct, node, tva.a_type);
	return ct;
};

let parseExtendedURIType_TVA = (node) => {
	let eURI = {};
	addElementBase(eURI, node);
	addAttribute(eURI, node, tva.a_contentType);
	addAttribute(eURI, node, tva.a_uriType);
	return eURI;
};

let parseTVAMediaLocatorType = (node) => {
	let ml = {};
	addElement(ml, node, tva.e_MediaUri, parseExtendedURIType_TVA);
	return ml;
};

let parseSegmentReferenceType = (node) => {
	let sr = {};
	addAttribute(sr, node, tva.a_segmentType, { default: "segment" });
	addAttribute(sr, node, tva.a_ref);
	return sr;
};

let parseRelatedMaterialType = (node) => {
	let rm = {};
	addLangAttribute(rm, node);
	rm[tva.e_HowRelated] = null;
	addControlledTermType(rm, node, tva.e_HowRelated);
	addElement(rm, node, tva.e_Format, function parseFormat(node2) {
		let fmt = {};
		addElement(fmt, node2, tva.e_AVAttributes2, parseAVAttributesType);
		addElement(fmt, node2, tva.e_StillPictureFormat2, function parseStillPictureFormat(node3, /* eslint-disable no-unused-vars*/ props3 /* eslint-enable */) {
			let spf = parseControlledTermType(node);
			addAttribute(spf, node3, tva.a_horizontalSize, { type: NUMBER });
			addAttribute(spf, node3, tva.a_verticalSize, { type: NUMBER });
			return spf;
		});
		return fmt;
	});
	addElements(rm, node, tva.e_MediaLocator, parseTVAMediaLocatorType);
	addElement(rm, node, tva.e_SegmentReference, parseSegmentReferenceType);
	addElements(rm, node, tva.e_PromotionalText, parseTextualType);
	addElements(rm, node, tva.e_PromotionalMedia, parseTitleMediaType);
	addElement(rm, node, tva.e_SocialMediaReference, function smrType(node) {
		let sm = {};
		addElementBase(sm, node);
		addAttribute(sm, node, tva.a_referenceType);
		return sm;
	});
	addElement(rm, node, tva.e_SourceMediaLocator, parseMediaLocatorType);
	return rm;
};

let parseCaptionLanguageType = (node) => {
	let cl = {};
	addAttribute(cl, node, tva.a_primary);
	addAttribute(cl, node, tva.a_translation);
	addAttribute(cl, node, tva.a_closed, { type: BOOLEAN, default: true });
	addAttribute(cl, node, tva.a_supplemental, { type: BOOLEAN, defaut: false });
	return cl;
};

let parseSignLanguageType = (node) => {
	let sl = {};
	addAttribute(sl, node, tva.a_primary);
	addAttribute(sl, node, tva.a_translation);
	addAttribute(sl, node, tva.a_type);
	addAttribute(sl, node, tva.a_closed);
	return sl;
};

let parseGenre = (node) => {
	let g = parseControlledTermType(node);
	addAttribute(g, node, tva.a_type, { default: tva.GENRE_TYPE_MAIN });
	return g;
};

let parseSynopsisType = (node) => {
	let st = parseTextualType(node);
	addAttribute(st, node, tva.a_length);
	return st;
};

/**
 * DVB-I Parsing - Service List
 */

let parseVideoAttributesType = (node) => {
	let newVA = parseTVAVideoAttributesType(node);
	addControlledTermType(newVA, node, dvbi.e_Colorimetry);
	return newVA;
};

let parseExtendedURIType_DVB = (node) => {
	let eURI = {};
	addSimpleElement(eURI, node, dvbi.e_URI);
	addAttribute(eURI, node, dvbi.a_contentType);
	return eURI;
};

let addCountries = (res, node, attributeName, property) => {
	if (node.hasAttribute(attributeName)) res[property] = node.getAttribute(attributeName).split(",");
};

let parseContentGuideSource = (node) => {
	let cg = {};
	addAttribute(cg, node, dvbi.a_CGSID);
	addAttribute(cg, node, dvbi.a_minimumMetadataUpdatePeriod);
	addMultiLingual(cg, node, dvbi.e_Name);
	addMultiLingual(cg, node, dvbi.e_ProviderName);
	addElements(cg, node, dvbi.e_RelatedMaterial, parseRelatedMaterialType);
	addElement(cg, node, dvbi.e_ScheduleInfoEndpoint, parseExtendedURIType_DVB);
	addElement(cg, node, dvbi.e_ProgramInfoEndpoint, parseExtendedURIType_DVB);
	addElement(cg, node, dvbi.e_GroupInfoEndpoint, parseExtendedURIType_DVB);
	addElement(cg, node, dvbi.e_MoreEpisodesEndpoint, parseExtendedURIType_DVB);
	return cg;
};

let parseDVBTriplet = (node) => {
	let triplet = {};
	addAttribute(triplet, node, dvbi.a_origNetId, { type: NUMBER });
	addAttribute(triplet, node, dvbi.a_tsId, { type: NUMBER });
	addAttribute(triplet, node, dvbi.a_serviceId, { type: NUMBER });
	return triplet;
};

let parseDVBTDeliveryParameters = (node) => {
	let dt = {};
	addElement(dt, node, dvbi.e_DVBTriplet, parseDVBTriplet);
	addSimpleElement(dt, node, dvbi.e_TargetCountry);
	return dt;
};

let parseDVBSDeliveryParameters = (node) => {
	let ds = {};
	addElement(ds, node, dvbi.e_DVBTriplet, parseDVBTriplet);
	addSimpleElement(ds, node, dvbi.e_OrbitalPosition, { type: NUMBER });
	addSimpleElement(ds, node, dvbi.e_Frequency, { type: NUMBER });
	addSimpleElement(ds, node, dvbi.e_Polarization);
	addSimpleElement(ds, node, dvbi.e_SymbolRate, { type: NUMBER });
	addSimpleElement(ds, node, dvbi.e_RollOff);
	addSimpleElement(ds, node, dvbi.e_ModulationSystem);
	addSimpleElement(ds, node, dvbi.e_FEC);
	addSimpleElement(ds, node, dvbi.e_ModcodMode);
	addSimpleElement(ds, node, dvbi.e_InputStreamIdentifier, { type: NUMBER });

	let parseFrequency = (node) => {
		let newFreq = {};
		addElementBase(newFreq, node, { type: NUMBER });
		addAttribute(newFreq, node, dvbi.a_primary, { type: BOOLEAN, default: false });
		return newFreq;
	};
	let parseChannelBonding = (node) => {
		let cb = {};
		addElements(cb, node, dvbi.e_Frequency, parseFrequency);
		return cb;
	};
	addElement(ds, node, dvbi.e_ChannelBonding, parseChannelBonding);
	return ds;
};

let parseDVBCDeliveryParameters = (node) => {
	let dc = {};
	addElement(dc, node, dvbi.e_DVBTriplet, parseDVBTriplet);
	addSimpleElement(dc, node, dvbi.e_TargetCountry);
	addSimpleElement(dc, node, dvbi.e_NetworkID, { type: NUMBER });
	return dc;
};

let parseDASHDeliveryParameters = (node) => {
	let dd = {};
	addElement(dd, node, dvbi.e_UriBasedLocation, parseExtendedURIType_DVB);
	addSimpleElement(dd, node, dvbi.e_MinimumBitRate, { type: NUMBER });
	addXMLElements(dd, node, dvbi.e_Extension);
	return dd;
};

let parseRTSPDeliveryParametersType = (node) => {
	let parseRTSPURLType = (node) => {
		let ru = {};
		addElementBase(ru, node);
		addAttribute(ru, node, dvbi.a_RTSPControlURL);
		return ru;
	};
	let rp = {};
	addElement(rp, node, dvbi.e_DVBTriplet, parseDVBTriplet);
	addElement(rp, node, dvbi.e_RTSPURL, parseRTSPURLType);
	addSimpleElement(rp, node, dvbi.e_MinimumBitRate, { type: NUMBER });
	return rp;
};

let parseMulticastTSDeliveryParametersType = (node) => {
	let addBasicMulticastAddressAttributesType = (res, node) => {
		addAttribute(res, node, dvbi.a_Source);
		addAttribute(res, node, dvbi.a_Address);
		addAttribute(res, node, dvbi.a_Port, { type: NUMBER });
	};
	let addFECAttributeGroupType = (res, node) => {
		addAttribute(res, node, dvbi.a_FECMaxBlockSize, { type: NUMBER });
		addAttribute(res, node, dvbi.a_FECMaxBlockTime, { type: NUMBER });
		addAttribute(res, node, dvbi.a_FECOTI);
	};
	let addMulticastAddressAttributes = (res, node) => {
		addBasicMulticastAddressAttributesType(res, node);
		addAttribute(res, node, dvbi.a_Streaming);
		addFECAttributeGroupType(res, node);
	};
	let parseMcastType = (node) => {
		let parseFECLayerAddressType = (node) => {
			let fla = {};
			addAttribute(fla, node, dvbi.a_Address);
			addAttribute(fla, node, dvbi.a_Source);
			addAttribute(fla, node, dvbi.a_Port, { type: NUMBER });
			addAttribute(fla, node, dvbi.a_MaxBitrate, { type: NUMBER });
			addAttribute(fla, node, dvbi.a_RTSPControlURL);
			addAttribute(fla, node, dvbi.a_PayloadTypeNumber, { type: NUMBER });
			addAttribute(fla, node, dvbi.a_TransportProtocol);
			return fla;
		};
		let parseRETInfoType = (node) => {
			let parseRTCPReportingType = (node) => {
				let rr = {};
				addAttribute(rr, node, dvbi.a_DestinationAddress);
				addAttribute(rr, node, dvbi.a_DestinationPort, { type: NUMBER });
				addAttribute(rr, node, dvbi.a_dvb_t_ret, { type: NUMBER });
				addAttribute(rr, node, dvbi.a_rtcp_bandwidth, { type: NUMBER });
				addAttribute(rr, node, dvbi.a_rtcp_rsize, { type: NUMBER });
				addAttribute(rr, node, dvbi.a_trr_int, { type: NUMBER });
				addAttribute(rr, node, dvbi.a_dvb_disable_rtcp_rr, { type: BOOLEAN, default: false });
				addAttribute(rr, node, dvbi.a_dvb_enable_byte, { type: BOOLEAN, default: false });
				addAttribute(rr, node, dvbi.a_dvb_t_wait_min, { type: NUMBER, default: 0 });
				addAttribute(rr, node, dvbi.a_dvb_t_wait_max, { type: NUMBER, default: 0 });
				addAttribute(rr, node, dvbi.a_dvb_ssrc_bitmask, { default: "ffffffff" });
				addAttribute(rr, node, dvbi.a_dvb_drsi_mc_ret, { type: BOOLEAN, default: false });
				addAttribute(rr, node, dvbi.a_dvb_ssrc_upstream_client, { type: NUMBER });
				return rr;
			};
			let addCommonCastRETType = (res, node) => {
				addAttribute(res, node, dvbi.a_ssrc, { type: NUMBER });
				addAttribute(res, node, dvbi.a_RTPPayloadTypeNumber, { type: NUMBER });
				addAttribute(res, node, dvbi.a_dvb_original_copy_ret, { type: BOOLEAN });
				addAttribute(res, node, dvbi.a_rtcp_mux, { type: BOOLEAN, default: false });
				addAttribute(res, node, dvbi.a_DestinationPort, { type: NUMBER });
				addAttribute(res, node, dvbi.a_rtx_time, { type: NUMBER });
			};
			let parseUnicastRETType = (node) => {
				let ur = {};
				addAttribute(ur, node, dvbi.a_trr_int, { type: NUMBER });
				addAttribute(ur, node, dvbi.a_DestinationPort_ForRTCPReporting, { type: NUMBER });
				addAttribute(ur, node, dvbi.a_SourcePort, { type: NUMBER });
				addAttribute(ur, node, dvbi.a_RTSPControlUR);
				addCommonCastRETType(ur, node);
				return ur;
			};
			let parseMulticastRETType = (node) => {
				let mr = {};
				addAttribute(mr, node, dvbi.a_SourceAddress);
				addAttribute(mr, node, dvbi.a_GroupAddress);
				addCommonCastRETType(mr, node);
				return mr;
			};
			let ri = {};
			addElement(ri, node, dvbi.e_RTCPReporting, parseRTCPReportingType);
			addElement(ri, node, dvbi.e_UnicastRET, parseUnicastRETType);
			addElement(ri, node, dvbi.e_MulticastRET, parseMulticastRETType);
			return ri;
		};
		let mc = {};
		addElement(mc, node, dvbi.e_FECBaseLayer, parseFECLayerAddressType);
		addElements(mc, node, dvbi.e_FECEnhancementLayer, parseFECLayerAddressType);
		addSimpleElement(mc, node, dvbi.e_CNAME);
		addSimpleElement(mc, node, dvbi.e_ssrc, { type: NUMBER });
		addElement(mc, node, dvbi.e_RTPRetransmission, parseRETInfoType);
		addMulticastAddressAttributes(mc, node);
		return mc;
	};
	let mts = {};
	addElement(mts, node, dvbi.e_DVBTriplet, parseDVBTriplet);
	addElement(mts, node, dvbi.e_MulticastTSDeliveryParameters, parseMcastType);
	addSimpleElement(mts, node, dvbi.e_MinimumBitRate, { type: NUMBER });
	return mts;
};

let parseLCNTableEntryType = (node) => {
	let ent = {};
	addAttribute(ent, node, dvbi.a_channelNumber, { type: NUMBER });
	addAttribute(ent, node, dvbi.a_serviceRef);
	addAttribute(ent, node, dvbi.a_selectable, { type: BOOLEAN, default: true });
	addAttribute(ent, node, dvbi.a_visible, { type: BOOLEAN, default: true });
	return ent;
};

let parseServiceInstance = (node) => {
	let parseContentProtectionType = (node) => {
		let parseProtectionSystemType = (node) => {
			let ps = {};
			addElementBase(ps, node);
			addAttribute(ps, node, dvbi.a_cpsIndex);
			return ps;
		};
		let parseCASystemType = (node) => parseProtectionSystemType(node);
		let parseDRMSystemType = (node) => {
			let newDRM = parseProtectionSystemType(node);
			addAttribute(newDRM, node, dvbi.a_encryptionScheme);
			return newDRM;
		};
		let cp = {};
		addElements(cp, node, dvbi.e_CASystemId, parseCASystemType);
		addElements(cp, node, dvbi.e_DRMSystemId, parseDRMSystemType);
		return cp;
	};
	let parseContentAttributesType = (node) => {
		let parseAudioConformancePoint = (node) => {
			let acp = parseControlledTermType(node);
			acp.deprecated = true;
		};
		let ca = {};
		addElements(ca, node, dvbi.e_AudioAttributes, parseAudioAttributesType);
		addElements(ca, node, dvbi.e_AudioConformancePoint, parseAudioConformancePoint);
		addElements(ca, node, dvbi.e_VideoAttributes, parseVideoAttributesType);
		addElement(ca, node, dvbi.e_VideoConformancePoint, parseControlledTermType);
		addElements(ca, node, dvbi.e_CaptionLanguage, parseCaptionLanguageType);
		addElements(ca, node, dvbi.e_SignLanguage, parseSignLanguageType);
		return ca;
	};
	let parseServiceAvailabilityType = (node) => {
		let parseAvailabilityPeriod = (node) => {
			let parseInterval = (node) => {
				let newInterval = {};
				addAttribute(newInterval, node, dvbi.a_days, { default: "1 2 3 4 5 6 7" });
				addAttribute(newInterval, node, dvbi.a_recurrence, { type: NUMBER, default: 1 });
				addAttribute(newInterval, node, dvbi.a_startTime, { default: "00:00:00Z" });
				addAttribute(newInterval, node, dvbi.a_endTime, { default: "23:59:59.999Z" });
				return newInterval;
			};
			let period = {};
			addAttribute(period, node, dvbi.a_validFrom);
			addAttribute(period, node, dvbi.a_validTo);
			addElements(period, node, dvbi.e_Interval, parseInterval);
			return period;
		};
		let av = {};
		addElements(av, node, dvbi.e_Period, parseAvailabilityPeriod);
		return av;
	};
	let parseFTAContentManagementType = (node) => {
		let fcm = {};
		addAttribute(fcm, node, dvbi.a_userDefined, { type: BOOLEAN });
		addAttribute(fcm, node, dvbi.a_doNotScramble, { type: BOOLEAN });
		addAttribute(fcm, node, dvbi.a_controlRemoteAccessOverInternet, { type: NUMBER });
		addAttribute(fcm, node, dvbi.a_doNotApplyRevocation, { type: BOOLEAN });
		return fcm;
	};
	let si = {};
	if (node) {
		addMultiLingual(si, node, dvbi.e_DisplayName);
		addElements(si, node, dvbi.e_RelatedMaterial, parseRelatedMaterialType);
		addElements(si, node, dvbi.e_ContentProtection, parseContentProtectionType);
		addElement(si, node, dvbi.e_ContentAttributes, parseContentAttributesType);
		addElement(si, node, dvbi.e_Availability, parseServiceAvailabilityType);
		addElements(si, node, dvbi.e_SubscriptionPackage, parseTextualType);
		addElement(si, node, dvbi.e_FTAContentManagement, parseFTAContentManagementType);
		addSimpleElement(si, node, dvbi.e_SourceType);
		addElements(si, node, dvbi.e_AltServiceName, parseTextValue);
		addElement(si, node, dvbi.e_DVBTDeliveryParameters, parseDVBTDeliveryParameters);
		addSimpleElement(si, node, dvbi.e_SATIPDeliveryParameters);
		addElement(si, node, dvbi.e_DVBSDeliveryParameters, parseDVBSDeliveryParameters);
		addElement(si, node, dvbi.e_DVBCDeliveryParameters, parseDVBCDeliveryParameters);
		addElement(si, node, dvbi.e_DASHDeliveryParameters, parseDASHDeliveryParameters);
		addElement(si, node, dvbi.e_RTSPDeliveryParameters, parseRTSPDeliveryParametersType);
		addElement(si, node, dvbi.e_MulticastTSDeliveryParameters, parseMulticastTSDeliveryParametersType);
		addXMLElement(si, node, dvbi.e_OtherDeliveryParameters);
		addAttribute(si, node, dvbi.a_priority, { type: NUMBER, default: 0 });
		addAttribute(si, node, dvbi.a_id, { type: NUMBER, default: 0 });
		addLangAttribute(si, node);
	}
	return si;
};

let addService = (res, node) => {
	let parseNVODType = (node) => {
		let nv = {};
		addAttribute(nv, node, dvbi.a_mode);
		addAttribute(nv, node, dvbi.a_reference);
		addAttribute(nv, node, dvbi.a_offset, { default: "PT0S" });
		return nv;
	};
	let parseServiceProminenceListType = (node) => {
		let pl = {};
		let parseProminance = (node) => {
			let prom = {};
			addElementBase(prom, node);
			addAttribute(prom, node, dvbi.a_country);
			addAttribute(prom, node, dvbi.a_region);
			addAttribute(prom, node, dvbi.a_ranking, { type: NUMBER });
			return prom;
		};
		addElements(pl, node, dvbi.e_Prominence, parseProminance);
		return pl;
	};
	let parseParentalRating = (node) => {
		let pr = {};
		addElements(pr, node, dvbi.e_MinimumAge, function parseMinimumAge(node) {
			let ma = {};
			addElementBase(ma, node, { type: NUMBER });
			addCountries(ma, node, dvbi.a_countryCodes, "Countries");
			return ma;
		});
		return pr;
	};

	let newSvc = {};
	newSvc.isTestService = node.tagName == dvbi.e_TestService;
	addSimpleElement(newSvc, node, dvbi.e_UniqueIdentifier);
	addElements(newSvc, node, dvbi.e_ServiceInstance, parseServiceInstance);
	addElements(newSvc, node, dvbi.e_TargetRegion, parseTextValue);
	addMultiLingual(newSvc, node, dvbi.e_ServiceName);
	addMultiLingual(newSvc, node, dvbi.e_ProviderName);
	addElements(newSvc, node, dvbi.e_RelatedMaterial, parseRelatedMaterialType);
	addElements(newSvc, node, dvbi.e_ServiceGenre, parseGenre);
	addControlledTermType(newSvc, node, dvbi.e_ServiceType);
	addElements(newSvc, node, dvbi.e_ServiceDescription, parseSynopsisType);
	addControlledTermType(newSvc, node, dvbi.e_RecordingInfo);
	addElement(newSvc, node, dvbi.e_ContentGuideSource, parseContentGuideSource);
	addSimpleElement(newSvc, node, dvbi.e_ContentGuideSourceRef);
	addSimpleElement(newSvc, node, dvbi.e_ContentGuideServiceRef);
	addXMLElements(newSvc, node, dvbi.e_AdditionalServiceParameters);
	addElements(newSvc, node, dvbi.e_NVOD, parseNVODType);
	addElement(newSvc, node, dvbi.e_e_ProminenceList, parseServiceProminenceListType);
	addElement(newSvc, node, dvbi.e_ParentalRating, parseParentalRating);
	addAttribute(newSvc, node, dvbi.a_dynamic, { type: BOOLEAN, default: false });
	addAttribute(newSvc, node, dvbi.a_version, { type: NUMBER });
	addAttribute(newSvc, node, dvbi.a_replayAvailable, { type: BOOLEAN, default: false });
	addLangAttribute(newSvc, node);

	if (!Object.prototype.hasOwnProperty.call(res, dvbi.e_Service)) res[dvbi.e_Service] = [];
	res[dvbi.e_Service].push(newSvc);
};

export function MakeJS_SL(SL) {
	let res = {};

	if (datatypeIs(SL, "string")) {
		try {
			let parseOpts = {
				/**
				 * locator is always need for error position info
				 */
				locator: {},
				/**
				 * you can override the errorHandler for xml parser
				 * @link http://www.saxproject.org/apidoc/org/xml/sax/ErrorHandler.html
				 */
				errorHandler: {
					warning: function (w) {
						console.warn(w);
					},
					error: function (w) {
						console.warn(w);
					},
					fatalError: function (w) {
						console.warn(w);
					},
				},
				//only callback model
				//errorHandler:function(level,msg){console.log(level,msg)}
			};
			SL = new DOMParser(parseOpts).parseFromString(SL);
		} catch (err) {
			return `XML parsing failed: ${err.message}`;
		}
	}

	let parseLanguageListType = (node) => {
		let ll = {};
		addElements(ll, node, dvbi.e_Language, parseTextValue);
		return ll;
	};

	let parseRegionListType = (node) => {
		let parseRegion = (node) => {
			let r = {};
			if (node) {
				addAttribute(r, node, dvbi.a_regionID);
				addAttribute(r, node, dvbi.a_selectable, { type: BOOLEAN, default: true });
				addLangAttribute(r, node);
				addCountries(r, node, dvbi.a_countryCodes, "Countries");
				addMultiLingual(r, node, dvbi.e_RegionName);
				//TODO Region.Postcode and Region.WildcardPostcode and  Region.PostcodeRange and  Region.Coordinates
				/*		for (const elem of node.children) {
					let loc = {};
					switch (elem.tagName) {
						case dvbi.e_Postcode:
							loc[dvbi.e_Postcode] = elem.nodeValue;
							break;
						case dvbi.e_WildcardPostcode:
							loc[dvbi.e_WildcardPostcode] = elem.nodeValue;
							break;
						case dvbi.e_PostcodeRange:
							addAttribute(loc, elem, dvbi.a_from);
							addAttribute(loc, elem, dvbi.a_to);
							break;
						case dvbi.e_Coordinates:
							addSimpleElement(loc, elem, dvbi.e_Latitude, { type: NUMBER });
							addSimpleElement(loc, elem, dvbi.e_Longitude, { type: NUMBER });
							addSimpleElement(loc, elem, dvbi.e_Radius, { type: NUMBER });
							break;
					}
					if (!isEmpty(loc)) {
						if (!Object.prototype.hasOwnProperty.call(r, "Location")) r.Location = [];
						r.Location.push(loc);
					}
				} */
				addElements(r, node, dvbi.e_Region, parseRegion);
			}
			return r;
		};
		let rl = {};
		addElements(rl, node, dvbi.e_Region, parseRegion);
		addAttribute(rl, node, dvbi.a_version, { type: NUMBER });
		addLangAttribute(rl, node);
		return rl;
	};
	let parseLCNTableList = (node) => {
		let ltl = {};
		let parseLCNTableType = (node) => {
			let lcnt = {};
			addElements(lcnt, node, dvbi.e_TargetRegion, parseTextValue);
			addElements(lcnt, node, dvbi.e_SubscriptionPackage, parseTextualType);
			addElements(lcnt, node, dvbi.e_LCN, parseLCNTableEntryType);
			return lcnt;
		};
		addElements(ltl, node, dvbi.e_LCNTable, parseLCNTableType);
		return ltl;
	};

	let parseSubscriptionPackageListType = (node) => {
		let spl = {};
		addAttribute(spl, node, dvbi.a_allowNoPackage, { type: BOOLEAN, default: true });
		addElements(spl, node, dvbi.e_SubscriptionPackage, parseTextualType);
		return spl;
	};

	switch (SL.documentElement.tagName) {
		case dvbi.e_ServiceList:
			let tSL = SL.documentElement;
			addAttribute(res, tSL, tva.a_lang);
			addAttribute(res, tSL, dvbi.a_version, { type: NUMBER });
			addAttribute(res, tSL, dvbi.a_responseStatus);
			addMultiLingual(res, tSL, dvbi.e_Name);
			/*addMultiLingual(res, tSL, dvbi.e_ProviderName);
			addElement(res, tSL, dvbi.e_LanguageList, parseLanguageListType);
			addElements(res, tSL, dvbi.e_RelatedMaterial, parseRelatedMaterialType);
			addElement(res, tSL, dvbi.e_RegionList, parseRegionListType);
			addElements(res, tSL, dvbi.e_TargetRegion, parseTextValue);
			addElement(res, tSL, dvbi.e_LCNTableList, parseLCNTableList);
			// ServiceList.ContentGuideSourceList
			let cgsl = hasElement(tSL, dvbi.e_ContentGuideSourceList);
			if (cgsl) {
				res[dvbi.e_ContentGuideSource] = [];
				let cgs = cgsl.getElementsByTagName(dvbi.e_ContentGuideSource);
				for (let i = 0; i < cgs.length; i++) res[dvbi.e_ContentGuideSource].push(parseContentGuideSource(cgs[i]));
			}
			// ServiceList.ContentGuideSource
			let cgs = hasElement(tSL, dvbi.e_ContentGuideSource);
			if (cgs) {
				if (!Object.prototype.hasOwnProperty.call(res, dvbi.e_ContentGuideSource)) res[dvbi.e_ContentGuideSource] = [];
				res[dvbi.e_ContentGuideSource].push(parseContentGuideSource(cgs));
			}
			let services = getNamedChildren(tSL, dvbi.e_Service, dvbi.e_TestService);
			//TODO for (const service of services) addService(res, service);
			addElement(res, tSL, dvbi.e_SubscriptionPackageList, parseSubscriptionPackageListType); */
			break;
		case dvbi.e_Playlist:
			break;
		default:
			console.log(`SL root element is ${SL.documentElement.tagName}`.red);
			break;
	}
	return res;
}

/**
 * DVB-I Parsing - Program Guide Data
 */

let parseBaseMemberOfType = (node) => {
	let parseValidPeriodType = (node) => {
		let pt = {};
		addSimpleElement(pt, node, tva.e_ValidFrom);
		addSimpleElement(pt, node, tva.e_ValidTo);
		return pt;
	};
	let bmot = {};
	addAttribute(bmot, node, tva.a_crid);
	addElements(bmot, node, tva.e_TimeLimitation, parseValidPeriodType);
	addAttribute(bmot, node, tva.a_index);
	return bmot;
};
let parseMemberOf = (node) => parseBaseMemberOfType(node);
let parseEpisodeOf = (node) => parseBaseMemberOfType(node);

let parseExplanationType = (node) => {
	let et = parseTextualType(node);
	addAttribute(et, node, tva.a_length);
	return et;
};

let parseTVAParentalGuidanceType = (node) => {
	let pg = parseMPEG7ParentalGuidanceType(node);
	addElements(pg, node, tva.e_ExplanatoryText, parseExplanationType);
	return pg;
};

let parseKeywordType = (node) => {
	let kw = parseTextualType(node);
	addAttribute(kw, node, tva.a_type);
	addAttribute(kw, node, tva.a_metadataOriginIDRef);
	return kw;
};

let parseTVAIDRefElementType = (node) => {
	let ir = {};
	addAttribute(ir, node, tva.a_ref);
	return ir;
};

let parseTVAAgentType = (node) => {
	let agent = {};
	addElement(agent, node, tva.e_PersonName, parseTVAPersonNameType);
	addElement(agent, node, tva.e_PersonNameIDRef, parseTVAIDRefElementType);
	addElement(agent, node, tva.e_BiographicalInformation, function parseBiographicalInformation(node) {
		let bi = {};
		addSimpleElement(bi, node, tva.e_BirthDate);
		addSimpleElement(bi, node, tva.e_DeathDate);
		addSimpleElements(bi, node, tva.e_Nationality);
		addSimpleElements(bi, node, tva.e_Occupation);
		return bi;
	});
	addElement(agent, node, tva.e_OrganizationName, parseTextualType);
	addElement(agent, node, tva.e_OrganizationNameIDRef, parseTVAIDRefElementType);
	addElements(agent, node, tva.e_RelatedPerson, function parseRelatedPerson(node) {
		let related = {};
		addElement(related, node, tva.e_PersonName, parseTVAPersonNameType);
		addElement(related, node, tva.e_PersonNameIDRef, parseTVAIDRefElementType);
		addAttribute(related, node, tva.a_relationship);
		return related;
	});
	addElements(agent, node, tva.e_RelatedPOrganization, function parseRelatedOrganization(node) {
		let related = {};
		addElement(related, node, tva.e_OrganizationName, parseTextualType);
		addElement(related, node, tva.e_OrganizationNameIDRef, parseTVAIDRefElementType);
		addAttribute(related, node, tva.a_relationship);
		return related;
	});
	return agent;
};

let parseTVAPersonNameType = (node) => {
	let person = parseMPEG7PersonNameType(node);
	addElements(person, node, tva.e_OtherIdentifier, parseUniqueIDType);
	addElements(person, node, tva.e_RelatedMaterial, parseRelatedMaterialType);
	addElements(person, node, tva.e_AdditionalInformation, parseTextualType);
	addAttribute(person, node, tva.a_nameType);
	return person;
};

let parseCreditsItemType = (node) => {
	let ci = parseTVAAgentType(node);
	addElements(ci, node, tva.e_Character, parseMPEG7PersonNameType);
	addElements(ci, node, tva.e_PresentationRole, parseTextualType);
	addElements(ci, node, tva.e_RelatedMaterial, parseRelatedMaterialType);
	addAttribute(ci, node, tva.a_role);
	addAttribute(ci, node, tva.a_index, { type: NUMBER });
	return ci;
};

let parseBasicDescription = (node) => {
	let bd = {};
	addElements(bd, node, tva.e_Title, parseTitleType);
	addElements(bd, node, tva.e_Synopsis, parseSynopsisType);
	addElements(bd, node, tva.e_Keyword, parseKeywordType);
	addElements(bd, node, tva.e_Genre, parseGenre);
	addElements(bd, node, tva.e_ParentalGuidance, parseTVAParentalGuidanceType);
	addElements(bd, hasElement(node, tva.e_CreditsList), tva.e_CreditsItem, parseCreditsItemType);
	addElements(bd, node, tva.e_RelatedMaterial, parseRelatedMaterialType);
	return bd;
};

let parseProgramInformationTableType = (node) => {
	let parseProgramInformationType = (node) => {
		let pi = {};
		addAttribute(pi, node, tva.a_programId);
		addLangAttribute(pi, node);
		addElement(pi, node, tva.e_BasicDescription, parseBasicDescription);
		addElements(pi, node, tva.e_OtherIdentifier, parseUniqueIDType);
		addElements(pi, node, tva.e_MemberOf, parseMemberOf);
		addElements(pi, node, tva.e_EpisodeOf, parseEpisodeOf);
		return pi;
	};
	let pit = {};
	addLangAttribute(pit, node);
	addElements(pit, node, tva.e_ProgramInformation, parseProgramInformationType);
	return pit;
};

let parseFlagType = (node) => {
	let flag = {};
	addAttribute(flag, node, tva.a_value, { type: BOOLEAN });
	return flag;
};

let parseCRIDRefType = (node) => {
	let crt = {};
	addAttribute(crt, node, tva.a_crid);
	return crt;
};

let parseInstanceDescriptionType = (node) => {
	let id = {};
	addElements(id, node, tva.e_Genre, parseGenre);
	addElement(id, node, tva.e_CaptionLanguage, parseCaptionLanguageType);
	addElement(id, node, tva.e_SignLanguage, parseSignLanguageType);
	addElement(id, node, tva.e_AVAttributes, parseAVAttributesType);
	addElements(id, node, tva.e_OtherIdentifier, parseUniqueIDType);
	addElements(id, node, tva.e_RelatedMaterial, parseRelatedMaterialType);
	return id;
};
let parseProgramLocationType = (node) => {
	let pl = {};
	addElement(pl, node, tva.e_Program, parseCRIDRefType);
	addElements(pl, node, tva.e_ProgramURL, parseExtendedURIType_TVA);
	addElements(pl, node, tva.AuxiliaryURL, parseExtendedURIType_TVA);
	addElements(pl, node, tva.e_InstanceDescription, parseInstanceDescriptionType);
	return pl;
};

let parseScheduleType = (node) => {
	let parseScheduleEventType = (node) => {
		let se = parseProgramLocationType(node);
		addSimpleElement(se, node, tva.e_PublishedStartTime);
		addSimpleElement(se, node, tva.e_PublishedDuration);
		addSimpleElement(se, node, tva.e_ActualStartTime);
		addSimpleElement(se, node, tva.e_ActualDuration);
		addElement(se, node, tva.e_FirstShowing, parseFlagType);
		addElement(se, node, tva.e_Free, parseFlagType);
		return se;
	};
	let s = {};
	addAttribute(s, node, tva.a_serviceIDRef);
	addAttribute(s, node, tva.a_start);
	addAttribute(s, node, tva.a_end);
	addElements(s, node, tva.e_ScheduleEvent, parseScheduleEventType);
	return s;
};

let parseOnDemandProgramType = (node) => {
	let od = {};
	addAttribute(od, node, tva.a_serviceIDRef);
	addSimpleElement(od, node, tva.e_PublishedDuration);
	addSimpleElement(od, node, tva.e_StartOfAvailability);
	addSimpleElement(od, node, tva.e_EndOfAvailability);
	addSimpleElement(od, node, tva.e_DeliveryMode);
	addElement(od, node, tva.e_Free, parseFlagType);
	return od;
};

let parseProgramGroupTypeType = (node) => {
	let parseBaseProgramGroupTypeType = (/* eslint-disable no-unused-vars*/ node /* eslint-enable */) => {
		return {};
	};
	let pgtt = parseBaseProgramGroupTypeType(node);
	addAttribute(pgtt, node, tva.a_type);
	addAttribute(pgtt, node, tva.a_value);
	return pgtt;
};

let parseProgramLocationTableType = (node) => {
	let plt = {};
	addLangAttribute(plt, node);
	addElements(plt, node, tva.e_Schedule, parseScheduleType);
	addElements(plt, node, tva.e_OnDemandProgram, parseOnDemandProgramType);
	return plt;
};

let parseGroupInformation = (node) => {
	let gi = {};
	addAttribute(gi, node, tva.a_groupId);
	addAttribute(gi, node, tva.a_ordered);
	addAttribute(gi, node, tva.a_numOfItems);
	addAttribute(gi, node, tva.a_serviceIDRef);
	addElement(gi, node, tva.e_GroupType, parseProgramGroupTypeType);
	addElement(gi, node, tva.e_BasicDescription, parseBasicDescription);
	addElement(gi, node, tva.e_MemberOf, parseMemberOf);
	return gi;
};

let parseGroupInformationTable = (node) => {
	let git = {};
	addLangAttribute(git, node);
	addElements(git, node, tva.e_GroupInformation, parseGroupInformation);
	return git;
};

let parseTVAProgramDescription = (node) => {
	let pd = {};
	addElement(pd, node, tva.e_ProgramInformationTable, parseProgramInformationTableType);
	addElement(pd, node, tva.e_ProgramLocationTable, parseProgramLocationTableType);
	addElement(pd, node, tva.e_GroupInformationTable, parseGroupInformationTable);
	return pd;
};

export function MakeJS_CG(CG) {
	let res = {};

	if (datatypeIs(CG, "string")) {
		try {
			CG = new DOMParser().parseFromString(CG);
		} catch (err) {
			return `XML parsing failed: ${err.message}`;
		}
	}

	if (CG.tagName == tva.e_TVAMain) {
		// TAVMain@lang
		addAttribute(res, CG, tva.a_lang);
		addElement(res, CG, tva.e_ProgramDescription, parseTVAProgramDescription);
	} else console.log(`CG root element is ${CG.tagName}`.red);

	return res;
}
