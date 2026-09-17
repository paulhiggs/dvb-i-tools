/**
 * libxml2-wasm-extensions.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Additional functions to help libxml2-wasm (https://jameslan.github.io/libxml2-wasm/v0.5/) align
 * with the formerly used libxmljs2 (https://github.com/marudor/libxmljs2)
 */

import { XmlDocument, XmlElement, XmlAttribute } from "libxml2-wasm"

//console.log(chalk.yellow.underline("initialize libxml2-wasm extensions"));

/**
 * find the named attribute without considering the namespace
 * return a pointer to the XmlAttribute object or null if not found
 */
XmlElement.prototype.attrAnyNs = function (name: string) : XmlAttribute | null{
	const rc = this.attrs.find((a) => a.name == name);
	return rc ? rc : null;
};


/**
 * find the named attribute without considering the namespace and return its value
 * return a pointer to the XmlAttribute object or the @default_value value
 */
XmlElement.prototype.attrAnyNsValueOr = function (name: string, default_value: string | null = null) : string | null {
	const rc = this.attrs.find((a) => a.name == name);
	return rc ? rc.value : default_value;
};



/**
 * find the nth instance of the named element without considering the namespace
 * return a pointer to the XmlElement object or null if not found
 */

XmlElement.prototype.getAnyNs = function (name: string, index: number = 1) : XmlElement | null {
	if (this == null) {
		throw new TypeError("XmlDocument.prototype.getAnyNs called on null or undefined");
	}
	if (!name) {
		throw new Error("XmlDocument.prototype.getAnyNs called without name");
	}
	let ix = 0,
		child = this.firstChild;
	while (child) {
		if (child instanceof XmlElement && child.name == name) {
			if (++ix == index) return child;
		}
		child = child.next;
	}
	return null;
};


/**
 * return true there is at least one child element as named
 */
XmlElement.prototype.hasChild = function (childName: string) : boolean {
	if (this == null) {
		throw new TypeError("XmlElement.prototype.hasChild called on null or undefined");
	}
	if (!childName) {
		throw new Error("XmlElement.prototype.hasChild called without name");
	}
	let child = this.firstChild as XmlElement;
	while (child) {
		if (child.name?.endsWith(childName)) return true;
		child = child.next;
	}
	return false;
};


/**
 * return true there is at least one child element
 */
XmlElement.prototype.hasChildren = function () : boolean {
	if (this == null) {
		throw new TypeError("XmlElement.prototype.hasChilden called on null or undefined");
	}
	let child = this.firstChild;
	while (child) {
		if (child instanceof XmlElement) return true;
		child = child.next;
	}
	return false;
};

/**
 * invoke the given callback for each child element
 */
XmlElement.prototype.forEachChildElement = function (func: (child: XmlElement) => void) : void {
	if (this == null) {
		throw new TypeError("XmlElement.prototype.forEachChildElement called on null or undefined");
	}
	let child = this.firstChild;
	while (child) {
		if (child instanceof XmlElement) 
			func(child);
		child = child.next;
	}
}



/**
 * invoke the given callback for each child with the given name (irrespective of namespace)
 */
XmlElement.prototype.forEachNamedChildElement = function (name: string | string[], func: (child: XmlElement) => void) : void {
	if (this == null) {
		throw new TypeError("XmlElement.prototype.forEachNamedChildElement called on null or undefined");
	}
	if (!name) {
		throw new Error("XmlElement.prototype.forEachNamedChildElement called without name");
	}
	let child = this.firstChild;
	while (child) {
		if (child instanceof XmlElement && (Array.isArray(name) ? name.includes(child.name) : child.name == name)) 
			func(child);
		child = child.next;
	}
}


/**
 * return true there is at least one child element
 */
XmlDocument.prototype.hasChildren = function () : boolean {
	if (this == null) {
		throw new TypeError("XmlDocument.prototype.hasChilden called on null or undefined");
	}
	let child = this.root.firstChild;
	while (child) {
		if (child instanceof XmlElement) return true;
		child = child.next;
	}
	return false;
};


/**
 * invoke the given callback for each child element
 */
XmlDocument.prototype.forEachChildElement = function (func: (child: XmlElement) => void) {
	if (this == null) {
		throw new TypeError("XmlDocument.prototype.forEachChildElement called on null or undefined");
	}
	let child = this?.firstChild;
	while (child) {
		if (child instanceof XmlElement) 
			func(child);
		child = child.next;
	}
}


/**
 * invoke the given callback for each child with the given name (irrespective of namespace)
 */
XmlDocument.prototype.forEachNamedChildElement = function (name: string, func: (child: XmlElement) => void) {
	if (this == null) {
		throw new TypeError("XmlDocument.prototype.forEachNamedChildElement called on null or undefined");
	}
	if (!name) {
		throw new Error("XmlDocument.prototype.forEachNamedChildElement called without name");
	}
	let child = this.root.firstChild;
	while (child) {
		if (child instanceof XmlElement && (Array.isArray(name) ? name.includes(child.name) : child.name == name)) 
			func(child);
		child = child.next;
	}
}


/**
 * return the namespace where the element is defined
 */
XmlElement.prototype.documentNamespace = function () : string {
	if (this == null) {
		throw new TypeError("XmlDocument.prototype.hasChild called on null or undefined");
	}
	if (!this.parent) return this.namespaceUri;
	return this.parent.documentNamespace();
};


/**
 * return a count of the number of named child elements (irrespective of namespace)
 */
XmlElement.prototype.countChildElements = function (childElementName: string) : number {
	if (this == null) {
		throw new TypeError("XmlElement.prototype.countChildElements called on null or undefined");
	}
	let r: number = 0;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	this.forEachNamedChildElement(childElementName, (elem) => r++);
	return r;
}


export const Libxml2_wasm_init = () => {};
