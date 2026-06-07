import { NextResponse } from "next/server";
import { runBuildAgents } from "@/lib/build-mode";
import { toJson } from "@/lib/json";
import { prisma } from "@/lib/server/prisma";
import { serializeBuildArtifact } from "@/lib/server/serialize";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      run: {
        include: {
          evidenceItems: true,
          projectSignals: true
        }
      }
    }
  });

  if (!opportunity) {
    return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
  }

  const result = await runBuildAgents({
    opportunity,
    run: opportunity.run,
    evidence: opportunity.run.evidenceItems,
    projects: opportunity.run.projectSignals
  });

  const buildArtifact = await prisma.buildArtifact.create({
    data: {
      opportunityId: id,
      status: "complete",
      productPlan: result.productPlan,
      architecturePlan: result.architecturePlan,
      implementationPlan: result.implementationPlan,
      demoHtml: result.demoHtml,
      agentLogsJson: toJson(result.agentLogs)
    }
  });

  return NextResponse.json({ buildArtifact: serializeBuildArtifact(buildArtifact) });
}
