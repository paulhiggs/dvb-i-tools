/**
 * MHP_definitions.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Element and attribute names, namespaces and values of the XML AIT (ETSI TS 102 809 clause 5.4), and the media types
 * that A177 gives for the applications it signals (issue #134)
 */

export const mhp = new class {
	// namespaces of the XML AIT
	MHP_2009_Namespace: string = "urn:dvb:mhp:2009" // ETSI TS 102 809 v1.2.1 and v1.3.1 (old)
	MHP_2026_Namespace: string = "urn:dvb:mhp:2026" // the ETSI version, also in the A177r8 second edition electronic attachments

	e_ServiceDiscovery: string = "ServiceDiscovery"
	e_ApplicationDiscovery: string = "ApplicationDiscovery"
	e_ApplicationList: string = "ApplicationList"
	e_Application: string = "Application"
	e_appName: string = "appName"
	e_applicationIdentifier: string = "applicationIdentifier"
	e_orgId: string = "orgId"
	e_appId: string = "appId"
	e_applicationDescriptor: string = "applicationDescriptor"
	e_type: string = "type"
	e_DvbApp: string = "DvbApp"
	e_OtherApp: string = "OtherApp"
	e_priority: string = "priority"
	e_mhpVersion: string = "mhpVersion"
	e_profile: string = "profile"
	e_versionMajor: string = "versionMajor"
	e_versionMinor: string = "versionMinor"
	e_versionMicro: string = "versionMicro"
	e_applicationTransport: string = "applicationTransport"
	e_URLBase: string = "URLBase"
	e_applicationLocation: string = "applicationLocation"

	a_type: string = "type" // xsi:type of <applicationTransport>
	HTTP_TRANSPORT: string = "HTTPTransportType"
	OC_TRANSPORT: string = "OCTransportType"

	// application types (<applicationDescriptor><type><OtherApp>) that a DVB-I client runs (A177r8 clause 5.2.4.1, 5.2.4.2)
	HBBTV_APP: string = "application/vnd.hbbtv.xhtml+xml"
	HTML5_APP: string = "text/html"
	XHTML_APP: string = "application/xhtml+xml"
	// the type of an AIT returned when the content is not available to the device (A177r8 clause 5.2.4.2)
	NOT_AVAILABLE_APP: string = "application/vnd.dvbi.non"

	// the query parameters that a DVB-I client appends to an XML AIT URL (A177r8 clause 5.2.4.4.6)
	CONTEXT_PARAMETERS: string[] = ["regionID[]", "lloc"]
};

// the application types that a DVB-I client is expected to run
export const DVBI_APPLICATION_TYPES: string[] = [mhp.HBBTV_APP, mhp.HTML5_APP, mhp.XHTML_APP];

/**
 * how an XML AIT is used, as the rules of A177 differ for each (issue #134):
 * - linked: the application of a service, service instance or service list (A177r8 clause 5.2.3)
 * - deeplink: a content deep-linked XML AIT, from OnDemandProgram.ProgramURL or a restart link (A177r8 clause 5.2.4.3)
 * - template: a Template XML AIT, from OnDemandProgram.AuxiliaryURL, a restart link or a box set (A177r8 clause 5.2.4.4)
 */
export const AIT_ROLE_LINKED = "linked",
	AIT_ROLE_DEEPLINK = "deeplink",
	AIT_ROLE_TEMPLATE = "template";
export const AIT_ROLES: { value: string; label: string }[] = [
	{ value: AIT_ROLE_LINKED, label: "Linked application" },
	{ value: AIT_ROLE_DEEPLINK, label: "Content deep link" },
	{ value: AIT_ROLE_TEMPLATE, label: "Template" },
];
