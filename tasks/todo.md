# Code Quality Improvement Tasks

**Created:** 2026-03-12
**Based on:** Code Quality Review Report

---

## Legend

- 🔴 = Critical (Must Fix)
- 🟠 = High Priority (Should Fix)
- 🟡 = Medium Priority (Consider Fixing)
- ⚪ = Low Priority (Technical Debt)
- ✅ = Completed
- 🔄 = In Progress
- ⏸️ = Blocked

---

## Phase 1: Critical Security Fixes 🔴

### Fix 1: Rate Limiting Race Condition ✅
- [x] Add atomic operations to rate-limit state updates
  - [x] Implement compare-and-swap pattern using Promise-based per-ID locks
  - [x] Add unit tests for concurrent access
  - [x] Verify TOCTOU vulnerability is fixed
- [x] Add integration test for race condition
- [x] Document fix in code comments
- [ ] Update CHANGELOG.md

**Files:** `src/middleware/rate-limit.ts`, `src/middleware/index.ts`, `__tests__/middleware.test.ts`
**Estimated:** 2-3 hours
**Status:** ✅ Completed (2026-03-12)

**Changes Made:**
1. Added `pendingOperations` Map for per-ID locking mechanism
2. Implemented atomic `checkAndIncrement()` function
3. Added `maxEntries` option to prevent memory exhaustion DoS
4. Added `cleanupIntervalMs` option for configurable cleanup frequency
5. Added utility functions: `getRateLimitStoreSize()`, `resetRateLimit()`
6. Added 12 new tests covering concurrent requests and memory protection
7. All 58 tests pass

---

### Fix 2: Memory Exhaustion DoS
- [ ] Implement maximum entry limit for rate limit store
  - [ ] Add LRU eviction when limit reached
  - [ ] Set reasonable default (e.g., 10,000 entries)
- [ ] Add aggressive cleanup interval option
  - [ ] Configurable cleanup frequency
  - [ ] Default cleanup every 1 minute
- [ ] Add metrics for store size
- [ ] Add tests for memory limit enforcement
- [ ] Document new configuration options
- [ ] Update CHANGELOG.md

**Files:** `src/middleware/rate-limit.ts`
**Estimated:** 2-3 hours
**Status:** ⏸️ Not Started

---

### Fix 3: Type Assertion Bypasses Validation
- [ ] Remove redundant non-null assertion (`token!`)
- [ ] Add proper type validation before cast
  - [ ] Implement type guard for Client vs string
  - [ ] Add runtime validation
- [ ] Add unit tests for type validation
- [ ] Verify TypeScript strict mode compliance
- [ ] Update CHANGELOG.md

**Files:** `src/middleware/authenticate.ts`
**Estimated:** 1-2 hours
**Status:** ⏸️ Not Started

---

### Fix 4: Async Server Creation
- [ ] Make `createSyncarServer` async
- [ ] Await `httpServer.listen()` before returning
- [ ] Update return type to `Promise<SyncarServer>`
- [ ] Update all usages in codebase
- [ ] Update documentation and examples
- [ ] Add tests for async initialization
- [ ] Update CHANGELOG.md

**Files:** `src/server.ts`, `src/index.ts`, documentation
**Estimated:** 3-4 hours
**Status:** ⏸️ Not Started

---

### Fix 5: Graceful Shutdown Implementation
- [ ] Implement proper `stop()` method
  - [ ] Close HTTP server
  - [ ] Close WebSocket transport
  - [ ] Clear all event listeners
  - [ ] Clear all timers
  - [ ] Wait for connections to drain
- [ ] Add shutdown timeout configuration
- [ ] Add tests for shutdown process
- [ ] Verify no memory leaks after shutdown
- [ ] Update CHANGELOG.md

**Files:** `src/server.ts`, `src/websocket.ts`
**Estimated:** 4-5 hours
**Status:** ⏸️ Not Started

---

## Phase 2: High Priority Fixes 🟠

### Fix 6: Client ID Collision Risk
- [ ] Add uniqueness check to `generateClientId()`
- [ ] Implement retry mechanism with counter
- [ ] Add option for custom ID generator
- [ ] Add tests for ID collision handling
- [ ] Document ID generation strategy
- [ ] Update CHANGELOG.md

**Files:** `src/websocket.ts`, `src/registry.ts`
**Estimated:** 2 hours
**Status:** ⏸️ Not Started

---

### Fix 7: Message Size Validation ✅
- [x] Add size check before `JSON.parse()`
- [x] Enforce `maxPayload` limit
- [x] Add appropriate error response
- [x] Add tests for size validation
- [x] Document size limits (in code comments)
- [ ] Update CHANGELOG.md

