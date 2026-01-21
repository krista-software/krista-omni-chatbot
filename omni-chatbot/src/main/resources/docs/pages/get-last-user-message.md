# Get Last User Message

## Overview

Retrieves the most recent message sent by the user in the current chatbot session. This catalog request searches through the conversation history and returns the last message where the sender is the authenticated user, making it useful for conversation context, validation, and workflow decisions.

## Request Details

- **Area**: Integration
- **Type**: CHANGE_SYSTEM
- **Retry Support**: ✅ Yes (Supports retry on failure)

## Input Parameters

This catalog request does not require any input parameters. It automatically uses the active user's session.

| Parameter Name | Type | Required | Description                  | Example |
|----------------|------|----------|------------------------------|---------|
| _(None)_       | -    | -        | No input parameters required | -       |

## Output Parameters

| Parameter Name | Type | Description                       | Example                     |
|----------------|------|-----------------------------------|-----------------------------|
| Message        | Text | The last message sent by the user | "I need help with my order" |

### Message Content

The returned message includes:
- **Text Content**: The actual message text sent by the user
- **Empty String**: Returns empty string ("") if no user messages are found

## Validation Rules

No validation rules apply as this request has no input parameters.

## Error Handling

### System Errors (SYSTEM_ERROR)

**Cause**: Failed to retrieve user message  
**Error Message**: "Failed to retrieve last user message"  
**Common Scenarios**:
- Session not found
- Inbox access error
- Message retrieval failure
- Authentication error

**Resolution**:
1. Verify the user has an active session
2. Check that a user has sent at least one message
3. Ensure Guest Authentication is configured
4. Review system logs for detailed errors
5. Retry the request

### Authorization Errors

**Cause**: User not properly authenticated  
**Error Message**: "User not authorized"  
**Common Scenarios**:
- Authentication token expired
- Session invalid
- Guest authentication is not configured

**Resolution**:
1. Verify Guest Authentication extension is configured
2. Ensure user session is active
3. Check authentication dependency is set
4. Restart chatbot session if necessary

## Usage Examples

### Example 1: Retrieve Last User Message

**Input**:
```
(No input parameters required)
```

**Output**:
```
Message: "I need help with my account"
```

**Result**: Successfully retrieved the last message sent by the user.

### Example 2: No User Messages Yet

**Input**:
```
(No input parameters required)
```

**Output**:
```
Message: ""
```

**Result**: Empty string returned because the user hasn't sent any messages yet.

### Example 3: After Form Submission

**Scenario**: User filled out a form with multiple fields

**Input**:
```
(No input parameters required)
```

**Output**:
```
Message: "Name: John Doe
Email: john@example.com
Phone: 555-1234"
```

**Result**: Last user message includes all form field values.

### Example 4: Conversation Context

**Scenario**: Bot needs to reference what the user just said

**Conversation**:
```
User: "What's the weather like?"
Bot: [Calls Get Last User Message]
Bot: "You asked: 'What's the weather like?' Let me check that for you."
```

**Result**: Bot can reference and confirm user's question.

## Business Rules

1. **User Messages Only**: Only returns messages sent by the user, not bot messages
2. **Most Recent First**: Searches from most recent messages backwards
3. **Session Scoped**: Only searches within the current user's session
4. **Empty on No Match**: Returns empty string if no user messages are found
5. **Pagination**: Searches in batches of 20 messages at a time
6. **Complete Message**: Returns the full message content including form fields
7. **Account Matching**: Verifies sender account ID matches authenticated user

## Limitations

1. **Single Message**: Returns only the last message, not message history
2. **Session Scope**: Cannot retrieve messages from previous sessions
3. **No Timestamp**: Does not include a message timestamp
4. **No Metadata**: Does not include message ID or other metadata
5. **Text Only**: Returns text content only, not media or attachments
6. **Search Limit**: Searches through messages in batches (may not find very old messages in long conversations)

## Best Practices

### 1. Use for Conversation Validation
Verify user input before processing:

```
1. Get Last User Message
2. Validate message content
3. If valid, proceed with action
4. If invalid, ask user to rephrase
```

### 2. Context-Aware Responses
Reference a user's message in bot responses:

```
User: "I want to cancel my subscription"
Bot: [Get Last User Message]
Bot: "I understand you want to cancel your subscription. Let me help you with that."
```

### 3. Conditional Workflow
Make decisions based on user input:

```
1. Get Last User Message
2. Check if message contains specific keywords
3. Route to appropriate conversation flow
4. Provide relevant response
```

### 4. Input Confirmation
Confirm user input before taking action:

