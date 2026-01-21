# Launcher Version Synchronization

## Overview
The `launcher-core` file version is synchronized between the build script and the Java backend using the `LAUNCHER_VERSION` environment variable.

**Important:** Only `launcher-core-*.js` filename changes with version. The `launcher-v1.js` is the **entry point** embedded in HTML and remains constant.

---

## Architecture

### Entry Point (Fixed)
```html
<!-- This filename stays constant - it's the entry point -->
<script src="https://extension.qa-in.eng.krista.app/.../chatbot/ui/launcher-v1.js"></script>
```

### Dynamic Core (Version-based)
```javascript
// launcher-v1.js fetches the versioned core file
const response = await fetch('__chatbotBasePath__chatbot/launcher');
const filename = await response.text(); // Returns: "launcher-core-v2.js"
```

---

## How It Works

### 1. Environment Variable
```bash
LAUNCHER_VERSION=v1  # Default value
```

### 2. Build Script (`build-launcher.sh`)
Generates versioned files:

```bash
LAUNCHER_VERSION=${LAUNCHER_VERSION:-v1}

# Compile TypeScript files
tsc bootstrap/launcher-core.ts --outfile bootstrap/launcher-core-${LAUNCHER_VERSION}.js
tsc bootstrap/launcher.ts --outfile bootstrap/launcher-${LAUNCHER_VERSION}.js

# Minify
minify bootstrap/launcher-core-${LAUNCHER_VERSION}.js > dist/launcher-core-${LAUNCHER_VERSION}.js
minify bootstrap/launcher-${LAUNCHER_VERSION}.js > dist/launcher-${LAUNCHER_VERSION}.js
```

**Output:**
- `dist/launcher-core-v1.js` ← **Version changes**
- `dist/launcher-v1.js` ← Entry point (constant)
- `dist/launcher.css`

### 3. Java Backend (`Constants.java`)
Reads the same environment variable:

```java
// Only launcher-core filename changes, launcher.js is the entry point and stays constant
public static final String LAUNCHER_VERSION = System.getenv().getOrDefault("LAUNCHER_VERSION", "v1");
public static final String LAUNCHER_CORE_FILENAME = "launcher-core-" + LAUNCHER_VERSION + ".js";
```

**Result:**
- `Constants.LAUNCHER_CORE_FILENAME` = `"launcher-core-v1.js"` (dynamic)

### 4. API Endpoint (`ChatBotResource.java`)
Returns the versioned core filename:

```java
@GET
@Path("/launcher")
@Produces(MediaType.TEXT_PLAIN)
public Response getCoreLauncherJs() {
    return Response.ok(Constants.LAUNCHER_CORE_FILENAME)  // "launcher-core-v1.js"
            .header("Access-Control-Allow-Origin", "*")
            .header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            .build();
}
```

### 5. File Serving (`ChatBotUIService.java`)
Handles the versioned core file:

```java
else if (subPath.endsWith("index.html") ||
        subPath.endsWith(Constants.LAUNCHER_CORE_FILENAME)) {
    content = content.replace("__chatbotBasePath__", getBaseURIHashCode(uriPath));
}
```

---

## Usage

### Default Version (v1)

**Build:**
```bash
npm run build-launcher
```

**Run:**
```bash
./gradlew bootRun
```

**Result:**
- Build generates: `launcher-core-v1.js`, `launcher-v1.js`
- API returns: `"launcher-core-v1.js"`
- Entry point: `launcher-v1.js` (constant)

---

### Custom Version (v2)

**Build:**
```bash
LAUNCHER_VERSION=v2 npm run build-launcher
```

**Run:**
```bash
LAUNCHER_VERSION=v2 ./gradlew bootRun
```

**Result:**
- Build generates: `launcher-core-v2.js`, `launcher-v2.js`
- API returns: `"launcher-core-v2.js"`
- Entry point: `launcher-v1.js` (still constant)

**Note:** The entry point `launcher-v1.js` doesn't change because it's embedded in HTML. Only the core file it loads changes.

