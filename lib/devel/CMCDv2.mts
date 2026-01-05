/**
 * CMCDv2.mts
 *
 * Definitions and check related to CMCD
 *
 */

/**
 * CMCDv2 schema update for A177
 * 
	<element name="CMCD" type="dvbisd:CMCDInitialisationType" minOccurs="0" maxOccurs="unbounded"/>

	<complexType name="CMCDInitialisationType">
		<sequence>
			<element name="Report" maxOccurs="unbounded">
				<complexType>
					<attribute name="reportingMode" use="required">
						<simpleType>
							<restriction base="string">
								<enumeration value="urn:dvb:metadata:cmcd:delivery:request">
									<annotation>
										<documentation>CMCD Request Reporting Mode</documentation>
									</annotation>
								</enumeration>
								<enumeration value="urn:dvb:metadata:cmcd:delivery:event">
									<annotation>
										<documentation>CMCD Event Reporting Mode</documentation>
									</annotation>
								</enumeration>
							</restriction>
						</simpleType>
					</attribute>
					<attribute name="eventURL" type="anyURI"/>
					<attribute name="transmissionMode" use="required">
						<simpleType>
							<restriction base="string">
								<enumeration value="urn:dvb:metadata:cmcd:delivery:customHTTPHeader"/>
								<enumeration value="urn:dvb:metadata:cmcd:delivery:queryArguments"/>
								<enumeration value="urn:dvb:metadata:cmcd:delivery:batch"/>
							</restriction>
						</simpleType>
					</attribute>
					<attribute name="batchSize" type="positiveInteger"/>
					<attribute name="reportingMethod" use="required">
						<simpleType>
							<list>
								<simpleType>
									<restriction base="string">
										<enumeration value="POST"/>
										<enumeration value="GET"/>
									</restriction>
								</simpleType>
							</list>
						</simpleType>
					</attribute>
					<attribute name="contentId">
						<simpleType>
							<restriction base="string">
								<maxLength value="128"/>
							</restriction>
						</simpleType>
					</attribute>
					<attribute name="enabledKeys" type="string"/>
					<attribute name="probability" default="1000">
						<simpleType>
							<restriction base="unsignedInt">
								<minInclusive value="1"/>
								<maxInclusive value="1000"/>
							</restriction>
						</simpleType>
					</attribute>
					<attribute name="obfuscateURL" type="boolean" default="true"/>
				</complexType>
			</element>
		</sequence>
		<attribute name="CMCDversion" use="required">
			<simpleType>
				<restriction base="unsignedInt">
					<minInclusive value="1"/>
					<maxInclusive value="2"/>
				</restriction>
			</simpleType>
		</attribute>
	</complexType>
 */

/**
 * CMCDv2 exmaple
 * 
	<DASHDeliveryParameters>
	  <UriBasedLocation contentType="application/dash+xml">
	    <dvbi-types:URI>http://123.123.123.123/manifest.mpd</dvbi-types:URI> 
	  </UriBasedLocation>
	  <CMCD CMCDversion="2"> 
	    <Report reportingMode="urn:dvb:metadata:cmcd:delivery:request"
	      transmissionMode="urn:dvb:metadata:cmcd:delivery:queryArguments"
	      reportingMethod="GET"
	      enabledKeys="cid sid br bl mtp bs su v"  
	      contentId="123-123-123-123"/>
	    <Report reportingMode="urn:dvb:metadata:cmcd:delivery:event"
	      transmissionMode="urn:dvb:metadata:cmcd:delivery:batch"
	      eventURL="https://somehost.net/CMCDreporting"
	      reportingMethod="POST"
	      enabledKeys="e ts cid sid br bl mtp bs su v"  
	      contentId="123-123-123-123"/>  
	    <Report reportingMode="urn:dvb:metadata:cmcd:delivery:event"
	      transmissionMode="urn:dvb:metadata:cmcd:delivery:batch"
	      eventURL="https://someotherhost.net/CMCDreporting"
	      batchSize="12"
	      reportingMethod="POST"
	      enabledKeys="e ts br bl cdn d ot pr sf sid sta df bs su v x-paul1"  
	      contentId="123-123-123-123"/>  
	  </CMCD>
	  <CMCD CMCDversion="2"> 
	    <Report reportingMode="urn:dvb:metadata:cmcd:delivery:event"
	      transmissionMode="urn:dvb:metadata:cmcd:delivery:batch"
	      reportingMethod="POST"
	      eventURL="https://v1host.net/CMCDreporting"
	      obfuscateURL="true"
	      enabledKeys="cid sid br bl mtp"  
	      contentId="123-123-123-123"/>
	  </CMCD>
	</DASHDeliveryParameters> 

 */

