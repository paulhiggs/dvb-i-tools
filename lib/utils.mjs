/**
 * utils.mjs
 *
 * some useful utility functions that may be used by more than one class
 */
import { statSync, readFileSync } from "fs";
import chalk from "chalk";
import { XmlElement } from "libxml2-wasm";

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
};


/**
 * determines if a value is in a set of values
 *
 * @param {String or Array} values         The set of values to check existance in
 * @param {String}          value          The value to check for existance
 * @param {boolean}         caseSensitive  Control case sensitive/insensitive matching (default: true)
 * @return {boolean}  true if value is in the set of values
 */
export let isIn = (values, value, caseSensitive = true) => findInSet(values, value, caseSensitive);

/**
 * determines if a value is in a set of values using a case insensitive comparison
 *
 * @param {String or Array} values     The set of values to check existance in
 * @param {String}          value      The value to check for existance
 * @return {boolean} true if value is in the set of values
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
			let units = [year, month, day, hour, minute, second, week].map(function (num) {
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
	node?.forEachNamedChildElement(childElementName, (/* eslint-disable no-unused-vars*/ elem /* eslint-enable */) => {
		r++;
	});
	return r;
}

/**
 * determines if the specified value is already in the array and adds it if it is not
 *
 * @param {Set}    found  an array on non-duplicated values
 * @param {String} val    the value whose existance is to be checked
 * @returns {boolean} true if @val is already present in @found, else false
 */
export function DuplicatedValue(found, val) {
	const included = found.has(val);
	if (!included) found.add(val);
	return included;
}

export function DumpString(str) {
	let t = [];
	for (let i = 0; i < str.length; i++) t.push(str.charCodeAt(i).toString(16));
	return `"${str}" --> ${t.join(" ")}`;
}


// ------------ functions imported from legacy phlib

/*
 * formatters
 */
//String.prototype.quote=function(using='"') {return using+this+using}
//String.prototype.elementize=function() {return '<'+this+'>'}
//String.prototype.attribute=function(elemName="") {return elemName+'@'+this}

Object.assign(String.prototype, {
	quote(using = '"') {
		return `${using}${this}${using}`;
	},
});
export let quote = (str) => str.quote();

Object.assign(String.prototype, {
	elementize() {
		return `<${this}>`;
	},
});
export let elementize = (str) => str.elementize();

Object.assign(String.prototype, {
	attribute(elemName = "") {
		return `${elemName}@${this}`;
	},
});
export let attribute = (attr, elem = "") => attr.attribute(elem);


/**
 * convert characters in the string to HTML entities
 *
 * @param {string} str String that should be displayed in HTML
 * @returns {string} A string with ENTITY representations of < and >
 */
export let HTMLize = (str) =>
	datatypeIs(str, "string") 
		? str.replace(/[&<>"'\-]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "-": "&#8209;" }[m])) 
		: str;


/**
 * return the type of the argument passed
 * @param {any} arg the argument whose type we are interested in
 * @param {string} requiredType  the desired tyoe
 * @returns {boolean or string} the type of the argument or a boolean if the type matches the requiredType
 */
export function datatypeIs(arg, requiredType = null) {
	if (!arg)
		// ensure null is not identified as an object
		return undefined;
	if (Array.isArray(arg)) return requiredType ? requiredType == "array" : "array";
	let typ = typeof arg;
	return requiredType ? requiredType == typ : typ;
}


/**
 * Check if an object is empty
 * 
 * @param {*} objectName the object to check for member attributes 
 * @returns true if the object is empty
 */
export const isObjectEmpty = (objectName) => {
  return (
    objectName &&
    Object.keys(objectName).length === 0 &&
    objectName.constructor === Object
  );
};
