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
- *inlineImages* default is "false"


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

- --port [-p] set the HTTP listening port (default: 3000)
- --sport [-s] set the HTTPS listening port (default: 3001)
- --urls [-u] load configation from network locations (default: use local files)
- --file [-f] name of the master registry file to use, can be an http(s) URL (default: ./slepr-master.xml)
- --CORSmode [-c] select the type of CORS handling
  - "library" - default mode - use the Express CORS library
  - "manual" - do code based CORS header insertion (not fully implemented or tested)
  - "none" - dont do any CORS handling
- --help [-h] server and client command help

If you want to start an HTTPS server, make sure you have `selfsigned.crt` and `selfsigned.key` files in the same directory. These can be generated (on Linux) with `sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt`

## validate_sl.js

DVB-I Service List validator

### Description

Validates the value space of the instance document, validation against the schema should be performed seperately (for now) Supports

- the [:2019 schema](http://dvb.org/wp-content/uploads/2019/11/A177_DVB-I_Nov_2019.pdf)
- the [:2020 schema](https://dvb.org/wp-content/uploads/2019/11/A177r1_Service-Discovery-and-Programme-Metadata-for-DVB-I_July-2020.pdf) with its classification scheme updates
- the [:2021 schema](https://dvb.org/wp-content/uploads/2020/11/A177r2_Service-Discovery-and-Programme-Metadata-for-DVB-I_ts_103-770-v120_June-2021.pdf) with its classification scheme updates
- the [:2022 schema](https://dvb.org/wp-content/uploads/2021/06/A177r3_Service-Discovery-and-Programme-Metadata-for-DVB-I_January-2022.pdf)
- the [:2022b schema](https://dvb.org/wp-content/uploads/2022/01/A177r4_Service-Discovery-and-Programme-Metadata-for-DVB-I_Interim-Draft_TS-103-770-v121_September-2022.pdf)
- the [:2023 schema](https://dvb.org/wp-content/uploads/2022/09/A177r5_Service-Discovery-and-Programme-Metadata-for-DVB-I_Interim-Draft_TS-103-770-v121_July-2023.pdf)
- the [:2024 schema](https://dvb.org/wp-content/uploads/2023/07/A177r6_Service-Discovery-and-Programme-Metadata-for-DVB-I_Draft_TS-103-770-v121_February-2024.pdf) ([latest details](https://dvb.org/?standard=service-discovery-and-programme-metadata-for-dvb-i))

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

### Use

&lt;server&gt;/check gives a basic/primitive UI. Enter the URL to your service list or a local filename and press "Submit" button. Await results!

### Installation

1. Clone this repository `git clone --recurse-submodules https://github.com/paulhiggs/dvb-i-tools.git`
1. Install necessary libraries (express, libxmljs, morgan) `npm install`
1. run it - `node validate_sl [--port 3010] [--sport 3011]`

If you want to start an HTTPS server, make sure you have `selfsigned.crt` and `selfsigned.key` files in the same directory. These can be generated (on Linux) with `sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt`

Occassionally, the language-subtag-registry file can be updated from https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry

#### Command Line Arguments

- --urls [-u] forces the classification scheme, country and language values to be read from the internet. Default is to load values from local files.
- --port [-p] set the HTTP listening port (default: 3010)
- --sport [-s] set the HTTPS listening port (default: 3011)

## validate_cg.js

DVB-I Content Guide validator

### Description

Validates the value space of the instance document, validation against the schema should be performed seperately (for now)

Checks performed:

- ensure only the permitted elements are present in &lt;ProgramDescription&gt;
- &lt;BasicDescription&gt; sub-elements (&lt;Title&gt;, &lt;Synopsis&gt;, &lt;Keyword&gt;, &lt;Genre&gt;, &lt;CreditsList&gt;, &lt;ParentalGuidance&gt;, &lt;RelatedMaterial&gt;) in &lt;ProgramInformation&gt;

### Use

#### URL based validation

&lt;server&gt;/check gives a basic/primitive UI. Enter the URL for a content guide query and the type of query/response from the endpoint. Press "Submit" button and await results!

#### File based validation

&lt;server&gt;/checkFile gives a basic/primitive UI. Select the file containing a DVB-I content guide metadata fragment and the type of response from the endpoint. Press "Submit" button and await results!

### Installation

1. Clone this repository `git clone --recurse-submodules https://github.com/paulhiggs/dvb-i-tools.git`
1. Install necessary libraries (express, libxmljs, morgan) `npm install`
1. run it - `node validate_cg [--urls] [--port 3020] [--sport 3021]`

If you want to start an HTTPS server, make sure you have `selfsigned.crt` and `selfsigned.key` files in the same directory. These can be generated (on Linux) with `sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt`

#### Command Line Arguments

- --urls [-u] forces the classification scheme, country and language values to be read from the internet. Default is to load values from local files.
- --port [-p] set the HTTP listening port (default: 3020)
- --sport [-s] set the HTTPS listening port (default: 3021)

## all-in-one.js

Implements csr.js, validate_cg.js and validate_sl.js in a single node

### Description

Same as for the individual applications

### Use

&lt;server&gt;/check gives a basic/primitive UI. Select the valildation type (service list or Content Guide) and provide either a URL or local file. Press "Validate!" button. Await results!

&lt;server&gt;/validate_sl?url=&lt;service_list_url&gt; gives the validation results of the service list in the "url"-parameter as HTML, same format as the /check validation. Also accepts POST request with the servicelist in the request body with content type "application/xml". The url query parameter in the POST request can be used to show the name of the list in the resulting HTML

&lt;server&gt;/validate_sl_json?url=&lt;service_list_url&gt; valdiates the list in the "url"-parameter and gives the number of errors, warnings and informationals as JSON. Also accepts POST request with the servicelist in the request body with content type "application/xml"  instead of the url query parameter. Example response:
```json
{
  "errors":1,
  "warnings":0,
  "informationals":0
}
```
&lt;server&gt;/validate_sl_json?url=&lt;service_list_url&gt;&results=all valdiates the list "url"-parameter and gives the complete validation results as JSON. Also accepts POST request with the servicelist in the request body with content type "application/xml" instead of the url query parameter. Example response:
```json
{
  "errs":
    {
    "countsErr":[],
    "countsWarn":[],
    "countsInfo":[],
    "errors":[
      {
      "code":"SL005:6",
      "message":"Error: Element '{urn:dvb:metadata:servicediscovery:2024}Service': Missing child element(s). Expected is one of ( {urn:dvb:metadata:servicediscovery:2024}ServiceName, {urn:dvb:metadata:servicediscovery:2024}ProviderName ).\n",
      "element":"    <Service version=\"1\">","line":3
      }
    ],
    "warnings":[],
    "informationals":[],
    "markupXML":[
      {"value":"<?xml version=\"1.0\" encoding=\"UTF-8\"?>","ix":1},{"value":"<ServiceList xmlns=\"urn:dvb:metadata:servicediscovery:2024\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema‑instance\" id=\"tag:example.com,2024:list1\" version=\"20240611115822\" xml:lang=\"en\">","ix":2},
      {"value":"  <Name>List</Name>","ix":3},
      {"value":"  <ProviderName>Provider</ProviderName>","ix":4},
      {"value":"  <Service version=\"1\">","ix":5,
        "validationErrors":[
          "(E) SL005:6: Error: Element '{urn:dvb:metadata:servicediscovery:2024}Service': Missing child element(s). Expected is one of ( {urn:dvb:metadata:servicediscovery:2024}ServiceName, {urn:dvb:metadata:servicediscovery:2024}ProviderName ).\n"
          ]
      },
      {"value":"   <UniqueIdentifier>tag:example.com,2024:ch1</UniqueIdentifier>","ix":6},
      {"value":"   <ServiceName>Service</ServiceName>","ix":7},
      {"value":" </Service>","ix":8},
      {"value":"</ServiceList>","ix":9}
    ],
    "errorDescriptions":[]
  }
}
```
### Installation

1. Clone this repository `git clone --recurse-submodules https://github.com/paulhiggs/dvb-i-tools.git`
1. Install necessary libraries (express, libxmljs, morgan) `npm install`
1. run it - `node all-in-one [--port 3030] [--sport 3031] [--CORSmode library]`

If you want to start an HTTPS server, make sure you have `selfsigned.crt` and `selfsigned.key` files in the same directory. These can be generated (on Linux) with `sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt`

#### Command Line Arguments

- --urls [-u] forces the classification scheme, country and language values to be read from the internet. Default is to load values from local files.
- --port [-p] set the HTTP listening port (default: 3030)
- --sport [-s] set the HTTPS listening port (default: 3031)
- --nocsr do not start the CSR function
- --nosl do not offer service list validation
- --nocg do not offer content guide validation
- --CORSmode [-c] select the type of CORS handling
  - "library" - default mode - use the Express CORS library
  - "manual" - do code based CORS header insertion (not fully implemented or tested)
  - "none" - dont do any CORS handling

### Installation alternative (Docker)

1. Clone this repository `git clone --recurse-submodules https://github.com/paulhiggs/dvb-i-tools.git`
2. run it - `docker compose up`
