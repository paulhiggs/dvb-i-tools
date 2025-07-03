/**
 * libxml2-wasm-extensions.ts
 *
 * Additional functions to help libxml2-wasm (https://jameslan.github.io/libxml2-wasm/v0.5/) align
 * with the formerly used libxmljs2 (https://github.com/marudor/libxmljs2)
 */
import chalk from "chalk";
import { XmlDocument, XmlElement, XmlText, XmlComment, XmlAttribute } from "libxml2-wasm";

console.log(chalk.yellow.underline("initialize extensions"));

/**
 * find the named attribute in an element without considering the namespace
 * return a pointer to the XmlAttribute object or null if not found
 */
declare module "libxml2-wasm" {
	interface XmlElement {
		attrAnyNs(name : string): XmlAttribute | undefined;
	}
}
if (!XmlElement.prototype.attrAnyNs) {
	XmlElement.prototype.attrAnyNs = function (name : string) {
		const rc = this.attrs.find((a : XmlAttribute) => a.name == name);
		return rc ? rc : undefined;
	};
}

/**
 * find the named attribute in an element without considering the namespace and return its value
 * if not found, return the @default_value value
 */
declare module "libxml2-wasm" {
	interface XmlElement {
		attrAnyNsValueOr(name : string, default_value : any): string | any;
	}
}
if (!XmlElement.prototype.attrAnyNsValueOr) {
	XmlElement.prototype.attrAnyNsValueOr = function (name, default_value) {
		let rc = this.attrs.find((a : XmlAttribute) => a.name == name);
		return rc ? rc.value : default_value;
	};
}

/**
 * find the named attribute in an element without considering the namespace and return its value
 * if not found, return the @default_value value
 */
declare module "libxml2-wasm" {
	interface XmlElement {
		attrAnyNsValueOrWithPrefix(name : string, prefix : string, default_value : any): string | any;
	}
}
if (!XmlElement.prototype.attrAnyNsValueOr) {
	XmlElement.prototype.attrAnyNsValueOrWithPrefix = function (name, prefix, default_value) {
		let rc = this.attrs.find((a : XmlAttribute) => a.name == name);
		return rc ? `${prefix}${rc.value}` : default_value;
	};
}

declare module "libxml2-wasm" {
	interface XmlElement {
		childNodes(): Array<XmlElement>;
	}
}
if (!XmlElement.prototype.childNodes) {
	XmlElement.prototype.childNodes = function () {
		if (this == null) {
			throw new TypeError("XmlElement.prototype.childNodes called on null or undefined");
		}
		let res : Array<XmlElement> = [];
		let child = this.firstChild;
		while (child) {
			if (child instanceof XmlElement) 
				res.push(child);
			child = child.next;
		}
		return res;
	};
}

declare module "libxml2-wasm" {
	interface XmlDocument {
		childNodes(): Array<XmlElement>;
	}
}
if (!XmlDocument.prototype.childNodes) {
	XmlDocument.prototype.childNodes = function () {
		if (this == null) {
			throw new TypeError("XmlDocument.prototype.childNodes called on null or undefined");
		}
		let res : Array<XmlElement> = [];
		let child = this.root.firstChild;
		while (child) {
			if (child instanceof XmlElement) 
				res.push(child);
			child = child.next;
		}
		return res;
	};
}

declare module "libxml2-wasm" {
	interface XmlElement {
		prettyPrint(indent? : string): string;
	}
}
if (!XmlElement.prototype.prettyPrint) {
	XmlElement.prototype.prettyPrint = function (indent = "") : string {
		if (!this || !this?.name) return "";
		let qualifyName = (_this : XmlAttribute | XmlElement) => (_this.namespacePrefix && _this.namespacePrefix.length ? `${_this.namespacePrefix}:` : "") + _this.name;
		let isStructureElement = (_this : XmlElement) => _this instanceof XmlElement;
		// to be a leaf node, all child nodes must be textual
		let isLeafElement = (_this : XmlElement) => {
			let leaf = true,
				kid = _this.firstChild;
			while (leaf && kid) {
				if (kid instanceof XmlText) leaf = false;
				kid = kid.next;
			}
			return leaf;
		};

		let t : string = indent + "<" + qualifyName(this);
		this.attrs?.forEach((attr : XmlAttribute) => {
			t += ` ${qualifyName(attr)}="${attr.value}"`;
		});
		if (isLeafElement(this)) 
			t += this.content.length ? `>${this.content}</${qualifyName(this)}>` : "/>";
		else t += this.firstChild ? ">" : "/>";
		let child = this.firstChild;
		while (child) {
			if (child instanceof XmlComment) 
				t += `\n${indent}<!--${child.content}-->`;
			else if (isStructureElement(child)) 
				t += "\n" + child.prettyPrint(indent + "  ");
			child = child.next;
		}
		t += !isLeafElement(this) ? `\n${indent}</${qualifyName(this)}>` : "";

		return t;
	};
}

export type DocumentProperties = {
	schema;
	namespace : string;
	prefix : string;
	datatypes_prefix? : string;
	tva_prefix? : string;
	mpeg7_prefix? : string;
}

export let MakeDocumentProperties = (element : XmlElement) : DocumentProperties=> {
	let res : DocumentProperties = {
		schema: element.namespaces,
		namespace: element.namespaceUri,
		prefix: element.namespacePrefix,
	};
	if (res.prefix == "") {
		res.prefix = "__DeFaUlT__";
		res.schema[res.prefix] = res.namespace;
		element.addNsDeclaration(res.namespace, res.prefix);
	}
	Object.getOwnPropertyNames(res.schema).forEach((property) => {
		if (res.schema[property].includes("urn:tva")) 
			res.tva_prefix = property;
		if (res.schema[property].includes("servicediscovery-types")) 
			res.datatypes_prefix = property;
		if (res.schema[property].includes("tva:mpeg7")) 
			res.mpeg7_prefix = property;
	});
	return res;
};

export let Libxml2_wasm_init = () => {};
