/**
 * utils.mjs
 *
 * some useful utility functions that may be used by more than one class
 */
import { statSync, readFileSync } from "fs";
import chalk from "chalk";
import { XmlElement } from 'libxml2-wasm';

import { datatypeIs } from "../phlib/phlib.js";

import { Array_extension_init } from "./Array-extensions.mjs";
Array_extension_init();

/**
 * constructs an XPath based on the provided arguments
 *
 * @param {String}  SCHEMA_PREFIX   Used when constructing Xpath queries
 * @param {String}  elementName     The name of the element to be searched for
 * @param {integer} index           The instance of the named element to be searched for (if specified)
 * @returns {String}  the XPath selector
 */
export let xPath = (SCHEMA_PREFIX, elementName, index = null) => `${SCHEMA_PREFIX}:${elementName}${index ? `[${index}]` : ""}`;

/**
 * constructs an XPath based on the provided arguments
 *
 * @param {String} SCHEMA_PREFIX    Used when constructing Xpath queries
 * @param {Array}  elementNames     the name of the elements to be included in the XPath query
 * @returns {String} the XPath selector
 */
export let xPathM = (SCHEMA_PREFIX, elementNames) => datatypeIs(elementNames, "array") ? `${SCHEMA_PREFIX}:${elementNames.join(`/${SCHEMA_PREFIX}:`)}` : xPath(SCHEMA_PREFIX, elementNames);

/* local */
let getFirstElementByTagName = (element, childElementName) => element.childNodes().find((c) => (c instanceof XmlElement) && c.name == childElementName);

/**
 * Finds the first named child element
 *
 * @param {XmlElement} element           The containing parent element
 * @param {String}    childElementName   The name of the child element to find
 * @returns {XmlElement} the named child element or undefined if not present
 */
export function getElementByTagName(element, childElementName, index = null) {
	switch (datatypeIs(childElementName)) {
		case "string":
			if (!index) return getFirstElementByTagName(element, childElementName);

			let cnt = 0;
			const ch1 = element.childNodes();
			for (let i = 0; i < ch1.length; i++) {
				if ((ch1[i] instanceof XmlElement) && ch1[i].name == childElementName) cnt++;
				if (cnt >= index) return ch1[i];
			}
			break;
		case "array":
			if (index) return undefined; // cant use index with list of elements
			let ch = element;
			for (let i = 0; ch && i < childElementName.length; i++) ch = getFirstElementByTagName(ch, childElementName[i]);
			return ch;
			break; // eslint-disable-line no-unreachable
	}
	return undefined;
}

/* local */
let findInSet = (values, value, caseSensitive) => {
	if (!values || !value || !datatypeIs(value, "string")) return false;
	const vlc = value.toLowerCase();
	switch (datatypeIs(values)) {
		case "array":
			return caseSensitive ? values.includes(value) : values.find((element) => element.toLowerCase() == vlc) != undefined;
		case "string":
			return caseSensitive ? values == value : values.toLowerCase() == vlc;
	}
	return false;
}

/**
 * determines if a value is in a set of values
 *
 * @param {String or Array} values         The set of values to check existance in
 * @param {String}          value          The value to check for existance
 * @param {boolean}         caseSensitive  Control case sensitive/insensitive matching (default: true)
 * @return {boolean}  if value is in the set of values
 */
export let isIn = (values, value, caseSensitive = true) => findInSet(values, value, caseSensitive);

/**
 * determines if a value is in a set of values using a case insensitive comparison
 *
 * @param {String or Array} values     The set of values to check existance in
 * @param {String}          value      The value to check for existance
 * @return {boolean} if value is in the set of values
 */
export let isIni = (values, value) => findInSet(values, value, false);

/**
 * replace ENTITY strings with a generic characterSet
 *
 * @param {String} string    string containing HTML or XML entities (starts with & ends with ;)
 * @return {String} the string with entities replaced with a single character '*'
 */
export let unEntity = (string) => string.replace(/(&.+;)/gi, "*");

/**
 * checks is an object has none of its own properties
 *
 * @param {Object} object   The object to check
 * @returns {Booolean} true if the object does not contain ant local properties
 */
export function isEmpty(object) {
	for (let key in object) {
		if (Object.prototype.hasOwnProperty.call(object, key)) return false;
	}
	return true;
}

/**
 * Synchronously reads a file (if it exists)
 *
 * @param {String} filename  The name of the file to read
 * @returns {Buffer} the buffer containing the data from the file, or null if there is a problem reading
 */
export function readmyfile(filename, options = null) {
	try {
		const stats = statSync(filename);
		if (stats.isFile()) return readFileSync(filename, options);
	} catch (err) {
		console.log(chalk.magenta(`${err.code}, ${err.path}`));
	}
	return null;
}

// credit to https://gist.github.com/adriengibrat/e0b6d16cdd8c584392d8#file-parseduration-es5-js
export function parseISOduration(duration) {
	const durationRegex = /^(-)?P(?:(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?|(\d+)W)$/;
	let parsed = null;
	if (duration)
		duration.replace(durationRegex, function (_, sign, year, month, day, hour, minute, second, week) {
			sign = sign ? -1 : 1;
			// parse number for each unit
			var units = [year, month, day, hour, minute, second, week].map(function (num) {
				return parseInt(num, 10) * sign || 0;
			});
			parsed = { year: units[0], month: units[1], week: units[6], day: units[2], hour: units[3], minute: units[4], second: units[5] };
		});
	// no regexp match
	if (!parsed) {
		throw new Error('Invalid duration "' + duration + '"');
	}
	/**
	 * Sum or substract parsed duration to date
	 *
	 * @param {Date} date A valid date instance
	 * @throws {TypeError} When date is not valid
	 * @returns {Date} Date plus or minus duration, according duration sign
	 */
	parsed.add = function add(date) {
		if (Object.prototype.toString.call(date) !== "[object Date]" || isNaN(date.valueOf())) {
			throw new TypeError("Invalid date");
		}
		return new Date(
			Date.UTC(
				date.getUTCFullYear() + parsed.year,
				date.getUTCMonth() + parsed.month,
				date.getUTCDate() + parsed.day + parsed.week * 7,
				date.getUTCHours() + parsed.hour,
				date.getUTCMinutes() + parsed.minute,
				date.getUTCSeconds() + parsed.second,
				date.getUTCMilliseconds()
			)
		);
	};

	return parsed;
}

/**
 * counts the number of named elements in the specificed node
 * *
 * @param {XmlElement} node             the libxmljs node to check
 * @param {String}     childElementName the name of the child element to count
 * @returns {integer} the number of named child elments
 */
export function CountChildElements(node, childElementName) {
	let r = 0;
	node?.childNodes().forEachNamedSubElement(childElementName, elem => {
		r++;
	});
	return r;
}

/**
 * determines if the specified value is already in the array and adds it if it is not
 * *
 * @param {Array} found    an array on non-duplicated values
 * @param {String}  val    the value whose existance is to be checked
 * @returns {boolean} true if @val is already present in @found, else false
 */
export function DuplicatedValue(found, val) {
	const f = found.includes(val);
	if (!f) found.push(val);
	return f;
}

export function DumpString(str) {
	let t = [];
	for (let i = 0; i < str.length; i++) t.push(str.charCodeAt(i).toString(16));
	return `"${str}" --> ${t.join(" ")}`;
}
