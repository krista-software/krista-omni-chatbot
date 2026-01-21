# ChatBotUIService Test Architecture

## How the Tests Work

### Test Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Test Execution Flow                       │
└─────────────────────────────────────────────────────────────┘

1. @BeforeEach: setUp()
   ├── Create new ChatBotUIService instance
   └── Clear static cache (via reflection)

2. Execute Test
   ├── Call service.getResponse(uriPath, subPath)
   │   ├── Service normalizes subPath
   │   ├── Determines cache control headers
   │   ├── Loads resource from /ui/ directory
   │   ├── Applies content replacements
   │   └── Caches the result
   │
   └── Assert expected behavior
       ├── Status code (200 or 404)
       ├── Response headers
       ├── Content replacements
       └── Cache state

3. @AfterEach: tearDown()
   └── Clear static cache (via reflection)
```

## Test Resource Loading

```
Test Resources Location:
src/test/resources/ui/
├── index.html          ← Contains __chatbotBasePath__ and /assets/
├── launcher.js         ← Contains __chatbotBasePath__
├── app.js              ← Contains /assets/ references
├── style.css           ← No replacements needed
└── logo.png            ← Binary asset

Service Loading:
getClass().getResourceAsStream("/ui/" + subPath)
                                  ↓
                    Loads from test classpath
                                  ↓
                    Returns InputStream with content
```

## Content Replacement Flow

```
┌──────────────────────────────────────────────────────────────┐
│              Content Replacement Logic                        │
└──────────────────────────────────────────────────────────────┘

Input: subPath = "index.html"
       uriPath = "https://...api/ID123/chatbot/ui/"

Step 1: Load Content
   Original: <script>const base = '__chatbotBasePath__';</script>
             <link href="/assets/style.css">

Step 2: Base Path Replacement (if index.html or launcher.js)
   getBaseURIHashCode(uriPath) → "/...api/ID123/"
   Replace: __chatbotBasePath__ → /...api/ID123/

Step 3: Assets Path Replacement (if .html or .js)
   Replace: /assets/ → chatbot/ui/assets/

Step 4: Cache Result
   UI_ASSET_CACHE_MAP.put("index.html", processedContent)

Final: <script>const base = '/...api/ID123/';</script>
       <link href="chatbot/ui/assets/style.css">
```

## Cache Behavior Testing

```
┌──────────────────────────────────────────────────────────────┐
│                    Cache Testing Flow                         │
└──────────────────────────────────────────────────────────────┘

Test: testContentCaching()

1. Initial State
   UI_ASSET_CACHE_MAP = {}  (empty)

2. First Request
   service.getResponse(uri, "app.js")
   ├── Cache miss
   ├── Load from resources
   ├── Apply replacements
   └── Store in cache
   
   UI_ASSET_CACHE_MAP = {"app.js": "processed content"}

3. Second Request
   service.getResponse(uri, "app.js")
   ├── Cache hit!
   └── Return cached content
   
   UI_ASSET_CACHE_MAP = {"app.js": "processed content"}

4. Verify
   ✓ Both requests return same content
   ✓ Replacements applied only once
   ✓ Cache contains expected entry
```

## Reflection-Based Testing

```
┌──────────────────────────────────────────────────────────────┐
│              Testing Private Methods & Fields                 │
└──────────────────────────────────────────────────────────────┘

Access Static Cache:
   Field cacheField = ChatBotUIService.class
                      .getDeclaredField("UI_ASSET_CACHE_MAP");
   cacheField.setAccessible(true);
   Map<String, String> cache = (Map) cacheField.get(null);

Access Private Method:
   Method method = ChatBotUIService.class
                   .getDeclaredMethod("getBaseURIHashCode", String.class);
   method.setAccessible(true);
   String result = (String) method.invoke(service, url);

Benefits:
   ✓ Test internal logic without exposing it
   ✓ Verify cache state between tests
   ✓ Clear cache for test isolation
