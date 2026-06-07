import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getPublicLlmSettings,
  saveActiveLlmSetting
} from "@/lib/server/llm-settings";

const saveSchema = z.object({
  provider: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  apiKey: z.string().optional(),
  clearApiKey: z.boolean().optional()
});

export async function GET() {
  return NextResponse.json(await getPublicLlmSettings());
}

export async function POST(request: Request) {
  const body = saveSchema.parse(await request.json());
  const active = await saveActiveLlmSetting(body);
  return NextResponse.json({ active });
}
