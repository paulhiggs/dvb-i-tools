/**
 * ait_check.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Check an XML AIT (ETSI TS 102 809 clause 5.4) against its schema and the rules of A177 for the applications that a
 * DVB-I client launches (issue #134). The rules differ for the role of the AIT: the application of a service (A177r8
 * clause 5.2.3), a content deep link (clause 5.2.4.3) or a template (clause 5.2.4.4)
 */

import process from "process"

import chalk from "chalk"
import { XmlDocument } from "libxml2-wasm"

import ErrorList, { APPLICATION, INFORMATION, WARNING } from "./error_list.mts"
import { mhp, DVBI_APPLICATION_TYPES, AIT_ROLES, AIT_ROLE_LINKED, AIT_ROLE_DEEPLINK, AIT_ROLE_TEMPLATE } from "./MHP_definitions.mts"
import { keys } from "./common_errors.mts"
import { SchemaCheck, SchemaLoad } from "./schema_checks.mts"
import { XMLAIT_Schema, schemaURL } from "./data_locations.mts"
import document_logger from "./logger.mts"
import { isHTTPURL, isHTTSPURL } from "./pattern_checks.mts"
import { allowTraversal, claimTraversal, currentRequest, currentValidation, deferRetrieval, documentRevision, safeFetch, setDocumentRevision, signaturePoliciesInEffect, ValidationScope } from "./safe_fetch.mts"
import { A177Revision } from "./revisions.mts"
import type { ValidationOptions } from "./safe_fetch.mts"
import { nestedTraversal, traversalFinished, traversalSkipped, traversalStarted } from "./traversal.mts"
import { checkSignedLocation, retrieveResource } from "./resource_checks.mts"
import type { ResourceOutcome } from "./resource_checks.mts"
import { dvbi } from "./DVB-I_definitions.mts"
import { StandardStatus } from "./globals.mts"
import type { StatsType, LoadOptions } from "./globals.mts"
import { readmyfile } from "./utils.mts"

// initialise string formatting extensions
import {} from "./string-extensions.mts"

// the choices of an XML AIT validation (see ValidationRequest)
export type AIT_Validator_Options = ValidationOptions

// what is known about an XML AIT from the document that refers to it (values for this one document, not choices of the
// request)
export type AIT_Reference = {
	linkedApplicationType?: string; // HowRelated@href of the linked application (LinkedApplicationCS:2019) that refers to it
};

// the linked applications that may have a name and icons in their XML AIT (A177r8 clause 5.2.3.1)
const NAMED_APPLICATIONS = [dvbi.APP_SERVICE_PROVIDER, dvbi.APP_LIST_INSTALLATION, dvbi.APP_WITHDRAW_AGREEMENT, dvbi.APP_RENEW_AGREEMENT];

const AIT_KEY = "XML AIT";

type AITSchemaVersion = {
	namespace: string;
	label: string; // used in the code of schema errors, e.g. AIT005:2009
	filename: string;
	schema?: XmlDocument;
	status: number;
};

const AIT_SchemaVersions: AITSchemaVersion[] = [
	// the ETSI version of the schema, also in the electronic attachments of the A177r8 second edition
	{ namespace: mhp.MHP_2026_Namespace, label: "2026", filename: XMLAIT_Schema.v2026.file, status: StandardStatus.ETSI },
	// ETSI TS 102 809 v1.2.1 and v1.3.1, replaced by urn:dvb:mhp:2026
	{ namespace: mhp.MHP_2009_Namespace, label: "2009", filename: XMLAIT_Schema.v2009.file, status: StandardStatus.OLD },
];

let AITschemasLoaded = false;
function LoadAITschemas(opts: LoadOptions): void {
	if (AITschemasLoaded) return;
	AITschemasLoaded = true;
	if (opts.verbose) console.log(chalk.yellow.underline("loading XML AIT schemas..."));
	AIT_SchemaVersions.forEach((version) => {
		if (opts.verbose) process.stdout.write(chalk.yellow(`..loading ${version.namespace} from ${version.filename} `));
		const buf = readmyfile(version.filename, {}) as Buffer;
		if (buf) version.schema = XmlDocument.fromBuffer(buf, { url: schemaURL(version.filename) });
		if (opts.verbose) process.stdout.write(`${version.schema ? chalk.green("OK") : chalk.red.bold("FAIL")}\n`);
	});
}

