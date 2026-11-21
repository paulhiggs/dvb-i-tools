/**
 * express-extensions.d.ts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * What a handler records in res.locals for the request log (request_logging.mts and csr.ts)
 */

export {}

declare global {
	namespace Express {
		interface Locals {
			// why the document could not be obtained or validated, or why the request is not valid
			parseErr?: string[]

			// the number of findings of the validation
			diags?: {
				countErrors: number
				countWarnings: number
				countInforms: number
			}

			// the request headers the response varies on (set with res.vary() too)
			vary?: string[]
		}
	}
}
