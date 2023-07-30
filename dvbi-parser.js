import { parseXmlString } from "libxmljs2";

import { datatypeIs } from "./phlib/phlib.js";
import { tva } from "./TVA_definitions.js";
import { dvbi } from "./DVB-I_definitions.js";

import { xPath, hasElement, isEmpty } from "./utils.js";
import { mlLanguage } from "./MultilingualElement.js";

let addAttribute = (res, node, attrName, deflt = null) => {
	if (node && node.attr(attrName)) res[attrName] = node.attr(attrName).value();
	else if (deflt) res[attrName] = deflt;
};

let addLangAttribute = (res, node) => {
	addAttribute(res, node, tva.a_lang);
	if (!res[tva.a_lang]) res[tva.a_lang] = mlLanguage(node);
};

let parseTextualType = (node) => {
	let tt = {};
	if (node) {
		tt.text = node.text();
		addLangAttribute(tt, node);
	}
	return tt;
};

let parseTermNameType = (node) => {
	let tnt = parseTextualType(node);
	if (node && node.attr(tva.a_preferred)) tnt[tva.a_preferred] = node.attr(tva.a_preferred).value();
	return tnt;
};

let addMultiLingual = (res, node, elementName, props) => {
	let i = 0,
		e;
	while ((e = node.get(xPath(props.prefix, elementName, ++i), props.schema)) != null) {
		if (!Object.prototype.hasOwnProperty.call(res, elementName)) res[elementName] = [];
		res[elementName].push(parseTextualType(e));
	}
};

let parseControlledTermType = (node) => {
	let ct = {};
	if (node) {
		addAttribute(ct, node, tva.a_href);
		let name = hasElement(node, tva.e_Name);
		if (name) ct[tva.e_Name] = parseTermNameType(name);
		let definition = hasElement(node, tva.e_Definition);
		if (definition) ct[tva.e_Definition] = parseTextualType(definition);
	}
	return ct;
};

let addControlledTermType = (res, node, elementName) => {
	let temp = hasElement(node, elementName);
	if (temp) res[elementName] = parseControlledTermType(temp);
};

let parseBitRate = (node) => {
	let br = {};
	if (node) {
		br.value = node.text();
		addAttribute(br, node, tva.a_variable);
		addAttribute(br, node, tva.a_minimum);
		addAttribute(br, node, tva.a_averge);
		addAttribute(br, node, tva.a_maximum);
	}
	return br;
};

let parseCaptioningAttributes = (node) => {
	let ca = {};
	addControlledTermType(ca, node, tva.e_Coding);
	let bitrate = hasElement(node, tva.e_BitRate);
	if (bitrate) ca[tva.e_BitRate] = parseBitRate(bitrate);
};

let parseAVAttributesType = (node, props) => {
	let avattr = {};
	if (node) {
		addControlledTermType(avattr, node, tva.e_FileFormat);
		addSimpleElement(avattr, node, tva.e_FileSize);
		addControlledTermType(avattr, node, tva.e_System);
		if (hasElement(node, tva.e_BitRate)) {
			avattr[tva.e_BitRate] = [];
			let i = 0,
				br;
			while ((br = node.get(xPath(props.prefix, tva.e_BitRate, ++i), props.schema)) != null) avattr[tva.e_BitRate].push(parseBitRate(br));
		}
		if (hasElement(node, tva.e_AudioAttributes)) {
			avattr[tva.e_AudioAttributes] = [];
			let i = 0,
				aa;
			while ((aa = node.get(xPath(props.prefix, tva.e_AudioAttributes, ++i), props.schema)) != null) avattr[tva.e_AudioAttributes].push(parseAudioAttributes(aa));
		}
		let videoattributes = hasElement(node, tva.e_VideoAttributes);
		if (videoattributes) avattr[tva.e_VideoAttributes] = parseVideoAttributes(videoattributes);
		if (hasElement(node, tva.e_CaptioningAttributes)) {
			avattr[tva.e_CaptioningAttributes] = [];
			let i = 0,
				ca;
			while ((ca = node.get(xPath(props.prefix, tva.e_CaptioningAttributes, ++i), props.schema)) != null) avattr[tva.e_CaptioningAttributes].push(parseCaptioningAttributes(ca));
		}
	}
	return avattr;
};

