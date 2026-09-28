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


class DVBIdefinitions {
	A177_Namespace: string = `${DVB_metadata}:servicediscovery:2019`
	A177r1_Namespace: string = `${DVB_metadata}:servicediscovery:2020`
	A177r2_Namespace: string = `${DVB_metadata}:servicediscovery:2021`
	A177r3_Namespace: string = `${DVB_metadata}:servicediscovery:2022`
	A177r4_Namespace: string = `${DVB_metadata}:servicediscovery:2022b`
	A177r5_Namespace: string = `${DVB_metadata}:servicediscovery:2023`
	A177r6_Namespace: string = `${DVB_metadata}:servicediscovery:2024`
	A177r7_Namespace: string = `${DVB_metadata}:servicediscovery:2025`
	A177r8_Namespace: string = `${DVB_metadata}:servicediscovery:2026`

	ApplicationStandards: string[] = []		// populated dynamically below
	ApplicationOptions: string[] = []   // populated dynamically below

	MIN_LCN: number = 1
	MAX_LCN: number = 9999

	MAX_TITLE_LENGTH: number = 80
	MAX_KEYWORD_LENGTH: number = 32
	MAX_ORGANIZATION_NAME_LENGTH: number = 32
	MAX_NAME_PART_LENGTH: number = 32
	MAX_EXPLANATORY_TEXT_LENGTH: number = 160

	MAX_CREDITS_ITEMS: number = 40

	XML_AIT_CONTENT_TYPE: string = "application/vnd.dvb.ait+xml"
	HTML5_APP: string = "text/html"
	XHTML_APP: string = "application/xhtml+xml"
	XML_APP: string = "application/xml" // replaces XML_AIT_CONTENT_TYPE from A177r7
	//	iOS_APP: string = "application/vnd.dvb.app.ios"
	//	ANDROID_APP: string = "application/vnd.dvb.app.android"
	TEMPLATE_AIT_URI: string = `${FVC_HowRelatedCS}:templateAIT`

	PAGINATION_FIRST_URI: string = `${PaginationPrefix}:first`
	PAGINATION_PREV_URI: string = `${PaginationPrefix}:prev`
	PAGINATION_NEXT_URI: string = `${PaginationPrefix}:next`
	PAGINATION_LAST_URI: string = `${PaginationPrefix}:last`

	CRID_NOW: string = `${NowNextCRIDPrefix}/now`
	CRID_LATER: string = `${NowNextCRIDPrefix}/later`
	CRID_EARLIER: string = `${NowNextCRIDPrefix}/earlier`

	MAX_SUBREGION_LEVELS: number = 3 // definied for <RegionElement> in Table 33 of A177

	EIT_PROGRAMME_CRID_TYPE: string = "eit-programme-crid"
	EIT_SERIES_CRID_TYPE: string = "eit-series-crid"

	// A177 only table 15 - deprecated in A177r1
	DVBT_SOURCE_TYPE: string = `${DVB_SOURCE_PREFIX}:dvb-t`
	DVBS_SOURCE_TYPE: string = `${DVB_SOURCE_PREFIX}:dvb-s`
	DVBC_SOURCE_TYPE: string = `${DVB_SOURCE_PREFIX}:dvb-c`
	DVBIPTV_SOURCE_TYPE: string = `${DVB_SOURCE_PREFIX}:dvb-iptv`
	DVBDASH_SOURCE_TYPE: string = `${DVB_SOURCE_PREFIX}:dvb-dash`
	DVBAPPLICATION_SOURCE_TYPE: string = `${DVB_SOURCE_PREFIX}:application`

	// A177 5.2.7.2
	CONTENT_TYPE_DASH_MPD: string = "application/dash+xml" // MPD of linear service
	old_CONTENT_TYPE_DVB_PLAYLIST: string = XMLdocumentType // XML Playlist prior to A177r8
	CONTENT_TYPE_DVB_PLAYLIST: string = "application/vnd.dvb.dash-playlist+xml" // XML Playlist for A177r8 onwards

