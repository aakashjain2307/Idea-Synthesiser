import { z } from "zod";
import type { EvidenceItem, Opportunity, ProjectSignal, ResearchRun } from "@prisma/client";
import { callLlmJson } from "@/lib/llm";
import { fromJson } from "@/lib/json";

const buildSchema = z.object({
  productPlan: z.string().min(20),
  architecturePlan: z.string().min(20),
  implementationPlan: z.string().min(20),
  demoHtml: z.string().min(100)
});

export type BuildModeInput = {
  opportunity: Opportunity;
  run: ResearchRun;
  evidence: EvidenceItem[];
  projects: ProjectSignal[];
};

export type BuildModeResult = z.infer<typeof buildSchema> & {
  agentLogs: Array<{
    agent: string;
    output: string;
  }>;
};

export async function runBuildAgents(input: BuildModeInput): Promise<BuildModeResult> {
  try {
    const product = await runAgent({
      agent: "Product planner",
      instruction:
        "Create a concise product plan for this opportunity. Include target user, core job, MVP promise, primary workflow, and validation plan.",
      input
    });
    const architecture = await runAgent({
      agent: "Technical architect",
      instruction:
        "Create a pragmatic technical architecture for a working demo. Include frontend, backend, data model, integrations, and risks.",
      input,
      prior: product
    });
    const demo = await runDemoAgent(input, product, architecture);
    const parsed = buildSchema.parse({
      productPlan: product,
      architecturePlan: architecture,
      implementationPlan: demo.implementationPlan,
      demoHtml: demo.demoHtml
    });

    return {
      ...parsed,
      agentLogs: [
        { agent: "Product planner", output: product },
        { agent: "Technical architect", output: architecture },
        { agent: "Demo builder", output: demo.implementationPlan }
      ]
    };
  } catch {
    return fallbackBuild(input);
  }
}

async function runAgent({
  agent,
  instruction,
  input,
  prior
}: {
  agent: string;
  instruction: string;
  input: BuildModeInput;
  prior?: string;
}) {
  const result = await callLlmJson({
    system: `${agent}. Return only JSON with { "output": string }.`,
    user: JSON.stringify({
      instruction,
      opportunity: opportunityPayload(input),
      prior
    })
  });
  const parsed = z.object({ output: z.string().min(20) }).parse(result);
  return parsed.output;
}

async function runDemoAgent(input: BuildModeInput, productPlan: string, architecturePlan: string) {
  const result = await callLlmJson({
    system:
      "Demo builder. Return only JSON with { implementationPlan: string, demoHtml: string }. The demoHtml must be a complete self-contained HTML document with inline CSS and JavaScript only.",
    user: JSON.stringify({
      instruction:
        "Build a polished clickable demo for this app idea. It must fit in one HTML file, show realistic sample data, and include at least one interactive control.",
      opportunity: opportunityPayload(input),
      productPlan,
      architecturePlan
    })
  });

  const parsed = z
    .object({
      implementationPlan: z.string().min(20),
      demoHtml: z.string().min(100)
    })
    .parse(result);

  return {
    ...parsed,
    demoHtml: sanitizeDemoHtml(parsed.demoHtml)
  };
}

function fallbackBuild(input: BuildModeInput): BuildModeResult {
  const opportunity = input.opportunity;
  const projects = input.projects.slice(0, 4);
  const evidence = input.evidence.slice(0, 4);

  const productPlan = [
    `Target user: ${opportunity.targetUser}.`,
    `Core pain: ${opportunity.painSignal}`,
    `MVP promise: ${opportunity.productWedge}`,
    "Primary workflow: user lands on the app, adds the main input, reviews AI-generated output, and saves or exports the result.",
    "Validation plan: interview 5 target users, ship a no-auth demo, and measure whether users ask to reuse it on their own data."
  ].join("\n");

  const architecturePlan = [
    "Frontend: single-page React or Next.js dashboard with a focused workflow and saved outputs.",
    "Backend: API routes for ingestion, generation, persistence, and export.",
    "Data: SQLite/Postgres tables for users, source inputs, generated outputs, and feedback.",
    projects.length
      ? `Useful project signals: ${projects.map((project) => project.fullName ?? project.name).join(", ")}.`
      : "Useful project signals: no specific repo dependency is required for the first demo.",
    "Risk: validate the paid workflow before adding integrations or complex automation."
  ].join("\n");

  const implementationPlan = [
    "1. Build the first screen around the main user job.",
    "2. Add sample data and one interactive generation/review loop.",
    "3. Store outputs locally and expose export actions.",
    "4. Add one integration only after a user asks for it twice."
  ].join("\n");

  return {
    productPlan,
    architecturePlan,
    implementationPlan,
    demoHtml: buildFallbackHtml(opportunity, projects, evidence),
    agentLogs: [
      { agent: "Product planner", output: productPlan },
      { agent: "Technical architect", output: architecturePlan },
      { agent: "Demo builder", output: implementationPlan }
    ]
  };
}

