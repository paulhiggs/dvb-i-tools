/**
 * ui.mts
 *
 * Drive the HTML user interface
 * 
 */
import Express from 'express';
import fileupload from 'express-fileupload';
import { readFileSync } from "fs";

import { HTMLize } from "../phlib/phlib.ts";

import ErrorList from "./error_list.mts";
import { ERROR, WARNING } from "./error_list.mts";
import type { LogIssue, DebugMessage } from "./error_list.mts";
import type { TypedRequestBody }  from "./index.d.ts"; 

export const MODE_UNSPECIFIED : string = "none",
	MODE_SL : string = "sl",
	MODE_CG : string = "cg",
	MODE_URL : string = "url",
	MODE_FILE : string = "file";

const MESSAGES_IN_ORDER : boolean = true; // when true outputs the errors, warnings and informations in the 'document order'. false==ouotput in order found
const SHOW_LINE_NUMBER : boolean = false; // include the line number in the XML document where the error was found

const pkg = JSON.parse(readFileSync("./package.json", { encoding: "utf-8" }).toString());

export function PAGE_TOP(pageTitle : string, label : string | null = null, motd : string | null = null) {
	const TABLE_STYLE =
		"<style>table {border-collapse: collapse;border: 1px solid black;} th, td {text-align: left; padding: 8px;} tr:nth-child(even) {background-color: #f2f2f2;}	</style>";
	const XML_STYLE = "<style>.xmlfont {font-family: Arial, Helvetica, sans-serif; font-size:90%;}</style>";
	const MARKUP_TABLE_STYLE = "<style></style>";
	// dont allow Chrome to translate the page - seems to 'detect' German
	const METAS = '<meta name="google" content="notranslate"/><meta charset="utf-8">';
	const HEAD = `<head>${METAS}${TABLE_STYLE}${XML_STYLE}${MARKUP_TABLE_STYLE}<title>${pageTitle}</title></head>`;
	const PG = `<html lang="en" xml:lang="en">\n${HEAD}<body>`;
	const PH = label ? `<h1>${label}</h1><p>${pkg.name} v${pkg.version} by ${HTMLize(pkg.author)}</p>` : "";
	const MOTD = motd ? `<div>${motd}</div>` : "";
	return `${PG}${PH}${MOTD}`;
}

const BREAK : string = "<br/>",
	LINE : string = "<hr/>";

export const PAGE_BOTTOM : string = `${BREAK}${LINE}<p><i>Submit issues at </i><a href=${pkg.bugs.url.quote()}>${pkg.bugs.url}</a></p></body></html>`;