import { dvbi } from "./DVB-I_definitions.mjs";
import { CMCD_MODE_REQUEST, CMCD_MODE_EVENT, CMCD_METHOD_BATCH, dvbiEA } from "./DVB-I_definitions.mjs";
import { APPLICATION, WARNING } from "./error_list.mjs";
import { checkAttributes } from "./schema_checks.mjs";
import { isIn } from "./utils.mjs";
import { isObjectEmpty } from "../phlib/phlib.js";
import { isHTTPURL } from "../pattern_checks.mjs";
import { InvalidURL, keys } from "./common_errors.mjs";

const CMCD_keys = {
	aggregate_encoded_bitrate: "ab",
	buffer_length: "bl",
	backgrounded: "bg",
	encoded_bitrate: "br",
	buffer_starvation: "bs",
	buffer_starvation_duration: "bsd",
	custom_event_name: "cen",
	content_id: "cid",
	CMSD_dynamic_header: "cmsdd",
	CMSD_static_header: "cmsds",
	content_signature: "cs",
	object_duration: "d",
	dropped_frames: "df",
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
	SMRT_header: "smrt",
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

// CMCDv2 draft at https://docs.google.com/document/d/1isrbeAuauUwjTDUJCxJVltxls_qrFFx7/edit
const CMCDv2_keys = [
	{ key: CMCD_keys.aggregate_encoded_bitrate, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.buffer_length, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.backgrounded, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.encoded_bitrate, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.buffer_starvation, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.buffer_starvation_duration, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.custom_event_name, allow_modes: event_mode_only },
	{ key: CMCD_keys.content_id, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.CMSD_dynamic_header, allow_modes: event_mode_only },
	{ key: CMCD_keys.CMSD_static_header, allow_modes: event_mode_only },
	{ key: CMCD_keys.content_signature, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.object_duration, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.dropped_frames, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.deadline, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.event, allow_modes: event_mode_only },
	{ key: CMCD_keys.player_error_code, allow_modes: request_and_event_modes },
	{ key: CMCD_keys.hostname, allow_modes: request_and_event_modes },
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
	{ key: CMCD_keys.SMRT_header, allow_modes: event_mode_only },
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
	if (!CMCD) {
		errs.addError({ type: APPLICATION, code: `${errCode}-00`, message: "checkCMCDkeys() called with CMCD=null" });
		return;
	}
	const keys_to_use = version == 2 ? CMCDv2_keys : CMCDv1_keys;
	const configured_keys = Report.attrAnyNsValueOr(dvbi.a_enabledKeys, null);
	const reporting_mode = Report.attrAnyNsValueOr(dvbi.a_reportingMode, "undefined");
	const obfuscate_url = Report.attrAnyNs(dvbi.a_obfuscateURL);

	if (configured_keys && configured_keys.length) {
		let hasURL = false;
		configured_keys.split(" ").forEach((key) => {
			if (key == CMCD_keys.request_url) hasURL = true;
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
					message: `${key.quote()} is not a reserved CMCDv${version} key or the correct format for a custom key`,
					fragment: CMCD,
					key: error_key,
				});
		});
		if (obfuscate_url && obfuscate_url.value == "true" && !hasURL)
			errs.addError({
				type: WARNING,
				code: `${errCode}d`,
				message: `${dvbi.a_obfuscateURL.attribute()}="true" is only applicable when '${CMCD_keys.request_url}' is specified in ${dvbi.a_enabledKeys.attribute()}`,
			});
	}
	if (reporting_mode == CMCD_MODE_EVENT) {
		let required_key = (reporting_mode, key) => ({
			code: `${errCode}d`,
			message: `the key ${key.quote()} is required to be specified for ${reportingMode(reporting_mode)} reporting`,
			fragment: CMCD,
			key: error_key,
		});

		let unprovided_key = (report_type, key) => ({
			code: `${errCode}e`,
			message: `${reportingMode(report_type)} mode report will include "${key.quote()}" - it is not specified here`,
			fragment: CMCD,
			key: error_key,
		});
		if (!isIn(keys, CMCD_keys.timestamp)) errs.addError(required_key(reporting_mode, CMCD_keys.timestamp));
		if (!isIn(keys, CMCD_keys.event)) errs.addError(unprovided_key(reporting_mode, CMCD_keys.event));
	}
	if (version >= 2) {
		let missing_mandatory_key = (key) => ({
			code: `${errCode}f`,
			message: `key "${key}" is required in all reports since CMCDv2 and should be included`,
			fragment: CMCD,
			key: error_key,
			description: "All keys are OPTIONAL except for 'bs', 'su', and 'v' which are now required as of version 2.",
			clause: "CMCDv2 clause 4.2 item 8",
		});
		// CMCDv2 clause 4.2 item 8 says that "bs", "su" and "v" are mandatory
		if (!isIn(keys, CMCD_keys.buffer_starvation)) errs.addError(missing_mandatory_key(CMCD_keys.buffer_starvation));
		if (!isIn(keys, CMCD_keys.startup)) errs.addError(missing_mandatory_key(CMCD_keys.startup));
		if (!isIn(keys, CMCD_keys.CMCD_version)) errs.addError(missing_mandatory_key(CMCD_keys.CMCD_version));
	}
}

