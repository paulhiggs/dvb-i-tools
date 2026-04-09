/**
 * string_extensions.mts	
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * extensions of the String class
 */

String.prototype.quote = function (this : string, using: string = '"') : string {
	return `${using}${this}${using}`;
};

String.prototype.elementize = function (this : string) : string {
	return `<${this}>`;
};

String.prototype.attribute = function (this : string, elementName: string = "") : string {
		return `${elementName}@${this}`;
};

String.prototype.HTMLize = function (this : string) : string {
	return HTMLize(this);
};


/*
export function elementize( str : string ) : string {
	return `<${str}>`;
}
export function quote( str : string, using? : string) : string {
	return `${using || '"'}${str}${using || '"'}`;
}
export function attribute( str : string, elementName : string = "") : string {
	return `${elementName}@${str}`;
}
*/
export function HTMLize( str : string ) : string {
	return str.replace(/[&<>"'-]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "-": "&#8209;" }[c[0]] || '#' + c.charCodeAt(0) + ';'));
}	