**Files:** `src/websocket.ts`, `src/errors.ts`, `__tests__/websocket.test.ts`
**Estimated:** 1-2 hours
**Status:** ✅ Completed (2026-03-12)

**Changes Made:**
- Created `MessageSizeError` class in `errors.ts` extending `TransportError`
  - Includes `dataSize` and `maxSize` properties
  - Code: `MESSAGE_TOO_LARGE`
  - Proper `toJSON()` and `toString()` methods
- Updated `handleMessage()` method to use `MessageSizeError`
- Added security documentation comment explaining defense-in-depth approach
- Added 6 tests for maxPayload configuration and MessageSizeError class
- All 360 tests pass

---

### Fix 8: Authentication Rate Limiting
- [ ] Add auth-specific rate limiting
- [ ] Implement exponential backoff
- [ ] Add account lockout after N failures
- [ ] Make backoff configurable
- [ ] Add tests for auth rate limiting
- [ ] Document security features
- [ ] Update CHANGELOG.md

**Files:** `src/middleware/authenticate.ts`
**Estimated:** 3 hours
**Status:** ⏸️ Not Started

---

### Fix 9: Authentication Error Message Leakage
- [ ] Return generic error messages for auth failures
- [ ] Log detailed errors server-side only
- [ ] Use same message for all auth failures
- [ ] Update tests for new error messages
- [ ] Document security behavior
- [ ] Update CHANGELOG.md

**Files:** `src/middleware/authenticate.ts`
**Estimated:** 1 hour
**Status:** ⏸️ Not Started

---

### Fix 10: Socket Send Error Handling
- [ ] Wrap `socket.send()` in try-catch blocks
- [ ] Implement error logging
- [ ] Add retry logic for transient failures
- [ ] Add error event emission
- [ ] Add tests for send failures
- [ ] Document error handling behavior
- [ ] Update CHANGELOG.md

**Files:** `src/handlers/messages.ts`, `src/handlers/signal.ts`
**Estimated:** 2-3 hours
**Status:** ⏸️ Not Started

---

## Phase 3: Medium Priority Improvements 🟡

### Fix 11: Test Implementation Coupling
- [ ] Refactor websocket tests to use public API
- [ ] Remove direct access to private members
- [ ] Add tests for observable behavior
- [ ] Verify all tests still pass
- [ ] Document test approach

**Files:** `__tests__/websocket.test.ts`
**Estimated:** 2-3 hours
**Status:** ⏸️ Not Started

---

### Fix 12: Integration Tests
- [ ] Create integration test suite
  - [ ] Real WebSocket server tests
  - [ ] End-to-end message flow tests
  - [ ] Memory leak verification tests
  - [ ] Cleanup verification tests
  - [ ] Failure scenario tests
- [ ] Set up test fixtures for integration tests
- [ ] Document integration test approach

**Files:** `__tests__/integration/` (new)
**Estimated:** 6-8 hours
**Status:** ⏸️ Not Started

---

### Fix 13: Context Class Refactoring
- [ ] Analyze ContextManager responsibilities
- [ ] Design split into focused classes
  - [ ] MiddlewareRegistry class
  - [ ] PipelineExecutor class
  - [ ] ContextFactory class
- [ ] Implement refactored classes
- [ ] Update all usages
- [ ] Add tests for new classes
- [ ] Verify no behavior changes
- [ ] Update documentation
- [ ] Update CHANGELOG.md

**Files:** `src/context.ts`
**Estimated:** 4-6 hours
**Status:** ⏸️ Not Started

---

### Fix 14: Log Injection Prevention
- [ ] Implement log input sanitization
- [ ] Add escape function for special characters
- [ ] Apply sanitization to all user-controlled log data
- [ ] Add tests for log injection prevention
- [ ] Document security measures

**Files:** `src/middleware/logger.ts`
**Estimated:** 2 hours
**Status:** ⏸️ Not Started

---

### Fix 15: Ping Timer Cleanup
- [ ] Add timer cleanup to `close()` method
- [ ] Add timer cleanup to `destroy()` method
- [ ] Ensure all timers are cleared
- [ ] Add tests for timer cleanup
- [ ] Verify no timer leaks
- [ ] Update CHANGELOG.md

**Files:** `src/websocket.ts`
**Estimated:** 1 hour
**Status:** ⏸️ Not Started

---

## Phase 4: Low Priority / Technical Debt ⚪

### Fix 16: Remove Unused Parameters
- [ ] Remove `_reason` parameter or use it
- [ ] Remove `_message` parameter or use it
- [ ] Review all `_` prefixed parameters
- [ ] Update JSDoc comments
- [ ] Verify tests still pass

**Files:** Multiple handler files
**Estimated:** 1 hour
**Status:** ⏸️ Not Started

---

