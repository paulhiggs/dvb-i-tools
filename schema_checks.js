// schema_checks.js

import { parseXmlString } from "libxmljs2";
import format from "xml-formatter";

import { elementize } from "./phlib/phlib.js";
import { dvbi } from "./DVB-I_definitions.js";
import { APPLICATION, INFORMATION, WARNING } from "./ErrorList.js";
import { OLD, DRAFT } from "./sl-check.js";

import { isIn, xPath } from "./utils.js";
import { datatypeIs } from "./phlib/phlib.js";

/**
 * check that the specified child elements are in the parent element
 *
 * @param {Object} checkElement       the element whose attributes should be checked
 * @param {Array}  requiredAttributes the element names permitted within the parent
 * @param {Array}  optionalAttributes the element names permitted within the parent
 * @param {Array}  definedAttributes  attributes that defined in the schema, whether requited, optional or profiled out
 * @param {Class}  errs               errors found in validaton
 * @param {string} errCode            error code to be used in reports,
 */
export function checkAttributes(checkElement, requiredAttributes, optionalAttributes, definedAttributes, errs, errCode) {
	if (!checkElement || !requiredAttributes) {
		errs.addError({ type: APPLICATION, code: "AT000", message: "checkAttributes() called with checkElement==null or requiredAttributes==null" });
		return;
	}
	let p = "";
	try {
		p = `${checkElement.parent().name()}.${checkElement.name()}`;
	} catch (e) {
		p = checkElement.name();
	}

	requiredAttributes.forEach((attributeName) => {
		if (!checkElement.attr(attributeName))
			errs.addError({ code: `${errCode}-1`, message: `${attributeName.attribute(`${p}`)} is a required attribute`, key: "missing attribute", line: checkElement.line() });
	});

	checkElement.attrs().forEach((attr) => {
		if (!isIn(requiredAttributes, attr.name()) && !isIn(optionalAttributes, attr.name()) && !isIn(definedAttributes, attr.name()))
			errs.addError({ code: `${errCode}-2`, message: `${attr.name().attribute()} is not permitted in ${p}`, key: "unexpected attribute", line: checkElement.line() });
	});

	definedAttributes.forEach((attribute) => {
		if (!isIn(requiredAttributes, attribute) && !isIn(optionalAttributes, attribute))
			if (checkElement.attr(attribute))
				errs.addError({
					type: INFORMATION,
					code: `${errCode}-3`,
					message: `${attribute.attribute()} is profiled out of  ${checkElement.name().elementize()}`,
					key: "unused attribute",
					line: checkElement.line(),
				});
	});
}

/**
 * check that the specified child elements are in the parent element
 *
 * @param {XMLNode} parentElement         the element whose children should be checked
 * @param {Array}   childElements		      the names of elements and their cardinality
 * @param {Array}   definedChildElements  the names of all child elements of parentElement that are defined in the schema, including
 *                                        those which are profiled out of DVB-I
 * @param {boolean} allowOtherElements    flag indicating if other elements, i.e. those defined in the another are permitted
 * @param {Class}   errs                  errors found in validaton
 * @param {string}  errCode               error code to be used for any error found
 * @returns {boolean} true if no errors are found (all mandatory elements are present and no extra elements are specified)
 *
 * NOTE: elements are described as an object containing "name", "minOccurs", "maxOccurs".
 *   Default values for minOccurs and maxOccurs are 1
 */
