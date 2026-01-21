# Get Session Info by Email

## Overview

Retrieves comprehensive session information and conversation history for a user identified by their email address. This catalog request returns both a formatted text summary and a structured list of all messages in the user's session, making it ideal for support, analytics, and administrative purposes.

## Request Details

- **Area**: Integration
- **Type**: CHANGE_SYSTEM
- **Retry Support**: ✅ Yes (Supports retry on failure)

## Input Parameters

| Parameter Name | Type | Required | Description | Example |
|----------------|------|----------|-------------|---------|
| Email | Text | Yes | Email address of the user whose session information to retrieve | "john.doe@example.com" |

## Output Parameters

| Parameter Name | Type | Description |
|----------------|------|-------------|
| Info | Paragraph | Formatted text summary of all session messages with sender names, timestamps, and content |
| Details | List of Multifield | Structured list of message objects containing Name, Creation Time, and Message fields |

### Details Structure

Each item in the Details list contains:

| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| Name | Text | Name of the message sender | "John Doe" or "Krista Bot" |
| Creation Time | Date | Timestamp when the message was created | 2024-01-15 10:30:00 |
| Message | Text | Complete message content including form fields | "Hello, I need help" |

## Validation Rules

| Validation | Error Message | Resolution |
|------------|---------------|------------|
| Email is required | "Email parameter is required" | Provide a valid email address |
| Email format valid | "Invalid email format" | Ensure email follows standard format (user@domain.com) |
| Account exists | "Account not found for email" | Verify the email address is registered in the system |

## Error Handling

### Input Errors (INPUT_ERROR)

**Cause**: Invalid or missing email parameter  
**Error Message**: "Email parameter is required" or "Invalid email format"  
**Common Scenarios**:
- Email parameter not provided
- Email format is invalid
- Empty or whitespace-only email

**Resolution**:
1. Provide a valid email address
2. Verify email format (user@domain.com)
3. Ensure email is not empty
4. Check for typos in email address

### Logic Errors (LOGIC_ERROR)

**Cause**: Account not found for provided email  
**Error Message**: "Account not found for email: [email]"  
**Common Scenarios**:
- Email address not registered in system
- User hasn't used the chatbot
- Typo in email address

**Resolution**:
1. Verify the email address is correct
2. Check if user has interacted with the chatbot
3. Confirm user account exists in the system
4. Try with a different email address

### System Errors (SYSTEM_ERROR)

**Cause**: Internal error retrieving session information  
**Error Message**: "Failed to retrieve session information"  
**Common Scenarios**:
- Database connection issues
- Inbox service unavailable
- Message retrieval failure

**Resolution**:
1. Retry the request
2. Check system logs for detailed errors
3. Verify inbox service is running
4. Ensure database connectivity
5. Contact system administrator

## Usage Examples

### Example 1: Retrieve Session Info for Support

**Input**:
```
Email: "customer@example.com"
```

**Output**:
```
Info: "Session info for email: 
Name: Krista Bot
Creation Time: Mon Jan 15 10:00:00 PST 2024
Message: Welcome to Krista! How can I help you today?

Name: John Customer
Creation Time: Mon Jan 15 10:01:00 PST 2024
Message: I need help with my order

Name: Krista Bot
Creation Time: Mon Jan 15 10:01:30 PST 2024
Message: I'd be happy to help with your order. What's your order number?"

Details: [
  {
    Name: "Krista Bot",
    Creation Time: 2024-01-15 10:00:00,
    Message: "Welcome to Krista! How can I help you today?"
  },
  {
    Name: "John Customer",
    Creation Time: 2024-01-15 10:01:00,
    Message: "I need help with my order"
  },
  {
    Name: "Krista Bot",
    Creation Time: 2024-01-15 10:01:30,
    Message: "I'd be happy to help with your order. What's your order number?"
  }
]
```

**Result**: Complete session information retrieved for support agent review.

### Example 2: No Messages in Session

