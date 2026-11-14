# Runtime Validation Report

**Updated**: 2026-10-09
**Target**: `C:\Users\yoide\OneDrive\Desktop\Adopkia`
**Database scope**: MySQL `adopkia`, `test_adopkia` and temporary `adopkia_cmp`, user `adopkia_dev`

## Update 2026-11-12

The sections below record the 2026-10-09 validation cycle and are kept as historical evidence; the counts in them are no longer current. Results of the 2026-11-12 run, in `C:\Users\yoide\OneDrive\Desktop\Adopkia-main`:

| Step | Status | Details |
|---|---|---|
| Django system check | PASS | `manage.py check`; no issues |
| Migration check | PASS | `makemigrations --check --dry-run`; no changes |
| Django tests (MySQL) | PASS | `manage.py test --noinput`; 100 tests, none skipped |
| Django tests (SQLite) | PASS | 100 tests, 1 skipped (MySQL-only cases) |
| Schema comparison | PASS | `compare_schema`; 0 differences over 25 tables and 33 FK relationships after updating `database/adopkia_v3.sql`; `adopkia_cmp` absent afterwards |
| Frontend | PASS | `npm run typecheck` clean; `npm test` 73 tests in 15 files |
| Lint | PASS | `ruff check` |
| Static files without debug | PASS | `collectstatic` plus a temporary non-debug server returned 200 for admin and browsable-API CSS |

Not re-run in this cycle: `pytest`, the HTTP E2E runner (`run_tests_e2e.py`), the OpenAPI validation and any Azure deployment. The Azure Blob Storage path for uploaded photos has not been exercised against a real storage account.

Findings corrected in this cycle:

- `database/adopkia_v3.sql` had drifted from the migrations (12 differences: missing `codigo_verificacion_correo` and `reto_matematico_login`, missing `usuario.nombre_usuario` and `usuario.correo_verificado`, and mismatches in `permiso_rol`, `configuracion_portal` and `recordatorio.notas`). The reference DDL and `adopkia_v3_pruebas.sql` were updated; migrations were not changed.
- `compare_schema` never dropped `adopkia_cmp` because its pattern did not match the `CREATE DATABASE ... CHARACTER SET` statement; a copy from 2026-10-14 was still present. The pattern was fixed.
- Public authentication endpoints and the session login forms had no rate limits; they now return 429 beyond the configured rates (`users/test_throttling.py`).
- `Dockerfile.azure` did not collect or serve static files; WhiteNoise and `collectstatic` were added.

## Update 2026-11-13

Frontend only; the backend was not re-run in this update, so the 2026-11-12 backend results above still stand as last recorded.

| Step | Status | Details |
|---|---|---|
| Frontend typecheck | PASS | `npm run typecheck`; no errors |
| Frontend tests | PASS | `npm test`; 83 tests in 17 files (was 73 in 15) |

Changes covered by the new tests:

- `frontend/src/portal/loadAllPages.ts` follows the `next` link of paginated responses until every record is loaded. It rejects a `next` that points to another path, stops on a repeated page and caps a list at 500 pages (`loadAllPages.test.ts`).
- After a write, the portal reloads only the lists that the action can change, using `endpointsAffectedBy` in `frontend/src/portal/navigation.ts`; an unknown resource still reloads everything. Marking all notifications as read triggers a single reload (`PortalReload.test.tsx`).

The project was placed under Git on this date (initial commit `8c0905e`, branch `main`, no remote).

### Backend and HTTP E2E (same date, later run)

| Step | Status | Details |
|---|---|---|
| Django tests (MySQL) | PASS | `manage.py test --noinput`; 100 tests, none skipped |
| Django tests (SQLite) | PASS | 100 tests, 1 skipped (MySQL-only cases) |
| pytest (MySQL) | PASS | `python -m pytest --create-db -W error::DeprecationWarning`; 101 passed, 296 subtests |
| OpenAPI | PASS | `manage.py spectacular --validate`; exit 0, no errors |
| HTTP E2E | PASS | `run_tests_e2e.py`; 6 tests, 383 `[PASS]` checks; fixtures of the run removed by prefix |

Row counts of the business tables in `adopkia` were recorded before and after the E2E runs and matched, except `reto_matematico_login` (expired single-use login challenges, 1 to 0).

The E2E runner had not been run since the 2026-10 cycle and no longer worked against the current application. Corrections:

