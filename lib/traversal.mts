/**
 * traversal.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Results of documents traversed into from the document being validated
 */

import ErrorList from "./error_list.mts"
import { currentObserver, recordTraversal, repeatedTraversal } from "./safe_fetch.mts"

/**
 * create the error list for a document to be traversed into, and add it to the results of the referencing document.
 * A URL is only traversed once during a validation: when it has already been requested, the repeat is counted against
 * the first request and no error list is created, so the caller must not traverse
 *
 * @param {ErrorList} errs         the results of the referencing document
 * @param {string}    url          the URL of the document to be traversed into
 * @param {string}    type         the type of document or request
 * @param {string}    description  a printable description of the document
 * @returns {ErrorList | null} the error list to validate the document into, or null if the URL was already requested
 */
export function nestedTraversal(errs: ErrorList, url: string, type: string, description: string): ErrorList | null {
	if (repeatedTraversal(url)) return null
	const nested = ErrorList.summaryOnly(url, type, description)
	recordTraversal(url, nested)
	errs.addNested(nested)
	currentObserver()?.requested?.(nested, errs)
	return nested
}

/**
 * tell the validation's observer (if any) about the progress of a traversed document, whose results are in errs (from
 * nestedTraversal()):
 * - skipped: the document is not traversed into, as a traversal limit was reached (TRAV002 / TRAV003)
 * - started: the document has been retrieved, and is being validated
 * - finished: the document, and any documents it traversed into, have been validated
 *
 * @param {ErrorList} errs  the results of the traversed document
 */
export const traversalSkipped = (errs: ErrorList): void => currentObserver()?.skipped?.(errs)
export const traversalStarted = (errs: ErrorList): void => currentObserver()?.started?.(errs)
export const traversalFinished = (errs: ErrorList): void => currentObserver()?.finished?.(errs)

// the codes of a referenced document that is not retrieved because a traversal limit was reached: the depth (TRAV002) or
// the maximum number of documents (TRAV003)
export const TRAVERSAL_LIMITS = ["TRAV002", "TRAV003"];

/**
 * the reason a referenced document was skipped (not retrieved) because a traversal limit was reached: the depth (TRAV002)
 * or the maximum number of documents (TRAV003). A skipped document is recorded with only that warning
 *
 * @param {ErrorList} errs  the results recorded for the referenced document
 * @returns {string | undefined} TRAV002 or TRAV003, or undefined for a document that was traversed into
 */
export function skippedTraversal(errs: ErrorList): string | undefined {
	const warnings = errs.codesReported("warnings");
	if (warnings.length != 1 || errs.numFatals() + errs.numErrors() + errs.numInformationals() > 0 || errs.nestedErrors.length > 0) return undefined;
	return TRAVERSAL_LIMITS.includes(warnings[0][0]) ? warnings[0][0] : undefined;
}
