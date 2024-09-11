/**
 * classification_scheme.js
 *
 * Manages Classification Scheme loading and checking
 */
import { readFile, readFileSync } from "fs";

import chalk from "chalk";
import { AvlTree } from "@datastructures-js/binary-search-tree";
import { parseXmlString } from "libxmljs2";
import fetchS from "sync-fetch";

import { dvb } from "./DVB_definitions.js";
import { handleErrors } from "./fetch_err_handler.js";
import { hasChild } from "./schema_checks.js";
import { isHTTPURL } from "./pattern_checks.js";

export const CS_URI_DELIMITER = ":";

/**
 * Constructs a linear list of terms from a heirarical clssification schemes which are read from an XML document and parsed by libxmljs
 *
 * @param {String} CSuri           the classification scheme domian
 * @param {Object} term            the classification scheme term that may include nested subterms
 * @param {boolean} leafNodesOnly  flag to indicate if only the leaf <term> values are to be loaded
 */
function addCSTerm(vals, CSuri, term, leafNodesOnly = false) {
	if (term.type() != "element") return;
	if (term.name() == dvb.e_Term) {
		if (!leafNodesOnly || (leafNodesOnly && !hasChild(term, dvb.e_Term))) if (term.attr(dvb.a_termID)) vals.push(`${CSuri}${CS_URI_DELIMITER}${term.attr(dvb.a_termID).value()}`);
		let st = 0,
			subTerm;
		while ((subTerm = term.child(st++)) != null) addCSTerm(vals, CSuri, subTerm, leafNodesOnly);
	}
}

/**
 * load the hierarical values from an XML classification scheme document into a linear list
 *
 * @param {String} xmlCS             the XML document  of the classification scheme
 * @param {boolean} leafNodesOnly    flag to indicate if only the leaf <term> values are to be loaded
 * @returns {Object} values parsed from the classification scheme in .vals and uri of classification scheme in .uri
 */
function loadClassificationScheme(xmlCS, leafNodesOnly = false) {
	let rc = { uri: null, vals: [] };
	if (!xmlCS) return rc;

	const CSnamespace = xmlCS.root().attr(dvb.a_uri);
	if (!CSnamespace) return rc;
	rc.uri = CSnamespace.value();
	let t = 0,
		term;
	while ((term = xmlCS.root().child(t++)) != null) addCSTerm(rc.vals, rc.uri, term, leafNodesOnly);
	return rc;
}

export default class ClassificationScheme {
	#values;
	#schemes;
	#leafsOnly;

	constructor() {
		this.#values = new AvlTree();
		this.#schemes = [];
		this.#leafsOnly = false;
		loadClassificationScheme.bind(this);
	}

	count() {
		return this.#values.count();
	}

	empty() {
		this.#values.clear();
		this.#schemes = [];
	}

	insertValue(key, value = true) {
		if (key != "") this.#values.insert(key, value);
	}

	valuesRange() {
		return this.#leafsOnly ? "-only leaf nodes are used from the CS" : "all nodes in the CS are used";
	}

	/**
	 * read a classification scheme from a URL and load its hierarical values into a linear list 
	 *
	 * @param {String} csURL URL to the classification scheme

	 */
	#loadFromURL(csURL, async=true) {
		const isHTTPurl = isHTTPURL(csURL);
		console.log(chalk.yellow(`${isHTTPurl ? "" : "--> NOT "}retrieving CS (${this.#leafsOnly ? "leaf" : "all"} nodes) from ${csURL} via fetch()`));
		if (!isHTTPurl) return;

		if (async)
			fetch(csURL)
				.then(handleErrors)
				.then((response) => response.text())
				.then((strXML) => loadClassificationScheme(parseXmlString(strXML), this.#leafsOnly))
				.then((res) => {
					res.vals.forEach((e) => {
						this.insertValue(e, true);
					});
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
					let CStext = loadClassificationScheme(parseXmlString(resp.text()), this.#leafsOnly);
					CStext.vals.forEach((e) => {
						this.insertValue(e, true);
					});
					this.#schemes.push(CStext.uri);
				}
				else console.log(chalk.red(`error (${resp.status}:${resp.statusText}) handling ${ref}`));
			}
		}
	}

	/**
	 * read a classification scheme from a local file and load its hierarical values into a linear list
	 *
	 * @param {String} classificationScheme the filename of the classification scheme
	 */
	#loadFromFile(classificationScheme, async=true) {
		console.log(chalk.yellow(`reading CS (${this.#leafsOnly ? "leaf" : "all"} nodes) from ${classificationScheme}`));

		if (async)
			readFile(classificationScheme, { encoding: "utf-8" }, (err, data) => {
				if (!err) {
					let res = loadClassificationScheme(parseXmlString(data.replace(/(\r\n|\n|\r|\t)/gm, "")), this.#leafsOnly);
					res.vals.forEach((e) => {
						this.insertValue(e, true);
					});
					this.#schemes.push(res.uri);
				} else console.log(chalk.red(err));
			});
		else {
			let buff = readFileSync(classificationScheme, { encoding: "utf-8" });
			let data = buff.toString();
			let res = loadClassificationScheme(parseXmlString(data.replace(/(\r\n|\n|\r|\t)/gm, "")), this.#leafsOnly);
			res.vals.forEach((e) => {
				this.insertValue(e, true);
			});
			this.#schemes.push(res.uri);
		}
	}

	loadCS(options, async=true) {
		if (!options) options = {};
		if (!Object.prototype.hasOwnProperty.call(options, "leafNodesOnly")) options.leafNodesOnly = false;
		this.#leafsOnly = options.leafNodesOnly;

		if (options.file) this.#loadFromFile(options.file, async);
		if (options.files) options.files.forEach((file) => this.#loadFromFile(file, async));
		if (options.url) this.#loadFromURL(options.url, async);
		if (options.urls) options.urls.forEach((url) => this.#loadFromURL(url, async));
	}

	/**
	 * determines if the value is in the classification scheme
	 *
	 * @param {String} value    The value to check for existance
	 * @returns {boolean} true if value is in the classification scheme
	 */
	isIn(value) {
		return this.#values.has(value);
	}

	/**
	 * determines if the scheme used by the provided term is included
	 * @param {String} term     The term whose scheme should bechecked
	 * @returns {boolean}
	 */
	hasScheme(term) {
		const pos = term.lastIndexOf(CS_URI_DELIMITER);
		if (pos == -1) return false;
		return this.#schemes.includes(term.slice(0, pos));
	}

	showMe(prefix = "") {
		console.log(`in showme("${prefix}"), count=${this.#values.count()}`);
		this.#values.traverseInOrder((node) => {
			if (prefix == "" || node.getValue().beginsWith(prefix)) console.log(node.getValue());
		});
	}

}
