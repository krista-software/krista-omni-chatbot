# Get Transcript of the Conversation

## Overview

Retrieves a formatted transcript of the entire conversation for the active user's current session. This catalog request generates a human-readable transcript containing all messages exchanged between the user and the chatbot, including form field interactions and responses.

## Request Details

- **Area**: Medium
- **Type**: CHANGE_SYSTEM
- **Retry Support**: ✅ Yes (Supports retry on failure)

## Input Parameters

This catalog request does not require any input parameters. It automatically uses the active user's session.

| Parameter Name | Type | Required | Description                  | Example |
|----------------|------|----------|------------------------------|---------|
| _(None)_       | -    | -        | No input parameters required | -       |

## Output Parameters

| Parameter Name | Type | Description                                                  | Example                                                          |
|----------------|------|--------------------------------------------------------------|------------------------------------------------------------------|
| Transcript     | Text | Formatted conversation transcript with bot and user messages | "bot: Welcome to Krista!\nuser: Hello\nbot: How can I help you?" |

### Transcript Format

The transcript is formatted with clear labels for bot and user messages:

```
bot: [Bot message]
user: [User message]
bot: [Bot response]
user: [User input]
```

Form fields and their values are also included in the transcript:

```
bot: Please provide your information
user: Name: John Doe
Email: john@example.com
```

## Validation Rules

No validation rules apply as this request has no input parameters. The session ID is automatically retrieved from the active user's context.

## Error Handling

### System Errors (SYSTEM_ERROR)

**Cause**: Failed to retrieve conversation transcript  
**Error Message**: "Failed to get the transcript of conversation: [error details]"  
**Common Scenarios**:
- Session not found
- Inbox access error
- Message retrieval failure
- Transcript formatting error

**Resolution**:
1. Verify the user has an active session
2. Check that messages exist in the conversation
3. Review system logs for detailed error information
4. Retry the request
5. Contact the system administrator if the issue persists

### Input Errors (INPUT_ERROR)

**Cause**: Invalid session state  
**Error Message**: "Invalid session or no active conversation"  
**Common Scenarios**:
- User session expired
- No conversation started
- Session is not properly initialized

**Resolution**:
1. Ensure user has started a conversation
2. Verify session is active and valid
3. Restart the chatbot if necessary
4. Check Guest Authentication configuration

## Usage Examples

### Example 1: Retrieve Simple Conversation Transcript

**Input**:
```
(No input parameters required)
```

**Output**:
```
Transcript: "bot: Welcome to Krista! How can I assist you today?
user: I need help with my account
bot: I'd be happy to help you with your account. What specific issue are you experiencing?
user: I forgot my password
bot: I can help you reset your password. Please provide your email address."
```

**Result**: Successfully retrieved the conversation transcript showing the exchange between bot and user.

### Example 2: Transcript with Form Data

**Input**:
```
(No input parameters required)
```

**Output**:
```
Transcript: "bot: Please fill out the following information:
user: Name: Jane Smith
Email: jane.smith@example.com
Phone: 555-1234
bot: Thank you for providing your information. We'll contact you shortly."
```

**Result**: Transcript includes form field names and user-provided values.

### Example 3: Multi-Turn Conversation

**Input**:
```
(No input parameters required)
```

**Output**:
```
Transcript: "bot: Welcome! What would you like to do today?
user: Check my order status
bot: I can help you with that. What's your order number?
user: Order number: 12345
bot: Let me look that up for you.
bot: Your order #12345 is currently being processed and will ship tomorrow.
user: Great, thank you!
bot: You're welcome! Is there anything else I can help you with?"
```

**Result**: Complete multi-turn conversation captured in chronological order.

### Example 4: Export for Support Ticket

**Scenario**: Customer service agent needs conversation history for a support ticket

**Input**:
```
(No input parameters required)
```

**Output**:
```
Transcript: "bot: Hello! How can I help you today?
user: I'm having trouble with my subscription
bot: I'm sorry to hear that. Can you describe the issue?
user: I was charged twice this month
bot: I understand. Let me escalate this to our billing team.
bot: I've created a support ticket for you. Reference number: TKT-789."
```

**Result**: Transcript exported and attached to support ticket TKT-789.

## Business Rules

1. **Session-Based Retrieval**: Transcript is retrieved for the active user's current session only
2. **Chronological Order**: Messages are ordered from oldest to newest
3. **Complete History**: All messages in the session are included in the transcript
4. **Formatted Output**: Messages are clearly labeled as "bot:" or "user:"
5. **Form Field Inclusion**: Form fields and their values are included in the transcript
6. **Scientific Notation Handling**: Numbers in scientific notation are converted to standard format
7. **Empty Message Filtering**: Empty or whitespace-only messages are excluded
8. **Maximum Messages**: Retrieves up to 100 messages (configurable)

## Limitations

1. **Session Scope**: Only retrieves messages from the current session
2. **Message Limit**: Default limit of 100 messages per retrieval
3. **No Historical Sessions**: Cannot retrieve transcripts from previous sessions
4. **Text Format Only**: Transcript is a plain text format, not structured data
5. **No Media Content**: Images, files, and other media are not included in the transcript text
6. **Language**: Transcript is in the language used during the conversation