	// A177 5.1.2
	CONTENT_TYPE_SERVCE_LIST: string = "application/vnd.dvb.dvbisl+xml"

	// A77 6.10.15 Parental Guidance
	DTG_CONTENT_WARNING_CS_SCHEME: string = "urn:dtg:metadata:cs:DTGContentWarningCS"

	// A177 6.11.2 - Audio Purpose
	AUDIO_PURPOSE_VISUAL_IMPAIRED: string = `${AudioPurposeCS}:1`
	AUDIO_PURPOSE_HEARING_IMPAIRED: string = `${AudioPurposeCS}:2`
	AUDIO_PURPOSE_MAIN: string = `${AudioPurposeCS}:6`
	AUDIO_PURPOSE_DIALOGUE_ENHANCEMENT: string = `${AudioPurposeCS}:8`

	// A177 6.11.3 - Caption Coding Format
	DVB_BITMAP_SUBTITLES: string = `${CaptionCodingFormatCS}:2.1`
	DVB_CHARACTER_SUBTITLES: string = `${CaptionCodingFormatCS}:2.2`
	EBU_TT_D: string = `${CaptionCodingFormatCS}:3.2`

	// A177 6.11.6 - Media Availability
	MEDIA_AVAILABLE: string = `${MediaAvailabilityCS}:media_available`
	MEDIA_UNAVAILABLE: string = `${MediaAvailabilityCS}:media_unavailable`

	// A177 6.11.7 - Forward EPG Availability
	FORWARD_EPG_AVAILABLE: string = `${ForwardEPGAvailabilityCS}:fepg_available`
	FORWARD_EPG_UNAVAILABLE: string = `${ForwardEPGAvailabilityCS}:fepg_unavailable`

	//A177r1 6.5.5 - Restart Link
	RESTART_LINK: string = `${FVC_HowRelatedCS}:restart`

	// A177 6.11.11 - Restart Availability
	RESTART_AVAILABLE: string = `${RestartAvailabilityCS}:restart_available`
	RESTART_CHECK: string = `${RestartAvailabilityCS}:restart_check`
	RESTART_PENDING: string = `${RestartAvailabilityCS}:restart_pending`

	// A177 7.3.1
	BANNER_OUTSIDE_AVAILABILITY_v1: string =  `${DVB_RELATED_CS_v1}:${OUTSIDE_AVAILABILITY_TERM}`
	LOGO_SERVICE_LIST_v1: string = `${DVB_RELATED_CS_v1}:1001.1`
	LOGO_SERVICE_v1: string = `${DVB_RELATED_CS_v1}:1001.2`
	LOGO_CG_PROVIDER_v1: string = `${DVB_RELATED_CS_v1}:1002.1`

	// A177r1 7.3.1
	BANNER_OUTSIDE_AVAILABILITY_v2: string = `${DVB_RELATED_CS_v2}:${OUTSIDE_AVAILABILITY_TERM}`
	BANNER_CONTENT_FINISHED_v2: string = `${DVB_RELATED_CS_v2}:${CONTENT_FINISHED_TERM}` // added in A17732
	LOGO_SERVICE_LIST_v2: string = `${DVB_RELATED_CS_v2}:1001.1`
	LOGO_SERVICE_v2: string = `${DVB_RELATED_CS_v2}:1001.2`
	LOGO_CG_PROVIDER_v2: string = `${DVB_RELATED_CS_v2}:1002.1`

	// A177r1 7.3.1
	BANNER_OUTSIDE_AVAILABILITY_v3: string = `${DVB_RELATED_CS_v3}:${OUTSIDE_AVAILABILITY_TERM}`
	BANNER_CONTENT_FINISHED_v3: string = `${DVB_RELATED_CS_v3}:${CONTENT_FINISHED_TERM}`
	LOGO_SERVICE_LIST_v3: string = `${DVB_RELATED_CS_v3}:1001.1`
	LOGO_SERVICE_v3: string = `${DVB_RELATED_CS_v3}:1001.2`
	LOGO_CG_PROVIDER_v3: string = `${DVB_RELATED_CS_v3}:1002.1`

