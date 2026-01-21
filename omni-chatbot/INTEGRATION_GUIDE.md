# Chatbot Integration Guide

## Overview
This guide explains how to integrate the Krista Chatbot into any website using the launcher script.

---

## Integration Steps

### 1. Add CSS and JS to the `<head>` section

```html
<head>
  <!-- Chatbot CSS -->
  <link rel="stylesheet" href="https://extension.qa-in.eng.krista.app/extension/api/sYB0OLxfjv8pkaWe_sjO9Yg_e_e/chatbot/ui/launcher.css"/>
  
  <!-- Chatbot Launcher Script -->
  <script src="https://extension.qa-in.eng.krista.app/extension/api/sYB0OLxfjv8pkaWe_sjO9Yg_e_e/chatbot/ui/launcher-v1.js"></script>
</head>
```

### 2. (Optional) Configure Chatbot Options

If you need to pass custom options to the chatbot, define them **before** the launcher script loads:

```html
<head>
  <!-- Define chatbot options -->
  <script>
    window.kristaChatbotOptions = {
      theme: 'light',
      position: 'bottom-right',
      welcomeMessage: 'Hello! How can I help you today?',
      // Add any other options your Chatbot class accepts
    };
  </script>
  
  <!-- Chatbot CSS -->
  <link rel="stylesheet" href="https://extension.qa-in.eng.krista.app/extension/api/sYB0OLxfjv8pkaWe_sjO9Yg_e_e/chatbot/ui/launcher.css"/>
  
  <!-- Chatbot Launcher Script -->
  <script src="https://extension.qa-in.eng.krista.app/extension/api/sYB0OLxfjv8pkaWe_sjO9Yg_e_e/chatbot/ui/launcher-v1.js"></script>
</head>
```

### 3. Complete Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Website with Krista Chatbot</title>
  
  <!-- Optional: Define chatbot options -->
  <script>
    window.kristaChatbotOptions = {
      theme: 'light',
      position: 'bottom-right',
      welcomeMessage: 'Hello! How can I help you today?'
    };
  </script>
  
  <!-- Chatbot CSS -->
  <link rel="stylesheet" href="https://extension.qa-in.eng.krista.app/extension/api/sYB0OLxfjv8pkaWe_sjO9Yg_e_e/chatbot/ui/launcher.css"/>
  
  <!-- Chatbot Launcher Script -->
  <script src="https://extension.qa-in.eng.krista.app/extension/api/sYB0OLxfjv8pkaWe_sjO9Yg_e_e/chatbot/ui/launcher-v1.js"></script>
</head>
<body>
  <h1>Welcome to My Website</h1>
  <p>The chatbot will appear automatically!</p>
</body>
</html>
```

---

## How It Works

### Step-by-Step Process

1. **Browser loads `launcher-v1.js`**
   - Script executes automatically when loaded

2. **Launcher fetches the chatbot filename**
   ```javascript
   fetch('https://extension.qa-in.eng.krista.app/extension/api/xxx/chatbot/launcher')
   // Returns: "launcher-core-v1.js"
   ```

3. **Launcher fetches the chatbot script**
   ```javascript
   fetch('https://extension.qa-in.eng.krista.app/extension/api/xxx/chatbot/ui/launcher-core-v1.js')
   // Returns: The actual chatbot JavaScript code
   ```

4. **Launcher injects the script into the page**
   ```javascript
   const scriptElement = document.createElement('script');
   scriptElement.textContent = scriptContent;
   document.body.appendChild(scriptElement);
   ```

5. **Launcher waits for Chatbot class to be available**
   - Polls `window.Chatbot` every 50ms
   - Timeout after 5 seconds

6. **Launcher initializes the chatbot**
   ```javascript
   const kristaChatbot = new window.Chatbot(options);
   kristaChatbot.init();
   ```

7. **Chatbot appears on your website!** 🎉

---

## Technical Details

### CORS Support
The launcher script includes full CORS support, allowing it to work on any domain:
- ✅ Works on `w3schools.com`
- ✅ Works on `example.com`
- ✅ Works on any website

### API Endpoints Used

| Endpoint | Method | Returns | Purpose |
|----------|--------|---------|---------|
| `/chatbot/launcher` | GET | Plain text | Returns the filename of the chatbot script |
| `/chatbot/ui/{filename}` | GET | JavaScript | Returns the chatbot launcher code |

### Options Configuration

The launcher looks for options in `window.kristaChatbotOptions`. If not found, it uses an empty object `{}`.

**Example options structure:**
```javascript
window.kristaChatbotOptions = {
  theme: 'light' | 'dark',
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left',
  welcomeMessage: string,
  apiKey: string,
  userId: string,
  // ... any other options your Chatbot class accepts
};
```

---

## Debugging

### Console Messages

The launcher provides helpful console messages:

**Success messages:**
```
✓ Chatbot launcher script loaded successfully
✓ Chatbot initialized successfully
```

**Error messages:**
```
✗ Failed to load chatbot launcher: [error details]
✗ Chatbot class not found on window object
✗ Failed to initialize chatbot: [error details]
```

### Troubleshooting

#### Chatbot doesn't appear
1. Check browser console for errors
2. Verify the script URL is correct
3. Check if CORS errors appear (should be fixed now)
4. Verify `window.Chatbot` is available after script loads

#### Options not working
1. Ensure `window.kristaChatbotOptions` is defined **before** the launcher script
2. Check console for initialization errors
3. Verify your Chatbot class accepts the options you're passing

#### CORS errors
1. Verify the server has CORS headers enabled
2. Check that OPTIONS preflight requests return 200
3. Ensure `Access-Control-Allow-Origin: *` header is present

---

## Advanced Usage

### Programmatic Initialization

If you want to control when the chatbot initializes, you can prevent auto-initialization:

```html
<script>
  // Prevent auto-initialization
  window.kristaChatbotAutoInit = false;
  
  // Define options
  window.kristaChatbotOptions = {
    theme: 'dark'
  };
</script>

<script src="https://extension.qa-in.eng.krista.app/extension/api/xxx/chatbot/ui/launcher-v1.js"></script>

<script>
  // Initialize manually when ready
  document.addEventListener('DOMContentLoaded', function() {
    if (window.Chatbot) {
      const kristaChatbot = new window.Chatbot(window.kristaChatbotOptions);
      kristaChatbot.init();
    }
  });
</script>
```

### Multiple Chatbots

To have multiple chatbot instances (not recommended, but possible):

```javascript
const chatbot1 = new window.Chatbot({ position: 'bottom-right' });
chatbot1.init();

const chatbot2 = new window.Chatbot({ position: 'bottom-left' });
chatbot2.init();
```

---

## Security Considerations

### CORS Policy
The current implementation uses `Access-Control-Allow-Origin: *`, which allows any website to load the chatbot.

**To restrict to specific domains:**
1. Modify `ChatBotResource.java` and `ChatBotUIService.java`
2. Replace `"*"` with specific domain(s)
3. Or implement dynamic origin validation

### Content Security Policy (CSP)
If your website uses CSP, you may need to add:

```html
<meta http-equiv="Content-Security-Policy" 
      content="script-src 'self' https://extension.qa-in.eng.krista.app 'unsafe-inline'; 
               style-src 'self' https://extension.qa-in.eng.krista.app;">
```

---

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify all URLs are correct
3. Ensure CORS headers are properly configured
4. Contact your Krista administrator

---

## Version History

### v1 (Current)
- Initial release
- CORS support for cross-origin integration
- Automatic script loading and initialization
- Options configuration support
- Error handling and logging

---

## Date
2025-11-12

