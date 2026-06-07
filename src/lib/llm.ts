import { z } from "zod";
import type { Last30DaysPlan } from "@/lib/connectors/last30days";
import { getEffectiveLlmConfig } from "@/lib/server/llm-settings";
import type { OpportunityDraft } from "@/lib/types";

const planSources = [
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

const opportunitySchema = z.object({
  title: z.string().min(3),
  targetUser: z.string().min(3),
  painSignal: z.string().min(3),
  productWedge: z.string().min(3),
  mvpScope: z.string().min(3),
  whyNow: z.string().min(3),
  demandScore: z.number().int().min(1).max(10),
  noveltyScore: z.number().int().min(1).max(10),
  feasibilityScore: z.number().int().min(1).max(10),
  businessScore: z.number().int().min(1).max(10),
  confidenceScore: z.number().int().min(1).max(10),
  evidenceIds: z.array(z.string()).default([]),
  projectIds: z.array(z.string()).default([])
});

const opportunitiesSchema = z.object({
  opportunities: z.array(opportunitySchema).min(1).max(8)
});

export async function hasLlm() {
  const config = await getEffectiveLlmConfig();
  return Boolean(config.apiKey) || config.provider === "ollama";
}

export function deterministicLast30DaysPlan(topic: string): Last30DaysPlan {
  return {
    raw_topic: topic,
    intent: "opportunity_discovery",
    freshness_mode: "last_30_days",
    cluster_mode: "pain_points_and_projects",
    subqueries: [
      {
        label: "pain-points",
        search_query: `${topic} pain points wish there was tool`,
        ranking_query: `Recent user pain points and unmet needs around ${topic}`,
        sources: planSources,
        weight: 0.45
      },
      {
        label: "workarounds",
        search_query: `${topic} workaround automation manual process`,
        ranking_query: `Workarounds, complaints, and manual processes around ${topic}`,
        sources: planSources,
        weight: 0.3
      },
      {
        label: "projects",
        search_query: `${topic} github open source launch`,
        ranking_query: `New projects and launches related to ${topic}`,
        sources: planSources,
        weight: 0.25
      }
    ],
    source_weights: Object.fromEntries(planSources.map((source) => [source, 1 / planSources.length])),
    notes: ["generated-by-idea-synthesizer"]
  };
}

export async function buildLast30DaysPlan(topic: string): Promise<Last30DaysPlan | null> {
  if (!(await hasLlm())) {
    return null;
  }

  try {
    const result = await callLlmJson({
      system:
        "You build concise JSON query plans for a last-30-days social research engine. Return only valid JSON.",
      user: `Create a query plan for finding startup opportunities around this topic: ${topic}.
Use this exact schema: { "raw_topic": string, "intent": string, "freshness_mode": string, "cluster_mode": string, "subqueries": [{ "label": string, "search_query": string, "ranking_query": string, "sources": string[], "weight": number }], "source_weights": object, "notes": string[] }.
Use 2 to 4 subqueries. Sources must be chosen from: ${planSources.join(", ")}.`
    });

    return {
      ...deterministicLast30DaysPlan(topic),
      ...(result as Partial<Last30DaysPlan>),
      raw_topic: topic
    };
  } catch {
    return null;
  }
}

export async function synthesizeWithLlm(input: {
  topic: string;
  evidence: Array<{ id: string; title: string; source: string; snippet?: string | null; url?: string | null }>;
  projects: Array<{ id: string; name: string; fullName?: string | null; stars?: number | null; description?: string | null }>;
  clusters: Array<{ id: string; title: string; score?: number | null }>;
}): Promise<OpportunityDraft[] | null> {
  if (!(await hasLlm()) || (input.evidence.length === 0 && input.projects.length === 0)) {
    return null;
  }

  try {
    const result = await callLlmJson({
      system:
        "You synthesize product opportunities from cited research and project signals. Return only valid JSON. Every opportunity must cite existing evidenceIds or projectIds.",
      user: JSON.stringify({
        topic: input.topic,
        task:
          "Create 4 to 6 specific buildable product opportunity cards. Use only the provided ids for evidenceIds and projectIds. If evidence is empty, ground ideas in projectIds.",
        schema:
          "{ opportunities: [{ title, targetUser, painSignal, productWedge, mvpScope, whyNow, demandScore, noveltyScore, feasibilityScore, businessScore, confidenceScore, evidenceIds, projectIds }] }",
        evidence: input.evidence.slice(0, 40),
        projects: input.projects.slice(0, 25),
        clusters: input.clusters.slice(0, 20)
      })
    });

    return opportunitiesSchema.parse(result).opportunities;
  } catch {
    return null;
  }
}

export async function callLlmJson({ system, user }: { system: string; user: string }) {
  const config = await getEffectiveLlmConfig();
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const apiKey = config.apiKey || (config.provider === "ollama" ? "ollama" : undefined);
  if (!apiKey && config.provider !== "ollama") {
    throw new Error("An API key is required for the active LLM provider.");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.35
    })
  });

  if (!response.ok) {
    throw new Error(`LLM request failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM response did not include content.");
  }
  return parseJsonObject(content);
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return parseJsonObject(fenced[1]);
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error("LLM response did not contain a JSON object.");
}
