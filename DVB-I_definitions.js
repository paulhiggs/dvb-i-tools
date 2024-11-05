/**
 * DVB-I_defintions.js
 *
 * Defintions made in DVB A177 Bluebooks
 */
import { tva, tvaEA, tvaEC, TVA_CSmetadata } from "./TVA_definitions.js";

const DVB_metadata = "urn:dvb:metadata";
const DVB_CSmetadata = `${DVB_metadata}:cs`,
	FVC_CSmetadata = "urn:fvc:metadata:cs";

const PaginationPrefix = `${FVC_CSmetadata}:HowRelatedCS:2015-12:pagination`,
	NowNextCRIDPrefix = "crid://dvb.org/metadata/schedules/now-next";

const DVB_SOURCE_PREFIX = `${DVB_metadata}:source`;
const LINKED_APLICATION_CS = `${DVB_CSmetadata}:LinkedApplicationCS:2019`;

const DVB_HowRelatedCS = `${DVB_CSmetadata}:HowRelatedCS`,
	DVB_RELATED_CS_v1 = `${DVB_HowRelatedCS}:2019`,
	DVB_RELATED_CS_v2 = `${DVB_HowRelatedCS}:2020`,
	DVB_RELATED_CS_v3 = `${DVB_HowRelatedCS}:2021`;

const FVC_HowRelatedCS = `${FVC_CSmetadata}:HowRelatedCS:2018`;

const CaptionCodingFormatCS = `${TVA_CSmetadata}:CaptionCodingFormatCS:2015`,
	AudioPurposeCS = `${TVA_CSmetadata}:AudioPurposeCS:2007`,
	MediaAvailabilityCS = `${FVC_CSmetadata}:MediaAvailabilityCS:2014-07`,
	ForwardEPGAvailabilityCS = `${FVC_CSmetadata}:FEPGAvailabilityCS:2014-10`,
	RestartAvailabilityCS = `${FVC_CSmetadata}:RestartAvailabilityCS:2018`;

export const XMLdocumentType = "application/xml";

const HbbTVStandardPrefix = "urn:hbbtv:appinformation:standardversion:hbbtv";
const HbbTVFeaturePrefix = "urn:hbbtv:appinformation:optionalfeature:hbbtv";
const CTAStandardPrefix = "urn:cta:wave:appinformation:standardversion";

