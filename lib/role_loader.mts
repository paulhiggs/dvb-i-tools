/**
 * role_loader.mts
 *
 * load roles used in <CreditsItem> elements
 * 
 */
import chalk from "chalk";

import { DVBI_CreditsItemRoles, DVBIv2_CreditsItemRoles } from "./data_locations.mts";
import Role from "./role.mts";

export function LoadCredits(useURLs : boolean, async : boolean = true) {
	console.log(chalk.yellow.underline("loading CreditsItem roles..."));
	const credits = new Role();
	credits.loadRoles(useURLs ? { urls: [DVBI_CreditsItemRoles.url, DVBIv2_CreditsItemRoles.url] } : { files: [DVBI_CreditsItemRoles.file, DVBIv2_CreditsItemRoles.file] }, async);
	return credits;
}
