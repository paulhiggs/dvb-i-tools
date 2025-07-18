/**
 * logger.mts
 *
 * log stuff from the validator
 * 
 */
import chalk from "chalk";
import Express, from "express";
import fileupload from "express-fileupload";
import { existsSync, writeFile } from "fs";
import { join, sep } from "path";

import type { TypedRequestBody }  from "./index.d.ts"; 

import ErrorList from "./error_list.mts";
import type { XMLline } from "./error_list.mts";
import { MODE_URL, MODE_SL } from "./UI.mts";


declare module "express" {
	interface Request {
		files? : fileupload.FileArray | null | undefined;
	}
}

export function createPrefix(req : TypedRequestBody) : string | null {
	const logDir = join(".", "arch");

	if (!existsSync(logDir)) return null;

	const getDate = (d : Date) => {
		const zeroPad = (num : number, places : number = 2) => String(num).padStart(places, '0');
		return `${d.getFullYear()}-${zeroPad(d.getMonth()+1)}-${zeroPad(d.getDate())} ${zeroPad(d.getHours())}.${zeroPad(d.getMinutes())}.${zeroPad(d.getSeconds())}`;
	};

	const xmlFileName = req?.files?.XMLfile?.name ? req.files.XMLfile.name: "";
	const fname = (req.body.doclocation == MODE_URL) ? req.body.XMLurl?.substring(req.body.XMLurl.lastIndexOf("/") + 1) : xmlFileName;
	if (!fname) return null;

	return `${logDir}${sep}${getDate(new Date())} (${req.body.testtype == MODE_SL ? "SL" : req.body.requestType}) ${fname.replace(/[/\\?%*:|"<>]/g, "-")}`;
}

export default function writeOut(errs : ErrorList, filebase : string | null , markup : boolean, req : TypedRequestBody | null = null) {
	if (!filebase || errs.markupXML?.length == 0) return;

	let outputLines : Array<string> = [];
	if (markup && req?.body?.XMLurl) 
		outputLines.push(`<!-- source: ${req.body.XMLurl} -->`);
	errs.markupXML?.forEach((line : XMLline) => {
		outputLines.push(line.value ? line.value : "");
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
