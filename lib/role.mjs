/**
 * role.mjs
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Manages Classification Scheme checking based in a flat list of roles
 */

import chalk from "chalk";
import { readFile, readFileSync } from "fs";
import fetchS from "sync-fetch";

import handleErrors from "./fetch_err_handler.mjs";
import { isHTTPURL } from "./pattern_checks.mjs";
import { fetch_options } from "./globals.mjs";

import ClassificationScheme from "./classification_scheme.mjs";

export default class Role extends ClassificationScheme {
	constructor() {
		super();
	}

	#addRole(role) {
		this.insertValue({term:role.trim(), leaf: true}, true);
	}

	/**
	 * read roles from a URL and load them into a linear list
	 *
	 * @param {String} rolesURL URL to the roles file
	 * @param {Boolean} async whether to use asynchronous fetch (true by default)
	 */
	#loadFromURL(rolesURL, async = true) {
		const isHTTPurl = isHTTPURL(rolesURL);
		console.log(chalk.yellow(`${isHTTPurl ? "" : "--> NOT "}retrieving Roles from ${rolesURL} via fetch()`));
		if (!isHTTPurl) return;

		if (async) {
			fetch(rolesURL, fetch_options)
				.then(handleErrors)
				.then((response) => response.text())
				.then((roles) =>
					roles.split("\n").forEach((role) => {
						this.#addRole(role);
					})
				)
				.catch((error) => console.log(chalk.red(`error (${error}) retrieving ${rolesURL}`)));
		} else {
			let resp = null;
			try {
				resp = fetchS(rolesURL, fetch_options);
			} catch (error) {
				console.log(chalk.red(error.message));
			}
			if (resp) {
				if (resp.ok) {
					resp
						.text()
						.split("\n")
						.forEach((role) => {
							this.#addRole(role);
						});
				} else console.log(chalk.red(`error (${resp.status}:${resp.statusText}) handling ${rolesURL}`));
			}
		}
	}

	/**
	 * read roles from a local file and load them into a linear list
	 *
	 * @param {String} rolesFile the filename of the roles file
	 * @param {Boolean} async whether to use asynchronous file read (true by default)
	 */
	#loadFromFile(rolesFile, async = true) {
		console.log(chalk.yellow(`reading Roles from ${rolesFile}`));

		if (async)
			readFile(rolesFile, { encoding: "utf-8" }, (err, data) => {
				if (!err)
					data.split("\n").forEach((role) => {
						this.#addRole(role);
					});
				else console.log(chalk.red(err));
			});
		else {
			const buff = readFileSync(rolesFile, { encoding: "utf-8" });
			const data = buff.toString();
			data.split("\n").forEach((role) => {
				this.#addRole(role);
			});
		}
	}

	/**
	 * load roles from a list of URLs and/or files, e.g. {url: "http://example.com/roles.txt", file: "local_roles.txt"}
	 * 
	 * @param {*} options list of URLs and/or files to load, e.g. {url: "http://example.com/roles.txt", file: "local_roles.txt"}
	 * @param {Boolean} async	 whether to use asynchronous fetch/file read (true by default) 
	 */
	loadRoles(options, async = true) {
		if (!options) options = {};
		if (options.file) this.#loadFromFile(options.file, async);
		if (options.files) options.files.forEach((file) => this.#loadFromFile(file, async));
		if (options.url) this.#loadFromURL(options.url, async);
		if (options.urls) options.urls.forEach((url) => this.#loadFromURL(url, async));
	}
}
