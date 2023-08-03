import { parseXmlString } from "libxmljs2";

import { datatypeIs } from "./phlib/phlib.js";
import { mpeg7 } from "./MPEG7_definitions.js";
import { tva } from "./TVA_definitions.js";
import { dvbi } from "./DVB-I_definitions.js";

import { xPath, hasElement, isEmpty } from "./utils.js";

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

let parseTextValue = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => (node ? node.text() : null);

let addElements = (res, node, elementName, props, parserFunc) => {
	if (!hasElement(node, elementName)) return;
	if (!Object.prototype.hasOwnProperty.call(res, elementName)) res[elementName] = [];
	let i = 0,
		g;
	while ((g = node.get(xPath(props.prefix, elementName, ++i), props.schema)) != null) {
		res[elementName].push(parserFunc(g, props));
	}
};

let addElement = (res, node, elementNme, props, parserFunc) => {
	let tmp = hasElement(node, elementNme);
	if (tmp) res[elementNme] = parserFunc(tmp, props);
};

/**
 * XML Parsing
 */
let addAttribute = (res, node, attrName, opts = { type: STRING, default: null }) => {
	if (node && node.attr(attrName)) res[attrName] = convertType(node.attr(attrName).value(), opts.type);
	else if (opts.default) res[attrName] = opts.default;
};

let addSimpleElement = (res, node, elementName, opts = { type: STRING }) => {
	if (!hasElement(node, elementName)) return;
	res[elementName] = convertType(parseTextValue(hasElement(node, elementName)), opts.type);
};

let addSimpleElements = (res, node, elementName, props, opts = { type: STRING }) => {
	if (!hasElement(node, elementName)) return;
	if (!Object.prototype.hasOwnProperty.call(res, elementName)) res[elementName] = [];
	let i = 0,
		g;
	while ((g = node.get(xPath(props.prefix, elementName, ++i), props.schema)) != null) res[elementName].push(convertType(parseTextValue(g, props), opts.type));
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

let addXMLElements = (res, node, elementName, props) => {
	if (!hasElement(node, elementName)) return;
	if (!Object.prototype.hasOwnProperty.call(res, elementName)) res[elementName] = [];
	let i = 0,
		g;
	while ((g = node.get(xPath(props.prefix, elementName, ++i), props.schema)) != null) res[elementName].push(g.toString({ declaration: false, format: true }));
};

/**
 * MPEG-7 Parsing
 */
let parseUniqueIDType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let id = {};
	addElementBase(id, node);
	addAttribute(id, node, mpeg7.a_type, { default: "URI" });
	addAttribute(id, node, mpeg7.a_organization);
	addAttribute(id, node, mpeg7.a_authority);
	addAttribute(id, node, mpeg7.a_encoding, { default: mpeg7.ID_ENCODING_TEXT });
	return id;
};

let parseTextualBaseType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let tbt = {};
	addElementBase(tbt, node);
	addLangAttribute(tbt, node);
	return tbt;
};

let parseTextualType = (node, props) => parseTextualBaseType(node, props);

let parseTitleType = (node, props) => {
	let tt = parseTextualType(node, props);
	addAttribute(tt, node, mpeg7.a_type, { default: mpeg7.TITLE_TYPE_MAIN });
	return tt;
};

let parseExtendedLanguageType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let lang = {};
	addElementBase(lang, node);
	addAttribute(lang, node, mpeg7.a_type, { default: "original" });
	addAttribute(lang, node, mpeg7.a_supplemental, { type: BOOLEAN, default: false });
	return lang;
};

let parseInlineMediaType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let im = {};
	addSimpleElement(im, node, mpeg7.e_MediaData16);
	addSimpleElement(im, node, mpeg7.e_MediaData64);
	addAttribute(im, node, mpeg7.a_type);
	return im;
};

let parseMediaLocatorType = (node, props) => {
	let ml = {};
	addSimpleElement(ml, node, mpeg7.e_MediaUri);
	addElement(ml, node, mpeg7.e_InlineMedia, props, parseInlineMediaType);
	return ml;
};

let parseBytePosition = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let bp = {};
	addAttribute(bp, node, mpeg7.a_offset, { type: NUMBER });
	addAttribute(bp, node, mpeg7.a_length, { type: NUMBER });
	return bp;
};

let parseImageLocatorType = (node, props) => {
	let il = parseMediaLocatorType(node, props);
	addSimpleElement(il, node, mpeg7.e_MediaTimePoint);
	addElement(il, node, mpeg7.e_BytePosition, props, parseBytePosition);
	return il;
};

let parseTemporalSegmentLocatorType = (node, props) => {
	let ts = parseMediaLocatorType(node, props);
	addSimpleElement(ts, node, mpeg7.e_MediaTimePoint);
	addElement(ts, node, mpeg7.e_BytePosition, props, parseBytePosition);
	return ts;
};

let parseTitleMediaType = (node, props) => {
	let tm = {};
	addElement(tm, node, mpeg7.e_TitleImage, props, parseImageLocatorType);
	addElement(tm, node, mpeg7.e_TitleVideo, props, parseTemporalSegmentLocatorType);
	addElement(tm, node, mpeg7.e_TitleAudio, props, parseTemporalSegmentLocatorType);
	return tm;
};

let parseMPEG7ParentalGuidanceType = (node, props) => {
	let pg = {};
	addControlledTermType(pg, node, mpeg7.e_ParentalRating, props);
	addSimpleElement(pg, node, mpeg7.e_MinimumAge, { type: NUMBER });
	addSimpleElements(pg, node, mpeg7.e_Region, props);
	return pg;
};

