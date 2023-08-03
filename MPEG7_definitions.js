const FILE_FORMAT_CS = "urn:mpeg:mpeg7:cs:FileFormatCS:2001";
const AUDIO_PRESENTATION_CS = "urn:mpeg:mpeg7:cs:AudioPresentationCS:2001";

export const mpeg7 = Object.freeze({
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

	ID_ENCODING_TEXT: "text",
	ID_ENCODING_BASE16: "base16",
	ID_ENCODING_BASE64: "base64",

	DEFAULT_TITLE_TYPE: "main",

	a_abbrev: "abbrev",
	a_authority: "authority",
	a_dateFrom: "dateFrom",
	a_dateTo: "dateTo",
	a_encoding: "encoding",
	a_initial: "initial",
	a_lang: "lang",
	a_length: "length",
	a_offset: "offset",
	a_organization: "organization",
	a_supplemental: "supplemental",
	a_type: "type",

	e_BytePosition: "BytePosition",
	e_FamilyName: "FamilyName",
	e_GivenName: "GivenName",
	e_InlineMedia: "InlineMedia",
	e_LinkingName: "LinkingName",
	e_MediaData16: "MediaData16",
	e_MediaData64: "MediaData64",
	e_MediaTimePoint: "MediaTimePoint",
	e_MediaUri: "MediaUri",
	e_MinimumAge: "MinimumAge",
	e_Numeration: "Numeration",
	e_ParentalRating: "ParentalRating",
	e_Region: "Region",
	e_Salutation: "Salutation",
	e_Title: "Title",
	e_TitleAudio: "TitleAudio",
	e_TitleImage: "TitleImage",
	e_TitleVideo: "TitleVideo",
});
