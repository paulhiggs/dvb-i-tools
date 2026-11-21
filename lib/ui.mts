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

import { ERROR, WARNING } from "./error_list.mts"
import ErrorList from "./error_list.mts";
import type { ErrorType } from "./error_list.mts"

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

export function PAGE_TOP(pageTitle: string, secure: boolean, label?:string, motd?:string) {
	const TABLE_STYLE =
		"<style>table {border-collapse: collapse;border: 1px solid black;} tr {vertical-align: top} th, td {text-align: left; padding: 8px;} tr:nth-child(even) {background-color: #f2f2f2;}</style>";
	const XML_STYLE = "<style>.xmlfont {font-family: Arial, Helvetica, sans-serif; font-size:90%;}</style>";
	const MARKUP_TABLE_STYLE = "<style></style>";
	const URL_FORMAT_STYLE = "<style>.url {font-family: Arial, Helvetica, sans-serif; font-size:80%;}</style>"
	// dont allow Chrome to translate the page - seems to 'detect' German
	const METAS = '<meta name="google" content="notranslate"/><meta charset="utf-8">';
	const HEAD = `<head>${METAS}${TABLE_STYLE}${XML_STYLE}${MARKUP_TABLE_STYLE}${URL_FORMAT_STYLE}<title>${pageTitle}</title></head>`;
	const PG = `<html lang="en" xml:lang="en">\n${HEAD}<body>`;
	const PH = label ? `<h1>${label}</h1><p>${pkg.name} v${pkg.version}/${secure ? "https" : "http"} by ${pkg.author.HTMLize()}</p>` : "";
	const MOTD = motd ? `<div>${motd}</div>` : "";
	return `${PG}${PH}${MOTD}`;
}


export const PAGE_BOTTOM = `${BREAK}${LINE}<p><i>Submit issues at </i><a href="${pkg?.bugs?.url}">${pkg?.bugs?.url}</a></p></body></html>`;

const RESULT_WITH_INSTRUCTION = (source: string) =>`${BREAK}<p><i>Results:</i> ${escapeHTML(source)}</p>`;
const SUMMARY_FORM_HEADER = "<table><tr><th>item</th><th>count</th></tr>";
const Dodger_Blue = "#1E90FF",
	link_css = "jump";

const scrollFunc = `<script>function myScrollTo(item){
	var itemPos = document.getElementById(item).getBoundingClientRect();
	window.scrollTo(window.scrollX+itemPos.x, window.scrollY+itemPos.y);
}</script>`;
const DETAIL_FORM_HEADER = (mode: string, colour?: string) =>
	`${scrollFunc}<table ${colour ? ` style="color:${colour}"` : ""}><tr>${SHOW_LINE_NUMBER ? "<th>line</th>" : ""}<th>code</th><th>${mode}</th></tr>`;
const DESCRIPTION_TABLE_HEADER = () => `<table><tr><th>code</th><th>description</th></tr>`;
const DEBUG_FORM_HEADER = (mode: string) => `${scrollFunc}<table><tr><th>code</th><th>${mode}</th></tr>`;
const TABLE_FOOTER = `</table>${BREAK}`;

const tabluateMessage = function* (value: ErrorType): Generator<string> {
	yield `<tr>`;
	const anchor = HasProperty(value, "line") ? `line-${value.line}` : null;
	if (SHOW_LINE_NUMBER) yield `<td>${Object.prototype.hasOwnProperty.call(value, "line") ? value.line : ""}</td>`;
	yield `<td>${anchor ? `<span class="${link_css}" onclick="myScrollTo('${anchor}')">` : ""}${value.code ? value.code.HTMLize() : ""}${anchor ? "</span>" : ""}</td>`;
	yield `<td>${value.message ? value.message.HTMLize() : ""}`;
	yield `${value.element ? `<br/><span class="xmlfont"><pre>${value.element.HTMLize()}</pre></span>` : ""}</td>`;
	yield "</tr>";
};

const simpleMessage = (value: {code: string, message: string}) => `<tr><td>${escapeHTML(value.code)}</td><td>${escapeHTML(value.message)}</td></tr>`;

const lineCompareFn = (a: ErrorType, b: ErrorType) => a?.line && b?.line ? a.line - b.line : 0;

const ErrorTable = function* (errors: ErrorType[], title: string, colour?: string): Generator<string> {
	yield DETAIL_FORM_HEADER(title, colour);
	if (MESSAGES_IN_ORDER) errors.sort(lineCompareFn);
	for (const e of errors) yield* tabluateMessage(e);
	yield TABLE_FOOTER;
}

