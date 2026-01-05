/**
 * role.mts
 *
 * Manages Classification Scheme checking based in a flat list of roles
 */
import { readFile, readFileSync } from "fs";

import chalk from "chalk";
import fetchS from "sync-fetch";

import handleErrors from "./fetch_err_handler.mts";
import { isHTTPURL } from "./pattern_checks.mts";

import ClassificationScheme from "./classification_scheme.mts";

export default class Role extends ClassificationScheme {
	constructor() {
		super();
	}

	/**
	 * read a classification scheme from a URL and load its hierarical values into a linear list
	 *
	 * @param {string} rolesURL URL to the classification scheme
	 * @param {boolean} async instructs the loading to be performed asynchronously
	 */
	#loadFromURL(rolesURL : string, async : boolean = true) {
		const isHTTPurl = isHTTPURL(rolesURL);
		console.log(chalk.yellow(`${isHTTPurl ? "" : "--> NOT "}retrieving Roles from ${rolesURL} via fetch()`));
		if (!isHTTPurl) return;

		if (async) {
			fetch(rolesURL)
				.then(handleErrors)
				.then((response) => response.text())
				.then((roles) =>
					roles.split("\n").forEach((role : string) => {
						this.insertValue(role.trim(), true);
					})
				)
				.catch((error) => console.log(chalk.red(`error (${error}) retrieving ${rolesURL}`)));
		} else {
			let resp = null;
			try {
				resp = fetchS(rolesURL);
			} catch (error) {
				console.log(chalk.red(error.message));
			}
			if (resp) {
				if (resp.ok) {
					resp
						.text()
						.split("\n")
						.forEach((role) => {
							this.insertValue(role.trim(), true);
						});
				} else console.log(chalk.red(`error (${resp.status}:${resp.statusText}) handling ${rolesURL}`));
			}
		}
	}

	/**
	 * read a classification scheme from a local file and load its hierarical values into a linear list
	 *
	 * @param {string} rolesFile the filename of the classification scheme
	 * @param {boolean} async instructs the loading to be performed asynchronously
	 */
	#loadFromFile(rolesFile : string, async : boolean = true) {
		console.log(chalk.yellow(`reading Roles from ${rolesFile}`));

		if (async)
			readFile(rolesFile, { encoding: "utf-8" }, (err: NodeJS.ErrnoException | null, data: string) => {
				if (!err)
					data.split("\n").forEach((role : string) => {
						this.insertValue(role.trim(), true);
					});
				else console.log(chalk.red(err));
			});
		else {
			let buff = readFileSync(rolesFile, { encoding: "utf-8" });
			let data = buff.toString();
			data.split("\n").forEach((role : string) => {
				this.insertValue(role.trim(), true);
			});
		}
	}

	loadRoles(options : any, async : boolean = true) {
		if (!options) options = {};
		if (options.file) this.#loadFromFile(options.file, async);
		if (options.files) options.files.forEach((file : string) => this.#loadFromFile(file, async));
		if (options.url) this.#loadFromURL(options.url, async);
		if (options.urls) options.urls.forEach((url : string) => this.#loadFromURL(url, async));
	}
}
