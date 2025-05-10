/**
 * libxml2-wasm-extensions.js
 *
 * Additional functions to help libxml2-wasm (https://jameslan.github.io/libxml2-wasm/v0.5/) align 
 * with the formerly used libxmljs2 (https://github.com/marudor/libxmljs2)
 */
import chalk from "chalk";
import { XmlDocument, XmlElement } from "libxml2-wasm";

console.log(chalk.cyan('initialize extensions'));

/**
 * find the named attribute in an element without considering the namespace
 */
if (!XmlElement.prototype.attrAnyNs) {
	XmlElement.prototype.attrAnyNs = function (name) {
		let rc = null;
		this.attrs.forEach(function(a) { 
			if (a.name == name) 
				rc = a;
			});
		return rc;
	}
}


export let  Libxml2_wasm_init = () => {};
