import { describe, expect, it } from "vitest";
import {
  extractFirstJsonObject,
  normalizeLast30DaysPayload,
  runLast30Days
} from "@/lib/connectors/last30days";

describe("last30days connector", () => {
  it("extracts JSON from noisy CLI output", () => {
    const parsed = extractFirstJsonObject(
      "logs before\nmore logs\n{\"topic\":\"AI tools\",\"warnings\":[]}\nlogs after"
    );

    expect(parsed.topic).toBe("AI tools");
  });

  it("normalizes evidence and clusters from emitted JSON", () => {
    const normalized = normalizeLast30DaysPayload({
      items_by_source: {
        reddit: [
          {
            item_id: "r1",
            title: "People want better agent handoffs",
            url: "https://reddit.com/r/example/comments/r1",
            snippet: "I wish this handled approvals.",
            published_at: "2026-05-25",
            engagement: { score: 120 },
            local_rank_score: 0.62
          }
        ],
        github: [
          {
            item_id: "g1",
            title: "owner/project",
            url: "https://github.com/owner/project",
            snippet: "Open source workflow automation.",
            metadata: {
              full_name: "owner/project",
              stars: 500,
              language: "TypeScript",
              topics: ["agents"]
            }
          }
        ]
      },
      clusters: [
        {
          cluster_id: "c1",
          title: "Agent handoffs are painful",
          score: 84,
          sources: ["reddit"],
          representative_ids: ["r1"],
          candidate_ids: ["r1"]
        }
      ],
      warnings: ["degraded"]
    });

    expect(normalized.evidence).toHaveLength(2);
    expect(normalized.projects[0].fullName).toBe("owner/project");
    expect(normalized.clusters[0].title).toBe("Agent handoffs are painful");
    expect(normalized.coverage.reddit).toBe(1);
    expect(normalized.warnings).toEqual(["degraded"]);
  });

  it("runs with an injected process runner", async () => {
    const result = await runLast30Days(
      {
        topic: "AI accounting",
        lookbackDays: 30,
        saveDir: "/tmp/idea-synth-test"
      },
      async () => ({
        stdout: "status\n{\"items_by_source\":{\"reddit\":[]},\"clusters\":[],\"warnings\":[]}",
        stderr: ""
      })
    );

    expect(result.normalized.coverage.reddit).toBe(0);
  });
});
