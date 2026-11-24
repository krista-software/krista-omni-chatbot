# PR Review Guide — KR-21161: Friendly Downtime Experience for the Chatbot

**Ticket:** [KR-21161](https://antbrains.atlassian.net/browse/KR-21161)
**Target release:** Omni Chatbot 3.0.7
**Scope:** Launcher only (`bootstrap/launcher-core.ts`, `bootstrap/launcher.css`) + one inline beacon in the chat app's `src/index.html`. Zero Angular app logic changes, zero backend changes.

---

## 1. The Issue

Customers embed the chatbot on their own websites (e.g. a utility-provider site). The
embed assets (`launcher.js`, `launcher.css`, `launcher-core-*.js`) are served from
S3/CloudFront, so the **chat bubble still renders even when the Krista environment is
down** (during an invoker upgrade, EP restart, or outage).

When a user clicked the bubble during such a window:

1. The launcher set the chat iframe's `src` to `…/chatbot/{v}/ui/` (served by the EP).
2. nginx/openresty could not reach the upstream and returned **502 Bad Gateway**.
3. The browser rendered the **raw nginx error HTML inside the chat window** —
   "502 Bad Gateway / nginx/1.28.3" — alongside the "Getting things ready..." text.

End users saw a broken, technical error inside an otherwise professional-looking site.

## 2. Root Cause Analysis

| Layer | Fact |
|---|---|
| Serving | Bubble assets come from S3/CDN (outage-proof); the chat iframe document comes from the EP (outage-exposed). The two can disagree about health. |
| Browser | The chat iframe is **cross-origin**, so JavaScript cannot read the HTTP status of its navigation. `iframe.onload` fires identically for a healthy page and a 502 error page. |
| Old launcher code | `openChatWindow()` removed the "Getting things ready..." message on `onload` — i.e. exactly when the 502 page finished rendering — and had no concept of "the app never came up". Whatever the server returned became visible. |

So the launcher had **no signal** to distinguish "Angular is booting" from "nginx served
an error page", and no UI for the failure state.

## 3. The Fix

### Design: positive proof instead of status codes

The detection never inspects HTTP status codes (unreadable cross-origin anyway).
It keys on two **positive proofs** posted by the chat document itself:

1. **`htmlLoaded` beacon** — a tiny inline script at the top of the chat app's
   `index.html` posts `{"messageType":"htmlLoaded"}` to the parent at **parse time**.
   Proxy error pages (502/504/404) carry no script, so they can never post it.
   Presence of the beacon at `onload` time = the real app document loaded.
2. **`initDone`** (already existed) — posted when Angular has booted. This is the
   authoritative "chat is alive" signal.

### State machine (`beginIframeLoad` in `launcher-core.ts`)

```
click bubble
  └─ iframe hidden (visibility:hidden), "Getting things ready..." shown,
     20 s absolute safety timer armed, iframe.src set
       ├─ htmlLoaded arrives  → real app; wait for initDone (no overlay path)
       ├─ onload w/o beacon   → error page; overlay after 500 ms
       │                        (margin only drains an in-flight beacon message)
       ├─ 20 s, nothing       → hung/unreachable; overlay
       └─ initDone arrives    → clear all timers, remove loading message,
                                hide any overlay (self-heal), REVEAL iframe
```

Key properties:

- **Raw error HTML is never visible** — the iframe stays hidden from load-start and
  is revealed in exactly one place: the `initDone` handler.
- **Instant detection** — a 502 shows the friendly screen ~0.5 s after the response
  arrives (no fixed multi-second grace period, no extra probe request).
- **No false positives on a healthy env** — the beacon arrives with the HTML, so slow
  devices/networks never trip the overlay; and even if a timer ever fired in a race,
  `showUnavailableOverlay()` refuses while `_appReady` is true, and `initDone`
  self-heals any overlay that slipped through. A working chat can never end up stuck
  behind the error screen.
- **Boot-window only** — once `initDone` has arrived, the feature is inert for the
  session. Mid-chat failures remain the Angular app's responsibility (WS handling
  etc.), untouched by this PR.

### The overlay UI

White panel inside the chat container: amber warning icon, title **"We'll be back
soon"**, message *"Our services are temporarily unavailable while we make
improvements. Kindly try again after some time. We appreciate your patience and
understanding."*, a **Try Again** button (uses the chatbot's configured brand color),
and a close (×) button.

**Try Again** forces a genuine refetch: iframe is reset to `about:blank`, then the
guarded load restarts (loading message, timers, hidden iframe). `about:blank` — not
`''` — because an empty src resolves to the **host page's URL** and would load the
customer's site inside the iframe. The `onload` handler skips the intermediate
`about:blank` navigation via a same-origin `contentWindow.location` read
(cross-origin read throws = a real page loaded).

### Alternatives considered and rejected

| Alternative | Why rejected |
|---|---|
| Parallel `fetch()` of the `/ui/` URL to read the status instantly | Works (CORS filter puts `ACAO:*` on healthy responses; nginx 502 fails readably) but costs **one extra request per chat open**. |
| Fixed 3 s grace period after `onload` | No extra request, but users stare at a loading state for 3+ s during outages, and very slow devices risked a false flash. The beacon gives both speed and safety. |