	// A177r2
	SERVICE_BANNER_v4: string = `${DVB_RELATED_CS_v3}:1001.3` // added in A177r3

	// A177 7.3.2
	APP_IN_PARALLEL: string = `${LINKED_APLICATION_CS}:1.1`
	APP_IN_CONTROL: string = `${LINKED_APLICATION_CS}:1.2`
	APP_OUTSIDE_AVAILABILITY: string = `${LINKED_APLICATION_CS}:2`
	APP_SERVICE_PROVIDER: string = `${LINKED_APLICATION_CS}:3`

	// A177r7
	APP_IN_SERIES: string = `${LINKED_APLICATION_CS}:1.3`
	APP_LIST_INSTALLATION :string = `${LINKED_APLICATION_CS}:4.1`
	APP_WITHDRAW_AGREEMENT: string = `${LINKED_APLICATION_CS}:4.2`
	APP_RENEW_AGREEMENT: string = `${LINKED_APLICATION_CS}:4.3`

	NVOD_MODE_REFERENCE: string = "reference"
	NVOD_MODE_TIMESHIFTED: string = "timeshifted"

	// possible values for DVB-S polarization
	DVBS_POLARIZATION_VALUES: string[] = ["horizontal", "vertical", "left circular", "right circular"]

	// @encryptionScheme values
	ENCRYPTION_VALID_TYPES: string[] = ["cenc", "cbcs", "cbcs-10"]

	// @TransportProtocol values
	ALLOWED_TRANSPORT_PROTOCOLS: string[] = ["RTP-AVP", "UDP-FEC"]

	// permitted values for @integrity algorithm
	ALLOWED_DIGESTS: string[] = ["sha1", "sha256", "sm3"]

	// REVIEW!! currently there is no profiled subset of fingerprint algorithms defined for DVB-I, so this check is not currently used.
	ALLOWED_FINGERPRINT_ALGOS: string[] = []

	// A177 annex K - Icecast
	ICECAST_V1_IDENTIFIER: string = "urn:dvb:icecast:v1"

