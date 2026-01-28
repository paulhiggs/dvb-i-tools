/**
 * common.d.ts
 * 
 * Some commonly used datatypes
 */

import IANALanguages from "./IANA_languages.mts";
import ISOcountries from "./ISO_countries.mts"
import ClassificationScheme from "./classification_scheme.mts";

export type shared_validation_options = {
	languages? : IANALanguages;
	countries? : ISOcountries;
	genres? : ClassificationScheme;
	videofmts? : ClassificationScheme;
	audiofmts? : ClassificationScheme;
	audiopres? : ClassificationScheme;	
	credits? : ClassificationScheme;	
	ratings? : ClassificationScheme;	
	accessibilities? : ClassificationScheme;
	audiopurps? : ClassificationScheme;
	stcarriage? : ClassificationScheme;
	stcodings? : ClassificationScheme;
	stpurposes? : ClassificationScheme;
}
