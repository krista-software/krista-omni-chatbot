# Release Notes – Krista Chatbot Extension

## Version 2.0.17

- **Krista Service APIs Java** : 1.0.120
- **Minimum Appliance Release Version**: 3.5.7

## Location:
- **Ecosystem:** Essentials
- **Domain:** Collaboration

## Features Implemented / Bug Fixes

* [KR-19514](https://antbrains.atlassian.net/browse/KR-19514): Introduced form-based UI configuration in the Integration Settings tab, replacing JSON-based input. The UI Config Json attribute is now optional and no longer used for chatbot configuration.
* [KR-19276](https://antbrains.atlassian.net/browse/KR-19276): Fixed issue where user accounts were being deleted while conversations were still pending.
* [KR-19466](https://antbrains.atlassian.net/browse/KR-19466): Fixed session timeout not updating to new values even after chatbot extension upgrade.

## Known Issue
* [KR-13245](https://antbrains.atlassian.net/browse/KR-13245) During execution, the conversation footer is only disabled when the last step is either "Person makes request" or "Ask a Person."

## Limitation and Caveats
* The chatbot currently supports only guest authentication.
* You can’t begin a new conversation when another one is ongoing. For example, you can't run multiple conversations from an NLP result or include conversation buttons in a user message during an active chat. 
* Resending the main message wouldn’t be possible after the sidebar execution flow is completed. 
* Support is provided for Safari version 16.3 and above.
* Table/List/Entity complex fields aren’t supported.

## Chatbot Upgrade Notes (Version 2.0.17)

Please review the following information after upgrading the chatbot to **version 2.0.17**.

### 1. Behavior for Older Integration Scripts

If you upgrade the chatbot to **v2.0.17** but continue using an **older integration script (prior to v2.0.17)**,
all **UI configuration settings**, including **Chat Bubble configuration**,
will be applied from the **Integration Settings** tab.

### 2. Chatbot Bubble Configuration and Cache Behavior

If you are upgrading the chatbot from a version **earlier than v2.0.16-sp2** to **v2.0.17**,
the **Chat Bubble configuration** from the **Integration Settings** may not be applied immediately due to browser caching.

- The chatbot will continue to function with the existing configuration.
- Once the browser cache is cleared (automatically or manually), the updated **Chat Bubble configuration** will be applied.
- Cache refresh typically occurs within **up to 7 days**.

### 3. Required Action After Upgrade

After upgrading the chatbot extension to **v2.0.17**,
please **refresh the chatbot invoker page** to ensure that the latest configuration is synchronized.

> **Important**: The UI Config Json attribute is now optional and no longer used. All chatbot UI configuration is now done through the form-based **Integration Settings** tab. Any values in the UI Config JSON field won’t have any impact on the chatbot configuration.
