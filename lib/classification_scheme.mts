/**
 * classification_scheme.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Manages Classification Scheme loading and checking
 */

import { readFile, readFileSync } from "fs";
import { XmlElement, XmlDocument } from "libxml2-wasm";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import{ countChildElements, documentNamespace, forEachNamedChildElement, forEachChildElement, hasChildren, hasChild, getAnyNs, attrAnyNsValueOrNull, attrAnyNsValueOr, attrAnyNs, doc_forEachNamedChildElement, doc_forEachChildElement, doc_hasChildren } from "../libxml2-wasm-extensions.mts";

import chalk from "chalk";
import { AvlTree } from "@datastructures-js/binary-search-tree";
import * as fetchS from "sync-fetch";

import { dvb } from "./DVB_definitions.mts";
import handleErrors from "./fetch_err_handler.mts";
import { isHTTPURL } from "./pattern_checks.mts";

export const CS_URI_DELIMITER = ":";


type SchemeLoadOptions = { 
	url?: string,
	urls?: string[],
	file?: string,
	files?: string[],
}	

type TermNode = {
	term: string;
	leaf?: boolean;
}

/**
 * Constructs a linear list of terms from a heirarical clssification schemes which are read from an XML document and parsed by libxmljs
 *
 * @param {Array<TermNode>} vals   the array to add the CS term into
 * @param {string | null}   CSuri  the classification scheme domian
 * @param {XmlElement}      term   the classification scheme term that may include nested subterms
 */
function addCSTerm(vals : Array<TermNode>, CSuri: string | null, term: XmlElement) {
	if (!(term instanceof XmlElement)) return;
	if (term.name == dvb.e_Term) {
		const termId = attrAnyNsValueOrNull(term, dvb.a_termID);
		if (termId) 
			vals.push({
				term:`${CSuri}${CS_URI_DELIMITER}${termId}`,
				leaf: !hasChild(term, dvb.e_Term),		
			});
		let subTerm = term.firstChild;
		while (subTerm) {
			addCSTerm(vals, CSuri, subTerm as XmlElement);
			subTerm = subTerm.next;
		}
	}
}

/**
 * load the hierarical values from an XML classification scheme document into a linear list
 *
 * @param {XmlDocument} xmlCS          the XML document  of the classification scheme
 * @returns {LoadedTerms_type} values parsed from the classification scheme in .vals and uri of classification scheme in .uri
 */
type LoadedTerms_type = {
	uri: string | null,
	vals: TermNode[],
}
function loadClassificationScheme(xmlCS: XmlDocument): LoadedTerms_type {
	const rc : LoadedTerms_type = { uri: null, vals: [] };
	if (!xmlCS) return rc;

	const CSnamespace = attrAnyNs(xmlCS.root, dvb.a_uri);
	if (!CSnamespace) return rc;
	rc.uri = CSnamespace.value;
	let term = xmlCS.root.firstChild;
	while (term) {
		addCSTerm(rc.vals, rc.uri, term as XmlElement);
		term = term.next;
	}
	return rc;
}

export default class ClassificationScheme {
	private values: AvlTree<TermNode>;
	private useIteration: boolean; // introduced in 5.4.0 to reduce risk of stack overflow woth very large trees
	private schemes: string[];

	constructor() {
		this.values = new AvlTree((a: TermNode, b: TermNode) => a.term ? a.term.localeCompare(b.term) : 1, { key: 'term'});
		this.useIteration = this.values?.insertIterative != undefined;
		this.schemes = [];
		loadClassificationScheme.bind(this);
	}

	count() {
		return this.values.count();
	}

	empty() {
		this.values.clear();
		this.schemes = [];
	}

	insertValue(key : TermNode) {
		if (key) {
			if (this.useIteration)
				this.values.insertIterative(key)
			else this.values.insert(key);	
		}
	}

