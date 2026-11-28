/**
 * image_variant_definitions.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * The image variants of table 8 of A177r8 clause 5.2.8.2.1 (issue #153). They are in a module of their own, which imports
 * only the revisions, so that the markets (markets.mts) can check the variants a market requires
 */

import { A177Revision } from "./revisions.mts"

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
export const variantNamed = (value: string | undefined): ImageVariant | undefined => IMAGE_VARIANTS.find((v) => v.value == value);

// whether a value is one of the image variants of table 8 (the values are in lower case, and are compared as they are)
export const isImageVariant = (value: string): boolean => IMAGE_VARIANTS.some((v) => v.value == value);