**Input**:
```
Email: "newuser@example.com"
```

**Output**:
```
Info: "Session info for email: "
Details: []
```

**Result**: User has a session but no messages yet.

### Example 3: Session with Form Data

**Input**:
```
Email: "formuser@example.com"
```

**Output**:
```
Info: "Session info for email:
Name: Krista Bot
Creation Time: Mon Jan 15 11:00:00 PST 2024
Message: Please provide your information

Name: Jane User
Creation Time: Mon Jan 15 11:01:00 PST 2024
Message: Name: Jane Smith
Email: jane@example.com
Phone: 555-1234"

Details: [
  {
    Name: "Krista Bot",
    Creation Time: 2024-01-15 11:00:00,
    Message: "Please provide your information"
  },
  {
    Name: "Jane User",
    Creation Time: 2024-01-15 11:01:00,
    Message: "Name: Jane Smith\nEmail: jane@example.com\nPhone: 555-1234"
  }
]
```

**Result**: Session includes form field data in message content.

## Business Rules

1. **Email-Based Lookup**: Retrieves session for the account associated with the provided email
2. **Complete History**: Returns all messages in the user's session
3. **Chronological Order**: Messages are ordered from oldest to newest
4. **Duplicate Prevention**: Duplicate messages are filtered out using message ID tracking
5. **Empty Message Filtering**: Messages with no content are excluded from results
6. **Form Field Inclusion**: Form fields and their values are included in message content
7. **Sender Identification**: Each message includes the sender's name
8. **Timestamp Precision**: Creation time is provided with full date and time
9. **Pagination**: Retrieves messages in batches of 100

## Limitations

1. **Single Session**: Returns information for one user's session only
2. **Current Session Only**: Cannot retrieve historical sessions
3. **Email Required**: Must have valid email address to lookup
4. **Account Dependency**: User must have an account in the system
5. **Message Limit**: Retrieves up to 100 messages per batch (may not include all messages in very long conversations)
6. **No Media Content**: Text content only, media files not included in message text
7. **Session Scope**: Limited to chatbot medium sessions

## Best Practices

### 1. Use for Customer Support
Retrieve conversation history when assisting customers:

```
1. Customer contacts support
2. Support agent gets customer email
3. Run "Get Session Info by Email"
4. Review conversation history
5. Provide informed assistance
```

### 2. Administrative Monitoring
Monitor user sessions for quality assurance:

```
1. Select user email for review
2. Get Session Info by Email
3. Review conversation quality
4. Identify improvement opportunities
5. Update conversation flows
```

### 3. Analytics and Reporting
Collect session data for analysis:

```
1. Get Session Info by Email for multiple users
2. Extract message patterns
3. Analyze conversation topics
4. Generate usage reports
5. Identify trends
```

### 4. Compliance and Auditing
Maintain records for compliance:

```
1. Get Session Info by Email
2. Export to audit log
3. Store with timestamp and user ID
4. Retain per compliance requirements
5. Provide for audits as needed
```

## Common Use Cases

### 1. Support Ticket Investigation

```
Scenario: Customer submits support ticket, agent needs conversation context
Action:
  1. Agent receives ticket with customer email
  2. Run "Get Session Info by Email" with customer's email
  3. Review conversation history in Details
  4. Understand customer's issue from context
  5. Provide targeted support
Result: Agent has full context to resolve issue efficiently
```

### 2. Quality Assurance Review

```
Scenario: QA team reviews chatbot interactions
Action:
  1. Select sample of user emails
  2. Get Session Info by Email for each user
  3. Review conversation quality
  4. Identify bot response issues
  5. Update conversation flows
Result: Improved chatbot quality based on real interactions
```

### 3. User Behavior Analysis

```
Scenario: Analyze how users interact with chatbot
Action:
  1. Get Session Info by Email for active users
  2. Parse message content for patterns
  3. Identify common questions
  4. Track conversation paths
  5. Optimize conversation design
Result: Data-driven conversation improvements
```

