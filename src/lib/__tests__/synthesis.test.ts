import { describe, expect, it } from "vitest";
import { synthesizeOpportunities } from "@/lib/synthesis";

describe("fallback synthesis", () => {
  it("creates opportunity drafts with real evidence ids", async () => {
    delete process.env.LLM_API_KEY;
    const now = new Date();
    const drafts = await synthesizeOpportunities({
      topic: "AI research workflows",
      evidence: [
        {
          id: "ev1",
          runId: "run1",
          source: "reddit",
          externalId: "r1",
          title: "Researchers hate stitching sources together",
          url: "https://example.com/r1",
          body: "I wish this workflow handled citations.",
          snippet: "I wish this workflow handled citations.",
          author: null,
          container: null,
          publishedAt: now,
          engagementJson: null,
          score: 80,
          metadataJson: null,
          rawJson: null,
          createdAt: now
        }
      ],
      projects: [
        {
          id: "pr1",
          runId: "run1",
          source: "github",
          externalId: "1",
          name: "citation-agent",
          fullName: "owner/citation-agent",
          url: "https://github.com/owner/citation-agent",
          description: "Citation automation",
          language: "TypeScript",
          stars: 100,
          forks: 5,
          openIssues: 2,
          owner: "owner",
          createdAtSource: now,
          pushedAtSource: now,
          starVelocity: 200,
          topicsJson: null,
          metadataJson: null,
          rawJson: null,
          createdAt: now
        }
      ],
      clusters: [
        {
          id: "cl1",
          runId: "run1",
          externalId: "c1",
          title: "Citation stitching is painful",
          score: 91,
          sourcesJson: "[\"reddit\"]",
          representativeIdsJson: null,
          candidateIdsJson: null,
          rawJson: null,
          createdAt: now
        }
      ]
    });

    expect(drafts[0].evidenceIds).toEqual(["ev1"]);
    expect(drafts[0].projectIds).toEqual(["pr1"]);
    expect(drafts[0].confidenceScore).toBeGreaterThan(1);
  });

  it("creates opportunity drafts when only GitHub projects are available", async () => {
    delete process.env.LLM_API_KEY;
    const now = new Date();
    const drafts = await synthesizeOpportunities({
      topic: "Side projects for AI labs",
      evidence: [],
      projects: [
        {
          id: "pr1",
          runId: "run1",
          source: "github",
          externalId: "1",
          name: "agent-browser",
          fullName: "vercel-labs/agent-browser",
          url: "https://github.com/vercel-labs/agent-browser",
          description: "Browser automation CLI for AI agents",
          language: "TypeScript",
          stars: 34000,
          forks: 500,
          openIssues: 22,
          owner: "vercel-labs",
          createdAtSource: now,
          pushedAtSource: now,
          starVelocity: 7000,
          topicsJson: null,
          metadataJson: null,
          rawJson: null,
          createdAt: now
        }
      ],
      clusters: []
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0].evidenceIds).toEqual([]);
    expect(drafts[0].projectIds).toEqual(["pr1"]);
    expect(drafts[0].painSignal).toContain("Browser automation");
  });
});
