import type { EvidenceItem, Opportunity, ProjectSignal, ResearchRun } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { runBuildAgents } from "@/lib/build-mode";

describe("build mode", () => {
  it("creates a fallback plan and self-contained demo when no LLM key is configured", async () => {
    delete process.env.LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.LLM_BASE_URL = "https://api.openai.com/v1";
    process.env.LLM_MODEL = "gpt-4.1-mini";

    const now = new Date();
    const run: ResearchRun = {
      id: "run1",
      topic: "apps that help backend engineers get hired at AI labs",
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
      title: "Eval Incident Replay Workbench",
      targetUser: "Senior backend engineers targeting AI lab infra roles",
      painSignal: "Candidates need visible proof they can debug model-serving incidents.",
      productWedge: "Turn production incident notes into replayable eval scenarios.",
      mvpScope: "A local dashboard for importing traces, labeling failures, and generating eval cases.",
      whyNow: "AI labs are hiring for reliability and evaluation infrastructure.",
      demandScore: 8,
      noveltyScore: 7,
      feasibilityScore: 8,
      businessScore: 6,
      confidenceScore: 7,
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
      title: "Hiring managers value infra demos",
      url: null,
      body: "Show concrete reliability work.",
      snippet: "Show concrete reliability work.",
      author: null,
      container: null,
      publishedAt: now,
      engagementJson: null,
      score: 80,
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

    const result = await runBuildAgents({
      opportunity,
      run,
      evidence: [evidence],
      projects: [project]
    });

    expect(result.productPlan).toContain(opportunity.targetUser);
    expect(result.architecturePlan).toContain("Frontend");
    expect(result.implementationPlan).toContain("1.");
    expect(result.demoHtml).toContain("<!doctype html>");
    expect(result.agentLogs).toHaveLength(3);
  });
});
