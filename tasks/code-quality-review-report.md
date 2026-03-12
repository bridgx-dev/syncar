# Code Quality Review Report: packages/server

**Date:** 2026-03-12
**Review Method:** Systematic code quality review with 6 dimensions
**Reviewers:** Claude Code (automated subagent analysis)

---

## Executive Summary

| Dimension | Overall Score | Status |
|-----------|---------------|--------|
| **Core Types & Utilities** | 4.6/5 | ✅ Excellent |
| **WebSocket Implementation** | 3.2/5 | ⚠️ Needs Attention |
| **Middleware Security** | 3.2/5 | ⚠️ Security Concerns |
| **Handlers & Channel** | 4.4/5 | ✅ Good |
| **Test Coverage** | 4.0/5 | ✅ Good |

**Overall Quality: 3.9/5** - Solid foundation with critical security issues to address.

### Files Reviewed
- `src/types.ts`, `src/errors.ts`, `src/utils.ts`, `src/context.ts`, `src/config.ts`
- `src/websocket.ts`, `src/server.ts`, `src/compose.ts`
- `src/middleware/*.ts` (5 files)
- `src/channel.ts`, `src/handlers/*.ts` (4 files)
- `__tests__/*.test.ts` (13 test files)

---

## 🔴 Critical Issues (Must Fix)

### 1. Rate Limiting Race Condition (TOCTOU Vulnerability)
**File:** `src/middleware/rate-limit.ts:90-107`
**Priority:** CRITICAL
**Type:** Security

**Issue:**
```typescript
// Current code has race condition
const state = this.store.get(id);
if (!state || Date.now() > state.reset) {
    // Gap between check and update - vulnerable to TOCTOU
}
```

The state retrieval and update are not atomic. An attacker can send multiple requests simultaneously between the check and update, bypassing rate limits.

**Impact:**
- Rate limits can be bypassed through timing attacks
- DoS attacks possible despite rate limiting

**Fix:**
- Use atomic operations or proper locking mechanisms
- Consider using a library designed for atomic rate limiting
- Implement compare-and-swap pattern for state updates

---

### 2. Memory Exhaustion DoS Vulnerability
**File:** `src/middleware/rate-limit.ts:44`
**Priority:** CRITICAL
**Type:** Security

**Issue:**
```typescript
private store = new Map<string, RateLimitState>();
// Unbounded growth - no size limit
```

The Map grows without bound as new unique IDs are encountered. An attacker can send requests with unique identifiers to exhaust server memory.

**Impact:**
- Server memory exhaustion
- Service disruption

**Fix:**
- Implement maximum entry limit with LRU eviction
- Add aggressive cleanup for expired entries
- Consider using Redis or similar for distributed rate limiting

---

### 3. Type Assertion Bypasses Validation
**File:** `src/middleware/authenticate.ts:42-45, 65`
**Priority:** CRITICAL
**Type:** Security / Correctness

**Issue:**
```typescript
// Line 42-45: Type casting without validation
const client = clientOrId as Client;

// Line 65: Non-null assertion after check
if (!token) return reject("No token provided");
const tokenValue = token!; // Why use ! if we just checked?
```

Type assertion bypasses TypeScript's safety checks. The non-null assertion is redundant after the null check.

**Impact:**
- Potential injection attacks if clientOrId is malformed
- Loss of type safety guarantees

**Fix:**
- Properly validate and narrow types before casting
- Remove redundant non-null assertion
- Use proper type guards

---

### 4. Async Server Creation Returns Synchronously
**File:** `src/server.ts:514-518`
**Priority:** CRITICAL
**Type:** Correctness

**Issue:**
```typescript
export function createSyncarServer(options: ServerOptions = {}): SyncarServer {
    // ...
    if (options.httpServer) {
        // async operation but function returns immediately
        httpServer.listen(options.port ?? DEFAULT_PORT);
    }
    return server;
}
```

The `httpServer.listen()` is asynchronous but the function returns immediately. The WebSocket transport attaches before the HTTP server is ready.

**Impact:**
- Race condition during server startup
- WebSocket connections may fail during initialization
- Unpredictable behavior

**Fix:**
- Make `createSyncarServer` async
- Await server.listen() before returning
- Or return a Promise that resolves when ready

---

### 5. No Graceful Shutdown Implementation
**File:** `src/server.ts`
**Priority:** CRITICAL
**Type:** Resource Management

**Issue:**
```typescript
stop(): void {
    this.state = ServerState.Stopped;
    this.handlers.clear();
    // Missing: close HTTP server
    // Missing: close WebSocket transport
    // Missing: cleanup event listeners
    // Missing: cleanup timers
}
```

The stop() method only clears handlers but doesn't properly clean up resources.

**Impact:**
- Memory leaks from event listeners
- Port remains bound after "stop"
- Timers continue running
- Connections not properly closed

**Fix:**
- Implement proper resource cleanup
- Close HTTP server and WebSocket transport
- Clear all event listeners and timers
- Wait for connections to drain gracefully

