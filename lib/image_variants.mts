/**
 * image_variants.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * The image_variant query parameter (A177r8 clause 5.2.8.2.1, issue #153). A client adds it to its requests for service
 * list registry responses, service lists and content guide responses, to ask for the image URLs of one variant (shape and
 * colour scheme) in the response. It applies to the request for the document, not to the image (only ?w= does, clause
 * 5.2.8.2.2). A document given by a URL with an image_variant is validated with that variant (ValidationRequest.imageVariant,
 * read from the URL by imageVariantOf() in routes/request_handling.mts), which is added to every such request the validation
 * makes, and the images in the responses are checked against it (checkImageVariant())
 */

import type { XmlElement } from "libxml2-wasm"

import ErrorList, { INFORMATION, WARNING } from "./error_list.mts"
import type { ReportedErrorType } from "./error_list.mts"
import type { ImageInfo } from "./image_format.mts"
import { A177Revision } from "./revisions.mts"
import { currentRequest, isOutermostDocument, safeFetch } from "./safe_fetch.mts"

// initialise string formatting extensions
import {} from "./string-extensions.mts"

export const IMAGE_VARIANT_PARAMETER = "image_variant";
const CLAUSE = "A177r8 clause 5.2.8.2.1";
const KEY = "image variant";

/**
 * the image variants of table 8 of A177r8 clause 5.2.8.2.1, each with the first revision of A177 that has it. The query
 * parameter is from A177r3 (for service lists, by its change history), and the 2:3 variants from A177r8 ("Portrait
 * formatted images"). The revision of each of the others is that of the parameter, until the texts of A177r3 to r7 are
 * checked (issue #153)
 */
export type ImageVariant = Readonly<{
	value: string;
	label: string;
	since: A177Revision;
	shape: Readonly<{ width: number; height: number }>; // the aspect ratio of its images
	transparent: boolean; // its images are "on transparent"
}>;
const SHAPES = { "16x9": { width: 16, height: 9 }, square: { width: 1, height: 1 }, "4x3": { width: 4, height: 3 }, "2x3": { width: 2, height: 3 } };
const variant = (value: string, label: string, since: A177Revision): ImageVariant => ({
	value,
	label,
	since,
	shape: SHAPES[value.split("_")[0] as keyof typeof SHAPES],
	transparent: label.endsWith("on transparent"),
});
export const IMAGE_VARIANTS: readonly ImageVariant[] = Object.freeze([
	variant("16x9_colour", "16:9 colour", A177Revision.r3),
	variant("square_colour", "1:1 colour", A177Revision.r3),
	variant("4x3_colour", "4:3 colour", A177Revision.r3),
	variant("2x3_colour", "2:3 colour", A177Revision.r8),
	variant("16x9_white", "16:9 white on transparent", A177Revision.r3),
	variant("square_white", "1:1 white on transparent", A177Revision.r3),
	variant("2x3_white", "2:3 white on transparent", A177Revision.r8),
	variant("16x9_colour_light", "16:9 colour light on transparent", A177Revision.r3),
	variant("square_colour_light", "1:1 colour light on transparent", A177Revision.r3),
	variant("2x3_colour_light", "2:3 colour light on transparent", A177Revision.r8),
	variant("16x9_colour_dark", "16:9 colour dark on transparent", A177Revision.r3),
	variant("square_colour_dark", "1:1 colour dark on transparent", A177Revision.r3),
	variant("2x3_colour_dark", "2:3 colour dark on transparent", A177Revision.r8),
]);
const variantNamed = (value: string | undefined): ImageVariant | undefined => IMAGE_VARIANTS.find((v) => v.value == value);

// whether a value is one of the image variants of table 8 (the values are in lower case, and are compared as they are)
export const isImageVariant = (value: string): boolean => IMAGE_VARIANTS.some((v) => v.value == value);

/**
 * the image_variant of a URL
 *
 * @param {string} url  the URL
 * @returns {string | undefined} the value of its image_variant query parameter, or undefined if it has none (or the URL
 *                               cannot be parsed)
 */
export function urlImageVariant(url: string): string | undefined {
	try {
		return new URL(url).searchParams.get(IMAGE_VARIANT_PARAMETER) ?? undefined;
	} catch {
		return undefined;
	}
}

/**
 * add the image variant of the validation to the URL of a request for a document. The parameter is added at the end of
 * the query, and the rest of the URL is kept as it is (it is not parsed and serialised again, which would change the
 * encoding of other parameters, such as regionID[] or a CRID)
 *
 * @param {string} url      the URL of the request
 * @param {string} variant  the image variant: by default that of the current validation
 * @returns {string} the URL with the image variant, or the URL unchanged when there is no variant, or when it already has an
 *                   image_variant (a pagination link given by the server, or the URL given by the user)
 */
export function withImageVariant(url: string, variant: string | undefined = currentRequest().imageVariant): string {
	if (variant == undefined || urlImageVariant(url) != undefined) return url;
	const hash = url.indexOf("#");
	const [base, fragment] = hash < 0 ? [url, ""] : [url.slice(0, hash), url.slice(hash)];
	const separator = !base.includes("?") ? "?" : base.endsWith("?") || base.endsWith("&") ? "" : "&";
	return `${base}${separator}${IMAGE_VARIANT_PARAMETER}=${encodeURIComponent(variant)}${fragment}`;
}

/**
 * report a variant that the A177 revision of the document does not define (IMV002), once, for the outermost document. The
 * variant is chosen before the revision of the document is known, so it is reported and not refused
 *
 * @param {A177Revision} revision  the revision of the document
 * @param {XmlElement}   root      the root element of the document
 * @param {ErrorList}    errs      where the finding is reported
 */
