import { z } from "zod";
import type { Last30DaysPlan } from "@/lib/connectors/last30days";
import { callLlmJson, hasLlm } from "@/lib/llm";

const searchBriefSchema = z.object({
  id: z.string().min(2).max(40),
  label: z.string().min(3).max(80),
  searchQuery: z.string().min(3).max(180),
  audience: z.string().min(3).max(120),
  opportunityAngle: z.string().min(3).max(220),
  githubTopics: z.array(z.string()).default([]),
  githubLanguages: z.array(z.string()).default([]),
  weight: z.number().min(0.05).max(1).default(0.25)
});

const intentPlanSchema = z.object({
  intentSummary: z.string().min(3).max(260),
  strategy: z.string().min(3).max(360),
  briefs: z.array(searchBriefSchema).min(2).max(6)
});

export type SearchBrief = z.infer<typeof searchBriefSchema>;

export type IntentSearchPlan = z.infer<typeof intentPlanSchema> & {
  warnings: string[];
  source: "llm" | "deterministic";
};

const last30DaysSources = [
  "reddit",
  "x",
  "youtube",
  "tiktok",
  "instagram",
  "hackernews",
  "grounding",
  "github",
  "digg"
];

export async function buildIntentSearchPlan(input: {
  intent: string;
  lookbackDays: number;
  githubLanguages: string[];
  githubTopics: string[];
}): Promise<IntentSearchPlan> {
  if (await hasLlm()) {
    try {
      const result = await callLlmJson({
        system:
          "You convert a user's high-level intent into concrete search briefs for finding buildable app ideas. Return only JSON.",
        user: JSON.stringify({
          userIntent: input.intent,
          lookbackDays: input.lookbackDays,
          requestedGithubLanguages: input.githubLanguages,
          requestedGithubTopics: input.githubTopics,
          instruction:
            "Create 3 to 5 search briefs. Do not preserve the user's wording literally if broader/better search phrases would find stronger opportunities. Each brief should target a different market, workflow, or technical wedge. Include GitHub topics/languages useful for project discovery.",
          schema:
            "{ intentSummary, strategy, briefs: [{ id, label, searchQuery, audience, opportunityAngle, githubTopics, githubLanguages, weight }] }",
          examples: [
            {
              intent: "I want to get hired at OpenAI or Anthropic",
              briefs: [
                "LLM evaluation and observability infrastructure for AI agents",
                "secure sandboxing and tool execution for coding agents",
                "data pipelines for post-training and human feedback"
              ]
            },
            {
              intent: "I want app ideas that can make 10k MRR",
              briefs: [
                "AI automation for SOC 2 evidence collection and security questionnaires",
                "accounts receivable invoice recovery automation for small businesses",
                "customer support QA and churn-risk workflows for B2B SaaS"
              ]
            }
          ]
        })
      });

      const parsed = intentPlanSchema.parse(result);
      return {
        ...parsed,
        briefs: normalizeBriefs(parsed.briefs),
        source: "llm",
        warnings: []
      };
    } catch (error) {
      return {
        ...deterministicIntentSearchPlan(input.intent),
        source: "deterministic",
        warnings: [
          `Intent planning used fallback expansion because the local LLM did not return a usable plan.`
        ]
      };
    }
  }

  return {
    ...deterministicIntentSearchPlan(input.intent),
    source: "deterministic",
    warnings: ["Intent planning used fallback expansion because no LLM is configured."]
  };
}

