/**
 * DVB-I_defintions.mjs
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Defintions made in DVB A177 Bluebooks
 */

import { mpeg7 } from "./MPEG7_definitions.mts";
import { tva, tvaEA, tvaEC, TVA_CSmetadata } from "./TVA_definitions.mts";
import { HBBTV_APP_TYPE } from "./HbbTV_definitions.mts";
import { HbbTV_Standard_versions, HbbTV_Features } from './HbbTV_definitions.mts'
import { CTA5000_Standard_versions} from './CTA_definitions.mts'

export const slVersions: Record<string, number> = {
	r0: 0,					// A177
	r1: 1,					// A177r1
	r2: 2,					// A177r2
	r3: 3,					// A177r3
	r4: 4,					// A177r4 - ETSI TS 103 770 v1.0.1 (2022-12)
	r5: 5,					// A177r5
	r6: 6,					// A177r6 - ETSI TS 103 770 v1.2.1 (2024-06)
	r7: 7,					// A177r7
	r8: 8,					// A177r8 - draft ETSI TS 103 770 v1.3.1 (2026-mm)
	unknown: -1,
};

export const cgVersions: Record<string, number> = {
	r0: 0,
	r1: 1,
	r2: 2,				// ETSI TS 102 822-3-1 v1.13.1
	r3: 3,				// ETSI TS 102 822-3-1 v1.14.1
	unknown: -1,
};

const DVB_metadata:string = "urn:dvb:metadata";
const DVB_CSmetadata:string = `${DVB_metadata}:cs`,
	FVC_CSmetadata:string = "urn:fvc:metadata:cs";

const PaginationPrefix:string = `${FVC_CSmetadata}:HowRelatedCS:2015-12:pagination`,
	NowNextCRIDPrefix:string = "crid://dvb.org/metadata/schedules/now-next";

const DVB_SOURCE_PREFIX:string = `${DVB_metadata}:source`;
const LINKED_APLICATION_CS:string = `${DVB_CSmetadata}:LinkedApplicationCS:2019`;

const DVB_HowRelatedCS:string = `${DVB_CSmetadata}:HowRelatedCS`,
	DVB_RELATED_CS_v1:string = `${DVB_HowRelatedCS}:2019`,
	DVB_RELATED_CS_v2:string = `${DVB_HowRelatedCS}:2020`,
	DVB_RELATED_CS_v3:string = `${DVB_HowRelatedCS}:2021`;

export const CONTENT_FINISHED_TERM:string = "1000.2",
	OUTSIDE_AVAILABILITY_TERM:string = "1000.1";

const FVC_HowRelatedCS:string = `${FVC_CSmetadata}:HowRelatedCS:2018`;

const CaptionCodingFormatCS:string = `${TVA_CSmetadata}:CaptionCodingFormatCS:2015`,
	AudioPurposeCS:string = `${TVA_CSmetadata}:AudioPurposeCS:2007`,
	MediaAvailabilityCS:string = `${FVC_CSmetadata}:MediaAvailabilityCS:2014-07`,
	ForwardEPGAvailabilityCS:string = `${FVC_CSmetadata}:FEPGAvailabilityCS:2014-10`,
	RestartAvailabilityCS:string = `${FVC_CSmetadata}:RestartAvailabilityCS:2018`;

export const XMLdocumentType:string = "application/xml";

const CMCDterm:string = `${DVB_metadata}:cmcd`;
const CMCDdelivery:string = `${CMCDterm}:delivery`;
export const CMCD_MODE_REQUEST:string = `${CMCDdelivery}:request`;
export const CMCD_MODE_EVENT:string = `${CMCDdelivery}:event`;

export const CMCD_METHOD_HTTP_HEADER:string = `${CMCDdelivery}:customHTTPHeader`,
	CMCD_METHOD_QUERY_ARGUMENT:string = `${CMCDdelivery}:queryArguments`,
	CMCD_METHOD_BODY:string = `${CMCDdelivery}:body`;

const dvbi_types: Record<string, string> = {
	a_verificationPolicy : tva.a_verificationPolicy,
}


