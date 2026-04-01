/**
 * spam_disruptions.mjs
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Endpoints to disrupt spammers/web crawlere
 * 
 * example JSON configuration file (sblocker_config.json)

	{
		"version" : 1,
		"endpoints" : [
			"/api", "/api/route", "/app", "/_next/server"
		],
		"protocol" : "http",
		"redirections" : [
			"45.205.1.18", "87.121.84.57", "95.214.55.63"
		]
	}

 */

import { readFileSync } from "fs";

import {spam_blocker_config} from "./data_locations.mjs";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function random_redirect(app, endpoint, protocol, targets) {
	app.all(endpoint, (req, res) => {

		let clientAddress = (socket) => {
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

export function init_spam_blocker(app) {
	const config = JSON.parse(readFileSync(spam_blocker_config,  { encoding: "utf-8" }).toString())
	config?.endpoints.forEach((endpoint) => {
		random_redirect(app, endpoint, config.protocol, config.redirections);
	})
}