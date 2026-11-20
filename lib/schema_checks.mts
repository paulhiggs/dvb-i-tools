/**
 * schema_checks.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 */

import { XsdValidator, XmlDocument, XmlAttribute, XmlValidateError } from "libxml2-wasm"
import { xmlRegisterFsInputProviders } from "libxml2-wasm/lib/nodejs.mjs"
xmlRegisterFsInputProviders();

import formatXml from "xml-formatter"

import { elementize, datatypeIs } from "./utils.mts"

import { dvbi } from "./DVB-I_definitions.mts"
import { FATAL, APPLICATION, INFORMATION, WARNING, DEBUG } from "./error_list.mts"
import type { ReportedErrorType } from "./error_list.mts"
import ErrorList from "./error_list.mts"
import { StandardStatus } from "./globals.mts"
import { parameterCheck } from "./utils.mts"
import { keys } from "./common_errors.mts"


function isSchemaAttribute(attribute : XmlAttribute) {
	if (attribute.name == "schemaLocation") {
		const prefix = attribute.namespacePrefix;
		return (attribute.namespaces[prefix].includes("XMLSchema-instance"))
	}
	return false;
}

/**
 * check that the specified child elements are in the parent element
 *
 * @param {XmlElement} checkElement       the element whose attributes should be checked
 * @param {string[]}   requiredAttributes the element names permitted within the parent
 * @param {string[]}   optionalAttributes the element names permitted within the parent
 * @param {string[]}   definedAttributes  attributes that defined in the schema, whether requited, optional or profiled out
 * @param {ErrorList}  errs               errors found in validaton
 * @param {string}     errCode            error code to be used in reports,
 */
export function checkAttributes(checkElement: XmlElement, requiredAttributes: string[], optionalAttributes: string[], definedAttributes: string[], errs: ErrorList, errCode: string) {
	if (!parameterCheck("checkAttributes", checkElement, null, errs, "AT000")) return;
	if (!requiredAttributes) {
		errs.addError({ type: APPLICATION, code: "AT001", message: "checkAttributes() called with requiredAttributes==null" });
		return;
	}
	const qualifiedName = `${checkElement.parent ? `${checkElement.parent.name}.` : ""}${checkElement.name}`;

	requiredAttributes.forEach((attributeName) => {
		if (!checkElement.attrAnyNs(attributeName))
			errs.addError({ 
				code: `${errCode}-1`, 
				message: `${attributeName.attribute(`${qualifiedName}`)} is a required attribute`, 
				key: "missing attribute", 
				line: checkElement.line });
	});

	checkElement.attrs.forEach((attribute) => {
		if (!isSchemaAttribute(attribute) && !requiredAttributes.includes(attribute.name) && !optionalAttributes.includes(attribute.name) && !definedAttributes.includes(attribute.name))
			errs.addError({ 
				code: `${errCode}-2`, 
				message: `${attribute.name.attribute()} is not permitted in ${qualifiedName}`, 
				key: "unexpected attribute", 
				line: checkElement.line 
			});
	});

	definedAttributes.forEach((attribute) => {
		if (!requiredAttributes.includes(attribute) && !optionalAttributes.includes(attribute))
			if (checkElement.attrAnyNs(attribute))
				errs.addError({
					type: INFORMATION,
					code: `${errCode}-3`,
					message: `${attribute.attribute()} is profiled out of  ${checkElement.name.elementize()}`,
					key: "profiled out",
					line: checkElement.line,
				});
	});
}

export type ElementCardinalityType = {
	name?: string
	minOccurs?: number
	maxOccurs?: number
}

/**
 * check that the specified child elements are in the parent element
 *
 * @param {XMLElement} parentElement         the element whose children should be checked
 * @param {ElementCardinalityType[]}      childElements         the names of elements and their cardinality
 * @param {string[]}      definedChildElements  the names of all child elements of parentElement that are defined in the schema, including
 *                                           those which are profiled out of DVB-I
 * @param {boolean}    allowOtherElements    flag indicating if other elements, i.e. those defined in the another are permitted
 * @param {ErrorList}  errs                  errors found in validaton
 * @param {string}     errCode               error code to be used for any error found
 * @returns {boolean} true if no errors are found (all mandatory elements are present and no extra elements are specified)
 *
 * NOTE: elements are described as an object containing "name", "minOccurs", "maxOccurs".
 *   Default values for minOccurs and maxOccurs are 1
 */
