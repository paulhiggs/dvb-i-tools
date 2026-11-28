/**
 * market_checks.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * The checks that a market adds to those of A177 (issue #119): the A177 revisions it permits, the size of the images it
 * stipulates, and the rules it enables. Each applies to the market of the current validation and the revision of the
 * document whose rules are being checked
 */

import type { XmlElement } from "libxml2-wasm"

import ErrorList, { WARNING } from "./error_list.mts"
import type { ImageInfo } from "./image_format.mts"
import { currentRequest, documentRevision } from "./safe_fetch.mts"
import { findMarket, marketSettings } from "./markets.mts"
import type { Market, MarketImageKind, MarketRule, MarketSettings } from "./markets.mts"
import { A177Revision } from "./revisions.mts"
import type { TVARevision } from "./revisions.mts"
import { tva } from "./TVA_definitions.mts"
import { dvbi } from "./DVB-I_definitions.mts"
import { mhp } from "./MHP_definitions.mts"
import { validOutScheduleHours, validServiceLogo } from "./sl_data_versions.mts"

// initialise string formatting extensions
import {} from "./string-extensions.mts"

const MARKET_KEY = "market";

// the market of the current validation, if it has one
export const currentMarketDefinition = (): Market | undefined => {
	const id = currentRequest().market;
	return id == undefined ? undefined : findMarket(id);
};

// the id and name of a market, for the results of a validation made for it (phase 4 of issue #119)
export const marketSummary = (id: string | undefined): { id: string; name: string } | undefined => {
	const market = id == undefined ? undefined : findMarket(id);
	return market ? { id: market.id, name: market.name } : undefined;
};

// the settings of the market of the validation, for the document whose rules are being checked
const documentSettings = (): MarketSettings | undefined => {
	const market = currentRequest().market,
		revision = documentRevision();
	return market == undefined || revision == undefined ? undefined : marketSettings(market, revision);
};

const permittedList = (market: Market): string => (market.permitted ?? []).map((r) => r.label).join(", ");

/**
 * report a document whose A177 revision the market of the validation does not permit (decision 29 of issue #119). The
 * document is then not processed further
 *
 * @param {A177Revision} revision  the revision of the document (from its namespace)
 * @param {XmlElement}   root      the root element of the document
 * @param {ErrorList}    errs      where the finding is reported
 * @returns {boolean} true when the revision is not permitted (and has been reported), false when it is, when the market
 *                    permits every revision, when there is no market, or when the revision is not known (which is reported
 *                    by the checker itself)
 */
export function refusedRevision(revision: A177Revision, root: XmlElement, errs: ErrorList): boolean {
	const market = currentMarketDefinition();
	if (!market || !revision.known || market.permits(revision)) return false;
	errs.addError({
		code: "MKT001",
		message: `${revision.label} is not permitted for the market ${market.id} (permitted: ${permittedList(market)}), so the document is not validated`,
		line: root.line,
		key: MARKET_KEY,
	});
	return true;
}

/**
 * the A177 revision whose market settings apply to a content guide document validated on its own (decision 7 of issue
 * #119): the latest revision that uses its TV-Anytime revision, and that the market permits. A document that no permitted
 * revision uses is reported (decision 29)
 *
 * @param {TVARevision} tvaRevision  the TV-Anytime revision of the document
 * @param {XmlElement}  root         the root element of the document
 * @param {ErrorList}   errs         where the finding is reported
 * @returns {A177Revision | undefined} the revision, or undefined when the document is not permitted (and has been reported)
 */
export function contentGuideRevision(tvaRevision: TVARevision, root: XmlElement, errs: ErrorList): A177Revision | undefined {
	const market = currentMarketDefinition();
	const revision = A177Revision.all.findLast((r) => r.tvAnytime == tvaRevision && (market?.permits(r) ?? true));
	if (revision || !market || !tvaRevision.known) return revision ?? A177Revision.unknown;
	errs.addError({
		code: "MKT001",
		message: `the TV-Anytime revision of this document is not used by an A177 revision permitted for the market ${market.id} (permitted: ${permittedList(market)}), so the document is not validated`,
		line: root.line,
		key: MARKET_KEY,
	});
	return undefined;
}

// the A177 revision whose market settings apply to an XML AIT validated on its own: the latest that the market permits
export const latestPermittedRevision = (): A177Revision => currentMarketDefinition()?.permitted?.at(-1) ?? A177Revision.latest;

