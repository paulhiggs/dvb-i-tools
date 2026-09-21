/**
 * role.mts
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

import handleErrors from "./fetch_err_handler.mts";
import { isHTTPURL } from "./pattern_checks.mts";
import { fetch_options } from "./globals.mts";

import ClassificationScheme from "./classification_scheme.mts"
import type {FileLocations } from "./classification_scheme.mts"
import type { LoadOptions } from "./globals.mts"

export default class Role extends ClassificationScheme {
	constructor() {
		super();
	}

	#addRole(role: string) {
		this.add({term: role.trim(), leaf: true});
	}

	/**
	 * read roles from a URL and load them into a linear list
	 *
	 * @param {string} rolesURL URL to the roles file
	 * @param {boolean} async whether to use asynchronous fetch (true by default)
	 * @param {boolean} verbose  display verbose output
	 */
	#loadFromURL(rolesURL: string, async: boolean = true, verbose: boolean = true) {
		const isHTTPurl = isHTTPURL(rolesURL);
		if (verbose) console.log(chalk.yellow(`${isHTTPurl ? "" : "--> NOT "}retrieving Roles from ${rolesURL} via fetch()`));
		if (!isHTTPurl) return;

		if (async) {
			fetch(rolesURL, fetch_options)
				.then(handleErrors)
				.then((response) => response.text())
				.then((roles) =>
					roles.split("\n").forEach((role: string) => {
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
	 * @param {string} rolesFile the filename of the roles file
	 * @param {boolean} async whether to use asynchronous file read (true by default)
	 * @param {boolean} verbose  display verbose output
	 */
	#loadFromFile(rolesFile: string, async: boolean = true, verbose: boolean = true) {
		if (verbose) console.log(chalk.yellow(`reading Roles from ${rolesFile}`));

		if (async)
			readFile(rolesFile, { encoding: "utf-8" }, (err: NodeJS.ErrnoException | null, data: string | NonSharedBuffer) => {
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
	 * @param {FileLocations} source  list of URLs and/or files to load, e.g. {url: "http://example.com/roles.txt", file: "local_roles.txt"}
	 * @param {LoadOptions} options   options for loading the roles into a classification scheme
	 */
	loadRoles(source: FileLocations, options: LoadOptions) {
		if (source.file) this.#loadFromFile(source.file, options.async, options.verbose);
		if (source.files) source.files.forEach((file) => this.#loadFromFile(file, options.async, options.verbose));
		if (source.url) this.#loadFromURL(source.url, options.async, options.verbose);
		if (source.urls) source.urls.forEach((url) => this.#loadFromURL(url, options.async, options.verbose));
	}
}
