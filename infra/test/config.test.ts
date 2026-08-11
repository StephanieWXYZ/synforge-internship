import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, validateDeploymentReady } from "../lib/config.js";

const fixture = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../config/deployment.example.json",
);

test("loads the checked-in example configuration for synthesis", () => {
  const config = loadConfig(fixture);
  assert.equal(config.projectName, "multi-persona");
  assert.equal(config.github.repo, "multi-persona");
  assert.equal(config.hosting.vectorStore, "database");
  assert.equal(config.identity.rolloutEnabled, false);
  assert.equal(config.identity.appUrl, "https://experts.thesyncforge.com");
  assert.match(config.identity.issuer, /^https:\/\//);
  assert.equal(config.monitoring?.alertEmail, "alerts@example.com");
});

test("rejects invalid OIDC deployment values", () => {
  const config = loadConfig(fixture);
  config.awsAccountId = "103655991246";
  config.github.owner = "tsf-Jack";
  config.hosting.amplifyGithubTokenSecretName = "github-token";
  config.hosting.runtimeSecretName = "runtime-secret";
  config.identity.domain = "http://insecure.example.com";
  assert.throws(() => validateDeploymentReady(config), /identity.domain/);
  config.identity.domain = "https://auth.thesyncforge.com";
  config.identity.appUrl = "http://insecure.example.com";
  assert.throws(() => validateDeploymentReady(config), /identity.appUrl/);
});

test("rejects placeholder account ids and secret names for deployment", () => {
  const config = loadConfig(fixture);
  assert.throws(() => validateDeploymentReady(config), /awsAccountId/);
});