type dvbi_info_type  = {
	A177_Namespace: string
	A177r1_Namespace: string
	A177r2_Namespace: string
	A177r3_Namespace: string
	A177r4_Namespace: string
	A177r5_Namespace: string
	A177r6_Namespace: string
	A177r7_Namespace: string
	A177r8_Namespace: string

	ApplicationStandards: string[]
	ApplicationOptions: string[]

	MIN_LCN: number
	MAX_LCN: number

	MAX_TITLE_LENGTH: number
	MAX_KEYWORD_LENGTH: number
	MAX_ORGANIZATION_NAME_LENGTH: number
	MAX_NAME_PART_LENGTH: number
	MAX_EXPLANATORY_TEXT_LENGTH: number

	MAX_CREDITS_ITEMS: number

	XML_AIT_CONTENT_TYPE: string
	HTML5_APP: string
	XHTML_APP: string
	XML_APP: string
	//	iOS_APP: string
	//	ANDROID_APP: string
	TEMPLATE_AIT_URI: string

	PAGINATION_FIRST_URI: string
	PAGINATION_PREV_URI: string
	PAGINATION_NEXT_URI: string
	PAGINATION_LAST_URI: string

	CRID_NOW: string
	CRID_LATER: string
	CRID_EARLIER: string

	MAX_SUBREGION_LEVELS: number

	EIT_PROGRAMME_CRID_TYPE: string
	EIT_SERIES_CRID_TYPE:string

	DVBT_SOURCE_TYPE: string
	DVBS_SOURCE_TYPE: string
	DVBC_SOURCE_TYPE: string
	DVBIPTV_SOURCE_TYPE: string
	DVBDASH_SOURCE_TYPE: string
	DVBAPPLICATION_SOURCE_TYPE: string

	CONTENT_TYPE_DASH_MPD: string 
	old_CONTENT_TYPE_DVB_PLAYLIST: string
	CONTENT_TYPE_DVB_PLAYLIST: string

	CONTENT_TYPE_SERVCE_LIST: string

	DTG_CONTENT_WARNING_CS_SCHEME: string

	AUDIO_PURPOSE_VISUAL_IMPAIRED: string
	AUDIO_PURPOSE_HEARING_IMPAIRED: string
	AUDIO_PURPOSE_MAIN: string
	AUDIO_PURPOSE_DIALOGUE_ENHANCEMENT: string

	DVB_BITMAP_SUBTITLES: string
	DVB_CHARACTER_SUBTITLES: string
	EBU_TT_D: string

	MEDIA_AVAILABLE: string
	MEDIA_UNAVAILABLE: string

	FORWARD_EPG_AVAILABLE: string
	FORWARD_EPG_UNAVAILABLE: string

	RESTART_LINK: string

	RESTART_AVAILABLE: string
	RESTART_CHECK: string
	RESTART_PENDING: string

	BANNER_OUTSIDE_AVAILABILITY_v1: string
	LOGO_SERVICE_LIST_v1: string
	LOGO_SERVICE_v1: string
	LOGO_CG_PROVIDER_v1: string

	BANNER_OUTSIDE_AVAILABILITY_v2: string
	BANNER_CONTENT_FINISHED_v2: string
	LOGO_SERVICE_LIST_v2: string
	LOGO_SERVICE_v2:string
	LOGO_CG_PROVIDER_v2: string

	BANNER_OUTSIDE_AVAILABILITY_v3: string
	BANNER_CONTENT_FINISHED_v3: string
	LOGO_SERVICE_LIST_v3: string
	LOGO_SERVICE_v3: string
	LOGO_CG_PROVIDER_v3: string

	SERVICE_BANNER_v4: string

	APP_IN_PARALLEL: string
	APP_IN_CONTROL: string
	APP_OUTSIDE_AVAILABILITY: string
	APP_SERVICE_PROVIDER: string

	APP_IN_SERIES: string
	APP_LIST_INSTALLATION: string
	APP_WITHDRAW_AGREEMENT: string
	APP_RENEW_AGREEMENT: string

	NVOD_MODE_REFERENCE: string
	NVOD_MODE_TIMESHIFTED: string

	DVBS_POLARIZATION_VALUES: string[]

	ENCRYPTION_VALID_TYPES: string[]

	ALLOWED_TRANSPORT_PROTOCOLS: string[]

	ALLOWED_DIGESTS: string[]

	ALLOWED_FINGERPRINT_ALGOS: string[]

	ICECAST_V1_IDENTIFIER: string
}