const KIND_NAMES: Record<MarketImageKind, string> = {
	serviceListLogo: "service list logo",
	serviceLogo: "service logo",
	contentGuideSourceLogo: "content guide source logo",
	promotionalStillImage: "promotional still image",
};

/**
 * check an image against the size and file size that the market of the validation stipulates for its kind (decisions 27
 * and 28 of issue #119). Only the image at the signalled URL is checked, not one scaled with ?w=
 *
 * @param {ImageInfo}       image     the properties read from the image
 * @param {MarketImageKind} kind      the kind of image
 * @param {string}          where     how the image is described in messages
 * @param {XmlElement}      MediaUri  the element referencing the image
 * @param {ErrorList}       errs      where findings are reported
 */
export function checkMarketImage(image: ImageInfo, kind: MarketImageKind | undefined, where: string, MediaUri: XmlElement, errs: ErrorList): void {
	const market = currentRequest().market,
		revision = documentRevision();
	if (!kind || market == undefined || revision == undefined) return;
	const required = marketSettings(market, revision).images[kind];
	if (!required) return;
	const name = KIND_NAMES[kind];
	if (required.width != undefined && image.width != undefined && image.height != undefined) {
		const sizeOK = image.width == required.width && (required.height == undefined || image.height == required.height);
		if (!sizeOK)
			errs.addError({
				code: "IMG020",
				message: `${where} (a ${name}) is ${image.width}x${image.height}, but the market ${market} requires ${required.height == undefined ? `a width of ${required.width}` : `${required.width}x${required.height}`}`,
				fragment: MediaUri,
				key: MARKET_KEY,
			});
	}
	if (required.maxBytes != undefined && image.size != undefined && image.size > required.maxBytes)
		errs.addError({
			code: "IMG021",
			type: WARNING,
			message: `${where} (a ${name}) is ${image.size} bytes, but the market ${market} recommends at most ${required.maxBytes}`,
			fragment: MediaUri,
			key: MARKET_KEY,
		});
}

/**
 * whether the market of the validation enables a rule for the document whose rules are being checked
 *
 * @param {MarketRule} rule  the rule
 * @returns {boolean} true if the rule is enabled
 */
export function marketRule(rule: MarketRule): boolean {
	return documentSettings()?.rules[rule] == true;
}

/**
 * the postcodes of a region, against the number of digits that the market of the validation gives them (parameter
 * postcode.digits, #139 DE-18): Postcode and PostcodeRange@from/@to have exactly that many digits, and a WildcardPostcode
 * has fewer digits beside its single *, which stands for at least one digit
 *
 * @param {XmlElement} Region  the <Region> element
 * @param {ErrorList}  errs    where findings are reported
 */
export function checkMarketPostcodes(Region: XmlElement, errs: ErrorList): void {
	const digits = documentSettings()?.parameters.postcode.digits;
	if (digits == undefined) return;
	const market = currentRequest().market;
	const exact = new RegExp(`^[0-9]{${digits}}$`);
	const report = (fragment: XmlElement, message: string) => errs.addError({ code: "MKT003", message: `${message}, the market ${market} requires ${digits} digits`, fragment, key: MARKET_KEY });
	Region.forEachNamedChildElement(dvbi.e_Postcode, (Postcode) => {
		if (!exact.test(Postcode.content.trim())) report(Postcode, `the postcode ${Postcode.content.trim().quote()} is not ${digits} digits`);
	});
	Region.forEachNamedChildElement(dvbi.e_PostcodeRange, (PostcodeRange) => {
		const from = PostcodeRange.attrAnyNsValueOr(dvbi.a_from)?.trim(),
			to = PostcodeRange.attrAnyNsValueOr(dvbi.a_to)?.trim();
		[from, to].forEach((value) => {
			if (value != undefined && !exact.test(value)) report(PostcodeRange, `the end of a postcode range ${value.quote()} is not ${digits} digits`);
		});
		if (from && to && exact.test(from) && exact.test(to) && from > to)
			errs.addError({ code: "MKT003", message: `the postcode range starts at ${from.quote()}, after its end ${to.quote()}`, fragment: PostcodeRange, key: MARKET_KEY });
	});
	Region.forEachNamedChildElement(dvbi.e_WildcardPostcode, (WildcardPostcode) => {
		const value = WildcardPostcode.content.trim();
		const counted = value.replace("*", "");
		if (value.split("*").length != 2 || !/^[0-9]*$/.test(counted) || counted.length >= digits)
			report(WildcardPostcode, `the wildcard postcode ${value.quote()} is not at most ${digits - 1} digits and one *`);
	});
}

