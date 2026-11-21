# dvb-i-tools

Pauls DVB Tools

## csr.ts - a DVB-I CSR / SLR

### Description

This server application implements a Service List Registry as defined by the [DVB-I Service Discovery and Content Metadata specification - A177r6](https://dvb.org/wp-content/uploads/2023/07/A177r6_Service-Discovery-and-Programme-Metadata-for-DVB-I_Draft_TS-103-770-v121_February-2024.pdf) in clause 5.1.3.2.

The application works by reading in a reference/master XML document and then pruning out any provider and service offerings that do not match the specified query parameters. Per A177r2, the allowed query parameters added to the /query are

- TargetCountry
- regulatorListFlag
- Delivery
- Language
- Genre
- ProviderName
- _inlineImages_ default is "false"

These parameter names are case sensitive and the comparisons made with their values are also case sensitive against the master Service List Entry Points Registy (SLEPR)

Note that these values are case sensitive, and a case sensitive matching is performed with the values, thus "AUT" != "aut"

### Installation

1. Clone this repository `git clone https://github.com/paulhiggs/dvb-i-tools.git`
1. Install necessary libraries (express, libxmljs, morgan) `npm install`

### Logging

If a subdirectory named `./arch` exists, then any XML document for validation will be copied there. There will be the original document with the suffix "`.txt`" and a second document with the suffix "`.mkup.txt`" containing line based validation results as XML comments 

If a subdirectory named `./logs` extists, then enhanced HTTP server logging willl be directed there (in addition to the NodeJS console) 

### Operation

1. Edit the Service List Entry Point Registry XML document (`slepr-master.xml`) as needed
1. run it - `node csr.ts [--port 3000] [--sport 3001] [--file ./slepr-master.xml] [--CORSmode library]`

The server can be reloaded with an updated `slepr-master.xml` file by invoking it with /reload, i.e. `http://localhost:3000/reload`

#### Server arguments

- `--port [-p] <port>` set the HTTP listening port (default: 3000)
- `--sport [-s] <port>` set the HTTPS listening port (default: 3001)
- `--urls [-u]` load configation from network locations (default: use local files)
- `--CSRfile [-f] <filename>` name of the registry file to use, can be an http(s) URL (default: ./registries/slepr-main.xml)
- `--CORSmode [-c] <mode>` select the type of CORS handling
  - `"library"` - default mode - use the Express CORS library
  - `"manual"` - do code based CORS header insertion (not fully implemented or tested)
  - `"none"` - dont do any CORS handling
- `--workers [-w] <number>` the number of worker threads (constrained interally to 1~num CPUs)
- `--SLRmode <mode>` select the type of processing for the SLR response
  - `"default"` - default mode - according to A177 specification
  - `"italy"` - process the SLR response accirding to Italian method
- `--help [-h]` server and client command help

If you want to start an HTTPS server, make sure you have `selfsigned.crt` and `selfsigned.key` files in the same directory. These can be generated (on Linux) with `sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt`

## all-in-one.ts

Implements csr.ts along with service list registry, service list and content guide document validation.

### Description

Validates the syntax and semantic value space of DVB-I service list registry, service list, playlist and content guide metadata according to DVB Bluebook A177

#### Supported A177 revisions

- the original A177 [:2019 schema](http://dvb.org/wp-content/uploads/2019/11/A177_DVB-I_Nov_2019.pdf)
- the A177r1 [:2020 schema](https://dvb.org/wp-content/uploads/2019/11/A177r1_Service-Discovery-and-Programme-Metadata-for-DVB-I_July-2020.pdf) with its classification scheme updates
- the A177r2 [:2021 schema](https://dvb.org/wp-content/uploads/2020/11/A177r2_Service-Discovery-and-Programme-Metadata-for-DVB-I_ts_103-770-v120_June-2021.pdf) with its classification scheme updates
- the A177r3 [:2022 schema](https://dvb.org/wp-content/uploads/2021/06/A177r3_Service-Discovery-and-Programme-Metadata-for-DVB-I_January-2022.pdf)
- the A177r4 [:2022b schema](https://dvb.org/wp-content/uploads/2022/01/A177r4_Service-Discovery-and-Programme-Metadata-for-DVB-I_Interim-Draft_TS-103-770-v121_September-2022.pdf)
- the A177r5 [:2023 schema](https://dvb.org/wp-content/uploads/2022/09/A177r5_Service-Discovery-and-Programme-Metadata-for-DVB-I_Interim-Draft_TS-103-770-v121_July-2023.pdf)
- the A177r6 [:2024 schema](https://dvb.org/wp-content/uploads/2023/07/A177r6_Service-Discovery-and-Programme-Metadata-for-DVB-I_Draft_TS-103-770-v121_February-2024.pdf)
- the A177r7 [:2025 schema](https://dvb.org/wp-content/uploads/2024/09/A177r7_Service-Discovery-and-Programme-Metadata-for-DVB-I_Interim-Draft_TS-103-770-v131_July-2025.pdf)
- the A177r8 [:2026 schema](https://dvb.org/wp-content/uploads/2025/12/A177r8_Service-Discovery-and-Programme-Metadata-for-DVB-I_Draft_TS-103-770-v131_June-2026.pdf) ([latest details](https://dvb.org/?standard=service-discovery-and-programme-metadata-for-dvb-i))

### Installation

#### node.js

1. Clone this repository `git clone https://github.com/paulhiggs/dvb-i-tools.git`
1. Install necessary libraries (express, libxmljs, morgan) `npm install`
1. run it - `node all-in-one.ts [--urls] [--port 3030] [--sport 3031]`

If you want to start an HTTPS server, make sure you have `selfsigned.crt` and `selfsigned.key` files in the same directory. These can be generated (on Linux) with `sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt`

Occassionally, the language-subtag-registry file can be updated from https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry

#### Docker

1. Clone this repository `git clone  https://github.com/paulhiggs/dvb-i-tools.git`
1. run it - `docker compose up`

### Command Line Arguments

- `--urls [-u]` forces the classification scheme, country and language values to be read from the internet. Default is to load values from local files.
- `--port [-p] <port>` set the HTTP listening port (default: 3030)
- `--sport [-s] <port>` set the HTTPS listening port (default: 3031)
- `--motd [-m] <filename>` file to read for Message of the Day (default: `motd.html`)
- `--nocsr` flag to disable SLR operation (default: false)
- `--nocg` flag to disable Content Guide validation (default: false)
- `--nosl` flag to disable Service List validation (default: false)
- `--nopl` flag to disable Playlist validation (default: false)
- `--noslr` flag to disable Service List Registry validation (default: false)
- `--CORSmode [-c] <mode>` select the type of CORS handling
  - `"library"` - default mode - use the Express CORS library
  - `"manual"` - do code based CORS header insertion (not fully implemented or tested)
  - `"none"` - dont do any CORS handling
- `--CSRfile [-f] <filename>` file to use for SLR responses (default: `./registries/slepr-main.xml`)
- `--SLRmode <mode>` select the type of processing for the SLR response
  - `"default"` - default mode - according to A177 specification
- `--allow_traversal [-t]` flag to allow document-to-document traversal <span style="color:red">(experimental, takes much time)</span>	
- `--fetch_concurrency <number>` maximum number of documents retrieved at the same time (default: 8). During traversal, referenced documents are downloaded ahead while earlier ones are validated; results are still reported in the order the documents are referenced. Use `1` to make one request at a time.
- `--fetch_per_host <number>` maximum number of documents retrieved at the same time from any one host (default: 4), within `--fetch_concurrency`. This stops a single server, such as an image server referenced by every programme, being sent more requests at once than it can answer within the timeout.
- `--allow_private_fetch <true|false>` allow documents to be retrieved from `localhost` and private network addresses (default: true). Set to `false` on a public deployment. Only literal IP addresses and `localhost` are recognised, not hostnames that resolve to private addresses.
- `--help [-h]` server and client command help

Documents retrieved for validation (by URL or by traversal) must use `http:` or `https:`, are limited to 10 MB and a 3 second timeout. A single validation traverses at most 10 levels deep.

When **Traverse referenced documents** is selected on the `/check` form, **Maximum documents** sets the most documents the validation traverses: a positive whole number (default 100), or `unlimited`. Unlimited can make a traversal of a large service list take hours. **Maximum depth** sets how many levels deep the validation traverses: a positive whole number, up to the server's limit of 10 (a larger value is lowered to 10). Traversal is only available when the server is started with `--allow_traversal`.

Each URL is validated only once during a validation. When the same URL is referenced again, it is not retrieved or reported again: the "references" column of the traversed documents table shows how many times it was referenced.

While a validation with traversal runs, the `/check` page shows its progress:
- the results of the document itself, as soon as its own rules have been checked
- the traversed documents, added to a table in the order they are referenced as each is validated
- counts that are updated every second: documents validated, waiting and skipped, the time taken, and the retrievals made

When the validation finishes, the full results replace the progress. Findings that need retrievals for the document itself (images, signature policies, traversal limits), and the document with its findings marked, appear only in the full results. The progress view needs scripting. Without it, the results are shown when the validation finishes, as before.

If the browser leaves the page, or the connection is lost, before the results are sent, the validation stops. Retrievals already in progress are completed, but nothing more is retrieved or validated.

For clients other than the form: a `POST` to `/check` with `Accept: application/x-ndjson` returns the progress as one JSON object per line:
- `{"event":"root","html":…}`: the document's own results
- `{"event":"progress","counts":{…},"documents":[…]}`: every second, the counts so far and the traversed documents that have started or finished since the last event

These are followed by the line `{"event":"results"}` and then the HTML of the results.

A referenced document that is not traversed is reported with a warning:
- `TRAV001` the URL has already been validated during this validation (repeats are normally counted in the "references" column instead)
- `TRAV002` the maximum traversal depth has been reached
- `TRAV003` the maximum number of traversed documents has been reached
- `TRAV000` the traversal was requested outside a validation (an internal error)

### Image checks

Every validation made through the server retrieves the images referenced in `<RelatedMaterial><MediaLocator><MediaUri>` (service list, service, content guide source and service banner logos, and promotional still images) and checks them against A177r8 clause 5.2.8. Inline (`data:`) images are checked without any retrieval. Each image URL is retrieved and reported only once per validation, including traversed documents, so a logo shared by many services is checked once. The content digest check (`@integrity`) uses the same retrieval. Images do not count towards the maximum number of documents to traverse, but they share the `--fetch_concurrency` and `--fetch_per_host` limits. A referenced resource is retrieved as soon as the rule that refers to it is checked, so retrievals proceed while the rest of the document is validated.

**Image checking** on the form chooses how images are checked:
- **No**: images are not retrieved (their URLs and `@contentType` are still checked).
- **Yes** (the default): each image is retrieved once and checked as below.
- **Yes and scaled**: each image is also requested at half its width with `?w=<width>` to check that the server scales it (A177r8 clause 5.2.8.2.2). This doubles the image requests.

For the `/validate_*` endpoints, add `images=no`, `images=yes` or `images=scaled` to the query of a `GET` request, or send the header `X-images` with a `POST`. Without it, images are checked (`yes`).

Referenced resources that are not images (applications, program URLs...) have their signature policy (`@verificationPolicy`) and content digest (`@integrity`) checked, with the same single retrieval.

- `IMG001` the image could not be retrieved (network error, timeout or a refused URL)
- `IMG002` the image request did not return a `2xx` status
- `IMG003` (warning) the response `Content-Type` is not the signalled `@contentType`
- `IMG004` the resource is not a readable image, or has no pixels
- `IMG005` the image format is not the one signalled in `@contentType`
- `IMG006` the image is in a format that is not permitted (GIF, BMP or SVG)
- `IMG007` the pixel aspect ratio is not 1:1
- `IMG008` (warning) the image does not have 8 bits per colour component
- `IMG009` (warning) the image uses a CMYK colour space, not sRGB
- `IMG010` the scaled image is not the requested width
- `IMG011` (warning) the scaled image could not be retrieved, or the server answered `400 Bad Request` (an unsupported width)
- `IMG012` the scaled image does not keep the aspect ratio of the original (it is cropped or stretched)
- `IMG013` the scaled image is not a readable image, or is in a different format from the original

### Signature policy checks

A `@verificationPolicy` names a signature policy (A177r8 clause 7.6). Policies are defined in the `<SignaturePolicies>` of a service list or a service list registry. A content guide document reached by traversal uses the policies of the service list it was reached from. A service list reached from a registry uses its own policies.

For each reference with a defined policy, every validation made through the server makes two separate checks:
- **the certificate chain of the HTTPS connection**: once for each `host:port` in a validation, including the host a redirect leads to.
- **the `X-JWS-Signature` of the response** (A177r8 clause 7.7.1.2), for each response the policy applies to:
  - every response from an endpoint whose `<URI>` carries the policy (e.g. the schedules returned by a `ScheduleInfoEndpoint` when traversing)
  - the response of a referenced resource, such as a logo

The connection is also checked for endpoints that are not traversed.

Either check can be turned off for a validation. **Signature policy checks** on the form chooses **Both** (the default), **Certificates only** (the connection), **Signatures only** (the `X-JWS-Signature`) or **None**. For the `/validate_*` endpoints, add `connection_certificates=false` and/or `response_signatures=false` to the query of a `GET`, or send the headers `X-connection-certificates: false` and/or `X-response-signatures: false` with a `POST`. A request can only turn a check off: neither check runs when the server does not make it.

Findings are errors when the policy's `Enforcement` is `required`, warnings for `warn`, and information for `vendor`.

Connection (`TLS`):
- `TLS001` a `CAFingerprint` of the policy is not in the server's certificate chain. **All** of the policy's fingerprints must be present. Servers usually do not send their root certificate, so a root CA fingerprint is only found when the server sends it or it is in the validator's trust store.
- `TLS002` the server's certificate chain could not be obtained (connection or handshake failure, timeout, or a URL the fetch policy refuses)
- `TLS003` a certificate in the chain is expired or not yet valid, is not issued by the next one, or the server's certificate is not valid for the host
- `TLS004` the host is not one of the policy's `SubjectConstraint/CN` values (`*.example.com` matches one level)

Response signature (`JWS`):
- `JWS001` there is no `X-JWS-Signature` (or the response could not be retrieved, so the signature could not be checked)
- `JWS002` the header is not a compact detached JWS
- `JWS003` the protected header does not have an `alg` from A177r8 clause 7.7.2, `crit` including `b64`, and `b64` set to `false`
- `JWS004` (information) the JWS has no certificate chain (`x5c`), so the signature and trust anchor cannot be checked
- `JWS005` the signature does not verify over the response body
- `JWS006` the signing key does not suit `alg` (RS256/RS512 need a 4096-bit RSA key; ES256 P-256; ES512 P-521; Ed25519)
- `JWS007` no certificate in the signing chain matches a `CAFingerprint` of the policy. **At least one** must match.
- `JWS008` a certificate in the signing chain is expired or not yet valid, or is not issued by the next one
- `JWS009` the host the response came from, after any redirects, is not one of the policy's `SubjectConstraint/CN` values
- `JWS010` (information) there is no `Reporting-Endpoints` header with a `dvbi-signature-validation` endpoint (A177r8 clause 7.6.2.5)

### Logging

If a subdirectory named `./arch` exists, then any XML document for validation will be copied there. There will be the original document with the suffix "`.txt`" and a second document with the suffix "`.mkup.txt`" containing line based validation results as XML comments 

If a subdirectory named `./logs` extists, then enhanced HTTP server logging willl be directed there (in addition to the NodeJS console) 

### Use

`<server>/check` gives a basic/primitive UI. Select the valildation type (Service List or Content Guide) and provide either a URL or local file. Press "Validate!" button. Await results!

#### Service list validation endpoints

`<server>/validate_sl?url=<service_list_url>&variants=DE` gives the validation results of the service list in the "url"-parameter as HTML, same format as the /check validation. Also accepts POST request with the servicelist in the request body with content type "application/xml". The url query parameter in the POST request can be used to show the name of the list in the resulting HTML.
The optional `variants=` query parameter can be used with a GET to specify region specific validation, or via the `X-variants` HTTP header for post.

`<server>/validate_sl_json?url=<service_list_url>&variants=DE` validates the list in the "url"-parameter and gives the number of fatals, errors, warnings and informationals as JSON. Also accepts POST request with the servicelist in the request body with content type "application/xml" instead of the url query parameter.
The optional `variants=` query parameter can be used with a GET to specify region specific validation, or via the `X-variants` HTTP header for post.
Example response:

```json
{
	"fatals": 0,
	"errors": 1,
	"warnings": 0,
	"informationals": 0
}
```

If the document cannot be retrieved, a `parseErr` array describing the problem is included in the same JSON object, e.g.

```json
{
	"parseErr": ["error (404:Not Found) handling https://example.com/list.xml"],
	"fatals": 0,
	"errors": 0,
	"warnings": 0,
	"informationals": 0
}
```

The response also includes `timing`: how long the validation took, and the retrievals it made from each host.

##### Traversal from the validation endpoints

The service list and service list registry endpoints (`/validate_sl`, `/validate_sl_json`, `/validate_slr`, `/validate_slr_json`) can traverse into the documents they reference, as **Traverse referenced documents** does on the form:
- `traverse=true`: in the query of a `GET`, or the header `X-traverse: true` with a `POST`.
- `max_traversal=<number|unlimited>`: the most documents to traverse (default 100). In the query, or the header `X-max-traversal` with a `POST`. An invalid value is reported in `parseErr`, and the document is not validated.
- `max_depth=<number>`: the most levels deep to traverse, a positive whole number (default, and at most, 10: a larger value is lowered to 10). In the query, or the header `X-max-depth` with a `POST`. An invalid value is reported in `parseErr`, and the document is not validated.

The other limits on retrievals (concurrency, the timeout, the size limit and private addresses) are set when the server is started, and cannot be changed by a request.

Traversal is only done when the server is started with `--allow_traversal`. Otherwise the response has an informational `TRAV004`, "traversal was requested, but is not allowed on this server".

With traversal, the JSON summary has a `traversed` object:
- `documents`: how many documents were traversed into.
- `skipped`: referenced documents that were not retrieved because the depth or document limit was reached (`TRAV002`, `TRAV003`).
- `repeats`: further references to the referenced documents, whether traversed or not, which were not requested again. This is the same count as "further references to them not validated again" in the HTML report.
- `withFatals`, `withErrors`, `withWarnings`: how many traversed documents had findings of each kind.
- `totals`: the findings of all the traversed documents together.
- `traversal`: how many times each `TRAV` code was reported.

```json
{
	"fatals": 0, "errors": 345, "warnings": 39, "informationals": 0,
	"traversed": {
		"documents": 30, "skipped": 9404, "repeats": 671,
		"withFatals": 0, "withErrors": 11, "withWarnings": 11,
		"totals": { "fatals": 0, "errors": 319, "warnings": 76, "informationals": 1581 },
		"traversal": { "TRAV003": 9404 }
	},
	"timing": { "durationMs": 3120, "documentsTraversed": 30, "...": "..." }
}
```

`results=tree` also gives a `document` node for the validated document, with a node in `nested` for each document it traversed into. Each node has:
- `url`, `type` and `description`
- `severity`: `none`, `debug`, `information`, `warning`, `error` or `fatal`
- `counts`
- `codes`: how many times each code was reported, for each severity
- `references`: how many times the document was referenced, when more than once
- `skipped`: `TRAV002` or `TRAV003`, for a document that was skipped because a traversal limit was reached

Two query parameters narrow the tree. Leaving documents out is counted in `omitted` on the node above them.
- `nested=problems`: only documents with fatals, errors or warnings, and the documents leading to them. Skipped documents are left out.
- `depth=<n>`: only documents up to `n` levels below the validated document.

```json
{
	"document": {
		"url": "https://example.com/sl.xml", "type": "Service List", "severity": "error",
		"counts": { "fatals": 0, "errors": 345, "warnings": 39, "informationals": 0 },
		"codes": { "errors": { "SL263": 18, "SI112-53": 327 }, "warnings": { "SL270": 38, "SL283": 1 } },
		"nested": [
			{ "url": "https://example.com/sip?sid=1&now_next=true", "type": "NowNext", "description": "Now/Next", "severity": "error",
			  "counts": { "fatals": 0, "errors": 8, "warnings": 2, "informationals": 28 },
			  "codes": { "errors": { "AV020": 2, "AV051-53": 6 }, "warnings": { "AV051-52a": 2 }, "informationals": { "PI021-3": 28 } },
			  "omitted": 2 }
		],
		"omitted": 9332
	}
}
```

`<server>/validate_sl_json?url=<service_list_url>&results=all` validates the list in the "url"-parameter and gives the complete validation results as JSON. The marked-up copy of the document (`markupXML`) is not included. The HTTP status is 200 whenever the request is accepted, including when the document cannot be retrieved: check for `parseErr` in the response. Also accepts POST request with the servicelist in the request body with content type "application/xml" instead of the url query parameter. 
The optional `variants=` query parameter can be used with a GET to specify region specific validation, or via the `X-variants` HTTP header for post.
Example response:

```json
{
	"errs": {
		"countsErr": [],
		"countsWarn": [],
		"countsInfo": [],
		"errors": [
			{
				"code": "SL005:6",
				"message": "Error: Element '{urn:dvb:metadata:servicediscovery:2024}Service': Missing child element(s). Expected is one of ( {urn:dvb:metadata:servicediscovery:2024}ServiceName, {urn:dvb:metadata:servicediscovery:2024}ProviderName ).\n",
				"element": "    <Service version=\"1\">",
				"line": 3
			}
		],
		"warnings": [],
		"informationals": [],
		"errorDescriptions": []
	}
}
```

#### Content guide validation endpoints

Type-parameter for all content guide validation requests is one of the following:

- Schedule Info (time stamp): `Time`
- Schedule Info (now/next): `NowNext`
- Schedule Info (window): `Window`
- Program Info: `ProgInfo`
- More Episodes: `MoreEpisodes`
- Box Set Categories: `bsCategories`
- Box Set Lists: `bsLists`
- Box Set Contents: `bsContents`

`<server>/validate_cg?url=<content_guide_url>&type=<type>` gives the validation results of the content guide data in the "url"-parameter as HTML, same format as the /check validation. Also accepts POST request with the content guide data in the request body with content type "application/xml". The url query parameter in the POST request can be used to show the name of the list in the resulting HTML

`<server>/validate_gc_json?url=<content_guide_url>&type=<type>` validates the content guide data in the "url"-parameter and gives the number of errors, warnings and informationals as JSON. Also accepts POST request with the content guide fragment in the request body with content type "application/xml" instead of the url query parameter. The response is in the same format as `<server>/validate_sl__json?url=<service_list_url>` request

`<server>/validate_cg_json?url=<content_guide_url>&results=all&type=<type>` validates the content guide document in "url"-parameter and gives the complete validation results as JSON. Also accepts POST request with the content guide fragment in the request body with content type "application/xml" instead of the url query parameter. The response is in the same format as `<server>/validate_sl_json?url=<service_list_url>&results=all` request

accepted valies for `<type>`

- `Time` - Content guide fragment represents a Timestamp Filtered Schedule response according to DVB A177 clause 6.5.4.3.1
- `NowNext` - Content guide fragment represents a Now/Next Filtered Schedule response according to DVB A177 clause 6.5.4.3.2
- `Window` - Content guide fragment represents a Now/Next (window) Filtered Schedule response according to DVB A177 clause 6.5.4.3.3
- `ProgInfo` - Content guide fragment contains a Detailed Program Information response according to DVD A177 clause 6.6.3
- `MoreEpisodes` - Content guide fragment contains a More episodes response according to DVB A177 clause 6.7.3
- `bsCategories` - Content guide fragment contains a Box Set Categories response according to DVB A177 clause 6.8.2.3
- `bsLists` - Content guide fragment contains a Box Set Lists response according to DVB A177 clause 6.8.3.3
- `bsContents` - Content guide fragment contains a Box Set Contents response according to DVB A177 clause 6.8.3.3

#### Service list registry validation endpoints
*todo writeup needed*

#### Playlist validation endpoints
*todo writeup needed*

## Acknowledgements

A 2026 code review of this repository, and the fixes that came out of it (output escaping, a single fetch policy for retrieved documents, resource clean-up, schema validator reuse, TypeScript and CI checks, and Docker and server start-up fixes), were carried out with help from [Claude](https://claude.com/claude-code), an AI assistant by Anthropic.

*Copyright (c) 2021-2026, Paul Higgs*<br/>
*All rights reserved*