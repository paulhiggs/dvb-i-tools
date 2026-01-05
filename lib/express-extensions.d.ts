/**
 * express-extensions.d.ts
 */

import {Request} from 'express'

declare global {
	namespace Express {
		export interface Request {
			parseErr? : string;
		}

		export interface Response {
			varyOn? : Array<string>; 
	 	}
	}
}


declare module 'express-session' {
	interface SessionData {
		lastUrl : string;
		mode : string;
		entry: string;
		cgmode? : string;

	}
}