type dvbi_attributes	= {
	a_algorithm: string
	a_Address: string
	a_batchSize: string
	a_certificateURL: string
	a_CGSID: string
	a_channelNumber: string
	a_CMCDversion: string
	a_contentId: string
	a_contentLanguage: typeof tva.a_contentLanguage
	a_contentType: typeof tva.a_contentType
	a_controlRemoteAccessOverInternet: string
	a_country: string
	a_countryCodes: string
	a_cpsIndex: string
	a_days: string
	a_DestinationAddress: string
	a_DestinationPort: string
	a_DestinationPort_ForRTCPReporting: string
	a_dvb_disable_rtcp_rr: string
	a_doNotApplyRevocation: string
	a_doNotScramble: string
	a_dvb_t_ret: string
	a_dynamic: string
	a_dvb_enable_byte: string
	a_dvb_original_copy_ret: string
	a_dvb_rsi_mc_ret: string
	a_dvb_ssrc_bitmask: string
	a_dvb_ssrc_upstream_client: string
	a_dvb_t_wait_max: string
	a_dvb_t_wait_min: string
	a_enabledKeys: string
	a_encryptionScheme: string
	a_end: string
	a_endTime: string
	a_eventTypes: string
	a_eventURL: string
	a_extensionName: string
	a_extraCapabilities: string
	a_FECMaxBlockSize: string
	a_FECMaxBlockTime: string
	a_FECOTI:string
	a_from: string
	a_GroupAddress: string
	a_href: typeof tva.a_href,
	a_id: string
	a_lang: typeof tva.a_lang,
	a_LAURL: string
	a_MaxBitrate: string
	a_mode: string
	a_minimumMetadataUpdatePeriod: string
	a_obfuscateURL: string
	a_objectTypes: string
	a_offset: string
	a_origNetId: string
	a_PayloadTypeNumber: string
	a_policyId: string
	a_Port: string
	a_primary: string
	a_priority: string
	a_probability: string
	a_ranking: string
	a_recurrence: string
	a_reference: string
	a_referenceType: string
	a_region: string
	a_regionID: string
	a_replayAvailable: string
	a_reportingMethod: string
	a_reportingMode: string
	a_responseStatus: string
	a_rtcp_bandwidth: string
	a_rtcp_mux: string
	a_rtcp_rsize: string
	a_RTPPayloadTypeNumber: string
	a_RTSPControlURL: string
	a_rtx_time: string
	a_selectable: string
	a_serviceGenre: string
	a_serviceId: string
	a_serviceRef: string
	a_serviceType: string
	a_Source: string
	a_SourceAddress: string
	a_SourcePort: string
	a_ssrc: string
	a_start: string
	a_startTime: string
	a_Streaming: string
	a_to: string
	a_transmissionMode: string
	a_TransportProtocol: string
	a_trr_int: string
	a_tsId: string
	a_userDefined: string
	a_validFrom: string
	a_validTo: string,
	a_verificationPolicy: typeof dvbi_types.a_verificationPolicy,
	a_version: string
	a_visible: string
}