```
1. Get Last User Message
2. Display confirmation: "You said: [message]"
3. Ask user to confirm
4. Proceed based on confirmation
```

## Common Use Cases

### 1. Intent Detection

```
Scenario: Determine user's intent from their message
Action:
  1. Get Last User Message
  2. Analyze message for keywords
  3. Identify intent (e.g., "cancel", "help", "order")
  4. Route to appropriate conversation
Result: User directed to relevant conversation flow
```

### 2. Input Validation

```
Scenario: Validate user provided required information
Action:
  1. Get Last User Message
  2. Check if message contains expected data
  3. If valid, proceed
  4. If invalid, request clarification
Result: Ensure valid input before processing
```

### 3. Conversation Logging

```
Scenario: Log user messages for analytics
Action:
  1. Get Last User Message
  2. Extract message content
  3. Log to analytics system
  4. Track common user queries
Result: Analytics data for conversation improvement
```

### 4. Escalation Context

```
Scenario: Escalate to human agent with context
Action:
  1. Get Last User Message
  2. Include in escalation request
  3. Human agent sees user's last question
  4. Agent can respond appropriately
Result: Smooth handoff with context preserved
```

### 5. Confirmation Workflows

```
Scenario: Confirm destructive action
Action:
  1. User: "Delete my account"
  2. Get Last User Message
  3. Bot: "You said: 'Delete my account'. Are you sure?"
  4. Wait for confirmation
Result: Prevent accidental destructive actions
```

## Related Catalog Requests

- [Get Transcript of the Conversation——](pages/get-transcript-of-the-conversation.md)Get complete conversation history
- [Get Session Id for Active User——](pages/get-session-id-for-active-user.md)Manage user sessions
- [Get Session Info by Email—](pages/get-session-info-by-email.md)Retrieve session information by email

## Technical Implementation

### Area Class
- **Class**: `IntegrationArea`
- **Package**: `app.krista.extensions.essentials.collaboration.omnichatbot.catalog`
- **Method**: `getLastUserMessage()`

### Implementation Details

The catalog request performs the following operations:

1. **Get Authorized Account**: Retrieves the currently authorized account
2. **Create Medium Message**: Creates an `InteractiveMessageIn` object
3. **Authenticate Account**: Gets the authenticated account for the session
4. **Get Session Inbox**: Retrieves the inbox ID for the user's session
5. **Retrieve Messages**: Fetches messages in batches of 20, starting from the most recent
6. **Search for User Message**: Iterates through messages from newest to oldest
7. **Match Sender**: Checks if message sender matches authenticated user
8. **Convert to DTO**: Converts a matching message to MessageDto
9. **Return Message**: Returns the message text or empty string

### Search Algorithm

The method uses a pagination approach:

```
1. Start with offset = null (most recent messages)
2. Fetch batch of 20 messages
3. Iterate through batch from newest to oldest
4. For each message:
   - Check if sender is the authenticated user
   - If match found, return message text
   - If no match, continue to next message
5. If batch exhausted, fetch next batch
6. Repeat until user message found or no more messages
7. Return empty string if no user messages found
```

### Dependencies

- `AuthorizationContext` - For retrieving an authorized account
- `InteractiveMediumService` - For account authentication
- `InboxManager` - For accessing inbox messages
- `MessageDtoFactory` - For converting messages to DTOs

## Troubleshooting

### Empty String Returned

**Cause**: No user messages in conversation  
**Solution**:
1. Verify a user has sent at least one message
2. Check conversation has started
3. Ensure messages are being saved correctly
4. Review session state

### Wrong Message Returned

**Cause**: Message ordering or account matching issue  
**Solution**:
1. Verify a user account is correctly authenticated
2. Check message timestamps
3. Review conversation flow
4. Ensure the session hasn't been reset

### System Error

**Cause**: Internal error retrieving messages  
**Solution**:
1. Check system logs for detailed errors
2. Verify inbox service is running
3. Ensure database connectivity
4. Retry the request
5. Contact the system administrator

### Performance Issues

**Cause**: Large number of messages in conversation  
**Solution**:
1. Consider conversation length limits
2. Review message pagination settings
3. Optimize conversation flows
4. Archive old conversations

## See Also

- [Get Transcript of the Conversation——](pages/get-transcript-of-the-conversation.md)Complete conversation history
- [Get Session Id for Active User——](pages/get-session-id-for-active-user.md)Session management
- [Extension Configuration——](pages/extension-configuration.md)Configure the chatbot
- [Authentication——](pages/authentication.md)Authentication and session details