---

## 🟠 High Priority Issues

### 6. Client ID Collision Risk
**File:** `src/websocket.ts:185`
**Priority:** HIGH
**Type:** Correctness

**Issue:**
```typescript
private generateClientId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
```

No uniqueness check - timestamp + random could generate duplicate IDs, especially at high connection rates.

**Impact:**
- Client identity confusion
- Message routing errors
- Connection state corruption

**Fix:**
- Check existing registry for uniqueness
- Use proper UUID generation
- Or use incrementing counter with prefix

---

### 7. No Message Size Validation Before Parsing
**File:** `src/websocket.ts:219`
**Priority:** HIGH
**Type:** Security / DoS

**Issue:**
```typescript
handleMessage(data: string): void {
    const message = JSON.parse(data); // No size check!
    // ...
}
```

Despite `maxPayload` config, no validation before JSON.parse. Large payloads can cause memory exhaustion or parsing DoS.

**Impact:**
- Memory exhaustion from large messages
- CPU exhaustion from parsing huge JSON
- DoS vulnerability

**Fix:**
- Validate message size before parsing
- Enforce maxPayload limit
- Consider streaming JSON parser for large messages

---

### 8. Authentication Lacks Rate Limiting
**File:** `src/middleware/authenticate.ts`
**Priority:** HIGH
**Type:** Security

**Issue:**
No rate limiting on authentication attempts. Brute force attacks on tokens are possible.

**Impact:**
- Token brute force attacks
- Authentication system abuse

**Fix:**
- Add authentication-specific rate limiting
- Implement exponential backoff for failures
- Add account lockout after N failures

---

### 9. Authentication Error Message Leakage
**File:** `src/middleware/authenticate.ts:80`
**Priority:** HIGH
**Type:** Security

**Issue:**
```typescript
catch (error) {
    return reject(`Token verification failed: ${error}`);
}
```

Reveals specific error reasons which aids attackers in understanding the authentication system.

**Impact:**
- Information disclosure
- Aids authentication attacks

**Fix:**
- Return generic error messages
- Log detailed errors server-side only
- Use same message for all auth failures

---

### 10. Socket Send Error Handling Missing
**Files:** `src/handlers/messages.ts`, `src/handlers/signal.ts`
**Priority:** HIGH
**Type:** Error Handling

**Issue:**
```typescript
// messages.ts:59
this.dispatch(channel, message); // No error handling
socket.send(JSON.stringify(data)); // No try-catch

// signal.ts:136, 183
socket.send(JSON.stringify(signal)); // No error handling
```

Socket send operations can fail but errors aren't caught.

**Impact:**
- Unhandled promise rejections
- Silent message delivery failures
- No retry mechanism

**Fix:**
- Wrap socket.send in try-catch
- Implement error handling and logging
- Consider retry logic for transient failures

---

## 🟡 Medium Priority Issues

### 11. Test Implementation Coupling
**File:** `__tests__/websocket.test.ts:114-145`
**Priority:** MEDIUM
**Type:** Test Quality

**Issue:**
```typescript
test('should handle connection', () => {
    transport['connections'].set('client1', mockClient); // Breaks encapsulation
    // ...
});
```

Tests directly manipulate private `connections` Map instead of using public API.

**Impact:**
- Brittle tests that break on implementation changes
- Tests don't verify actual behavior
- False confidence in code quality

**Fix:**
- Use public API for testing
- Test observable behavior, not internal state
- Add integration tests with real WebSocket connections

---

### 12. Missing Integration Tests
**File:** Test suite
**Priority:** MEDIUM
**Type:** Test Coverage

**Issue:**
No end-to-end tests demonstrating:
- Complete server lifecycle with real WebSocket connections
- Memory leak verification
- Cleanup of event listeners and timers
- Real-world scenarios (malformed messages, network failures)

**Impact:**
- Integration bugs not caught
- Memory leaks undetected
- Reduced confidence in production behavior

**Fix:**
- Add integration test suite
- Test with real ws Server class
- Verify cleanup and memory management
- Test failure scenarios

---

### 13. Context Class Too Large (God Object Tendency)
**File:** `src/context.ts`
**Priority:** MEDIUM
**Type:** Design

**Issue:**
ContextManager has 14 methods handling:
- Context creation
- Middleware management
- Pipeline execution
- State management

**Impact:**
- Reduced maintainability
- Harder to test
- Violates single responsibility principle

**Fix:**
- Consider splitting into focused classes
- Separate middleware management from execution
- Use composition over large monolithic class

---

### 14. Log Injection Risk
**File:** `src/middleware/logger.ts:73, 79`
**Priority:** MEDIUM
**Type:** Security

**Issue:**
```typescript
// User-controlled data logged without sanitization
logger.log(`Message from ${client.id}: ${message}`); // message could contain newlines, etc.
```

User-controlled data is logged without sanitization, allowing log injection attacks.

