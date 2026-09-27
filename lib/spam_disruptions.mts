/**
 * spam_disruptions.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Endpoints to disrupt spammers/web crawlers
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

import express from "express"
import { readFileSync } from "fs"

import {spam_blocker_config} from "./data_locations.mts"
import { Socket } from "net"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function random_redirect(app: express.Application, endpoint: string, protocol: string, targets: string[]) {
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

export function init_spam_blocker(app: express.Application) : void {
	try {
		const config = JSON.parse(readFileSync(spam_blocker_config,  { encoding: "utf-8" }).toString())
		config?.endpoints.forEach((endpoint: string) => {
			random_redirect(app, endpoint, config.protocol, config.redirections);
		})
	}
	// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-empty
	catch (err) {}
}