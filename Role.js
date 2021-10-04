/**
 * Manages Classification Scheme checking based in a flat list of roles
 * 
 */
import { readFile } from 'fs';
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
import { handleErrors } from "./fetch-err-handler.js";

import ClassificationScheme from "./ClassificationScheme.js";

export default class Role  extends ClassificationScheme {
  
    /**
     * read a classification scheme from a URL and load its hierarical values into a linear list 
     *
     * @param {String} rolesURL URL to the classification scheme
     */
    loadFromURL(rolesURL) {
		console.log(`retrieving Roles from ${rolesURL} via fetch()`);

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
            if (!err) {
                data.split('\n').forEach(e=>{this.insertValue(e.trim(), true);});
            }
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
