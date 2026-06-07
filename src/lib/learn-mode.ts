import { z } from "zod";
import type {
  BuildArtifact,
  EvidenceItem,
  Opportunity,
  ProjectSignal,
  ResearchRun
} from "@prisma/client";
import { callLlmJson } from "@/lib/llm";
import { fromJson } from "@/lib/json";

const learnSchema = z.object({
  technologyMap: z.string().min(20),
  buildExplanation: z.string().min(20),
  learningPath: z.string().min(20),
  handsOnTasks: z.string().min(20),
  interviewPrep: z.string().min(20),
  conceptChecks: z.string().min(20)
});

export type LearnModeInput = {
  opportunity: Opportunity;
  run: ResearchRun;
  evidence: EvidenceItem[];
  projects: ProjectSignal[];
  build?: BuildArtifact | null;
};

export type LearnModeResult = z.infer<typeof learnSchema> & {
  agentLogs: Array<{
    agent: string;
    output: string;
  }>;
};

export async function runLearningAgents(input: LearnModeInput): Promise<LearnModeResult> {
  try {
    const technologyMap = await runAgent({
      agent: "Technology cartographer",
      instruction:
        "Create a project-specific technology map. Include core concepts, why each matters, prerequisites, what to learn first, and what can wait.",
      input
    });
    const mentor = await runMentorAgent(input, technologyMap);
    const practice = await runPracticeAgent(input, technologyMap, mentor);
    const parsed = learnSchema.parse({
      technologyMap,
      buildExplanation: mentor.buildExplanation,
      learningPath: mentor.learningPath,
      handsOnTasks: practice.handsOnTasks,
      interviewPrep: practice.interviewPrep,
      conceptChecks: practice.conceptChecks
    });

    return {
      ...parsed,
      agentLogs: [
        { agent: "Technology cartographer", output: technologyMap },
        {
          agent: "Project mentor",
          output: [mentor.buildExplanation, mentor.learningPath].join("\n\n")
        },
        {
          agent: "Practice coach",
          output: [practice.handsOnTasks, practice.interviewPrep, practice.conceptChecks].join("\n\n")
        }
      ]
    };
  } catch {
    return fallbackLearn(input);
  }
}

async function runAgent({
  agent,
  instruction,
  input
}: {
  agent: string;
  instruction: string;
  input: LearnModeInput;
}) {
  const result = await callLlmJson({
    system: `${agent}. Return only JSON with { "output": string }.`,
    user: JSON.stringify({
      instruction,
      project: projectPayload(input)
    })
  });
  return z.object({ output: z.string().min(20) }).parse(result).output;
}

async function runMentorAgent(input: LearnModeInput, technologyMap: string) {
  const result = await callLlmJson({
    system:
      "Project mentor. Return only JSON with { buildExplanation: string, learningPath: string }.",
    user: JSON.stringify({
      instruction:
        "Explain what the user should understand in the generated project, then create a 7-day learning path tied to modifying and improving this exact app.",
      project: projectPayload(input),
      technologyMap
    })
  });

  return z
    .object({
      buildExplanation: z.string().min(20),
      learningPath: z.string().min(20)
    })
    .parse(result);
}

async function runPracticeAgent(
  input: LearnModeInput,
  technologyMap: string,
  mentor: { buildExplanation: string; learningPath: string }
) {
  const result = await callLlmJson({
    system:
      "Practice coach. Return only JSON with { handsOnTasks: string, interviewPrep: string, conceptChecks: string }.",
    user: JSON.stringify({
      instruction:
        "Create hands-on tasks, interview/portfolio prep, and concept checks that force the user to learn the underlying technology instead of only prompting an AI to build it.",
      project: projectPayload(input),
      technologyMap,
      buildExplanation: mentor.buildExplanation,
      learningPath: mentor.learningPath
    })
  });

  return z
    .object({
      handsOnTasks: z.string().min(20),
      interviewPrep: z.string().min(20),
      conceptChecks: z.string().min(20)
    })
    .parse(result);
}

