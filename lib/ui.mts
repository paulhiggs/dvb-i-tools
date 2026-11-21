/**
 * ui.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Drive the HTML user interface
 */

import express from "express"
import { readFileSync } from "fs"
import { join } from "path"
import type { UploadedFile } from "express-fileupload"

import { __dirname } from "./data_locations.mts"

import { APPLICATION, ERROR, FATAL, WARNING } from "./error_list.mts"
import ErrorList from "./error_list.mts";
import type { ErrorType, SeverityList } from "./error_list.mts"
import type { ValidationTiming } from "./safe_fetch.mts"

import type { CGRequestType } from "./cg_check.mts"
import { CG_REQUEST_SCHEDULE_TIME, CG_REQUEST_SCHEDULE_NOWNEXT, CG_REQUEST_SCHEDULE_WINDOW, CG_REQUEST_PROGRAM, CG_REQUEST_MORE_EPISODES, CG_REQUEST_BS_CATEGORIES, CG_REQUEST_BS_LISTS, CG_REQUEST_BS_CONTENTS } from "./cg_check.mts"

import { HasProperty, escapeHTML } from "./utils.mts"
import { isHTTPURL } from "./pattern_checks.mts"
import { read_string_options } from "./globals.mts"

export const MODE_UNSPECIFIED = "none",
	MODE_SL = "sl",
	MODE_CG = "cg",
	MODE_SLR = "slr",
	MODE_PL = "pl",
	MODE_URL = "url",
	MODE_FILE = "file";

const MESSAGES_IN_ORDER = true; // when true outputs the errors, warnings and informations in the 'document order'. false==ouotput in order found
const SHOW_LINE_NUMBER = false; // include the line number in the XML document where the error was found

const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), read_string_options).toString());

export const BREAK = "<br/>",
	LINE = "<hr/>";

const formatCount = (n: number): string => n.toLocaleString("en-GB");
const plural = (n: number, one: string, many: string): string => `${formatCount(n)} ${n == 1 ? one : many}`;

/**
 * the stylesheet for all pages. Colours are defined as custom properties, with a dark set used when the browser
 * prefers a dark colour scheme. Severity colours are applied with the s-* classes, which set --sev and --sev-bg
 */
