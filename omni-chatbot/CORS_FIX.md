# CORS Fix for Chatbot Launcher

## Problem
When the launcher script (`launcher-v1.js`) runs on a parent site (e.g., `w3schools.com`), it makes cross-origin requests to the Krista extension server (e.g., `extension.qa-in.eng.krista.app`). These requests were being blocked by the browser due to missing CORS headers.

## Error
```
Access to fetch at 'https://extension.qa-in.eng.krista.app/extension/api/xxx/chatbot/launcher' 
from origin 'https://www.w3schools.com' has been blocked by CORS policy
```

## Solution
Added CORS headers to all endpoints that the launcher script calls:

### 1. `/chatbot/launcher` Endpoint
**File:** `ChatBotResource.java`

Added:
- `@OPTIONS` handler for preflight requests
- CORS headers to the `@GET` response

```java
@OPTIONS
@Path("/launcher")
public Response getCoreLauncherJsOptions() {
    return Response.ok()
            .header("Access-Control-Allow-Origin", "*")
            .header("Access-Control-Allow-Methods", "GET, OPTIONS")
            .header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            .build();
}

@GET
@Path("/launcher")
@Produces(MediaType.TEXT_PLAIN)
public Response getCoreLauncherJs() {
    return Response.ok("launcher-core-v1.js")
            .header("Access-Control-Allow-Origin", "*")
            .header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            .build();
}
```

### 2. `/chatbot/ui/{subpath}` Endpoint
**File:** `ChatBotResource.java`

Added `@OPTIONS` handler for preflight requests:

```java
@OPTIONS
@Path("/ui/{subpath: .*}")
public Response getUIAssetsOptions() {
    return Response.ok()
            .header("Access-Control-Allow-Origin", "*")
            .header("Access-Control-Allow-Methods", "GET, OPTIONS")
            .header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Krista-Original-URI")
            .build();
}
```

### 3. UI Assets Response
**File:** `ChatBotUIService.java`

Added CORS headers to all UI asset responses:

```java
return Response.ok(content)
        .header("Content-type", mimeType)
        .header("Cache-Control", cacheControl)
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        .build();
```

## CORS Headers Explained

### `Access-Control-Allow-Origin: *`
Allows requests from any origin. This is necessary because the launcher script can be embedded on any parent site.

### `Access-Control-Allow-Methods: GET, OPTIONS`
Specifies which HTTP methods are allowed for cross-origin requests.

### `Access-Control-Allow-Headers: Content-Type, Authorization, X-Krista-Original-URI`
Specifies which headers can be sent in the cross-origin request. Includes:
- `Content-Type` - for JSON responses
- `Authorization` - for authenticated requests
- `X-Krista-Original-URI` - custom header used by the application

## Request Flow

1. **Parent site loads launcher script:**
   ```html
   <script src="https://extension.qa-in.eng.krista.app/extension/api/xxx/chatbot/ui/launcher-v1.js"></script>
   ```

2. **Launcher script makes API call to get filename:**
   ```javascript
   const response = await fetch('https://extension.qa-in.eng.krista.app/extension/api/xxx/chatbot/launcher');
   const filename = await response.text(); // Returns: "launcher-core-v1.js"
   ```
   - Browser sends OPTIONS preflight request
   - Server responds with CORS headers
   - Browser allows the actual GET request
   - Server returns plain text filename

3. **Launcher fetches the chatbot script:**
   ```javascript
   const scriptResponse = await fetch('https://extension.qa-in.eng.krista.app/extension/api/xxx/chatbot/ui/launcher-core-v1.js');
   const scriptContent = await scriptResponse.text();
   ```
   - Browser sends OPTIONS preflight request
   - Server responds with CORS headers
   - Browser allows the actual GET request
   - Server returns the JavaScript code

4. **Launcher injects the chatbot into the host page:**
   ```javascript
   const scriptElement = document.createElement('script');
   scriptElement.textContent = scriptContent;
   document.body.appendChild(scriptElement);
   ```
   - Chatbot launcher code is now executed on the host page
   - Chatbot UI appears on the parent site

## Testing

To test the CORS fix:

1. Deploy the updated code
2. Embed the launcher script on a test page with a different origin
3. Open browser DevTools Network tab
4. Verify that:
   - OPTIONS requests return 200 with CORS headers
   - GET requests return 200 with CORS headers
   - No CORS errors appear in the console

## Files Modified

1. `omni-chatbot/src/main/java/app/krista/extensions/essentials/collaboration/omnichatbot/resource/ChatBotResource.java`
   - Added OPTIONS handler for `/launcher`
   - Modified GET handler for `/launcher` to return Response with CORS headers
   - Added OPTIONS handler for `/ui/{subpath}`

2. `omni-chatbot/src/main/java/app/krista/extensions/essentials/collaboration/omnichatbot/service/ChatBotUIService.java`
   - Added CORS headers to all UI asset responses

## Security Considerations

Using `Access-Control-Allow-Origin: *` allows any website to make requests to your API. This is appropriate for:
- Public APIs
- Embedded widgets/launchers that can be used on any site

If you need to restrict access to specific domains, replace `*` with the allowed origin:
```java
.header("Access-Control-Allow-Origin", "https://trusted-domain.com")
```

Or implement dynamic origin validation:
```java
String origin = request.getHeader("Origin");
if (isAllowedOrigin(origin)) {
    .header("Access-Control-Allow-Origin", origin)
}
```

## Date
2025-11-12

