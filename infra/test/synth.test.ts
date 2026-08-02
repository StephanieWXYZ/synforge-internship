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
  template.resourceCountIs("AWS::IAM::Role", 1);
  template.hasResourceProperties("AWS::Amplify::App", { Platform: "WEB_COMPUTE" });
  template.hasResourceProperties("AWS::Amplify::Branch", {
    EnableAutoBuild: true,
    Framework: "Next.js - SSR",
  });

  const json = JSON.stringify(template.toJSON());
  assert.match(json, /AWS::DynamoDB::Table/);
  assert.match(json, /DYNAMODB_TABLE_NAME/);
  assert.match(json, /owner-index/);
  assert.match(json, /related-index/);
  assert.match(json, /RUNTIME_SECRET_NAME/);
  assert.match(json, /AWS::S3::Bucket/);
  assert.match(json, /UPLOAD_BUCKET_NAME/);
  assert.match(json, /s3:PutObject/);
  assert.match(json, /secretsmanager:GetSecretValue/);
  assert.match(json, /\/api\/\{proxy\+\}/);
  assert.match(json, /overwrite:path/);
});