const STYLESHEET = `
:root {
	--bg: #f5f7f9; --surface: #ffffff; --sunken: #eef1f5; --fg: #17202b; --muted: #5a6676; --line: #d9dfe7;
	--accent: #1d5fa8; --accent-fg: #ffffff; --accent-soft: #e3edf8;
	--fatal: #7a1023; --fatal-bg: #f9e1e5; --error: #b4232f; --error-bg: #fbe7e8; --warn: #8a5300; --warn-bg: #fdf0d8;
	--info: #1f5d99; --info-bg: #e2eefa; --debug: #4e5a68; --debug-bg: #eceff3; --ok: #1d6b45; --ok-bg: #e0f2e8;
	--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
	--font-mono: ui-monospace, "SFMono-Regular", "Cascadia Mono", Consolas, "Liberation Mono", monospace;
	--radius: 6px; --step--1: 0.8125rem; --step-0: 0.9375rem; --step-1: 1.125rem; --step-2: 1.5rem;
	color-scheme: light;
}
@media (prefers-color-scheme: dark) {
	:root {
		--bg: #0f141a; --surface: #161d26; --sunken: #1c2530; --fg: #e4e9ef; --muted: #97a3b2; --line: #2b3644;
		--accent: #6ba7e8; --accent-fg: #0b1622; --accent-soft: #1b2c40;
		--fatal: #ff8fa0; --fatal-bg: #3a1620; --error: #ff8a8f; --error-bg: #3a1a1d; --warn: #f2bd62; --warn-bg: #352812;
		--info: #8cc0f5; --info-bg: #172b40; --debug: #aeb8c4; --debug-bg: #222b36; --ok: #7fd3a6; --ok-bg: #15301f;
		color-scheme: dark;
	}
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font-family: var(--font-sans); font-size: var(--step-0); line-height: 1.5; padding: 0 max(16px, env(safe-area-inset-right, 0px)) 48px max(16px, env(safe-area-inset-left, 0px)); }
.page { max-width: 1120px; margin: 0 auto; display: grid; gap: 24px; }
h1, h2 { margin: 0; line-height: 1.25; text-wrap: balance; }
h2 { font-size: var(--step-1); font-weight: 600; }
a { color: var(--accent); }
a:focus-visible, button:focus-visible, summary:focus-visible, .seg input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }
.s-fatal { --sev: var(--fatal); --sev-bg: var(--fatal-bg); }
.s-error { --sev: var(--error); --sev-bg: var(--error-bg); }
.s-warn { --sev: var(--warn); --sev-bg: var(--warn-bg); }
.s-info { --sev: var(--info); --sev-bg: var(--info-bg); }
.s-debug { --sev: var(--debug); --sev-bg: var(--debug-bg); }
.s-ok { --sev: var(--ok); --sev-bg: var(--ok-bg); }

.masthead { display: grid; gap: 14px; padding-top: 20px; }
.bars { display: grid; grid-template-columns: repeat(7, 1fr); height: 4px; border-radius: 2px; overflow: hidden; }
.bars span:nth-child(1) { background: #c0c0c0; } .bars span:nth-child(2) { background: #c0c000; } .bars span:nth-child(3) { background: #00c0c0; }
.bars span:nth-child(4) { background: #00c000; } .bars span:nth-child(5) { background: #c000c0; } .bars span:nth-child(6) { background: #c00000; }
.bars span:nth-child(7) { background: #0000c0; }
.masthead-row { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 24px; }
.brand { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.brand h1 { font-size: var(--step-2); font-weight: 700; letter-spacing: -0.01em; }
.version { font-family: var(--font-mono); font-size: var(--step--1); color: var(--muted); }
.masthead nav { display: flex; flex-wrap: wrap; gap: 18px; font-size: var(--step--1); }
.masthead nav a { color: var(--muted); text-decoration: none; }
.masthead nav a:hover { color: var(--fg); text-decoration: underline; }
.motd { background: var(--accent-soft); border-radius: var(--radius); padding: 10px 14px; }

.panel { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); }
form.panel { padding: 22px; display: grid; gap: 20px; }
fieldset { border: 0; margin: 0; padding: 0; min-width: 0; display: grid; gap: 8px; }
legend { padding: 0; margin-bottom: 8px; font-size: var(--step--1); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.seg { display: flex; flex-wrap: wrap; gap: 8px; }
.seg label { position: relative; }
.seg input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.seg span { display: inline-block; padding: 8px 14px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); cursor: pointer; font-weight: 500; }
.seg input:checked + span { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.seg label:hover span { border-color: var(--accent); }
.source-row { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: center; }
.source-row .seg span { padding: 8px 12px; }
.field input { width: 100%; font: inherit; font-family: var(--font-mono); font-size: var(--step--1); padding: 9px 11px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--sunken); color: var(--fg); }
@supports selector(:has(*)) {
	.field-file { display: none; }
	form:has(#radFile:checked) .field-url { display: none; }
	form:has(#radFile:checked) .field-file { display: block; }
	.cg-type { display: none; }
	form:has(#radCG:checked) .cg-type { display: grid; }
	form:not(:has(#radSL:checked, #radSLR:checked)) .sl-options { display: none; }
	form:not(:has(#cbTraverse:checked)) .traverse-limit { display: none; }
}
.options { display: grid; gap: 10px; }
.traverse-limit { display: grid; grid-template-columns: auto auto 1fr; gap: 4px 10px; align-items: center; margin-left: 26px; }
.traverse-limit input { font: inherit; font-family: var(--font-mono); font-size: var(--step--1); padding: 5px 8px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--sunken); color: var(--fg); width: 9rem; }
.traverse-limit .hint { grid-column: 1 / -1; }
.choice { display: grid; gap: 6px; padding-top: 4px; }
.choice-label { font-weight: 500; }
.choice .seg span { padding: 6px 12px; }
.check { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; align-items: start; }
.check input { margin: 4px 0 0; width: 16px; height: 16px; accent-color: var(--accent); }
.check .hint, .check .note { grid-column: 2; }
.hint { color: var(--muted); font-size: var(--step--1); }
.note { font-size: var(--step--1); color: var(--warn); background: var(--warn-bg); border-radius: var(--radius); padding: 6px 10px; justify-self: start; }
.actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
button.primary { font: inherit; font-weight: 600; padding: 10px 22px; border: 0; border-radius: var(--radius); background: var(--accent); color: var(--accent-fg); cursor: pointer; }
button.primary:hover { filter: brightness(1.08); }
button.primary:disabled { opacity: 0.7; cursor: progress; }

.results-head { display: grid; gap: 4px; }
.eyebrow { font-size: var(--step--1); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.results-head .source { font-family: var(--font-mono); overflow-wrap: anywhere; }
.results-head .meta { color: var(--muted); font-size: var(--step--1); }
.alert { border-radius: var(--radius); padding: 10px 14px; color: var(--sev); background: var(--sev-bg); }
.alert p { margin: 0; }
.badges { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.badge { display: grid; gap: 2px; padding: 14px 16px; border-radius: var(--radius); background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--sev); text-decoration: none; color: var(--fg); }
.badge .n { font-size: var(--step-2); font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.1; }
.badge .label { font-size: var(--step--1); color: var(--muted); }
.badge.zero { border-left-color: var(--line); }
.badge.zero .n { color: var(--muted); }
a.badge:hover { border-color: var(--sev); }
.categories { display: flex; flex-wrap: wrap; gap: 6px 8px; font-size: var(--step--1); }
.cat { display: inline-flex; gap: 6px; align-items: baseline; padding: 3px 10px; border-radius: 999px; background: var(--sev-bg, var(--sunken)); }
.cat b { font-weight: 600; font-variant-numeric: tabular-nums; }

details.section { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); min-width: 0; }
details.section > summary { list-style: none; cursor: pointer; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 14px 18px; font-weight: 600; }
details.section > summary::-webkit-details-marker { display: none; }
details.section > summary::before { content: ""; width: 7px; height: 7px; border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted); transform: rotate(-45deg); transition: transform 0.15s; flex: none; }
details.section[open] > summary::before { transform: rotate(45deg); }
@media (prefers-reduced-motion: reduce) { details.section > summary::before { transition: none; } }
.count { font-size: var(--step--1); font-weight: 600; font-variant-numeric: tabular-nums; padding: 1px 9px; border-radius: 999px; color: var(--sev, var(--muted)); background: var(--sev-bg, var(--sunken)); }
summary .aside { margin-left: auto; font-weight: 400; font-size: var(--step--1); color: var(--muted); }
.section-body { border-top: 1px solid var(--line); }
.scroll { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: var(--step--1); }
th { text-align: left; font-weight: 600; color: var(--muted); padding: 9px 14px; background: var(--sunken); white-space: nowrap; }
td { padding: 10px 14px; border-top: 1px solid var(--line); vertical-align: top; }
td.msg { min-width: 18rem; }
.chip, .c { display: inline-block; font-family: var(--font-mono); font-size: 0.75rem; font-weight: 500; padding: 1px 7px; border-radius: 4px; color: var(--sev, var(--fg)); background: var(--sev-bg, var(--sunken)); white-space: nowrap; text-decoration: none; }
a.chip:hover { text-decoration: underline; }
.fragment { margin: 6px 0 0; padding: 6px 9px; font-family: var(--font-mono); font-size: 0.75rem; background: var(--sunken); border-radius: 4px; white-space: pre-wrap; overflow-wrap: anywhere; }
.desc td:first-child { width: 1%; }
.ref { color: var(--muted); }
.all-clear { border-radius: var(--radius); padding: 14px 16px; color: var(--ok); background: var(--ok-bg); font-weight: 500; }

.listing { margin: 0; padding: 8px 0; font-family: var(--font-mono); font-size: 0.78rem; line-height: 1.6; counter-reset: ln; overflow-x: auto; }
.listing > span { display: block; white-space: pre; padding-right: 16px; }
.listing > span[id] { counter-increment: ln; }
.listing > span[id]::before { content: counter(ln); display: inline-block; width: 6ch; margin-right: 14px; text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; }
.listing > span.s-error, .listing > span.s-warn, .listing > span.s-info { background: var(--sev-bg); box-shadow: inset 3px 0 0 var(--sev); }
.listing > span.s-error::before, .listing > span.s-warn::before, .listing > span.s-info::before { color: var(--sev); font-weight: 600; }
.listing > span.f { white-space: pre-wrap; padding-left: calc(6ch + 14px); font-family: var(--font-sans); font-size: var(--step--1); color: var(--sev); background: var(--sev-bg); box-shadow: inset 3px 0 0 var(--sev); }

.trav-summary { display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 12px 18px; font-size: var(--step--1); color: var(--muted); border-bottom: 1px solid var(--line); }
.trav-summary b { color: var(--fg); font-variant-numeric: tabular-nums; }
.filters { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 18px; border-bottom: 1px solid var(--line); align-items: center; }
.filters .lbl { font-size: var(--step--1); color: var(--muted); margin-right: 4px; }
.filters button { font: inherit; font-size: var(--step--1); padding: 3px 10px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); cursor: pointer; }
.filters button[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.trav td:first-child { min-width: 22rem; padding-left: calc(14px + var(--i, 0px)); }
.trav td:first-child a { font-weight: 500; }
.trav td:nth-child(2) { min-width: 16rem; }
.url { display: block; font-family: var(--font-mono); font-size: 0.72rem; color: var(--muted); overflow-wrap: anywhere; }
.d2 { --i: 18px; } .d3 { --i: 36px; } .d4 { --i: 54px; } .d5 { --i: 72px; } .d6 { --i: 90px; } .d7 { --i: 108px; } .d8 { --i: 126px; } .d9 { --i: 144px; } .d10 { --i: 162px; }
.trav tbody tr:not(.d1) td:first-child { background: linear-gradient(var(--line), var(--line)) no-repeat calc(var(--i) + 4px) 0 / 2px 100%; }
.trav td:nth-child(2) > * { margin: 0 4px 4px 0; }
/* a document with no findings has no code chips, so it is labelled instead */
.trav tr.s-ok td:nth-child(2)::before { content: "No findings"; display: inline-block; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 1px 8px; border-radius: 999px; color: var(--sev); background: var(--sev-bg); }
.dbg { display: block; font-size: var(--step--1); color: var(--muted); }
.trav td:last-child { text-align: right; font-variant-numeric: tabular-nums; color: var(--muted); white-space: nowrap; }
.trav[data-show="error"] tbody tr:not(.s-error, .s-fatal), .trav[data-show="warn"] tbody tr:not(.s-warn),
.trav[data-show="info"] tbody tr:not(.s-info), .trav[data-show="ok"] tbody tr:not(.s-ok) { display: none; }

footer { color: var(--muted); font-size: var(--step--1); display: flex; flex-wrap: wrap; gap: 8px 20px; justify-content: space-between; border-top: 1px solid var(--line); padding-top: 16px; }
.timing td:not(:first-child), .timing th:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.timing tr.s-warn td:nth-child(7) { color: var(--sev); font-weight: 600; }
.timing td.url { font-size: var(--step--1); }
.timing-note { margin: 0; padding: 10px 18px; border-top: 1px solid var(--line); }
.stats h2 { padding: 14px 18px 10px; }
.stats table { border-top: 1px solid var(--line); }
@media (max-width: 720px) {
	.badges { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.source-row { grid-template-columns: 1fr; }
	form.panel { padding: 16px; }
}
`.replace(/\n\t*/g, "\n");

