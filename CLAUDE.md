# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Validators for DVB-I XML documents defined in DVB Bluebook A177 (revisions r0 to r8): service lists, content guide (TV-Anytime) fragments, playlists and service list registry (SLR / SLEPR) responses, and the XML AIT documents (ETSI TS 102 809) they refer to. It also includes a Service List Registry server that answers `/query` requests. Everything runs inside one Express web server.

- [all-in-one.ts](all-in-one.ts): the main entry point. It parses command-line options and calls `validator()` in [lib/validator.mts](lib/validator.mts), which only puts the parts together:
  - [lib/config.mts](lib/config.mts): `loadConfig(options)` checks and normalises the options into a frozen `ValidatorConfig`, and throws a `ConfigError` for a bad option (only `validator()` exits). `applyFetchPolicy()` sets the server's fetch policy.
  - [lib/services.mts](lib/services.mts): `createServices(config)` loads the reference data, and builds the checkers and the SLEPR once.
  - [lib/app.mts](lib/app.mts): `createApp(config, services)` builds the Express application:
    - the middleware: CORS, `helmet()` with the `CONTENT_SECURITY_POLICY` (`'self'` only, and no `upgrade-insecure-requests`), the page stylesheet and script (`PAGE_ASSETS`), the favicon and the request logging. The form's body parsers (`express-fileupload` with the 10 MB limit, and `express.urlencoded()`) are only on the `/check` route. There are no sessions: the form is drawn from a `FormState`, the defaults or the values just submitted
    - a router for each feature in [lib/routes/](lib/routes/): `validate.mts` for `/validate_{sl,cg,pl,slr,ait}[_json]`, `check.mts` for `/check`, `slepr.mts` for `/query` and `/reload`, and `info.mts` for `/stats` and `/langs`
    - the 404 for any method
    - the error handler

    It does not listen or exit, so it can be tested in-process on an ephemeral port. `routes/request_handling.mts` holds the shared request readers and `report()`.

    The handlers check the request first, then validate, then send the results. The readers return what they found instead of changing `req`: `getDocument()` gives `{document, parseErr}` and `requestFromQuery()` gives `{options}` or `{parseErr}`. The outcome for the request log (`parseErr`, `diags`, `vary`) goes in `res.locals`, typed in `express-extensions.d.ts`, through `recordOutcome()` or `sendRegistryResponse()`. `SLEPR.processServiceListRequest(query, userAgent)` returns a `RegistryResponse` and does not use Express.
  - [lib/server.mts](lib/server.mts): `startWorkers()` for `--workers`, and `startServer()` for the HTTP/HTTPS listeners and the HTTP-to-HTTPS redirect. On `SIGTERM`/`SIGINT` it sets `app.locals.stopping` (so `/healthz` reports `stopping`), closes the servers, calls `stopAllValidations()` (`safe_fetch.mts`) and exits within `SHUTDOWN_GRACE_MS`. With workers, `restartWorkersOnExit()` passes the signal on and stops restarting them.
  - [lib/request_logging.mts](lib/request_logging.mts): the morgan request log.
- [csr.ts](csr.ts): a standalone SLR server with only the `/query` endpoint.
- [README.md](README.md) documents the command-line options and HTTP endpoints. Update it when you change either of them.

## Commands

Node ≥ 26.9 runs the `.ts`/`.mts` sources directly through type stripping. There is no build step.

```sh
npm start                 # node all-in-one.ts (HTTP :3030, HTTPS :3031 if selfsigned.crt/.key exist)
npm run lint              # eslint
npm run typecheck         # tsc --noEmit
npm test                  # testsuite/test-runner.ts runs all six test files
npm run test-documents    # only the XML document tests (also: test-expressions, test-lookups, test-languages, test-app, test-revisions)
```

CI ([.github/workflows](.github/workflows)) runs lint, typecheck and test on every push, so all three must pass.

Running a subset of tests (they use `node:test`):

```sh
node --test-name-pattern="Playists" testsuite/test-documents.ts
node --experimental-test-tag-filter=16 testsuite/test-documents.ts   # tags are the test-NNN directory numbers
```

## Test suite

