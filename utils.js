/* jshint esversion: 6 */

/**
 * constructs an XPath based on the provided arguments
 *
 * @param {string} SCHEMA_PREFIX   Used when constructing Xpath queries
 * @param {string} elementName     The name of the element to be searched for
 * @param {int} index              The instance of the named element to be searched for (if specified)
 * @returns {string} the XPath selector
 */
 module.exports.xPath = (SCHEMA_PREFIX, elementName, index=null) => `${SCHEMA_PREFIX}:${elementName}${index?`[${index}]`:""}`;


/**
 * constructs an XPath based on the provided arguments
 * 
 * @param {string} SCHEMA_PREFIX Used when constructing Xpath queries
 * @param {array} elementNames the name of the element to be searched for
 * @returns {string} the XPath selector
 */
module.exports.xPathM = function (SCHEMA_PREFIX, elementNames) {
	let t="";
	elementNames.forEach(elementName => {
		if (t.length) { t+="/"; first=false;}
		t+=`${SCHEMA_PREFIX}:${elementName}`;
	});
	return t;
};


/* local */ function findInSet(values, value, caseSensitive) {
	let vlc=value.toLowerCase();
    if (typeof(values)=="string")
        return caseSensitive? values==value : values.toLowerCase()==vlc;

    if (typeof(values)=="object")
		return caseSensitive? values.includes(value) : (values.find(element => element.toLowerCase()==vlc) != undefined);

    return false;
}

/**
 * determines if a value is in a set of values 
 *
 * @param {String or Array} values The set of values to check existance in
 * @param {String} value The value to check for existance
 * @return {boolean} if value is in the set of values
 */
module.exports.isIn = (values, value, caseSensitive=true) =>  findInSet(values, value, caseSensitive);


/**
 * determines if a value is in a set of values using a case insensitive comparison
 *
 * @param {String or Array} values The set of values to check existance in
 * @param {String} value The value to check for existance
 * @return {boolean} if value is in the set of values
 */
module.exports.isIni = (values, value) => findInSet(values, value, false);


/**
 * replace ENTITY strings with a generic characterSet
 *
 * @param {string} str string containing HTML or XML entities (starts with & ends with ;)
 * @return {string} the string with entities replaced with a single character '*'
 */
module.exports.unEntity = (str) => str.replace(/(&.+;)/ig, "*");




// credit to https://gist.github.com/adriengibrat/e0b6d16cdd8c584392d8#file-parseduration-es5-js
module.exports.parseISOduration = function(duration) {
	var durationRegex = /^(-)?P(?:(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?|(\d+)W)$/;
	var parsed;
	if (duration) duration.replace(durationRegex, function (_, sign, year, month, day, hour, minute, second, week) {
		sign = sign ? -1 : 1;
		// parse number for each unit
		var units = [year, month, day, hour, minute, second, week].map(function (num) { return parseInt(num, 10) * sign || 0; });
		parsed = {year: units[0], month: units[1], week: units[6], day: units[2], hour: units[3], minute: units[4], second: units[5]};
	} );
	// no regexp match
	if (!parsed) { throw new Error('Invalid duration "' + duration + '"'); }
	/**
	 * Sum or substract parsed duration to date
	 *
	 * @param {Date} date: A valid date instance
	 * @throws {TypeError} When date is not valid
	 * @returns {Date} Date plus or minus duration, according duration sign
	 */
	parsed.add = function add (date) {
		if (Object.prototype.toString.call(date) !== '[object Date]' || isNaN(date.valueOf())) {
			throw new TypeError('Invalid date');
		}
		return new Date(Date.UTC(
			date.getUTCFullYear() + parsed.year,
			date.getUTCMonth() + parsed.month,
			date.getUTCDate() + parsed.day + parsed.week * 7,
			date.getUTCHours() + parsed.hour,
			date.getUTCMinutes() + parsed.minute,
			date.getUTCSeconds() + parsed.second,
			date.getUTCMilliseconds()
		));
	};

	return parsed;
};
