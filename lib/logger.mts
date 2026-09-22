/**
 * logger.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * log stuff from the validator
 */

import * as Express from "express"
import chalk from "chalk";

import { existsSync, writeFile } from "fs";
import { join, sep } from "path";
import { MODE_URL, MODE_SL, MODE_SLR } from "./ui.mts";
import ErrorList from "./error_list.mts";

export function createPrefix(req: Express.Request) {
	const logDir = join(".", "arch");

	if (!existsSync(logDir)) return null;

	const getDate = (i : Temporal.Instant) => {
		const fillZero = (t: number) : string => `${t < 10 ? "0" : ""}${t}`;
		const d = Temporal.Instant.fromEpochMilliseconds(i.epochMilliseconds).toZonedDateTimeISO("UTC");
		return `${d.year}-${fillZero(d.month)}-${fillZero(d.day)} ${fillZero(d.hour)}.${fillZero(d.minute)}.${fillZero(d.second)}`;
	};

	const fname = req.body.doclocation == MODE_URL ? req.body.XMLurl.substr(req.body.XMLurl.lastIndexOf("/") + 1) : req?.files?.XMLfile?.name;
	if (!fname) return null;

	const mode = req.body.testtype == MODE_SL ? "SL" : req.body.testtype == MODE_SLR ? "SLR" : req.body.requestType;

	return `${logDir}${sep}${getDate(Temporal.Now.instant())} (${mode}) ${fname.replace(/[/\\?%*:|"<>]/g, "-")}`;
}


export default function writeOut(errs: ErrorList, filebase: string | undefined, markup: boolean, req?: Express.Request) {
	if (!filebase || errs.markupXML?.length == 0) return;

	const outputLines = [];
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
