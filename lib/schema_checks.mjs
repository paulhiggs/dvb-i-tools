/**
 * schema_checks.mjs
 */
import { XmlDocument, XsdValidator } from "libxml2-wasm";
import { xmlRegisterFsInputProviders } from "libxml2-wasm/lib/nodejs.mjs";
xmlRegisterFsInputProviders();

import format from "xml-formatter";

import { elementize, datatypeIs } from "./utils.mjs";

import { Array_extension_init } from "./Array-extensions.mjs";
Array_extension_init();

import { dvbi } from "./DVB-I_definitions.mjs";
import { FATAL, APPLICATION, INFORMATION, WARNING, DEBUG } from "./error_list.mjs";
import { OLD, DRAFT } from "./globals.mjs";
import { isIn } from "./utils.mjs";
import { keys } from "./common_errors.mjs";


/**
 * check that the specified child elements are in the parent element
 *
 * @param {XmlElement} checkElement       the element whose attributes should be checked
 * @param {Array}      requiredAttributes the element names permitted within the parent
 * @param {Array}      optionalAttributes the element names permitted within the parent
 * @param {Array}      definedAttributes  attributes that defined in the schema, whether requited, optional or profiled out
 * @param {ErrorList}  errs               errors found in validaton
 * @param {String}     errCode            error code to be used in reports,
 */
