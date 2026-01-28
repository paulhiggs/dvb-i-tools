/**
 * libxml2-wasm-extensions.d.ts
 *
 */


import { XmlAttribute } from "libxml2-wasm";
import { XmlElement as _XmlElement, XmlDocument as _XmlDocument } from "libxml2-wasm";


type array_iterator_function = (e : XmlElement) => void;

declare global {
	export class XmlElement extends _XmlElement {
		attrAnyNs(name : string) : XmlAttribute | null;
		attrAnyNsValueOr(name : string, default_value : string) : string;
		attrAnyNsValueOrNull(name : string) : string | null;
		childNodes(named ? : string) : XmlElement[];
		getAnyNs(_name : string, _index? : number) : XmlElement | null;
		hasChild(_childName : string) : boolean;
		documentNamespace() : string;
		forEachSubElement(callback : array_iterator_function, thisArg? : any) : void;
		forEachNamedSubElement(elementName : Array<string> | string, callback : array_iterator_function, thisArg? : any) : void;
		countChildren(named : string) : number;
	}

	export class XmlDocument extends _XmlDocument {
		childNodes() : Array<XmlElement>;
	}
}