export function PAGE_TOP(pageTitle: string, secure: boolean, label?:string, motd?:string) {
	// dont allow Chrome to translate the page - seems to 'detect' German
	const METAS = '<meta charset="utf-8"><meta name="google" content="notranslate"><meta name="viewport" content="width=device-width, initial-scale=1">';
	const HEAD = `<head>${METAS}<title>${escapeHTML(pageTitle)}</title><style>${STYLESHEET}</style></head>`;
	const BARS = `<div class="bars" aria-hidden="true">${"<span></span>".repeat(7)}</div>`;
	const NAV = `<nav aria-label="Validator links"><a href="${escapeHTML(pkg?.repository?.url)}" target="_blank" rel="noopener noreferrer">Source</a><a href="${escapeHTML(pkg?.bugs?.url)}" target="_blank" rel="noopener noreferrer">Report an issue</a><a href="/stats">Statistics</a></nav>`;
	const MASTHEAD = `<header class="masthead">${BARS}<div class="masthead-row"><div class="brand"><h1>${escapeHTML(label ?? pageTitle)}</h1><span class="version">${escapeHTML(pkg.name)} v${escapeHTML(pkg.version)} · ${secure ? "https" : "http"}</span></div>${NAV}</div></header>`;
	const MOTD = motd ? `<div class="motd">${motd}</div>` : "";
	return `<!DOCTYPE html>\n<html lang="en">${HEAD}<body><div class="page">${MASTHEAD}${MOTD}`;
}

