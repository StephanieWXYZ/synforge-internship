# AUTH-001: Authentication and Ownership Model

## Status

Planning decision documented for review. This ticket is documentation-only and
does not include authentication, Prisma schema, or route-protection code
changes.

## Decision Summary

The MVP will use the shared SyncForge authentication system through
Cognito/OIDC. The application will keep its local `User.id` as the stable
ownership key for product data. Chatbots are private to their owner in the MVP,
and documents, chunks, conversations, messages, and sources are scoped through
the chatbot/resource hierarchy.

## Decisions

| Decision | Selected Model |
| --- | --- |
| Authentication provider | Use the shared SyncForge authentication system through Cognito/OIDC. The repository already contains the initial OIDC implementation, so this ticket documents and validates that approach instead of selecting another provider. |
| Teams | Users will not belong to teams in the MVP. |
| Chatbot sharing | Chatbots will be private to their owner in the MVP. No sharing or public links yet. |
| Roles | No application roles are needed in the MVP. All signed-in users have the same product-level permissions and may access only their own resources. |
| Chatbot ownership | A `User` owns a `Chatbot` through `Chatbot.userId`. |
| Existing records | Existing records that are already associated with a local user must preserve that user's `User.id` when the account is linked to OIDC. Orphaned records with no `userId` must not be automatically claimed by whichever user signs in first. |

## Ownership Relationships

```text
User
  owns Chatbot
    owns Document
      owns DocumentChunk
    owns Conversation
      owns Message
        stores SourceReference metadata for retrieved chunks
```

Relationship list:

- `User` is the local application identity and stable product-data owner.
- `Session` belongs to `User`.
- `Chatbot` belongs to `User`.
- `Document` belongs to a `Chatbot` and is also scoped to the owning `User`.
- `DocumentChunk` belongs to a `Document` and `Chatbot`, and is also scoped to
  the owning `User`.
- `Conversation` belongs to a `Chatbot` and is also scoped to the owning `User`.
- `Message` belongs to a `Conversation` and is also scoped to the owning `User`.
- Source references are stored on assistant messages and point back to retrieved
  document chunks. They are not independently shareable resources.

Documents, chunks, conversations, messages, and source references should not be
treated as independently shareable resources. Access to each child record must
be validated through the current user's ownership of the parent chatbot/resource
hierarchy.

## Protected Pages

The following pages should require an authenticated user:

- `/`
- `/chatbots/new`
- `/chatbots/[id]`
- `/chatbots/[id]/chat`

Unauthenticated page requests should redirect to `/sign-in`.

## Protected Server Operations

The following server operations should require an authenticated user:

- `GET /api/chatbots`
- `POST /api/chatbots`
- `GET /api/chatbots/[id]`
- `POST /api/documents`
- `POST /api/documents/upload-url`
- `DELETE /api/documents/[id]`
- `POST /api/documents/[id]`
- `POST /api/chat`

The internal document-processing route is not protected by a browser session. It
should remain protected by worker request authentication and must receive
`userId`, `chatbotId`, and `documentId` in the signed job payload.

## Request Behavior

Unauthenticated API requests should return `401` with a safe authentication
error. Unauthenticated page requests should redirect to `/sign-in`.

Unauthorized resource IDs should return a safe not-found or validation response.
The response should not reveal whether the requested resource exists under
another user or chatbot.

Examples:

- A user requesting another user's chatbot should receive a safe not-found
  response.
- A user deleting or reprocessing a document must provide a document that belongs
  to the selected chatbot and current user.
- A user reopening or retrying a conversation must use a conversation that
  belongs to the selected chatbot and current user.
- Retrieval must only return chunks belonging to the selected chatbot and
  current user.

## Migration and Backfill Procedure

Disposable local development databases can be reset when legacy records are not
worth preserving.

For data that must be preserved:

1. Identify the designated owner user for the preserved chatbot records.
2. Backfill orphaned `Chatbot.userId` values to that designated user.
3. Backfill child `Document`, `DocumentChunk`, `Conversation`, and `Message`
   `userId` values from their parent chatbot or conversation hierarchy.
4. Validate that every child record's `userId` matches the owner of its parent
   chatbot.
5. Validate that every `DocumentChunk.chatbotId` matches its parent document's
   chatbot.
6. Validate that every `Message.userId` matches its parent conversation's
   chatbot owner.
7. Do not automatically assign orphaned records to the first user who signs in.
8. After validation passes, a follow-up implementation ticket may make product
   ownership fields required where appropriate.

Existing records that already have `userId` should preserve that local `User.id`
through OIDC account linking. Accounts should not be merged solely because email
addresses match.

## Current Implementation Notes and Discrepancies

- The repository already contains an initial Cognito/OIDC implementation and an
  `docs/oidc-migration.md` plan. AUTH-001 aligns with that direction.
- `User` includes OIDC mapping fields: `oidcIssuer`, `oidcSubject`, and
  `emailVerified`.
- `Session` uses a local opaque session cookie after authentication.
- Product tables already include `userId`, and many page/API queries filter by
  `userId`.
- `README.md` still lists "No authentication yet" under MVP limitations, which
  is outdated relative to the current auth implementation.
- Product ownership fields such as `Chatbot.userId`, `Document.userId`,
  `DocumentChunk.userId`, `Conversation.userId`, and `Message.userId` are still
  nullable in the Prisma schema. That allows legacy/orphaned rows and should be
  handled by the documented backfill before any future hardening migration.
- `Document`, `DocumentChunk`, `Conversation`, and `Message` also carry `userId`
  directly. The documented ownership model treats these as scoped child records,
  not independently shareable resources.

## Out of Scope for AUTH-001

- Implementing new authentication behavior.
- Changing Prisma schema fields or migrations.
- Changing route-protection logic.
- Adding team membership.
- Adding chatbot sharing or public links.
- Adding role-based permissions.
- Removing legacy password fields after the migration window.
