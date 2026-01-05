/**
 * role_loader.mts
 *
 * load roles used in <CreditsItem> elements
 */

import chalk from "chalk";

import Role from "./role.mts";
import { DVBI_CreditsItemRoles, DVBIv2_CreditsItemRoles } from "./data_locations.mts";

export function LoadCredits(useURLs : boolean, async : boolean = true) : Role {
	console.log(chalk.yellow.underline("loading CreditsItem roles..."));
	const credits = new Role();
	credits.loadRoles(useURLs ? { urls: [DVBI_CreditsItemRoles.url, DVBIv2_CreditsItemRoles.url] } : { files: [DVBI_CreditsItemRoles.file, DVBIv2_CreditsItemRoles.file] }, async);
	return credits;
}