function* tabulateResults(source: string, error: string[] | undefined, errs: ErrorList | undefined): Generator<string> {

	yield RESULT_WITH_INSTRUCTION(source);
	if (error)
		for (const e of error) yield `<p>${e.HTMLize()}</p>`;

	let resultsShown = false;
	if (errs) {
		yield `<style>span.${link_css} {} span.${link_css} {color: ${Dodger_Blue}; text-decoration: underline;} </style>`;

		if (errs.numCountsFatal() > 0 || errs.numCountsErr() > 0 || errs.numCountsWarn() > 0 || errs.numCountsInfo() > 0) {
			yield SUMMARY_FORM_HEADER;
			for (const f of errs.countsFatal) yield `<tr style="color:red;"><td>FATAL: ${f.key.HTMLize()}</td><td>${f.count}</td></tr>`;
			for (const e of errs.countsErr) yield `<tr><td>${e.key.HTMLize()}</td><td>${e.count}</td></tr>`;
			for (const w of errs.countsWarn) yield `<tr><td><i>W: ${w.key.HTMLize()}</i></td><td>${w.count}</td></tr>`;
			for (const i of errs.countsInfo) yield `<tr><td><i>I: ${i.key.HTMLize()}</i></td><td>${i.count}</td></tr>`;
			resultsShown = true;
			yield TABLE_FOOTER;
		}

		if (errs.numFatals() > 0) {
			yield* ErrorTable(errs.fatals, "fatals (further validation aborted)", "red");
			resultsShown = true;
		}

		if (errs.numErrors() > 0) {
			yield* ErrorTable(errs.errors, "errors");
			resultsShown = true;
		}

		if (errs.numWarnings() > 0) {
			yield* ErrorTable(errs.warnings, "warnings");
			resultsShown = true;
		}

		if (errs.numInformationals() > 0) {
			yield* ErrorTable(errs.informationals, "informationals");
			resultsShown = true;
		}

		if (errs.debugs.length > 0) {
			yield DEBUG_FORM_HEADER("debug");
			for (const d of errs.debugs) yield simpleMessage(d);
			resultsShown = true;
			yield TABLE_FOOTER;
		}
	}

	if (!error && !resultsShown) yield `no errors, warnings or informationals${BREAK}`;
	else if (errs?.errorDescriptions.length) {
		yield DESCRIPTION_TABLE_HEADER();
		for (const desc of errs.errorDescriptions) {
			yield `<tr><td>${desc.code.HTMLize()}</td>`;
			yield `<td>${desc.description.HTMLize().replace(/\n/, BREAK)}`;
			if (desc.clause && desc.clause.length) yield `${BREAK}reference: ${escapeHTML(desc.clause)}`;
			yield "</td></tr>";
		}
		yield TABLE_FOOTER;
	}

	if (errs && errs.markupXML && errs.markupXML.length > 0) {
		yield LINE;
		const FATAL = "fatals",
			ERR = "errors",
			WARN = "warnings",
			INFO = "info",
			style = (name: string, colour: string) => `<style>.${name} {position:relative; cursor:pointer; color:${colour};} .${name}[title]:hover:after {opacity:1; transition-delay:.1s; }</style>`;
		let lineNum = 0;
		const maxLineNumLength = errs.markupXML!.length.toString().length;
		yield `${style(FATAL, "red")}${style(ERR, "red")}${style(WARN, "blue")}${style(INFO, "orange")}<pre>`;

		for (const line of errs.markupXML!) {
			let cla = "";
			const tip = line.validationErrors ? line.validationErrors.map((err) => err.HTMLize()).join("&#10;") : null;
			if (tip) {
				if (tip.includes(ERROR)) cla = ERR;
				else if (tip.includes(WARNING)) cla = WARN;
				else cla = INFO;
			}
			const qualifier = tip ? ` class="${cla}" title="${tip}"` : "";
			if (SHOW_LINE_NUMBER) {
				lineNum++;
				yield `<span>${lineNum.toString().padStart(maxLineNumLength)} : </span>`;
			}
			yield `<span id="line-${line.ix}"${qualifier}>${line.value.HTMLize()}</span>${BREAK}`;
		}
		yield `</pre>${LINE}`;
	}
}


const severity_highlight: {background:string, text:string}[] = [
	/* 0 */ {background:"background-color: palegreen;", text:"color:black;"},
	/* 1 */ {background:"background-color: skyblue;", text:"color:black;"},
	/* 2 */ {background:"background-color: yellow;", text:"color:black;"},
	/* 3 */ {background:"background-color: orange;", text:"color:black;"},
	/* 4 */ {background:"background-color: red;", text:"color:white;"},
	/* 5 */ {background:"background-color: darkred;", text:"color:yellow;"},
]

