/**
 * CMCDv2.mjs
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Definitions and check related to CMCD
 *
 */

// CTA-5004-B (a.k.a. second revision of CMCDv2) is available 
// at https://www.cta.tech/standards/wave-common-media-client-data/

/**
 * CMCDv2 example
 * 
	<DASHDeliveryParameters>
	  <UriBasedLocation contentType="application/dash+xml">
	    <dvbi-types:URI>http://123.123.123.123/manifest.mpd</dvbi-types:URI> 
	  </UriBasedLocation>
    <CMCD CMCDversion="2" contentId="123‑123‑123‑123-456-789">
      <Report reportingMode="urn:dvb:metadata:cmcd:delivery:request" 
				transmissionMode="urn:dvb:metadata:cmcd:delivery:queryArguments" 
				enabledKeys="cid sid br bl mtp bs su v"/>
      <Report reportingMode="urn:dvb:metadata:cmcd:delivery:event" 
				transmissionMode="urn:dvb:metadata:cmcd:delivery:body" 
				eventURL="https://somehost.net/CMCDreporting" 
				enabledKeys="e ts cid sid br bl mtp bs su v"/>
      <Report reportingMode="urn:dvb:metadata:cmcd:delivery:event" 
				transmissionMode="urn:dvb:metadata:cmcd:delivery:body" 
				eventURL="https://someotherhost.net/CMCDreporting" 
				batchSize="12" 
				enabledKeys="e ts br bl d ot pr sf sid sta cid dfa bs su v x‑paul1"/>
			<Report reportingMode="urn:dvb:metadata:cmcd:delivery:event" 
				transmissionMode="urn:dvb:metadata:cmcd:delivery:body" 
				eventURL="https://v1host.net/CMCDreporting" 
				obfuscateURL="true" 
				enabledKeys="cid sid br bl mtp bs su v e ts"/>
    </CMCD>
	</DASHDeliveryParameters> 
 */

import { dvbi } from "./DVB-I_definitions.mjs";
import { CMCD_MODE_REQUEST, CMCD_MODE_EVENT } from "./DVB-I_definitions.mjs";
import { CMCD_METHOD_HTTP_HEADER, CMCD_METHOD_QUERY_ARGUMENT, CMCD_METHOD_BODY } from "./DVB-I_definitions.mjs";
import { WARNING } from "./error_list.mjs";
import { isIn, parameterCheck } from "./utils.mjs";
import { isObjectEmpty } from "./utils.mjs";
import { isHTTPURL } from "./pattern_checks.mjs";
import { InvalidURL, keys } from "./common_errors.mjs";
import { isKnownCMCDCustomKey } from "./CMCD_custom_keys.mjs";

const supported_CMCD_versions = [1, 2];

const CMCD_keys = {
	aggregate_encoded_bitrate: "ab",
	buffer_length: "bl",
	backgrounded: "bg",
	encoded_bitrate: "br",
	buffer_starvation: "bs",
	buffer_starvation_absolute: "bsa",
	buffer_starvation_duration: "bsd",
	buffer_starvation_duration_absolute: "bsda",
	custom_event_name: "cen",
	content_id: "cid",
	CMSD_dynamic_header: "cmsdd",
	CMSD_static_header: "cmsds",
	content_signature: "cs",
	object_duration: "d",
	dropped_frames_absolute: "dfa",
	deadline: "dl",
	event: "e",
	player_error_code: "ec",
	hostname: "h",
	lowest_aggregated_encoded_bitrate: "lab",
	lowest_encoded_bitrate: "lb",
	live_stream_latency: "ltc",
	media_start_delay: "msd",
	measured_throughput: "mtp",
	next_object_request: "nor",
	non_rendered: "nr",
	next_range_request: "nrr", // removed from CMCDv2
	object_type: "ot",
	playhead_bitrate: "pb",
	playback_rate: "pr",
	playhead_time: "pt",
	response_code: "rc",
	requested_maximum_throughput: "rtp",
	streaming_format: "sf",
	session_id: "sid",
	SMRT_data_header: "smrt",
	sequence_number: "sn",
	stream_type: "st",
	state: "sta",
	startup: "su",
	top_aggregated_encoded_bitrate: "tab",
	top_encoded_bitrate: "tb",
	target_buffer_length: "tbl",
	top_playable_bitrate: "tpb",
	timestamp: "ts",
	time_to_first_byte: "ttfb",
	time_to_first_body_byte: "ttfbb",
	time_to_last_byte: "ttlb",
	request_url: "url",
	CMCD_version: "v",
};

