// data-locations.js

import { join } from "path";

const REPO_RAW="https://raw.githubusercontent.com/paulhiggs/dvb-i-tools/main/";
const DVB_METADATA="https://dvb.org/metadata/";

// SLEPR == Service List Entry Point Registry
const SLEPR_Dir="registries", SLEPR_File="slepr-main.xml";
export const Default_SLEPR={file:join(SLEPR_Dir,SLEPR_File), url:`${REPO_RAW}${SLEPR_Dir}/${SLEPR_File}`};

const TV_Anytime_dir="tva";
const idTVA_ContentCS="ContentCS.xml";
export const TVA_ContentCS={file:join(TV_Anytime_dir, idTVA_ContentCS), url:`${REPO_RAW}${TV_Anytime_dir}/${idTVA_ContentCS}`};

const idTVA_FormatCS="FormatCS.xml";
export const TVA_FormatCS={file:join(TV_Anytime_dir, idTVA_FormatCS), url:`${REPO_RAW}${TV_Anytime_dir}/${idTVA_FormatCS}`};

const idTVA_PictureCS="PictureFormatCS.xml";
export const TVA_PictureFormatCS={file:join(TV_Anytime_dir, idTVA_PictureCS), url:`${REPO_RAW}${TV_Anytime_dir}/${idTVA_PictureCS}`};

const idDVB_ContentSubjectCS="DVBContentSubjectCS-2019.xml";
export const DVBI_ContentSubject={file:join("dvbi", idDVB_ContentSubjectCS), url:`${REPO_RAW}dvbi/${idDVB_ContentSubjectCS}`};

const idDVB_ServiceTypeCS="DVBServiceTypeCS-2019.xml";
export const DVBI_ServiceTypeCS={file:join("dvbi", idDVB_ServiceTypeCS), url:`${REPO_RAW}dvbi/${idDVB_ServiceTypeCS}`};

const idDVB_AudioCodecCS="AudioCodecCS.xml";

export const DVB_AudioCodecCS={
    y2007:{file:join("dvb/cs/2007/", idDVB_AudioCodecCS), url:`${DVB_METADATA}cs/2007/${idDVB_AudioCodecCS}`},
    y2020:{file:join("dvb/cs/2020/", idDVB_AudioCodecCS), url:`${DVB_METADATA}cs/2020/${idDVB_AudioCodecCS}`}
};


const idDVB_VideoCodecCS="VideoCodecCS.xml";

export const DVB_VideoCodecCS={
    y2007:{file:join("dvb/cs/2007", idDVB_VideoCodecCS), url:`${DVB_METADATA}cs/2007/${idDVB_VideoCodecCS}`},
    y2021:{file:join("dvb/cs/2021", idDVB_VideoCodecCS), url:`${DVB_METADATA}cs/2021/${idDVB_VideoCodecCS}`}
};

const idMPEG_AudioCodingFormatCS="AudioCodingFormatCS.xml";
export const MPEG7_AudioCodingFormatCS={file:join("mpeg7", idMPEG_AudioCodingFormatCS), url:`${REPO_RAW}mpeg7/${idMPEG_AudioCodingFormatCS}`};

const idMPEG7_VisualCodingFormatCS="VisualCodingFormatCS.xml";
export const MPEG7_VisualCodingFormatCS={file:join("mpeg7", idMPEG7_VisualCodingFormatCS), url:`${REPO_RAW}mpeg7/${idMPEG7_VisualCodingFormatCS}`};

const idMPEG7_AudioPresentationCS="AudioPresentationCS.xml";
export const MPEG7_AudioPresentationCS={file:join("mpeg7", idMPEG7_AudioPresentationCS), url:`${REPO_RAW}mpeg7/${idMPEG7_AudioPresentationCS}`};

const idDVB_AudioConformanceCS="AudioConformancePointsCS.xml";
export const DVB_AudioConformanceCS={file:join("dvb/cs/2017", idDVB_AudioConformanceCS), url:`${DVB_METADATA}cs/2017/${idDVB_AudioConformanceCS}`};

const idDVB_VideoConformanceCS="VideoConformancePointsCS.xml";
export const DVB_VideoConformanceCS={
    y2017:{file:join("dvb/cs/2017", idDVB_VideoConformanceCS), url:`${DVB_METADATA}cs/2017/${idDVB_VideoConformanceCS}`},
    y2021:{file:join("dvb/cs/2021", idDVB_VideoConformanceCS), url:`${DVB_METADATA}cs/2021/${idDVB_VideoConformanceCS}`}
};

const idISO3166="iso3166-countries.json";
export const ISO3166={file:join("iso", idISO3166), url:`${REPO_RAW}iso/${idISO3166}`};

const idDVBI_RecordingInfoCS="DVBRecordingInfoCS-2019.xml";
export const DVBI_RecordingInfoCS={file:join("dvbi", idDVBI_RecordingInfoCS), url:`${REPO_RAW}dvbi/${idDVBI_RecordingInfoCS}`};

const v1Credits="CreditsItem@role-values.txt";
export const DVBI_CreditsItemRoles={file:join("dvbi", v1Credits), url:`${REPO_RAW}dvbi/${v1Credits}`};

const v2Credits="CreditsItem@role-values-v2.txt";
export const DVBIv2_CreditsItemRoles={file:join("dvbi", v2Credits), url:`${REPO_RAW}dvbi/${v2Credits}`};


export const TVAschema={file:join(".", "tva_metadata_3-1.xsd")};

export const DVBI_ServiceListSchema={
    v1:{file:join(".", "dvbi_v1.0.xsd")},
    v2:{file:join(".", "dvbi_v2.0.xsd")},
    v3:{file:join(".", "dvbi_v3.0.xsd")},
    v3x:{file:join(".", "dvbi_v3.x.xsd")}
};

const languagesFilename="language-subtag-registry";
export const IANA_Subtag_Registry={file:join("iana", languagesFilename), url:`https://www.iana.org/assignments/language-subtag-registry/${languagesFilename}`};
