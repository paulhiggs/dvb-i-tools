/**
 * globals.mjs
 *
 * Useful global values
 */

export const HTTPPort = {
	csr: 3000,
	all_in_one: 3030,
};

export const CORSmanual = "manual",
	CORSlibrary = "library",
	CORSnone = "none";
export const CORSoptions = [CORSmanual, CORSlibrary, CORSnone];

export const DRAFT = 0x01,
	OLD = 0x02,
	ETSI = 0x04,
	CURRENT = 0x08;
