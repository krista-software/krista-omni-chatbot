# Get Script Element

## Overview

Generates the complete HTML and JavaScript code required to embed the Krista Chatbot on your website. This catalog request returns a ready-to-use script element that includes stylesheet links, JavaScript files, and initialization code with proper configuration for your Krista instance.

## Request Details

- **Area**: Integration
- **Type**: QUERY_SYSTEM
- **Retry Support**: ❌ No (Query operations typically don't support retry)

## Input Parameters

This catalog request does not require any input parameters. It automatically generates the script based on the extension's configuration.

| Parameter Name | Type | Required | Description                  | Example |
|----------------|------|----------|------------------------------|---------|
| _(None)_       | -    | -        | No input parameters required | -       |

## Output Parameters

| Parameter Name | Type | Description                                             | Example            |
|----------------|------|---------------------------------------------------------|--------------------|
| Script Element | Text | Complete HTML/JavaScript code for embedding the chatbot | See examples below |

### Script Element Structure

The generated script includes:

1. **Stylesheet Link** - CSS file for chatbot styling
2. **JavaScript File** - Chatbot launcher script
3. **Initialization Code** - JavaScript to configure and initialize the chatbot
4. **Authentication Script** - Authentication extension script (if configured)
5. **Configuration Options** - Position, transition, host URL, and chat bubble settings

## Validation Rules

No validation rules apply as this request has no input parameters.

## Error Handling

### System Errors (SYSTEM_ERROR)

**Cause**: Failed to generate a script element  
**Error Message**: "Failed to generate script element"  
**Common Scenarios**:
- Routing information is unavailable
- Extension is not properly configured
- Authentication dependency error

**Resolution**:
1. Verify the chatbot extension is properly configured
2. Check routing ID is set correctly
3. Ensure authentication dependency is configured (if required)
4. Review system logs for detailed errors
5. Contact the system administrator if the issue persists

## Usage Examples

### Example 1: Basic Script Generation

**Input**:
```
(No input parameters required)
```

**Output**:
```html
<link rel="stylesheet" href="https://your-instance.krista.ai/chatbot/ui/launcher.css" />
<script src="https://your-instance.krista.ai/chatbot/ui/launcher.js"></script>
<script>
    let kristaChat = null;
    function createChatbotClient(data, ref) {
      const options = {
        position: 'bottomRight',
        transition: 'slideIn',
        host: "https://your-instance.krista.ai/chatbot/",
        chatBubble: {
          cssClass: 'bubble-btn',
          icon: `<svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M30 0C13.4315 0 0 13.4315 0 30C0 46.5685 13.4315 60 30 60C35.0129 60 39.7387 58.7705 43.8922 56.5965C44.3533 56.3552 44.8874 56.2858 45.3902 56.4205L55.7458 59.1953C57.2329 59.5938 58.5938 58.2329 58.1953 56.7458L55.563 46.9219C55.418 46.3809 55.5096 45.8058 55.7961 45.3245C58.4663 40.8394 60 35.5988 60 30C60 13.4315 46.5685 0 30 0Z" fill="#3F3920"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M26 34.0898V37C26 37.5523 26.4477 38 27 38H35.5858C35.851 38 36.1054 38.1054 36.2929 38.2929L38.4879 40.4879C38.6769 40.6769 39 40.543 39 40.2757V32C39 31.4477 38.5523 31 38 31V33C38 33.5523 37.5523 34 37 34H26.4142C26.2699 34 26.1288 34.0312 26 34.0898Z" fill="white"/>
              <path d="M21 23C21 22.4477 21.4477 22 22 22H35C35.5523 22 36 22.4477 36 23V31C36 31.5523 35.5523 32 35 32H24.4142C24.149 32 23.8946 32.1054 23.7071 32.2929L21.5121 34.4879C21.3231 34.6769 21 34.543 21 34.2757V23Z" fill="white"/>
            </svg >`
        }
      }
      kristaChat = new Chatbot(options);
      kristaChat.init(); 
    }
    $(document).ready(function () {
      const ref = {
        chatBubble: $('.chat-bubble')
      }
        createChatbotClient({}, ref);
    })
  </script>
```

**Result**: Complete script ready to embed on any webpage.

### Example 2: Script with Authentication

**Scenario**: Generate a script when Guest Authentication extension is configured as a dependency

**Input**:
```
(No input parameters required)
```

**Output**:
```html
<!-- Authentication Extension Script -->
<script src="https://your-instance.krista.ai/auth/script.js"></script>

<!-- Chatbot Scripts -->
<link rel="stylesheet" href="https://your-instance.krista.ai/chatbot/ui/launcher.css" />
<script src="https://your-instance.krista.ai/chatbot/ui/launcher.js"></script>
<script>
    let kristaChat = null;
    function createChatbotClient(data, ref) {
      const options = {
        position: 'bottomRight',
        transition: 'slideIn',
        host: "https://your-instance.krista.ai/chatbot/",
        chatBubble: {
          cssClass: 'bubble-btn',
          icon: `<svg>...</svg>`
        }
      }
      kristaChat = new Chatbot(options);
      kristaChat.init(); 
    }
    $(document).ready(function () {
      const ref = {
        chatBubble: $('.chat-bubble')
      }
        createChatbotClient({}, ref);
    })
  </script>
```

**Result**: Script includes authentication extension script element.

### Example 3: Embed on Website

**Scenario**: Copy a generated script and embed on your website

**Action**:
1. Run "Get Script Element" catalog request
2. Copy the output script
3. Paste into your website's HTML (before closing `</body>` tag)
4. Save and deploy your website

**Result**: Chatbot widget appears on your website.

## Business Rules

1. **Automatic URL Generation**: Script URLs are automatically generated based on the extension's routing configuration
2. **Authentication Integration**: If Guest Authentication extension is configured as a dependency, its script is included
3. **Default Configuration**: Script includes default chatbot configuration (position, transition, etc.)
4. **jQuery Dependency**: Script assumes jQuery is available on the page
5. **SVG Icon Included**: Default Krista chatbot icon is embedded in the script
6. **Ready-to-Use**: Script requires no modifications to work (but can be customized)

## Limitations

1. **jQuery Required**: The generated script requires jQuery to be loaded on the page
2. **Static Configuration**: Script uses default configuration; customization requires manual editing
3. **Single Instance**: Script is designed for a single chatbot instance per page
4. **No Context Data**: A generated script doesn't include context data passing (must be added manually)
5. **Fixed Icon**: Uses default Krista icon (can be customized in the Integration tab)

## Best Practices

### 1. Add jQuery Dependency
Ensure jQuery is loaded before the chatbot script:

```html
<!-- Load jQuery first -->
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>

<!-- Then load a chatbot script -->
<link rel="stylesheet" href="https://your-instance.krista.ai/chatbot/ui/launcher.css" />
<script src="https://your-instance.krista.ai/chatbot/ui/launcher.js"></script>
```

### 2. Place Script Before Closing Body Tag
Add the script just before the closing `</body>` tag:

```html
<html>
<head>
  <title>My Website</title>
</head>
<body>
  <!-- Your website content -->
  
  <!-- Chatbot script at the end -->
  <script>/* Generated chatbot script */</script>
</body>
</html>
```

### 3. Customize After Generation
Modify the generated script to add context data or custom configuration:

```javascript
const options = {
  position: 'bottomRight',
  transition: 'slideIn',
  host: "https://your-instance.krista.ai/chatbot/",
  metadata: {  // Add context data
    USER_ID: 12345,
    USER_NAME: "John Doe"
  },
  chatBubble: {
    cssClass: 'bubble-btn',
    icon: `<svg>...</svg>`
  }
}
```

### 4. Test on Staging First
Always test the embedded chatbot on a staging environment before production:

```
1. Get Script Element
2. Embed on staging website
3. Test all functionality
4. Verify appearance and behavior
5. Deploy to production
```

## Common Use Cases

### 1. Website Integration

```
Scenario: Add chatbot to company website
Action:
  1. Run "Get Script Element" catalog request
  2. Copy generated script
  3. Add to website template
  4. Deploy website
Result: Chatbot available on all website pages
```

### 2. Customer Portal Integration

```
Scenario: Embed chatbot in customer portal
Action:
  1. Get Script Element
  2. Customize with user context data
  3. Embed in portal pages
  4. Test with authenticated users
Result: Personalized chatbot in customer portal
```

### 3. E-Commerce Site

```
Scenario: Add chatbot to online store
Action:
  1. Get Script Element
  2. Add cart and product context data
  3. Embed on product and checkout pages
  4. Configure for shopping assistance
Result: Shopping assistant chatbot on e-commerce site
```

### 4. Support Portal

```
Scenario: Integrate chatbot in support portal
Action:
  1. Get Script Element
  2. Add support ticket context
  3. Embed on support pages
  4. Configure for support workflows
Result: Automated support chatbot in portal
```

## Related Catalog Requests

- [Get Session Id for Active User](pages/get-session-id-for-active-user.md) - Manage chatbot sessions
- [Get Last User Message](pages/get-last-user-message.md) - Retrieve user messages
- [Get Transcript of the Conversation](pages/get-transcript-of-the-conversation.md) - Export conversations

## Technical Implementation

### Area Class
- **Class**: `IntegrationArea`
- **Package**: `app.krista.extensions.essentials.collaboration.omnichatbot.catalog`
- **Method**: `getScriptElement()`

### Implementation Details

The catalog request performs the following operations:

1. **Check Authentication Dependency**: Checks if Guest Authentication extension is configured
2. **Get Authentication Script**: If authentication is configured, retrieves its script element
3. **Get Routing URL**: Retrieves the base URL for the chatbot extension
4. **Build Script**: Constructs the complete HTML/JavaScript script
5. **Include Stylesheet**: Adds a link to launcher.css
6. **Include JavaScript**: Adds script tag for launcher.js
7. **Add Initialization**: Includes JavaScript initialization code
8. **Return Script**: Returns complete script as text

### Script Components

The generated script includes:

- **Stylesheet Link**: `<link rel="stylesheet" href="{basePath}/ui/launcher.css" />`
- **JavaScript File**: `<script src="{basePath}/ui/launcher.js"></script>`
- **Initialization Function**: `createChatbotClient(data, ref)`
- **Options Object**: Configuration for position, transition, host, chatBubble
- **jQuery Ready Handler**: `$(document).ready(function () { ... })`

### Dependencies

- `Invoker` (self) - For accessing extension bindings and routing information
- `Invoker` (Authentication) - For retrieving authentication script (if configured)
- `RoutingInfo` - For generating proper URLs

## Troubleshooting

### Script URLs Not Working

**Cause**: Incorrect routing configuration or URL  
**Solution**:
1. Verify extension routing ID is configured
2. Check access point is properly set
3. Ensure URLs are accessible from your website
4. Test URLs directly in the browser

### Chatbot Doesn't Load on Website

**Cause**: jQuery not loaded or script placement issue  
**Solution**:
1. Ensure jQuery is loaded before a chatbot script
2. Check the browser console for JavaScript errors
3. Verify a script is placed before closing `</body>` tag
4. Test on a simple HTML page first

### Authentication Script is Not Included

**Cause**: Authentication dependency not configured  
**Solution**:
1. Verify Guest Authentication is set in Dependencies
2. Check authentication extension is properly configured
3. Regenerate script after configuring dependency
4. Review extension configuration

## See Also

- [Extension Configuration](pages/extension-configuration.md) - Configure the chatbot extension
- [Context Data Passing](pages/context-data-passing.md) - Add context data to the script
- [Testing the Chatbot](pages/testing-chatbot.md) - Test the embedded chatbot
- [Authentication](pages/authentication.md) - Authentication configuration