type dvbi_elements = {
	e_AdditionalServiceParameters: string
	e_AltServiceName: string
	e_AudioConformancePoint: string
	e_Availability: string
	e_CAFingerprint: string
	e_CASystemId: string
	e_ChannelBonding: string
	e_CMCD: string
	e_CNAME: string
	e_Colorimetry: string
	e_ContentAttributes: string
	e_ContentGuideServiceRef: string
	e_ContentGuideSource: string,
	e_ContentGuideSourceList: string
	e_ContentGuideSourceRef: string
	e_ContentProtection: string
	e_Coordinates: string
	e_Delivery: string
	e_DASHDeliveryParameters: string
	e_DisplayName: string
	e_DRMSystemId: string
	e_DVBCDeliveryParameters: string
	e_DVBSDeliveryParameters: string
	e_DVBTDeliveryParameters: string
	e_DVBTriplet: string
	e_Extension: string
	e_FEC: string
	e_FECBaseLayer: string
	e_FECEnhancementLayer: string
	e_Format: string
	e_Frequency: string
	e_FTAContentManagement: string
	e_Genre: string
	e_GroupInfoEndpoint:string
	e_IdentifierBasedDeliveryParameters: string
	e_InputStreamIdentifier: string
	e_Interval: string
	e_IPMulticastAddress: string
	e_Language: string
	e_LanguageList: string
	e_Latitude: string
	e_LCN: string
	e_LCNRange: string
	e_LCNTable: string
	e_LCNTableList: string
	e_Longitude: string
	e_MinimumAge: string
	e_MinimumBitRate: string
	e_ModcodMode: string
	e_ModulationSystem: string
	e_ModulationType: string
	e_MoreEpisodesEndpoint: string
	e_MulticastRET: string
	e_MulticastTSDeliveryParameters: string
	e_Name: typeof mpeg7.e_Name,
	e_NetworkID: string
	e_NVOD: string
	e_OrbitalPosition:string
	e_OtherDeliveryParameters: string
	e_ParentalRating: string
	e_Period:string
	e_Playlist: string
	e_PlaylistEntry: string
	e_Polarization: string
	e_Postcode: string
	e_PostcodeRange: string
	e_ProgramInfoEndpoint:string
	e_Prominence: string
	e_ProminenceList: string
	e_PromotionalMedia: string
	e_PromotionalText: string
	e_ProviderName: string
	e_QueryParameters: string
	e_Radius: string
	e_RecordingInfo: string
	e_Region: string
	e_RegionList: string
	e_RegionName: string
	e_RelatedMaterial: typeof tva.e_RelatedMaterial,
	e_RollOff: string
	e_Report: string
	e_Requires: string
	e_RTCPReporting: string
	e_RTPRetransmission: string
	e_RTSPDeliveryParameters: string
	e_RTSPURL: string
	e_SATIPDeliveryParameters: string
	e_ScheduleInfoEndpoint: string
	e_SegmentReference: string
	e_Service: string
	e_ServiceDescription: string
	e_ServiceInstance: string
	e_ServiceGenre: string
	e_ServiceList: string
	e_ServiceName: string
	e_ServiceType: string
	e_SignaturePolicies: string
	e_SignaturePolicy: string
	e_SocialMediaReference: string
	e_SourceMediaReference: string
	e_SourceType: string
	e_ssrc: string
	e_StandardVersion: string
	e_StillPictureFormat: string
	e_SubscriptionPackage: string
	e_SubscriptionPackageList: string
	e_SymbolRate: string
	e_TargetCountry: string
	e_TargetRegion: string
	e_TestService: string
	e_TrustAnchor: string
	e_UnicastRET: string
	e_UniqueIdentifier: string
	e_URI: string
	e_UriBasedLocation: string
	e_VideoConformancePoint: string
	e_WildcardPostcode: string
}

