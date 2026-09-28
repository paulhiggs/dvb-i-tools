/**
 * fetch_err_handler.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 */

/**
 * Throw a nice error if there is a problem fetching the information
 *
 * @param {Response} response
 * @returns
 */
export default function handleErrors(response: Response) {
	if (response && !response.ok) throw Error(`fetch() returned (${response.status}) ${response.statusText.quote()}`);
	return response;
}
