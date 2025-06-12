/**
 * schema_checks.js
 */
import { XmlDocument, XsdValidator } from "libxml2-wasm";
import { xmlRegisterFsInputProviders } from "libxml2-wasm/lib/nodejs.mjs";
xmlRegisterFsInputProviders();

import format from "xml-formatter";

import { elementize, datatypeIs } from "./phlib/phlib.js";

import { dvbi } from "./DVB-I_definitions.js";
import { APPLICATION, INFORMATION, WARNING, DEBUG } from "./error_list.js";
import { OLD, DRAFT } from "./globals.js";
import { isIn, xPath } from "./utils.js";
import { keys } from "./common_errors.js";

/**
 * check that the specified child elements are in the parent element
 *
 * @param {XmlElement} checkElement       the element whose attributes should be checked
 * @param {Array}      requiredAttributes the element names permitted within the parent
 * @param {Array}      optionalAttributes the element names permitted within the parent
 * @param {Array}      definedAttributes  attributes that defined in the schema, whether requited, optional or profiled out
 * @param {ErrorList}  errs               errors found in validaton
 * @param {string}     errCode            error code to be used in reports,
 */
export function checkAttributes(checkElement, requiredAttributes, optionalAttributes, definedAttributes, errs, errCode) {
	if (!checkElement || !requiredAttributes) {
		errs.addError({ type: APPLICATION, code: "AT000", message: "checkAttributes() called with checkElement==null or requiredAttributes==null" });
		return;
	}
	let p = "";
	try {
		p = `${checkElement.parent.childName}.${checkElement.name}`;
	} catch (e) {
		p = checkElement.name;
	}

	requiredAttributes.forEach((attributeName) => {
		if (!checkElement.attrAnyNs(attributeName))
			errs.addError({ code: `${errCode}-1`, message: `${attributeName.attribute(`${p}`)} is a required attribute`, key: "missing attribute", line: checkElement.line });
	});

	checkElement.attrs.forEach((attr) => {
		if (!isIn(requiredAttributes, attr.name) && !isIn(optionalAttributes, attr.name) && !isIn(definedAttributes, attr.name))
			errs.addError({ code: `${errCode}-2`, message: `${attr.name.attribute()} is not permitted in ${p}`, key: "unexpected attribute", line: checkElement.line });
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
 * @param {XMLElement} parentElement         the element whose children should be checked
 * @param {Array}      childElements		      the names of elements and their cardinality
 * @param {Array}      definedChildElements  the names of all child elements of parentElement that are defined in the schema, including
 *                                           those which are profiled out of DVB-I
 * @param {boolean}    allowOtherElements    flag indicating if other elements, i.e. those defined in the another are permitted
 * @param {ErrorList}  errs                  errors found in validaton
 * @param {string}     errCode               error code to be used for any error found
 * @returns {boolean} true if no errors are found (all mandatory elements are present and no extra elements are specified)
 *
 * NOTE: elements are described as an object containing "name", "minOccurs", "maxOccurs".
 *   Default values for minOccurs and maxOccurs are 1
 */
export function checkTopElementsAndCardinality(parentElement, childElements, definedChildElements, allowOtherElements, errs, errCode) {
	var findElementIn = (elementList, elementName) => (datatypeIs(elementList, "array") ? elementList.find((element) => element.name == elementName) : false);

	function getNamedChildElements(node, childElementName) {
		let res = [];
		node?.childNodes().forEachNamedSubElement(childElementName, elem => {
			res.push(elem);
		});
		return res;
	}
	if (!parentElement) {
		errs.addError({ type: APPLICATION, code: "TE000", message: "checkTopElementsAndCardinality() called with a 'null' element to check" });
		return false;
	}
	let rv = true;
	const thisElem = elementize(`${parentElement.parent.name}.${parentElement.name}`);
	// check that each of the specifid childElements exists
	childElements.forEach((elem) => {
		const min = Object.prototype.hasOwnProperty.call(elem, "minOccurs") ? elem.minOccurs : 1;
		const max = Object.prototype.hasOwnProperty.call(elem, "maxOccurs") ? elem.maxOccurs : 1;
		const namedChildren = getNamedChildElements(parentElement, elem.name),
			count = namedChildren.length;

		if (count == 0 && min != 0) {
			errs.addError({
				code: `${errCode}-1`,
				line: parentElement.line,
				message: `Mandatory element ${elem.name.elementize()} not specified in ${thisElem}`,
				key: "missing element",
			});
			rv = false;
		} else {
			if (count < min || count > max) {
				namedChildren.forEach((child) =>
					errs.addError({
						code: `${errCode}-2`,
						line: child.line,
						message: `Cardinality of ${elem.name.elementize()} in ${thisElem} is not in the range ${min}..${max == Infinity ? "unbounded" : max}`,
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
		let excludedChildren = [];
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
 * @param {XmlElement} containingElement    the element to check
 * @param {string}     childElementName     the name of the child element to look for
 * @returns {boolean} true if the element contains the named child element(s) otherwise false
 */
export function hasChild(containingElement, childElementName) {
	let child = containingElement?.firstChild;
	while (child) {
		if (child?.name?.endsWith(childElementName)) return true;
		child = child.next;
	}
	return false;
}

/**
 * validate a XML document gainst the specified schema (included schemas must be in the same directory)
 *
 * @param {XmlDocument} XML         the XML document to check
 * @param {XmlDocument} XSD         the schema
 * @param {ErrorList}   errs        array to record any errors
 * @param {string}      errCode     the error code to report with each error
 */
export function SchemaCheck(XML, XSD, errs, errCode) {
	let validator = null;
	try {
		validator = XsdValidator.fromDoc(XSD);
	} catch (err) {
		const x = err.details;
		x.forEach((e) => {
			errs.addError({ code: "LS000", type: DEBUG, message: JSON.stringify(e) });
		});
	}

	try {
		validator.validate(XML);
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
 * @param {object}      props                Metadata of the XML document
 * @param {XmlDocument} document             the XML document
 * @param {enum}        publication_state    the publication status of the schema
 * @param {ErrorList}   errs                 array to record any errors
 * @param {string}      errCode              the error code to report with each error
 */
export function SchemaVersionCheck(props, document, publication_state, errs, errCode) {
	let ServiceList = document.get(xPath(props.prefix, dvbi.e_ServiceList), props.schema);
	if (publication_state & OLD) {
		let err1 = { code: `${errCode}a`, message: "schema version is out of date", key: "schema version" };
		if (ServiceList) err1.line = ServiceList.line;
		errs.addError(err1);
	}
	if (publication_state & DRAFT) {
		let err2 = { type: WARNING, code: `${errCode}b`, message: "schema is in draft state", key: "schema version" };
		if (ServiceList) err2.line = ServiceList.line;
		errs.addError(err2);
	}
}

/**
 * load the XML data
 * @param {XmlDocument} document 	  XMLdocument
 * @param {ErrorList}   errs        error handler for any loading errors
 * @param {string}      errcode     error code prefix to use for any loading issues
 * @returns {XMLDocument}  an XML document structure
 */
export function SchemaLoad(document, errs, errcode) {
	const _key = "malformed XML";
	let tmp = null,
		prettyXML = null;

	try {
		tmp = XmlDocument.fromString(document);
	}
	catch (err) {
		errs.addError({ code: `${errcode}-1`, message: `Raw XML parsing failed: ${err.message}`, key: _key });
	}
	try {
		prettyXML = format(document.replace(/(\n\t)/gm, "\n"), { collapseContent: true, lineSeparator: "\n" });
	} catch (err) {
		errs.addError({ code: `${errcode}-2`, message: `XML format failed: ${err.cause}`, key: _key });
		return null;
	}
	try {
		tmp = XmlDocument.fromString(prettyXML);
	} catch (err) {
		errs.addError({ code: `${errcode}-11`, message: `XML parsing failed: ${err.message}`, key: _key });
		errs.loadDocument(prettyXML);
		return null;
	}
	if (!tmp || !tmp.root) {
		errs.addError({ code: `${errcode}-12`, message: "XML document is empty", key: _key });
		errs.loadDocument(prettyXML);
		return null;
	}

	errs.loadDocument(prettyXML);
	return tmp;
}