const CMCD_EVENT_TYPES = ["abs","abe","ae","as","b","bc","c","ce","e","h","m","pc","pe","pr","ps","rr","sk","t","um"];
const CMCD_OBJECT_TYPES = ["m", "a", "v", "av", "i", "c", "tt", "k", "o"];

const request_mode_only = [CMCD_MODE_REQUEST],
	event_mode_only = [CMCD_MODE_EVENT],
	request_and_event_modes = [CMCD_MODE_REQUEST, CMCD_MODE_EVENT];

const CMCDv1_keys = [
	{ key: CMCD_keys.encoded_bitrate, allow_modes: request_mode_only },
	{ key: CMCD_keys.buffer_length, allow_modes: request_mode_only },
	{ key: CMCD_keys.buffer_starvation, allow_modes: request_mode_only },
	{ key: CMCD_keys.content_id, allow_modes: request_mode_only },
	{ key: CMCD_keys.object_duration, allow_modes: request_mode_only },
	{ key: CMCD_keys.deadline, allow_modes: request_mode_only },
	{ key: CMCD_keys.measured_throughput, allow_modes: request_mode_only },
	{ key: CMCD_keys.next_object_request, allow_modes: request_mode_only },
	{ key: CMCD_keys.next_range_request, allow_modes: request_mode_only },
	{ key: CMCD_keys.object_type, allow_modes: request_mode_only },
	{ key: CMCD_keys.playback_rate, allow_modes: request_mode_only },
	{ key: CMCD_keys.requested_maximum_throughput, allow_modes: request_mode_only },
	{ key: CMCD_keys.streaming_format, allow_modes: request_mode_only },
	{ key: CMCD_keys.session_id, allow_modes: request_mode_only },
	{ key: CMCD_keys.stream_type, allow_modes: request_mode_only },
	{ key: CMCD_keys.startup, allow_modes: request_mode_only },
	{ key: CMCD_keys.top_encoded_bitrate, allow_modes: request_mode_only },
	{ key: CMCD_keys.CMCD_version, allow_modes: request_mode_only },
];

const CMCDv2_keys = [
	{ key: CMCD_keys.aggregate_encoded_bitrate, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.buffer_length, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.backgrounded, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.encoded_bitrate, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.buffer_starvation, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.buffer_starvation_absolute, allow_modes: request_and_event_modes }, 
	{ key: CMCD_keys.buffer_starvation_duration, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.buffer_starvation_duration_absolute, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.custom_event_name, allow_modes: event_mode_only },
	{ key: CMCD_keys.content_id, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.CMSD_dynamic_header, allow_modes: event_mode_only },
	{ key: CMCD_keys.CMSD_static_header, allow_modes: event_mode_only },
	{ key: CMCD_keys.content_signature, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.object_duration, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.dropped_frames_absolute, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.deadline, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.event, allow_modes: event_mode_only },
	{ key: CMCD_keys.player_error_code, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.hostname, allow_modes: event_mode_only },
	{ key: CMCD_keys.lowest_aggregated_encoded_bitrate, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.lowest_encoded_bitrate, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.live_stream_latency, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.media_start_delay, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.measured_throughput, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.next_object_request, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.non_rendered, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.object_type, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.playhead_bitrate, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.playback_rate, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.playhead_time, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.response_code, allow_modes: event_mode_only },
	{ key: CMCD_keys.requested_maximum_throughput, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.streaming_format, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.session_id, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.SMRT_data_header, allow_modes: event_mode_only },
	{ key: CMCD_keys.sequence_number, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.stream_type, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.state, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.startup, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.top_aggregated_encoded_bitrate, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.top_encoded_bitrate, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.target_buffer_length, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.top_playable_bitrate, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.timestamp, allow_modes: event_mode_only },
	{ key: CMCD_keys.time_to_first_byte, allow_modes: event_mode_only },
	{ key: CMCD_keys.time_to_first_body_byte, allow_modes: event_mode_only },
	{ key: CMCD_keys.time_to_last_byte, allow_modes: event_mode_only },
	{ key: CMCD_keys.request_url, allow_modes: event_mode_only },
	{ key: CMCD_keys.CMCD_version, allow_modes: request_and_event_modes },
];

