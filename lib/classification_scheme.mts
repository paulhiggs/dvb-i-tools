/**
 * classification_scheme.mts
 *
 * Manages Classification Scheme loading and checking
 */
import { readFile, readFileSync } from "fs";

import chalk from "chalk";
import { AvlTree } from "@datastructures-js/binary-search-tree";
import fetchS from "sync-fetch";

import { XmlDocument, XmlElement } from "libxml2-wasm";

import { dvb } from "./DVB_definitions.mts";
import handleErrors from "./fetch_err_handler.mts";
import { hasChild } from "./schema_checks.mts";
import { isHTTPURL } from "./pattern_checks.mts";
import { datatypeIs } from "../phlib/phlib.ts";

export type CSLoaderOptions = {
	urls? : Array<string>,
	url? : string,
	files? : Array<string>,
	file? : string,
	leafNodesOnly? : boolean,
}
type CSLoaderResponse = {
	uri : string | null,
	vals : Array<string>,
}

export const CS_URI_DELIMITER = ":";

/**
 * Constructs a linear list of terms from a heirarical clssification schemes which are read from an XML document and parsed by libxmljs
 *
 * @param {Array<string>} vals           the array to add the CS term into
 * @param {string}        CSuri          the classification scheme domian
 * @param {XmlElement}    term           the classification scheme term that may include nested subterms
 * @param {boolean}       leafNodesOnly  flag to indicate if only the leaf <term> values are to be loaded
 */
function addCSTerm(vals : Array<string>, CSuri : string, term : XmlElement, leafNodesOnly : boolean = false) {
	if (!(term instanceof XmlElement)) return;
	if (term.name == dvb.e_Term) {
		if (!leafNodesOnly || (leafNodesOnly && !hasChild(term, dvb.e_Term)))
			if (term.attrAnyNs(dvb.a_termID)) 
				vals.push(`${CSuri}${CS_URI_DELIMITER}${term.attrAnyNsValueOr(dvb.a_termID, "!empty!")}`);
		let subTerm = term.firstChild;
		while (subTerm) {
			addCSTerm(vals, CSuri, subTerm as XmlElement, leafNodesOnly);
			subTerm = subTerm.next;
		}
	}
}

/**
 * load the hierarical values from an XML classification scheme document into a linear list
 *
 * @param {XmlDocument} xmlCS            the XML document of the classification scheme
 * @param {boolean}     leafNodesOnly    flag to indicate if only the leaf <term> values are to be loaded
 * @returns {Object} values parsed from the classification scheme in .vals and uri of classification scheme in .uri
 */

function loadClassificationScheme(xmlCS : XmlDocument, leafNodesOnly : boolean = false) : CSLoaderResponse {
	let rc : CSLoaderResponse = { uri: null, vals: [] };

	const CSnamespace = xmlCS.root.attrAnyNs(dvb.a_uri);
	if (!CSnamespace) return rc;
	rc.uri = CSnamespace.value;
	let term = xmlCS.root.firstChild;
	while (term) {
		addCSTerm(rc.vals, rc.uri, term as XmlElement, leafNodesOnly);
		term = term.next;
	}
	return rc;
}

export default class ClassificationScheme {
	private values : AvlTree<string>;
	private schemes : Array<string>;
	private leafsOnly : boolean;

	constructor() {
		this.values = new AvlTree();
		this.schemes = [];
		this.leafsOnly = false;
		loadClassificationScheme.bind(this);
	}

	count() {
		return this.values.count();
	}

	empty() {
		this.values.clear();
		this.schemes = [];
	}

	insertValue(key : string) {
		if (key != "") this.values.insert(key);
	}

	valuesRange = () => this.leafsOnly ? "-only leaf nodes are used from the CS" : "all nodes in the CS are used";

