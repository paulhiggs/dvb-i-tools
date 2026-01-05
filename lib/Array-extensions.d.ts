/**
 * Array-extensions.d.ts
 *
 */

import { XmlElement } from "libxml2-wasm";

type array_iterator_function = (e : XmlElement) => void;

interface Array<XmlElement> {
	forEachSubElement(callback : array_iterator_function, thisArg? : any) : void;
	forEachNamedSubElement(elementName : Array<string> | string, callback : array_iterator_function, thisArg? : any) : void;
}