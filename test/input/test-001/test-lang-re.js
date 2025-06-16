
const ConsoleColours = {
		Reset: "\x1b[0m",
		Bright: "\x1b[1m",
		Dim: "\x1b[2m",
		Underscore: "\x1b[4m",
		Blink: "\x1b[5m",
		Reverse: "\x1b[7m",
		Hidden: "\x1b[8m",

		FgBlack: "\x1b[30m",
		FgRed: "\x1b[31m",
		FgGreen: "\x1b[32m",
		FgYellow: "\x1b[33m",
		FgBlue: "\x1b[34m",
		FgMagenta: "\x1b[35m",
		FgCyan: "\x1b[36m",
		FgWhite: "\x1b[37m",

		BgBlack: "\x1b[40m",
		BgRed: "\x1b[41m",
		BgGreen: "\x1b[42m",
		BgYellow: "\x1b[43m",
		BgBlue: "\x1b[44m",
		BgMagenta: "\x1b[45m",
		BgCyan: "\x1b[46m",
		BgWhite: "\x1b[47m",
	},
	ConsoleGreen = `${ConsoleColours.Reset}${ConsoleColours.FgGreen}`,
	ConsoleRed = `${ConsoleColours.Reset}${ConsoleColours.FgRed}`,
	ConsoleCyan = `${ConsoleColours.Reset}${ConsoleColours.FgCyan}`;

var regular = "(art-lojban|cel-gaulish|no-bok|no-nyn|zh-guoyu|zh-hakka|zh-min|zh-min-nan|zh-xiang)";
var irregular = "(en-GB-oed|i-ami|i-bnn|i-default|i-enochian|i-hak|i-klingon|i-lux|i-mingo|i-navajo|i-pwn|i-tao|i-tay|i-tsu|sgn-BE-FR|sgn-BE-NL|sgn-CH-DE)";
var grandfathered = "(?<grandfathered>" + irregular + "|" + regular + ")";
var privateUse = "(?<privateUse>x(-[A-Za-z0-9]{1,8})+)";
var privateUse2 = "(?<privateUse2>x(-[A-Za-z0-9]{1,8})+)";
var singleton = "[0-9A-WY-Za-wy-z]";
var extension = "(?<extension>" + singleton + "(-[A-Za-z0-9]{2,8})+)";
var variant = "(?<variant>[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3})";
var region = "(?<region>[A-Za-z]{2}|[0-9]{3})";
var script = "(?<script>[A-Za-z]{4})";
var extlang = "(?<extlang>[A-Za-z]{3}(-[A-Za-z]{3}){0,2})";
var language = "(?<language>([A-Za-z]{2,3}(-" + extlang + ")?)|[A-Za-z]{4}|[A-Za-z]{5,8})";
var langtag = "(" + language + "(-" + script + ")?" + "(-" + region + ")?" + "(-" + variant + ")*" + "(-" + extension + ")*" + "(-" + privateUse2 + ")?" + ")";
var languageTag = "^(" + grandfathered + "|" + langtag + "|" + privateUse + ")$";


const test_exp = `${languageTag}`

const tests_language = [
	{item: "Language 001", pattern: test_exp, evaluate: "eng", expect: true },
	{item: "Language 002", pattern: test_exp, evaluate: "english", expect: true },
	{item: "Language 003", pattern: test_exp, evaluate: "engl!sh", expect: false },
	{item: "Language 004 (BCP47)", pattern: test_exp, evaluate: "zh-Hant-CN-x-private1-private2", expect: true},
	{item: "Language 005 (BCP47)", pattern: test_exp, evaluate: "zh-Hant-CN-x-private1", expect: true},
	{item: "Language 006 (BCP47)", pattern: test_exp, evaluate: "zh-Hant-CN", expect: true},
	{item: "Language 007 (BCP47)", pattern: test_exp, evaluate: "zh-Hant", expect: true},
	{item: "Language 008 (BCP47)", pattern: test_exp, evaluate: "zh", expect: true},


	{item: "Language 009", pattern: test_exp, evaluate: "zh-Hant-CN-x-", expect: false},
	{item: "Language 010", pattern: test_exp, evaluate: "zh-Hant-CN-x", expect: false},
	{item: "Language 011", pattern: test_exp, evaluate: "zh-", expect: false},

	{item: "Language 012", pattern: test_exp, evaluate: "zh-ziang", expect: true},
	

];

function doTest(test) {

	let showOutput = (testNo, value, result, expected) => {
		console.log(
			result == expected ? ConsoleGreen : ConsoleRed,
			`test ${testNo}(${value}) expect ${expected} --> ${result} ${result == expected ? "OK" : "FAIL!!"}`,
			ConsoleColours.Reset
		);		
	};
	
	if (Object.prototype.hasOwnProperty.call(test, "pattern")) {
		let re = new RegExp(`^${test.pattern}$`),
			res = re.test(test.evaluate);
		showOutput(test.item, test.evaluate, res, test.expect);
	}
	if (Object.prototype.hasOwnProperty.call(test, "fn")) {
		let res = test.fn(test.evaluate);
		showOutput(test.item, test.evaluate, res, test.expect);
	}
	if (Object.prototype.hasOwnProperty.call(test, "expression")) {
		let res = test.expression.test(test.evaluate);
		showOutput(test.item, test.evaluate, res, test.expect);
	}
}

tests_language.forEach((test) => doTest(test));