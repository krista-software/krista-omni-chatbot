# PR Review Guide — KR-21136: Selection Field (Entity) Search Fix

**Branch:** `hotfix/KR-21136` → `release/omni-chatbot`
**Jira:** [KR-21136](https://antbrains.atlassian.net/browse/KR-21136) (fix), [KR-21139](https://antbrains.atlassian.net/browse/KR-21139) (refactor commit — same fix, engineering-task view of the ticket)
**Extension version:** 3.0.5 → 3.0.6
**Scope:** three fixes, one theme — entity search in the chatbot:
1. Standalone Selection field search 404 (routing) — sections 2–4
2. Table-level attached-entity search contract + button gate — section 5
3. Entity-selection COLUMNS inside tables rendered manual entry instead of the search dialog — section 6
**Blast radius:** Frontend only (Angular). Zero backend/Java changes in the fix itself.

---

## 1. What was broken (symptom)

Entity search ("Selection field" search modal in chat forms) returned
**`404 Not Found — nginx/1.30.3`** on every environment.
It worked in chatbot 2.0.16 (the old React app) but not in the current Angular app.

Key observation for reviewers: the 404 page is **nginx's own**, not the extension's —
the request never reached the extension at all. This immediately rules out the
backend endpoint.

## 2. Root cause

`EntitySearchService` was the **only** service in the Angular app that did not go
through `ApiService`. It hand-built its URL:

```typescript
// OLD (broken):
const routingId = window.AppConfig?.chatbotRoutingId || 'A_pR4e9i1qxSCWDPK5rDuig_e_e';
const url = `/extension/api/${routingId}/chatbot/entities/search`;
```

Three stacked failures:

1. **`window.AppConfig` no longer exists.** It came from `config.js`, which was
   removed in an earlier cleanup (script tag, asset, and generate-config build step
   all deleted). So the lookup is always `undefined`.
2. **The fallback is a hardcoded dev routing ID** (`A_pR4e9i1qxSCWDPK5rDuig_e_e`)
   that exists in no real environment → nginx has nothing to route to → 404.
3. **The hand-rolled path is missing the node prefix** (e.g. `/node1/…`) that the
   server-injected `window.basePath` carries. Even with a correct routing ID, a
   bare `/extension/api/<id>/…` path is not guaranteed to route.

Why 2.0.16 worked: the React app built this URL from its own working base-path
config. This one service was simply never migrated during the Angular rewrite.

**Backend verification done:** `POST /chatbot/entities/search`
(`ChatBotResource.java:230` + SDK `EntitySearchResource` in `ChatBotApplication`)
is byte-for-byte identical between tag `omni-chatbot-2.0.16` and current code.
Nothing to review server-side.

## 3. The fix (what to review, file by file)

### `src/app/services/entity-search.service.ts` (the heart of the PR)

| Before | After |
|---|---|
| Raw `HttpClient` + hand-built URL | `ApiService.post()` with endpoint from `environment.apiEndpoints` |
| URL from dead `window.AppConfig` + hardcoded fallback | URL from `environment.chatbotRoutingId` = `AppConfig.getChatbotRoutingPath()` = server-injected `window.basePath` (correct routing ID **and** node prefix — same mechanism as every working endpoint: config, session, messages) |
| No session headers | `Chatbot-Session-Id` + `X-Krista-Context` attached automatically by `ApiService` |
| Error handler read `HttpErrorResponse.error.message` | Error handler reads `Error.message` (see "Error contract" below) |

**Signature trim (review feedback, applied):** `searchEntities(searchDto)` — the
`_workspaceId` / `_clientSessionId` / `_timeout` params were dead (session id
comes from `StorageService` inside `getAuthenticatedHeaders`; timeout was never
implemented) and are removed, along with the modal's `workspaceId` /
`clientSessionId` `@Input`s that existed solely to feed them, and their bindings
in `entity-selector-field.component.html` and `table-field.component.html`.
The AOT compiler validates no binding is left dangling.

**What did NOT change (regression safety):**
- Request payload shape (`sourceField/filterFieldName/value/page/count`) — identical.
- Response transformation (`transformResponse`) — untouched.
- Cancellation logic (`cancelSubject` / `cancelSearch()`) — untouched.
- The modal still receives the same `{status: 'error', errorMessage}` object on failure.

**Error contract (worth 2 minutes of reviewer attention):**
`ApiService.handleError` catches the `HttpErrorResponse` and re-throws a plain
`Error` whose `message` already contains the server's error message. So the old
two-step read (`error.error?.message || error.message`) collapses to
`error.message` — same user-visible result, simpler code.

### `src/environments/environment.ts` + `environment.prod.ts`

One line each: `searchEntities: 'chatbot/entities/search'` added to
`apiEndpoints`, following the exact pattern of the nine existing entries.

### `ChatBotExtension.java` + `release-notes.md` (commit 2)

Version bump `3.0.5` → `3.0.6` and the KR-21136 release-note entry. Mechanical.

## 4. Behavior change reviewers should be aware of

The request now carries the user's session headers. Previously it was sent
**anonymously** — `GuestRequestAuthenticator` returns `null` when no session
header/cookie is present, and `/entities/search` accepts anonymous callers, which
is why a routing-ID-only fix also worked in manual testing.

Attaching the session identity:
- makes entity search consistent with every other API call,
- is what the 2.0.16 app effectively did,
- adds no failure risk in practice: an invalid/stale session resolves to `null`
  in the authenticator and the request proceeds anonymously — same as before.

Side effect (expected, harmless): the POST now triggers a CORS preflight when
cross-origin, exactly like `submitMessage`/`session` already do. No new CORS
surface.

## 5. Table-level entity search: 2.0.16 contract + button gate

Two changes restore the 2.0.16 behavior for the TABLE-LEVEL "add rows from
entity search" feature (the table's attached `meta.entity`):

1. **`table-field.component.html`** — the search modal now receives the WHOLE
   table field (`[field]="field"`), not `meta.entity`. Verified against the
   2.0.16 tag end-to-end: `TableFieldRenderer.tsx:217` passed
   `fieldState.field` (the table's raw field JSON via
   `KSDKFormField.toJSON() → this.source`), and the backend
   `EntitySearchService` has a dedicated `com.krista.fields.Table` branch that
   extracts `meta.entity` itself.
2. **`table-field.component.ts`** — the search button is gated on
   `entitySelectorMeta?.entityTypeDomain` (2.0.16's
   `EntitySelectorMeta.hasEntity`). Without that attribute no backend branch
   can resolve the entity, so previously the button offered a doomed search.
   Tables whose omni-medium message lacks `entityTypeDomain` on `meta.entity`
   now hide the button — exactly what 2.0.16 did.
3. **`entity-search.service.ts` — `normalizeEntityAttributes()`** — the
   serialization normalization (entityDefinition.fields array→object, strip
   frontend-only metadata) now also applies to the nested
   `meta.entity.attributeValues` (table shape), because
   `EntitySelectorMetaParser` mutates it in place by reference.

> Note for reviewers: kristaclient is NOT a reference for this path — it uses a
> platform BFF endpoint (`/entities/tablefield/search`, invokerId+entityType+
> fieldId) that does not exist in the chatbot extension. The 2.0.16 chatbot is
> the correct contract.

## 6. Entity-selection COLUMNS inside tables (the "manual entry" bug)

**Symptom:** a `com.krista.fields.Entity` column inside a table offered plain
text/number inputs ("enter data") instead of the entity search dialog.

**Root cause:** `table-field.component.ts` treated `ENTITY_SELECTION` as a
composite column type and flattened it into manual-entry sub-columns
(`Column1.Name`, `Column1.Age`). The submitted values carried **no
primaryKey**, so the backend could never map them to an entity record — the
flow was broken end-to-end, not just cosmetically. In 2.0.16, `SelectionField
extends KristaTypeField` (NOT `BaseCompositeField`) — entity-selection columns
render as a single cell with the search dialog. Only `EntityField`
(EntityReference) is composite/flattened.

**The fix (2 edits — the rest of the pipeline already existed):**

1. **`table-field.component.ts`** — removed `ENTITY_SELECTION` from
   `isCompositeColumnType()`. The cell then flows through the existing chain:
   `app-dynamic-field` → `app-entity-selector-field` (search dialog) → emits
   `{fields, meta}` (or array for `selectionSize:"N"`) → stored under the
   column name → submitted via the same `getKristaValue` path the standalone
   Selection field already uses in production.
2. **`dynamic-field.component.ts`** — `getEntitySelectorFieldConfig()` now
   propagates `showLabel` from `basicFieldConfig`, so table cells
   (`showLabel:false` — the column header already names the field) don't
   repeat the label. Standalone fields are unaffected (`undefined` ≠ `false`).

**Why simple columns can't be affected:** text/number columns never entered the
composite branch (`flattenColumns` "regular field, add as-is" path is
byte-identical), and `getEntitySelectorFieldConfig` runs only for the
`entitySelection` switch case. MultiField/Composite/EntityReference flattening
is preserved and covered by tests (below).

## 7. Automated regression tests

**`entity-search.service.spec.ts` — 13 tests.** Intercept the REAL outgoing
HTTP request via `HttpTestingController`:

- **URL tests (the 404 bug):** POST goes to
  `environment.chatbotRoutingId + apiEndpoints.searchEntities`; must NOT
  contain the legacy hardcoded routing id `A_pR4e9i1qxSCWDPK5rDuig_e_e`.
- **Header tests:** `Chatbot-Session-Id` + `X-Krista-Context` attached when a
  session exists; anonymous request still sent when not.
- **Payload tests:** search params + serialized sourceField;
  `entityDefinition.fields` array→object; frontend-only metadata stripped —
  for BOTH the standalone shape and the nested TABLE `meta.entity` shape
  (fieldType `com.krista.fields.Table` preserved for backend routing).
- **Response tests:** success transform, backend error body, HTTP 5xx mapped
  to `{status:'error'}` without throwing.
- **Cancellation:** `cancelSearch()` aborts the in-flight request.

**`table-field.component.spec.ts` — 11 tests (NEW — component had no spec):**

- Entity column NOT flattened; full attributes survive; no `Column1.Name` /
  `Column1.Age` sub-columns.
- Simple text/number columns untouched (explicit regression guard).
- MultiField still flattens (`Contact.Phone`/`Contact.Email`);
  EntityReference still flattens (`Ref1.City`).
- Header matrix: entity column = one header cell, colSpan 1.
- `hasEntity` gate: button hidden without `entityTypeDomain`, shown with it.
- Value round-trip: incoming row value lands under `cells['Column1']`;
  `getCellField` carries value + attributes; submit emits the `EntityValue`
  (with primaryKey) under the column name through `getKristaValue`.

**`dynamic-field.component.spec.ts` — +3 tests:** `showLabel:false`
propagation, `showLabel` undefined for standalone, `entitySelectorMeta` parsed
from column attributes.

**Test infrastructure fixed to make `ng test` compile at all** (it was broken
on this branch lineage):

1. `app.facade.spec.ts` — removed stale `getPoolEntry` spy (method does not
   exist on this branch's `AuthApiService`).
2. `ui-toolkit-src-angular/.../KSDKMessage.ts` — added a `form` setter.
   `MessageService.handleUpdateMessages` assigns `existing.form = ...`, but
   `form` was getter-only — a compile error under `tsconfig.spec.json` AND a
   latent runtime `TypeError` on the UpdateMessage path. Purely additive.
3. `karma.conf.js` (new) + `angular.json` `karmaConfig` entry — explicit karma
   config with `require()`-based plugins so IDE test runners (WebStorm)
   resolve karma plugins from `omni-angular/node_modules` instead of the repo
   root.

**Suite status: 941 pass / 27 fail — all 27 are PRE-EXISTING** stale
assertions (`TimelineViewComponent` 18, `AppComponent` 6, Camera/File/
MessageBubble 1 each) that drifted while the test build was uncompilable
(e.g. spec expects `image/jpeg,image/png`, component now returns `image/*`).
Tracked as follow-up tech debt — deliberately not addressed in this hotfix.

**Coverage of changed files** (Lines): `entity-search.service.ts` **98.2%**,
`table-field.component.ts` 48.3% (was 0% — uncovered remainder is
pre-existing pagination/aggregates code), `dynamic-field.component.ts` 48.4%.
Project overall 35.3% (pre-existing condition; this PR raises it).

## 8. How to verify (QA / reviewer test plan)

**Standalone Selection field:**
1. Deploy 3.0.6 to a QA invoker; run a conversation with a Selection field.
2. Open the search modal, type a query → results (HTTP 200 on
   `POST …/chatbot/entities/search`); DevTools: URL contains the real routing
   ID + node prefix; request carries `Chatbot-Session-Id` + `X-Krista-Context`.
3. No-match query → empty result, no error. Kill invoker mid-search → error
   message shown, retry works after restart.
4. Localhost dev: search works via `dev-config.json`'s routing ID.

**Entity column inside a table:**
5. Table with a `com.krista.fields.Entity` column → cell shows
   "Select <entity>" and opens the SEARCH dialog (not text inputs); filters
   from the column's attributes appear; multi-select works for
   `selectionSize:"N"`.
6. Submit the row → request body carries the entity value
   (`{fields, meta}` with `meta.primaryKey`) under the column name.
7. Regression: a table with plain text/number columns — add row, type values,
   submit — unchanged.
8. Table-level attached-entity search button: hidden when the message's
   `meta.entity` lacks `entityTypeDomain` (expected for tables where the omni
   medium does not deliver it — see section 10), shown and functional when it
   is present.

Build verification: `ng build --configuration production` green (only
pre-existing SCSS warnings).

## 9. Review checklist

- [ ] `entity-search.service.ts`: no leftover reference to `window.AppConfig`,
      `HttpClient`, or a hardcoded routing ID (grep the file).
- [ ] Endpoint string `chatbot/entities/search` matches the backend
      `@Path("/entities/search")` under the `chatbot` jaxrsId.
- [ ] Both environment files updated identically (dev + prod).
- [ ] `searchEntities(searchDto)` signature trim: no caller still passes the
      removed params; modal `@Input`s and their two template binding sites
      removed (AOT-verified).
- [ ] Error object shape consumed by the modal unchanged (`status`/`errorMessage`).
- [ ] `isCompositeColumnType`: only MULTI_FIELD / COMPOSITE_FIELD /
      ENTITY_FIELD remain; comment documents the 2.0.16 hierarchy evidence.
- [ ] Table-level modal binding is `[field]="field"` (the table field), with
      the `hasEntity` gate on `allowEntitySearch`.
- [ ] Version bump is only `3.0.5 → 3.0.6` in the `@Extension` annotation;
      release notes list KR-21136.

## 10. Known follow-ups / NOT in the committed PR yet

**Platform gap (separate ticket needed, kristagrand):** the omni/chatbot-medium
message omits `entityTypeDomain` on the TABLE-LEVEL attached entity
(`meta.entity`) even though Studio stores it (webmono `FieldTableState.ts:107`
reads it back) and the native medium delivers it to kristaclient. Traced to the
kristagrand executor chain (`TableFieldAttributeParser` →
`SelectionEntityAttributeParser` bails out when both `entityTypeDomain` and
`entityDefinition` are absent from the core field attributes). Until fixed,
tables relying on the TABLE-LEVEL search (not entity columns) show no search
button in the chatbot — same behavior as 2.0.16. Entity COLUMNS are unaffected
(their attributes arrive fully enriched).

Two local (uncommitted at time of writing) backend changes exist on this branch's
working tree and should either be committed here or moved to their own PR:

1. **`ChatBotPool.java`** — (a) abort role change when the new role can't be
   resolved (`newRoleId == null` previously fell through, NPE'd per entry inside
   `List.of(null)`, and silently drained the whole warm pool for a typo'd role);
   (b) persist refreshed role IDs back to the pool store so a JVM restart /
   `popInline` serves the current role, not the stale one.
2. **`ChatBotApiService.java`** — removed a duplicate
   `mediumService.registerSender(chatBotMessageSender)` registration from the
   constructor.

If they land in this PR, reviewers should additionally check: the new
`return;` on unresolved role leaves `refilling`/generation state consistent, and
that removing the sender registration is safe because the sender is registered
elsewhere (verify the remaining registration site).

## 11. Risk summary

| Risk | Level | Why |
|---|---|---|
| Standalone entity search regression | Low | Same payload/response shape; only transport plumbing changed; verified on QA |
| Simple table columns (text/number) | None | Never entered the composite branch; path byte-identical; guarded by explicit tests |
| MultiField / EntityReference columns | None | Flattening preserved; guarded by explicit tests |
| Entity column submit shape | Low | New shape is the proven standalone contract (`{fields, meta}` with primaryKey); the OLD flattened shape carried no primaryKey and was unusable by the backend |
| Read-only display of historical entity-column rows | Low (visual) | One summary cell instead of flattened sub-columns — matches kristaclient/2.0.16 rendering |
| Table-level search button visibility | Intended change | Hidden when `meta.entity` lacks `entityTypeDomain` (2.0.16 parity); see section 10 platform follow-up |
| Other endpoints affected | None | No shared code touched except two additive environment entries |
| Auth regression | None | Anonymous fallback in the authenticator is unchanged; headers are additive |
| Backend regression | None | Fix is frontend-only; version bump is metadata |