// the direct tuning parameters of a DVB-S service instance (A177 clause 5.2.12, #139 DE-15)
const DIRECT_TUNING = [dvbi.e_OrbitalPosition, dvbi.e_Frequency, dvbi.e_Polarization, dvbi.e_SymbolRate];

/**
 * the rule dvbsDirectTuning (#139 DE-15): every DVB-S service instance has the parameters for direct tuning
 *
 * @param {XmlElement} DVBSDeliveryParameters  the <DVBSDeliveryParameters> element
 * @param {ErrorList}  errs                    where the finding is reported
 */
export function checkDirectTuning(DVBSDeliveryParameters: XmlElement, errs: ErrorList): void {
	if (!marketRule("dvbsDirectTuning")) return;
	const missing = DIRECT_TUNING.filter((name) => !DVBSDeliveryParameters.hasChild(name));
	if (missing.length > 0)
		errs.addError({
			code: "MKT004",
			message: `${dvbi.e_DVBSDeliveryParameters.elementize()} has no ${missing.map((m) => m.elementize()).join(", ")}, which the market ${currentRequest().market} requires for direct tuning`,
			fragment: DVBSDeliveryParameters,
			key: MARKET_KEY,
		});
}

/**
 * the rule serviceLogoRequired (decision 24 of issue #119): the <Service> itself has a service logo. A logo only in a
 * <ServiceInstance> does not satisfy it
 *
 * @param {XmlElement} service         the <Service> element
 * @param {string}     thisServiceId  the identifier of the service, for the message
 * @param {ErrorList}  errs            where the finding is reported
 */
export function checkServiceLogoRequired(service: XmlElement, thisServiceId: string, errs: ErrorList): void {
	if (!marketRule("serviceLogoRequired")) return;
	let hasLogo = false;
	service.forEachNamedChildElement(tva.e_RelatedMaterial, (RelatedMaterial) => {
		const HowRelated = RelatedMaterial.getAnyNs(tva.e_HowRelated);
		if (HowRelated && validServiceLogo(HowRelated)) hasLogo = true;
	});
	if (!hasLogo)
		errs.addError({
			code: "MKT002",
			message: `service ${thisServiceId.quote()} has no service logo in its ${dvbi.e_Service.elementize()}, which the market ${currentRequest().market} requires`,
			line: service.line,
			key: MARKET_KEY,
		});
}

/**
 * the media types that the market of the validation permits for an Icecast service instance (parameter icecast.contentTypes,
 * #139 DE-6): an IdentifierBasedDeliveryParameters with an Icecast identifier (A177r8 annex K) has a @contentType, and it is
 * one of them
 *
 * @param {XmlElement} params  the <IdentifierBasedDeliveryParameters> element
 * @param {ErrorList}  errs    where the finding is reported
 */
export function checkIcecastContentType(params: XmlElement, errs: ErrorList): void {
	const permitted = documentSettings()?.parameters.icecast.contentTypes;
	if (permitted == undefined || !params.content.trim().startsWith(dvbi.ICECAST_V1_IDENTIFIER)) return;
	const contentType = params.attrAnyNsValueOr(dvbi.a_contentType);
	const expected = permitted.map((t) => t.quote()).join(" or ");
	if (contentType == null || !permitted.includes(contentType.trim().toLowerCase()))
		errs.addError({
			code: "MKT005",
			message:
				contentType == null
					? `the Icecast ${dvbi.e_IdentifierBasedDeliveryParameters.elementize()} has no ${dvbi.a_contentType.attribute()}, which the market ${currentRequest().market} requires to be ${expected}`
					: `the Icecast ${dvbi.e_IdentifierBasedDeliveryParameters.elementize()} has ${dvbi.a_contentType.attribute()} ${contentType.quote()}, but the market ${currentRequest().market} requires ${expected}`,
			fragment: params,
			key: MARKET_KEY,
		});
}

