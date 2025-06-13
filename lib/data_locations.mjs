/**
 * data_locations.mjs
 *
 * paths and URLs to various files used by the validation toole
 */
import { join, dirname } from "path";

export const __dirname = process.cwd();
export const __dirname_linux = __dirname.replace(/\\/g, "/");

const REPO_RAW = "https://raw.githubusercontent.com/paulhiggs/dvb-i-tools/main/";
const DVB_METADATA = "https://dvb.org/metadata/";

const SLEPR_subDir = "registries",
	resoucesPath = "res";

const subdirDVBCS = join(resoucesPath, "dvb", "cs"),
	subdirDVBI = join(resoucesPath, "dvbi"),
	subdirIANA = join(resoucesPath, "iana"),
	subdirISO = join(resoucesPath, "iso"),
	subdirMPEG7 = join(resoucesPath, "mpeg7"),
	subdirTVA = join(resoucesPath, "tva");

const pathDVBCS = join(__dirname, subdirDVBCS),
	pathDVBI = join(__dirname, subdirDVBI),
	pathIANA = join(__dirname, subdirIANA),
	pathISO = join(__dirname, subdirISO),
	pathMPEG7 = join(__dirname, subdirMPEG7),
	pathTVA = join(__dirname, subdirTVA);

const path2007CS = join(pathDVBCS, "2007"),
	url2007CS = "cs/2007",
	path2017CS = join(pathDVBCS, "2017"),
	url2017CS = "cs/2017",
	path2019CS = join(pathDVBCS, "2019"),
	url2019CS = "cs/2019",
	path2020CS = join(pathDVBCS, "2020"),
	url2020CS = "cs/2020",
	path2021CS = join(pathDVBCS, "2021"),
	url2021CS = "cs/2021",
	path2022CS = join(pathDVBCS, "2022"),
	url2022CS = "cs/2022",
	path2024CS = join(pathDVBCS, "2024"),
	url2024CS = "cs/2024";

// SLEPR == Service List Entry Point Registry
const SLEPR_Dir = join(__dirname, SLEPR_subDir),
	SLEPR_File = "slepr-main.xml";
export const Default_SLEPR = { file: join(SLEPR_Dir, SLEPR_File), url: `${REPO_RAW}${SLEPR_subDir}/${SLEPR_File}` };

const idTVA_ContentCS = "ContentCS.xml";
export const TVA_ContentCS = { file: join(pathTVA, idTVA_ContentCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_ContentCS}` };

const idTVA_FormatCS = "FormatCS.xml";
export const TVA_FormatCS = { file: join(pathTVA, idTVA_FormatCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_FormatCS}` };

const idTVA_PictureCS = "PictureFormatCS.xml";
export const TVA_PictureFormatCS = { file: join(pathTVA, idTVA_PictureCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_PictureCS}` };

const idTVA_ContentAlertCS = "ContentAlertCS.xml";
export const TVA_ContentAlertCS = { file: join(pathTVA, idTVA_ContentAlertCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_ContentAlertCS}` };

const idTVA_AccessibilityPurposeCS = "AccessibilityPurposeCS.xml";
export const TVA_AccessibilityPurposeCS = { file: join(pathTVA, idTVA_AccessibilityPurposeCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_AccessibilityPurposeCS}` };

const idTVA_AudioPurposeCS = "AudioPurposeCS.xml";
export const TVA_AudioPurposeCS = { file: join(pathTVA, idTVA_AudioPurposeCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_AudioPurposeCS}` };

const idTVA_SubtitleCarriageCS = "SubtitleCarriageCS.xml";
export const TVA_SubitleCarriageCS = { file: join(pathTVA, idTVA_SubtitleCarriageCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_SubtitleCarriageCS}` };

const idTVA_SubtitleCodingFormatCS = "SubtitleCodingFormatCS.xml";
export const TVA_SubitleCodingFormatCS = { file: join(pathTVA, idTVA_SubtitleCodingFormatCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_SubtitleCodingFormatCS}` };

