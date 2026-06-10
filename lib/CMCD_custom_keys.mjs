/**
 * CMCD_custom_keys.mjs
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Definitions and check related to CMCD custom keys defined by other organisations, such as the SVTA (Streaming Video Technology Alliance)
 *
 */


import { join } from "path";
import { readFile, readFileSync } from "fs";

import chalk from "chalk";
import fetchS from "sync-fetch";

import handleErrors from "./fetch_err_handler.mjs";
import { __dirname, resouces_subDir } from "./data_locations.mjs";
import { fetch_options } from "./globals.mjs";

const CMCD_Registry_Filename = "registry.json";
const CMCD_CUSTOM_KEYS_REGISTRY = {
	file: join(__dirname, resouces_subDir, "CMCD", CMCD_Registry_Filename), 
  url : `https://raw.githubusercontent.com/streaming-video-technology-alliance/common-media-client-data-custom-keys/refs/heads/main/keys/${CMCD_Registry_Filename}`,
};

let custom_keys = null;

function loadKeyData(keyData) {
	return JSON.parse(keyData);
}

export function LoadKnownCustomKeysRegistry(useURL, async = true) {
	console.log(chalk.yellow.underline("loading Known CMCD Custom keys ..."));

	if (useURL) {
		console.log(chalk.yellow(`retrieving known keys from ${CMCD_CUSTOM_KEYS_REGISTRY.url}`));
		if (async)
			fetch(CMCD_CUSTOM_KEYS_REGISTRY.url, fetch_options)
				.then(handleErrors)
				.then((response) => response.text())
				.then((responseText) => (custom_keys = loadKeyData(responseText)))
				.catch((error) => console.log(chalk.red(`error (${error}) retrieving ${CMCD_CUSTOM_KEYS_REGISTRY.url}`)));
		else {
			let resp = null;
			try {
				resp = fetchS(CMCD_CUSTOM_KEYS_REGISTRY.url, fetch_options);
			} catch (error) {
				console.log(chalk.red(error.message));
			}
			if (resp) {
				if (resp.ok) custom_keys = loadKeyData(resp.text());
				else console.log(chalk.red(`error (${resp.error()}) retrieving ${CMCD_CUSTOM_KEYS_REGISTRY.url}`));
			}
		}
	}
	else {
		console.log(chalk.yellow(`reading known keys from ${CMCD_CUSTOM_KEYS_REGISTRY.file}`));
		if (async) 
			readFile(
				CMCD_CUSTOM_KEYS_REGISTRY.file,
				{ encoding: "utf-8" },
				function (err, data) {
					if (!err) custom_keys = loadKeyData(data);
					else console.log(chalk.red(err.message));
				}
			);
		else 
			custom_keys = loadKeyData(readFileSync(CMCD_CUSTOM_KEYS_REGISTRY.file, { encoding: "utf-8" }).toString());
	}
}


/**
 * Check if the given key is a known CMCD custom key
 * 
 * @param {String} key   key to check 
 * @returns {String | undefined} The description of the custom key, if known, otherwise undedined
 */
export function isKnownCMCDCustomKey(key) {
	if (!custom_keys) return undefined;

	const found = custom_keys.keys.find((k) => k.keyName == key);
	return found ? found.valueDefinition : undefined;
}


export function CMCD_custom_stats(res) {
	if (custom_keys) {
		res.numSVTA_CustomKeys = custom_keys.keys.length;
	}		
}