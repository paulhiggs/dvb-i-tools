/**
 * Array-extensions.mjs
 *
 * Additional useful functions when processing arrays
 */

import { XmlElement } from "libxml2-wasm";

if (!Array.prototype.forEachSubElement) {
	// based on the polyfill at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
	/*
	 * alternate to Array.prototype.forEach that only returns XML tree nodes that are elements
	 */

	/**
	 * Iterate over the array invoking the callback in the array item is an XmlElement
	 *
	 * @param {function} callback     function to be invoked - same approach as Array.forEach()
	 */
	Array.prototype.forEachSubElement = function (callback, thisArg) {
		if (this == null) {
			throw new TypeError("Array.prototype.forEachSubElement called on null or undefined");
		}

		var T, k;
		// 1. Let O be the result of calling toObject() passing the
		// |this| value as the argument.
		var O = Object(this);

		// 2. Let lenValue be the result of calling the Get() internal
		// method of O with the argument "length".
		// 3. Let len be toUint32(lenValue).
		var len = O.length >>> 0;

		// 4. If isCallable(callback) is false, throw a TypeError exception.
		// See: https://es5.github.com/#x9.11
		if (typeof callback !== "function") {
			throw new TypeError(`${callback} is not a function`);
		}

		// 5. If thisArg was supplied, let T be thisArg; else let
		// T be undefined.
		if (arguments.length > 1) {
			T = thisArg;
		}

		// 6. Let k be 0
		k = 0;

		// 7. Repeat, while k < len
		while (k < len) {
			var kValue;

			// a. Let Pk be ToString(k).
			//    This is implicit for LHS operands of the in operator
			// b. Let kPresent be the result of calling the HasProperty
			//    internal method of O with argument Pk.
			//    This step can be combined with c
			// c. If kPresent is true, then
			if (k in O) {
				// i. Let kValue be the result of calling the Get internal
				// method of O with argument Pk.
				kValue = O[k];

				// ii. Call the Call internal method of callback with T as
				// the this value and argument list containing kValue, k, and O.
				if (kValue instanceof XmlElement) callback.call(T, kValue, k, O);
			}
			// d. Increase k by 1.
			k++;
		}
		// 8. return undefined
	};
}

/**
 * Iterate over the array invoking the callback if the array item is an XmlElement with the specified name
 *
 * @param {String or Array}   elementName  the name(s) of the element that we want the callback to be invoked for
 * @param {function} callback     function to be invoked - same approach as Array.forEach()
 */
if (!Array.prototype.forEachNamedSubElement) {
	Array.prototype.forEachNamedSubElement = function (elementName, callback, thisArg) {
		if (this == null) {
			throw new TypeError("Array.prototype.forEachNamedSubElement called on null or undefined");
		}

		var T, k;
		// 1. Let O be the result of calling toObject() passing the
		// |this| value as the argument.
		var O = Object(this);

		// 2. Let lenValue be the result of calling the Get() internal
		// method of O with the argument "length".
		// 3. Let len be toUint32(lenValue).
		var len = O.length >>> 0;

		// 4. If isCallable(callback) is false, throw a TypeError exception.
		// See: https://es5.github.com/#x9.11
		if (typeof callback !== "function") {
			throw new TypeError(`${callback} is not a function`);
		}

		// 5. If thisArg was supplied, let T be thisArg; else let
		// T be undefined.
		if (arguments.length > 1) {
			T = thisArg;
		}

		// 6. Let k be 0
		k = 0;

		// 7. Repeat, while k < len
		while (k < len) {
			var kValue;

			// a. Let Pk be ToString(k).
			//    This is implicit for LHS operands of the in operator
			// b. Let kPresent be the result of calling the HasProperty
			//    internal method of O with argument Pk.
			//    This step can be combined with c
			// c. If kPresent is true, then
			if (k in O) {
				// i. Let kValue be the result of calling the Get internal
				// method of O with argument Pk.
				kValue = O[k];

				// ii. Call the Call internal method of callback with T as
				// the this value and argument list containing kValue, k, and O.
				if (kValue instanceof XmlElement && (Array.isArray(elementName) ? elementName.includes[kValue.name] : kValue.name == elementName)) callback.call(T, kValue, k, O);
			}
			// d. Increase k by 1.
			k++;
		}
		// 8. return undefined
	};
}

export let Array_extension_init = () => {};
