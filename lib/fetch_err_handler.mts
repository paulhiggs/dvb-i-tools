/**
 * fetch_err_handler.mts
 *
 */

/**
 * Throw a nice error is there is a problem fetching the information
 *
 * @param {Response} response
 * @returns
 */
export default function handleErrors(response : Response) {
	if (response && !response.ok) throw Error(`fetch() returned (${response.status}) "${response.statusText}"`);
	return response;
}
