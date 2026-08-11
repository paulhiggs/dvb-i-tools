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

import { fetch_options } from "./globals.mjs";
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
		const termId = term.attrAnyNsValueOr(dvb.a_termID);
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
	const rc = { uri: null, vals: [] };
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
		this.#schemes = new Set();
		loadClassificationScheme.bind(this);
	}

	count() {
		return this.#values.count();
	}

		/**
	 * Remove all values from the classification scheme
	 *
	 * @deprecated Use clear() instead - it is better aligned with Set() and Map() methods
	 */
	empty() {
		this.clear();
	}

		/**
	 * Remove all values from the classification scheme
	 *
	 */
	clear() {
		this.#values.clear();
		this.#schemes.clear();
	}


	/**
	 * Add the provided value to the classification scheme
	 *
	 * @param {String} key the value to add to the classification scheme
	 * 
	 * @deprecated Use add() instead - it is better aligned with Set() and Map() methods
	 */
	insertValue(key) {
		this.add(key);
	}

	/**
	 * Add the provided value to the classification scheme
	 *
	 * @param {String} key the value to add to the classification scheme
	 */
	add(key) {
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
	 * @param {Boolean} async whether to use asynchronous fetch (true by default)
	 */
	#loadFromURL(csURL, async = true) {
		const isHTTPurl = isHTTPURL(csURL);
		console.log(chalk.yellow(`${isHTTPurl ? "" : "--> NOT "}retrieving CS from ${csURL} via fetch()`));
		if (!isHTTPurl) return;

		if (async)
			fetch(csURL, fetch_options)
				.then(handleErrors)
				.then((response) => response.text())
				.then((strXML) => loadClassificationScheme(XmlDocument.fromString(strXML)))
				.then((res) => {
					res.vals.forEach((e) => this.add(e) );
					this.#schemes.add(res.uri);
				})
				.catch((error) => console.log(chalk.red(`error (${error}) retrieving ${csURL}`)));
		else {
			let resp = null;
			try {
				resp = fetchS(csURL, fetch_options);
			} catch (error) {
				console.log(chalk.red(error.message));
			}
			if (resp) {
				if (resp.ok) {
					const CStext = loadClassificationScheme(XmlDocument.fromString(resp.text()));
					CStext.vals.forEach((e) => this.add(e));
					this.#schemes.add(CStext.uri);
				} else console.log(chalk.red(`error (${resp.status}:${resp.statusText}) handling ${csURL}`));
			}
		}
	}

	/**
	 * read a classification scheme from a local file and load its hierarical values into a linear list
	 *
	 * @param {String} classificationScheme the filename of the classification scheme
	 * @param {Boolean} async whether to use asynchronous file read (true by default)
	 * @param {boolean} verbose  display verbose output
	 */
	#loadFromFile(classificationScheme, async = true, verbose = true) {
		if (verbose) console.log(chalk.yellow(`reading CS from ${classificationScheme}`));

		if (async)
			readFile(classificationScheme, { encoding: "utf-8" }, (err, data) => {
				if (!err) {
					const res = loadClassificationScheme(XmlDocument.fromString(data.replace(/(\r\n|\n|\r|\t)/gm, "")));
					res.vals.forEach((e) => this.insertValue(e));
					this.#schemes.add(res.uri);
				} else console.log(chalk.red(err));
			});
		else {
			const buff = readFileSync(classificationScheme, { encoding: "utf-8" });
			const data = buff.toString();
			const res = loadClassificationScheme(XmlDocument.fromString(data.replace(/(\r\n|\n|\r|\t)/gm, "")));
			res.vals.forEach((e) => this.add(e));
			this.#schemes.add(res.uri);
		}
	}

	/**
	 * 
	 * @param {*} source list of URLs and/or files to load, e.g. {url: "http://example.com/roles.txt", file: "local_roles.txt"}
	 * @param {Boolean} opts.async	 whether to use asynchronous fetch/file read (true by default) 
	 * @param {boolean} opts.verbose  display verbose output
	 * @param {Array} extra_vals additional values to add to the classification scheme (e.g. from a config file) - these should be full URIs and will be added after any values loaded from files/URLs
	 */
	loadCS(source, options, extra_vals = null) {

		if (source.file) this.#loadFromFile(source.file, options.async, options.verbose);
		if (source.files) source.files.forEach((file) => this.#loadFromFile(file, options.async, options.verbose));
		if (source.url) this.#loadFromURL(source.url, options.async, options.verbose);
		if (source.urls) source.urls.forEach((url) => this.#loadFromURL(url, options.async, options.verbose));

		if (extra_vals && datatypeIs(extra_vals, "array")) {
			extra_vals.forEach((v) => {
				if (datatypeIs(v, "string")) this.add(v, true);
			});
		}
	}


	/**
	 * determines if the value is in the classification scheme
	 *
	 * @param {String} value    The value to check for existance
	 * @returns {boolean} true if value is in the classification scheme
	 */
	has(value) {
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
		return node ? node.getValue().leaf : false;
	}

	/**
	 * determines if the scheme used by the provided term is included
	 * @param {String} scheme     The term whose scheme should bechecked
	 * @returns {boolean}
	 */
	hasScheme(scheme) {
		const pos = scheme.lastIndexOf(CS_URI_DELIMITER);
		if (pos == -1) return false;
		return this.#schemes.has(scheme.slice(0, pos));
	}

	showMe(prefix = "") {
		console.log(`in showme(${prefix.quote()}), count=${this.#values.count()}`);
		const showNode = (node) => {
			if (prefix == "" || node.term.startsWith(prefix)) 
				console.log(`${node.term}${node.leaf?" \u{1f33f}":""}`);
			}
		if (this.#useIteration)
			this.#values.traverseInOrderIterative((node) => showNode(node.getValue()));
		else
			this.#values.traverseInOrder((node) => showNode(node.getValue()));
	}
}