function opportunityPayload(input: BuildModeInput) {
  const evidenceIds = fromJson<string[]>(input.opportunity.evidenceIdsJson, []);
  const projectIds = fromJson<string[]>(input.opportunity.projectIdsJson, []);
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
      whyNow: input.opportunity.whyNow,
      scores: {
        demand: input.opportunity.demandScore,
        novelty: input.opportunity.noveltyScore,
        feasibility: input.opportunity.feasibilityScore,
        business: input.opportunity.businessScore,
        confidence: input.opportunity.confidenceScore
      }
    },
    evidence: input.evidence
      .filter((item) => evidenceIds.includes(item.id))
      .slice(0, 8)
      .map((item) => ({ title: item.title, source: item.source, snippet: item.snippet })),
    projects: input.projects
      .filter((project) => projectIds.includes(project.id))
      .slice(0, 8)
      .map((project) => ({
        name: project.fullName ?? project.name,
        description: project.description,
        language: project.language,
        stars: project.stars
      }))
  };
}

function buildFallbackHtml(
  opportunity: Opportunity,
  projects: ProjectSignal[],
  evidence: EvidenceItem[]
) {
  const title = escapeHtml(opportunity.title);
  const projectRows = projects
    .slice(0, 3)
    .map(
      (project) =>
        `<li><strong>${escapeHtml(project.fullName ?? project.name)}</strong><span>${escapeHtml(
          project.description ?? "Project signal"
        )}</span></li>`
    )
    .join("");
  const evidenceRows = evidence
    .slice(0, 3)
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.source)}</strong><span>${escapeHtml(
          item.snippet ?? item.title
        )}</span></li>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #f6f7f2; color: #17202a; }
    .shell { max-width: 1080px; margin: 0 auto; padding: 28px; }
    .top { display:flex; justify-content:space-between; gap:16px; align-items:center; border-bottom:1px solid #d9ded4; padding-bottom:18px; }
    h1 { font-size: 30px; margin: 0; letter-spacing: 0; }
    .pill { border:1px solid #cbd6ce; border-radius:8px; padding:8px 10px; font-size:13px; color:#2f6f5e; background:white; }
    .grid { display:grid; grid-template-columns: 1.1fr .9fr; gap:18px; margin-top:22px; }
    .panel { background:white; border:1px solid #dfe4dc; border-radius:8px; padding:18px; box-shadow:0 18px 48px rgba(23,32,42,.08); }
    label { display:block; font-size:12px; font-weight:700; color:#6b756d; text-transform:uppercase; letter-spacing:.08em; margin-bottom:8px; }
    textarea, input { width:100%; box-sizing:border-box; border:1px solid #d4dbd2; border-radius:8px; padding:12px; font:inherit; }
    textarea { min-height:132px; resize:vertical; }
    button { margin-top:12px; border:0; border-radius:8px; padding:12px 14px; color:white; background:#17202a; font-weight:700; cursor:pointer; }
    .result { margin-top:14px; padding:14px; border-radius:8px; background:#eef6f1; color:#244e43; min-height:58px; }
    ul { list-style:none; padding:0; margin:0; display:grid; gap:10px; }
    li { border:1px solid #e3e7df; border-radius:8px; padding:12px; display:grid; gap:4px; }
    li span { color:#5b675f; font-size:13px; line-height:1.45; }
    @media (max-width: 820px) { .grid { grid-template-columns:1fr; } .top { align-items:flex-start; flex-direction:column; } }
  </style>
</head>
<body>
  <main class="shell">
    <section class="top">
      <div>
        <h1>${title}</h1>
        <p>${escapeHtml(opportunity.productWedge)}</p>
      </div>
      <div class="pill">${escapeHtml(opportunity.targetUser)}</div>
    </section>
    <section class="grid">
      <div class="panel">
        <label for="input">Workflow input</label>
        <textarea id="input">${escapeHtml(opportunity.painSignal)}</textarea>
        <button id="generate">Generate first useful output</button>
        <div class="result" id="result">Click generate to preview the core product loop.</div>
      </div>
      <div class="panel">
        <label>Signals used</label>
        <ul>
          ${projectRows || evidenceRows || "<li><strong>Opportunity signal</strong><span>Grounded in the selected idea card.</span></li>"}
        </ul>
      </div>
    </section>
  </main>
  <script>
    document.getElementById('generate').addEventListener('click', () => {
      const text = document.getElementById('input').value.trim();
      document.getElementById('result').textContent = text
        ? 'Demo output: prioritized workflow, suggested next action, and export-ready summary generated from your input.'
        : 'Add input first.';
    });
  </script>
</body>
</html>`;
}

function sanitizeDemoHtml(html: string) {
  const trimmed = html.trim();
  const withoutFences = trimmed
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  if (/<!doctype html|<html[\s>]/i.test(withoutFences)) {
    return withoutFences;
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Demo</title></head><body>${withoutFences}</body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
