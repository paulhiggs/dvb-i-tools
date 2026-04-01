/**
 * role_loader.mjs
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * load roles used in <CreditsItem> elements
 */

import chalk from "chalk";

import Role from "./role.mjs";
import { DVBI_CreditsItemRoles, DVBIv2_CreditsItemRoles } from "./data_locations.mjs";

export function LoadCredits(useURLs, async = true) {
	console.log(chalk.yellow.underline("loading CreditsItem roles..."));
	const credits = new Role();
	credits.loadRoles(useURLs ? { urls: [DVBI_CreditsItemRoles.url, DVBIv2_CreditsItemRoles.url] } : { files: [DVBI_CreditsItemRoles.file, DVBIv2_CreditsItemRoles.file] }, async);
	return credits;
}
