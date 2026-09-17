/**
 * data_locations.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * paths and URLs to various files used by the validation toole
 */

import { join } from "path";
import process from "node:process";

const TESTSUITE_DIR: string = "testsuite";
export const __dirname: string = process.cwd().endsWith(TESTSUITE_DIR) ? process.cwd().substring(0, process.cwd().length - TESTSUITE_DIR.length) : process.cwd();
export const __dirname_linux: string = __dirname.replace(/\\/g, "/");

const REPO_RAW: string = "https://raw.githubusercontent.com/paulhiggs/dvb-i-tools/main/";
const DVB_METADATA: string = "https://dvb.org/metadata/";

export const resouces_subDir: string = "res";
const SLEPR_subDir: string = "registries",
	schemasPath: string = process.cwd().endsWith(TESTSUITE_DIR) ? "../schemas": "schemas";

const subdirDVBI: string = join(resouces_subDir, "dvbi"),
	subdirISO: string = join(resouces_subDir, "iso"),
	subdirMPEG7: string = join(resouces_subDir, "mpeg7"),
	subdirTVA: string = join(resouces_subDir, "tva");

const pathDVBCS: string = join(__dirname, resouces_subDir, "dvb", "cs"),
	pathDVBI: string = join(__dirname, subdirDVBI),
	pathIANA: string = join(__dirname, resouces_subDir, "iana"),
	pathISO: string = join(__dirname, subdirISO),
	pathMPEG7: string = join(__dirname, subdirMPEG7),
	pathTVA: string = join(__dirname, subdirTVA);

const path2007CS: string = join(pathDVBCS, "2007"),
	url2007CS: string = "cs/2007",
	path2017CS: string = join(pathDVBCS, "2017"),
	url2017CS: string = "cs/2017",
	//	path2019CS: string = join(pathDVBCS, "2019"),
	url2019CS: string = "cs/2019",
	path2020CS: string = join(pathDVBCS, "2020"),
	url2020CS: string = "cs/2020",
	path2021CS: string = join(pathDVBCS, "2021"),
	url2021CS: string = "cs/2021",
	path2022CS: string = join(pathDVBCS, "2022"),
	url2022CS: string = "cs/2022",
	path2024CS: string = join(pathDVBCS, "2024"),
	url2024CS: string = "cs/2024",
	path2026CS: string = join(pathDVBCS, "2026"),
	url2026CS: string = "cs/2026";

export const spam_blocker_config: string = join(__dirname, "sblocker_config.json");

type DataLocation = { file: string, url?: string };

// SLEPR == Service List Entry Point Registry
const SLEPR_Dir: string = join(__dirname, SLEPR_subDir),
	SLEPR_File: string = "slepr-main.xml";
export const Default_SLEPR = { file: join(SLEPR_Dir, SLEPR_File), url: `${REPO_RAW}${SLEPR_subDir}/${SLEPR_File}` };

const idTVA_ContentCS: string = "ContentCS.xml";
export const TVA_ContentCS: DataLocation = { file: join(pathTVA, idTVA_ContentCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_ContentCS}` };

const idTVA_FormatCS: string = "FormatCS.xml";
export const TVA_FormatCS: DataLocation = { file: join(pathTVA, idTVA_FormatCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_FormatCS}` };

const idTVA_PictureCS: string = "PictureFormatCS.xml";
export const TVA_PictureFormatCS: DataLocation = { file: join(pathTVA, idTVA_PictureCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_PictureCS}` };

const idTVA_ContentAlertCS: string = "ContentAlertCS.xml";
export const TVA_ContentAlertCS: DataLocation = { file: join(pathTVA, idTVA_ContentAlertCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_ContentAlertCS}` };

