const FILE_FORMAT_CS = "urn:mpeg:mpeg7:cs:FileFormatCS:2001";
const AUDIO_PRESENTATION_CS = "urn:mpeg:mpeg7:cs:AudioPresentationCS:2001";

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