const isCustomKey = (key) => key.includes("-");
const reportingMode = (mode) => (mode.indexOf(":") != -1 ? mode.substring(mode.lastIndexOf(":") + 1) : "***");

const error_key = keys.k_CMCD;

function checkCMCDkeys(Report, version, errs, errCode) {
	if (!parameterCheck("checkCMCDkeys", Report, dvbi.e_Report, errs, `${errCode}-00`)) return;
	if (Number.isNaN(version)) return;

	const keys_to_use = version == 1 ? CMCDv1_keys : CMCDv2_keys;
	const configured_keys = Report.attrAnyNsValueOr(dvbi.a_enabledKeys);
	const reporting_mode = Report.attrAnyNsValueOr(dvbi.a_reportingMode, "undefined");
	const obfuscate_url = Report.attrAnyNsValueOr(dvbi.a_obfuscateURL);

	if (configured_keys && configured_keys.length > 0) {
		let hasURL = false;
		configured_keys.split(" ").forEach((key) => {
			if (key == CMCD_keys.request_url) hasURL = true;
			const reserved_key = keys_to_use.find((e) => e.key == key);
			if (reserved_key) {
				if (!isIn(reserved_key.allow_modes, reporting_mode))
					errs.addError({
						code: `${errCode}a`,
						message: `${key.quote()} is not allowed for the specified reporting mode (${reportingMode(reporting_mode)})`,
						fragment: Report,
						key: error_key,
					});
			} else if (isCustomKey(key)) {
				const knownCustomKey = isKnownCMCDCustomKey(key);
				if (knownCustomKey) 
					errs.addError({
						type: WARNING,
						code: `${errCode}b`,
						message: `known custom CMCD key ${key.quote()} in use`,
						fragment: Report,
						key: error_key,
						clause: "SVTA",
						description: `known CMCD Custom Key ${key.quote()}=${knownCustomKey.quote()}`,
					});		
				else errs.addError({
					type: WARNING,
					code: `${errCode}c`,
					message: `custom CMCD key ${key.quote()} in use`,
					fragment: Report,
					key: error_key,
				});
				}
			else
				errs.addError({
					code: `${errCode}d`,
					message: `${key.quote()} is not a reserved CMCDv${version} key or the correct format for a custom key`,
					fragment: Report,
					key: error_key,
				});
		});
		if (obfuscate_url && obfuscate_url == "true" && !hasURL)
			errs.addError({
				type: WARNING,
				code: `${errCode}e`,
				fragment: Report,
				message: `${dvbi.a_obfuscateURL.attribute()}="true" is only relevant when '${CMCD_keys.request_url}' is specified in ${dvbi.a_enabledKeys.attribute()}`,
				key: error_key,
			});
	}
	const configured_keys_array = configured_keys.split(" ");
	if (reporting_mode == CMCD_MODE_EVENT) {
		if (!isIn(configured_keys_array, CMCD_keys.timestamp)) 
			errs.addError({
				code: `${errCode}f`,
				message: `the key ${CMCD_keys.timestamp.quote()} is required to be specified for ${reportingMode(reporting_mode)} reporting`,
				fragment: Report,
				key: error_key,
			});
		if (!isIn(configured_keys_array, CMCD_keys.event)) 
			errs.addError({
				code: `${errCode}g`,
				message: `${reportingMode(reporting_mode)} mode report will include ${CMCD_keys.event.quote()} - it is not specified here`,
				fragment: Report,
				key: error_key,
			});
	}
	if (version >= 2) {
		const missingMandatoryKeyError = (key) => ({
			code: `${errCode}h`,
			message: `key ${key.quote()} is required in all reports since CMCDv2 and should be included`,
			fragment: Report,
			key: error_key,
			description: "All keys are OPTIONAL except for 'bs', 'su', and 'v' which are now required as of version 2.",
			clause: "CTA-5004-A clause 4.2 item 8",
		});
		// CTA-5004-A clause 4.2 item 8 says that "bs", "su" and "v" are mandatory
		if (!isIn(configured_keys_array, CMCD_keys.buffer_starvation)) errs.addError(missingMandatoryKeyError(CMCD_keys.buffer_starvation));
		if (!isIn(configured_keys_array, CMCD_keys.startup)) errs.addError(missingMandatoryKeyError(CMCD_keys.startup));
		if (!isIn(configured_keys_array, CMCD_keys.CMCD_version)) errs.addError(missingMandatoryKeyError(CMCD_keys.CMCD_version));
	}
}