const idTVA_AccessibilityPurposeCS: string = "AccessibilityPurposeCS.xml";
export const TVA_AccessibilityPurposeCS: DataLocation = { file: join(pathTVA, idTVA_AccessibilityPurposeCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_AccessibilityPurposeCS}` };

const idTVA_AudioPurposeCS: string = "AudioPurposeCS.xml";
export const TVA_AudioPurposeCS: DataLocation = { file: join(pathTVA, idTVA_AudioPurposeCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_AudioPurposeCS}` };

const idTVA_SubtitleCarriageCS: string = "SubtitleCarriageCS.xml";
export const TVA_SubitleCarriageCS: DataLocation = { file: join(pathTVA, idTVA_SubtitleCarriageCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_SubtitleCarriageCS}` };

const idTVA_SubtitleCodingFormatCS: string = "SubtitleCodingFormatCS.xml";
export const TVA_SubitleCodingFormatCS: DataLocation = { file: join(pathTVA, idTVA_SubtitleCodingFormatCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_SubtitleCodingFormatCS}` };

const idTVA_SubtitlePurposeCS: string = "SubtitlePurposeCS.xml";
export const TVA_SubitlePurposeCS: DataLocation = { file: join(pathTVA, idTVA_SubtitlePurposeCS), url: `${REPO_RAW}${subdirTVA}/${idTVA_SubtitlePurposeCS}` };

const idDVB_ContentSubjectCS: string = "DVBContentSubjectCS-2019.xml";
export const DVBI_ContentSubject: DataLocation = { file: join(pathDVBI, idDVB_ContentSubjectCS), url: `${DVB_METADATA}${url2019CS}/${idDVB_ContentSubjectCS}` };

const idDVB_ServiceTypeCS: string = "DVBServiceTypeCS-2019.xml";
export const DVBI_ServiceTypeCS: DataLocation = { file: join(pathDVBI, idDVB_ServiceTypeCS), url: `${DVB_METADATA}${url2022CS}/${idDVB_ServiceTypeCS}` };

const idDVB_LinkApplicationTypeCS: string = "DVBLinkedApplicationCS-2019.xml";
export const DVBI_LinkedApplicationCS: DataLocation = { file: join(pathDVBI, idDVB_LinkApplicationTypeCS), url: `${DVB_METADATA}${url2019CS}/${idDVB_LinkApplicationTypeCS}` };

const idDVB_AudioCodecCS: string = "AudioCodecCS.xml";
export const DVB_AudioCodecCS: Record<string, DataLocation> = {
	y2007: { file: join(path2007CS, idDVB_AudioCodecCS), url: `${DVB_METADATA}${url2007CS}/${idDVB_AudioCodecCS}` },
	y2020: { file: join(path2020CS, idDVB_AudioCodecCS), url: `${DVB_METADATA}${url2020CS}/${idDVB_AudioCodecCS}` },
	y2024: { file: join(path2024CS, idDVB_AudioCodecCS), url: `${DVB_METADATA}${url2024CS}/${idDVB_AudioCodecCS}` },
};

const idDVB_VideoCodecCS: string = "VideoCodecCS.xml";
export const DVB_VideoCodecCS: Record<string, DataLocation> = {
	y2007: { file: join(path2007CS, idDVB_VideoCodecCS), url: `${DVB_METADATA}${url2007CS}/${idDVB_VideoCodecCS}` },
	y2020: { file: join(path2020CS, idDVB_VideoCodecCS), url: `${DVB_METADATA}${url2020CS}/${idDVB_VideoCodecCS}` },
	y2021: { file: join(path2021CS, idDVB_VideoCodecCS), url: `${DVB_METADATA}${url2021CS}/${idDVB_VideoCodecCS}` },
	y2022: { file: join(path2022CS, idDVB_VideoCodecCS), url: `${DVB_METADATA}${url2022CS}/${idDVB_VideoCodecCS}` },
};

const idDVB_ColorimetryCS: string = "ColorimetryCS.xml";
export const DVB_ColorimetryCS: Record<string, DataLocation> = {
	y2020: { file: join(path2020CS, idDVB_ColorimetryCS), url: `${DVB_METADATA}${url2020CS}/${idDVB_ColorimetryCS}` },
};

