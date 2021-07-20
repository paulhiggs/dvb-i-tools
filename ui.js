/* jshint esversion: 8 */

const phlib=require('./phlib/phlib.js');

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
const PAGE_BOTTOM="</body></html>";


function tabulateResults(res, error, errs) {

	const RESULT_WITH_INSTRUCTION="<br><p><i>Results:</i></p>";
	const SUMMARY_FORM_HEADER="<table><tr><th>item</th><th>count</th></tr>";
	
	DETAIL_FORM_HEADER = (mode) => `<table><tr><th>code</th><th>${mode}</th></tr>`;

	function tabluateMessage(value) {
		res.write('<tr>');
		res.write(`<td>${value.code?phlib.HTMLize(value.code):""}</td>`);
		res.write(`<td>${value.message?phlib.HTMLize(value.message):""}`);
		res.write(`${value.element?`<br/><span class=\"xmlfont\"><pre>${phlib.HTMLize(value.element)}</pre></span>`:""}</td>`);
		res.write('</tr>');
	}	

    res.write(RESULT_WITH_INSTRUCTION);
	if (error) 
		res.write(`<p>${error}</p>`);
	let resultsShown=false;
	if (errs) {

		if (errs.numCountsErr()>0 || errs.numCountsWarn()>0 ) {		
			res.write(SUMMARY_FORM_HEADER);
			Object.keys(errs.countsErr).forEach( function (i) {return res.write(`<tr><td>${phlib.HTMLize(i)}</td><td>${errs.countsErr[i]}</td></tr>`); });
			Object.keys(errs.countsWarn).forEach( function (i) {return res.write(`<tr><td><i>${phlib.HTMLize(i)}</i></td><td>${errs.countsWarn[i]}</td></tr>`); });
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
	}
	if (!error && !resultsShown) 
		res.write("no errors or warnings");
}

/**
 * constructs HTML output of the errors found in the service list analysis
 *
 * @param {boolean} URLmode    If true ask for a URL to a service list, if false ask for a file
 * @param {Object}  res        The Express result 
 * @param {string}  lastInput  The url of the service list - used to keep the form intact
 * @param {string}  error      a single error message to display on the form, genrrally related to loading the content to validate
 * @param {Object}  errors     the errors and warnings found during the content guide validation
 * @returns {Promise} the output stream (res) for further async processing
 */
module.exports.drawSLForm = function (URLmode, res, lastInput=null, error=null, errs=null) {
	
	const ENTRY_FORM_URL=`<form method=\"post\"><p><i>URL:</i></p><input type=\"url\" name=\"SLurl\" value=\"${lastInput?lastInput:""}\"><input type=\"submit\" value=\"submit\"></form>`;
	const ENTRY_FORM_FILE=`<form method=\"post\" encType=\"multipart/form-data\"><p><i>FILE:</i></p><input type=\"file\" name=\"SLfile\" value=\"${lastInput?lastInput:""}\"><input type=\"submit\" value=\"submit\"></form>`;

    res.write(PAGE_TOP('DVB-I Service List Validator'));    

	res.write(URLmode?ENTRY_FORM_URL:ENTRY_FORM_FILE);

	tabulateResults(res, error, errs);

	res.write(PAGE_BOTTOM);
	
	return new Promise((resolve, reject) => {
		resolve(res);
	});
};



/**
 * constructs HTML output of the errors found in the content guide analysis
 *
 * @param {boolean} URLmode   if true ask for a URL to a content guide, if false ask for a file
 * @param {Array}   supportedRequests the content guide request types
 * @param {Object}  res       the Express result 
 * @param {string}  lastInput the url or file name previously used - used to keep the form intact
 * @param {string}  lastType  the previously request type - used to keep the form intact
 * @param {string}  error     a single error message to display on the form, generally related to loading the content to validate
 * @param {ErrorList}  errors    the errors and warnings found during the content guide validation
 */
 module.exports.drawCGForm = function(URLmode, supportedRequests, res, lastInput=null, lastType=null, error=null, errs=null) {
	const ENTRY_FORM_URL=`<form method=\"post\"><p><i>URL:</i></p><input type=\"url\" name=\"CGurl\" value=\"${lastInput?lastInput:""}\"/><input type=\"submit\" value=\"submit\"/>`;
	const ENTRY_FORM_FILE=`<form method=\"post\" encType=\"multipart/form-data\"><p><i>FILE:</i></p><input type=\"file\" name=\"CGfile\" value=\"${lastInput ? lastInput : ""}\"/><input type=\"submit\" value=\"submit\"/>`;
	const ENTRY_FORM_END="</form>";

	const ENTRY_FORM_REQUEST_TYPE_HEADER="<p><i>REQUEST TYPE:</i></p>";

	const ENTRY_FORM_REQUEST_TYPE_ID="requestType";

    res.write(PAGE_TOP('DVB-I Content Guide Validator'));
    res.write(URLmode?ENTRY_FORM_URL:ENTRY_FORM_FILE);

	res.write(ENTRY_FORM_REQUEST_TYPE_HEADER);

	if (!lastType) 
		lastType=supportedRequests[0].value;
	supportedRequests.forEach(function (choice) {
		res.write(`<input type=\"radio\" name=${ENTRY_FORM_REQUEST_TYPE_ID.quote()} value=${choice.value.quote()}`);
		if (lastType==choice.value)
			res.write(" checked");
		res.write(`>${choice.label}</input>`);
	});
	res.write(ENTRY_FORM_END);

	tabulateResults(res, error, errs);

	//PH experimental stuff
/*	if (errs && errs.markupXML) {
		res.write("<hr><table class=\"markedup\">");
		errs.markupXML.forEach(line => {
			res.write(`<tr><td>${line.ix}</td>`);
			let indent=0;
			while (line.value.charAt(indent)==' ')
				indent++;
			res.write(`<td style="padding-left:${indent*10}px;"><span class=\"xmlfont\">${phlib.HTMLize(line.value)}</span>`);
			if (line.validationErrors) {
				line.validationErrors.forEach(error => {
					res.write(`<br/>${phlib.HTMLize(error)}`);
				});
			}
			res.write("</tr>");

		})
		res.write("</table><hr>");
	} */
	res.write(PAGE_BOTTOM);

	return new Promise(function (resolve, reject) {
		resolve(res);
	});
};