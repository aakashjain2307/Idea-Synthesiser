import { NextResponse } from "next/server";
import { getSourceHealth } from "@/lib/source-health";

export async function GET() {
  return NextResponse.json({ health: await getSourceHealth() });
}
