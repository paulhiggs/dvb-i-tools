/**
 * StringSet.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * A case insensitive set of strings
 */

export class CaseInsensitiveSet extends Set<string> {
   constructor(values?: string[]) {
     super(Array.from(values || [], it => it.toLowerCase()))
   }

   add(str: string) {
     return super.add(str.toLowerCase())
   }

   has(str: string): boolean {
     return super.has(str.toLowerCase())
   }

   delete(str: string) {
     return super.delete(str.toLowerCase())
   }

	 DuplicateValue(str: string) : boolean {
		const existed = this.has(str)
		this.add(str)
		return existed
	 }
}