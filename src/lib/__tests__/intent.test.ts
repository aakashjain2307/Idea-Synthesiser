import { describe, expect, it } from "vitest";
import { briefToLast30DaysPlan, buildIntentSearchPlan } from "@/lib/intent";

describe("intent planning", () => {
  it("expands AI lab hiring intent into backend-relevant search briefs", async () => {
    delete process.env.LLM_API_KEY;
    const plan = await buildIntentSearchPlan({
      intent: "I want to get hired in OpenAI or Anthropic. What should I build?",
      lookbackDays: 30,
      githubLanguages: [],
      githubTopics: []
    });

    expect(plan.source).toBe("deterministic");
    expect(plan.briefs.length).toBeGreaterThanOrEqual(3);
    expect(plan.briefs.map((brief) => brief.searchQuery).join(" ")).toContain("evaluation");
    expect(plan.briefs.map((brief) => brief.searchQuery).join(" ")).toContain("sandboxing");
  });

  it("expands money intent into paid workflow search briefs", async () => {
    delete process.env.LLM_API_KEY;
    const plan = await buildIntentSearchPlan({
      intent: "I want to find apps that can make 10k MRR like Starter Story",
      lookbackDays: 30,
      githubLanguages: [],
      githubTopics: []
    });

    expect(plan.briefs.map((brief) => brief.searchQuery).join(" ")).toContain("SOC 2");
    expect(plan.briefs.map((brief) => brief.searchQuery).join(" ")).toContain("invoice");
  });

  it("turns a search brief into a Last30Days query plan", () => {
    const plan = briefToLast30DaysPlan({
      id: "support-qa",
      label: "Support QA",
      searchQuery: "AI tools for B2B SaaS customer support QA",
      audience: "Support teams",
      opportunityAngle: "Find quality and churn workflows.",
      githubTopics: ["support"],
      githubLanguages: ["TypeScript"],
      weight: 0.25
    });

    expect(plan.raw_topic).toBe("AI tools for B2B SaaS customer support QA");
    expect(plan.subqueries).toHaveLength(3);
    expect(plan.subqueries[0].search_query).toContain("pain points");
  });
});
