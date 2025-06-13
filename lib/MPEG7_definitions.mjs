/**
 * MPEG7_defintions.mjs
 *
 * Defintion made in MPEG-7, ISO/IEC 15938-5
 */

const MPEG7_CS = "urn:mpeg:mpeg7:cs";
const FILE_FORMAT_CS = `${MPEG7_CS}:FileFormatCS:2001`;
const AUDIO_PRESENTATION_CS = `${MPEG7_CS}:AudioPresentationCS:2001`;

export const mpeg7 = {
	// A177 6.11.1 - Audio Mix Type
	AUDIO_MIX_MONO: `${AUDIO_PRESENTATION_CS}:2`,
	AUDIO_MIX_STEREO: `${AUDIO_PRESENTATION_CS}:3`,
	AUDIO_MIX_5_1: `${AUDIO_PRESENTATION_CS}:5`,

	JPEG_IMAGE_CS_VALUE: `${FILE_FORMAT_CS}:1`,
	PNG_IMAGE_CS_VALUE: `${FILE_FORMAT_CS}:15`,

	TITLE_TYPE_MAIN: "main",
	TITLE_TYPE_SECONDARY: "secondary",
	TITLE_TYPE_ALTERNATIVE: "alternative",
	TITLE_TYPE_ORIGINAL: "original",
	TITLE_TYPE_POPULAR: "popular",
	TITLE_TYPE_OPUSNUMBER: "opusNumber",
	TITLE_TYPE_SONG: "songTitle",
	TITLE_TYPE_ALBUM: "albumTitle",
	TITLE_TYPE_SERIES: "seriesTitle",
	TITLE_TYPE_EPISOIDE: "episodeTitle",

	DEFAULT_TITLE_TYPE: "main",

	a_authority: "authority",
	a_encoding: "encoding",
	a_organization: "organization",
	a_lang: "lang",
	a_supplemental: "supplemental",
	a_type: "type",
};

export const MPEG1_layer_2 = `${MPEG7_CS}:AudioCodingFormatCS:2001:3.2`;
