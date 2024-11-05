/**
 * CMCD.js
 *
 * Definitions related to CMCD
 *
 */

import { APPLICATION } from "./error_list.js";
import { isIn } from "./utils.js";

export const CMCD_keys = {
	encoded_bitrate: "br",
	buffer_length: "bl",
	buffer_starvation: "bs",
	content_id: "cid",
	object_duration: "d",
	deadline: "dl",
	measured_throughput: "mtp",
	next_object_request: "nor",
	next_range_request: "nrr",
	object_type: "ot",
	playback_rate: "pr",
	requested_maximum_throughput: "rtp",
	streaming_format: "sf",
	session_id: "sid",
	stream_type: "st",
	startup: "su",
	top_bitrate: "tb",
	cmcd_version: "v",
};

const CMCDv1_keys = [
	CMCD_keys.encoded_bitrate,
	CMCD_keys.buffer_length,
	CMCD_keys.buffer_starvation,
	CMCD_keys.content_id,
	CMCD_keys.object_duration,
	CMCD_keys.deadline,
	CMCD_keys.measured_throughput,
	CMCD_keys.next_object_request,
	CMCD_keys.next_range_request,
	CMCD_keys.object_type,
	CMCD_keys.playback_rate,
	CMCD_keys.requested_maximum_throughput,
	CMCD_keys.streaming_format,
	CMCD_keys.session_id,
	CMCD_keys.stream_type,
	CMCD_keys.startup,
	CMCD_keys.top_bitrate,
	CMCD_keys.cmcd_version,
];

const isCustomKey = (key) => key.includes("-");

export function checkCMCDkeys(keysAttr, errs, errCode) {
	if (!keysAttr) {
		errs.addError({ type: APPLICATION, code: `${errCode}-00`, message: "checkCMCDkeys() called with extn=null" });
		return;
	}
	const keys = keysAttr.value().split(" ");
	keys.forEach((key) => {
		if (!isIn(CMCDv1_keys, key)) {
			if (!isCustomKey(key))
				errs.addError({
					code: `${errCode}-01`,
					message: `${key.quote()} is not a reserved key or the correct format for a custom key`,
					fragment: keysAttr.node(),
				});
		}
	});
}
