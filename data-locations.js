// data-locations.js
import { join } from "path";

const REPO_RAW="https://raw.githubusercontent.com/paulhiggs/dvb-i-tools/main/";
const DVB_METADATA="https://dvb.org/metadata/";

const pathDVBCS='dvb/cs/', pathDVBI="dvbi", pathISO="iso", pathMPEG7="mpeg7", pathTVA="tva",
      path2007CS=`${pathDVBCS}2007`,
      path2017CS=`${pathDVBCS}2017`,
      path2020CS=`${pathDVBCS}2020`,
      path2021CS=`${pathDVBCS}2021`;

// SLEPR == Service List Entry Point Registry
const SLEPR_Dir="registries", SLEPR_File="slepr-main.xml";
export const Default_SLEPR={file:join(SLEPR_Dir,SLEPR_File), url:`${REPO_RAW}${SLEPR_Dir}/${SLEPR_File}`};

const idTVA_ContentCS="ContentCS.xml";
export const TVA_ContentCS={file:join(pathTVA, idTVA_ContentCS), url:`${REPO_RAW}${pathTVA}/${idTVA_ContentCS}`};

const idTVA_FormatCS="FormatCS.xml";
export const TVA_FormatCS={file:join(pathTVA, idTVA_FormatCS), url:`${REPO_RAW}${pathTVA}/${idTVA_FormatCS}`};

const idTVA_PictureCS="PictureFormatCS.xml";
export const TVA_PictureFormatCS={file:join(pathTVA, idTVA_PictureCS), url:`${REPO_RAW}${pathTVA}/${idTVA_PictureCS}`};

const idDVB_ContentSubjectCS="DVBContentSubjectCS-2019.xml";
export const DVBI_ContentSubject={file:join(pathDVBI, idDVB_ContentSubjectCS), url:`${REPO_RAW}${pathDVBI}/${idDVB_ContentSubjectCS}`};

const idDVB_ServiceTypeCS="DVBServiceTypeCS-2019.xml";
export const DVBI_ServiceTypeCS={file:join(pathDVBI, idDVB_ServiceTypeCS), url:`${REPO_RAW}${pathDVBI}/${idDVB_ServiceTypeCS}`};

const idDVB_AudioCodecCS="AudioCodecCS.xml";
export const DVB_AudioCodecCS={
    y2007:{file:join(path2007CS, idDVB_AudioCodecCS), url:`${DVB_METADATA}${path2007CS}/${idDVB_AudioCodecCS}`},
    y2020:{file:join(path2020CS, idDVB_AudioCodecCS), url:`${DVB_METADATA}${path2020CS}/${idDVB_AudioCodecCS}`}
};

const idDVB_VideoCodecCS="VideoCodecCS.xml";
export const DVB_VideoCodecCS={
    y2007:{file:join(path2007CS, idDVB_VideoCodecCS), url:`${DVB_METADATA}${path2007CS}/${idDVB_VideoCodecCS}`},
    y2021:{file:join(path2021CS, idDVB_VideoCodecCS), url:`${DVB_METADATA}${path2021CS}/${idDVB_VideoCodecCS}`}
};

const idMPEG_AudioCodingFormatCS="AudioCodingFormatCS.xml";
export const MPEG7_AudioCodingFormatCS={file:join(pathMPEG7, idMPEG_AudioCodingFormatCS), url:`${REPO_RAW}${pathMPEG7}/${idMPEG_AudioCodingFormatCS}`};

const idMPEG7_VisualCodingFormatCS="VisualCodingFormatCS.xml";
export const MPEG7_VisualCodingFormatCS={file:join(pathMPEG7, idMPEG7_VisualCodingFormatCS), url:`${REPO_RAW}${pathMPEG7}/${idMPEG7_VisualCodingFormatCS}`};

const idMPEG7_AudioPresentationCS="AudioPresentationCS.xml";
export const MPEG7_AudioPresentationCS={file:join(pathMPEG7, idMPEG7_AudioPresentationCS), url:`${REPO_RAW}${pathMPEG7}/${idMPEG7_AudioPresentationCS}`};

const idDVB_AudioConformanceCS="AudioConformancePointsCS.xml";
export const DVB_AudioConformanceCS={file:join(path2017CS, idDVB_AudioConformanceCS), url:`${DVB_METADATA}${path2017CS}/${idDVB_AudioConformanceCS}`};

const idDVB_VideoConformanceCS="VideoConformancePointsCS.xml";
export const DVB_VideoConformanceCS={
    y2017:{file:join(path2017CS, idDVB_VideoConformanceCS), url:`${DVB_METADATA}${path2017CS}/${idDVB_VideoConformanceCS}`},
    y2021:{file:join(path2021CS, idDVB_VideoConformanceCS), url:`${DVB_METADATA}${path2021CS}/${idDVB_VideoConformanceCS}`}
};

const idISO3166="iso3166-countries.json";
export const ISO3166={file:join(pathISO, idISO3166), url:`${REPO_RAW}${pathISO}/${idISO3166}`};

const idDVBI_RecordingInfoCS="DVBRecordingInfoCS-2019.xml";
export const DVBI_RecordingInfoCS={file:join(pathDVBI, idDVBI_RecordingInfoCS), url:`${REPO_RAW}${pathDVBI}/${idDVBI_RecordingInfoCS}`};

const v1Credits="CreditsItem@role-values.txt";
export const DVBI_CreditsItemRoles={file:join(pathDVBI, v1Credits), url:`${REPO_RAW}${pathDVBI}/${v1Credits}`};

const v2Credits="CreditsItem@role-values-v2.txt";
export const DVBIv2_CreditsItemRoles={file:join(pathDVBI, v2Credits), url:`${REPO_RAW}${pathDVBI}/${v2Credits}`};

export const TVAschema={file:join(".", "tva_metadata_3-1.xsd")};

export const DVBI_ServiceListSchema={
	v1:{file:join(".", "dvbi_v1.0.xsd")},
	v2:{file:join(".", "dvbi_v2.0.xsd")},
	v3:{file:join(".", "dvbi_v3.0.xsd")},
	v3x:{file:join(".", "dvbi_v3.1.xsd")}
};

const languagesFilename="language-subtag-registry";
export const IANA_Subtag_Registry={file:join("iana", languagesFilename), url:`https://www.iana.org/assignments/language-subtag-registry/${languagesFilename}`};
