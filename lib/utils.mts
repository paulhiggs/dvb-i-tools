/**
 * utils.mts
 *
 * some useful utility functions that may be used by more than one class
 */
import { XmlElement } from "libxml2-wasm";

import { datatypeIs } from "../phlib/phlib.ts";

import { Array_extension_init } from "./Array-extensions.mts";
Array_extension_init();

import { statSync, readFileSync } from "fs";
import chalk from "chalk";


/**
 * Synchronously reads a file (if it exists)
 *
 * @param {string} filename  The name of the file to read
 * @returns {string | NonSharedBuffer | null } the buffer containing the data from the file, or null if there is a problem reading
 */
function readmyfile(filename : string, options : any | null = null) : string | NonSharedBuffer | null {
	try {
		const stats = statSync(filename);
		if (stats.isFile()) return readFileSync(filename, options);
	} catch (err) {
		console.log(chalk.magenta(`${err.code}, ${err.path}`));
	}
	return null;
}
export function readmyfileB(filename) : NonSharedBuffer | null {
	const res = readmyfile(filename);
	return res ? res as NonSharedBuffer : null;
}
export function readmyfileS(filename : string) : string | null {
	const res = readmyfile(filename, { encoding: "utf-8", flag: "r" });
	return res ? res as string : null;
}

/**
 * constructs an XPath based on the provided arguments
 *
 * @param {string} SCHEMA_PREFIX  Used when constructing Xpath queries
 * @param {string} elementName    The name of the element to be searched for
 * @param {number} index          The instance of the named element to be searched for (if specified)
 * @returns {string}  the XPath selector
 */
export let xPath = (SCHEMA_PREFIX : string, elementName : string, index : number | undefined = undefined) : string =>
	`${SCHEMA_PREFIX}:${elementName}${index ? `[${index}]` : ""}`;

/**
 * constructs an XPath based on the provided arguments
 *
 * @param {string} SCHEMA_PREFIX        Used when constructing Xpath queries
 * @param {Array<string>} elementNames  the name of the elements to be included in the XPath query
 * @returns {String} the XPath selector
 */
export let xPathM = (SCHEMA_PREFIX : string, elementNames : Array<string>) : string =>
	`${SCHEMA_PREFIX}:${elementNames.join(`/${SCHEMA_PREFIX}:`)}`;

/**
 * returns the first child whose name matches the specified value
 * @param {XmlElement} element  The element to search in for the named child
 * @param {string} elementName  The name of the element to search for
 * @returns {XmlElement | undefined} the named child element or undefined if not present
 *
 */
export let getFirstElementByTagName = (element : XmlElement, childElementName : string) : XmlElement | undefined =>
	element.childNodes().find((child) => child instanceof XmlElement && child.name == childElementName);

/**
 * Finds the first named child element
 *
 * @param {XmlElement} element                       The containing parent element
 * @param {string | Array<string>} childElementName  The name of the child element to find
 * @param {number | undefined} index                 Where to stare looking index == undefined == 0 --> look for first instance
 * @returns {XmlElement} the named child element or undefined if not present
 */
export function getElementByTagName(element : XmlElement, childElementName : string | Array<string>, index : number | undefined = undefined) : XmlElement | undefined {
	if (childElementName instanceof Array) {
		if (index) return undefined; // cant use index with list of elements
		let ch : XmlElement | undefined = element;
		for (let i = 0; ch && i < childElementName.length; i++) 
			ch = getFirstElementByTagName(ch, childElementName[i]);
		return ch;
	}
	else {
			if (!index) return getFirstElementByTagName(element, childElementName);
			let cnt : number = 0;
			const ch = element.childNodes();
			for (let i = 0; i < ch.length; i++) {
				if (ch[i] instanceof XmlElement && ch[i].name == childElementName) cnt++;
				if (cnt >= index) return ch[i];
			}
	}
	return undefined;
}

/* local */
let findInSet = (values  : string | Array<string>, value : string, caseSensitive : boolean) => {
	if (!values || !value || !datatypeIs(value, "string")) return false;
	const vlc = value.toLowerCase();
	if (values instanceof Array)
		return caseSensitive ? values.includes(value) : values.find((element) => element.toLowerCase() == vlc) != undefined;
	else
		return caseSensitive ? values == value : values.toLowerCase() == vlc;
};