let parseTVATVAMediaLocatorType = (node) => {
	let ml = {};
	if (node) {
		let mediauri = hasElement(node, tva.e_MediaUri);
		if (mediauri) ml[tva.e_MediaUri] = parseExtendedURIType_TVA(mediauri);
	}
	return ml;
};

let parseRelatedMaterialType = (node, props) => {
	let rm = {};
	// RelatedMaterial@lang
	addLangAttribute(rm, node);
	// RelatedMaterial.HowRelated
	rm[tva.e_HowRelated] = null;
	addControlledTermType(rm, node, tva.e_HowRelated);
	// RelatedMaterial.Format
	let format = hasElement(node, tva.e_Format);
	if (format) {
		rm[tva.e_Format] = {};
		// RelatedMaterial.Format.AVAttributes
		let avattributes = hasElement(format, tva.e_AVAttributes);
		if (avattributes) rm[tva.e_Format][tva.e_AVAttributes] = parseAVAttributesType(avattributes, props);
		// RelatedMaterial.Format.StillPictureFormat
		addControlledTermType(rm[tva.e_Format], format, tva.e_StillPictureFormat);
	}
	// RelatedMAterial.MediaLocator
	if (hasElement(node, tva.e_MediaLocator)) {
		rm[tva.e_MediaLocator] = [];
		let i = 0,
			ml;
		while ((ml = node.get(xPath(props.prefix, tva.e_MediaLocator, ++i), props.schema)) != null) rm[tva.e_MediaLocator].push(parseTVATVAMediaLocatorType(ml));
	}
	// TODO - RelatedMaterial.SegmentReference
	let segmentreference = hasElement(node, tva.e_SegmentReference);
	// RelatedMaterial.PromotionalText
	if (hasElement(node, tva.e_PromotionalText)) {
		rm[tva.e_PromotionalText] = [];
		let i = 0,
			pt;
		while ((pt = node.get(xPath(props.prefix, tva.e_PromotionalText, ++i), props.schema)) != null) rm[tva.e_PromotionalText].push(parseTextualType(pt));
	}
	// TODO - RelatedMaterial.PromotionalMedia
	if (hasElement(node, tva.e_PromotionalMedia)) {
	}
	// TODO - RelatedMaterial.SocialMediaReference
	if (hasElement(node, tva.e_SocialMediaReference)) {
	}
	// TODO - RelatedMaterial.SourceMediaLocator
	if (hasElement(node, tva.e_SourceMediaLocator)) {
	}
	return rm;
};

let parseExtendedURIType_DVB = (node) => {
	let eURI = {};
	if (node) {
		addSimpleElement(eURI, node, dvbi.e_URI);
		addAttribute(eURI, node, dvbi.a_contentType);
	}
	return eURI;
};

let parseExtendedURIType_TVA = (node) => {
	let eURI = {};
	if (node) {
		eURI.URI = node.text();
		addAttribute(eURI, node, tva.a_contentType);
		addAttribute(eURI, node, tva.a_uriType);
	}
	return eURI;
};

let addRelatedMaterial = (res, node, props) => {
	if (!hasElement(node, dvbi.e_RelatedMaterial)) return;
	if (!Object.prototype.hasOwnProperty.call(res, dvbi.e_RelatedMaterial)) res[dvbi.e_RelatedMaterial] = [];
	let i = 0,
		r;
	while ((r = node.get(xPath(props.prefix, dvbi.e_RelatedMaterial, ++i), props.schema)) != null) res[dvbi.e_RelatedMaterial].push(parseRelatedMaterialType(r, props));
};

let addSimpleElement = (res, node, elementName) => {
	let tmp = hasElement(node, elementName);
	if (tmp) res[elementName] = tmp.text();
};

let addCountries = (res, node, attributeName, property) => {
	if (node.attr(attributeName)) res[property] = node.attr(attributeName).value().split(",");
};

let parseRegion = (node, props) => {
	let r = {};
	if (node) {
		// Region@regionID
		addAttribute(r, node, dvbi.a_regionID);
		// Region@selectable
		addAttribute(r, node, dvbi.a_selectable, true);
		// Region@lang
		addLangAttribute(r, node);
		// Region@countryCodes
		addCountries(r, node, dvbi.a_countryCodes, "Countries");
		// Region.RegionName
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
					addSimpleElement(loc, elem, dvbi.e_Latitude);
					addSimpleElement(loc, elem, dvbi.e_Longitude);
					addSimpleElement(loc, elem, dvbi.e_Radius);
					break;
			}
			if (!isEmpty(loc)) {
				if (!Object.prototype.hasOwnProperty.call(r, "Location")) r.Location = [];
				r.Location.push(loc);
			}
		});
		// Region.Region
		if (hasElement(node, dvbi.e_Region)) {
			r[dvbi.e_Region] = [];
			let i = 0,
				sr;
			while ((sr = node.get(xPath(props.prefix, dvbi.e_Region, ++i), props.schema)) != null) r[dvbi.e_Region].push(parseRegion(sr, props));
		}
	}
	return r;
};

