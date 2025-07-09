import express from "express";
import { UploadedFile } from "express-fileupload";

export interface TypedRequestBody extends Express.Request {
		body : {
			doclocation? : string,
			XMLurl? : string,
			testtype? : string,
			requestType? : string,
		},
		files : {
			XMLfile : UploadedFile,
		},
		parseErr? : string,
		url : string,
}