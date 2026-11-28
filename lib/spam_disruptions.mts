/**
 * spam_disruptions.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Endpoints to disrupt spammers/web crawlers
 * 
 * The endpoints are given by the spamBlocker section of the server's configuration file (issue #147), e.g.

	"spamBlocker": {
		"enabled": true,
		"endpoints": [ "/api", "/api/route", "/app", "/_next/server" ],
		"protocol": "http",
		"redirections": [ "45.205.1.18", "87.121.84.57", "95.214.55.63" ]
	}

 */

import express from "express"
import { Socket } from "net"

// the settings of the spam blocker, from the configuration (config_file.mts)
export type SpamBlockerSettings = {
	endpoints: string[]; // the paths that are answered with a redirect
	protocol: string; // "http" or "https"
	redirections: string[]; // IP addresses to redirect to
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function random_redirect(app: express.Application, endpoint: string, protocol: string, targets: string[]) : void {
	app.all(endpoint, (req:express.Request, res: express.Response) => {

		const clientAddress = (socket: Socket) => {
			switch (socket.remoteFamily) {
				case "IPv6":
					return "www.example.com";
				case "IPv4":
					return socket.remoteAddress;
			}
			return "localhost";
		}

		const to = `${req.protocol}://${clientAddress(req.socket)}/`;
		res.redirect(301, to);
	})
}

/**
 * answer each of the spam blocker's endpoints with a redirect
 *
 * @param {express.Application} app       the application
 * @param {SpamBlockerSettings} settings  the endpoints, protocol and redirections of the configuration
 */
export function init_spam_blocker(app: express.Application, settings: SpamBlockerSettings) : void {
	settings.endpoints.forEach((endpoint) => random_redirect(app, endpoint, settings.protocol, settings.redirections));
}
