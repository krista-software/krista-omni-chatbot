# Get Session Id for Active User

## Overview

Retrieves the session ID for the currently active user in the chatbot. This catalog request returns the unique identifier for the user's current chatbot session, which can be used for session tracking, conversation management, and integration with other systems.

## Request Details

- **Area**: Medium
- **Type**: QUERY_SYSTEM
- **Retry Support**: ❌ No (Query operations typically don't support retry)

## Input Parameters

This catalog request does not require any input parameters.

| Parameter Name | Type | Required | Description | Example |
|----------------|------|----------|-------------|---------|
| _(None)_ | - | - | No input parameters required | - |

## Output Parameters

| Parameter Name | Type | Description | Example |
|----------------|------|-------------|---------|
| Session Id | Text | Unique identifier for the active user's chatbot session | "inbox_abc123def456" |

## Validation Rules

No validation rules apply as this request has no input parameters.

## Error Handling

### System Errors (SYSTEM_ERROR)

**Cause**: Internal system error while retrieving or creating session  
**Error Message**: "Failed to retrieve session ID"  
**Common Scenarios**:
- Database connection issues
- Session service unavailable
- Internal service errors

**Resolution**:
1. Retry the request
2. Check system logs for detailed error information
3. Verify the chatbot extension is properly configured
4. Ensure Guest Authentication extension is working correctly
5. Contact system administrator if issue persists

### Authorization Errors

**Cause**: User is not properly authenticated  
**Error Message**: "User not authorized"  
**Common Scenarios**:
- Guest authentication not configured
- Authentication token expired
- User session invalid

**Resolution**:
1. Verify Guest Authentication extension is configured
2. Ensure user has valid authentication
3. Check authentication dependency is set correctly
4. Restart the chatbot session

## Usage Examples

### Example 1: Get Current Session ID

**Input**:
```
(No input parameters required)
```

**Output**:
```
Session Id: "inbox_7f8e9d0c1b2a3456"
```

**Result**: Successfully retrieved the session ID for the active user's chatbot session.

### Example 2: Use in Conversation Flow

**Scenario**: Retrieve session ID to pass to an external system for tracking

**Input**:
```
(No input parameters required)
```

**Output**:
```
Session Id: "inbox_abc123def456789"
```

**Result**: Session ID can now be used to correlate chatbot interactions with external systems.

### Example 3: Session Tracking

**Scenario**: Track user sessions for analytics or support purposes

**Input**:
```
(No input parameters required)
```

**Output**:
```
Session Id: "inbox_user_session_12345"
```

**Result**: Session ID retrieved for logging and tracking purposes.

## Business Rules

1. **Automatic Session Creation**: If no session exists for the active user, a new session is automatically created
2. **Session Uniqueness**: Each user session has a unique identifier
3. **Session Persistence**: The session ID remains constant for the duration of the user's chatbot interaction
4. **Language Association**: Sessions are associated with a language code (default: English "en")
5. **Guest Authentication**: Sessions are created using the Guest Authentication extension
6. **Session Storage**: Session information is stored in the session store for quick retrieval

## Limitations

1. **Language Support**: Currently defaults to English ("en") language code
2. **Authentication Dependency**: Requires Guest Authentication extension to be configured
3. **Session Scope**: Session ID is specific to the chatbot medium and cannot be used across different mediums
4. **No Custom Parameters**: Cannot specify custom session parameters or attributes

## Best Practices

### 1. Use for Session Tracking
Store the session ID in your application to track user interactions across multiple requests:

```
Session ID: inbox_abc123
User Action: Started conversation
Timestamp: 2024-01-15 10:30:00
```

### 2. Integrate with External Systems
Pass the session ID to external systems for correlation:

```
External System Call:
- Session ID: inbox_abc123
- User Context: Customer Service
- Conversation Topic: Product Inquiry
```

### 3. Error Handling
Always handle potential errors when retrieving session IDs:

```
Try to get session ID
If error occurs:
  - Log the error
  - Notify user of temporary issue
  - Retry after brief delay
```

### 4. Session Validation
Verify the session ID is valid before using it in other operations:

```
1. Get Session ID
2. Validate format (non-empty, proper structure)
3. Use in subsequent operations
```

## Common Use Cases

### 1. Conversation Transcript Retrieval

```
Scenario: Retrieve conversation history for the current session
Action:
  1. Get Session Id for active user
  2. Use session ID to retrieve conversation transcript
  3. Display or export transcript
Result: Complete conversation history retrieved
```

### 2. Multi-System Integration

```
Scenario: Integrate chatbot with CRM system
Action:
  1. Get Session Id for active user
  2. Pass session ID to CRM API
  3. CRM logs interaction with session reference
Result: Chatbot interactions tracked in CRM
```

### 3. Support Ticket Creation

```
Scenario: Create support ticket with conversation context
Action:
  1. Get Session Id for active user
  2. Retrieve conversation details using session ID
  3. Create support ticket with session reference
Result: Support ticket linked to chatbot conversation
```

### 4. Analytics and Reporting

```
Scenario: Track chatbot usage and user engagement
Action:
  1. Get Session Id for active user
  2. Log session ID with user actions
  3. Analyze session data for insights
Result: Comprehensive usage analytics available
```

## Related Catalog Requests

- [Get Transcript of the Conversation](pages/get-transcript-of-the-conversation.md) - Retrieve conversation transcript using session ID
- [Get Last User Message](pages/get-last-user-message.md) - Fetch the last message from the user
- [Get Session Info by Email](pages/get-session-info-by-email.md) - Retrieve session information by email address

## Technical Implementation

### Service Class
- **Class**: `ChatBotApiService`
- **Package**: `app.krista.extensions.essentials.collaboration.omnichatbot.service`
- **Method**: `getOrCreateSession(String languageCode)`

### Implementation Details

The catalog request performs the following operations:

1. **Get Authorized Account**: Retrieves the currently authorized account from the authorization context
2. **Create Medium Message**: Creates an `InteractiveMessageIn` object with the medium type and account ID
3. **Authenticate Account**: Uses the `InteractiveMediumService` to get or create an authenticated account
4. **Get Session Inbox**: Retrieves or creates a session inbox for the authenticated account
5. **Store Session**: Stores the session information in the session store
6. **Return Session ID**: Returns the inbox ID as the session identifier

### Dependencies

- `AuthorizationContext` - For retrieving the authorized account
- `InteractiveMediumService` - For account authentication and session management
- `SessionStore` - For storing session information
- Guest Authentication Extension - For user authentication

## Troubleshooting

### Session ID Not Returned

**Cause**: Authentication or session creation failure  
**Solution**:
1. Verify Guest Authentication extension is configured
2. Check authentication dependency is set
3. Review system logs for errors
4. Ensure user is properly authenticated

### Session ID Changes Unexpectedly

**Cause**: Session timeout or restart  
**Solution**:
1. Check session timeout settings in Guest Authentication
2. Verify `restartOnRefresh` configuration
3. Review session persistence settings
4. Increase session timeout if appropriate

### Cannot Use Session ID in Other Requests

**Cause**: Session ID format or validity issue  
**Solution**:
1. Verify session ID is not empty
2. Check a session ID format is correct
3. Ensure session hasn't expired
4. Retry getting a fresh session ID

## See Also

- [Authentication](pages/authentication.md) - Authentication and session management details
- [Extension Configuration](pages/extension-configuration.md) - Configure the chatbot extension
- [Get Transcript of the Conversation](pages/get-transcript-of-the-conversation.md) - Use session ID to get transcripts

