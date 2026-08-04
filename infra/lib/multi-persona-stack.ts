import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import * as amplify from "aws-cdk-lib/aws-amplify";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUrlIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { DeploymentConfig, DeploymentStage, stackBaseName } from "./config.js";

interface MultiPersonaStackProps extends cdk.StackProps {
  config: DeploymentConfig;
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const amplifyBuildSpec = readFileSync(path.join(projectRoot, "amplify.yml"), "utf8").trim();

export class MultiPersonaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MultiPersonaStackProps) {
    super(scope, id, props);

    const baseName = stackBaseName(props.config);
    const database = new dynamodb.Table(this, "DatabaseTable", {
      tableName: `${baseName}-data`,
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expiresAtEpoch",
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    database.addGlobalSecondaryIndex({
      indexName: "owner-index",
      partitionKey: { name: "ownerPk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "ownerSk", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    database.addGlobalSecondaryIndex({
      indexName: "related-index",
      partitionKey: { name: "relatedPk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "relatedSk", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    const uploadBucket = new s3.Bucket(this, "UploadBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 300,
        },
      ],
    });
    const vectorBucketName = `${baseName}-vectors`;
    const vectorIndexName = "chunks-v1-1536";
    const vectorBucket = new cdk.CfnResource(this, "VectorBucket", {
      type: "AWS::S3Vectors::VectorBucket",
      properties: {
        VectorBucketName: vectorBucketName,
      },
    });
    vectorBucket.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    const vectorIndex = new cdk.CfnResource(this, "VectorIndex", {
      type: "AWS::S3Vectors::Index",
      properties: {
        VectorBucketName: vectorBucketName,
        IndexName: vectorIndexName,
        DataType: "float32",
        Dimension: 1536,
        DistanceMetric: "cosine",
      },
    });
    vectorIndex.addResourceDependency(vectorBucket);
    vectorIndex.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    const runtimeSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "RuntimeSecret",
      props.config.hosting.runtimeSecretName,
    );
    const workerSecret = new secretsmanager.Secret(this, "WorkerSecret", {
      secretName: `${baseName}-document-worker`,
      description: "HMAC key used only between the SQS dispatcher and document worker route.",
      generateSecretString: {
        passwordLength: 48,
        excludePunctuation: true,
      },
    });
    const documentDeadLetterQueue = new sqs.Queue(this, "DocumentDeadLetterQueue", {
      queueName: `${baseName}-document-dlq.fifo`,
      fifo: true,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });
    const documentQueue = new sqs.Queue(this, "DocumentQueue", {
      queueName: `${baseName}-document.fifo`,
      fifo: true,
      retentionPeriod: cdk.Duration.days(4),
      visibilityTimeout: cdk.Duration.minutes(84),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        queue: documentDeadLetterQueue,
        maxReceiveCount: 5,
      },
    });
    const computeRole = new iam.Role(this, "AmplifyComputeRole", {
      roleName: `${baseName}-amplify-compute-role`,
      description: "Least-privilege role used by the Amplify Next.js SSR runtime.",
      assumedBy: new iam.ServicePrincipal("amplify.amazonaws.com"),
    });
    runtimeSecret.grantRead(computeRole);
    workerSecret.grantRead(computeRole);
    documentQueue.grantSendMessages(computeRole);
    database.grant(
      computeRole,
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:ConditionCheckItem",
    );
    computeRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
        resources: [`${uploadBucket.bucketArn}/*`],
      }),
    );
    computeRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "s3vectors:PutVectors",
          "s3vectors:QueryVectors",
          "s3vectors:GetVectors",
          "s3vectors:DeleteVectors",
        ],
        resources: [vectorIndex.ref],
      }),
    );

    const amplifyApp = new amplify.CfnApp(this, "AmplifyApp", {
      name: props.config.hosting.appName,
      repository: `https://github.com/${props.config.github.owner}/${props.config.github.repo}`,
      accessToken: cdk.SecretValue.secretsManager(
        props.config.hosting.amplifyGithubTokenSecretName,
      ).unsafeUnwrap(),
      platform: "WEB_COMPUTE",
      computeRoleArn: computeRole.roleArn,
      enableBranchAutoDeletion: false,
      buildSpec: amplifyBuildSpec,
      environmentVariables: [
        { name: "DYNAMODB_TABLE_NAME", value: database.tableName },
        { name: "RUNTIME_SECRET_NAME", value: props.config.hosting.runtimeSecretName },
        { name: "UPLOAD_BUCKET_NAME", value: uploadBucket.bucketName },
        { name: "VECTOR_BUCKET_NAME", value: vectorBucketName },
        { name: "VECTOR_INDEX_NAME", value: vectorIndexName },
        { name: "VECTOR_DIMENSION", value: "1536" },
        { name: "VECTOR_EMBEDDING_VERSION", value: "v1" },
        { name: "VECTOR_STORE", value: props.config.hosting.vectorStore },
        { name: "DOCUMENT_QUEUE_URL", value: documentQueue.queueUrl },
        { name: "WORKER_SECRET_NAME", value: workerSecret.secretName },
      ],
    });

    const amplifyBranch = new amplify.CfnBranch(this, "AmplifyBranch", {
      appId: amplifyApp.attrAppId,
      branchName: props.config.github.branch,
      enableAutoBuild: true,
      framework: "Next.js - SSR",
      stage: amplifyStage(props.config.stageName),
    });
    const amplifyOrigin = `https://${amplifyBranch.branchName}.${amplifyApp.attrDefaultDomain}`;

    const documentWorker = new lambdaNodejs.NodejsFunction(this, "DocumentWorker", {
      functionName: `${baseName}-document-worker`,
      description: "Dispatches queued document jobs to the protected Amplify processing route.",
      entry: path.join(projectRoot, "workers/documentProcessor.ts"),
      handler: "handler",
      projectRoot,
      depsLockFilePath: path.join(projectRoot, "package-lock.json"),
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.X86_64,
      memorySize: 256,
      timeout: cdk.Duration.minutes(14),
      bundling: {
        minify: true,
        sourceMap: true,
      },
      environment: {
        AMPLIFY_ORIGIN: amplifyOrigin,
        WORKER_SECRET_NAME: workerSecret.secretName,
      },
    });
    workerSecret.grantRead(documentWorker);
    documentWorker.addEventSource(
      new lambdaEventSources.SqsEventSource(documentQueue, {
        batchSize: 1,
        reportBatchItemFailures: true,
      }),
    );

    const documentDeadLetterAlarm = new cloudwatch.Alarm(this, "DocumentDeadLetterAlarm", {
      alarmName: `${baseName}-document-dlq-not-empty`,
      alarmDescription: "A document processing job exhausted its retries and entered the DLQ.",
      metric: documentDeadLetterQueue.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(1),
        statistic: "Maximum",
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    const documentQueueAgeAlarm = new cloudwatch.Alarm(this, "DocumentQueueAgeAlarm", {
      alarmName: `${baseName}-document-queue-age`,
      alarmDescription: "The oldest document processing job has waited for at least 20 minutes.",
      metric: documentQueue.metricApproximateAgeOfOldestMessage({
        period: cdk.Duration.minutes(5),
        statistic: "Maximum",
      }),
      threshold: cdk.Duration.minutes(20).toSeconds(),
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    const documentWorkerErrorAlarm = new cloudwatch.Alarm(this, "DocumentWorkerErrorAlarm", {
      alarmName: `${baseName}-document-worker-errors`,
      alarmDescription: "The document queue dispatcher returned at least one error in five minutes.",
      metric: documentWorker.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: "Sum",
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    let documentAlarmTopic: sns.Topic | undefined;
    const alertEmail = props.config.monitoring?.alertEmail;
    if (alertEmail) {
      documentAlarmTopic = new sns.Topic(this, "DocumentAlarmTopic", {
        topicName: `${baseName}-document-alarms`,
        displayName: "Multi Persona document processing alarms",
      });
      documentAlarmTopic.addSubscription(new snsSubscriptions.EmailSubscription(alertEmail));
      const alarmAction = new cloudwatchActions.SnsAction(documentAlarmTopic);
      documentDeadLetterAlarm.addAlarmAction(alarmAction);
      documentQueueAgeAlarm.addAlarmAction(alarmAction);
      documentWorkerErrorAlarm.addAlarmAction(alarmAction);
    }

    const api = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: `${baseName}-http-api`,
      corsPreflight: {
        allowOrigins: ["*"],
        allowHeaders: ["authorization", "content-type"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        maxAge: cdk.Duration.days(1),
      },
    });
    const integration = new HttpUrlIntegration("AmplifyApiIntegration", amplifyOrigin, {
      parameterMapping: new apigwv2.ParameterMapping().overwritePath(
        apigwv2.MappingValue.requestPath(),
      ),
    });
    api.addRoutes({
      path: "/api",
      methods: [apigwv2.HttpMethod.ANY],
      integration,
    });
    api.addRoutes({
      path: "/api/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration,
    });

    const defaultStage = api.defaultStage?.node.defaultChild as apigwv2.CfnStage;
    defaultStage.defaultRouteSettings = {
      throttlingBurstLimit: 20,
      throttlingRateLimit: 10,
    };

    new cdk.CfnOutput(this, "AmplifyAppId", { value: amplifyApp.attrAppId });
    new cdk.CfnOutput(this, "AmplifyFrontendUrl", { value: amplifyOrigin });
    new cdk.CfnOutput(this, "ApiBaseUrl", { value: api.apiEndpoint });
    new cdk.CfnOutput(this, "DatabaseTableName", { value: database.tableName });
    new cdk.CfnOutput(this, "UploadBucketName", { value: uploadBucket.bucketName });
    new cdk.CfnOutput(this, "VectorBucketName", { value: vectorBucketName });
    new cdk.CfnOutput(this, "VectorIndexName", { value: vectorIndexName });
    new cdk.CfnOutput(this, "DocumentQueueUrl", { value: documentQueue.queueUrl });
    new cdk.CfnOutput(this, "DocumentDeadLetterQueueUrl", {
      value: documentDeadLetterQueue.queueUrl,
    });
    new cdk.CfnOutput(this, "DocumentWorkerName", { value: documentWorker.functionName });
    new cdk.CfnOutput(this, "DocumentDeadLetterAlarmName", {
      value: documentDeadLetterAlarm.alarmName,
    });
    new cdk.CfnOutput(this, "DocumentQueueAgeAlarmName", {
      value: documentQueueAgeAlarm.alarmName,
    });
    new cdk.CfnOutput(this, "DocumentWorkerErrorAlarmName", {
      value: documentWorkerErrorAlarm.alarmName,
    });
    if (documentAlarmTopic) {
      new cdk.CfnOutput(this, "DocumentAlarmTopicArn", {
        value: documentAlarmTopic.topicArn,
      });
    }
  }
}

function amplifyStage(stage: DeploymentStage): "DEVELOPMENT" | "BETA" | "PRODUCTION" {
  if (stage === "production") return "PRODUCTION";
  if (stage === "staging") return "BETA";
  return "DEVELOPMENT";
}
