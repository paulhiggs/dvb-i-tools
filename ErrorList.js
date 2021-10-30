/**
 * ErrorList.js
 * 
 * Manages errors and warnings for the application
 * 
 */

import { parseXmlString } from "libxmljs2";

export const ERROR=1, WARNING=2, APPLICATION=3;

export default class ErrorList {

	constructor() {
		this.countsErr=[]; this.numCountsE=0;   // keep these counters as arrays constructed by 
		this.countsWarn=[]; this.numCountsW=0;   // direct insertion do not maintain them
		this.errors=[];
		this.warnings=[];
		this.markupXML=[];
	}
	loadDocument(doc) {
		let lines=parseXmlString(doc).toString().split('\n');
		this.markupXML=lines.map((str, index) => ({ value: str, ix: index }));
	}
	/* private */ setError(code, message, lineNo) {
		let found=this.markupXML.find(line => (line.ix==lineNo));
		if (found) {
			if (!found.validationErrors)
				found.validationErrors=[];
			found.validationErrors.push(`${code}: ${message}`);
		}
	}
	/* private */ increment(key) {
		if (this.countsErr[key]===undefined)
			this.set(key);
		else this.countsErr[key]++;
	}
	set(key,value=1) {
		this.countsErr[key]=value;
		this.numCountsE++;
	}
	/* private */ incrementW(key) {
		if (this.countsWarn[key]===undefined)
			this.setW(key);
		else this.countsWarn[key]++;
	}
	setW(key,value=1) {
		this.countsWarn[key]=value;
		this.numCountsW++;
	}

	/*private*/ prettyPrint(node) {
		// clean up and redo formatting 
	    return node.toString({declaration:false, format:true});
		//return parseXmlString(node.toString().replace(/[\t\r\n]/ig, "")).toString({declaration:false, format:true});
	}
	/**
	 * 
	 * @param {integer} e.type     (optional) ERROR(default) or WARNING
	 * @param {sring} e.code       Error code
	 * @param {string} e.message   The error message
	 * @param {string} e.key       (optional)The category of the message
	 * @param {string or libxmljs2:Node} e.fragment (optional) The XML fragment (or node in the XML document) triggering the error
	 * @param {integer} e.line     (optional) the line number of the element in the XML document that triggered the error
	 */
	addError(e) {
		let _INVALID_CALL='invalid addError call';
		if (!e.type) e.type=ERROR;

		if (![ERROR, WARNING, APPLICATION].includes(e.type)) {
			this.errors.push({code:"ERR000", message:`addError() called with invalid type property (${e.type})`});
			this.increment(_INVALID_CALL);
		}
		if (!e.code) {
			this.errors.push({code:"ERR001", message:'addError() called without code property'});
			this.increment(_INVALID_CALL);
			e.code="ERR001";
		}
		if (!e.message) {
			this.errors.push({code:"ERR002", message:'addError() called without message property'});
			this.increment(_INVALID_CALL);
			e.message="no error message";
		}
		let newError={code:e.code, message:e.message, 
						element:e.fragment?((typeof(e.fragment)=="string" || e.fragment instanceof String)?e.fragment:this.prettyPrint(e.fragment)):null
		};

		switch (e.type) {
			case ERROR: 
				this.errors.push(newError);
				if (e.key) this.increment(e.key);
				break;
			case APPLICATION:
				this.errors.push(newError);
				this.increment('application process error');
				break;
			case WARNING: 
				this.warnings.push(newError);
				if (e.key) this.incrementW(e.key);
				break;
		}
		if (!e.line && e.fragment && typeof(e.fragment)!="string")
			e.line=e.fragment.line();
		if (e.line)
			this.setError(e.code, e.message, e.line-1);
	} 
	numErrors() { return this.errors.length; }
	numWarnings() { return this.warnings.length; }

	numCountsErr() { return this.numCountsE; }
	numCountsWarn() { return this.numCountsW; }
 }
