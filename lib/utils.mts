/**
 * utils.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * some useful utility functions that may be used by more than one class
 */
import { statSync, readFileSync } from "fs";
import chalk from "chalk";
import { XmlElement } from "libxml2-wasm";

import ErrorList, { APPLICATION } from "./error_list.mts";

/* local */
const findInSet = (values : string | string[], value : string, caseSensitive : boolean) : boolean=> {
	if (!values || !value || !datatypeIs(value, "string")) return false;
	const vlc = value.toLowerCase();
	switch (datatypeIs(values)) {
		case "array":
			return caseSensitive ? values.includes(value) : (values as string[]).find((element) => element.toLowerCase() == vlc) != undefined;
		case "string":
			return caseSensitive ? values == value : (values as string).toLowerCase() == vlc;
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
export const isIn = (values : string | string[], value : string, caseSensitive : boolean = true) : boolean => findInSet(values, value, caseSensitive);

/**
 * determines if a value is in a set of values using a case insensitive comparison
 *
 * @param {String or Array} values     The set of values to check existance in
 * @param {String}          value      The value to check for existance
 * @return {boolean} true if value is in the set of values
 */
export const isIni = (values : string | string[], value : string) : boolean => findInSet(values, value, false);

/**
 * replace ENTITY strings with a generic characterSet
 *
 * @param {String} str    string containing HTML or XML entities (starts with & ends with ;)
 * @return {String} the string with entities replaced with a single character '*'
 */
export const unEntity = (str : string) => str.replace(/(&.+;)/gi, "*");

/**
 * checks is an object has none of its own properties
 *
 * @param {Object} object   The object to check
 * @returns {Booolean} true if the object does not contain ant local properties
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isEmpty(object : any) : boolean {
	for (const key in object) {
		if (Object.prototype.hasOwnProperty.call(object, key)) return false;
	}
	return true;
}

/**
 * Synchronously reads a file (if it exists)
 *
 * @param {String} filename  The name of the file to read
 * @param {Object} options   options to pass to readFileSync (e.g. {encoding: "utf-8"})
 * @returns {Buffer | null} the buffer containing the data from the file, or null if there is a problem reading
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readmyfile(filename : string, options? : any) : Buffer | null {
	try {
		const stats = statSync(filename);
		if (stats.isFile()) return readFileSync(filename, options);
	} catch (err) {
		// console.log(chalk.magenta(`${err.code}, ${err.path}`));
		console.log(chalk.magenta(err));
	}
	return null;
}



export function parameterCheck(functionName : string, node : XmlElement, expectedType : string | string[] | undefined, errs : ErrorList, errcode : string) {
	if (!node) {
		errs.addError({
			type: APPLICATION,
			code: `${errcode}-a`,
			message: `${functionName}() called with ${expectedType}==null`,
		});
		return false;
	}
	if (expectedType)
		if (Array.isArray(expectedType) ? !expectedType.includes(node.name) : node.name != expectedType) {
		errs.addError({
			type: APPLICATION,
			code: `${errcode}-c`,
			message: `${functionName}() called with wrong element type ${node.name}, expected ${expectedType}`,
		});
		return false;
	}
	return true;
}


/**
 * determines if the specified value is already in the array and adds it if it is not
 *
 * @param {Set<kind>}   found  an array on non-duplicated values
 * @param {kind} val    the value whose existance is to be checked
 * @returns {boolean} true if @val is already present in @found, else false
 */
export function DuplicatedValue<Type>(found : Set<Type>, val: Type) : boolean {
	const included = found.has(val);
	if (!included) found.add(val);
	return included;
}

export function DumpString(str : string) : string {
	const t = [];
	for (let i = 0; i < str.length; i++) t.push(str.charCodeAt(i).toString(16));
	return `"${str}" --> ${t.join(" ")}`;
}


// ------------ functions imported from legacy phlib

/**
 * return the type of the argument passed
 * @param {any} arg the argument whose type we are interested in
 * @param {string} requiredType  the desired tyoe
 * @returns {boolean or string} the type of the argument or a boolean if the type matches the requiredType
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function datatypeIs(arg : any, requiredType?: string) : boolean | string | undefined {
	if (arg == null || arg == undefined)
		// ensure null is not identified as an object
		return undefined;
	if (Array.isArray(arg)) return requiredType ? requiredType == "array" : "array";
	const typ = typeof arg;
	return requiredType ? requiredType == typ : typ;
}


/**
 * Check if an object is empty
 * 
 * @param {*} objectName the object to check for member attributes 
 * @returns true if the object is empty
 */
//eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isObjectEmpty = (objectName : any) : boolean=> {
  return (
    objectName &&
    Object.keys(objectName).length === 0 &&
    objectName.constructor === Object
  );
};
