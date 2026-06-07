import { NextResponse } from "next/server";
import { callLlmJson } from "@/lib/llm";
import { getEffectiveLlmConfig, maskConfig } from "@/lib/server/llm-settings";

export async function POST() {
  try {
    const result = await callLlmJson({
      system: "Return only JSON.",
      user: "Return exactly {\"ok\":true,\"message\":\"ready\"}."
    });
    const config = await getEffectiveLlmConfig();
    return NextResponse.json({
      ok: true,
      config: maskConfig(config),
      result
    });
  } catch (error) {
    const config = await getEffectiveLlmConfig();
    return NextResponse.json(
      {
        ok: false,
        config: maskConfig(config),
        error: error instanceof Error ? error.message : "LLM provider test failed."
      },
      { status: 400 }
    );
  }
}