let addRegionList = (res, node, props) => {
	let regionlist = hasElement(node, dvbi.e_RegionList);
	if (!regionlist) return;
	if (!Object.prototype.hasOwnProperty.call(res, dvbi.e_RegionList)) res[dvbi.e_RegionList] = {};

	addAttribute(res[dvbi.e_RegionList], regionlist, dvbi.a_version);
	addLangAttribute(res[dvbi.e_RegionList], regionlist);
	res[dvbi.e_RegionList][dvbi.e_Region] = [];
	let i = 0,
		cr;
	while ((cr = regionlist.get(xPath(props.prefix, dvbi.e_Region, ++i), props.schema)) != null) res[dvbi.e_RegionList][dvbi.e_Region].push(parseRegion(cr, props));
};

let parseContentGuideSource = (node, props) => {
	let cg = {};
	addMultiLingual(cg, node, dvbi.e_Name, props);
	addMultiLingual(cg, node, dvbi.e_ProviderName, props);
	addRelatedMaterial(cg, node, props);

	let sep = hasElement(node, dvbi.e_ScheduleInfoEndpoint);
	if (sep) cg[dvbi.e_ScheduleInfoEndpoint] = parseExtendedURIType_DVB(sep);
	let pei = hasElement(node, dvbi.e_ProgramInfoEndpoint);
	if (pei) cg[dvbi.e_ProgramInfoEndpoint] = parseExtendedURIType_DVB(pei);
	let gei = hasElement(node, dvbi.e_GroupInfoEndpoint);
	if (gei) cg[dvbi.e_GroupInfoEndpoint] = parseExtendedURIType_DVB(gei);
	let mee = hasElement(node, dvbi.e_MoreEpisodesEndpoint);
	if (mee) cg[dvbi.e_MoreEpisodesEndpoint] = parseExtendedURIType_DVB(mee);
	return cg;
};

let addGenre = (res, node, elementName, props) => {
	if (!hasElement(node, elementName)) return;
	if (!Object.prototype.hasOwnProperty.call(res, elementName)) res[elementName] = [];
};

let parseSynopsisType = (node) => {
	let st = {};
	if (node) {
		st.text = node.text();
		addAttribute(st, node, tva.a_length);
	}
	return st;
};

let parseDVBTriplet = (node) => {
	let triplet = {};
	if (node) {
		addAttribute(triplet, node, dvbi.a_origNetId);
		addAttribute(triplet, node, dvbi.a_tsId);
		addAttribute(triplet, node, dvbi.a_serviceId);
	}
	return triplet;
};

let addTriplet = (res, node) => {
	let triplet = hasElement(node, dvbi.e_DVBTriplet);
	if (triplet) res[dvbi.e_DVBTriplet] = parseDVBTriplet(triplet);
};

let parseDVBTDeliveryParameters = (node) => {
	let dt = {};
	if (node) {
		addTriplet(dt, node);
		addSimpleElement(dt, node, dvbi.e_TargetCountry);
	}
	return dt;
};

let parseDVBSDeliveryParameters = (node, props) => {
	let ds = {};
	if (node) {
		addTriplet(ds, node);

		addSimpleElement(ds, node, dvbi.e_OrbitalPosition);
		addSimpleElement(ds, node, dvbi.e_Frequency);
		addSimpleElement(ds, node, dvbi.e_Polarization);
		addSimpleElement(ds, node, dvbi.e_SymbolRate);
		addSimpleElement(ds, node, dvbi.e_RollOff);
		addSimpleElement(ds, node, dvbi.e_ModulationSystem);
		addSimpleElement(ds, node, dvbi.e_FEC);
		addSimpleElement(ds, node, dvbi.e_ModcodMode);
		addSimpleElement(ds, node, dvbi.e_InputStreamIdentifier);
		let cb = hasElement(node, dvbi.e_ChannelBonding);
		if (cb) {
			ds[dvbi.e_ChannelBonding] = [];
			let i = 0,
				f;
			while ((f = cb.get(xPath(props.prefix, dvbi.e_Frequency, ++i), props.schema)) != null) {
				let newFreq = {};
				newFreq.text = f.text();
				addAttribute(newFreq, f, dvbi.a_primary);
				ds[dvbi.e_ChannelBonding].push(newFreq);
			}
		}
	}
	return ds;
};

