import { HTMLize } from './phlib/phlib.js';
import { ERROR, WARNING, INFORMATION } from './ErrorList.js';
 
function PAGE_TOP(label) {
	const TABLE_STYLE="<style>table {border-collapse: collapse;border: 1px solid black;} th, td {text-align: left; padding: 8px;} tr:nth-child(even) {background-color: #f2f2f2;}	</style>";
	const XML_STYLE="<style>.xmlfont {font-family: Arial, Helvetica, sans-serif; font-size:90%;}</style>";
	
	const MARKUP_TABLE_STYLE="<style></style>";

	const METAS="<meta name=\"google\" content=\"notranslate\" />"; // dont allow Chrome to translate the page - seems to 'detect' German
	const HEAD=`<head>${METAS}${TABLE_STYLE}${XML_STYLE}${MARKUP_TABLE_STYLE}<title>${label}</title></head>`;
	const PG=`<html lang=\"en\" xml:lang=\"en\">\n${HEAD}<body>`;
	const PH=`<h1>${label}</h1>`;

	return `${PG}${PH}`;
}
const PAGE_BOTTOM="<br/><hr><p><i>Submit issues at </i><a href=\"https://github.com/paulhiggs/dvb-i-tools/issues\">https://github.com/paulhiggs/dvb-i-tools/issues</a></p></body></html>";


