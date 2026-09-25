/**
 * error_list.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Manages errors and warnings for the application
 */

import { datatypeIs, DefaultProperty, HasProperty } from "./utils.mts"

export const ERROR: string = "(E)",
	DEBUG: string = "(D)",
	WARNING: string = "(W)",
	INFORMATION: string = "(I)",
	APPLICATION: string = "(A)",
	FATAL: string = "(F)";

const MAX_FRAGMENT_LINES: number = 6; // the maximum number of lines in an element to display when that element has an error

const nthIndexOf = (string	: string, pattern: string, n: number) => {
	let i = -1;
	while (n-- && i++ < string.length) {
		i = string.indexOf(pattern, i);
		if (i < 0) break;
	}
	return i;
};

type ErrorKeyType = {
	key: string;
	count: number;
}

export type ErrorType = {
	type: string;
	code: string; 
	message: string; 
	element?: string | null; 
	line?: number
}

export type ErrorDescriptionType = {
	code: string;
	description: string;
	clause?: string;
}

export type ReportedErrorType = {
	type?: string;
	code: string;
	message: string;
	key?: string;
	fragment?: string | XmlElement;
	fragments?: Array< string | XmlElement>;
	multiElementError?: Array<XmlElement | null>;
	line? : number;
	description?: string;
	clause?: string;
	reportInTable?: boolean;
}

type DebugMessageType = {
	code: string;
	message: string;
}

export default class ErrorList {

	countsFatal: ErrorKeyType[];
	countsErr: ErrorKeyType[];
	countsWarn: ErrorKeyType[];
	countsInfo: ErrorKeyType[];

	fatals: ErrorType[];
	errors: ErrorType[];
	warnings: ErrorType[];
	debugs: DebugMessageType[];
	informationals: ErrorType[];

	errorDescriptions: ErrorDescriptionType[];

	markupXML?: { value: string; ix: number; validationErrors?: string[] }[];

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
	loadDocument(doc: string) {
		this.markupXML = doc.split("\n").map((str, index) => ({ value: str, ix: index + 1 }));
	}

