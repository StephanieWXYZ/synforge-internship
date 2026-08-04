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
  assert.equal(config.monitoring?.alertEmail, "alerts@example.com");
});

test("rejects placeholder account ids and secret names for deployment", () => {
  const config = loadConfig(fixture);
  assert.throws(() => validateDeploymentReady(config), /awsAccountId/);
});
