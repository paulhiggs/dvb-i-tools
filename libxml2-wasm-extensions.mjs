/**
 * libxml2-wasm-extensions.mjs
 *
 * Additional functions to help libxml2-wasm (https://jameslan.github.io/libxml2-wasm/v0.5/) align 
 * with the formerly used libxmljs2 (https://github.com/marudor/libxmljs2)
 */
import chalk from "chalk";
import { XmlDocument, XmlElement } from "libxml2-wasm";

console.log(chalk.yellow.underline('initialize extensions'));

/**
 * find the named attribute in an element without considering the namespace 
 * return a pointer to the XmlAttribute object or null if not found
 */
if (!XmlElement.prototype.attrAnyNs) {
	XmlElement.prototype.attrAnyNs = function (name) {
		let rc = this.attrs.find((a) => a.name == name)
		return rc ? rc : null;
	}
}

/**
 * find the named attribute in an element without considering the namespace and return its value
 * if not found, return the @default_value value
 */
if (!XmlElement.prototype.attrAnyNsValueOr) {
	XmlElement.prototype.attrAnyNsValueOr = function (name, default_value) {
		let rc = this.attrs.find((a) => a.name == name)
		return rc ? rc.value : default_value;
	}
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
	XmlDocument.prototype.childNodes = function () {
		if (this == null) {
			throw new TypeError("XmlDocument.prototype.childNodes called on null or undefined");
		}
		let res = [];
		let child = this.root.firstChild;
		while (child) {
			if (child instanceof XmlElement) res.push(child);
			child = child.next;
		}
		return res;
	};
}


if (!XmlElement.prototype.prettyPrint) {
	XmlElement.prototype.prettyPrint = function (indent = "") {
		if (!this || !this?.name) return "";
		let qualifyName = (_this) => (_this.namespacePrefix && _this.namespacePrefix.length ? `${_this.namespacePrefix}:` : "") + _this.name;
		let isStructureElement = (_this) => (_this.__proto__.constructor.name == "XmlElement");
		// to be a leaf node, all child nodes must be textual
		let isLeafElement = (_this) => {
			let leaf=true, kid = _this.firstChild;
			while (leaf && kid) {
				if (kid.__proto__.constructor.name != "XmlText")
					leaf = false;
				kid = kid.next;
			}
			return leaf;
		}

		let t = indent + "<" + qualifyName(this);
		this.attrs?.forEach((a) => {
			t += ` ${qualifyName(a)}="${a.value}"`;
		});
		if (isLeafElement(this))
			t += this.content.length ? `>${this.content}</${qualifyName(this)}>` : "/>";
		else
			t += (this.firstChild ? ">" : "/>");
		let child = this.firstChild;
		while (child) {
			if (child.__proto__.constructor.name == "XmlComment")
				t += `\n${indent}<!--${child.content}-->`;
			else if (isStructureElement(child))
				t += "\n" + child.prettyPrint(indent + "  ");
			child = child.next;
		}
		t += !isLeafElement(this) ? `\n${indent}</${qualifyName(this)}>` : ""; 

		return t;
	}
}


export let MakeDocumentProperties = (element) => {
	if (element.__proto__.constructor.name != "XmlElement") return {};
	let res = {
		schema: element.namespaces,
		namespace: element.namespaceUri,
		prefix: element.namespacePrefix,
		datatypes_prefix: null,
		tva_prefix: null,
		mpeg7_prefix: null,
	};
	if (res.prefix == "") {
		res.prefix = "__DeFaUlT__" 
		res.schema[res.prefix] = res.namespace;
		element.addNsDeclaration(res.namespace, res.prefix);
	}
	Object.getOwnPropertyNames(res.schema).forEach((prop) => {
		if (res.schema[prop].includes("urn:tva")) res.tva_prefix = prop;
		if (res.schema[prop].includes("servicediscovery-types")) res.datatypes_prefix = prop;
		if (res.schema[prop].includes("tva:mpeg7")) res.mpeg7_prefix = prop;
	});
	return res;
}

if (!Array.prototype.forEachSubElement) {
	// based on the polyfill at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
	/*
	 * alternate to Array.prototype.forEach that only returns XML tree nodes that are elements
	 */

	Array.prototype.forEachSubElement = function (callback, thisArg) {
		if (this == null) {
			throw new TypeError("Array.prototype.forEachSubElement called on null or undefined");
		}

		var T, k;
		// 1. Let O be the result of calling toObject() passing the
		// |this| value as the argument.
		var O = Object(this);

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
			var kValue;

			// a. Let Pk be ToString(k).
			//    This is implicit for LHS operands of the in operator
			// b. Let kPresent be the result of calling the HasProperty
			//    internal method of O with argument Pk.
			//    This step can be combined with c
			// c. If kPresent is true, then
			if (k in O) {
				// i. Let kValue be the result of calling the Get internal
				// method of O with argument Pk.
				kValue = O[k];

				// ii. Call the Call internal method of callback with T as
				// the this value and argument list containing kValue, k, and O.
				if (kValue instanceof XmlElement) callback.call(T, kValue, k, O);
			}
			// d. Increase k by 1.
			k++;
		}
		// 8. return undefined
	};
}


export let  Libxml2_wasm_init = () => {};
