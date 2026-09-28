/**
 * TVA_defintions.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Definitions made by TV-Anytime in versions of ETSI TS 102 822-3-1
 */

import { mpeg7 } from "./MPEG7_definitions.mts"

export const TVA_CSmetadata: string = "urn:tva:metadata:cs";

class TVAterms {
	SYNOPSIS_BRIEF_LABEL: string = "brief"
	SYNOPSIS_BRIEF_LENGTH: number = 30
	SYNOPSIS_SHORT_LABEL: string = "short"
	SYNOPSIS_SHORT_LENGTH: number = 90
	SYNOPSIS_MEDIUM_LABEL: string = "medium"
	SYNOPSIS_MEDIUM_LENGTH: number = 250
	SYNOPSIS_LONG_LABEL: string = "long"
	SYNOPSIS_LONG_LENGTH: number = 1200
	SYNOPSIS_EXTENDED_LABEL: string = "extended"
	SYNOPSIS_EXTENDED_MIN_LENGTH: number = 1200

	KEYWORD_TYPE_MAIN: string = "main"
	KEYWORD_TYPE_SECONDARY: string = "secondary"
	KEYWORD_TYPE_OTHER: string = "other"
	DEFAULT_KEYWORD_TYPE: string = "main"

	GENRE_TYPE_MAIN: string = "main"
	GENRE_TYPE_SECONDARY: string = "secondary"
	GENRE_TYPE_OTHER: string = "other"
	DEFAULT_GENRE_TYPE: string = "main"
	ALL_GENRE_TYPES: string[] = ["main", "secondary", "other"]

	DELIVERY_MODE_STREAMING: string = "streaming"

	SCAN_TYPES: string[] = ["interlaced", "progressive"]
	COLOR_TYPES: string[] = ["color", "blackAndWhite", "blackAndWhiteAndColor", "colorized"]

	ALLOWED_ASPECT_RATIO_TYPES: string[] = ["original", "publication"]

	APPLICATION_SUBTITLE_CODING: string = "urn:tva:metadata:cs:SubtitleCodingFormatCS:2023:8"
	APPLICATION_SUBTITLE_CARRIAGE: string = "urn:tva:metadata:cs:SubtitleCarriageCS:2023:1"

	e_TVAMain: string = "TVAMain"
	e_ProgramInformationTable: string = "ProgramInformationTable"
	e_ProgramLocationTable: string = "ProgramLocationTable"
	e_GroupInformationTable: string = "GroupInformationTable"