function tabulateResults(source : string , res : Express.Response, error : string | null = null, errs : ErrorList | null) {
	const RESULT_WITH_INSTRUCTION = `${BREAK}<p><i>Results:</i> ${source}</p>`;
	const SUMMARY_FORM_HEADER = "<table><tr><th>item</th><th>count</th></tr>";
	const Dodger_Blue = "#1E90FF",
		link_css = "jump";

	const scrollFunc = `<script>function myScrollTo(item){
		var itemPos = document.getElementById(item).getBoundingClientRect();
		window.scrollTo(window.scrollX+itemPos.x, window.scrollY+itemPos.y);
	}</script>`;
	let DETAIL_FORM_HEADER = (mode : string) : string => `${scrollFunc}<table><tr>${SHOW_LINE_NUMBER ? "<th>line</th>" : ""}<th>code</th><th>${mode}</th></tr>`;
	let DESCRIPTION_TABLE_HEDER = () : string => `<table><tr><th>code</th><th>description</th></tr>`;
	let DEBUG_FORM_HEADER = (mode : string) : string => `${scrollFunc}<table><tr><th>code</th><th>${mode}</th></tr>`;

	const TABLE_FOOTER : string = `</table>${BREAK}`;

	let tabluateMessage = (value : LogIssue) => {
		res.write("<tr>");
		const anchor = Object.prototype.hasOwnProperty.call(value, "line") ? `line-${value.line}` : null;
		if (SHOW_LINE_NUMBER) res.write(`<td>${Object.prototype.hasOwnProperty.call(value, "line") ? value.line : ""}</td>`);
		res.write(`<td>${anchor ? `<span class=${link_css.quote('"')} onclick="myScrollTo('${anchor}')">` : ""}${value.code ? HTMLize(value.code) : ""}${anchor ? "</span>" : ""}</td>`);
		res.write(`<td>${value.message ? HTMLize(value.message) : ""}`);
		res.write(`${value.element ? `<br/><span class="xmlfont"><pre>${HTMLize(value.element)}</pre></span>` : ""}</td>`);
		res.write("</tr>");
	}

	let simpleMessage = (value : DebugMessage) => {
		res.write(`<tr><td>${value.code}</td><td>${value.message}</td><tr>`);
	}

	res.write(RESULT_WITH_INSTRUCTION);
	if (error) res.write(`<p>${error}</p>`);
	let resultsShown = false;
	if (errs) {
		res.write(`<style>span.${link_css} {} span.${link_css} {color: ${Dodger_Blue}; text-decoration: underline;} </style>`);

		if (errs.numCountsErr() > 0 || errs.numCountsWarn() > 0 || errs.numCountsInfo() > 0) {
			res.write(SUMMARY_FORM_HEADER);
			errs.countsErr.forEach((e) => res.write(`<tr><td>${HTMLize(e.key)}</td><td>${e.count}</td></tr>`));
			errs.countsWarn.forEach((w) => res.write(`<tr><td><i>W: ${HTMLize(w.key)}</i></td><td>${w.count}</td></tr>`));
			errs.countsInfo.forEach((i) => res.write(`<tr><td><i>I: ${HTMLize(i.key)}</i></td><td>${i.count}</td></tr>`));
			resultsShown = true;
			res.write(TABLE_FOOTER);
		}

		let sortComparitor = (a : LogIssue, b: LogIssue) : number => {
			if (!a?.line || !b?.line)
				return 0;
			if (a.line < b.line)
				return -1;
			else if (a.line > b.line)
				return 1;
			return 0;
		};

		if (errs.numErrors() > 0) {
			res.write(DETAIL_FORM_HEADER("errors"));
			if (MESSAGES_IN_ORDER)
				errs.errors.sort((a : LogIssue, b : LogIssue) => sortComparitor(a, b));
			errs.errors.forEach(tabluateMessage);
			resultsShown = true;
			res.write(TABLE_FOOTER);
		}

		if (errs.numWarnings() > 0) {
			res.write(DETAIL_FORM_HEADER("warnings"));
			if (MESSAGES_IN_ORDER)
				errs.warnings.sort((a : LogIssue, b : LogIssue) => sortComparitor(a, b));
			errs.warnings.forEach(tabluateMessage);
			resultsShown = true;
			res.write(TABLE_FOOTER);
		}

		if (errs.numInformationals() > 0) {
			res.write(DETAIL_FORM_HEADER("informationals"));
			if (MESSAGES_IN_ORDER)
				errs.informationals.sort((a : LogIssue, b : LogIssue) => sortComparitor(a, b));
			errs.informationals.forEach(tabluateMessage);
			resultsShown = true;
			res.write(TABLE_FOOTER);
		}

		if (errs.debugs.length > 0) {
			res.write(DEBUG_FORM_HEADER("debug"));
			errs.debugs.forEach(simpleMessage);
			resultsShown = true;
			res.write(TABLE_FOOTER);
		}
	}

	if (!error && !resultsShown) res.write(`no errors, warnings or informationals${BREAK}`);
	else if (errs && errs.errorDescriptions.length) {
		res.write(DESCRIPTION_TABLE_HEDER());
		errs.errorDescriptions.forEach((desc) => {
			res.write(`<tr><td>${desc.code}</td>`);
			res.write(`<td>${HTMLize(desc.description).replace(/\n/, BREAK)}`);
			if (desc.clause && desc.clause.length) res.write(`${BREAK}reference: ${desc.clause}`);
			res.write("</td></tr>");
		});
		res.write(TABLE_FOOTER);
	}

	if (errs && errs.markupXML && errs.markupXML.length > 0) {
		res.write(LINE);
		const ERR = "errors",
			WARN = "warnings",
			INFO = "info",
			style = (name : string, colour : string) => `<style>.${name} {position:relative; cursor:pointer; color:${colour};} .${name}[title]:hover:after {opacity:1; transition-delay:.1s; }</style>`;
		let lineNum = 0;
		const maxLineNumLength = errs.markupXML.length.toString().length;
		res.write(`${style(ERR, "red")}${style(WARN, "blue")}${style(INFO, "orange")}<pre>`);

		errs.markupXML.forEach((line) => {
			let cla = "";
			const tip = line.validationErrors ? line.validationErrors.map((err) => HTMLize(err)).join("&#10;") : null;
			if (tip) {
				if (tip.includes(ERROR)) cla = ERR;
				else if (tip.includes(WARNING)) cla = WARN;
				else cla = INFO;
			}
			let qualifier = tip ? ` class=${cla.quote('"')} title=${tip.quote('"')}` : "";
			if (SHOW_LINE_NUMBER) {
				lineNum++;
				res.write(`<span>${lineNum.toString().padStart(maxLineNumLength)} : </span>`);
			}
			res.write(`<span id="line-${line.ix}"${qualifier}>${HTMLize(line.value)}</span>${BREAK}`);
		});
		res.write(`</pre>${LINE}`);
	}
}

