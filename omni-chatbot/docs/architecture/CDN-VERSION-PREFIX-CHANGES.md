# CDN Cache Version Prefix — Change Guide

## Goal

Add a numeric version segment to the chatbot URL path for CDN cache-busting.

**Current:**  `…/extension/api/{routingId}/chatbot/ui/…`
**New:**      `…/extension/api/{routingId}/chatbot/{cacheVersion}/ui/…`

Example: `…/extension/api/lLrmgvk1kO1ct11E3_pwIkg_e_e/chatbot/0/ui/`

Use a **plain integer** (`0`, `1`, `2` …) — not `v1`. Regex `\d+` matches all versions without updates, and avoids collision with existing `/v1/api/` versioning.

**Important:** The version goes AFTER `/chatbot/`, not before it. `/chatbot/` is the JAX-RS context path (`jaxrsId = "chatbot"`) — the platform uses it to route requests to the chatbot extension. Placing the version before `/chatbot/` breaks platform routing (404).

---

## Cache policy

### UI Assets (`/chatbot/{version}/ui/...`)

| File | Example URL | Cache-Control | Duration | CDN |
|---|---|---|---|---|
| `main-*.js` | `/chatbot/0/ui/main-66A65DKO.js` | `public, max-age=31536000, immutable` | 1 year | Yes |
| `polyfills-*.js` | `/chatbot/0/ui/polyfills-B6TNHZQ6.js` | `public, max-age=31536000, immutable` | 1 year | Yes |
| `styles-*.css` | `/chatbot/0/ui/styles-XXXX.css` | `public, max-age=31536000, immutable` | 1 year | Yes |
| `chunk-*.js` | `/chatbot/0/ui/chunk-XXXX.js` | `public, max-age=31536000, immutable` | 1 year | Yes |
| `assets/config.js` | `/chatbot/0/ui/assets/config.js` | `public, max-age=31536000, immutable` | 1 year | Yes |
| `assets/i18n/*.json` | `/chatbot/0/ui/assets/i18n/en.json` | `public, max-age=31536000, immutable` | 1 year | Yes |
| `assets/images/*` | `/chatbot/0/ui/assets/images/logo.svg` | `public, max-age=31536000, immutable` | 1 year | Yes |
| Fonts (`.woff2`, `.ttf`) | `/chatbot/0/ui/fonts/...` | `public, max-age=31536000, immutable` | 1 year | Yes |
| `favicon.ico` | `/chatbot/0/ui/favicon.ico` | `public, max-age=31536000, immutable` | 1 year | Yes |
| `index.html` | `/chatbot/0/ui/` | `public, max-age=1800` | 30 min | Yes |
| `workspace/*` | `/chatbot/0/ui/workspace/...` | `no-cache, no-store, must-revalidate` | never | No |
| `launcher.js` | `/chatbot/ui/launcher.js` | `public, max-age=1800` | 30 min | Yes |
| `launcher.css` | `/chatbot/ui/launcher.css` | `public, max-age=1800` | 30 min | Yes |

### API Endpoints (`/chatbot/...`)

| Endpoint | Method | Cache-Control | Duration | CDN |
|---|---|---|---|---|
| `/config` | GET | `public, max-age=1800` | 30 min | Yes |
| `/launcher-file` | GET | `public, max-age=1800` | 30 min | Yes |
| `/supportedLanguages` | GET | `public, max-age=1800` | 30 min | Yes |
| `/integration` | GET | none | - | No |
| `/session` | POST | none | - | No |
| `/inboxes/{id}/messages` | GET | none | - | No |
| `/inboxes/{id}/messages/{id}` | PUT | none | - | No |
| `/entities/search` | POST | none | - | No |
| `/sendTranscript` | POST | none | - | No |
| `/saveUIConfig` | POST | none | - | No |

### Auth Endpoints (`/chatbot/authn/...`)

| Endpoint | Method | Cache-Control | Duration | CDN |
|---|---|---|---|---|
| `/authn/type` | GET | none | - | No |
| `/authn/login` | POST | none | - | No |
| `/authn/pool-entry` | GET | `no-store` | never | No |
| `/authn/upsertPersonAttributes` | POST | none | - | No |
| `/authn/v1/logout` | POST | none | - | No |

---

## Entry points (never versioned)

These embed URLs are hardcoded on customer host sites and never change:

```html
<link rel="stylesheet" href="…/{routingId}/chatbot/ui/launcher.css"/>
<script src="…/{routingId}/chatbot/ui/launcher.js"></script>
```

- Served with `Cache-Control: public, max-age=1800` — CDN caches per routing ID (30 min)
- `launcher.js` contains `__cdnCacheVersion__` placeholder, replaced at serve-time by the backend
- All subsequent calls from launcher.js go through the versioned path

