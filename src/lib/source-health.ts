import { existsSync } from "node:fs";
import { getLast30DaysConfig } from "@/lib/connectors/last30days";
import { getEffectiveLlmConfig } from "@/lib/server/llm-settings";
import type { SourceHealthItem } from "@/lib/types";

export async function getSourceHealth(): Promise<SourceHealthItem[]> {
  const { scriptPath } = getLast30DaysConfig();
  const llm = await getEffectiveLlmConfig();
  const hasLlm = Boolean(llm.apiKey) || llm.provider === "ollama";
  const hasX = Boolean((process.env.AUTH_TOKEN && process.env.CT0) || process.env.XAI_API_KEY);
  const hasSocialBroker = Boolean(process.env.SCRAPECREATORS_API_KEY);
  const hasWeb = Boolean(
    process.env.BRAVE_API_KEY ||
      process.env.EXA_API_KEY ||
      process.env.SERPER_API_KEY ||
      process.env.PARALLEL_API_KEY
  );

  return [
    {
      source: "Last30Days engine",
      status: existsSync(scriptPath) ? "ready" : "missing",
      message: existsSync(scriptPath)
        ? "Python research engine is installed and can be executed."
        : `Expected script at ${scriptPath}.`,
      details: { scriptPath }
    },
    {
      source: "LLM planning and synthesis",
      status: hasLlm ? "ready" : "degraded",
      message: hasLlm
        ? "LLM key is configured for query planning and idea synthesis."
        : "No LLM_API_KEY or OPENAI_API_KEY set. The app will use deterministic planning and heuristic ideas.",
      details: {
        provider: llm.provider,
        baseUrl: llm.baseUrl,
        model: llm.model,
        source: llm.source
      }
    },
    {
      source: "GitHub Scout",
      status: process.env.GITHUB_TOKEN ? "ready" : "degraded",
      message: process.env.GITHUB_TOKEN
        ? "Authenticated GitHub searches are available."
        : "GitHub works without a token, but rate limits are lower.",
      details: { authenticated: Boolean(process.env.GITHUB_TOKEN) }
    },
    {
      source: "X/Twitter via Last30Days",
      status: hasX ? "ready" : "degraded",
      message: hasX
        ? "X access is configured for Last30Days."
        : "Set AUTH_TOKEN/CT0 or XAI_API_KEY for stronger X coverage.",
      details: { configured: hasX }
    },
    {
      source: "TikTok, Instagram, Reddit backup",
      status: hasSocialBroker ? "ready" : "degraded",
      message: hasSocialBroker
        ? "ScrapeCreators key is configured for richer social coverage."
        : "Set SCRAPECREATORS_API_KEY to unlock additional social sources.",
      details: { configured: hasSocialBroker }
    },
    {
      source: "Grounded web search",
      status: hasWeb ? "ready" : "degraded",
      message: hasWeb
        ? "A web backend is configured for Last30Days auto-resolution."
        : "Set BRAVE_API_KEY, EXA_API_KEY, SERPER_API_KEY, or PARALLEL_API_KEY for web grounding.",
      details: { configured: hasWeb }
    }
  ];
}