	e_AccessibilityAttributes: string = "AccessibilityAttributes"
	e_ActualDuration: string = "ActualDuration"
	e_ActualEndTime: string = "ActualEndTime"
	e_ActualStartTime: string = "ActualStartTime"
	e_AggregationOf: string = "AggregationOf"
	e_AppInformation: string = "AppInformation"
	e_AspectRatio: string = "AspectRatio"
	e_AVAttributes: string = "AVAttributes"
	e_AudioAttributes: string = "AudioAttributes"
	e_AudioDescriptionAttributes: string = "AudioDescriptionAttributes"
	e_AudioLanguage: string = "AudioLanguage"
	e_AuxiliaryURI: string = "AuxiliaryURI"
	e_AuxiliaryURL: string = "AuxiliaryURL"
	e_AwardsList: string = "AwardsList"
	e_BasicDescription: string = "BasicDescription"
	e_BitRate: string = "BitRate"
	e_BitsPerSample: string = "BitsPerSample"
	e_BroadcastEvent: string = "BroadcastEvent"
	e_CaptioningAttributes: string = "CaptioningAttributes"
	e_CaptionLanguage: string = "CaptionLanguage"
	e_Carriage: string = "Carriage"
	e_Character: string = "Character"
	e_Closed: string = "Closed"
	e_Coding: string = "Coding"
	e_Color: string = "Color"
	e_ContentVersion: string = "ContentVersion"
	e_CountryCodes: string = "CountryCodes"
	e_CreationCoordinates: string = "CreationCoordinates"
	e_CreditsInformationTable: string = "CreditsInformationTable"
	e_CreditsItem: string = "CreditsItem"
	e_CreditsList: string = "CreditsList"
	e_DeliveryMode: string = "DeliveryMode"
	e_DepictedCoordinates: string = "DepictedCoordinates"
	e_DerivedFrom: string = "DerivedFrom"
	e_DialogueEnhancementAttributes: string = "DialogueEnhancementAttributes"
	e_Duration: string = "Duration"
	e_EarlyPlayout: string = "EarlyPlayout"
	e_EmbargoTime: string = "EmbargoTime"
	e_EndOfAvailability: string = "EndOfAvailability"
	e_EpisodeOf: string = "EpisodeOf"
	e_ExpiryTimeAfterDownload: string = "ExpiryTimeAfterDownload"
	e_ExpiryTimeAfterDownloadFirstStart: string = "ExpiryTimeAfterDownloadFirstStart"
	e_ExpiryTimeAfterFirstStart: string = "ExpiryTimeAfterFirstStart"
	e_ExpiryTime: string = "ExpiryTime"
	e_ExplanatoryText: string = "ExplanatoryText"
	e_FamilyName: string = "FamilyName"
	e_FileFormat: string = "FileFormat"
	e_FileSize: string = "FileSize"
	e_FirstAvailability: string = "FirstAvailability"
	e_FirstShowing: string = "FirstShowing"
	e_Format: string = "Format"
	e_FrameRate: string = "FrameRate"
	e_Free: string = "Free"
	e_Genre: string = "Genre"
	e_GivenName: string = "GivenName"
	e_GroupInformation: string = "GroupInformation"
	e_GroupType: string = "GroupType"
	e_HighContrastUIAttributes: string = "HighContrastUIAttributes"
	e_HorizontalSize: string = "HorizontalSize"
	e_HowRelated: string = "HowRelated"
	e_ImmediateViewing: string = "ImmediateViewing"
	e_InlineMedia: string = "InlineMedia"
	e_InstanceDescription: string = "InstanceDescription"
	e_InstanceMetadataId: string = "InstanceMetadataId"
	e_Keyword: string = "Keyword"
	e_Language: string = "Language"
	e_LastAvailability: string = "LastAvailability"
	e_LastShowing: string = "LastShowing"
	e_Live: string = "Live"
	e_MagnificationUIAttributes: string = "MagnificationUIAttributes"
	e_MaxNumberOfDownloads: string = "MaxNumberOfDownloads"
	e_MediaLocator: string = "MediaLocator"
	e_MediaTitle: string = "MediaTitle"
	e_MediaUri: string = "MediaUri"
	e_MemberOf: string = "MemberOf"
	e_MinimumAge: string = "MinimumAge"
	e_MixType: string = "MixType"
	e_NumOfChannels: string = "NumOfChannels"
	e_OnDemandProgram: string = "OnDemandProgram"
	e_OnDemandService: string = "OnDemandService"
	e_OrganizationName: string = "OrganizationName"
	e_OtherIdentifier: string = "OtherIdentifier"
	e_ParentalGuidance: string = "ParentalGuidance"
	e_ParentalRating: string = "ParentalRating"
	e_PartOfAggregatedGroup: string = "PartOfAggregatedGroup"
	e_PartOfAggregateProgram: string = "PartOfAggregateProgram"
	e_Personalisation: string = "Personalisation"
	e_PersonName: string = "PersonName"
	e_PictureFormat: string = "PictureFormat"
	e_ProductionDate: string = "ProductionDate"
	e_ProductionLocation: string = "ProductionLocation"
	e_ProgramDescription: string = "ProgramDescription"
	e_ProgramInformation: string = "ProgramInformation"
	e_Program: string = "Program"
	e_ProgramReviewTable: string = "ProgramReviewTable"
	e_ProgramURL: string = "ProgramURL"
	e_PromotionalInformation: string = "PromotionalInformation"
	e_PromotionalMedia: string = "PromotionalMedia"
	e_PromotionalText: string = "PromotionalText"
	e_PublishedDuration: string = "PublishedDuration"
	e_PublishedEndTime: string = "PublishedEndTime"
	e_PublishedStartTime: string = "PublishedStartTime"
	e_PurchaseInformationTable: string = "PurchaseInformationTable"
	e_PurchaseList: string = "PurchaseList"
	e_Purpose: string = "Purpose"
	e_PushDownloadProgram: string = "PushDownloadProgram"
	e_ReceiverMix: string = "ReceiverMix"
	e_RelatedMaterial: string = "RelatedMaterial"
	e_ReleaseDate: string = "ReleaseDate"
	e_ReleaseInformation: string = "ReleaseInformation"
	e_ReleaseLocation: string = "ReleaseLocation"
	e_Repeat: string = "Repeat"
	e_RequiredStandardVersion: string = "RequiredStandardVersion"
	e_RequiredOptionalFeature: string = "RequiredOptionalFeature"
	e_ResponseToUserActionAttributes: string = "ResponseToUserActionAttributes"
	e_RightsInformationTable: string = "RightsInformationTable"
	e_SampleFrequency: string = "SampleFrequency"
	e_Scan: string = "Scan"
	e_Schedule: string = "Schedule"
	e_ScheduleEvent: string = "ScheduleEvent"
	e_ScreenReaderAttributes: string = "ScreenReaderAttributes"
	e_ScreenReaderLanguage: string = "ScreenReaderLanguage"
	e_SegmentInformationTable: string = "SegmentInformationTable"
	e_ServiceInformationTable: string = "ServiceInformationTable"
	e_SegmentReference: string = "SegmentReference"
	e_ShortTitle: string = "ShortTitle"
	e_SigningAttributes: string = "SigningAttributes"
	e_SignLanguage: string = "SignLanguage"
	e_SocialMediaReference: string = "SocialMediaReference"
	e_SourceMediaLocator: string = "SourceMediaLocator"
	e_SpokenSubtitlesAttributes: string = "SpokenSubtitlesAttributes"
	e_StartOfAvailability: string = "StartOfAvailability"
	e_StillPictureFormat: string = "StillPictureFormat"
	e_StreamID: string = "StreamID"
	e_SubtitleAttributes: string = "SubtitleAttributes"
	e_SubtitleLanguage: string = "SubtitleLanguage"
	e_SuitableForTTS: string = "SuitableForTTS"
	e_Synopsis: string = "Synopsis"
	e_System: string = "System"
	e_Title: string = "Title"
	e_VerticalSize: string = "VerticalSize"
	e_VideoAttributes: string = "VideoAttributes"

