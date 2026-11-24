# Feature Grilling Session — Omni Chatbot 3.0.6

**Feature Name:** Integration Settings Redesign + Chatbot Boot CDN Resilience
**Jira Tickets:** [KR-21160](https://antbrains.atlassian.net/browse/KR-21160) (primary — Integration Settings redesign / author integration experience), [KR-21091](https://antbrains.atlassian.net/browse/KR-21091) (CDN caching / boot resilience)
**Design Reference:** [Figma — Chatbot Configuration](https://chatbotconfiguration.figma.site/)
**Developers:** Hiren Panchal
**Timelines:** 17 Jun 2026 – 10 Jul 2026 (~3.5 weeks)

---

## 1. Problem Statement & Business Context

**What are we building and why?**

Two new capabilities ship in 3.0.6:

1. **Integration Settings Redesign (major, KR-21160):** The existing Integration Settings tab was a plain form with no visual feedback — admins had to embed the script on an external page and reload to see how their configuration looked. This was slow, error-prone, and not designer-friendly. We are implementing the [Figma-designed chatbot configuration UI](https://chatbotconfiguration.figma.site/) to give admins a real-time, in-place preview of the chatbot as they configure it.

2. **Chatbot Boot CDN Resilience (KR-21091):** Every invoker upgrade or restart caused the chatbot bubble to disappear from customer websites for the entire restart window because the browser fetched `/chatbot/config` from the origin each time. We now instruct the browser and CDN to cache configuration intelligently so the chatbot boots even when the origin is temporarily unreachable.

**Which personas benefit?**

- **Krista admins:** can see chatbot appearance changes live while editing Integration Settings — no external page needed.
- **End users on customer websites:** the chatbot bubble loads reliably, even during Krista server upgrades.

**Why now?**

- Admins have been requesting better configuration visibility. The Figma design (above) was produced by UX and is the agreed target for how the configuration experience should look.
- Customer-visible downtime during upgrades is a SLA risk. The CDN headers fix is the extension's share of that fix — zero infra change required.

**Success metrics:**

- Admins can see a pixel-accurate live preview of the chatbot without leaving Integration Settings.
- "Try It Live" opens a fully functional chatbot on a real hosted page.
- `/chatbot/config` is served from browser or CDN cache during invoker restarts — no 499 storm.
- Chatbot boot request count drops (one CORS preflight eliminated per boot).

---

## 2. Feature Walkthrough

### Feature A — Integration Settings Redesign (KR-21160)

**Before:** A single scrollable form. No preview. To check appearance the admin had to embed the script on an external site.

**After:** A two-column layout matching the Figma design:

- **Left column:** slim collapsible _Integration Script_ strip (collapsed by default — it is a one-time setup step) + the full _Configuration_ form below it.
- **Right column:** a sticky _Live Preview_ sidebar — a pixel-accurate mini replica of the chatbot (bubble, header, chat body, footer, branding) that re-renders in real time as the admin types in any field.

**Admin workflow (happy path):**

1. Admin opens Integration Settings.
2. Live Preview loads on the right showing the current saved configuration.
3. Admin changes brand color, logo, welcome message, etc. — Preview updates immediately (debounced 400 ms for heavy fields like logo/font URL).
4. Admin clicks **"Expand"** icon → preview grows to a full-screen overlay showing the chatbot at its real launcher dimensions.
5. Admin clicks **"TRY IT LIVE"** in the Integration Script strip → a new browser tab opens at `/chatbot/preview`, a real hosted page with the actual one-line embed script and the SAVED configuration — full production path, fully functional, refreshable.
6. Admin saves. Done.

**Key UI details (matching Figma):**

| Element | Implementation |
|---|---|
| Integration Script strip | Slim ~54px collapsible row, collapsed by default; inline **Copy** button |
| Live Preview frame | Bounded mini-site: bubble (50px), chat window (header / body / footer replica) |
| Header in preview | Brand color, logo (max 48px h / 138px w), invoker name, subtitle, language dropdown |
| Chat body in preview | Bot bubble = white + border; user bubble = brand color; timestamps inline |
| Footer in preview | Input pill (#f8f9fa, radius 24px), send = 40px brand-color circle + white plane icon |
| Branding row | "Powered by Krista" absolutely centered; T&C link pinned right (#259de1 fixed, mirrors production) |
| Expand mode | Reparents the single preview frame node into a fixed full-screen overlay (real launcher dimensions: 30 % width, 16 px offsets); collapse via X or Esc |
| Unified card headers | Blue material icon 24px + 18px/500 title + 13px subtitle — consistent across all three cards |

**Live Preview fidelity rules (matches production exactly):**

- Logo size, header height, action button size, and bubble radius all pulled from the real component values (user-confirmed after parity review).
- `isFullSize` fills the frame and hides the header — mirrors `app.facade.ts` behavior.
- No in-preview font scaling (real UI does not scale with window size).

### Feature B — Chatbot Live Demo Page (`/chatbot/preview`)

A new public server-served demo page at `GET /chatbot/preview` ("Krista AI Chatbot — Live Preview"):

- A branded showcase host page (Krista hero, compact feature-pillar strip) with an animated **spotlight** that points at the chat bubble (positioned via MutationObserver once the bubble is in the DOM).
- The real one-line integration `<script>` tag — full production path: `launcher.js` → bubble → iframe → real session (chatting there creates a real session, exactly as on a customer site).
- `noindex` meta + inline CSP (`<meta http-equiv="Content-Security-Policy">`) — not indexed, locked-down sources.
- The page itself is served `no-store` (default-deny filter) and sets `window.__chatbotPreviewMode = true` — see Feature C for how this guarantees just-saved settings.
- Refreshable and shareable as a URL (replaces the old `document.write / about:blank` in-overlay approach, which was neither).

### Feature C — Always-Fresh Preview Config (`/config/preview`) + CDN Boot Resilience (KR-21091)

**Part 1 — dedicated uncached preview config endpoint (new):**

`GET /chatbot/config/preview` returns the identical payload to `/config` but with `Cache-Control: no-store` — never cached by browser or CDN. Consumed only in preview mode:

- The demo page sets `window.__chatbotPreviewMode = true` → launcher-core fetches `/config/preview` instead of `/config`.
- launcher-core then appends `chatbotPreview=1` to the chat iframe URL → the Angular app's `ConfigApiService` also switches to `/config/preview`.
- A separate **path** (not a query parameter) is deliberate: CDN cache policies may exclude query strings from the cache key, which would silently serve the cached `/config` copy.

Result: "Try It Live" always reflects **just-saved** settings, while customer embeds keep the fully cached `/config` (no freshness/perf trade-off on the customer path).

**Part 2 — Cache-Control headers so the chatbot boots during invoker upgrades:**

| Endpoint | Old behavior | New behavior |
|---|---|---|
| `GET /chatbot/config`, `/supportedLanguages`, `/launcher-file` | No header / uncached | `public, max-age=1800, s-maxage=1800, stale-if-error=86400` — browser AND CDN cache 30 min; CDN serves last-good copy up to 24 h if origin is down |
| `GET /chatbot/ui/launcher.js` (+ launcher.css) | `no-store` | `public, s-maxage=1800, max-age=0, stale-if-error=86400` — CDN caches 30 min; browser always re-fetches (edge-served) so a launcher change propagates within one CDN TTL |
| Versioned hashed UI assets (`/chatbot/{v}/ui/*`) | 30 min | `public, max-age=31536000, immutable` — content-hashed, safe to cache 1 year |
| All other endpoints | Unconstrained | New default-deny filter (`CacheControlResponseFilter`) stamps `no-store` on anything that does not opt in |

**Versioned endpoints:** the Angular app now calls `/chatbot/{cdnCacheVersion}/config` and `/chatbot/{v}/supportedLanguages` (`ConfigApiService.toVersionedEndpoint`; version injected into `index.html` as `window.cdnCacheVersion`). The server's `CdnCacheVersionFilter` strips the version segment — backend routing unchanged. This gives the CDN a versioned cache key it can safely hold.

**Why these values?**

- 30-min config cache (browser + CDN) → fast boot, origin shielded; admin changes reach customer embeds within the TTL. The Integration Settings preview is exempt via `/config/preview`, so admins still verify changes instantly.
- `stale-if-error=86400` → if origin is down during an upgrade, CDN serves the last-good config/launcher for up to 24 h → the bubble keeps loading on customer sites.
- Default-deny filter → session/messages/auth responses can never be accidentally CDN-cached, so DevOps can use one generic honor-origin CDN behavior.

---

## 3. Functional Requirements

**User stories:**

- As a Krista admin, I can see a real-time preview of the chatbot (bubble + full chat window) as I configure it, without leaving Integration Settings.
- As a Krista admin, I can open a real hosted preview page with one click to test the fully functional chatbot with my current settings.
- As an admin, I can copy the integration script with one click directly from the Settings page.
- As a site visitor, the chatbot bubble loads even when Krista is mid-upgrade.

**Acceptance criteria:**

- Live Preview re-renders within 400 ms of any field change (debounced).
- Preview frame in expand mode matches real launcher window dimensions (30 % width, 16 px offsets, correct bubble position).
- `/chatbot/preview` opens a real working chatbot, is refreshable, and reflects the latest **saved** settings (via `/config/preview`, never cached).
- Copy button copies the script text to clipboard.
- `x-cache: Hit from cloudfront` on second consecutive `/chatbot/{v}/config` request when the CDN behavior is deployed; `/chatbot/config/preview` never cached.
- Browser DevTools shows no `OPTIONS` preflight on `/chatbot/config`.

**Business rules:**

- Integration Settings remains admin-only (no RBAC change).
- Preview page is as public as the chatbot itself (guest-accessible — it uses the same launcher script).
- All configuration values displayed in the preview are read from the form in real time (unsaved), but the "Try It Live" page always uses the last **saved** configuration.

**Configuration options:** No new admin-facing config keys. Launcher version bumped v3 → v4.

**Backward compatibility:**

- No API contract changes; all existing endpoint URLs unchanged.
- Existing embed scripts on customer pages continue to work without change.
- Old integration strip content (code block + copy) is preserved inside the new collapsible strip.

---

## 4. Technical Architecture

### Integration Settings — Frontend Architecture

```
integration/index.html  (standalone admin page, no Angular, no launcher)
    |
    |-- Left column
    |       |-- .integration-strip  (collapsible; Copy button; "TRY IT LIVE" button)
    |       |-- .config-panel       (full configuration form)
    |
    |-- Right sticky sidebar
            |-- #previewFrameHome   (anchor node for the preview frame)
                    |
                    |-- #previewFrame  (single DIV mini-site — no iframe)
                            |-- bubble, header, body, footer replicas
                                 (pure HTML/CSS/JS — no launcher, no Angular, no session)
```

**Key design decisions:**

- **Single frame node, reparented for expand:** `expandPreview()` moves `#previewFrame` into the full-screen `#previewOverlay` host. Collapsing (X/Esc) moves it back to `#previewFrameHome`. One node, never duplicated → preview state and bindings never drift.
- **Real-time update via `updatePreview()`:** called on every `input`/`change` event on the form. Reads unsaved values directly. Logo/font URL changes debounced 400 ms to avoid spamming load events.
- **Copy button:** reads `pre.textContent.trim()` (pre may be `display:none` when strip is collapsed); `event.stopPropagation()` prevents the strip toggling on copy click.
- **"TRY IT LIVE":** calls `window.open(new URL('_basePath_preview', location.href).href)` — constructs the correct absolute URL regardless of where the page is served.

### Demo Page + Preview Config — Backend Architecture

```
GET /chatbot/preview
    |
    v
ChatBotResource.preview()
    |  reads template: src/main/resources/integration/preview.html
    |  substitutes:  _basePath_  (= <routing URL>/chatbot/)
    v
Served as text/html, public (same auth as chatbot itself)
Cache-Control: no-store  (via default-deny CacheControlResponseFilter)
```

The demo page sets `window.__chatbotPreviewMode = true` and embeds the exact same one-line launcher `<script>` that customers use. Browser then runs the full production boot path — with one preview-mode difference:

```
launcher.js  →  fetches launcher-file + launcher-core
             →  launcher-core.isPreviewMode()?  yes → GET /chatbot/config/preview  (no-store)
                                                no  → GET /chatbot/{v}/config      (cached)
             →  renders bubble
             →  on click: opens chat iframe (preview mode appends ?chatbotPreview=1)
                     → Angular ConfigApiService.isPreviewMode() → same endpoint switch
             →  Angular app → real session
```

So the preview always reflects just-saved settings while customer embeds stay fully cached.

### CDN Architecture

```
Browser
  |-- GET /chatbot/{v}/config, /{v}/supportedLanguages, /launcher-file
  |     Cache-Control: public, max-age=1800, s-maxage=1800, stale-if-error=86400
  |     → Browser caches 30 min; CDN caches 30 min
  |     → CDN serves stale up to 24 h if origin is down (stale-if-error)
  |
  |-- GET /chatbot/ui/launcher.js (+ launcher.css)
  |     Cache-Control: public, s-maxage=1800, max-age=0, stale-if-error=86400
  |     → CDN caches 30 min; browser always re-fetches from the edge
  |
  |-- GET /chatbot/{v}/ui/<hashed asset>
  |     Cache-Control: public, max-age=31536000, immutable  (content-hashed)
  |
  |-- GET /chatbot/config/preview
        Cache-Control: no-cache, no-store, must-revalidate  (preview mode only)

CacheControlResponseFilter (new)
  → Default-deny: stamps no-store on every response that hasn't set its own header
  → Opt-in: cacheable endpoints set their own Cache-Control explicitly
```

**Services impacted:**

- `ChatBotResource.java` — new `preview()` + `getConfigurationPreview()` endpoints; cache headers on `getConfigurationGET()`, `getSupportedLanguages()`, `getCoreLauncherJs()`.
- `CacheControlResponseFilter.java` — new JAX-RS response filter (default-deny).
- `ChatBotAuthenticator.java` — `/preview` and `/config/preview` added to the public (guest-accessible) path list.
- `ChatBotUIService.java` — cache-policy selection per asset class (launcher.js CDN-only, hashed assets 1 year, index.html 30 min).
- `integration/index.html` — full layout redesign (strip + form + live preview sidebar).
- `integration/preview.html` — new demo page template.
- Frontend: `launcher-core.ts` (preview-mode switch, `chatbotPreview=1` iframe param), Angular `ConfigApiService` (preview-mode + versioned endpoints), `app.config.ts` (`getCdnCacheVersion()`), `ApiService` (no Content-Type on GET → no CORS preflight).

---

## 5. API Design

| Endpoint | Change | Notes |
|---|---|---|
| `GET /chatbot/preview` | **New** | Serves the live demo page. Public (same as chatbot). `no-store` via default-deny filter. No user input — no validation needed. |
| `GET /chatbot/config/preview` | **New** | Identical payload to `/config`, `Cache-Control: no-cache, no-store, must-revalidate`. Public. Used only in preview mode (`window.__chatbotPreviewMode` / `chatbotPreview=1`). Separate path (not query param) so CDN cache-key policies can't alias it to the cached `/config`. |
| `GET /chatbot/config` | Cache header updated | `public, max-age=1800, s-maxage=1800, stale-if-error=86400`. No request/response body change. |
| `GET /chatbot/{v}/config`, `/{v}/supportedLanguages` | **New shape** (frontend now uses it) | Server strips `/{digits}/` via `CdnCacheVersionFilter` → same handler. Gives CDN a versioned cache key. |
| `GET /chatbot/supportedLanguages` | Cache header updated | Same 30-min public policy as `/config`; returns `[{code, name}]` (same shape as the list inlined in `/config`). |
| `GET /chatbot/launcher-file` | Cache header updated | Same 30-min public policy as `/config`. |
| `GET /chatbot/ui/launcher.js` | Cache header updated | `public, s-maxage=1800, max-age=0, stale-if-error=86400`. No content change. |
| All other endpoints | Default-deny applied | `CacheControlResponseFilter` stamps `no-store` if no `Cache-Control` already set. |

**Authentication:** unchanged (header-based `Chatbot-Session-Id` + `X-Krista-Context`). Config/languages are user-independent and intentionally skip session headers to remain CDN-cacheable.

**Idempotency:** all new/changed endpoints are read-only GETs.

**Rate limiting:** unchanged (existing concurrency/admission control from 3.0.5 untouched).

---

## 6. Engineering Deep Dive

**Design decisions & why:**

- **Single reparented preview frame:** an earlier version used `document.write` on an `about:blank` iframe. That prevented the page from being refreshed or shared as a URL. The server-served `/chatbot/preview` page solves both limitations cleanly.

- **Live preview as a pure HTML/CSS/JS mini-site** (no Angular, no launcher, no session): the Integration Settings page itself is a standalone admin page outside Angular. Embedding a real Angular iframe for preview would require a full boot sequence per keystroke — impractical. The mini-site is a faithful visual replica, not a functional chatbot. "TRY IT LIVE" launches the real thing.

- **Default-deny cache filter:** instead of marking every dynamic endpoint `no-store` individually, one filter makes it the default. This is safer (no accidental caching of session or auth data) and easier to audit (cacheable endpoints explicitly opt in).

- **Dedicated `/config/preview` endpoint instead of cache-busting:** earlier iterations tried `fetch(url, {cache:'reload'})` to punch through the caches — but a browser directive cannot punch through a CDN cache, and query-param busting fails when CDN cache keys exclude query strings. A separate uncached **path** is the only mechanism that is correct at every cache layer, and it lets `/config` itself be fully cached (browser + CDN, 30 min) with zero freshness compromise for admins.

- **Preview mode as a window flag + iframe param:** the demo page sets `window.__chatbotPreviewMode`; launcher-core reads it and forwards `chatbotPreview=1` to the chat iframe. Both layers (launcher + Angular app) independently switch their config fetch to `/config/preview`. Customer embeds never set the flag → zero impact on the production path.

**Failure scenarios:**

- Origin down during boot → CDN `stale-if-error` serves last-good config for up to 24 h → bubble renders.
- Logo URL load failure in preview → preview renders gracefully with no image (does not block other fields).
- "TRY IT LIVE" on a page with unsaved changes → the preview page uses saved config (by design; a tooltip/note explains this).

**Performance:**

- One CORS preflight eliminated per chatbot boot (Content-Type removed from GET requests in Angular ApiService → `GET /chatbot/config` is now CORS "simple").
- Config and launcher served from browser/CDN cache in steady state → reduced origin load + faster boot for returning visitors.

---

## 7. Security Review

- **Demo page:** public by design (chatbot itself is guest-accessible; `/preview` and `/config/preview` added to the authenticator's public path list). `noindex` meta prevents search indexing. `no-store` prevents any caching of the response. Inline CSP `<meta http-equiv="Content-Security-Policy">` restricts sources (`unsafe-inline` accepted — page is noindex, admin-shared, no user input).
- **Cache safety:** the default-deny filter guarantees session/message/auth responses can never be CDN-cached (OWASP: sensitive data exposure via shared cache — prevented by design).
- **CORS:** `Access-Control-Allow-Origin: *` unchanged — valid only because auth is header-based (no cookies, no credentialed CORS risk). Removing `Content-Type` from GET requests does not change the allow policy; it only avoids an unnecessary preflight.
- **No new data stored or exposed:** preview and config endpoints surface only existing admin-configured data. No PII.
- **Secrets:** none introduced.

---

## 8. Observability

- **Logging:** admin page actions (copy, expand, "try it live") are client-side only — no server log noise.
- **Metrics/tracing:** the preflight elimination reduces OPTIONS noise in SigNoz dashboards.
- **Dashboards/alerts to watch post-deploy:**
  - `x-cache` on `/chatbot/{v}/config` → expect `Hit from cloudfront` on repeat requests within 30 min (once the CDN behavior is deployed); `/chatbot/config/preview` must always be `Miss`/uncached.
  - No `OPTIONS` for `/chatbot/config` in browser DevTools Network tab.
  - nginx 499 count on `/chatbot/config` during upgrades should drop to ~0 (CDN shields origin).
  - `#####-CHATBOT-CDN launcher.js served with cache version` log line confirms version substitution.
- **Feature flags:** none — all changes are always-on.

---

## 9. Testing Strategy

**Integration Settings (frontend):**

- Manual QA: open Integration Settings → change brand color, logo, welcome message → verify preview updates live.
- Expand mode: verify preview overlays at correct dimensions; Esc/X collapses back.
- Copy button: verify clipboard content matches the displayed script; verify strip collapse/expand does not interfere.
- "TRY IT LIVE": verify new tab opens at the correct URL; verify the chatbot is fully functional (session, messages); verify page is refreshable.
- Parity check: compare live preview header/body/footer dimensions and colors against the production chatbot side-by-side. Reference: [Figma design](https://chatbotconfiguration.figma.site/).

**Demo page + preview config:**

- `GET /chatbot/preview` → HTTP 200, `Cache-Control` = no-store family; bubble spotlight appears next to the bubble.
- Page loads chatbot bubble; clicking bubble opens chat; messages work (real session).
- **Freshness:** change a setting in Integration Settings, save, refresh the demo page → change visible immediately (network tab shows `GET /chatbot/config/preview`, not `/config`).
- Chat iframe URL contains `chatbotPreview=1`; the iframe's config request also hits `/config/preview`.
- A normal customer embed (without the flag) still fetches the cached versioned `/chatbot/{v}/config` — verify no `chatbotPreview` leakage.
- `noindex` meta present.

**CDN caching:**

- `curl -I .../chatbot/0/config` twice → second response `x-cache: Hit from cloudfront` (30-min TTL, once CDN behavior deployed).
- `curl -I .../chatbot/ui/launcher.js` → `x-cache: Hit from cloudfront` on second call (CDN caches 30 min; browser always re-fetches).
- `curl -I .../chatbot/config/preview` twice → never a CDN hit.
- Browser DevTools: no `OPTIONS` preflight on `GET /chatbot/config`.
- Simulate origin down (stop invoker): CDN should serve last-good config (`stale-if-error`); bubble should render.

**Regression:**

- Full build green (Gradle).
- Existing embed scripts on external pages continue to work unchanged.
- `/chatbot/session`, `/chatbot/messages`, `/chatbot/authn/*` confirm `Cache-Control: no-store` in response headers (default-deny in effect).

---

## 10. Deployment Plan

- **Rollout:** standard extension upgrade to 3.0.6 per invoker (catalog release). QA → one production invoker → rest.
- **Rollback:** redeploy 3.0.5 — no data migration to undo; no schema changes.
- **Downtime:** only the normal invoker reload window.
- **DB migration:** none.
- **Infra prerequisite (CDN — DevOps):** The CloudFront behavior for `*/chatbot/*` must honor origin Cache-Control with **Min TTL = 0 and Default TTL = 0** — Min TTL > 0 would override our `no-store` on messages/session, and Default TTL > 0 would cache header-less responses from older invokers. See risk #1 in section 11 for the full mechanism. Must be confirmed before go-live.
- **Production verification checklist:**
  - Integration Settings page renders two-column layout.
  - Live preview updates on field change.
  - "TRY IT LIVE" opens `/chatbot/preview` with working chatbot; save a setting → refresh → change visible immediately.
  - `curl` versioned config twice → CDN hit on second; `curl` launcher.js twice → CDN hit; `config/preview` never cached.
  - No OPTIONS on config in browser Network tab.

---

## 11. Risks & Open Questions

**Known risks:**

1. **CDN behavior prerequisite (go-live gate, DevOps):** our code sends the correct headers, but CloudFront only *honors* them if the `*/chatbot/*` behavior is configured with **Min TTL = 0 and Default TTL = 0**. Two failure modes if not:
   - *Min TTL > 0:* CloudFront caches for at least Min TTL **even when the origin says `no-store`** — our messages/session responses would be edge-cached despite the default-deny filter (one guest could see another guest's chat).
   - *Default TTL > 0:* Default TTL applies when the origin sends **no** Cache-Control header at all — older invoker versions (pre-3.0.6, e.g. 2.0.16) behind the same distribution send no header on `/messages`/`/session`, so their responses would be edge-cached.
   With both TTLs = 0, `no-store` is honored, header-less responses are not cached, and the cacheable endpoints still cache via their explicit `s-maxage`. DevOps must confirm this before go-live.
2. **Launcher CDN TTL:** launcher changes now take up to 30 min to propagate through CDN. Ops must know to manually invalidate for emergency launcher fixes.
3. **Live preview parity drift:** if production component CSS changes in a future release, the mini-site replica will need to be updated alongside it. Parity-reminder comments are added in the relevant component files.

**Open questions for QA:**

- Should the "TRY IT LIVE" page show a banner clarifying it reflects **saved** (not unsaved form) settings? Recommended — waiting for UX confirmation.
- Should the Expand overlay darken the background behind the preview? Current implementation has no backdrop — consistent with the Figma design.

**Dependencies:** DevOps CloudFront behavior configuration (cache header side is done in code; edge-caching benefit requires the CDN behavior to be deployed on production).

**Technical debt:** hard-coded preview mini-site dimensions (bubble offset 30px, window 30 %) — should be sourced from the same constants the Angular app uses when a shared config mechanism exists.

**Future enhancements:**

- Move preview to a real Angular iframe (full functional preview) once Angular supports a lightweight embedded mode.
- localStorage last-known-config fallback for the chatbot client (resilience during longer outages).
- Zero-downtime invoker upgrades (platform/infra — the only complete fix for live-conversation availability during upgrades).

---

## Presentation Deliverables (status)

| Deliverable | Status |
|---|---|
| Figma design reference | [chatbotconfiguration.figma.site](https://chatbotconfiguration.figma.site/) |
| Live Integration Settings (KR-21160) | Done — deployable in 3.0.6 |
| Demo page (`/chatbot/preview`) + `/config/preview` | Done |
| CDN cache headers + versioned frontend endpoints | Done (code); pending DevOps CDN behavior config |
| API spec | Done — section 5 table |
| Risk assessment | Done — section 11 |
| Test strategy | Done — section 9 |
| Rollout plan | Done — section 10 |

---

## Evaluation Scorecard

| Category | Weight | Score (1-5) |
|---|---|---|
| Problem Understanding | 10% | |
| Functional Completeness | 10% | |
| Technical Design | 20% | |
| Scalability | 10% | |
| Performance | 10% | |
| Security | 10% | |
| Reliability | 10% | |
| Test Strategy | 5% | |
| Deployment Plan | 5% | |
| Documentation | 5% | |
| Risk Identification | 5% | |

**Decision:** Approve / Approve with Changes / Rework Required
