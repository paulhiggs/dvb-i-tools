/**
 * json_results.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * The JSON response of the /validate_*_json endpoints: the counts for the document validated, a summary of the documents
 * it traversed into, and optionally a tree with a node for each traversed document
 */

import ErrorList from "./error_list.mts"
import type { SeverityList } from "./error_list.mts"
import { skippedTraversal } from "./traversal.mts"

const LISTS: SeverityList[] = ["fatals", "errors", "warnings", "informationals", "suppressed"];
const SEVERITY_NAME = ["none", "debug", "information", "warning", "error", "fatal"];

// the codes of the traversal findings that a client may want to count
const TRAVERSAL_CODES = ["TRAV001", "TRAV002", "TRAV003", "TRAV004"];


// suppressed: the findings that the market of the validation suppresses (issue #119)
type Counts = { fatals: number; errors: number; warnings: number; informationals: number; suppressed: number };

const countsOf = (errs: ErrorList): Counts => ({ fatals: errs.numFatals(), errors: errs.numErrors(), warnings: errs.numWarnings(), informationals: errs.numInformationals(), suppressed: errs.numSuppressed() });

// the number of times each code was reported, for each severity that has any
function codesOf(errs: ErrorList): Partial<Record<SeverityList, Record<string, number>>> {
	const codes: Partial<Record<SeverityList, Record<string, number>>> = {};
	for (const list of LISTS) {
		const reported = errs.codesReported(list);
		if (reported.length > 0) codes[list] = Object.fromEntries(reported);
	}
	return codes;
}

// every document traversed into, at any depth
function* traversedDocuments(errs: ErrorList): Generator<ErrorList> {
	for (const nested of errs.nestedErrors) {
		yield nested;
		yield* traversedDocuments(nested);
	}
}

export type TraversalSummary = {
	documents: number; // documents traversed into (retrieved and validated)
	skipped: number; // referenced documents that were not retrieved, because the depth or document limit was reached
	repeats: number; // further references to referenced documents (traversed or not), which were not requested again: as in the HTML report
	withFatals: number; // traversed documents with at least one fatal error
	withErrors: number;
	withWarnings: number;
	totals: Counts; // the findings of all the traversed documents together
	traversal: Record<string, number>; // how many times each TRAV code was reported (TRAV002/TRAV003 for the skipped documents)
};

/**
 * summarise the documents a validation traversed into
 *
 * @returns {TraversalSummary | undefined} the summary, or undefined if no document was traversed into
 */
export function traversalSummary(errs: ErrorList): TraversalSummary | undefined {
	if (errs.nestedErrors.length == 0) return undefined;
	const summary: TraversalSummary = { documents: 0, skipped: 0, repeats: 0, withFatals: 0, withErrors: 0, withWarnings: 0, totals: { fatals: 0, errors: 0, warnings: 0, informationals: 0, suppressed: 0 }, traversal: {} };
	const countTraversal = (list: ErrorList) => {
		for (const l of LISTS)
			for (const [code, count] of list.codesReported(l))
				if (TRAVERSAL_CODES.includes(code)) summary.traversal[code] = (summary.traversal[code] ?? 0) + count;
	};
	countTraversal(errs); // TRAV codes can also be reported in the document validated
	for (const doc of traversedDocuments(errs)) {
		countTraversal(doc);
		summary.repeats += (doc.references ?? 1) - 1;
		if (skippedTraversal(doc)) {
			summary.skipped++;
			continue;
		}
		summary.documents++;
		const counts = countsOf(doc);
		if (counts.fatals > 0) summary.withFatals++;
		if (counts.errors > 0) summary.withErrors++;
		if (counts.warnings > 0) summary.withWarnings++;
		for (const l of LISTS) summary.totals[l] += counts[l];
	}
	return summary;
}

export type TreeOptions = {
	problemsOnly?: boolean; // only documents with fatal errors, errors or warnings (and the documents leading to them); skipped documents are left out
	maxDepth?: number; // the deepest level of traversed documents to include (1 = those referenced by the document validated)
};