let parseDVBCDeliveryParameters = (node) => {
	let dc = {};
	if (node) {
		addTriplet(dc, node);
		addSimpleElement(dc, node, dvbi.e_TargetCountry);
		addSimpleElement(dc, node, dvbi.e_NetworkID);
	}
	return dc;
};

let parseDASHDeliveryParameters = (node) => {
	let dd = {};
	if (node) {
		// DASHDeliveryParameters.UriBasedLocation
		dd[dvbi.e_UriBasedLocation] = parseExtendedURIType_DVB(hasElement(node, dvbi.e_UriBasedLocation));
		// DASHDeliveryParameters.MinimumBitRate
		addSimpleElement(dd, node, dvbi.e_MinimumBitRate);
		// TODO - DASHDeliveryParameters.Extension
	}
	return dd;
};

let parseRTSPDeliveryParametersType = (node) => {
	let rp = {};
	if (node) {
		addTriplet(rp, node);
		// TODO - RTSPDeliveryParameters.RTSPURL
		addSimpleElement(rp, node, dvbi.e_MinimumBitRate);
	}
	return rp;
};

let parseMulticastTSDeliveryParametersType = (node) => {
	let mts = {};
	if (node) {
		addTriplet(mts, node);
		// TODO - MulticastTSDeliveryParameters.IPMulticastAddress
		addSimpleElement(mts, node, dvbi.e_MinimumBitRate);
	}
	return mts;
};

let parseCaptionLanguage = (node) => {
	let cl = {};
	if (node) {
		addAttribute(cl, node, tva.a_primary);
		addAttribute(cl, node, tva.a_translation);
		addAttribute(cl, node, tva.a_closed, true);
		addAttribute(cl, node, tva.a_supplemental, false);
	}
	return cl;
};
let parseSignLanguage = (node) => {
	let sl = {};
	if (node) {
		addAttribute(sl, node, tva.a_primary);
		addAttribute(sl, node, tva.a_translation);
		addAttribute(sl, node, tva.a_type);
		addAttribute(sl, node, tva.a_closed);
	}
	return sl;
};

let parseContentProtectionType = (node, props) => {
	let cp = {};
	if (node) {
		if (hasElement(node, dvbi.e_CASystemType)) {
			cp[dvbi.e_CASystemType] = [];
			let i = 0,
				ca;
			while ((ca = node.get(xPath(props.prefix, dvbi.e_CASystemType, ++i), props.schema)) != null) {
				let newCA = {};
				addAttribute(newCA, ca, dvbi.a_cpsIndex);
				newCA.text = ca.text();
				cp[dvbi.e_CASystemType].push(newCA);
			}
		}
		if (hasElement(node, dvbi.e_DRMSystemType)) {
			cp[dvbi.e_DRMSystemType] = [];
			let i = 0,
				dr;
			while ((dr = node.get(xPath(props.prefix, dvbi.e_DRMSystemType, ++i), props.schema)) != null) {
				let newDRM = {};
				addAttribute(newDRM, dr, dvbi.a_cpsIndex);
				newDRM.text = dr.text();
				addAttribute(newDRM, dr, dvbi.a_encryptionScheme);
				cp[dvbi.e_DRMSystemType].push(newDRM);
			}
		}
	}
	return cp;
};

let parseAudioAttributes = (node) => {
	let newAA = {};
	addControlledTermType(newAA, node, tva.e_Coding);
	addSimpleElement(newAA, node, tva.e_NumOfChannels);
	addControlledTermType(newAA, node, tva.e_MixType);
	addSimpleElement(newAA, node, tva.e_SampleFrequency);
	addSimpleElement(newAA, node, tva.e_BitsPerSample);
	let bitrate = hasElement(node, tva.e_BitRate);
	if (bitrate) newAA[tva.e_BitRate] = parseBitRate(bitrate);
	return newAA;
};

