# Active User Limit & Waiting Queue – Feature Overview

## What is this feature?

This feature allows you to control how many users can use the chatbot at the same time per invoker. When the limit is reached, new users are placed in a waiting queue instead of getting an error. They see a waiting screen with their position and estimated wait time. As soon as a spot opens up, they are automatically let in.

## Why was this built?

Some customers have limited backend licenses or resources and need to manage how many people use the chatbot at the same time. This feature handles that gracefully — users wait in line instead of getting errors or being blocked.

## How does it work for the user?

1. User opens the chatbot and starts a session.
2. If there is room, they get in immediately — no change from today.
3. If the limit is reached, they see a waiting screen showing their position in line and estimated wait time.
4. The screen updates automatically every few seconds — no need to refresh.
5. As soon as a spot opens, they are taken into the chatbot automatically.
6. If they close the tab while waiting, they leave the queue silently.

## How does a spot open up?

- A user logs out
- A user becomes idle for too long and is disconnected automatically
- A user closes the browser — the system detects this within ~30 seconds and frees the spot

## How is the queue managed?

The queue follows strict first come, first served order. If User A joins before User B, User A always gets in first. Even if a user refreshes the page, their position is preserved.

## What about returning users?

If a user already has an active session (e.g. opened a new tab or refreshed), they are recognized and let in immediately — they don't go through the queue again.

## Is this turned on by default?

No. The feature is turned off by default. Nothing changes for existing customers unless they explicitly ask to enable it.

## How to enable?

Admins can enable it and set the maximum active user count from the chatbot configuration. Default limit when enabled is 250 users per invoker.

## What if we turn it off after it was on?

- All waiting users are immediately let in
- Active users continue normally
- The system goes back to unlimited access

If turned back on, it starts fresh — stale sessions are cleaned up automatically within seconds.

## What if something goes wrong internally?

The system always favors letting users in. If there is any internal issue, users are admitted rather than blocked. No user will ever be stuck because of a system error.

## Per-invoker isolation

Each invoker has its own independent limit and queue. Users on one invoker have no impact on another invoker's capacity.

## Key points for customer conversations

- Zero impact if not enabled
- Users see a friendly waiting screen, never an error
- Queue is fully automatic — no manual work needed
- Returning users bypass the queue
- Admins can change the limit or turn it off anytime with immediate effect
- The system never blocks a user due to internal errors