// what the rules need to know about each <Application>
type ApplicationInfo = {
	element: XmlElement;
	type?: string; // the <OtherApp> media type, or "DvbApp <value>"
	otherApp?: string;
	orgId?: string;
	appId?: string;
	priority: number;
	mhpVersion: string; // "<profile> <major>.<minor>.<micro>", or "" when it is not given
	version?: { profile: number; release: string }; // the <mhpVersion>: its profile, and "<major>.<minor>.<micro>"
	hasIcon: boolean;
};

const hexValue = (value: string | undefined): number => (value == undefined ? NaN : parseInt(value, 16));
const childText = (element: XmlElement | null | undefined, name: string): string | undefined => element?.getAnyNs(name)?.content.trim();

/**
 * the URL formed by a launch location, or undefined if it is not a valid HTTP(S) URL
 */
function launchURL(location: string): URL | undefined {
	try {
		return isHTTPURL(location) ? new URL(location) : undefined;
	} catch {
		return undefined; // malformed %-encoding
	}
}

export default class XmlAitCheck {
	#numRequests: number;

	constructor(opts: LoadOptions) {
		LoadAITschemas(opts);
		this.#numRequests = 0;
	}

	stats(): StatsType {
		return { numRequests: this.#numRequests };
	}

	// the roles that an XML AIT can have, for the form and the /validate_ait endpoints
	get supportedRoles(): { value: string; label: string }[] {
		return AIT_ROLES;
	}

	/**
	 * the properties of an <Application> that the rules use
	 */
	/*private*/ #applicationInfo(Application: XmlElement): ApplicationInfo {
		const identifier = Application.getAnyNs(mhp.e_applicationIdentifier),
			descriptor = Application.getAnyNs(mhp.e_applicationDescriptor),
			type = descriptor?.getAnyNs(mhp.e_type),
			version = descriptor?.getAnyNs(mhp.e_mhpVersion);
		const otherApp = childText(type, mhp.e_OtherApp),
			dvbApp = childText(type, mhp.e_DvbApp);
		const release = version
			? `${hexValue(childText(version, mhp.e_versionMajor))}.${hexValue(childText(version, mhp.e_versionMinor))}.${hexValue(childText(version, mhp.e_versionMicro))}`
			: "";
		return {
			element: Application,
			type: otherApp ?? (dvbApp ? `${mhp.e_DvbApp} ${dvbApp}` : undefined),
			otherApp,
			orgId: childText(identifier, mhp.e_orgId),
			appId: childText(identifier, mhp.e_appId),
			priority: hexValue(childText(descriptor, mhp.e_priority)),
			mhpVersion: version ? `${hexValue(childText(version, mhp.e_profile))} ${release}` : "",
			version: version ? { profile: hexValue(childText(version, mhp.e_profile)), release } : undefined,
			hasIcon: descriptor?.hasChild(mhp.e_icon) ?? false,
		};
	}