let parseVideoAttributes = (node) => {
	let newVA = {};
	addControlledTermType(newVA, node, tva.e_Coding);
	addSimpleElement(newVA, node, tva.e_Scan);
	addSimpleElement(newVA, node, tva.e_HorizontalSize);
	addSimpleElement(newVA, node, tva.e_VerticalSize);
	addSimpleElement(newVA, node, tva.e_AspectRatio);
	let colortype = hasElement(node, tva.e_Color);
	if (colortype) addAttribute(newVA, node, tva.a_type);
	addSimpleElement(newVA, node, tva.e_FrameRate);
	let bitrate = hasElement(node, tva.e_BitRate);
	if (bitrate) newVA[tva.e_BitRate] = parseBitRate(bitrate);
	addControlledTermType(newVA, node, tva.e_PictureFormat);
	addControlledTermType(newVA, node, dvbi.e_Colorimetry);
};

let parseServiceInstance = (node, props) => {
	let si = {};
	if (node) {
		// ServiceInstance.DisplayName
		addMultiLingual(si, node, dvbi.e_DisplayName, props);
		// ServiceInstace.RelatedMaterial
		addRelatedMaterial(si, node, props);
		// ServiceInstance.ContentProtection
		if (hasElement(node, dvbi.e_ContentProtection)) {
			si[dvbi.e_ContentProtection] = [];
			let i = 0,
				cp;
			while ((cp = node.get(xPath(props.prefix, dvbi.e_ContentProtection, ++i), props.schema)) != null) si[dvbi.e_ContentProtection].push(parseContentProtectionType(cp, props));
		}
		// ServiceInstance.ContentAttributes
		let contentattributes = hasElement(node, dvbi.e_ContentAttributes);
		if (contentattributes) {
			si[dvbi.e_ContentAttributes] = [];
			if (hasElement(contentattributes, dvbi.e_AudioAttributes)) {
				let i = 0,
					aa;
				while ((aa = contentattributes.get(xPath(props.prefix, dvbi.e_AudioAttributes, ++i), props.schema)) != null) si[dvbi.e_ContentAttributes].push(parseAudioAttributes(aa));
			}
			if (hasElement(contentattributes, dvbi.e_AudioConformancePoint)) {
				let i = 0,
					ac;
				while ((ac = contentattributes.get(xPath(props.prefix, dvbi.e_AudioConformancePoint, ++i), props.schema)) != null) {
					let newAC = {};
					newAC[dvbi.e_AudioConformancePoint] = parseControlledTermType(ac);
					newAC.deprecated = true;
					si[dvbi.e_ContentAttributes].push(newAC);
				}
			}
			if (hasElement(contentattributes, dvbi.e_VideoAttributes)) {
				let i = 0,
					va;
				while ((va = contentattributes.get(xPath(props.prefix, dvbi.e_VideoAttributes, ++i), props.schema)) != null) si[dvbi.e_ContentAttributes].push(parseVideoAttributes(va));
			}
			if (hasElement(contentattributes, dvbi.e_VideoConformancePoint)) {
				let newVC = {};
				addControlledTermType(newVC, contentattributes, dvbi.e_VideoConformancePoint);
				si[dvbi.e_ContentAttributes].push(newVC);
			}
			if (hasElement(contentattributes, dvbi.e_CaptionLanguage)) {
				let i = 0,
					cl;
				while ((cl = contentattributes.get(xPath(props.prefix, dvbi.e_CaptionLanguage, ++i), props.schema)) != null) si[dvbi.e_ContentAttributes].push(parseCaptionLanguage(cl));
			}
			if (hasElement(contentattributes, dvbi.e_SignLanguage)) {
				let i = 0,
					sl;
				while ((sl = contentattributes.get(xPath(props.prefix, dvbi.e_SignLanguage, ++i), props.schema)) != null) si[dvbi.e_ContentAttributes].push(parseSignLanguage(sl));
			}
		}
		// ServiceInstance.Availability
		let availability = hasElement(node, dvbi.e_Availability);
		if (availability) {
			si[dvbi.e_Availability] = [];
			let i = 0,
				period;
			while ((period = availability.get(xPath(props.prefix, dvbi.e_Availability, ++i), props.schema)) != null) {
				let newPeriod = {};
				addAttribute(newPeriod, period, dvbi.a_validFrom);
				addAttribute(newPeriod, period, dvbi.a_validTo);
				if (hasElement(period, dvbi.e_Interval)) {
					newPeriod[dvbi.e_Interval] = [];
					let j = 0,
						int;
					while ((int = node.get(xPath(props.prefix, dvbi.dvbi.e_Interval, ++j), props.schema)) != null) {
						let newInterval = {};
						addAttribute(newInterval, int, dvbi.a_days, "1 2 3 4 5 6 7");
						addAttribute(newInterval, int, dvbi.a_recurrence, "1");
						addAttribute(newInterval, int, dvbi.a_startTime, "00:00:00Z");
						addAttribute(newInterval, int, dvbi.a_endTime, "23:59:59.999Z");
					}
				}
				si[dvbi.e_Availability].push(newPeriod);
			}
		}
		// ServiceInstance.SubscriptionPackage
		if (hasElement(node, dvbi.e_SubscriptionPackage)) {
			si[dvbi.e_SubscriptionPackage] = [];
			let i = 0,
				sp;
			while ((sp = node.get(xPath(props.prefix, dvbi.e_SubscriptionPackage, ++i), props.schema)) != null) si[dvbi.e_SubscriptionPackage].push(parseTextualType(sp));
		}
		// ServiceInstance.FTAContentManagement
		let fta = hasElement(node, dvbi.e_FTAContentManagement);
		if (fta) {
			let fcm = {};
			addAttribute(fcm, fta, dvbi.a_userDefined);
			addAttribute(fcm, fta, dvbi.a_doNotScramble);
			addAttribute(fcm, fta, dvbi.a_controlRemoteAccessOverInternet);
			addAttribute(fcm, fta, dvbi.a_doNotApplyRevocation);
			si[dvbi.e_FTAContentManagement] = fcm;
		}
		// ServiceInstance.SourceType
		addSimpleElement(si, node, dvbi.e_SourceType);
		// ServiceInstance.AltServiceName
		if (hasElement(node, dvbi.e_AltServiceName)) {
			si[dvbi.e_AltServiceName] = [];
			let i = 0,
				asn;
			while ((asn = node.get(xPath(props.prefix, dvbi.e_AltServiceName, ++i), props.schema)) != null) si[dvbi.e_AltServiceName].push(asn.text());
		}
		// ServiceInstance.DVBTDeliveryParameters
		let dvbtparams = hasElement(node, dvbi.e_DVBTDeliveryParameters);
		if (dvbtparams) si[dvbi.e_DVBTDeliveryParameters] = parseDVBTDeliveryParameters(dvbtparams);
		// ServiceInstance.SATIPDeliveryParameters
		addSimpleElement(si, node, dvbi.e_SATIPDeliveryParameters);
		// ServiceInstance.DVBSDeliveryParameters
		let dvbsparams = hasElement(node, dvbi.e_DVBSDeliveryParameters);
		if (dvbsparams) si[dvbi.e_DVBSDeliveryParameters] = parseDVBSDeliveryParameters(dvbsparams, props);
		// ServiceInstance.DVBCDeliveryParameters
		let dvbcparams = hasElement(node, dvbi.e_DVBCDeliveryParameters);
		if (dvbcparams) si[dvbi.e_DVBCDeliveryParameters] = parseDVBCDeliveryParameters(dvbtparams);
		// ServiceInstance.DASHDeliveryParameters
		let dashparams = hasElement(node, dvbi.e_DASHDeliveryParameters);
		if (dashparams) si[dvbi.e_DASHDeliveryParameters] = parseDASHDeliveryParameters(dashparams);
		// ServiceInstance.RTSPDeliveryParameters
		let rtspparams = hasElement(node, dvbi.e_RTSPDeliveryParameters);
		if (rtspparams) si[dvbi.e_RTSPDeliveryParameters] = parseRTSPDeliveryParametersType(rtspparams);
		// ServiceInstance.MulticastTSDeliveryParameters
		let mcastts = hasElement(node, dvbi.e_MulticastTSDeliveryParameters);
		if (mcastts) si[dvbi.e_MulticastTSDeliveryParameters] = parseMulticastTSDeliveryParametersType(mcastts);
		// TODO - ServiceInstance.OtherDeliveryParameters

		// ServiceInstance@priority
		addAttribute(si, node, dvbi.a_priority, 0);
		// ServiceInstance@id
		addAttribute(si, node, dvbi.a_id);
		// ServiceInstance@lang
		addLangAttribute(si, node);
	}
	return si;
};

