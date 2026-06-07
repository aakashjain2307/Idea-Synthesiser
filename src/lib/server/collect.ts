import path from "node:path";
import { prisma } from "@/lib/server/prisma";
import { toJson } from "@/lib/json";
import { runLast30Days } from "@/lib/connectors/last30days";
import { scoutGitHub } from "@/lib/connectors/github";
import {
  briefToLast30DaysPlan,
  buildIntentSearchPlan,
  type SearchBrief
} from "@/lib/intent";
import type {
  NormalizedCluster,
  NormalizedEvidence,
  NormalizedProject
} from "@/lib/types";
import { fromJson } from "@/lib/json";

export async function collectRun(runId: string) {
  const run = await prisma.researchRun.findUnique({ where: { id: runId } });
  if (!run) {
    throw new Error("Research run not found.");
  }

  await prisma.researchRun.update({
    where: { id: runId },
    data: { status: "collecting", error: null }
  });

  await prisma.$transaction([
    prisma.evidenceItem.deleteMany({ where: { runId } }),
    prisma.projectSignal.deleteMany({ where: { runId } }),
    prisma.cluster.deleteMany({ where: { runId } }),
    prisma.sourceRun.deleteMany({ where: { runId } })
  ]);

  const warnings: string[] = [];
  let coverage: Record<string, number> = {};
  let last30daysRawPath: string | undefined;
  let last30daysStdout: string | undefined;
  let last30daysPlan: unknown = null;

  const evidence: NormalizedEvidence[] = [];
  const projects: NormalizedProject[] = [];
  const clusters: NormalizedCluster[] = [];

  const userGithubLanguages = fromJson<string[]>(run.githubLanguages, []);
  const userGithubTopics = fromJson<string[]>(run.githubTopics, []);
  const intentPlan = await buildIntentSearchPlan({
    intent: run.topic,
    lookbackDays: run.lookbackDays,
    githubLanguages: userGithubLanguages,
    githubTopics: userGithubTopics
  });
  warnings.push(...intentPlan.warnings);

  await prisma.sourceRun.create({
    data: {
      runId,
      source: "intent",
      status: "complete",
      finishedAt: new Date(),
      countsJson: toJson({ briefs: intentPlan.briefs.length }),
      warningsJson: toJson(intentPlan.warnings),
      rawJson: toJson(intentPlan)
    }
  });

  const concurrency = Number(process.env.INTENT_SEARCH_CONCURRENCY ?? 2);
  const last30daysPlans: Record<string, unknown> = {};
  const rawPaths: string[] = [];
  const stdoutSummaries: Array<{ briefId: string; label: string; rawPath?: string; stdout: string }> = [];

  await mapWithConcurrency(intentPlan.briefs, concurrency, async (brief) => {
    const sourceRun = await prisma.sourceRun.create({
      data: {
        runId,
        source: `last30days:${brief.id}`,
        status: "running",
        rawJson: toJson({ brief })
      }
    });

    try {
      const providerPlan = briefToLast30DaysPlan(brief);
      last30daysPlans[brief.id] = providerPlan;
      const result = await runLast30Days({
        topic: brief.searchQuery,
        lookbackDays: run.lookbackDays,
        plan: providerPlan,
        saveDir: path.join(process.cwd(), ".idea-synthesizer", "last30days")
      });

      evidence.push(...tagEvidence(result.normalized.evidence, brief));
      projects.push(...tagProjects(result.normalized.projects, brief));
      clusters.push(...tagClusters(result.normalized.clusters, brief));
      mergeCoverage(coverage, result.normalized.coverage);
      warnings.push(...result.normalized.warnings.map((warning) => `${brief.label}: ${warning}`));
      if (result.rawPath) {
        rawPaths.push(result.rawPath);
      }
      stdoutSummaries.push({
        briefId: brief.id,
        label: brief.label,
        rawPath: result.rawPath,
        stdout: result.stdout.slice(0, 8000)
      });

      await prisma.sourceRun.update({
        where: { id: sourceRun.id },
        data: {
          status: "complete",
          finishedAt: new Date(),
          countsJson: toJson(result.normalized.coverage),
          warningsJson: toJson(result.normalized.warnings),
          rawJson: toJson({ brief, stderr: result.stderr, rawPath: result.rawPath })
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Last30Days failed.";
      warnings.push(`${brief.label}: ${message}`);
      await prisma.sourceRun.update({
        where: { id: sourceRun.id },
        data: { status: "failed", finishedAt: new Date(), error: message, rawJson: toJson({ brief }) }
      });
    }
  });

  await mapWithConcurrency(intentPlan.briefs, concurrency, async (brief) => {
    const sourceRun = await prisma.sourceRun.create({
      data: {
        runId,
        source: `github:${brief.id}`,
        status: "running",
        rawJson: toJson({ brief })
      }
    });

    try {
      const github = await scoutGitHub({
        topic: brief.searchQuery,
        lookbackDays: run.lookbackDays,
        languages: mergeLists(userGithubLanguages, brief.githubLanguages),
        topics: githubTopicsForBrief(userGithubTopics, brief.githubTopics),
        limit: 20
      });
      projects.push(...tagProjects(github.projects, brief));
      warnings.push(...github.warnings.map((warning) => `${brief.label}: ${warning}`));

      await prisma.sourceRun.update({
        where: { id: sourceRun.id },
        data: {
          status: "complete",
          finishedAt: new Date(),
          countsJson: toJson({ projects: github.projects.length }),
          warningsJson: toJson(github.warnings),
          rawJson: toJson({ brief })
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "GitHub Scout failed.";
      warnings.push(`${brief.label}: ${message}`);
      await prisma.sourceRun.update({
        where: { id: sourceRun.id },
        data: { status: "failed", finishedAt: new Date(), error: message, rawJson: toJson({ brief }) }
      });
    }
  });

  evidence.push(...manualEvidence(run.manualEvidence));

  await saveEvidence(runId, dedupeEvidence(evidence));
  await saveProjects(runId, dedupeProjects(projects));
  await saveClusters(runId, clusters);

  return prisma.researchRun.update({
    where: { id: runId },
    data: {
      status: "collected",
      warnings: toJson(warnings),
      sourceCoverage: toJson(coverage),
      last30daysRawPath: rawPaths.join("\n") || last30daysRawPath,
      last30daysStdout: toJson(stdoutSummaries) || last30daysStdout,
      last30daysPlan: toJson({
        intentPlan,
        last30daysPlans
      })
    },
    include: runInclude
  });
}

export const runInclude = {
  evidenceItems: { orderBy: { createdAt: "desc" as const } },
  projectSignals: { orderBy: [{ starVelocity: "desc" as const }, { stars: "desc" as const }] },
  clusters: { orderBy: { score: "desc" as const } },
  opportunities: {
    orderBy: { createdAt: "desc" as const },
    include: {
      buildArtifacts: {
        orderBy: { createdAt: "desc" as const },
        take: 1
      },
      learnArtifacts: {
        orderBy: { createdAt: "desc" as const },
        take: 1
      }
    }
  },
  sourceRuns: { orderBy: { startedAt: "asc" as const } }
};

function manualEvidence(value: string | null): NormalizedEvidence[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(/\n{2,}|\n-/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const url = item.match(/https?:\/\/\S+/)?.[0];
      return {
        source: "manual",
        externalId: `manual:${index + 1}`,
        title: `Manual evidence ${index + 1}`,
        url,
        body: item,
        snippet: item.slice(0, 260),
        score: 50,
        raw: { text: item }
      };
    });
}

function dedupeEvidence(items: NormalizedEvidence[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.url ?? `${item.source}:${item.externalId ?? item.title}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupeProjects(items: NormalizedProject[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.fullName ?? item.url ?? `${item.source}:${item.name}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function tagEvidence(items: NormalizedEvidence[], brief: SearchBrief): NormalizedEvidence[] {
  return items.map((item) => ({
    ...item,
    metadata: {
      ...(objectRecord(item.metadata)),
      intentBrief: brief
    },
    raw: {
      item: item.raw,
      intentBrief: brief
    }
  }));
}

function tagProjects(items: NormalizedProject[], brief: SearchBrief): NormalizedProject[] {
  return items.map((item) => ({
    ...item,
    metadata: {
      ...(objectRecord(item.metadata)),
      intentBrief: brief
    },
    raw: {
      item: item.raw,
      intentBrief: brief
    }
  }));
}

function tagClusters(items: NormalizedCluster[], brief: SearchBrief): NormalizedCluster[] {
  return items.map((item) => ({
    ...item,
    title: `${brief.label}: ${item.title}`,
    sources: [...(item.sources ?? []), brief.id],
    raw: {
      item: item.raw,
      intentBrief: brief
    }
  }));
}

function mergeCoverage(target: Record<string, number>, source: Record<string, number>) {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function mergeLists(primary: string[], secondary: string[]) {
  return [...new Set([...primary, ...secondary].map((item) => item.trim()).filter(Boolean))].slice(
    0,
    4
  );
}

function githubTopicsForBrief(userTopics: string[], briefTopics: string[]) {
  if (userTopics.length > 0) {
    return userTopics.slice(0, 3);
  }
  return briefTopics.slice(0, 3);
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<void>
) {
  const queue = [...items.entries()];
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) {
        return;
      }
      await mapper(next[1], next[0]);
    }
  });
  await Promise.all(workers);
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function saveEvidence(runId: string, items: NormalizedEvidence[]) {
  for (const item of items) {
    await prisma.evidenceItem.create({
      data: {
        runId,
        source: item.source,
        externalId: item.externalId,
        title: item.title,
        url: item.url,
        body: item.body,
        snippet: item.snippet,
        author: item.author,
        container: item.container,
        publishedAt: item.publishedAt ?? undefined,
        engagementJson: item.engagement ? toJson(item.engagement) : null,
        score: item.score,
        metadataJson: item.metadata ? toJson(item.metadata) : null,
        rawJson: item.raw ? toJson(item.raw) : null
      }
    });
  }
}

async function saveProjects(runId: string, items: NormalizedProject[]) {
  for (const item of items) {
    await prisma.projectSignal.create({
      data: {
        runId,
        source: item.source,
        externalId: item.externalId,
        name: item.name,
        fullName: item.fullName,
        url: item.url,
        description: item.description,
        language: item.language,
        stars: item.stars,
        forks: item.forks,
        openIssues: item.openIssues,
        owner: item.owner,
        createdAtSource: item.createdAtSource ?? undefined,
        pushedAtSource: item.pushedAtSource ?? undefined,
        starVelocity: item.starVelocity,
        topicsJson: item.topics ? toJson(item.topics) : null,
        metadataJson: item.metadata ? toJson(item.metadata) : null,
        rawJson: item.raw ? toJson(item.raw) : null
      }
    });
  }
}

async function saveClusters(runId: string, items: NormalizedCluster[]) {
  for (const item of items) {
    await prisma.cluster.create({
      data: {
        runId,
        externalId: item.externalId,
        title: item.title,
        score: item.score,
        sourcesJson: item.sources ? toJson(item.sources) : null,
        representativeIdsJson: item.representativeIds ? toJson(item.representativeIds) : null,
        candidateIdsJson: item.candidateIds ? toJson(item.candidateIds) : null,
        rawJson: item.raw ? toJson(item.raw) : null
      }
    });
  }
}
