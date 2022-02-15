/**
 * Manages Classification Scheme checking based in a flat list of roles
 * 
 */
import { readFile } from 'fs';

import fetch from 'node-fetch';
import { handleErrors } from "./fetch-err-handler.js";

import ClassificationScheme from "./ClassificationScheme.js";
import { isHTTPURL } from "./pattern_checks.js";


export default class Role  extends ClassificationScheme {

	/**
	 * read a classification scheme from a URL and load its hierarical values into a linear list 
	 *
	 * @param {String} rolesURL URL to the classification scheme
	 */
	loadFromURL(rolesURL) {
		let isHTTPurl=isHTTPURL(rolesURL);
		console.log(`${isHTTPurl?"":"--> NOT "}retrieving Roles from ${rolesURL} via fetch()`);
		if (!isHTTPurl) return;

		fetch(rolesURL)
			.then(handleErrors)
			.then(response => response.text())
			.then(roles => roles.split('\n').forEach(e=>{this.insertValue(e.trim(), true);}))
			.catch(error => console.log(`error (${error}) retrieving ${rolesURL}`));
	}

	/**
	 * read a classification scheme from a local file and load its hierarical values into a linear list 
	 *
	 * @param {String} rolesFile the filename of the classification scheme
	 */
	loadFromFile(rolesFile) {
		console.log(`reading Roles from ${rolesFile}`);

		readFile(rolesFile, {encoding: "utf-8"}, (err, data)=> {
			if (!err) 
				data.split('\n').forEach(e=>{this.insertValue(e.trim(), true);});
			else console.log(err);
		});
	}

	loadRoles(options) {
		if (!options) options={};
		if (options.file)
			this.loadFromFile(options.file);
		if (options.files)
			options.files.forEach(file => this.loadFromFile(file));
		if (options.url)
			this.loadFromURL(options.url);
		if (options.urls) 
			options.urls.forEach(url => this.loadFromURL(url));
	}
}