let parseMPEG7PersonNameType = (node, props) => {
	let person = {};
	let parseNameComponentType = (node, props) => {
		let nc = parseTextualBaseType(node, props);
		addAttribute(nc, node, mpeg7.a_initial);
		addAttribute(nc, node, mpeg7.a_abbrev);
		return nc;
	};
	node.childNodes().forEachSubElement((c) => {
		switch (c.name()) {
			case mpeg7.e_GivenName:
				if (!Object.prototype.hasOwnProperty.call(person, mpeg7.e_GivenName)) person[mpeg7.e_GivenName] = [];
				person[mpeg7.e_GivenName].push(parseNameComponentType(c, props));
				break;
			case mpeg7.e_LinkingName:
				if (!Object.prototype.hasOwnProperty.call(person, mpeg7.e_LinkingName)) person[mpeg7.e_LinkingName] = [];
				person[mpeg7.e_LinkingName].push(parseNameComponentType(c, props));
				break;
			case mpeg7.e_FamilyName:
				if (!Object.prototype.hasOwnProperty.call(person, mpeg7.e_FamilyName)) person[mpeg7.e_FamilyName] = [];
				person[mpeg7.e_FamilyName].push(parseNameComponentType(c, props));
				break;
			case mpeg7.e_Title:
				if (!Object.prototype.hasOwnProperty.call(person, mpeg7.e_Title)) person[mpeg7.e_Title] = [];
				person[mpeg7.e_Title].push(parseNameComponentType(c, props));
				break;
			case mpeg7.e_Salutation:
				if (!Object.prototype.hasOwnProperty.call(person, mpeg7.e_Salutation)) person[mpeg7.e_Salutation] = [];
				person[mpeg7.e_Salutation].push(parseNameComponentType(c, props));
				break;
			case mpeg7.e_Numeration:
				if (!Object.prototype.hasOwnProperty.call(person, mpeg7.e_Numeration)) person[mpeg7.e_Numeration] = [];
				person[mpeg7.e_Numeration].push(parseNameComponentType(c, props));
				break;
		}
	});
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
	if (node.type() != "element") return "**";
	if (node.attr(tva.a_lang)) return node.attr(tva.a_lang).value();
	return ansectorLanguage(node.parent());
}

let addLangAttribute = (res, node) => {
	addAttribute(res, node, tva.a_lang);
	if (!res[tva.a_lang]) res[tva.a_lang] = ansectorLanguage(node);
};

let parseTermNameType = (node, props) => {
	let tnt = parseTextualType(node, props);
	addAttribute(tnt, node, tva.a_preferred);
	return tnt;
};

let parseControlledTermType = (node, props) => {
	let ct = {};
	addAttribute(ct, node, tva.a_href);
	addElement(ct, node, tva.e_Name, props, parseTermNameType);
	addElement(ct, node, tva.e_Definition, props, parseTextualType);
	return ct;
};

let addControlledTermType = (res, node, elementName, props) => {
	addElement(res, node, elementName, props, parseControlledTermType);
};

let addMultiLingual = (res, node, elementName, props) => {
	addElements(res, node, elementName, props, parseTextualType);
};

let parseBitRateType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let br = {};
	addElementBase(br, node, { type: NUMBER });
	addAttribute(br, node, tva.a_variable, { type: BOOLEAN, default: false });
	addAttribute(br, node, tva.a_minimum, { type: NUMBER });
	addAttribute(br, node, tva.a_average, { type: NUMBER });
	addAttribute(br, node, tva.a_maximum, { type: NUMBER });
	return br;
};

let parseAudioLanguageType = (node, props) => {
	let alang = parseExtendedLanguageType(node, props);
	addAttribute(alang, node, tva.a_purpose);
	return alang;
};

let parseAudioAttributesType = (node, props) => {
	let newAA = {};
	addControlledTermType(newAA, node, tva.e_Coding, props);
	addSimpleElement(newAA, node, tva.e_NumOfChannels, { type: NUMBER });
	addControlledTermType(newAA, node, tva.e_MixType, props);
	addElement(newAA, node, tva.e_AudioLanguage, props, parseAudioLanguageType);
	addSimpleElement(newAA, node, tva.e_SampleFrequency, { type: NUMBER });
	addSimpleElement(newAA, node, tva.e_BitsPerSample, { type: NUMBER });
	addElement(newAA, node, tva.e_BitRate, props, parseBitRateType);
	return newAA;
};

let parseTVAVideoAttributesType = (node, props) => {
	let newVA = {};
	addControlledTermType(newVA, node, tva.e_Coding, props);
	addSimpleElement(newVA, node, tva.e_Scan);
	addSimpleElement(newVA, node, tva.e_HorizontalSize, { type: NUMBER });
	addSimpleElement(newVA, node, tva.e_VerticalSize, { type: NUMBER });
	addSimpleElement(newVA, node, tva.e_AspectRatio);
	addElement(newVA, node, tva.e_Color, props, parseColorType);
	addSimpleElement(newVA, node, tva.e_FrameRate);
	addElement(newVA, node, tva.e_BitRate, props, parseBitRateType);
	addControlledTermType(newVA, node, tva.e_PictureFormat, props);
	addControlledTermType(newVA, node, dvbi.e_Colorimetry, props);
	return newVA;
};

let parseCaptioningAttributesType = (node, props) => {
	let ca = {};
	addControlledTermType(ca, node, tva.e_Coding, props);
	addElement(ca, node, tva.e_BitRate, props, parseBitRateType);
	return ca;
};

let parseAVAttributesType = (node, props) => {
	let avattr = {};
	addControlledTermType(avattr, node, tva.e_FileFormat, props);
	addSimpleElement(avattr, node, tva.e_FileSize, { type: NUMBER });
	addControlledTermType(avattr, node, tva.e_System, props);
	addElements(avattr, node, tva.e_BitRate, props, parseBitRateType);
	addElements(avattr, node, tva.e_AudioAttributes, props, parseAudioAttributesType);
	addElement(avattr, node, tva.e_VideoAttributes, props, parseTVAVideoAttributesType);
	addElements(avattr, node, tva.e_CaptioningAttributes, props, parseCaptioningAttributesType);
	return avattr;
};