### Fix 17: Extract Magic Numbers
- [ ] Extract substring indices to named constants
- [ ] Extract ready state values to constants
- [ ] Extract timeout values to constants
- [ ] Update all usages
- [ ] Document constants

**Files:** `src/utils.ts`, `src/websocket.ts`
**Estimated:** 1 hour
**Status:** ⏸️ Not Started

---

### Fix 18: Add Logging to Silent Failures
- [ ] Add logging to connection handler silent returns
- [ ] Add logging to websocket error handling
- [ ] Ensure all failure paths have some logging
- [ ] Add tests for logging behavior

**Files:** `src/handlers/connections.ts`, `src/websocket.ts`
**Estimated:** 1 hour
**Status:** ⏸️ Not Started

---

### Fix 19: Remove Dead Code for Non-Existent Scope Property ✅
- [x] Remove dead code checking `channelInstance?.scope === 'broadcast'`
- [x] Verify Channel class has no `scope` property (only `flow`)
- [x] Remove lines 112-116 from signal handler
- [x] Update tests if any reference this check (none found)
- [x] Verify no regressions in subscribe behavior (354 tests pass)
- [ ] Update CHANGELOG.md

**Files:** `src/handlers/signal.ts:112-116`
**Estimated:** 30 minutes
**Status:** ✅ Completed (2026-03-12)

**Changes Made:**
- Removed dead code checking for non-existent `scope` property
- Removed unused `channelInstance` variable that was only used for the dead check
- All 354 tests pass with no regressions

---

## Additional Improvements

### Documentation
- [ ] Add security guide to README
- [ ] Add architecture decision records (ADRs)
- [ ] Add migration guide for breaking changes
- [ ] Add performance tuning guide

### Observability
- [ ] Add structured logging (JSON format)
- [ ] Add correlation IDs for request tracing
- [ ] Add metrics collection endpoints
- [ ] Add health check endpoint

### Developer Experience
- [ ] Add TypeScript strict mode compliance
- [ ] Add pre-commit hooks for linting
- [ ] Add code coverage reporting
- [ ] Add performance benchmarks

---

## Progress Tracking

### Overall Progress
- [ ] Phase 1: Critical Security Fixes (1/5 complete)
- [x] Phase 2: High Priority Fixes (1/5 complete)
- [ ] Phase 3: Medium Priority Improvements (0/5 complete)
- [x] Phase 4: Low Priority / Technical Debt (1/4 complete)

### Statistics
- **Total Tasks:** 19 fixes + additional improvements
- **Estimated Total Time:** 45.5-60.5 hours
- **Completed:** 3 (Fix 1, Fix 7, Fix 19)
- **In Progress:** 0
- **Blocked:** 0

---

## Notes

- Each fix should include:
  - Code changes
  - Unit tests
  - Documentation updates
  - CHANGELOG entry

- Testing checklist for each fix:
  - [ ] Unit tests pass
  - [ ] Integration tests pass
  - [ ] No regressions in existing tests
  - [ ] Manual testing completed
  - [ ] Code review approved

- Before marking a fix as complete:
  - [ ] All sub-tasks checked
  - [ ] Tests written and passing
  - [ ] Documentation updated
  - [ ] CHANGELOG updated
  - [ ] Code reviewed

---

## Quick Reference

| Fix ID | Description | Priority | Status |
|--------|-------------|----------|--------|
| Fix 1 | Rate limiting race condition | 🔴 Critical | ✅ |
| Fix 2 | Memory exhaustion DoS | 🔴 Critical | ⏸️ |
| Fix 3 | Type assertion bypass | 🔴 Critical | ⏸️ |
| Fix 4 | Async server creation | 🔴 Critical | ⏸️ |
| Fix 5 | Graceful shutdown | 🔴 Critical | ⏸️ |
| Fix 6 | Client ID collision | 🟠 High | ⏸️ |
| Fix 7 | Message size validation | 🟠 High | ✅ |
| Fix 8 | Auth rate limiting | 🟠 High | ⏸️ |
| Fix 9 | Auth error leakage | 🟠 High | ⏸️ |
| Fix 10 | Socket send errors | 🟠 High | ⏸️ |
| Fix 11 | Test coupling | 🟡 Medium | ⏸️ |
| Fix 12 | Integration tests | 🟡 Medium | ⏸️ |
| Fix 13 | Context refactoring | 🟡 Medium | ⏸️ |
| Fix 14 | Log injection | 🟡 Medium | ⏸️ |
| Fix 15 | Timer cleanup | 🟡 Medium | ⏸️ |
| Fix 16 | Unused params | ⚪ Low | ⏸️ |
| Fix 17 | Magic numbers | ⚪ Low | ⏸️ |
| Fix 18 | Silent failures | ⚪ Low | ⏸️ |
| Fix 19 | Dead code (scope property) | ⚪ Low | ✅ |
