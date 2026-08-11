import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { loadConfig, stackBaseName } from "../lib/config.js";
import { MultiPersonaStack } from "../lib/multi-persona-stack.js";

const fixture = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../config/deployment.example.json",
);

test("synthesizes Amplify SSR and an API Gateway proxy", () => {
  const config = loadConfig(fixture);
  const app = new cdk.App();
  const stack = new MultiPersonaStack(app, `${stackBaseName(config)}-test`, {
    config,
    env: { account: config.awsAccountId, region: config.awsRegion },
  });
  const template = Template.fromStack(stack);

  template.resourceCountIs("AWS::Amplify::App", 1);
  template.resourceCountIs("AWS::Amplify::Branch", 1);
  template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);
  template.resourceCountIs("AWS::IAM::Role", 2);
  template.resourceCountIs("AWS::SQS::Queue", 2);
  template.resourceCountIs("AWS::Lambda::Function", 1);
  template.resourceCountIs("AWS::Lambda::EventSourceMapping", 1);
  template.resourceCountIs("AWS::CloudWatch::Alarm", 3);
  template.resourceCountIs("AWS::SNS::Topic", 1);
  template.resourceCountIs("AWS::SNS::Subscription", 1);
  template.hasResourceProperties("AWS::Amplify::App", { Platform: "WEB_COMPUTE" });
  template.hasResourceProperties("AWS::Amplify::Branch", {
    EnableAutoBuild: true,
    Framework: "Next.js - SSR",
    EnvironmentVariables: [
      { Name: "COGNITO_ISSUER", Value: config.identity.issuer },
      { Name: "COGNITO_DOMAIN", Value: config.identity.domain },
      { Name: "COGNITO_CLIENT_ID", Value: config.identity.clientId },
      { Name: "NEXT_PUBLIC_APP_URL", Value: config.identity.appUrl },
      { Name: "OIDC_ROLLOUT_ENABLED", Value: "false" },
    ],
  });

  const json = JSON.stringify(template.toJSON());
  assert.match(json, /AWS::DynamoDB::Table/);
  assert.match(json, /DYNAMODB_TABLE_NAME/);
  assert.match(json, /owner-index/);
  assert.match(json, /related-index/);
  assert.match(json, /RUNTIME_SECRET_NAME/);
  assert.match(json, /npm run build/);
  assert.match(json, /npm run verify:deployment/);
  assert.match(json, /AWS::S3::Bucket/);
  assert.match(json, /UPLOAD_BUCKET_NAME/);
  assert.match(json, /AWS::S3Vectors::VectorBucket/);
  assert.match(json, /AWS::S3Vectors::Index/);
  assert.match(json, /VECTOR_BUCKET_NAME/);
  assert.match(json, /VECTOR_INDEX_NAME/);
  assert.match(json, /s3vectors:QueryVectors/);
  assert.match(json, /s3vectors:PutVectors/);
  assert.match(json, /s3:PutObject/);
  assert.match(json, /DOCUMENT_QUEUE_URL/);
  assert.match(json, /WORKER_SECRET_NAME/);
  assert.match(json, /sqs:SendMessage/);
  assert.match(json, /ReportBatchItemFailures/);
  assert.match(json, /document-dlq\.fifo/);
  assert.match(json, /document-dlq-not-empty/);
  assert.match(json, /document-queue-age/);
  assert.match(json, /document-worker-errors/);
  assert.match(json, /ApproximateAgeOfOldestMessage/);
  assert.match(json, /ApproximateNumberOfMessagesVisible/);
  assert.match(json, /AWS\/Lambda/);
  assert.match(json, /alerts@example\.com/);
  assert.match(json, /document-alarms/);
  assert.match(json, /AlarmActions/);
  assert.match(json, /DOCUMENT_QUEUE_URL/);
  assert.match(json, /CorsConfiguration/);
  assert.match(json, /secretsmanager:GetSecretValue/);
  assert.match(json, /\/api\/\{proxy\+\}/);
  assert.match(json, /overwrite:path/);
});