export function checkTopElementsAndCardinality(parentElement, childElements, definedChildElements, allowOtherElements, errs, errCode) {
	var findElementIn = (elementList, elementName) => (datatypeIs(elementList, "array") ? elementList.find((element) => element.name == elementName) : false);

	function getNamedChildElements(node, childElementName) {
		let res = [],
			childElems = node ? node.childNodes() : null;
		if (childElems)
			childElems.forEachSubElement((elem) => {
				if (elem.name() == childElementName) res.push(elem);
			});
		return res;
	}
	if (!parentElement) {
		errs.addError({ type: APPLICATION, code: "TE000", message: "checkTopElementsAndCardinality() called with a 'null' element to check" });
		return false;
	}
	let rv = true,
		thisElem = elementize(`${parentElement.parent().name()}.${parentElement.name()}`);
	// check that each of the specifid childElements exists
	childElements.forEach((elem) => {
		let min = Object.prototype.hasOwnProperty.call(elem, "minOccurs") ? elem.minOccurs : 1;
		let max = Object.prototype.hasOwnProperty.call(elem, "maxOccurs") ? elem.maxOccurs : 1;
		let namedChildren = getNamedChildElements(parentElement, elem.name),
			count = namedChildren.length;

		if (count == 0 && min != 0) {
			errs.addError({ code: `${errCode}-1`, line: parentElement.line(), message: `Mandatory element ${elem.name.elementize()} not specified in ${thisElem}` });
			rv = false;
		} else {
			if (count < min || count > max) {
				namedChildren.forEach((child) =>
					errs.addError({
						code: `${errCode}-2`,
						line: child.line(),
						message: `Cardinality of ${elem.name.elementize()} in ${thisElem} is not in the range ${min}..${max == Infinity ? "unbounded" : max}`,
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
			let childName = child.name();
			if (!findElementIn(childElements, childName)) {
				if (isIn(excludedChildren, childName))
					errs.addError({ type: INFORMATION, code: `${errCode}-10`, message: `Element ${childName.elementize()} in ${thisElem} is not included in DVB-I`, line: child.line() });
				else if (!allowOtherElements) {
					errs.addError({ code: `${errCode}-11`, line: child.line(), message: `Element ${childName.elementize()} is not permitted in ${thisElem}` });
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
 * @param {Object} elem                 the element to check
 * @param {string} childElementName     the name of the child element to look for
 * @returns {boolean} true of the element contains the named child element(s) otherwise false
 */
export var hasChild = (elem, childElementName) => (elem ? elem.childNodes().find((el) => el.type() == "element" && el.name().endsWith(childElementName)) != undefined : false);

/**
 * validate a XML document gainst the specified schema (included schemas must be in the same directory)
 *
 * @param {Document} XML         the XML document to check
 * @param {Document} XSD         the schema
 * @param {object}   errs        array to record any errors
 * @param {string}   errCode     the error code to report with each error
 */
export function SchemaCheck(XML, XSD, errs, errCode) {
	if (!XML.validate(XSD)) {
		let prettyXML = format(XML.toString(), { collapseContent: true, lineSeparator: "\n" /*, strictMode: true */ });
		let lines = prettyXML.split("\n");
		XML.validationErrors.forEach((ve) => {
			let splt = ve.toString().split("\r");
			splt.forEach((err) => errs.addError({ code: errCode, message: err, fragment: lines[ve.line - 1], line: ve.line, key: "XSD validation" }));
		});
	}
}

/**
 * report if the schema version being used is not 'formal'
 *
 * @param {object}      props                Metadata of the XML document
 * @param {XMLdocument} document             the XML document
 * @param {enum}        publication_state    the publication status of the schema
 * @param {Class}       errs                 array to record any errors
 * @param {string}      errCode              the error code to report with each error
 */
export function SchemaVersionCheck(props, document, publication_state, errs, errCode) {
	let ServiceList = document.get(xPath(props.prefix, dvbi.e_ServiceList), props.schema);
	if (publication_state & OLD) {
		let err1 = { code: `${errCode}a`, message: "schema version is out of date", key: "schema version" };
		if (ServiceList) err1.line = ServiceList.line();
		errs.addError(err1);
	}
	if (publication_state & DRAFT) {
		let err2 = { type: WARNING, code: `${errCode}b`, message: "schema is in draft state", key: "schema version" };
		if (ServiceList) err2.line = ServiceList.line();
		errs.addError(err2);
	}
}

/**
 * load the XML data
 * @param {XMLdocument} document 	  XMLdocument
 * @param {Class}       errs        error handler for any loading errors
 * @param {string}      errcode     error code prefix to use for any loading issues
 * @returns {Document}  an XML document structure for use with libxmljs2
 */
export function SchemaLoad(document, errs, errcode) {
	let tmp = null,
		prettyXML = format(document.replace(/(\n\t)/gm, "\n"), { collapseContent: true, lineSeparator: "\n" });

	try {
		tmp = parseXmlString(prettyXML);
	} catch (err) {
		errs.addError({ code: `${errcode}-1`, message: `XML parsing failed: ${err.message}`, key: "malformed XML" });
		errs.loadDocument(prettyXML);
		return null;
	}
	if (!tmp || !tmp.root()) {
		errs.addError({ code: `${errcode}-2`, message: "XML document is empty", key: "malformed XML" });
		errs.loadDocument(prettyXML);
		return null;
	}

	errs.loadDocument(prettyXML);
	return tmp;
}
