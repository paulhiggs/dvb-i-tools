/**
 * CMCD.mjs
 *
 * Definitions and check related to CMCD
 *
 */

import { isObjectEmpty } from "../phlib/phlib.js";

import { keys } from "./common_errors.mjs";
import { dvbi } from "./DVB-I_definitions.mjs";
import { CMCD_MODE_REQUEST, dvbiEA } from "./DVB-I_definitions.mjs";
import { APPLICATION, WARNING } from "./error_list.mjs";
import { checkAttributes } from "./schema_checks.mjs";
import { isIn } from "./utils.mjs";

const CMCD_keys = {
	encoded_bitrate: "br",
	aggregate_encoded_bitrate: "ab",
	playhead_bitrate: "pb",
	buffer_length: "bl",
	target_buffer_length: "tbl",
	buffer_starvation: "bs",
	buffer_starvation_duration: "bsd",
	cdn_id: "cdn",
	content_id: "cid",
	object_duration: "d",
	deadline: "dl",
	live_stream_latency: "ltc",
	measured_throughput: "mtp",
	next_object_request: "nor",
	next_range_request: "nrr", // removed from CMCDv2
	object_type: "ot",
	playback_rate: "pr",
	requested_maximum_throughput: "rtp",
	response_code: "rc",
	streaming_format: "sf",
	session_id: "sid",
	backgrounded: "bg",
	sequence_number: "sn",
	state: "sta",
	stream_type: "st",
	startup: "su",
	time_to_first_byte: "ttfb",
	time_to_first_body_byte: "ttfbb",
	time_to_last_byte: "ttlb",
	timestamp: "ts",
	top_playable_bitrate: "tpb",
	top_encoded_bitrate: "tb",
	lowest_encoded_bitrate: "lb",
	top_aggregated_encoded_bitrate: "tab",
	lowest_aggregated_encoded_bitrate: "lab",
	request_url: "url",
	playhead_time: "pt",
	player_error_code: "ec",
	media_start_delay: "msd",
	event: "e",
	CMSD_dynamic_header: "cmsdd",
	CMSD_static_header: "cmsds",
	SMT_header: "smrt",
	dropped_frames: "df",
	content_signature: "cs",
	CMCD_version: "v",
};

const all_reporting_modes = [CMCD_MODE_REQUEST];
const CMCDv1_keys = [
	{ key: CMCD_keys.encoded_bitrate, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.buffer_length, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.buffer_starvation, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.content_id, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.object_duration, allow_modes: [CMCD_MODE_REQUEST] },
	{ key: CMCD_keys.deadline, allow_modes: [CMCD_MODE_REQUEST] },
	{ key: CMCD_keys.measured_throughput, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.next_object_request, allow_modes: [CMCD_MODE_REQUEST] },
	{ key: CMCD_keys.object_type, allow_modes: [CMCD_MODE_REQUEST] },
	{ key: CMCD_keys.playback_rate, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.requested_maximum_throughput, allow_modes: [CMCD_MODE_REQUEST] },
	{ key: CMCD_keys.streaming_format, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.session_id, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.stream_type, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.startup, allow_modes: [CMCD_MODE_REQUEST] },
	{ key: CMCD_keys.top_encoded_bitrate, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.CMCD_version, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.next_range_request, allow_modes: [CMCD_MODE_REQUEST] },
];

const isCustomKey = (key) => key.includes("-");
const reportingMode = (mode) => (mode.indexOf(":") != -1 ? mode.substring(mode.lastIndexOf(":") + 1) : "***");

