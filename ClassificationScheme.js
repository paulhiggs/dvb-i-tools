/* jshint esversion: 8 */
/**
 * ClassificationScheme.js
 * 
 * Manages Classification Scheme loading and checking
 * 
 */
const fs=require('fs');
const libxml=require('libxmljs2');
const fetch=require('node-fetch');
const { isHTTPURL } = require("./pattern_checks");


/**
 * check if the element contains the named child element
 *
 * @param {Object} elem the element to check
 * @param {string} childElementName the name of the child element to look for
 *& @returns {boolean} true of the element contains the named child element(s) otherwise false
 */
hasChild = (elem, childElementName) => elem ? elem.childNodes().find(el => el.type()=='element' && el.name()==childElementName) != undefined : false;


/**
 * Constructs a linear list of terms from a heirarical clssification schemes which are read from an XML document and parsed by libxmljs
 *
 * @param {String} CSuri The classification scheme domian
 * @param {Object} term The classification scheme term that may include nested subterms
 * @param {boolean} leafNodesOnly flag to indicate if only the leaf <term> values are to be loaded 
 */
function addCSTerm(vals, CSuri, term, leafNodesOnly=false) {
    if (term.type()!="element") return;
    if (term.name()==="Term") {
        if (!leafNodesOnly || (leafNodesOnly && !hasChild(term, "Term")))
            if (term.attr("termID")) 
                vals.push(`${CSuri}:${term.attr("termID").value()}`);
        var st=0, subTerm;
        while ((subTerm=term.child(st++))!=null)
            addCSTerm(vals, CSuri, subTerm, leafNodesOnly);
    }
}


/**
 * load the hierarical values from an XML classification scheme document into a linear list 
 *
 * @param {String} xmlCS the XML document  of the classification scheme
 * @param {boolean} leafNodesOnly flag to indicate if only the leaf <term> values are to be loaded 
 */
function loadClassificationScheme(xmlCS, leafNodesOnly=false) {
    let vals=[];
    if (!xmlCS) return vals;
    let CSnamespace = xmlCS.root().attr("uri");
    if (!CSnamespace) return vals;
    var t=0, term;
    while ((term=xmlCS.root().child(t++))!=null)
        addCSTerm(vals, CSnamespace.value(), term, leafNodesOnly);
    return vals;
}


module.exports = class ClassificationScheme {

    constructor () {
        this.values=[];
        loadClassificationScheme.bind(this);
    }

    count() {
        return this.values.length;
    }

    empty() {
        this.values=[];
    }
    
    /**
     * read a classification scheme from a URL and load its hierarical values into a linear list 
     *
     * @param {String} csURL URL to the classification scheme
     * @param {boolean} leafNodesOnly flag to indicate if only the leaf <term> values are to be loaded 
     */
    loadFromURL(csURL, leafNodesOnly=false) {
        
		function handleErrors(response) {
			if (!response.ok) {
				throw Error(response.statusText);
			}
			return response;
		}
		console.log(`retrieving CS from ${csURL} via fetch()`); 
		fetch(csURL)
			.then(handleErrors)
			.then(response => response.text())
			.then(strXML => loadClassificationScheme(libxml.parseXmlString(strXML), leafNodesOnly).forEach(e=>{this.values.push(e);}))
			.catch(error => console.log(`error (${error}) retrieving ${csURL}`));
    }

    /**
     * read a classification scheme from a local file and load its hierarical values into a linear list 
     *
     * @param {String} classificationScheme the filename of the classification scheme
     * @param {boolean} leafNodesOnly flag to indicate if only the leaf <term> values are to be loaded 
     */
    loadFromFile(classificationScheme, leafNodesOnly=false) {
        console.log(`reading CS from ${classificationScheme}`);

        fs.readFile(classificationScheme, {encoding: "utf-8"}, (err,data)=> {
            if (!err) {
                loadClassificationScheme(libxml.parseXmlString(data.replace(/(\r\n|\n|\r|\t)/gm,"")), leafNodesOnly).forEach(e=>{this.values.push(e);});
            }
            else console.log(err);
        });


    }

    /**
     * loads classification scheme values from either a local file or an URL based location and return them
     * as an array
     *        
     * @param {boolean} useURL        if true use the URL loading method else use the local file
     * @param {String} CSfilename     the filename of the classification scheme
     * @param {String} CSurl          URL to the classification scheme
     * @param {boolean} leafNodesOnly flag to indicate if only the leaf <term> values are to be loaded 
     */
    loadCS(useURL, CSfilename, CSurl, leafNodesOnly=false){
        if (useURL)
		    this.loadFromURL(CSurl, leafNodesOnly);
	    else this.loadFromFile(CSfilename, leafNodesOnly);
    }
    
    /**
     * loads classification scheme values from either a local file or an URL based location 

     * @param {String} CSfilename     the filename of the classification scheme
     * @param {String} CSurl          URL to the classification scheme
     * @param {boolean} leafNodesOnly flag to indicate if only the leaf <term> values are to be loaded 
     */
    loadCS2(from, leafNodesOnly=false) {
        if (isHTTPURL(from))
            this.loadFromURL(CSurl, leafNodesOnly);
        else this.loadFromFile(CSfilename, leafNodesOnly);
    }

    loadCSExt(options) {
        if (!options) options={};
        if (!options.leafNodesOnly) options.leafNodesOnly=false;

        if (options.file)
            this.loadFromFile(options.file, options.leafNodesOnly);
        else if (options.files)
            options.files.forEach(file => this.loadFromFile(file, options.leafNodesOnly));
        else if (options.url)
            this.loadFromURL(options.url, options.leafNodesOnly);
        else if (options.urls)
            options.urls.forEach(url => this.loadFromURL(url, options.leafNodesOnly));
    }

    /**
     * determines if the value is in the classification scheme
     *
     * @param {String} value           The value to check for existance
     * @returns {boolean} true if value is in the classification scheme
     */
    isIn(value) {
        return this.values.includes(value);
    }
};