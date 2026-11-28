/**
 * image_checks.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Checks of referenced images: that they can be retrieved, that the image matches its signalled media type and the
 * A177 restrictions (A177r8 clause 5.2.8.3), and that the server scales it on request (A177r8 clause 5.2.8.2.2).
 * The retrieval itself is done by checkReferencedResource() in resource_checks.mts
 */

import { readImageInfo } from "./image_format.mts"
import type { ImageInfo } from "./image_format.mts"
import { imageFormatOf } from "./MIME_checks.mts"
import { tva } from "./TVA_definitions.mts"
import { WARNING } from "./error_list.mts"
import ErrorList from "./error_list.mts"
import type { ResourceOutcome } from "./resource_checks.mts"
import { checkMarketImage } from "./market_checks.mts"
import { checkImageVariant } from "./image_variants.mts"
import type { MarketImageKind } from "./markets.mts"

const IMAGE_KEY = "image checks";
const RESPONSE_CLAUSE = "A177r8 clause 5.2.8.3";
const SCALING_CLAUSE = "A177r8 clause 5.2.8.2.2";

const mediaType = (mime: string): string => mime.split(";")[0].trim().toLowerCase();
const FORMAT_NAME: Record<string, string> = { png: "PNG", jpeg: "JPEG", webp: "WebP", gif: "GIF", bmp: "BMP", svg: "SVG", unknown: "unrecognised" };

/**
 * the URL of an image scaled to a width, using the image resolution query of A177r8 clause 5.2.8.2.2
 *
 * @returns {string | undefined} the URL, or undefined if the image URL cannot be parsed
 */
export const scaledURL = (url: string, width: number): string | undefined => {
	try {
		const u = new URL(url);
		u.searchParams.set("w", String(width));
		return u.href;
	} catch {
		return undefined;
	}
};

/**
 * the width to request when checking that the server scales an image: half its width, so the server has to scale it
 *
 * @returns {number | undefined} the width, or undefined if the image was not retrieved or has no width to halve
 */
export const scalingWidth = (original: ResourceOutcome): number | undefined => {
	const width = original.ok ? original.image?.width : undefined;
	return width && width > 1 ? Math.round(width / 2) : undefined;
};

/**
 * report the properties of an image that A177 restricts
 *
 * @param {ImageInfo}   image        the properties read from the image
 * @param {string|null} contentType  the signalled MediaUri@contentType
 * @param {string}      where        how the image is described in messages
 * @param {XmlElement}  MediaUri     the element referencing the image
 * @param {ErrorList}   errs         where findings are reported
 * @param {MarketImageKind} kind     the kind of image, for the sizes that a market stipulates (issue #119)
 * @returns {boolean} true if the image could be read and is in a permitted format, so its scaling can be checked
 */
function checkImageProperties(image: ImageInfo, contentType: string | null, where: string, MediaUri: XmlElement, errs: ErrorList, kind?: MarketImageKind): boolean {
	const report = (code: string, message: string, type?: string, description?: string, clause = RESPONSE_CLAUSE) =>
		errs.addError({ code, message, fragment: MediaUri, key: IMAGE_KEY, ...(type ? { type } : {}), ...(description ? { description, clause } : {}) });

	if (image.problem || image.format == "unknown") {
		report("IMG004", `${where} is not a readable image${image.problem ? `: ${image.problem}` : ""}`, undefined, "The referenced resource shall be a JPEG, PNG or WebP image.");
		return false;
	}
	const permitted = !["gif", "bmp", "svg"].includes(image.format);
	if (!permitted)
		report("IMG006", `${where} is a ${FORMAT_NAME[image.format]} image, which is not permitted`, undefined, "Images shall be JPEG or PNG; other formats including WebP may also be provided. GIF images are not supported.");
	const signalled = contentType ? imageFormatOf(contentType) : undefined;
	if (signalled && signalled != image.format)
		report("IMG005", `${where} is a ${FORMAT_NAME[image.format]} image, but ${tva.a_contentType.attribute(tva.e_MediaUri)} is ${contentType!.quote()}`, undefined, "The format of the image shall be the one specified in MediaUri@contentType.");
	if (image.width === 0 || image.height === 0) report("IMG004", `${where} has no pixels (${image.width}x${image.height})`);
	if (image.pixelAspect && image.pixelAspect.x != image.pixelAspect.y)
		report("IMG007", `${where} has a pixel aspect ratio of ${image.pixelAspect.x}:${image.pixelAspect.y}, not 1:1`, undefined, "All images shall have a pixel aspect ratio of 1:1.", "A177r8 clause 5.2.8.2.1");
	if (image.bitsPerComponent != undefined && image.bitsPerComponent != 8)
		report("IMG008", `${where} has ${image.bitsPerComponent} bits per colour component, not 8`, WARNING, "Images shall have a colour depth of 32 bits (8 bits per component).");
	if (image.cmyk) report("IMG009", `${where} uses a CMYK colour space, not sRGB`, WARNING, "Images shall use the sRGB colour space (either explicitly signalled or assumed if not).");
	checkMarketImage(image, kind, where, MediaUri, errs);
	// the image variant that the document was requested with (issue #153)
	checkImageVariant(image, where, MediaUri, errs);
	return permitted;
}