function checkCMCDkeys(CMCDreport, errs, errCode) {
	if (!CMCDreport) {
		errs.addError({ type: APPLICATION, code: `${errCode}-00`, message: "checkCMCDkeys() called with CMCDreport=null" });
		return;
	}

	const keys_to_use = CMCDv1_keys;
	const keys = CMCDreport.attrAnyNs(dvbi.a_enabledKeys)?.value.split(" ");
	const reporting_mode = CMCDreport.attrAnyNs(dvbi.a_reportingMode) ? CMCDreport.attrAnyNs(dvbi.a_reportingMode).value : "undefined";
	if (keys)
		keys.forEach((key) => {
			const reserved_key = keys_to_use.find((e) => e.key == key);
			if (reserved_key) {
				if (!isIn(reserved_key.allow_modes, reporting_mode))
					errs.addError({
						code: `${errCode}a`,
						message: `${key.quote()} is not allowed for the specified reporting mode (${reportingMode(reporting_mode)})`,
						fragment: CMCDreport,
						key: keys.CMCD,
					});
			} else if (isCustomKey(key))
				errs.addError({
					type: WARNING,
					code: `${errCode}b`,
					message: `custom CMCD key ${key.quote()} in use`,
					fragment: CMCDreport,
					key: keys.CMCD,
				});
			else
				errs.addError({
					code: `${errCode}c`,
					message: `${key.quote()} is not a reserved CMCDv1 key or the correct format for a custom key`,
					fragment: CMCDreport,
					key: keys.CMCD,
				});
		});
}

function check_CMCD(CMCDelem, counts, errs, errCode) {
	if (isObjectEmpty(counts)) {
		counts[reportingMode(CMCD_MODE_REQUEST)] = 0;
	}

	const version = CMCDelem.attrAnyNs(dvbi.a_CMCDversion) ? CMCDelem.attrAnyNs(dvbi.a_CMCDversion).value : 1;
	if (version != 1) {
		errs.addError({
			code: `${errCode}`,
			message: `CMCDv${version} is not supported`,
			fragment: CMCDelem,
			key: keys.CMCD,
		});
		return;
	}

	let rep = 0,
		CMCDreport;
	while ((CMCDreport = CMCDelem.getAnyNs(dvbi.e_Report, ++rep)) != null) {
		const reporting_mode = CMCDreport.attrAnyNs(dvbi.a_reportingMode)?.value;
		switch (reporting_mode) {
			case CMCD_MODE_REQUEST:
				checkAttributes(
					CMCDreport,
					[dvbi.a_reportingMode, dvbi.a_transmissionMode, dvbi.a_reportingMethod],
					[dvbi.a_contentId, dvbi.a_enabledKeys, dvbi.a_probability],
					dvbiEA.CMCD,
					errs,
					`${errCode}-1`
				);
				break;
		}

		const enabledKeys = CMCDreport.attrAnyNs(dvbi.a_enabledKeys);
		if (enabledKeys) {
			const keys = enabledKeys.value.split(" ");
			if (!CMCDreport.attrAnyNs(dvbi.a_contentId) && isIn(keys, CMCD_keys.content_id))
				errs.addError({
					code: `${errCode}-11`,
					message: `${dvbi.a_contentId.attribute()} must be specified when ${dvbi.a_enabledKeys.attribute()} contains '${CMCD_keys.content_id}'`,
					fragment: CMCDreport,
					key: keys.CMCD,
				});
			else if (CMCDreport.attrAnyNs(dvbi.a_contentId) && !isIn(keys, CMCD_keys.content_id))
				errs.addError({
					type: WARNING,
					code: `${errCode}-12`,
					message: `${dvbi.a_contentId.attribute()} is specified but key '${CMCD_keys.content_id}' not requested for reporting`,
					fragment: CMCDreport,
					key: keys.CMCD,
				});
			checkCMCDkeys(CMCDreport, errs, `${errCode}-13`);
		}

		if (Object.prototype.hasOwnProperty.call(counts, reportingMode(reporting_mode))) {
			counts[reportingMode(reporting_mode)]++;
			if (counts[reportingMode(CMCD_MODE_REQUEST)] > 1)
				errs.addError({
					code: `${errCode}-20`,
					message: "only a single reporting configuration for Request Mode can be specified",
					fragment: CMCDelem,
					key: keys.CMCD,
				});
		}
	}
}

export function ValidateCMCDinDASH(DASHDeliveryParameters, errs, errCode) {
	let cc = 0,
		mode_counts = {}, // accumulator of each request type
		CMCDelem;
	while ((CMCDelem = DASHDeliveryParameters.getAnyNs(dvbi.e_CMCD, ++cc)) != null) check_CMCD(CMCDelem, mode_counts, errs, errCode);
}
