/**
 * libxml2-wasm-extensions.mjs
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Additional functions to help libxml2-wasm (https://jameslan.github.io/libxml2-wasm/v0.5/) align
 * with the formerly used libxmljs2 (https://github.com/marudor/libxmljs2)
 */
import chalk from "chalk";
import { XmlDocument, XmlElement } from "libxml2-wasm";

console.log(chalk.yellow.underline("initialize libxml2-wasm extensions"));

/**
 * find the named attribute without considering the namespace
 * return a pointer to the XmlAttribute object or null if not found
 */
if (!XmlElement.prototype.attrAnyNs) {
	XmlElement.prototype.attrAnyNs = function (name) {
		const rc = this.attrs.find((a) => a.name == name);
		return rc ? rc : null;
	};
}


/**
 * find the named attribute without considering the namespace and return its value
 * return a pointer to the XmlAttribute object or the @default_value value
 */
if (!XmlElement.prototype.attrAnyNsValueOr) {
	XmlElement.prototype.attrAnyNsValueOr = function (name, default_value = null) {
		const rc = this.attrs.find((a) => a.name == name);
		return rc ? rc.value : default_value;
	};
}


/**
 * find the nth instance of the named element without considering the namespace
 * return a pointer to the XmlElement object or null if not found
 */
if (!XmlElement.prototype.getAnyNs) {
	XmlElement.prototype.getAnyNs = function (name, index = 1) {
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
}


/**
 * return true there is at least one child element as named
 */
if (!XmlElement.prototype.hasChild) {
	XmlElement.prototype.hasChild = function (childName) {
		if (this == null) {
			throw new TypeError("XmlElement.prototype.hasChild called on null or undefined");
		}
		if (!childName) {
			throw new Error("XmlElement.prototype.hasChild called without name");
		}
		let child = this.firstChild;
		while (child) {
			if (child.name?.endsWith(childName)) return true;
			child = child.next;
		}
		return false;
	};
}


/**
 * return true there is at least one child element
 */
if (!XmlElement.prototype.hasChilden) {
	XmlElement.prototype.hasChildren = function () {
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
}


/**
 * invoke the given callback for each child element
 */
if (!XmlElement.prototype.forEachChildElement) {
	XmlElement.prototype.forEachChildElement = function (func) {
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
}


/**
 * invoke the given callback for each child with the given name (irrespective of namespace)
 */
if (!XmlElement.prototype.forEachNamedChildElement) {
	XmlElement.prototype.forEachNamedChildElement = function (name, func) {
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
}


/**
 * return true there is at least one child element
 */
if (!XmlDocument.prototype.hasChilden) {
	XmlDocument.prototype.hasChildren = function () {
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
}


/**
 * invoke the given callback for each child element
 */
if (!XmlDocument.prototype.forEachChildElement) {
	XmlDocument.prototype.forEachChildElement = function (func) {
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
}


/**
 * invoke the given callback for each child with the given name (irrespective of namespace)
 */
if (!XmlDocument.prototype.forEachNamedChildElement) {
	XmlDocument.prototype.forEachNamedChildElement = function (name, func) {
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
}


/**
 * return the namespace where the element is defined
 */
if (!XmlElement.prototype.documentNamespace) {
	XmlElement.prototype.documentNamespace = function () {
		if (this == null) {
			throw new TypeError("XmlDocument.prototype.hasChild called on null or undefined");
		}
		if (!this.parent) return this.namespaceUri;
		return this.parent.documentNamespace();
	};
}


/**
 * return a count of the number of named child elements (irrespective of namespace)
 */
if (!XmlElement.prototype.countChildElements) {
	XmlElement.prototype.countChildElements = function (childElementName) {
		if (this == null) {
			throw new TypeError("XmlElement.prototype.countChildElements called on null or undefined");
		}
		let r = 0;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		this.forEachNamedChildElement(childElementName, (elem) => r++);
		return r;
	}
}


export const Libxml2_wasm_init = () => {};
