import type { EvidenceItem, ProjectSignal, Cluster } from "@prisma/client";
import { fromJson } from "@/lib/json";
import { synthesizeWithLlm } from "@/lib/llm";
import type { OpportunityDraft } from "@/lib/types";

export async function synthesizeOpportunities(input: {
  topic: string;
  evidence: EvidenceItem[];
  projects: ProjectSignal[];
  clusters: Cluster[];
}): Promise<OpportunityDraft[]> {
  const llmDrafts = await synthesizeWithLlm({
    topic: input.topic,
    evidence: input.evidence.map((item) => ({
      id: item.id,
      title: item.title,
      source: item.source,
      snippet: item.snippet,
      url: item.url
    })),
    projects: input.projects.map((project) => ({
      id: project.id,
      name: project.name,
      fullName: project.fullName,
      stars: project.stars,
      description: project.description
    })),
    clusters: input.clusters.map((cluster) => ({
      id: cluster.id,
      title: cluster.title,
      score: cluster.score
    }))
  });

  if (llmDrafts?.length) {
    return sanitizeDrafts(llmDrafts, input.evidence, input.projects);
  }

  return heuristicOpportunities(input);
}

function heuristicOpportunities(input: {
  topic: string;
  evidence: EvidenceItem[];
  projects: ProjectSignal[];
  clusters: Cluster[];
}): OpportunityDraft[] {
  const topEvidence = [...input.evidence]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 8);
  const topProjects = [...input.projects]
    .sort((a, b) => (b.starVelocity ?? b.stars ?? 0) - (a.starVelocity ?? a.stars ?? 0))
    .slice(0, 6);
  const seeds = buildOpportunitySeeds(input, topEvidence, topProjects);

  return seeds.slice(0, 5).map((seed, index) => {
    const evidence = topEvidence.slice(index, index + 3);
    const fallbackEvidence = evidence.length ? evidence : topEvidence.slice(0, 3);
    const projects = topProjects.slice(index, index + 2);
    const sourceSpread = new Set(fallbackEvidence.map((item) => item.source)).size;
    const hasProject = projects.length > 0;

    return {
      title: titleFromCluster(seed.title, input.topic),
      targetUser: seed.kind === "project"
        ? `Builders and operators watching ${input.topic}`
        : `People actively working around ${input.topic}`,
      painSignal:
        fallbackEvidence[0]?.snippet ??
        fallbackEvidence[0]?.body ??
        seed.description ??
        `Active projects suggest builders are experimenting around ${input.topic}, but conversation evidence is thin.`,
      productWedge: hasProject
        ? `Package the strongest open-source building blocks into a focused workflow and validate the missing user-facing layer.`
        : `Build a narrow workflow that removes the manual step implied by the research cluster.`,
      mvpScope: `A single-purpose web app that ingests the user's current workflow, produces the first useful output, and stores repeatable templates.`,
      whyNow: hasProject
        ? `GitHub Scout found active or fast-growing projects, which creates reusable building blocks and a signal that developers are exploring the space.`
        : `The last-30-days evidence shows enough fresh discussion to test demand quickly.`,
      demandScore: clampScore(5 + sourceSpread + fallbackEvidence.length + (hasProject ? 1 : 0)),
      noveltyScore: clampScore(hasProject ? 7 : 6),
      feasibilityScore: clampScore(hasProject ? 8 : 6),
      businessScore: clampScore(6 + (hasProject ? 1 : 0)),
      confidenceScore: clampScore(4 + fallbackEvidence.length + sourceSpread + (hasProject ? 1 : 0)),
      evidenceIds: fallbackEvidence.map((item) => item.id),
      projectIds: projects.map((project) => project.id),
      raw: {
        mode: "heuristic",
        seedId: seed.id,
        seedKind: seed.kind,
        sourceHints: seed.sources
      }
    };
  });
}

function sanitizeDrafts(
  drafts: OpportunityDraft[],
  evidence: EvidenceItem[],
  projects: ProjectSignal[]
): OpportunityDraft[] {
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const projectIds = new Set(projects.map((project) => project.id));
  const fallbackEvidence = evidence.slice(0, 3).map((item) => item.id);
  const fallbackProjects = projects.slice(0, 3).map((project) => project.id);

  return drafts.map((draft) => ({
    ...draft,
    demandScore: clampScore(draft.demandScore),
    noveltyScore: clampScore(draft.noveltyScore),
    feasibilityScore: clampScore(draft.feasibilityScore),
    businessScore: clampScore(draft.businessScore),
    confidenceScore: clampScore(draft.confidenceScore),
    evidenceIds: draft.evidenceIds.filter((id) => evidenceIds.has(id)).slice(0, 8),
    projectIds: draft.projectIds.filter((id) => projectIds.has(id)).slice(0, 6)
  })).map((draft) => ({
    ...draft,
    evidenceIds: draft.evidenceIds.length ? draft.evidenceIds : fallbackEvidence,
    projectIds: draft.projectIds.length ? draft.projectIds : fallbackProjects
  }));
}

function buildOpportunitySeeds(
  input: { clusters: Cluster[] },
  topEvidence: EvidenceItem[],
  topProjects: ProjectSignal[]
) {
  if (input.clusters.length) {
    return input.clusters.slice(0, 5).map((cluster) => ({
      id: cluster.id,
      kind: "cluster" as const,
      title: cluster.title,
      description: undefined,
      sources: fromJson<string[]>(cluster.sourcesJson, [])
    }));
  }

  if (topEvidence.length) {
    return topEvidence.map((item) => ({
      id: item.id,
      kind: "evidence" as const,
      title: item.title,
      description: item.snippet ?? item.body ?? undefined,
      sources: [item.source]
    }));
  }

  return topProjects.map((project) => ({
    id: project.id,
    kind: "project" as const,
    title: project.fullName ?? project.name,
    description: project.description ?? undefined,
    sources: [project.source]
  }));
}

function titleFromCluster(clusterTitle: string, topic: string) {
  const clean = clusterTitle.replace(/^people on\s+/i, "").replace(/\.$/, "");
  if (clean.toLowerCase().includes(topic.toLowerCase())) {
    return clean;
  }
  return `${clean} for ${topic}`;
}

function clampScore(value: number) {
  return Math.max(1, Math.min(10, Math.round(value)));
}
