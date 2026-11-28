/**
 * image_format.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Reads the properties of an image (format, dimensions, colour depth, pixel aspect ratio) from its header, without
 * decoding the image data
 */

export type ImageFormat = "png" | "jpeg" | "webp" | "gif" | "bmp" | "svg" | "unknown";

export type ImageInfo = {
	format: ImageFormat;
	width?: number;
	height?: number;
	bitsPerComponent?: number; // bits per colour component (for a palette PNG, of the palette entries)
	cmyk?: boolean; // the image uses a CMYK (or YCCK) colour space, not sRGB
	pixelAspect?: { x: number; y: number }; // the pixel aspect ratio, when the image signals one
	transparency?: boolean; // the image can have transparent pixels: an alpha channel, or a transparent colour (issue #153)
	problem?: string; // why the header could not be read (the image is truncated or corrupt)
	size?: number; // the size of the file, in bytes
};

const startsWith = (bytes: Buffer, signature: number[], offset = 0): boolean =>
	bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] == b);
const ascii = (bytes: Buffer, start: number, length: number): string => bytes.toString("latin1", start, start + length);

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function readPNG(bytes: Buffer): ImageInfo {
	const info: ImageInfo = { format: "png" };
	let offset = PNG_SIGNATURE.length;
	let colourType = -1,
		bitDepth = 0;
	while (offset + 8 <= bytes.length) {
		const length = bytes.readUInt32BE(offset),
			type = ascii(bytes, offset + 4, 4),
			data = offset + 8;
		if (data + length > bytes.length) break;
		if (type == "IHDR") {
			if (length < 13) return { ...info, problem: "the PNG header (IHDR) is too short" };
			info.width = bytes.readUInt32BE(data);
			info.height = bytes.readUInt32BE(data + 4);
			bitDepth = bytes[data + 8];
			colourType = bytes[data + 9];
		} else if (type == "tRNS") {
			info.transparency = true; // a transparent colour, or the transparency of palette entries
		} else if (type == "pHYs" && length >= 9) {
			info.pixelAspect = { x: bytes.readUInt32BE(data), y: bytes.readUInt32BE(data + 4) };
		} else if (type == "IDAT" || type == "IEND") break; // the properties are all signalled before the image data
		offset = data + length + 4; // and the CRC
	}
	if (info.width == undefined) return { ...info, problem: "the PNG header (IHDR) is missing" };
	// the palette entries of an indexed colour image (colour type 3) are always 8 bits per component
	info.bitsPerComponent = colourType == 3 ? 8 : bitDepth;
	// greyscale with alpha (4) and truecolour with alpha (6) have an alpha channel
	info.transparency = info.transparency == true || colourType == 4 || colourType == 6;
	return info;
}

// start of frame markers, which carry the image dimensions: SOF0-SOF3, SOF5-SOF7, SOF9-SOF11, SOF13-SOF15
const JPEG_SOF = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];

function readJPEG(bytes: Buffer): ImageInfo {
	const info: ImageInfo = { format: "jpeg", transparency: false }; // a JPEG image has no transparency
	let offset = 2,
		adobeTransform = -1,
		components = 0;
	while (offset + 4 <= bytes.length) {
		if (bytes[offset] != 0xff) return { ...info, problem: `the JPEG marker at byte ${offset} is not valid` };
		const marker = bytes[offset + 1];
		if (marker == 0xff) {
			offset++; // fill byte
			continue;
		}
		if (marker == 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker == 0x01) {
			offset += 2; // markers without a length
			continue;
		}
		if (marker == 0xd9 || marker == 0xda) break; // end of image, or start of scan: no more header segments
		const length = bytes.readUInt16BE(offset + 2),
			data = offset + 4;
		if (length < 2 || offset + 2 + length > bytes.length) break;
		if (marker == 0xe0 && length >= 16 && ascii(bytes, data, 5) == "JFIF\0") {
			const x = bytes.readUInt16BE(data + 8),
				y = bytes.readUInt16BE(data + 10);
			if (x > 0 && y > 0) info.pixelAspect = { x, y };
		} else if (marker == 0xee && length >= 14 && ascii(bytes, data, 5) == "Adobe") {
			adobeTransform = bytes[data + 11];
		} else if (JPEG_SOF.includes(marker) && length >= 8) {
			info.bitsPerComponent = bytes[data];
			info.height = bytes.readUInt16BE(data + 1);
			info.width = bytes.readUInt16BE(data + 3);
			components = bytes[data + 5];
		}
		offset += 2 + length;
	}
	if (info.width == undefined) return { ...info, problem: "the JPEG frame header (SOF) is missing" };
	// four components are CMYK, or YCCK when the Adobe segment signals transform 2
	info.cmyk = components == 4 || adobeTransform == 2;
	return info;
}

function readWebP(bytes: Buffer): ImageInfo {
	const info: ImageInfo = { format: "webp", bitsPerComponent: 8 };
	const chunk = ascii(bytes, 12, 4),
		data = 20;
	if (chunk == "VP8X" && bytes.length >= data + 10) {
		info.width = bytes.readUIntLE(data + 4, 3) + 1;
		info.height = bytes.readUIntLE(data + 7, 3) + 1;
		info.transparency = (bytes[data] & 0x10) != 0; // the alpha flag of the extended format
	} else if (chunk == "VP8L" && bytes.length >= data + 5 && bytes[data] == 0x2f) {
		const bits = bytes.readUInt32LE(data + 1);
		info.width = (bits & 0x3fff) + 1;
		info.height = ((bits >> 14) & 0x3fff) + 1;
		info.transparency = ((bits >> 28) & 1) == 1; // alpha_is_used of the lossless format
	} else if (chunk == "VP8 " && bytes.length >= data + 10 && startsWith(bytes, [0x9d, 0x01, 0x2a], data + 3)) {
		info.width = bytes.readUInt16LE(data + 6) & 0x3fff;
		info.height = bytes.readUInt16LE(data + 8) & 0x3fff;
		info.transparency = false; // the simple lossy format has no alpha
	} else return { ...info, problem: "the WebP image header is not recognised" };
	return info;
}

/**
 * read the properties of an image from its header
 *
 * @param {Buffer} bytes  the image
 * @returns {ImageInfo} the format of the image, and the properties that could be read
 */
export function readImageInfo(bytes: Buffer): ImageInfo {
	return { ...readImageHeader(bytes), size: bytes.length };
}

function readImageHeader(bytes: Buffer): ImageInfo {
	try {
		if (startsWith(bytes, PNG_SIGNATURE)) return readPNG(bytes);
		if (startsWith(bytes, [0xff, 0xd8, 0xff])) return readJPEG(bytes);
		if (ascii(bytes, 0, 4) == "RIFF" && ascii(bytes, 8, 4) == "WEBP") return readWebP(bytes);
		if (ascii(bytes, 0, 6) == "GIF87a" || ascii(bytes, 0, 6) == "GIF89a")
			return { format: "gif", width: bytes.length >= 10 ? bytes.readUInt16LE(6) : undefined, height: bytes.length >= 10 ? bytes.readUInt16LE(8) : undefined };
		if (ascii(bytes, 0, 2) == "BM") return { format: "bmp" };
		const text = bytes.toString("utf8", 0, Math.min(bytes.length, 1024)).trimStart().toLowerCase();
		if (text.startsWith("<svg") || (text.startsWith("<?xml") && text.includes("<svg"))) return { format: "svg" };
	} catch (e) {
		return { format: "unknown", problem: `the image header could not be read (${e instanceof Error ? e.message : e})` };
	}
	return { format: "unknown" };
}