let parseColorType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let ct = {};
	addAttribute(ct, node, tva.a_type);
	return ct;
};

let parseExtendedURIType_TVA = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let eURI = {};
	addElementBase(eURI, node);
	addAttribute(eURI, node, tva.a_contentType);
	addAttribute(eURI, node, tva.a_uriType);
	return eURI;
};

let parseTVAMediaLocatorType = (node, props) => {
	let ml = {};
	addElement(ml, node, tva.e_MediaUri, props, parseExtendedURIType_TVA);
	return ml;
};

let parseSegmentReferenceType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let sr = {};
	addAttribute(sr, node, tva.a_segmentType, { default: "segment" });
	addAttribute(sr, node, tva.a_ref);
	return sr;
};

let parseRelatedMaterialType = (node, props) => {
	let rm = {};
	addLangAttribute(rm, node);
	rm[tva.e_HowRelated] = null;
	addControlledTermType(rm, node, tva.e_HowRelated, props);
	addElement(rm, node, tva.e_Format, props, function parseFormat(node2, props2) {
		let fmt = {};
		addElement(fmt, node2, tva.e_AVAttributes, props2, parseAVAttributesType);
		addElement(fmt, node2, tva.e_StillPictureFormat, props2, function parseStillPictureFormat(node3, /* eslint-disable no-unused-vars*/ props3 /* eslint-enable */) {
			let spf = parseControlledTermType(node, props);
			addAttribute(spf, node3, tva.a_horizontalSize, { type: NUMBER });
			addAttribute(spf, node3, tva.a_verticalSize, { type: NUMBER });
			return spf;
		});
		return fmt;
	});
	addElements(rm, node, tva.e_MediaLocator, props, parseTVAMediaLocatorType);
	addElement(rm, node, tva.e_SegmentReference, props, parseSegmentReferenceType);
	addElements(rm, node, tva.e_PromotionalText, props, parseTextualType);
	addElements(rm, node, tva.e_PromotionalMedia, props, parseTitleMediaType);
	addElement(rm, node, tva.e_SocialMediaReference, props, function smrType(node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) {
		let sm = {};
		addElementBase(sm, node);
		addAttribute(sm, node, tva.a_referenceType);
		return sm;
	});
	addElement(rm, node, tva.e_SourceMediaLocator, props, parseMediaLocatorType);
	return rm;
};

let parseCaptionLanguageType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let cl = {};
	addAttribute(cl, node, tva.a_primary);
	addAttribute(cl, node, tva.a_translation);
	addAttribute(cl, node, tva.a_closed, { type: BOOLEAN, default: true });
	addAttribute(cl, node, tva.a_supplemental, { type: BOOLEAN, defaut: false });
	return cl;
};

let parseSignLanguageType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let sl = {};
	addAttribute(sl, node, tva.a_primary);
	addAttribute(sl, node, tva.a_translation);
	addAttribute(sl, node, tva.a_type);
	addAttribute(sl, node, tva.a_closed);
	return sl;
};

let parseGenre = (node, props) => {
	let g = parseControlledTermType(node, props);
	addAttribute(g, node, tva.a_type, { default: tva.GENRE_TYPE_MAIN });
	return g;
};

let parseSynopsisType = (node, props) => {
	let st = parseTextualType(node, props);
	addAttribute(st, node, tva.a_length);
	return st;
};

/**
 * DVB-I Parsing - Service List
 */

let parseVideoAttributesType = (node, props) => {
	let newVA = parseTVAVideoAttributesType(node, props);
	addControlledTermType(newVA, node, dvbi.e_Colorimetry, props);
	return newVA;
};

let parseExtendedURIType_DVB = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let eURI = {};
	addSimpleElement(eURI, node, dvbi.e_URI);
	addAttribute(eURI, node, dvbi.a_contentType);
	return eURI;
};

let addCountries = (res, node, attributeName, property) => {
	if (node.attr(attributeName)) res[property] = node.attr(attributeName).value().split(",");
};

let parseContentGuideSource = (node, props) => {
	let cg = {};
	addAttribute(cg, node, dvbi.a_CGSID);
	addAttribute(cg, node, dvbi.a_minimumMetadataUpdatePeriod);
	addMultiLingual(cg, node, dvbi.e_Name, props);
	addMultiLingual(cg, node, dvbi.e_ProviderName, props);
	addElements(cg, node, dvbi.e_RelatedMaterial, props, parseRelatedMaterialType);
	addElement(cg, node, dvbi.e_ScheduleInfoEndpoint, props, parseExtendedURIType_DVB);
	addElement(cg, node, dvbi.e_ProgramInfoEndpoint, props, parseExtendedURIType_DVB);
	addElement(cg, node, dvbi.e_GroupInfoEndpoint, props, parseExtendedURIType_DVB);
	addElement(cg, node, dvbi.e_MoreEpisodesEndpoint, props, parseExtendedURIType_DVB);
	return cg;
};

let parseDVBTriplet = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let triplet = {};
	addAttribute(triplet, node, dvbi.a_origNetId, { type: NUMBER });
	addAttribute(triplet, node, dvbi.a_tsId, { type: NUMBER });
	addAttribute(triplet, node, dvbi.a_serviceId, { type: NUMBER });
	return triplet;
};

let parseDVBTDeliveryParameters = (node, props) => {
	let dt = {};
	addElement(dt, node, dvbi.e_DVBTriplet, props, parseDVBTriplet);
	addSimpleElement(dt, node, dvbi.e_TargetCountry);
	return dt;
};