	a_average: string = "average"
	a_closed: string = "closed"
	a_contentLanguage: string = "contentLanguage"
	a_contentType: string = "contentType"
	a_crid: string = "crid"
	a_end: string = "end"
	a_fragmentId: string = "fragmentId"
	a_fragmentVersion: string = "fragmentVersion"
	a_fragmentExpirationDate: string = "fragmentExpirationDate"
	a_groupId: string = "groupId"
	a_horizontalSize: string = "horizontalSize"
	a_href: string = "href"
	a_index: string = "index"
	a_integrity: string = "integrity"
	a_lang= mpeg7.a_lang
	a_length: string = "length"
	a_maximum: string = "maximum"
	a_metadataOriginIDRef: string = "metadataOriginIDRef"
	a_minimum: string = "minimum"
	a_numOfItems: string = "numOfItems"
	a_ordered: string = "ordered"
	a_primary: string = "primary"
	a_programId: string = "programId"
	a_purpose: string = "purpose"
	a_role: string = "role"
	a_serviceIDRef: string = "serviceIDRef"
	a_serviceInstanceID: string = "serviceInstanceID"
	a_start: string = "start"
	a_supplemental: string = "supplemental"
	a_translation: string = "translation"
	a_type: string = "type"
	a_uriType: string = "uriType"
	a_variable: string = "variable"
	a_value: string = "value"
	a_verificationPolicy: string = "verificationPolicy"
	a_verticalSize: string = "verticalSize"

	v_lengthLong: string = "long"
	v_otherCollection: string = "otherCollection"

	t_MemberOfType: string = "MemberOfType"
	t_ProgramGroupTypeType: string = "ProgramGroupTypeType"

	cs_PromotionalStillImage: string = `${TVA_CSmetadata}:HowRelatedCS:2012:19`
};

export const tva = new TVAterms()

const tvaBaseMemberOfTypeAttributes: string[] = [tva.a_crid, tva.a_index],
	tvaControlledTermTypeAttributes: string[] = [tva.a_href],
	tvafragmentIdentificationAttributes: string[] = [tva.a_fragmentId, tva.a_fragmentVersion, tva.a_fragmentExpirationDate],
	tvaExtendedURITypeAttributes: string[] = [tva.a_contentType, tva.a_uriType, tva.a_integrity, tva.a_verificationPolicy],
	mpeg7UniqueIDTypeAttributes: string[] = [mpeg7.a_type, mpeg7.a_organization, mpeg7.a_authority, mpeg7.a_encoding];

