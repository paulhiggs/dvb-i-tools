/**
 * js-utils.mjs
 *
 * some useful utility functions that may be used by more than one class
 */
import { statSync, readFileSync } from "fs";
import chalk from "chalk";

/**
 * Synchronously reads a file (if it exists)
 *
 * @param {String} filename  The name of the file to read
 * @returns {Buffer} the buffer containing the data from the file, or null if there is a problem reading
 */
export function readmyfile(filename, options = null) {
	try {
		const stats = statSync(filename);
		if (stats.isFile()) return readFileSync(filename, options);
	} catch (err) {
		console.log(chalk.magenta(`${err.code}, ${err.path}`));
	}
	return null;
}


// credit to https://gist.github.com/adriengibrat/e0b6d16cdd8c584392d8#file-parseduration-es5-js
export function parseISOduration(duration) {
	const durationRegex = /^(-)?P(?:(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?|(\d+)W)$/;
	let parsed = null;
	if (duration)
		duration.replace(durationRegex, function (_, sign, year, month, day, hour, minute, second, week) {
			sign = sign ? -1 : 1;
			// parse number for each unit
			var units = [year, month, day, hour, minute, second, week].map(function (num) {
				return parseInt(num, 10) * sign || 0;
			});
			parsed = { year: units[0], month: units[1], week: units[6], day: units[2], hour: units[3], minute: units[4], second: units[5] };
		});
	// no regexp match
	if (!parsed) {
		throw new Error('Invalid duration "' + duration + '"');
	}
	/**
	 * Sum or substract parsed duration to date
	 *
	 * @param {Date} date A valid date instance
	 * @throws {TypeError} When date is not valid
	 * @returns {Date} Date plus or minus duration, according duration sign
	 */
	parsed.add = function add(date) {
		if (Object.prototype.toString.call(date) !== "[object Date]" || isNaN(date.valueOf())) {
			throw new TypeError("Invalid date");
		}
		return new Date(
			Date.UTC(
				date.getUTCFullYear() + parsed.year,
				date.getUTCMonth() + parsed.month,
				date.getUTCDate() + parsed.day + parsed.week * 7,
				date.getUTCHours() + parsed.hour,
				date.getUTCMinutes() + parsed.minute,
				date.getUTCSeconds() + parsed.second,
				date.getUTCMilliseconds()
			)
		);
	};

	return parsed;
}

