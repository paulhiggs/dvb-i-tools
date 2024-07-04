/**
 * RoleLoader.js
 *
 */

import chalk from "chalk";

import Role from "./Role.js";
import { DVBI_CreditsItemRoles, DVBIv2_CreditsItemRoles } from "./data-locations.js";

export function LoadCredits(useURLs) {
	console.log(chalk.yellow.underline("loading CreditsItem roles..."));
	let credits = new Role();
	credits.loadRoles(useURLs ? { urls: [DVBI_CreditsItemRoles.url, DVBIv2_CreditsItemRoles.url] } : { files: [DVBI_CreditsItemRoles.file, DVBIv2_CreditsItemRoles.file] });
	return credits;
}
