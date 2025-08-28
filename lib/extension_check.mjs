/**
 * extension_check.mjs
 *
 * Check a Extension elements in DVB-I Service Lists and Service List Registry responses
 */

import { keys } from "./common_errors.mjs";
import { dvbi } from "./DVB-I_definitions.mjs";
import { APPLICATION, WARNING } from "./error_list.mjs";

export const EXTENSION_LOCATION_SERVICE_LIST_REGISTRY = 101,
	EXTENSION_LOCATION_SERVICE_ELEMENT = 201,
	EXTENSION_LOCATION_DASH_INSTANCE = 202,
	EXTENSION_LOCATION_OTHER_DELIVERY = 203;

export function CheckExtension(extn, extLoc, errs, errCode) {
	if (!extn) {
		errs.addError({
			type: APPLICATION,
			code: "CE000",
			message: "CheckExtension() called with extn=null",
		});
		return;
	}
	// extension type is checked in schema validation

	if (extn.attrAnyNs(dvbi.a_extensionName)) {
		const where = (extension, location) => `${extension} extension only premitted in ${location}`;
		switch (extn.attrAnyNs(dvbi.a_extensionName).value) {
			case "DVB-HB":
				if (extLoc != EXTENSION_LOCATION_SERVICE_LIST_REGISTRY)
					errs.addError({
						code: `${errCode}-1`,
						message: where("DVB-HB", "Service List Registry"),
						fragment: extn,
						key: keys.k_Extensibility,
					});
				break;
			case "urn:hbbtv:dvbi:service:serviceIdentifierTriplet":
				if (extLoc != EXTENSION_LOCATION_SERVICE_ELEMENT)
					errs.addError({
						code: `${errCode}-2`,
						message: where("HbbTV", "Service List"),
						fragment: extn,
						key: keys.k_Extensibility,
					});
				break;
			case "vnd.apple.mpegurl":
				if (extLoc != EXTENSION_LOCATION_OTHER_DELIVERY)
					errs.addError({
						code: `${errCode}-3`,
						message: where("HLS", "Service List"),
						fragment: extn,
						key: keys.k_Extensibility,
					});
				break;
			default:
				errs.addError({
					type: WARNING,
					code: `${errCode}-100`,
					key: "unknown extension",
					fragment: extn,
					message: `extension "${extn.attrAnyNs(dvbi.a_extensionName).value}" is not known to this tool`,
				});
		}
	}
}
