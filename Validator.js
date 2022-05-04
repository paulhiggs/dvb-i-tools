import fetchS from 'sync-fetch';

import { drawForm } from "./ui.js";
import ErrorList from "./ErrorList.js";
import { isHTTPURL } from "./pattern_checks.js";


export const MODE_UNSPECIFIED="none", MODE_SL="sl", MODE_CG="cg", MODE_URL="url", MODE_FILE="file";

export function DVB_I_check(deprecationWarning, req, res, slcheck, cgcheck, hasSL, hasCG, mode=MODE_UNSPECIFIED, linktype=MODE_UNSPECIFIED) {

	if (!req.session.data) {
		// setup defaults
		req.session.data={};
		req.session.data.lastUrl="";
		req.session.data.mode=(mode==MODE_UNSPECIFIED)?(hasSL?MODE_SL:MODE_CG):mode;
		req.session.data.entry=(linktype==MODE_UNSPECIFIED)?MODE_URL:linktype;
		if (cgcheck) req.session.data.cgmode=cgcheck.supportedRequests[0].value;
	}
	if (req.session.data.lastUrl!=req.url) {
		req.session.data.mode=(mode==MODE_UNSPECIFIED)?(hasSL?MODE_SL:MODE_CG):mode;
		req.session.data.entry=(linktype==MODE_UNSPECIFIED)?MODE_URL:linktype;
		req.session.data.lastUrl=req.url;
	}

	let FormArguments={cg:MODE_CG, sl:MODE_SL, file:MODE_FILE, url:MODE_URL, hasSL:hasSL, hasCG:hasCG};
	if (!req.body.testtype) 
		drawForm(deprecationWarning?'/check':null, req, res, FormArguments, cgcheck?cgcheck.supportedRequests:null, null, null);
	else {
		let VVxml=null;
		req.parseErr=null;
		if (req.body.testtype==MODE_CG && req.body.requestType.length==0) 
			req.parseErr="request type not specified";
		else if (req.body.doclocation==MODE_URL && req.body.XMLurl.length==0)
			req.parseErr="URL not specified";
		else if (req.body.doclocation==MODE_FILE && !(req.files && req.files.XMLfile))
			req.parseErr="File not provided";

		if (!req.parseErr)
			switch (req.body.doclocation) {
				case MODE_URL:
					if (isHTTPURL(req.body.XMLurl)) {
						let resp=fetchS(req.body.XMLurl);
						if (resp.ok)
							VVxml=resp.text();
						else req.parseErr=`error (${resp.status}:${resp.statusText}) handling ${req.body.XMLurl}`;
					}
					else
						req.parseErr=`${req.body.XMLurl} is not an HTTP(S) URL`;
					req.session.data.url=req.body.XMLurl;

					break;
				case MODE_FILE:
					try {
						VVxml=req.files.XMLfile.data.toString();
					}
					catch (err) {
						req.parseErr=`retrieval of FILE ${req.files.XMLfile.name} failed`;
					}	
					req.session.data.url=null;			
					break;
				default:
					req.parseErr=`method is not "${MODE_URL}" or "${MODE_FILE}"`;
			}
		let errs=new ErrorList();
		if (!req.parseErr) 
			switch (req.body.testtype) {
				case MODE_CG:
					if (cgcheck) cgcheck.doValidateContentGuide(VVxml, req.body.requestType, errs);
					break;
				case MODE_SL:
					if (slcheck) slcheck.doValidateServiceList(VVxml, errs);
					break;
			}

		req.session.data.mode=req.body.testtype;
		req.session.data.entry=req.body.doclocation;
		if (req.body.requestType) req.session.data.cgmode=req.body.requestType;
		drawForm(deprecationWarning?'/check':null, req, res, FormArguments, cgcheck?cgcheck.supportedRequests:null, req.parseErr, errs);
	} 
	res.end();
}
