/**
 * fetch_err_handler.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 */

/**
 * Throw a nice error is there is a problem fetching the information
 *
 * @param {*} response
 * @returns
 */
export default function handleErrors(response) {
	if (response && !response.ok) throw Error(`fetch() returned (${response.status}) ${response.statusText.quote()}`);
	return response;
}
