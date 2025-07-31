/**
 * error_list.mts
 *
 * Manages errors and warnings for the application
 * 
 */
import { XmlElement } from "libxml2-wasm";


export const FATAL : string = "(F)", 
	ERROR : string = "(E)",
	DEBUG : string = "(D)",
	WARNING : string = "(W)",
	INFORMATION : string = "(I)",
	APPLICATION : string = "(A)";

const MAX_FRAGMENT_LINES : number = 6; // the maximum number of lines in an element to display when that element has an error

let nthIndexOf = (str : string, pat : string, n : number) : number => {
	let i : number = -1;
	while (n-- && i++ < str.length) {
		i = str.indexOf(pat, i);
		if (i < 0) break;
	}
	return i;
};

export type XMLline = {
	value? : string;
	ix? : number;
	validationErrors? : Array<string>;
}

type ErrorCount = {
	key : string;
	count : number;
}

export type LogIssue = {
	code : string;
	message : string;
	element? : string;
	line? : number;
}

export type ErrorArgs = {
	type? : string;
	code : string;
	message : string;
	key? : string;
	fragment? : string | XmlElement;
	multiElementError? : Array<string | XmlElement>;
	fragments? : Array<string | XmlElement>;
	line? : number;
	description? : string;
	clause? : string;
	reportInTable? : boolean;
}

type ErrorDescription = {
	code : string;
	description : string;
	clause? : string;
}

export type DebugMessage = {
	code : string;
	message : string;
}

export default class ErrorList {

	countsFatal: Array<ErrorCount>;
	countsErr : Array<ErrorCount>;
	countsWarn  : Array<ErrorCount>;
	countsInfo : Array<ErrorCount>;
	fatals : Array<LogIssue>;
	errors : Array<LogIssue>;
	warnings : Array<LogIssue>;
	informationals : Array<LogIssue>;
	debugs : Array<LogIssue>;
	markupXML?  : Array<XMLline>;
	errorDescriptions : Array<ErrorDescription>;

	constructor() {
		this.countsFatal = [];
		this.countsErr = [];
		this.countsWarn = [];
		this.countsInfo = [];
		this.fatals = [];
		this.errors = [];
		this.warnings = [];
		this.debugs = [];
		this.informationals = [];
		this.markupXML = [];
		this.errorDescriptions = [];
	}
	/**
	 * loads the text that can be marked up with any validation errors/warnings etc
	 * @param {string} doc   The document received for validation
	 */
	loadDocument(doc : string) {
		this.markupXML = doc.split("\n").map((str, index) => ({ value: str, ix: index + 1 }));
	}
	/**
	 * attach an error message to a particular line in the received text
	 * @param {string} type     the type of error message, e.g. APPLICATION, ERROR, WARNING...
	 * @param {string} code     the short code of the error
	 * @param {string} message  the verbose error message
	 * @param {number} lineNo  the line number in the received text to attach the error to
	 */
	private setError(type : string, code : string, message : string, lineNo : number) {
		let found = this.markupXML?.find((line) => line.ix == lineNo);
		if (found) {
			if (!found.validationErrors) found.validationErrors = [];
			found.validationErrors.push(`${type} ${code}: ${message}`);
		}
	}

	private doIncrement(data : Array<ErrorCount>, key : string)
	{
		const c = data.find((e) => e.key == key);
		if (c) c.count++;
		else data.push({ key: key, count: 1 });
	}
	private doSet(data : Array<ErrorCount>, key : string, value : number = 1) {
		let c = data.find((e) => e.key == key);
		if (c) c.count++;
		else data.push({ key: key, count: value });
	}

	private incrementF(key : string) : void {
		this.doIncrement(this.countsFatal, key);
	}
	setF(key : string, value : number = 1)  : void {
		this.doSet(this.countsFatal, key, value);
	}
	private incrementE(key : string) : void {
		this.doIncrement(this.countsErr, key);
	}
	set(key : string, value : number = 1)  : void {
		this.doSet(this.countsErr, key, value);
	}
	private incrementW(key : string) : void  {
		this.doIncrement(this.countsWarn, key);
	}
	setW(key : string, value : number = 1) : void  {
		this.doSet(this.countsWarn, key, value);
	}
	private incrementI(key : string) : void  {
		this.doIncrement(this.countsInfo, key);
	}
	setI(key : string, value : number = 1) : void  {
		this.doSet(this.countsInfo, key, value);
	}

	private prettyPrint(node : XmlElement) : string {
		const t = node.prettyPrint();
		const maxLen = nthIndexOf(t, "\n", MAX_FRAGMENT_LINES);
		return maxLen == -1 ? t : `${t.slice(0, maxLen)}\n....\n`;
	}

	private insertErrorData(type : string, key : string, err : LogIssue) {
		switch (type) {
			case FATAL:
				this.fatals.push(err);
				if (key !== "") this.incrementF(key);
				break;
			case ERROR:
				this.errors.push(err);
				if (key !== "") this.incrementE(key);
				break;
			case APPLICATION:
				this.errors.push(err);
				this.incrementE("application process error");
				break;
			case WARNING:
				this.warnings.push(err);
				if (key !== "") this.incrementW(key);
				break;
			case INFORMATION:
				this.informationals.push(err);
				if (key !== "") this.incrementI(key);
				break;
		}
	}

	private debugMessage(err : DebugMessage) {
		this.debugs.push(err);
	}

