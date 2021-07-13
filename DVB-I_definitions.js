/* jshint esversion: 8 */

const PAGINATION_PREFIX = "urn:fvc:metadata:cs:HowRelatedCS:2015-12:pagination:";
const CRID_NOW_NEXT_PREFIX = "crid://dvb.org/metadata/schedules/now-next/";

const FILE_FORMAT_CS = "urn:mpeg:mpeg7:cs:FileFormatCS:2001";

const DVB_SOURCE_PREFIX = "urn:dvb:metadata:source";
const LINKED_APLICATION_CS = "urn:dvb:metadata:cs:LinkedApplicationCS:2019";
const DVB_RELATED_CS_v1 = "urn:dvb:metadata:cs:HowRelatedCS:2019";
const DVB_RELATED_CS_v2 = "urn:dvb:metadata:cs:HowRelatedCS:2020";


module.exports = Object.freeze({
	A177v1_Namespace: "urn:dvb:metadata:servicediscovery:2019",
    A177v2_Namespace: "urn:dvb:metadata:servicediscovery:2020",
    A177v3_Namespace: "urn:dvb:metadata:servicediscovery:2021",
    A177v4_Namespace: "urn:dvb:metadata:servicediscovery:2021x",
	
    MAX_TITLE_LENGTH: 80,
    MAX_KEYWORD_LENGTH: 32,
	MAX_ORGANIZATION_NAME_LENGTH: 32,
	MAX_NAME_PART_LENGTH: 32,
	MAX_EXPLANATORY_TEXT_LENGTH: 160,
	
	XML_AIT_CONTENT_TYPE: "application/vnd.dvb.ait+xml",
	HTML5_APP: "text/html",
	XHTML_APP: "application/xhtml+xml",
//	iOS_APP: "application/vnd.dvb.app.ios",
//	ANDROID_APP: "application/vnd.dvb.app.android",
    TEMPLATE_AIT_URI: "urn:fvc:metadata:cs:HowRelatedCS:2018:templateAIT",
    
	PAGINATION_FIRST_URI: PAGINATION_PREFIX+"first",
	PAGINATION_PREV_URI: PAGINATION_PREFIX+"prev",
	PAGINATION_NEXT_URI: PAGINATION_PREFIX+"next",
	PAGINATION_LAST_URI : PAGINATION_PREFIX+"last",
	  
	CRID_NOW: CRID_NOW_NEXT_PREFIX+"now",
	CRID_LATER: CRID_NOW_NEXT_PREFIX+"later",
	CRID_EARLIER: CRID_NOW_NEXT_PREFIX+"earlier", 
	
	PROMOTIONAL_STILL_IMAGE_URI: "urn:tva:metadata:cs:HowRelatedCS:2012:19",
	
	MAX_SUBREGION_LEVELS: 3, // definied for <RegionElement> in Table 33 of A177

    JPEG_IMAGE_CS_VALUE: FILE_FORMAT_CS+":1",
    PNG_IMAGE_CS_VALUE: FILE_FORMAT_CS+":15",	
	
	EIT_PROGRAMME_CRID_TYPE: "eit-programme-crid",
	EIT_SERIES_CRID_TYPE: "eit-series-crid",

// A177v1 only table 15 - deprecated in A177v2
    DVBT_SOURCE_TYPE: DVB_SOURCE_PREFIX + ":dvb-t",
    DVBS_SOURCE_TYPE: DVB_SOURCE_PREFIX + ":dvb-s",
    DVBC_SOURCE_TYPE: DVB_SOURCE_PREFIX + ":dvb-c",
    DVBIPTV_SOURCE_TYPE: DVB_SOURCE_PREFIX + ":dvb-iptv",
    DVBDASH_SOURCE_TYPE: DVB_SOURCE_PREFIX + ":dvb-dash",
    DVBAPPLICATION_SOURCE_TYPE: DVB_SOURCE_PREFIX + ":application",

// A177 5.2.7.2
    CONTENT_TYPE_DASH_MPD: "application/dash+xml",    // MPD of linear service
    CONTENT_TYPE_DVB_PLAYLIST: "application/xml",     // XML Playlist

// A177 5.5.24  <VideoAttribites><Colorimetry>
	COLORIMETRY_BT709: "urn:dvb:metadata:cs:ColorimetryCS:2020:1",
	COLORIMETRY_BT2020_NCL: "urn:dvb:metadata:cs:ColorimetryCS:2020:2.1",
	COLORIMETRY_BT2100_NCL: "urn:dvb:metadata:cs:ColorimetryCS:2020:3.1",
	
	ALLOWED_COLORIMETRY: ["urn:dvb:metadata:cs:ColorimetryCS:2020:1",
			"urn:dvb:metadata:cs:ColorimetryCS:2020:2.1", "urn:dvb:metadata:cs:ColorimetryCS:2020:3.1"],
	
// A177 6.11.2 - Audio Purpose
	AUDIO_PURPOSE_MAIN: "urn:tva:metadata:cs:AudioPurposeCS:2007:1",
	AUDIO_PURPOSE_DESCRIPTION: "urn:tva:metadata:cs:AudioPurposeCS:2007:6",

// A177 6.11.3 - Caption Coding Format
	DVB_BITMAP_SUBTITLES: "urn:tva:metadata:cs:CaptionCodingFormatCS:2015:2.1",
	DVB_CHARACTER_SUBTITLES: "urn:tva:metadata:cs:CaptionCodingFormatCS:2015:2.2",
	EBU_TT_D: "urn:tva:metadata:cs:CaptionCodingFormatCS:2015:3.2",

// A177 6.11.6 - Media Availability
	MEDIA_AVAILABLE: "urn:fvc:metadata:cs:MediaAvailabilityCS:2014-07:media_available",
	MEDIA_UNAVAILABLE: "urn:fvc:metadata:cs:MediaAvailabilityCS:2014-07:media_unavailable",

// A177 6.11.7 - Forward EPG Availability
	FORWARD_EPG_AVAILABLE: "urn:fvc:metadata:cs:FEPGAvailabilityCS:2014-10:fepg_available",
	FORWARD_EPG_UNAVAILABLE: "urn:fvc:metadata:cs:FEPGAvailabilityCS:2014-10:fepg_unavailable",

//A177r1 6.5.5 - Restart Link
	RESTART_LINK: "urn:fvc:metadata:cs:HowRelatedCS:2018:restart",

// A177 6.11.11 - Restart Availability
    RESTART_AVAILABLE: "urn:fvc:metadata:cs:RestartAvailabilityCS:2018:restart_available",
	RESTART_CHECK: "urn:fvc:metadata:cs:RestartAvailabilityCS:2018:restart_check",
	RESTART_PENDING: "urn:fvc:metadata:cs:RestartAvailabilityCS:2018:restart_pending",

// A177v1 7.3.1
    BANNER_OUTSIDE_AVAILABILITY_v1: DVB_RELATED_CS_v1+":1000.1",
    LOGO_SERVICE_LIST_v1: DVB_RELATED_CS_v1+":1001.1",
    LOGO_SERVICE_v1: DVB_RELATED_CS_v1+":1001.2",
    LOGO_CG_PROVIDER_v1: DVB_RELATED_CS_v1+":1002.1",

// A177v2 7.3.1
    BANNER_OUTSIDE_AVAILABILITY_v2: DVB_RELATED_CS_v2+":1000.1",
	BANNER_CONTENT_FINISHED_v2: DVB_RELATED_CS_v2+":1000.2",	// added in A177v2
    LOGO_SERVICE_LIST_v2: DVB_RELATED_CS_v2+":1001.1",
    LOGO_SERVICE_v2: DVB_RELATED_CS_v2+":1001.2",
    LOGO_CG_PROVIDER_v2: DVB_RELATED_CS_v2+":1002.1",

// A177 7.3.2
    APP_IN_PARALLEL: LINKED_APLICATION_CS+":1.1",
    APP_IN_CONTROL: LINKED_APLICATION_CS+":1.2",
    APP_OUTSIDE_AVAILABILITY: LINKED_APLICATION_CS+":2",

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
	a_contentLanguage: "contentLanguage",
	a_contentType: "contentType",
	a_controlRemoteAccessOverInternet: "controlRemoteAccessOverInternet",
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
	a_encryptionScheme: "encryptionScheme",
	a_endTime: "endTime",
	a_extensionName: "extensionName",
	a_FECMaxBlockSize: "FECMaxBlockSize",
	a_FECMaxBlockTime: "FECMaxBlockTime",
	a_FECOTI: "FECOTI",
	a_from: "from",
	a_GroupAddress: "GroupAddress",
	a_horizontalSize: "horizontalSize",
	a_href: "href",
	a_lang: "lang",
	a_MaxBitrate: "MaxBitrate",
	a_minimumMetadataUpdatePeriod: "minimumMetadataUpdatePeriod",
	a_origNetId: "origNetId",
	a_PayloadTypeNumber: "PayloadTypeNumber",
	a_Port: "Port",
	a_priority: "priority", 
	a_recurrence: "recurrence",
	a_referenceType: "referenceType",
	a_regionID: "regionID",
	a_regulatorListFlag: "regulatorListFlag",
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
	a_verticalSize: "verticalSize",
	a_visible: "visible",

	e_AdditionalServiceParameters: "AdditionalServiceParameters",
	e_AltServiceName: "AltServiceName", 
	e_AudioConformancePoint: "AudioConformancePoint",
	e_Availability: "Availability",
	e_CASystemId: "CASystemId",
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
	e_FECBaseLayer: "FECBaseLayer",
	e_FECEnhancementLayer: "FECEnhancementLayer",
	e_Format: "Format",
	e_Frequency: "Frequency",
	e_FTAContentManagement: "FTAContentManagement",
	e_Genre: "Genre",
	e_GroupInfoEndpoint: "GroupInfoEndpoint",
	e_Interval: "Interval",
	e_IPMulticastAddress: "IPMulticastAddress",
	e_Language: "Language",
	e_Latitude: "Latitude",
	e_LCN: "LCN",
	e_LCNTable: "LCNTable",
	e_LCNTableList: "LCNTableList",
	e_Longitude: "Longitude",
	e_MinimumBitRate: "MinimumBitRate",
	e_MoreEpisodesEndpoint: "MoreEpisodesEndpoint",
	e_MulticastRET: "MulticastRET",
	e_MulticastTSDeliveryParameters: "MulticastTSDeliveryParameters",
	e_Name: "Name",
	e_NetworkID: "NetworkID", 
	e_OrbitalPosition: "OrbitalPosition",
	e_OtherDeliveryParameters: "OtherDeliveryParameters",
	e_Period: "Period",
	e_PlaylistEntry: "PlaylistEntry",
	e_Polarization: "Polarization",
	e_Postcode: "Postcode",
	e_PostcodeRange: "PostcodeRange",
	e_ProgramInfoEndpoint: "ProgramInfoEndpoint",
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
	e_TargetCountry: "TargetCountry",
	e_TargetRegion: "TargetRegion",
	e_UnicastRET: "UnicastRET",
	e_UniqueIdentifier: "UniqueIdentifier",
	e_URI: "URI",
	e_UriBasedLocation: "UriBasedLocation",
	e_VideoConformancePoint: "VideoConformancePoint",
	e_WildcardPostcode: "WildcardPostcode",
	
	__zzzDVB_IENDzzz__: null
});