function list_versions(version_numbers) {
	if (version_numbers.length == 0) return ` NONE `;
	if (version_numbers.length == 1) return ` ${version_numbers[0]} is`;
	let rc = "s "
	version_numbers.forEach((version, ix, arr) => {
		rc += `${version}`;
		rc += (ix == arr.length - 2) ? " and " : (ix == arr.length - 1) ? "" : ", ";
	});
	return rc + " are";
}


function ValidateContentIdLength(contentId, element, CMCDversion, errs, errPrefix) {
	if (!contentId)
		return;
	const contentIdLengthError = (_errCode, version, maxLen, foundLen) => ({
		code: _errCode,
		message: `length of ${dvbi.a_contentId.attribute(element.name)} must be less than or equal to ${maxLen} (counted ${foundLen}) for CMCDv${version}`,
		fragment: element,
		key: error_key,
	});
	if (!Number.isNaN(CMCDversion)) 
		switch (CMCDversion) {
			case 1:
				if (contentId.length > 64) {
					errs.addError(contentIdLengthError(`${errPrefix}-18`, CMCDversion, 64, contentId.length));
					errs.errorDescription({
						code: `${errPrefix}-18`,
						clause: "CTA-5004 Table 1",
						reference: "https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf",
						description: "A unique string identifying the current content. Maximum length is 64 characters.",
					});
				}
				break;
			default:
				if (contentId.length > 128) {
					// should not happen as the schema supporting CMCDv2 constrains the maximum length to 128 characters.
					errs.addError(contentIdLengthError(`${errPrefix}-18`, CMCDversion, 128, contentId.length));
					errs.errorDescription({
						code: `${errPrefix}-18`,
						clause: "CTA-5004-B Table 1",
						reference: "https://shop.cta.tech/collections/standards/products/cta-5004-b",
						description: "A unique string identifying the current content. Maximum length is 128 characters.",
					});
				}
				break;
		}
}


function ValidateReportType(Report, errs, errCode) {
	const reporting_mode = Report.attrAnyNsValueOr(dvbi.a_reportingMode),
			transmission_mode = Report.attrAnyNsValueOr(dvbi.a_transmissionMode);
	switch (reporting_mode) {
		case CMCD_MODE_REQUEST:
			if (transmission_mode && ![CMCD_METHOD_HTTP_HEADER, CMCD_METHOD_QUERY_ARGUMENT].includes(transmission_mode))
				errs.addError({
					code: `${errCode}-1b`,
					message: `only request header and query parameter methods are permitted for request based reporting`,
					fragment: Report,
					key: error_key,
					description: "The client attaches CMCD data to each media object request, using either query arguments or request headers.",
					clause: "CTA-5004-A clause 2.1",
				});
			if (Report.attrAnyNs(dvbi.a_eventURL))
				errs.addError({
					type: WARNING,
					code: `${errCode}-1c`,
					message: `${dvbi.a_eventURL.attribute(dvbi.e_Report)} is not used in request reporting mode`,
					fragment: Report,
					key: error_key,
				});
			if (Report.attrAnyNs(dvbi.a_batchSize))
				errs.addError({
					type: WARNING,
					code: `${errCode}-1d`,
					message: `${dvbi.a_batchSize.attribute(dvbi.e_Report)} is not applicable in request reporting mode`,
					fragment: Report,
					key: error_key,
				});
			if (Report.attrAnyNs(dvbi.a_eventTypes))
				errs.addError({
					type: WARNING,
					code: `${errCode}-1d`,
					message: `${dvbi.a_eventTypes.attribute(dvbi.e_Report)} is not applicable in request reporting mode`,
					fragment: Report,
					key: error_key,
				});
			break;

		case CMCD_MODE_EVENT:
			if (transmission_mode && transmission_mode != CMCD_METHOD_BODY) 
				errs.addError({
					code: `${errCode}-1b`,
					message: `only the body reporting method is permitted for evenet based reporting`,
					fragment: Report,
					key: error_key,
					description: "The player reports CMCD data to one or more alternate destinations in batches in the HTTP request body as defined in Section 3.3..",
					clause: "CTA-5004-B clause 2.2",
				});
			// eslint-disable-next-line no-case-declarations
			const Report_eventURL = Report.attrAnyNsValueOr(dvbi.a_eventURL);
			if (Report_eventURL) {
				if (!isHTTPURL(Report_eventURL))
					errs.addError(InvalidURL(Report_eventURL, Report, dvbi.a_eventURL.attribute(), `${errCode}-2b`));
			} else
				errs.addError({
					code: `${errCode}-2c`,
					message: `${dvbi.a_eventURL.attribute()} must be specified for event reporting mode`,
					fragment: Report,
					key: error_key,
				});

			break;
		}
}


