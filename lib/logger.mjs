/**
 * logger.mjs
 *
 * log stuff from the validator
 */

import chalk from "chalk";

import { existsSync, writeFile } from "fs";
import { join, sep } from "path";
import { MODE_URL, MODE_SL, MODE_SLR } from "./ui.mjs";

export function createPrefix(req) {
	const logDir = join(".", "arch");

	if (!existsSync(logDir)) return null;

	const getDate = (d) => {
		const fillZero = (t) => (t < 10 ? `0${t}` : t);
		return `${d.getFullYear()}-${fillZero(d.getMonth() + 1)}-${fillZero(d.getDate())} ${fillZero(d.getHours())}.${fillZero(d.getMinutes())}.${fillZero(d.getSeconds())}`;
	};

	const fname = req.body.doclocation == MODE_URL ? req.body.XMLurl.substr(req.body.XMLurl.lastIndexOf("/") + 1) : req?.files?.XMLfile?.name;
	if (!fname) return null;

	const mode = req.body.testtype == MODE_SL ? "SL" : req.body.testtype == MODE_SLR ? "SLR" : req.body.requestType;

	return `${logDir}${sep}${getDate(new Date())} (${mode}) ${fname.replace(/[/\\?%*:|"<>]/g, "-")}`;
}

export default function writeOut(errs, filebase, markup, req = null) {
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