	// A177 defined elements and attributes
	a_algorithm: string = "algorithm"
	a_Address: string = "Address"
	a_batchSize: string = "batchSize"
	a_certificateURL: string = "certificateURL"
	a_CGSID: string = "CGSID"
	a_channelNumber: string = "channelNumber"
	a_CMCDversion: string = "CMCDversion"
	a_contentId: string = "contentId"
	a_contentLanguage = tva.a_contentLanguage
	a_contentType = tva.a_contentType
	a_controlRemoteAccessOverInternet: string = "controlRemoteAccessOverInternet"
	a_country: string = "country"
	a_countryCodes: string = "countryCodes"
	a_cpsIndex: string = "cpsIndex"
	a_days: string = "days"
	a_DestinationAddress: string = "DestinationAddress"
	a_DestinationPort: string = "DestinationPort"
	a_DestinationPort_ForRTCPReporting: string = "DestinationPort-ForRTCPReporting"
	a_dvb_disable_rtcp_rr: string = "dvb-disable-rtcp-rr"
	a_doNotApplyRevocation: string = "doNotApplyRevocation"
	a_doNotScramble: string = "doNotScramble"
	a_dvb_t_ret: string = "dvb-t-ret"
	a_dynamic: string = "dynamic"
	a_dvb_enable_byte: string = "dvb-enable-byte"
	a_dvb_original_copy_ret: string = "dvb-original-copy-ret"
	a_dvb_rsi_mc_ret: string = "dvb-rsi-mc-ret"
	a_dvb_ssrc_bitmask: string = "dvb-ssrc-bitmask"
	a_dvb_ssrc_upstream_client: string = "dvb-ssrc-upstream-client"
	a_dvb_t_wait_max: string = "dvb-t-wait-max"
	a_dvb_t_wait_min: string = "dvb-t-wait-min"
	a_enabledKeys: string = "enabledKeys"
	a_encryptionScheme: string = "encryptionScheme"
	a_end: string = "end"
	a_endTime: string = "endTime"
	a_eventTypes: string = "eventTypes"
	a_eventURL: string = "eventURL"
	a_extensionName: string = "extensionName"
	a_extraCapabilities: string = "extraCapabilities"
	a_FECMaxBlockSize: string = "FECMaxBlockSize"
	a_FECMaxBlockTime: string = "FECMaxBlockTime"
	a_FECOTI: string = "FECOTI"
	a_from: string = "from"
	a_GroupAddress: string = "GroupAddress"
	a_href = tva.a_href
	a_id: string = "id"
	a_lang = tva.a_lang
	a_LAURL: string = "LAURL"
	a_MaxBitrate: string = "MaxBitrate"
	a_mode: string = "mode"
	a_minimumMetadataUpdatePeriod: string = "minimumMetadataUpdatePeriod"
	a_obfuscateURL: string = "obfuscateURL"
	a_objectTypes: string = "objectTypes"
	a_offset: string = "offset"
	a_origNetId: string = "origNetId"
	a_PayloadTypeNumber: string = "PayloadTypeNumber"
	a_policyId: string = "policyId"
	a_Port: string = "Port"
	a_primary: string = "primary"
	a_priority: string = "priority"
	a_probability: string = "probability"
	a_ranking: string = "ranking"
	a_recurrence: string = "recurrence"
	a_reference: string = "reference"
	a_referenceType: string = "referenceType"
	a_region: string = "region"
	a_regionID: string = "regionID"
	a_replayAvailable: string = "replayAvailable"
	a_reportingMethod: string = "reportingMethod"
	a_reportingMode: string = "reportingMode"
	a_responseStatus: string = "responseStatus"
	a_rtcp_bandwidth: string = "rtcp-bandwidth"
	a_rtcp_mux: string = "rtcp-mux"
	a_rtcp_rsize: string = "rtcp-rsize"
	a_RTPPayloadTypeNumber: string = "RTPPayloadTypeNumber"
	a_RTSPControlURL: string = "RTSPControlURL"
	a_rtx_time: string = "rtx-time"
	a_selectable: string = "selectable"
	a_serviceGenre: string = "serviceGenre"
	a_serviceId: string = "serviceId"
	a_serviceRef: string = "serviceRef"
	a_serviceType: string = "serviceType"
	a_Source: string = "Source"
	a_SourceAddress: string = "SourceAddress"
	a_SourcePort: string = "SourcePort"
	a_ssrc: string = "ssrc"
	a_start: string = "start"
	a_startTime: string = "startTime"
	a_Streaming: string = "Streaming"
	a_to: string = "to"
	a_transmissionMode: string = "transmissionMode"
	a_TransportProtocol: string = "TransportProtocol"
	a_trr_int: string = "trr-int"
	a_tsId: string = "tsId"
	a_userDefined: string = "userDefined"
	a_validFrom: string = "validFrom"
	a_validTo: string = "validTo"
	a_verificationPolicy = dvbi_types.a_verificationPolicy
	a_version: string = "version"
	a_visible: string = "visible"