let parseDVBSDeliveryParameters = (node, props) => {
	let ds = {};
	addElement(ds, node, dvbi.e_DVBTriplet, props, parseDVBTriplet);
	addSimpleElement(ds, node, dvbi.e_OrbitalPosition, { type: NUMBER });
	addSimpleElement(ds, node, dvbi.e_Frequency, { type: NUMBER });
	addSimpleElement(ds, node, dvbi.e_Polarization);
	addSimpleElement(ds, node, dvbi.e_SymbolRate, { type: NUMBER });
	addSimpleElement(ds, node, dvbi.e_RollOff);
	addSimpleElement(ds, node, dvbi.e_ModulationSystem);
	addSimpleElement(ds, node, dvbi.e_FEC);
	addSimpleElement(ds, node, dvbi.e_ModcodMode);
	addSimpleElement(ds, node, dvbi.e_InputStreamIdentifier, { type: NUMBER });

	let parseFrequency = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
		let newFreq = {};
		addElementBase(newFreq, node, { type: NUMBER });
		addAttribute(newFreq, node, dvbi.a_primary, { type: BOOLEAN, default: false });
		return newFreq;
	};
	let parseChannelBonding = (node, props) => {
		let cb = {};
		addElements(cb, node, dvbi.e_Frequency, props, parseFrequency);
		return cb;
	};
	addElement(ds, node, dvbi.e_ChannelBonding, props, parseChannelBonding);
	return ds;
};

let parseDVBCDeliveryParameters = (node, props) => {
	let dc = {};
	addElement(dc, node, dvbi.e_DVBTriplet, props, parseDVBTriplet);
	addSimpleElement(dc, node, dvbi.e_TargetCountry);
	addSimpleElement(dc, node, dvbi.e_NetworkID, { type: NUMBER });
	return dc;
};

let parseDASHDeliveryParameters = (node, props) => {
	let dd = {};
	addElement(dd, node, dvbi.e_UriBasedLocation, props, parseExtendedURIType_DVB);
	addSimpleElement(dd, node, dvbi.e_MinimumBitRate, { type: NUMBER });
	addXMLElements(dd, node, dvbi.e_Extension, props);
	return dd;
};

let parseRTSPDeliveryParametersType = (node, props) => {
	let parseRTSPURLType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
		let ru = {};
		addElementBase(ru, node);
		addAttribute(ru, node, dvbi.a_RTSPControlURL);
		return ru;
	};
	let rp = {};
	addElement(rp, node, dvbi.e_DVBTriplet, props, parseDVBTriplet);
	addElement(rp, node, dvbi.e_RTSPURL, props, parseRTSPURLType);
	addSimpleElement(rp, node, dvbi.e_MinimumBitRate, { type: NUMBER });
	return rp;
};

let parseMulticastTSDeliveryParametersType = (node, props) => {
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
	let parseMcastType = (node, props) => {
		let parseFECLayerAddressType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
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
		let parseRETInfoType = (node, props) => {
			let parseRTCPReportingType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
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
			let parseUnicastRETType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
				let ur = {};
				addAttribute(ur, node, dvbi.a_trr_int, { type: NUMBER });
				addAttribute(ur, node, dvbi.a_DestinationPort_ForRTCPReporting, { type: NUMBER });
				addAttribute(ur, node, dvbi.a_SourcePort, { type: NUMBER });
				addAttribute(ur, node, dvbi.a_RTSPControlUR);
				addCommonCastRETType(ur, node);
				return ur;
			};
			let parseMulticastRETType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
				let mr = {};
				addAttribute(mr, node, dvbi.a_SourceAddress);
				addAttribute(mr, node, dvbi.a_GroupAddress);
				addCommonCastRETType(mr, node);
				return mr;
			};
			let ri = {};
			addElement(ri, node, dvbi.e_RTCPReporting, props, parseRTCPReportingType);
			addElement(ri, node, dvbi.e_UnicastRET, props, parseUnicastRETType);
			addElement(ri, node, dvbi.e_MulticastRET, props, parseMulticastRETType);
			return ri;
		};
		let mc = {};
		addElement(mc, node, dvbi.e_FECBaseLayer, props, parseFECLayerAddressType);
		addElements(mc, node, dvbi.e_FECEnhancementLayer, props, parseFECLayerAddressType);
		addSimpleElement(mc, node, dvbi.e_CNAME);
		addSimpleElement(mc, node, dvbi.e_ssrc, { type: NUMBER });
		addElement(mc, node, dvbi.e_RTPRetransmission, props, parseRETInfoType);
		addMulticastAddressAttributes(mc, node);
		return mc;
	};
	let mts = {};
	addElement(mts, node, dvbi.e_DVBTriplet, props, parseDVBTriplet);
	addElement(mts, node, dvbi.e_MulticastTSDeliveryParameters, props, parseMcastType);
	addSimpleElement(mts, node, dvbi.e_MinimumBitRate, { type: NUMBER });
	return mts;
};

let parseLCNTableEntryType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let ent = {};
	addAttribute(ent, node, dvbi.a_channelNumber, { type: NUMBER });
	addAttribute(ent, node, dvbi.a_serviceRef);
	addAttribute(ent, node, dvbi.a_selectable, { type: BOOLEAN, default: true });
	addAttribute(ent, node, dvbi.a_visible, { type: BOOLEAN, default: true });
	return ent;
};

