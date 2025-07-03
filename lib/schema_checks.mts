/**
 * schema_checks.mts
 */
import { XmlDocument, XmlElement, XsdValidator } from "libxml2-wasm";
import { xmlRegisterFsInputProviders } from "libxml2-wasm/lib/nodejs.mjs";
xmlRegisterFsInputProviders();

import format from "xml-formatter";

import { elementize, datatypeIs } from "../phlib/phlib.ts";

import {  Libxml2_wasm_init } from "../libxml2-wasm-extensions.mts";
import type { DocumentProperties } from "../libxml2-wasm-extensions.mts";
Libxml2_wasm_init();

import { Array_extension_init } from "./Array-extensions.mts";
Array_extension_init();

import { dvbi } from "./DVB-I_definitions.mts";
import { APPLICATION, INFORMATION, WARNING, DEBUG } from "./error_list.mts";
import ErrorList from "./error_list.mts";
import type { ErrorArgs } from "./error_list.mts";
import { SpecificationState } from "./globals.mts";
import { isIn, xPath } from "./utils.mts";
import { keys } from "./common_errors.mts";

export type ElementCardinality = {
	name : string;
	minOccurs? : number;
	maxOccurs? : number;
};

/**
 * check that the specified child elements are in the parent element
 *
 * @param {XmlElement} checkElement           the element whose attributes should be checked
 * @param {Array<string>} requiredAttributes  the attribute names required within the parent
 * @param {Array<string>} optionalAttributes  the attribute names permitted within the parent
 * @param {Array<string>} definedAttributes   attributes that are defined in the schema, whether required, optional or profiled out
 * @param {ErrorList} errs                    errors found in validation
 * @param {string} errCode                    error code to be used in reports
 */
export function checkAttributes(checkElement : XmlElement, requiredAttributes : Array<string>, optionalAttributes : Array<string>, definedAttributes : Array<string>, errs : ErrorList, errCode : string) {
	if (!checkElement || !requiredAttributes) {
		errs.addError({ type: APPLICATION, code: "AT000", message: "checkAttributes() called with checkElement==null or requiredAttributes==null" });
		return;
	}
	const p = `${checkElement.parent ? `${checkElement.parent.name}.`:""}${checkElement.name}`;

	requiredAttributes.forEach((attributeName) => {
		if (!checkElement.attrAnyNs(attributeName))
			errs.addError({ code: `${errCode}-1`, message: `${attributeName.attribute(`${p}`)} is a required attribute`, key: "missing attribute", line: checkElement.line });
	});

	checkElement.attrs.forEach((attribute) => {
		if (!isIn(requiredAttributes, attribute.name) && !isIn(optionalAttributes, attribute.name) && !isIn(definedAttributes, attribute.name))
			errs.addError({ code: `${errCode}-2`, message: `${attribute.name.attribute()} is not permitted in ${p}`, key: "unexpected attribute", line: checkElement.line });
	});

	definedAttributes.forEach((attribute) => {
		if (!isIn(requiredAttributes, attribute) && !isIn(optionalAttributes, attribute))
			if (checkElement.attrAnyNs(attribute))
				errs.addError({
					type: INFORMATION,
					code: `${errCode}-3`,
					message: `${attribute.attribute()} is profiled out of  ${checkElement.name.elementize()}`,
					key: "unused attribute",
					line: checkElement.line,
				});
	});
}

/**
 * check that the specified child elements are in the parent element
 *
 * @param {XMLElement} parentElement                 the element whose children should be checked
 * @param {Array<ElementCardinality>} childElements  the names of elements and their cardinality
 * @param {Array<string>} definedChildElements       the names of all child elements of parentElement that are defined in the schema, including
 *                                                   those which are profiled out of DVB-I
 * @param {boolean} allowOtherElements               flag indicating if other elements, i.e. those defined in the another are permitted
 * @param {ErrorList} errs                           errors found in validaton
 * @param {string} errCode                           error code to be used for any error found
 * @returns {boolean} true if no errors are found (all mandatory elements are present and no extra elements are specified)
 *
 * NOTE: elements are described as an object containing "name", "minOccurs", "maxOccurs".
 *   Default values for minOccurs and maxOccurs are 1
 */
export function checkTopElementsAndCardinality(parentElement : XmlElement, childElements : Array<ElementCardinality>, definedChildElements : Array<string>, allowOtherElements : boolean, errs : ErrorList, errCode : string) {
	let findElementIn = (elementList : Array<ElementCardinality>, elementName : string) => (datatypeIs(elementList, "array") ? elementList.find((element) => element.name == elementName) : false);

	function getNamedChildElements(node : XmlElement, childElementName : string) : Array<XmlElement> {
		let res : Array<XmlElement> = [];
		node?.childNodes().forEachNamedSubElement(childElementName, (child : XmlElement) => {
			res.push(child);
		});
		return res;
	}

	if (!parentElement) {
		errs.addError({ type: APPLICATION, code: "TE000", message: "checkTopElementsAndCardinality() called with a 'null' element to check" });
		return false;
	}
	let rv : boolean = true;
	const thisElem = elementize(`${parentElement.parent ? `${parentElement.parent.name}.` : ""}${parentElement.name}`);
	// check that each of the specifid childElements exists
	childElements.forEach((child : ElementCardinality) => {
		const min : number = child.minOccurs ? child.minOccurs : 1;
		const max : number = child.maxOccurs ? child.maxOccurs : 1;
		const namedChildren = getNamedChildElements(parentElement, child.name),
			count = namedChildren.length;

		if (count == 0 && min != 0) {
			errs.addError({
				code: `${errCode}-1`,
				line: parentElement.line,
				message: `Mandatory element ${child.name.elementize()} not specified in ${thisElem}`,
				key: "missing element",
			});
			rv = false;
		} else {
			if (count < min || count > max) {
				namedChildren.forEach((child) =>
					errs.addError({
						code: `${errCode}-2`,
						line: child.line,
						message: `Cardinality of ${child.name.elementize()} in ${thisElem} is not in the range ${min}..${max == Infinity ? "unbounded" : max}`,
						key: "wrong element count",
					})
				);
				rv = false;
			}
		}
	});

	// check that no additional child elements existance if the "Other Child Elements are OK" flag is not set
	if (parentElement.childNodes()) {
		// create a set of child elements that are in the schema but not in DVB-I
		let excludedChildren : Array<string> = [];
		definedChildElements.forEach((child) => {
			if (!findElementIn(childElements, child)) excludedChildren.push(child);
		});

		parentElement.childNodes().forEachSubElement((child) => {
			const childName = child.name;
			if (!findElementIn(childElements, childName)) {
				if (isIn(excludedChildren, childName))
					errs.addError({
						type: INFORMATION,
						code: `${errCode}-10`,
						message: `Element ${childName.elementize()} in ${thisElem} is not included in DVB-I`,
						line: child.line,
						key: "profiled out",
					});
				else if (!allowOtherElements) {
					errs.addError({ code: `${errCode}-11`, line: child.line, message: `Element ${childName.elementize()} is not permitted in ${thisElem}`, key: "element not allowed" });
					rv = false;
				}
			}
		});
	}
	return rv;
}