export const dvbi = {
	A177_Namespace: `${DVB_metadata}:servicediscovery:2019`,
	A177r1_Namespace: `${DVB_metadata}:servicediscovery:2020`,
	A177r2_Namespace: `${DVB_metadata}:servicediscovery:2021`,
	A177r3_Namespace: `${DVB_metadata}:servicediscovery:2022`,
	A177r4_Namespace: `${DVB_metadata}:servicediscovery:2022b`,
	A177r5_Namespace: `${DVB_metadata}:servicediscovery:2023`,
	A177r6_Namespace: `${DVB_metadata}:servicediscovery:2024`,
	A177r7_Namespace: `${DVB_metadata}:servicediscovery:2025`,

	ApplicationStandards: [
		`${HbbTVStandardPrefix}:1.2.1`,
		`${HbbTVStandardPrefix}:1.5.1`,
		`${HbbTVStandardPrefix}:1.6.1`,
		`${HbbTVStandardPrefix}:1.7.1`,
		`${CTAStandardPrefix}:cta500a:2018`,
		`${CTAStandardPrefix}:cta500b:2019`,
		`${CTAStandardPrefix}:cta500c:2020`,
		`${CTAStandardPrefix}:cta500d:2021`,
		`${CTAStandardPrefix}:cta500e:2022`,
		`${CTAStandardPrefix}:cta500f:2023`,
	],
	ApplicationOptions: [
		`${HbbTVFeaturePrefix}:2decoder`,
		`${HbbTVFeaturePrefix}:2html`,
		`${HbbTVFeaturePrefix}:graphics_01`,
		`${HbbTVFeaturePrefix}:graphics_02`,
		`${HbbTVFeaturePrefix}:screader`,
	],

	MAX_TITLE_LENGTH: 80,
	MAX_KEYWORD_LENGTH: 32,
	MAX_ORGANIZATION_NAME_LENGTH: 32,
	MAX_NAME_PART_LENGTH: 32,
	MAX_EXPLANATORY_TEXT_LENGTH: 160,

	MAX_CREDITS_ITEMS: 40,

	XML_AIT_CONTENT_TYPE: "application/vnd.dvb.ait+xml",
	HTML5_APP: "text/html",
	XHTML_APP: "application/xhtml+xml",
	//	iOS_APP: "application/vnd.dvb.app.ios",
	//	ANDROID_APP: "application/vnd.dvb.app.android",
	TEMPLATE_AIT_URI: `${FVC_HowRelatedCS}:templateAIT`,

	PAGINATION_FIRST_URI: `${PaginationPrefix}:first`,
	PAGINATION_PREV_URI: `${PaginationPrefix}:prev`,
	PAGINATION_NEXT_URI: `${PaginationPrefix}:next`,
	PAGINATION_LAST_URI: `${PaginationPrefix}:last`,

	CRID_NOW: `${NowNextCRIDPrefix}/now`,
	CRID_LATER: `${NowNextCRIDPrefix}/later`,
	CRID_EARLIER: `${NowNextCRIDPrefix}/earlier`,

	MAX_SUBREGION_LEVELS: 3, // definied for <RegionElement> in Table 33 of A177

	EIT_PROGRAMME_CRID_TYPE: "eit-programme-crid",
	EIT_SERIES_CRID_TYPE: "eit-series-crid",

	// A177 only table 15 - deprecated in A177r1
	DVBT_SOURCE_TYPE: `${DVB_SOURCE_PREFIX}:dvb-t`,
	DVBS_SOURCE_TYPE: `${DVB_SOURCE_PREFIX}:dvb-s`,
	DVBC_SOURCE_TYPE: `${DVB_SOURCE_PREFIX}:dvb-c`,
	DVBIPTV_SOURCE_TYPE: `${DVB_SOURCE_PREFIX}:dvb-iptv`,
	DVBDASH_SOURCE_TYPE: `${DVB_SOURCE_PREFIX}:dvb-dash`,
	DVBAPPLICATION_SOURCE_TYPE: `${DVB_SOURCE_PREFIX}:application`,

	// A177 5.2.7.2
	CONTENT_TYPE_DASH_MPD: "application/dash+xml", // MPD of linear service
	CONTENT_TYPE_DVB_PLAYLIST: XMLdocumentType, // XML Playlist

	// A77 6.10.15 Parental Guidance
	DTG_CONTENT_WARNING_CS_SCHEME: "urn:dtg:metadata:cs:DTGContentWarningCS",

	// A177 6.11.2 - Audio Purpose
	AUDIO_PURPOSE_VISUAL_IMPAIRED: `${AudioPurposeCS}:1`,
	AUDIO_PURPOSE_HEARING_IMPAIRED: `${AudioPurposeCS}:2`,
	AUDIO_PURPOSE_MAIN: `${AudioPurposeCS}:6`,
	AUDIO_PURPOSE_DIALOGUE_ENHANCEMENT: `${AudioPurposeCS}:8`,

	// A177 6.11.3 - Caption Coding Format
	DVB_BITMAP_SUBTITLES: `${CaptionCodingFormatCS}:2.1`,
	DVB_CHARACTER_SUBTITLES: `${CaptionCodingFormatCS}:2.2`,
	EBU_TT_D: `${CaptionCodingFormatCS}:3.2`,

	// A177 6.11.6 - Media Availability
	MEDIA_AVAILABLE: `${MediaAvailabilityCS}:media_available`,
	MEDIA_UNAVAILABLE: `${MediaAvailabilityCS}:media_unavailable`,

	// A177 6.11.7 - Forward EPG Availability
	FORWARD_EPG_AVAILABLE: `${ForwardEPGAvailabilityCS}:fepg_available`,
	FORWARD_EPG_UNAVAILABLE: `${ForwardEPGAvailabilityCS}:fepg_unavailable`,

	//A177r1 6.5.5 - Restart Link
	RESTART_LINK: `${FVC_HowRelatedCS}:restart`,

	// A177 6.11.11 - Restart Availability
	RESTART_AVAILABLE: `${RestartAvailabilityCS}:restart_available`,
	RESTART_CHECK: `${RestartAvailabilityCS}:restart_check`,
	RESTART_PENDING: `${RestartAvailabilityCS}:restart_pending`,

	// A177 7.3.1
	BANNER_OUTSIDE_AVAILABILITY_v1: `${DVB_RELATED_CS_v1}:1000.1`,
	LOGO_SERVICE_LIST_v1: `${DVB_RELATED_CS_v1}:1001.1`,
	LOGO_SERVICE_v1: `${DVB_RELATED_CS_v1}:1001.2`,
	LOGO_CG_PROVIDER_v1: `${DVB_RELATED_CS_v1}:1002.1`,

	// A177r1 7.3.1
	BANNER_OUTSIDE_AVAILABILITY_v2: `${DVB_RELATED_CS_v2}:1000.1`,
	BANNER_CONTENT_FINISHED_v2: `${DVB_RELATED_CS_v2}:1000.2`, // added in A17732
	LOGO_SERVICE_LIST_v2: `${DVB_RELATED_CS_v2}:1001.1`,
	LOGO_SERVICE_v2: `${DVB_RELATED_CS_v2}:1001.2`,
	LOGO_CG_PROVIDER_v2: `${DVB_RELATED_CS_v2}:1002.1`,

	// A177r1 7.3.1
	BANNER_OUTSIDE_AVAILABILITY_v3: `${DVB_RELATED_CS_v3}:1000.1`,
	BANNER_CONTENT_FINISHED_v3: `${DVB_RELATED_CS_v3}:1000.2`,
	LOGO_SERVICE_LIST_v3: `${DVB_RELATED_CS_v3}:1001.1`,
	LOGO_SERVICE_v3: `${DVB_RELATED_CS_v3}:1001.2`,
	LOGO_CG_PROVIDER_v3: `${DVB_RELATED_CS_v3}:1002.1`,

	// A177r2
	SERVICE_BANNER_v4: `${DVB_RELATED_CS_v3}:1001.3`, // added in A177r3

	// A177 7.3.2
	APP_IN_PARALLEL: `${LINKED_APLICATION_CS}:1.1`,
	APP_IN_CONTROL: `${LINKED_APLICATION_CS}:1.2`,
	APP_OUTSIDE_AVAILABILITY: `${LINKED_APLICATION_CS}:2`,
	APP_SERVICE_PROVIDER: `${LINKED_APLICATION_CS}:3`,

	// A177r7
	APP_IN_SERIES: `${LINKED_APLICATION_CS}:1.3`,
	APP_LIST_INSTALLATION: `${LINKED_APLICATION_CS}:4.1`,
	APP_WITHDRAW_AGREEMENT: `${LINKED_APLICATION_CS}:4.2`,
	APP_RENEW_AGREEMENT: `${LINKED_APLICATION_CS}:4.3`,

	NVOD_MODE_REFERENCE: "reference",
	NVOD_MODE_TIMESHIFTED: "timeshifted",

	// possible values for DVB-S polarization
	DVBS_POLARIZATION_VALUES: ["horizontal", "vertical", "left circular", "right circular"],

	// @encryptionScheme values
	ENCRYPTION_VALID_TYPES: ["cenc", "cbcs", "cbcs-10"],

	// @TransportProtocol values
	ALLOWED_TRANSPORT_PROTOCOLS: ["RTP-AVP", "UDP-FEC"],

	// A177 defined elements and attributes
	a_Address: "Address",
	a_CGSID: "CGSID",
	a_channelNumber: "channelNumber",
	a_contentId: "contentId",
	a_contentLanguage: tva.a_contentLanguage,
	a_contentType: tva.a_contentType,
	a_controlRemoteAccessOverInternet: "controlRemoteAccessOverInternet",
	a_country: "country",
	a_countryCodes: "countryCodes",
	a_cpsIndex: "cpsIndex",
	a_days: "days",
	a_DestinationAddress: "DestinationAddress",
	a_DestinationPort: "DestinationPort",
	a_DestinationPort_ForRTCPReporting: "DestinationPort-ForRTCPReporting",
	a_dvb_disable_rtcp_rr: "dvb-disable-rtcp-rr",
	a_doNotApplyRevocation: "doNotApplyRevocation",
	a_doNotScramble: "doNotScramble",
	a_dvb_t_ret: "dvb-t-ret",
	a_dynamic: "dynamic",
	a_dvb_enable_byte: "dvb-enable-byte",
	a_dvb_original_copy_ret: "dvb-original-copy-ret",
	a_dvb_rsi_mc_ret: "dvb-rsi-mc-ret",
	a_dvb_ssrc_bitmask: "dvb-ssrc-bitmask",
	a_dvb_ssrc_upstream_client: "dvb-ssrc-upstream-client",
	a_dvb_t_wait_max: "dvb-t-wait-max",
	a_dvb_t_wait_min: "dvb-t-wait-min",
	a_enabledKeys: "enabledKeys",
	a_encryptionScheme: "encryptionScheme",
	a_endTime: "endTime",
	a_extensionName: "extensionName",
	a_FECMaxBlockSize: "FECMaxBlockSize",
	a_FECMaxBlockTime: "FECMaxBlockTime",
	a_FECOTI: "FECOTI",
	a_from: "from",
	a_GroupAddress: "GroupAddress",
	a_href: tva.a_href,
	a_id: "id",
	a_MaxBitrate: "MaxBitrate",
	a_mode: "mode",
	a_minimumMetadataUpdatePeriod: "minimumMetadataUpdatePeriod",
	a_offset: "offset",
	a_origNetId: "origNetId",
	a_PayloadTypeNumber: "PayloadTypeNumber",
	a_Port: "Port",
	a_primary: "primary",
	a_priority: "priority",
	a_ranking: "ranking",
	a_recurrence: "recurrence",
	a_reference: "reference",
	a_referenceType: "referenceType",
	a_region: "region",
	a_regionID: "regionID",
	a_regulatorListFlag: "regulatorListFlag",
	a_responseStatus: "responseStatus",
	a_rtcp_bandwidth: "rtcp-bandwidth",
	a_rtcp_mux: "rtcp-mux",
	a_rtcp_rsize: "rtcp-rsize",
	a_RTPPayloadTypeNumber: "RTPPayloadTypeNumber",
	a_RTSPControlURL: "RTSPControlURL",
	a_rtx_time: "rtx-time",
	a_selectable: "selectable",
	a_serviceId: "serviceId",
	a_serviceRef: "serviceRef",
	a_Source: "Source",
	a_SourceAddress: "SourceAddress",
	a_SourcePort: "SourcePort",
	a_ssrc: "ssrc",
	a_startTime: "startTime",
	a_Streaming: "Streaming",
	a_to: "to",
	a_TransportProtocol: "TransportProtocol",
	a_trr_int: "trr-int",
	a_tsId: "tsId",
	a_userDefined: "userDefined",
	a_validFrom: "validFrom",
	a_validTo: "validTo",
	a_version: "version",
	a_visible: "visible",

	e_AdditionalServiceParameters: "AdditionalServiceParameters",
	e_AltServiceName: "AltServiceName",
	e_AudioConformancePoint: "AudioConformancePoint",
	e_Availability: "Availability",
	e_CASystemId: "CASystemId",
	e_ChannelBonding: "ChannelBonding",
	e_CMCD: "CMCD",
	e_CNAME: "CNAME",
	e_Colorimetry: "Colorimetry",
	e_ContentAttributes: "ContentAttributes",
	e_ContentGuideServiceRef: "ContentGuideServiceRef",
	e_ContentGuideSource: "ContentGuideSource",
	e_ContentGuideSourceList: "ContentGuideSourceList",
	e_ContentGuideSourceRef: "ContentGuideSourceRef",
	e_ContentProtection: "ContentProtection",
	e_Coordinates: "Coordinates",
	e_Delivery: "Delivery",
	e_DASHDeliveryParameters: "DASHDeliveryParameters",
	e_DisplayName: "DisplayName",
	e_DRMSystemId: "DRMSystemId",
	e_DVBCDeliveryParameters: "DVBCDeliveryParameters",
	e_DVBSDeliveryParameters: "DVBSDeliveryParameters",
	e_DVBTDeliveryParameters: "DVBTDeliveryParameters",
	e_DVBTriplet: "DVBTriplet",
	e_Extension: "Extension",
	e_FEC: "FEC",
	e_FECBaseLayer: "FECBaseLayer",
	e_FECEnhancementLayer: "FECEnhancementLayer",
	e_Format: "Format",
	e_Frequency: "Frequency",
	e_FTAContentManagement: "FTAContentManagement",
	e_Genre: "Genre",
	e_GroupInfoEndpoint: "GroupInfoEndpoint",
	e_InputStreamIdentifier: "InputStreamIdentifier",
	e_Interval: "Interval",
	e_IPMulticastAddress: "IPMulticastAddress",
	e_Language: "Language",
	e_LanguageList: "LanguageList",
	e_Latitude: "Latitude",
	e_LCN: "LCN",
	e_LCNTable: "LCNTable",
	e_LCNTableList: "LCNTableList",
	e_Longitude: "Longitude",
	e_MinimumAge: "MinimumAge",
	e_MinimumBitRate: "MinimumBitRate",
	e_ModcodMode: "ModcodMode",
	e_ModulationSystem: "ModulationSystem",
	e_ModulationType: "ModulationType",
	e_MoreEpisodesEndpoint: "MoreEpisodesEndpoint",
	e_MulticastRET: "MulticastRET",
	e_MulticastTSDeliveryParameters: "MulticastTSDeliveryParameters",
	e_Name: "Name",
	e_NetworkID: "NetworkID",
	e_NVOD: "NVOD",
	e_OrbitalPosition: "OrbitalPosition",
	e_OtherDeliveryParameters: "OtherDeliveryParameters",
	e_ParentalRating: "ParentalRating",
	e_Period: "Period",
	e_PlaylistEntry: "PlaylistEntry",
	e_Polarization: "Polarization",
	e_Postcode: "Postcode",
	e_PostcodeRange: "PostcodeRange",
	e_ProgramInfoEndpoint: "ProgramInfoEndpoint",
	e_Prominence: "Prominence",
	e_ProminenceList: "ProminenceList",
	e_PromotionalMedia: "PromotionalMedia",
	e_PromotionalText: "PromotionalText",
	e_Provider: "Provider",
	e_ProviderName: "ProviderName",
	e_ProviderOffering: "ProviderOffering",
	e_QueryParameters: "QueryParameters",
	e_Radius: "Radius",
	e_RecordingInfo: "RecordingInfo",
	e_Region: "Region",
	e_RegionList: "RegionList",
	e_RegionName: "RegionName",
	e_RelatedMaterial: tva.e_RelatedMaterial,
	e_RollOff: "RollOff",
	e_RTCPReporting: "RTCPReporting",
	e_RTPRetransmission: "RTPRetransmission",
	e_RTSPDeliveryParameters: "RTSPDeliveryParameters",
	e_RTSPURL: "RTSPURL",
	e_SATIPDeliveryParameters: "SATIPDeliveryParameters",
	e_ScheduleInfoEndpoint: "ScheduleInfoEndpoint",
	e_SegmentReference: "SegmentReference",
	e_Service: "Service",
	e_ServiceDescription: "ServiceDescription",
	e_ServiceInstance: "ServiceInstance",
	e_ServiceGenre: "ServiceGenre",
	e_ServiceList: "ServiceList",
	e_ServiceListOffering: "ServiceListOffering",
	e_ServiceName: "ServiceName",
	e_ServiceType: "ServiceType",
	e_SocialMediaReference: "SocialMediaReference",
	e_SourceMediaReference: "SourceMediaReference",
	e_SourceType: "SourceType",
	e_ssrc: "ssrc",
	e_StillPictureFormat: "StillPictureFormat",
	e_SubscriptionPackage: "SubscriptionPackage",
	e_SubscriptionPackageList: "SubscriptionPackageList",
	e_SymbolRate: "SymbolRate",
	e_TargetCountry: "TargetCountry",
	e_TargetRegion: "TargetRegion",
	e_TestService: "TestService",
	e_UnicastRET: "UnicastRET",
	e_UniqueIdentifier: "UniqueIdentifier",
	e_URI: "URI",
	e_UriBasedLocation: "UriBasedLocation",
	e_VideoConformancePoint: "VideoConformancePoint",
	e_WildcardPostcode: "WildcardPostcode",

	q_inlineImages: "inlineImages",
};

export const dvbEA = {
	// EA = Element-Attributes - the attributes that are defiend for each element
	MediaLocator: [dvbi.a_contentLanguage].concat(tvaEA.mediaLocator),
	NVOD: [dvbi.a_mode, dvbi.a_reference, dvbi.a_offset],
	ServiceList: [dvbi.a_version, tva.a_lang, dvbi.a_responseStatus, dvbi.a_id],
};

export const dvbiEC = {
	// EC = Element-Children - the child elements or each element
	RelatedMaterial: tvaEC.RelatedMaterial,
};
