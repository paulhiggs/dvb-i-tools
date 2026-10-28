/**
 * MPEG7_defintions.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Defintions made in MPEG-7, ISO/IEC 15938-5
 */

const MPEG7_CS: string = "urn:mpeg:mpeg7:cs";
const FILE_FORMAT_CS: string = `${MPEG7_CS}:FileFormatCS:2001`;
const AUDIO_PRESENTATION_CS: string = `${MPEG7_CS}:AudioPresentationCS:2001`;

export const mpeg7 = new class {
	// A177 6.11.1 - Audio Mix Type
	AUDIO_MIX_MONO: string = `${AUDIO_PRESENTATION_CS}:2`
	AUDIO_MIX_STEREO: string = `${AUDIO_PRESENTATION_CS}:3`
	AUDIO_MIX_5_1: string = `${AUDIO_PRESENTATION_CS}:5`

	JPEG_IMAGE_CS_VALUE: string = `${FILE_FORMAT_CS}:1`
	PNG_IMAGE_CS_VALUE: string = `${FILE_FORMAT_CS}:15`

	TITLE_TYPE_MAIN: string = "main"
	TITLE_TYPE_SECONDARY: string = "secondary"
	TITLE_TYPE_ALTERNATIVE: string = "alternative"
	TITLE_TYPE_ORIGINAL: string = "original"
	TITLE_TYPE_POPULAR: string = "popular"
	TITLE_TYPE_OPUSNUMBER: string = "opusNumber"
	TITLE_TYPE_SONG: string = "songTitle"
	TITLE_TYPE_ALBUM: string = "albumTitle"
	TITLE_TYPE_SERIES: string = "seriesTitle"
	TITLE_TYPE_EPISOIDE: string = "episodeTitle"

	DEFAULT_TITLE_TYPE: string = "main"

	a_authority: string = "authority"
	a_encoding: string = "encoding"
	a_organization: string = "organization"
	a_lang: string = "lang"
	a_supplemental: string = "supplemental"
	a_type: string = "type"

	e_Address: string = "Address"
	e_AgentType: string = "AgentType"
	e_ContactName: string = "ContactName"
	e_ElectronicAddress: string = "ElectronicAddress"
	e_Jurisdiction: string = "Jurisdiction"
	e_Kind: string = "Kind"
	e_Name: string = "Name"
};

export const MPEG1_layer_2: string = `${MPEG7_CS}:AudioCodingFormatCS:2001:3.2`;
