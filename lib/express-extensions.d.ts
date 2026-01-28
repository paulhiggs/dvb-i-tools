/**
 * express-extensions.d.ts
 */

import {Request} from 'express'

declare global {
	namespace Express {
		export interface Request {
			parseErr? : string;

			diags : {
				countErrors : number;
				countWarnings : number;
				countInforms : number;

			}
		}

		export interface Response {
			varyOn? : Array<string>; 
	 	}
	}
}


declare module 'express-session' {

	interface SessionData {

		data : {
			lastUrl : string;
			mode : string;
			entry: string;
			cgmode? : string;
			url? : string;
		};

	}
}