let parseServiceInstance = (node, props) => {
	let parseContentProtectionType = (node, props) => {
		let parseProtectionSystemType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
			let ps = {};
			addElementBase(ps, node);
			addAttribute(ps, node, dvbi.a_cpsIndex);
			return ps;
		};
		let parseCASystemType = (node, props) => parseProtectionSystemType(node, props);
		let parseDRMSystemType = (node, props) => {
			let newDRM = parseProtectionSystemType(node, props);
			addAttribute(newDRM, node, dvbi.a_encryptionScheme);
			return newDRM;
		};
		let cp = {};
		addElements(cp, node, dvbi.e_CASystemId, props, parseCASystemType);
		addElements(cp, node, dvbi.e_DRMSystemId, props, parseDRMSystemType);
		return cp;
	};
	let parseContentAttributesType = (node, props) => {
		let parseAudioConformancePoint = (node, props) => {
			let acp = parseControlledTermType(node, props);
			acp.deprecated = true;
		};
		let ca = {};
		addElements(ca, node, dvbi.e_AudioAttributes, props, parseAudioAttributesType);
		addElements(ca, node, dvbi.e_AudioConformancePoint, props, parseAudioConformancePoint);
		addElements(ca, node, dvbi.e_VideoAttributes, props, parseVideoAttributesType);
		addElement(ca, node, dvbi.e_VideoConformancePoint, props, parseControlledTermType);
		addElements(ca, node, dvbi.e_CaptionLanguage, props, parseCaptionLanguageType);
		addElements(ca, node, dvbi.e_SignLanguage, props, parseSignLanguageType);
		return ca;
	};
	let parseServiceAvailabilityType = (node, props) => {
		let parseAvailabilityPeriod = (node, props) => {
			let parseInterval = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
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
			addElements(period, node, dvbi.e_Interval, props, parseInterval);
			return period;
		};
		let av = {};
		addElements(av, node, dvbi.e_Period, props, parseAvailabilityPeriod);
		return av;
	};
	let parseFTAContentManagementType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
		let fcm = {};
		addAttribute(fcm, node, dvbi.a_userDefined, { type: BOOLEAN });
		addAttribute(fcm, node, dvbi.a_doNotScramble, { type: BOOLEAN });
		addAttribute(fcm, node, dvbi.a_controlRemoteAccessOverInternet, { type: NUMBER });
		addAttribute(fcm, node, dvbi.a_doNotApplyRevocation, { type: BOOLEAN });
		return fcm;
	};
	let si = {};
	if (node) {
		addMultiLingual(si, node, dvbi.e_DisplayName, props);
		addElements(si, node, dvbi.e_RelatedMaterial, props, parseRelatedMaterialType);
		addElements(si, node, dvbi.e_ContentProtection, props, parseContentProtectionType);
		addElement(si, node, dvbi.e_ContentAttributes, props, parseContentAttributesType);
		addElement(si, node, dvbi.e_Availability, props, parseServiceAvailabilityType);
		addElements(si, node, dvbi.e_SubscriptionPackage, props, parseTextualType);
		addElement(si, node, dvbi.e_FTAContentManagement, props, parseFTAContentManagementType);
		addSimpleElement(si, node, dvbi.e_SourceType);
		addElements(si, node, dvbi.e_AltServiceName, props, parseTextValue);
		addElement(si, node, dvbi.e_DVBTDeliveryParameters, props, parseDVBTDeliveryParameters);
		addSimpleElement(si, node, dvbi.e_SATIPDeliveryParameters);
		addElement(si, node, dvbi.e_DVBSDeliveryParameters, props, parseDVBSDeliveryParameters);
		addElement(si, node, dvbi.e_DVBCDeliveryParameters, props, parseDVBCDeliveryParameters);
		addElement(si, node, dvbi.e_DASHDeliveryParameters, props, parseDASHDeliveryParameters);
		addElement(si, node, dvbi.e_RTSPDeliveryParameters, props, parseRTSPDeliveryParametersType);
		addElement(si, node, dvbi.e_MulticastTSDeliveryParameters, props, parseMulticastTSDeliveryParametersType);
		addXMLElement(si, node, dvbi.e_OtherDeliveryParameters);
		addAttribute(si, node, dvbi.a_priority, { type: NUMBER, default: 0 });
		addAttribute(si, node, dvbi.a_id, { type: NUMBER, default: 0 });
		addLangAttribute(si, node);
	}
	return si;
};

