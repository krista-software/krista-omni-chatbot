# ChatBotUIService Test Results

## Summary
All tests passed successfully! ✅

**Total Tests:** 12  
**Passed:** 12 ✓  
**Failed:** 0 ✗  
**Success Rate:** 100%

---

## Test Categories

### 1. getHost() Method Tests (6 tests)

Tests the extraction of protocol and host from URLs.

| Test Case | Input | Expected Output | Status |
|-----------|-------|-----------------|--------|
| Standard HTTPS URL | `https://extension.qa-in.eng.krista.app/extension/api/sYB0OLxfjv8pkaWe_sjO9Yg_e_e/chatbot/ui/launcher-v1.js` | `https://extension.qa-in.eng.krista.app` | ✓ PASS |
| HTTP with port | `http://localhost:8080/extension/api/test/chatbot/ui/launcher-v1.js` | `http://localhost:8080` | ✓ PASS |
| HTTPS with non-standard port | `https://extension.qa-in.eng.krista.app:8443/extension/api/test/chatbot/ui/launcher-v1.js` | `https://extension.qa-in.eng.krista.app:8443` | ✓ PASS |
| HTTPS with standard port 443 | `https://extension.qa-in.eng.krista.app:443/extension/api/test/chatbot/ui/launcher-v1.js` | `https://extension.qa-in.eng.krista.app` | ✓ PASS |
| HTTP with standard port 80 | `http://extension.qa-in.eng.krista.app:80/extension/api/test/chatbot/ui/launcher-v1.js` | `http://extension.qa-in.eng.krista.app` | ✓ PASS |
| URL with node prefix | `https://extension.aws-dev02.eng.krista.app/node1/extension/api/SLZN4qLgFCU9lbKYxEg3WQ_e_e/chatbot/ui/launcher-v1.js` | `https://extension.aws-dev02.eng.krista.app` | ✓ PASS |

### 2. getBaseURIHashCode() Method Tests (4 tests)

Tests the extraction of the base path before "chatbot" keyword.

| Test Case | Input | Expected Output | Status |
|-----------|-------|-----------------|--------|
| Standard URL with node prefix | `https://extension.aws-dev02.eng.krista.app/node1/extension/api/SLZN4qLgFCU9lbKYxEg3WQ_e_e/chatbot/ui/` | `/node1/extension/api/SLZN4qLgFCU9lbKYxEg3WQ_e_e/` | ✓ PASS |
| URL without node prefix | `https://extension.qa-in.eng.krista.app/extension/api/sYB0OLxfjv8pkaWe_sjO9Yg_e_e/chatbot/ui/launcher-v1.js` | `/extension/api/sYB0OLxfjv8pkaWe_sjO9Yg_e_e/` | ✓ PASS |
| URL with port | `https://extension.qa-in.eng.krista.app:8443/extension/api/test123/chatbot/ui/index.html` | `/extension/api/test123/` | ✓ PASS |
| Localhost URL | `http://localhost:8080/extension/api/test/chatbot/ui/` | `/extension/api/test/` | ✓ PASS |

### 3. Integration Tests (2 tests)

Tests the combination of both methods to construct the full base URL.

| Test Case | Input | Expected Output | Status |
|-----------|-------|-----------------|--------|
| Full base URL construction | `https://extension.qa-in.eng.krista.app/extension/api/sYB0OLxfjv8pkaWe_sjO9Yg_e_e/chatbot/ui/launcher-v1.js` | `https://extension.qa-in.eng.krista.app/extension/api/sYB0OLxfjv8pkaWe_sjO9Yg_e_e/` | ✓ PASS |
| Full base URL with node prefix | `https://extension.aws-dev02.eng.krista.app/node1/extension/api/SLZN4qLgFCU9lbKYxEg3WQ_e_e/chatbot/ui/` | `https://extension.aws-dev02.eng.krista.app/node1/extension/api/SLZN4qLgFCU9lbKYxEg3WQ_e_e/` | ✓ PASS |

---

## Bug Fixed

### Issue Found
In `ChatBotUIService.java` line 46, there was a bug where `getHost(uriPath)` was called twice:

```java
String baseUrl = getHost(uriPath) + getHost(uriPath);  // ❌ WRONG
```

This would result in incorrect URLs like:
```
https://extension.qa-in.eng.krista.apphttps://extension.qa-in.eng.krista.app
```

### Fix Applied
Changed line 46 to correctly combine host and base path:

```java
String baseUrl = getHost(uriPath) + getBaseURIHashCode(uriPath);  // ✅ CORRECT
```

This now correctly produces:
```
https://extension.qa-in.eng.krista.app/extension/api/sYB0OLxfjv8pkaWe_sjO9Yg_e_e/
```

Also improved the logging statement on line 47:
```java
LOGGER.info("baseUrl: {}", baseUrl);  // ✅ Proper SLF4J parameterized logging
```

---

## How to Run Tests

To run the tests manually:

```bash
cd omni-chatbot
javac src/test/java/app/krista/extensions/essentials/collaboration/omnichatbot/service/SimpleTest.java
java -cp src/test/java app.krista.extensions.essentials.collaboration.omnichatbot.service.SimpleTest
```

---

## Method Specifications

### getHost(String url)
**Purpose:** Extracts the protocol and host from a URL.

**Input:** Full URL string  
**Output:** Protocol + host (+ port if non-standard)

**Examples:**
- Input: `https://extension.qa-in.eng.krista.app/extension/api/test/chatbot/ui/launcher-v1.js`
- Output: `https://extension.qa-in.eng.krista.app`

### getBaseURIHashCode(String url)
**Purpose:** Extracts the path before the "chatbot" keyword.

**Input:** Full URL string  
**Output:** Path substring before "chatbot"

**Examples:**
- Input: `https://extension.qa-in.eng.krista.app/extension/api/test/chatbot/ui/launcher-v1.js`
- Output: `/extension/api/test/`

### Integration (getHost + getBaseURIHashCode)
**Purpose:** Constructs the complete base URL for API calls.

**Result:** `{protocol}://{host}{basePath}`

**Examples:**
- Input: `https://extension.qa-in.eng.krista.app/extension/api/test/chatbot/ui/launcher-v1.js`
- Output: `https://extension.qa-in.eng.krista.app/extension/api/test/`

---

## Date
2025-11-12

