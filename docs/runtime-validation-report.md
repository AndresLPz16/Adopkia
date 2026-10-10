# Runtime Validation Report

**Updated**: 2026-10-09
**Target**: `C:\Users\yoide\OneDrive\Desktop\Adopkia`
**Database scope**: MySQL `adopkia`, `test_adopkia` and temporary `adopkia_cmp`, user `adopkia_dev`

## Summary

| Step | Status | Exit Code | Details |
|---|---|---:|---|
| Django system check | PASS | 0 | `manage.py check`; no issues |
| Migration check | PASS | 0 | `manage.py makemigrations --check --dry-run`; no changes |
| Django tests | PASS | 0 | `manage.py test --noinput`; 53 tests |
| pytest | PASS | 0 | `python -m pytest --create-db -q`; 53 passed and 226 subtests |
| HTTP E2E/startup | PASS | 0 | `run_tests_e2e.py`; `runserver` readiness returned HTTP 200; 6 tests |
| Schema comparison | PASS | 0 | `manage.py compare_schema`; no differences in the compared categories |
| OpenAPI | PASS | 0 | `/api/docs/` returned HTML 200; `/api/schema/` returned parseable OpenAPI 3 JSON; `spectacular --validate` |
| Comparison DB cleanup | PASS | 0 | `SHOW DATABASES LIKE 'adopkia_cmp'` returned no row |
| Root API index | PASS | 0 | `/` returned HTTP 200 directly as standard DRF Api Root (JSON and HTML); it matched `/api/v1/`, including absolute resource URLs. |

**Overall**: PASS for the executed suites, HTTP scenarios, schema categories and documentation checks. The role matrix is evidence-based for the scenarios listed below; it is not a claim that every actor/verb/object permutation was individually enumerated.

## Bilingual implementation validation (latest)

| Check | Result |
|---|---|
| Django suite | PASS, exit 0; 53 tests. |
| pytest suite | PASS, exit 0; 53 tests and 226 subtests. |
| Django system and migration checks | PASS; no system issues and no model changes detected. |
| Bilingual tests | PASS; validation language, `Accept-Language`, catalog, notification, both admin prefixes, model/field labels and fallback covered. |
| Live API/admin/docs probes | PASS; root, `/api/v1/`, `/api/docs/`, `/api/schema/` and `/api-auth/login/` returned 200; admin paths redirected to login; browsable auth routes rendered HTML; English species included `Dog`. |
| OpenAPI | PASS; `spectacular --validate` exit 0 with no warnings/errors; JSON endpoint declared OpenAPI 3.0.3. |
| Schema | PASS; no differences; `adopkia_cmp` was confirmed absent afterward. |
| Translation catalog audit | PASS; Api Root title, description and anonymous guidance are translated for Spanish and English. `.mo` catalogs regenerated with polib because GNU `msgfmt` is unavailable. |

The local server on port 8000 was started temporarily for HTTP probes and stopped after verification. No credentials, password hashes, or tokens were displayed.

The first checks exposed an invalid `SAFE_METHODS` import and a language-negotiation issue where `LocaleMiddleware` forced Spanish on unprefixed API routes. Both were corrected. A test URL initially depended on the previous request's active translation; its language context was isolated, and the final complete suites pass.

## Test Evidence

- Latest Django and pytest runs each passed 53 tests; pytest also passed 226 subtests.
- `GET /` returned HTTP 200 directly: JSON responses matched `/api/v1/`, and the browsable HTML showed the standard `Log in` link and Api Root title.
- `/api-auth/login/` returned HTTP 200 in Spanish and English (`?lang=` and `Accept-Language`); the form accepts the email address as the username and a password.
- `/admin/` and `/en/admin/` returned HTTP 302 to their localized login routes.
- The JWT registration and login URLs rendered HTML forms for GET with HTTP 405, as those API endpoints do not support GET.
- `/api/v1/species/?lang=en` returned HTTP 200 and included `Dog`.
- HTTP runner ran 6 test cases and reported 375 `[PASS]` checks, including HTTP status and Content-Type assertions.
- Readiness: `GET /api/v1/species/` → 200.
- Docs: `GET /api/docs/` → 200, `text/html`.
- Schema: `GET /api/schema/?format=json` → 200, OpenAPI 3 JSON.
- Error/auth checks: duplicate email, empty required fields, invalid status and return date before adoption → 400 JSON; inactive user, absent token, invalid token and expired token → 401 JSON.
- CORS preflight allowed `http://localhost:3000` and `http://localhost:5173`, and rejected an unconfigured external origin.
- Photo registration by URL → 201 JSON. The adoption flow, approval, return, reminder command and messaging checks passed; the test asserts the expected notification counts.
- E2E fixture cleanup reported that records with the unique test prefix were deleted.
- `compare_schema` checked tables, columns, types, nullability, PK, UNIQUE, FK/actions, CHECK, functions, triggers and views: zero differences. Scope included 20 business tables, 31 FK relationships, 2 functions, 13 triggers and 2 views.
- `adopkia_cmp` was absent after comparison.
- No passwords, password hashes, or complete JWTs were included in the report.

