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
import type { ValidationTiming } from "./safe_fetch.mts"
import { marketSeverityOf } from "./safe_fetch.mts"
import type { ServiceCoverage } from "./schedule_coverage.mts"

export const ERROR: string = "(E)",
	DEBUG: string = "(D)",
	WARNING: string = "(W)",
	INFORMATION: string = "(I)",
	APPLICATION: string = "(A)",
	FATAL: string = "(F)";

// the type of a finding for each severity a market can give (markets.mts), and the name of each type
const MARKET_TYPES: Record<string, string> = { error: ERROR, warning: WARNING, information: INFORMATION };
const TYPE_NAMES: Record<string, string> = { [ERROR]: "an error", [WARNING]: "a warning", [INFORMATION]: "information" };

const MAX_FRAGMENT_LINES: number = 6; // the maximum number of lines in an element to display when that element has an error

const nthIndexOf = (string	: string, pattern: string, n: number) : number => {
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

export type ErrorListOptions = {
	markup?: boolean; // keep a marked up copy of the document and the fragment text of each error
	summaryOnly?: boolean; // keep only the number of times each code is reported, not the individual messages
};

export type SeverityList = "fatals" | "errors" | "warnings" | "informationals";

// the number of times each code has been reported, in order of first report
export type CodeCounts = Record<SeverityList, Record<string, number>>;

type DebugMessageType = {
	code: string;
	message: string;
}

// the empty arrays and counts of a list that keeps only a summary. They are shared by every such list until something is
// added, when the list makes its own (see #store(), #debugMessage() and addNested()). Most of the lists of a large
// traversal are of documents skipped because a traversal limit was reached, which only ever have one warning, and many
// traversed documents have no findings (dvb-i-tools #99). They are frozen, so adding to them by mistake fails
const NOTHING: readonly never[] = Object.freeze([]);
const NO_CODES: Readonly<Record<string, number>> = Object.freeze({});
const NO_CODE_COUNTS: Readonly<CodeCounts> = Object.freeze({ fatals: NO_CODES, errors: NO_CODES, warnings: NO_CODES, informationals: NO_CODES });
// the counts of a list that has reported one code once, shared by all such lists: one for each code and severity
const ONLY_CODE = new Map<string, CodeCounts>();
const onlyCode = (list: SeverityList, code: string): CodeCounts => {
	const key = `${list} ${code}`;
	let counts = ONLY_CODE.get(key);
	if (!counts) {
		counts = Object.freeze({ ...NO_CODE_COUNTS, [list]: Object.freeze({ [code]: 1 }) }) as CodeCounts;
		ONLY_CODE.set(key, counts);
	}
	return counts;
};

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

	nestedErrors: ErrorList[]

	// when only a summary is kept (for traversed documents), the number of times each code is reported replaces the
	// individual messages in fatals/errors/warnings/informationals, and no error descriptions or category counts are kept
	codeCounts?: CodeCounts

	// true when a marked up copy of the document and the text of each error's fragment are kept. Only the document that a
	// validation was requested for needs them (for the report and the archive), so they are not kept for traversed
	// documents. Private fields are not included when the list is serialised to JSON
	#keepMarkup: boolean

	source?: string
	type?: string
	description?: string

	// for a traversed document, the number of times its URL was referenced during the validation. It is only validated
	// (and reported) once
	references?: number

	// for the document a validation was requested for: how long the validation took, and the retrievals it made
	timing?: ValidationTiming

	// for a service list validated with traversal: the coverage of the schedule of each service (issue #122)
	scheduleCoverage?: ServiceCoverage[]

	/**
	 * @param {string}           location     where the document came from (URL or file name)
	 * @param {string}           type         the type of document or request
	 * @param {string}           description  a printable description of the document
	 * @param {ErrorListOptions} options
	 *                             markup     keep a marked up copy of the document and the fragment text of each error
	 *                                        (default false)
	 *                           summaryOnly  keep only the number of times each code is reported (default false)
	 */
	constructor(location?: string, type?: string, description?: string, options: ErrorListOptions = {}) {
		this.#keepMarkup = options.markup ?? false;
		// a list that keeps only a summary never adds to the category counts, the findings or the code descriptions, so they
		// share one empty array instead of each having their own: a validation with traversal can keep tens of thousands of
		// these lists (dvb-i-tools #99). Its debug messages, nested lists and code counts are shared until it has some
		const empty = <T,>(): T[] => (options.summaryOnly ? (NOTHING as unknown as T[]) : []);
		this.countsFatal = empty();
		this.countsErr = empty();
		this.countsWarn = empty();
		this.countsInfo = empty();
		this.fatals = empty();
		this.errors = empty();
		this.warnings = empty();
		this.debugs = empty();
		this.informationals = empty();
		if (this.#keepMarkup) this.markupXML = [];
		this.errorDescriptions = empty();

		this.nestedErrors = empty()
		if (options.summaryOnly) this.codeCounts = NO_CODE_COUNTS as CodeCounts
		this.source = location
		this.type = type
		this.description = description
	}

	setLocation(sourceLoc: string) {
		this.source = sourceLoc
	}

	setType(sourceType: string) {
		this.type = sourceType
	}


	/**
	 * an error list for the document a validation was requested for, keeping the marked up copy of the document
	 */
	static withMarkup(): ErrorList {
		return new ErrorList(undefined, undefined, undefined, { markup: true });
	}

	/**
	 * an error list for a document reached by traversal, which is only reported by its compact summary
	 */
	static summaryOnly(location: string, type: string, description: string): ErrorList {
		return new ErrorList(location, type, description, { summaryOnly: true });
	}

	/**
	 * loads the text that can be marked up with any validation errors/warnings etc (only if this list keeps markup)
	 * @param {string} doc   The document received for validation
	 */
	loadDocument(doc: string) {
		if (this.#keepMarkup) this.markupXML = doc.split("\n").map((str, index) => ({ value: str, ix: index + 1 }));
	}

	/**
	 * attach an error message to a particular line in the received text
	 * @param {string} type     the type of error message, e.g. APPLICATION, ERROR, WARNING...
	 * @param {string} code     the short code of the error
	 * @param {string} message  the verbose error message
	 * @param {number} lineNo  the line number in the received text to attach the error to
	 */
	/* private method */ #setError(type: string, code: string, message: string, lineNo: number) {
		const found = this.markupXML?.find((line) => line.ix == lineNo);
		if (found) {
			if (!found.validationErrors) found.validationErrors = [];
			found.validationErrors.push(`${type} ${code}: ${message}`);
		}
	}

	/* private method*/ #incrementF(key: string) {
		if (this.codeCounts) return;
		const c = this.countsFatal.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsFatal.push({ key: key, count: 1 });
	}
	setF(key: string, value: number = 1) {
		if (this.codeCounts) return;
		const c = this.countsFatal.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsFatal.push({ key: key, count: value });
	}
	/* private method*/ #increment(key: string) {
		if (this.codeCounts) return;
		const c = this.countsErr.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsErr.push({ key: key, count: 1 });
	}
	set(key: string, value: number = 1) {
		if (this.codeCounts) return;
		const c = this.countsErr.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsErr.push({ key: key, count: value });
	}
	/* private method*/ #incrementW(key: string) {
		if (this.codeCounts) return;
		const c = this.countsWarn.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsWarn.push({ key: key, count: 1 });
	}
	setW(key: string, value: number = 1) {
		if (this.codeCounts) return;
		const c = this.countsWarn.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsWarn.push({ key: key, count: value });
	}
	/* private method*/ #incrementI(key: string) {
		if (this.codeCounts) return;
		const c = this.countsInfo.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsInfo.push({ key: key, count: 1 });
	}
	setI(key: string, value: number = 1) {
		if (this.codeCounts) return;
		const c = this.countsInfo.find((e) => e.key == key);
		if (c) c.count++;
		else this.countsInfo.push({ key: key, count: value });
	}

	/* private method */ #prettyPrint(node: XmlElement) : string | null {
		// the fragment text is only kept by a list that keeps markup (i.e. not for a traversed document)
		if (!this.#keepMarkup) return null;
		const t = node.toString();
		const maxLen = nthIndexOf(t, "\n", MAX_FRAGMENT_LINES);
		return maxLen == -1 ? t : `${t.slice(0, maxLen)}\n....\n`;
	}

	/* private method */ #store(list: SeverityList, err: ErrorType) {
		if (this.codeCounts) {
			// the first code reported shares the counts of every list with only that code, reported once (such as the TRAV003
			// warning of every skipped document). Another report replaces them with the list's own
			if (this.codeCounts == NO_CODE_COUNTS) {
				this.codeCounts = onlyCode(list, err.code);
				return;
			}
			if (Object.isFrozen(this.codeCounts)) this.codeCounts = { ...this.codeCounts };
			if (Object.isFrozen(this.codeCounts[list])) this.codeCounts[list] = { ...this.codeCounts[list] };
			const counts = this.codeCounts[list];
			counts[err.code] = (counts[err.code] ?? 0) + 1;
		}
		else this[list].push(err);
	}

	/* private method */ #insertErrorData( key: string | undefined, err: ErrorType) {
		switch (err.type) {
			case FATAL:
				this.#store("fatals", err);
				if (key) this.#incrementF(key);
				break;
			case ERROR:
				this.#store("errors", err);
				if (key) this.#increment(key);
				break;
			case APPLICATION:
				this.#store("errors", err);
				this.#increment("application process error");
				break;
			case WARNING:
				this.#store("warnings", err);
				if (key) this.#incrementW(key);
				break;
			case INFORMATION:
				this.#store("informationals", err);
				if (key) this.#incrementI(key);
				break;
		}
	}

	/* private method */ #count(list: SeverityList): number {
		return this.codeCounts ? Object.values(this.codeCounts[list]).reduce((a, b) => a + b, 0) : this[list].length;
	}

	/* private method */ #debugMessage(err: DebugMessageType) {
		if (Object.isFrozen(this.debugs)) this.debugs = [];
		this.debugs.push(err);
	}

	/**
	 * add the results of a document traversed into from this one
	 *
	 * @param {ErrorList} nested  the results of the traversed document
	 */
	addNested(nested: ErrorList): void {
		if (Object.isFrozen(this.nestedErrors)) this.nestedErrors = [];
		this.nestedErrors.push(nested);
	}


	/**
	 * log an error from the service list or program metadata analysis
	 *
	 * @param {string}              e.type        (optional) ERROR(default) or WARNING
	 * @param {string}              e.code        Error code
	 * @param {string}              e.message     The error message
	 * @param {string}              e.key         (optional)The category of the message
	 * @param {string | XmlElement} e.fragment    (optional) The XML fragment (or node in the XML document) triggering the error
	 * @param {number}              e.line        (optional) the line number of the element in the XML document that triggered the error
	 * @param {string}              e.description (optional) a description of the error
	 * @param {string}              e.clause      (optional) the specification clause/section that is violated (only used with @e.description is provided)
	 */
	addError(e: ReportedErrorType) {
		const _INVALID_CALL = "invalid addError call";
		let argsOK = true;
		DefaultProperty(e, "type", ERROR);
		DefaultProperty(e, "reportInTable", true);

		if (![FATAL, ERROR, WARNING, INFORMATION, APPLICATION, DEBUG].includes(e.type as string)) {
			this.#store("errors", { code: "ERR000", type: APPLICATION, message: `addError() called with invalid type property (${e.type})` });
			this.#increment(_INVALID_CALL);
			argsOK = false;
		}
		if (!e.code) {
			this.#store("errors", { code: "ERR001", type: APPLICATION, message: "addError() called without code property" });
			this.#increment(_INVALID_CALL);
			e.code = "ERR001";
			argsOK = false;
		}
		if (!e.message) {
			this.#store("errors", { code: "ERR002", type: APPLICATION, message: "addError() called without message property" });
			this.#increment(_INVALID_CALL);
			e.message = "no error message";
			argsOK = false;
		}

		if (!argsOK) return;

		// the market of the validation can change the severity of a finding, or turn it off (issue #119, decisions 20-22). The code
		// is never changed. A fatal, debug or application finding is not changed
		if ([ERROR, WARNING, INFORMATION].includes(e.type as string)) {
			const changed = marketSeverityOf(e.code);
			if (changed?.severity == "off") return;
			if (changed) {
				const type = MARKET_TYPES[changed.severity];
				if (type != e.type) e = { ...e, type, message: `${e.message} (${TYPE_NAMES[e.type as string]} in A177, ${TYPE_NAMES[type]} for the market ${changed.market})` };
			}
		}

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
		return this.#count("fatals");
	}
	numErrors() {
		return this.#count("errors");
	}
	numWarnings() {
		return this.#count("warnings");
	}
	numInformationals() {
		return this.#count("informationals");
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
	 * the number of times each code has been reported with a severity, in order of first report
	 *
	 * @param {SeverityList} list  the severity
	 * @returns {[string, number][]} the codes and their counts
	 */
	codesReported(list: SeverityList): [string, number][] {
		if (this.codeCounts) return Object.entries(this.codeCounts[list]);
		const counts: Record<string, number> = {};
		this[list].forEach((e: ErrorType) => (counts[e.code] = (counts[e.code] ?? 0) + 1));
		return Object.entries(counts);
	}

	compactSummary() {
		const summary = (list: SeverityList) => this.codesReported(list).map(([code, count]) => `"${code}"${count > 1 ? `=${count}` : ""}`).join(", ");
		return `F(${summary("fatals")}) E(${summary("errors")}) W(${summary("warnings")}) I(${summary("informationals")}) D:${this.debugs.length}`;
	}

	countsSummary() {
		return `F:${this.numFatals()} E:${this.numErrors()} W:${this.numWarnings()} I:${this.numInformationals()} D:${this.debugs.length} `;
	}

	severity() : number {
		if (this.numFatals() > 0) return 5
		else if (this.numErrors() > 0) return 4
		else if (this.numWarnings() > 0) return 3
		else if (this.numInformationals() > 0) return 2
		else if (this.debugs.length > 0) return 1
		return 0
	}
	
	/**
	 * built up descriptive information on the errors found in the analysis
	 *
	 * @param {string}  e.code         Error code, should be the same as @e.code passed to addError
	 * @param {string}  e.description  A long form description of the stated error code
	 * @param {string}  e.clause      (optional) the specification clause/section that is violated (only used with @e.description is provided)
	 */
	errorDescription(e: ErrorDescriptionType) {
		if (this.codeCounts || !e.code || !e.description) return;
		const found = this.errorDescriptions.find((element) => e.code == element.code);
		if (found) {
			if (found.description.indexOf(e.description) == -1) found.description += `\n${e.description}`;
		} 
		else this.errorDescriptions.push(e);
	}
}