### 4. Compliance Reporting

```
Scenario: Generate compliance report for user interactions
Action:
  1. Get Session Info by Email for all users in period
  2. Extract relevant conversation data
  3. Format for compliance report
  4. Include timestamps and content
  5. Submit for audit
Result: Complete audit trail of user interactions
```

### 5. Escalation with Context

```
Scenario: Escalate complex issue to specialist
Action:
  1. Get Session Info by Email for user
  2. Include conversation history in escalation
  3. Specialist reviews full context
  4. Specialist provides expert assistance
Result: Efficient escalation with complete context
```

## Related Catalog Requests

- [Get Session Id for Active User](pages/get-session-id-for-active-user.md) - Get session ID for current user
- [Get Transcript of the Conversation](pages/get-transcript-of-the-conversation.md) - Get formatted transcript
- [Get Last User Message](pages/get-last-user-message.md) - Get most recent user message

## Technical Implementation

### Area Class
- **Class**: `IntegrationArea`
- **Package**: `app.krista.extensions.essentials.collaboration.omnichatbot.catalog`
- **Method**: `getSessionInfoByEmail(String email)`

### Implementation Details

The catalog request performs the following operations:

1. **Lookup Account**: Uses `AccountProvider` to find account by email
2. **Create Medium Message**: Creates `InteractiveMessageIn` for the account
3. **Authenticate Account**: Gets authenticated account for the medium
4. **Get Session Inbox**: Retrieves inbox ID for the user's session
5. **Retrieve Messages**: Fetches messages in batches of 100
6. **Process Messages**: Iterates through messages, filtering duplicates
7. **Extract Message Data**: Gets sender name, creation time, and message content
8. **Build Info String**: Constructs formatted text summary
9. **Build Details List**: Creates structured list of message objects
10. **Return Results**: Returns both Info and Details

### Duplicate Prevention

Uses a `Set<String>` to track processed message IDs:

```java
Set<String> processedMessageIds = new HashSet<>();

for (Message message : messages) {
    if (processedMessageIds.contains(message.getMessageId())) {
        continue; // Skip duplicate
    }
    processedMessageIds.add(message.getMessageId());
    // Process message...
}
```

### Message Processing

For each message:
1. Converts to `MessageDto` using `MessageDtoFactory`
2. Extracts sender name
3. Gets creation timestamp
4. Builds message content from text and form fields
5. Filters out empty messages
6. Adds to both Info string and Details list

### Dependencies

- `AccountProvider` - For looking up account by email
- `InteractiveMediumService` - For account authentication
- `InboxManager` - For accessing inbox messages
- `MessageDtoFactory` - For converting messages to DTOs

## Troubleshooting

### Account Not Found Error

**Cause**: Email address not registered in system  
**Solution**:
1. Verify email address is correct
2. Check for typos
3. Confirm user has used the chatbot
4. Try with a known valid email

### Empty Results Returned

**Cause**: User has no messages in session  
**Solution**:
1. Verify user has interacted with chatbot
2. Check if session was recently created
3. Confirm messages were sent successfully
4. Review session state

### Duplicate Messages in Results

**Cause**: Duplicate filtering not working  
**Solution**:
1. Check system logs for errors
2. Verify message IDs are unique
3. Review message retrieval logic
4. Contact the system administrator

### Performance Issues with Large Sessions

**Cause**: Many messages in session  
**Solution**:
1. Consider pagination limits
2. Review message batch size
3. Optimize for expected session sizes
4. Implement caching if needed

## See Also

- [Get Session Id for Active User](pages/get-session-id-for-active-user.md) - Session management
- [Get Transcript of the Conversation](pages/get-transcript-of-the-conversation.md) - Formatted transcripts
- [Extension Configuration](pages/extension-configuration.md) - Configure the chatbot
- [Authentication](pages/authentication.md) - Authentication details