export const PAGE_BOTTOM = `<footer><span>${escapeHTML(pkg.name)} v${escapeHTML(pkg.version)} by ${pkg.author.HTMLize()}</span><span>Report issues at <a href="${escapeHTML(pkg?.bugs?.url)}">${escapeHTML(pkg?.bugs?.url)}</a></span></footer></div></body></html>`;

// the CSS class for each value of ErrorList.severity(), used by the severity filter of the traversed documents table
const SEVERITY_CLASS = ["s-ok", "s-debug", "s-info", "s-warn", "s-error", "s-fatal"];
const LIST_CLASS: Record<SeverityList, string> = { fatals: "s-fatal", errors: "s-error", warnings: "s-warn", informationals: "s-info" };

const tabulateMessage = function* (value: ErrorType): Generator<string> {
	const anchor = HasProperty(value, "line") ? `#line-${value.line}` : null;
	const code = value.code ? value.code.HTMLize() : "";
	yield "<tr>";
	if (SHOW_LINE_NUMBER) yield `<td>${HasProperty(value, "line") ? value.line : ""}</td>`;
	yield `<td>${anchor ? `<a class="chip" href="${anchor}">${code}</a>` : `<span class="chip">${code}</span>`}</td>`;
	yield `<td class="msg">${value.message ? value.message.HTMLize() : ""}${value.element ? `<pre class="fragment">${value.element.HTMLize()}</pre>` : ""}</td>`;
	yield "</tr>";
};

const lineCompareFn = (a: ErrorType, b: ErrorType) => a?.line && b?.line ? a.line - b.line : 0;

// a collapsible section of the results, open unless stated
const sectionStart = (id: string, title: string, count: string, severityClass: string, aside?: string, open = true) =>
	`<details class="section ${severityClass}" id="${id}"${open ? " open" : ""}><summary>${title} <span class="count">${count}</span>${aside ? `<span class="aside">${aside}</span>` : ""}</summary><div class="section-body">`;
const SECTION_END = "</div></details>";

const ErrorTable = function* (errors: ErrorType[], id: string, title: string, severityClass: string): Generator<string> {
	yield sectionStart(id, title, formatCount(errors.length), severityClass, MESSAGES_IN_ORDER ? "in document order" : undefined);
	yield `<div class="scroll"><table><thead><tr>${SHOW_LINE_NUMBER ? "<th>Line</th>" : ""}<th scope="col">Code</th><th scope="col">Finding</th></tr></thead><tbody>`;
	if (MESSAGES_IN_ORDER) errors.sort(lineCompareFn);
	for (const e of errors) yield* tabulateMessage(e);
	yield `</tbody></table></div>${SECTION_END}`;
};

// how the type of a message attached to a line in the marked up document is shown
const MESSAGE_TYPE: [string, string][] = [
	[FATAL, "Fatal"],
	[ERROR, "Error"],
	[APPLICATION, "Application error"],
	[WARNING, "Warning"],
];
const messageText = (message: string): string => {
	const type = MESSAGE_TYPE.find(([prefix]) => message.startsWith(`${prefix} `));
	return type ? `${type[1]} ${message.slice(type[0].length + 1)}` : message;
};

