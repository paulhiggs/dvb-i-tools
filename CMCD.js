/**
 * CMCD.js
 *
 * Definitions and check related to CMCD
 *
 */

import { dvbi } from "./DVB-I_definitions.js";
import { CMCD_MODE_REQUEST, CMCD_MODE_RESPONSE, CMCD_MODE_INTERVAL } from "./DVB-I_definitions.js";
import { APPLICATION, WARNING } from "./error_list.js";
import { isIn } from "./utils.js";

const CMCD_VERSION = 1;

const CMCD_keys = {
	encoded_bitrate: "br",
	buffer_length: "bl",
	buffer_starvation: "bs",
	buffer_starvation_duration: "bsd",
	cdn_id: "cdn",
	content_id: "cid",
	object_duration: "d",
	deadline: "dl",
	live_stream_latency: "ltc",
	measured_throughput: "mtp",
	next_object_request: "nor",
	next_range_request: "nrr",
	object_type: "ot",
	playback_rate: "pr",
	requested_maximum_throughput: "rtp",
	response_code: "rc",
	streaming_format: "sf",
	session_id: "sid",
	interstitial: "int",
	state: "sta",
	stream_type: "st",
	startup: "su",
	time_to_first_byte: "ttfb",
	time_to_first_body_byte: "ttfbb",
	time_to_last_byte: "ttlb",
	timestamp: "ts",
	top_encoded_bitrate: "tb",
	lowest_encoded_bitrate: "lb",
	top_aggregated_encoded_bitrate: "tab",
	lowest_aggregated_encoded_bitrate: "lab",
	request_url: "url",
	playhead_position: "pp",
	player_error_code: "ec",
	media_start_delay: "msd",
	event: "e",
	cmcd_version: "v",
};

const all_reporting_modes = [CMCD_MODE_REQUEST, CMCD_MODE_RESPONSE, CMCD_MODE_INTERVAL];
const CMCDv1_keys = [
	{ key: CMCD_keys.encoded_bitrate, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.buffer_length, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.buffer_starvation, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.content_id, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.object_duration, allow_modes: [CMCD_MODE_REQUEST, CMCD_MODE_RESPONSE] },
	{ key: CMCD_keys.deadline, allow_modes: [CMCD_MODE_REQUEST, CMCD_MODE_RESPONSE] },
	{ key: CMCD_keys.measured_throughput, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.next_object_request, allow_modes: [CMCD_MODE_REQUEST, CMCD_MODE_RESPONSE] },
	{ key: CMCD_keys.next_range_request, allow_modes: [CMCD_MODE_REQUEST, CMCD_MODE_RESPONSE] },
	{ key: CMCD_keys.object_type, allow_modes: [CMCD_MODE_REQUEST, CMCD_MODE_RESPONSE] },
	{ key: CMCD_keys.playback_rate, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.requested_maximum_throughput, allow_modes: [CMCD_MODE_REQUEST, CMCD_MODE_RESPONSE] },
	{ key: CMCD_keys.streaming_format, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.session_id, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.stream_type, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.startup, allow_modes: [CMCD_MODE_REQUEST, CMCD_MODE_RESPONSE] },
	{ key: CMCD_keys.top_encoded_bitrate, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.cmcd_version, allow_modes: all_reporting_modes },
];

const CMCDv2_keys = CMCDv1_keys.concat([
	{ key: CMCD_keys.buffer_starvation_duration, allow_modes: [CMCD_MODE_REQUEST, CMCD_MODE_RESPONSE] },
	{ key: CMCD_keys.cdn_id, allow_modes: all_reporting_modes },
	{ ley: CMCD_keys.live_stream_latency, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.response_code, allow_modes: [CMCD_MODE_RESPONSE] },
	{ key: CMCD_keys.interstitial, allow_modes: [CMCD_MODE_REQUEST, CMCD_MODE_RESPONSE] },
	{ key: CMCD_keys.state, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.time_to_first_byte, allow_modes: [CMCD_MODE_RESPONSE] },
	{ key: CMCD_keys.time_to_first_body_byte, allow_modes: [CMCD_MODE_RESPONSE] },
	{ key: CMCD_keys.time_to_last_byte, allow_modes: [CMCD_MODE_RESPONSE] },
	{ key: CMCD_keys.timestamp, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.lowest_encoded_bitrate, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.top_aggregated_encoded_bitrate, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.lowest_aggregated_encoded_bitrate, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.request_url, allow_modes: [CMCD_MODE_RESPONSE] },
	{ key: CMCD_keys.playhead_position, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.player_error_code, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.media_start_delay, allow_modes: all_reporting_modes },
	{ key: CMCD_keys.event, allow_modes: all_reporting_modes },
]);