export function briefToLast30DaysPlan(brief: SearchBrief): Last30DaysPlan {
  return {
    raw_topic: brief.searchQuery,
    intent: "opportunity_discovery",
    freshness_mode: "last_30_days",
    cluster_mode: "pain_points_projects_and_requests",
    subqueries: [
      {
        label: "pain",
        search_query: `${brief.searchQuery} pain points wish there was tool`,
        ranking_query: `Find concrete complaints, unmet needs, and repeated requests around ${brief.searchQuery}.`,
        sources: last30DaysSources,
        weight: 0.4
      },
      {
        label: "workarounds",
        search_query: `${brief.searchQuery} workaround manual process automation`,
        ranking_query: `Find manual workflows, spreadsheets, scripts, and awkward workarounds around ${brief.searchQuery}.`,
        sources: last30DaysSources,
        weight: 0.3
      },
      {
        label: "launched-projects",
        search_query: `${brief.searchQuery} github launch open source tool`,
        ranking_query: `Find new or fast-moving tools that indicate builders are active around ${brief.searchQuery}.`,
        sources: last30DaysSources,
        weight: 0.3
      }
    ],
    source_weights: Object.fromEntries(
      last30DaysSources.map((source) => [source, 1 / last30DaysSources.length])
    ),
    notes: [brief.opportunityAngle, `audience: ${brief.audience}`]
  };
}

