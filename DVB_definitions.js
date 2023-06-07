export const dvb = {
	a_termID: "termID",
	a_uri: "uri",

	e_Term: "Term",
};

export const sats = {
	MODULATION_S: "DVB-S",
	MODULATION_S2: "DVB-S2",
	MODULATION_S2X: "DVB-S2X",
	S_FEC: ["1/2", "3/5", "2/3", "3/4", "4/5", "5/6", "8/9", "9/10"],
	S_RollOff: ["0.35"],
	S_Modulation: ["QPSK"],
};

sats.S2X_FEC = ["7/8", "1/4", "1/3", "2/5", "13/45", "9/20", "11/20", "23/36", "13/18", "5/9", "26/45", "28/45", "7/9", "77/90", "8/15", "32/45", "11/15"].concat(sats.S_FEC);

sats.S2_RollOff = ["0.25", "0.20"].concat(sats.S_RollOff);
sats.S2X_RollOff = ["0.15", "0.10", "0.05"].concat(sats.S2_RollOff);

sats.S2_Modulation = ["8PSK"].concat(sats.S_Modulation);
sats.S2X_Modulation = ["8PSK-L", "16APSK", "16APSK-L", "32APSK", "32APSK-L", "64APSK", "64APSK-L"].concat(sats.S2_Modulation);
