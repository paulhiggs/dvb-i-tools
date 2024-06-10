export const dvb = {
	a_termID: "termID",
	a_uri: "uri",

	e_Term: "Term",
};

const _S_FEC = ["1/2", "3/5", "2/3", "3/4", "4/5", "5/6", "8/9", "9/10"];
const _S_Modulation = ["QPSK"];

const _S2_RollOff = ["0.35", "0.25", "0.20"];
const _S2_Modulation = ["8PSK"].concat(_S_Modulation);

const _S2X_RollOff = ["0.15", "0.10", "0.05"].concat(_S2_RollOff);
const _S2X_FEC = ["7/8", "1/4", "1/3", "2/5", "13/45", "9/20", "11/20", "23/36", "13/18", "5/9", "26/45", "28/45", "7/9", "77/90", "8/15", "32/45", "11/15"].concat(_S_FEC);
const _S2X_Modulation = ["8PSK-L", "16APSK", "16APSK-L", "32APSK", "32APSK-L", "64APSK", "64APSK-L"].concat(_S2_Modulation);

export const sats = {
	MODULATION_S: "DVB-S",
	MODULATION_S2: "DVB-S2",
	MODULATION_S2X: "DVB-S2X",
	S_FEC: _S_FEC,
	S_RollOff: null,		// rolloff is not permitted in satellite_delivery_system_descriptor of EN 300 468
	S_Modulation: _S_Modulation,
	S2_FEC: _S_FEC,
	S2_RollOff: _S2_RollOff,
	S2_Modulation: _S2_Modulation,
	S2X_FEC: _S2X_FEC,
	S2X_RollOff: _S2X_RollOff,
	S2X_Modulation: _S2X_Modulation,
};
