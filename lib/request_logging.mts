/**
 * request_logging.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * The HTTP request log: one line per request, on the console and, when a ./logs directory exists, in a monthly rotated
 * file there
 */

import { existsSync } from "fs"
import { join } from "path"
import express from "express"
import morgan, { token } from "morgan"
import fileupload from "express-fileupload"
import { createStream } from "rotating-file-stream"

import { MODE_CG, MODE_FILE } from "./ui.mts"

export const LOGGING_TEMPLATE =
	":pid :remote-addr :protocol :method :url :status :res[content-length] :counts - :response-time ms :agent :parseErr :location :vary :redirect";

let tokensDefined = false;

// the tokens of LOGGING_TEMPLATE that morgan does not define
function defineTokens(): void {
	if (tokensDefined) return;
	tokensDefined = true;
	token("protocol", (req: express.Request) => {
		return req.protocol;
	});
	token("counts", (req: express.Request) => {
		return req.diags ? `(${req.diags.countErrors},${req.diags.countWarnings},${req.diags.countInforms})` : "[-]";
	});
	token("agent", (req: express.Request) => {
		return `(${req.headers["user-agent"]})`;
	});
	token("vary", (req: express.Request, res: express.Response) => {
		return res.varyOn && res.varyOn.size > 0 ? `vary(${[...res.varyOn!].join(",")})` : "-";
	});
	token("parseErr", (req: express.Request) => {
		return req?.parseErr ? `(${req.parseErr})` : "";
	});
	token("location", (req: express.Request) => {
		return req?.body?.testtype
			? `${req.body.testtype}::[${req.body.testtype == MODE_CG ? `(${req.body.requestType})` : ""}${
					req.body.doclocation == MODE_FILE ? (req.files?.XMLfile ? (req.files.XMLfile as fileupload.UploadedFile).name : "unnamed") : req.body.XMLurl
				}]`
			: "[*]";
	});
	const getSource = (req: express.Request) => req.ip || /*req._remoteAddress ||*/ (req.socket && req.socket.remoteAddress) || undefined;
	token("redirect", (req: express.Request, res: express.Response) => {
		return [301, 302].includes(res.statusCode) ? `redirect(${req.socket.remoteFamily}-${getSource(req)}` : "";
	});
}

/**
 * the request loggers: the console, and a rotated file in ./logs when that directory exists
 *
 * @returns {express.RequestHandler[]} the loggers, to be registered before the routes
 */
export function requestLoggers(): express.RequestHandler[] {
	defineTokens();
	const loggers: express.RequestHandler[] = [morgan(LOGGING_TEMPLATE)];
	const logDir = join(".", "logs");
	if (existsSync(logDir)) {
		const logStream = createStream("access.log", {
			interval: "1M", // rotate monthly
			compress: "gzip", // compress rotated files
			path: logDir,
		});
		loggers.push(morgan(LOGGING_TEMPLATE, { stream: logStream }));
	}
	return loggers;
}

/**
 * the request logger for the console only (e.g. for the HTTP to HTTPS redirect)
 */
export function consoleLogger(): express.RequestHandler {
	defineTokens();
	return morgan(LOGGING_TEMPLATE);
}