	e_AdditionalServiceParameters: string = "AdditionalServiceParameters"
	e_AltServiceName: string = "AltServiceName"
	e_AudioConformancePoint: string = "AudioConformancePoint"
	e_Availability: string = "Availability"
	e_CAFingerprint: string = "CAFingerprint"
	e_CASystemId: string = "CASystemId"
	e_ChannelBonding: string = "ChannelBonding"
	e_CMCD: string = "CMCD"
	e_CNAME: string = "CNAME"
	e_Colorimetry: string = "Colorimetry"
	e_ContentAttributes: string = "ContentAttributes"
	e_ContentGuideServiceRef: string = "ContentGuideServiceRef"
	e_ContentGuideSource: string = "ContentGuideSource"
	e_ContentGuideSourceList: string = "ContentGuideSourceList"
	e_ContentGuideSourceRef: string = "ContentGuideSourceRef"
	e_ContentProtection: string = "ContentProtection"
	e_Coordinates: string = "Coordinates"
	e_Delivery: string = "Delivery"
	e_DASHDeliveryParameters: string = "DASHDeliveryParameters"
	e_DisplayName: string = "DisplayName"
	e_DRMSystemId: string = "DRMSystemId"
	e_DVBCDeliveryParameters: string = "DVBCDeliveryParameters"
	e_DVBSDeliveryParameters: string = "DVBSDeliveryParameters"
	e_DVBTDeliveryParameters: string = "DVBTDeliveryParameters"
	e_DVBTriplet: string = "DVBTriplet"
	e_Extension: string = "Extension"
	e_FEC: string = "FEC"
	e_FECBaseLayer: string = "FECBaseLayer"
	e_FECEnhancementLayer: string = "FECEnhancementLayer"
	e_Format: string = "Format"
	e_Frequency: string = "Frequency"
	e_FTAContentManagement: string = "FTAContentManagement"
	e_Genre: string = "Genre"
	e_GroupInfoEndpoint: string = "GroupInfoEndpoint"
	e_IdentifierBasedDeliveryParameters: string = "IdentifierBasedDeliveryParameters"
	e_InputStreamIdentifier: string = "InputStreamIdentifier"
	e_Interval: string = "Interval"
	e_IPMulticastAddress: string = "IPMulticastAddress"
	e_Language: string = "Language"
	e_LanguageList: string = "LanguageList"
	e_Latitude: string = "Latitude"
	e_LCN: string = "LCN"
	e_LCNRange: string = "LCNRange"
	e_LCNTable: string = "LCNTable"
	e_LCNTableList: string = "LCNTableList"
	e_Longitude: string = "Longitude"
	e_MinimumAge: string = "MinimumAge"
	e_MinimumBitRate: string = "MinimumBitRate"
	e_ModcodMode: string = "ModcodMode"
	e_ModulationSystem: string = "ModulationSystem"
	e_ModulationType: string = "ModulationType"
	e_MoreEpisodesEndpoint: string = "MoreEpisodesEndpoint"
	e_MulticastRET: string = "MulticastRET"
	e_MulticastTSDeliveryParameters: string = "MulticastTSDeliveryParameters"
	e_Name = mpeg7.e_Name
	e_NetworkID: string = "NetworkID"
	e_NVOD: string = "NVOD"
	e_OrbitalPosition: string = "OrbitalPosition"
	e_OtherDeliveryParameters: string = "OtherDeliveryParameters"
	e_ParentalRating: string = "ParentalRating"
	e_Period: string = "Period"
	e_Playlist: string = "Playlist"
	e_PlaylistEntry: string = "PlaylistEntry"
	e_Polarization: string = "Polarization"
	e_Postcode: string = "Postcode"
	e_PostcodeRange: string = "PostcodeRange"
	e_ProgramInfoEndpoint: string = "ProgramInfoEndpoint"
	e_Prominence: string = "Prominence"
	e_ProminenceList: string = "ProminenceList"
	e_PromotionalMedia: string = "PromotionalMedia"
	e_PromotionalText: string = "PromotionalText"
	e_ProviderName: string = "ProviderName"
	e_QueryParameters: string = "QueryParameters"
	e_Radius: string = "Radius"
	e_RecordingInfo: string = "RecordingInfo"
	e_Region: string = "Region"
	e_RegionList: string = "RegionList"
	e_RegionName: string = "RegionName"
	e_RelatedMaterial = tva.e_RelatedMaterial
	e_RollOff: string = "RollOff"
	e_Report: string = "Report"
	e_Requires: string = "Requires"
	e_RTCPReporting: string = "RTCPReporting"
	e_RTPRetransmission: string = "RTPRetransmission"
	e_RTSPDeliveryParameters: string = "RTSPDeliveryParameters"
	e_RTSPURL: string = "RTSPURL"
	e_SATIPDeliveryParameters: string = "SATIPDeliveryParameters"
	e_ScheduleInfoEndpoint: string = "ScheduleInfoEndpoint"
	e_SegmentReference: string = "SegmentReference"
	e_Service: string = "Service"
	e_ServiceDescription: string = "ServiceDescription"
	e_ServiceInstance: string = "ServiceInstance"
	e_ServiceGenre: string = "ServiceGenre"
	e_ServiceList: string = "ServiceList"
	e_ServiceName: string = "ServiceName"
	e_ServiceType: string = "ServiceType"
	e_SignaturePolicies: string = "SignaturePolicies"
	e_SignaturePolicy: string = "SignaturePolicy"
	e_SocialMediaReference: string = "SocialMediaReference"
	e_SourceMediaReference: string = "SourceMediaReference"
	e_SourceType: string = "SourceType"
	e_ssrc: string = "ssrc"
	e_StandardVersion: string = "StandardVersion"
	e_StillPictureFormat: string = "StillPictureFormat"
	e_SubscriptionPackage: string = "SubscriptionPackage"
	e_SubscriptionPackageList: string = "SubscriptionPackageList"
	e_SymbolRate: string = "SymbolRate"
	e_TargetCountry: string = "TargetCountry"
	e_TargetRegion: string = "TargetRegion"
	e_TestService: string = "TestService"
	e_TrustAnchor: string = "TrustAnchor"
	e_UnicastRET: string = "UnicastRET"
	e_UniqueIdentifier: string = "UniqueIdentifier"
	e_URI: string = "URI"
	e_UriBasedLocation: string = "UriBasedLocation"
	e_VideoConformancePoint: string = "VideoConformancePoint"
	e_WildcardPostcode: string = "WildcardPostcode"

