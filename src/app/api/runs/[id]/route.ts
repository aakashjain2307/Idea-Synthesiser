import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { runInclude } from "@/lib/server/collect";
import { serializeRun } from "@/lib/server/serialize";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await prisma.researchRun.findUnique({
    where: { id },
    include: runInclude
  });

  if (!run) {
    return NextResponse.json({ error: "Research run not found." }, { status: 404 });
  }

  return NextResponse.json({ run: serializeRun(run) });
}