function fallbackLearn(input: LearnModeInput): LearnModeResult {
  const opportunity = input.opportunity;
  const build = input.build;
  const projectNames = input.projects
    .filter((project) => projectIds(input).includes(project.id))
    .slice(0, 4)
    .map((project) => project.fullName ?? project.name);
  const evidenceSources = input.evidence
    .filter((item) => evidenceIds(input).includes(item.id))
    .slice(0, 4)
    .map((item) => `${item.source}: ${item.title}`);

  const technologyMap = [
    `Project: ${opportunity.title}`,
    "",
    "Learn first:",
    `1. User workflow and domain model: understand the real job behind "${opportunity.productWedge}".`,
    "2. Data flow: trace how inputs become stored records, generated outputs, and reviewable artifacts.",
    "3. Evaluation loop: define what a good output means, how to score it, and how to detect regressions.",
    "4. Observability: capture traces, errors, latency, and user feedback before adding more automation.",
    "",
    "Learn later:",
    "1. Scaling and queueing once the core workflow is validated.",
    "2. Advanced integrations after users repeatedly ask for them.",
    "3. Fine-grained permissioning, collaboration, and hosted deployment.",
    projectNames.length ? `Relevant open-source signals: ${projectNames.join(", ")}.` : "",
    evidenceSources.length ? `Evidence to keep close: ${evidenceSources.join(" | ")}.` : ""
  ]
    .filter((line) => line !== "")
    .join("\n");

  const buildExplanation = [
    "The generated demo is a teaching surface, not just a disposable prototype.",
    `It expresses the core product loop for ${opportunity.targetUser}: collect the user's input, run the first useful transformation, and return an output that can be reviewed or saved.`,
    build
      ? "Use the current build plan to identify the frontend workflow, backend responsibilities, data model, and places where real integrations would replace mock data."
      : "Build the demo first, then revisit this explanation and connect each UI element to the backend or data concept it represents.",
    "The senior-engineering learning goal is to explain the system boundaries, failure modes, and validation strategy without relying on generated code as a black box."
  ].join("\n");

  const learningPath = [
    "Day 1: Write the one-page domain model. Define users, inputs, outputs, state transitions, and success criteria.",
    "Day 2: Rebuild the core data flow by hand in a small script or API route. Add one test fixture.",
    "Day 3: Add scoring or validation logic. Decide what a good result means and what should fail.",
    "Day 4: Add observability. Log inputs, outputs, errors, latency, and user corrections.",
    "Day 5: Replace one mock with a real source or realistic fixture. Document the tradeoff.",
    "Day 6: Add regression checks. Make sure yesterday's good examples still pass.",
    "Day 7: Write a portfolio README that explains the architecture, what you learned, and what you would build next."
  ].join("\n");

  const handsOnTasks = [
    "1. Modify the generated demo so one output changes based on a real rule you wrote.",
    "2. Add a new data field and trace it through UI, storage, and generated output.",
    "3. Add a failing example and explain why the current system handles it poorly.",
    "4. Create a tiny evaluation set with 5 examples and expected outcomes.",
    "5. Write one paragraph explaining which part you now understand well enough to debug."
  ].join("\n");

  const interviewPrep = [
    "Portfolio angle: frame this as evidence that you can turn ambiguous demand into a reliable product loop.",
    "Architecture story: explain the data model, generation boundary, evaluation strategy, and why the MVP avoids unnecessary integrations.",
    "Senior backend questions to prepare:",
    "1. What state must be persisted and what can be recomputed?",
    "2. How would you detect output quality regression?",
    "3. What would break under 100x more inputs?",
    "4. How would you separate user workflow code from model/provider code?",
    "5. What would you measure before deciding this is worth productizing?"
  ].join("\n");

  const conceptChecks = [
    "1. Explain the core domain model in 90 seconds.",
    "2. What is the smallest useful evaluation set for this project?",
    "3. Which failure mode would most damage user trust?",
    "4. Which part of the demo is mocked, and how would you replace it safely?",
    "5. What technical decision would you reverse if the product became collaborative?"
  ].join("\n");

  return {
    technologyMap,
    buildExplanation,
    learningPath,
    handsOnTasks,
    interviewPrep,
    conceptChecks,
    agentLogs: [
      { agent: "Technology cartographer", output: technologyMap },
      { agent: "Project mentor", output: [buildExplanation, learningPath].join("\n\n") },
      { agent: "Practice coach", output: [handsOnTasks, interviewPrep, conceptChecks].join("\n\n") }
    ]
  };
}

function projectPayload(input: LearnModeInput) {
  const evidence = input.evidence
    .filter((item) => evidenceIds(input).includes(item.id))
    .slice(0, 8)
    .map((item) => ({ title: item.title, source: item.source, snippet: item.snippet }));
  const projects = input.projects
    .filter((project) => projectIds(input).includes(project.id))
    .slice(0, 8)
    .map((project) => ({
      name: project.fullName ?? project.name,
      description: project.description,
      language: project.language,
      stars: project.stars
    }));

  return {
    run: {
      topic: input.run.topic
    },
    opportunity: {
      title: input.opportunity.title,
      targetUser: input.opportunity.targetUser,
      painSignal: input.opportunity.painSignal,
      productWedge: input.opportunity.productWedge,
      mvpScope: input.opportunity.mvpScope,
      whyNow: input.opportunity.whyNow
    },
    build: input.build
      ? {
          productPlan: input.build.productPlan,
          architecturePlan: input.build.architecturePlan,
          implementationPlan: input.build.implementationPlan
        }
      : null,
    evidence,
    projects
  };
}

function evidenceIds(input: LearnModeInput) {
  return fromJson<string[]>(input.opportunity.evidenceIdsJson, []);
}

function projectIds(input: LearnModeInput) {
  return fromJson<string[]>(input.opportunity.projectIdsJson, []);
}