import type { CGRequestInfo } from "./cg_check.mts";

export type FormOptions = {
	cg : string;
	sl : string;
	file : string;
	url : string;
	hasSL : boolean;
	hasCG :  boolean;
	supportedRequests? : Array<CGRequestInfo>;
}

export function drawForm(req : TypedRequestBody, res : Express.Response, modes : FormOptions, motd : string | null = null, error : string | null = null, errs : ErrorList | null = null) {
	const ENTRY_FORM_REQUEST_TYPE_ID = "requestType";

	res.setHeader("Content-Type", "text/html");
	res.write(PAGE_TOP("DVB-I Validator", "DVB-I Validator", motd));
	res.write(`
	<script>
	function redrawForm() {
		document.getElementById("entryURL").hidden=!document.getElementById("radURL").checked
		document.getElementById("entryFile").hidden=!document.getElementById("radFile").checked
		document.getElementById("entryCGtype").hidden=!document.getElementById("radCG").checked
	}
	</script>
	<form method="post" encType="multipart/form-data">
		${
			modes.hasSL
				? `<input id="radSL" type="radio" name="testtype" value=${modes.sl.quote('"')} ${req?.session?.data?.mode == modes.sl ? "checked" : ""} onclick="redrawForm()">Service List</input>`
				: ""
		}
		${
			modes.hasCG
				? `<input id="radCG" type="radio" name="testtype" value=${modes.cg.quote('"')}${req?.session?.data?.mode == modes.cg ? "checked" : ""} onclick="redrawForm()">Content Guide</input>`
				: ""
		}
		<br><br>
		<input id="radURL" type="radio" name="doclocation" value=${modes.url.quote('"')} ${req?.session?.data?.entry == modes.url ? "checked" : ""} onclick="redrawForm()">URL</input>
		<input id="radFile" type="radio" name="doclocation" value=${modes.file.quote('"')} ${req?.session?.data?.entry == modes.file ? "checked" : ""} onclick="redrawForm()">File</input>
		${LINE}
		<div id="entryURL" ${req?.session?.data?.entry == modes.url ? "" : "hidden"}><p><i>URL:</i><input type="url" name="XMLurl" value=${req?.session?.data?.url ? req.session.data.url.quote('"') : "".quote('"')}></p></div>
		<div id="entryFile" ${req?.session?.data?.entry == modes.file ? "" : "hidden"}><p><i>FILE:</i><input type="file" name="XMLfile" value=""></p></div>
		<div id="entryCGtype" ${req?.session?.data?.mode == modes.cg ? "" : "hidden"}><p>Query type:</p>`);

	if (modes.supportedRequests)
		modes?.supportedRequests?.forEach((choice) => {
			res.write(
				`<input type="radio" name=${ENTRY_FORM_REQUEST_TYPE_ID.quote('"')} value=${choice.value.quote('"')} ${choice.value == req?.session?.data?.cgmode ? "checked" : ""}>${choice.label}</input>`
			);
		});
	res.write(`</div>
		<br><input type="submit" value="Validate!"><br>	
	</form>
	`);
	let source = "";
	switch (req.body?.doclocation) {
		case MODE_URL:
			source = req.body?.XMLurl ? req.body?.XMLurl : "";
			break;
		case MODE_FILE:
			source = (req.files?.XMLfile as fileupload.UploadedFile)?.name ? (req.files?.XMLfile as fileupload.UploadedFile).name : "";
			break;
	}
	tabulateResults(source, res, error, errs);
	res.write(PAGE_BOTTOM);

	return new Promise((resolve, /* eslint-disable no-unused-vars */ reject /* eslint-enable */) => {
		resolve(res);
	});
}

export function drawResults(req : Express.Request, res : Express.Response, motd : string | null = null, error : string | null = null, errs : ErrorList | null = null) {
	res.setHeader("Content-Type", "text/html");
	res.write(PAGE_TOP("DVB-I Validator", "DVB-I Validator", motd));
	tabulateResults(req.query.url ? req.query.url as string : "uploaded list", res, error, errs);
	res.write(PAGE_BOTTOM);
	return new Promise((resolve, /* eslint-disable no-unused-vars */ reject /* eslint-enable */) => {
		resolve(res);
	});
}