export const dvbi: dvbi_info_type & dvbi_attributes & dvbi_elements = {
	A177_Namespace: `${DVB_metadata}:servicediscovery:2019`,
	A177r1_Namespace: `${DVB_metadata}:servicediscovery:2020`,
	A177r2_Namespace: `${DVB_metadata}:servicediscovery:2021`,
	A177r3_Namespace: `${DVB_metadata}:servicediscovery:2022`,
	A177r4_Namespace: `${DVB_metadata}:servicediscovery:2022b`,
	A177r5_Namespace: `${DVB_metadata}:servicediscovery:2023`,
	A177r6_Namespace: `${DVB_metadata}:servicediscovery:2024`,
	A177r7_Namespace: `${DVB_metadata}:servicediscovery:2025`,
	A177r8_Namespace: `${DVB_metadata}:servicediscovery:2026`,

	ApplicationStandards: [],		// populated dynamically below
	ApplicationOptions: [],   // populated dynamically below

	MIN_LCN: 1,
	MAX_LCN: 9999,

	MAX_TITLE_LENGTH: 80,
	MAX_KEYWORD_LENGTH: 32,
	MAX_ORGANIZATION_NAME_LENGTH: 32,
	MAX_NAME_PART_LENGTH: 32,
	MAX_EXPLANATORY_TEXT_LENGTH: 160,

	MAX_CREDITS_ITEMS: 40,

	XML_AIT_CONTENT_TYPE: "application/vnd.dvb.ait+xml",
	HTML5_APP: "text/html",
	XHTML_APP: "application/xhtml+xml",
	XML_APP: "application/xml", // replaces XML_AIT_CONTENT_TYPE from A177r7
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
	old_CONTENT_TYPE_DVB_PLAYLIST: XMLdocumentType, // XML Playlist prior to A177r8
	CONTENT_TYPE_DVB_PLAYLIST: "application/vnd.dvb.dash-playlist+xml", // XML Playlist for A177r8 onwards

	// A177 5.1.2
	CONTENT_TYPE_SERVCE_LIST: "application/vnd.dvb.dvbisl+xml",

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
	BANNER_OUTSIDE_AVAILABILITY_v1: `${DVB_RELATED_CS_v1}:${OUTSIDE_AVAILABILITY_TERM}`,
	LOGO_SERVICE_LIST_v1: `${DVB_RELATED_CS_v1}:1001.1`,
	LOGO_SERVICE_v1: `${DVB_RELATED_CS_v1}:1001.2`,
	LOGO_CG_PROVIDER_v1: `${DVB_RELATED_CS_v1}:1002.1`,

	// A177r1 7.3.1
	BANNER_OUTSIDE_AVAILABILITY_v2: `${DVB_RELATED_CS_v2}:${OUTSIDE_AVAILABILITY_TERM}`,
	BANNER_CONTENT_FINISHED_v2: `${DVB_RELATED_CS_v2}:${CONTENT_FINISHED_TERM}`, // added in A17732
	LOGO_SERVICE_LIST_v2: `${DVB_RELATED_CS_v2}:1001.1`,
	LOGO_SERVICE_v2: `${DVB_RELATED_CS_v2}:1001.2`,
	LOGO_CG_PROVIDER_v2: `${DVB_RELATED_CS_v2}:1002.1`,

	// A177r1 7.3.1
	BANNER_OUTSIDE_AVAILABILITY_v3: `${DVB_RELATED_CS_v3}:${OUTSIDE_AVAILABILITY_TERM}`,
	BANNER_CONTENT_FINISHED_v3: `${DVB_RELATED_CS_v3}:${CONTENT_FINISHED_TERM}`,
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

	// permitted values for @integrity algorithm
	ALLOWED_DIGESTS: ["sha1", "sha256", "sm3"],

	// REVIEW!! currently there is no profiled subset of fingerprint algorithms defined for DVB-I, so this check is not currently used.
	ALLOWED_FINGERPRINT_ALGOS: [],

	// A177 annex K - Icecast
	ICECAST_V1_IDENTIFIER: "urn:dvb:icecast:v1",

	// A177 defined elements and attributes
	a_algorithm: "algorithm",
	a_Address: "Address",
	a_batchSize: "batchSize",
	a_certificateURL: "certificateURL",
	a_CGSID: "CGSID",
	a_channelNumber: "channelNumber",
	a_CMCDversion: "CMCDversion",
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
	a_end: "end",
	a_endTime: "endTime",
	a_eventTypes: "eventTypes",
	a_eventURL: "eventURL",
	a_extensionName: "extensionName",
	a_extraCapabilities: "extraCapabilities",
	a_FECMaxBlockSize: "FECMaxBlockSize",
	a_FECMaxBlockTime: "FECMaxBlockTime",
	a_FECOTI: "FECOTI",
	a_from: "from",
	a_GroupAddress: "GroupAddress",
	a_href: tva.a_href,
	a_id: "id",
	a_lang: tva.a_lang,
	a_LAURL: "LAURL",
	a_MaxBitrate: "MaxBitrate",
	a_mode: "mode",
	a_minimumMetadataUpdatePeriod: "minimumMetadataUpdatePeriod",
	a_obfuscateURL: "obfuscateURL",
	a_objectTypes: "objectTypes",
	a_offset: "offset",
	a_origNetId: "origNetId",
	a_PayloadTypeNumber: "PayloadTypeNumber",
	a_policyId: "policyId",
	a_Port: "Port",
	a_primary: "primary",
	a_priority: "priority",
	a_probability: "probability",
	a_ranking: "ranking",
	a_recurrence: "recurrence",
	a_reference: "reference",
	a_referenceType: "referenceType",
	a_region: "region",
	a_regionID: "regionID",
	a_replayAvailable: "replayAvailable",
	a_reportingMethod: "reportingMethod",
	a_reportingMode: "reportingMode",
	a_responseStatus: "responseStatus",
	a_rtcp_bandwidth: "rtcp-bandwidth",
	a_rtcp_mux: "rtcp-mux",
	a_rtcp_rsize: "rtcp-rsize",
	a_RTPPayloadTypeNumber: "RTPPayloadTypeNumber",
	a_RTSPControlURL: "RTSPControlURL",
	a_rtx_time: "rtx-time",
	a_selectable: "selectable",
	a_serviceGenre: "serviceGenre",
	a_serviceId: "serviceId",
	a_serviceRef: "serviceRef",
	a_serviceType: "serviceType",
	a_Source: "Source",
	a_SourceAddress: "SourceAddress",
	a_SourcePort: "SourcePort",
	a_ssrc: "ssrc",
	a_start: "start",
	a_startTime: "startTime",
	a_Streaming: "Streaming",
	a_to: "to",
	a_transmissionMode: "transmissionMode",
	a_TransportProtocol: "TransportProtocol",
	a_trr_int: "trr-int",
	a_tsId: "tsId",
	a_userDefined: "userDefined",
	a_validFrom: "validFrom",
	a_validTo: "validTo",
	a_verificationPolicy: dvbi_types.a_verificationPolicy,
	a_version: "version",
	a_visible: "visible",

	e_AdditionalServiceParameters: "AdditionalServiceParameters",
	e_AltServiceName: "AltServiceName",
	e_AudioConformancePoint: "AudioConformancePoint",
	e_Availability: "Availability",
	e_CAFingerprint: "CAFingerprint",
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
	e_IdentifierBasedDeliveryParameters: "IdentifierBasedDeliveryParameters",
	e_InputStreamIdentifier: "InputStreamIdentifier",
	e_Interval: "Interval",
	e_IPMulticastAddress: "IPMulticastAddress",
	e_Language: "Language",
	e_LanguageList: "LanguageList",
	e_Latitude: "Latitude",
	e_LCN: "LCN",
	e_LCNRange: "LCNRange",
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
	e_Name: mpeg7.e_Name,
	e_NetworkID: "NetworkID",
	e_NVOD: "NVOD",
	e_OrbitalPosition: "OrbitalPosition",
	e_OtherDeliveryParameters: "OtherDeliveryParameters",
	e_ParentalRating: "ParentalRating",
	e_Period: "Period",
	e_Playlist: "Playlist",
	e_PlaylistEntry: "PlaylistEntry",
	e_Polarization: "Polarization",
	e_Postcode: "Postcode",
	e_PostcodeRange: "PostcodeRange",
	e_ProgramInfoEndpoint: "ProgramInfoEndpoint",
	e_Prominence: "Prominence",
	e_ProminenceList: "ProminenceList",
	e_PromotionalMedia: "PromotionalMedia",
	e_PromotionalText: "PromotionalText",
	e_ProviderName: "ProviderName",
	e_QueryParameters: "QueryParameters",
	e_Radius: "Radius",
	e_RecordingInfo: "RecordingInfo",
	e_Region: "Region",
	e_RegionList: "RegionList",
	e_RegionName: "RegionName",
	e_RelatedMaterial: tva.e_RelatedMaterial,
	e_RollOff: "RollOff",
	e_Report: "Report",
	e_Requires: "Requires",
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
	e_ServiceName: "ServiceName",
	e_ServiceType: "ServiceType",
	e_SignaturePolicies: "SignaturePolicies",
	e_SignaturePolicy: "SignaturePolicy",
	e_SocialMediaReference: "SocialMediaReference",
	e_SourceMediaReference: "SourceMediaReference",
	e_SourceType: "SourceType",
	e_ssrc: "ssrc",
	e_StandardVersion: "StandardVersion",
	e_StillPictureFormat: "StillPictureFormat",
	e_SubscriptionPackage: "SubscriptionPackage",
	e_SubscriptionPackageList: "SubscriptionPackageList",
	e_SymbolRate: "SymbolRate",
	e_TargetCountry: "TargetCountry",
	e_TargetRegion: "TargetRegion",
	e_TestService: "TestService",
	e_TrustAnchor: "TrustAnchor",
	e_UnicastRET: "UnicastRET",
	e_UniqueIdentifier: "UniqueIdentifier",
	e_URI: "URI",
	e_UriBasedLocation: "UriBasedLocation",
	e_VideoConformancePoint: "VideoConformancePoint",
	e_WildcardPostcode: "WildcardPostcode",
};
HbbTV_Standard_versions.forEach((v) => (dvbi.ApplicationStandards as string[]).push(v))
CTA5000_Standard_versions.forEach((v) => (dvbi.ApplicationStandards as string[]).push(v))
HbbTV_Features.forEach((f) => (dvbi.ApplicationOptions as string[]).push(f)) 


