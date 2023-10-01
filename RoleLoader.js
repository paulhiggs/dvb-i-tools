/**
 * RoleLoader.js
 *
 */

import "colors";

import Role from "./Role.js";
import { DVBI_CreditsItemRoles, DVBIv2_CreditsItemRoles } from "./data-locations.js";

export function LoadCredits(useURLs) {
	console.log("loading CreditsItem roles...".yellow.underline);
	let credits = new Role();
	credits.loadRoles(useURLs ? { urls: [DVBI_CreditsItemRoles.url, DVBIv2_CreditsItemRoles.url] } : { files: [DVBI_CreditsItemRoles.file, DVBIv2_CreditsItemRoles.file] });
	return credits;
}
