# Authentication

## Overview

The Krista Chatbot Extension uses the Guest Authentication extension to provide secure, streamlined access for chatbot users. This authentication mechanism allows users to interact with the chatbot without requiring traditional login credentials, making it ideal for public-facing chatbot implementations.

## Authentication Modes

### Guest Authentication

The Chatbot Extension currently supports **Guest Authentication** exclusively. This authentication mode provides:

- **Streamlined Access** - Users can interact immediately without registration
- **Session Management** - Each user receives a unique session identifier
- **Secure Communication** - Sessions are managed securely by the Krista platform
- **Automatic Account Creation** - Guest accounts are created automatically for each session

**When to Use Guest Authentication:**
- Public-facing chatbots on websites
- Customer service chatbots
- Information kiosks
- Anonymous user interactions
- Quick access scenarios without user registration

## Authentication Flow

### Initial Authentication

1. **User Accesses Chatbot** - User opens the chatbot widget on your website
2. **Authentication Request** - Chatbot extension requests authentication from Guest Authentication extension
3. **Guest Account Creation** - A temporary guest account is created for the session
4. **Session Establishment** - A unique session ID is generated and associated with the guest account
5. **Chatbot Initialization** - Welcome conversation is triggered for the authenticated session

### Session Flow Diagram

```
User Opens Chatbot
       ↓
Guest Authentication Extension
       ↓
Create Guest Account
       ↓
Generate Session ID
       ↓
Initialize Chatbot Session
       ↓
Trigger Welcome Conversation
```

## Session Management

### Session Creation

Sessions are created automatically when a user first interacts with the chatbot:

- **Session ID** - Unique identifier for each user session
- **Account Association** - Each session is linked to a guest account
- **Inbox Creation** - A dedicated inbox is created for the session
- **Language Setting** - Default language (English) is set for the session

### Session Persistence

- Sessions persist for the duration of the user's interaction
- Session data is maintained in the Krista platform
- Conversation history is preserved within the session
- Sessions can be retrieved using the session ID

### Session Termination

Sessions may terminate under the following conditions:

- User closes the chatbot window (if `restartOnRefresh` is enabled)
- Session timeout period expires (configured in Authentication extension)
- User clears browser cookies/storage
- Manual session termination

## Security Considerations

### Best Practices

1. **Configure Session Timeout**
   - Set appropriate timeout values in the Guest Authentication extension
   - Balance security with user experience
   - Typical values: 15-30 minutes for active sessions

2. **HTTPS Requirement**
   - Always use HTTPS for production deployments
   - Ensures encrypted communication
   - Protects session data in transit

3. **Trust Extension Setting**
   - Enable "Trust Extension" only when necessary
   - Understand the security implications
   - Review with a security team for production use

4. **Regular Updates**
   - Keep Guest Authentication extension updated
   - Keep Chatbot extension updated

### Data Privacy

- Guest sessions are temporary and anonymous
- No personally identifiable information (PII) is required
- Conversation data is stored according to Krista platform policies
- Transcripts can be exported if needed for compliance

## Authentication Extension Setup

### Prerequisites

Before configuring authentication:

1. Access to Krista Catalog
2. Workspace administrator rights
3. Understanding of your security requirements

### Installation Steps

1. **Navigate to Authentication Domain**
   - Go to Catalog → Krista Ecosystem → Authentication Domain
   - Locate the Guest Authentication extension

2. **Add to Workspace**
   - Click "Add to Workspace"
   - Update to the latest version if prompted

3. **Configure Parameters**
   - Navigate to the extension's Setup page
   - Configure session timeout settings
   - Set any required security parameters

4. **Validate Configuration**
   - Click "Validate Attributes"
   - Resolve any validation errors
   - Save the configuration

5. **Link to Chatbot Extension**
   - In Chatbot Extension setup
   - Navigate to Dependencies panel
   - Select Guest Authentication in the Authentication field

## Session Timeout Configuration

### Understanding Session Timeout

Session timeout determines how long a user session remains active without interaction.

**Important:** After modifying the session timeout parameter in the Authentication extension, you must upgrade and validate the Chatbot extension.

### Recommended Timeout Values

| Use Case | Recommended Timeout | Rationale |
|----------|-------------------|-----------|
| Public Information | 15 minutes | Quick queries, minimal interaction |
| Customer Service | 30 minutes | Longer conversations, form filling |
| Complex Workflows | 60 minutes | Multi-step processes, document uploads |

### Configuring Timeout

1. Open Guest Authentication extension setup
2. Locate the session timeout parameter
3. Enter timeout value in minutes
4. Save and validate the configuration
5. **Important:** Upgrade and validate the Chatbot extension after changes

## Troubleshooting Authentication

### User Cannot Access Chatbot

**Cause**: Guest Authentication extension not configured or linked  
**Resolution**:
1. Verify Guest Authentication extension is installed
2. Check extension is properly configured
3. Ensure Chatbot extension has Authentication dependency set
4. Validate both extensions

### Session Expires Too Quickly

**Cause**: Session timeout set too low  
**Resolution**:
1. Review session timeout in Guest Authentication extension
2. Increase timeout value if appropriate
3. Upgrade and validate Chatbot extension
4. Test with users to confirm improvement

### Session Not Persisting

**Cause**: Browser storage issues or configuration  
**Resolution**:
1. Check if cookies are enabled in the browser
2. Verify browser local storage is accessible
3. Review `restartOnRefresh` setting in UI Config
4. Test in different browsers

## Limitations

- **Authentication Mode**: Only Guest Authentication is currently supported
- **User Accounts**: No traditional user account management
- **Persistent Identity**: Guest sessions are temporary and anonymous
- **Multi-Device**: Sessions are browser-specific, not cross-device

## Future Authentication Options

While currently limited to Guest Authentication, future versions may support:

- OAuth 2.0 authentication
- SAML integration
- Custom authentication providers
- Multifactor authentication (MFA)

## See Also

- [Extension Configuration](pages/extension-configuration.md) - Complete setup guide
- [Get Session Id for Active User](pages/get-session-id-for-active-user.md) - Retrieve session information
- [Testing the Chatbot](pages/testing-chatbot.md) - Test authentication flow

