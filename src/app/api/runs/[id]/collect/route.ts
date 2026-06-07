import { NextResponse } from "next/server";
import { collectRun } from "@/lib/server/collect";
import { serializeRun } from "@/lib/server/serialize";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const run = await collectRun(id);
    return NextResponse.json({ run: serializeRun(run) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Collection failed." },
      { status: 500 }
    );
  }
}