export function checkImageVariantRevision(revision: A177Revision, root: XmlElement, errs: ErrorList): void {
	const variant = currentRequest().imageVariant;
	if (variant == undefined || !revision.known || !isOutermostDocument()) return;
	const since = IMAGE_VARIANTS.find((v) => v.value == variant)?.since;
	if (since && revision < since)
		errs.addError({
			type: INFORMATION,
			code: "IMV002",
			message: `the image variant ${variant.quote()} is not defined in ${revision.label} (it is from ${since.label}), so a server of this revision may refuse it`,
			line: root.line,
			key: KEY,
			clause: CLAUSE,
		});
}

/**
 * the URL without its image_variant query parameter
 *
 * @param {string} url  the URL
 * @returns {string} the URL, with the rest of its query as it is
 */
export function withoutImageVariant(url: string): string {
	const hash = url.indexOf("#");
	const [base, fragment] = hash < 0 ? [url, ""] : [url.slice(0, hash), url.slice(hash)];
	const query = base.indexOf("?");
	if (query < 0) return url;
	const kept = base
		.slice(query + 1)
		.split("&")
		.filter((part) => part.length > 0 && part.split("=")[0] != IMAGE_VARIANT_PARAMETER);
	return `${base.slice(0, query)}${kept.length > 0 ? `?${kept.join("&")}` : ""}${fragment}`;
}

/**
 * the finding for a request with a valid image variant that the server refused with 400 (IMV001): A177 says "If a valid
 * value from this list is used, the response shall not error". The server may refuse the request for another reason (e.g.
 * a schedule window it does not have), so it is requested again without the variant: the refusal is the variant's only
 * when that request succeeds. Otherwise the response is reported as any other failure
 *
 * @param {number}     status    the HTTP status of the response
 * @param {string}     url       the URL of the request
 * @param {XmlElement} Location  the element of the referring document, for the report
 * @returns {Promise<ReportedErrorType | undefined>} the finding, or undefined when the response is not a refusal of a valid
 *                    variant
 */
export async function refusedImageVariant(status: number, url: string, Location: XmlElement): Promise<ReportedErrorType | undefined> {
	const variant = urlImageVariant(url);
	if (status != 400 || variant == undefined || !isImageVariant(variant)) return undefined;
	const plain = withoutImageVariant(url);
	const { response } = await safeFetch(plain);
	if (!response?.ok) return undefined;
	return {
		code: "IMV001",
		message: `the request ${url.quote()} with the valid image variant ${variant.quote()} was refused (400 Bad Request), but succeeds without it`,
		fragment: Location,
		key: KEY,
		clause: CLAUSE,
		description: "All endpoints shall accept the image_variant values of table 8. If a valid value is used, the response shall not error, but is not required to contain an image",
	};
}

/**
 * check an image of a document requested with an image variant against the variant (IMV004, IMV005): its shape (from
 * its width and height, within 1%), and that an image "on transparent" can have transparent pixels. A177 lets a server give
 * another format when an item has no image of the variant ("the endpoint may substitute an alternative format at its
 * discretion"), so they are warnings. The colours (white, light or dark) are not checked, as the pixels are not decoded
 *
 * @param {ImageInfo}  image     the properties read from the image
 * @param {string}     where     how the image is described in messages
 * @param {XmlElement} MediaUri  the element referencing the image
 * @param {ErrorList}  errs      where findings are reported
 */
export function checkImageVariant(image: ImageInfo, where: string, MediaUri: XmlElement, errs: ErrorList): void {
	const wanted = variantNamed(currentRequest().imageVariant);
	if (!wanted || !image.width || !image.height) return;
	const ratio = image.width / image.height,
		expected = wanted.shape.width / wanted.shape.height;
	if (Math.abs(ratio - expected) / expected > 0.01)
		errs.addError({
			type: WARNING,
			code: "IMV004",
			message: `${where} is ${image.width}x${image.height}, which is not ${wanted.shape.width}:${wanted.shape.height} as the image variant ${wanted.value.quote()} is`,
			fragment: MediaUri,
			key: KEY,
			clause: CLAUSE,
		});
	if (wanted.transparent && image.transparency == false)
		errs.addError({
			type: WARNING,
			code: "IMV005",
			message: `${where} has no transparency (no alpha channel or transparent colour), but the image variant ${wanted.value.quote()} is ${wanted.label.slice(wanted.label.indexOf(" ") + 1)}`,
			fragment: MediaUri,
			key: KEY,
			clause: CLAUSE,
		});
}

/**
 * the URL of a pagination link to follow, with the image variant of the validation (IMV003 for a link that does not keep it)
 *
 * @param {string}     url   the URL of the next page, from the response
 * @param {XmlElement} link  the element that gives it, for the report
 * @param {ErrorList}  errs  where the finding is reported
 * @returns {string} the URL to request
 */
export function paginationWithImageVariant(url: string, link: XmlElement, errs: ErrorList): string {
	const variant = currentRequest().imageVariant;
	if (variant == undefined) return url;
	const given = urlImageVariant(url);
	if (given != variant)
		errs.addError({
			type: INFORMATION,
			code: "IMV003",
			message:
				given == undefined
					? `the pagination link ${url.quote()} has no image variant, although the request had ${variant.quote()}: it is requested with it`
					: `the pagination link ${url.quote()} has the image variant ${given.quote()}, but the request had ${variant.quote()}`,
			fragment: link,
			key: KEY,
			clause: CLAUSE,
		});
	return withImageVariant(url, variant);
}
