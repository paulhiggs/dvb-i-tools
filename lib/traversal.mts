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
import { recordTraversal, repeatedTraversal } from "./safe_fetch.mts"

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
	errs.nestedErrors.push(nested)
	return nested
}
