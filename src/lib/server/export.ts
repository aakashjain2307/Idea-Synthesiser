import type { EvidenceItem, Opportunity, ProjectSignal, ResearchRun } from "@prisma/client";
import { fromJson } from "@/lib/json";

export function runToMarkdown(input: {
  run: ResearchRun;
  opportunities: Opportunity[];
  evidence: EvidenceItem[];
  projects: ProjectSignal[];
}) {
  const evidenceById = new Map(input.evidence.map((item) => [item.id, item]));
  const projectsById = new Map(input.projects.map((project) => [project.id, project]));

  const lines = [
    `# ${input.run.topic} opportunities`,
    "",
    `Generated: ${new Date().toISOString()}`,
    `Lookback: ${input.run.lookbackDays} days`,
    ""
  ];

  for (const opportunity of input.opportunities) {
    const evidenceIds = fromJson<string[]>(opportunity.evidenceIdsJson, []);
    const projectIds = fromJson<string[]>(opportunity.projectIdsJson, []);
    lines.push(`## ${opportunity.title}`);
    lines.push("");
    lines.push(`Target user: ${opportunity.targetUser}`);
    lines.push("");
    lines.push(`Pain signal: ${opportunity.painSignal}`);
    lines.push("");
    lines.push(`Product wedge: ${opportunity.productWedge}`);
    lines.push("");
    lines.push(`MVP scope: ${opportunity.mvpScope}`);
    lines.push("");
    lines.push(`Why now: ${opportunity.whyNow}`);
    lines.push("");
    lines.push(
      `Scores: demand ${opportunity.demandScore}/10, novelty ${opportunity.noveltyScore}/10, feasibility ${opportunity.feasibilityScore}/10, business ${opportunity.businessScore}/10, confidence ${opportunity.confidenceScore}/10`
    );
    lines.push("");
    lines.push("Evidence:");
    evidenceIds.forEach((id) => {
      const item = evidenceById.get(id);
      if (item) {
        lines.push(`- ${item.title}${item.url ? ` (${item.url})` : ""}`);
      }
    });
    lines.push("");
    if (projectIds.length) {
      lines.push("Related projects:");
      projectIds.forEach((id) => {
        const project = projectsById.get(id);
        if (project) {
          lines.push(
            `- ${project.fullName ?? project.name}${project.url ? ` (${project.url})` : ""}`
          );
        }
      });
      lines.push("");
    }
  }

  return lines.join("\n");
}
