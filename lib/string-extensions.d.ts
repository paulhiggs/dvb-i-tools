/**
 * string-extensions.d.ts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 */

export {}

declare global {

	export interface String {
			quote() : string;
			elementize() : string;
			HTMLize() : string;
			attribute(elemName?: string) : string;
	}

}
