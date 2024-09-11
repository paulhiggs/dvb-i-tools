/**
 * error_list.js
 *
 * Manages errors and warnings for the application
 */
import { datatypeIs } from "./phlib/phlib.js";

export const ERROR = "(E)",
	WARNING = "(W)",
	INFORMATION = "(I)",
	APPLICATION = "(A)";

const MAX_FRAGMENT_LINES = 6; // the maximum number of lines in an element to display when that element has an error

let nthIndexOf = (str, pat, n) => {
	let i = -1;
	while (n-- && i++ < str.length) {
		i = str.indexOf(pat, i);
		if (i < 0) break;
	}
	return i;
};

export default class ErrorList {
	#numCountsE; // keep these counters as arrays constructed by
	#numCountsW; // direct insertion do not maintain them
	#numCountsI;

	constructor() {
		this.countsErr = [];
		this.#numCountsE = 0;
		this.countsWarn = [];
		this.#numCountsW = 0;
		this.countsInfo = [];
		this.#numCountsI = 0;
		this.errors = [];
		this.warnings = [];
		this.informationals = [];
		this.markupXML = [];
		this.errorDescriptions = [];
	}
	/**
	 * loads the text that can be marked up with any validation errors/warnings etc
	 * @param {string} doc   The document received for validation
	 */
	loadDocument(doc) {
		this.markupXML = doc.split("\n").map((str, index) => ({ value: str, ix: index + 1 }));
	}
	/**
	 * attach an error message to a particular line in the received text
	 * @param {*} type    the type of error message, e.g. APPLICATION, ERROR, WARNING...
	 * @param {*} code    the short code of the error
	 * @param {*} message the verbose error message
	 * @param {*} lineNo  the line number in the received text to attach the error to
	 */
	/* private method */ #setError(type, code, message, lineNo) {
		let found = this.markupXML.find((line) => line.ix == lineNo);
		if (found) {
			if (!found.validationErrors) found.validationErrors = [];
			found.validationErrors.push(`${type} ${code}: ${message}`);
		}
	}
	/* private method*/ #increment(key) {
		if (this.countsErr[key] === undefined) this.set(key);
		else this.countsErr[key]++;
	}
	set(key, value = 1) {
		this.countsErr[key] = value;
		this.#numCountsE++;
	}
	/* private method*/ #incrementW(key) {
		if (this.countsWarn[key] === undefined) this.setW(key);
		else this.countsWarn[key]++;
	}
	setW(key, value = 1) {
		this.countsWarn[key] = value;
		this.#numCountsW++;
	}
	/* private method*/ #incrementI(key) {
		if (this.countsInfo[key] === undefined) this.setI(key);
		else this.countsInfo[key]++;
	}
	setI(key, value = 1) {
		this.countsInfo[key] = value;
		this.#numCountsI++;
	}

	/* private method */ #prettyPrint(node) {
		// clean up and redo formatting
		const tmp = node.toString({ declaration: false, format: true });
		const maxLen = nthIndexOf(tmp, "\n", MAX_FRAGMENT_LINES);
		return maxLen == -1 ? tmp : `${tmp.slice(0, maxLen)}\n....\n`;
	}

	/* private method */ #insertErrorData(type, key, err) {
		switch (type) {
			case ERROR:
				this.errors.push(err);
				if (key) this.#increment(key);
				break;
			case APPLICATION:
				this.errors.push(err);
				this.#increment("application process error");
				break;
			case WARNING:
				this.warnings.push(err);
				if (key) this.#incrementW(key);
				break;
			case INFORMATION:
				this.informationals.push(err);
				if (key) this.#incrementI(key);
				break;
		}
	}

	/**
	 * log an error from the service list or program metadata analysis
	 *
	 * @param {integer}                  e.type      (optional) ERROR(default) or WARNING
	 * @param {string}                   e.code      Error code
	 * @param {string}                   e.message   The error message
	 * @param {string}                   e.key       (optional)The category of the message
	 * @param {string or libxmljs2:Node} e.fragment  (optional) The XML fragment (or node in the XML document) triggering the error
	 * @param {integer}                  e.line      (optional) the line number of the element in the XML document that triggered the error
	 */
	addError(e) {
		const _INVALID_CALL = "invalid addError call";
		let argsOK = true;
		if (!Object.prototype.hasOwnProperty.call(e, "type")) e.type = ERROR;
		if (!Object.prototype.hasOwnProperty.call(e, "reportInTable")) e.reportInTable = true;

		if (![ERROR, WARNING, INFORMATION, APPLICATION].includes(e.type)) {
			this.errors.push({ code: "ERR000", message: `addError() called with invalid type property (${e.type})` });
			this.#increment(_INVALID_CALL);
			argsOK = false;
		}
		if (!e.code) {
			this.errors.push({ code: "ERR001", message: "addError() called without code property" });
			this.#increment(_INVALID_CALL);
			e.code = "ERR001";
			argsOK = false;
		}
		if (!e.message) {
			this.errors.push({ code: "ERR002", message: "addError() called without message property" });
			this.#increment(_INVALID_CALL);
			e.message = "no error message";
			argsOK = false;
		}

		if (!argsOK) return;

		if (e.multiElementError) {
			/**
			 * this type of error involves multiple elements, for example when the cardinality exceeds a specified limit.
			 * each element of multiElementError is an element that is marked up, but the error message is
			 * only reported once in the error list
			 */
			this.#insertErrorData(e.type, e.key, { code: e.code, message: e.message });
			e.multiElementError.forEach((fragment) => {
				if (fragment && !datatypeIs(fragment, "string")) this.#setError(e.type, e.code, e.message, fragment.line());
			});
		} else if (e.fragments) {
			// note that the line of the error is derived from the fragment -- e.line is only used with the fragment is already a string
			e.fragments.forEach((fragment) => {
				let newError = { code: e.code, message: e.message };
				if (fragment) {
					newError.element = datatypeIs(fragment, "string") ? fragment : this.#prettyPrint(fragment);

					if (datatypeIs(fragment, "string")) {
						if (Object.prototype.hasOwnProperty.call(e, "line")) {
							this.#setError(e.type, e.code, e.message, e.line);
							newError.line = e.line - 2;
						}
					} else {
						this.#setError(e.type, e.code, e.message, fragment.line());
						newError.line = fragment.line() - 2;
					}
					if (e.reportInTable) this.#insertErrorData(e.type, e.key, newError);
				}
			});
		} else if (e.fragment) {
			// note that the line of the error is derived from the fragment -- e.line is only used with the fragment is already a string
			let newError = { code: e.code, message: e.message, element: datatypeIs(e.fragment, "string") ? e.fragment : this.#prettyPrint(e.fragment) };

			if (datatypeIs(e.fragment, "string")) {
				if (Object.prototype.hasOwnProperty.call(e, "line")) {
					this.#setError(e.type, e.code, e.message, e.line);
					newError.line = e.line - 2;
				}
			} else {
				this.#setError(e.type, e.code, e.message, e.fragment.line());
				newError.line = e.fragment.line() - 2;
			}
			if (e.reportInTable) this.#insertErrorData(e.type, e.key, newError);
		} else {
			let newError = { code: e.code, message: e.message, element: null };
			if (e.line) {
				this.#setError(e.type, e.code, e.message, e.line);
				newError.line = e.line - 2;
			}
			if (e.reportInTable) this.#insertErrorData(e.type, e.key, newError);
		}
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

	numCountsErr() {
		return this.#numCountsE;
	}
	numCountsWarn() {
		return this.#numCountsW;
	}
	numCountsInfo() {
		return this.#numCountsI;
	}

	/**
	 * built up descriptive information on the errors found in the analysis
	 *
	 * @param {string}  e.code         Error code, should be the same as @e.code passed to addError
	 * @param {string}  e.description  A long form description of the stated error code
	 */
	errorDescription(e) {
		if (!e.code || !e.description) return;
		let found = this.errorDescriptions.find((element) => e.code == element.code);
		if (found) {
			if (found.description.indexOf(e.description) == -1) found.description += `\n${e.description}`;
		} else this.errorDescriptions.push(e);
	}
}
