#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import {
  loadConfig,
  loadDeploymentReadyConfig,
  stackBaseName,
} from "../lib/config.js";
import { MultiPersonaStack } from "../lib/multi-persona-stack.js";

const config =
  process.env.MULTI_PERSONA_REQUIRE_DEPLOYMENT_READY === "true"
    ? loadDeploymentReadyConfig()
    : loadConfig();
const app = new cdk.App();
const baseName = stackBaseName(config);
const env = { account: config.awsAccountId, region: config.awsRegion };

new MultiPersonaStack(app, `${baseName}-app`, { config, env });