## Best Practices

### 1. Use for Support Documentation
Capture conversation transcripts for customer support records:

```
1. Get Transcript of the Conversation
2. Attach to support ticket
3. Store in CRM system
4. Use for quality assurance review
```

### 2. Conversation Analytics
Analyze conversation patterns and user behavior:

```
1. Retrieve transcript
2. Parse for keywords and topics
3. Identify common user questions
4. Improve conversation flows based on insights
```

### 3. Compliance and Auditing
Maintain records for compliance purposes:

```
1. Get transcript at end of conversation
2. Store in secure audit log
3. Include timestamp and session ID
4. Retain according to compliance requirements
```

### 4. Quality Assurance
Review conversations for quality improvement:

```
1. Retrieve random sample of transcripts
2. Review for accuracy and helpfulness
3. Identify areas for improvement
4. Update conversation flows as needed
```

## Common Use Cases

### 1. Customer Support Escalation

```
Scenario: User requests human agent assistance
Action:
  1. Get Transcript of the Conversation
  2. Pass transcript to human agent
  3. Agent reviews conversation history
  4. Agent continues conversation with full context
Result: Seamless handoff to human agent with complete context
```

### 2. Conversation Export

```
Scenario: User requests copy of conversation
Action:
  1. Get Transcript of the Conversation
  2. Format transcript for email
  3. Send transcript to user's email address
Result: User receives complete conversation history
```

### 3. Analytics Dashboard

```
Scenario: Display conversation metrics on dashboard
Action:
  1. Get Transcript of the Conversation
  2. Parse transcript for metrics (message count, topics, etc.)
  3. Update analytics dashboard
Result: Real-time conversation analytics available
```

### 4. Training Data Collection

```
Scenario: Collect conversations for AI training
Action:
  1. Get Transcript of the Conversation
  2. Anonymize personal information
  3. Store in training data repository
Result: Conversation data available for model improvement
```

## Related Catalog Requests

- [Get Session Id for Active User](pages/get-session-id-for-active-user.md) - Retrieve the session ID used for transcript retrieval
- [Get Last User Message](pages/get-last-user-message.md) - Get only the most recent user message
- [Get Session Info by Email](pages/get-session-info-by-email.md) - Retrieve session information including messages by email

## Technical Implementation

### Service Class
- **Class**: `ChatBotApiService`
- **Package**: `app.krista.extensions.essentials.collaboration.omnichatbot.service`
- **Method**: `getMessages(String inboxId, String offset, boolean inclusive, int pageSize)`

### Helper Class
- **Class**: `TranscriptUtils`
- **Package**: `app.krista.extensions.essentials.collaboration.omnichatbot.utils`
- **Method**: `createFormattedTranscript(List<MessageDto> messages)`

### Implementation Details

The catalog request performs the following operations:

1. **Get Session ID**: Retrieves the inbox ID for the active user's session
2. **Retrieve Messages**: Fetches up to 100 messages from the inbox
3. **Format Transcript**: Uses `TranscriptUtils.createFormattedTranscript()` to format messages
4. **Handle Errors**: Catches exceptions and returns appropriate error responses
5. **Return Result**: Returns success response with formatted transcript

### Transcript Formatting Logic

The `TranscriptUtils.createFormattedTranscript()` method:

1. Iterates through all messages in chronological order
2. Identifies sender (bot or user)
3. Extracts message text
4. Processes form fields and their values
5. Converts scientific notation numbers to standard format
6. Filters out empty messages
7. Formats with "bot:" or "user:" prefixes
8. Returns a complete formatted transcript string

### Dependencies

- `ChatBotApiService` - For session and message retrieval
- `TranscriptUtils` - For transcript formatting
- `MessageDtoFactory` - For converting messages to DTOs
- `InboxManager` - For accessing inbox messages

## Troubleshooting

### Empty Transcript Returned

**Cause**: No messages in the conversation  
**Solution**:
1. Verify the conversation has started
2. Check that messages were sent
3. Ensure the session is active
4. Try sending a message first

### Transcript Missing Recent Messages

**Cause**: Message retrieval limit or timing issue  
**Solution**:
1. Check if more than 100 messages exist
2. Verify messages were successfully sent
3. Wait a moment and retry
4. Check system logs for message processing issues

### Transcript Format Incorrect

**Cause**: Formatting error or special characters  
**Solution**:
1. Review transcript for special characters
2. Check for encoding issues
3. Verify message content is valid
4. Contact support if formatting persists

### System Error When Retrieving Transcript

**Cause**: Internal service error  
**Solution**:
1. Retry the request
2. Check system logs for detailed errors
3. Verify inbox service is running
4. Ensure database connectivity
5. Contact the system administrator

## See Also

- [Get Session Id for Active User](pages/get-session-id-for-active-user.md) - Session management
- [Extension Configuration](pages/extension-configuration.md) - Configure the chatbot
- [Authentication](pages/authentication.md) - Session and authentication details