export const dvbisld: Record<string, string> = {
	A177_Namespace: `${DVB_metadata}:servicelistdiscovery:2019`,
	A177r1_Namespace: `${DVB_metadata}:servicelistdiscovery:2020`,
	A177r2_Namespace: `${DVB_metadata}:servicelistdiscovery:2021`,
	A177r3_Namespace: `${DVB_metadata}:servicelistdiscovery:2022`,
	A177r4_Namespace: `${DVB_metadata}:servicelistdiscovery:2022b`,
	A177r5_Namespace: `${DVB_metadata}:servicelistdiscovery:2023`,
	A177r6_Namespace: `${DVB_metadata}:servicelistdiscovery:2024`,
	A177r7_Namespace: `${DVB_metadata}:servicelistdiscovery:2025`,
	A177r8_Namespace: `${DVB_metadata}:servicelistdiscovery:2026`,

	a_contentType: dvbi.a_contentType as string,
	a_originalNetworkID: "originalNetworkID",
	a_regulatorFlag: "regulatorFlag",
	a_regulatorListFlag: "regulatorListFlag",
	a_standardVersion: "standardVersion",
	a_verificationPolicy: dvbi_types.a_verificationPolicy,
	a_xmlAitApplicationType: "xmlAitApplicationType",

	e_ApplicationDelivery: "ApplicationDelivery",
	e_ApplicationType: "ApplicationType",
	e_Delivery: dvbi.e_Delivery as string,
	e_DASHDelivery: "DASHDelivery",
	e_DVBCDelivery: "DVBCDelivery",
	e_DVBSDelivery: "DVBSDelivery",
	e_DVBTDelivery: "DVBTDelivery",
	e_Language: dvbi.e_Language as string,
	e_MulticastTSDelivery: "MulticastTSDelivery",
	e_Provider: "Provider",
	e_ProviderOffering: "ProviderOffering",
	e_RelatedMaterial: dvbi.e_RelatedMaterial as string,
	e_RTSPDelivery: "RTSPDelivery",
	e_ServiceListEntryPoints: "ServiceListEntryPoints",
	e_ServiceListId: "ServiceListId",
	e_ServiceListName: "ServiceListName",
	e_ServiceListOffering: "ServiceListOffering",
	e_ServiceListRegistryEntity: "ServiceListRegistryEntity",
	e_ServiceListURI: "ServiceListURI",
	e_TargetCountry: dvbi.e_TargetCountry as string,
	e_URI: dvbi.e_URI as string,

	q_inlineImages: "inlineImages",
};

