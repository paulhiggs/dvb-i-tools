/**
 * string_extensions.d.ts	
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * declaration of extensions of the String class
 */


//function elementise(str : string ) : string;
//function quote(str : string, using? : string ) : string;
//function attribute(str : string, elementName? : string ) : string;
//function HTMLize(str : string ) : string;	
export {  };

declare global {
    interface String {
      quote(using? : string) : string;
      elementize() : string;
			attribute(elementName? : string) : string;
			HTMLize() : string;
    }
	}