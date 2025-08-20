/**
 * libxml2-wasm-extensions.mjs
 *
 * Additional functions to help libxml2-wasm (https://jameslan.github.io/libxml2-wasm/v0.5/) align
 * with the formerly used libxmljs2 (https://github.com/marudor/libxmljs2)
 */
import chalk from "chalk";
import { XmlDocument, XmlElement } from "libxml2-wasm";

console.log(chalk.yellow.underline("initialize extensions"));

const DEFAULT_TAG = "__DeFaUlT__";

/**
 * find the named attribute in an element without considering the namespace
 * return a pointer to the XmlAttribute object or null if not found
 */
if (!XmlElement.prototype.attrAnyNs) {
	XmlElement.prototype.attrAnyNs = function (name) {
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
		let rc = this.attrs.find((a) => a.name == name);
		return rc ? rc.value : default_value;
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

if (!XmlElement.prototype.getAnyNs) {
	XmlElement.prototype.getAnyNs = function (_name, _index = 1) {
		if (this == null) {
			throw new TypeError("XmlDocument.prototype.getAnyNs called on null or undefined");
		}
		if (!_name) {
			throw new TypeError("XmlDocument.prototype.getAnyNS called without name");
		}
		let ix = 0,
			child = this.firstChild;
		while (child) {
			if (child instanceof XmlElement && child.name == _name) {
				if (++ix == _index) return child;
			}
			child = child.next;
		}
	};
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
		discovery_prefix: null,
	};
	if (res.prefix == "") {
		res.prefix = DEFAULT_TAG;
		res.schema[res.prefix] = res.namespace;
		element.addNsDeclaration(res.namespace, res.prefix);
	}
	Object.getOwnPropertyNames(res.schema).forEach((property) => {
		if (res.schema[property].includes("urn:tva")) res.tva_prefix = property;
		if (res.schema[property].includes("servicediscovery-types")) res.datatypes_prefix = property;
		if (res.schema[property].includes(":servicelistdiscovery:")) res.discovery_prefix = property;
		if (res.schema[property].includes("tva:mpeg7")) res.mpeg7_prefix = property;
	});
	return res;
};

export let Libxml2_wasm_init = () => {};