export const tvaEA: Record<string, string[]> = {
	// EA = Element-Attributes - the attributes that are defiend for each element
	AudioLanguage: [tva.a_purpose, mpeg7.a_type, mpeg7.a_supplemental],
	AuxiliaryURI: tvaExtendedURITypeAttributes,
	Coding: tvaControlledTermTypeAttributes,
	CreditsItem: [tva.a_role, tva.a_index],
	EpisodeOf: tvaBaseMemberOfTypeAttributes,
	ExplanatoryText: [tva.a_length, tva.a_lang],
	Genre: [tva.a_type, tva.a_metadataOriginIDRef].concat(tvaControlledTermTypeAttributes),
	GroupInformation: [tva.a_groupId, tva.a_lang, tva.a_ordered, tva.a_numOfItems, tva.a_metadataOriginIDRef, tva.a_serviceIDRef].concat(tvafragmentIdentificationAttributes),
	GroupType: [tva.a_type, tva.a_value],
	HowRelated: tvaControlledTermTypeAttributes,
	Keyword: [tva.a_lang, tva.a_type, tva.a_metadataOriginIDRef],
	MediaLocator: [],
	MediaUri: tvaExtendedURITypeAttributes,
	MemberOf: tvaBaseMemberOfTypeAttributes,
	MinimumAge: [],
	MixType: tvaControlledTermTypeAttributes,
	OnDemandProgram: [tva.a_serviceIDRef, tva.a_lang, tva.a_metadataOriginIDRef].concat(tvafragmentIdentificationAttributes),
	OtherIdentifier: mpeg7UniqueIDTypeAttributes,
	ParentalRating: [tva.a_href],
	Program: [tva.a_crid],
	ProgramInformation: [tva.a_programId, tva.a_lang, tva.a_metadataOriginIDRef].concat(tvafragmentIdentificationAttributes),
	ProgramInformationTable: [tva.a_lang, tva.a_programId, tva.a_metadataOriginIDRef].concat(tvafragmentIdentificationAttributes),
	ProgramLocationTable: [tva.a_lang, tva.a_metadataOriginIDRef],
	Schedule: [tva.a_serviceIDRef, tva.a_start, tva.a_end, tva.a_lang, tva.a_metadataOriginIDRef].concat(tvafragmentIdentificationAttributes),
	ScheduleEvent: [tva.a_lang, tva.a_metadataOriginIDRef],
	StillPictureFormat: [tva.a_horizontalSize, tva.a_verticalSize, tva.a_href],
	Synopsis: [tva.a_length, tva.a_lang],
	Title: [tva.a_type, tva.a_lang],
};

const ProgramLocationType: string[] = [tva.e_Program, tva.e_ProgramURL, tva.e_AuxiliaryURL, tva.e_InstanceMetadataId, tva.e_InstanceDescription];
export const BaseAccessibilityAttributesType: string[] = [tva.e_AppInformation, tva.e_Personalisation];

