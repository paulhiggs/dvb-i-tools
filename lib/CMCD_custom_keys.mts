/**
 * CMCD_custom_keys.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 * 
 * Definitions and check related to CMCD
 *
 */

import { join } from "path";
import { readFile, readFileSync } from "fs";

import chalk from "chalk";
import * as fetchS from "sync-fetch";

import handleErrors from "./fetch_err_handler.mts";
import { __dirname, resouces_subDir } from "./data_locations.mts";


const CMCD_Registry_Filename = "registry.json";
const CMCD_CUSTOM_KEYS_REGISTRY = {
	file: join(__dirname, resouces_subDir, "CMCD", CMCD_Registry_Filename), 
  url : `https://raw.githubusercontent.com/streaming-video-technology-alliance/common-media-client-data-custom-keys/refs/heads/main/keys/${ CMCD_Registry_Filename}`,
};

let custom_keys = null;

function loadKeyData(keyData : string) {
	return JSON.parse(keyData);
}

export function LoadKnownCustomKeysRegistry(useURL, async = true) {
	console.log(chalk.yellow.underline("loading Known CMCD Custom keys ..."));

	if (useURL) {
		console.log(chalk.yellow(`retrieving known keys from ${CMCD_CUSTOM_KEYS_REGISTRY.url}`));
		if (async)
			fetch(CMCD_CUSTOM_KEYS_REGISTRY.url)
				.then(handleErrors)
				.then((response) => response.text())
				.then((responseText) => (custom_keys = loadKeyData(responseText)))
				.catch((error) => console.log(chalk.red(`error (${error}) retrieving ${CMCD_CUSTOM_KEYS_REGISTRY.url}`)));
		else {
			let resp = null;
			try {
				resp = fetchS(CMCD_CUSTOM_KEYS_REGISTRY.url);
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

export function isKnownCMCDCustomKey(key) {
	if (!custom_keys) return null;

	const found = custom_keys.keys.find((k) => k.keyName == key);
	return found ? found.valueDefinition : false;
}


export function CMCD_custom_stats(res) {
	if (custom_keys) {
		res.numSVTA_CustomKeys = custom_keys.keys.length;
	}		
}