**Impact:**
- Log file corruption
- Fake log entries
- Log forging attacks

**Fix:**
- Sanitize user input before logging
- Escape special characters
- Use structured logging (JSON format)

---

### 15. Ping Timer Memory Leak
**File:** `src/websocket.ts:256-258`
**Priority:** MEDIUM
**Type:** Resource Management

**Issue:**
```typescript
private startPingTimer(): void {
    this.pingTimer = setInterval(() => {
        // Timer created but never cleaned up in destructor
    }, this.pingInterval);
}
```

Ping timer created without cleanup mechanism in close/destroy methods.

**Impact:**
- Memory leak
- Timer continues running after connection closes
- Resource exhaustion over time

**Fix:**
- Clear timer in close/destroy methods
- Ensure all timers are cleaned up

---

## ⚪ Low Priority / Technical Debt

### 16. Unused Parameters
**Files:** Multiple
- `handlers/connections.ts:34` - `_reason` parameter ignored
- `handlers/signal.ts:189` - `_message` parameter unused
- Various `_` prefixed parameters

**Fix:** Remove unused parameters or use them meaningfully

---

### 17. Magic Numbers
**Files:** `utils.ts`, `websocket.ts`
- Substring indices: `(2, 11)`, `(2, 9)`
- Ready state values
- Timeout values

**Fix:** Extract to named constants

---

### 18. Silent Failures
**File:** `handlers/connections.ts:38-40`
```typescript
if (!client) return; // Silent failure - no logging
```

**Fix:** Add logging for debugging purposes

---

## Positive Patterns Detected

| Pattern | Location | Quality Assessment |
|---------|----------|-------------------|
| **Middleware/Onion Pattern** | `compose.ts`, handlers | ⭐⭐⭐⭐⭐ Excellent implementation |
| **Dependency Injection** | Handler classes | ⭐⭐⭐⭐ Good, promotes testability |
| **Registry Pattern** | Client/Channel registries | ⭐⭐⭐⭐ Good separation |
| **Type Safety** | `types.ts`, error classes | ⭐⭐⭐⭐⭐ Excellent TypeScript usage |
| **Documentation** | All files with JSDoc | ⭐⭐⭐⭐⭐ Comprehensive and practical |
| **Error Hierarchy** | Custom error classes | ⭐⭐⭐⭐⭐ Well-structured |
| **Observer Pattern** | Set-based handlers | ⭐⭐⭐⭐ Good implementation |

---

## Anti-Patterns Found

| Anti-Pattern | Files | Severity | Remediation |
|--------------|-------|----------|-------------|
| **God Object** | `websocket.ts`, `context.ts` | Medium | Extract Class |
| **Silent Failure** | `handlers/connections.ts`, `websocket.ts` | Medium | Add logging/error handling |
| **Magic Numbers** | `utils.ts`, `websocket.ts` | Low | Extract Constant |
| **Type Assertion** | `authenticate.ts`, `context.ts` | High | Use proper type guards |
| **Incomplete Abstraction** | `server.ts` | High | Complete abstraction or remove |

---

## Architecture Recommendations

### 1. Middleware Composition
- [ ] Add middleware order validation
- [ ] Define error propagation strategy
- [ ] Add middleware execution context isolation

### 2. Security Layers
- [ ] Add input sanitization layer
- [ ] Implement origin validation for WebSocket
- [ ] Add built-in rate limiting (not just middleware)

### 3. Resource Management
- [ ] Implement proper lifecycle management
- [ ] Add connection pool limits
- [ ] Implement graceful shutdown

### 4. Observability
- [ ] Add structured logging
- [ ] Add metrics collection
- [ ] Add distributed tracing

---

## Test Coverage Gaps

1. **Integration Tests**: No end-to-end tests
2. **Security Tests**: No authentication/rate limit attack tests
3. **Performance Tests**: No load or stress tests
4. **Memory Leak Tests**: No cleanup verification
5. **Failure Scenarios**: Limited error path testing

---

## Priority Matrix

| Issue | Priority | Effort | Impact | ROI |
|-------|----------|--------|--------|-----|
| Rate limit race condition | Critical | Medium | High | 🔴 High |
| Memory exhaustion DoS | Critical | Low | High | 🔴 High |
| Type assertion bypass | Critical | Low | High | 🔴 High |
| Async server creation | Critical | Medium | High | 🔴 High |
| Graceful shutdown | Critical | High | High | 🟠 Medium |
| Client ID collision | High | Low | Medium | 🟠 Medium |
| Message size validation | High | Low | High | 🔴 High |
| Auth rate limiting | High | Medium | Medium | 🟠 Medium |
| Socket error handling | High | Medium | Medium | 🟠 Medium |

---

## References

- Review methodology based on: [Code Quality Review Skill](/.claude/skills/code-quality-review/)
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- WebSocket Security: https://owasp.org/www-community/vulnerabilities/WebSocket_security
