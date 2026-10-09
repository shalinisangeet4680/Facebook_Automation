# Security

## 1. Secrets

- Secrets live only in environment variables locally and in the platform's secret manager in production. `.env` is git-ignored; `.env.example` lists keys without values.
- Required secrets: `JWT_ACCESS_SECRET`, `TOKEN_ENCRYPTION_KEY`, `DATABASE_URL`, `REDIS_URL`, provider keys.
- Real environment variables always override values in `.env`.
- Configuration is validated at startup; missing or weak secrets stop the process.

## 2. Data protection

| Data | Protection |
|---|---|
| Meta System User tokens | AES-256-GCM with a 32-byte key, versioned ciphertext (`v1.<iv>.<tag>.<data>`), never returned to clients, never logged; only the last 4 characters are shown |
| Refresh tokens | SHA-256 hash stored; raw token only in the client |
| OTP codes | SHA-256 hash with expiry and attempt limits; timing-safe comparison |
| Access tokens | Short-lived (15 minutes) signed JWTs |
| Personal data | Phone numbers stored in E.164; logs mask phone numbers and tokens |

The encryption key can be rotated by adding a new key version and re-encrypting in a background job; the ciphertext prefix identifies the key version.

## 3. Transport and headers

- HTTPS only in production; HSTS through helmet.
- Helmet security headers; CORS limited to known web origins with credentials.
- Request body size limits; JSON only.

## 4. Access control

- `AuthGuard` is global; routes opt out with `@Public()`.
- Every business query is scoped by `workspace_id` from the token, never from client input.
- Workspace roles (`owner`, `admin`, `member`) enforced by a role guard on sensitive routes (connection changes, launches, budget changes).

## 5. Abuse protection

- Rate limits per IP, per phone, and per user (Redis-backed, shared across instances).
- OTP attempt limits and cooldowns.
- Refresh token reuse detection revokes the session family.
- Idempotency keys on money-related actions.

## 6. Auditing

`audit_events` records every sensitive action: sign-ins, connection changes, approvals, launches, budget changes, automatic pauses, with actor (`user`, `system`, `ai`), target, and details. Customers can see their own audit log.

## 7. Checklist for every new endpoint

- [ ] DTO validation with whitelist; unknown fields rejected
- [ ] Workspace scoping from `TenantContext`
- [ ] Role check if it changes connections, spend, or launches
- [ ] Idempotency key if it spends money or changes budgets
- [ ] Rate limit appropriate to the action
- [ ] No secrets or tokens in responses or logs
- [ ] Error messages are user-safe
- [ ] e2e test for success and the main failure
