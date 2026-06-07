import type {
  BuildArtifact,
  EvidenceItem,
  Opportunity,
  ProjectSignal,
  ResearchRun
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import { runLearningAgents } from "@/lib/learn-mode";

describe("learn mode", () => {
  it("creates a project-specific learning plan when no LLM key is configured", async () => {
    delete process.env.LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.LLM_BASE_URL = "https://api.openai.com/v1";
    process.env.LLM_MODEL = "gpt-4.1-mini";

    const now = new Date();
    const run: ResearchRun = {
      id: "run1",
      topic: "AI harnesses for backend engineers",
      lookbackDays: 30,
      status: "synthesized",
      manualEvidence: null,
      githubLanguages: null,
      githubTopics: null,
      last30daysRawPath: null,
      last30daysPlan: null,
      last30daysStdout: null,
      sourceCoverage: null,
      warnings: null,
      error: null,
      createdAt: now,
      updatedAt: now
    };
    const opportunity: Opportunity = {
      id: "op1",
      runId: "run1",
      title: "Eval Harness Debugger",
      targetUser: "Senior backend engineers learning AI evaluation infrastructure",
      painSignal: "Builders need to understand eval failures instead of only generating demos.",
      productWedge: "A workbench for creating, scoring, and replaying eval cases.",
      mvpScope: "Import examples, run scoring logic, and inspect failures.",
      whyNow: "AI labs increasingly value eval and observability depth.",
      demandScore: 8,
      noveltyScore: 7,
      feasibilityScore: 8,
      businessScore: 7,
      confidenceScore: 8,
      evidenceIdsJson: "[\"ev1\"]",
      projectIdsJson: "[\"pr1\"]",
      status: "new",
      notes: null,
      isSaved: false,
      rawJson: null,
      createdAt: now,
      updatedAt: now
    };
    const evidence: EvidenceItem = {
      id: "ev1",
      runId: "run1",
      source: "manual",
      externalId: null,
      title: "Eval literacy matters",
      url: null,
      body: "Understanding failures is the hard part.",
      snippet: "Understanding failures is the hard part.",
      author: null,
      container: null,
      publishedAt: now,
      engagementJson: null,
      score: 90,
      metadataJson: null,
      rawJson: null,
      createdAt: now
    };
    const project: ProjectSignal = {
      id: "pr1",
      runId: "run1",
      source: "github",
      externalId: null,
      name: "evals",
      fullName: "openai/evals",
      url: "https://github.com/openai/evals",
      description: "Framework for evaluating language models",
      language: "Python",
      stars: 16000,
      forks: 2000,
      openIssues: 200,
      owner: "openai",
      createdAtSource: now,
      pushedAtSource: now,
      starVelocity: 120,
      topicsJson: null,
      metadataJson: null,
      rawJson: null,
      createdAt: now
    };
    const build: BuildArtifact = {
      id: "build1",
      opportunityId: "op1",
      status: "complete",
      productPlan: "Build a local eval debugging product.",
      architecturePlan: "Next.js UI, API routes, SQLite, scoring functions, and trace logs.",
      implementationPlan: "Create examples, score outputs, and inspect failures.",
      demoHtml: "<!doctype html><html><body>Eval harness demo</body></html>",
      agentLogsJson: null,
      error: null,
      createdAt: now,
      updatedAt: now
    };

    const result = await runLearningAgents({
      opportunity,
      run,
      evidence: [evidence],
      projects: [project],
      build
    });

    expect(result.technologyMap).toContain("Learn first");
    expect(result.buildExplanation).toContain("generated demo");
    expect(result.learningPath).toContain("Day 1");
    expect(result.handsOnTasks).toContain("evaluation set");
    expect(result.interviewPrep).toContain("Senior backend questions");
    expect(result.conceptChecks).toContain("core domain model");
    expect(result.agentLogs).toHaveLength(3);
  });
});