	/**
	 * check the launch location of an application: <URLBase> of each HTTP transport followed by <applicationLocation>
	 * (A177r8 clause 5.2.4.3, ETSI TS 102 809 clause 5.4.4.17)
	 */
	/*private*/ #checkLaunchLocation(app: ApplicationInfo, errs: ErrorList): void {
		const Application = app.element;
		const location = childText(Application, mhp.e_applicationLocation) ?? "";
		let httpTransports = 0;
		Application.forEachNamedChildElement(mhp.e_applicationTransport, (transport) => {
			// xsi:type="mhp:HTTPTransportType" (the prefix is the document's own)
			const transportType = transport.attrAnyNsValueOr(mhp.a_type, "") ?? "";
			if (!transportType.endsWith(mhp.HTTP_TRANSPORT)) return;
			httpTransports++;
			const URLBase = childText(transport, mhp.e_URLBase) ?? "";
			if (!launchURL(URLBase)) {
				errs.addError({
					code: "AIT016",
					message: `${mhp.e_URLBase.elementize()} ${URLBase.quote()} is not an HTTP or HTTPS URL`,
					fragment: transport.getAnyNs(mhp.e_URLBase) ?? transport,
					key: keys.k_InvalidURL,
					clause: "ETSI TS 102 809 clause 5.4.4.17",
				});
				return;
			}
			const launch = launchURL(`${URLBase}${location}`);
			if (!launch) {
				errs.addError({
					code: "AIT017",
					message: `${mhp.e_URLBase.elementize()} followed by ${mhp.e_applicationLocation.elementize()} (${`${URLBase}${location}`.quote()}) is not a valid URL`,
					fragment: Application.getAnyNs(mhp.e_applicationLocation) ?? Application,
					key: keys.k_InvalidURL,
					clause: "A177r8 clause 5.2.4.3",
					description: "The concatenation of URLBase and applicationLocation shall form a URL specifying an application launch location",
				});
				return;
			}
			const clashes = [...new Set([...launch.searchParams.keys()].filter((name) => mhp.CONTEXT_PARAMETERS.includes(name)))];
			if (clashes.length > 0)
				errs.addError({
					type: WARNING,
					code: "AIT019",
					message: `the launch location ${launch.href.quote()} uses the query ${clashes.length == 1 ? "parameter" : "parameters"} ${clashes.map((c) => c.quote()).join(" and ")}, which the DVB-I client appends as a contextual parameter`,
					fragment: Application.getAnyNs(mhp.e_applicationLocation) ?? Application,
					key: "contextual parameter",
					clause: "A177r8 clause 5.2.4.3, 5.2.4.4.6",
					description: "The Content Provider shall ensure that any included query parameters are distinct from the contextual parameters (regionID[] and lloc)",
				});
		});
		if (httpTransports == 0)
			errs.addError({
				type: INFORMATION,
				code: "AIT018",
				message: `application ${app.orgId}/${app.appId} has no HTTP transport, so it cannot be launched from broadband`,
				fragment: Application,
				key: AIT_KEY,
			});
	}

	/**
	 * the platform profile and version of an HbbTV application (A177r8 clause 5.2.4.2, ETSI TS 102 796 v1.8.1 clause 7.2.3.1)
	 */
	/*private*/ #checkHbbTVVersion(app: ApplicationInfo, errs: ErrorList): void {
		if (app.otherApp != mhp.HBBTV_APP) return;
		const mhpVersion = app.element.getAnyNs(mhp.e_applicationDescriptor)?.getAnyNs(mhp.e_mhpVersion) ?? app.element;
		if (!app.version) {
			errs.addError({
				type: WARNING,
				code: "AIT024",
				message: `HbbTV application ${app.orgId}/${app.appId} has no ${mhp.e_mhpVersion.elementize()}, so a DVB-I client cannot determine its platform profile`,
				fragment: app.element,
				key: "platform profile",
				clause: "A177r8 clause 5.2.4.2",
				description: "The platform profile value shall be specified in the child elements of the mhp:mhpVersion element",
			});
			return;
		}
		if (!mhp.HBBTV_VERSIONS.includes(app.version.release))
			errs.addError({
				type: WARNING,
				code: "AIT025",
				message: `HbbTV application ${app.orgId}/${app.appId} is signalled with version ${app.version.release}, which is not one of ${mhp.HBBTV_VERSIONS.join(", ")}`,
				fragment: mhpVersion,
				key: "platform profile",
				clause: "ETSI TS 102 796 clause 7.2.3.1",
				description: "Terminals launch HbbTV applications signalled with version 1.1.1 to 1.8.1, and ignore those with other values",
			});
		if (Number.isNaN(app.version.profile) || (app.version.profile & ~mhp.HBBTV_PROFILE_BITS) != 0)
			errs.addError({
				type: WARNING,
				code: "AIT026",
				message: `HbbTV application ${app.orgId}/${app.appId} has the application profile 0x${(app.version.profile || 0).toString(16).padStart(4, "0")}, which uses bits that are not defined (only 0x0001 and 0x0002 can be combined with the basic profile 0x0000)`,
				fragment: mhpVersion,
				key: "platform profile",
				clause: "ETSI TS 102 796 clause 7.2.3.1",
			});
	}

	/**
	 * the signature policy of a launch location (urn:dvb:mhp:2026, <applicationLocation mhp:verificationPolicy>) is one
	 * of those defined by the service list that refers to the AIT, and the launch location (<URLBase> followed by
	 * <applicationLocation>) is an HTTPS URL. The codes are those of ValidateAnySignaturePolicy(), which checks the
	 * element's own content: here the URL is formed from two elements
	 */
	/*private*/ #checkLaunchPolicy(app: ApplicationInfo, errs: ErrorList): void {
		const location = app.element.getAnyNs(mhp.e_applicationLocation);
		const policyId = location?.attrAnyNsValueOr(mhp.a_verificationPolicy);
		if (!location || !policyId) return;
		const policies = signaturePoliciesInEffect();
		if (!policies)
			errs.addError({
				type: INFORMATION,
				code: "AIT027-1",
				message: `the XML AIT was not reached from a service list that defines signature policies, so ${policyId.quote()} is not checked`,
				fragment: location,
				key: keys.k_SignaturePolicies,
			});
		else if (!policies.has(policyId))
			errs.addError({
				type: WARNING,
				code: "AIT027-2",
				message: `${policyId.quote()} is not defined in the service list that refers to this XML AIT`,
				fragment: location,
				key: keys.k_SignaturePolicies,
			});
		// the policy of the referring service list, when it defines it: the response of each launch location is checked against
		// it (A177r8 clause 7.6.2.1: a signature policy applied to a URL validates the signature in the HTTP response headers)
		const policy = policies?.get(policyId);
		const location_text = location.content.trim();
		app.element.forEachNamedChildElement(mhp.e_applicationTransport, (transport) => {
			const URLBase = childText(transport, mhp.e_URLBase);
			const launch = URLBase != undefined ? launchURL(`${URLBase}${location_text}`) : undefined;
			if (!launch) return; // an invalid launch location is reported by #checkLaunchLocation()
			if (!isHTTSPURL(launch.href))
				errs.addError({
					type: WARNING,
					code: "AIT027-3",
					message: `signature validation is only applicable to secure (https) connections, but the launch location is ${launch.href.quote()}`,
					fragment: location,
					key: keys.k_SignaturePolicies,
				});
			if (policy) checkSignedLocation(launch.href, location, policy, errs);
		});
	}

	/**
	 * report the state of the schema of the AIT: a warning when it is old (urn:dvb:mhp:2009) or a draft
	 */
	/*private*/ #checkSchemaStatus(version: AITSchemaVersion, root: XmlElement, errs: ErrorList): void {
		const current = AIT_SchemaVersions.find((v) => v.status & StandardStatus.ETSI && !(v.status & StandardStatus.OLD));
		if (version.status & StandardStatus.OLD)
			errs.addError({
				type: WARNING,
				code: "AIT006a",
				message: `the XML AIT uses the old schema ${version.namespace.quote()}${current ? `, which is replaced by ${current.namespace.quote()}` : ""}`,
				line: root.line,
				key: "schema version",
			});
		if (version.status & StandardStatus.DRAFT)
			errs.addError({
				type: WARNING,
				code: "AIT006b",
				message: `the XML AIT schema ${version.namespace.quote()} is in draft state`,
				line: root.line,
				key: "schema version",
			});
	}

	/**
	 * the rules of A177 for the applications of an XML AIT
	 */
	/*private*/ #checkApplications(applications: ApplicationInfo[], role: string, reference: AIT_Reference, errs: ErrorList): void {
		// "not available" (A177r8 clause 5.2.4.2): a content deep-linked AIT returned when no application can be provided
		const notAvailable = applications.filter((app) => app.otherApp == mhp.NOT_AVAILABLE_APP);
		notAvailable.forEach((app) => {
			if (role == AIT_ROLE_DEEPLINK)
				errs.addError({
					type: INFORMATION,
					code: "AIT011",
					message: `the AIT signals that the content is not available to this device (${mhp.e_OtherApp.elementize()} ${mhp.NOT_AVAILABLE_APP.quote()})`,
					fragment: app.element,
					key: AIT_KEY,
					clause: "A177r8 clause 5.2.4.2",
				});
			else
				errs.addError({
					type: WARNING,
					code: "AIT012",
					message: `${mhp.NOT_AVAILABLE_APP.quote()} is only defined for a content deep-linked XML AIT`,
					fragment: app.element,
					key: AIT_KEY,
					clause: "A177r8 clause 5.2.4.2",
				});
		});

		// application types other than those a DVB-I client runs are allowed (A177r8 clause 5.2.4.1), but are ignored
		applications
			.filter((app) => app.otherApp != mhp.NOT_AVAILABLE_APP && !DVBI_APPLICATION_TYPES.includes(app.otherApp ?? ""))
			.forEach((app) =>
				errs.addError({
					type: INFORMATION,
					code: "AIT010",
					message: `application type ${(app.type ?? "").quote()} is not one that a DVB-I client runs (${DVBI_APPLICATION_TYPES.map((t) => t.quote()).join(", ")})`,
					fragment: app.element,
					key: AIT_KEY,
					clause: "A177r8 clause 5.2.4.1, 5.2.4.2",
				})
			);

		const runnable = applications.filter((app) => DVBI_APPLICATION_TYPES.includes(app.otherApp ?? ""));
		if (runnable.length == 0 && notAvailable.length == 0)
			errs.addError({
				type: WARNING,
				code: "AIT013",
				message: "the AIT has no application that a DVB-I client can run, so the client shows the service or content as unavailable",
				line: applications[0]?.element.line,
				key: AIT_KEY,
				clause: "A177r8 clause 5.2.4.2",
				description: `A DVB-I client selects an application of type ${DVBI_APPLICATION_TYPES.map((t) => t.quote()).join(", ")}, and ignores the others`,
			});

		// the client selects the application with the highest priority that it can run: two that it cannot tell apart are ambiguous
		for (let i = 0; i < runnable.length; i++)
			for (let j = i + 1; j < runnable.length; j++) {
				const a = runnable[i],
					b = runnable[j];
				if (a.type == b.type && a.mhpVersion == b.mhpVersion && a.priority == b.priority)
					errs.addError({
						type: WARNING,
						code: "AIT014",
						message: `application ${b.orgId}/${b.appId} (line ${b.element.line}) has the same type ${(b.type ?? "").quote()}, ${mhp.e_mhpVersion.elementize()} and ${mhp.e_priority.elementize()} as application ${a.orgId}/${a.appId} (line ${a.element.line}), so the choice between them is ambiguous`,
						fragment: b.element,
						key: AIT_KEY,
						clause: "A177r8 clause 5.2.4.2",
					});
			}

		// all the applications of a content deep-linked or template AIT have the same orgId and appId (A177r8 clause 5.2.4.3, 5.2.4.4.1)
		if (role == AIT_ROLE_DEEPLINK || role == AIT_ROLE_TEMPLATE) {
			const first = applications[0];
			applications
				.slice(1)
				.filter((app) => app.orgId != first.orgId || app.appId != first.appId)
				.forEach((app) =>
					errs.addError({
						code: "AIT015",
						message: `application ${app.orgId}/${app.appId} does not have the same ${mhp.e_orgId.elementize()} and ${mhp.e_appId.elementize()} as the first application (${first.orgId}/${first.appId}, line ${first.element.line})`,
						fragment: app.element,
						key: AIT_KEY,
						clause: role == AIT_ROLE_DEEPLINK ? "A177r8 clause 5.2.4.3" : "A177r8 clause 5.2.4.4.1",
						description: `All applications in a ${role == AIT_ROLE_DEEPLINK ? "content deep-linked" : "Template"} XML AIT shall have the same orgId and appId`,
					})
				);
		}

		applications.forEach((app) => {
			this.#checkLaunchLocation(app, errs);
			this.#checkHbbTVVersion(app, errs);
			this.#checkLaunchPolicy(app, errs);
		});

		// a service provider or service list application may have icons (A177r8 clause 5.2.3.1)
		const linkedType = reference.linkedApplicationType;
		if (linkedType && NAMED_APPLICATIONS.includes(linkedType))
			applications
				.filter((app) => !app.hasIcon)
				.forEach((app) =>
					errs.addError({
						type: INFORMATION,
						code: "AIT029",
						message: `application ${app.orgId}/${app.appId} has no ${mhp.e_icon.elementize()}: the linked application ${linkedType.quote()} may have icons, which the DVB-I client can show with its name`,
						fragment: app.element,
						key: AIT_KEY,
						clause: "A177r8 clause 5.2.3.1",
					})
				);
	}

	/**
	 * validate an XML AIT and record any errors
	 *
	 * @param {string}    AITtext  the XML AIT to be validated
	 * @param {string}    role     how the AIT is used: "linked" (the default), "deeplink" or "template" (see AIT_ROLES)
	 * @param {ErrorList} errs     errors found in validaton
	 * @param {AIT_Validator_Options} options
	 *                      log_prefix            the first part of the logging location (or null if no logging)
	 *                      report_schema_version report the state of the schema in the error/warning list
	 * @param {AIT_Reference} reference  what the document that refers to the AIT says about it, when it is traversed into
	 */
	/*public*/ async doValidateXmlAit(AITtext: string, role: string | undefined, errs: ErrorList, options: AIT_Validator_Options = {}, reference: AIT_Reference = {}): Promise<void> {
		this.#numRequests++;
		using scope = ValidationScope.open(options);
		const request = currentRequest();
		if (!AITtext) {
			errs.addError({ type: APPLICATION, code: "AIT000", message: "doValidateXmlAit() called with AITtext==null" });
			return;
		}
		const aitRole = role && role.length > 0 ? role : AIT_ROLE_LINKED;
		if (!AIT_ROLES.some((r) => r.value == aitRole)) {
			errs.addError({
				type: APPLICATION,
				code: "AIT009",
				message: `unknown XML AIT role ${aitRole.quote()}, expected one of ${AIT_ROLES.map((r) => r.value.quote()).join(", ")}`,
			});
			return;
		}

		// 'using' disposes the document (WASM memory) on every exit from this method
		using AIT = SchemaLoad(AITtext, errs, "AIT001");
		if (!AIT) return;
		document_logger(errs, scope.depth == 0 ? request.log_prefix : undefined, false);

		if (AIT.root.name !== mhp.e_ServiceDiscovery) {
			errs.addError({
				code: "AIT002",
				message: `Root element is not ${mhp.e_ServiceDiscovery.elementize()}`,
				line: AIT.root.line,
				key: keys.k_XSDValidation,
				clause: "ETSI TS 102 809 clause 5.4",
			});
			return;
		}
		const ns = AIT.root.namespaceUri;
		// the market settings that apply to the findings of the AIT (issue #119): those of the document that refers to it, or for
		// an AIT validated on its own, those of the latest A177 revision
		if (documentRevision() == undefined) setDocumentRevision(A177Revision.latest);
		if (!ns) {
			errs.addError({
				code: "AIT003",
				message: `namespace is not provided for ${mhp.e_ServiceDiscovery.elementize()}`,
				line: AIT.root.line,
				key: keys.k_XSDValidation,
			});
			return;
		}
		const version = AIT_SchemaVersions.find((v) => v.namespace == ns);
		if (!version?.schema) {
			errs.addError({
				code: "AIT004",
				message: `Unsupported namespace ${ns.quote()}, expected ${AIT_SchemaVersions.map((v) => v.namespace.quote()).join(" or ")}`,
				line: AIT.root.line,
				key: keys.k_XSDValidation,
			});
			return;
		}
		SchemaCheck(AIT as XmlDocument, version.schema, version.filename, errs, `AIT005:${version.label}`);
		if (request.report_schema_version) this.#checkSchemaStatus(version, AIT.root as XmlElement, errs);

		const applications: ApplicationInfo[] = [];
		(AIT.root as XmlElement).forEachNamedChildElement(mhp.e_ApplicationDiscovery, (discovery) =>
			discovery.forEachNamedChildElement(mhp.e_ApplicationList, (list) =>
				list.forEachNamedChildElement(mhp.e_Application, (Application) => applications.push(this.#applicationInfo(Application)))
			)
		);
		// the schema requires at least one application: when there is none, the XSD error has been reported
		if (applications.length > 0) this.#checkApplications(applications, aitRole, reference, errs);

		await scope.finish();
		if (scope.depth == 0) errs.timing = scope.timing();
	}

	/**
	 * the checks of the response that delivered a referenced XML AIT: its Content-Type (A177r8 clause 5.2.4.1), and for a
	 * Template XML AIT how long it can be cached (A177r8 clause 5.2.4.4.5)
	 */
	/*private*/ #checkResponse(resp: ResourceOutcome, url: string, role: string, Location: XmlElement, errs: ErrorList): void {
		const mediaType = (resp.contentType ?? "").split(";")[0].trim().toLowerCase();
		if (mediaType != mhp.XML_AIT_CONTENT_TYPE)
			errs.addError({
				type: WARNING,
				code: "AIT020",
				message: `the XML AIT ${url.quote()} is delivered with Content-Type ${(resp.contentType ?? "(none)").quote()}, not ${mhp.XML_AIT_CONTENT_TYPE.quote()}`,
				fragment: Location,
				key: "Content-Type",
				clause: "A177r8 clause 5.2.4.1",
				description: "XML AIT files shall be delivered by Content Providers with the Content-Type header set to application/vnd.dvb.ait+xml",
			});
		if (role == AIT_ROLE_TEMPLATE && !resp.expires && !/(^|,)\s*max-age\s*=/i.test(resp.cacheControl ?? ""))
			errs.addError({
				type: INFORMATION,
				code: "AIT021",
				message: `the Template XML AIT ${url.quote()} has neither an Expires header nor Cache-Control: max-age, so a DVB-I client assumes that it expires 24 hours after it is retrieved`,
				fragment: Location,
				key: "caching",
				clause: "A177r8 clause 5.2.4.4.5",
			});
	}

	/**
	 * validate an XML AIT that a service list or content guide refers to, when the request asks for it (aits), after the
	 * rules of the referring document have been checked (issue #134). Each URL is validated once in a validation, and
	 * counts against its traversal limits
	 *
	 * @param {XmlElement}    Location     the element that refers to the AIT (e.g. <MediaUri>, <ProgramURL>, <AuxiliaryURI>)
	 * @param {string}        url          the URL of the XML AIT
	 * @param {string}        role         how the AIT is used (linked, deeplink or template)
	 * @param {ErrorList}     errs         the results of the referring document
	 * @param {AIT_Reference} reference    what the referring document says about the AIT
	 */
	/*public*/ validateReferencedAit(Location: XmlElement, url: string, role: string, errs: ErrorList, reference: AIT_Reference = {}): void {
		const label = AIT_ROLES.find((r) => r.value == role)?.label ?? role;
		const nested = nestedTraversal(errs, url, `XML AIT-${role}`, `XML AIT (${label})`);
		if (!nested) return; // already validated in this validation
		const limited = allowTraversal(url);
		if (limited) {
			nested.addError({ code: limited.code, type: WARNING, message: limited.message, fragment: Location, key: keys.k_Traversal });
			traversalSkipped(nested);
			return;
		}
		// the AIT is counted against the traversal limits, and retrieved with the same retrieval as the checks of its reference
		// (content digest, signature policy), so that it is requested once
		const validation = currentValidation();
		const retrieve = async (): Promise<{ refused?: { code: string; message: string }; outcome?: ResourceOutcome }> => {
			const refused = claimTraversal(url);
			if (refused) return { refused };
			const outcome = await retrieveResource(url, validation, true);
			// the first retrieval of the URL did not keep its content (it was retrieved for another reason, e.g. as an image)
			if (outcome.ok && outcome.text == undefined) {
				const { response } = await safeFetch(url, validation);
				return { outcome: response?.ok ? { ...outcome, text: response.text() } : outcome };
			}
			return { outcome };
		};
		deferRetrieval(retrieve, async ({ refused, outcome }) => {
			if (refused) {
				nested.addError({ code: refused.code, type: WARNING, message: refused.message, fragment: Location, key: keys.k_Traversal });
				traversalSkipped(nested);
				return;
			}
			traversalStarted(nested);
			if (outcome?.error)
				nested.addError({ code: "AIT030", message: `cannot retrieve the XML AIT ${url.quote()}, error=${outcome.error}`, fragment: Location, key: keys.k_Traversal });
			else if (outcome && !outcome.ok)
				nested.addError({ code: "AIT031", message: `error retrieving the XML AIT ${url.quote()} - ${outcome.status} ${outcome.statusText}`, fragment: Location, key: keys.k_Traversal });
			else if (outcome) {
				const text = outcome.text ?? "";
				// the content is not needed again (the URL is only validated once), so it is not kept until the validation finishes
				delete outcome.text;
				this.#checkResponse(outcome, url, role, Location, nested);
				await this.doValidateXmlAit(text, role, nested, {}, reference);
			}
			traversalFinished(nested);
		});
	}
}
