// test regular expressions

import { doTest } from "./expression_test_common.mjs";

import {
	e_IPv6Address,
	e_IPv4Address,
	isDVBLocator,
	isPostcode,
	isWildcardPostcode,
	validExtensionName,
	validFrameRate,
	isISODuration,
	isURL,
	isURN,
	isHTTPURL,
	validZuluTimeType,
	isUTCDateTime,
} from "../../../lib/pattern_checks.mjs";

import {isTAGURI} from "../../../lib/URI_checks.mjs";

const AVCregex = /[a-z0-9!"#$%&'()*+,./:;<=>?@[\] ^_`{|}~-]{4}\.[a-f0-9]{6}/i;
const AC4regex = /ac-4(\.[a-fA-F\d]{1,2}){3}/;
const VP9regex = /^vp09(\.\d{2}){3}(\.(\d{2})?){0,5}$/;
const AV1regex = /^av01\.\d\.\d+[MH]\.\d{1,2}((\.\d?)(\.(\d{3})?(\.(\d{2})?(.(\d{2})?(.(\d{2})?(.\d?)?)?)?)?)?)?$/;

const tests0 = [
	{ item: "v6-001", pattern: e_IPv6Address, evaluate: "1:2:3:4:5:6:7:8", expect: true },
	{ item: "v6-002", pattern: e_IPv6Address, evaluate: "1::", expect: true },
	{ item: "v6-003", pattern: e_IPv6Address, evaluate: "1:2:3:4:5:6:7::", expect: true },
	{ item: "v6-004", pattern: e_IPv6Address, evaluate: "1::8", expect: true },
	{ item: "v6-005", pattern: e_IPv6Address, evaluate: "1:2:3:4:5:6::8", expect: true },
	{ item: "v6-006", pattern: e_IPv6Address, evaluate: "1::7:8", expect: true },
	{ item: "v6-007", pattern: e_IPv6Address, evaluate: "1:2:3:4:5::7:8", expect: true },
	{ item: "v6-008", pattern: e_IPv6Address, evaluate: "1:2:3:4:5::8", expect: true },
	{ item: "v6-009", pattern: e_IPv6Address, evaluate: "1::6:7:8", expect: true },
	{ item: "v6-010", pattern: e_IPv6Address, evaluate: "1:2:3:4::6:7:8", expect: true },
	{ item: "v6-011", pattern: e_IPv6Address, evaluate: "1:2:3:4::8", expect: true },
	{ item: "v6-012", pattern: e_IPv6Address, evaluate: "1::5:6:7:8", expect: true },
	{ item: "v6-013", pattern: e_IPv6Address, evaluate: "1:2:3::5:6:7:8", expect: true },
	{ item: "v6-014", pattern: e_IPv6Address, evaluate: "1:2:3::8", expect: true },
	{ item: "v6-015", pattern: e_IPv6Address, evaluate: "1::4:5:6:7:8", expect: true },
	{ item: "v6-016", pattern: e_IPv6Address, evaluate: "1:2::4:5:6:7:8", expect: true },
	{ item: "v6-017", pattern: e_IPv6Address, evaluate: "1:2::8", expect: true },
	{ item: "v6-018", pattern: e_IPv6Address, evaluate: "1::3:4:5:6:7:8", expect: true },
	{ item: "v6-019", pattern: e_IPv6Address, evaluate: "1::8", expect: true },
	{ item: "v6-020", pattern: e_IPv6Address, evaluate: "::2:3:4:5:6:7:8", expect: true },
	{ item: "v6-021", pattern: e_IPv6Address, evaluate: "::8", expect: true },
	{ item: "v6-021", pattern: e_IPv6Address, evaluate: "::", expect: true },
	{ item: "v6-022", pattern: e_IPv6Address, evaluate: "fe08::7:8%eth0", expect: true },
	{ item: "v6-023", pattern: e_IPv6Address, evaluate: "fe08::7:8%1", expect: true },
	{ item: "v6-024", pattern: e_IPv6Address, evaluate: "::255.255.255.255", expect: true },
	{ item: "v6-025", pattern: e_IPv6Address, evaluate: "::ffff:255.255.255.255", expect: true },
	{ item: "v6-026", pattern: e_IPv6Address, evaluate: "2001:db8:3:4::192.0.2.33", expect: true },
	{ item: "v6-027", pattern: e_IPv6Address, evaluate: "64:ff9b::192.0.2.3", expect: true },

	{ item: "v6-028", pattern: e_IPv6Address, evaluate: "::ffff:10.0.0.1", expect: true },
	{ item: "v6-029", pattern: e_IPv6Address, evaluate: "::ffff:1.2.3.4", expect: true },
	{ item: "v6-030", pattern: e_IPv6Address, evaluate: "::ffff:0.0.0.0", expect: true },
	{ item: "v6-031", pattern: e_IPv6Address, evaluate: "1:2:3:4:5:6:77:88", expect: true },
	{ item: "v6-032", pattern: e_IPv6Address, evaluate: "fe08::7:8", expect: true },
	{ item: "v6-033", pattern: e_IPv6Address, evaluate: "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", expect: true },

	{ item: "v6-101", pattern: e_IPv6Address, evaluate: "::ffff:0:255.255.255.255", expect: false },
	{ item: "v6-101", pattern: e_IPv6Address, evaluate: "1:2:3:4:5:6:7:8:9", expect: false },
	{ item: "v6-101", pattern: e_IPv6Address, evaluate: "1:2:3:4:5:6::7:8", expect: false },
	{ item: "v6-101", pattern: e_IPv6Address, evaluate: ":1:2:3:4:5:6:7:8", expect: false },
	{ item: "v6-101", pattern: e_IPv6Address, evaluate: "1:2:3:4:5:6:7:8:", expect: false },
	{ item: "v6-101", pattern: e_IPv6Address, evaluate: "::1:2:3:4:5:6:7:8", expect: false },
	{ item: "v6-101", pattern: e_IPv6Address, evaluate: "1:2:3:4:5:6:7:8::", expect: false },
	{ item: "v6-101", pattern: e_IPv6Address, evaluate: "1:2:3:4:5:6:7:88888", expect: false },
	{ item: "v6-101", pattern: e_IPv6Address, evaluate: "2001:db8:3:4:5::192.0.2.33", expect: false },
	{ item: "v6-101", pattern: e_IPv6Address, evaluate: "fe08::7:8%", expect: false },
	{ item: "v6-101", pattern: e_IPv6Address, evaluate: "fe08::7:8i", expect: false },
	{ item: "v6-101", pattern: e_IPv6Address, evaluate: "fe08::7:8interface", expect: false },

	{ item: "v4-001", pattern: e_IPv4Address, evaluate: "1:2:3:4:5:6:7:8", expect: false },
	{ item: "v4-002", pattern: e_IPv4Address, evaluate: "64:ff9b::192.0.2.3", expect: false },
	{ item: "v4-003", pattern: e_IPv4Address, evaluate: "192.0.2.3", expect: true },
	{ item: "v4-004", pattern: e_IPv4Address, evaluate: "192..2.3", expect: false },
	{ item: "v4-005", pattern: e_IPv4Address, evaluate: "192.0", expect: false },
	{ item: "v4-006", pattern: e_IPv4Address, evaluate: "127.0.0.1", expect: true },
	{ item: "v4-007", pattern: e_IPv4Address, evaluate: "292.168.0.1", expect: false },
	{ item: "v4-008", pattern: e_IPv4Address, evaluate: "10002.3.4", expect: false },
	{ item: "v4-009", pattern: e_IPv4Address, evaluate: "1.2.3.4.5", expect: false },
	{ item: "v4-010", pattern: e_IPv4Address, evaluate: "256.0.0.0", expect: false },
	{ item: "v4-011", pattern: e_IPv4Address, evaluate: "260.0.0.0", expect: false },
	{ item: "v4-012", pattern: e_IPv4Address, evaluate: "10.0.0.1", expect: true },
	{ item: "v4-013", pattern: e_IPv4Address, evaluate: "192.168.1.1", expect: true },
	{ item: "v4-014", pattern: e_IPv4Address, evaluate: "0.0.0.0", expect: true },
	{ item: "v4-015", pattern: e_IPv4Address, evaluate: "255.255.255.255", expect: true },

	{ item: "dvbloc-01", fn: isDVBLocator, evaluate: "dvb://aa.bb.cc", expect: false },
	{ item: "dvbloc-01", fn: isDVBLocator, evaluate: "dvb://a0a.1bb.cc2;12d", expect: true },

	{ item: "post-01", fn: isPostcode, evaluate: "RG4 5HJ", expect: true },
	{ item: "post-02", fn: isPostcode, evaluate: "rg4 5hj", expect: true },
	{ item: "post-03", fn: isPostcode, evaluate: "30324", expect: true },
	{ item: "post-04", fn: isPostcode, evaluate: "90210", expect: true },

	{ item: "post-11", fn: isWildcardPostcode, evaluate: "W12 7TQ", expect: false },
	{ item: "post-12", fn: isWildcardPostcode, evaluate: "W12-7TQ", expect: false },
	{ item: "post-13", fn: isWildcardPostcode, evaluate: "*12-7TQ", expect: true },
	{ item: "post-14", fn: isWildcardPostcode, evaluate: "W12-*", expect: true },
	{ item: "post-15", fn: isWildcardPostcode, evaluate: "300*", expect: true },
	{ item: "post-16", fn: isWildcardPostcode, evaluate: "9*0", expect: true },
	{ item: "post-17", fn: isWildcardPostcode, evaluate: "9**0", expect: false },
	{ item: "post-18", fn: isWildcardPostcode, evaluate: "9*-*0", expect: false },

	{ item: "extn-11", fn: validExtensionName, evaluate: "HBBTV", expect: true },
	{ item: "extn-12", fn: validExtensionName, evaluate: "DVB-HB", expect: true },
	{ item: "extn-13", fn: validExtensionName, evaluate: "HBB.TV", expect: true },
	{ item: "extn-14", fn: validExtensionName, evaluate: "@HBBTV", expect: false },

	{ item: "fr-11", fn: validFrameRate, evaluate: "120", expect: true },
	{ item: "fr-12", fn: validFrameRate, evaluate: "59.96", expect: true },
	{ item: "fr-13", fn: validFrameRate, evaluate: "120/1.001", expect: true },

	{ item: "url-01", fn: isURL, evaluate: "http://github.com/", expect: true },
	{ item: "url-02", fn: isURL, evaluate: "https://github.com/", expect: true },
	{ item: "url-03", fn: isURL, evaluate: "mailto:someone@mycompany.com", expect: true },
	{ item: "url-04a", fn: isURL, evaluate: "mailto:someone@yoursite.com?subject=Mail from Our Site", expect: false },
	{ item: "url-04b", fn: isURL, evaluate: "mailto:someone@yoursite.com?subject=Mail%20from%20Our%20Site", expect: true },
	{
		item: "url-05a",
		fn: isURL,
		evaluate: "mailto:someone@yoursite.com?cc=someoneelse@theirsite.com, another@thatsite.com, me@mysite.com&bcc=lastperson@theirsite.com&subject=Big%20News",
		expect: false,
	},
	{
		item: "url-05b",
		fn: isURL,
		evaluate:  "mailto:someone@yoursite.com?cc=someoneelse@theirsite.com,%20another@thatsite.com,%20me@mysite.com&bcc=lastperson@theirsite.com&subject=Big%20News",
		expect: true,
	},
	{
		item: "url-06a",
		fn: isURL,
		evaluate: "mailto:someone@yoursite.com?cc=someoneelse@theirsite.com, another@thatsite.com, me@mysite.com&bcc=lastperson@theirsite.com&subject=Big%20News&body=Body-goes-here",
		expect: false,
	},
	{
		item: "url-06b",
		fn: isURL,
		evaluate: 	"mailto:someone@yoursite.com?cc=someoneelse@theirsite.com,%20another@thatsite.com,%20me@mysite.com&bcc=lastperson@theirsite.com&subject=Big%20News&body=Body-goes-here",
		expect: true,
	},

	{ item: "http-01", fn: isHTTPURL, evaluate: "http://github.com/", expect: true },
	{ item: "http-02", fn: isHTTPURL, evaluate: "https://github.com/", expect: true },
	{ item: "http-03", fn: isHTTPURL, evaluate: "http://where.co.uk/dvb-i/serviceList.php?id=331", expect: true },

	{ item: "urn-01", fn: isURN, evaluate: "urn:mpeg:mpeg7:cs:AudioPresentationCS:2001:2", expect: true },

	{ item: "dur-01", fn: isISODuration, evaluate: "PT1H", expect: true },
	{ item: "dur-02", fn: isISODuration, evaluate: "PT1H00M00S", expect: true },
	{ item: "dur-03", fn: isISODuration, evaluate: "PT45M", expect: true },
	{ item: "dur-04", fn: isISODuration, evaluate: "PT1H16.3S", expect: true },
	{ item: "dur-05", fn: isISODuration, evaluate: "+PT1H16.3S", expect: true },
	{ item: "dur-06", fn: isISODuration, evaluate: "-PT1H16.3S", expect: true },
	{ item: "dur-07", fn: isISODuration, evaluate: "P3Y6M4DT12H30M5S", expect: true },
	{ item: "dur-08", fn: isISODuration, evaluate: "P+3Y6M4DT12H30M5S", expect: true },
	{ item: "dur-09", fn: isISODuration, evaluate: "P-3Y6M4DT12H30M5S", expect: true },

	{ item: "dur-30", fn: isISODuration, evaluate: "P3MT", expect: false },
	{ item: "dur-31", fn: isISODuration, evaluate: "PT", expect: false },
	{ item: "dur-32", fn: isISODuration, evaluate: "P", expect: false },
	{ item: "dur-33", fn: isISODuration, evaluate: "P3MT", expect: false },

	{ item: "ztime-01", fn: validZuluTimeType, evaluate: "09:30Z", expect: false }, // seconds are required in DVB-I
	{ item: "ztime-02", fn: validZuluTimeType, evaluate: "14:55:15Z", expect: true },
	{ item: "ztime-03", fn: validZuluTimeType, evaluate: "14:55:15.124Z", expect: true },

	{ item: "ztime-51", fn: validZuluTimeType, evaluate: "24:00:00Z", expect: false },
	{ item: "ztime-52", fn: validZuluTimeType, evaluate: "09:30-05:00", expect: false },
	{ item: "ztime-53", fn: validZuluTimeType, evaluate: "09:30+08:30", expect: false },
	{ item: "ztime-54", fn: validZuluTimeType, evaluate: "09:30+12", expect: false },

	{item: "ztime-55", fn:isUTCDateTime, evaluate: "2024-08-20T12:45:15.000Z", expect: true},
	{item: "ztime-56", fn:isUTCDateTime, evaluate: "2024-08-20T12:45:15Z", expect: true},
	{item: "ztime-57", fn:isUTCDateTime, evaluate: "2014-07-15T20:42:30Z", expect: true},

	{item: "taguri-1", fn: isTAGURI, evaluate: "tag:sandt.com:uk,2023:SandT‑Service‑1", expect: false},
	{item: "taguri-2", fn: isTAGURI, evaluate: "tag:sandt.com.uk,2023:SandT‑Service‑1", expect: false},
	{item: "taguri-3", fn: isTAGURI, evaluate: "tag:sandt.com.uk,2023:SandT-Service-1", expect: true},
	{item: "taguri-4", fn: isTAGURI, evaluate: "tag:sandt.com.uk,2023:SandT‑Service‑1‑The Legend of Boggy Creek (1972)", expect: false},
	{item: "taguri-5", fn: isTAGURI, evaluate: "tag:sandt.com.uk,2023:SandT-Service-1-The%20Legend%20of%20Boggy%20Creek%20(1972)", expect: true},
];

const tests1 = [
	{item: "AVC regexp1", expression: AVCregex, evaluate: "avc1.001122", expect: true },
	{item: "AC-4 regexp1", expression: AC4regex, evaluate: "ac-4.00.11.22", expect: true },
	{item: "VP9 regex1", expression: VP9regex, evaluate: "vp09.00.11.22", expect: true },
	{item: "VP9 regex2", expression: VP9regex, evaluate: "vp09.00.11.22..12.03..", expect: true },
	{item: "AV1 regex1", expression: AV1regex, evaluate: "av01.0.04M.10.0.112.09.16.09.0", expect:true },
	{item: "AV1 regex2", expression: AV1regex, evaluate: "av01.0.04M.12", expect:true },
	{item: "AV1 regex3", expression: AV1regex, evaluate: "av01.0.04H.8..112....0", expect:true },
];


tests0.forEach((test) => doTest(test));
tests1.forEach((test) => doTest(test));

