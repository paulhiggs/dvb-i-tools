# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Validators for DVB-I XML documents defined in DVB Bluebook A177 (revisions r0 to r8): service lists, content guide (TV-Anytime) fragments, playlists and service list registry (SLR / SLEPR) responses. It also includes a Service List Registry server that answers `/query` requests. Everything runs inside one Express web server.

- [all-in-one.ts](all-in-one.ts): the main entry point. It parses command-line options and calls `validator()` in [lib/validator.mts](lib/validator.mts), which sets up the Express app, the cluster workers, the routes (`/check`, `/validate_{sl,cg,pl,slr}[_json]`, `/query`, `/reload`, `/stats`, `/langs`) and the HTTP/HTTPS listeners.
- [csr.ts](csr.ts): a standalone SLR server with only the `/query` endpoint.
- [README.md](README.md) documents the command-line options and HTTP endpoints. Update it when you change either of them.

## Commands

Node ≥ 26.9 runs the `.ts`/`.mts` sources directly through type stripping. There is no build step.

```sh
npm start                 # node all-in-one.ts (HTTP :3030, HTTPS :3031 if selfsigned.crt/.key exist)
npm run lint              # eslint
npm run typecheck         # tsc --noEmit
npm test                  # testsuite/test-runner.ts runs all four test files
npm run test-documents    # only the XML document tests (also: test-expressions, test-lookups, test-languages)
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

The public entry points are `doValidateServiceList(text, errs, options)`, `doValidateContentGuide(text, type, errs, options)` and the matching methods on the other classes. `ServiceListCheck` holds a `ContentGuideCheck` so that it can validate content guide documents it traverses into.

A validation runs in this order:
1. `SchemaLoad` parses the document.
2. The root namespace selects the A177 revision.
3. `SchemaCheck` runs XSD validation against the matching `schemas/*.xsd`.
4. Hand-written semantic rules run for everything XSD can't express.

Rules that depend on the revision compare `SL_SchemaVersion(ns)` (or the CG/SLR equivalent) against `slVersions.rN`. The revision tables live in [lib/sl_data_versions.mts](lib/sl_data_versions.mts) and [lib/slr_data_versions.mts](lib/slr_data_versions.mts). Each table maps a namespace to its XSD file, its status (CURRENT/OLD/ETSI…) and its variant flags. `GERMAN_A177r6_VARIANT` selects the `-(DE)` schemas and extra rules; it is set with `variants=DE` or the `X-variants` header.

### Error reporting

[lib/error_list.mts](lib/error_list.mts) defines `ErrorList`. Every finding goes through `errs.addError({type, code, message, line?, fragment?, key?, clause?, description?})`. The type defaults to error. The other types are `WARNING`, `INFORMATION`, `FATAL`, `DEBUG` and `APPLICATION`. Codes are short prefixed identifiers (`SL005`, `AR032`, `TRAV001`…). The tests assert on these codes, so renumbering a code breaks the expectations in the test suite. Shared error builders are in [lib/common_errors.mts](lib/common_errors.mts).

### Network access and traversal

[lib/safe_fetch.mts](lib/safe_fetch.mts) is the only module that may retrieve a URL supplied by a client or found in a validated document. It enforces the fetch policy: http(s) only, an optional private-address block, a 10 MB size limit, a timeout and a concurrency limit. It also enforces the traversal limits: depth, document count, and de-duplication by URL.

A validation opens `using scope = ValidationScope.open()`. While the synchronous rules run, any network work is registered with `deferRetrieval(retrieve, complete)` or `deferTask()`. That work only runs at `scope.finish()`. Retrievals then run ahead concurrently, but the completions run in the order they were registered, so the report order stays deterministic. A nested validation of a traversed document opens a child scope that shares its parent's budget. Do not `await` a fetch directly inside rule code; use `deferRetrieval`.

### libxml2-wasm

XML is handled by `libxml2-wasm`. [libxml2-wasm-extensions.mts](libxml2-wasm-extensions.mts) and its `.d.ts` add helper methods (`attrAnyNs`, `attrAnyNsValueOr`, `getAnyNs`, `hasChild`, …) to `XmlElement` and `XmlDocument`, and the code uses these throughout. Documents live in WASM memory and must be disposed, so load them with `using` (e.g. `using SL = SchemaLoad(...)`). Call `xmlRegisterFsInputProviders()` before loading XSDs that use `xs:include`.

[lib/string-extensions.mts](lib/string-extensions.mts) adds `String.prototype` helpers such as `.quote()` and `.elementize()`. A module must import it for its side effect before using them.

### Reference data

- Element, attribute and namespace names come from constant objects (`dvbi`, `tva`, `mpeg7`, `dvb`…) in the `*_definitions.mts` files. Use these instead of string literals.
- The allowed child elements and attributes for each element are listed in `dvbiEC`/`dvbiEA` and `tvaEC`/`tvaEA`. `checkTopElementsAndCardinality` and `checkAttributes` check against these lists.
- Classification schemes, ISO countries and IANA languages are loaded from `res/` by default, or from the network with `--urls`. The local paths and remote URLs are both listed in [lib/data_locations.mts](lib/data_locations.mts). The loaders are in `classification_scheme_loaders.mts`.
- `registries/slepr-main.xml` is the master SLEPR document. [lib/slepr.mts](lib/slepr.mts) prunes it to answer `/query`.

### UI

[lib/ui.mts](lib/ui.mts) renders the `/check` form and the HTML results, which are streamed with backpressure. All values from documents or requests must go through `escapeHTML` from `utils.mts`.

## Conventions

- Format with tabs (width 2), LF line endings, double quotes and a print width of 180 (see `.prettierrc.cjs` and `.editorconfig`).
- Imports include the `.mts`/`.ts` extension (`allowImportingTsExtensions`, `module: nodenext`).
- Source files start with the standard header comment: file name, copyright Paul Higgs, BSD-2-Clause.
- Commit messages are short and imperative. PRs are merged with `Merge pull request #N: <summary>`. Version bumps in `package.json` are separate commits.