export function checkTopElementsAndCardinality(parentElement: XmlElement, childElements: ElementCardinalityType[], definedChildElements: string[], allowOtherElements: boolean, errs: ErrorList, errCode: string): boolean {
	if (!parameterCheck("checkTopElementsAndCardinality", parentElement, null, errs, "TE000")) return false;

	const findElementIn = (elementList: ElementCardinalityType[], elementName: string) => elementList.find((element) => element.name == elementName) !== undefined;

	function getNamedChildElements(node: XmlElement, childElementName: string): XmlElement[] {
		const res: XmlElement[] = [];
		node?.forEachNamedChildElement(childElementName, (child) => {
			res.push(child);
		});
		return res;
	}

	let rv = true;
	const thisElem = elementize(`${parentElement.parent?.name}.${parentElement.name}`);
	// check that each of the specifid childElements exists
	childElements.forEach((child) => {
		if (child.name) {
			const min = child.minOccurs != undefined ? child.minOccurs : 1;
			const max = child.maxOccurs != undefined ? child.maxOccurs : 1;
			const namedChildren = getNamedChildElements(parentElement, child.name),
				count = namedChildren.length;

			if (count == 0 && min != 0) {
				errs.addError({
					code: `${errCode}-1`,
					line: parentElement.line,
					message: `Mandatory element ${child.name.elementize()} not specified in ${thisElem}`,
					key: keys.k_MissingElement,
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
		}
	});

	// check that no additional child elements existance if the "Other Child Elements are OK" flag is not set
	if (parentElement.hasChildren()) {
		// create a set of child elements that are in the schema but not in DVB-I
		const excludedChildren: string[] = [];
		definedChildElements.forEach((child) => {
			if (!findElementIn(childElements, child)) excludedChildren.push(child);
		});

		parentElement.forEachChildElement((child) => {
			const childName = child.name;
			if (!findElementIn(childElements, childName)) {
				if (excludedChildren.includes(childName))
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
 * validate a XML document gainst the specified schema (included schemas must be in the same directory)
 *
 * @param {XmlDocument} XML          the XML document to check
 * @param {XmlDocument} XSD          the schema
 * @param {string}      XSDfilename  location of the schema in @XSd to serve as the root for relative paths
 * @param {ErrorList}   errs         array to record any errors
 * @param {string}      errCode      the error code to report with each error
 */
export function SchemaCheck(XML: XmlDocument, XSD: XmlDocument, XSDfilename: string, errs: ErrorList, errCode: string) {
	const validator = getValidator(XSD, XSDfilename, errs);
	if (!validator) {
		errs.addError({ code: "LS001", type: DEBUG, message: `validator not loaded. XSDfilename=${XSDfilename.quote()}` });
		return;
	}
	try {
		validator.validate(XML);
	} catch (err) {
		const details = validationDetails(err);
		if (details) {
			const lines = formatXml(XML.toString(), { collapseContent: true, lineSeparator: "\n", strictMode: true }).split("\n");
			details.forEach((ve) => {
				errs.addError({ code: errCode, message: ve.message, fragment: lines[ve.line - 1], line: ve.line, key: keys.k_XSDValidation });
			});
		} else
			// the document could not be validated, so it must not be reported as schema valid
			errs.addError({
				type: APPLICATION,
				code: "LS002",
				message: `schema validation against ${XSDfilename.quote()} failed: ${errorMessage(err)}`,
				key: keys.k_XSDValidation,
			});
	}
}

/**
 * compiled schema validators, one for each loaded schema document.
 * Schemas are loaded once at startup and are not disposed, so the validators are kept for the life of the process.
 * If a schema document is ever disposed or replaced, its validator must be disposed and removed from here.
 */
const validators = new WeakMap<XmlDocument, XsdValidator>();

function getValidator(XSD: XmlDocument, XSDfilename: string, errs: ErrorList): XsdValidator | undefined {
	const cached = validators.get(XSD);
	if (cached) return cached;
	try {
		const validator = XsdValidator.fromDoc(XSD);
		validators.set(XSD, validator);
		return validator;
	} catch (err) {
		const details = validationDetails(err);
		if (details)
			details.forEach((e) => {
				errs.addError({ code: "LS000", type: DEBUG, message: `${JSON.stringify(e)}, url: ${XSDfilename}` });
			});
		else errs.addError({ code: "LS000", type: DEBUG, message: `${errorMessage(err)}, url: ${XSDfilename}` });
	}
	return undefined;
}

/**
 * @returns the validation details from an XmlValidateError, or undefined if the error is of another kind or has no details
 */
function validationDetails(err: unknown) {
	return err instanceof XmlValidateError && Array.isArray(err.details) && err.details.length > 0 ? err.details : undefined;
}

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * report if the schema version being used is not 'formal'
 *
 * @param {XmlDocument} document             the XML document
 * @param {enum}        publication_state    the publication status of the schema
 * @param {ErrorList}   errs                 array to record any errors
 * @param {string}      errCode              the error code to report with each error
 */
export function SchemaVersionCheck(document: XmlDocument, publication_state: number, errs: ErrorList, errCode: string) {
	const ServiceList = (document.root as XmlElement)?.getAnyNs(dvbi.e_ServiceList);
	if (publication_state & StandardStatus.OLD) {
		const err1: ReportedErrorType = { code: `${errCode}a`, message: "schema version is out of date", key: "schema version" };
		if (ServiceList) err1.line = ServiceList.line;
		errs.addError(err1);
	}
	if (publication_state & StandardStatus.DRAFT) {
		const err2: ReportedErrorType  = { type: WARNING, code: `${errCode}b`, message: "schema is in draft state", key: "schema version" };
		if (ServiceList) err2.line = ServiceList.line;
		errs.addError(err2);
	}
}

/**
 * load the XML data
 * @param {string} document  XMLdocument
 * @param {ErrorList} errs  error handler for any loading errors
 * @param {string} errCode  error code prefix to use for any loading issues
 * @returns {XMLDocument}  an XML document structure
 */
export function SchemaLoad(document: string, errs: ErrorList, errCode: string): XmlDocument | null {
	// eslint-disable-next-line no-useless-assignment
	let tmp = null, prettyXML = null;
	try {
		// this parse of the raw document is only used to report errors with their original positions,
		// the document returned is parsed from the formatted text below
		XmlDocument.fromString(document).dispose();
	} catch (err) {
		if (err.details && datatypeIs(err.details, "array"))
			err.details.forEach((e) =>
				errs.addError({ type: FATAL, code: `${errCode}-1`, message: `Raw XML parsing failed: ${e.message} at char ${e.col}`, line: e.line, key: keys.k_MalformedXML })
			);
		else errs.addError({ type: FATAL, code: `${errCode}-2`, message: `Raw XML parsing failed: ${err.message}`, key: keys.k_MalformedXML });
	}
	try {
		prettyXML = formatXml(document.replace(/(\n\t)/gm, "\n"), { collapseContent: true, lineSeparator: "\n" });
	} catch (err) {
		errs.addError({ type: FATAL, code: `${errCode}-10`, message: `XML format failed: ${err.cause}`, key: keys.k_MalformedXML });
		return null;
	}
	try {
		tmp = XmlDocument.fromString(prettyXML);
	} catch (err) {
		errs.addError({ type: FATAL, code: `${errCode}-11`, message: `XML parsing failed: ${err.message}`, key: keys.k_MalformedXML });
		errs.loadDocument(prettyXML);
		return null;
	}
	if (!tmp || !tmp.root) {
		tmp?.dispose();
		errs.addError({ type: FATAL, code: `${errCode}-12`, message: "XML document is empty", key: keys.k_MalformedXML });
		errs.loadDocument(prettyXML);
		return null;
	}

	errs.loadDocument(prettyXML);
	return tmp;
}