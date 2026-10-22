/**
 * logger.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * log stuff from the validator
 */

import express from "express"
import fileupload from "express-fileupload"
import chalk from "chalk"

import { existsSync, writeFile } from "fs"
import { join, sep } from "path"
import { MODE_URL, MODE_CG, MODE_SL, MODE_SLR, MODE_PL } from "./ui.mts"
import ErrorList from "./error_list.mts"

export function createPrefix(req: express.Request, testtype?: string) : string | undefined {
	const logDir = join(".", "arch");

	if (!existsSync(logDir)) return undefined;
	if (testtype && [MODE_CG, MODE_SL, MODE_SLR, MODE_PL].includes(testtype)) return undefined

	const getDate = (i : Temporal.Instant) : string=> {
		const fillZero = (t: number) : string => `${t < 10 ? "0" : ""}${t}`;
		const d = Temporal.Instant.fromEpochMilliseconds(i.epochMilliseconds).toZonedDateTimeISO("UTC");
		return `${d.year}-${fillZero(d.month)}-${fillZero(d.day)} ${fillZero(d.hour)}.${fillZero(d.minute)}.${fillZero(d.second)}`;
	};

	let fname: string | undefined = undefined,
		mode: string | undefined = undefined
	switch (req.method) {
		case "GET":
			if (req.query?.url) {
				const _url = req.query.url as string
				fname = _url.substring(_url.lastIndexOf("/") + 1)
			}
			mode = testtype || req.query?.testtype as string | undefined
			break
		case "POST":
			fname = req.body.doclocation == MODE_URL 
				? req.body.XMLurl.substring(req.body.XMLurl.lastIndexOf("/") + 1) 
				: (req?.files?.XMLfile as fileupload.UploadedFile).name
			mode = testtype || req.body.requestType
			break
	}
	if (!fname || !mode) return undefined
	return `${logDir}${sep}${getDate(Temporal.Now.instant())} (${mode}) ${fname.replace(/[/\\?%*:|"<>]/g, "-")}`
}


export default function writeOut(errs: ErrorList, filebase: string | undefined, markup: boolean, req?: express.Request) : void {
	if (!filebase || errs.markupXML?.length == 0) return;

	const outputLines = [];
	if (markup && req?.body?.XMLurl) outputLines.push(`<!-- source: ${req.body.XMLurl} -->`);
	errs.markupXML?.forEach((line) => {
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