function* tabulateResults(source: string, error: string[] | undefined, errs: ErrorList | undefined): Generator<string> {
	if (!error && !errs) return; // nothing has been validated yet

	const meta = [errs?.type ? escapeHTML(errs.type) : "", errs?.timing ? timingSummary(errs.timing) : ""].filter((m) => m.length > 0).join(" · ");
	yield `<section class="results-head" aria-label="Results"><span class="eyebrow">Results</span><div class="source">${escapeHTML(source)}</div>${meta ? `<div class="meta">${meta}</div>` : ""}</section>`;
	if (error) yield `<div class="alert s-error" role="alert">${error.map((e) => `<p>${e.HTMLize()}</p>`).join("")}</div>`;

	let resultsShown = false;
	if (errs) {
		const badge = (count: number, id: string, label: string, severityClass: string) =>
			count > 0
				? `<a class="badge ${severityClass}" href="#${id}"><span class="n">${formatCount(count)}</span><span class="label">${label}</span></a>`
				: `<span class="badge zero ${severityClass}"><span class="n">0</span><span class="label">${label}</span></span>`;
		yield `<div class="badges">${badge(errs.numFatals(), "fatals", "fatal", "s-fatal")}${badge(errs.numErrors(), "errors", "errors", "s-error")}${badge(errs.numWarnings(), "warnings", "warnings", "s-warn")}${badge(errs.numInformationals(), "informationals", "informational", "s-info")}</div>`;

		if (errs.numCountsFatal() > 0 || errs.numCountsErr() > 0 || errs.numCountsWarn() > 0 || errs.numCountsInfo() > 0) {
			yield `<div class="categories" role="group" aria-label="Counts by category">`;
			for (const f of errs.countsFatal) yield `<span class="cat s-fatal">${f.key.HTMLize()} <b>${formatCount(f.count)}</b></span>`;
			for (const e of errs.countsErr) yield `<span class="cat">${e.key.HTMLize()} <b>${formatCount(e.count)}</b></span>`;
			for (const w of errs.countsWarn) yield `<span class="cat s-warn">${w.key.HTMLize()} <b>${formatCount(w.count)}</b></span>`;
			for (const i of errs.countsInfo) yield `<span class="cat s-info">${i.key.HTMLize()} <b>${formatCount(i.count)}</b></span>`;
			yield "</div>";
			resultsShown = true;
		}

		if (errs.numFatals() > 0) {
			yield* ErrorTable(errs.fatals, "fatals", "Fatal errors (further validation aborted)", "s-fatal");
			resultsShown = true;
		}

		if (errs.numErrors() > 0) {
			yield* ErrorTable(errs.errors, "errors", "Errors", "s-error");
			resultsShown = true;
		}

		if (errs.numWarnings() > 0) {
			yield* ErrorTable(errs.warnings, "warnings", "Warnings", "s-warn");
			resultsShown = true;
		}

		if (errs.numInformationals() > 0) {
			yield* ErrorTable(errs.informationals, "informationals", "Informational", "s-info");
			resultsShown = true;
		}

		if (errs.debugs.length > 0) {
			yield sectionStart("debug", "Debug messages", formatCount(errs.debugs.length), "s-debug");
			yield `<div class="scroll"><table><thead><tr><th scope="col">Code</th><th scope="col">Message</th></tr></thead><tbody>`;
			for (const d of errs.debugs) yield `<tr><td><span class="chip">${escapeHTML(d.code)}</span></td><td class="msg">${escapeHTML(d.message)}</td></tr>`;
			yield `</tbody></table></div>${SECTION_END}`;
			resultsShown = true;
		}
	}

	if (!error && !resultsShown) yield `<div class="all-clear">No errors, warnings or informational messages</div>`;
	else if (errs?.errorDescriptions.length) {
		yield sectionStart("descriptions", "What the codes mean", formatCount(errs.errorDescriptions.length), "");
		yield `<div class="scroll"><table class="desc"><tbody>`;
		for (const desc of errs.errorDescriptions) {
			yield `<tr><td><span class="chip">${desc.code.HTMLize()}</span></td>`;
			yield `<td>${desc.description.HTMLize().replace(/\n/, BREAK)}`;
			if (desc.clause && desc.clause.length) yield `${BREAK}<span class="ref">Reference: ${escapeHTML(desc.clause)}</span>`;
			yield "</td></tr>";
		}
		yield `</tbody></table></div>${SECTION_END}`;
	}

	if (errs && errs.markupXML && errs.markupXML.length > 0) {
		const flagged = errs.markupXML.reduce((n, line) => n + (line.validationErrors?.length ? 1 : 0), 0);
		yield sectionStart("listing", "Document with findings marked", plural(errs.markupXML.length, "line", "lines"), "", flagged > 0 ? `${plural(flagged, "line", "lines")} with findings` : undefined);
		yield `<pre class="listing">`;
		for (const line of errs.markupXML) {
			if (line.validationErrors?.length) {
				const all = line.validationErrors.join(" ");
				const severityClass = all.includes(FATAL) || all.includes(ERROR) || all.includes(APPLICATION) ? "s-error" : all.includes(WARNING) ? "s-warn" : "s-info";
				yield `<span id="line-${line.ix}" class="${severityClass}">${line.value.HTMLize()}</span>`;
				yield `<span class="f ${severityClass}">${line.validationErrors.map((message) => messageText(message).HTMLize()).join(BREAK)}</span>`;
			}
			else yield `<span id="line-${line.ix}">${line.value.HTMLize()}</span>`;
		}
		yield `</pre>${SECTION_END}`;
	}
}