	/**
	 * attach an error message to a particular line in the received text
	 * @param {string} type     the type of error message, e.g. APPLICATION, ERROR, WARNING...
	 * @param {string} code     the short code of the error
	 * @param {string} message  the verbose error message
	 * @param {integer} lineNo  the line number in the received text to attach the error to
	 */
	/* private method */ #setError(type: string, code: string, message: string, lineNo: number) {
		const found = this.markupXML!.find((line) => line.ix == lineNo);
		if (found) {
			if (!found.validationErrors) found.validationErrors = [];
			found.validationErrors.push(`${type} ${code}: ${message}`);
		}
	}

	/* private method*/ #incrementF(key: string) {
		const c = this.countsFatal.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsFatal.push({ key: key, count: 1 });
	}
	setF(key: string, value: number = 1) {
		const c = this.countsFatal.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsFatal.push({ key: key, count: value });
	}
	/* private method*/ #increment(key: string) {
		const c = this.countsErr.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsErr.push({ key: key, count: 1 });
	}
	set(key: string, value: number = 1) {
		const c = this.countsErr.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsErr.push({ key: key, count: value });
	}
	/* private method*/ #incrementW(key: string) {
		const c = this.countsWarn.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsWarn.push({ key: key, count: 1 });
	}
	setW(key: string, value: number = 1) {
		const c = this.countsWarn.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsWarn.push({ key: key, count: value });
	}
	/* private method*/ #incrementI(key: string) {
		const c = this.countsInfo.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsInfo.push({ key: key, count: 1 });
	}
	setI(key: string, value: number = 1) {
		const c = this.countsInfo.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsInfo.push({ key: key, count: value });
	}

	/* private method */ #prettyPrint(node: XmlElement) {
		const t = node.toString();
		const maxLen = nthIndexOf(t, "\n", MAX_FRAGMENT_LINES);
		return maxLen == -1 ? t : `${t.slice(0, maxLen)}\n....\n`;
	}

	/* private method */ #insertErrorData( key: string | undefined, err: ErrorType) {
		switch (err.type) {
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

	/* private method */ #debugMessage(err: DebugMessageType) {
		this.debugs.push(err);
	}


	/**
	 * log an error from the service list or program metadata analysis
	 *
	 * @param {string}              e.type        (optional) ERROR(default) or WARNING
	 * @param {string}              e.code        Error code
	 * @param {string}              e.message     The error message
	 * @param {string}              e.key         (optional)The category of the message
	 * @param {string | XmlElement} e.fragment    (optional) The XML fragment (or node in the XML document) triggering the error
	 * @param {integer}             e.line        (optional) the line number of the element in the XML document that triggered the error
	 * @param {string}              e.description (optional) a description of the error
	 * @param {string}              e.clause      (optional) the specification clause/section that is violated (only used with @e.description is provided)
	 */
	addError(e: ReportedErrorType) {
		const _INVALID_CALL = "invalid addError call";
		let argsOK = true;
		DefaultProperty(e, "type", ERROR);
		DefaultProperty(e, "reportInTable", true);

		if (![FATAL, ERROR, WARNING, INFORMATION, APPLICATION, DEBUG].includes(e.type as string)) {
			this.errors.push({ code: "ERR000", type: APPLICATION, message: `addError() called with invalid type property (${e.type})` });
			this.#increment(_INVALID_CALL);
			argsOK = false;
		}
		if (!e.code) {
			this.errors.push({ code: "ERR001", type: APPLICATION, message: "addError() called without code property" });
			this.#increment(_INVALID_CALL);
			e.code = "ERR001";
			argsOK = false;
		}
		if (!e.message) {
			this.errors.push({ code: "ERR002", type: APPLICATION, message: "addError() called without message property" });
			this.#increment(_INVALID_CALL);
			e.message = "no error message";
			argsOK = false;
		}

		if (!argsOK) return;

		if (e.type == DEBUG) {
			this.#debugMessage({ code: e.code, message: e.message });
		} 
		else if (e.multiElementError) {
			/**
			 * this type of error involves multiple elements, for example when the cardinality exceeds a specified limit.
			 * each element of multiElementError is an element that is marked up, but the error message is
			 * only reported once in the error list
			 */
			this.#insertErrorData(e.key, { type: e.type as string, code: e.code, message: e.message });
			e.multiElementError.forEach((fragment) => {
				if (fragment && !datatypeIs(fragment, "string")) this.#setError(e.type as string, e.code, e.message, fragment.line);
			});
		} 
		else if (e.fragments) {
			// note that the line of the error is derived from the fragment -- e.line is only used with the fragment is already a string
			e.fragments.forEach((fragment) => {
				const newError: ErrorType = { type: e.type as string, code: e.code, message: e.message };
				if (fragment) {
					newError.element = datatypeIs(fragment, "string") ? fragment as string : this.#prettyPrint(fragment as XmlElement);

					if (datatypeIs(fragment, "string")) {
						if (HasProperty(e, "line")) {
							this.#setError(e.type as string, e.code, e.message, e.line as number);
							newError.line = e.line;
						}
					} else {
							newError.line = (fragment as XmlElement).line;
						this.#setError(e.type as string, e.code, e.message, newError.line);
					}
					if (e.reportInTable) this.#insertErrorData(e.key, newError);
				}
			});
		} 
		else if (e.fragment) {
			// note that the line of the error is derived from the fragment -- e.line is only used when the fragment is already a string
			const newError: ErrorType = { 
				type: e.type as string, 
				code: e.code,
				message: e.message, 
				element: datatypeIs(e.fragment, "string") 
					? e.fragment as string 
					: this.#prettyPrint(e.fragment as XmlElement) };

			if (datatypeIs(e.fragment, "string")) {
				if (HasProperty(e, "line")) {
					this.#setError(e.type as string, e.code, e.message, e.line as number);
					newError.line = e.line;
				}
			} else {
				newError.line = (e.fragment as XmlElement).line;
				this.#setError(e.type as string, e.code, e.message, newError.line);
			}
			if (e.reportInTable) this.#insertErrorData(e.key, newError);
		} 
		else {
			const newError: ErrorType  = { type: e.type as string, code: e.code, message: e.message, element: null };
			if (e.line) {
				this.#setError(e.type as string, e.code, e.message, e.line);
				newError.line = e.line;
			}
			if (e.reportInTable) this.#insertErrorData(e.key, newError);
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

	compactSummary() {
		const summary = (counts: ErrorType[]) => {
			const s: { code: string; count: number }[] = [];
			counts.forEach((e: ErrorType) => {
				const i = s.find((f) => f.code == e.code);
				if (i) i.count++;
				else s.push({ code: e.code, count: 1 });
			})
			return s.map((e) => `"${e.code}"${e.count>1 ? `=${e.count}` : ``}`).join(", ");
		};
		return `F(${summary(this.fatals)}) E(${summary(this.errors)}) W(${summary(this.warnings)}) I(${summary(this.informationals)})`;
	}

	countsSummary() {
		return `F:${this.fatals.length} E:${this.errors.length} W:${this.warnings.length} I:${this.informationals.length} D:${this.debugs.length} `;
	}
	
	/**
	 * built up descriptive information on the errors found in the analysis
	 *
	 * @param {string}  e.code         Error code, should be the same as @e.code passed to addError
	 * @param {string}  e.description  A long form description of the stated error code
	 * @param {string}  e.clause      (optional) the specification clause/section that is violated (only used with @e.description is provided)
	 */
	errorDescription(e: ErrorDescriptionType) {
		if (!e.code || !e.description) return;
		const found = this.errorDescriptions.find((element) => e.code == element.code);
		if (found) {
			if (found.description.indexOf(e.description) == -1) found.description += `\n${e.description}`;
		} 
		else this.errorDescriptions.push(e);
	}
}