function* nested_error_row(req: express.Request, errs: ErrorList | undefined, depth: number): Generator<string> {
	if (!errs || errs.nestedErrors.length == 0) return
	for (const nest of errs.nestedErrors) {
		const palette =  severity_highlight[nest.severity()]
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
		yield `<tr><td>${depth}</td><td>`+
			refer+
			(nest.source ? `${BREAK}<span class="url">${escapeHTML(nest.source)}</span>`: "")+
			"</td>"+
			`<td style="${palette.background} ${palette.text}">${escapeHTML(nest.compactSummary())}`
		for (const msg of nest.debugs) yield `${BREAK}${escapeHTML(msg.code)} ${escapeHTML(msg.message)}`
		yield `</td><td>${(nest.references ?? 1) > 1 ? nest.references : ""}</td></tr>`
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

function* reportNestedErrors(req: express.Request, errs: ErrorList | undefined): Generator<string> {
	if (!errs || errs.nestedErrors.length == 0) return

	const { documents, repeats } = traversalCounts(errs)
	yield `${BREAK}<p><b>Traversed Errors</b></p>`
	yield `<p>${documents} ${documents == 1 ? "document" : "documents"} traversed${repeats > 0 ? `, ${repeats} further ${repeats == 1 ? "reference" : "references"} to them not validated again` : ""}</p>`
	yield `<table><tr><th></th><th>location</th><th>result</th><th>references</th></tr>`

	yield* nested_error_row(req, errs, 1)
	yield "</table>"
}

// the results part of a page: the validation results, the traversed documents and the page bottom
function* resultsPage(req: express.Request, source: string, error: string[] | undefined, errs: ErrorList | undefined): Generator<string> {
	yield* tabulateResults(source, error, errs);
	yield* reportNestedErrors(req, errs);
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

export async function drawForm(
		req: express.Request, res: express.Response,
		modes: FormModes, 
		supportedRequests: CGRequestType[] | null, 
		motd?: string, error?: string[], errs?: ErrorList) : Promise<express.Response> {
			
	const ENTRY_FORM_REQUEST_TYPE_ID = "requestType";

	res.setHeader("Content-Type", "text/html");
	res.write(PAGE_TOP("DVB-I Validator", req.secure, "DVB-I Validator", motd));
	res.write(`
	<script>
	function redrawForm() {
		document.getElementById("entryURL").hidden=!document.getElementById("radURL").checked
		document.getElementById("entryFile").hidden=!document.getElementById("radFile").checked
		document.getElementById("entryCGtype").hidden=!document.getElementById("radCG").checked
		document.getElementById("variants").hidden=!document.getElementById("radSL").checked && !document.getElementById("radSLR").checked
		document.getElementById("traverser").hidden=!document.getElementById("radSL").checked && !document.getElementById("radSLR").checked
	}
	</script>
	<form method="post" encType="multipart/form-data">
		${
			modes.hasSL
				? `<input id="radSL" type="radio" name="testtype" value="${modes.sl}" ${req.session.data?.mode == modes.sl ? "checked" : ""} onclick="redrawForm()">Service List</input>`
				: ""
		}
		${
			modes.hasPL
				? `<input id="radPL" type="radio" name="testtype" value="${modes.pl}" ${req.session.data?.mode == modes.pl ? "checked" : ""} onclick="redrawForm()">Playist</input>`
				: ""
		}
		${
			modes.hasCG
				? `<input id="radCG" type="radio" name="testtype" value="${modes.cg}" ${req.session.data?.mode == modes.cg ? "checked" : ""} onclick="redrawForm()">Content Guide</input>`
				: ""
		}
		${
			modes.hasSLR
				? `<input id="radSLR" type="radio" name="testtype" value="${modes.slr}" ${req.session.data?.mode == modes.slr ? "checked" : ""} onclick="redrawForm()">Service List Registry</input>`
				: ""
		}

		<br><br>
		<input id="radURL" type="radio" name="doclocation" value="${modes.url}" ${req.session.data?.entry == modes.url ? "checked" : ""} onclick="redrawForm()">URL</input>
		<input id="radFile" type="radio" name="doclocation" value="${modes.file}" ${req.session.data?.entry == modes.file ? "checked" : ""} onclick="redrawForm()">File</input>
		<br/>
		${LINE}
		<div id="entryURL" ${req.session.data?.entry == modes.url ? "" : "hidden"}><p><i>URL:</i><input type="url" size="70" name="XMLurl" value="${
			escapeHTML(req.session.data?.url)
		}"></p></div>
		<div id="entryFile" ${req.session.data?.entry == modes.file ? "" : "hidden"}><p><i>FILE:</i><input type="file" name="XMLfile" value=""></p></div>
		<div id="variants">Variants: <input id="cbGermany" type="checkbox" name="forGermany" ${req.session.data?.forGermany == true ? "checked" : ""} onclick="redrawForm()">Germany</input></div>
		${
			modes.allowTraversal
			? `<div id="traverser">Options: <input id="cbTraverse" type="checkbox" name="traverse" ${req.session.data?.traverse == true ? "checked" : ""} onclick="redrawForm()">Traverse <span style="color:red">(caution: time consuming)</span></input></div>`
			: ""
		}
		<div id="entryCGtype" ${req.session.data?.mode == modes.cg ? "" : "hidden"}><p>Query type:</p>`);
	if (supportedRequests)
		supportedRequests.forEach((choice) => {
			res.write(
				`<input type="radio" id="${escapeHTML(choice.value)}" name="${ENTRY_FORM_REQUEST_TYPE_ID}" value="${escapeHTML(choice.value)}" ${choice.value == req.session.data?.cgmode ? "checked" : ""} onclick="redrawForm()">${escapeHTML(choice.label)}</input>`
			);
		});
	res.write(`</div>
		<br><input type="submit" value="Validate!"><br>	
	</form>
	`);
	let source: string = "";
	switch (req.body?.doclocation) {
		case MODE_URL:
			source = req.body?.XMLurl ? req.body?.XMLurl : "";
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
