export type ResearchInput = {
  topic: string;
  lookbackDays: number;
  manualEvidence?: string;
  githubLanguages?: string[];
  githubTopics?: string[];
};

export type NormalizedEvidence = {
  source: string;
  externalId?: string;
  title: string;
  url?: string;
  body?: string;
  snippet?: string;
  author?: string;
  container?: string;
  publishedAt?: Date | null;
  engagement?: unknown;
  score?: number;
  metadata?: unknown;
  raw?: unknown;
};

export type NormalizedProject = {
  source: string;
  externalId?: string;
  name: string;
  fullName?: string;
  url?: string;
  description?: string;
  language?: string;
  stars?: number;
  forks?: number;
  openIssues?: number;
  owner?: string;
  createdAtSource?: Date | null;
  pushedAtSource?: Date | null;
  starVelocity?: number;
  topics?: string[];
  metadata?: unknown;
  raw?: unknown;
};

export type NormalizedCluster = {
  externalId?: string;
  title: string;
  score?: number;
  sources?: string[];
  representativeIds?: string[];
  candidateIds?: string[];
  raw?: unknown;
};

export type OpportunityDraft = {
  title: string;
  targetUser: string;
  painSignal: string;
  productWedge: string;
  mvpScope: string;
  whyNow: string;
  demandScore: number;
  noveltyScore: number;
  feasibilityScore: number;
  businessScore: number;
  confidenceScore: number;
  evidenceIds: string[];
  projectIds: string[];
  raw?: unknown;
};

export type SourceHealthItem = {
  source: string;
  status: "ready" | "degraded" | "missing";
  message: string;
  details?: Record<string, unknown>;
};