	constructor() {
		HbbTV_Standard_versions.forEach((v) => this.ApplicationStandards.push(v))
		CTA5000_Standard_versions.forEach((v) => this.ApplicationStandards.push(v))
		HbbTV_Features.forEach((f) => this.ApplicationOptions.push(f)) 
	}
};


export const dvbi = new DVBIdefinitions()

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

	a_contentType: dvbi.a_contentType,
	a_originalNetworkID: "originalNetworkID",
	a_regulatorFlag: "regulatorFlag",
	a_regulatorListFlag: "regulatorListFlag",
	a_standardVersion: "standardVersion",
	a_verificationPolicy: dvbi_types.a_verificationPolicy,
	a_xmlAitApplicationType: "xmlAitApplicationType",

	e_ApplicationDelivery: "ApplicationDelivery",
	e_ApplicationType: "ApplicationType",
	e_Delivery: dvbi.e_Delivery,
	e_DASHDelivery: "DASHDelivery",
	e_DVBCDelivery: "DVBCDelivery",
	e_DVBSDelivery: "DVBSDelivery",
	e_DVBTDelivery: "DVBTDelivery",
	e_Language: dvbi.e_Language,
	e_MulticastTSDelivery: "MulticastTSDelivery",
	e_Provider: "Provider",
	e_ProviderOffering: "ProviderOffering",
	e_RelatedMaterial: dvbi.e_RelatedMaterial,
	e_RTSPDelivery: "RTSPDelivery",
	e_ServiceListEntryPoints: "ServiceListEntryPoints",
	e_ServiceListId: "ServiceListId",
	e_ServiceListName: "ServiceListName",
	e_ServiceListOffering: "ServiceListOffering",
	e_ServiceListRegistryEntity: "ServiceListRegistryEntity",
	e_ServiceListURI: "ServiceListURI",
	e_TargetCountry: dvbi.e_TargetCountry,
	e_URI: dvbi.e_URI,

	q_inlineImages: "inlineImages",
};

