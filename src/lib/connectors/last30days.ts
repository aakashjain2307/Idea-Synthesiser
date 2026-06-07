import { execFile as execFileCallback } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { compactText, parseDate } from "@/lib/json";
import type {
  NormalizedCluster,
  NormalizedEvidence,
  NormalizedProject
} from "@/lib/types";

const execFile = promisify(execFileCallback);

export type Last30DaysPlan = {
  raw_topic: string;
  intent: string;
  freshness_mode: string;
  cluster_mode: string;
  subqueries: Array<{
    label: string;
    search_query: string;
    ranking_query: string;
    sources: string[];
    weight: number;
  }>;
  source_weights?: Record<string, number>;
  notes?: string[];
};

export type Last30DaysRunInput = {
  topic: string;
  lookbackDays: number;
  plan?: Last30DaysPlan | null;
  saveDir: string;
  timeoutMs?: number;
};

export type Last30DaysResult = {
  payload: Record<string, unknown>;
  stdout: string;
  stderr: string;
  rawPath?: string;
  normalized: {
    evidence: NormalizedEvidence[];
    projects: NormalizedProject[];
    clusters: NormalizedCluster[];
    coverage: Record<string, number>;
    warnings: string[];
  };
};

type ExecFileLike = (
  file: string,
  args: readonly string[],
  options: {
    timeout: number;
    maxBuffer: number;
    env: NodeJS.ProcessEnv;
  }
) => Promise<{ stdout: string | Buffer; stderr: string | Buffer }>;

export function getLast30DaysConfig() {
  const skillDir =
    process.env.LAST30DAYS_SKILL_DIR ?? "/Users/aakashjain/.agents/skills/last30days";
  const defaultCertPath = "/etc/ssl/cert.pem";
  return {
    skillDir,
    python: process.env.LAST30DAYS_PYTHON ?? "python3",
    scriptPath: path.join(skillDir, "scripts", "last30days.py"),
    sslCertFile:
      process.env.SSL_CERT_FILE ?? (existsSync(defaultCertPath) ? defaultCertPath : undefined)
  };
}

export function extractFirstJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  if (start === -1) {
    throw new Error("No JSON object found in last30days output.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(text.slice(start, index + 1)) as Record<string, unknown>;
      }
    }
  }

  throw new Error("Incomplete JSON object in last30days output.");
}

export async function runLast30Days(
  input: Last30DaysRunInput,
  runner: ExecFileLike = execFile
): Promise<Last30DaysResult> {
  const { python, scriptPath, sslCertFile } = getLast30DaysConfig();
  if (!existsSync(scriptPath)) {
    throw new Error(`last30days script was not found at ${scriptPath}`);
  }

  await mkdir(input.saveDir, { recursive: true });

  const args = [
    scriptPath,
    input.topic,
    "--emit=json",
    "--days",
    String(input.lookbackDays),
    "--save-dir",
    input.saveDir
  ];

  let planPath: string | null = null;
  if (input.plan) {
    const dir = await mkdtemp(path.join(tmpdir(), "idea-synth-plan-"));
    planPath = path.join(dir, "last30days-plan.json");
    await writeFile(planPath, JSON.stringify(input.plan, null, 2), "utf8");
    args.push("--plan", planPath);
  }

  if (process.env.LAST30DAYS_MOCK === "1") {
    args.push("--mock");
  }

  const result = await runner(python, args, {
    timeout: input.timeoutMs ?? 300000,
    maxBuffer: 1024 * 1024 * 24,
    env: {
      ...process.env,
      ...(sslCertFile ? { SSL_CERT_FILE: sslCertFile } : {})
    }
  });

  const stdout = result.stdout?.toString() ?? "";
  const stderr = result.stderr?.toString() ?? "";
  const payload = extractFirstJsonObject(stdout);
  const rawPath = extractSavedPath(stdout);

  return {
    payload,
    stdout,
    stderr,
    rawPath,
    normalized: normalizeLast30DaysPayload(payload)
  };
}

