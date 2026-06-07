import type {
  Cluster,
  BuildArtifact,
  EvidenceItem,
  LearnArtifact,
  Opportunity,
  ProjectSignal,
  ResearchRun,
  SavedIdea,
  SourceRun
} from "@prisma/client";
import { fromJson } from "@/lib/json";

type RunWithRelations = ResearchRun & {
  evidenceItems?: EvidenceItem[];
  projectSignals?: ProjectSignal[];
  clusters?: Cluster[];
  opportunities?: Array<Opportunity & {
    buildArtifacts?: BuildArtifact[];
    learnArtifacts?: LearnArtifact[];
  }>;
  sourceRuns?: SourceRun[];
};

export function serializeRun(run: RunWithRelations) {
  return {
    ...run,
    githubLanguages: fromJson<string[]>(run.githubLanguages, []),
    githubTopics: fromJson<string[]>(run.githubTopics, []),
    sourceCoverage: fromJson<Record<string, number>>(run.sourceCoverage, {}),
    warnings: fromJson<string[]>(run.warnings, []),
    evidenceItems: run.evidenceItems?.map(serializeEvidence) ?? [],
    projectSignals: run.projectSignals?.map(serializeProject) ?? [],
    clusters: run.clusters?.map(serializeCluster) ?? [],
    opportunities: run.opportunities?.map(serializeOpportunity) ?? [],
    sourceRuns: run.sourceRuns?.map(serializeSourceRun) ?? []
  };
}

export function serializeEvidence(item: EvidenceItem) {
  return {
    ...item,
    engagement: fromJson(item.engagementJson, null),
    metadata: fromJson(item.metadataJson, null),
    raw: fromJson(item.rawJson, null)
  };
}

export function serializeProject(project: ProjectSignal) {
  return {
    ...project,
    topics: fromJson<string[]>(project.topicsJson, []),
    metadata: fromJson(project.metadataJson, null),
    raw: fromJson(project.rawJson, null)
  };
}

export function serializeCluster(cluster: Cluster) {
  return {
    ...cluster,
    sources: fromJson<string[]>(cluster.sourcesJson, []),
    representativeIds: fromJson<string[]>(cluster.representativeIdsJson, []),
    candidateIds: fromJson<string[]>(cluster.candidateIdsJson, []),
    raw: fromJson(cluster.rawJson, null)
  };
}

export function serializeOpportunity(
  opportunity: Opportunity & {
    buildArtifacts?: BuildArtifact[];
    learnArtifacts?: LearnArtifact[];
  }
) {
  return {
    ...opportunity,
    evidenceIds: fromJson<string[]>(opportunity.evidenceIdsJson, []),
    projectIds: fromJson<string[]>(opportunity.projectIdsJson, []),
    raw: fromJson(opportunity.rawJson, null),
    buildArtifacts: opportunity.buildArtifacts?.map(serializeBuildArtifact) ?? [],
    learnArtifacts: opportunity.learnArtifacts?.map(serializeLearnArtifact) ?? []
  };
}

export function serializeBuildArtifact(build: BuildArtifact) {
  return {
    ...build,
    agentLogs: fromJson(build.agentLogsJson, [])
  };
}

export function serializeLearnArtifact(learn: LearnArtifact) {
  return {
    ...learn,
    agentLogs: fromJson(learn.agentLogsJson, [])
  };
}

export function serializeSourceRun(sourceRun: SourceRun) {
  return {
    ...sourceRun,
    counts: fromJson<Record<string, number>>(sourceRun.countsJson, {}),
    warnings: fromJson<string[]>(sourceRun.warningsJson, []),
    raw: fromJson(sourceRun.rawJson, null)
  };
}

export function serializeSavedIdea(savedIdea: SavedIdea) {
  return {
    ...savedIdea,
    snapshot: fromJson(savedIdea.snapshotJson, null)
  };
}