```

## Test Isolation Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                    Test Isolation                             │
└──────────────────────────────────────────────────────────────┘

Problem: Static cache persists across tests
Solution: Clear cache before and after each test

@BeforeEach
void setUp() {
    service = new ChatBotUIService();
    clearCache();  ← Ensures clean state
}

@AfterEach
void tearDown() {
    clearCache();  ← Cleanup after test
}

Result:
   ✓ Each test starts with empty cache
   ✓ Tests don't affect each other
   ✓ Predictable, repeatable results
```

## Parameterized Testing

```
┌──────────────────────────────────────────────────────────────┐
│              Parameterized Test Examples                      │
└──────────────────────────────────────────────────────────────┘

@ParameterizedTest
@ValueSource(strings = {"index.html", "app.js", "style.css"})
void testNoCacheForDynamicFiles(String fileName) {
    // Test runs 3 times with different inputs
    Response response = service.getResponse(TEST_URI, fileName);
    assertThat(response.getHeaderString("Cache-Control"))
        .isEqualTo("no-cache, no-store, must-revalidate");
}

@ParameterizedTest
@CsvSource({
    "https://host.com/api/ID/chatbot/ui/, /api/ID/",
    "http://localhost:8080/chatbot/ui/, /"
})
void testVariousUrlFormats(String url, String expectedBasePath) {
    String basePath = invokeGetBaseURIHashCode(url);
    assertThat(basePath).isEqualTo(expectedBasePath);
}

Benefits:
   ✓ Reduces code duplication
   ✓ Tests multiple scenarios easily
   ✓ Clear input-output relationships
```

## Test Coverage Matrix

```
┌────────────────────────────────────────────────────────────────────┐
│                    Coverage Matrix                                  │
├────────────────┬───────────────┬──────────────┬───────────────────┤
│ Feature        │ Unit Tests    │ Integration  │ Edge Cases        │
├────────────────┼───────────────┼──────────────┼───────────────────┤
│ File Loading   │ ✓ 404 errors  │ ✓ Real files │ ✓ Unicode names   │
│                │ ✓ Path norm   │ ✓ All types  │ ✓ Long names      │
│                │               │              │ ✓ Special chars   │
├────────────────┼───────────────┼──────────────┼───────────────────┤
│ Cache Headers  │ ✓ Logic tests │ ✓ Real resp  │ ✓ Unknown types   │
│                │               │ ✓ All types  │                   │
├────────────────┼───────────────┼──────────────┼───────────────────┤
│ Content        │ ✓ Pattern ID  │ ✓ Real repl  │ ✓ Multiple occur  │
│ Replacement    │               │ ✓ Verify out │ ✓ Edge patterns   │
├────────────────┼───────────────┼──────────────┼───────────────────┤
│ URL Parsing    │ ✓ All formats │ ✓ Real URLs  │ ✓ Malformed       │
│                │ ✓ Edge cases  │              │ ✓ Null/empty      │
├────────────────┼───────────────┼──────────────┼───────────────────┤
│ Caching        │ ✓ Cache logic │ ✓ Real cache │ ✓ Concurrent      │
│                │ ✓ Static test │ ✓ Multi-file │ ✓ Large files     │
└────────────────┴───────────────┴──────────────┴───────────────────┘
```

## Key Testing Principles Applied

1. **Arrange-Act-Assert Pattern**
   - Clear separation of test phases
   - Easy to understand test intent

2. **Test Isolation**
   - Each test is independent
   - No shared state between tests

3. **Real Resource Testing**
   - Tests use actual files
   - Verifies real behavior, not mocks

4. **Comprehensive Coverage**
   - Happy paths
   - Error scenarios
   - Edge cases

5. **Descriptive Naming**
   - @DisplayName for clarity
   - Test names describe behavior

6. **Reflection for Internals**
   - Test private methods
   - Verify internal state
   - Maintain encapsulation

## Running Specific Test Groups

```bash
# Run all tests
./gradlew test --tests ChatBotUIServiceTest

# Run specific nested class
./gradlew test --tests "*ChatBotUIServiceTest\$FileTypeHandlingTests"
./gradlew test --tests "*ChatBotUIServiceTest\$ContentReplacementTests"
./gradlew test --tests "*ChatBotUIServiceTest\$IntegrationTests"

# Run specific test method
./gradlew test --tests "*ChatBotUIServiceTest.testNonExistentFile"
```