---

## Request Flow

```
1. HTML loads entry point (constant):
   <script src=".../launcher-v1.js"></script>

2. launcher-v1.js calls API:
   GET /chatbot/launcher
   Response: "launcher-core-v2.js"

3. launcher-v1.js fetches core:
   GET /chatbot/ui/launcher-core-v2.js
   Response: [JavaScript code]

4. launcher-v1.js injects and executes core:
   const scriptElement = document.createElement('script');
   scriptElement.textContent = scriptContent;
   document.body.appendChild(scriptElement);
```

---

## Version Management

### Changing Versions

1. **Update environment variable:**
   ```bash
   export LAUNCHER_VERSION=v2
   ```

2. **Rebuild the launcher:**
   ```bash
   npm run build-launcher
   ```

3. **Restart Java application:**
   ```bash
   ./gradlew bootRun
   ```

4. **Verify:**
   ```bash
   curl http://localhost:8080/chatbot/launcher
   # Should return: launcher-core-v2.js
   ```

### Version Naming

You can use any version string:
- `v1`, `v2`, `v3` - Simple versions
- `2024-11`, `2024-12` - Date-based
- `1.0.0`, `1.1.0` - Semantic versioning
- `beta`, `stable` - Environment-based

**Example:**
```bash
LAUNCHER_VERSION=2024-11-prod npm run build-launcher
```
Generates: `launcher-core-2024-11-prod.js`

---

## Benefits

### ✅ Hot Swapping
- Change `LAUNCHER_VERSION` without updating HTML
- Entry point stays constant: `launcher-v1.js`
- Core file changes dynamically: `launcher-core-v2.js`

### ✅ Easy Rollback
- Keep multiple versions: `launcher-core-v1.js`, `launcher-core-v2.js`
- Rollback by changing env var: `LAUNCHER_VERSION=v1`
- No HTML changes needed

### ✅ A/B Testing
- Deploy multiple versions simultaneously
- Switch between versions by changing env var
- Test new features without affecting all users

### ✅ Zero Downtime Updates
- Deploy new version: `launcher-core-v2.js`
- Keep old version: `launcher-core-v1.js`
- Switch when ready: `LAUNCHER_VERSION=v2`

---

## Deployment

### Development
```bash
export LAUNCHER_VERSION=dev
npm run build-launcher
./gradlew bootRun
```

### Production
```bash
export LAUNCHER_VERSION=v1
npm run build-launcher
./gradlew build
java -jar build/libs/omni-chatbot.jar
```

### Docker
```dockerfile
FROM openjdk:17
ENV LAUNCHER_VERSION=v1
COPY build/libs/omni-chatbot.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: omni-chatbot
spec:
  template:
    spec:
      containers:
      - name: omni-chatbot
        image: omni-chatbot:latest
        env:
        - name: LAUNCHER_VERSION
          value: "v1"
```

---

## Files Modified

1. **`Constants.java`**
   - Added `LAUNCHER_VERSION` constant (reads from env)
   - Added `LAUNCHER_CORE_FILENAME` constant (dynamic)

2. **`ChatBotResource.java`**
   - Updated `/launcher` endpoint to use `Constants.LAUNCHER_CORE_FILENAME`

3. **`ChatBotUIService.java`**
   - Updated file serving logic to use `Constants.LAUNCHER_CORE_FILENAME`

4. **`build-launcher.sh`**
   - Already uses `LAUNCHER_VERSION` environment variable

---

## Summary

**What Changes:**
- ✅ `launcher-core-v1.js` → `launcher-core-v2.js` (version-based)

**What Stays Constant:**
- ✅ `launcher-v1.js` (entry point in HTML)
- ✅ `launcher.css` (styles)

**Why This Design:**
- Entry point embedded in HTML can't change easily
- Core file loaded dynamically can change anytime
- Allows hot swapping without HTML updates
- Enables rollback and A/B testing

---

## Date
2025-11-13

