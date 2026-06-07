PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "ResearchRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "topic" TEXT NOT NULL,
  "lookbackDays" INTEGER NOT NULL DEFAULT 30,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "manualEvidence" TEXT,
  "githubLanguages" TEXT,
  "githubTopics" TEXT,
  "last30daysRawPath" TEXT,
  "last30daysPlan" TEXT,
  "last30daysStdout" TEXT,
  "sourceCoverage" TEXT,
  "warnings" TEXT,
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "EvidenceItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "externalId" TEXT,
  "title" TEXT NOT NULL,
  "url" TEXT,
  "body" TEXT,
  "snippet" TEXT,
  "author" TEXT,
  "container" TEXT,
  "publishedAt" DATETIME,
  "engagementJson" TEXT,
  "score" REAL,
  "metadataJson" TEXT,
  "rawJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ResearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ProjectSignal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "externalId" TEXT,
  "name" TEXT NOT NULL,
  "fullName" TEXT,
  "url" TEXT,
  "description" TEXT,
  "language" TEXT,
  "stars" INTEGER,
  "forks" INTEGER,
  "openIssues" INTEGER,
  "owner" TEXT,
  "createdAtSource" DATETIME,
  "pushedAtSource" DATETIME,
  "starVelocity" REAL,
  "topicsJson" TEXT,
  "metadataJson" TEXT,
  "rawJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectSignal_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ResearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Cluster" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "externalId" TEXT,
  "title" TEXT NOT NULL,
  "score" REAL,
  "sourcesJson" TEXT,
  "representativeIdsJson" TEXT,
  "candidateIdsJson" TEXT,
  "rawJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Cluster_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ResearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Opportunity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "targetUser" TEXT NOT NULL,
  "painSignal" TEXT NOT NULL,
  "productWedge" TEXT NOT NULL,
  "mvpScope" TEXT NOT NULL,
  "whyNow" TEXT NOT NULL,
  "demandScore" INTEGER NOT NULL,
  "noveltyScore" INTEGER NOT NULL,
  "feasibilityScore" INTEGER NOT NULL,
  "businessScore" INTEGER NOT NULL,
  "confidenceScore" INTEGER NOT NULL,
  "evidenceIdsJson" TEXT,
  "projectIdsJson" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new',
  "notes" TEXT,
  "isSaved" BOOLEAN NOT NULL DEFAULT false,
  "rawJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Opportunity_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ResearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "BuildArtifact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'complete',
  "productPlan" TEXT NOT NULL,
  "architecturePlan" TEXT NOT NULL,
  "implementationPlan" TEXT NOT NULL,
  "demoHtml" TEXT NOT NULL,
  "agentLogsJson" TEXT,
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BuildArtifact_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LearnArtifact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "buildArtifactId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'complete',
  "technologyMap" TEXT NOT NULL,
  "buildExplanation" TEXT NOT NULL,
  "learningPath" TEXT NOT NULL,
  "handsOnTasks" TEXT NOT NULL,
  "interviewPrep" TEXT NOT NULL,
  "conceptChecks" TEXT NOT NULL,
  "agentLogsJson" TEXT,
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearnArtifact_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LearnArtifact_buildArtifactId_fkey" FOREIGN KEY ("buildArtifactId") REFERENCES "BuildArtifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SavedIdea" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT,
  "opportunityId" TEXT,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "snapshotJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedIdea_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ResearchRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SavedIdea_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SourceRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  "countsJson" TEXT,
  "warningsJson" TEXT,
  "error" TEXT,
  "rawJson" TEXT,
  CONSTRAINT "SourceRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ResearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SourceHealth" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "detailsJson" TEXT,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "LlmProviderSetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "apiKey" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "EvidenceItem_runId_idx" ON "EvidenceItem" ("runId");
CREATE INDEX IF NOT EXISTS "EvidenceItem_source_idx" ON "EvidenceItem" ("source");
CREATE INDEX IF NOT EXISTS "ProjectSignal_runId_idx" ON "ProjectSignal" ("runId");
CREATE INDEX IF NOT EXISTS "ProjectSignal_source_idx" ON "ProjectSignal" ("source");
CREATE INDEX IF NOT EXISTS "Cluster_runId_idx" ON "Cluster" ("runId");
CREATE INDEX IF NOT EXISTS "Opportunity_runId_idx" ON "Opportunity" ("runId");
CREATE INDEX IF NOT EXISTS "BuildArtifact_opportunityId_idx" ON "BuildArtifact" ("opportunityId");
CREATE INDEX IF NOT EXISTS "LearnArtifact_opportunityId_idx" ON "LearnArtifact" ("opportunityId");
CREATE INDEX IF NOT EXISTS "LearnArtifact_buildArtifactId_idx" ON "LearnArtifact" ("buildArtifactId");
CREATE UNIQUE INDEX IF NOT EXISTS "SavedIdea_opportunityId_key" ON "SavedIdea" ("opportunityId");
CREATE INDEX IF NOT EXISTS "SourceRun_runId_idx" ON "SourceRun" ("runId");
CREATE INDEX IF NOT EXISTS "SourceRun_source_idx" ON "SourceRun" ("source");
CREATE UNIQUE INDEX IF NOT EXISTS "SourceHealth_source_key" ON "SourceHealth" ("source");
CREATE UNIQUE INDEX IF NOT EXISTS "LlmProviderSetting_provider_key" ON "LlmProviderSetting" ("provider");
