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