const idTVA_SubtitlePurposeCS = "SubtitlePurposeCS.xml";
export const TVA_SubitlePurposeCS = { file: join(pathTVA, idTVA_SubtitlePurposeCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_SubtitlePurposeCS}` };

const idDVB_ContentSubjectCS = "DVBContentSubjectCS-2019.xml";
export const DVBI_ContentSubject = { file: join(pathDVBI, idDVB_ContentSubjectCS), url: `${DVB_METADATA}${url2019CS}/${idDVB_ContentSubjectCS}` };

const idDVB_ServiceTypeCS = "DVBServiceTypeCS-2019.xml";
export const DVBI_ServiceTypeCS = { file: join(pathDVBI, idDVB_ServiceTypeCS), url: `${DVB_METADATA}${url2022CS}/${idDVB_ServiceTypeCS}` };

const idDVB_AudioCodecCS = "AudioCodecCS.xml";
export const DVB_AudioCodecCS = {
	y2007: { file: join(path2007CS, idDVB_AudioCodecCS), url: `${DVB_METADATA}${url2007CS}/${idDVB_AudioCodecCS}` },
	y2020: { file: join(path2020CS, idDVB_AudioCodecCS), url: `${DVB_METADATA}${url2020CS}/${idDVB_AudioCodecCS}` },
	y2024: { file: join(path2024CS, idDVB_AudioCodecCS), url: `${DVB_METADATA}${url2024CS}/${idDVB_AudioCodecCS}` },
};

const idDVB_VideoCodecCS = "VideoCodecCS.xml";
export const DVB_VideoCodecCS = {
	y2007: { file: join(path2007CS, idDVB_VideoCodecCS), url: `${DVB_METADATA}${url2007CS}/${idDVB_VideoCodecCS}` },
	y2021: { file: join(path2021CS, idDVB_VideoCodecCS), url: `${DVB_METADATA}${url2021CS}/${idDVB_VideoCodecCS}` },
	y2022: { file: join(path2022CS, idDVB_VideoCodecCS), url: `${DVB_METADATA}${url2022CS}/${idDVB_VideoCodecCS}` },
};

const idDVB_ColorimetryCS = "ColorimetryCS.xml";
export const DVB_ColorimetryCS = {
	y2020: { file: join(path2020CS, idDVB_ColorimetryCS), url: `${DVB_METADATA}${url2020CS}/${idDVB_ColorimetryCS}` },
};

const idMPEG7_VisualCodingFormatCS = "VisualCodingFormatCS.xml";
export const MPEG7_VisualCodingFormatCS = { file: join(pathMPEG7, idMPEG7_VisualCodingFormatCS), url: `${REPO_RAW}${subdirMPEG7}/${idMPEG7_VisualCodingFormatCS}` };

const idMPEG7_AudioPresentationCS = "AudioPresentationCS.xml";
export const MPEG7_AudioPresentationCS = { file: join(pathMPEG7, idMPEG7_AudioPresentationCS), url: `${REPO_RAW}${subdirMPEG7}/${idMPEG7_AudioPresentationCS}` };

const idDVB_AudioConformanceCS = "AudioConformancePointsCS.xml";
export const DVB_AudioConformanceCS = { file: join(path2017CS, idDVB_AudioConformanceCS), url: `${DVB_METADATA}${url2017CS}/${idDVB_AudioConformanceCS}` };

const idDVB_VideoConformanceCS = "VideoConformancePointsCS.xml";
export const DVB_VideoConformanceCS = {
	y2017: { file: join(path2017CS, idDVB_VideoConformanceCS), url: `${DVB_METADATA}${url2017CS}/${idDVB_VideoConformanceCS}` },
	y2021: { file: join(path2021CS, idDVB_VideoConformanceCS), url: `${DVB_METADATA}${url2021CS}/${idDVB_VideoConformanceCS}` },
	y2022: { file: join(path2022CS, idDVB_VideoConformanceCS), url: `${DVB_METADATA}${url2022CS}/${idDVB_VideoConformanceCS}` },
	y2024: {
		file: join(path2024CS, idDVB_VideoConformanceCS),
		url: `${REPO_RAW}dvb/${url2024CS}/${idDVB_VideoConformanceCS}` /*`${DVB_METADATA}${url2024CS}/${idDVB_VideoConformanceCS}`*/,
	},
};

const idISO3166 = "iso3166-countries.json";
export const ISO3166 = { file: join(pathISO, idISO3166), url: `${REPO_RAW}${subdirISO}/${idISO3166}` };

const idDVBI_RecordingInfoCS = "DVBRecordingInfoCS-2019.xml";
export const DVBI_RecordingInfoCS = { file: join(pathDVBI, idDVBI_RecordingInfoCS), url: `${REPO_RAW}${subdirDVBI}/${idDVBI_RecordingInfoCS}` };

const v1Credits = "CreditsItem@role-values.txt";
export const DVBI_CreditsItemRoles = { file: join(pathDVBI, v1Credits), url: `${REPO_RAW}${subdirDVBI}/${v1Credits}` };

const v2Credits = "CreditsItem@role-values-v2.txt";
export const DVBIv2_CreditsItemRoles = { file: join(pathDVBI, v2Credits), url: `${REPO_RAW}${subdirDVBI}/${v2Credits}` };

const idDVB_ParentalGuidanceCS = "ParentalGuidanceCS.xml";
export const DVBI_ParentalGuidanceCS = { file: join(path2007CS, idDVB_ParentalGuidanceCS), url: `${DVB_METADATA}${url2007CS}/${idDVB_ParentalGuidanceCS}` };

const TVAnamespace = "urn:tva:metadata";
const TVAfileprefix = "tva_metadata_3-1";

export const TVAschema = {
	v2019: { namespace: `${TVAnamespace}:2019`, file: join(".", `${TVAfileprefix}_2019.xsd`) },
	v2023: { namespace: `${TVAnamespace}:2023`, file: join(".", `${TVAfileprefix}_2023.xsd`) },
	v2024: { namespace: `${TVAnamespace}:2024`, file: join(".", `${TVAfileprefix}_2024.xsd`) },
};

export const DVBI_ServiceListSchema = {
	r0: { file: join(__dirname, "dvbi_v1.0.xsd") },
	r1: { file: join(__dirname, "dvbi_v2.0.xsd") },
	r2: { file: join(__dirname, "dvbi_v3.0.xsd") },
	r3: { file: join(__dirname, "dvbi_v3.1.xsd") },
	r4: { file: join(__dirname, "dvbi_v4.0-with-hls-hbbtv.xsd") },
	r5: { file: join(__dirname, "dvbi_v5.0-with-hls-hbbtv.xsd") },
	r6: { file: join(__dirname, "dvbi_v6.0-with-hls-hbbtv.xsd") },
	r7: { file: join(__dirname, "dvbi_v7.0-with-hls-hbbtv.xsd") },
};

const languagesFilename = "language-subtag-registry";
export const IANA_Subtag_Registry = { file: join(pathIANA, languagesFilename), url: `https://www.iana.org/assignments/language-subtag-registry/${languagesFilename}` };

export const MOTD = {
	file: join(".", `motd.html`),
};
