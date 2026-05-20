/**
 * playlist_check.mjs
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Check a play list
 */


import ErrorList, { APPLICATION } from "./error_list.mjs";
import { dvbi} from "./DVB-I_definitions.mjs";
import { InvalidURL, keys } from "./common_errors.mjs";
import { SchemaCheck, SchemaVersionCheck, SchemaLoad } from "./schema_checks.mjs";
import { GetSchema, SL_SchemaVersion } from "./sl_data_versions.mjs";
import writeOut from "./logger.mjs";
import { isHTTPURL } from "./pattern_checks.mjs";


export default class PlaylistCheck {
	#numRequests;

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	constructor(useURLs, opts, async = true) {
		this.#numRequests = 0;
	}

	stats() {
		let res = {};
		res.numRequests = this.#numRequests;
		return res;
	}



	/*private*/ #doSchemaVerification(Playlist, errs, errCode, report_schema_version = true) {
		const x = GetSchema(Playlist.root.namespaceUri);
		if (x && x.schema) {
			SchemaCheck(Playlist, x.schema, x.filename, errs, `${errCode}:${SL_SchemaVersion(Playlist.root.namespaceUri)}`);
			if (report_schema_version) SchemaVersionCheck(Playlist, x.status, errs, `${errCode}:`);
			return true;
		}
		return false;
	}

	/**
	 * validate the service list and record any errors
	 *
	 * @param {String}    PLtext      The play list text to be validated
	 * @param {ErrorList} errs        Errors found in validaton
	 * @param {Object}    options
	 *                      log_prefix            the first part of the logging location (or null if no logging)
	 *                      report_schema_version report the state of the schema in the error/warning list
	 */
	/*public*/ doValidatePlaylist(PLtext, errs, options = {}) {
		this.#numRequests++;
		if (!PLtext) {
			errs.addError({
				type: APPLICATION,
				code: "PL000",
				message: "doValidatePlaylist() called with PLtext==null",
			});
			return;
		}

		if (!Object.prototype.hasOwnProperty.call(options, "log_prefix")) options.log_prefix = null;
		if (!Object.prototype.hasOwnProperty.call(options, "report_schema_version")) options.report_schema_version = true;

		const PL = SchemaLoad(PLtext, errs, "SL001");
		if (!PL) return;
		writeOut(errs, options.log_prefix, false);

		if (PL.root.name !== dvbi.e_Playlist) {
			errs.addError({
				code: "PL004",
				message: `Root element is not ${dvbi.e_Playlist.elementize()}`,
				line: PL.root.line,
				key: keys.k_XSDValidation,
				clause: "A177 clause 5.7.1",
				description: `the root element of the play list XML instance document must be ${dvbi.e_Playlist.elementize()}`,
			});
			return;
		}

		if (!PL.root.namespaceUri) {
			errs.addError({
				code: "PL003",
				message: `namespace is not provided for ${dvbi.e_Playlist.elementize()}`,
				line: PL.root.line,
				key: keys.k_XSDValidation,
				clause: "A177 clause 5.4.1",
				description: `the namespace for ${dvbi.e_Playlist.elementize()} is required to ensure appropriate syntax and semantic checking`,
			});
			return;
		}

		const ns = PL.root.namespaceUri;

		if (!this.#doSchemaVerification(PL, errs, "PL005", options.report_schema_version)) {
			errs.addError({
				code: "PL010",
				message: `Unsupported namespace ${ns.quote()}`,
				key: keys.k_XSDValidation,
			});
			return;
		}
		const Playlist = PL.root;

		// <Playlist><PlaylistEntry>
		Playlist.forEachNamedChildElement(dvbi.e_PlaylistEntry, (PlaylistEntry) => {
			if (!isHTTPURL(PlaylistEntry.content))
				errs.addError(
					InvalidURL(PlaylistEntry.content, PlaylistEntry, dvbi.e_PlaylistEntry.elementize(), "PL012")
				);
		});

		PL.dispose();
	}


	/**
	 * validate the service list and record any errors
	 *
	 * @param {String} SLtext  The service list text to be validated
	 * @returns {Class} Errors found in validaton
	 */
	/*public*/ validatePlaylist(PLtext) {
		const errs = new ErrorList();
		this.doValidatePlaylist(PLtext, errs);

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		return new Promise((resolve, reject) => {
			resolve(errs);
		});
	}

}