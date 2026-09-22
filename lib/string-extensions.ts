/**
 * string-extensions
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Context specific things to do with strings
 */


import { datatypeIs } from "./utils.mts";

/**
 * encapsulate the specified string in quotes
 *
 * @param {string} str  the string to be encapsulated in quotes
 * @returns {string} the string encapsulated in quotes
 */
String.prototype.quote = function() : string {
    return `"${this}"`
}


/**
 * convert characters in the string to HTML entities
 */
String.prototype.HTMLize = function() : string {
	return datatypeIs(this, "string") 
	? (this as string).replace(/[&<>"'-]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "-": "&#8209;" }[m])) 
	: this as string;
}


/**
 * express the name of at atribute in the form of element@attribute
 * 
 * @param {string} elemName  the name of the element (optional)
 * @returns {string} the attribute expressed in the form of element@attribute
 */
String.prototype.attribute = function	(elemName : string= "") : string {
	return `${elemName}@${this}`;
}


/**
 * express the name of an element in the form of <element>
 * 
 * @param {string} elem  the name of the element
 * @returns {string} the element expressed in the form of <element>
 */
String.prototype.elementize = function() : string {
	return `<${this}>`;
}