export function checkAttributes(checkElement, requiredAttributes, optionalAttributes, definedAttributes, errs, errCode) {
	if (!checkElement || !requiredAttributes) {
		errs.addError({ type: APPLICATION, code: "AT000", message: "checkAttributes() called with checkElement==null or requiredAttributes==null" });
		return;
	}
	const qualifiedName = `${checkElement.parent ? `${checkElement.parent.name}.` : ""}${checkElement.name}`;

	requiredAttributes.forEach((attributeName) => {
		if (!checkElement.attrAnyNs(attributeName))
			errs.addError({ code: `${errCode}-1`, message: `${attributeName.attribute(`${qualifiedName}`)} is a required attribute`, key: "missing attribute", line: checkElement.line });
	});

	checkElement.attrs.forEach((attribute) => {
		if (!isIn(requiredAttributes, attribute.name) && !isIn(optionalAttributes, attribute.name) && !isIn(definedAttributes, attribute.name))
			errs.addError({ code: `${errCode}-2`, message: `${attribute.name.attribute()} is not permitted in ${qualifiedName}`, key: "unexpected attribute", line: checkElement.line });
	});

	definedAttributes.forEach((attribute) => {
		if (!isIn(requiredAttributes, attribute) && !isIn(optionalAttributes, attribute))
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

/**
 * check that the specified child elements are in the parent element
 *
 * @param {XMLElement} parentElement         the element whose children should be checked
 * @param {Array}      childElements         the names of elements and their cardinality
 * @param {Array}      definedChildElements  the names of all child elements of parentElement that are defined in the schema, including
 *                                           those which are profiled out of DVB-I
 * @param {boolean}    allowOtherElements    flag indicating if other elements, i.e. those defined in the another are permitted
 * @param {ErrorList}  errs                  errors found in validaton
 * @param {String}     errCode               error code to be used for any error found
 * @returns {boolean} true if no errors are found (all mandatory elements are present and no extra elements are specified)
 *
 * NOTE: elements are described as an object containing "name", "minOccurs", "maxOccurs".
 *   Default values for minOccurs and maxOccurs are 1
 */
export function checkTopElementsAndCardinality(parentElement, childElements, definedChildElements, allowOtherElements, errs, errCode) {
	let findElementIn = (elementList, elementName) => (datatypeIs(elementList, "array") ? elementList.find((element) => element.name == elementName) : false);

	function getNamedChildElements(node, childElementName) {
		let res = [];
		node?.childNodes().forEachNamedSubElement(childElementName, (child) => {
			res.push(child);
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
	childElements.forEach((child) => {
		if (child?.name) {
			const min = Object.prototype.hasOwnProperty.call(child, "minOccurs") ? child.minOccurs : 1;
			const max = Object.prototype.hasOwnProperty.call(child, "maxOccurs") ? child.maxOccurs : 1;
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
 * validate a XML document gainst the specified schema (included schemas must be in the same directory)
 *
 * @param {XmlDocument} XML          the XML document to check
 * @param {XmlDocument} XSD          the schema
 * @param {String}      XSDfilename  location of the schema in @XSd to serve as the root for relative paths
 * @param {ErrorList}   errs         array to record any errors
 * @param {String}      errCode      the error code to report with each error
 */
export function SchemaCheck(XML, XSD, XSDfilename, errs, errCode) {
	let validator = null;
	try {
		validator = XsdValidator.fromDoc(XSD);
	} catch (err) {
		const x = err.details;
		x.forEach((e) => {
			errs.addError({ code: "LS000", type: DEBUG, message: `${JSON.stringify(e)}, url: ${XSDfilename}` });
		});
	}

	if (!validator) {
		errs.addError({ code: "LS001", type: DEBUG, message: `validator not loaded. XSDfilename= "${XSDfilename}"` });
		return;
	}
	try {
		validator.validate(XML);
	} catch (err) {
		//console.log(err.message)
		if (err.details) {
			const lines = format(XML.toString(), { collapseContent: true, lineSeparator: "\n", strictMode: true }).split("\n");
			err.details.forEach((ve) => {
				errs.addError({ code: errCode, message: ve.message, fragment: lines[ve.line - 1], line: ve.line, key: keys.k_XSDValidation });
			});
		}
	}
}

/**
 * report if the schema version being used is not 'formal'
 *
 * @param {XmlDocument} document             the XML document
 * @param {enum}        publication_state    the publication status of the schema
 * @param {ErrorList}   errs                 array to record any errors
 * @param {String}      errCode              the error code to report with each error
 */
export function SchemaVersionCheck(document, publication_state, errs, errCode) {
	const ServiceList = document.root.getAnyNs(dvbi.e_ServiceList);
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
 * @param {XmlDocument} document 	   XMLdocument
 * @param {ErrorList}   errs         error handler for any loading errors
 * @param {String}      errcode      error code prefix to use for any loading issues
 * @returns {XMLDocument}  an XML document structure
 */
export function SchemaLoad(document, errs, errcode) {
	let tmp = null,
		prettyXML = null;

	try {
		tmp = XmlDocument.fromString(document);
	} catch (err) {
		if (err.details && datatypeIs(err.details, "array"))
			err.details.forEach((e) =>
				errs.addError({ type: FATAL, code: `${errcode}-1`, message: `Raw XML parsing failed: ${e.message} at char ${e.col}`, line: e.line, key: keys.k_MalformedXML })
			);
		else errs.addError({ type: FATAL, code: `${errcode}-1`, message: `Raw XML parsing failed: ${err.message}`, key: keys.k_MalformedXML });
	}
	try {
		prettyXML = format(document.replace(/(\n\t)/gm, "\n"), { collapseContent: true, lineSeparator: "\n" });
	} catch (err) {
		errs.addError({ type: FATAL, code: `${errcode}-2`, message: `XML format failed: ${err.cause}`, key: keys.k_MalformedXML });
		return null;
	}
	try {
		tmp = XmlDocument.fromString(prettyXML);
	} catch (err) {
		errs.addError({ type: FATAL, code: `${errcode}-11`, message: `XML parsing failed: ${err.message}`, key: keys.k_MalformedXML });
		errs.loadDocument(prettyXML);
		return null;
	}
	if (!tmp || !tmp.root) {
		errs.addError({ type: FATAL, code: `${errcode}-12`, message: "XML document is empty", key: keys.k_MalformedXML });
		errs.loadDocument(prettyXML);
		return null;
	}

	errs.loadDocument(prettyXML);
	return tmp;
}