	/**
	 * read a classification scheme from a URL and load its hierarical values into a linear list
	 *
	 * @param {String}  csURL URL to the classification scheme
	 * @param {boolean} async
	 */
	private loadFromURL(csURL : string, async : boolean = true) {
		const isHTTPurl : boolean = isHTTPURL(csURL);
		console.log(chalk.yellow(`${isHTTPurl ? "" : "--> NOT "}retrieving CS (${this.leafsOnly ? "leaf" : "all"} nodes) from ${csURL} via fetch()`));
		if (!isHTTPurl) return;

		if (async)
			fetch(csURL)
				.then(handleErrors)
				.then((response) => response.text())
				.then((strXML) => loadClassificationScheme(XmlDocument.fromString(strXML), this.leafsOnly))
				.then((res) => {
					res.vals.forEach((e) => {
						this.insertValue(e);
					});
					if (res.uri) 
						this.schemes.push(res.uri);
				})
				.catch((error) => console.log(chalk.red(`error (${error}) retrieving ${csURL}`)));
		else {
			let resp : any = null;
			try {
				resp = fetchS(csURL);
			} catch (error) {
				console.log(chalk.red(error.message));
			}
			if (resp) {
				if (resp.ok) {
					let CStext = loadClassificationScheme(XmlDocument.fromString(resp.content), this.leafsOnly);
					CStext.vals.forEach((e) => {
						this.insertValue(e);
					});
					if (CStext.uri)
						this.schemes.push(CStext.uri);
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
	private loadFromFile(classificationScheme : string, async : boolean = true) {
		console.log(chalk.yellow(`reading CS (${this.leafsOnly ? "leaf" : "all"} nodes) from ${classificationScheme}`));

		if (async)
			readFile(classificationScheme, { encoding: "utf-8" }, (err, data) => {
				if (!err) {
					let res = loadClassificationScheme(XmlDocument.fromString(data.replace(/(\r\n|\n|\r|\t)/gm, "")), this.leafsOnly);
					res.vals.forEach((e) => {
						this.insertValue(e);
					});
					if (res.uri)
						this.schemes.push(res.uri);
				} else console.log(chalk.red(err));
			});
		else {
			let buff = readFileSync(classificationScheme, { encoding: "utf-8" });
			let data = buff.toString();
			let res = loadClassificationScheme(XmlDocument.fromString(data.replace(/(\r\n|\n|\r|\t)/gm, "")), this.leafsOnly);
			res.vals.forEach((e) => {
				this.insertValue(e);
			});
			if (res.uri)
				this.schemes.push(res.uri);
		}
	}

	loadCS(options : CSLoaderOptions, async : boolean = true, extra_vals : Array<string> | null = null) {
		options.leafNodesOnly = options.leafNodesOnly ? options.leafNodesOnly : false;
		this.leafsOnly = options.leafNodesOnly ;

		if (options.file) this.loadFromFile(options.file, async);
		if (options.files) options.files.forEach((file) => this.loadFromFile(file, async));
		if (options.url) this.loadFromURL(options.url, async);
		if (options.urls) options.urls.forEach((url) => this.loadFromURL(url, async));

		if (extra_vals && datatypeIs(extra_vals, "array")) {
			extra_vals.forEach((v) => {
				if (datatypeIs(v, "string")) this.insertValue(v);
			});
		}
	}

	/**
	 * determines if the value is in the classification scheme
	 *
	 * @param {string} value    The value to check for existance
	 * @returns {boolean} true if value is in the classification scheme
	 */
	isIn(value : string) : boolean {
		return this.values.has(value);
	}

	/**
	 * determines if the scheme used by the provided term is included
	 * @param {string} term     The term whose scheme should bechecked
	 * @returns {boolean}
	 */
	hasScheme(term : string) : boolean {
		const pos = term.lastIndexOf(CS_URI_DELIMITER);
		if (pos == -1) return false;
		return this.schemes.includes(term.slice(0, pos));
	}

	showMe(prefix : string = "") {
		console.log(`in showme("${prefix}"), count=${this.values.count()}`);
		this.values.traverseInOrder((node) => {
			if (prefix == "" || node.getValue().startsWith(prefix)) 
				console.log(node.getValue());
		});
	}
}