let addService = (res, node, props) => {
	let parseNVODType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
		let nv = {};
		addAttribute(nv, node, dvbi.a_mode);
		addAttribute(nv, node, dvbi.a_reference);
		addAttribute(nv, node, dvbi.a_offset, { default: "PT0S" });
		return nv;
	};
	let parseServiceProminenceListType = (node, props) => {
		let pl = {};
		let parseProminance = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
			let prom = {};
			addElementBase(prom, node);
			addAttribute(prom, node, dvbi.a_country);
			addAttribute(prom, node, dvbi.a_region);
			addAttribute(prom, node, dvbi.a_ranking, { type: NUMBER });
			return prom;
		};
		addElements(pl, node, dvbi.e_Prominence, props, parseProminance);
		return pl;
	};
	let parseParentalRating = (node, props) => {
		let pr = {};
		addElements(pr, node, dvbi.e_MinimumAge, props, function parseMinimumAge(node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) {
			let ma = {};
			addElementBase(ma, node, { type: NUMBER });
			addCountries(ma, node, dvbi.a_countryCodes, "Countries");
			return ma;
		});
		return pr;
	};

	let newSvc = {};
	newSvc.isTestService = node.name() == dvbi.e_TestService;
	addSimpleElement(newSvc, node, dvbi.e_UniqueIdentifier);
	addElements(newSvc, node, dvbi.e_ServiceInstance, props, parseServiceInstance);
	addElements(newSvc, node, dvbi.e_TargetRegion, props, parseTextValue);
	addMultiLingual(newSvc, node, dvbi.e_ServiceName, props);
	addMultiLingual(newSvc, node, dvbi.e_ProviderName, props);
	addElements(newSvc, node, dvbi.e_RelatedMaterial, props, parseRelatedMaterialType);
	addElements(newSvc, node, dvbi.e_ServiceGenre, props, parseGenre);
	addControlledTermType(newSvc, node, dvbi.e_ServiceType, props);
	addElements(newSvc, node, dvbi.e_ServiceDescription, props, parseSynopsisType);
	addControlledTermType(newSvc, node, dvbi.e_RecordingInfo, props);
	addElement(newSvc, node, dvbi.e_ContentGuideSource, props, parseContentGuideSource);
	addSimpleElement(newSvc, node, dvbi.e_ContentGuideSourceRef);
	addSimpleElement(newSvc, node, dvbi.e_ContentGuideServiceRef);
	addXMLElements(newSvc, node, dvbi.e_AdditionalServiceParameters, props);
	addElements(newSvc, node, dvbi.e_NVOD, parseNVODType);
	addElement(newSvc, node, dvbi.e_e_ProminenceList, props, parseServiceProminenceListType);
	addElement(newSvc, node, dvbi.e_ParentalRating, props, parseParentalRating);
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
			SL = parseXmlString(SL);
		} catch (err) {
			return `XML parsing failed: ${err.message}`;
		}
	}

	let SL_SCHEMA = {},
		SCHEMA_PREFIX = SL.root().namespace().prefix(),
		SCHEMA_NAMESPACE = SL.root().namespace().href();
	SL_SCHEMA[SCHEMA_PREFIX] = SCHEMA_NAMESPACE;

	let parseLanguageListType = (node, props) => {
		let ll = {};
		addElements(ll, node, dvbi.e_Language, props, parseTextValue);
		return ll;
	};

	let parseRegionListType = (node, props) => {
		let parseRegion = (node, props) => {
			let r = {};
			if (node) {
				addAttribute(r, node, dvbi.a_regionID);
				addAttribute(r, node, dvbi.a_selectable, { type: BOOLEAN, default: true });
				addLangAttribute(r, node);
				addCountries(r, node, dvbi.a_countryCodes, "Countries");
				addMultiLingual(r, node, dvbi.e_RegionName, props);
				// Region.Postcode and Region.WildcardPostcode and  Region.PostcodeRange and  Region.Coordinates
				node.childNodes().forEachSubElement((elem) => {
					let loc = {};
					switch (elem.name()) {
						case dvbi.e_Postcode:
							loc[dvbi.e_Postcode] = elem.text();
							break;
						case dvbi.e_WildcardPostcode:
							loc[dvbi.e_WildcardPostcode] = elem.text();
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
				});
				addElements(r, node, dvbi.e_Region, props, parseRegion);
			}
			return r;
		};
		let rl = {};
		addElements(rl, node, dvbi.e_Region, props, parseRegion);
		addAttribute(rl, node, dvbi.a_version, { type: NUMBER });
		addLangAttribute(rl, node);
		return rl;
	};
	let parseLCNTableList = (node, props) => {
		let ltl = {};
		let parseLCNTableType = (node, props) => {
			let lcnt = {};
			addElements(lcnt, node, dvbi.e_TargetRegion, props, parseTextValue);
			addElements(lcnt, node, dvbi.e_SubscriptionPackage, props, parseTextualType);
			addElements(lcnt, node, dvbi.e_LCN, props, parseLCNTableEntryType);
			return lcnt;
		};
		addElements(ltl, node, dvbi.e_LCNTable, props, parseLCNTableType);
		return ltl;
	};

	let parseSubscriptionPackageListType = (node, props) => {
		let spl = {};
		addAttribute(spl, node, dvbi.a_allowNoPackage, { type: BOOLEAN, default: true });
		addElements(spl, node, dvbi.e_SubscriptionPackage, props, parseTextualType);
		return spl;
	};

	let props = {
		schema: SL_SCHEMA,
		prefix: SCHEMA_PREFIX,
		namespace: SCHEMA_NAMESPACE,
	};

	switch (SL.root().name()) {
		case dvbi.e_ServiceList:
			addAttribute(res, SL.root(), tva.a_lang);
			addAttribute(res, SL.root(), dvbi.a_version, { type: NUMBER });
			addAttribute(res, SL.root(), dvbi.a_responseStatus);
			addMultiLingual(res, SL, dvbi.e_Name, props);
			addMultiLingual(res, SL, dvbi.e_ProviderName, props);
			addElement(res, SL, dvbi.e_LanguageList, props, parseLanguageListType);
			addElements(res, SL, dvbi.e_RelatedMaterial, props, parseRelatedMaterialType);
			addElement(res, SL, dvbi.e_RegionList, props, parseRegionListType);
			addElements(res, SL, dvbi.e_TargetRegion, props, parseTextValue);
			addElement(res, SL, dvbi.e_LCNTableList, props, parseLCNTableList);
			// ServiceList.ContentGuideSourceList
			let cgsl = hasElement(SL, dvbi.e_ContentGuideSourceList);
			if (cgsl) {
				res[dvbi.e_ContentGuideSource] = [];
				let i = 0,
					cgs;
				while ((cgs = cgsl.get(xPath(props.prefix, dvbi.e_ContentGuideSource, ++i), props.schema)) != null) res.ContentGuideSource.push(parseContentGuideSource(cgs, props));
			}
			// ServiceList.ContentGuideSource
			let cgs = hasElement(SL, dvbi.e_ContentGuideSource);
			if (cgs) {
				if (!Object.prototype.hasOwnProperty.call(res, dvbi.e_ContentGuideSource)) res.ContentGuideSource = [];
				res[dvbi.e_ContentGuideSource].push(parseContentGuideSource(cgs, props));
			}
			if (SL.childNodes())
				SL.childNodes().forEachSubElement((elem) => {
					if ([dvbi.e_Service, dvbi.e_TestService].includes(elem.name())) addService(res, elem, props);
				});
			addElement(res, SL, dvbi.e_SubscriptionPackageList, props, parseSubscriptionPackageListType);
			break;
		case dvbi.e_Playlist:
			break;
		default:
			console.log(`SL root element is ${SL.root().name()}`.red);
			break;
	}
	return res;
}

