/**
 * logger.mts
 *
 * log stuff from the validator
 */
import { existsSync, writeFile } from "fs";
import { join, sep } from "path";

import chalk from "chalk";
import express from "express";

import ErrorList from "./error_list.mjs";
import { MODE_URL, MODE_SL, MODE_SLR } from "./ui.mts";

export function createPrefix(req : express.Request) : string | null {
	const logDir = join(".", "arch");

	if (!existsSync(logDir)) return null;

	const getDate = (d : Date) => {
		const fillZero = (t : number) => (t < 10 ? `0${t}` : t);
		return `${d.getFullYear()}-${fillZero(d.getMonth() + 1)}-${fillZero(d.getDate())} ${fillZero(d.getHours())}.${fillZero(d.getMinutes())}.${fillZero(d.getSeconds())}`;
	};

	const fname = req.body.doclocation == MODE_URL ? req.body.XMLurl.substr(req.body.XMLurl.lastIndexOf("/") + 1) : req.files.XMLfile.name;
	if (!fname) return null;

	const mode = req.body.testtype == MODE_SL ? "SL" : req.body.testtype == MODE_SLR ? "SLR" : req.body.requestType;

	return `${logDir}${sep}${getDate(new Date())} (${mode}) ${fname.replace(/[/\\?%*:|"<>]/g, "-")}`;
}

export default function writeOut(errs : ErrorList, filebase : string | null, markup : boolean, req? : express.Request) : void {
	if (!filebase || errs.markupXML?.length == 0) return;

	let outputLines = [];
	if (markup && req?.body?.XMLurl) outputLines.push(`<!-- source: ${req.body.XMLurl} -->`);
	errs.markupXML.forEach((line) => {
		outputLines.push(line.value);
		if (markup && line.validationErrors)
			line.validationErrors.forEach((error) => {
				outputLines.push(`<!--${error.replace(/[\n]/g, "")}-->`);
			});
	});
	const filename = markup ? `${filebase}.mkup.txt` : `${filebase}.raw.txt`;
	writeFile(filename, outputLines.join("\n"), (err) => {
		if (err) console.log(chalk.red(err));
	});
}
