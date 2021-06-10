/* jshint esversion: 8 */
// data-locations.js

const path=require("path");

const REPO_RAW="https://raw.githubusercontent.com/paulhiggs/dvb-i-tools/master/";
const DVB_METADATA="https://dvb.org/metadata/";

const idTVA_ContentCS="ContentCS.xml";
module.exports.TVA_ContentCS={file:path.join("tva", idTVA_ContentCS), url:`${REPO_RAW}tva/${idTVA_ContentCS}`};

const idTVA_FormatCS="FormatCS.xml";
module.exports.TVA_FormatCS={file:path.join("tva", idTVA_FormatCS), url:`${REPO_RAW}tva/${idTVA_FormatCS}`};

const idTVA_PictureCS="PictureFormatCS.xml";
module.exports.TVA_PictureFormatCS={file:path.join("tva", idTVA_PictureCS), url:`${REPO_RAW}tva/${idTVA_PictureCS}`};

const idDVB_ContentSubjectCS="DVBContentSubjectCS-2019.xml";
module.exports.DVBI_ContentSubject={file:path.join("dvbi", idDVB_ContentSubjectCS), url:`${REPO_RAW}dvbi/${idDVB_ContentSubjectCS}`};

const idDVB_ServiceTypeCS="DVBServiceTypeCS-2019.xml";
module.exports.DVBI_ServiceTypeCS={file:path.join("dvbi", idDVB_ServiceTypeCS), url:`${REPO_RAW}dvbi/${idDVB_ServiceTypeCS}`};

const idDVB_AudioCodecCS="AudioCodecCS.xml";

module.exports.DVB_AudioCodecCS={
    y2007:{file:path.join("dvb/cs/2007/", idDVB_AudioCodecCS), url:`${DVB_METADATA}cs/2007/${idDVB_AudioCodecCS}`},
    y2020:{file:path.join("dvb/cs/2020/", idDVB_AudioCodecCS), url:`${DVB_METADATA}cs/2020/${idDVB_AudioCodecCS}`}
};


const idDVB_VideoCodecCS="VideoCodecCS.xml";

module.exports.DVB_VideoCodecCS={
    y2007:{file:path.join("dvb/cs/2007", idDVB_VideoCodecCS), url:`${DVB_METADATA}cs/2007/${idDVB_VideoCodecCS}`},
    y2021:{file:path.join("dvb/cs/2021", idDVB_VideoCodecCS), url:`${DVB_METADATA}cs/2021/${idDVB_VideoCodecCS}`}
};

const idMPEG_AudioCodingFormatCS="AudioCodingFormatCS.xml";
module.exports.MPEG7_AudioCodingFormatCS={file:path.join("mpeg7", idMPEG_AudioCodingFormatCS), url:`${REPO_RAW}mpeg7/${idMPEG_AudioCodingFormatCS}`};

const idMPEG7_VisualCodingFormatCS="VisualCodingFormatCS.xml";
module.exports.MPEG7_VisualCodingFormatCS={file:path.join("mpeg7", idMPEG7_VisualCodingFormatCS), url:`${REPO_RAW}mpeg7/${idMPEG7_VisualCodingFormatCS}`};

const idMPEG7_AudioPresentationCS="AudioPresentationCS.xml";
module.exports.MPEG7_AudioPresentationCS={file:path.join("mpeg7", idMPEG7_AudioPresentationCS), url:`${REPO_RAW}mpeg7/${idMPEG7_AudioPresentationCS}`};

const idDVB_AudioConformanceCS="AudioConformancePointsCS.xml";
module.exports.DVB_AudioConformanceCS={file:path.join("dvb/cs/2017", idDVB_AudioConformanceCS), url:`${DVB_METADATA}cs/2017/${idDVB_AudioConformanceCS}`};

const idDVB_VideoConformanceCS="VideoConformancePointsCS.xml";
module.exports.DVB_VideoConformanceCS={
    y2017:{file:path.join("dvb/cs/2017", idDVB_VideoConformanceCS), url:`${DVB_METADATA}cs/2017/${idDVB_VideoConformanceCS}`},
    y2021:{file:path.join("dvb/cs/2021", idDVB_VideoConformanceCS), url:`${DVB_METADATA}cs/2021/${idDVB_VideoConformanceCS}`}
};

const idISO3166="iso3166-countries.json";
module.exports.ISO3166={file:path.join("iso", idISO3166), url:`${REPO_RAW}iso/${idISO3166}`};

const idDVBI_RecordingInfoCS="DVBRecordingInfoCS-2019.xml";
module.exports.DVBI_RecordingInfoCS={file:path.join("dvbi", idDVBI_RecordingInfoCS), url:`${REPO_RAW}dvbi/${idDVBI_RecordingInfoCS}`};

const v1Credits="CreditsItem@role-values.txt";
module.exports.DVBI_CreditsItemRoles={file:path.join("dvbi", v1Credits), url:`${REPO_RAW}dvbi/${v1Credits}`};

const v2Credits="CreditsItem@role-values-v2.txt";
module.exports.DVBIv2_CreditsItemRoles={file:path.join("dvbi", v2Credits), url:`${REPO_RAW}dvbi/${v2Credits}`};


module.exports.TVAschema={file:path.join(".", "tva_metadata_3-1.xsd")};

module.exports.DVBI_ServiceListSchema={
    v1:{file:path.join(".", "dvbi_v1.0.xsd")},
    v2:{file:path.join(".", "dvbi_v1.0.xsd")},
    v3:{file:path.join(".", "dvbi_v3.0.xsd")}
};

const languagesFilename="language-subtag-registry";
module.exports.IANA_Subtag_Registry={file:path.join("iana", languagesFilename), url:`https://www.iana.org/assignments/language-subtag-registry/${languagesFilename}`};