function* nested_error_row(req: express.Request, errs: ErrorList | undefined, depth: number): Generator<string> {
	if (!errs || errs.nestedErrors.length == 0) return
	for (const nest of errs.nestedErrors) {
		const severity = nest.severity()
		let validator=undefined, refer = "<b><i>unknown</i></b>"
		if (nest.source && nest.description) {
			switch (nest.type) {
				case "SL":
					validator=`${req.protocol}://${req.host}/validate_sl?url=${encodeURIComponent(nest.source)}`
					break
				case CG_REQUEST_SCHEDULE_TIME:
				case CG_REQUEST_SCHEDULE_NOWNEXT:
				case CG_REQUEST_SCHEDULE_WINDOW:
				case CG_REQUEST_PROGRAM:
				case CG_REQUEST_MORE_EPISODES:
				case CG_REQUEST_BS_CATEGORIES:
				case CG_REQUEST_BS_LISTS:
				case CG_REQUEST_BS_CONTENTS:
					validator=`${req.protocol}://${req.host}/validate_cg?url=${encodeURIComponent(nest.source)}&type=${encodeURIComponent(nest.type)}`
					break
			}
			// only link to HTTP(S) locations - the source is taken from the validated document and could be a javascript: or data: URL
			let isHTTP = false
			try { isHTTP = isHTTPURL(nest.source) } catch { /* malformed %-encoding in the URL */ }
			const href = validator ?? (isHTTP ? nest.source : undefined)
			refer = href
				? `<a target="_blank" rel="noopener noreferrer" href="${escapeHTML(href)}">${escapeHTML(nest.description)}</a>`
				: escapeHTML(nest.description)
		}
		// the codes reported are shown as chips in their severity colours; the row's class is used by the severity filter
		yield `<tr class="${SEVERITY_CLASS[severity]} d${Math.min(depth, 10)}"><td>${refer}${nest.source ? `<span class="url">${escapeHTML(nest.source)}</span>` : ""}</td><td>`
		for (const list of ["fatals", "errors", "warnings", "informationals"] as SeverityList[])
			for (const [code, count] of nest.codesReported(list))
				yield `<span class="c ${LIST_CLASS[list]}">${escapeHTML(code)}${count > 1 ? ` ×${count}` : ""}</span>`
		for (const msg of nest.debugs) yield `<span class="dbg">${escapeHTML(msg.code)} ${escapeHTML(msg.message)}</span>`
		yield `</td><td>${(nest.references ?? 1) > 1 ? formatCount(nest.references!) : ""}</td></tr>`
		yield* nested_error_row(req, nest, depth+1)
	}
}

// the number of traversed documents, and the number of further references to them that were not validated again
function traversalCounts(errs: ErrorList): { documents: number; repeats: number } {
	let documents = 0,
		repeats = 0;
	const pending = [...errs.nestedErrors];
	while (pending.length > 0) {
		const nest = pending.pop()!;
		documents++;
		repeats += (nest.references ?? 1) - 1;
		pending.push(...nest.nestedErrors);
	}
	return { documents, repeats };
}

// shows the severity filter of the traversed documents table, which needs scripting (without it, all rows are shown)
const TRAVERSAL_FILTER_SCRIPT = `<script>(function(){var f=document.currentScript.previousElementSibling;f.hidden=false;f.addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;var t=document.getElementById("trav");if(t)t.dataset.show=b.dataset.show;f.querySelectorAll("button").forEach(function(x){x.setAttribute("aria-pressed",String(x===b))})})})();</script>`;

function* reportNestedErrors(req: express.Request, errs: ErrorList | undefined): Generator<string> {
	if (!errs || errs.nestedErrors.length == 0) return

	const { documents, repeats } = traversalCounts(errs)
	yield sectionStart("traversed", "Traversed documents", formatCount(documents), "", "in the order referenced")
	yield `<div class="trav-summary"><span><b>${formatCount(documents)}</b> ${documents == 1 ? "document" : "documents"} validated</span>${repeats > 0 ? `<span><b>${formatCount(repeats)}</b> further ${repeats == 1 ? "reference" : "references"} to them not validated again</span>` : ""}</div>`
	const filter = (show: string, label: string) => `<button type="button" data-show="${show}" aria-pressed="${show == "all"}">${label}</button>`
	yield `<div class="filters" role="group" aria-label="Show traversed documents" hidden><span class="lbl">Show</span>${filter("all", "All")}${filter("error", "Errors")}${filter("warn", "Warnings")}${filter("info", "Informational")}${filter("ok", "No findings")}</div>${TRAVERSAL_FILTER_SCRIPT}`
	yield `<div class="scroll"><table class="trav" id="trav" data-show="all"><thead><tr><th scope="col">Document</th><th scope="col">Result</th><th scope="col">References</th></tr></thead><tbody>`

	yield* nested_error_row(req, errs, 1)
	yield `</tbody></table></div>${SECTION_END}`
}