function ValidateKeys(Report, CMCDversion, errs, errCode) {
	const enabledKeys = Report.attrAnyNsValueOr(dvbi.a_enabledKeys);
	if (!enabledKeys) return;

	const keys = enabledKeys.split(" ");
	let contentId = Report.attrAnyNsValueOr(dvbi.a_contentId);
	if (!contentId)
		contentId = Report.parent.attrAnyNsValueOr(dvbi.a_contentId);
	if (!contentId && isIn(keys, CMCD_keys.content_id))
		errs.addError({
			code: `${errCode}-11`,
			message: `${dvbi.a_contentId.attribute()} must be specified when ${dvbi.a_enabledKeys.attribute()} contains '${CMCD_keys.content_id}'`,
			fragment: Report,
			key: error_key,
		});
	
	checkCMCDkeys(Report, CMCDversion, errs, `${errCode}-13`);
}


function ValidateAttributes(Report, CMCDversion, counts, errs, errCode) {
	const objectTypes = Report.attrAnyNsValueOr(dvbi.a_objectTypes);
	if (objectTypes) {
		const objectTypes_array = objectTypes.split(" ");
		objectTypes_array.forEach((objectType) => {
			if (objectType.length != 0 && !isIn(CMCD_OBJECT_TYPES, objectType))
				errs.addError({
					code: `${errCode}-15`,
					message: `invalid object type ${objectType.quote()} specified in ${dvbi.a_objectTypes.attribute()}`,
					fragment: Report,
					key: error_key,
				});
		});
	}

	const eventTypes = Report.attrAnyNsValueOr(dvbi.a_eventTypes);
	if (eventTypes) {
		const eventTypes_array = eventTypes.split(" ");
		eventTypes_array.forEach((eventType) => {
			if (eventType.length != 0 && !isIn(CMCD_EVENT_TYPES, eventType))
				errs.addError({
					code: `${errCode}-14`,
					message: `invalid event type ${eventType.quote()} specified in ${dvbi.a_eventTypes.attribute()}`,
					fragment: Report,
					key: error_key,
				});
		});
	}

	const reporting_mode = Report.attrAnyNsValueOr(dvbi.a_reportingMode);

	if (reporting_mode && supported_CMCD_versions.includes(CMCDversion) && Object.prototype.hasOwnProperty.call(counts, reportingMode(reporting_mode))) {
		counts[reportingMode(reporting_mode)][CMCDversion-1]++;
		if (counts[reportingMode(CMCD_MODE_REQUEST)][CMCDversion-1] > 1)
			errs.addError({
				code: `${errCode}-20`,
				message: "only a single reporting configuration for Request Mode can be specified",
				fragment: Report.parent,
				key: error_key,
			});
	}
}

function ValidateCMCDv1Element(CMCDelem, counts, errs, errCode) {
	CMCDelem.forEachNamedChildElement(dvbi.e_Report, (Report) => {
		const reporting_mode = Report.attrAnyNsValueOr(dvbi.a_reportingMode);
		if (reporting_mode != CMCD_MODE_REQUEST)
			errs.addError({
				code: `${errCode}-12`,
				message: "This reporting type is not permitted in CMCDv1",
				fragment: Report,
				key: error_key,
			});
		ValidateReportType(Report, errs, `${errCode}-21`);
		const contentId = Report.attrAnyNsValueOr(dvbi.a_contentId) | CMCDelem.attrAnyNsValueOr(dvbi.a_contentId);
		if (contentId)
			ValidateContentIdLength(contentId, Report, 1, errs, `${errCode}-23`)
		ValidateKeys(Report, 1, errs, `${errCode}-25`);
		ValidateAttributes(Report, 1, counts, errs, `${errCode}-25`);
		if (Report.attrAnyNs(dvbi.a_contentId)) {
			const enabledKeys = Report.attrAnyNsValueOr(dvbi.a_enabledKeys);
			if (enabledKeys) {
				const keys = enabledKeys.split(" ");
				if (!keys.includes(CMCD_keys.content_id))
					errs.addError({
						type: WARNING,
						code: `${errCode}-31`,
						message: `${dvbi.a_contentId.attribute()} is specified but key '${CMCD_keys.content_id}' not requested for reporting`,
						fragment: Report,
						key: error_key,
					});
			}
		}
	});
}

