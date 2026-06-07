import { prisma } from "@/lib/server/prisma";

export type LlmProviderPreset = {
  provider: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  needsApiKey: boolean;
};

export type EffectiveLlmConfig = {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  source: "database" | "environment";
};

export const llmProviderPresets: LlmProviderPreset[] = [
  {
    provider: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1-mini",
    models: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o", "o4-mini"],
    needsApiKey: true
  },
  {
    provider: "ollama",
    label: "Ollama local",
    baseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "gemma4:31b-cloud",
    models: ["gemma4:31b-cloud", "llama3.2", "qwen2.5:7b", "mistral", "llama3.1:8b"],
    needsApiKey: false
  },
  {
    provider: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4.1-mini",
    models: [
      "openai/gpt-4.1-mini",
      "openai/gpt-4.1",
      "anthropic/claude-3.5-sonnet",
      "google/gemini-2.5-flash",
      "meta-llama/llama-3.3-70b-instruct"
    ],
    needsApiKey: true
  },
  {
    provider: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    needsApiKey: true
  },
  {
    provider: "gemini",
    label: "Gemini OpenAI-compatible",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash"],
    needsApiKey: true
  },
  {
    provider: "custom",
    label: "Custom OpenAI-compatible",
    baseUrl: "https://api.example.com/v1",
    defaultModel: "model-name",
    models: ["model-name"],
    needsApiKey: true
  }
];

export async function getEffectiveLlmConfig(): Promise<EffectiveLlmConfig> {
  if (process.env.NODE_ENV !== "test") {
    try {
      const active = await prisma.llmProviderSetting.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" }
      });

      if (active) {
        return {
          provider: active.provider,
          baseUrl: active.baseUrl,
          model: active.model,
          apiKey: active.apiKey ?? undefined,
          source: "database"
        };
      }
    } catch {
      // The table may not exist yet during first boot. Fall back to env settings.
    }
  }

  return {
    provider: inferProvider(process.env.LLM_BASE_URL),
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
    model: process.env.LLM_MODEL ?? "gpt-4.1-mini",
    apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY,
    source: "environment"
  };
}

export async function getPublicLlmSettings() {
  const active = await getEffectiveLlmConfig();
  return {
    active: maskConfig(active),
    presets: llmProviderPresets
  };
}

export async function saveActiveLlmSetting(input: {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  clearApiKey?: boolean;
}) {
  const provider = input.provider || "custom";
  const existing = await prisma.llmProviderSetting.findUnique({
    where: { provider }
  });
  const apiKey = input.clearApiKey ? null : input.apiKey?.trim() || existing?.apiKey || null;

  await prisma.llmProviderSetting.updateMany({
    data: { isActive: false },
    where: { isActive: true }
  });

  const saved = await prisma.llmProviderSetting.upsert({
    where: { provider },
    update: {
      baseUrl: input.baseUrl.trim().replace(/\/$/, ""),
      model: input.model.trim(),
      apiKey,
      isActive: true
    },
    create: {
      provider,
      name: labelForProvider(provider),
      baseUrl: input.baseUrl.trim().replace(/\/$/, ""),
      model: input.model.trim(),
      apiKey,
      isActive: true
    }
  });

  return maskConfig({
    provider: saved.provider,
    baseUrl: saved.baseUrl,
    model: saved.model,
    apiKey: saved.apiKey ?? undefined,
    source: "database"
  });
}

export function maskConfig(config: EffectiveLlmConfig) {
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKeyConfigured: Boolean(config.apiKey),
    source: config.source
  };
}

function inferProvider(baseUrl: string | undefined) {
  if (!baseUrl) {
    return "openai";
  }
  if (baseUrl.includes("ollama") || baseUrl.includes("11434")) {
    return "ollama";
  }
  if (baseUrl.includes("openrouter")) {
    return "openrouter";
  }
  if (baseUrl.includes("groq")) {
    return "groq";
  }
  if (baseUrl.includes("googleapis")) {
    return "gemini";
  }
  if (baseUrl.includes("openai")) {
    return "openai";
  }
  return "custom";
}

function labelForProvider(provider: string) {
  return llmProviderPresets.find((preset) => preset.provider === provider)?.label ?? provider;
}
