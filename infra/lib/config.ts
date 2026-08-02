import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type DeploymentStage = "dev" | "staging" | "production";

export interface DeploymentConfig {
  awsAccountId: string;
  awsRegion: string;
  projectName: string;
  stageName: DeploymentStage;
  github: {
    owner: string;
    repo: string;
    branch: string;
  };
  hosting: {
    appName: string;
    amplifyGithubTokenSecretName: string;
    runtimeSecretName: string;
    vectorStore: "database" | "s3-vectors";
  };
}

const configDirectory = path.resolve(import.meta.dirname, "../config");
const defaultConfigPath = path.join(configDirectory, "deployment.json");
const exampleConfigPath = path.join(configDirectory, "deployment.example.json");

export function resolveConfigPath(environment = process.env): string {
  const configured = environment.MULTI_PERSONA_DEPLOY_CONFIG?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? path.normalize(configured)
      : path.resolve(environment.INIT_CWD?.trim() || process.cwd(), configured);
  }
  return existsSync(defaultConfigPath) ? defaultConfigPath : exampleConfigPath;
}

export function loadConfig(configPath = resolveConfigPath()): DeploymentConfig {
  if (!existsSync(configPath)) {
    throw new Error(
      `Missing ${configPath}. Copy infra/config/deployment.example.json to deployment.json.`,
    );
  }

  const parsed = JSON.parse(readFileSync(configPath, "utf8")) as Partial<DeploymentConfig>;
  const stageName = parsed.stageName;
  if (stageName !== "dev" && stageName !== "staging" && stageName !== "production") {
    throw new Error("stageName must be dev, staging, or production.");
  }

  const projectName = normalizeName(parsed.projectName, "projectName");
  return {
    awsAccountId: parsed.awsAccountId?.trim() ?? "",
    awsRegion: parsed.awsRegion?.trim() ?? "",
    projectName,
    stageName,
    github: {
      owner: requireText(parsed.github?.owner, "github.owner"),
      repo: requireText(parsed.github?.repo, "github.repo"),
      branch: requireText(parsed.github?.branch, "github.branch"),
    },
    hosting: {
      appName: parsed.hosting?.appName?.trim() || `${projectName}-${stageName}-web`,
      amplifyGithubTokenSecretName:
        parsed.hosting?.amplifyGithubTokenSecretName?.trim() ?? "",
      runtimeSecretName: parsed.hosting?.runtimeSecretName?.trim() ?? "",
      vectorStore:
        parsed.hosting?.vectorStore === "s3-vectors" ? "s3-vectors" : "database",
    },
  };
}

export function loadDeploymentReadyConfig(): DeploymentConfig {
  const configPath = resolveConfigPath();
  if (path.resolve(configPath) === path.resolve(exampleConfigPath)) {
    throw new Error(
      "Refusing to deploy from deployment.example.json. Create infra/config/deployment.json first.",
    );
  }
  const config = loadConfig(configPath);
  validateDeploymentReady(config);
  return config;
}

export function validateDeploymentReady(config: DeploymentConfig): void {
  if (!/^\d{12}$/.test(config.awsAccountId) || /^([0-9])\1{11}$/.test(config.awsAccountId)) {
    throw new Error("awsAccountId must be a real 12-digit AWS account id.");
  }
  if (!/^[a-z]{2}(?:-[a-z0-9]+)+-\d+$/.test(config.awsRegion)) {
    throw new Error("awsRegion is invalid.");
  }

  for (const [name, value] of [
    ["github.owner", config.github.owner],
    ["github.repo", config.github.repo],
    ["github.branch", config.github.branch],
    ["hosting.appName", config.hosting.appName],
    ["hosting.amplifyGithubTokenSecretName", config.hosting.amplifyGithubTokenSecretName],
    ["hosting.runtimeSecretName", config.hosting.runtimeSecretName],
  ] as const) {
    if (!value || /FILL_ME|REPLACE|PLACEHOLDER/i.test(value)) {
      throw new Error(`${name} must be configured before deployment.`);
    }
  }

  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(config.github.owner)) {
    throw new Error("github.owner must be one exact GitHub owner.");
  }
  if (!/^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/.test(config.github.repo)) {
    throw new Error("github.repo must be one exact GitHub repository.");
  }
  if (!/^(?!.*\.\.)(?!.*[~^:?*\[\\])[A-Za-z0-9._/-]+$/.test(config.github.branch)) {
    throw new Error("github.branch must be one exact branch without wildcards.");
  }
}

export function stackBaseName(config: Pick<DeploymentConfig, "projectName" | "stageName">) {
  return `${config.projectName}-${config.stageName}`;
}

function normalizeName(value: string | undefined, field: string): string {
  const normalized = requireText(value, field).toLowerCase();
  if (!/^[a-z][a-z0-9-]{1,38}[a-z0-9]$/.test(normalized)) {
    throw new Error(`${field} must be 3-40 lowercase letters, digits, or hyphens.`);
  }
  return normalized;
}

function requireText(value: string | undefined, field: string): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}
