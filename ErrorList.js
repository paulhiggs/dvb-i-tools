/**
 * ErrorList.js
 * 
 * Manages errors and warnings for the application
 * 
 */

const libxml=require("libxmljs2");

module.exports = class ErrorList {
      
    constructor() {
        this.countsErr=[]; this.numCountsE=0;   // keep these counters as arrays constructed by 
        this.countsWarn=[]; this.numCountsW=0;   // direct insertion do not maintain them
        this.errors=[];
        this.warnings=[];
        this.markupXML=[];
    }
    loadDocument(doc) {
        let lines=libxml.parseXmlString(doc).toString().split('\n');
        this.markupXML=lines.map((str, index) => ({ value: str, ix: index }));
    }
    setError(err, lineNo) {
        let found=this.markupXML.find(line => (line.ix==lineNo));
        if (found) {
            if (!found.validationErrors)
                found.validationErrors=[];
            found.validationErrors.push(err);
        }
    }
    increment(key) {
        if (this.countsErr[key]===undefined)
            this.set(key);
        else this.countsErr[key]++;
    }
    set(key,value=1) {
        this.countsErr[key]=value;
        this.numCountsE++;
    }
    incrementW(key) {
        if (this.countsWarn[key]===undefined)
            this.setW(key);
        else this.countsWarn[key]++;
     }
    setW(key,value=1) {
        this.countsWarn[key]=value;
        this.numCountsW++;
    }
    push(errMessage, key=null) {
        this.errors.push({code:null, message:errMessage, element:null});
		if (key) this.increment(key);
    }
	pushCode(errNo, errMessage, key=null, lineNo=null) {
        this.errors.push({code:errNo, message:errMessage, element:null});
		if (key) this.increment(key);
        if (lineNo) this.setError(errMessage, lineNo);
    }
	pushCodeWithFragment(errNo, errMessage, fragment, key=null) {
        this.errors.push({code:errNo, message:errMessage, 
            element:(typeof(fragment)=="string" || fragment instanceof String)?fragment:fragment.toString()});
		if (key) this.increment(key);
    }
	pushW(errMessage, key=null) {
        this.warnings.push({code:null, message:errMessage, element:null});
		if (key) this.incrementW(key);
    }
	pushCodeW(errNo, errMessage, key=null) {
        this.warnings.push({code:errNo, message:errMessage, element:null});
		if (key) this.incrementW(key);
    }
    pushCodeWWithFragment(errNo, errMessage, fragment, key=null) {
        this.warnings.push({code:errNo, message:errMessage, 
            element:(typeof(fragment)=="string" || fragment instanceof String)?fragment:fragment.toString()});
		if (key) this.incrementW(key);
    }
    numErrors() { return this.errors.length; }
    numWarnings() { return this.warnings.length; }

    numCountsErr() { return this.numCountsE; }
    numCountsWarn() { return this.numCountsW; }
 };
