# FND-001 Baseline Smoke Test Report

Date: 2026-07-16

Branch: `feature/FND-001-baseline-smoke-test`

## Summary

This report documents the Milestone 0 baseline smoke test for the TSF document-based chatbot MVP. The goal was to confirm that the current application can run locally and complete the expected core workflow before starting the next implementation tickets.

Overall result: **Pass with one local database migration-history follow-up.**

The main product flow works end to end:

- A user can create a chatbot.
- A supported document can be uploaded and processed.
- Chunks and embeddings are created.
- Known document questions receive supported answers with sources.
- Unknown questions return the required fallback response with no sources.
- A separate chatbot without the uploaded document cannot answer from that document.

No cross-chatbot leakage was observed during this baseline smoke test.

## Scope

1. Local setup and environment checks.
2. Real Estate Assistant creation.
3. Sample lease upload and document processing.
4. Known-answer chat questions.
5. Unknown-answer fallback behavior.
6. Insurance Assistant separation check.
7. Lint, test, and build commands.

## Environment

- Node version: `v24.13.0`
- Package manager: `npm 11.6.2`
- Lockfile: `package-lock.json`
- Git version: `git version 2.52.0`
- Local env file: `.env` exists
- Required `.env` variable names verified: `DATABASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `EMBEDDING_MODEL`
- API keys or `.env` values: not included

## Task Checklist

| Required Task | Result | Evidence / Notes |
| --- | --- | --- |
| Clone the repository and install dependencies. | Pass | Existing local repository checkout was used. Dependencies were already installed and usable from `node_modules`. |
| Create the local `.env` file using the approved variable names. | Pass | `.env` exists and includes the required variable names. Values are not included in this report. |
| Generate the Prisma client and run migrations. | Partial pass | `npx prisma generate` passed. Local `dev.db` is schema-synced, but `npx prisma migrate status` reported migration-history mismatch. See Known Issue. |
| Start the application locally. | Pass | `npm run dev` started the app at `http://localhost:3000`. |
| Create a Real Estate Assistant. | Pass | Real Estate Assistant was created successfully. |
| Upload the sample lease document from the project brief. | Pass | `sample-lease.txt` uploaded successfully. |
| Confirm that the document reaches `ready` status. | Pass | Uploaded document reached `ready`. |
| Confirm that chunks and embeddings are created. | Pass | 1 chunk was created and contained a stored embedding. |
| Ask the known-answer questions. | Pass | Rent and pet questions returned document-supported answers. |
| Ask the kitchen-color question. | Pass | Returned the exact fallback response with no sources. |
| Create an Insurance Assistant without uploading the lease. | Pass | Insurance Assistant was created with no uploaded lease document. |
| Confirm that the Insurance Assistant cannot answer from the lease. | Pass | Insurance Assistant returned the exact fallback response with no sources. |
| Run lint, tests, and build commands when available. | Pass | `npm run lint`, `npm run test`, and `npm run build` passed. |

## Setup Commands

| Step | Result | Notes |
| --- | --- | --- |
| Local repository checkout | Pass | Existing local checkout was used for this baseline run. |
| Dependency install | Pass | Dependencies were already installed and usable from `node_modules`. Package manager confirmed from `package-lock.json`. |
| `npx prisma validate` | Pass | Prisma schema is valid. |
| `npx prisma generate` | Pass | Prisma Client generated successfully. |
| `npx prisma migrate status` | Needs follow-up | Local `dev.db` exists and is schema-synced, but Prisma reports migrations as not applied because this development database was previously synced outside migration history. See Known Issue below. |
| `npx prisma db push` | Pass | Default local `dev.db` is in sync with the Prisma schema. |
| `npm run dev` | Pass | App started at `http://localhost:3000`. |
| `npm run lint` | Pass | No lint errors. |
| `npm run test` | Pass | 3 test files, 9 tests passed. |
| `npm run build` | Pass | Production build completed successfully. |

## Smoke Test Data

Sample lease file: `sample-lease.txt`

```text
Sample Lease Agreement

The tenant must pay rent on the first day of each month.
The monthly rent amount is $2,000.
The lease starts on January 1, 2026 and ends on December 31, 2026.
The tenant must not keep pets without written approval from the landlord.
The tenant must give 60 days written notice before ending the lease early.
```

## Smoke Test Results

| Step | Result | Notes |
| --- | --- | --- |
| Create test user/session | Pass | Required because the current app includes authentication. Test account was removed after the smoke test. |
| Create Real Estate Assistant | Pass | Chatbot created successfully. |
| Upload sample lease document | Pass | Upload returned a document with `ready` status. |
| Confirm document reaches `ready` | Pass | Document status was `ready`. |
| Confirm chunks and embeddings are created | Pass | 1 chunk was created and the chunk had a stored embedding. |
| Ask: `How much is the monthly rent?` | Pass | Answer: `The monthly rent is $2,000.` Source count: 1. |
| Ask: `Are pets allowed?` | Pass | Answer mentioned written landlord approval. Source count: 1. |
| Ask: `What color is the kitchen?` | Pass | Returned exact fallback: `I don't have enough information in the uploaded documents to answer that.` Source count: 0. |
| Create Insurance Assistant without uploading lease | Pass | Chatbot created successfully with no uploaded documents. |
| Ask Insurance Assistant: `How much is the monthly rent?` | Pass | Returned exact fallback and no sources. |

## Screenshots

- Chatbot list: `docs/fnd-001-screenshots/01-chatbot-list.png`
- Real Estate document ready state: `docs/fnd-001-screenshots/02-real-estate-document-ready.png`
- Known answer with source reference: `docs/fnd-001-screenshots/03-known-answer-with-source.png`
- Unknown answer fallback with no sources: `docs/fnd-001-screenshots/04-fallback-answer-no-sources.png`
- Insurance assistant with no uploaded lease document: `docs/fnd-001-screenshots/05-insurance-assistant-no-lease.png`
- Insurance assistant cannot answer from lease: `docs/fnd-001-screenshots/05-insurance-fallback-no-lease.png`

## Flow Explanation

1. A user creates a chatbot for a specific domain.
2. A supported document is uploaded to that chatbot.
3. The server stores the document record, parses the file text, splits text into chunks, generates embeddings, and stores those chunks with the chatbot.
4. When the user asks a question, the server retrieves chunks scoped to the selected chatbot.
5. Retrieved context is sent to the language model.
6. If the context supports the answer, the assistant responds with a document-based answer and source references.
7. If the context is empty or insufficient, the assistant returns the exact fallback message.
8. Conversations and messages are saved so they can be reopened after refresh.

## Known Issue / Follow-Up

### Local Prisma migration history mismatch

Command:

```bash
npx prisma migrate status
```

Observed result:

Prisma reported that the local `dev.db` has unapplied migrations:

```text
Following migrations have not yet been applied:
20260523124300_init
20260710000000_basic_auth
```

However, `npx prisma db push` confirmed the database is already in sync with the Prisma schema.

Likely cause:

This local development database was previously updated outside normal migration history during earlier MVP work.

Impact:

- The application still runs locally.
- The smoke test passed.
- Prisma schema validation, client generation, lint, tests, and build all passed.
- This should be checked on a clean clone or with a reset local development database before treating it as a migration defect.

Suggested follow-up:

Create a separate setup/DB ticket only if the same migration-history issue appears on a clean local setup.