	/**
	 * log an error from the service list or program metadata analysis
	 *
	 * @param {string} e.type                                  (optional) ERROR(default) or WARNING
	 * @param {string} e.code                                  Error code
	 * @param {string} e.message                               The error message
	 * @param {string} e.key                                   (optional)The category of the message
	 * @param {Array<string | XmlElement>} e.multiElementError (optional)
	 * @param {string | XmlElement} e.fragment                 (optional) The XML fragment (or node in the XML document) triggering the error
	 * @param {Array<string | XmlElement>} e.fragments         (optional) Mutiple elements that contribute to the validation error
	 * @param {number} e.line                                  (optional) the line number of the element in the XML document that triggered the error
	 * @param {string} e.description                           (optional) a description of the error
	 * @param {string} e.clause                                (optional) the specification clause/section that is violated (only used with @e.description is provided)
	 * @param {boolean} e.reportInTable                        (optional) true(default) to add this error into the list of errors found
	 */
	addError(e : ErrorArgs) {
		const _INVALID_CALL = "invalid addError call";
		let argsOK = true;
		e.type = e.type || ERROR;
		if (!Object.prototype.hasOwnProperty.call(e, "reportInTable")) e.reportInTable = true;
		if (e.line && e.line < 0)
			delete e.line;

		if (![FATAL, ERROR, WARNING, INFORMATION, APPLICATION, DEBUG].includes(e.type ? e.type : "")) {
			this.errors.push({ code: "ERR000", message: `addError() called with invalid type property (${e.type})` });
			this.incrementE(_INVALID_CALL);
			argsOK = false;
		}
		if (!e.code) {
			this.errors.push({ code: "ERR001", message: "addError() called without code property" });
			this.incrementE(_INVALID_CALL);
			e.code = "ERR001";
			argsOK = false;
		}
		if (!e.message) {
			this.errors.push({ code: "ERR002", message: "addError() called without message property" });
			this.incrementE(_INVALID_CALL);
			e.message = "no error message";
			argsOK = false;
		}

		if (!argsOK) return;

		if (e.type == DEBUG) {
			this.debugMessage({ code: e.code, message: e.message });
		} else if (e.multiElementError) {
			/**
			 * this type of error involves multiple elements, for example when the cardinality exceeds a specified limit.
			 * each element of multiElementError is an element that is marked up, but the error message is
			 * only reported once in the error list
			 */
			this.insertErrorData(e.type ? e.type : ERROR, e.key ? e.key : "", { code: e.code, message: e.message });
			e.multiElementError.forEach((fragment) => {
				if (fragment && fragment instanceof XmlElement) 
					this.setError(e.type ? e.type : ERROR, e.code, e.message, fragment.line);
			});
		} else if (e.fragments) {
			// note that the line of the error is derived from the fragment -- e.line is only used with the fragment is already a string
			e.fragments.forEach((fragment) => {
				let newError : LogIssue = { code: e.code, message: e.message };
				if (typeof fragment === "string") {
					newError.element = fragment
					if (e.line) {
						this.setError(e.type ? e.type : ERROR, e.code, e.message, e.line);
						newError.line = e.line
					}
				}
				if (fragment instanceof XmlElement) {
					newError.element = this.prettyPrint(fragment);
					this.setError(e.type ? e.type : ERROR, e.code, e.message, fragment.line);
					newError.line = fragment.line;
				}
				if (e.reportInTable) this.insertErrorData(e.type ? e.type : ERROR, e.key ? e.key : "", newError);
			});
		} else if (e.fragment) {
			// note that the line of the error is derived from the fragment -- e.line is only used when the fragment is already a string
			let newError : LogIssue = { code: e.code, message: e.message };

			if (typeof e.fragment === "string") {
				newError.element = e.fragment;
				if (e.line) {
					this.setError(e.type ? e.type : ERROR, e.code, e.message, e.line);
					newError.line = e.line;
				}
			}
			if (e.fragment instanceof XmlElement) {
				newError.element = this.prettyPrint(e.fragment);
				this.setError(e.type ? e.type : ERROR, e.code, e.message, e.fragment.line);
				newError.line = e.fragment.line;
			}
			if (e.reportInTable) this.insertErrorData(e.type ? e.type : ERROR, e.key ? e.key : "", newError);
		} else {
			let newError : LogIssue = { code: e.code, message: e.message, element: undefined };
			if (e.line) {
				this.setError(e.type ? e.type : ERROR, e.code, e.message, e.line);
				newError.line = e.line;
			}
			if (e.reportInTable) this.insertErrorData(e.type ? e.type : ERROR, e.key ? e.key : "", newError);
		}
		if (e.description) this.errorDescription({ code: e.code, description: e.description, clause: e.clause });
	}

	numFatals() {
		return this.fatals.length;
	}
	numErrors() {
		return this.errors.length;
	}
	numWarnings() {
		return this.warnings.length;
	}
	numInformationals() {
		return this.informationals.length;
	}

	numCountsFatal() {
		return this.countsFatal.length;
	}
	numCountsErr() {
		return this.countsErr.length;
	}
	numCountsWarn() {
		return this.countsWarn.length;
	}
	numCountsInfo() {
		return this.countsInfo.length;
	}

	/**
	 * built up descriptive information on the errors found in the analysis
	 *
	 * @param {string}  e.code         Error code, should be the same as @e.code passed to addError
	 * @param {string}  e.description  A long form description of the stated error code
	 * @param {string}  e.clause      (optional) the specification clause/section that is violated (only used with @e.description is provided)
	 */
	errorDescription(e : ErrorDescription) {
		if (!e.code || !e.description) return;
		let found = this.errorDescriptions.find((element) => e.code == element.code);
		if (found) {
			if (found.description.indexOf(e.description) == -1) found.description += `\n${e.description}`;
		} 
		else this.errorDescriptions.push(e);
	}
}
