/**
 * libxml2-wasm-extensions.mjs
 *
 * Additional functions to help libxml2-wasm (https://jameslan.github.io/libxml2-wasm/v0.5/) align
 * with the formerly used libxmljs2 (https://github.com/marudor/libxmljs2)
 */
import chalk from "chalk";
import { XmlDocument, XmlElement } from "libxml2-wasm";

console.log(chalk.yellow.underline("initialize libxml2-wasm extensions"));

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
			throw new TypeError("XmlDocument.prototype.hasChild called on null or undefined");
		}
		if (!_childName) {
			throw new Error("XmlDocument.prototype.hasChild called without name");
		}
		let child = this?.firstChild;
		while (child) {
			if (child?.name?.endsWith(_childName)) return true;
			child = child.next;
		}
		return false;
	};
}


if (!XmlElement.prototype.hasChilden) {
	XmlElement.prototype.hasChildren = function () {
		if (this == null) {
			throw new TypeError("XmlDocument.prototype.hasChilden called on null or undefined");
		}
		let child = this?.firstChild;
		while (child) {
			if (child instanceof XmlElement) return true;
			child = child.next;
		}
		return false;
	};
}


if (!XmlElement.prototype.forEachChildElement) {
	XmlElement.prototype.forEachChildElement = function (func) {
		if (this == null) {
			throw new TypeError("XmlElement.prototype.forEachChildElement called on null or undefined");
		}
		let child = this?.firstChild;
		while (child) {
			if (child instanceof XmlElement) 
				func(child);
			child = child.next;
		}
	}
}


if (!XmlElement.prototype.forEachNamedChildElement) {
	XmlElement.prototype.forEachNamedChildElement = function (name, func) {
		if (this == null) {
			throw new TypeError("XmlElement.prototype.forEachNamedChildElement called on null or undefined");
		}
		if (!name) {
			throw new Error("XmlElement.prototype.forEachNamedChildElement called without name");
		}
		let child = this?.firstChild;
		while (child) {
			if (child instanceof XmlElement && (Array.isArray(name) ? name.includes(child.name) : child.name == name)) 
				func(child);
			child = child.next;
		}
	}
}


if (!XmlDocument.prototype.hasChilden) {
	XmlDocument.prototype.hasChildren = function () {
		if (this == null) {
			throw new TypeError("XmlDocument.prototype.hasChilden called on null or undefined");
		}
		let child = this?.root.firstChild;
		while (child) {
			if (child instanceof XmlElement) return true;
			child = child.next;
		}
		return false;
	};
}


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


if (!XmlDocument.prototype.forEachNamedChildElement) {
	XmlDocument.prototype.forEachNamedChildElement = function (name, func) {
		if (this == null) {
			throw new TypeError("XmlDocument.prototype.forEachNamedChildElement called on null or undefined");
		}
		if (!name) {
			throw new Error("XmlDocument.prototype.forEachNamedChildElement called without name");
		}
		let child = this?.root.firstChild;
		while (child) {
			if (child instanceof XmlElement && (Array.isArray(name) ? name.includes(child.name) : child.name == name)) 
				func(child);
			child = child.next;
		}
	}
}


if (!XmlElement.prototype.documentNamespace) {
	XmlElement.prototype.documentNamespace = function () {
		if (this == null) {
			throw new TypeError("XmlDocument.prototype.hasChild called on null or undefined");
		}
		if (!this.parent) return this.namespaceUri;
		return this.parent.documentNamespace();
	};
}

export let Libxml2_wasm_init = () => {};
