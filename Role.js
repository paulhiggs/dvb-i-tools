/* jshint esversion: 8 */
/**
 * Manages Classification Scheme checking based in a flat list of roles
 * 
 */
const fs=require('fs');
const fetch=require('node-fetch');

const ClassificationScheme=require("./ClassificationScheme.js");

module.exports = class Role  extends ClassificationScheme {
  
    /**
     * read a classification scheme from a URL and load its hierarical values into a linear list 
     *
     * @param {String} rolesURL URL to the classification scheme
     */
    loadFromURL(rolesURL) {
        
		function handleErrors(response) {
			if (!response.ok) {
				throw Error(`fetch() returned (${response.status}) "${response.statusText}"`);
			}
			return response;
		}
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

        fs.readFile(rolesFile, {encoding: "utf-8"}, (err, data)=> {
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
};