const isCustomKey = (key) => key.includes("-");
const reportingMode = (mode) => (mode.includes(":") ? mode.substring(mode.lastIndexOf(":") + 1) : "***");

const error_key = "CMCD";
const keys_to_use = CMCD_VERSION == 2 ? CMCDv2_keys : CMCDv1_keys;

function checkCMCDkeys(CMCD, errs, errCode) {
	if (!CMCD) {
		errs.addError({ type: APPLICATION, code: `${errCode}-00`, message: "checkCMCDkeys() called with CMCD=null" });
		return;
	}
	const keys = CMCD.attr(dvbi.a_enabledKeys)?.value().split(" ");
	const reporting_mode = CMCD.attr(dvbi.a_reportingMode)?.value() | "undefined";
	if (keys) {
		keys.forEach((key) => {
			const reserved_key = keys_to_use.find((e) => e.key == key);
			if (reserved_key) {
				if (!isIn(reserved_key.allow_modes, reporting_mode))
					errs.addError({
						code: `${errCode}a`,
						message: `${key.quote()} is not allowed for the specified reporting mode (${reportingMode(reporting_mode)})`,
						fragment: CMCD,
						key: error_key,
					});
			} else if (isCustomKey(key))
				errs.addError({
					type: WARNING,
					code: `${errCode}b`,
					message: `custom CMCD key ${key.quote()} in use`,
					fragment: CMCD,
					key: error_key,
				});
			else
				errs.addError({
					code: `${errCode}c`,
					message: `${key.quote()} is not a reserved CMCDv${CMCD_VERSION} key or the correct format for a custom key`,
					fragment: CMCD,
					key: error_key,
				});
		});
	}
	if (reporting_mode == CMCD_MODE_INTERVAL && !isIn(keys, CMCD_keys.timestamp))
		errs.addError({
			code: `${errCode}d`,
			message: `the key ${CMCD_keys.timestamp.quote()} is required to be specified for ${reportingMode(reporting_mode)} reporting`,
			fragment: CMCD,
			key: error_key,
		});

	let unprovided_key = (report_type, key) => ({
		code: `${errCode}e`,
		message: `${report_type} mode report will include "${key}" - it is not specified here`,
		fragment: CMCD,
		key: error_key,
	});

	if (reporting_mode == CMCD_MODE_RESPONSE) {
		if (!isIn(keys, CMCD_keys.request_url)) errs.addError(unprovided_key("response", CMCD_keys.request_url));
		if (!isIn(keys, CMCD_keys.timestamp)) errs.addError(unprovided_key("response", CMCD_keys.timestamp));
	} else if (reporting_mode == CMCD_MODE_INTERVAL) {
		if (!isIn(keys, CMCD_keys.timestamp)) errs.addError(unprovided_key("interval", CMCD_keys.timestamp));
	}
}

export function check_CMCD(CMCDelem, errs, errCode) {
	const enabledKeys = CMCDelem.attr(dvbi.a_enabledKeys);
	if (enabledKeys) {
		const keys = enabledKeys.value().split(" ");
		if (!CMCDelem.attr(dvbi.a_contentId) && isIn(keys, CMCD_keys.content_id))
			errs.addError({
				code: `${errCode}-1`,
				message: `${dvbi.a_contentId.attribute()} must be specified when ${dvbi.a_enabledKeys.attribute()} contains '${CMCD_keys.content_id}'`,
				fragment: CMCDelem,
				key: error_key,
			});
		else if (CMCDelem.attr(dvbi.a_contentId) && !isIn(keys, CMCD_keys.content_id))
			errs.addError({
				type: WARNING,
				code: `${errCode}-2`,
				message: `${dvbi.a_contentId.attribute()} is specified by key '${CMCD_keys.content_id}' not requested for reporting`,
				fragment: CMCDelem,
				key: error_key,
			});
		checkCMCDkeys(CMCDelem, errs, `${errCode}-3`);
	}
	/* TODO
		if (CMCD_VERSION == 2) {
			const reporting_mode = CMCDelem.attr(dvbi.a_reportingMode)?.value();
			if (reporting_mode == CMCD_MODE_REQUEST) {
				// there should be an @beaconURL attribute for reporting
			}
			if (reporting_mode == CMCD_MODE_INTERVAL) {
				// there should be an @beaconURL attribute for reporting, there may be an @interval attribute for batch size
			}
		}
*/
}
