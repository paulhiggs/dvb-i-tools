/**
 * fetch_error_handler.js
 * 
 * Throw a nice error is there is a problem fetching the information
 *
 * @param {*} response
 * @returns
 */
export function handleErrors(response) {
	if (response && !response.ok) throw Error(`fetch() returned (${response.status}) "${response.statusText}"`);
	return response;
}