function deterministicIntentSearchPlan(intent: string) {
  const lower = intent.toLowerCase();

  if (
    lower.includes("openai") ||
    lower.includes("anthropic") ||
    lower.includes("ai lab") ||
    lower.includes("hired") ||
    lower.includes("job")
  ) {
    return {
      intentSummary: "Find portfolio projects that demonstrate AI-lab-relevant backend judgment.",
      strategy:
        "Search for infrastructure-heavy agent, evaluation, sandboxing, data, and reliability gaps that map to senior backend work.",
      briefs: normalizeBriefs([
        {
          id: "agent-evals",
          label: "Agent eval observability",
          searchQuery: "LLM evaluation and observability infrastructure for AI agents",
          audience: "AI lab infra and product engineering teams",
          opportunityAngle: "Build an eval and tracing platform for long-running AI agents.",
          githubTopics: ["evals", "observability", "agents", "tracing"],
          githubLanguages: ["TypeScript", "Python", "Go"],
          weight: 0.25
        },
        {
          id: "tool-sandbox",
          label: "Secure tool execution",
          searchQuery: "secure sandboxing and tool execution for coding agents",
          audience: "Teams deploying coding and browser agents",
          opportunityAngle: "Build secure execution infrastructure for agent tool calls.",
          githubTopics: ["sandbox", "agents", "security", "mcp"],
          githubLanguages: ["Rust", "Go", "TypeScript"],
          weight: 0.25
        },
        {
          id: "feedback-data",
          label: "Feedback data pipelines",
          searchQuery: "data pipelines for AI evals post-training and human feedback",
          audience: "Post-training, evals, and data platform teams",
          opportunityAngle: "Build reliable data systems for model feedback and evaluation loops.",
          githubTopics: ["data-pipeline", "evals", "llmops"],
          githubLanguages: ["Python", "Go"],
          weight: 0.25
        },
        {
          id: "agent-devtools",
          label: "Agent developer platform",
          searchQuery: "developer productivity infrastructure for AI coding agents",
          audience: "Developers using AI agents inside real codebases",
          opportunityAngle: "Build backend services that make agents observable, reproducible, and safe.",
          githubTopics: ["developer-tools", "coding-agent", "mcp"],
          githubLanguages: ["TypeScript", "Rust"],
          weight: 0.25
        }
      ])
    };
  }

  if (
    lower.includes("money") ||
    lower.includes("10k") ||
    lower.includes("mrr") ||
    lower.includes("starter story") ||
    lower.includes("saas") ||
    lower.includes("iphone") ||
    lower.includes("ios") ||
    lower.includes("android")
  ) {
    return {
      intentSummary: "Find narrow app ideas with plausible paid demand and $10k/month potential.",
      strategy:
        "Search for recurring B2B workflow pain, compliance pressure, revenue leakage, and niche mobile utility needs.",
      briefs: normalizeBriefs([
        {
          id: "soc2",
          label: "Compliance automation",
          searchQuery: "AI agent for SOC 2 evidence collection and security questionnaires",
          audience: "B2B SaaS founders and security teams",
          opportunityAngle: "Automate tedious compliance evidence and questionnaire workflows.",
          githubTopics: ["compliance", "security", "automation", "saas"],
          githubLanguages: ["TypeScript", "Python"],
          weight: 0.25
        },
        {
          id: "ar",
          label: "Invoice recovery",
          searchQuery: "AI automation for invoice recovery and accounts receivable teams",
          audience: "Small businesses and finance operators",
          opportunityAngle: "Reduce cash leakage with follow-up, reconciliation, and escalation workflows.",
          githubTopics: ["invoice", "finance", "automation"],
          githubLanguages: ["TypeScript", "Python"],
          weight: 0.25
        },
        {
          id: "support-qa",
          label: "Support QA",
          searchQuery: "AI tools for B2B SaaS customer support QA and churn prevention",
          audience: "Customer support and success teams",
          opportunityAngle: "Turn support tickets into QA, coaching, and churn-risk workflows.",
          githubTopics: ["customer-support", "analytics", "automation"],
          githubLanguages: ["TypeScript", "Python"],
          weight: 0.25
        },
        {
          id: "mobile-field",
          label: "Niche mobile workflows",
          searchQuery: "mobile app workflow automation for field service contractors and property managers",
          audience: "Local service businesses with repeated field workflows",
          opportunityAngle: "Build a simple paid mobile app for one repeated operational task.",
          githubTopics: ["mobile", "workflow", "field-service"],
          githubLanguages: ["Swift", "Kotlin", "TypeScript"],
          weight: 0.25
        }
      ])
    };
  }

  return {
    intentSummary: `Find buildable opportunities related to: ${intent}`,
    strategy:
      "Search across pain points, manual workarounds, new open-source projects, and niche user communities.",
    briefs: normalizeBriefs([
      {
        id: "pain",
        label: "Pain points",
        searchQuery: `${intent} pain points wish there was tool`,
        audience: "Users actively complaining about the workflow",
        opportunityAngle: "Find repeated complaints that can become a narrow product wedge.",
        githubTopics: ["automation", "workflow"],
        githubLanguages: ["TypeScript", "Python"],
        weight: 0.25
      },
      {
        id: "workarounds",
        label: "Workarounds",
        searchQuery: `${intent} workaround spreadsheet manual process`,
        audience: "Operators patching the workflow manually",
        opportunityAngle: "Find messy manual workflows worth automating.",
        githubTopics: ["automation", "tools"],
        githubLanguages: ["TypeScript", "Python"],
        weight: 0.25
      },
      {
        id: "launches",
        label: "Recent launches",
        searchQuery: `${intent} github open source launch tool`,
        audience: "Builders and early adopters",
        opportunityAngle: "Find building blocks and fast-moving project categories.",
        githubTopics: ["developer-tools", "ai"],
        githubLanguages: ["TypeScript", "Python", "Go"],
        weight: 0.25
      },
      {
        id: "buyers",
        label: "Buyer workflows",
        searchQuery: `${intent} businesses paying for software automation`,
        audience: "Potential buyers with budgets",
        opportunityAngle: "Find workflows with willingness to pay.",
        githubTopics: ["saas", "workflow"],
        githubLanguages: ["TypeScript", "Python"],
        weight: 0.25
      }
    ])
  };
}

function normalizeBriefs(briefs: SearchBrief[]): SearchBrief[] {
  const seen = new Set<string>();
  return briefs.slice(0, 6).map((brief, index) => {
    const id = slug(brief.id || brief.label || `brief-${index + 1}`);
    const uniqueId = seen.has(id) ? `${id}-${index + 1}` : id;
    seen.add(uniqueId);
    return {
      ...brief,
      id: uniqueId,
      searchQuery: brief.searchQuery.trim(),
      githubTopics: brief.githubTopics.map(slug).filter(Boolean).slice(0, 4),
      githubLanguages: brief.githubLanguages.map((item) => item.trim()).filter(Boolean).slice(0, 4),
      weight: brief.weight || 1 / Math.max(1, briefs.length)
    };
  });
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