export type DocumentNode = {
	url?: string;
	type?: string;
	description?: string;
	severity: string; // the most severe finding: none, debug, information, warning, error or fatal
	counts: Counts;
	codes: Partial<Record<SeverityList, Record<string, number>>>;
	references?: number; // how many times the document was referenced, when more than once
	skipped?: string; // TRAV002 or TRAV003, for a referenced document that was skipped because a traversal limit was reached
	nested?: DocumentNode[];
	omitted?: number; // traversed documents below this one that are not included (because of maxDepth or problemsOnly)
};

const hasProblems = (errs: ErrorList): boolean => errs.numFatals() + errs.numErrors() + errs.numWarnings() > 0;

function nodeOf(errs: ErrorList, depth: number, options: TreeOptions): DocumentNode | undefined {
	const node: DocumentNode = { url: errs.source, type: errs.type, description: errs.description, severity: SEVERITY_NAME[errs.severity()], counts: countsOf(errs), codes: codesOf(errs) };
	if ((errs.references ?? 1) > 1) node.references = errs.references;
	const skipped = depth > 0 ? skippedTraversal(errs) : undefined;
	if (skipped) node.skipped = skipped;
	let omitted = 0;
	const nested: DocumentNode[] = [];
	for (const child of errs.nestedErrors) {
		const below = child.nestedErrors.length > 0 ? [...traversedDocuments(child)].length : 0;
		if (options.maxDepth != undefined && depth + 1 > options.maxDepth) {
			omitted += 1 + below;
			continue;
		}
		const childNode = nodeOf(child, depth + 1, options);
		if (childNode) nested.push(childNode);
		else omitted += 1 + below;
	}
	if (nested.length > 0) node.nested = nested;
	if (omitted > 0) node.omitted = omitted;
	// with problemsOnly, a traversed document is kept if it has problems, or if a document below it is kept
	if (depth > 0 && options.problemsOnly && (skipped || !hasProblems(errs)) && nested.length == 0) return undefined;
	return node;
}

/**
 * a tree with a node for the document validated and for each document it traversed into
 *
 * @param {ErrorList}   errs     the results of the validation
 * @param {TreeOptions} options  which traversed documents to include
 * @returns {DocumentNode} the node of the document validated
 */
export const documentTree = (errs: ErrorList, options: TreeOptions = {}): DocumentNode => nodeOf(errs, 0, options)!;

export type ResultMode = "summary" | "tree" | "all";

/**
 * the JSON response of a validation
 *
 * @param {ErrorList}   errs      the results of the validation
 * @param {ResultMode}  mode      "summary" (the default): counts, and a summary of the traversed documents;
 *                                "tree": also a node for each document; "all": the whole ErrorList, as before
 * @param {TreeOptions} options   which traversed documents to include in the tree
 * @param {string[]}    parseErr  why the document could not be obtained or validated, if it could not
 * @returns {Record<string, unknown>} the response, to be serialised with JSON.stringify()
 */
export function jsonResult(errs: ErrorList, mode: ResultMode = "summary", options: TreeOptions = {}, parseErr?: string[]): Record<string, unknown> {
	const result: Record<string, unknown> = parseErr ? { parseErr } : {};
	if (mode == "all") {
		result.errs = errs;
		return result;
	}
	Object.assign(result, countsOf(errs));
	const traversed = traversalSummary(errs);
	if (traversed) result.traversed = traversed;
	if (errs.timing) result.timing = errs.timing;
	// the market the document was validated for (issue #119)
	if (errs.market) result.market = errs.market;
	// the coverage of the schedule of each service of a service list validated with traversal (issue #122)
	if (errs.scheduleCoverage?.length) result.scheduleCoverage = errs.scheduleCoverage;
	if (mode == "tree") result.document = documentTree(errs, options);
	return result;
}
