

import { datatypeIs } from "./utils.mts";

/**
 * encapsulate the specified string in quotes
 *
 * @param {String} str  the string to be encapsulated in quotes
 * @returns {String} the string encapsulated in quotes
 */
String.prototype.quote = function() : string {
    return `"${this}"`
}


/**
 * convert characters in the string to HTML entities
 */
String.prototype.HTMLize = function() {
	return datatypeIs(this, "string") 
	? (this as string).replace(/[&<>"'-]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "-": "&#8209;" }[m])) 
	: this as string;
}


/**
 * express the name of at atribute in the form of element@attribute
 * 
 * @param {String} elemName  the name of the element (optional)
 * @returns {String} the attribute expressed in the form of element@attribute
 */
String.prototype.attribute = function	(elemName : string= ""): string {
	return `${elemName}@${this}`;
}


/**
 * express the name of an element in the form of <element>
 * 
 * @param {String} elem  the name of the element
 * @returns {String} the element expressed in the form of <element>
 */
String.prototype.elementize = function() : string {
	return `<${this}>`;
}