function ValidateCMCDv2Element(CMCDelem, counts, errs, errCode) {
	const contentId = CMCDelem.attrAnyNsValueOr(dvbi.a_contentId);
	if (contentId) {
		ValidateContentIdLength(contentId, 2, errs,`${errCode}-23`);
	}
	CMCDelem.forEachNamedChildElement(dvbi.e_Report, (Report) => {
		ValidateReportType(Report, errs, `${errCode}-21`);
		ValidateKeys(Report, 2, errs, `${errCode}-25`);
		ValidateAttributes(Report, 2, counts, errs, `${errCode}-27`);
	});
}

function cidRequested(CMCDelem) {
	// return true if the 'cid' metric is used in any child <Report>
	let rc = false;
	CMCDelem.forEachNamedChildElement(dvbi.e_Report, (Report) => {
		const enabledKeys = Report.attrAnyNsValueOr(dvbi.a_enabledKeys);
		if (enabledKeys) {
			const keys = enabledKeys.split(" ");
			if (keys.includes(CMCD_keys.content_id))
				rc = true;
		}
	});
	return rc;
}

function check_CMCD(CMCDelem, counts, errs, errCode) {
	if (!parameterCheck("check_CMCD", CMCDelem, dvbi.e_CMCD, errs, `${errCode}-0`)) return;
	
	if (isObjectEmpty(counts)) {
		counts.version = [];
		counts[reportingMode(CMCD_MODE_REQUEST)] = [];
		counts[reportingMode(CMCD_MODE_EVENT)] = [];
		for (let i=0; i < supported_CMCD_versions.length; i++) {
			counts.version.push(0);
			counts[reportingMode(CMCD_MODE_REQUEST)].push(0);
			counts[reportingMode(CMCD_MODE_EVENT)].push(0);
		};
	}

	const CMCDversion = parseInt(CMCDelem.attrAnyNsValueOr(dvbi.a_CMCDversion)); // should result in a number or NaN, which is handled in the checks below

	if (supported_CMCD_versions.includes(CMCDversion)) {
		if (counts.version[CMCDversion-1] != 0)
			errs.addError({
				code: `${errCode}-1`,
				message: `Only a single ${dvbi.e_CMCD} element with ${dvbi.a_CMCDversion.attribute()}=${CMCDversion} is permitted`,
				line: CMCDelem.line,
				key: error_key,
				clause: "A177 table 32",
				description: "Only a single CMCD element for each CMCDversion is permited.",
			});
		counts.version[CMCDversion-1]++;
	} 
	else {
		// shouldn't happen as the value space is constrained in the schema
		errs.addError({
			code: `${errCode}-2`,
			message: `Only CMCD version${list_versions(supported_CMCD_versions)} supported, got (${CMCDversion})`,
			fragment: CMCDelem,
			key: error_key,
		});
		return;
	}

	//const specVersion = SL_SchemaVersion(CMCDelem.documentNamespace());
	switch (CMCDversion) {
		case 1:
			ValidateCMCDv1Element(CMCDelem, counts, errs, `${errCode}-11`);
			break;
		case 2:
			ValidateCMCDv2Element(CMCDelem, counts, errs, `${errCode}-12`);
			break;
	}

	if (CMCDelem.attrAnyNs(dvbi.a_contentId) && !cidRequested(CMCDelem)) {
		errs.addError({
			type: WARNING,
			code: `${errCode}-21`,
			message: `${dvbi.a_contentId.attribute()} is specified but key '${CMCD_keys.content_id}' not requested for reporting`,
			fragment: CMCDelem,
			key: error_key,
		});
	}
}


export function ValidateCMCDinDASH(DASHDeliveryParameters, errs, errCode) {
	let mode_counts = {}; // accumulator of each request type
	DASHDeliveryParameters.forEachNamedChildElement(dvbi.e_CMCD, (CMCDelem) => {
		check_CMCD(CMCDelem, mode_counts, errs, errCode);
	});	
}
