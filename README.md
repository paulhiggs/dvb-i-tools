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

Validates the syntax and semantic value space of DVB-I service list registry, service list, playlist and content guide metadata according to DVB Bluebook A177, and of the XML AIT documents (ETSI TS 102 809) that they refer to

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

The image installs only the runtime dependencies (`npm ci --omit=dev`, `NODE_ENV=production`), and has a `HEALTHCHECK` that asks `/healthz` over HTTPS.

#### Stopping

On `SIGTERM` (for example `docker stop`) or `SIGINT` (Ctrl-C), the server shuts down gracefully:
- `/healthz` reports `stopping`
- it stops accepting connections
- the validations in progress are stopped, and their requests are answered with the results so far
- it exits when the connections have closed, or after 8 seconds (less than the 10 seconds `docker stop` waits)

With `--workers`, the primary passes the signal on to the workers and does not restart them. A second signal stops the process at once.

### Command Line Arguments

- `--urls [-u]` forces the classification scheme, country and language values to be read from the internet. Default is to load values from local files.
- `--port [-p] <port>` set the HTTP listening port (default: 3030)
- `--sport [-s] <port>` set the HTTPS listening port (default: 3031)
- `--motd [-m] <filename>` file to read for Message of the Day (default: `motd.html`). The content security policy of the pages refuses inline scripts, `<style>` elements and `style` attributes, so the message can only use plain markup and the validator's own classes
- `--nocsr` flag to disable SLR operation (default: false)
- `--nocg` flag to disable Content Guide validation (default: false)
- `--nosl` flag to disable Service List validation (default: false)
- `--nopl` flag to disable Playlist validation (default: false)
- `--noslr` flag to disable Service List Registry validation (default: false)
- `--noait` flag to disable XML AIT validation (default: false)
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

Unless **Image checking** is **No** (see below), every validation made through the server retrieves the images referenced in `<RelatedMaterial><MediaLocator><MediaUri>` (service list, service, content guide source and service banner logos, and promotional still images) and checks them against A177r8 clause 5.2.8. Inline (`data:`) images are decoded and checked in the same way, without any retrieval. Each image URL is retrieved and reported only once per validation, including traversed documents, so a logo shared by many services is checked once. The content digest check (`@integrity`) uses the same retrieval. Images do not count towards the maximum number of documents to traverse, but they share the `--fetch_concurrency` and `--fetch_per_host` limits. A referenced resource is retrieved as soon as the rule that refers to it is checked, so retrievals proceed while the rest of the document is validated.

**Image checking** on the form chooses how images are checked:
- **No**: no image is checked, neither a retrieved nor an inline (`data:`) image. Their URLs and `@contentType` are still checked, and so is a content digest (`@integrity`): a referenced image with a digest is still retrieved to compare it, but the image itself is not checked.
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

### Markets