/**
 * determines if a value is in a set of values
 *
 * @param {string | Array<string>} values  The set of values to check existance in
 * @param {string} value                   The value to check for existance
 * @param {boolean} caseSensitive          Control case sensitive/insensitive matching (default: true)
 * @return {boolean}  true if value is in the set of values
 */
export let isIn = (values : string | Array<string>, value : string, caseSensitive :boolean = true) : boolean =>
	findInSet(values, value, caseSensitive);

/**
 * determines if a value is in a set of values using a case insensitive comparison
 *
 * @param {string | Array<string>} values  The set of values to check existance in
 * @param {string} value                   The value to check for existance
 * @return {boolean} true if value is in the set of values
 */
export let isIni = (values : string | Array<string>, value : string) : boolean =>
	findInSet(values, value, false);

/**
 * replace ENTITY strings with a generic characterSet
 *
 * @param {string} string  string containing HTML or XML entities (starts with & ends with ;)
 * @return {string} the string with entities replaced with a single character '*'
 */
export let unEntity = (string : string ) : string =>
	string.replace(/(&.+;)/gi, "*");

/**
 * checks is an object has none of its own properties
 *
 * @param {Object} object  The object to check
 * @returns {Booolean} true if the object does not contain ant local properties
 */
export function isEmpty(object : any) : boolean {
	for (let key in object)
		if (Object.prototype.hasOwnProperty.call(object, key))
			 return false;
	return true;
}

/**
 * counts the number of named elements in the specificed node
 * *
 * @param {XmlElement} node         the libxmljs node to check
 * @param {string} childElementName  the name of the child element to count
 * @returns {number} the number of named child elments
 */
export function CountChildElements(node : XmlElement, childElementName : string) : number {
	let r : number = 0;
	node?.childNodes().forEachNamedSubElement(childElementName, (/* eslint-disable no-unused-vars*/ elem /* eslint-enable */) => {
		r++;
	});
	return r;
}

/**
 * determines if the specified value is already in the array and adds it if it is not
 * *
 * @param {Array} found  an array on non-duplicated values
 * @param {string} val   the value whose existance is to be checked
 * @returns {boolean} true if @val is already present in @found, else false
 */
export function DuplicatedValue(found, val) {
	const f = found.includes(val);
	if (!f) found.push(val);
	return f;
}

export function DumpString(str : string) : string {
	let t : Array<string> = [];
	for (let i = 0; i < str.length; i++) 
		t.push(str.charCodeAt(i).toString(16));
	return `"${str}" --> ${t.join(" ")}`;
}


// credit to https://gist.github.com/adriengibrat/e0b6d16cdd8c584392d8#file-parseduration-es5-js
export class parseISOduration2 {
	
	private durationRegex = /^(-)?P(?:(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?|(\d+)W)$/;
	private parsed;

	constructor(duration? : string) {
		if (duration)
			this.parsed = duration.replace(this.durationRegex, function(_, sign, year, month, day, hour, minute, second, week) : any {
				sign = sign ? -1 : 1;
				// parse number for each unit
				var units = [year, month, day, hour, minute, second, week].map(function (num) {
					return parseInt(num, 10) * sign || 0;
				});
				return { year: units[0], month: units[1], week: units[6], day: units[2], hour: units[3], minute: units[4], second: units[5] };
			});
		// no regexp match
		if (!this.parsed) {
			throw new Error('Invalid duration "' + duration + '"');
		}
	}

	/**
	 * Sum or substract parsed duration to date
	 *
	 * @param {Date} date A valid date instance
	 * @throws {TypeError} When date is not valid
	 * @returns {Date} Date plus or minus duration, according duration sign
	 */
	 add(date : Date) : Date {
		if (Object.prototype.toString.call(date) !== "[object Date]" || isNaN(date.valueOf())) {
			throw new TypeError("Invalid date");
		}
		return new Date(
			Date.UTC(
				date.getUTCFullYear() + this.parsed.year,
				date.getUTCMonth() + this.parsed.month,
				date.getUTCDate() + this.parsed.day + this.parsed.week * 7,
				date.getUTCHours() + this.parsed.hour,
				date.getUTCMinutes() + this.parsed.minute,
				date.getUTCSeconds() + this.parsed.second,
				date.getUTCMilliseconds()
			)
		);
	};
}