	/**
	 * read a classification scheme from a URL and load its hierarical values into a linear list
	 *
	 * @param {string}  csURL URL to the classification scheme
	 * @param {boolean} async
	 */
	private loadFromURL(csURL: string, async: boolean = true) {
		const isHTTPurl = isHTTPURL(csURL);
		console.log(chalk.yellow(`${isHTTPurl ? "" : "--> NOT "}retrieving CS from ${csURL} via fetch()`));
		if (!isHTTPurl) return;

		if (async)
			fetch(csURL)
				.then(handleErrors)
				.then((response) => response.text())
				.then((strXML) => loadClassificationScheme(XmlDocument.fromString(strXML)))
				.then((res) => {
					res.vals.forEach((e) => this.insertValue(e));
					if (res.uri) this.schemes.push(res.uri);
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
					const CStext = loadClassificationScheme(XmlDocument.fromString(resp.text()));
					CStext.vals.forEach((e) => this.insertValue(e));
					if (CStext.uri) this.schemes.push(CStext.uri);
				} else console.log(chalk.red(`error (${resp.status}:${resp.statusText}) handling ${csURL}`));
			}
		}
	}

	/**
	 * read a classification scheme from a local file and load its hierarical values into a linear list
	 *
	 * @param {string} classificationScheme the filename of the classification scheme
	 * @param {boolean} async
	 */
	private loadFromFile(classificationScheme: string, async: boolean = true) {
		console.log(chalk.yellow(`reading CS from ${classificationScheme}`));

		if (async)
			readFile(classificationScheme, { encoding: "utf-8" }, (err, data) => {
				if (!err) {
					const res : LoadedTerms_type = loadClassificationScheme(XmlDocument.fromString(data.replace(/(\r\n|\n|\r|\t)/gm, "")));
					res.vals.forEach((e) => this.insertValue(e));
					if (res.uri) this.schemes.push(res.uri);
				} else console.log(chalk.red(err));
			});
		else {
			const buff = readFileSync(classificationScheme, { encoding: "utf-8" });
			const data = buff.toString();
			const res = loadClassificationScheme(XmlDocument.fromString(data.replace(/(\r\n|\n|\r|\t)/gm, "")));
			res.vals.forEach((e) => this.insertValue(e));
			if (res.uri) this.schemes.push(res.uri);
		}
	}

	loadCS(options : SchemeLoadOptions, async: boolean = true, extra_vals: string[] = []) {
		if (!options) options = {};

		if (options.file) this.loadFromFile(options.file, async);
		if (options.files) options.files.forEach((file) => this.loadFromFile(file, async));
		if (options.url) this.loadFromURL(options.url, async);
		if (options.urls) options.urls.forEach((url) => this.loadFromURL(url, async));

		extra_vals.forEach((v) => this.insertValue({term: v, leaf: true}));
	}

	/**
	 * determines if the value is in the classification scheme
	 *
	 * @param {string} value    The value to check for existance
	 * @returns {boolean} true if value is in the classification scheme
	 */
	isIn(value: string) : boolean {
		return this.useIteration ? this.values.hasIterative({term:value}) : this.values.has({term:value});
	}

		/**
	 * determines if the value is in the classification scheme and is a leaf node
	 *
	 * @param {string} value    The value to check for existance
	 * @returns {boolean} true if value is a leaf nodein the classification scheme
	 */
	isLeaf(value: string): boolean {
		const node = this.values.find({term: value});
		return node && node.getValue().leaf;
	}

	/**
	 * determines if the scheme used by the provided term is included
	 * @param {string} scheme     The term whose scheme should bechecked
	 * @returns {boolean}
	 */
	hasScheme(scheme: string) : boolean {
		const pos = scheme.lastIndexOf(CS_URI_DELIMITER);
		if (pos == -1) return false;
		return this.schemes.includes(scheme.slice(0, pos));
	}

	showMe(prefix = "") {
		console.log(`in showme(${prefix.quote()}), count=${this.values.count()}`);
		const showNode = (node : TermNode) => {
			if (prefix == "" || node.term.startsWith(prefix)) 
				console.log(`${node.term}${node.leaf?" \u{1f33f}":""}`);
			}
		if (this.useIteration)
			this.values.traverseInOrderIterative((node) => showNode(node.getValue()));
		else
			this.values.traverseInOrder((node) => showNode(node.getValue()));
	}
}
