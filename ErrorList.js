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
		let lines=parseXmlString(doc).toString({declaration:false, format:true}).split('\n');
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


	/**
	 * 
	 * @param {integer} e.type     (optional) ERROR(default) or WARNING
	 * @param {sring} e.code       Error code
	 * @param {string} e.message   The error message
	 * @param {string} e.key       (optional)The category of the message
	 * @param {string or libxmljs2:Node} e.fragment (optional) The XML fragment (or node in the XML document) triggering the error
	 * @param {integer} e.line     (optional) the line number of the element in the XML document that triggered the error
	 */
	/* private method */ prettyPrint(node) {
		// clean up and redo formatting 
		return node.toString({declaration:false, format:true});
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
		}
	}

	addError(e) {
		let _INVALID_CALL='invalid addError call', argsOK=true;
		if (!e.type) e.type=ERROR;

		if (![ERROR, WARNING, APPLICATION].includes(e.type)) {
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

		if (e.fragments) {
			
			e.fragments.forEach(fragment => {
				let newError={code:e.code, message:e.message};
				newError.element=(typeof(fragment)=="string" || fragment instanceof String)?fragment:this.prettyPrint(fragment);

				this.insertErrorData(e.type, e.key, newError);
				if (typeof(fragment)!="string")
					this.setError(e.code, e.message, fragment.line()-2);
			});
		} 
		else if (e.fragment) {
			let newError={code:e.code, message:e.message, 
				element:((typeof(e.fragment)=="string" || e.fragment instanceof String)?e.fragment:this.prettyPrint(e.fragment))};

			this.insertErrorData(e.type, e.key, newError);

			if (!e.line && typeof(e.fragment)!="string")
				e.line=e.fragment.line()-1;
			if (e.line)
				this.setError(e.code, e.message, e.line-1);
		} 
		else {
			let newError={code:e.code, message:e.message, element:null};

			this.insertErrorData(e.type, e.key, newError);
			if (e.line)
				this.setError(e.code, e.message, e.line-2);
		}

	}
	
	numErrors() { return this.errors.length; }
	numWarnings() { return this.warnings.length; }

	numCountsErr() { return this.numCountsE; }
	numCountsWarn() { return this.numCountsW; }
 }
