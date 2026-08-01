#!/usr/bin/env node
import { loadDeploymentReadyConfig } from "../lib/config.js";

const config = loadDeploymentReadyConfig();
console.log(
  `Deployment config is valid for ${config.projectName}-${config.stageName} in ${config.awsRegion}.`,
);
