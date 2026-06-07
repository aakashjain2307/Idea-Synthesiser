import { NextResponse } from "next/server";
import { runLearningAgents } from "@/lib/learn-mode";
import { toJson } from "@/lib/json";
import { prisma } from "@/lib/server/prisma";
import { serializeLearnArtifact } from "@/lib/server/serialize";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      buildArtifacts: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
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

  const latestBuild = opportunity.buildArtifacts[0] ?? null;
  const result = await runLearningAgents({
    opportunity,
    run: opportunity.run,
    evidence: opportunity.run.evidenceItems,
    projects: opportunity.run.projectSignals,
    build: latestBuild
  });

  const learnArtifact = await prisma.learnArtifact.create({
    data: {
      opportunityId: id,
      buildArtifactId: latestBuild?.id ?? null,
      status: "complete",
      technologyMap: result.technologyMap,
      buildExplanation: result.buildExplanation,
      learningPath: result.learningPath,
      handsOnTasks: result.handsOnTasks,
      interviewPrep: result.interviewPrep,
      conceptChecks: result.conceptChecks,
      agentLogsJson: toJson(result.agentLogs)
    }
  });

  return NextResponse.json({ learnArtifact: serializeLearnArtifact(learnArtifact) });
}
