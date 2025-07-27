/**
 * error_list.mjs
 *
 * Manages errors and warnings for the application
 */
import { datatypeIs } from "../phlib/phlib.js";

export const ERROR = "(E)",
	DEBUG = "(D)",
	WARNING = "(W)",
	INFORMATION = "(I)",
	APPLICATION = "(A)",
	FATAL = "(F)";

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
	 * @param {String} doc   The document received for validation
	 */
	loadDocument(doc) {
		this.markupXML = doc.split("\n").map((str, index) => ({ value: str, ix: index + 1 }));
	}
	/**
	 * attach an error message to a particular line in the received text
	 * @param {String} type     the type of error message, e.g. APPLICATION, ERROR, WARNING...
	 * @param {String} code     the short code of the error
	 * @param {String} message  the verbose error message
	 * @param {integer} lineNo  the line number in the received text to attach the error to
	 */
	/* private method */ #setError(type, code, message, lineNo) {
		let found = this.markupXML.find((line) => line.ix == lineNo);
		if (found) {
			if (!found.validationErrors) found.validationErrors = [];
			found.validationErrors.push(`${type} ${code}: ${message}`);
		}
	}

	/* private method*/ #incrementF(key) {
		let c = this.countsFatal.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsFatal.push({ key: key, count: 1 });
	}
	setF(key, value = 1) {
		let c = this.countsFatak.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsFatal.push({ key: key, count: value });
	}
	/* private method*/ #increment(key) {
		let c = this.countsErr.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsErr.push({ key: key, count: 1 });
	}
	set(key, value = 1) {
		let c = this.countsErr.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsErr.push({ key: key, count: value });
	}
	/* private method*/ #incrementW(key) {
		let c = this.countsWarn.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsWarn.push({ key: key, count: 1 });
	}
	setW(key, value = 1) {
		let c = this.countsWarn.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsWarn.push({ key: key, count: value });
	}
	/* private method*/ #incrementI(key) {
		let c = this.countsInfo.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsInfo.push({ key: key, count: 1 });
	}
	setI(key, value = 1) {
		let c = this.countsInfo.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsInfo.push({ key: key, count: value });
	}

	/* private method */ #prettyPrint(node) {
		const t = node.prettyPrint();
		const maxLen = nthIndexOf(t, "\n", MAX_FRAGMENT_LINES);
		return maxLen == -1 ? t : `${t.slice(0, maxLen)}\n....\n`;
	}

	/* private method */ #insertErrorData(type, key, err) {
		switch (type) {
			case FATAL:
				this.fatals.push(err);
				if (key) this.#incrementF(key);
				break;
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

	/* private method */ #debugMessage(err) {
		this.debugs.push(err);
	}

	/**
	 * log an error from the service list or program metadata analysis
	 *
	 * @param {String}               e.type        (optional) ERROR(default) or WARNING
	 * @param {String}               e.code        Error code
	 * @param {String}               e.message     The error message
	 * @param {String}               e.key         (optional)The category of the message
	 * @param {String or XmlElement} e.fragment    (optional) The XML fragment (or node in the XML document) triggering the error
	 * @param {integer}              e.line        (optional) the line number of the element in the XML document that triggered the error
	 * @param {String}               e.description (optional) a description of the error
	 * @param {String}               e.clause      (optional) the specification clause/section that is violated (only used with @e.description is provided)
	 */
	addError(e) {
		const _INVALID_CALL = "invalid addError call";
		let argsOK = true;
		if (!Object.prototype.hasOwnProperty.call(e, "type")) e.type = ERROR;
		if (!Object.prototype.hasOwnProperty.call(e, "reportInTable")) e.reportInTable = true;

		if (![FATAL, ERROR, WARNING, INFORMATION, APPLICATION, DEBUG].includes(e.type)) {
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

		if (e.type == DEBUG) {
			this.#debugMessage({ code: e.code, message: e.message });
		} else if (e.multiElementError) {
			/**
			 * this type of error involves multiple elements, for example when the cardinality exceeds a specified limit.
			 * each element of multiElementError is an element that is marked up, but the error message is
			 * only reported once in the error list
			 */
			this.#insertErrorData(e.type, e.key, { code: e.code, message: e.message });
			e.multiElementError.forEach((fragment) => {
				if (fragment && !datatypeIs(fragment, "string")) this.#setError(e.type, e.code, e.message, fragment.line);
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
							newError.line = e.line;
						}
					} else {
						this.#setError(e.type, e.code, e.message, fragment.line);
						newError.line = fragment.line;
					}
					if (e.reportInTable) this.#insertErrorData(e.type, e.key, newError);
				}
			});
		} else if (e.fragment) {
			// note that the line of the error is derived from the fragment -- e.line is only used when the fragment is already a string
			let newError = { code: e.code, message: e.message, element: datatypeIs(e.fragment, "string") ? e.fragment : this.#prettyPrint(e.fragment) };

			if (datatypeIs(e.fragment, "string")) {
				if (Object.prototype.hasOwnProperty.call(e, "line")) {
					this.#setError(e.type, e.code, e.message, e.line);
					newError.line = e.line;
				}
			} else {
				this.#setError(e.type, e.code, e.message, e.fragment.line);
				newError.line = e.fragment.line;
			}
			if (e.reportInTable) this.#insertErrorData(e.type, e.key, newError);
		} else {
			let newError = { code: e.code, message: e.message, element: null };
			if (e.line) {
				this.#setError(e.type, e.code, e.message, e.line);
				newError.line = e.line;
			}
			if (e.reportInTable) this.#insertErrorData(e.type, e.key, newError);
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
	 * @param {String}  e.code         Error code, should be the same as @e.code passed to addError
	 * @param {String}  e.description  A long form description of the stated error code
	 * @param {String}  e.clause      (optional) the specification clause/section that is violated (only used with @e.description is provided)
	 */
	errorDescription(e) {
		if (!e.code || !e.description) return;
		let found = this.errorDescriptions.find((element) => e.code == element.code);
		if (found) {
			if (found.description.indexOf(e.description) == -1) found.description += `\n${e.description}`;
		} else this.errorDescriptions.push(e);
	}
}
