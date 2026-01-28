/**
 * utils.mts
 *
 * some useful utility functions that may be used by more than one class
 */
import { statSync, readFileSync } from "fs";
import chalk from "chalk";
//import { XmlElement } from "libxml2-wasm";

//import { Array_extension_init } from "./Array-extensions.mts";
//Array_extension_init();


/* local */
let findInSet = (values : string | Array<string>, value : string, caseSensitive : boolean) : boolean => {
	const vlc = value.toLowerCase();
	switch (datatypeIs(values)) {
		case "array":
			const va = values as Array<string>
			return caseSensitive ? va.includes(value) : va.find((element : string) => element.toLowerCase() == vlc) != undefined;
		case "string":
			const vs = values as string;
			return caseSensitive ? vs == value : vs.toLowerCase() == vlc;
	}
	return false;
};

/**
 * determines if a value is in a set of values
 *
 * @param {String | Array} values         The set of values to check existance in
 * @param {String}          value          The value to check for existance
 * @param {boolean}         caseSensitive  Control case sensitive/insensitive matching (default: true)
 * @return {boolean}  true if value is in the set of values
 */
export let isIn = (values : string | Array<string>, value : string, caseSensitive? : boolean) : boolean => findInSet(values, value, caseSensitive == undefined ? true : caseSensitive);

/**
 * determines if a value is in a set of values using a case insensitive comparison
 *
 * @param {String or Array} values     The set of values to check existance in
 * @param {String}          value      The value to check for existance
 * @return {boolean} true if value is in the set of values
 */
export let isIni = (values : string | Array<string>, value : string) : boolean => findInSet(values, value, false);

/**
 * replace ENTITY strings with a generic characterSet
 *
 * @param {String} str    string containing HTML or XML entities (starts with & ends with ;)
 * @return {String} the string with entities replaced with a single character '*'
 */
export let unEntity = (str : string) : string => str.replace(/(&.+;)/gi, "*");

/**
 * checks is an object has none of its own properties
 *
 * @param {Object} object   The object to check
 * @returns {Booolean} true if the object does not contain ant local properties
 */
export function isEmpty(object : any) : boolean {
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
export function readmyfile(filename : string, options = null) {
	try {
		const stats = statSync(filename);
		if (stats.isFile()) return readFileSync(filename, options);
	} catch (err) {
		console.log(chalk.magenta(`${err.code}, ${err.path}`));
	}
	return undefined;
}

type iso_duration_type = {
	year : number;
	month : number;
	week: number;
	day : number;
	hour : number;
	minute : number;
	second : number;
};


export class ISOduration {
	
	#year : number = 0;
	#month : number = 0;
	#week: number = 0;
	#day : number = 0;
	#hour : number = 0;
	#minute : number = 0;
	#second : number = 0;

	durationRegex = /^(-)?P(?:(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?|(\d+)W)$/;

	constructor (duration : string) {

		let match = duration.match(this.durationRegex)
		if (match) {
			let sign = match[1] ? -1 : 1;
			this.#year = parseInt(match[2], 10) * sign || 0;
			this.#month = parseInt(match[3], 10) * sign || 0;
			this.#week = parseInt(match[8], 10) * sign || 0;
			this.#day = parseInt(match[4], 10) * sign || 0;
			this.#hour = parseInt(match[5], 10) * sign || 0;
			this.#minute = parseInt(match[6], 10) * sign || 0;
			this.#second = parseInt(match[7], 10) * sign || 0;
		}
		else
			throw new Error('Invalid duration "' + duration + '"');
	}

	add( date : Date ) : Date {
		return new Date(
			Date.UTC(
				date.getUTCFullYear() + this.#year,
				date.getUTCMonth() + this.#month,
				date.getUTCDate() + this.#day + this.#week * 7,
				date.getUTCHours() + this.#hour,
				date.getUTCMinutes() + this.#minute,
				date.getUTCSeconds() + this.#second,
				date.getUTCMilliseconds()
			)
		);
	};

}

/**
 * determines if the specified value is already in the array and adds it if it is not
 * *
 * @param {Array} found    an array on non-duplicated values
 * @param {String}  val    the value whose existance is to be checked
 * @returns {boolean} true if @val is already present in @found, else false
 */
export function DuplicatedValue<T>(found : Array<T>, val : T) : boolean {
	const f = found.includes(val);
	if (!f) found.push(val);
	return f;
}


export function DumpString(str : string) : string {
	let t = [];
	for (let i = 0; i < str.length; i++) t.push(str.charCodeAt(i).toString(16));
	return `"${str}" --> ${t.join(" ")}`;
}
