/**
 * spam_disruptions.d.ts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Endpoints to disrupt spammers/web crawlers
 */

import express from "express"

declare global {
 function init_spam_blocker(app: express.Application) : void
}
