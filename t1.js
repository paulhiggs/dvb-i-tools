

import { XmlDocument, XmlElement, XmlComment, XmlXPath } from 'libxml2-wasm';

let xx1 = `
<bookstore xmlns="urn:dvb:metadata:servicediscovery:2020" xmlns:ab="paul.hhh">

<!-- test -->

<book>
  <title lang="en">Harry Potter</title>
  <ab:price>29.99</ab:price>
</book>

<book>
  <title lang="en">Learning XML</title>
  <ab:price>39.95</ab:price>
</book>

</bookstore>
`;

let tmp1 = XmlDocument.fromString(xx1);
const default_namespace_prefix = "DeFaUlT"

let root_element = tmp1.root;
console.log("prefix="+root_element.namespacePrefix+", name="+root_element.name)

let document_prefix = root_element.namespacePrefix;

let ns_map1 = root_element.namespaces
if (document_prefix == '')
	ns_map1[default_namespace_prefix] = ns_map1[''];

console.dir(ns_map1)

let pp1 = tmp1.get(XmlXPath.compile(`${default_namespace_prefix}:book`, ns_map1))

console.dir(pp1)
let qq1 = pp1.get(XmlXPath.compile('ab:price', ns_map1));
console.log(qq1.content)

console.log(pp1 instanceof XmlComment)