let addService = (res, node, props) => {
	let newSvc = {};
	newSvc.isTestService = node.name() == dvbi.e_TestService;

	// Service.UniqueIdentifier
	addSimpleElement(newSvc, node, dvbi.e_UniqueIdentifier);

	// Service.ServiceInstance
	if (hasElement(node, dvbi.e_ServiceInstance)) {
		newSvc[dvbi.e_ServiceInstance] = [];
		let i = 0,
			si;
		while ((si = node.get(xPath(props.prefix, dvbi.e_ServiceInstance, ++i), props.schema)) != null) newSvc[dvbi.e_ServiceInstance].push(parseServiceInstance(si, props));
	}
	// Service.TargetRegion
	if (hasElement(node, dvbi.e_TargetRegion)) {
		newSvc[dvbi.e_TargetRegion] = [];
		let i = 0,
			t;
		while ((t = node.get(xPath(props.prefix, dvbi.e_TargetRegion, ++i), props.schema)) != null) newSvc[dvbi.e_TargetRegion].push(t.text());
	}

	// Service.ServiceName
	addMultiLingual(newSvc, node, dvbi.e_ServiceName, props);
	// Service.ProviderName
	addMultiLingual(newSvc, node, dvbi.e_ProviderName, props);
	// Service.RelatedMaterial
	addRelatedMaterial(newSvc, node, props);
	// Service.ServiceGenre
	addGenre(newSvc, node, dvbi.e_ServiceGenre, props);
	// Service.ServiceType
	addControlledTermType(newSvc, node, dvbi.e_ServiceType);
	// Service.ServiceDescription
	if (hasElement(node, dvbi.e_ServiceDescription)) {
		newSvc[dvbi.e_ServiceDescription] = [];
		let i = 0,
			sd;
		while ((sd = node.get(xPath(props.prefix, dvbi.e_ServiceDescription, ++i), props.schema)) != null) newSvc[dvbi.e_ServiceDescription].push(parseSynopsisType(sd));
	}
	// Service.RecordingInfo
	addControlledTermType(newSvc, node, dvbi.e_RecordingInfo);
	// Service.ContentGuideSource
	let contentguidesource = hasElement(node, dvbi.e_ContentGuideSource);
	if (contentguidesource) newSvc[dvbi.e_ContentGuideSource] = parseContentGuideSource(contentguidesource, props);
	// Service.ContentGuideSourceRef
	addSimpleElement(newSvc, node, dvbi.e_ContentGuideSourceRef);
	// Service.ContentGuideServiceRef
	addSimpleElement(newSvc, node, dvbi.e_ContentGuideServiceRef);
	// TODO - Service.AdditionalServiceParameters
	// Service.NVOD
	let nvod = hasElement(node, dvbi.e_NVOD);
	if (nvod) {
		newSvc[dvbi.e_NVOD] = {};
		addAttribute(newSvc[dvbi.e_NVOD], nvod, dvbi.a_mode);
		addAttribute(newSvc[dvbi.e_NVOD], nvod, dvbi.a_reference);
		addAttribute(newSvc[dvbi.e_NVOD], nvod, dvbi.a_offset, "PT0S");
	}
	// ProminenceList
	let prominence = hasElement(node, dvbi.e_ProminenceList);
	if (prominence) {
		newSvc[dvbi.e_Prominence] = [];
		let i = 0,
			p;
		while ((p = prominence.get(xPath(props.prefix, dvbi.e_Prominence, ++i), props.schema)) != null) {
			let prom = {};
			prom.text = p.text();
			addAttribute(prom, p, dvbi.a_country);
			addAttribute(prom, p, dvbi.a_region);
			addAttribute(prom, p, dvbi.a_ranking);
			newSvc[dvbi.e_Prominence].push(prom);
		}
	}
	// ParentalRating
	let parentalrating = hasElement(node, dvbi.e_ParentalRating);
	if (parentalrating) {
		newSvc[dvbi.e_ParentalRating] = [];
		let i = 0,
			ma;
		while ((ma = parentalrating.get(xPath(props.prefix, dvbi.e_MinimumAge, ++i), props.schema)) != null) {
			let newRating = {};
			newRating[dvbi.e_MinimumAge] = ma.text();
			addCountries(newRating, ma, dvbi.a_countryCodes, "Countries");
			newSvc[dvbi.e_ParentalRating].push(newRating);
		}
	}
	// Service@dynamic
	addAttribute(newSvc, node, dvbi.a_dynamic, false);
	// Service@version
	addAttribute(newSvc, node, dvbi.a_version);
	// Service@replayAvailable
	addAttribute(newSvc, node, dvbi.a_replayAvailable, false);
	// Service@lang
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

	let props = {
		schema: SL_SCHEMA,
		prefix: SCHEMA_PREFIX,
		namespace: SCHEMA_NAMESPACE,
	};

	// ServiceList@lang
	addAttribute(res, SL.root(), tva.a_lang);
	// ServiceList@version
	addAttribute(res, SL.root(), dvbi.a_version);
	// ServiceList@responseStatus
	addAttribute(res, SL.root(), dvbi.a_responseStatus);
	// ServiceList.Name
	addMultiLingual(res, SL, dvbi.e_Name, props);
	// ServiceList.ProviderName
	addMultiLingual(res, SL, dvbi.e_ProviderName, props);
	// ServiceList.LanguageList
	let ll = hasElement(SL, dvbi.e_LanguageList);
	if (ll) {
		res[dvbi.e_Language] = [];
		let i = 0,
			l;
		while ((l = ll.get(xPath(props.prefix, dvbi.e_Language, ++i), props.schema)) != null) res[dvbi.e_Language].push(l.text());
	}
	// ServiceList.RelatedMaterial
	addRelatedMaterial(res, SL, props);
	// ServiceList.RegionList
	addRegionList(res, SL, props);
	// ServiceLIst.TargetRegion
	if (hasElement(SL, dvbi.e_TargetRegion)) {
		res[dvbi.e_TargetRegion] = [];
		let i = 0,
			r;
		while ((r = SL.get(xPath(props.prefix, dvbi.e_TargetRegion, ++i), props.schema)) != null) res.TargetRegion.push(r.text());
	}
	// ServiceList.LCNTableList
	let lcntl = hasElement(SL, dvbi.e_LCNTableList);
	if (lcntl) {
		res[dvbi.e_LCNTable] = [];
		let i = 0,
			lcnt;
		while ((lcnt = lcntl.get(xPath(props.prefix, dvbi.e_LCNTable, ++i), props.schema)) != null) {
			let l = {};
			if (hasElement(lcnt, dvbi.e_TargetRegion)) {
				l[dvbi.e_TargetRegion] = [];
				let j = 0,
					t;
				while ((t = lcnt.get(xPath(props.prefix, dvbi.e_LCNTable, ++j), props.schema)) != null) l[dvbi.e_TargetRegion].push(t.text());
			}
			if (hasElement(lcnt, dvbi.e_SubscriptionPackage)) {
				l[dvbi.e_SubscriptionPackage] = [];
				let j = 0,
					s;
				while ((s = lcnt.get(xPath(props.prefix, dvbi.e_SubscriptionPackage, ++j), props.schema)) != null) l[dvbi.e_SubscriptionPackage].push(parseTextualType(s));
			}
			if (hasElement(lcnt, dvbi.e_LCN)) {
				l[dvbi.e_LCN] = [];
				let j = 0,
					lcn;
				while ((lcn = lcnt.get(xPath(props.prefix, dvbi.e_LCN, ++j), props.schema)) != null) {
					let ent = {};
					addAttribute(ent, lcn, dvbi.a_channelNumber);
					addAttribute(ent, lcn, dvbi.a_serviceRef);
					addAttribute(ent, lcn, dvbi.a_selectable, true);
					addAttribute(ent, lcn, dvbi.a_visible, true);
					l[dvbi.e_LCN].push(ent);
				}
			}
			res[dvbi.e_LCNTable].push(l);
		}
	}
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
	// ServiceList.Service and ServiceList.TestService
	if (SL.childNodes())
		SL.childNodes().forEachSubElement((elem) => {
			if ([dvbi.e_Service, dvbi.e_TestService].includes(elem.name())) addService(res, elem, props);
		});

	// ServiceList.SubscriptionPackageList
	let spl = hasElement(SL, dvbi.e_SubscriptionPackageList);
	if (spl) {
		res[dvbi.e_SubscriptionPackage] = [];
		let i = 0,
			sp;
		while ((sp = spl.get(xPath(props.prefix, dvbi.e_SubscriptionPackage, ++i), props.schema)) != null) res[dvbi.e_SubscriptionPackage].push(parseTextualType(sp));
	}
	return res;
}
