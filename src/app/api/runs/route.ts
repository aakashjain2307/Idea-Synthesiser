import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { runInclude } from "@/lib/server/collect";
import { serializeRun } from "@/lib/server/serialize";
import { toJson } from "@/lib/json";

const createRunSchema = z.object({
  topic: z.string().min(2).max(180),
  lookbackDays: z.coerce.number().int().min(1).max(90).default(30),
  manualEvidence: z.string().optional(),
  githubLanguages: z.array(z.string()).default([]),
  githubTopics: z.array(z.string()).default([])
});

export async function GET() {
  const runs = await prisma.researchRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      opportunities: { select: { id: true } },
      evidenceItems: { select: { id: true } },
      projectSignals: { select: { id: true } }
    }
  });

  return NextResponse.json({
    runs: runs.map((run) => ({
      id: run.id,
      topic: run.topic,
      lookbackDays: run.lookbackDays,
      status: run.status,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      counts: {
        opportunities: run.opportunities.length,
        evidence: run.evidenceItems.length,
        projects: run.projectSignals.length
      }
    }))
  });
}

export async function POST(request: Request) {
  const body = createRunSchema.parse(await request.json());
  const run = await prisma.researchRun.create({
    data: {
      topic: body.topic,
      lookbackDays: body.lookbackDays,
      manualEvidence: body.manualEvidence,
      githubLanguages: toJson(body.githubLanguages),
      githubTopics: toJson(body.githubTopics)
    },
    include: runInclude
  });

  return NextResponse.json({ run: serializeRun(run) }, { status: 201 });
}
