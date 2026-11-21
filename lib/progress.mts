/**
 * progress.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Follows a validation as it happens, and reports its progress as events, so that the /check form can show the results of
 * the document while the documents it traverses into are still being validated (issue #104). The events are:
 *   root      the document's own results (HTML), once its rules have been checked. Findings of its deferred work (images,
 *             signature policies, traversal limits) come later, in the final results
 *   progress  every interval: the traversed documents started or finished since the last event, and the counts so far
 * The final results are not an event: they are the HTML report, which the caller sends after the validation
 */

import type ErrorList from "./error_list.mts"
import type { SeverityList } from "./error_list.mts"
import { validationTiming } from "./safe_fetch.mts"
import type { ValidationHandle, ValidationObserver } from "./safe_fetch.mts"

const SEVERITY_LISTS: SeverityList[] = ["fatals", "errors", "warnings", "informationals"]

// a traversed document, as reported in a progress event
export type DocumentProgress = {
	id: number // 1, 2, ... in the order the documents were requested
	parent: number // the id of the document that referenced it, 0 for the document being validated
	depth: number // 1 for a document referenced by the document being validated, ...
	description: string
	url: string
	state: "validating" | "done"
	severity?: number // when done: ErrorList.severity(), 0 (no findings) to 5 (fatal)
	codes?: Partial<Record<SeverityList, Record<string, number>>> // when done: the codes reported, with their counts
}

// how far the validation has got
export type ProgressCounts = {
	requested: number // documents requested by traversal, each URL once
	validated: number // documents validated
	skipped: number // documents not traversed into, as a traversal limit was reached
	waiting: number // documents requested, but not yet validated or skipped
	durationMs: number
	requests: number // retrievals made
	timeouts: number
}

export type ProgressEvent =
	| { event: "root"; html: string }
	| { event: "progress"; counts: ProgressCounts; documents: DocumentProgress[] }

type Tracked = { id: number; parent: number; depth: number; state: "requested" | "validating" | "done" | "skipped" }

export type ProgressOptions = {
	intervalMs?: number // how often progress events are sent (default 1000)
	rootHTML: (root: ErrorList) => string // renders the document's own results, for the root event
	canSend?: () => boolean // false while the client cannot take more data: progress is held back, and sent later in one event
}

export class ProgressReport implements ValidationObserver {
	readonly #root: ErrorList
	readonly #send: (event: ProgressEvent) => void
	readonly #options: ProgressOptions
	readonly #tracked = new WeakMap<ErrorList, Tracked>()
	#changed = new Map<number, ErrorList>() // documents whose state has changed since the last progress event
	#counts = { requested: 0, validated: 0, skipped: 0 }
	#validation: ValidationHandle | undefined
	#timer: ReturnType<typeof setInterval> | undefined
	#cancelled = false
	#lastSent = "" // the counts of the last progress event, so an unchanged one is not sent again

	/**
	 * @param {ErrorList}       root     the results of the document being validated
	 * @param {function}        send     sends an event to the client
	 * @param {ProgressOptions} options  how the report is made
	 */
	constructor(root: ErrorList, send: (event: ProgressEvent) => void, options: ProgressOptions) {
		this.#root = root
		this.#send = send
		this.#options = options
		this.#tracked.set(root, { id: 0, parent: 0, depth: 0, state: "validating" })
	}

	get cancelled(): boolean {
		return this.#cancelled
	}

	// stop the validation, e.g. when the client has gone away
	cancel(): void {
		this.#cancelled = true
		this.stop()
	}

	// stop sending progress events, when the validation has finished: the changes since the last event are sent first
	stop(): void {
		if (this.#timer) clearInterval(this.#timer)
		this.#timer = undefined
		if (this.#validation) this.flush(true)
	}

	attached(validation: ValidationHandle): void {
		this.#validation = validation
		this.#timer = setInterval(() => this.flush(), this.#options.intervalMs ?? 1000)
		this.#timer.unref?.()
	}

	rulesChecked(): void {
		if (this.#cancelled) return
		this.#send({ event: "root", html: this.#options.rootHTML(this.#root) })
		this.flush(true)
	}

	requested(document: ErrorList, parent: ErrorList): void {
		const from = this.#tracked.get(parent)
		if (!from || this.#tracked.has(document)) return
		this.#tracked.set(document, { id: ++this.#counts.requested, parent: from.id, depth: from.depth + 1, state: "requested" })
	}

	started(document: ErrorList): void {
		this.#change(document, "validating")
	}

	finished(document: ErrorList): void {
		if (this.#change(document, "done")) this.#counts.validated++
	}

	skipped(document: ErrorList): void {
		const tracked = this.#tracked.get(document)
		if (!tracked || tracked.state == "skipped") return
		tracked.state = "skipped"
		this.#counts.skipped++
		this.#changed.delete(tracked.id) // skipped documents are counted, not listed
	}

	#change(document: ErrorList, state: "validating" | "done"): boolean {
		const tracked = this.#tracked.get(document)
		if (!tracked || tracked.state == state || tracked.state == "skipped") return false
		tracked.state = state
		this.#changed.set(tracked.id, document)
		return true
	}

	/**
	 * the counts so far
	 */
	counts(): ProgressCounts {
		const timing = this.#validation ? validationTiming(this.#validation) : undefined
		const { requested, validated, skipped } = this.#counts
		return { requested, validated, skipped, waiting: requested - validated - skipped, durationMs: timing?.durationMs ?? 0, requests: timing?.requests ?? 0, timeouts: timing?.timeouts ?? 0 }
	}

	/**
	 * send a progress event with the documents that have changed since the last one, unless nothing has changed or the
	 * client cannot take more data (the changes are then sent in a later event)
	 *
	 * @param {boolean} force  send the event even when the client cannot take more data
	 */
	flush(force = false): void {
		if (this.#cancelled) return
		if (!force && this.#options.canSend && !this.#options.canSend()) return
		const counts = this.counts()
		const summary = JSON.stringify({ ...counts, durationMs: 0 })
		if (this.#changed.size == 0 && summary == this.#lastSent && !force) return
		const documents: DocumentProgress[] = []
		for (const [id, document] of this.#changed) {
			const tracked = this.#tracked.get(document)!
			const progress: DocumentProgress = { id, parent: tracked.parent, depth: tracked.depth, description: document.description ?? "", url: document.source ?? "", state: tracked.state == "done" ? "done" : "validating" }
			if (progress.state == "done") {
				progress.severity = document.severity()
				const codes: DocumentProgress["codes"] = {}
				for (const list of SEVERITY_LISTS) {
					const reported = document.codesReported(list)
					if (reported.length > 0) codes[list] = Object.fromEntries(reported)
				}
				progress.codes = codes
			}
			documents.push(progress)
		}
		documents.sort((a, b) => a.id - b.id)
		this.#changed = new Map()
		this.#lastSent = summary
		this.#send({ event: "progress", counts, documents })
	}
}
