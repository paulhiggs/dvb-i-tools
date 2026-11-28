/**
 * info.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Information pages: /stats (the system, the application, the running configuration and the request counts of each
 * checker) and /langs (the languages known to the service list checker). The pages are drawn by ui.mts
 */

import os from "node:os"
import process from "process"
import { readFileSync } from "fs"
import { join } from "path"
import express from "express"

import { drawLanguages, drawStats } from "../ui.mts"
import { read_string_options } from "../globals.mts"
import { __dirname } from "../data_locations.mts"
import type { ValidatorServices } from "../services.mts"
import type { ValidatorConfig } from "../config.mts"
import { ALL_IN_ONE_CONFIG, ALL_IN_ONE_SETTINGS, runningConfiguration } from "../config_file.mts"

const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), read_string_options).toString());

/**
 * the /stats and /langs pages
 *
 * @param {ValidatorConfig}   config    the configuration, shown on /stats (issue #147)
 * @param {ValidatorServices} services  the checkers and service list registry, whose statistics are shown
 * @returns {express.Router} the router
 */
export function infoRouter(config: ValidatorConfig, services: ValidatorServices): express.Router {
	const configuration = runningConfiguration(ALL_IN_ONE_SETTINGS, config.settings, config.configFiles, ALL_IN_ONE_CONFIG);
	const router = express.Router();
	const { slcheck, plcheck, cgcheck, slrcheck, aitcheck, csr } = services;

	router.get("/stats", async (req: express.Request, res: express.Response) => {
		const InactiveFeatureStats = { active: "false" };
		await drawStats(req, res, [
			["System", {
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
			}],
			["Application", { version: pkg?.version ? pkg.version : "unknown" }],
			["Configuration", configuration],
			["CSR", csr ? csr.stats() : InactiveFeatureStats],
			["SL", slcheck ? slcheck.stats() : InactiveFeatureStats],
			["PL", plcheck ? plcheck.stats() : InactiveFeatureStats],
			["SLR", slrcheck ? slrcheck.stats() : InactiveFeatureStats],
			["CG", cgcheck ? cgcheck.stats() : InactiveFeatureStats],
			["AIT", aitcheck ? aitcheck.stats() : InactiveFeatureStats],
		]);
		res.status(200).end();
	});

	router.get("/langs", async (req: express.Request, res: express.Response) => {
		const langs = slcheck ? (slcheck.langs(true) as Record<string, string[]>) : { empty: [] };
		await drawLanguages(req, res, langs);
		res.status(200).end();
	});
	return router;
}
