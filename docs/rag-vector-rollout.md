# RAG vector retrieval rollout

The application supports two retrieval backends:

- `database` keeps the original in-process cosine similarity search and is the default.
- `s3-vectors` queries the S3 Vectors index with mandatory `userId` and `chatbotId` filters.

DynamoDB remains the source of truth for documents and chunk content. S3 Vectors stores the
embedding and the chunk ID plus filterable ownership metadata.

## Safe rollout

1. Deploy the vector bucket, 1536-dimension cosine index, IAM permissions, and application code
   while `hosting.vectorStore` remains `database`.
2. Preview existing data without writing:

   ```sh
   npm run backfill:vectors
   ```

3. Write existing embeddings idempotently, then verify a tenant-filtered query:

   ```sh
   npm run backfill:vectors -- --write
   npm run backfill:vectors -- --verify
   ```

4. Change `hosting.vectorStore` in the private deployment configuration to `s3-vectors`, deploy
   the CDK stack, and rebuild the Amplify branch.
5. Run document chat smoke tests before leaving the new backend enabled.

The backfill requires `DYNAMODB_TABLE_NAME`, `VECTOR_BUCKET_NAME`, `VECTOR_INDEX_NAME`,
`VECTOR_DIMENSION`, and `VECTOR_STORE=s3-vectors` in the command environment.

## Rollback

Set `hosting.vectorStore` back to `database`, deploy the CDK stack, and rebuild Amplify. Existing
vectors can remain in the retained index while the issue is investigated.

## Asynchronous ingestion

Production uploads use a FIFO SQS queue. The upload API validates the S3 object with a HEAD
request, creates a document in `queued` state, and returns immediately. A small Lambda dispatcher
signs the job with a dedicated Secrets Manager key and calls the protected Amplify processing
route. Failed jobs are retried up to five times before moving to the FIFO dead-letter queue.

Local development remains synchronous when `DOCUMENT_QUEUE_URL` is empty. Document status uses
`updatedAt` so queued or processing jobs become manually retryable after 20 minutes.

CloudWatch alarms monitor the asynchronous pipeline:

- `multi-persona-dev-document-dlq-not-empty` alarms when at least one job reaches the DLQ.
- `multi-persona-dev-document-queue-age` alarms when the oldest queued job is at least 20 minutes old.
- `multi-persona-dev-document-worker-errors` alarms when the dispatcher records an error in a five-minute window.

The alarms intentionally have no notification action until an SNS, email, or chat destination is selected.
