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

import { APPLICATION } from "./error_list.mts";
import ErrorList from  "./error_list.mts";

import {} from "./string-extensions.ts";

/* local */
const findInSet = (values : string | string[], value : string, caseSensitive : boolean) : boolean => {
	if (!values || !value || !datatypeIs(value, "string")) return false;
	const vlc = value.toLowerCase();
	switch (datatypeIs(values)) {
		case "array":
			return caseSensitive 
				? values.includes(value) 
				: (values as string[]).find((element) => element.toLowerCase() == vlc) != undefined;
		case "string":
			return caseSensitive 
			? values == value 
			: (values as string).toLowerCase() == vlc;
	}
	return false;
};


/**
 * determines if a value is in a set of values
 *
 * @param {string | string[]} values         The set of values to check existance in
 * @param {string}          value          The value to check for existance
 * @param {boolean}         caseSensitive  Control case sensitive/insensitive matching (default: true)
 * @return {boolean}  true if value is in the set of values
 */
export const isIn = (values: string | string[], value: string, caseSensitive: boolean = true) : boolean => 
	findInSet(values, value, caseSensitive);

/**
 * determines if a value is in a set of values using a case insensitive comparison
 *
 * @param {string | string[]} values     The set of values to check existance in
 * @param {string}          value      The value to check for existance
 * @return {boolean} true if value is in the set of values
 */
export const isIni = (values: string | string[], value: string) : boolean => findInSet(values, value, false);

/**
 * replace ENTITY strings with a generic characterSet
 *
 * @param {String} str    string containing HTML or XML entities (starts with & ends with ;)
 * @return {String} the string with entities replaced with a single character '*'
 */
export const unEntity = (str: string) : string => str.replace(/(&.+;)/gi, "*");

/**
 * checks is an object has none of its own properties
 *
 * @param {Object} object   The object to check
 * @returns {Booolean} true if the object does not contain ant local properties
 */
export function isEmpty(object: Record<string, unknown>) : boolean {
//	for (const key in object) {
//		if (HasProperty(object, key)) return false;
//	}
	return Object.keys(object).length == 0;
}

/**
 * Synchronously reads a file (if it exists)
 *
 * @param {String} filename  The name of the file to read
 * @param {Record<string,unknown>} options  Options to pass to readFileSync
 * @returns {Buffer} the buffer containing the data from the file, or null if there is a problem reading
 */
export function readmyfile(filename: string, options: Record<string, unknown>) : Buffer | null {
	try {
		const stats = statSync(filename);
		if (stats.isFile()) 
			return readFileSync(filename, options);
	} catch (err) {
		console.log(chalk.magenta(`${err.code}, ${err.path}`));
	}
	return null;
}


/**
 * Check the argument passed to a validation function.
 * Likely not needed in a TypeScript based solution but we need to ensure that we are "checking" the properly named XmlElement
 * 
 * @param {string} functionName  the name of the function that is calling this check
 * @param {XmlElement | null} node  the XmlElement being used in validation
 * @param {string[] | string | null} expectedType  the name of names that the @node needs to be 
 * @param {ErrorList} errs  the class where errors and warnings relating to the service list processing are stored
 * @param {string} errcode  the prefix to use for any errors found
 * @returns {boolean} true if @node is an XmlElement and has the correct name, else false
 */
export function parameterCheck(functionName: string, node: XmlElement | null, expectedType: string | string[] | null, errs: ErrorList, errcode: string): boolean {
	if (!node) {
		errs.addError({
			type: APPLICATION,
			code: `${errcode}-a`,
			message: `${functionName}() called with ${expectedType}==null`,
		});
		return false;
	}
	if (!(node instanceof XmlElement)) {
		errs.addError({
			type: APPLICATION,
			code: `${errcode}-b`,
			message: `${functionName}() called with type ${(node as XmlElement).constructor.name} instead of XmlElement`,
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
 * @param {Set<sting>}found  an array on non-duplicated values
 * @param {string} val the value whose existance is to be checked
 * @returns {boolean} true if @val is already present in @found, else false
 */
export function DuplicatedValue<TYPE>(found: Set<TYPE>, val: TYPE): boolean {
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

/*
 * formatters
 */

/**
 * encapsulate the specified string in quotes
 *
 * @param {String} str  the string to be encapsulated in quotes
 * @returns {String} the string encapsulated in quotes
 */
export const quote = (str : string) : string => str.quote();


/**
 * express the name of an element in the form of <element>
 * 
 * @param {String} elem  the name of the element
 * @returns {String} the element expressed in the form of <element>
 */
export const elementize = (elem : string) : string => elem.elementize();


/**
 * express the name of at atribute in the form of element@attribute
 * 
 * @param {String} attr  the name of the attribute
 * @param {String} elem  the name of the element (optional)
 * @returns {String} the attribute expressed in the form of element@attribute
 */
export const attribute = (attr : string, elem : string= "") : string => attr.attribute(elem);


/**
 * convert characters in the string to HTML entities
 */
export const HTMLize = (str : string) => str.HTMLize();


/**
 * return the type of the argument passed
 * 
 * @param {unknown} arg the argument whose type we are interested in
 * @param {string} requiredType  the desired type
 * @returns {boolean | string} the type of the argument or a boolean if the type matches the requiredType
 */
export function datatypeIs(arg: unknown, requiredType: string | null = null): boolean | string | undefined {
	if (arg === null || arg === undefined)
		// ensure null is not identified as an object
		return undefined;
	if (Array.isArray(arg)) return requiredType ? requiredType == "array" : "array";
	const typ = typeof arg;
	return requiredType ? requiredType == typ : typ;
}


/**
 * Check if an object is empty
 * 
 * @param {unknown} objectName the object to check for member attributes 
 * @returns true if the object is empty
 */
export const isObjectEmpty = (objectName: unknown) => {
  return (
    objectName &&
    Object.keys(objectName).length === 0 &&
    objectName.constructor === Object
  );
};

/**
 * Checks if a string contains any hexadecimal characters
 * 
 * @param {string} str the string to check
 * @returns {boolean} true if the string contains hexadecimal characters, false otherwise
 */
export function containsHex(str : string | null | undefined): boolean {
	if (!str) return false;
	str = str.toLowerCase();
	for (let i = 0; i < str.length; i++)
		if (str[i] >= 'a' && str[i] <= 'f')
			return true;
	return false;
}


const _HexRegexp = new RegExp(`^(?<hex_ind>(0x))?(?<value>[0-9a-fA-F]+)$`);
export function HexOrDecValue(str: string) : number{
	const res = str.match(_HexRegexp);
	return parseInt((res?.groups?.value as string), res?.groups?.hex_ind == "0x" || containsHex(res?.groups?.value) ? 16 : 10);	
}

/**
 * Checks if the named property exists in the object and is not undefined
 * 
 * @param {*} obj        The object to check for the property
 * @param {String} prop  The name of the property to check for
 * @returns true if the property exists in the object and is not undefined
 **/
export const HasProperty = (obj: unknown, prop: string) => {
	return Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 * Sets the default value of a property in an object if the property does not exist or is undefined
 * 
 * @param {*} obj        The object to set the property in
 * @param {String} prop  The name of the property to set
 * @param {*} defaultValue  The default value to set if the property does not exist or is undefined
 **/
export const DefaultProperty = (obj: Record<string, unknown>, prop: string, defaultValue: unknown) => {
	if (!HasProperty(obj, prop)) 
		(obj as Record<string, unknown>)[prop] = defaultValue;
}