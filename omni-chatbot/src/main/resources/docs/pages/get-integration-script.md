# Get Integration Information

## Overview

Returns the two things needed to put the chatbot in front of people:

- an **Integration Script** — a single script tag to paste into a website
- a **Chatbot URL** — a link that opens the chatbot directly in a browser

Both come back from the invoker the request runs on, so the values are always correct for that workspace and environment. Nothing has to be looked up or assembled by hand.

## Request Details

| | |
|---|---|
| Name | Get Integration Information |
| Area | Integration |
| Type | QUERY_SYSTEM |

## Input Parameters

None.

## Output Parameters

| Name | Type | Description |
|---|---|---|
| Integration Script | RichText | The launcher script tag, shown as copyable text |
| Chatbot URL | RichText | A clickable link that opens the chatbot |

Both replies are RichText because that is rendered as HTML: it makes the URL a real clickable link, and it lets the script tag display as readable text rather than as live markup.

### What the values look like

```
Integration Script
<script src="https://<host>/extension/api/<routingId>/chatbot/ui/launcher.js"></script>

Chatbot URL
https://<host>/extension/api/<routingId>/chatbot/<cdnCacheVersion>/ui/
```

The `<cdnCacheVersion>` segment comes from the chatbot's CDN cache version, so the URL follows it automatically when it is bumped.

## Usage

### Embed the chatbot on a website

Copy the **Integration Script** value and paste it into the page, ideally just before the closing `</body>` tag:

```html
<body>
  <!-- page content -->

  <script src="https://<host>/extension/api/<routingId>/chatbot/ui/launcher.js"></script>
</body>
```

That one tag is all a host page needs. The launcher:

- injects its own stylesheet — no separate CSS link is required
- initialises itself once the page is ready — no `new Chatbot(options)` call is required
- takes the chat bubble's appearance from the **Integration Settings** page, served from the invoker

There is **no jQuery dependency**.

### Open the chatbot directly

Click the **Chatbot URL**. The chatbot opens on its own page — useful for sharing with someone who has no site to embed it in, and for a quick check that the invoker is serving correctly.

## Customising the bubble

Appearance — bot name, colours, bubble text, icon, position — is configured on the **Integration Settings** page and served to the launcher at runtime. The embed snippet does not need to be edited to change any of it.

## Notes for upgrades

This request was previously named **Get Script Element** and replied with a single **Script Element** field containing a long HTML block: a stylesheet link, an initialisation script with an inline options object, and an inline SVG icon. That block could not be pasted into a site as-is, it silently depended on jQuery being present, and it exposed no chatbot URL.

The request id is unchanged, so anything referring to it by id keeps working. If a conversation reads the old **Script Element** reply field by name, point it at **Integration Script** or **Chatbot URL** instead.

## Related

- [Testing the Chatbot](testing-chatbot.md)
- [Context Data Passing](context-data-passing.md)
