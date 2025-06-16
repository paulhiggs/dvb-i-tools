// test BCP47 language related regular expressions

import { BCP47_Language_Tag } from "../../../lib/pattern_checks.mjs"
import { isValidLangFormat } from "../../../lib/IANA_languages.mjs"

import { doTest } from "./expression_test_common.mjs";

const tests_language = [
	{item: "Language 001", pattern: BCP47_Language_Tag, evaluate: "eng", expect: true },
	{item: "Language 002", pattern: BCP47_Language_Tag, evaluate: "english", expect: true },
	{item: "Language 003", pattern: BCP47_Language_Tag, evaluate: "engl!sh", expect: false },
	{item: "Language 004 (BCP47)", pattern: BCP47_Language_Tag, evaluate: "zh-Hant-CN-x-private1-private2", expect: true},
	{item: "Language 005 (BCP47)", pattern: BCP47_Language_Tag, evaluate: "zh-Hant-CN-x-private1", expect: true},
	{item: "Language 006 (BCP47)", pattern: BCP47_Language_Tag, evaluate: "zh-Hant-CN", expect: true},
	{item: "Language 007 (BCP47)", pattern: BCP47_Language_Tag, evaluate: "zh-Hant", expect: true},
	{item: "Language 008 (BCP47)", pattern: BCP47_Language_Tag, evaluate: "zh", expect: true},

	{item: "Language 009", pattern: BCP47_Language_Tag, evaluate: "zh-Hant-CN-x-", expect: false},
	{item: "Language 010", pattern: BCP47_Language_Tag, evaluate: "zh-Hant-CN-x", expect: false},
	{item: "Language 011", pattern: BCP47_Language_Tag, evaluate: "zh-", expect: false},

	{item: "Language 012", fn: isValidLangFormat, evaluate: "zh-ziang", expect: true},
];


tests_language.forEach((test) => doTest(test));