/**
 * check if the element contains the named child element
 *
 * @param {XmlElement} containingElement   the element to check
 * @param {string} childElementName        the name of the child element to look for
 * @returns {boolean} true if the element contains the named child element(s) otherwise false
 */
export function hasChild(containingElement : XmlElement, childElementName : string) : boolean {
	const children = containingElement.childNodes();
	return (children.find((child) => child.name == childElementName) != undefined)
}

/**
 * validate a XML document gainst the specified schema (included schemas must be in the same directory)
 *
 * @param {XmlDocument} XML the XML document to check
 * @param {XmlDocument} XSD the schema
 * @param {ErrorList} errs  array to record any errors
 * @param {string} errCode  the error code to report with each error
 */
export function SchemaCheck(XML : XmlDocument, XSD : XmlDocument, errs : ErrorList, errCode : string) {
	let validator : XsdValidator | undefined = undefined;
	try {
		validator = XsdValidator.fromDoc(XSD);
	} 
	catch (err) {
		const x = err.details;
		x.forEach((e) => {
			errs.addError({ code: "LS000", type: DEBUG, message: JSON.stringify(e) });
		});
	}

	try {
		if (validator) validator.validate(XML);
	} catch (err) {
		//console.log(err.message)
		if (err.details) {
			const lines = format(XML.toString(), { collapseContent: true, lineSeparator: "\n", strictMode: true }).split("\n");
			err.details.forEach((ve) => {
				errs.addError({ code: errCode, message: ve.message, fragment: lines[ve.line], line: ve.line, key: keys.k_XSDValidation });
			});
		}
	}
}

/**
 * report if the schema version being used is not 'formal'
 *
 * @param {DocumentProperties} props  Metadata of the XML document
 * @param {XmlDocument} document      the XML document
 * @param {enum} publication_state    the publication status of the schema
 * @param {ErrorList} errs            array to record any errors
 * @param {string} errCode            the error code to report with each error
 */
export function SchemaVersionCheck(props : DocumentProperties, document : XmlDocument, publication_state : SpecificationState, errs : ErrorList, errCode : string) {
	let ServiceList = document.get(xPath(props.prefix, dvbi.e_ServiceList), props.schema);
	if (publication_state & SpecificationState.OLD) {
		let err1 : ErrorArgs = { code: `${errCode}a`, message: "schema version is out of date", key: "schema version" };
		if (ServiceList) err1.line = ServiceList.line;
		errs.addError(err1);
	}
	if (publication_state & SpecificationState.DRAFT) {
		let err2 : ErrorArgs= { type: WARNING, code: `${errCode}b`, message: "schema is in draft state", key: "schema version" };
		if (ServiceList) err2.line = ServiceList.line;
		errs.addError(err2);
	}
}

/**
 * load the XML data
 * @param {string} document  XMLdocument
 * @param {ErrorList} errs   error handler for any loading errors
 * @param {string} errcode   error code prefix to use for any loading issues
 * @returns {XMLDocument} an XML document structure
 */
export function SchemaLoad(document : string, errs : ErrorList, errcode : string) : XmlDocument | undefined {
	const _key = "malformed XML";
	let tmp : XmlDocument | undefined = undefined,
		prettyXML = "";

	try {
		tmp = XmlDocument.fromString(document);
	} catch (err) {
		errs.addError({ code: `${errcode}-1`, message: `Raw XML parsing failed: ${err.message}`, key: _key });
	}
	try {
		prettyXML = format(document.replace(/(\n\t)/gm, "\n"), { collapseContent: true, lineSeparator: "\n" });
	} catch (err) {
		errs.addError({ code: `${errcode}-2`, message: `XML format failed: ${err.cause}`, key: _key });
		return undefined;
	}
	try {
		tmp = XmlDocument.fromString(prettyXML);
	} catch (err) {
		errs.addError({ code: `${errcode}-11`, message: `XML parsing failed: ${err.message}`, key: _key });
		errs.loadDocument(prettyXML);
		return undefined;
	}
	if (!tmp || !tmp.root) {
		errs.addError({ code: `${errcode}-12`, message: "XML document is empty", key: _key });
		errs.loadDocument(prettyXML);
		return undefined;
	}

	errs.loadDocument(prettyXML);
	return tmp;
}
