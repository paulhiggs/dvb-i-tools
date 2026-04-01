/**
 * extension_check.mjs
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Check a Extension elements in DVB-I Service Lists and Service List Registry responses
 */

import { keys } from "./common_errors.mjs";
import { dvbi } from "./DVB-I_definitions.mjs";
import { WARNING } from "./error_list.mjs";
import { parameterCheck } from "./utils.mjs";
import { hbbtv } from "./HbbTV_definitions.mjs";

export const EXTENSION_LOCATION_SERVICE_LIST_REGISTRY = 101,
	EXTENSION_LOCATION_SERVICE_ELEMENT = 201,
	EXTENSION_LOCATION_DASH_INSTANCE = 202,
	EXTENSION_LOCATION_OTHER_DELIVERY = 203;

export function CheckExtension(extn, extLoc, errs, errCode) {
	if (!parameterCheck("CheckExtension", extn, null, errs, "CE000")) return;

	// extension type is checked in schema validation

	const extn_extensionName = extn.attrAnyNsValueOr(dvbi.a_extensionName, null);
	if (extn_extensionName) {
		const where = (extension, location) => `${extension} extension only premitted in ${location}`;
		switch (extn_extensionName) {
			case "DVB-HB":
				if (extLoc != EXTENSION_LOCATION_SERVICE_LIST_REGISTRY)
					errs.addError({
						code: `${errCode}-1`,
						message: where("DVB-HB", "Service List Registry"),
						fragment: extn,
						key: keys.k_Extensibility,
					});
				break;
			case hbbtv.serviceIdentifierTriplet_extension:
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
					message: `extension ${extn_extensionName.quote()} is not known to this tool`,
				});
		}
	}
}
