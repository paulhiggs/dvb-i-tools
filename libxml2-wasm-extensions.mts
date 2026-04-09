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
import chalk from "chalk";
import { XmlDocument, XmlElement, XmlAttribute } from "libxml2-wasm";

console.log(chalk.yellow.underline("initialize libxml2-wasm extensions"));

/**
 * find the named attribute in an element without considering the namespace
 * return a pointer to the XmlAttribute object or null if not found
 */
/* XmlElement.prototype.attrAnyNs = (name) => {
	if (this == null) {
		throw new TypeError("XmlElement.attrAnyNs called on null or undefined");
	}	const rc = this.attrs.find((a) => a.name == name);
	return rc ? rc : null;
}; */
export function attrAnyNs(e : XmlElement, name: string) : XmlAttribute | null{
	if (e == null) {
		throw new TypeError("attrAnyNs called on null or undefined");
	}	const rc = e.attrs.find((a) => a.name == name);
	return rc ? rc : null; 
}



/**
 * find the named attribute in an element without considering the namespace and return its value
 * if not found, return the @default_value value
 */
/* XmlElement.prototype.attrAnyNsValueOr = function (name, default_value) {
	if (this == null) {
		throw new TypeError("XmlElement.attrAnyNsValueOr called on null or undefined");
	}	const rc = this.attrs.find((a) => a.name == name);
	return rc ? rc.value : default_value;
}; */
export function attrAnyNsValueOr(e : XmlElement, name: string, default_value: string) : string {
	if (e == null) {
		throw new TypeError("attrAnyNsValueOr called on null or undefined");
	}	
	const rc = e.attrs.find((a) => a.name == name);
	return rc ? rc.value : default_value;
} 

/* XmlElement.prototype.attrAnyNsValueOrNull = function (name) {
	if (this == null) {
		throw new TypeError("XmlElement.attrAnyNsValueOrNull called on null or undefined");
	}
	const rc = this.attrs.find((a) => a.name == name);
	return rc ? rc.value : null;
}; */
export function attrAnyNsValueOrNull(e : XmlElement, name: string) : string | null {
	if (e == null) {
		throw new TypeError("attrAnyNsValueOrNull called on null or undefined");
	}	
	const rc = e.attrs.find((a) => a.name == name);
	return rc ? rc.value : null;
}

/*XmlElement.prototype.getAnyNs = function (_name, _index = 1) {
	if (this == null) {
		throw new TypeError("XmlElement.getAnyNs called on null or undefined");
	}
	let ix = 0,
		child = this.firstChild;
	while (child) {
		if (child instanceof XmlElement && child.name == _name) {
			if (++ix == _index) return child;
		}
		child = child.next;
	}
	return null;
};*/
export function getAnyNs(e : XmlElement, name: string, index = 1) : XmlElement | null {
	if (e == null) {
		throw new TypeError("getAnyNs called on null or undefined");
	}
	let ix = 0,
		child = e.firstChild;
			while (child) {
		if (child instanceof XmlElement && child.name == name) {
			if (++ix == index) return child;
		}
		child = child.next;
	}
	return null; 
}

/* XmlElement.prototype.hasChild = function (_childName) {
	if (this == null) {
		throw new TypeError("XmlElement.hasChild called on null or undefined");
	}
	let child = this?.firstChild;
	while (child) {
		if (child?.name?.endsWith(_childName)) return true;
		child = child.next;
	}
	return false;
}; */
export function hasChild(e : XmlElement, childName: string) : boolean {
	if (e == null) {
		throw new TypeError("hasChild called on null or undefined");
	}	
	let child = e.firstChild;
	while (child) {
		if (child instanceof XmlElement && child.name.endsWith(childName)) return true;
		child = child.next as XmlElement;
	}	
	return false;
}

/* XmlElement.prototype.hasChildren = function () {
	if (this == null) {
		throw new TypeError("XmlElement.hasChildren called on null or undefined");
	}
	let child = this?.firstChild;
	while (child) {
		if (child instanceof XmlElement) return true;
		child = child.next;
	}
	return false;
}; */
export function hasChildren(e : XmlElement) : boolean {
	if (e == null) {
		throw new TypeError("hasChildren called on null or undefined");
	}
	let child = e.firstChild;
	while (child) {
		if (child instanceof XmlElement) return true;
		child = child.next as XmlElement;
	} 
	return false;
}