const idMPEG7_AudioCodingFormatCS: string = "AudioCodingFormatCS.xml";
export const MPEG7_AudioCodingFormatCS: DataLocation = { file: join(pathMPEG7, idMPEG7_AudioCodingFormatCS), url: `${REPO_RAW}${subdirMPEG7}/${idMPEG7_AudioCodingFormatCS}` };

const idMPEG7_VisualCodingFormatCS: string = "VisualCodingFormatCS.xml";
export const MPEG7_VisualCodingFormatCS: DataLocation = { file: join(pathMPEG7, idMPEG7_VisualCodingFormatCS), url: `${REPO_RAW}${subdirMPEG7}/${idMPEG7_VisualCodingFormatCS}` };

const idMPEG7_AudioPresentationCS: string = "AudioPresentationCS.xml";
export const MPEG7_AudioPresentationCS: DataLocation = { file: join(pathMPEG7, idMPEG7_AudioPresentationCS), url: `${REPO_RAW}${subdirMPEG7}/${idMPEG7_AudioPresentationCS}` };

const idDVB_AudioConformanceCS: string = "AudioConformancePointsCS.xml";
export const DVB_AudioConformanceCS: Record<string, DataLocation> = {
	y2017: { file: join(path2017CS, idDVB_AudioConformanceCS), url: `${DVB_METADATA}${url2017CS}/${idDVB_AudioConformanceCS}` },
	y2024: { file: join(path2024CS, idDVB_AudioConformanceCS), url: `${DVB_METADATA}${url2024CS}/${idDVB_AudioConformanceCS}` },
};

const idDVB_VideoConformanceCS: string = "VideoConformancePointsCS.xml";
export const DVB_VideoConformanceCS: Record<string, DataLocation> = {
	y2017: { file: join(path2017CS, idDVB_VideoConformanceCS), url: `${DVB_METADATA}${url2017CS}/${idDVB_VideoConformanceCS}` },
	y2021: { file: join(path2021CS, idDVB_VideoConformanceCS), url: `${DVB_METADATA}${url2021CS}/${idDVB_VideoConformanceCS}` },
	y2022: { file: join(path2022CS, idDVB_VideoConformanceCS), url: `${DVB_METADATA}${url2022CS}/${idDVB_VideoConformanceCS}` },
	y2024: { file: join(path2024CS, idDVB_VideoConformanceCS), url: `${DVB_METADATA}${url2024CS}/${idDVB_VideoConformanceCS}`	},
	y2026: { file: join(path2026CS, idDVB_VideoConformanceCS), url: `${DVB_METADATA}${url2026CS}/${idDVB_VideoConformanceCS}` },
};

const idISO3166: string = "iso3166-countries.json";
export const ISO3166: DataLocation = { file: join(pathISO, idISO3166), url: `${REPO_RAW}${subdirISO}/${idISO3166}` };

const idDVBI_RecordingInfoCS: string = "DVBRecordingInfoCS-2019.xml";
export const DVBI_RecordingInfoCS: DataLocation = { file: join(pathDVBI, idDVBI_RecordingInfoCS), url: `${REPO_RAW}${subdirDVBI}/${idDVBI_RecordingInfoCS}` };

const v1Credits: string = "CreditsItem@role-values.txt";
export const DVBI_CreditsItemRoles: DataLocation = { file: join(pathDVBI, v1Credits), url: `${REPO_RAW}${subdirDVBI}/${v1Credits}` };

const v2Credits: string = "CreditsItem@role-values-v2.txt";
export const DVBIv2_CreditsItemRoles: DataLocation = { file: join(pathDVBI, v2Credits), url: `${REPO_RAW}${subdirDVBI}/${v2Credits}` };