A validation can be made for a **market**: the settings of a market deployment of DVB-I, which differ from A177 itself (issue #119). The markets are defined in [res/markets.json](res/markets.json), which is loaded at start-up (from the repository with `--urls`, like the other reference data). A file that is not valid stops the start-up, with a message for each problem. One market is defined:

| Id | Name | Settings |
|---|---|---|
| `DE` | Germany | Only **A177r6** is permitted: a document of any other revision is reported with `MKT001` and not validated. The programme guide needs 7 days either side of today instead of 28. Service lists and service list registries are validated against the `-(DE)` schemas, which make `@networkID` optional, allow any number of `NetworkID` elements, and add `@directTuningAvailable` to `OrbitalPosition`. From the DTVP DVB-I Implementation Profile v1.1.0 (issue #139): service logos are 320 pixels wide and at most 64000 bytes, promotional still images (EPG images) 640 pixels wide and at most 100000 bytes, postcodes have 5 digits, and every DVB-S service instance has its direct tuning parameters. An XML AIT in the old `urn:dvb:mhp:2009` namespace is not a warning: `AIT006a` is suppressed |

A validation is made for one market, or none (A177 itself). It applies to every document the validation traverses into. The market is chosen with:
- **Market** on the /check form (for service lists and service list registries)
- `market=<id>` in the query of a `GET` to a `/validate_*` endpoint, or the header `X-market: <id>` with a `POST`. The id can be in any case. An empty value is no market
- `variants=<id>` / `X-variants: <id>`, the earlier names, which are **deprecated** but still accepted. When both are given, `market` is used

A market that is not defined is answered with `400` and a `parseErr` naming the markets that are, since the validation cannot be made for it. (Before markets, an unknown `variants=` value was ignored.)

#### The markets file

`res/markets.json` is a JSON array of markets. Each market has:
- `id`: letters, digits, `-` or `_`, unique in any case
- `name`, and an optional `description`, shown on the /check form
- `permitted` (optional): the A177 revisions the market permits, e.g. `["r6"]`. Without it every revision is permitted. A service list, service list registry response or playlist of another revision is reported with `MKT001` (an error) and is not validated: no XSD validation and no other rules. This applies to traversed documents too. A content guide document validated on its own is permitted when a permitted A177 revision uses its TV-Anytime revision (for `DE`, TV-Anytime 2024, which A177r6 uses; not TV-Anytime 2027). `MKT001` cannot be changed with `severity`, and a revision range that includes no permitted revision is refused
- `revisions`: a list of ranges of A177 revisions, each with `from` and `to` (`r0` to `r8`, or `latest`), and the settings for the documents of those revisions:
  - `schemas`: the XSD file (in `schemas/`) used instead of A177's, for `serviceList` and `serviceListRegistry` documents
  - `parameters`: values that differ from A177's. Each is a positive whole number:

    | Parameter | Meaning | A177 |
    |---|---|---|
    | `schedule.daysEitherSide` | the days of programme guide needed before and after today (`SL201`) | 28 |
    | `lcn.min`, `lcn.max` | the range of channel numbers in an `LCNTable`: `LCN@channelNumber` (`SL264`), `LCNRange@start` (`SL266`) and `LCNRange@end` (`SL267`). `min` must not be above `max` | 1, 9999 |
    | `postcode.digits` | the number of digits of the postcodes of the service list's regions (`MKT003`, an error): a `Postcode` and the `@from` and `@to` of a `PostcodeRange` have exactly that many digits (and `@from` is not after `@to`), and a `WildcardPostcode` has fewer digits beside its single `*`, which stands for at least one digit | none |
  - `severity`: the severity of codes for the market, instead of A177's: `"error"`, `"warning"`, `"information"`, `"suppressed"` for findings that are shown but not counted, or `"off"` for findings that do not apply to the market. A key is a code (`"SL264"`), or a prefix of codes followed by `*` (`"SI020-1-*"`, `"SL24*"`), which has at least the letters and one digit. A code's own entry wins, and otherwise the longest prefix that it starts with. The code itself is never changed
  - `images`: what the market stipulates for each kind of image: `serviceListLogo`, `serviceLogo`, `contentGuideSourceLogo` and `promotionalStillImage` (by their `HowRelated`). Each has a `width`, which the image must match exactly, with an optional `height` that it must also match (without it, any height and aspect ratio is accepted), and an optional `maxBytes`, the largest file size the market recommends. Each is a positive whole number, and either a `width` or `maxBytes` is needed. A later range replaces what an earlier one gives for a kind. A177 itself stipulates no sizes. They are checked only when images are checked (**Image checking** Yes, `images=yes|scaled`), for the image at the signalled URL (not one scaled with `?w=`) and for inline (`data:`) images:
    - `IMG020` (error): the image is not the size the market requires
    - `IMG021` (warning): the file is larger than `maxBytes` (for an inline image, its decoded data)
  - `rules`: the rules the market enables, each `true` or `false` (a later range can turn one off). They are:
    - `serviceLogoRequired`: every `Service` must have a service logo (`HowRelated` `…:1001.2`) in its own `RelatedMaterial`. A logo only in a `ServiceInstance` does not satisfy it (`MKT002`, an error)
    - `dvbsDirectTuning`: every `DVBSDeliveryParameters` has the parameters for direct tuning (A177 clause 5.2.12): `OrbitalPosition`, `Frequency`, `Polarization` and `SymbolRate` (`MKT004`, an error)

The settings for a document are those of the ranges that include its A177 revision, in the order they are listed: a later range wins for the same setting. A content guide document has the revision of the service list that refers to it, or when it is validated on its own, the latest A177 revision that uses its TV-Anytime revision. An XML AIT has the revision of the document that refers to it, or the latest that the market permits. Unknown properties, parameters and revisions, values that are not valid, and missing schema files are refused. So is a severity for a fatal or XSD finding (`SL001`, `SR001`, `CG001`, `PL001`, `AIT001`, `SL005`, `SR005`, `CG003`, `PL005`, `AIT005`, and the codes made from them, such as `SL005:8`), whose findings all have one code: a market relaxes a schema rule with its own schema instead. `MKT001` cannot be changed either. The loader does not check that a code exists, as many codes are made when they are reported (`BE005`, `SE005`).

The results of a validation made for a market name it: the heading of the HTML results ("for the market Germany (DE)"), `market` (`{ "id", "name" }`) in the JSON results, and a `<!-- market: … -->` line in the archived marked-up document.

A finding whose severity a market changes says so at the end of its message, e.g. `(an error in A177, a warning for the market DE)`. A finding that a market turns `off` is not reported at all: not in the HTML or JSON results, the archive or the progress view.

A finding that a market sets to `suppressed` is still shown, but is not an error, warning or information: it is not counted in them, and does not make a document's result worse. Its message ends with its type in A177, e.g. `(a warning in A177, suppressed for the market DE)`. It is in its own list, `suppressed`:
- the HTML results have a **suppressed by the market** count (only when there are any) and a **Suppressed by the market** table, and the marked-up listing shows it as `Suppressed`
- in the traversed documents table and the progress view, its code is shown in grey
- the JSON results have a `suppressed` count (with the other counts, in `totals` and in each tree node), `suppressed` codes in `codes`, and with `results=all` a `suppressed` array
- the archive has it as `(S)`

For example, the German market (without its description):

```json
{
	"id": "DE",
	"name": "Germany",
	"permitted": [
		"r6"
	],
	"revisions": [
		{
			"from": "r6",
			"to": "r6",
			"parameters": {
				"schedule": {
					"daysEitherSide": 7
				},
				"postcode": {
					"digits": 5
				}
			},
			"schemas": {
				"serviceList": "dvbi_v6.0+hls+hbbtv-(DE).xsd",
				"serviceListRegistry": "dvbi_service_list_discovery_v1.6+hls-(DE).xsd"
			},
			"images": {
				"serviceLogo": {
					"width": 320,
					"maxBytes": 64000
				},
				"promotionalStillImage": {
					"width": 640,
					"maxBytes": 100000
				}
			},
			"severity": {
				"AIT006a": "suppressed"
			},
			"rules": {
				"dvbsDirectTuning": true
			}
		}
	]
}
```

### Logging

If a subdirectory named `./arch` exists, then any XML document for validation will be copied there. There will be the original document with the suffix "`.txt`" and a second document with the suffix "`.mkup.txt`" containing line based validation results as XML comments 

If a subdirectory named `./logs` extists, then enhanced HTTP server logging willl be directed there (in addition to the NodeJS console) 

### Use

`<server>/check` gives a basic/primitive UI. Select the valildation type (Service List or Content Guide) and provide either a URL or local file. Press "Validate!" button. Await results!

An uploaded file can be up to 10 MB, the same limit as a document sent in the body of a `POST` to the `/validate_*` endpoints. A larger file is answered with `413`. The form does not use cookies or sessions: it shows the choices just submitted with the results, and the defaults when it is opened again.

#### Service list validation endpoints

`<server>/validate_sl?url=<service_list_url>&market=DE` gives the validation results of the service list in the "url"-parameter as HTML, same format as the /check validation. Also accepts POST request with the servicelist in the request body with content type "application/xml". The url query parameter in the POST request can be used to show the name of the list in the resulting HTML.
The optional `market=` query parameter (with a GET) or `X-market` header (with a POST) validates for a market (see [Markets](#markets)).

`<server>/validate_sl_json?url=<service_list_url>&market=DE` validates the list in the "url"-parameter and gives the number of fatals, errors, warnings and informationals as JSON. Also accepts POST request with the servicelist in the request body with content type "application/xml" instead of the url query parameter.
The optional `market=` query parameter (with a GET) or `X-market` header (with a POST) validates for a market (see [Markets](#markets)).
Example response:

```json
{
	"fatals": 0,
	"errors": 1,
	"warnings": 0,
	"informationals": 0,
	"suppressed": 0
}
```

If the document cannot be retrieved, a `parseErr` array describing the problem is included in the same JSON object, e.g.

```json
{
	"parseErr": ["error (404:Not Found) handling https://example.com/list.xml"],
	"fatals": 0,
	"errors": 0,
	"warnings": 0,
	"informationals": 0,
	"suppressed": 0
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
	"fatals": 0, "errors": 345, "warnings": 39, "informationals": 0, "suppressed": 0,
	"traversed": {
		"documents": 30, "skipped": 9404, "repeats": 671,
		"withFatals": 0, "withErrors": 11, "withWarnings": 11,
		"totals": { "fatals": 0, "errors": 319, "warnings": 76, "informationals": 1581, "suppressed": 0 },
		"traversal": { "TRAV003": 9404 }
	},
	"timing": { "durationMs": 3120, "documentsTraversed": 30, "...": "..." }
}
```

###### Schedule coverage

With traversal, the schedule of each service is requested in 6 hour windows, from 28 days before today to 28 days after (7 days for the German market, `market=DE`), as A177r8 clause 6.5.2.2 allows. The requests include `inclusive=true`, so that a server that supports it also returns the events that started before each window. The events of all of a service's windows give the coverage of each UTC day:
- `full`: the programme events cover the whole day. A gap of up to 5 minutes is not counted.
- `partial`: the events cover part of the day.
- `none`: no events cover the day, including when its requests failed (the failures have their own errors, such as `VCG002`).
- `indeterminate`: a window of the day was not requested because a traversal limit was reached (`TRAV002`, `TRAV003`), and the windows that were validated do not show a gap.

A service whose schedule does not cover a day (`partial` or `none`) has a warning, `SL201`, with the number of days in each state and the dates. Each service needs 228 windows (60 for the German market), so with the default `max_traversal` of 100 most days are `indeterminate`: use a higher maximum, or `unlimited`, to check the coverage.

Several services can use the same service ID for their schedule (`ContentGuideServiceRef`). Their schedule is requested and reported once, with the services that use it in `services`. The HTML report has a **Schedule coverage** section, with a row of days for each schedule. The JSON summary and tree have a `scheduleCoverage` array, with an entry for each service:

```json
"scheduleCoverage": [{
	"service": "tag:example.com,2026:service-1", "services": ["tag:example.com,2026:service-1"], "daysEitherSide": 7,
	"counts": { "full": 13, "partial": 1, "none": 1, "indeterminate": 0 },
	"days": [{ "date": "2026-11-17", "state": "full", "coveredMinutes": 1440 }, "..."]
}]
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
		"counts": { "fatals": 0, "errors": 345, "warnings": 39, "informationals": 0, "suppressed": 0 },
		"codes": { "errors": { "SL263": 18, "SI112-53": 327 }, "warnings": { "SL270": 38, "SL283": 1 } },
		"nested": [
			{ "url": "https://example.com/sip?sid=1&now_next=true", "type": "NowNext", "description": "Now/Next", "severity": "error",
			  "counts": { "fatals": 0, "errors": 8, "warnings": 2, "informationals": 28, "suppressed": 0 },
			  "codes": { "errors": { "AV020": 2, "AV051-53": 6 }, "warnings": { "AV051-52a": 2 }, "informationals": { "PI021-3": 28 } },
			  "omitted": 2 }
		],
		"omitted": 9332
	}
}
```

`<server>/validate_sl_json?url=<service_list_url>&results=all` validates the list in the "url"-parameter and gives the complete validation results as JSON. The marked-up copy of the document (`markupXML`) is not included. The HTTP status is 200 whenever the request is accepted, including when the document cannot be retrieved: check for `parseErr` in the response. Also accepts POST request with the servicelist in the request body with content type "application/xml" instead of the url query parameter. 
The optional `market=` query parameter (with a GET) or `X-market` header (with a POST) validates for a market (see [Markets](#markets)).
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
		"suppressed": [],
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

#### XML AIT validation endpoints

`<server>/validate_ait?url=<xml_ait_url>&role=<role>` gives the validation results of the XML AIT in the "url"-parameter as HTML, same format as the /check validation. `<server>/validate_ait_json?url=<xml_ait_url>&role=<role>` gives them as JSON, in the same format as `/validate_sl_json` (with `results=all` for the complete results). Both also accept a POST request with the XML AIT in the request body with content type "application/xml". On the /check form, choose **XML AIT** and how it is used.

An XML AIT in the `urn:dvb:mhp:2026` namespace (the ETSI version, also in the electronic attachments of the A177r8 second edition) or the older `urn:dvb:mhp:2009` namespace (ETSI TS 102 809 v1.2.1 and v1.3.1) is checked against its schema, in `schemas/ts102809/`. The rules of A177 depend on how the AIT is used, given by `<role>`:

- `linked` (the default) - the application of a service, service instance or service list, signalled in a `<RelatedMaterial>` (A177r8 clause 5.2.3)
- `deeplink` - a content deep-linked XML AIT, from `<OnDemandProgram><ProgramURL>` or a restart link (A177r8 clause 5.2.4.3)
- `template` - a Template XML AIT, from `<OnDemandProgram><AuxiliaryURL>`, a restart link or a box set (A177r8 clause 5.2.4.4)

The codes:
- `AIT001` the document is not well formed; `AIT002` the root element is not `<ServiceDiscovery>`; `AIT003` it has no namespace; `AIT004` the namespace is not supported
- `AIT005:2009`, `AIT005:2026` the document is not valid against the schema of its namespace. In `urn:dvb:mhp:2026`, which has `attributeFormDefault="qualified"`, the attributes defined by the XML AIT schema itself are namespace qualified, e.g. `<mhp:applicationLocation mhp:verificationPolicy="...">`
- `AIT006a` (warning, suppressed for the market `DE`) the AIT uses the old schema `urn:dvb:mhp:2009`, which is replaced by `urn:dvb:mhp:2026`; `AIT006b` (warning) the schema is a draft
- `AIT009` the role is not one of those above
- `AIT010` (information) an application is of a type that a DVB-I client does not run: only `application/vnd.hbbtv.xhtml+xml`, `text/html` and `application/xhtml+xml` are run (A177r8 clause 5.2.4.1, 5.2.4.2)
- `AIT011` (information) the deep link says that the content is not available to the device (`application/vnd.dvbi.non`, A177r8 clause 5.2.4.2); `AIT012` (warning) `application/vnd.dvbi.non` in an AIT that is not a deep link
- `AIT013` (warning) the AIT has no application that a DVB-I client can run, so the service or content is shown as unavailable
- `AIT014` (warning) two applications have the same type, `<mhpVersion>` and `<priority>`, so the client's choice between them is ambiguous (A177r8 clause 5.2.4.2)
- `AIT015` the applications of a deep link or template do not all have the same `<orgId>` and `<appId>` (A177r8 clause 5.2.4.3, 5.2.4.4.1)
- `AIT016` an HTTP transport's `<URLBase>` is not an HTTP or HTTPS URL; `AIT017` `<URLBase>` followed by `<applicationLocation>` is not a valid URL (A177r8 clause 5.2.4.3)
- `AIT018` (information) an application has no HTTP transport, so it cannot be launched from broadband
- `AIT019` (warning) the launch location uses a query parameter that the client appends as a contextual parameter, `regionID[]` or `lloc` (A177r8 clause 5.2.4.3, 5.2.4.4.6)
- `AIT024` (warning) an HbbTV application has no `<mhpVersion>`, so its platform profile cannot be determined (A177r8 clause 5.2.4.2); `AIT025` (warning) its version is not one of 1.1.1 to 1.8.1; `AIT026` (warning) its application profile uses bits other than `0x0001` and `0x0002` (ETSI TS 102 796 v1.8.1 clause 7.2.3.1)
- `AIT027-1` (information) the launch location has a signature policy (`<applicationLocation mhp:verificationPolicy>`, `urn:dvb:mhp:2026`), but the AIT was not reached from a service list, so it is not checked; `AIT027-2` (warning) the policy is not defined by the service list that refers to the AIT; `AIT027-3` (warning) the launch location is not an `https` URL
  When the referring service list defines the policy (with `aits`), the response of each launch location (`<URLBase>` followed by `<applicationLocation>`) is retrieved once and checked against it, as for any other reference with a signature policy (A177r8 clause 7.6.2.1): its `X-JWS-Signature` (`JWS001` to `JWS010`, when response signatures are checked) and the certificate chain of its server (when connection certificates are checked). The findings are on the `<applicationLocation>`, with the results of the AIT. The launch location is requested with the validator's own `User-Agent` and without the query parameters that a client adds (A177r8 clause 5.2.3.2.5), so a server that answers a DVB-I client differently may give a different result.

The XML AITs that service lists and content guides refer to are also validated when the request asks for it: **Validate referenced XML AITs** on the /check form (for service lists, registries and content guides), or `aits=true` in the query of a `GET` (`X-aits: true` with a `POST`) to the `/validate_sl`, `/validate_cg` and `/validate_slr` endpoints. It is off by default, as every On Demand programme can refer to its own AIT. The role comes from the element that refers to the AIT:

- `linked`: the `<MediaUri contentType="application/vnd.dvb.ait+xml">` of a linked application in a service list
- `deeplink`: `<OnDemandProgram><ProgramURL>`, and the `<MediaUri>` of a restart link
- `template`: `<OnDemandProgram><AuxiliaryURL>`, the `<AuxiliaryURI>` of a restart link, and the `<AuxiliaryURI>` of a box set's Template AIT

Both URLs of a restart link (A177r8 clause 6.5.5.3) are XML AITs, so when `@contentType` is omitted from its `<MediaUri>` or `<AuxiliaryURI>`, as in A177r8 figure 11, `application/vnd.dvb.ait+xml` is assumed, with the warning `RR004`. Another `@contentType` is an error, `RR005`, and that URL is not validated as an AIT.

Each AIT URL is validated once in a validation (a repeat is counted against the first reference), and counts as a traversed document against the limits of traversal. An AIT whose reference also has a content digest (`@integrity`) or a signature policy (`@verificationPolicy`) is retrieved once for all of these checks. Its results are with those of the referring document, like those of a traversed document. A referenced AIT also has:
- `AIT020` (warning) the response's `Content-Type` is not `application/vnd.dvb.ait+xml` (A177r8 clause 5.2.4.1)
- `AIT021` (information) a Template XML AIT has neither an `Expires` header nor `Cache-Control: max-age`, so a client assumes that it expires 24 hours after it is retrieved (A177r8 clause 5.2.4.4.5)
- `AIT029` (information) an application of a service provider (`LinkedApplicationCS:2019:3`) or service list (`4.1`, `4.2`, `4.3`) application has no `<icon>`, which it may have (A177r8 clause 5.2.3.1)
- `AIT030` the AIT cannot be retrieved; `AIT031` its request does not return a `2xx` status


#### Health

`<server>/healthz` answers `200` with `ok` when the server is ready, and `503` with `starting` until the service list registry has been read, or `stopping` while it shuts down. It is not written to the request log.

#### Security headers

Every response has the standard security headers (`helmet`), and this content security policy:

```
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'self'; base-uri 'none'
```

The pages load their stylesheet and script from `<server>/ui/validator.css` and `<server>/ui/validator.js`, and have no inline scripts or styles. The policy has no `upgrade-insecure-requests`, so a validator served over HTTP only still works. There is no `Strict-Transport-Security` header, and `Cross-Origin-Resource-Policy` is `cross-origin`, so the endpoints can be used from other origins.

## Acknowledgements

A 2026 code review of this repository, and the fixes that came out of it (output escaping, a single fetch policy for retrieved documents, resource clean-up, schema validator reuse, TypeScript and CI checks, and Docker and server start-up fixes), were carried out with help from [Claude](https://claude.com/claude-code), an AI assistant by Anthropic.

*Copyright (c) 2021-2026, Paul Higgs*<br/>
*All rights reserved*