/**
 * DVB-I Parsing - Program Guide Data
 */

let parseBaseMemberOfType = (node, props) => {
	let parseValidPeriodType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
		let pt = {};
		addSimpleElement(pt, node, tva.e_ValidFrom);
		addSimpleElement(pt, node, tva.e_ValidTo);
		return pt;
	};
	let bmot = {};
	addAttribute(bmot, node, tva.a_crid);
	addElements(bmot, node, tva.e_TimeLimitation, props, parseValidPeriodType);
	addAttribute(bmot, node, tva.a_index);
	return bmot;
};
let parseMemberOf = (node, props) => parseBaseMemberOfType(node, props);
let parseEpisodeOf = (node, props) => parseBaseMemberOfType(node, props);

let parseExplanationType = (node, props) => {
	let et = parseTextualType(node, props);
	addAttribute(et, node, tva.a_length);
	return et;
};

let parseTVAParentalGuidanceType = (node, props) => {
	let pg = parseMPEG7ParentalGuidanceType(node, props);
	addElements(pg, node, tva.e_ExplanatoryText, props, parseExplanationType);
	return pg;
};

let parseKeywordType = (node, props) => {
	let kw = parseTextualType(node, props);
	addAttribute(kw, node, tva.a_type);
	addAttribute(kw, node, tva.a_metadataOriginIDRef);
	return kw;
};

let parseTVAIDRefElementType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let ir = {};
	addAttribute(ir, node, tva.a_ref);
	return ir;
};

let parseTVAAgentType = (node, props) => {
	let agent = {};
	addElement(agent, node, tva.e_PersonName, props, parseTVAPersonNameType);
	addElement(agent, node, tva.e_PersonNameIDRef, props, parseTVAIDRefElementType);
	addElement(agent, node, tva.e_BiographicalInformation, props, function parseBiographicalInformation(node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) {
		let bi = {};
		addSimpleElement(bi, node, tva.e_BirthDate);
		addSimpleElement(bi, node, tva.e_DeathDate);
		addSimpleElements(bi, node, tva.e_Nationality);
		addSimpleElements(bi, node, tva.e_Occupation);
		return bi;
	});
	addElement(agent, node, tva.e_OrganizationName, props, parseTextualType);
	addElement(agent, node, tva.e_OrganizationNameIDRef, props, parseTVAIDRefElementType);
	addElements(agent, node, tva.e_RelatedPerson, props, function parseRelatedPerson(node, props) {
		let related = {};
		addElement(related, node, tva.e_PersonName, props, parseTVAPersonNameType);
		addElement(related, node, tva.e_PersonNameIDRef, props, parseTVAIDRefElementType);
		addAttribute(related, node, tva.a_relationship);
		return related;
	});
	addElements(agent, node, tva.e_RelatedPOrganization, props, function parseRelatedOrganization(node, props) {
		let related = {};
		addElement(related, node, tva.e_OrganizationName, props, parseTextualType);
		addElement(related, node, tva.e_OrganizationNameIDRef, props, parseTVAIDRefElementType);
		addAttribute(related, node, tva.a_relationship);
		return related;
	});
	return agent;
};

let parseTVAPersonNameType = (node, props) => {
	let person = parseMPEG7PersonNameType(node, props);
	addElements(person, node, tva.e_OtherIdentifier, props, parseUniqueIDType);
	addElements(person, node, tva.e_RelatedMaterial, props, parseRelatedMaterialType);
	addElements(person, node, tva.e_AdditionalInformation, props, parseTextualType);
	addAttribute(person, node, tva.a_nameType);
	return person;
};

let parseCreditsItemType = (node, props) => {
	let ci = parseTVAAgentType(node, props);
	addElements(ci, node, tva.e_Character, props, parseMPEG7PersonNameType);
	addElements(ci, node, tva.e_PresentationRole, props, parseTextualType);
	addElements(ci, node, tva.e_RelatedMaterial, props, parseRelatedMaterialType);
	addAttribute(ci, node, tva.a_role);
	addAttribute(ci, node, tva.a_index, { type: NUMBER });
	return ci;
};

let parseBasicDescription = (node, props) => {
	let bd = {};
	addElements(bd, node, tva.e_Title, props, parseTitleType);
	addElements(bd, node, tva.e_Synopsis, props, parseSynopsisType);
	addElements(bd, node, tva.e_Keyword, props, parseKeywordType);
	addElements(bd, node, tva.e_Genre, props, parseGenre);
	addElements(bd, node, tva.e_ParentalGuidance, props, parseTVAParentalGuidanceType);
	addElements(bd, hasElement(node, tva.e_CreditsList), tva.e_CreditsItem, props, parseCreditsItemType);
	addElements(bd, node, tva.e_RelatedMaterial, props, parseRelatedMaterialType);
	//HERE TODO
	return bd;
};

let parseProgramInformationTableType = (node, props) => {
	let parseProgramInformationType = (node, props) => {
		let pi = {};
		addAttribute(pi, node, tva.a_programId);
		addLangAttribute(pi, node);
		addElement(pi, node, tva.e_BasicDescription, props, parseBasicDescription);
		addElements(pi, node, tva.e_OtherIdentifier, props, parseUniqueIDType);
		addElements(pi, node, tva.e_MemberOf, props, parseMemberOf);
		addElements(pi, node, tva.e_EpisodeOf, props, parseEpisodeOf);
		return pi;
	};
	let pit = {};
	addLangAttribute(pit, node);
	addElements(pit, node, tva.e_ProgramInformation, props, parseProgramInformationType);
	return pit;
};

