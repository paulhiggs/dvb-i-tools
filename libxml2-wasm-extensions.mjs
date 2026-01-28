/**
 * libxml2-wasm-extensions.mjs
 *
 * Additional functions to help libxml2-wasm (https://jameslan.github.io/libxml2-wasm/v0.5/) align
 * with the formerly used libxmljs2 (https://github.com/marudor/libxmljs2)
 */
import chalk from "chalk";
//import { XmlDocument, XmlElement } from "libxml2-wasm";

console.log(chalk.yellow.underline("initialize libxml2-wasm extensions"));

/**
 * find the named attribute in an element without considering the namespace
 * return a pointer to the XmlAttribute object or null if not found
 */
if (!XmlElement.prototype.attrAnyNs) {
	XmlElement.prototype.attrAnyNs = function (name) {
		if (this == null) {
			throw new TypeError("XmlElement.prototype.attrAnyNs called on null or undefined");
		}
		let rc = this.attrs.find((a) => a.name == name);
		return rc ? rc : null;
	};
}

/**
 * find the named attribute in an element without considering the namespace and return its value
 * if not found, return the @default_value value
 */
if (!XmlElement.prototype.attrAnyNsValueOr) {
	XmlElement.prototype.attrAnyNsValueOr = function (name, default_value) {
		if (this == null) {
			throw new TypeError("XmlElement.prototype.attrAnyNsValueOr called on null or undefined");
		}
		let rc = this.attrs.find((a) => a.name == name);
		return rc ? rc.value : default_value;
	};
}
if (!XmlElement.prototype.attrAnyNsValueOrNull) {
	XmlElement.prototype.attrAnyNsValueOrNull = function (name) {
		if (this == null) {
			throw new TypeError("XmlElement.prototype.attrAnyNsValueOrNull called on null or undefined");
		}
		let rc = this.attrs.find((a) => a.name == name);
		return rc ? rc.value : null;
	};
}

if (!XmlElement.prototype.childNodes) {
	XmlElement.prototype.childNodes = function () {
		if (this == null) {
			throw new TypeError("XmlElement.prototype.childNodes called on null or undefined");
		}
		let res = [];
		let child = this.firstChild;
		while (child) {
			if (child instanceof XmlElement) res.push(child);
			child = child.next;
		}
		return res;
	};
}

if (!XmlDocument.prototype.childNodes) {
	XmlDocument.prototype.childNodes = function (named = undefined) {
		if (this == null) {
			throw new TypeError("XmlDocument.prototype.childNodes called on null or undefined");
		}
		let res = [];
		let child = this.root.firstChild;
		while (child) {
			if (child instanceof XmlElement) 
				if (named == undefined || named && named == child.name) res.push(child);
			child = child.next;
		}
		return res;
	};
}

if (!XmlElement.prototype.getAnyNs) {
	XmlElement.prototype.getAnyNs = function (_name, _index = 1) {
		if (this == null) {
			throw new TypeError("XmlDocument.prototype.getAnyNs called on null or undefined");
		}
		if (!_name) {
			throw new Error("XmlDocument.prototype.getAnyNs called without name");
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
	};
}

if (!XmlElement.prototype.hasChild) {
	XmlElement.prototype.hasChild = function (_childName) {
		if (this == null) {
			throw new TypeError("XmlElement.prototype.hasChild called on null or undefined");
		}
		if (!_childName) {
			throw new Error("XmlElement.prototype.hasChild called without name");
		}
		let child = this?.firstChild;
		while (child) {
			if (child?.name?.endsWith(_childName)) return true;
			child = child.next;
		}
		return false;
	};
}


if (!XmlElement.prototype.documentNamespace) {
	XmlElement.prototype.documentNamespace = function () {
		if (this == null) {
			throw new TypeError("XmlDocument.prototype.documentNamespace called on null or undefined");
		}
		if (!this.parent) return this.namespaceUri;
		return this.parent.documentNamespace();
	};
}



/**
 * Iterate over the array invoking the callback in the array item is an XmlElement
 *
 * @param {function} callback     function to be invoked - same approach as Array.forEach()
 */
if (!XmlElement.prototype.forEachSubElement) {
	XmlElement.prototype.forEachSubElement = function (callback, thisArg) {
		if (this == null) {
			throw new TypeError("XmlElement.prototype.forEachSubElement called on null or undefined");
		}

		var T, k;
		// 1. Let O be the result of calling toObject() passing the
		// |this| value as the argument.
		var O = this.childNodes();

		// 2. Let lenValue be the result of calling the Get() internal
		// method of O with the argument "length".
		// 3. Let len be toUint32(lenValue).
		var len = O.length >>> 0;

		// 4. If isCallable(callback) is false, throw a TypeError exception.
		// See: https://es5.github.com/#x9.11
		if (typeof callback !== "function") {
			throw new TypeError(`${callback} is not a function`);
		}

		// 5. If thisArg was supplied, let T be thisArg; else let
		// T be undefined.
		if (arguments.length > 1) {
			T = thisArg;
		}

		// 6. Let k be 0
		k = 0;

		// 7. Repeat, while k < len
		while (k < len) {
			var kValue = O[k];

			if (kValue instanceof XmlElement) callback.call(T, kValue, k, O);

			k++;
		}
		// 8. return undefined
	};
}

/**
 * Iterate over the array invoking the callback if the array item is an XmlElement with the specified name
 *
 * @param {String or Array}   elementName  the name(s) of the element that we want the callback to be invoked for
 * @param {function} callback     function to be invoked - same approach as Array.forEach()
 */
if (!XmlElement.prototype.forEachNamedSubElement) {
	XmlElement.prototype.forEachNamedSubElement = function (elementName, callback, thisArg) {
		if (this == null) {
			throw new TypeError("XmlElement.prototype.forEachNamedSubElement called on null or undefined");
		}

		var T, k;
		// 1. Let O be the result of calling toObject() passing the
		// |this| value as the argument.
		var O =this.childNodes();

		// 2. Let lenValue be the result of calling the Get() internal
		// method of O with the argument "length".
		// 3. Let len be toUint32(lenValue).
		var len = O.length >>> 0;

		// 4. If isCallable(callback) is false, throw a TypeError exception.
		// See: https://es5.github.com/#x9.11
		if (typeof callback !== "function") {
			throw new TypeError(`${callback} is not a function`);
		}

		// 5. If thisArg was supplied, let T be thisArg; else let
		// T be undefined.
		if (arguments.length > 1) {
			T = thisArg;
		}

		// 6. Let k be 0
		k = 0;

		// 7. Repeat, while k < len
		while (k < len) {
			var kValue = O[k];

			if (kValue instanceof XmlElement && (Array.isArray(elementName) ? elementName.includes[kValue.name] : kValue.name == elementName)) 
				callback.call(T, kValue, k, O);
			k++;
		}
		// 8. return undefined
	};
}


if (!XmlElement.prototype.countChildren) {
	XmlElement.prototype.countChildren = function (named) {
		if (this == null) {
			throw new TypeError("XmlDocument.prototype.countChildren called on null or undefined");
		}
		if (!named) {
			throw new Error("XmlDocument.prototype.countChildren called without named");
		}
		let cnt = 0,
			child = this.firstChild;
		while (child) {
			if (child instanceof XmlElement && child.name == named) 
				cnt++;
			child = child.next;
		}
		return cnt;
	};
}


export let Libxml2_wasm_init = () => {};
