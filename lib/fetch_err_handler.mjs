/**
 * fetch_err_handler.mjs
 *
 * Throw a nice error is there is a problem fetching the information
 *
 * @param {*} response
 * @returns
 */
export default function handleErrors(response) {
	if (response && !response.ok) throw Error(`fetch() returned (${response.status}) "${response.statusText}"`);
	return response;
}
