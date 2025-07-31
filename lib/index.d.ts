//import express from "express";
import  fileUpload from "express-fileupload";
//import {GCrequests} from "./globals.mts"

/*
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
*/

declare module "node:http" {
	export interface IncomingMessage {
		query? : {
			url? : string;
		}
		diags : {
			countErrors : number,
			countWarnings : number,
			countInforms : number,
		};
		protocol?: string | null | undefined;
		parseErr?:  string | null | undefined;
		body? : {
			testtype? : string;
			doclocation? : string;
			requestType? : string;
			XMLurl? : string;
		};
		files? : {
			XMLfile : fileUpload.UploadedFile;
		}
	}
}

declare global {
	namespace Express {
		export interface Request {
			files? : fileUpload.FileArray | null | undefined;
			url? : string;
			body? : {
				XMLurl? : string;
			};
			parseErr : string | undefined;
		}
	}
}

declare namespace Express {
	export interface Request {
		files? : fileUpload.FileArray | null | undefined;
		url? : string;
		body? : {
			XMLurl? : string;
		};
		parseErr : string | undefined;
	}
}
export type FormSessionData = {
	lastUrl? : string;
	mode? : string;
	linktype? : string;
	entry? : string;
	cgmode? : string;
	url? : string;
};


declare module "express-session" {
	export interface SessionData {
		data : FormSessionData;
	}
}

declare module "express" {
	export interface Request {
		files? : fileUpload.FileArray | null | undefined;
		parseErr : string | undefined;
		url? : string;
	}
}
