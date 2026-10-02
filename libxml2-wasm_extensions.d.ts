/**
 * libxml2-wasm-extensions.d.ts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Additional functions to help libxml2-wasm (https://jameslan.github.io/libxml2-wasm/v0.5/) align
 * with the formerly used libxmljs2 (https://github.com/marudor/libxmljs2)
 */

//import "libxml2-wasm";

//declare module "libxml2-wasm" {
/* 
    interface XmlElement {
        documentNamespace(): string;
    }
*/
//} 
export {}

import { 
	XmlAttribute as libXmlAttribute, 
	XmlElement as libXmlElement, 
	XmlDocument as libXmlDocument } from "libxml2-wasm"

declare global {

	export declare class XmlAttribute extends libXmlAttribute {
	}

	export declare class XmlElement extends libXmlElement {

		attrAnyNs(name: string) : XmlAttribute | null
		attrAnyNsValueOr(name: string, default_value?: string) : string | null
		getAnyNs(name: string, index?: number) : XmlElement | null

		hasChild(childName: string) : boolean
		hasChildren() : boolean

		forEachChildElement(func: (child: XmlElement) => void) : void
		forEachNamedChildElement(childName: string | string[], func: (child: XmlElement) => void) : void

		documentNamespace() : string

		countChildElements(childElementName: string) : number
	}

	export declare class XmlDocument extends libXmlDocument {
		hasChildren() : boolean
		forEachChildElement(func: (child: XmlElement) => void) : void
		forEachNamedChildElement(childName: string | string[], func: (child: XmlElement) => void) : void
	}

}




