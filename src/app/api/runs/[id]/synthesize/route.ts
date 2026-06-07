import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { runInclude } from "@/lib/server/collect";
import { serializeRun } from "@/lib/server/serialize";
import { synthesizeOpportunities } from "@/lib/synthesis";
import { toJson } from "@/lib/json";

export async function POST(
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

  if (!run.evidenceItems.length && !run.projectSignals.length) {
    return NextResponse.json(
      { error: "Collect evidence or project signals before synthesizing opportunities." },
      { status: 400 }
    );
  }

  const drafts = await synthesizeOpportunities({
    topic: run.topic,
    evidence: run.evidenceItems,
    projects: run.projectSignals,
    clusters: run.clusters
  });

  await prisma.opportunity.deleteMany({ where: { runId: id } });

  for (const draft of drafts) {
    await prisma.opportunity.create({
      data: {
        runId: id,
        title: draft.title,
        targetUser: draft.targetUser,
        painSignal: draft.painSignal,
        productWedge: draft.productWedge,
        mvpScope: draft.mvpScope,
        whyNow: draft.whyNow,
        demandScore: draft.demandScore,
        noveltyScore: draft.noveltyScore,
        feasibilityScore: draft.feasibilityScore,
        businessScore: draft.businessScore,
        confidenceScore: draft.confidenceScore,
        evidenceIdsJson: toJson(draft.evidenceIds),
        projectIdsJson: toJson(draft.projectIds),
        rawJson: draft.raw ? toJson(draft.raw) : null
      }
    });
  }

  const updated = await prisma.researchRun.update({
    where: { id },
    data: { status: "synthesized" },
    include: runInclude
  });

  return NextResponse.json({ run: serializeRun(updated) });
}
