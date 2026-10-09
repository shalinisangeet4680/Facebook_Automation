# Authentication

## 1. Overview

- Users sign in with a **phone number and a one-time code (OTP)**. There are no passwords.
- After verification the backend issues a **JWT access token** (15 minutes) and an **opaque refresh token** (30 days, rotated on every use).
- Web clients receive both as `httpOnly` cookies. Mobile clients receive them in the response body and store them in Keychain or Keystore.
- The `AuthGuard` accepts the access token from `Authorization: Bearer` or from the `access_token` cookie.

## 2. OTP flow

```
POST /api/v1/auth/otp/request   { phone: "8434230999" }
  → normalise to E.164 (+918434230999)
  → check the phone is allowed (beta allowlist / test numbers)
  → rate limits: 1 request per 30 s, 5 per 15 min per phone; 20 per hour per IP
  → create otp_challenges row: code hash, expires in 10 minutes, attempts 0
  → OtpSender.send(phone, code)
  ← 200 { phone: "+91 84342 30999", expiresInSeconds: 600, resendInSeconds: 30 }

POST /api/v1/auth/otp/verify    { phone, code }
  → latest unconsumed, unexpired challenge for the phone
  → max 5 attempts per challenge; timing-safe hash comparison
  → on success: mark consumed, find or create user, ensure a workspace exists
  → create a session (refresh token family) and issue tokens
  ← 200 { user, workspace, isNewUser }  (+ tokens: cookies for web, body for mobile)
```

### Test numbers

`OTP_TEST_NUMBERS` holds `phone:code` pairs, for example `8434230999:963101`. For these numbers no SMS is sent and the fixed code is accepted. While the product is in private beta, only numbers in this list may sign in. Real delivery is added by implementing the `OtpSender` port with an SMS provider; no other code changes.

## 3. Tokens

### Access token (JWT)

| Claim | Value |
|---|---|
| `sub` | user ID |
| `typ` | `"access"` |
| `wid` | active workspace ID |
| `sid` | session ID (refresh token family) |
| `iat`, `exp` | issued at, expiry (15 minutes) |

Signed with `JWT_ACCESS_SECRET` (HS256). Verified on every request without a database lookup; expiry is always enforced.

### Refresh token

- 32 random bytes, base64url. Only its SHA-256 hash is stored in `refresh_tokens`.
- Belongs to a **family** (one family per login on one device).
- Valid for 30 days from its issue; each refresh issues a new token and marks the old one `replaced`.
- **Reuse detection:** presenting a token that was already replaced revokes the whole family and forces sign-in again on that device.
- **Concurrent refresh grace:** if a replaced token is presented within 15 seconds of being replaced (two tabs refreshing at once), the API returns `409 SESSION_REFRESHED` without revoking anything; the client simply retries its original request with the cookies the other tab already received.
- Logout revokes the family; logout-all revokes every family of the user.

## 4. Web cookies

| Cookie | Value | Attributes |
|---|---|---|
| `access_token` | JWT | `HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=900` |
| `refresh_token` | opaque token | `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=2592000` |

- `Secure` is off only on `http://localhost` in development.
- The web app calls the API through its own origin (`/api/*` is proxied to the backend), so cookies are first-party.
- State-changing requests must include `X-Client: web`; cross-site forms cannot set custom headers, which blocks CSRF together with `SameSite=Lax`.

## 5. Refresh behaviour in clients

1. A request returns `401 UNAUTHORIZED`.
2. The client calls `POST /api/v1/auth/refresh` once (concurrent 401s share one refresh call).
3. On success the original request is retried. On `409 SESSION_REFRESHED` the original request is retried without refreshing again. On any other failure the user is sent to the login screen.

## 6. Data

| Table | Purpose |
|---|---|
| `users` | phone (unique), name, timestamps |
| `workspaces` | tenant; owner user |
| `workspace_members` | user ↔ workspace with role (`owner`, `admin`, `member`) |
| `otp_challenges` | code hash, attempts, expiry, consumed time, IP |
| `refresh_tokens` | token hash, family ID, user ID, expiry, replaced/revoked time, user agent, IP |

## 7. Rate limits

| Route | Limit |
|---|---|
| `otp/request` | 1 per 30 s and 5 per 15 min per phone; 20 per hour per IP |
| `otp/verify` | 5 attempts per challenge; 30 per hour per IP |
| `auth/refresh` | 60 per hour per session |
| Everything else | 300 per minute per user, 100 per minute per IP when unauthenticated |
