/**
 * DVB_definitions.mjs
 * 
 * Some definitions from other (non DVB-I) specifications
 *  
 * references
 * (DVB-SI) ETSI EN 300 468 - https://www.etsi.org/deliver/etsi_en/300400_300499/300468/
 * (DVB-S) ETSI EN 300 421 - https://www.etsi.org/deliver/etsi_en/300400_300499/300421/
 * (DVB-S2) ETSI EN 303 307-1 - https://www.etsi.org/deliver/etsi_en/302300_302399/30230701/
 * (DVB-S2x) ETSI EN 303 307-2 - https://www.etsi.org/deliver/etsi_en/302300_302399/30230702/
 */
export const dvb = {
	a_termID: "termID",
	a_uri: "uri",

	e_ClassificationScheme: "ClassificationScheme",
	e_Term: "Term",
};

// ETSI EN 300 421 clause 4.5
const _S_RollOff = ["0.35"];  

// ETSI EN 300 421 table 3
const _S_FEC = ["1/2", "2/3", "3/4", "5/6", "7/8"]; 

// ETSI EN 300 421 clause 4.5
const _S_Modulation = ["QPSK"]; 


// ETSI EN 300 468 table 39
const _S2_RollOff = ["0.25", "0.20"].concat(_S_RollOff);

const _S2_FEC = _S_FEC;

const _S2_Modulation = ["8PSK"].concat(_S_Modulation);

const _S2X_RollOff = ["0.15", "0.10", "0.05"].concat(_S2_RollOff);

// ETSI EN 302 307-2 V1.4.1 table 1
const _S2X_FEC = ["1/3", "1/4", "2/5", "3/5", "4/5", "5/9", "7/9", "8/9", "8/15", "9/10", "9/20", "11/15", "11/20", "13/18", "13/45", "23/36", "25/36", "26/45", "28/45", "32/45", "77/90"].concat(_S_FEC);

// other FEC values found in ETSI EN 302 307-2 V1.4.1 table 1 but not included in A177r6
// 2/9, 1/5, 4/15, 11/45, 29/45, 31/45

const _S2X_Modulation = ["8PSK-L", "16APSK", "16APSK-L", "32APSK", "32APSK-L", "64APSK", "64APSK-L"].concat(_S2_Modulation);
// other modulation values found in ETSI EN 302 307-2 V1.4.1 table 1 but not included in A177r6
// 128APSK, 256APSK, 256APSK-L, BPSK, BPSK-S

export const sats = {
	MODULATION_S: "DVB-S",
	MODULATION_S2: "DVB-S2",
	MODULATION_S2X: "DVB-S2X",
	S_FEC: _S_FEC,
	S_RollOff: _S_RollOff,
	S_Modulation: _S_Modulation,
	S2_FEC: _S2_FEC,
	S2_RollOff: _S2_RollOff,
	S2_Modulation: _S2_Modulation,
	S2X_FEC: _S2X_FEC,
	S2X_RollOff: _S2X_RollOff,
	S2X_Modulation: _S2X_Modulation,
};