---

## How it works

```
HOST SITE                           BACKEND                          CDN
────────                            ───────                          ───
<script src="…/chatbot/ui/         serves launcher.js with
  launcher.js">                    __cdnCacheVersion__ = "0"
  │  (no version, no-cache)          │
  ├─────────────────────────────────►│
  │◄─────────────────────────────────┤
  │
  │  JS executes, all calls versioned:
  │  …/chatbot/0/launcher-file     ──► CdnCacheVersionFilter ──►  /launcher-file
  │  …/chatbot/0/ui/{core}         ──► strips "0/" prefix    ──►  /ui/{core}
  │  …/chatbot/0/config            ──► JAX-RS matches        ──►  /config
  │  …/chatbot/0/ui/ (iframe)      ──► as before             ──►  /ui/
```

---

## Files changed

### 1. `launcher.ts` → compiled to `launcher.js`

**File:** `src/main/omni-angular/bootstrap/launcher.ts`

Added `__cdnCacheVersion__/` after `chatbot/` in all URL construction points:

```javascript
fetch('__chatbotBasePath__chatbot/__cdnCacheVersion__/launcher-file')
scriptElement.src = `__chatbotBasePath__chatbot/__cdnCacheVersion__/ui/${filename}`
host: '__chatbotBasePath__chatbot/__cdnCacheVersion__/'
```

### 2. `ChatBotUIService.java` — placeholder replacement

**File:** `src/main/java/.../service/ChatBotUIService.java`

- `CDN_CACHE_VERSION = "0"` constant — increment on each release
- `loadAndTransform()` replaces `__cdnCacheVersion__` → `"0"` when serving `launcher.js`
- `getInvokerBaseUrl()` is unchanged — base path stays version-free

### 3. `CdnCacheVersionFilter.java` — strips version from incoming requests

**File:** `src/main/java/.../filter/CdnCacheVersionFilter.java`

`@PreMatching` filter that strips the leading `/{digits}/` prefix from the request path so existing JAX-RS routes match unchanged. Only numeric-only segments are stripped — no collision risk with real paths.

### 4. `ChatBotApplication.java` — filter registration

**File:** `src/main/java/.../resource/ChatBotApplication.java`

Registered `CdnCacheVersionFilter.class` in `getClasses()`.

---

## CloudFront setup

### Path pattern

```
/extension/api/*/chatbot/*
```

### Lambda@Edge (origin response)

```javascript
export const handler = async (event) => {
    const request  = event.Records[0].cf.request;
    const response = event.Records[0].cf.response;
    const status = parseInt(response.status, 10);

    if (status < 200 || status >= 300) {
        return response;
    }

    const uri = request.uri;

    // Versioned UI assets — /chatbot/{version}/ui/... — cache 1 year (immutable)
    if (/\/chatbot\/\d+\/ui\//.test(uri)) {
        response.headers['cache-control'] = [{
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
        }];
    }
    // Cacheable API endpoints — cache 30 min
    else if (/\/chatbot\/\d+\/(config|supportedLanguages|launcher-file)$/.test(uri)) {
        response.headers['cache-control'] = [{
            key: 'Cache-Control',
            value: 'public, max-age=1800'
        }];
    }

    return response;
};
```

**What gets cached:**
- `/chatbot/0/ui/main-*.js` — cached 1 year (versioned, immutable)
- `/chatbot/0/ui/assets/i18n/en.json` — cached 1 year (versioned, immutable)
- `/chatbot/0/config` — cached 30 min (API)
- `/chatbot/0/supportedLanguages` — cached 30 min (API)
- `/chatbot/0/launcher-file` — cached 30 min (API)

**What does NOT get cached:**
- `/chatbot/ui/launcher.js` — no version, backend sends `no-cache` header
- `/chatbot/ui/main-*.js` — old non-versioned path, untouched by Lambda
- `/chatbot/session`, `/chatbot/authn/...` — dynamic API calls, untouched

No Lambda or path pattern update needed on version bump (`0` → `1` → `2`).

---

## Regex reference

**Versioned paths (CDN-cacheable):**
```
/extension/api/[^/]+/chatbot/(\d+)/.*
```

**Entry points (never cache — no version segment):**
```
/extension/api/[^/]+/chatbot/ui/launcher\.(js|css)
```

---

## Bumping the version

1. Change `CDN_CACHE_VERSION` in `ChatBotUIService.java` (e.g. `"0"` → `"1"`)
2. Deploy
3. Next `launcher.js` request (never cached) gets the new version baked in
4. All subsequent calls hit `…/chatbot/1/…` — CDN has no cache for `/1/` — fetches fresh
5. Old `/0/` entries expire naturally
