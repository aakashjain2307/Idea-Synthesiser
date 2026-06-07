import { describe, expect, it } from "vitest";
import { getEffectiveLlmConfig, llmProviderPresets } from "@/lib/server/llm-settings";

describe("LLM provider settings", () => {
  it("falls back to environment settings in tests", async () => {
    process.env.LLM_BASE_URL = "http://127.0.0.1:11434/v1";
    process.env.LLM_MODEL = "llama3.2";
    process.env.LLM_API_KEY = "ollama";
    delete process.env.OPENAI_API_KEY;

    const config = await getEffectiveLlmConfig();

    expect(config.provider).toBe("ollama");
    expect(config.model).toBe("llama3.2");
    expect(config.apiKey).toBe("ollama");

    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_MODEL;
    delete process.env.LLM_API_KEY;
  });

  it("ships useful provider presets", () => {
    expect(llmProviderPresets.map((preset) => preset.provider)).toEqual(
      expect.arrayContaining(["openai", "ollama", "openrouter", "groq", "gemini", "custom"])
    );
    expect(llmProviderPresets.find((preset) => preset.provider === "openai")?.models).toEqual(
      expect.arrayContaining(["gpt-4.1-mini", "gpt-4.1", "gpt-4o"])
    );
    expect(llmProviderPresets.every((preset) => preset.models.length > 0)).toBe(true);
  });
});
