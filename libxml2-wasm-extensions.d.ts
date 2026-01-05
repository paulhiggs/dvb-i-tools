/**
 * libxml2-wasm-extensions.d.ts
 *
 */

import { XmlAttribute, XmlElement as _XmlElement, XmlDocument as _XmlDocument } from "libxml2-wasm";

declare class XmlElement extends _XmlElement {
	attrAnyNs(name : string) : XmlAttribute | null;
	attrAnyNsValueOr(name : string, default_value : string) : string;
	attrAnyNsValueOrNull(name : string) : string | null;
	childNodes() : Array<XmlElement>;
	getAnyNs(_name : string, _index? : number) : XmlElement;
	hasChild(_childName : string) : boolean;
	documentNamespace() : string;
}

declare class XmlDocument extends _XmlDocument {
	childNodes() : Array<XmlElement>;
}

