import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { runInclude } from "@/lib/server/collect";
import { serializeRun } from "@/lib/server/serialize";
import { runToMarkdown } from "@/lib/server/export";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "md";
  const run = await prisma.researchRun.findUnique({
    where: { id },
    include: runInclude
  });

  if (!run) {
    return NextResponse.json({ error: "Research run not found." }, { status: 404 });
  }

  if (format === "json") {
    return NextResponse.json(serializeRun(run), {
      headers: {
        "Content-Disposition": `attachment; filename="${slug(run.topic)}-ideas.json"`
      }
    });
  }

  const markdown = runToMarkdown({
    run,
    opportunities: run.opportunities,
    evidence: run.evidenceItems,
    projects: run.projectSignals
  });

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug(run.topic)}-ideas.md"`
    }
  });
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