// a duration, e.g. "850 ms", "15.2 s" or "7 min 12 s"
const formatDuration = (ms: number): string => {
	if (ms < 1000) return `${Math.round(ms)} ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
	const s = Math.round(ms / 1000);
	return s < 3600 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
};

// how long the validation took, and what it retrieved, for the results header
function timingSummary(timing: ValidationTiming): string {
	const parts = [`validated in ${formatDuration(timing.durationMs)}`];
	if (timing.documentsTraversed > 0) parts.push(plural(timing.documentsTraversed, "document traversed", "documents traversed"));
	if (timing.resourcesRetrieved > 0)
		parts.push(`${plural(timing.resourcesRetrieved, "resource retrieved", "resources retrieved")}${timing.imagesChecked > 0 ? ` (${plural(timing.imagesChecked, "image", "images")} checked)` : ""}`);
	if (timing.timeouts > 0) parts.push(`<a href="#timing">${plural(timing.timeouts, "timeout", "timeouts")}</a>`);
	return parts.join(" · ");
}

// the time spent retrieving from each host, which shows which servers slowed the validation down
function* reportTiming(errs: ErrorList | undefined): Generator<string> {
	const timing = errs?.timing;
	if (!timing || timing.hosts.length == 0) return;
	yield sectionStart("timing", "Retrieval timing", plural(timing.requests, "request", "requests"), timing.timeouts > 0 ? "s-warn" : "", `${plural(timing.hosts.length, "host", "hosts")}, most time first`, false);
	yield `<div class="scroll"><table class="timing"><thead><tr><th scope="col">Host</th><th scope="col">Requests</th><th scope="col">Total time</th><th scope="col">Average</th><th scope="col">95%</th><th scope="col">Slowest</th><th scope="col">Timeouts</th><th scope="col">Errors</th></tr></thead><tbody>`;
	for (const h of timing.hosts)
		yield `<tr${h.timeouts > 0 ? ' class="s-warn"' : ""}><td class="url">${escapeHTML(h.host)}</td><td>${formatCount(h.requests)}</td><td>${formatDuration(h.totalMs)}</td><td>${formatDuration(h.averageMs)}</td><td>${formatDuration(h.p95Ms)}</td><td>${formatDuration(h.maxMs)}</td><td>${h.timeouts ? formatCount(h.timeouts) : ""}</td><td>${h.errors ? formatCount(h.errors) : ""}</td></tr>`;
	yield `</tbody></table></div><p class="hint timing-note">Times are for each retrieval once it started. Retrievals from different hosts run at the same time, so the totals add up to more than the validation took.</p>${SECTION_END}`;
}

// the results part of a page: the validation results, the traversed documents and the page bottom
function* resultsPage(req: express.Request, source: string, error: string[] | undefined, errs: ErrorList | undefined): Generator<string> {
	yield* tabulateResults(source, error, errs);
	yield* reportNestedErrors(req, errs);
	yield* reportTiming(errs);
	yield PAGE_BOTTOM;
}

const WRITE_CHUNK_SIZE = 64 * 1024; // characters joined into each write to the response

/**
 * write the parts of a page to the response, joined into chunks of about WRITE_CHUNK_SIZE characters. When the response
 * cannot take more data, waits for it to drain before producing more, so a large report is not buffered in memory.
 * Stops producing the page if the client disconnects
 *
 * @param {express.Response} res    the response to write to
 * @param {Iterable<string>} parts  the parts of the page, in order
 */
async function sendHTML(res: express.Response, parts: Iterable<string>): Promise<void> {
	let chunk: string[] = [],
		size = 0;
	const flush = async (): Promise<boolean> => {
		if (res.destroyed) return false;
		const ok = res.write(chunk.join(""));
		chunk = [];
		size = 0;
		if (!ok && !res.destroyed)
			await new Promise<void>((resolve) => {
				const done = () => {
					res.off("drain", done);
					res.off("close", done);
					resolve();
				};
				res.on("drain", done);
				res.on("close", done);
			});
		return !res.destroyed;
	};
	for (const part of parts) {
		chunk.push(part);
		size += part.length;
		if (size >= WRITE_CHUNK_SIZE && !(await flush())) return;
	}
	if (size > 0) await flush();
}

export type FormModes = {
	cg: string
	sl: string
	pl: string
	slr: string
	file: string
	url: string
	hasSL: boolean
	hasPL: boolean
	hasCG: boolean
	hasSLR: boolean
	allowTraversal: boolean
}

// a choice shown as one of a row of buttons
const segmentChoice = (name: string, value: string, id: string, label: string, checked: boolean) =>
	`<label><input type="radio" name="${name}" value="${escapeHTML(value)}" id="${escapeHTML(id)}"${checked ? " checked" : ""}><span>${escapeHTML(label)}</span></label>`;

const SUBMIT_HINT = "Results appear below this form.";
// feedback while a validation is running, which can take many minutes with traversal (the form works without it)
const SUBMIT_SCRIPT = `<script>(function(){var f=document.getElementById("check-form"),b=document.getElementById("validate"),h=document.getElementById("submit-hint");if(!f||!b||!h)return;f.addEventListener("submit",function(){b.disabled=true;b.textContent="Validating\\u2026";h.textContent="Validating. With traversal, a large service list can take many minutes."});window.addEventListener("pageshow",function(){b.disabled=false;b.textContent="Validate";h.textContent=${JSON.stringify(SUBMIT_HINT)}})})();</script>`;

export async function drawForm(
		req: express.Request, res: express.Response,
		modes: FormModes,
		supportedRequests: CGRequestType[] | null,
		motd?: string, error?: string[], errs?: ErrorList) : Promise<express.Response> {

	const ENTRY_FORM_REQUEST_TYPE_ID = "requestType";
	const session = req.session.data;

	res.setHeader("Content-Type", "text/html");
	res.write(PAGE_TOP("DVB-I Validator", req.secure, "DVB-I Validator", motd));

	const types = [
		modes.hasSL ? segmentChoice("testtype", modes.sl, "radSL", "Service List", session?.mode == modes.sl) : "",
		modes.hasPL ? segmentChoice("testtype", modes.pl, "radPL", "Playlist", session?.mode == modes.pl) : "",
		modes.hasCG ? segmentChoice("testtype", modes.cg, "radCG", "Content Guide", session?.mode == modes.cg) : "",
		modes.hasSLR ? segmentChoice("testtype", modes.slr, "radSLR", "Service List Registry", session?.mode == modes.slr) : "",
	].join("");
	const requestTypes = supportedRequests
		? supportedRequests.map((choice) => segmentChoice(ENTRY_FORM_REQUEST_TYPE_ID, choice.value, choice.value, choice.label, choice.value == session?.cgmode)).join("")
		: "";
	const traverse = modes.allowTraversal
		? `<label class="check sl-options"><input type="checkbox" id="cbTraverse" name="traverse"${session?.traverse == true ? " checked" : ""}><span>Traverse referenced documents</span><span class="hint">Also validate the schedules, programme information, box sets and service lists that the document refers to.</span><span class="note">This can take a long time: 20 minutes or more for a large service list.</span></label><div class="traverse-limit sl-options"><label for="maxTraversal">Maximum documents</label><input type="text" id="maxTraversal" name="maxTraversal" inputmode="numeric" size="10" value="${escapeHTML(session?.maxTraversal ?? "100")}" aria-describedby="maxTraversal-hint"><span class="hint" id="maxTraversal-hint">The most documents to traverse: a number, or unlimited. Unlimited can take hours for a large service list.</span></div>`
		: "";
	const images = session?.images ?? "yes";
	const imageChecking = `<div class="choice" role="group" aria-labelledby="images-label"><span class="choice-label" id="images-label">Image checking</span><div class="seg">${segmentChoice("images", "no", "imgNo", "No", images == "no")}${segmentChoice("images", "yes", "imgYes", "Yes", images == "yes")}${segmentChoice("images", "scaled", "imgScaled", "Yes and scaled", images == "scaled")}</div><span class="hint">Yes retrieves each referenced image once and checks its format, size, colour depth and pixel aspect ratio. Yes and scaled also requests each image at half its width with ?w= to check that the server scales it, which doubles the image requests.</span></div>`;

	res.write(`<form class="panel" id="check-form" method="post" enctype="multipart/form-data">
<fieldset><legend>What to validate</legend><div class="seg">${types}</div></fieldset>
<fieldset><legend>Document</legend><div class="source-row">
<div class="seg" role="group" aria-label="Document source">${segmentChoice("doclocation", modes.url, "radURL", "URL", session?.entry == modes.url)}${segmentChoice("doclocation", modes.file, "radFile", "File", session?.entry == modes.file)}</div>
<div class="field field-url"><input type="url" id="XMLurl" name="XMLurl" aria-label="Document URL" placeholder="https://example.com/servicelist.xml" value="${escapeHTML(session?.url)}"></div>
<div class="field field-file"><input type="file" id="XMLfile" name="XMLfile" aria-label="Document file"></div>
</div></fieldset>
<fieldset class="cg-type"><legend>Content guide query type</legend><div class="seg">${requestTypes}</div></fieldset>
<fieldset><legend>Options</legend><div class="options">
<label class="check sl-options"><input type="checkbox" id="cbGermany" name="forGermany"${session?.forGermany == true ? " checked" : ""}><span>Germany</span><span class="hint">Validate against the German profile of A177, which requires 7 days of programme guide either side of today instead of 28.</span></label>
${traverse}
${imageChecking}
</div></fieldset>
<div class="actions"><button type="submit" class="primary" id="validate">Validate</button><span class="hint" id="submit-hint">${SUBMIT_HINT}</span></div>
</form>${SUBMIT_SCRIPT}`);

	let source: string = "";
	switch (req.body?.doclocation) {
		case MODE_URL:
			source = typeof req.body?.XMLurl == "string" ? req.body.XMLurl : "";
			break;
		case MODE_FILE:
			source = (req.files?.XMLfile as UploadedFile)?.name ? (req.files?.XMLfile as UploadedFile).name : "";
			break;
	}
	await sendHTML(res, resultsPage(req, source, error, errs));
	return res;
}

export async function drawResults(req: express.Request, res: express.Response, motd?: string, error?: string[], errs?: ErrorList) : Promise<express.Response>{
	res.setHeader("Content-Type", "text/html");
	res.write(PAGE_TOP("DVB-I Validator", req.secure, "DVB-I Validator", motd));
	await sendHTML(res, resultsPage(req, req.query.url ? req.query.url as string: "uploaded list", error, errs));
	return res;
}
