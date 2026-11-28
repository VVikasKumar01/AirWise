# Security Summary

**Reviewed Files**: 23
**Issues Resolved**: 3

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Rate-Limit IP Resolution | `server/security.ts`, `server/app.ts` | 43–55 | Rate limiter read the untrusted left-most `X-Forwarded-For` header directly and only pruned expired buckets when over cap, allowing rate-limit bypass and bucket growth. | Medium | Fixed | Enabled `app.set('trust proxy', 1)` in Express, switched rate limiter to `req.ip`, and added oldest-entry eviction when active buckets hit `maxBuckets`. |
| Empty Coordinate Coercion | `server/validation.ts` | 52–65 | `parseCoordinates` coerced `""`, whitespace, and `null` via `Number()` to `0`, treating missing coordinates as `(0, 0)` instead of rejecting them. | Low | Fixed | Added `toStrictFiniteNumber` to reject empty strings and non-numeric values before range checking. |
| Local Storage Validation | `src/utils/storage.ts` | 46–145 | Hydrated preferences, impact actions, and emission factors did not validate finite numbers, allowing corrupted `localStorage` data to cause `NaN` totals or malformed API queries. | Low | Fixed | Added strict type and finite-number validation on all `localStorage` hydration helpers. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| API Keys & Secrets | `server/geminiService.ts` | `GEMINI_API_KEY` is read only on the server from `process.env` and never bundled into Vite client code. |
| Dependency Security | `bun.lock` | `bun audit` checked 256 packages and found 0 vulnerabilities. |
| Untrusted URLs & Output | `server/geminiService.ts`, `src/components/AssistantPage.tsx` | Grounded Maps URLs are validated with `URL` to allow only `http:`/`https:`, and chat/advice text renders strictly via React text nodes (no `dangerouslySetInnerHTML`). |
| Audio & Payload Bounds | `server/app.ts`, `server/validation.ts` | Global JSON bodies are capped at `100kb`, `/api/transcribe` is capped at `2.5mb` with MIME allowlisting and base64 regex validation. |
| HTTP Security Headers | `server/security.ts` | Emits `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Cross-Origin-Resource-Policy: same-origin`, and `Permissions-Policy`. |

## PoC Verification

### Rate Limiter Spoofed X-Forwarded-For Bypass
#### Summary
| Field | Value |
|---|---|
| Issue Type | Rate-Limit Bypass via Untrusted Header |
| Impact | Medium |
| Affected File | `server/security.ts:43-55`, `server/app.ts:36` |
| Test Scenario | Repeated requests from `127.0.0.1` carrying `X-Forwarded-For: 203.0.113.99` after exhausting the 2-request quota. |

#### How It Was Fixed
Configured `app.set('trust proxy', 1)` in Express and switched `createRateLimiter` to key buckets by `req.ip || req.socket?.remoteAddress || 'unknown'` while evicting oldest entries if `buckets.size >= maxBuckets`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Two requests from `127.0.0.1` exhaust `maxRequests: 2` in `createRateLimiter`. | Bucket reaches `count = 2` |
| 2 | Third request arrives with forged `x-forwarded-for: 203.0.113.99`. | Header ignored; `clientIp` resolves to `req.ip` (`127.0.0.1`) |
| 3 | Existing bucket check runs (`existing.count >= options.maxRequests`). | **Handled Safely** (HTTP `429` returned) |

#### Conclusion
**Fix Verified** - Spoofed `X-Forwarded-For` values can no longer bypass per-IP rate limiting or grow buckets past `maxBuckets`.
