/**
 * libxml2-wasm-extensions.d.ts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Type declarations for the additional functions (implemented in libxml2-wasm-extensions.mts) that help
 * libxml2-wasm (https://jameslan.github.io/libxml2-wasm/v0.5/) align with the formerly used libxmljs2 (https://github.com/marudor/libxmljs2)
 */

export {}

import type {
	XmlAttribute as libXmlAttribute,
	XmlElement as libXmlElement,
	XmlDocument as libXmlDocument } from "libxml2-wasm"

// add the helper methods to the libxml2-wasm classes, so they are available wherever the classes are imported
declare module "libxml2-wasm" {

	interface XmlElement {

		attrAnyNs(name: string) : libXmlAttribute | null
		attrAnyNsValueOr(name: string, default_value?: string) : string | null
		getAnyNs(name: string, index?: number) : libXmlElement | null

		hasChild(childName: string) : boolean
		hasChildren() : boolean

		forEachChildElement(func: (child: libXmlElement) => void) : void
		forEachNamedChildElement(childName: string | string[], func: (child: libXmlElement) => void) : void

		documentNamespace() : string

		countChildElements(childElementName: string) : number
	}

	interface XmlDocument {
		hasChildren() : boolean
		forEachChildElement(func: (child: libXmlElement) => void) : void
		forEachNamedChildElement(childName: string | string[], func: (child: libXmlElement) => void) : void
	}
}

// files that use these names without importing them get the same (augmented) libxml2-wasm types
declare global {
	type XmlAttribute = libXmlAttribute
	type XmlElement = libXmlElement
	type XmlDocument = libXmlDocument
}
