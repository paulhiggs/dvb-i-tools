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
import { MODE_URL, MODE_CG, MODE_SL, MODE_SLR, MODE_PL, MODE_AIT } from "./ui.mts"
import ErrorList from "./error_list.mts"

let lastArchiveStamp = "",
	archiveSequence = 0;

export function createPrefix(req: express.Request, testtype?: string) : string | undefined {
	const logDir: string = join(".", "arch");

	if (!existsSync(logDir)) return undefined;
	// a specified test type must be one of the known validation types
	if (testtype && ![MODE_CG, MODE_SL, MODE_SLR, MODE_PL, MODE_AIT].includes(testtype)) return undefined

	const getDate = (i : Temporal.Instant) : string=> {
		const fillZero = (t: number) : string => `${t < 10 ? "0" : ""}${t}`;
		const d = Temporal.Instant.fromEpochMilliseconds(i.epochMilliseconds).toZonedDateTimeISO("UTC");
		const stamp = `${d.year}-${fillZero(d.month)}-${fillZero(d.day)} ${fillZero(d.hour)}.${fillZero(d.minute)}.${fillZero(d.second)}.${d.millisecond.toString().padStart(3, "0")}`;
		// documents archived within the same millisecond get a sequence number so they do not overwrite each other
		archiveSequence = stamp == lastArchiveStamp ? archiveSequence + 1 : 0;
		lastArchiveStamp = stamp;
		return archiveSequence ? `${stamp}-${archiveSequence}` : stamp;
	};

	const lastPathSegment = (url: unknown) : string | undefined =>
		typeof url == "string" ? url.substring(url.lastIndexOf("/") + 1) : undefined

	let fname: string | undefined = undefined,
		mode: string | undefined = undefined
	switch (req.method) {
		case "GET":
			fname = lastPathSegment(req.query?.url)
			mode = testtype || req.query?.testtype as string | undefined
			break
		case "POST":
			if (typeof req.body == "string")
				// document POSTed directly to a /validate_* endpoint (parsed by express.text())
				fname = "posted.xml"
			else if (req.body?.doclocation == MODE_URL)
				fname = lastPathSegment(req.body.XMLurl)
			else
				fname = (req.files?.XMLfile as fileupload.UploadedFile | undefined)?.name
			mode = testtype || (typeof req.body == "object" ? req.body?.requestType : undefined)
			break
	}
	if (!fname || !mode) return undefined
	return `${logDir}${sep}${getDate(Temporal.Now.instant())} (${mode}) ${fname.replace(/[/\\?%*:|"<>]/g, "-")}`
}


export default function document_logger(errs: ErrorList, filebase: string | undefined, markup: boolean, req?: express.Request) : void {
	if (!filebase || !errs.markupXML?.length) return;

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
