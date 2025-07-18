import express from "express";
import { UploadedFile } from "express-fileupload";

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

export interface TypedRequestBody extends Express.Request {
		body : {
			doclocation? : string,
			XMLurl? : string,
			testtype? : string,
			requestType? : CGrequests,
		},
		diags : {
			countErrors : number;
			countWarnings : number;
			countInforms : number;
		},
		files : {
			XMLfile : UploadedFile,
		},
		parseErr? : string,
		url : string,
}