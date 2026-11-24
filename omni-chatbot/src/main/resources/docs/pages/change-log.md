# Omni Chatbot — Change Log

## Version 4.0.0

### What's New & Fixed

* While a conversation is busy with a long-running step, the chatbot now shows a live **status indicator** — an animated bubble that cycles through the status messages the conversation sends, along with an optional image — instead of a plain loader. This makes it clear that work is in progress and what is currently happening. While a status step is running the message box stays in place and is simply greyed out, instead of disappearing and shifting the chat.
* The **Welcome Conversation** is now **optional**. If you leave it empty, the chatbot greets users with the **Welcome Message** from the **Basic Settings** section of Integration Settings — so a simple greeting no longer requires building a conversation.
* The **Welcome Message** now always has a value: if you clear it, a built-in default greeting is used, so users are never met with a blank chat.

### Important Upgrade Notes

* If a chatbot has **both** a Welcome Conversation and a Welcome Message configured, the **Welcome Conversation now takes precedence** and the Welcome Message is not shown. Previously both could appear. To use the short greeting instead, clear the **Welcome Conversation** field on the Setup page.

## Version 3.0.11

### What's New & Fixed

* **Get Script Element** is now **Get Integration Information**, and it replies with the two things you actually need to put the chatbot in front of people: an **Integration Script** — a single script tag you paste into your own website — and a **Chatbot URL** you can click to open the chatbot straight away. Previously it returned a long HTML block containing a stylesheet link, an initialisation script and an inline icon. That block could not be used as-is, it silently required jQuery on the host page, and it gave you no way to simply open the chatbot.

### Important Upgrade Notes

* The reply field **Script Element** has been replaced by **Integration Script** and **Chatbot URL**. If a conversation reads the old field, point it at the new one.

## Version 3.0.10

### What's New & Fixed

* When the Welcome Conversation can't run — for example, it isn't live — the chatbot now shows a **Fallback Message** instead of getting stuck on an endless loader. You can set a custom message in the **Basic Settings** section of Integration Settings; if you leave it empty, a generic default message is shown.
* The chatbot now reports **usage statistics** to your observability dashboard (SigNoz) via OpenTelemetry — active users, sessions, connections, incoming/outgoing messages, login failures, and errors by source — plus a classified reason whenever a chat fails to start. This gives administrators clearer visibility into chatbot health and adoption.

## Version 3.0.9

### What's New & Fixed

* Messages now arrive reliably even right after a platform update — including the "session timed out" notice. And once a chat session times out, the message box and Send button are disabled, so it's clear the conversation has ended, and you'll need to refresh to start a new one.
* The chat message box is now a single line — press Enter to send your message, with no extra scrollbar.
* Images added to a form's label now display correctly in the chat.
* The chat window header now shows a **Minimize** control in place of the Close button.
* The chatbot now stops its background keep-alive (ping) traffic once a chat session times out, instead of continuing it in the background.
* The chatbot no longer opens extra connections after a session times out.
* The chatbot now stays available and loads reliably while the platform is being updated, so users are no longer interrupted during an upgrade.
* When the chatbot backend is unreachable (e.g. during an environment upgrade or outage), the chat window now shows a friendly **"We'll be back soon"** screen with a **Try Again** button instead of a raw gateway error page (502/504).

### Important Upgrade Notes

#### 1. Configuration changes can take up to 30 minutes to appear

To keep the chatbot fast and available during platform updates, some settings are now cached. After you **Save** changes in Integration Settings (bot name, theme, chat bubble, welcome message, Terms & Conditions, languages), they may take **up to 30 minutes** to reach end users. The chatbot keeps working with the previous settings until the cache refreshes.

**What to do:**

- Use the Integration Settings **Live Preview** or the **"Try it live"** demo page to check a change immediately — they always show your just-saved settings.
- For end users, allow **up to 30 minutes**, or verify in a **fresh / incognito browser**.
- For an **immediate** rollout to everyone, ask your administrator to refresh the CloudFront cache for the affected paths.

#### 2. Chats open during the upgrade may briefly not receive pushed messages (one-time)

A chat that is **already open at the exact moment of an upgrade** may not receive server-sent messages (such as the session-timeout notice) until its connection reconnects. This **recovers on its own** — the connection re-establishes automatically after the upgrade, or when the user refreshes the page. If a session times out during this brief window, the user still sees the timeout notice.

**What to do:** Nothing. This is a one-time effect during the upgrade only; new chats started afterward are unaffected.
