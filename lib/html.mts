/**
 * html.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * An html`` tagged template that escapes what is interpolated into it, unless it is already HTML. Pages are built from it
 * (ui.mts), so a value from a document or a request cannot be written to a page without being escaped:
 *   html`<td>${value}</td>`   the value is escaped with escapeHTML()
 *   text(value)               the value shown as text, with HTMLize(): also escapes = and makes hyphens non-breaking, so
 *                             codes and messages are not broken across lines at a hyphen
 *   raw(markup)               markup the validator itself provides (the stylesheet, scripts, the --motd message); never use
 *                             it for a value from a document or a request
 * An interpolated array is joined, and undefined, null and false give nothing, so ${cond && html`...`} can be used
 */

import { escapeHTML } from "./utils.mts"

// initialise string formatting extensions
import {} from "./string-extensions.mts"

/**
 * a fragment of HTML. It is an object rather than a string, so html`` can tell it from text that is to be escaped
 */
export class HTML {
	readonly markup: string;
	constructor(markup: string) {
		this.markup = markup;
	}
	toString(): string {
		return this.markup;
	}
	get length(): number {
		return this.markup.length;
	}
}

// what a value interpolated into html`` contributes to the markup
const fragment = (value: unknown): string => {
	if (value instanceof HTML) return value.markup;
	if (Array.isArray(value)) return value.map(fragment).join("");
	if (value === undefined || value === null || value === false) return "";
	return escapeHTML(value);
};

/**
 * the tag of an HTML template: the interpolated values are escaped, unless they are HTML
 *
 * @param {TemplateStringsArray} strings  the markup of the template
 * @param {unknown[]}            values   the values interpolated
 * @returns {HTML} the markup
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): HTML {
	let markup = strings[0];
	for (let i = 0; i < values.length; i++) markup += fragment(values[i]) + strings[i + 1];
	return new HTML(markup);
}

/**
 * markup provided by the validator itself, used as it is
 *
 * @param {string} markup  the markup
 * @returns {HTML} the markup
 */
export const raw = (markup: string): HTML => new HTML(markup);

/**
 * a value shown as text with HTMLize(): escaped, and with non-breaking hyphens
 *
 * @param {string} value  the text
 * @returns {HTML} the markup
 */
export const text = (value: string | undefined | null): HTML => new HTML(value ? value.HTMLize() : "");

/**
 * join fragments with a separator
 *
 * @param {unknown[]} values     the fragments (escaped if they are not HTML)
 * @param {HTML}      separator  the markup between them
 * @returns {HTML} the markup
 */
export const join = (values: unknown[], separator: HTML): HTML => new HTML(values.map(fragment).join(separator.markup));
