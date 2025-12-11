# dvb-i-tools

Pauls DVB Tools

## csr.js - a DVB-I CSR / SLR

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

1. Clone this repository `git clone --recurse-submodules https://github.com/paulhiggs/dvb-i-tools.git`
1. Install necessary libraries (express, libxmljs, morgan) `npm install`

### Operation

1. Edit the Service List Entry Point Registry XML document (`slepr-master.xml`) as needed
1. run it - `node csr.js [--port 3000] [--sport 3001] [--file ./slepr-master.xml] [--CORSmode library]`

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

## all-in-one.js

Implements csr.js, validate_cg.js and validate_sl.js in a single node

### Description

Validates DVB-I service list and content guide metadata according to DVB Bluebook A177

#### Service List checks (non-exhaustive)

Validates the value space of the instance document, validation against the schema should be performed seperately (for now) Supports

- the original A177 [:2019 schema](http://dvb.org/wp-content/uploads/2019/11/A177_DVB-I_Nov_2019.pdf)
- the A177r1 [:2020 schema](https://dvb.org/wp-content/uploads/2019/11/A177r1_Service-Discovery-and-Programme-Metadata-for-DVB-I_July-2020.pdf) with its classification scheme updates
- the A177r2 [:2021 schema](https://dvb.org/wp-content/uploads/2020/11/A177r2_Service-Discovery-and-Programme-Metadata-for-DVB-I_ts_103-770-v120_June-2021.pdf) with its classification scheme updates
- the A177r3 [:2022 schema](https://dvb.org/wp-content/uploads/2021/06/A177r3_Service-Discovery-and-Programme-Metadata-for-DVB-I_January-2022.pdf)
- the A177r4 [:2022b schema](https://dvb.org/wp-content/uploads/2022/01/A177r4_Service-Discovery-and-Programme-Metadata-for-DVB-I_Interim-Draft_TS-103-770-v121_September-2022.pdf)
- the A177r5 [:2023 schema](https://dvb.org/wp-content/uploads/2022/09/A177r5_Service-Discovery-and-Programme-Metadata-for-DVB-I_Interim-Draft_TS-103-770-v121_July-2023.pdf)
- the A177r6 [:2024 schema](https://dvb.org/wp-content/uploads/2023/07/A177r6_Service-Discovery-and-Programme-Metadata-for-DVB-I_Draft_TS-103-770-v121_February-2024.pdf)
- the A177r7 [:2025 schema](https://dvb.org/wp-content/uploads/2024/09/A177r7_Service-Discovery-and-Programme-Metadata-for-DVB-I_Interim-Draft_TS-103-770-v131_July-2025.pdf) ([latest details](https://dvb.org/?standard=service-discovery-and-programme-metadata-for-dvb-i))
- the A177r8 :2026 schema - currently in development

Checks performed:

- validation against the appropriate schema
- channel numbers are not duplictaed in LCN tables
- region identifiers are unique
- service identifiers are
  - unique
  - formatted according to the TAG URI scheme
- country codes are valid against ISO3166 aplha 3 for region tables and delivery parameters for DVB-T and DVB-C
- regions are not excessively nested
- @countryCodes attribute is not specified for sub-regions
- ServiceGenre is selected from
  - TV Anytime ContentCS
  - TV Anytime FormatCS
  - DVB ContentSubjectCS
- AudioAttributes@href and AudioConformancePoints@href (deprecated in A177r5) accorinding to
  - DVB AudioCodecCS and DVB AudioCodecCS:2020
  - MPEG7 AudioCodingFormatCS
  - DVB AudioConformancePointsCS
- VideoAttributes@href and VideoConformancePoints@href accorinding to
  - DVB VideoCodecCS and DVB VideoCodecCS:2020
  - MPEG7 VisualCodingFormatCS
  - DVB VideoConformancePointsCS
- ServiceType according to DVB ServiceTypeCS-2019
- TargetRegion for the Service List, LCN Table and Services are defined in the region table
- Validation of &lt;RelatedMaterial&gt; for Service List, Service, Service Instance, Content Guide Source
- Unique @CGSID values
- &lt;ContentGuideSourceRef&gt; refers to a &lt;ContentGuideSource&gt; in the &lt;ContentGuideSourceList&gt;
- &lt;ContentGuideServiceRef&gt; for a servie is not the same as the &lt;UniqueIdentifier&gt; (warning)
- &lt;SourceType&gt; is according to specification and appropriate DeliveryParameters are provided (note that &lt;SourceType&gt; is deprecated)
- For &lt;DASHDeliveryParameters&gt;
  - valid @contentType in &lt;UriBasedLocation&gt;
- only one element for each @xml:lang is specified in any mpeg7:TextualType element
- SAT&gt;IP parameters are only specified with DVB-T or DVB-S delivery parameters
- unique service prominence values
- unigue global and national parental rating values for services and program metadata
- correct use of accessibility features and applications signalling

#### Content Guide checks (non-exhaustive)

Validates the value space of the instance document

- ensure only the permitted elements are present in &lt;ProgramDescription&gt;
- &lt;BasicDescription&gt; sub-elements (&lt;Title&gt;, &lt;Synopsis&gt;, &lt;Keyword&gt;, &lt;Genre&gt;, &lt;CreditsList&gt;, &lt;ParentalGuidance&gt;, &lt;RelatedMaterial&gt;) in &lt;ProgramInformation&gt;

### Installation

#### node.js

1. Clone this repository `git clone --recurse-submodules https://github.com/paulhiggs/dvb-i-tools.git`
1. Install necessary libraries (express, libxmljs, morgan) `npm install`
1. run it - `node all-in-one [--urls] [--port 3030] [--sport 3031]`

If you want to start an HTTPS server, make sure you have `selfsigned.crt` and `selfsigned.key` files in the same directory. These can be generated (on Linux) with `sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt`

Occassionally, the language-subtag-registry file can be updated from https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry

#### Docker

1. Clone this repository `git clone --recurse-submodules https://github.com/paulhiggs/dvb-i-tools.git`
1. run it - `docker compose up`

### Command Line Arguments

- `--urls [-u]` forces the classification scheme, country and language values to be read from the internet. Default is to load values from local files.
- `--port [-p] <port>` set the HTTP listening port (default: 3030)
- `--sport [-s] <port>` set the HTTPS listening port (default: 3031)
- `--motd [-m] <filename>` file to read for Message of the Day (default: `motd.html`)
- `--nocsr` flag to disable SLR operation (default: false)
- `--nocg` flag to disable Content Guide validation (default: false)
- `--nosl` flag to disable Service List validation (default: false)
- `--noslr` flag to disable Service List Registry validation (default: false)
- `--CORSmode [-c] <mode>` select the type of CORS handling
  - `"library"` - default mode - use the Express CORS library
  - `"manual"` - do code based CORS header insertion (not fully implemented or tested)
  - `"none"` - dont do any CORS handling
- `--CSRfile [-f] <filename>` file to use for SLR responses (default: `./registries/slepr-main.xml`)
- `--SLRmode <mode>` select the type of processing for the SLR response
  - `"default"` - default mode - according to A177 specification
- `--help [-h]` server and client command help

### Use

`<server>/check` gives a basic/primitive UI. Select the valildation type (service list or Content Guide) and provide either a URL or local file. Press "Validate!" button. Await results!

#### Service list validation endpoints

`<server>/validate_sl?url=<service_list_url>` gives the validation results of the service list in the "url"-parameter as HTML, same format as the /check validation. Also accepts POST request with the servicelist in the request body with content type "application/xml". The url query parameter in the POST request can be used to show the name of the list in the resulting HTML

`<server>/validate_sl_json?url=<service_list_url>;` valdiates the list in the "url"-parameter and gives the number of errors, warnings and informationals as JSON. Also accepts POST request with the servicelist in the request body with content type "application/xml" instead of the url query parameter. Example response:

```json
{
	"errors": 1,
	"warnings": 0,
	"informationals": 0
}
```

`<server>/validate_sl_json?url=<service_list_url>&results=all` valdiates the list "url"-parameter and gives the complete validation results as JSON. Also accepts POST request with the servicelist in the request body with content type "application/xml" instead of the url query parameter. Example response:

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
		"markupXML": [
			{ "value": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>", "ix": 1 },
			{
				"value": "<ServiceList xmlns=\"urn:dvb:metadata:servicediscovery:2024\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema‑instance\" id=\"tag:example.com,2024:list1\" version=\"20240611115822\" xml:lang=\"en\">",
				"ix": 2
			},
			{ "value": "  <Name>List</Name>", "ix": 3 },
			{ "value": "  <ProviderName>Provider</ProviderName>", "ix": 4 },
			{
				"value": "  <Service version=\"1\">",
				"ix": 5,
				"validationErrors": [
					"(E) SL005:6: Error: Element '{urn:dvb:metadata:servicediscovery:2024}Service': Missing child element(s). Expected is one of ( {urn:dvb:metadata:servicediscovery:2024}ServiceName, {urn:dvb:metadata:servicediscovery:2024}ProviderName ).\n"
				]
			},
			{ "value": "   <UniqueIdentifier>tag:example.com,2024:ch1</UniqueIdentifier>", "ix": 6 },
			{ "value": "   <ServiceName>Service</ServiceName>", "ix": 7 },
			{ "value": " </Service>", "ix": 8 },
			{ "value": "</ServiceList>", "ix": 9 }
		],
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

## validate_sl.js

This standalone app is now removed. Use `all-in-one.js --nocsr --nocg` instead.

## validate_cg.js

This standalone app is now removed. Use `all-in-one.js --nocsr --nosl` instead.
