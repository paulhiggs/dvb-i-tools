/* jshint esversion: 8 */
// data-locations.js

const path=require("path");

const REPO_RAW="https://raw.githubusercontent.com/paulhiggs/dvb-i-tools/master/";
const DVB_METADATA="https://dvb.org/metadata/";

const TVA_ContentCS="ContentCS.xml";
module.exports.TVA_ContentCSFilename=path.join("tva", TVA_ContentCS);
module.exports.TVA_ContentCSURL=`${REPO_RAW}tva/${TVA_ContentCS}`;

const TVA_FormatCS="FormatCS.xml";
module.exports.TVA_FormatCSFilename=path.join("tva", TVA_FormatCS);
module.exports.TVA_FormatCSURL=`${REPO_RAW}tva/${TVA_FormatCS}`;

const TVA_PictureCS="PictureFormatCS.xml";
module.exports.TVA_PictureFormatCSFilename=path.join("tva", TVA_PictureCS);
module.exports.TVA_PictureFormatCSURL=`${REPO_RAW}tva/${TVA_PictureCS}`;

const DVB_ContentSubjectCS="DVBContentSubjectCS-2019.xml";
module.exports.DVBI_ContentSubjectFilename=path.join("dvbi", DVB_ContentSubjectCS);
module.exports.DVBI_ContentSubjectURL=`${REPO_RAW}dvbi/${DVB_ContentSubjectCS}`;

const DVB_ServiceTypeCS="DVBServiceTypeCS-2019.xml";
module.exports.DVBI_ServiceTypeCSFilename=path.join("dvbi", DVB_ServiceTypeCS);
module.exports.DVBI_ServiceTypeCSURL=`${REPO_RAW}dvbi/${DVB_ServiceTypeCS}`;

const DVB_AudioCodecCS2007="2007/AudioCodecCS.xml";
module.exports.DVB_AudioCodecCSFilename=path.join("dvb/cs/", DVB_AudioCodecCS2007);
module.exports.DVB_AudioCodecCSURL=`${DVB_METADATA}cs/${DVB_AudioCodecCS2007}`;

const DVB_AudioCodecCS2020="2020/AudioCodecCS.xml";
module.exports.DVB_AudioCodecCS2020Filename=path.join("dvb/cs/", DVB_AudioCodecCS2020);
module.exports.DVB_AudioCodecCS2020URL=`${DVB_METADATA}cs/${DVB_AudioCodecCS2020}`;

const DVB_VideoCodecCS="VideoCodecCS.xml";
module.exports.DVB_VideoCodecCS2007Filename=path.join("dvb/cs/2007", DVB_VideoCodecCS);
module.exports.DVB_VideoCodecCS2007URL=`${DVB_METADATA}cs/2007/${DVB_VideoCodecCS}`;

module.exports.DVB_VideoCodecCS2020Filename=path.join("dvb/cs/2020", DVB_VideoCodecCS);
module.exports.DVB_VideoCodecCS2020URL=`${DVB_METADATA}cs/2020/${DVB_VideoCodecCS}`;

module.exports.DVB_VideoCodecCS2021Filename=path.join("dvb/cs/2021", DVB_VideoCodecCS);
module.exports.DVB_VideoCodecCS2021URL=`${DVB_METADATA}cs/2021/${DVB_VideoCodecCS}`;

const MPEG_AudioCodingFormatCS="AudioCodingFormatCS.xml";
module.exports.MPEG7_AudioCodingFormatCSFilename=path.join("mpeg7", MPEG_AudioCodingFormatCS);
module.exports.MPEG7_AudioCodingFormatCSURL=`${REPO_RAW}mpeg7/${MPEG_AudioCodingFormatCS}`;

const MPEG7_VisualCodingFormatCS="VisualCodingFormatCS.xml";
module.exports.MPEG7_VisualCodingFormatCSFilename=path.join("mpeg7", MPEG7_VisualCodingFormatCS);
module.exports.MPEG7_VisualCodingFormatCSURL=`${REPO_RAW}mpeg7/${MPEG7_VisualCodingFormatCS}`;

const MPEG7_AudioPresentationCS="AudioPresentationCS.xml";
module.exports.MPEG7_AudioPresentationCSFilename=path.join("mpeg7", MPEG7_AudioPresentationCS);
module.exports.MPEG7_AudioPresentationCSURL=`${REPO_RAW}mpeg7/${MPEG7_AudioPresentationCS}`;

const DVB_AudioConformanceCS="AudioConformancePointsCS.xml";
module.exports.DVB_AudioConformanceCSFilename=path.join("dvb/cs/2017", DVB_AudioConformanceCS);
module.exports.DVB_AudioConformanceCSURL=`${DVB_METADATA}cs/2017/${DVB_AudioConformanceCS}`;

const DVB_VideoConformanceCS="VideoConformancePointsCS.xml";
module.exports.DVB_VideoConformanceCS2017Filename=path.join("dvb/cs/2017", DVB_VideoConformanceCS);
module.exports.DVB_VideoConformanceCS2017URL=`${DVB_METADATA}cs/2017/${DVB_VideoConformanceCS}`;

module.exports.DVB_VideoConformanceCS2021Filename=path.join("dvb/cs/2021", DVB_VideoConformanceCS);
module.exports.DVB_VideoConformanceCS2021URL=`${DVB_METADATA}cs/2021/${DVB_VideoConformanceCS}`;

const ISO3166="iso3166-countries.json";
module.exports.ISO3166_Filename=path.join("iso", ISO3166);
module.exports.ISO3166_URL=`${REPO_RAW}iso/${ISO3166}`;

const DVBI_RecordingInfoCS="DVBRecordingInfoCS-2019.xml";
module.exports.DVBI_RecordingInfoCSFilename=path.join("dvbi", DVBI_RecordingInfoCS);
module.exports.DVBI_RecordingInfoCSURL=`${REPO_RAW}dvbi/${DVBI_RecordingInfoCS}`;

const v1Credits="CreditsItem@role-values.txt";
module.exports.DVBI_CreditsItemRolesFilename=path.join("dvbi", v1Credits);
module.exports.DVBI_CreditsItemRolesURL=`${REPO_RAW}dvbi/${v1Credits}`;

const v2Credits="CreditsItem@role-values-v2.txt";
module.exports.DVBIv2_CreditsItemRolesFilename=path.join("dvbi", v2Credits);
module.exports.DVBIv2_CreditsItemRolesURL=`${REPO_RAW}dvbi/${v2Credits}`;


module.exports.TVAschemaFileName=path.join(".", "tva_metadata_3-1.xsd");

module.exports.DVBI_ServiceListSchemaFilename_v1=path.join(".", "dvbi_v1.0.xsd");
module.exports.DVBI_ServiceListSchemaFilename_v2=path.join(".", "dvbi_v2.0.xsd");
module.exports.DVBI_ServiceListSchemaFilename_v3=path.join(".", "dvbi_v3.0.xsd");

const languagesFilename="language-subtag-registry";
module.exports.IANA_Subtag_Registry_Filename=path.join("iana", languagesFilename);
module.exports.IANA_Subtag_Registry_URL=`https://www.iana.org/assignments/language-subtag-registry/${languagesFilename}`;