### Schema comparison detail

| Category | Compared scope | Differences |
|---|---:|---:|
| Tables | 20 business tables | 0 |
| Columns, SQL types and nullability | All compared table columns | 0 |
| Primary keys and UNIQUE constraints | All compared tables | 0 |
| Foreign keys and delete actions | 31 FK relationships | 0 |
| CHECK constraints | All compared checks | 0 |
| Functions | 2 | 0 |
| Triggers | 13 | 0 |
| Views | 2 | 0 |

## Role / Action Matrix Evidence

| Actor | Verified behaviors and HTTP outcomes |
|---|---|
| Anonymous | Public catalog GETs → 200; protected collection GETs → 401; protected POST/PUT/PATCH/DELETE attempts → 401; adoption statistics → 401. |
| Adopter | Own request create/PATCH/cancel → 201/200/200; own message edit while unread and delete → 200/204; own notification mark-read/delete → 200/204; another adopter's request, conversation, message or notification → 404; cannot manage shelter, follow-up or another user's medical record → 403. |
| Shelter | Own shelter and pet PUT/PATCH → 200; own follow-up PATCH/DELETE → 200/204; own photo delete → 204; own reminder PUT/delete → 200/204; responsible member PATCH/delete → 200/204; another shelter's resources → 403 (or scoped member/request lookup → 404). |
| Administrator | Statistics → 200; tested shelter/pet updates and administrative deletes → 200/204; cannot create adoption requests, conversations or adopter messages → 403; cannot mutate another user's message, shelter membership or veterinarian profile → 403. |
| Veterinarian | Own veterinarian profile PATCH → 200; own medical-record create/PUT/PATCH/DELETE → 201/200/200/204; cannot create pets, adoption requests, conversations or messages → 403; approval/rejection actions → 404. |

All actor roles received 200 on protected collection reads; object-level checks above verify the tested ownership boundaries. The suite also exercised 405 for tested methods not implemented on the resource, rather than treating them as successful mutations. This report does not label unexecuted actor/object/verb combinations as passed.

## Issues Found and Corrections

| Issue | Cause | Correction / evidence |
|---|---|---|
| Administrator could send messages as a conversation participant | The shared conversation helper treated administrative read access as participant write access | Separated participant write authorization from administrative read access; HTTP E2E now verifies administrator message creation is 403. |
| PATCH of an adoption request could return 500 | The default model serializer update path attempted to assign the write-only `answers` list to the model | Added transactional request/answer update handling and partial-update support; added 3 Django regression tests, bringing both suites to 28; all pass. |
| Initial SQL-object migration was blocked by MySQL error 1419 | Binary logging disallowed function creation without `log_bin_trust_function_creators` | User enabled the required MySQL setting; rerun completed with exit 0. No privilege escalation or server configuration change was made by the test runner. |
| Previous documentation described blocked test runs and no schema comparison | README contained stale results from before MySQL function-creator configuration was enabled | Replaced the stale results with this validation cycle's outcomes. |

## Remaining Coverage Notes

- Docker CLI is unavailable. Node.js 24.21.0 and Playwright/Chromium are available; this update exercised the rendered admin login pages, but did not add a standalone Playwright assertion suite. Tests used the authorized live MySQL service, not a Docker fallback.
- The matrix test exercises all roles on the protected collection reads and probes the key allowed/denied mutation boundaries, including PUT/PATCH/DELETE. It does not exhaustively enumerate every Cartesian combination of five actor types × every resource × every object ownership state × every mutation verb. Such combinations are not reported as passed unless an assertion was run.
- The startup timing was not recorded; readiness was established by the successful HTTP response.

## Runtime Verdict

```text
environment:
  docker: UNAVAILABLE — Docker CLI not found
  node: AVAILABLE — v24.21.0
  playwright: AVAILABLE — Chromium installed; Spanish and English admin login pages rendered
  infra-tier: PRIMARY(MySQL) — real authorized MySQL databases used
  browser-tier: PRIMARY(Playwright browser rendering) — bilingual admin login pages; no standalone Playwright test runner
startup: PASS — existing runserver from this project; HTTP species/admin/docs/static probes returned 200; startup time not measured
integration: PASS — exit_code: 0, passed: 53, failed: 0, skipped: 0 (Django); 53 passed (pytest), 226 subtests; MySQL
e2e: PASS — exit_code: 0, passed: 6, failed: 0 in the existing HTTP runner; additional live HTTP probes and bilingual admin browser checks passed
overall: PASS — all final test commands exited 0; browser-test and exhaustive-matrix limits remain explicit
```
