/**
 * schedule_coverage.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * How much of each day the schedule of a service covers (issue #122). A177r8 clause 6.1 describes the content guide as
 * holding the schedule for 28 days forwards and backwards (7 days for the German profile, #139 DE-1). During traversal, the schedule
 * of a service is requested in 6 hour windows (clause 6.5.2.2); the events of every window are collected here, and the
 * coverage of each UTC day is worked out from their union once all the windows have been validated. An event that started
 * in an earlier window still covers this one, so the result does not depend on whether the server supports inclusive=true
 */

import type { XmlElement } from "libxml2-wasm";

import { tva } from "./TVA_definitions.mts";
import type { ValidationHandle } from "./safe_fetch.mts";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// a gap between events of this length or less is not counted, e.g. between programmes, or from rounding
export const COVERAGE_TOLERANCE_MS = 5 * MINUTE_MS;

/**
 * the coverage of a day:
 *   full           the events cover the whole day (gaps of up to COVERAGE_TOLERANCE_MS are not counted)
 *   partial        the events cover some of the day, and there is a gap
 *   none           the events do not cover any of the day (including when its requests failed)
 *   indeterminate  a window of the day was skipped because a traversal limit was reached, and the windows that were
 *                  validated do not show a gap
 */
export type DayState = "full" | "partial" | "none" | "indeterminate";
export const DAY_STATES: DayState[] = ["full", "partial", "none", "indeterminate"];

export type DayCoverage = {
	date: string; // the UTC day, YYYY-MM-DD
	state: DayState;
	coveredMinutes: number; // how much of the day the events cover
	offset: number; // the day relative to today: -1 is yesterday, 0 today and 1 tomorrow
};

export type ServiceCoverage = {
	service: string; // the service ID used in the requests (the ContentGuideServiceRef or UniqueIdentifier)
	services: string[]; // the UniqueIdentifiers of the services whose schedule this is (several can use the same service ID)
	daysBefore: number; // the days before today that are expected
	daysAfter: number; // the days after today that are expected
	counts: Record<DayState, number>;
	days: DayCoverage[];
};

// a period of time, in milliseconds since the epoch: [start, end)
type Period = [number, number];

// merge periods that overlap or touch, in order of start
const union = (periods: Period[]): Period[] => {
	const sorted = periods.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
	const merged: Period[] = [];
	for (const [s, e] of sorted) {
		const last = merged.at(-1);
		if (last && s <= last[1]) last[1] = Math.max(last[1], e);
		else merged.push([s, e]);
	}
	return merged;
};

// the parts of a period that are not in any of the (merged) periods
const remainder = ([start, end]: Period, merged: Period[]): Period[] => {
	const parts: Period[] = [];
	let from = start;
	for (const [s, e] of merged) {
		if (e <= from) continue;
		if (s >= end) break;
		if (s > from) parts.push([from, Math.min(s, end)]);
		from = Math.max(from, e);
		if (from >= end) break;
	}
	if (from < end) parts.push([from, end]);
	return parts;
};

const overlap = ([start, end]: Period, merged: Period[]): number =>
	merged.reduce((total, [s, e]) => total + Math.max(0, Math.min(e, end) - Math.max(s, start)), 0);

/**
 * a request for one window of the schedule of a service, passed to the validation of its response
 */
export type ScheduleWindow = {
	coverage: ScheduleCoverage;
	start: number; // the requested start and end, in milliseconds since the epoch
	end: number;
};

/**
 * the schedule of one service, collected from its windows
 */
export class ScheduleCoverage {
	readonly service: string;
	readonly firstDay: number; // UTC midnight at the start of the first day, in milliseconds since the epoch
	readonly daysBefore: number;
	readonly daysAfter: number;
	#events: Period[] = [];
	#skipped: Period[] = [];
	#services: string[] = [];

	/**
	 * @param {string} service         the service ID used in the requests
	 * @param {number} today           UTC midnight at the start of today, in milliseconds since the epoch
	 * @param {number} daysBefore      the days before today that are expected
	 * @param {number} daysAfter       the days after today that are expected
	 */
	constructor(service: string, today: number, daysBefore: number, daysAfter: number) {
		this.service = service;
		this.daysBefore = daysBefore;
		this.daysAfter = daysAfter;
		this.firstDay = today - daysBefore * DAY_MS;
	}

