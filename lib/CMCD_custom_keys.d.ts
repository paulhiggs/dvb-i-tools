/**
 * CMCD_custom_keys.d.ts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Definitions and check related to CMCD custom keys defined by other organisations, such as 
 * the SVTA (Streaming Video Technology Alliance)
 */

import type { LoadOptions } from "./globals.mts"

function LoadKnownCustomKeysRegistry(opts: LoadOptions): void

function isKnownCMCDCustomKey(key: string): string | undefined

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CMCD_custom_stats(res: any)