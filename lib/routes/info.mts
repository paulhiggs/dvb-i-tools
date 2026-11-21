/**
 * info.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Information pages: /stats (the system, the application and request counts of each checker) and /langs (the languages
 * known to the service list checker)
 */

import os from "node:os"
import process from "process"
import { readFileSync } from "fs"
import { join } from "path"
import express from "express"

import { PAGE_TOP, PAGE_BOTTOM } from "../ui.mts"
import { read_string_options } from "../globals.mts"
import type { StatsType } from "../globals.mts"
import { __dirname } from "../data_locations.mts"
import { HasProperty, escapeHTML } from "../utils.mts"
import type { ValidatorServices } from "../services.mts"

const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), read_string_options).toString());

const tabulate = function (res: express.Response, group: string, stats: StatsType) {
	res.write(`<section class="panel stats"><h2>${group}</h2>`);
	if (Object.keys(stats).length === 0) res.write(`<p class="hint">No statistics</p>`);
	else {
		res.write(`<div class="scroll"><table><thead><tr><th scope="col">Item</th><th scope="col">Value</th></tr></thead><tbody>`);
		Object.getOwnPropertyNames(stats).forEach((key) => res.write(`<tr><td>${escapeHTML(key)}</td><td>${escapeHTML(stats[key])}</td></tr>`));
		res.write("</tbody></table></div>");
	}
	res.write("</section>");
};

const tabularize = function (res: express.Response, groupname: string, values: string[]) {
	res.write(`<section class="panel stats"><h2>${escapeHTML(groupname)}</h2>`);
	if (values.length == 0) res.write(`<p class="hint">No values</p>`);
	else {
		res.write(`<div class="scroll"><table>`);
		let maxLen = 0;
		values.forEach((value) => {
			if (value.length > maxLen) maxLen = value.length;
		});
		let firstRow = true;
		for (let i = 0; i < values.length; i++) {
			if (i % (maxLen > 4 ? 10 : 20) == 0) {
				res.write(`${firstRow ? "" : "</tr>"}<tr>`);
				firstRow = false;
			}
			res.write(`<td>${escapeHTML(values[i])}</td>`);
		}
		res.write(`${firstRow ? "" : "</tr>"}</table></div>`);
	}
	res.write("</section>");
};

/**
 * the /stats and /langs pages
 *
 * @param {ValidatorServices} services  the checkers and service list registry, whose statistics are shown
 * @returns {express.Router} the router
 */
export function infoRouter(services: ValidatorServices): express.Router {
	const router = express.Router();
	const { slcheck, plcheck, cgcheck, slrcheck, csr } = services;

	router.get("/stats", (req: express.Request, res: express.Response) => {
		res.setHeader("Content-Type", "text/html");
		res.write(PAGE_TOP("Validator Stats", req.secure));
		tabulate(res, "System", {
			arch: os.arch(),
			endianness: os.endianness(),
			host: os.hostname(),
			os: os.type(),
			numCPUs: os.cpus().length,
			machine: os.machine(),
			platform: os.platform(),
			release: os.release(),
			version: os.version(),
			node: process.version,
		});
		tabulate(res, "Application", {
			version: pkg?.version ? pkg.version : "unknown",
		});
		const InactiveFeatureStats = { active: "false" };
		tabulate(res, "CSR", csr ? csr.stats() : InactiveFeatureStats);
		tabulate(res, "SL", slcheck ? slcheck.stats() : InactiveFeatureStats);
		tabulate(res, "PL", plcheck ? plcheck.stats() : InactiveFeatureStats);
		tabulate(res, "SLR", slrcheck ? slrcheck.stats() : InactiveFeatureStats);
		tabulate(res, "CG", cgcheck ? cgcheck.stats() : InactiveFeatureStats);
		res.write(PAGE_BOTTOM);
		res.status(200).end();
	});

	router.get("/langs", (req: express.Request, res: express.Response) => {
		res.setHeader("Content-Type", "text/html");
		res.write(PAGE_TOP("Languages", req.secure));

		let langs: Record<string, string[]> = { empty: [] };
		if (slcheck) langs = slcheck.langs(true) as Record<string, string[]>;

		if (HasProperty(langs, "empty")) res.write(`<p class="hint">No statistics</p>`);
		else {
			Object.getOwnPropertyNames(langs).forEach((key) => tabularize(res, key, langs[key] as string[]));
		}
		res.write(PAGE_BOTTOM);
		res.status(200).end();
	});
	return router;
}