`testsuite/` is a **git submodule** ([paulhiggs/dvb-i-tools.testsuite](https://github.com/paulhiggs/dvb-i-tools.testsuite)). Clone with `--recurse-submodules`, or run `git submodule update --init`. New or changed test documents are committed in the submodule repository.

[testsuite/test-documents.ts](testsuite/test-documents.ts) maps each `test-NNN/` directory to a validator. For a CG directory it also gives the request type (e.g. `test-008/` → `NowNext`). Every `.xml` file in the directory becomes a test. The expected result is taken from one of these:
- a sibling `<name>.expect.json` file with `{fatals, errors, warnings, informationals, debugs}` arrays of `{code, count?}`, or
- comments inside the XML: `<!-- dvb-i-tools.expect errors:[{"code":"SL005"}], warnings:[{"code":"X","count":2}] -->`.

The match is exact. Each expected code must occur `count` times (default 1), and any unexpected code fails the test. A file with no expectation is reported as `todo`. `test-003-net/` is skipped when the network is unavailable.

## Architecture

### Checkers

Each document type has one checker class. The class is constructed once and reused for every request, because its constructor loads all classification schemes and XSD schemas:
- `ServiceListCheck` in [lib/sl_check.mts](lib/sl_check.mts), with helpers in `sl_check_helpers.mts`
- `ContentGuideCheck` in [lib/cg_check.mts](lib/cg_check.mts), with helpers in `cg_check_helpers.mts`
- `PlaylistCheck` in [lib/playlist_check.mts](lib/playlist_check.mts)
- `ServiceListRegistryCheck` in [lib/slr_check.mts](lib/slr_check.mts)
- `XmlAitCheck` in [lib/ait_check.mts](lib/ait_check.mts), with names in `MHP_definitions.mts` (#134). `doValidateXmlAit(text, role, errs, options)` takes the role of the AIT (`linked`, `deeplink` or `template`), as the A177 rules differ for each. Its schemas are in `schemas/ts102809/2009/` and `2026/`, each folder with the imports its `mis_xmlait*.xsd` expects (keep them there, unchanged). The service list and content guide checkers get it as `opts.aitcheck`, and hand the AITs their documents refer to to `validateReferencedAit()` when the request has `aits`, which validates them like a traversed document

The public entry points are `doValidateServiceList(text, errs, options)`, `doValidateContentGuide(text, type, errs, options)` and the matching methods on the other classes. `ServiceListCheck` holds a `ContentGuideCheck` so that it can validate content guide documents it traverses into.

A validation runs in this order:
1. `SchemaLoad` parses the document.
2. The root namespace selects the A177 revision.
3. `SchemaCheck` runs XSD validation against the matching `schemas/*.xsd`.
4. Hand-written semantic rules run for everything XSD can't express.

Rules that depend on the revision compare `SL_SchemaVersion(ns)` (or the CG/SLR equivalent) against `slVersions.rN`. The revisions are objects of two distinct classes in [lib/revisions.mts](lib/revisions.mts) (#125), derived from one base class: `A177Revision` (`slVersions`, from `SL_SchemaVersion()` and `SLR_SchemaVersion()`, up to `r8`) and `TVARevision` (`cgVersions`, from `CG_SchemaVersion()`, up to `r3`). `<`, `<=`, `>`, `>=`, `==` and `!=` work within one class; comparing the two classes, or a revision with a number, does not compile. Revisions are only compared: there is no arithmetic on them, and `known` is used instead of `!`. Each `A177Revision` has `tvAnytime`, the TV-Anytime revision its service list schema imports (#128): a rule on TV-Anytime elements that occur in both service lists and content guides (such as `AccessibilityAttributes`) compares that revision with `cgVersions`, never `CG_SchemaVersion()` of a service list's namespace, which is `unknown`. A new revision is added in its class (and `latest` moved to it), and its tests in `testsuite/test-revisions.ts`. The revision tables live in [lib/sl_data_versions.mts](lib/sl_data_versions.mts) and [lib/slr_data_versions.mts](lib/slr_data_versions.mts). Each table maps a namespace to its XSD file and its status (CURRENT/OLD/ETSI…).

### Markets

A market (#119) is the settings of a market deployment, defined in [res/markets.json](res/markets.json) and loaded by [lib/markets.mts](lib/markets.mts) (`LoadMarkets()`, once, from `createServices()` and the SL/SLR checker constructors). The loader checks the file itself (there is no JSON schema): an unknown property, parameter or revision, a bad value or a missing XSD is a `MarketsError`, which stops the start-up. Germany is the market `DE`: its `-(DE)` schemas for r6 and 7 schedule days for every revision.
- A validation is for one market or none: `ValidationRequest.market` (an id), set with `market=` / `X-market` (or the deprecated `variants=` / `X-variants`) by `getMarket()`, and the Market choice of `/check`. An undefined market is answered with 400.
- Rules read the settings for the document's A177 revision with `currentMarket(revision)` (`safe_fetch.mts`), e.g. `currentMarket(rev).parameters.schedule.daysEitherSide`. Without a market they are `MARKET_DEFAULTS`, the A177 values. `SL_GetSchema()` / `SLR_GetSchema()` take the market's schema for the revision when it gives one.
- A new parameter is added to `MarketParameters`, `MARKET_DEFAULTS` and `PARAMETER_CHECKS` in `markets.mts`, to the README, and to the rule that reads it. Say "market", not "variant".

### Error reporting

[lib/error_list.mts](lib/error_list.mts) defines `ErrorList`. Every finding goes through `errs.addError({type, code, message, line?, fragment?, key?, clause?, description?})`. The type defaults to error. The other types are `WARNING`, `INFORMATION`, `FATAL`, `DEBUG` and `APPLICATION`. Codes are short prefixed identifiers (`SL005`, `AR032`, `TRAV001`…). The tests assert on these codes, so renumbering a code breaks the expectations in the test suite. Shared error builders are in [lib/common_errors.mts](lib/common_errors.mts).

A traversed document's results are kept in a summary list (`ErrorList.summaryOnly()`), which only counts each code (`codeCounts`). A large traversal keeps tens of thousands of these, so their arrays and counts are frozen objects shared by all of them until something is added (#99). Add to an `ErrorList` only through `addError()` and `addNested()`, never by writing to its arrays.

### Network access and traversal

[lib/safe_fetch.mts](lib/safe_fetch.mts) is the only module that may retrieve a URL supplied by a client or found in a validated document. It enforces the fetch policy: http(s) only, an optional private-address block, a 10 MB size limit, a timeout and a concurrency limit. It also enforces the traversal limits: depth, document count, and de-duplication by URL.

A validation opens `using scope = ValidationScope.open()`. While the synchronous rules run, any network work is registered with `deferRetrieval(retrieve, complete)` or `deferTask()`. That work only runs at `scope.finish()`. Retrievals then run ahead concurrently, but the completions run in the order they were registered, so the report order stays deterministic. A nested validation of a traversed document opens a child scope that shares its parent's budget. Do not `await` a fetch directly inside rule code; use `deferRetrieval`.

The network calls themselves (`fetch()` in `safeFetch()`, and the work given to `withFetchSlots()`) run outside every validation's asynchronous context (`networkWork()`). Node keeps the context a long-lived handle is created in, such as a pooled keep-alive socket or the DNS resolver, and a validation's context reaches all its results. Make any new network call through these two functions. When the outermost scope is disposed, its budget also lets go of the traversed documents' results and the shared retrievals (#99). A shared retrieval (`retrieveResource()`) keeps only what the checks need, not the content: the one exception is an XML AIT that is also validated (`keepContent`), whose content `validateReferencedAit()` removes once it has validated it (#134).

### Validation request and per-document options

Two kinds of input reach a validator, and they travel differently:
- **Choices for the whole validation** are a `ValidationRequest` (`lib/safe_fetch.mts`):
  - the fields are `traverse`, `maxTraversal`, `images`, `aits`, `market`, `report_schema_version` and `log_prefix`
  - the outermost validation sets them once, from the options it is given: `ValidationScope.open(options)`
  - every document it traverses into uses the same choices, and ignores the options it is given for them
  - rules read them with `currentRequest()`, never from their `options` parameter
  - only the outermost document (`scope.depth == 0`) is archived with `log_prefix`

  `validator.mts` builds the request in one place for each entry point: `requestFromCheckForm()` for `/check`, and `requestFromQuery()` for the `/validate_*` endpoints. A new per-request choice is added to `ValidationRequest`, to these builders, and to the rule that reads it. Nothing needs to be passed on at traversal points.
- **Values that belong to one document** are passed explicitly. These are the content guide endpoints (`CG_Endpoints`: `progInfo_ep`, `grpInfo_ep`, `mEpisodes_ep`), which come from the service list that refers to the document, and the `scheduleWindow` of a timestamp filtered schedule requested during traversal (`CG_ScheduleWindow`), whose events are added to the coverage of its service ([lib/schedule_coverage.mts](lib/schedule_coverage.mts), #122). The coverage is evaluated by a `deferTask()` registered after the service's windows, so it runs once they have all been validated.

Other context is also carried by the scope:
- **Signature policies:** `setSignaturePolicies()` / `signaturePoliciesInEffect()`
- **Retrievals shared within a validation:** `sharedRetrieval()`, `firstReference()`
- **Timing:** `ValidationScope.timing()`, or `validationTiming(handle)` while the validation runs
- **Progress:**
  - `observeValidation(observer, work)` attaches a `ValidationObserver` to the validation that the work starts.
  - The observer is told when the outermost document's own rules have been checked, and when each traversed document is requested, started, finished or skipped (the `traversal*()` calls in `traversal.mts`).
  - Its `cancelled` flag stops the validation.
  - `ProgressReport` in [lib/progress.mts](lib/progress.mts) uses this for the live view of `/check` (`Accept: application/x-ndjson`).
  - A new place that traverses into a document must call `traversalStarted()`, `traversalFinished()` and `traversalSkipped()`, as `validateContentGuide()` and `validateServiceList()` do.

The public `doValidate…(text, errs, options)` methods keep their option names (`SL_Validator_Options` and the others are `ValidationOptions`), so the testsuite can call them directly.

### libxml2-wasm

XML is handled by `libxml2-wasm`. [libxml2-wasm-extensions.mts](libxml2-wasm-extensions.mts) and its `.d.ts` add helper methods (`attrAnyNs`, `attrAnyNsValueOr`, `getAnyNs`, `hasChild`, …) to `XmlElement` and `XmlDocument`, and the code uses these throughout. Documents live in WASM memory and must be disposed, so load them with `using` (e.g. `using SL = SchemaLoad(...)`). Call `xmlRegisterFsInputProviders()` before loading XSDs that use `xs:include`.

[lib/string-extensions.mts](lib/string-extensions.mts) adds `String.prototype` helpers such as `.quote()` and `.elementize()`. A module must import it for its side effect before using them.

### Reference data

- Element, attribute and namespace names come from constant objects (`dvbi`, `tva`, `mpeg7`, `dvb`…) in the `*_definitions.mts` files. Use these instead of string literals.
- The allowed child elements and attributes for each element are listed in `dvbiEC`/`dvbiEA` and `tvaEC`/`tvaEA`. `checkTopElementsAndCardinality` and `checkAttributes` check against these lists.
- Classification schemes, ISO countries and IANA languages are loaded from `res/` by default, or from the network with `--urls`. The local paths and remote URLs are both listed in [lib/data_locations.mts](lib/data_locations.mts). The loaders are in `classification_scheme_loaders.mts`.
- `registries/slepr-main.xml` is the master SLEPR document. [lib/slepr.mts](lib/slepr.mts) prunes it to answer `/query`.

### UI

[lib/ui.mts](lib/ui.mts) renders every page (the `/check` form, the HTML results, `/stats` and `/langs`). The results are streamed with backpressure. Pages are built with the `html` tagged template from [lib/html.mts](lib/html.mts):
- `html` escapes every interpolated value with `escapeHTML`, unless the value is already `HTML`. Arrays are joined, and `undefined`, `null` and `false` give nothing.
- `text(value)` shows text with `HTMLize()`, which also gives non-breaking hyphens. It is used for codes, messages and the marked-up listing.
- `raw(markup)` is only for markup the validator provides itself (fixed markup and the `--motd` file). Never use it for a value from a document or a request.

The pages have no inline scripts, styles or event handlers, as the content security policy refuses them. The stylesheet (`STYLESHEET`) and the one page script (`PAGE_SCRIPT`) are served from memory as `PAGE_ASSETS` (`/ui/validator.css` and `/ui/validator.js`, with `?v=` a hash of the content). Add behaviour to `PAGE_SCRIPT`, which finds its elements by id or class (and `data-` attributes for settings), and add styles to `STYLESHEET`, not `style=` attributes.

Build new markup with `html`, not with plain template strings.

## Conventions

- Format with tabs (width 2), LF line endings, double quotes and a print width of 180 (see `.prettierrc.cjs` and `.editorconfig`).
- Imports include the `.mts`/`.ts` extension (`allowImportingTsExtensions`, `module: nodenext`).
- Source files start with the standard header comment: file name, copyright Paul Higgs, BSD-2-Clause.
- Commit messages are short and imperative. PRs are merged with `Merge pull request #N: <summary>`. Each PR bumps the patch version (`npm version patch --no-git-tag-version`), and the bump in `package.json` and `package-lock.json` is part of the change's own commit.

## Issues

Always record as much information as possible in the related GitHub issue. The issues are the project's record of why things are the way they are, which helps future maintenance and learning. Include:
- the problem and how it was investigated, including measurements (timings, memory, report sizes, counts) and the commands or method used to get them
- the decisions taken and the alternatives considered, with the reasons
- the specification clauses that apply (A177 revision and clause)
- what was implemented, the files changed, and any new error codes with their meaning
- how it was tested and what the tests covered, including results on real service lists such as the BMT Germany testbed
- any limitations, follow-up work, or other issues it relates to

Add this as a comment when the work is done, and before a branch with experimental work is deleted. A PR description can summarise the change, but the issue keeps the full detail.