export function normalizeLast30DaysPayload(payload: Record<string, unknown>) {
  const itemsBySource = objectRecord(payload.items_by_source);
  const evidence: NormalizedEvidence[] = [];
  const projects: NormalizedProject[] = [];
  const coverage: Record<string, number> = {};

  for (const [source, items] of Object.entries(itemsBySource)) {
    const rows = Array.isArray(items) ? items : [];
    coverage[source] = rows.length;

    rows.forEach((raw, index) => {
      const item = objectRecord(raw);
      const metadata = objectRecord(item.metadata);
      const title = compactText(item.title ?? item.body ?? `${source} item ${index + 1}`, 180);
      const url = stringOrUndefined(item.url);

      evidence.push({
        source,
        externalId: stringOrUndefined(item.item_id) ?? url ?? `${source}:${index}`,
        title,
        url,
        body: stringOrUndefined(item.body),
        snippet: stringOrUndefined(item.snippet),
        author: stringOrUndefined(item.author) ?? stringOrUndefined(metadata.username),
        container: stringOrUndefined(item.container),
        publishedAt: parseDate(item.published_at),
        engagement: item.engagement,
        score: numberOrUndefined(item.final_score) ?? numberOrUndefined(item.local_rank_score),
        metadata,
        raw: item
      });

      const project = projectFromLast30DaysItem(source, item);
      if (project) {
        projects.push(project);
      }
    });
  }

  const clusters = Array.isArray(payload.clusters)
    ? payload.clusters.map((raw, index) => {
        const cluster = objectRecord(raw);
        return {
          externalId: stringOrUndefined(cluster.cluster_id) ?? `cluster:${index}`,
          title: compactText(cluster.title ?? `Cluster ${index + 1}`, 220),
          score: numberOrUndefined(cluster.score),
          sources: stringArray(cluster.sources),
          representativeIds: stringArray(cluster.representative_ids),
          candidateIds: stringArray(cluster.candidate_ids),
          raw: cluster
        };
      })
    : [];

  return {
    evidence,
    projects,
    clusters,
    coverage,
    warnings: stringArray(payload.warnings)
  };
}

function projectFromLast30DaysItem(
  source: string,
  item: Record<string, unknown>
): NormalizedProject | null {
  const url = stringOrUndefined(item.url);
  const repo = parseGitHubRepo(url);

  if (source !== "github" && !repo) {
    return null;
  }

  const metadata = objectRecord(item.metadata);
  const fullName =
    stringOrUndefined(metadata.full_name) ??
    stringOrUndefined(metadata.repo) ??
    repo?.fullName;

  return {
    source: "last30days",
    externalId: stringOrUndefined(item.item_id) ?? url,
    name: fullName?.split("/").at(-1) ?? compactText(item.title ?? "GitHub project", 120),
    fullName,
    url,
    description: stringOrUndefined(item.snippet) ?? stringOrUndefined(item.body),
    language: stringOrUndefined(metadata.language),
    stars: numberOrUndefined(metadata.stars) ?? numberOrUndefined(metadata.stargazers_count),
    forks: numberOrUndefined(metadata.forks) ?? numberOrUndefined(metadata.forks_count),
    openIssues: numberOrUndefined(metadata.open_issues_count),
    owner: fullName?.split("/")[0] ?? repo?.owner,
    createdAtSource: parseDate(metadata.created_at),
    pushedAtSource: parseDate(metadata.pushed_at),
    topics: stringArray(metadata.topics),
    metadata,
    raw: item
  };
}

function parseGitHubRepo(url?: string) {
  if (!url) {
    return null;
  }
  const match = url.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (!match) {
    return null;
  }
  return {
    owner: match[1],
    name: match[2],
    fullName: `${match[1]}/${match[2]}`
  };
}

function extractSavedPath(stdout: string) {
  const match = stdout.match(/\[last30days\]\s+Saved output to\s+(.+)$/m);
  return match?.[1]?.trim();
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}
