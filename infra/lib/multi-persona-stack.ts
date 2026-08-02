import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import * as amplify from "aws-cdk-lib/aws-amplify";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUrlIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
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
    const runtimeSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "RuntimeSecret",
      props.config.hosting.runtimeSecretName,
    );
    const computeRole = new iam.Role(this, "AmplifyComputeRole", {
      roleName: `${baseName}-amplify-compute-role`,
      description: "Least-privilege role used by the Amplify Next.js SSR runtime.",
      assumedBy: new iam.ServicePrincipal("amplify.amazonaws.com"),
    });
    runtimeSecret.grantRead(computeRole);
    database.grant(
      computeRole,
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:ConditionCheckItem",
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
  }
}

function amplifyStage(stage: DeploymentStage): "DEVELOPMENT" | "BETA" | "PRODUCTION" {
  if (stage === "production") return "PRODUCTION";
  if (stage === "staging") return "BETA";
  return "DEVELOPMENT";
}
