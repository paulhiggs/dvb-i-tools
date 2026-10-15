/**
 * express-extensions.d.ts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 */

export {}

declare module "express-session" {
	interface SessionData {
		data : {
			mode?: string
			entry?: string
			url?: string
			cgmode?: string
			lastUrl?: string

			forGermany?: boolean
			traverse?: boolean
		}
	}
}


declare module "express" {

	export interface Request {
		parseErr? : string[]

		diags?: {
			countErrors?: number
			countWarnings?: number
			countInforms?: number
		}
	}

	export interface Response {
		parseErr?: string
		varyOn? : Set<string>
	}
}

