
import { XmlAttribute as libXmlAttribute, XmlElement as libXmlElement, XmlDocument as libXmlDocument } from "libxml2-wasm";

export {}

declare global {

	export interface String {
			quote() : string;
			elementize() : string;
			HTMLize() : string;
			attribute(elemName?: string) : string;
	}

}

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

declare global {

	export interface SessionData {
		data? : {
			mode?: string
		}

	}
	export interface Request {
		parseErr? : string
	}

	export interface Response {
		parseErr?: string
		varyon? : string[]
	}
}