export function check_CMCD(CMCDelem, counts, errs, errCode) {
	if (isObjectEmpty(counts)) {
		counts[reportingMode(CMCD_MODE_REQUEST)] = counts[reportingMode(CMCD_MODE_EVENT)] = 0;
	}

	let CMCDversion = CMCDelem.attrAnyNsValueOr(dvbi.a_CMCDversion, null);
	if (CMCDversion && ![1, 2].includes(parseInt(CMCDversion)))
		// shouldn't happen as the value space is constrained in the schema
		errs.addError({
			code: `${errCode}-5`,
			message: `Only CMCD versions 1 and 2 are supported, got (${CMCDversion})`,
			fragment: CMCDelem,
			key: error_key,
		});
	CMCDversion = parseInt(CMCDversion);

	let rep = 0,
		Report;
	while ((Report = CMCDelem.getAnyNs(dvbi.e_Report, rep++)) != null) {
		const reporting_mode = Report.attrAnyNsValueOr(dvbi.a_reportingMode, null);
		const transmission_mode = Report.attrAnyNsValueOr(dvbi.a_transmissionMode, null);
		const reporting_method = Report.attrAnyNsValueOr(dvbi.a_reportingMethod, null);
		switch (reporting_mode) {
			case CMCD_MODE_REQUEST:
				checkAttributes(
					Report,
					[dvbi.a_CMCDversion, dvbi.a_reportingMode, dvbi.a_transmissionMode, dvbi.a_reportingMethod],
					[dvbi.a_contentId, dvbi.a_enabledKeys, dvbi.a_probability],
					dvbiEA.CMCD,
					errs,
					`${errCode}-1a`
				);
				if (transmission_mode && ![CMCD_METHOD_HTTP_HEADER, CMCD_METHOD_QUERY_ARGUMENT].includes(transmission_mode))
					errs.addError({
						code: `${errCode}-1b`,
						message: `only request header and query parameter methods are permitted for request based reporting`,
						fragment: Report,
						key: error_key,
						description: "The client attaches CMCD data to each media object request, using either query arguments or request headers.",
						clause: "CMCDv2 clause 2.1",
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
				break;
			case CMCD_MODE_EVENT:
				checkAttributes(
					Report,
					[dvbi.a_CMCDversion, dvbi.a_reportingMode, dvbi.a_transmissionMode, dvbi.a_reportingMethod, dvbi.a_beaconURL],
					[dvbi.a_contentId, dvbi.a_enabledKeys, dvbi.a_probability, dvbi.a_interval],
					dvbiEA.CMCD,
					errs,
					`${errCode}-2a`
				);
				if (Report.attrAnyNs(dvbi.a_eventURL)) {
					if (!isHTTPURL(Report.attrAnyNs(dvbi.a_eventURL).value))
						errs.addError(InvalidURL(Report.attrAnyNs(dvbi.a_eventURL).value, Report, dvbi.a_eventURL.attribute(), `${errCode}-2b`));
				} else
					errs.addError({
						code: `${errCode}-2c`,
						message: `${dvbi.a_eventURL.attribute()} must be specified for event reporting mode`,
						fragment: Report,
						key: error_key,
					});
				break;
		}
		if (transmission_mode == CMCD_METHOD_BATCH && reporting_method != "POST")
			errs.addError({
				code: `${errCode}-3`,
				message: `${dvbi.a_reportingMethod.attribute()} must be POST for batch reporting`,
				fragment: Report,
				key: error_key,
				description: "Batch payloads MUST be transmitted using an HTTP POST request in which the batch object forms the body of the request.",
				clause: "CMCDv2 clause 3.3",
			});

		const enabledKeys = Report.attrAnyNsValueOr(dvbi.a_enabledKeys, null);
		if (enabledKeys) {
			const keys = enabledKeys.split(" ");
			if (!Report.attrAnyNs(dvbi.a_contentId) && isIn(keys, CMCD_keys.content_id))
				errs.addError({
					code: `${errCode}-11`,
					message: `${dvbi.a_contentId.attribute()} must be specified when ${dvbi.a_enabledKeys.attribute()} contains '${CMCD_keys.content_id}'`,
					fragment: Report,
					key: error_key,
				});
			else if (Report.attrAnyNs(dvbi.a_contentId) && !isIn(keys, CMCD_keys.content_id))
				errs.addError({
					type: WARNING,
					code: `${errCode}-12`,
					message: `${dvbi.a_contentId.attribute()} is specified but key '${CMCD_keys.content_id}' not requested for reporting`,
					fragment: Report,
					key: error_key,
				});
			const contentId = Report.attrAnyNsValueOr(dvbi.a_contentId, null);
			if (contentId) {
				let contentIdLengthError = (_errCode, version, maxLen, foundLen) => ({
					code: _errCode,
					message: `length of ${dvbi.a_contentId.atribute(CMCDelem.name)} must be less than or equal to ${maxLen} (counted ${foundLen}) for CMCDv${version}`,
					fragment: CMCDelem,
					key: error_key,
				});
				switch (CMCDversion) {
					case 1:
						if (contentId.length > 64) {
							errs.addError(contentIdLengthError(`${errCode}-18a`, CMCDversion, 64, contentId.length));
							errs.errorDescription({
								code: `${errCode}-18a`,
								clause: "CTA-5004 Table 1",
								reference: "https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf",
								description: "A unique string identifying the current content. Maximum length is 64 characters.",
							});
						}
						break;
					case NaN:
						break;
					default:
						// should not happen as the schema supporting CMCDv2 constrains the maximum length to 128 characters.
						if (contentId.length > 128) {
							errs.addError(contentIdLengthError(`${errCode}-18b`, CMCDversion, 128, contentId.length));
							errs.errorDescription({
								code: `${errCode}-18b`,
								clause: "draft CMCDv2 Table 1",
								reference: "https://docs.google.com/document/d/1isrbeAuauUwjTDUJCxJVltxls_qrFFx7/edit",
								description: "A unique string identifying the current content. Maximum length is 128 characters.",
							});
						}
						break;
				}
			}
			checkCMCDkeys(Report, CMCDversion, errs, `${errCode}-13`);
		}
	}

	if (Object.prototype.hasOwnProperty.call(counts, reportingMode(reporting_mode))) {
		counts[reportingMode(reporting_mode)]++;
		if (counts[reportingMode(CMCD_MODE_REQUEST)] > 1)
			errs.addError({
				code: `${errCode}-20`,
				message: "only a single reporting configuration for Request Mode can be specified",
				fragment: CMCDelem,
				key: error_key,
			});
	}
}
