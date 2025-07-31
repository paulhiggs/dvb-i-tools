/**
 * globals.mts
 *
 * Useful global values
 * 
 */


export const HTTPPort = {
	csr: 3000,
	all_in_one: 3030,
};

export const CORSmanual : string = "manual",
	CORSlibrary : string = "library",
	CORSnone : string = "none";
export const CORSoptions : Array<string> = [CORSmanual, CORSlibrary, CORSnone];

export enum SpecificationState {
	DRAFT = 0x01,
	OLD = 0x02,
	ETSI = 0x04,
	CURRENT = 0x08,
}

export enum CGrequests {
	SCHEDULE_TIME = "Time",
	SCHEDULE_NOWNEXT = "NowNext",
	SCHEDULE_WINDOW = "Window",
	PROGRAM = "ProgInfo",
	MORE_EPISODES = "MoreEpisodes",
	BS_CATEGORIES = "bsCategories",
	BS_LISTS = "bsLists",
	BS_CONTENTS = "bsContents",
}