export const tvaEC : Record<string, string[]>= {
	// EC = Element-Children - the child elements or each element
	AccessibilityAttributes: [
		tva.e_SubtitleAttributes,
		tva.e_AudioDescriptionAttributes,
		tva.e_SigningAttributes,
		tva.e_DialogueEnhancementAttributes,
		tva.e_SpokenSubtitlesAttributes,
		tva.e_MagnificationUIAttributes,
		tva.e_HighContrastUIAttributes,
		tva.e_ScreenReaderAttributes,
		tva.e_ResponseToUserActionAttributes,
	],
	AudioAttributes: [tva.e_Coding, tva.e_NumOfChannels, tva.e_MixType, tva.e_AudioLanguage, tva.e_SampleFrequency, tva.e_BitsPerSample, tva.e_BitRate],
	AudioDescriptionAttributes: [tva.e_AudioAttributes, tva.e_ReceiverMix].concat(BaseAccessibilityAttributesType),
	AVAttributes: [
		tva.e_FileFormat,
		tva.e_FileSize,
		tva.e_System,
		tva.e_BitRate,
		tva.e_AudioAttributes,
		tva.e_VideoAttributes,
		tva.e_CaptioningAttributes,
		tva.e_AccessibilityAttributes,
	],
	CaptioningAttributes: [tva.e_Coding, tva.e_BitRate],
	CreditsItem: [
		tva.e_PersonName, "PersonNameIDRef", 
		tva.e_OrganizationName, "OrganizationNameIDRef", 
		tva.e_Character, 
		"PresentationRole", 
		tva.e_RelatedMaterial,
	],
	BasicDescription: [
		tva.e_Title,
		tva.e_MediaTitle,
		tva.e_ShortTitle,
		tva.e_Synopsis,
		tva.e_PromotionalInformation,
		tva.e_Keyword,
		tva.e_Genre,
		tva.e_ParentalGuidance,
		tva.e_Language,
		tva.e_CaptionLanguage,
		tva.e_SignLanguage,
		tva.e_CreditsList,
		tva.e_AwardsList,
		tva.e_RelatedMaterial,
		tva.e_ProductionDate,
		tva.e_ProductionLocation,
		tva.e_CreationCoordinates,
		tva.e_DepictedCoordinates,
		tva.e_ReleaseInformation,
		tva.e_Duration,
		tva.e_PurchaseList,
	],
	BroadcastEvent: [],
	DialogEnhancementAttributes: [tva.e_AudioAttributes].concat(BaseAccessibilityAttributesType),
	Format: [tva.e_AVAttributes, tva.e_StillPictureFormat],
	GroupInformation: [tva.e_GroupType, tva.e_BasicDescription, tva.e_MemberOf, tva.e_OtherIdentifier, tva.e_PartOfAggregatedGroup, tva.e_AggregationOf],
	InstanceDescription: [
		tva.e_Title,
		tva.e_Synopsis,
		tva.e_Genre,
		tva.e_PurchaseList,
		tva.e_CaptionLanguage,
		tva.e_SignLanguage,
		tva.e_ParentalGuidance,
		tva.e_AVAttributes,
		tva.e_MemberOf,
		tva.e_OtherIdentifier,
		tva.e_RelatedMaterial,
	],
	MediaLocator: [tva.e_MediaUri, tva.e_AuxiliaryURI, tva.e_InlineMedia, tva.e_StreamID],
	OnDemandProgram: [
		tva.e_PublishedDuration,
		tva.e_StartOfAvailability,
		tva.e_EndOfAvailability,
		tva.e_FirstAvailability,
		tva.e_LastAvailability,
		tva.e_ImmediateViewing,
		tva.e_DeliveryMode,
		tva.e_ContentVersion,
		tva.e_ExpiryTime,
		tva.e_EarlyPlayout,
		tva.e_Free,
		tva.e_ExpiryTimeAfterFirstStart,
		tva.e_EmbargoTime,
		tva.e_MaxNumberOfDownloads,
		tva.e_ExpiryTimeAfterDownload,
		tva.e_ExpiryTimeAfterDownloadFirstStart,
	].concat(ProgramLocationType),
	ProgramDescription: [
		tva.e_ProgramInformationTable,
		tva.e_GroupInformationTable,
		tva.e_ProgramInformationTable,
		tva.e_ServiceInformationTable,
		tva.e_CreditsInformationTable,
		tva.e_ProgramReviewTable,
		tva.e_SegmentInformationTable,
		tva.e_PurchaseInformationTable,
		tva.e_RightsInformationTable,
	],
	ProgramInformation: [
		tva.e_BasicDescription,
		tva.e_OtherIdentifier,
		tva.e_AVAttributes,
		tva.e_MemberOf,
		tva.e_DerivedFrom,
		tva.e_EpisodeOf,
		tva.e_PartOfAggregateProgram,
		tva.e_AggregationOf,
	],
	ProgramLocationTable: [tva.e_Schedule, tva.e_BroadcastEvent, tva.e_OnDemandProgram, tva.e_OnDemandService, tva.e_PushDownloadProgram],
	RelatedMaterial: [
		tva.e_HowRelated,
		tva.e_Format,
		tva.e_MediaLocator,
		tva.e_SegmentReference,
		tva.e_PromotionalText,
		tva.e_PromotionalMedia,
		tva.e_SocialMediaReference,
		tva.e_SourceMediaLocator,
		tva.e_AccessibilityAttributes,
	],
	Schedule: [tva.e_ScheduleEvent],
	ScheduleEvent: [
		tva.e_PublishedStartTime,
		tva.e_PublishedEndTime,
		tva.e_PublishedDuration,
		tva.e_ActualStartTime,
		tva.e_ActualEndTime,
		tva.e_ActualDuration,
		tva.e_DeliveryMode,
		tva.e_Repeat,
		tva.e_FirstShowing,
		tva.e_LastShowing,
		tva.e_Free,
	].concat(ProgramLocationType),
	ScreenReaderAttributes: [tva.e_Purpose, tva.e_ScreenReaderLanguage].concat(BaseAccessibilityAttributesType),
	SigningAttributes: [tva.e_Coding, tva.e_SignLanguage, tva.e_Closed].concat(BaseAccessibilityAttributesType),
	SpokenSubtitlesAttributes: [tva.e_AudioAttributes].concat(BaseAccessibilityAttributesType),
	SubtitleAttributes: [tva.e_Carriage, tva.e_Coding, tva.e_SubtitleLanguage, tva.e_Purpose, tva.e_SuitableForTTS].concat(BaseAccessibilityAttributesType),
	VideoAttributes: [tva.e_Coding, tva.e_Scan, tva.e_HorizontalSize, tva.e_VerticalSize, tva.e_AspectRatio, tva.e_Color, tva.e_FrameRate, tva.e_BitRate, tva.e_BitsPerSample],
};
tvaEC.BroadcastEvent = tvaEC.ScheduleEvent;