	// a service whose schedule this is
	usedBy(serviceId: string): void {
		if (!this.#services.includes(serviceId)) this.#services.push(serviceId);
	}

	window(start: number, end: number): ScheduleWindow {
		return { coverage: this, start, end };
	}

	// the window was not requested, as a traversal limit was reached
	skipped(window: ScheduleWindow): void {
		this.#skipped.push([window.start, window.end]);
	}

	addEvent(start: number, end: number): void {
		if (Number.isFinite(start) && Number.isFinite(end) && end > start) this.#events.push([start, end]);
	}

	/**
	 * the coverage of each day, from the events of all the windows
	 *
	 * @returns {ServiceCoverage} the state and covered minutes of each day, and the number of days in each state
	 */
	evaluate(): ServiceCoverage {
		const events = union(this.#events),
			skipped = union(this.#skipped);
		const counts: Record<DayState, number> = { full: 0, partial: 0, none: 0, indeterminate: 0 };
		const days: DayCoverage[] = [];
		for (let d = 0; d < this.daysBefore + 1 + this.daysAfter; d++) {
			const day: Period = [this.firstDay + d * DAY_MS, this.firstDay + (d + 1) * DAY_MS];
			const covered = overlap(day, events);
			// the gaps that are long enough to count, and the parts of them in windows that were validated
			const gaps = remainder(day, events).filter(([s, e]) => e - s > COVERAGE_TOLERANCE_MS);
			const definite = gaps.some((gap) => remainder(gap, skipped).some(([s, e]) => e - s > COVERAGE_TOLERANCE_MS));
			const allSkipped = remainder(day, skipped).length == 0;
			const state: DayState =
				allSkipped && covered == 0 ? "indeterminate"
				: definite ? (covered == 0 ? "none" : "partial")
				: gaps.length > 0 ? "indeterminate"
				: "full";
			counts[state]++;
			days.push({ date: new Date(day[0]).toISOString().slice(0, 10), state, coveredMinutes: Math.round(covered / MINUTE_MS), offset: d - this.daysBefore });
		}
		return { service: this.service, services: [...this.#services], daysBefore: this.daysBefore, daysAfter: this.daysAfter, counts, days };
	}
}

/**
 * add the events of a timestamp filtered schedule response to the coverage of its service. An event whose start time or
 * duration can not be read is left out (the validation rules report it)
 *
 * @param {XmlElement}     TVAMain  the root of the response
 * @param {ScheduleWindow} window   the request the response is for
 */
export function collectScheduleEvents(TVAMain: XmlElement, window: ScheduleWindow): void {
	TVAMain.getAnyNs(tva.e_ProgramDescription)
		?.getAnyNs(tva.e_ProgramLocationTable)
		?.forEachNamedChildElement(tva.e_Schedule, (Schedule) =>
			Schedule.forEachNamedChildElement(tva.e_ScheduleEvent, (Event) => {
				const start = Event.getAnyNs(tva.e_PublishedStartTime)?.content,
					duration = Event.getAnyNs(tva.e_PublishedDuration)?.content;
				if (!start || !duration) return;
				try {
					const from = Temporal.Instant.from(start.trim()).epochMilliseconds;
					window.coverage.addEvent(from, from + Temporal.Duration.from(duration.trim()).total({ unit: "milliseconds" }));
				} catch {
					// not a valid date and time, or duration
				}
			})
		);
}

// the coverage of each service in each validation: two services can use the same service ID with the same schedule
// endpoint, and a URL is only requested once in a validation (repeatedTraversal()), so they share the coverage
const coverages = new WeakMap<object, Map<string, ScheduleCoverage>>();

/**
 * the coverage of the schedule of a service in a validation
 *
 * @param {ValidationHandle} validation  the validation (currentValidation())
 * @param {string} endpoint             the ScheduleInfoEndpoint
 * @param {string} service              the service ID used in the requests
 * @param {number} today                UTC midnight at the start of today, in milliseconds since the epoch
 * @param {number} daysBefore           the days before today that are expected
 * @param {number} daysAfter            the days after today that are expected
 * @returns {{ coverage: ScheduleCoverage, first: boolean }} the coverage, and whether it was made by this call
 */
export function scheduleCoverage(validation: ValidationHandle, endpoint: string, service: string, today: number, daysBefore: number, daysAfter: number): { coverage: ScheduleCoverage; first: boolean } {
	let byService = coverages.get(validation as object);
	if (!byService) coverages.set(validation as object, (byService = new Map()));
	const key = `${endpoint}?sid=${service}`;
	const found = byService.get(key);
	if (found) return { coverage: found, first: false };
	const coverage = new ScheduleCoverage(service, today, daysBefore, daysAfter);
	byService.set(key, coverage);
	return { coverage, first: true };
}
