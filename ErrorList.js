/**
 * ErrorList.js
 * 
 * Manages errors and warnings for the application
 * 
 */

import { parseXmlString } from "libxmljs2";
import { datatypeIs } from "./phlib/phlib.js";

export const ERROR='(E)', WARNING='(W)', INFORMATION='(I)', APPLICATION='(A)';

const MAX_FRAGMENT_LINES = 6; // the maximum number of lines in an element to display when that element has an error


var nthIndexOf = (str, pat, n) => {
		let i = -1;
		while (n-- && i++ < str.length) {
			i = str.indexOf(pat, i);
			if (i < 0) break;
		}
		return i;
	};

export default class ErrorList {

	constructor() {
		this.countsErr=[]; this.numCountsE=0;   // keep these counters as arrays constructed by 
		this.countsWarn=[]; this.numCountsW=0;   // direct insertion do not maintain them
		this.countsInfo=[]; this.numCountsI=0;   
		this.errors=[];
		this.warnings=[];
		this.informationals=[];
		this.markupXML=[];
	}
	loadDocument(doc) {
		let lines=parseXmlString(doc).toString({declaration:false, format:true}).split('\n');
		this.markupXML=lines.map((str, index) => ({ value: str, ix: index }));
	}
	/* private */ setError(type, code, message, lineNo) {
		let found=this.markupXML.find(line => (line.ix==lineNo));
		if (found) {
			if (!found.validationErrors)
				found.validationErrors=[];
			found.validationErrors.push(`${type} ${code}: ${message}`);
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
	/* private */ incrementI(key) {
		if (this.countsInfo[key]===undefined)
			this.setI(key);
		else this.countsInfo[key]++;
	}
	setI(key,value=1) {
		this.countsInfo[key]=value;
		this.numCountsI++;
	}


	/* private method */ prettyPrint(node) {
		// clean up and redo formatting 
		let tmp=node.toString({declaration:false, format:true});
		let maxLen=nthIndexOf(tmp, '\n', MAX_FRAGMENT_LINES);
		return maxLen==-1?tmp:`${tmp.slice(0,maxLen)}....\n`;
	}

	/* private method */ insertErrorData(type, key, err) {
		switch (type) {
			case ERROR: 
				this.errors.push(err);
				if (key) this.increment(key);
				break;
			case APPLICATION:
				this.errors.push(err);
				this.increment('application process error');
				break;
			case WARNING: 
				this.warnings.push(err);
				if (key) this.incrementW(key);
				break;
			case INFORMATION:
				this.informationals.push(err);
				if (key) this.incrementI(key);
				break;
		}
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
		let _INVALID_CALL='invalid addError call', argsOK=true;
		if (!e.hasOwnProperty('type')) e.type=ERROR;
		if (!e.hasOwnProperty('reportInTable')) e.reportInTable=true;

		if (![ERROR, WARNING, INFORMATION, APPLICATION].includes(e.type)) {
			this.errors.push({code:"ERR000", message:`addError() called with invalid type property (${e.type})`});
			this.increment(_INVALID_CALL);
			argsOK=false;
		}
		if (!e.code) {
			this.errors.push({code:"ERR001", message:'addError() called without code property'});
			this.increment(_INVALID_CALL);
			e.code="ERR001";
			argsOK=false;
		}
		if (!e.message) {
			this.errors.push({code:"ERR002", message:'addError() called without message property'});
			this.increment(_INVALID_CALL);
			e.message="no error message";
			argsOK=false;
		}

		if (!argsOK)
			return;

		if (e.multiElementError) {
			/** 
			 * this type of error involves multiple elements, for example when the cardinality exceeds a specified limit.
			 * each element of multiElementError is an element that is marked up, but the error message is 
			 * only reported once in the error list
			 */
			this.insertErrorData(e.type, e.key, {code:e.code, message:e.message});
			e.multiElementError.forEach(fragment => {
				if (fragment && !datatypeIs(fragment, "string"))
					this.setError(e.type, e.code, e.message, fragment.line()-2);
			});
		}
		else if (e.fragments) {
			e.fragments.forEach(fragment => {
				let newError={code:e.code, message:e.message};
				if (fragment) {
					newError.element=datatypeIs(fragment, "string")?fragment:this.prettyPrint(fragment);
					
					if (!datatypeIs(fragment, "string")) {
						this.setError(e.type, e.code, e.message, fragment.line()-2);
						newError.line=fragment.line()-2;
					}
					if (e.reportInTable)
						this.insertErrorData(e.type, e.key, newError);
				}	
			});
		} 
		else if (e.fragment) {
			let newError={code:e.code, message:e.message, 
				element:(datatypeIs(e.fragment, "string")?e.fragment:this.prettyPrint(e.fragment))};

			if (!e.line && !datatypeIs(e.fragment, "string"))
				e.line=e.fragment.line()-1;
			if (e.line) {
				this.setError(e.type, e.code, e.message, e.line-1);
				newError.line=e.line-1;
			}
			if (e.reportInTable)
				this.insertErrorData(e.type, e.key, newError);
		} 
		else {
			let newError={code:e.code, message:e.message, element:null};
			if (e.line) {
				this.setError(e.type, e.code, e.message, e.line-2);
				newError.line=e.line-2;
			}
			if (e.reportInTable)
				this.insertErrorData(e.type, e.key, newError);
		}
	}
	
	numErrors() { return this.errors.length; }
	numWarnings() { return this.warnings.length; }
	numInformationals() { return this.informationals.length; }

	numCountsErr() { return this.numCountsE; }
	numCountsWarn() { return this.numCountsW; }
	numCountsInfo() { return this.numCountsI; }
 }
