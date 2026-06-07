import { afterEach, describe, expect, it, vi } from "vitest";
import { buildQueries, scoutGitHub } from "@/lib/connectors/github";

describe("GitHub Scout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GITHUB_TOKEN;
  });

  it("builds freshness and filter aware queries", () => {
    const queries = buildQueries(
      {
        topic: "AI agents",
        lookbackDays: 30,
        languages: ["TypeScript"],
        topics: ["workflow automation"]
      },
      "2026-05-01"
    );

    expect(queries[0]).toContain("pushed:>=2026-05-01");
    expect(queries[0]).toContain("language:TypeScript");
    expect(queries[0]).toContain("topic:\"workflow automation\"");
    expect(queries[1]).toContain("created:>=2026-05-01");
  });

  it("dedupes repos and computes star velocity", async () => {
    process.env.GITHUB_TOKEN = "test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: new Headers(),
        json: async () => ({
          total_count: 1,
          incomplete_results: false,
          items: [
            {
              id: 1,
              name: "project",
              full_name: "owner/project",
              html_url: "https://github.com/owner/project",
              description: "A useful agent tool",
              language: "TypeScript",
              stargazers_count: 300,
              forks_count: 12,
              open_issues_count: 4,
              owner: { login: "owner" },
              created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
              pushed_at: new Date().toISOString(),
              topics: ["agents"]
            }
          ]
        })
      }))
    );

    const result = await scoutGitHub({ topic: "AI agents", lookbackDays: 30, limit: 5 });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].fullName).toBe("owner/project");
    expect(result.projects[0].starVelocity ?? 0).toBeGreaterThan(300);
    expect(result.warnings).toEqual([]);
  });

  it("surfaces rate limit warnings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 403,
        headers: new Headers({ "x-ratelimit-remaining": "0" }),
        json: async () => ({})
      }))
    );

    const result = await scoutGitHub({ topic: "AI agents", lookbackDays: 30, limit: 5 });

    expect(result.projects).toHaveLength(0);
    expect(result.warnings.join(" ")).toContain("rate limit");
  });
});