/**
 * the rule hbbtvInControl (#139 DE-8), in the document that signals the application: a linked application that controls the
 * presentation of the service (LinkedApplicationCS:2019:1.2) is referenced as an XML AIT
 *
 * @param {XmlElement} MediaUri  the <MediaUri> of the linked application
 * @param {string}     AppType   the HowRelated@href of the linked application
 * @param {ErrorList}  errs      where the finding is reported
 */
export function checkInControlReference(MediaUri: XmlElement, AppType: string, errs: ErrorList): void {
	if (AppType != dvbi.APP_IN_CONTROL || !marketRule("hbbtvInControl")) return;
	const contentType = MediaUri.attrAnyNsValueOr(tva.a_contentType);
	if (contentType != dvbi.XML_AIT_CONTENT_TYPE)
		errs.addError({
			code: "MKT006",
			message: `the linked application ${AppType.quote()} is ${contentType ? `of type ${contentType.quote()}` : `given without a ${tva.a_contentType.attribute()}`}, but the market ${currentRequest().market} requires an XML AIT (${dvbi.XML_AIT_CONTENT_TYPE.quote()})`,
			fragment: MediaUri,
			key: MARKET_KEY,
		});
}

/**
 * the rule hbbtvInControl (#139 DE-8), in the XML AIT of a linked application that controls the presentation of the service
 * (LinkedApplicationCS:2019:1.2): the AIT has an HbbTV application
 *
 * @param {string | undefined}        linkedApplicationType  the HowRelated@href of the linked application that refers to the AIT
 * @param {(string | undefined)[]}    applicationTypes       the <OtherApp> of each application of the AIT
 * @param {number | undefined}        line                   the line of the first application, for the report
 * @param {ErrorList}                 errs                   where the finding is reported
 */
export function checkInControlAit(linkedApplicationType: string | undefined, applicationTypes: (string | undefined)[], line: number | undefined, errs: ErrorList): void {
	if (linkedApplicationType != dvbi.APP_IN_CONTROL || !marketRule("hbbtvInControl")) return;
	if (!applicationTypes.includes(mhp.HBBTV_APP))
		errs.addError({
			code: "MKT007",
			message: `the XML AIT of the linked application ${linkedApplicationType.quote()} has no HbbTV application (${mhp.e_OtherApp.elementize()} ${mhp.HBBTV_APP.quote()}), which the market ${currentRequest().market} requires`,
			line,
			key: MARKET_KEY,
		});
}

// a <Service> that a market rule requires something of (#139, the IT-6 table of the DTVP profile)
const reportService = (code: string, service: XmlElement, thisServiceId: string, missing: string, errs: ErrorList) =>
	errs.addError({
		code,
		message: `service ${thisServiceId.quote()} has no ${missing}, which the market ${currentRequest().market} requires`,
		line: service.line,
		key: MARKET_KEY,
	});

/**
 * the rules of a market for each <Service> (#139, the provider column of the IT-6 table of the DTVP profile):
 *   outOfServiceBannerRequired  an out-of-service banner (HowRelated …:1000.1) in the <Service> itself (MKT008)
 *   serviceTypeRequired         a <ServiceType> (MKT009)
 *   contentGuideSourceRequired  a content guide source: <ContentGuideSource> or <ContentGuideSourceRef> in the <Service>,
 *                               or the <ContentGuideSource> of the <ServiceList>, which is the default (MKT011)
 *   serviceInstanceRequired     at least one <ServiceInstance> (MKT012)
 *
 * @param {XmlElement} service        the <Service> element
 * @param {string}     thisServiceId  the identifier of the service, for the message
 * @param {ErrorList}  errs           where the findings are reported
 */