/* XmlElement.prototype.forEachChildElement = function (func) {
	if (this == null) {
		throw new TypeError("XmlElement.forEachChildElement called on null or undefined");
	}
	let child = this?.firstChild;
	while (child) {
		if (child instanceof XmlElement) 
			func(child);
		child = child.next;
	}
} */
export function forEachChildElement(e : XmlElement, func : (child: XmlElement) => void) {
	if (e == null) {
		throw new TypeError("forEachChildElement called on null or undefined");
	}
	let child = e.firstChild;
	while (child) {
		if (child instanceof XmlElement) 
			func(child);
		child = child.next as XmlElement;
	} 
}


/* XmlElement.prototype.forEachNamedChildElement = function (name, func) {
	if (this == null) {
		throw new TypeError("XmlElement.forEachNamedChildElement called on null or undefined");
	}
	let child = this?.firstChild;
	while (child) {
		if (child instanceof XmlElement && (Array.isArray(name) ? name.includes(child.name) : child.name == name)) 
			func(child);
		child = child.next;
	}
} */
export function forEachNamedChildElement(e : XmlElement, name: string | string[], func : (child: XmlElement) => void) {
	if (e == null) {
		throw new TypeError("forEachNamedChildElement called on null or undefined");
	}
	let child = e.firstChild;
	while (child) {
		if (child instanceof XmlElement && (Array.isArray(name) ? name.includes(child.name) : child.name == name)) 
			func(child);
		child = child.next as XmlElement;
	} 
}


/* XmlElement.prototype.documentNamespace = function () {
	if (this == null) {
		throw new TypeError("XmlDocument.prototype.hasChild called on null or undefined");
	}
	if (!this.parent) return this.namespaceUri;
	return this.parent.documentNamespace();
}; */
export function documentNamespace(e : XmlElement) : string | null {
	if (e == null) {
		throw new TypeError("documentNamespace called on null or undefined");
	}
	if (!e.parent) return e.namespaceUri;
	return documentNamespace(e.parent as XmlElement);
}

/* XmlElement.prototype.countChildElements = function (childElementName) {
	if (this == null) {
		throw new TypeError("XmlElement.countChildElements called on null or undefined");
	}
	let r = 0;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	this?.forEachNamedChildElement(childElementName, (elem) => r++);
	return r;
} */
export function countChildElements(e : XmlElement, childElementName: string) : number {
	if (e == null) {
		throw new TypeError("countChildElements called on null or undefined");
	}
	let r = 0;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	forEachNamedChildElement(e, childElementName, (elem) => r++);
	return r; 
}


/* XmlDocument.prototype.hasChildren = function () {
	if (this == null) {
		throw new TypeError("XmlDocument.hasChilden called on null or undefined");
	}
	let child = this?.root.firstChild;
	while (child) {
		if (child instanceof XmlElement) return true;
		child = child.next;
	}
	return false;
}; */
export function doc_hasChildren(d : XmlDocument) : boolean {
	if (d == null) {
		throw new TypeError("documentHasChildren called on null or undefined");
	}	
	let child = d.root.firstChild;
	while (child) {
		if (child instanceof XmlElement) return true;
		child = child.next;
	}
	return false; 
}


/* XmlDocument.prototype.forEachChildElement = function (func) {
	if (this == null) {
		throw new TypeError("XmlDocument.forEachChildElement called on null or undefined");
	}
	let child = this?.firstChild;
	while (child) {
		if (child instanceof XmlElement) 
			func(child);
		child = child.next;
	}
} */
export function doc_forEachChildElement(d : XmlDocument, func : (child: XmlElement) => void) {
	if (d == null) {
		throw new TypeError("documentForEachChildElement called on null or undefined");
	}
	let child = d.root.firstChild;
	while (child) {
		if (child instanceof XmlElement)
			func(child as XmlElement);
		child = child.next;
	}	
}

/* XmlDocument.prototype.forEachNamedChildElement = function (name, func) {
	if (this == null) {
		throw new TypeError("XmlDocument.forEachNamedChildElement called on null or undefined");
	}
	let child = this?.root.firstChild;
	while (child) {
		if (child instanceof XmlElement && (Array.isArray(name) ? name.includes(child.name) : child.name == name)) 
			func(child);
		child = child.next;
	}
} */
export function doc_forEachNamedChildElement(d : XmlDocument, name: string | string[], func : (child: XmlElement) => void) {
	if (d == null) {
		throw new TypeError("documentForEachNamedChildElement called on null or undefined");
	}
	let child = d.root.firstChild;
	while (child) {
		if (child instanceof XmlElement && (Array.isArray(name) ? name.includes(child.name) : child.name == name))	
			func(child as XmlElement);
		child = child.next;
	}
}