/**
 * check an inline (data: URI) image, which needs no retrieval
 *
 * @param {XmlElement}  MediaUri     the element whose content is the data: URI
 * @param {string|null} contentType  the signalled MediaUri@contentType
 * @param {ErrorList}   errs         where findings are reported
 */
export function checkInlineImage(MediaUri: XmlElement, contentType: string | null, errs: ErrorList, kind?: MarketImageKind): void {
	const location = MediaUri.content.trim();
	const comma = location.indexOf(",");
	if (comma < 0) return; // an invalid data: URI is reported by the caller
	const header = location.slice(5, comma),
		data = location.slice(comma + 1);
	let content: Buffer;
	try {
		content = /;base64$/i.test(header) ? Buffer.from(data, "base64") : Buffer.from(decodeURIComponent(data), "latin1");
	} catch {
		return; // malformed %-encoding is reported by the caller
	}
	checkImageProperties(readImageInfo(content), contentType, "the inline image", MediaUri, errs, kind);
}

/**
 * report the retrieval of an image and the properties of the image retrieved
 *
 * @param {ResourceOutcome} original     the retrieval of the image
 * @param {string}          location     the URL of the image
 * @param {string|null}     contentType  the signalled MediaUri@contentType
 * @param {XmlElement}      MediaUri     the element referencing the image
 * @param {ErrorList}       errs         where findings are reported
 * @returns {boolean} true if the image was retrieved, readable and in a permitted format, so its scaling can be checked
 */
export function reportImage(original: ResourceOutcome, location: string, contentType: string | null, MediaUri: XmlElement, errs: ErrorList, kind?: MarketImageKind): boolean {
	const where = `the image at ${location}`;
	if (!original.ok) {
		if (original.error) errs.addError({ code: "IMG001", message: `${where} could not be retrieved: ${original.error}`, fragment: MediaUri, key: IMAGE_KEY });
		else errs.addError({ code: "IMG002", message: `${where} could not be retrieved: ${original.status} ${original.statusText}`, fragment: MediaUri, key: IMAGE_KEY });
		return false;
	}
	if (contentType && original.contentType && mediaType(original.contentType) != mediaType(contentType))
		errs.addError({
			code: "IMG003",
			type: WARNING,
			message: `${where} is served with Content-Type ${original.contentType.quote()}, but ${tva.a_contentType.attribute(tva.e_MediaUri)} is ${contentType.quote()}`,
			fragment: MediaUri,
			key: IMAGE_KEY,
		});
	return checkImageProperties(original.image!, contentType, where, MediaUri, errs, kind);
}

/**
 * report whether the server scaled an image to the requested width, keeping its aspect ratio
 *
 * @param {ResourceOutcome} original  the retrieval of the image
 * @param {number}          target    the width requested
 * @param {ResourceOutcome} scaled    the retrieval of the image at that width
 * @param {string}          location  the URL of the image
 * @param {XmlElement}      MediaUri  the element referencing the image
 * @param {ErrorList}       errs      where findings are reported
 */
export function reportImageScaling(original: ResourceOutcome, target: number, scaled: ResourceOutcome, location: string, MediaUri: XmlElement, errs: ErrorList): void {
	const where = `the image at ${location}`,
		request = scaledURL(location, target);
	const scaling = (code: string, message: string, type?: string) =>
		errs.addError({ code, message, fragment: MediaUri, key: IMAGE_KEY, ...(type ? { type } : {}), clause: SCALING_CLAUSE,
			description: "When the client adds ?w=<width> to the image URL, the server shall return the image scaled to that width, keeping its aspect ratio. An unsupported width shall be answered with 400 (Bad Request)." });
	if (!scaled.ok) {
		if (scaled.error) scaling("IMG011", `the scaled image ${request} could not be retrieved: ${scaled.error}`, WARNING);
		else if (scaled.status == 400) scaling("IMG011", `the server does not support scaling ${where} to width ${target} (400 Bad Request for ${request})`, WARNING);
		else scaling("IMG011", `the scaled image ${request} could not be retrieved: ${scaled.status} ${scaled.statusText}`, WARNING);
		return;
	}
	const image = scaled.image!,
		originalImage = original.image!;
	if (image.problem || image.format == "unknown" || image.width == undefined || image.height == undefined) {
		scaling("IMG013", `the response to ${request} is not a readable image${image.problem ? `: ${image.problem}` : ""}`);
		return;
	}
	if (image.format != originalImage.format)
		scaling("IMG013", `the response to ${request} is a ${FORMAT_NAME[image.format]} image, but the original is ${FORMAT_NAME[originalImage.format]}`);
	if (image.width != target)
		scaling("IMG010", image.width == originalImage.width
			? `${where} is not scaled when width ${target} is requested (${request} is ${image.width}x${image.height})`
			: `${request} is ${image.width} pixels wide, not ${target}`);
	else {
		const expectedHeight = Math.round((target * originalImage.height!) / originalImage.width!);
		if (Math.abs(image.height - expectedHeight) > 1)
			scaling("IMG012", `${request} is ${image.width}x${image.height}, but keeping the aspect ratio of ${originalImage.width}x${originalImage.height} gives ${target}x${expectedHeight}`);
	}
}