function tabulateResults(res, error, errs) {

	const RESULT_WITH_INSTRUCTION="<br><p><i>Results:</i></p>";
	const SUMMARY_FORM_HEADER="<table><tr><th>item</th><th>count</th></tr>";
	const Dodger_Blue="#1E90FF", link_css="jump";
	
	let DETAIL_FORM_HEADER = (mode) => `<table><tr><th>code</th><th>${mode}</th></tr>`;

	function tabluateMessage(value) {
		res.write('<tr>');
		let anchor=value.hasOwnProperty('line')?`line-${value.line}`:null;
		res.write(`<td>${anchor?`<a class="${link_css}" href="#${anchor}">`:""}${value.code?HTMLize(value.code):""}${anchor?"</a>":""}</td>`);
		res.write(`<td>${value.message?HTMLize(value.message):""}`);
		res.write(`${value.element?`<br/><span class=\"xmlfont\"><pre>${HTMLize(value.element)}</pre></span>`:""}</td>`);
		res.write('</tr>');
	}

    res.write(RESULT_WITH_INSTRUCTION);
	if (error) 
		res.write(`<p>${error}</p>`);
	let resultsShown=false;
	if (errs) {
		res.write(`<style>a.${link_css} {} a.${link_css}:link {color: ${Dodger_Blue}; text-decoration: none;} a.${link_css}:hover {text-decoration:underline; text-decoration-style: dashed} a.${link_css}:visited {color: ${Dodger_Blue};}</style>`);

		if (errs.numCountsErr()>0 || errs.numCountsWarn()>0 ) {		
			res.write(SUMMARY_FORM_HEADER);
			Object.keys(errs.countsErr).forEach( function (i) {return res.write(`<tr><td>${HTMLize(i)}</td><td>${errs.countsErr[i]}</td></tr>`); });
			Object.keys(errs.countsWarn).forEach( function (i) {return res.write(`<tr><td><i>${HTMLize(i)}</i></td><td>${errs.countsWarn[i]}</td></tr>`); });
			resultsShown=true;
			res.write("</table><br/>");
		}

		if (errs.numErrors() > 0) {
			res.write(DETAIL_FORM_HEADER("errors"));
			errs.errors.forEach(tabluateMessage);
			resultsShown=true;
			res.write("</table><br/>");
		} 

		if (errs.numWarnings()>0) {
			res.write(DETAIL_FORM_HEADER("warnings"));
			errs.warnings.forEach(tabluateMessage);
			resultsShown=true;
			res.write("</table><br/>");
		}

		if (errs.numInformationals()>0) {
			res.write(DETAIL_FORM_HEADER("informationals"));
			errs.informationals.forEach(tabluateMessage);
			resultsShown=true;
			res.write("</table><br/>");
		}

		if (errs.markupXML.length>0) {
			res.write("<hr/>EXPERIMENTAL - not all errors are indicated<hr/>");
			const ERR="errors", WARN="warnings", INFO="info",
				  style=(name,colour) => `<style>.${name} {position:relative; cursor:pointer; color:${colour};} .${name}[title]:hover:after {opacity:1; transition-delay:.1s; }</style>`;
			res.write(`${style(ERR, "red")}${style(WARN, "blue")}${style(INFO, "green")}<pre>`);
			errs.markupXML.forEach(line => {
				let cla="", tip=line.validationErrors?line.validationErrors.map(err=>HTMLize(err)).join('&#10;'):null;
				if (tip) {
					if (tip.includes(ERROR)) cla=ERR;
					else if (tip.includes(WARNING)) cla=WARN;
					else cla=INFO;
				}
				let qualifier=tip?` class="${cla}" title="${tip}"`:"";
				res.write(`<span id="line-${line.ix}"${qualifier}>${HTMLize(line.value)}</span><br/>`);
			});
			res.write("</pre><hr/>");
		} 
	}
	if (!error && !resultsShown) 
		res.write("no errors or warnings");
}


export function drawForm(deprecateTo, req, res, modes, supportedRequests, error=null, errs=null) {

	const ENTRY_FORM_REQUEST_TYPE_ID="requestType";

	res.setHeader('Content-Type','text/html');
	res.write(PAGE_TOP('DVB-I Validator'));
	if (deprecateTo)
		res.write(`<p style="color:orange;">This endpoint is deprecated, use ${deprecateTo} instead</p><br>`);
	res.write(`
	<script>
	function redrawForm() {
		document.getElementById("entryURL").hidden=!document.getElementById("radURL").checked
		document.getElementById("entryFile").hidden=!document.getElementById("radFile").checked
		document.getElementById("entryCGtype").hidden=!document.getElementById("radCG").checked
	}
	</script>
	<form method="post" encType="multipart/form-data">
		${modes.hasSL?`<input id="radSL" type="radio" name="testtype" value="${modes.sl}" ${req.session.data.mode==modes.sl?"checked":""} onclick="redrawForm()">Service List</input>`:""}
		${modes.hasCG?`<input id="radCG" type="radio" name="testtype" value="${modes.cg}" ${req.session.data.mode==modes.cg?"checked":""} onclick="redrawForm()">Content Guide</input>`:""}
		<br><br>
		<input id="radURL" type="radio" name="doclocation" value="${modes.url}" ${req.session.data.entry==modes.url?"checked":""} onclick="redrawForm()">URL</input>
		<input id="radFile" type="radio" name="doclocation" value="${modes.file}" ${req.session.data.entry==modes.file?"checked":""} onclick="redrawForm()">File</input>
		<hr>
		<div id="entryURL" ${req.session.data.entry==modes.url?"":"hidden"}><p><i>URL:</i><input type="url" name="XMLurl" value="${req.session.data.url?req.session.data.url:""}"></p></div>
		<div id="entryFile" ${req.session.data.entry==modes.file?"":"hidden"}><p><i>FILE:</i><input type="file" name="XMLfile" value=""></p></div>
		<div id="entryCGtype" ${req.session.data.mode==modes.cg?"":"hidden"}><p>Query type:</p>`);

	if (supportedRequests) supportedRequests.forEach(choice => {
		res.write(`<input type="radio" name=${ENTRY_FORM_REQUEST_TYPE_ID.quote()} value=${choice.value.quote()} ${choice.value==req.session.data.cgmode?"checked":""}>${choice.label}</input>`);
	});	
	res.write(`</div>
		<br><input type="submit" value="Validate!"><br>	
	</form>
	`);
	tabulateResults(res, error, errs);
	res.write(PAGE_BOTTOM);

	return new Promise((resolve, reject) => {
		resolve(res);
	});
}