# Domain Knowledge Chatbot MVP

A Next.js MVP for creating document-grounded chatbots by business domain. Admins can create a chatbot, upload files to that specific chatbot, and ask questions that are answered only from that chatbot's uploaded documents.

Example domains include real estate, insurance, power station operations, legal/compliance, and education.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- Prisma ORM with SQLite
- Local file storage in `uploads/`
- OpenAI-compatible LLM adapter using `LLM_API_KEY`, `LLM_MODEL`, and `EMBEDDING_MODEL`
- JSON-stored embeddings with cosine similarity search in application code

## Setup

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If `npx prisma migrate dev` fails in a very new Node runtime, use an LTS Node version. For local recovery, the checked-in SQLite migration can also be applied manually:

```bash
sqlite3 prisma/dev.db < prisma/migrations/20260523124300_init/migration.sql
npx prisma generate
```

## Environment Variables

```bash
DATABASE_URL="file:./dev.db"
LLM_API_KEY="your-provider-key"
LLM_MODEL="gpt-4.1-mini"
EMBEDDING_MODEL="text-embedding-3-small"
LLM_BASE_URL="https://api.openai.com/v1"
```

`LLM_BASE_URL` is optional and can point at an OpenAI-compatible provider.

## How To Use

1. Go to the home page and click **Create chatbot**.
2. Create a chatbot such as `Real Estate Assistant`.
3. Open the chatbot detail page.
4. Upload a PDF, TXT, or DOCX file.
5. Wait for the document status to become `ready`.
6. Open chat and ask a question.
7. Assistant answers include source references with file name and chunk number.

Each chatbot retrieves chunks only where `chatbotId` matches the current chatbot, so an `Insurance Assistant` will not use `Real Estate Assistant` documents.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run prisma:generate
npm run prisma:migrate
```

## AWS continuous deployment

This repository uses the same CDK-managed Amplify and API Gateway structure as
`wuxia-dream`, with a narrower continuous-deployment permission model:

- Amplify Hosting Compute runs the complete Next.js SSR application.
- API Gateway exposes `/api` and `/api/*` and proxies those requests to the
  Next.js route handlers hosted by Amplify.
- Amplify auto-builds the configured branch after each commit.
- GitHub Actions tests pull requests and commits to `main`.
- Application deployment is handled by Amplify's repository webhook, so GitHub
  Actions does not receive an account-level AWS deployment role.

The infrastructure source is in `infra/`, and `amplify.yml` is the hosting
build specification.

### One-time AWS setup

1. Store a GitHub token that can access this repository in AWS Secrets Manager.
   The existing `wuxia-dream` token secret can be reused only if that token and
   its GitHub App installation also have access to `multi-persona`.
2. Create a second Secrets Manager JSON secret for runtime configuration:

   ```json
   {
     "LLM_API_KEY": "replace-me",
     "LLM_MODEL": "gpt-4.1-mini",
     "EMBEDDING_MODEL": "text-embedding-3-small",
     "LLM_BASE_URL": "https://api.openai.com/v1"
   }
   ```

   CDK grants the Amplify SSR Compute role read access only to this secret. The
   API key is fetched at runtime and is not copied into the Amplify build
   artifact.

3. Copy `infra/config/deployment.example.json` to the gitignored
   `infra/config/deployment.json`, fill in the account, repository, and secret
   names, then bootstrap and deploy CDK once using an AWS administrator session:

   ```bash
   npm ci --prefix infra
   npm run cdk:bootstrap --prefix infra -- aws://ACCOUNT_ID/us-east-1
   npm run cdk:deploy --prefix infra
   ```

CDK outputs the Amplify URL, API Gateway base URL, and Amplify app ID. Subsequent
commits to `main` trigger the Amplify branch build automatically without AWS
credentials in GitHub Actions.

> **AWS storage:** Amplify uses the stack-managed DynamoDB table through its SSR
> Compute Role. The table is on-demand, has point-in-time recovery and deletion
> protection enabled, and is retained if the stack is deleted. Local development
> continues to use SQLite when `DYNAMODB_TABLE_NAME` is absent. In AWS, uploaded
> source files are stored in the stack-managed private S3 bucket through the same
> Compute Role. The bucket blocks public access, uses S3-managed encryption and
> versioning, and is retained if the stack is deleted. Local development continues
> to store source files under `uploads/` when `UPLOAD_BUCKET_NAME` is absent.

After deploying the stack, verify the complete AWS data path with:

```bash
DYNAMODB_TABLE_NAME=multi-persona-dev-data AWS_REGION=us-east-1 npm run smoke:dynamodb
```

The smoke test creates an isolated account, session, chatbot, document chunk,
conversation, and message, verifies the expected queries, and removes its data.

## Document Processing

Uploads are validated by type and size, stored in S3 on AWS (or under `uploads/`
locally), parsed into text, split into roughly 1,000 character chunks with overlap,
embedded, and stored in the configured database. PDF, TXT, and DOCX are supported
for the MVP.

## Retrieval Flow

1. Embed the user question.
2. Load chunks for the current chatbot only.
3. Rank chunks by cosine similarity.
4. Select the top 5 chunks.
5. Build a prompt from chatbot instructions, domain metadata, retrieved chunks, and the question.
6. Generate the answer through the LLM adapter.
7. Save user and assistant messages.
8. Return source references.

If no relevant uploaded document context exists, the assistant says:

> I don't have enough information in the uploaded documents to answer that.

## MVP Limitations

- Local file storage only
- SQLite only
- Basic vector search in application code
- No authentication yet
- No role-based permissions yet
- No production-grade background queue yet
- No advanced document parsing yet
- Upload processing is synchronous during the request

## Future Improvements

- Add authentication and organization-level permissions
- Move document processing to a background queue
- Replace JSON vector search with pgvector, Pinecone, Weaviate, Chroma, or another vector store
- Add richer source previews and page-level PDF citations
- Add conversation history browsing
- Add admin controls for reprocessing and deleting documents
