/**
 * role_loader.js
 *
 * load roles used in <CreditsItem> elements
 */

import chalk from "chalk";

import Role from "./role.js";
import { DVBI_CreditsItemRoles, DVBIv2_CreditsItemRoles } from "./data_locations.js";

export function LoadCredits(useURLs) {
	console.log(chalk.yellow.underline("loading CreditsItem roles..."));
	let credits = new Role();
	credits.loadRoles(useURLs ? { urls: [DVBI_CreditsItemRoles.url, DVBIv2_CreditsItemRoles.url] } : { files: [DVBI_CreditsItemRoles.file, DVBIv2_CreditsItemRoles.file] });
	return credits;
}