export const validApplicationTypes: string[] = [
	dvbi.XML_AIT_CONTENT_TYPE as string, 
	dvbi.HTML5_APP as string, 
	dvbi.XHTML_APP as string, 
	dvbi.XML_APP as string
];

// ETSI TS 102 809 clause 5.4.4.12
export const DvbApplicationType: string[] = ["DVB-J", "DVB-HTML"];

// A177 clause 5.2.4.1
export const DvbIApplicationTypes: string[] = [
	dvbi.HTML5_APP as string, 
	dvbi.XHTML_APP as string, 
	HBBTV_APP_TYPE
];

export const dvbiEA: Record<string, string[]> = {
	// EA = Element-Attributes - the attributes that are defiend for each element
	MediaLocator: [dvbi.a_contentLanguage as string].concat(tvaEA.MediaLocator),
	NVOD: [dvbi.a_mode as string, dvbi.a_reference as string, dvbi.a_offset as string],
	ServiceList: [dvbi.a_version as string, tva.a_lang, dvbi.a_responseStatus as string, dvbi.a_id as string],
	ServiceListEntryPoints: [dvbi.a_version as string, tva.a_lang],
	CMCD: [dvbi.a_reportingMode as string, dvbi.a_transmissionMode as string, dvbi.a_contentId as string, dvbi.a_enabledKeys as string, dvbi.a_probability as string],
	CMCDv2: [dvbi.a_reportingMode as string, dvbi.a_eventURL as string, dvbi.a_transmissionMode as string, dvbi.a_batchSize as string, dvbi.a_contentId as string, dvbi.a_enabledKeys as string, dvbi.a_probability as string, dvbi.a_obfuscateURL as string],
	ServiceType: [dvbi.a_dynamic as string, dvbi.a_version as string, dvbi.a_replayAvailable as string, dvbi.a_lang as string],
	ServiceInstanceType: [dvbi.a_priority as string, dvbi.a_id as string, tva.a_lang],
};

