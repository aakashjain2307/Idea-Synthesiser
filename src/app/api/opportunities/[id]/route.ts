import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { serializeOpportunity } from "@/lib/server/serialize";
import { toJson } from "@/lib/json";

const updateSchema = z.object({
  status: z.string().optional(),
  notes: z.string().optional(),
  isSaved: z.boolean().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = updateSchema.parse(await request.json());

  const opportunity = await prisma.opportunity.update({
    where: { id },
    data: {
      status: body.status,
      notes: body.notes,
      isSaved: body.isSaved
    },
    include: {
      buildArtifacts: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      learnArtifacts: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  if (body.isSaved) {
    await prisma.savedIdea.upsert({
      where: { opportunityId: id },
      update: {
        title: opportunity.title,
        notes: opportunity.notes,
        snapshotJson: toJson(opportunity)
      },
      create: {
        runId: opportunity.runId,
        opportunityId: opportunity.id,
        title: opportunity.title,
        notes: opportunity.notes,
        snapshotJson: toJson(opportunity)
      }
    });
  }

  if (body.isSaved === false) {
    await prisma.savedIdea.deleteMany({ where: { opportunityId: id } });
  }

  return NextResponse.json({ opportunity: serializeOpportunity(opportunity) });
}