let parseFlagType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let flag = {};
	addAttribute(flag, node, tva.a_value, { type: BOOLEAN });
	return flag;
};

let parseCRIDRefType = (node, /* eslint-disable no-unused-vars*/ props /* eslint-enable */) => {
	let crt = {};
	addAttribute(crt, node, tva.a_crid);
	return crt;
};

let parseInstanceDescriptionType = (node, props) => {
	let id = {};
	addElements(id, node, tva.e_Genre, props, parseGenre);
	addElement(id, node, tva.e_CaptionLanguage, props, parseCaptionLanguageType);
	addElement(id, node, tva.e_SignLanguage, props, parseSignLanguageType);
	addElement(id, node, tva.e_AVAttributes, props, parseAVAttributesType);
	addElements(id, node, tva.e_OtherIdentifier, parseUniqueIDType);
	addElements(id, node, tva.e_RelatedMaterial, props, parseRelatedMaterialType);
	return id;
};
let parseProgramLocationType = (node, props) => {
	let pl = {};
	addElement(pl, node, tva.e_Program, props, parseCRIDRefType);
	addElements(pl, node, tva.e_ProgramURL, props, parseExtendedURIType_TVA);
	addElements(pl, node, tva.AuxiliaryURL, props, parseExtendedURIType_TVA);
	addElements(pl, node, tva.e_InstanceDescription, props, parseInstanceDescriptionType);
	return pl;
};

let parseScheduleType = (node, props) => {
	let parseScheduleEventType = (node, props) => {
		let se = parseProgramLocationType(node, props);
		addSimpleElement(se, node, tva.e_PublishedStartTime);
		addSimpleElement(se, node, tva.e_PublishedDuration);
		addSimpleElement(se, node, tva.e_ActualStartTime);
		addSimpleElement(se, node, tva.e_ActualDuration);
		addElement(se, node, tva.e_FirstShowing, props, parseFlagType);
		addElement(se, node, tva.e_Free, props, parseFlagType);
		return se;
	};
	let s = {};
	addAttribute(s, node, tva.a_serviceIDRef);
	addAttribute(s, node, tva.a_start);
	addAttribute(s, node, tva.a_end);
	addElements(s, node, tva.e_ScheduleEvent, props, parseScheduleEventType);
	return s;
};

let parseOnDemandProgramType = (node, props) => {
	let od = {};
	addAttribute(od, node, tva.a_serviceIDRef);
	addSimpleElement(od, node, tva.e_PublishedDuration);
	addSimpleElement(od, node, tva.e_StartOfAvailability);
	addSimpleElement(od, node, tva.e_EndOfAvailability);
	addSimpleElement(od, node, tva.e_DeliveryMode);
	addElement(od, node, tva.e_Free, props, parseFlagType);
	return od;
};

let parseProgramLocationTableType = (node, props) => {
	let plt = {};
	addLangAttribute(plt, node);
	addElements(plt, node, tva.e_Schedule, props, parseScheduleType);
	addElements(plt, node, tva.e_OnDemandProgram, props, parseOnDemandProgramType);
	return plt;
};

let parseProgramGroupTypeType = (node, props) => {
	let parseBaseProgramGroupTypeType = (/* eslint-disable no-unused-vars*/ node, props /* eslint-enable */) => {
		return {};
	};
	let pgtt = parseBaseProgramGroupTypeType(node, props);
	addAttribute(pgtt, node, tva.a_type);
	addAttribute(pgtt, node, tva.a_value);
	return pgtt;
};

let parseGroupInformation = (node, props) => {
	let gi = {};
	addAttribute(gi, node, tva.a_groupId);
	addAttribute(gi, node, tva.a_ordered);
	addAttribute(gi, node, tva.a_numOfItems);
	addAttribute(gi, node, tva.a_serviceIDRef);
	addElement(gi, node, tva.e_GroupType, props, parseProgramGroupTypeType);
	addElement(gi, node, tva.e_BasicDescription, props, parseBasicDescription);
	addElement(gi, node, tva.e_MemberOf, props, parseMemberOf);
	return gi;
};

let parseGroupInformationTable = (node, props) => {
	let git = {};
	addLangAttribute(git, node);
	addElements(git, node, tva.e_GroupInformation, props, parseGroupInformation);
	return git;
};

let parseTVAProgramDescription = (node, props) => {
	let pd = {};
	addElement(pd, node, tva.e_ProgramInformationTable, props, parseProgramInformationTableType);
	addElement(pd, node, tva.e_ProgramLocationTable, props, parseProgramLocationTableType);
	addElement(pd, node, tva.e_GroupInformationTable, props, parseGroupInformationTable);
	return pd;
};

export function MakeJS_CG(CG) {
	let res = {};

	if (datatypeIs(CG, "string")) {
		try {
			CG = parseXmlString(CG);
		} catch (err) {
			return `XML parsing failed: ${err.message}`;
		}
	}

	let CG_SCHEMA = {},
		SCHEMA_PREFIX = CG.root().namespace().prefix(),
		SCHEMA_NAMESPACE = CG.root().namespace().href();
	CG_SCHEMA[SCHEMA_PREFIX] = SCHEMA_NAMESPACE;

	let props = {
		schema: CG_SCHEMA,
		prefix: SCHEMA_PREFIX,
		namespace: SCHEMA_NAMESPACE,
	};

	if (CG.root().name() == tva.e_TVAMain) {
		// TAVMain@lang
		addAttribute(res, CG.root(), tva.a_lang);
		addElement(res, CG, tva.e_ProgramDescription, props, parseTVAProgramDescription);
	} else console.log(`CG root element is ${CG.root().name()}`.red);

	return res;
}