export function checkServiceRequirements(service: XmlElement, thisServiceId: string, errs: ErrorList): void {
	if (marketRule("outOfServiceBannerRequired")) {
		let hasBanner = false;
		service.forEachNamedChildElement(tva.e_RelatedMaterial, (RelatedMaterial) => {
			const HowRelated = RelatedMaterial.getAnyNs(tva.e_HowRelated);
			if (HowRelated && validOutScheduleHours(HowRelated)) hasBanner = true;
		});
		if (!hasBanner) reportService("MKT008", service, thisServiceId, `out-of-service banner in its ${dvbi.e_Service.elementize()}`, errs);
	}
	if (marketRule("serviceTypeRequired") && !service.hasChild(dvbi.e_ServiceType)) reportService("MKT009", service, thisServiceId, dvbi.e_ServiceType.elementize(), errs);
	if (marketRule("contentGuideSourceRequired")) {
		const listDefault = (service.parent as XmlElement | null)?.hasChild(dvbi.e_ContentGuideSource) ?? false;
		if (!service.hasChild(dvbi.e_ContentGuideSource) && !service.hasChild(dvbi.e_ContentGuideSourceRef) && !listDefault)
			reportService("MKT011", service, thisServiceId, `content guide source (${dvbi.e_ContentGuideSource.elementize()} or ${dvbi.e_ContentGuideSourceRef.elementize()}, or a default in the ${dvbi.e_ServiceList.elementize()})`, errs);
	}
	if (marketRule("serviceInstanceRequired") && !service.hasChild(dvbi.e_ServiceInstance)) reportService("MKT012", service, thisServiceId, dvbi.e_ServiceInstance.elementize(), errs);
}

/**
 * the rule displayNameRequired (#139, the IT-6 table of the DTVP profile): every <ServiceInstance> has a <DisplayName>
 * (MKT010)
 *
 * @param {XmlElement} ServiceInstance  the <ServiceInstance> element
 * @param {string}     thisServiceId    the identifier of its service, for the message
 * @param {ErrorList}  errs             where the finding is reported
 */
export function checkDisplayNameRequired(ServiceInstance: XmlElement, thisServiceId: string, errs: ErrorList): void {
	if (!marketRule("displayNameRequired") || ServiceInstance.hasChild(dvbi.e_DisplayName)) return;
	const priority = ServiceInstance.attrAnyNsValueOr(dvbi.a_priority);
	errs.addError({
		code: "MKT010",
		message: `a ${dvbi.e_ServiceInstance.elementize()}${priority ? ` (priority ${priority})` : ""} of service ${thisServiceId.quote()} has no ${dvbi.e_DisplayName.elementize()}, which the market ${currentRequest().market} requires`,
		line: ServiceInstance.line,
		key: MARKET_KEY,
	});
}

// the values of LCNRange@serviceOrigin that give channel numbers to unmatched broadcast services (A177r8 clause 5.5.29): any
// is for DVB-I services as well
const BROADCAST_ORIGINS = [dvbi.SERVICE_ORIGIN_TARGET_BROADCAST, dvbi.SERVICE_ORIGIN_OTHER_BROADCAST, dvbi.SERVICE_ORIGIN_ANY];

/**
 * the rule broadcastLCNRangeRequired (#139, the IT-6 table of the DTVP profile: "LCNRange ... needed for Overscan"): every
 * <LCNTable> has an <LCNRange> whose @serviceOrigin is targetBroadcast, otherBroadcast or any, for the broadcast services found by
 * a scan that the service list does not match (MKT013). Without @serviceOrigin a range is for DVB-I services (its default,
 * dvbi)
 *
 * @param {XmlElement} LCNTable  the <LCNTable> element
 * @param {ErrorList}  errs      where the finding is reported
 */
export function checkBroadcastLCNRange(LCNTable: XmlElement, errs: ErrorList): void {
	if (!marketRule("broadcastLCNRangeRequired")) return;
	let found = false;
	LCNTable.forEachNamedChildElement(dvbi.e_LCNRange, (LCNRange) => {
		if (BROADCAST_ORIGINS.includes(LCNRange.attrAnyNsValueOr(dvbi.a_serviceOrigin) ?? "")) found = true;
	});
	if (!found) {
		const regions: string[] = [];
		LCNTable.forEachNamedChildElement(dvbi.e_TargetRegion, (TargetRegion) => regions.push(TargetRegion.content.trim().quote()));
		errs.addError({
			code: "MKT013",
			message: `the ${dvbi.e_LCNTable.elementize()}${regions.length > 0 ? ` for ${regions.join(", ")}` : ""} has no ${dvbi.e_LCNRange.elementize()} with ${dvbi.a_serviceOrigin.attribute()} ${BROADCAST_ORIGINS.slice(0, -1).map((o) => o.quote()).join(", ")} or ${BROADCAST_ORIGINS.at(-1)!.quote()}, which the market ${currentRequest().market} requires`,
			line: LCNTable.line,
			key: MARKET_KEY,
		});
	}
}