const idDVB_ParentalGuidanceCS: string = "ParentalGuidanceCS.xml";
export const DVB_ParentalGuidanceCS: DataLocation = { file: join(path2007CS, idDVB_ParentalGuidanceCS), url: `${DVB_METADATA}${url2007CS}/${idDVB_ParentalGuidanceCS}` };

const TVAnamespace: string = "urn:tva:metadata";
const TVAfileprefix: string = "tva_metadata_3-1";

type TVAschemaVersions = "v2019" | "v2023" | "v2024" | "v2026";
type TVASchemaVersonInfo = { namespace: string, file: string };
type TVAschemaInfo = { [version in TVAschemaVersions]: TVASchemaVersonInfo }; 
export const TVAschema: TVAschemaInfo = {
	v2019: { namespace: `${TVAnamespace}:2019`, file: `./${schemasPath}/${TVAfileprefix}_2019.xsd` },
	v2023: { namespace: `${TVAnamespace}:2023`, file: `./${schemasPath}/${TVAfileprefix}_2023.xsd` },
	v2024: { namespace: `${TVAnamespace}:2024`, file: `./${schemasPath}/${TVAfileprefix}_2024.xsd` },
	v2026: { namespace: `${TVAnamespace}:2026`, file: `./${schemasPath}/${TVAfileprefix}_v1141.xsd` },
};

export const DVBI_ServiceListSchema: { [key: string]: { file: string } } = {
	r0: { file:  `./${schemasPath}/dvbi_v1.0.xsd` },
	r1: { file:  `./${schemasPath}/dvbi_v2.0.xsd` },
	r2: { file:  `./${schemasPath}/dvbi_v3.0.xsd` },
	r3: { file:  `./${schemasPath}/dvbi_v3.1.xsd` },
	r4: { file:  `./${schemasPath}/dvbi_v4.0+hls+hbbtv.xsd` },
	r5: { file:  `./${schemasPath}/dvbi_v5.0+hls+hbbtv.xsd` },
	r6: { file:  `./${schemasPath}/dvbi_v6.0+hls+hbbtv.xsd` },
	r6_Germany: {file:  `./${schemasPath}/dvbi_v6.0+hls+hbbtv-(DE).xsd`},
	r7: { file:  `./${schemasPath}/dvbi_v7.0+hls+hbbtv.xsd` },
	r8: { file:  `./${schemasPath}/dvbi_v8.0+hls+hbbtv+dvbhb.xsd` },
};

export const DVBI_ServiceListRegistrySchema: { [key: string]: { file: string } } = {
	r0: { file: `./${schemasPath}/dvbi_service_list_discovery_v1.0.xsd` },
	r1: { file: `./${schemasPath}/dvbi_service_list_discovery_v1.1.xsd` },
	r2: { file: `./${schemasPath}/dvbi_service_list_discovery_v1.2.xsd` },
	r3: { file: `./${schemasPath}/dvbi_service_list_discovery_v1.3.xsd` },
	r4: { file: `./${schemasPath}/dvbi_service_list_discovery_v1.4+hls.xsd` },
	r5: { file: `./${schemasPath}/dvbi_service_list_discovery_v1.5+hls.xsd` },
	r6: { file: `./${schemasPath}/dvbi_service_list_discovery_v1.6+hls.xsd` },
	r6_Germany: { file: `./${schemasPath}/dvbi_service_list_discovery_v1.6+hls-(DE).xsd` },
	r7: { file: `./${schemasPath}/dvbi_service_list_discovery_v1.7+hls.xsd` },
	r8: { file: `./${schemasPath}/dvbi_service_list_discovery_v1.8+hls.xsd` },
};

const languagesFilename: string = "language-subtag-registry";
export const IANA_Subtag_Registry: DataLocation = { file: join(pathIANA, languagesFilename), url: `https://www.iana.org/assignments/language-subtag-registry/${languagesFilename}` };

export const MOTD: DataLocation = {
	file: join(".", "motd.html"),
};