- **Runner could not start.** It runs without debug, so MySQL required verified TLS and the local server uses a self-signed certificate. `DB_SSL_MODE=disabled` is now also accepted when `DB_HOST` is local (`127.0.0.1`, `localhost`, `::1`), and the runner sets it. Remote hosts still require `verify_identity` outside debug.
- **Registration returned 503.** Without debug the verification code is sent through SMTP and no mail server is configured locally. The runner now uses Django's dummy email backend; the tests mark the accounts as verified.
- **Stale expectations in `tests_e2e/`.** The API root now returns `role`, `role_code` and `resources`; read serializers return the translated label in `status` and the catalog value in `status_code`; registration requires `username`. Role permissions are configurable, so the tests now derive the expected status from the `permiso_rol` matrix in force (`role_allows` in `tests_e2e/common.py`) instead of a fixed list. A role without the permission gets 403 before the object lookup, where the old tests expected 404 or 405.
- `E2E_SHOW_BODY=1` adds the response body to a failed status assertion, for local diagnosis only.
- SQLite mode used `DB_NAME` as the database file path and created an empty `adopkia` file in the project root on every run; it now always uses `db.sqlite3`.

Behaviour observed and left unchanged, for a decision:

- A non-adopter with role permission (administrator on adoption requests and conversations, shelter on conversations) is rejected by the integrity rule with 400, not 403. Nothing is created.
- The default matrix gives the adopter role no `reminders` permission, so an adopter got 403 on `/api/v1/reminders/`; the README route table lists the adopter as having access to their own reminders. Corrected the same day: `reminders:read` was added to the adopter defaults (`users/rbac.py`, frontend `permissions.ts`) and migration `users.0016_grant_adopter_reminder_read` grants it on existing databases. The adopter reads only the reminders of their own adoptions and still cannot create, edit or delete them (`medical.tests`, 101 Django tests; E2E `lectura/adopter/reminders/` returns 200).
- In the local `adopkia` database the adopter role differs from `DEFAULT_PERMISSIONS`: it lacks `notifications:update`, `formQuestions:read`, `shelters:read` and `vaccines:read`, and has `adoptionRequests:delete`, `notifications:delete`, `petPhotos:read` and `profile:delete`. With that matrix an adopter got 403 when marking a notification as read. Corrected the same day in the local database only: the four missing default permissions were added and the extra ones kept; a new E2E run confirmed `PATCH /api/v1/notifications/{id}/` returns 200 for the adopter. No migration or code changed, so other installations are not affected.
- `ShelterViewSet` validates the body before checking shelter membership, so an outsider sending an invalid `PUT` gets 400 rather than 403.

### Azure deployment and final run (2026-11-13, evening)

The application was deployed to an Azure for Students subscription, region `spaincentral`, resource group `rg-adopkia-prod-spc`: a Container App (express environment, 0.5 vCPU, scale to zero) serving the React portal and the API from one container, MySQL Flexible Server B1ms, Container Registry, Key Vault and a storage account for photos. The database holds the repository's demonstration dataset (42 users), not a copy of the local database.

| Step | Status | Details |
|---|---|---|
| Live routes | PASS | portal at `/`, `/app/dashboard` and `/admin/permissions`; `/api/v1/`, catalog endpoints, `/api/docs/`, admin login and static files returned 200 |
| Live flow with a temporary shelter account | PASS | login 200, profile 200, pet creation 201, photo upload 201; account and data removed afterwards |
| Azure Blob Storage for uploaded photos | PASS | the uploaded photo was readable at its public blob URL; after deleting the photo through the API the blob returned 404 |
| Verification email | PASS | a real registration returned 201 and the code arrived by email (Gmail SMTP); the test account was removed |

Findings during the deployment:

- MySQL provisioning was rejected in `northcentralus` (`ProvisionNotSupportedForRegion`) although the capability listing showed the SKU; it succeeded in `spaincentral`.
- Static Web Apps is not offered in any region the subscription allows, so the portal is built into the image and served by WhiteNoise (`DJANGO_FRONTEND_DIST`).
- The Container Apps express environment does not support Key Vault secret references; secrets are passed as app secrets.
- Deleting a photo left its blob behind. A `post_delete` handler now removes the stored file (also when the pet is deleted). Its first version did not match Azure URLs, because `AzureStorage.url()` drops the trailing slash of a folder name; fixed and covered by a test.

Final run on the code as deployed:

| Step | Status | Details |
|---|---|---|
| Django tests (MySQL) | PASS | 109 tests |
| pytest (MySQL) | PASS | 110 passed, 296 subtests |
| HTTP E2E | PASS | 6 tests, 383 `[PASS]` checks; local row counts unchanged |
| OpenAPI | PASS | `spectacular --validate`, exit 0 |
| Schema comparison | PASS | `compare_schema`, no differences |
| Frontend | PASS | typecheck clean; 83 tests in 17 files, four consecutive runs |

One frontend run reported 1 failed test out of 83 while pytest and the E2E runner were running at the same time on the same machine. The failing test was not captured and the failure did not repeat in four runs alone; a timing issue under load is the likely cause, not confirmed.

Not exercised: the E2E runner against the Azure deployment (it only targets the local database), and behaviour after the container scales to zero for a long period.

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