export const validApplicationTypes: string[] = [
	dvbi.XML_AIT_CONTENT_TYPE, 
	dvbi.HTML5_APP, 
	dvbi.XHTML_APP, 
	dvbi.XML_APP,
];

// ETSI TS 102 809 clause 5.4.4.12
export const DvbApplicationType: string[] = ["DVB-J", "DVB-HTML"];

// A177 clause 5.2.4.1
export const DvbIApplicationTypes: string[] = [
	dvbi.HTML5_APP, 
	dvbi.XHTML_APP, 
	HBBTV_APP_TYPE,
];

export const dvbiEA: Record<string, string[]> = {
	// EA = Element-Attributes - the attributes that are defiend for each element
	MediaLocator: [dvbi.a_contentLanguage].concat(tvaEA.MediaLocator),
	NVOD: [dvbi.a_mode, dvbi.a_reference, dvbi.a_offset],
	ServiceList: [dvbi.a_version, tva.a_lang, dvbi.a_responseStatus, dvbi.a_id],
	ServiceListEntryPoints: [dvbi.a_version, tva.a_lang],
	CMCD: [dvbi.a_reportingMode, dvbi.a_transmissionMode, dvbi.a_contentId, dvbi.a_enabledKeys, dvbi.a_probability],
	CMCDv2: [dvbi.a_reportingMode, dvbi.a_eventURL, dvbi.a_transmissionMode, dvbi.a_batchSize, dvbi.a_contentId, dvbi.a_enabledKeys, dvbi.a_probability, dvbi.a_obfuscateURL],
	ServiceType: [dvbi.a_dynamic, dvbi.a_version, dvbi.a_replayAvailable, dvbi.a_lang],
	ServiceInstanceType: [dvbi.a_priority, dvbi.a_id, tva.a_lang],
};

export const dvbiEC: Record<string, string[]> = {
	// EC = Element-Children - the child elements or each element
	RelatedMaterial: tvaEC.RelatedMaterial,
	OrganizationType: [mpeg7.e_Name, mpeg7.e_Kind, mpeg7.e_ContactName, mpeg7.e_Jurisdiction, mpeg7.e_Address, mpeg7.e_ElectronicAddress],
	ServiceType: [
		dvbi.e_UniqueIdentifier,
		dvbi.e_ServiceInstance,
		dvbi.e_TargetRegion,
		dvbi.e_ServiceName,
		dvbi.e_ProviderName,
		dvbi.e_RelatedMaterial,
		dvbi.e_ServiceGenre,
		dvbi.e_ServiceType,
		dvbi.e_ServiceDescription,
		dvbi.e_RecordingInfo,
		dvbi.e_ContentGuideSource,
		dvbi.e_ContentGuideSourceRef,
		dvbi.e_ContentGuideServiceRef,
		dvbi.e_AdditionalServiceParameters,
		dvbi.e_NVOD,
		dvbi.e_ProminenceList,
		dvbi.e_ParentalRating,
	],
	ServiceInstanceType: [
		dvbi.e_DisplayName,
		dvbi.e_RelatedMaterial,
		dvbi.e_ContentProtection,
		dvbi.e_ContentAttributes,
		dvbi.e_Availability,
		dvbi.e_SubscriptionPackage,
		dvbi.e_FTAContentManagement,
		dvbi.e_SourceType,
		dvbi.e_AltServiceName,
		dvbi.e_DVBTDeliveryParameters,
		dvbi.e_DVBSDeliveryParameters,
		dvbi.e_DVBCDeliveryParameters,
		dvbi.e_SATIPDeliveryParameters,
		dvbi.e_RTSPDeliveryParameters,
		dvbi.e_MulticastTSDeliveryParameters,
		dvbi.e_OtherDeliveryParameters,
		dvbi.e_IdentifierBasedDeliveryParameters,
	],
	ContentProtectionType: [dvbi.e_CASystemId, dvbi.e_DRMSystemId],
};
