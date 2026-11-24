# Release Notes – Omni Chatbot Extension

## Location:
- **Ecosystem:** Essentials
- **Domain:** Collaboration

## Version 4.0.0

- **Krista Service APIs Java** : 1.0.126-sp2
- **Minimum Appliance Release Version**: 3.6.2-sp4

## Features Implemented / Bug Fixes

* [KR-14876](https://antbrains.atlassian.net/browse/KR-14876): Show a live **status indicator** while a conversation is busy with a long-running step — an animated bubble that cycles through the status messages the conversation sends, with an optional image — instead of a plain loader. While a status step runs the message box now stays in place and is greyed out instead of being hidden, so the chat no longer shifts.
* The **Welcome Conversation** is now optional. When it is left empty the chatbot greets users with the **Welcome Message** from the **Basic Settings** section of Integration Settings; if that is also empty, a built-in default greeting is used.

### Important Upgrade Notes

* When both a **Welcome Conversation** and a **Welcome Message** are configured, the Welcome Conversation now takes precedence and the Welcome Message is not shown. Clear the **Welcome Conversation** field on the Setup page to use the short greeting instead.

## Version 3.0.10

- **Krista Service APIs Java** : 1.0.126-sp2
- **Minimum Appliance Release Version**: 3.6.2-sp4

## Features Implemented / Bug Fixes

* [KR-19199](https://antbrains.atlassian.net/browse/KR-19199): OpenTelemetry observability for the Omni Chatbot — span-based telemetry exported to SigNoz (active users, sessions, connections, incoming/outgoing messages, login failures, errors by source), plus classified chat-start failure reasons.
* [KR-21127](https://antbrains.atlassian.net/browse/KR-21127): Show a **Fallback Message** when the Welcome Conversation cannot run (e.g. it is not live) instead of leaving the chatbot stuck on an endless loader. Set a custom message in the **Basic Settings** section of Integration Settings; if left empty, a generic default message is shown.

## Version 3.0.9

- **Krista Service APIs Java** : 1.0.126-sp2
- **Minimum Appliance Release Version**: 3.6.2-sp4

## Features Implemented / Bug Fixes

* [KR-21024](https://antbrains.atlassian.net/browse/KR-21024): Messages now arrive reliably even right after a platform update — including the "session timed out" notice. And once a chat session times out, the message box and Send button are disabled, so it's clear the conversation has ended and you'll need to refresh to start a new one.
* [KR-20682](https://antbrains.atlassian.net/browse/KR-20682): The chat message box is now a single line — press Enter to send your message, with no extra scrollbar.
* [KR-21121](https://antbrains.atlassian.net/browse/KR-21121): Images added to a form's label now display correctly in the chat.
* [KR-21139](https://antbrains.atlassian.net/browse/KR-21139): The chat window header now shows a **Minimize** control in place of the Close button.
* [KR-19784](https://antbrains.atlassian.net/browse/KR-19784): The chatbot now stops its background keep-alive (ping) traffic once a chat session times out, instead of continuing it in the background.
* [KR-19635](https://antbrains.atlassian.net/browse/KR-19635): The chatbot no longer opens extra connections after a session times out.
* [KR-21091](https://antbrains.atlassian.net/browse/KR-21091): The chatbot now stays available and loads reliably while the platform is being updated, so users are no longer interrupted during an upgrade.
* [KR-21161](https://antbrains.atlassian.net/browse/KR-21161): When the chatbot backend is unreachable (e.g. during an environment upgrade or outage), the chat window now shows a friendly **"We'll be back soon"** screen with a **Try Again** button instead of a raw gateway error page (502/504).

## Chatbot Upgrade Notes (Version 3.0.9)

### 1. Configuration changes can take up to 30 minutes to appear (CDN caching)

To keep the chatbot fast and resilient during invoker upgrades, several bootstrap resources are now cached at the CDN and in the browser. As a result, some changes are **not instant**:

- **Integration Settings changes** (bot name, theme, chat bubble, welcome message, Terms & Conditions, languages, etc.) are delivered via the cached `config` / supported-languages responses. After you **Save**, the update appears within **up to 30 minutes**. The chatbot keeps working with the previous settings until the cache refreshes.

**What to do:**

- The Integration Settings **Live Preview** and the **"Try it live"** demo page always reflect your **just-saved** settings immediately (they read an uncached preview endpoint), so use them to verify a change right away.
- For end users, allow **up to 30 minutes** for the change to propagate, or verify it immediately in a **fresh / incognito browser**.
- For an **immediate** rollout to everyone, ask DevOps to **invalidate the CloudFront cache** for the affected paths (e.g. `/chatbot/*/config`, `/chatbot/*/supportedLanguages`, `/chatbot/ui/launcher.*`).

> **Note**: During an invoker upgrade / restart, cached copies keep the chatbot bubble and initial load available from the edge. The live conversation (session, messages, real-time updates) still requires the invoker to be running.

### 2. Chats open during the upgrade may briefly not receive pushed messages (one-time)

A chat that is **already open at the exact moment of an upgrade** may not receive server-sent messages (such as the session-timeout notice) until its connection reconnects:

- This **recovers on its own** — the connection re-establishes automatically after the upgrade, or as soon as the user refreshes the page.
- If a session times out during this brief window, the user still sees the timeout notice.

**What to do:** Nothing. This is a one-time effect during the upgrade only; new chats started afterward are unaffected.

## Version 3.0.6

- **Krista Service APIs Java** : 1.0.126-sp2
- **Minimum Appliance Release Version**: 3.6.2-sp4

## Features Implemented / Bug Fixes

* [KR-21136](https://antbrains.atlassian.net/browse/KR-21136): Search feature in Selection field is fixed now. 
* [KR-21036](https://antbrains.atlassian.net/browse/KR-21036): New **Faster Startup** toggle in the Behavior section of Integration Settings. When enabled, a warm pool of pre-authenticated guest users is maintained in the background so new chatbot opens skip the live login round-trip and feel near-instant. Disabled by default — opt in per chatbot.
* [KR-21090](https://antbrains.atlassian.net/browse/KR-21090): Feedback submission fails and marks conversation as Incomplete

## Chatbot Upgrade Notes (Version 3.0.3)

### 1. Enabling the "Faster Startup" warm pool

The chatbot now ships with a **Faster Startup** toggle in the **Behavior** section of Integration Settings. When enabled:

- A warm pool of guest user accounts is maintained in the background for this chatbot.
- New chatbot opens consume a pre-warmed entry instead of provisioning one on the fly — typical login latency drops noticeably.
- The pool tops itself up after every consumed entry and again on the background sweep cycle (every 5 minutes).

The toggle is **off by default**. No pool entries are created until an admin enables it and saves. While disabled, logins fall back to the live provisioning path used in earlier versions.

### 2. Turning the toggle off deletes existing pool users

When the **Faster Startup** toggle is flipped from on to off and saved:

- All pooled guest accounts created for this chatbot are deleted from the workspace (hard delete, not a soft retire).
- The pool's persistent storage is drained.

> **Important**: This deletion happens on save. If a real user is in the middle of a chat at that moment, their guest account is also removed and their session ends abruptly. Plan toggle-off changes during a quiet window, or coordinate with anyone who might be chatting.

### 3. Default Role still drives pool composition

Pooled accounts inherit the chatbot's **Default Role** at the time each entry is provisioned. Changing the Default Role while the toggle is on reconciles every existing entry to the new role in place — no orphan accounts. The View-access caveat under Section 1 of the 3.0.1 upgrade notes still applies: the Default Role must have View access to your Welcome and Fallback conversations regardless of whether the warm pool is on or off.

## Version 3.0.1

- **Krista Service APIs Java** : 1.0.126
- **Minimum Appliance Release Version**: 3.6.2-sp2

## Features Implemented / Bug Fixes

* [KR-20928](https://antbrains.atlassian.net/browse/KR-20928): Significantly faster chatbot launch (v3.0.1). Guest sessions are now served from a pre-provisioned warm pool, and bootstrap configuration, supported languages, and UI assets are delivered with fewer network round-trips on first open.
* [KR-20928](https://antbrains.atlassian.net/browse/KR-20928): The welcome conversation now starts automatically once per session as soon as the chat connects (v3.0.1).
* [KR-19466](https://antbrains.atlassian.net/browse/KR-19466): Fixed session timeout not updating to new values even after chatbot extension upgrade.
* [KR-20773](https://antbrains.atlassian.net/browse/KR-20773): Supported CSP script-src header.
* [KR-20881](https://antbrains.atlassian.net/browse/KR-20881): HTML tags were displayed in message issue is solved.
* [KR-20928](https://antbrains.atlassian.net/browse/KR-20928): Improved Omni Chatbot launch time (v3.0.0-sp3).

## Known Issue
* [KR-13245](https://antbrains.atlassian.net/browse/KR-13245) During execution, the conversation footer is only disabled when the last step is either "Person makes request" or "Ask a Person."

## Limitation and Caveats
* You can’t begin a new conversation when another one is ongoing. For example, you can't run multiple conversations from an NLP result or include conversation buttons in a user message during an active chat. 
* Resending the main message wouldn’t be possible after the sidebar execution flow is completed. 
* Support is provided for Safari version 16.3 and above.

## General Guidelines

- **Conversation access**: Whichever role you set as the **Default Role**, ensure it has **View** access to every conversation the chatbot runs — at minimum the **Welcome Conversation** and the **Fallback Conversation**. Missing View access is the most common cause of "the chat connects but no messages appear."
- **After changing the Default Role or a conversation**: reopen the Omni Chatbot configuration page to confirm the change took effect, then verify the Default Role still has View access to the selected conversations.
- **Verifying an upgrade**: open the chatbot in a fresh or incognito browser session (to bypass cached assets) and confirm it loads end-to-end — open, welcome message, and a reply.

## Chatbot Upgrade Notes (Version 3.0.1)

### 1. Default Role must have *View* access to your Welcome and Fallback conversations

Guest users run the chatbot under the configured **Default Role**. That role must be granted **View** access to the **Welcome Conversation** and the **Fallback Conversation** in each conversation's role settings.

> **Important**: If the Default Role does not have View access to a conversation, the chatbot will connect and may show a typing/working indicator, but **no messages will be delivered**. After changing your Welcome or Fallback conversation, confirm the Default Role has View access to the new conversation.

### 2. Warm session pool and changing the Default Role

To speed up chatbot open, guest accounts are now pre-provisioned in a background pool tied to your **Default Role**.

- When you **change the Default Role**, the pool is rebuilt for the new role. New sessions opened during the brief rebuild window still work correctly; they just may not benefit from the pool until warm-up completes.
- No manual action is required.

### 3. Cached UI assets refresh automatically after upgrade

Chatbot UI assets are now served under a versioned path so browsers and CDNs cache them safely. After upgrading:

- The chatbot continues to function with existing cached assets.
- Updated assets are picked up automatically as the cache refreshes (typically within **up to 7 days**, or immediately after a manual cache clear).
- You do **not** need to update or re-paste your integration script.

### 4. Guest Authentication dependency (temporary)

The **Guest Authentication** configuration remains consolidated inside the Omni Chatbot extension (introduced in 3.0.0-sp5). The **Authentication dependency** is still present in this release **only** to migrate any remaining Guest Authentication settings (Default Role, Session Timeout, Attribute Parameters) onto the chatbot invoker on upgrade. It will be removed in a future release. No action is required.

## Chatbot Upgrade Notes (Version 3.0.0-sp5)

Starting with this release, the Guest Authentication configuration is consolidated into the Omni Chatbot extension. Please review the following information after upgrading the chatbot to **version 3.0.0-sp5**.

### 1. Guest Authentication Fields Now Part of the Chatbot Extension

The configuration fields that were previously part of the **Guest Authentication** extension are now available directly within the **Omni Chatbot** extension configuration.

### 2. Migrated Values May Not Appear Immediately

After upgrading, the migrated Guest Authentication values may not be immediately visible on the Omni Chatbot configuration page. If the values are not displayed, navigate back and reopen the Omni Chatbot configuration page.

> **Note**: Even if the Guest Authentication values are not initially visible in the UI, the migration completes successfully on the backend and the migrated configuration remains intact.

### 3. Dependency Field No Longer Required

The **Dependency** field is no longer used. You do not need to select a dependency extension.

## Chatbot Upgrade Notes (Version 2.0.17-sp1)

Please review the following information after upgrading the chatbot to **version 2.0.17-sp1**.

### 1. Behavior for Older Integration Scripts

If you upgrade the chatbot to **v2.0.17-sp1** but continue using an **older integration script (prior to v2.0.17-sp1)**,
all **UI configuration settings**, including **Chat Bubble configuration**,
will be applied from the **Integration Settings** tab.

### 2. Chatbot Bubble Configuration and Cache Behavior

If you are upgrading the chatbot from a version **earlier than v2.0.16-sp2** to **v2.0.17-sp1**,
the **Chat Bubble configuration** from the **Integration Settings** may not be applied immediately due to browser caching.

- The chatbot will continue to function with the existing configuration.
- Once the browser cache is cleared (automatically or manually), the updated **Chat Bubble configuration** will be applied.
- Cache refresh typically occurs within **up to 7 days**.

### 3. Required Action After Upgrade

After upgrading the chatbot extension to **v2.0.17-sp1**,
please **refresh the chatbot invoker page** to ensure that the latest configuration is synchronized.

> **Important**: The UI Config Json attribute is now optional and no longer used. All chatbot UI configuration is now done through the form-based **Integration Settings** tab. Any values in the UI Config JSON field won’t have any impact on the chatbot configuration.
