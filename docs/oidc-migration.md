# Experts OIDC migration

Status: implementation and production identity configuration complete; interactive SSO pending
Tracking key: `EXPERTS`
Central tracker: `forge/docs/cross-repo-oidc-rollout.md`
Production application: `https://experts.thesyncforge.com`

## Goal

Replace local password authentication with the shared SyncForge Cognito login
while preserving existing users, chatbots, documents, conversations, and their
current internal database IDs.

## Current state

- Next.js App Router owns the UI and server routes.
- `User` stores an scrypt password hash and salt.
- `Session` stores opaque database-backed sessions in the `tsf_session` cookie.
- Product records reference the local `User.id` and should not be re-keyed.
- The Forge identity stack has reserved an `experts-web` public Cognito client.

## Target model

The application keeps its local user row and adds a durable mapping to Cognito:

```text
oidcIssuer: string | null
oidcSubject: string | null
emailVerified: boolean
UNIQUE(oidcIssuer, oidcSubject)
```

Email is used for display and a verified migration challenge, not as the
long-term identity key. Existing foreign keys continue to reference `User.id`.

## Target flow

1. `/api/auth/signin` creates state, nonce, and PKCE cookies and redirects to Cognito.
2. `/api/auth/callback` exchanges the code and validates the ID token.
3. The app resolves `(issuer, subject)` to the existing local user or enters the
   controlled legacy-link flow.
4. The app creates its own opaque Experts session cookie.
5. Existing `requireUser`/`requireApiUser` consumers continue to receive the
   local application user.

## Work items

- [x] `EXPERTS-001` Add nullable OIDC identity fields and a composite unique constraint.
- [x] `EXPERTS-002` Add an additive database migration and validate the full SQL chain on a fresh SQLite database.
- [x] `EXPERTS-003` Add OIDC environment validation and documented local callback values.
- [x] `EXPERTS-004` Implement signin, callback, refresh, logout, and current-user routes.
- [x] `EXPERTS-005` Validate state, nonce, PKCE, signature, issuer, audience, and expiry.
- [x] `EXPERTS-006` Preserve the existing local `User.id` after OIDC login.
- [x] `EXPERTS-007` Build a legacy-account linking flow requiring verified email and old-password proof.
- [x] `EXPERTS-008` Add account-link conflict and recovery screens.
- [x] `EXPERTS-009` Disable new local-password registration after the rollout flag is enabled.
- [x] `EXPERTS-010` Add audit events without logging credentials or tokens.
- [x] `EXPERTS-011` Add tests for login, replayed callback, wrong audience, and link conflicts.
- [ ] `EXPERTS-012` Run staging SSO tests from Forge to Experts and back.
- [ ] `EXPERTS-013` Remove password fields and legacy sessions only after the migration window.

## Migration rules

- Never merge accounts solely because their email strings match.
- Automatic linking is allowed only when policy explicitly approves it and the
  Cognito token has `email_verified=true`; the initial rollout additionally
  requires proof of the legacy password.
- An `(issuer, subject)` may belong to exactly one local user.
- A local user may have only one primary Cognito identity in the first release.
- Password login remains available only during a time-bounded migration window.

## Acceptance criteria

- A Forge-authenticated user enters Experts without re-entering credentials.
- Existing records retain their current local `User.id` ownership.
- A legacy user can safely link an account without duplicating their data.
- Callback replay, nonce mismatch, audience mismatch, and open redirects fail closed.
- New production users cannot create a second local-password identity.
- Disabling OIDC does not silently fall back to an insecure production mock mode.

## Rollback

Keep legacy sign-in available during the linking window. Set the server-side
`OIDC_ROLLOUT_ENABLED=true` only after the Cognito callback is live; this disables
new password registration but deliberately preserves existing-password sign-in
for account linking. Rolling back sets the flag to `false`; it does not delete
OIDC mappings or re-key product data.

## Local implementation evidence

On 2026-08-10, Prisma schema validation and client generation passed, TypeScript
and ESLint passed, all 64 tests passed, the Next.js production build and deployment
artifact verification passed, and all four migration SQL files applied successfully
to a fresh temporary SQLite database with no foreign-key violations.
The checked-in `prisma/dev.db` predates the basic-auth migration and must be
baselined or recreated separately; it was not modified during this work.

The OIDC implementation is deployed to the Amplify preview and the shared
production identity domain is live. Interactive verification in `EXPERTS-012`
remains required before enabling the rollout flag. Password cleanup in
`EXPERTS-013` remains intentionally deferred until the migration window closes.

Authentication audit output is a fixed JSON schema containing only event,
outcome, reason code, optional flow/scope, and timestamp. It excludes email,
local user IDs, OIDC subjects, authorization codes, credentials, and tokens.

## Staging evidence

On 2026-08-10, the independent staging Cognito stack and the Experts draft-PR
preview were deployed. Amplify job `1` passed BUILD, DEPLOY, and VERIFY at
`https://codex-experts-oidc-sso.d3ksnlhzjcoqk4.amplifyapp.com`.

An unauthenticated protocol smoke test confirmed:

- the deployed sign-in page contains the SyncForge entry point;
- `/api/auth/me` returns `401` without a local session;
- `/api/auth/signin` redirects to the shared Cognito domain;
- the authorization request uses code flow, S256 PKCE, state, and nonce;
- Cognito serves the managed `/login` page successfully.

`EXPERTS-012` remains open because a verified test-user login, legacy-account
link, refresh, Forge-to-Experts browser SSO, and logout matrix still require an
interactive Cognito account.

On 2026-08-10, the Amplify `main` and preview branch configurations were moved
from the temporary Cognito prefix to `https://auth.thesyncforge.com`. The issuer
and Experts client ID remain unchanged; `OIDC_ROLLOUT_ENABLED` stays `false`
until the interactive matrix passes.
