/**
 * role.mjs
 *
 * Manages Classification Scheme checking based in a flat list of roles
 */
import chalk from "chalk";
import { readFile, readFileSync } from "fs";

import handleErrors from "./fetch_err_handler.mjs";
import { isHTTPURL } from "./pattern_checks.mjs";

import ClassificationScheme from "./classification_scheme.mjs";

export default class Role extends ClassificationScheme {
	constructor() {
		super();
	}

	/**
	 * read a classification scheme from a URL and load its hierarical values into a linear list
	 *
	 * @param {String} rolesURL URL to the classification scheme
	 */
	#loadFromURL(rolesURL, async = true) {
		const isHTTPurl = isHTTPURL(rolesURL);
		console.log(chalk.yellow(`${isHTTPurl ? "" : "--> NOT "}retrieving Roles from ${rolesURL} via fetch()`));
		if (!isHTTPurl) return;

		fetch(rolesURL)
			.then(handleErrors)
			.then((response) => response.content)
			.then((roles) =>
				roles.split("\n").forEach((e) => {
					this.insertValue(e.trim(), true);
				})
			)
			.catch((error) => console.log(chalk.red(`error (${error}) retrieving ${rolesURL}`)));
	}

	/**
	 * read a classification scheme from a local file and load its hierarical values into a linear list
	 *
	 * @param {String} rolesFile the filename of the classification scheme
	 */
	#loadFromFile(rolesFile, async = true) {
		console.log(chalk.yellow(`reading Roles from ${rolesFile}`));

		if (async)
			readFile(rolesFile, { encoding: "utf-8" }, (err, data) => {
				if (!err)
					data.split("\n").forEach((e) => {
						this.insertValue(e.trim(), true);
					});
				else console.log(chalk.red(err));
			});
		else {
			let buff = readFileSync(rolesFile, { encoding: "utf-8" });
			let data = buff.toString();
			data.split("\n").forEach((e) => {
					this.insertValue(e.trim(), true);
				});
		}
	}

	loadRoles(options, async = true) {
		if (!options) options = {};
		if (options.file) this.#loadFromFile(options.file, async);
		if (options.files) options.files.forEach((file) => this.#loadFromFile(file, async));
		if (options.url) this.#loadFromURL(options.url, async);
		if (options.urls) options.urls.forEach((url) => this.#loadFromURL(url, async));
	}
}
