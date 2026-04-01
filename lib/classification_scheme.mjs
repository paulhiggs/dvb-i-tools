/**
 * classification_scheme.mjs
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Manages Classification Scheme loading and checking
 */

import { readFile, readFileSync } from "fs";

import chalk from "chalk";
import { AvlTree } from "@datastructures-js/binary-search-tree";
import fetchS from "sync-fetch";

import { XmlDocument, XmlElement } from "libxml2-wasm";

import { dvb } from "./DVB_definitions.mjs";
import handleErrors from "./fetch_err_handler.mjs";
import { isHTTPURL } from "./pattern_checks.mjs";
import { datatypeIs } from "./utils.mjs";

export const CS_URI_DELIMITER = ":";

/**
 * Constructs a linear list of terms from a heirarical clssification schemes which are read from an XML document and parsed by libxmljs
 *
 * @param {Array}      vals           the array to add the CS term into
 * @param {String}     CSuri          the classification scheme domian
 * @param {XmlElement} term           the classification scheme term that may include nested subterms
 */
function addCSTerm(vals, CSuri, term) {
	if (!(term instanceof XmlElement)) return;
	if (term.name == dvb.e_Term) {
		const termId = term.attrAnyNsValueOr(dvb.a_termID, null);
		if (termId) 
			vals.push({
				term:`${CSuri}${CS_URI_DELIMITER}${termId}`,
				leaf: !term.hasChild(dvb.e_Term),		
			});
		let subTerm = term.firstChild;
		while (subTerm) {
			addCSTerm(vals, CSuri, subTerm);
			subTerm = subTerm.next;
		}
	}
}

/**
 * load the hierarical values from an XML classification scheme document into a linear list
 *
 * @param {XmlDocument} xmlCS          the XML document  of the classification scheme
 * @returns {Object} values parsed from the classification scheme in .vals and uri of classification scheme in .uri
 */
function loadClassificationScheme(xmlCS) {
	let rc = { uri: null, vals: [] };
	if (!xmlCS) return rc;

	const CSnamespace = xmlCS.root.attrAnyNs(dvb.a_uri);
	if (!CSnamespace) return rc;
	rc.uri = CSnamespace.value;
	let term = xmlCS.root.firstChild;
	while (term) {
		addCSTerm(rc.vals, rc.uri, term);
		term = term.next;
	}
	return rc;
}

export default class ClassificationScheme {
	#values;
	#useIteration; // introduced in 5.4.0 to reduce risk of stack overflow woth very large trees
	#schemes;

	constructor() {
		this.#values = new AvlTree((a,b) => a.term ? a.term.localeCompare(b.term) : 1, { key: 'term'});
		this.#useIteration = this.#values?.insertIterative != undefined;
		this.#schemes = [];
		loadClassificationScheme.bind(this);
	}

	count() {
		return this.#values.count();
	}

	empty() {
		this.#values.clear();
		this.#schemes = [];
	}

	insertValue(key) {
		if (key) {
			if (this.#useIteration)
				this.#values.insertIterative(key)
			else this.#values.insert(key);	
		}
	}

	/**
	 * read a classification scheme from a URL and load its hierarical values into a linear list
	 *
	 * @param {String}  csURL URL to the classification scheme
	 * @param {boolean} async
	 */
	#loadFromURL(csURL, async = true) {
		const isHTTPurl = isHTTPURL(csURL);
		console.log(chalk.yellow(`${isHTTPurl ? "" : "--> NOT "}retrieving CS from ${csURL} via fetch()`));
		if (!isHTTPurl) return;

		if (async)
			fetch(csURL)
				.then(handleErrors)
				.then((response) => response.text())
				.then((strXML) => loadClassificationScheme(XmlDocument.fromString(strXML)))
				.then((res) => {
					res.vals.forEach((e) => this.insertValue(e) );
					this.#schemes.push(res.uri);
				})
				.catch((error) => console.log(chalk.red(`error (${error}) retrieving ${csURL}`)));
		else {
			let resp = null;
			try {
				resp = fetchS(csURL);
			} catch (error) {
				console.log(chalk.red(error.message));
			}
			if (resp) {
				if (resp.ok) {
					let CStext = loadClassificationScheme(XmlDocument.fromString(resp.content));
					CStext.vals.forEach((e) => this.insertValue(e));
					this.#schemes.push(CStext.uri);
				} else console.log(chalk.red(`error (${resp.status}:${resp.statusText}) handling ${csURL}`));
			}
		}
	}

	/**
	 * read a classification scheme from a local file and load its hierarical values into a linear list
	 *
	 * @param {String} classificationScheme the filename of the classification scheme
	 * @param {boolean} async
	 */
	#loadFromFile(classificationScheme, async = true) {
		console.log(chalk.yellow(`reading CS from ${classificationScheme}`));

		if (async)
			readFile(classificationScheme, { encoding: "utf-8" }, (err, data) => {
				if (!err) {
					let res = loadClassificationScheme(XmlDocument.fromString(data.replace(/(\r\n|\n|\r|\t)/gm, "")));
					res.vals.forEach((e) => this.insertValue(e));
					this.#schemes.push(res.uri);
				} else console.log(chalk.red(err));
			});
		else {
			let buff = readFileSync(classificationScheme, { encoding: "utf-8" });
			let data = buff.toString();
			let res = loadClassificationScheme(XmlDocument.fromString(data.replace(/(\r\n|\n|\r|\t)/gm, "")));
			res.vals.forEach((e) => this.insertValue(e));
			this.#schemes.push(res.uri);
		}
	}

	loadCS(options, async = true, extra_vals = null) {
		if (!options) options = {};

		if (options.file) this.#loadFromFile(options.file, async);
		if (options.files) options.files.forEach((file) => this.#loadFromFile(file, async));
		if (options.url) this.#loadFromURL(options.url, async);
		if (options.urls) options.urls.forEach((url) => this.#loadFromURL(url, async));

		if (extra_vals && datatypeIs(extra_vals, "array")) {
			extra_vals.forEach((v) => {
				if (datatypeIs(v, "string")) this.insertValue(v, true);
			});
		}
	}

	/**
	 * determines if the value is in the classification scheme
	 *
	 * @param {String} value    The value to check for existance
	 * @returns {boolean} true if value is in the classification scheme
	 */
	isIn(value) {
		return this.#useIteration ? this.#values.hasIterative({term:value}) : this.#values.has({term:value});
	}

		/**
	 * determines if the value is in the classification scheme and is a leaf node
	 *
	 * @param {String} value    The value to check for existance
	 * @returns {boolean} true if value is a leaf nodein the classification scheme
	 */
	isLeaf(value) {
		const node = this.#values.find({term: value});
		return node ? node.leaf : false;
	}

	/**
	 * determines if the scheme used by the provided term is included
	 * @param {String} scheme     The term whose scheme should bechecked
	 * @returns {boolean}
	 */
	hasScheme(scheme) {
		const pos = scheme.lastIndexOf(CS_URI_DELIMITER);
		if (pos == -1) return false;
		return this.#schemes.includes(scheme.slice(0, pos));
	}

	showMe(prefix = "") {
		console.log(`in showme(${prefix.quote()}), count=${this.#values.count()}`);
		let showNode = (node) => {
			if (prefix == "" || node.term.beginsWith(prefix)) 
				console.log(`${node.term}${node.leaf?" \u{1f33f}":""}`);
			}
		if (this.#useIteration)
			this.#values.traverseInOrderIterative((node) => showNode(node.getValue()));
		else
			this.#values.traverseInOrder((node) => showNode(node.getValue()));
	}
}
