/**
 * globals.mts
 *
 * Useful global values
 */

type app_ports = {
	csr : number;
	all_in_one : number;
}

export const HTTPPort : app_ports = {
	csr: 3000,
	all_in_one: 3030,
};

export const CORSmanual : string = "manual",
	CORSlibrary : string = "library",
	CORSnone : string = "none";
export const CORSoptions : Array<string> = [CORSmanual, CORSlibrary, CORSnone];

export const DRAFT : number = 0x01,
	OLD : number = 0x02,
	ETSI : number = 0x04,
	CURRENT : number = 0x08;