export const dvbiEC: Record<string, string[]> = {
	// EC = Element-Children - the child elements or each element
	RelatedMaterial: tvaEC.RelatedMaterial,
	OrganizationType: [mpeg7.e_Name, mpeg7.e_Kind, mpeg7.e_ContactName, mpeg7.e_Jurisdiction, mpeg7.e_Address, mpeg7.e_ElectronicAddress],
	ServiceType: [
		dvbi.e_UniqueIdentifier as string,
		dvbi.e_ServiceInstance as string,
		dvbi.e_TargetRegion as string,
		dvbi.e_ServiceName as string,
		dvbi.e_ProviderName as string,
		dvbi.e_RelatedMaterial as string,
		dvbi.e_ServiceGenre as string,
		dvbi.e_ServiceType as string,
		dvbi.e_ServiceDescription as string,
		dvbi.e_RecordingInfo as string,
		dvbi.e_ContentGuideSource as string,
		dvbi.e_ContentGuideSourceRef as string,
		dvbi.e_ContentGuideServiceRef as string,
		dvbi.e_AdditionalServiceParameters as string,
		dvbi.e_NVOD as string,
		dvbi.e_ProminenceList as string,
		dvbi.e_ParentalRating as string,
	],
	ServiceInstanceType: [
		dvbi.e_DisplayName as string,
		dvbi.e_RelatedMaterial as string,
		dvbi.e_ContentProtection as string,
		dvbi.e_ContentAttributes as string,
		dvbi.e_Availability as string,
		dvbi.e_SubscriptionPackage as string,
		dvbi.e_FTAContentManagement as string,
		dvbi.e_SourceType as string,
		dvbi.e_AltServiceName as string,
		dvbi.e_DVBTDeliveryParameters as string,
		dvbi.e_DVBSDeliveryParameters as string,
		dvbi.e_DVBCDeliveryParameters as string,
		dvbi.e_SATIPDeliveryParameters as string,
		dvbi.e_RTSPDeliveryParameters as string,
		dvbi.e_MulticastTSDeliveryParameters as string,
		dvbi.e_OtherDeliveryParameters as string,
		dvbi.e_IdentifierBasedDeliveryParameters as string,
	],
	ContentProtectionType: [dvbi.e_CASystemId as string, dvbi.e_DRMSystemId as string],
};
