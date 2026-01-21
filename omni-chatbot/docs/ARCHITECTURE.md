# Omni-Chatbot Extension - Architecture Document

**Version:** 2.0.17 | **Domain:** Collaboration | **Ecosystem:** Essentials

---

## Table of Contents
1. [High-Level Architecture](#1-high-level-architecture)
2. [5-Layer Architecture](#2-5-layer-architecture)
3. [Component Diagrams](#3-component-diagrams)
4. [Data Flow](#4-data-flow)
5. [Performance Characteristics](#5-performance-characteristics)
6. [Error Scenarios](#6-error-scenarios)
7. [Sequence Diagrams](#7-sequence-diagrams)

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OMNI-CHATBOT EXTENSION                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Browser   │    │  REST API   │    │  WebSocket  │    │   ActiveMQ  │  │
│  │   Widget    │◄──►│  Endpoints  │◄──►│   Handler   │◄──►│   Broker    │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                  │                  │                  │          │
│         ▼                  ▼                  ▼                  ▼          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        SERVICE LAYER                                 │   │
│  │  ChatBotApiService │ ChatBotUIService │ ChatBotMessageSender        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                  │                  │                  │          │
│         ▼                  ▼                  ▼                  ▼          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        STORAGE LAYER                                 │   │
│  │  SessionStore │ ConnectionStore │ WsConnectionStore │ KeyValueStore │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 5-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: EXTENSION LAYER                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ChatBotExtension.java                                                   │ │
│ │ • Lifecycle: validateAttributes(), onInvokerLoad/Unload/Removed()       │ │
│ │ • Configuration: Welcome Conversation, uiConfigJson, CORS, Fallback     │ │
│ │ • Dependencies: Authentication Extension                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 2: CATALOG LAYER                                                      │
│ ┌────────────────────────────────┐ ┌────────────────────────────────────┐  │
│ │ MediumArea.java                │ │ IntegrationArea.java               │  │
│ │ • Get Session Id (QUERY)       │ │ • Get Script Element (QUERY)       │  │
│ │ • Get Transcript (CHANGE)      │ │ • GetLastUserMessage (CHANGE)      │  │
│ │                                │ │ • Get Session Info by Email        │  │
│ └────────────────────────────────┘ └────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 3: SERVICE LAYER                                                      │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────────────┐ │
│ │ ChatBotApiService│ │ ChatBotUIService │ │ ChatBotMessageSender         │ │
│ │ • getOrCreate    │ │ • getResponse()  │ │ • sendMessages()             │ │
│ │   Session()      │ │ • Asset caching  │ │ • ActiveMQ integration       │ │
│ │ • getMessages()  │ │ • Path transform │ │ • WS notification delivery   │ │
│ │ • getConfig()    │ │                  │ │                              │ │
│ │ • submitAnswer() │ │                  │ │                              │ │
│ └──────────────────┘ └──────────────────┘ └──────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 4: RESOURCE LAYER                                                     │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────────────┐ │
│ │ ChatBotResource  │ │ ChatBotProtocol  │ │ CorsResponseFilter           │ │
│ │ REST Endpoints:  │ │ Handler          │ │ • Access-Control-Allow-*     │ │
│ │ • /session       │ │ • WsProtocol     │ │ • Origin: *                  │ │
│ │ • /config        │ │ • WsEventHandler │ │ • Methods: GET,POST,OPTIONS  │ │
│ │ • /messages      │ │   Registry       │ │                              │ │
│ │ • /sendTranscript│ │                  │ │                              │ │
│ └──────────────────┘ └──────────────────┘ └──────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 5: STORE/UTILITY LAYER                                                │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌───────────────┐ │
│ │ SessionStore   │ │ ConnectionStore│ │ WsConnection   │ │ TranscriptUtil│ │
│ │ (KeyValueStore)│ │ (KeyValueStore)│ │ Store (Memory) │ │ ActiveMQ P/C  │ │
│ └────────────────┘ └────────────────┘ └────────────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Diagrams

### 3.1 WebSocket Handler Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WEBSOCKET EVENT HANDLING                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐                                                    │
│  │ WsEventHandlerRegistry │◄─────────────────────────────────────────────┐  │
│  └──────────┬──────────┘                                                 │  │
│             │ getWsEventHandler(WsEvent)                                 │  │
│             ▼                                                            │  │
│  ┌──────────────────────────────────────────────────────────────────┐   │  │
│  │                    EVENT TYPE ROUTING                             │   │  │
│  ├──────────────────┬──────────────────┬──────────────────┬─────────┤   │  │
│  │ WsConnection     │ WsConnection     │ WsConnection     │ WsText  │   │  │
│  │ UpgradeRequest   │ Opened           │ Closed           │ Message │   │  │
│  └────────┬─────────┴────────┬─────────┴────────┬─────────┴────┬────┘   │  │
│           ▼                  ▼                  ▼              ▼        │  │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌─────────┐  │  │
│  │ WsConnection   │ │ WsConnection   │ │ WsConnection   │ │ WsRequest│  │  │
│  │ UpgradeRequest │ │ OpenedHandler  │ │ ClosedHandler  │ │ Handler │  │  │
│  │ Handler        │ │                │ │                │ │         │  │  │
│  └────────────────┘ └────────────────┘ └────────────────┘ └────┬────┘  │  │
│                                                                 │       │  │
│                                                                 ▼       │  │
│                                              ┌─────────────────────────┐│  │
│                                              │ WsPayloadHandlerRegistry││  │
│                                              ├─────────────────────────┤│  │
│                                              │ "welcome" → WsWelcome   ││  │
│                                              │            MessageHandler│  │
│                                              │ "Message" → WsMessage   ││  │
│                                              │             Handler     ││  │
│                                              │ "MessageAnswer" → Ws    ││  │
│                                              │   MessageAnswerHandler  ││  │
│                                              └─────────────────────────┘│  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Message Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MESSAGE FLOW ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INBOUND (User → Bot)                    OUTBOUND (Bot → User)              │
│  ═══════════════════                     ════════════════════               │
│                                                                             │
│  ┌─────────┐                             ┌─────────────────────┐            │
│  │ Browser │                             │ Conversation Engine │            │
│  └────┬────┘                             └──────────┬──────────┘            │
│       │ WebSocket                                   │                       │
│       ▼                                             ▼                       │
│  ┌─────────────────┐                     ┌─────────────────────┐            │
│  │ WsRequestHandler│                     │ InteractiveMessageOut│           │
│  └────────┬────────┘                     └──────────┬──────────┘            │
│           │                                         │                       │
│           ▼                                         ▼                       │
│  ┌─────────────────┐                     ┌─────────────────────┐            │
│  │ WsPayloadHandler│                     │ ChatBotMessageSender│            │
│  │ (Message/Answer)│                     └──────────┬──────────┘            │
│  └────────┬────────┘                                │                       │
│           │                                         ▼                       │
│           ▼                              ┌─────────────────────┐            │
│  ┌─────────────────┐                     │   ActiveMQProducer  │            │
│  │ MediumService   │                     │ Topic: websocket-   │            │
│  │ .receiveMessage │                     │ chatbot-messages    │            │
│  └────────┬────────┘                     └──────────┬──────────┘            │
│           │                                         │                       │
│           ▼                                         ▼                       │
│  ┌─────────────────┐                     ┌─────────────────────┐            │
│  │ InboxManager    │                     │ WsConnectionStore   │            │
│  │ (Store Message) │                     │ .sendTextMessage()  │            │
│  └─────────────────┘                     └─────────────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Flow

### 4.1 Session Creation Flow

```
┌────────┐     ┌──────────────┐     ┌─────────────────┐     ┌─────────────┐
│ Client │────►│ POST /session│────►│ ChatBotApi      │────►│ SessionStore│
│        │     │              │     │ Service         │     │             │
└────────┘     └──────────────┘     │ .getOrCreate    │     │ .put()      │
                                    │  Session()      │     │             │
     ◄──────────────────────────────┤                 │◄────┤             │
     sessionInboxId                 └─────────────────┘     └─────────────┘
```

### 4.2 WebSocket Connection Flow

```
┌────────┐  WS Upgrade   ┌──────────────┐  Authenticate  ┌─────────────────┐
│ Client │──────────────►│ ChatBot      │───────────────►│ Authentication  │
│        │               │ Authenticator│                │ Extension       │
└────────┘               └──────────────┘                └─────────────────┘
                                │                               │
                                │◄──────────────────────────────┘
                                │ accountId
                                ▼
                         ┌──────────────┐
                         │ WsConnection │
                         │ OpenedHandler│
                         └──────┬───────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
       ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐
       │ WsConnection│  │ Connection  │  │ Send Connection │
       │ Store.save()│  │ Store.put() │  │ Established     │
       └─────────────┘  └─────────────┘  └─────────────────┘
```

---

## 5. Performance Characteristics

### 5.1 Performance Metrics

| Component | Metric | Value | Notes |
|-----------|--------|-------|-------|
| WsConnectionStore | Capacity | 128 initial | ConcurrentHashMap |
| UI Asset Cache | TTL | 7 days | Except index.html, launcher.* |
| Message Page Size | Default | 20 | Configurable via query param |
| Transcript Limit | Max Messages | 100 | Per getTranscript() call |
| ActiveMQ Topics | Count | 2 | messages, state-notifications |

### 5.2 Performance Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PERFORMANCE OPTIMIZATION LAYERS                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ CACHING LAYER                                                        │   │
│  │ ┌───────────────────┐  ┌───────────────────┐  ┌──────────────────┐  │   │
│  │ │ UI_ASSET_CACHE_MAP│  │ WsConnectionStore │  │ SessionStore     │  │   │
│  │ │ (Static HashMap)  │  │ (ConcurrentHash)  │  │ (KeyValueStore)  │  │   │
│  │ │ TTL: 7 days       │  │ Capacity: 128     │  │ Persistent       │  │   │
│  │ └───────────────────┘  └───────────────────┘  └──────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ MESSAGING LAYER                                                      │   │
│  │ ┌───────────────────────────────────────────────────────────────┐   │   │
│  │ │ ActiveMQ (JMS)                                                 │   │   │
│  │ │ • Topic: websocket-chatbot-messages (broadcast)                │   │   │
│  │ │ • Topic: chatbot-message-state-notifications (state updates)   │   │   │
│  │ │ • Session: AUTO_ACKNOWLEDGE                                    │   │   │
│  │ └───────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ CONNECTION LAYER                                                     │   │
│  │ • WebSocket: Persistent, bidirectional                               │   │
│  │ • Auto-pong enabled for keep-alive                                   │   │
│  │ • Ping signal handling for connection health                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Static UI_ASSET_CACHE_MAP | Memory growth with unique paths | Restart clears cache |
| One WS per account per node | Multi-tab issues | Use same session |
| In-memory WsConnectionStore | Lost on restart | Re-establish connections |
| 100 message transcript limit | Large conversations truncated | Paginate if needed |
| Synchronous transcript HTTP | Blocks on slow callbacks | Async recommended |

---

## 6. Error Scenarios

### 6.1 Error Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ERROR HANDLING FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐                                                            │
│  │ Client      │                                                            │
│  │ Request     │                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    ERROR DETECTION POINTS                             │  │
│  ├──────────────┬──────────────┬──────────────┬──────────────┬─────────┤  │
│  │ Authentication│ Validation  │ Processing   │ External     │ Runtime │  │
│  │ Errors       │ Errors      │ Errors       │ Service Errors│ Errors  │  │
│  └──────┬───────┴──────┬──────┴──────┬───────┴──────┬───────┴────┬────┘  │
│         │              │             │              │            │        │
│         ▼              ▼             ▼              ▼            ▼        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐  │
│  │ 401/1008   │ │ 400 Bad    │ │ 500 Server │ │ JMS/HTTP   │ │ NPE/   │  │
│  │ Unauthorized│ │ Request    │ │ Error      │ │ Timeout    │ │ ISE    │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Error Scenarios Matrix

| Error Code | Scenario | Component | Cause | Recovery |
|------------|----------|-----------|-------|----------|
| **401** | Unauthorized | ChatBotAuthenticator | Invalid/missing session | Re-authenticate |
| **1008** | WS Auth Failed | WsConnectionOpenedHandler | No valid account | Reconnect with auth |
| **400** | Invalid JSON | ChatBotResource | Malformed request body | Fix JSON syntax |
| **400** | Missing Config | sendTranscript | No Dashboard Callback Url | Configure uiConfigJson |
| **404** | Asset Not Found | ChatBotUIService | Invalid UI path | Check asset exists |
| **JMSException** | MQ Failure | ActiveMQProducer | Broker unavailable | Check ActiveMQ |
| **IllegalStateException** | No Account | WsConnectionStore | Session expired | Create new session |
| **IllegalArgumentException** | Invalid Config | ChatBotExtension | Bad uiConfigJson | Fix JSON format |

### 6.3 Error Handling Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ERROR HANDLING BY LAYER                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 1: Extension                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ validateAttributes() → IllegalArgumentException                      │   │
│  │ • "Welcome Conversation does not exist"                              │   │
│  │ • "Invalid 'UI Config Json' format"                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  LAYER 2: Catalog                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Catalog Requests → ExtensionResponse.withError()                     │   │
│  │ • Transcript generation failures                                     │   │
│  │ • Session lookup failures                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  LAYER 3: Service                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ChatBotApiService → Logged + null/empty returns                      │   │
│  │ ChatBotMessageSender → JMSException handling                         │   │
│  │ TranscriptUtils → IllegalArgumentException for invalid input         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  LAYER 4: Resource                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ChatBotResource → Response.status(400/404).entity(message)           │   │
│  │ WebSocket → connection.close(1008, "User is not Authorised")         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  LAYER 5: Store                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ WsConnectionStore → IllegalStateException for null accountId         │   │
│  │ SessionStore → null returns for missing sessions                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Sequence Diagrams

### 7.1 Complete Chat Session Lifecycle

```
┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐
│ Browser│  │ REST API │  │ WebSocket│  │ Services │  │ ActiveMQ │  │ Inbox  │
└───┬────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘
    │            │             │             │             │            │
    │ POST /session            │             │             │            │
    │───────────►│             │             │             │            │
    │            │ getOrCreateSession()      │             │            │
    │            │────────────────────────►  │             │            │
    │            │             │             │ create inbox│            │
    │            │             │             │────────────────────────► │
    │            │◄────────────────────────  │             │            │
    │◄───────────│ sessionInboxId            │             │            │
    │            │             │             │             │            │
    │ WS Connect │             │             │             │            │
    │────────────────────────► │             │             │            │
    │            │             │ authenticate│             │            │
    │            │             │────────────►│             │            │
    │            │             │◄────────────│             │            │
    │            │             │ ConnectionEstablished     │            │
    │◄────────────────────────│             │             │            │
    │            │             │             │             │            │
    │ welcome payload          │             │             │            │
    │────────────────────────► │             │             │            │
    │            │             │ executeConversation()     │            │
    │            │             │────────────►│             │            │
    │            │             │             │ store msg   │            │
    │            │             │             │────────────────────────► │
    │            │             │             │             │            │
    │            │             │             │ sendMessages│            │
    │            │             │             │────────────►│            │
    │            │             │             │             │ broadcast  │
    │            │             │◄────────────────────────  │            │
    │◄────────────────────────│ NewMessages  │             │            │
    │            │             │             │             │            │
```

### 7.2 Transcript Generation Flow

```
┌────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────┐
│ Client │  │ REST API │  │TranscriptUtil│  │InboxMgr  │  │ Callback │
└───┬────┘  └────┬─────┘  └──────┬───────┘  └────┬─────┘  └────┬─────┘
    │            │               │               │              │
    │ POST /sendTranscript       │               │              │
    │ {inboxId}  │               │               │              │
    │───────────►│               │               │              │
    │            │ extractInboxIdValue()         │              │
    │            │──────────────►│               │              │
    │            │               │ getMessages() │              │
    │            │               │──────────────►│              │
    │            │               │◄──────────────│              │
    │            │               │ messages      │              │
    │            │               │               │              │
    │            │ createFormattedTranscript()   │              │
    │            │◄──────────────│               │              │
    │            │ transcript    │               │              │
    │            │               │               │              │
    │            │ sendPostRequest(callback, transcript)        │
    │            │─────────────────────────────────────────────►│
    │            │◄─────────────────────────────────────────────│
    │◄───────────│ 200 OK       │               │              │
    │            │               │               │              │
```

---

## 8. Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Java 21 | Core platform |
| DI Framework | HK2 3.0.3 | Dependency injection |
| REST | JAX-RS | HTTP endpoints |
| WebSocket | WsProtocol | Real-time messaging |
| Messaging | ActiveMQ (JMS 2.0) | Distributed notifications |
| Serialization | Gson | JSON processing |
| Build | Gradle + Node.js 22 | Build automation |
| UI | Vite + TypeScript | Frontend bundling |

---

## 9. Deployment Considerations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         LOAD BALANCER                                │   │
│  └───────────────────────────────┬─────────────────────────────────────┘   │
│                                  │                                          │
│         ┌────────────────────────┼────────────────────────┐                │
│         ▼                        ▼                        ▼                │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐        │
│  │   Node 1    │          │   Node 2    │          │   Node N    │        │
│  │ ┌─────────┐ │          │ ┌─────────┐ │          │ ┌─────────┐ │        │
│  │ │Extension│ │          │ │Extension│ │          │ │Extension│ │        │
│  │ │Instance │ │          │ │Instance │ │          │ │Instance │ │        │
│  │ └─────────┘ │          │ └─────────┘ │          │ └─────────┘ │        │
│  │ ┌─────────┐ │          │ ┌─────────┐ │          │ ┌─────────┐ │        │
│  │ │WsConn   │ │          │ │WsConn   │ │          │ │WsConn   │ │        │
│  │ │Store    │ │          │ │Store    │ │          │ │Store    │ │        │
│  │ │(Local)  │ │          │ │(Local)  │ │          │ │(Local)  │ │        │
│  │ └─────────┘ │          │ └─────────┘ │          │ └─────────┘ │        │
│  └──────┬──────┘          └──────┬──────┘          └──────┬──────┘        │
│         │                        │                        │                │
│         └────────────────────────┼────────────────────────┘                │
│                                  ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         ACTIVEMQ BROKER                              │   │
│  │  Topic: websocket-chatbot-messages (cross-node broadcast)            │   │
│  │  Topic: chatbot-message-state-notifications                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                  │                                          │
│                                  ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      SHARED KEY-VALUE STORE                          │   │
│  │                    (SessionStore, ConnectionStore)                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*Document generated for Omni-Chatbot Extension v2.0.17*