## 4. Files Changed

| File | Change |
|---|---|
| `src/main/omni-angular/bootstrap/launcher-core.ts` | New fields (`_loadingMsg`, `_startupTimer`, `_postLoadTimer`, `_unavailableOverlay`, `_appReady`, `_htmlLoaded`); `openChatWindow()` delegates to new `beginIframeLoad()`; new methods `showLoadingMessage`, `removeLoadingMessage`, `startLoadTimers`, `showUnavailableOverlay`, `hideUnavailableOverlay`, `retryConnection`; `htmlLoaded` message case added; `initDone` case now clears timers, removes loading UI, self-heals overlay, reveals iframe; `cleanHtml()` clears timers. |
| `src/main/omni-angular/bootstrap/launcher.css` | `.chatbot-unavailable-*` styles for the overlay, close button, icon, title, message, retry button. |
| `src/main/omni-angular/src/index.html` | Inline `htmlLoaded` beacon at the top of `<head>` (guarded for standalone mode, try/catch). |
| `src/main/omni-angular/.env` + `src/main/resources/launcher.properties` | `LAUNCHER_VERSION` v3 → **v4** — new filename `launcher-core-v4.js` bypasses CloudFront (30-min TTL on `/chatbot/*/ui/*`) and browser caches on deploy. |
| `ChatBotExtension.java` | Extension version 3.0.6 → **3.0.7**. |
| `docs/pages/release-notes.md` | 3.0.7 section with the KR-21161 entry. |

## 5. Backward Compatibility / No-Regression Notes

- No message types removed or changed; `initDone` still posts `dataToChatbot` exactly
  as before. `restartOnRefresh`, `logoutDone`, unread badge, minimize, resize — untouched.
- The beacon is additive: an **old launcher** receiving `htmlLoaded` falls into the
  message switch's `default:` case (ignored). A **new launcher + old index.html**
  (only possible via transient cache skew; index.html is not edge-cached) would show
  a brief overlay flash that `initDone` self-heals.
- Feature applies to every load path: bubble click, `startAsBubble=false`,
  `restartOnRefresh` auto-open, `autoLaunchChatbot=true`.
- Message listener already filters non-string data and try/catches `JSON.parse`, so
  foreign postMessages (ads, extensions) cannot break the new cases.

## 6. Test Cases

### How to simulate an outage

- **Real:** stop the invoker/EP on a test environment.
- **DevTools:** Network tab → Request blocking → block `*/chatbot/*/ui/` (note:
  blocked requests may not fire `onload`, so the overlay may take the 20 s safety
  path instead of the 500 ms path).
- Before each round, verify the **served** `launcher-core-v4.js` contains `_appReady`
  (DevTools → Sources → search) — CDN/browser caches serving a stale launcher have
  invalidated test rounds before.

### Happy path (no regressions)

| # | Steps | Expected |
|---|---|---|
| 1 | Backend up → click bubble | "Getting things ready..." briefly, chat opens; no overlay |
| 2 | DevTools Slow 3G + 6× CPU throttle → click bubble | Longer loading message, **no overlay**, chat opens |
| 3 | `restartOnRefresh` on → refresh host page mid-session | Chat auto-reopens normally |
| 4 | Unread badge, resize, minimize, logout | Behave exactly as before |
| 5 | Kill EP **after** chat is working | No overlay (feature is boot-only); app's own WS handling applies |

### Outage path

| # | Steps | Expected |
|---|---|---|
| 6 | EP down → click bubble | Loading message ~1 s → **"We'll be back soon"** overlay; raw 502 HTML **never** visible |
| 7 | Overlay shown → Try Again ×3 (still down) | Overlay returns each time; no 502 flash; exactly one `ui/` request per retry |
| 8 | Overlay shown → start EP → Try Again | Loading message → chat opens |
| 9 | Restart EP → click bubble during warm-up (slow first response, e.g. 7 s) | No overlay (beacon arrives with the HTML); chat opens when ready |
| 10 | EP hung (no response at all) | Overlay at ~20 s |
| 11 | Overlay → close (×) → click bubble again | Container reopens with overlay; Try Again still works |

## 7. Deployment Notes

- `LAUNCHER_VERSION` bumped to **v4**: the launcher filename change is the
  cache-bust — do not deploy this feature under a previously used version number.
- `launcher.js` / `launcher.css` copies pasted into S3 by DevOps do **not** need
  re-pasting for this feature (the changed logic lives in `launcher-core-v4.js`,
  which is fetched from the EP/CDN via `launcher-file`) — but the updated
  `dist/launcher.css` (overlay styles) **must** be re-pasted to S3 wherever the CSS
  is served statically, otherwise the overlay renders unstyled.
- The Gradle build (`buildUI`) regenerates `dist/` from source and `.env`;
  `jar.finalizedBy(cleanDir)` deletes `node_modules`/`dist` afterwards — local
  rebuilds need `npm install` first.
