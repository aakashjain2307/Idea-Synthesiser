"use client";

import {
  Activity,
  Archive,
  BookOpen,
  Boxes,
  Check,
  ChevronRight,
  Database,
  Download,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Github,
  Hammer,
  Heart,
  Loader2,
  Radar,
  RefreshCw,
  Save,
  Search,
  Settings,
  Sparkles,
  Tags,
  PlugZap
} from "lucide-react";
import type { ComponentType } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Health = {
  source: string;
  status: "ready" | "degraded" | "missing";
  message: string;
};

type RunListItem = {
  id: string;
  topic: string;
  lookbackDays: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  counts: {
    opportunities: number;
    evidence: number;
    projects: number;
  };
};

type EvidenceItem = {
  id: string;
  source: string;
  title: string;
  url?: string | null;
  snippet?: string | null;
  body?: string | null;
  score?: number | null;
  container?: string | null;
};

type ProjectSignal = {
  id: string;
  source: string;
  name: string;
  fullName?: string | null;
  url?: string | null;
  description?: string | null;
  language?: string | null;
  stars?: number | null;
  starVelocity?: number | null;
  topics?: string[];
};

type Cluster = {
  id: string;
  title: string;
  score?: number | null;
  sources?: string[];
};

type BuildArtifact = {
  id: string;
  status: string;
  productPlan: string;
  architecturePlan: string;
  implementationPlan: string;
  demoHtml: string;
  agentLogs?: Array<{
    agent: string;
    output: string;
  }>;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
};

type LearnArtifact = {
  id: string;
  opportunityId: string;
  buildArtifactId?: string | null;
  status: string;
  technologyMap: string;
  buildExplanation: string;
  learningPath: string;
  handsOnTasks: string;
  interviewPrep: string;
  conceptChecks: string;
  agentLogs?: Array<{
    agent: string;
    output: string;
  }>;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
};

type Opportunity = {
  id: string;
  title: string;
  targetUser: string;
  painSignal: string;
  productWedge: string;
  mvpScope: string;
  whyNow: string;
  demandScore: number;
  noveltyScore: number;
  feasibilityScore: number;
  businessScore: number;
  confidenceScore: number;
  evidenceIds: string[];
  projectIds: string[];
  status: string;
  notes?: string | null;
  isSaved: boolean;
  buildArtifacts: BuildArtifact[];
  learnArtifacts: LearnArtifact[];
};

type SourceRun = {
  id: string;
  source: string;
  status: string;
  counts?: Record<string, number>;
  warnings?: string[];
  error?: string | null;
};

type ResearchRun = {
  id: string;
  topic: string;
  lookbackDays: number;
  status: string;
  manualEvidence?: string | null;
  last30daysRawPath?: string | null;
  last30daysPlan?: string | null;
  sourceCoverage?: Record<string, number>;
  warnings?: string[];
  createdAt: string;
  evidenceItems: EvidenceItem[];
  projectSignals: ProjectSignal[];
  clusters: Cluster[];
  opportunities: Opportunity[];
  sourceRuns: SourceRun[];
};

type LibraryIdea = {
  id: string;
  title: string;
  notes?: string | null;
  createdAt: string;
};

type LlmPreset = {
  provider: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  needsApiKey: boolean;
};

type LlmSettings = {
  active: {
    provider: string;
    baseUrl: string;
    model: string;
    apiKeyConfigured: boolean;
    source: "database" | "environment";
  };
  presets: LlmPreset[];
};

type LlmDraft = {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
};

const tabs = ["Opportunities", "Evidence", "Projects", "Clusters", "Last30Days"] as const;

export function Dashboard() {
  const [health, setHealth] = useState<Health[]>([]);
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [selectedRun, setSelectedRun] = useState<ResearchRun | null>(null);
  const [library, setLibrary] = useState<LibraryIdea[]>([]);
  const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null);
  const [llmDraft, setLlmDraft] = useState<LlmDraft>({
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    apiKey: ""
  });
  const [llmStatus, setLlmStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Opportunities");
  const [topic, setTopic] = useState("I want app ideas that can make $10k/month");
  const [lookbackDays, setLookbackDays] = useState(30);
  const [languages, setLanguages] = useState("TypeScript, Python");
  const [githubTopics, setGithubTopics] = useState("");
  const [manualEvidence, setManualEvidence] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [buildingOpportunityId, setBuildingOpportunityId] = useState<string | null>(null);
  const [learningOpportunityId, setLearningOpportunityId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadInitial();
  }, []);

  async function loadInitial() {
    const [healthResponse, runsResponse, libraryResponse, llmResponse] = await Promise.all([
      fetchJson<{ health: Health[] }>("/api/source-health"),
      fetchJson<{ runs: RunListItem[] }>("/api/runs"),
      fetchJson<{ ideas: LibraryIdea[] }>("/api/library"),
      fetchJson<LlmSettings>("/api/llm-settings")
    ]);

    setHealth(healthResponse.health);
    setRuns(runsResponse.runs);
    setLibrary(libraryResponse.ideas);
    setLlmSettings(llmResponse);
    setLlmDraft((current) => ({
      ...current,
      provider: llmResponse.active.provider,
      baseUrl: llmResponse.active.baseUrl,
      model: llmResponse.active.model,
      apiKey: ""
    }));

    if (!selectedRun && runsResponse.runs[0]) {
      await selectRun(runsResponse.runs[0].id);
    }
  }

  async function saveLlmSettings({ test = false }: { test?: boolean } = {}) {
    setLlmStatus(test ? "Saving and testing model provider..." : "Saving model provider...");
    setError(null);

    try {
      const saved = await fetchJson<{ active: LlmSettings["active"] }>("/api/llm-settings", {
        method: "POST",
        body: JSON.stringify(llmDraft)
      });

      setLlmSettings((current) =>
        current
          ? {
              ...current,
              active: saved.active
            }
          : current
      );
      setLlmDraft((current) => ({ ...current, apiKey: "" }));

      if (test) {
        const tested = await fetchJson<{ ok: boolean; config: LlmSettings["active"] }>(
          "/api/llm-settings/test",
          { method: "POST" }
        );
        setLlmStatus(tested.ok ? `Connected to ${tested.config.model}.` : "Provider test failed.");
      } else {
        setLlmStatus("Model provider saved.");
      }

      await loadInitial();
    } catch (caught) {
      setLlmStatus(caught instanceof Error ? caught.message : "Could not save model provider.");
    }
  }

  function applyLlmPreset(provider: string) {
    const preset = llmSettings?.presets.find((item) => item.provider === provider);
    if (!preset) {
      setLlmDraft((current) => ({ ...current, provider }));
      return;
    }

    setLlmDraft({
      provider: preset.provider,
      baseUrl: preset.baseUrl,
      model: preset.defaultModel,
      apiKey: ""
    });
    setLlmStatus(null);
  }

  async function selectRun(id: string) {
    const response = await fetchJson<{ run: ResearchRun }>(`/api/runs/${id}`);
    setSelectedRun(response.run);
  }

  async function createRun(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy("Creating research run");

    try {
      const created = await fetchJson<{ run: ResearchRun }>("/api/runs", {
        method: "POST",
        body: JSON.stringify({
          topic,
          lookbackDays,
          manualEvidence,
          githubLanguages: listFromText(languages),
          githubTopics: listFromText(githubTopics)
        })
      });

      setSelectedRun(created.run);
      setBusy("Collecting recent signals");
      const collected = await fetchJson<{ run: ResearchRun }>(
        `/api/runs/${created.run.id}/collect`,
        { method: "POST" }
      );
      setSelectedRun(collected.run);

      setBusy("Synthesizing opportunities");
      const synthesized = await fetchJson<{ run: ResearchRun }>(
        `/api/runs/${created.run.id}/synthesize`,
        { method: "POST" }
      );
      setSelectedRun(synthesized.run);
      setActiveTab("Opportunities");
      await loadInitial();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something failed.");
    } finally {
      setBusy(null);
    }
  }

  async function updateOpportunity(id: string, patch: Partial<Opportunity>) {
    if (!selectedRun) {
      return;
    }

    const response = await fetchJson<{ opportunity: Opportunity }>(`/api/opportunities/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });

    setSelectedRun({
      ...selectedRun,
      opportunities: selectedRun.opportunities.map((item) =>
        item.id === id ? response.opportunity : item
      )
    });
    await loadInitial();
  }

  async function buildOpportunity(id: string) {
    setError(null);
    setBuildingOpportunityId(id);

    try {
      const response = await fetchJson<{ buildArtifact: BuildArtifact }>(
        `/api/opportunities/${id}/build`,
        { method: "POST" }
      );

      setSelectedRun((current) =>
        current
          ? {
              ...current,
              opportunities: current.opportunities.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      buildArtifacts: [
                        response.buildArtifact,
                        ...(item.buildArtifacts ?? []).filter(
                          (build) => build.id !== response.buildArtifact.id
                        )
                      ]
                    }
                  : item
              )
            }
          : current
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not build this idea.");
    } finally {
      setBuildingOpportunityId(null);
    }
  }

  async function learnOpportunity(id: string) {
    setError(null);
    setLearningOpportunityId(id);

    try {
      const response = await fetchJson<{ learnArtifact: LearnArtifact }>(
        `/api/opportunities/${id}/learn`,
        { method: "POST" }
      );

      setSelectedRun((current) =>
        current
          ? {
              ...current,
              opportunities: current.opportunities.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      learnArtifacts: [
                        response.learnArtifact,
                        ...(item.learnArtifacts ?? []).filter(
                          (learn) => learn.id !== response.learnArtifact.id
                        )
                      ]
                    }
                  : item
              )
            }
          : current
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create a learning plan.");
    } finally {
      setLearningOpportunityId(null);
    }
  }

  const evidenceById = useMemo(
    () => new Map(selectedRun?.evidenceItems.map((item) => [item.id, item]) ?? []),
    [selectedRun]
  );
  const projectsById = useMemo(
    () => new Map(selectedRun?.projectSignals.map((item) => [item.id, item]) ?? []),
    [selectedRun]
  );
  const selectedLlmPreset = useMemo(
    () => llmSettings?.presets.find((item) => item.provider === llmDraft.provider),
    [llmDraft.provider, llmSettings]
  );
  const modelOptions = selectedLlmPreset?.models ?? [];
  const selectedModelOption = modelOptions.includes(llmDraft.model) ? llmDraft.model : "__custom";

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-5 px-4 py-4 lg:px-6">
        <header className="flex flex-col gap-3 border-b border-ink/10 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-ink text-white">
              <Radar className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-ink">Idea Synthesizer</h1>
              <p className="text-sm text-ink/60">
                Local opportunity radar powered by Last30Days and GitHub Scout.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={`${health.filter((item) => item.status === "ready").length} ready`} />
            <StatusPill
              label={`${health.filter((item) => item.status !== "ready").length} degraded`}
              tone="amber"
            />
            {selectedRun ? (
              <>
                <a
                  className="icon-button"
                  href={`/api/export/runs/${selectedRun.id}?format=md`}
                  title="Export Markdown"
                >
                  <Download className="h-4 w-4" />
                  Markdown
                </a>
                <a
                  className="icon-button"
                  href={`/api/export/runs/${selectedRun.id}?format=json`}
                  title="Export JSON"
                >
                  <Database className="h-4 w-4" />
                  JSON
                </a>
              </>
            ) : null}
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4">
            <section className="panel">
              <div className="section-title">
                <Search className="h-4 w-4" />
                New run
              </div>
              <form className="mt-4 flex flex-col gap-3" onSubmit={createRun}>
                <label className="field-label" htmlFor="topic">
                  Intent
                </label>
                <input
                  id="topic"
                  className="input"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="I want to get hired at AI labs. What should I build?"
                  required
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label" htmlFor="days">
                      Lookback
                    </label>
                    <input
                      id="days"
                      className="input"
                      type="number"
                      min={1}
                      max={90}
                      value={lookbackDays}
                      onChange={(event) => setLookbackDays(Number(event.target.value))}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="languages">
                      Languages
                    </label>
                    <input
                      id="languages"
                      className="input"
                      value={languages}
                      onChange={(event) => setLanguages(event.target.value)}
                    />
                  </div>
                </div>

                <label className="field-label" htmlFor="topics">
                  GitHub topics
                </label>
                <input
                  id="topics"
                  className="input"
                  value={githubTopics}
                  onChange={(event) => setGithubTopics(event.target.value)}
                  placeholder="Optional, like evals, compliance, mobile"
                />

                <label className="field-label" htmlFor="manual">
                  Manual evidence
                </label>
                <textarea
                  id="manual"
                  className="textarea min-h-[120px]"
                  value={manualEvidence}
                  onChange={(event) => setManualEvidence(event.target.value)}
                  placeholder="Paste links, notes, quotes, or half-formed hunches."
                />

                <button className="primary-button" disabled={Boolean(busy)}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {busy ?? "Run research"}
                </button>
                {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
              </form>
            </section>

            <section className="panel">
              <div className="section-title">
                <Settings className="h-4 w-4" />
                Model provider
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <label className="field-label" htmlFor="llm-provider">
                  Provider
                </label>
                <select
                  id="llm-provider"
                  className="select"
                  value={llmDraft.provider}
                  onChange={(event) => applyLlmPreset(event.target.value)}
                >
                  {(llmSettings?.presets ?? []).map((preset) => (
                    <option key={preset.provider} value={preset.provider}>
                      {preset.label}
                    </option>
                  ))}
                </select>

                <label className="field-label" htmlFor="llm-base-url">
                  Base URL
                </label>
                <input
                  id="llm-base-url"
                  className="input"
                  value={llmDraft.baseUrl}
                  onChange={(event) =>
                    setLlmDraft((current) => ({ ...current, baseUrl: event.target.value }))
                  }
                />

                <label className="field-label" htmlFor="llm-model">
                  Model
                </label>
                <select
                  id="llm-model"
                  className="select"
                  value={selectedModelOption}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (next === "__custom") {
                      return;
                    }
                    setLlmDraft((current) => ({ ...current, model: next }));
                  }}
                >
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                  <option value="__custom">Custom model</option>
                </select>
                <input
                  className="input"
                  value={llmDraft.model}
                  onChange={(event) =>
                    setLlmDraft((current) => ({ ...current, model: event.target.value }))
                  }
                  placeholder="Enter a custom model id"
                />

                <label className="field-label" htmlFor="llm-api-key">
                  API key
                </label>
                <input
                  id="llm-api-key"
                  className="input"
                  type="password"
                  value={llmDraft.apiKey}
                  onChange={(event) =>
                    setLlmDraft((current) => ({ ...current, apiKey: event.target.value }))
                  }
                  placeholder={
                    llmSettings?.active.apiKeyConfigured
                      ? "Saved key configured"
                      : llmDraft.provider === "ollama"
                        ? "Not needed for local Ollama"
                        : "Paste provider key"
                  }
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void saveLlmSettings()}
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void saveLlmSettings({ test: true })}
                  >
                    <PlugZap className="h-4 w-4" />
                    Save & test
                  </button>
                </div>

                <div className="rounded-lg border border-ink/10 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/45">
                    Active
                  </p>
                  <p className="mt-1 text-sm text-ink/70">
                    {llmSettings?.active.provider ?? "openai"} ·{" "}
                    {llmSettings?.active.model ?? "gpt-4.1-mini"}
                  </p>
                  <p className="mt-1 text-xs text-ink/55">
                    {llmSettings?.active.apiKeyConfigured || llmSettings?.active.provider === "ollama"
                      ? "Credentials ready"
                      : "No key configured"}
                  </p>
                </div>
                {llmStatus ? <p className="text-sm text-ink/65">{llmStatus}</p> : null}
              </div>
            </section>

            <section className="panel">
              <div className="section-title">
                <Activity className="h-4 w-4" />
                Source health
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {health.map((item) => (
                  <div key={item.source} className="rounded-lg border border-ink/10 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-ink">{item.source}</span>
                      <SourceStatus status={item.status} />
                    </div>
                    <p className="mt-1 text-xs leading-5 text-ink/60">{item.message}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="section-title">
                <Archive className="h-4 w-4" />
                Recent runs
              </div>
              <div className="mt-3 flex max-h-[330px] flex-col gap-2 overflow-auto pr-1 thin-scrollbar">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    className={`run-row ${selectedRun?.id === run.id ? "run-row-active" : ""}`}
                    onClick={() => void selectRun(run.id)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{run.topic}</span>
                      <span className="mt-1 block text-xs text-ink/55">
                        {run.counts.opportunities} ideas, {run.counts.evidence} signals,{" "}
                        {run.counts.projects} projects
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </button>
                ))}
                {!runs.length ? <p className="text-sm text-ink/55">No runs yet.</p> : null}
              </div>
            </section>
          </aside>

          <section className="min-w-0">
            {selectedRun ? (
              <div className="flex flex-col gap-4">
                <RunHeader run={selectedRun} onRefresh={() => void selectRun(selectedRun.id)} />

                <div className="flex flex-wrap gap-2 border-b border-ink/10">
                  {tabs.map((tab) => (
                    <button
                      key={tab}
                      className={`tab-button ${activeTab === tab ? "tab-button-active" : ""}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {activeTab === "Opportunities" ? (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {selectedRun.opportunities.map((opportunity) => (
                      <OpportunityCard
                        key={opportunity.id}
                        opportunity={opportunity}
                        evidenceById={evidenceById}
                        projectsById={projectsById}
                        onSave={() =>
                          void updateOpportunity(opportunity.id, {
                            isSaved: !opportunity.isSaved
                          })
                        }
                        onStatus={(status) => void updateOpportunity(opportunity.id, { status })}
                        onBuild={() => void buildOpportunity(opportunity.id)}
                        isBuilding={buildingOpportunityId === opportunity.id}
                        onLearn={() => void learnOpportunity(opportunity.id)}
                        isLearning={learningOpportunityId === opportunity.id}
                      />
                    ))}
                    {!selectedRun.opportunities.length ? (
                      <EmptyState icon={FlaskConical} label="No opportunities synthesized yet." />
                    ) : null}
                  </div>
                ) : null}

                {activeTab === "Evidence" ? <EvidenceTable items={selectedRun.evidenceItems} /> : null}
                {activeTab === "Projects" ? (
                  <ProjectsGrid projects={selectedRun.projectSignals} />
                ) : null}
                {activeTab === "Clusters" ? <ClustersGrid clusters={selectedRun.clusters} /> : null}
                {activeTab === "Last30Days" ? <Last30DaysPanel run={selectedRun} /> : null}
              </div>
            ) : (
              <EmptyState icon={Radar} label="Start a run to populate the cockpit." />
            )}

            {library.length ? (
              <section className="mt-5">
                <div className="section-title mb-3">
                  <BookOpen className="h-4 w-4" />
                  Saved library
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {library.slice(0, 6).map((idea) => (
                    <div key={idea.id} className="rounded-lg border border-ink/10 bg-white p-3">
                      <p className="line-clamp-2 text-sm font-medium text-ink">{idea.title}</p>
                      <p className="mt-2 text-xs text-ink/55">
                        Saved {new Date(idea.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function RunHeader({ run, onRefresh }: { run: ResearchRun; onRefresh: () => void }) {
  const warnings = run.warnings ?? [];
  return (
    <section className="panel">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={run.status} tone={run.status === "synthesized" ? "green" : "blue"} />
            <StatusPill label={`${run.lookbackDays} days`} />
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-normal text-ink">{run.topic}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Metric label="Ideas" value={run.opportunities.length} />
            <Metric label="Evidence" value={run.evidenceItems.length} />
            <Metric label="Projects" value={run.projectSignals.length} />
            <Metric label="Clusters" value={run.clusters.length} />
          </div>
        </div>
        <button className="secondary-button" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>
      {warnings.length ? (
        <div className="mt-4 rounded-lg border border-amberline/25 bg-[#fff8ed] p-3">
          <p className="text-sm font-medium text-amberline">Degraded signals</p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-ink/65">
            {warnings.slice(0, 5).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function OpportunityCard({
  opportunity,
  evidenceById,
  projectsById,
  onSave,
  onStatus,
  onBuild,
  isBuilding,
  onLearn,
  isLearning
}: {
  opportunity: Opportunity;
  evidenceById: Map<string, EvidenceItem>;
  projectsById: Map<string, ProjectSignal>;
  onSave: () => void;
  onStatus: (status: string) => void;
  onBuild: () => void;
  isBuilding: boolean;
  onLearn: () => void;
  isLearning: boolean;
}) {
  const citedEvidence = opportunity.evidenceIds
    .map((id) => evidenceById.get(id))
    .filter(Boolean) as EvidenceItem[];
  const citedProjects = opportunity.projectIds
    .map((id) => projectsById.get(id))
    .filter(Boolean) as ProjectSignal[];
  const latestBuild = opportunity.buildArtifacts?.[0];
  const latestLearn = opportunity.learnArtifacts?.[0];

  return (
    <article className="rounded-lg border border-ink/10 bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-normal text-ink">{opportunity.title}</h3>
          <p className="mt-1 text-sm text-ink/60">{opportunity.targetUser}</p>
        </div>
        <button
          className={`square-button ${opportunity.isSaved ? "square-button-active" : ""}`}
          onClick={onSave}
          title={opportunity.isSaved ? "Remove from library" : "Save to library"}
        >
          {opportunity.isSaved ? <Heart className="h-4 w-4 fill-current" /> : <Save className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <TextBlock label="Pain signal" value={opportunity.painSignal} />
        <TextBlock label="Product wedge" value={opportunity.productWedge} />
        <TextBlock label="MVP scope" value={opportunity.mvpScope} />
        <TextBlock label="Why now" value={opportunity.whyNow} />
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        <Score label="Demand" value={opportunity.demandScore} />
        <Score label="Novelty" value={opportunity.noveltyScore} />
        <Score label="Build" value={opportunity.feasibilityScore} />
        <Score label="Biz" value={opportunity.businessScore} />
        <Score label="Conf" value={opportunity.confidenceScore} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          className="select"
          value={opportunity.status}
          onChange={(event) => onStatus(event.target.value)}
        >
          <option value="new">New</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="validating">Validating</option>
          <option value="parked">Parked</option>
        </select>
        <button className="primary-button" type="button" onClick={onBuild} disabled={isBuilding}>
          {isBuilding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hammer className="h-4 w-4" />}
          {isBuilding ? "Building" : latestBuild ? "Rebuild" : "Build"}
        </button>
        <button className="secondary-button" type="button" onClick={onLearn} disabled={isLearning}>
          {isLearning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GraduationCap className="h-4 w-4" />
          )}
          {isLearning ? "Learning" : latestLearn ? "Refresh learning" : "Learn"}
        </button>
      </div>

      {latestBuild ? <BuildArtifactPanel build={latestBuild} /> : null}
      {latestLearn ? <LearnArtifactPanel learn={latestLearn} /> : null}

      <div className="mt-4 border-t border-ink/10 pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink/45">
          Cited evidence
        </p>
        <div className="flex flex-col gap-2">
          {citedEvidence.slice(0, 3).map((item) => (
            <EvidenceLink key={item.id} item={item} />
          ))}
        </div>
      </div>

      {citedProjects.length ? (
        <div className="mt-4 border-t border-ink/10 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink/45">
            Related projects
          </p>
          <div className="flex flex-wrap gap-2">
            {citedProjects.map((project) => (
              <a
                key={project.id}
                className="project-chip"
                href={project.url ?? "#"}
                target="_blank"
                rel="noreferrer"
              >
                <Github className="h-3.5 w-3.5" />
                {project.fullName ?? project.name}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function BuildArtifactPanel({ build }: { build: BuildArtifact }) {
  const agentLogs = build.agentLogs ?? [];

  return (
    <div className="mt-4 rounded-lg border border-moss/20 bg-[#f7fbf8] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-moss">
          Build mode
        </p>
        <StatusPill label={build.status} tone="green" />
      </div>

      <div className="mt-3 grid gap-3">
        <BuildText label="Product agent" value={build.productPlan} />
        <BuildText label="Architecture agent" value={build.architecturePlan} />
        <BuildText label="Demo agent" value={build.implementationPlan} />
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-ink/10 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 bg-ink/[0.03] px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/45">
            Working demo
          </p>
          <a
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-ink/10 bg-white px-2.5 text-xs font-medium text-ink/70 transition hover:border-lake/25 hover:bg-lake/5 hover:text-lake"
            href={`/builds/${build.id}`}
            onClick={(event) => {
              event.preventDefault();
              window.open(event.currentTarget.href, "_blank", "noopener,noreferrer");
            }}
            target="_blank"
            rel="noreferrer"
            title="Open full demo in a new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open full demo
          </a>
        </div>
        <iframe
          title={`Build demo ${build.id}`}
          className="h-[420px] w-full bg-white"
          sandbox="allow-forms allow-scripts"
          srcDoc={build.demoHtml}
        />
      </div>

      {agentLogs.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-ink/65">Agent logs</summary>
          <div className="mt-2 grid gap-2">
            {agentLogs.map((log) => (
              <div key={log.agent} className="rounded-lg border border-ink/10 bg-white p-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/45">
                  {log.agent}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-ink/60">
                  {log.output}
                </p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function LearnArtifactPanel({ learn }: { learn: LearnArtifact }) {
  const agentLogs = learn.agentLogs ?? [];

  return (
    <div className="mt-4 rounded-lg border border-lake/20 bg-[#f7f9ff] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-lake" />
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-lake">
            Learn mode
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={learn.buildArtifactId ? "build-linked" : "idea-linked"} tone="blue" />
          <a
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-ink/10 bg-white px-2.5 text-xs font-medium text-ink/70 transition hover:border-lake/25 hover:bg-lake/5 hover:text-lake"
            href={`/learns/${learn.id}`}
            onClick={(event) => {
              event.preventDefault();
              window.open(event.currentTarget.href, "_blank", "noopener,noreferrer");
            }}
            target="_blank"
            rel="noreferrer"
            title="Open learning plan in a new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open learning plan
          </a>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <LearnSection label="Technology map" value={learn.technologyMap} defaultOpen />
        <LearnSection label="Build explanation" value={learn.buildExplanation} />
        <LearnSection label="Learning path" value={learn.learningPath} />
        <LearnSection label="Hands-on tasks" value={learn.handsOnTasks} />
        <LearnSection label="Interview prep" value={learn.interviewPrep} />
        <LearnSection label="Concept checks" value={learn.conceptChecks} />
      </div>

      {agentLogs.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-ink/65">Learning agent logs</summary>
          <div className="mt-2 grid gap-2">
            {agentLogs.map((log) => (
              <div key={log.agent} className="rounded-lg border border-ink/10 bg-white p-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/45">
                  {log.agent}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-ink/60">
                  {log.output}
                </p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function LearnSection({
  label,
  value,
  defaultOpen = false
}: {
  label: string;
  value: string;
  defaultOpen?: boolean;
}) {
  return (
    <details className="rounded-lg border border-ink/10 bg-white p-3" open={defaultOpen}>
      <summary className="cursor-pointer text-sm font-semibold text-ink/75">{label}</summary>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-ink/65">{value}</p>
    </details>
  );
}

function BuildText({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/45">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-ink/70">{value}</p>
    </div>
  );
}

function EvidenceTable({ items }: { items: EvidenceItem[] }) {
  return (
    <div className="panel overflow-hidden p-0">
      <div className="grid grid-cols-[120px_minmax(0,1fr)_90px] border-b border-ink/10 bg-ink/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink/50">
        <span>Source</span>
        <span>Signal</span>
        <span>Score</span>
      </div>
      <div className="max-h-[720px] overflow-auto thin-scrollbar">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[120px_minmax(0,1fr)_90px] gap-3 border-b border-ink/10 px-4 py-3 last:border-b-0"
          >
            <span className="source-badge">{item.source}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer" title="Open source">
                    <ExternalLink className="h-3.5 w-3.5 text-lake" />
                  </a>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink/60">
                {item.snippet ?? item.body}
              </p>
            </div>
            <span className="text-sm font-medium text-ink/70">
              {item.score ? Math.round(item.score) : "-"}
            </span>
          </div>
        ))}
        {!items.length ? <EmptyState icon={Database} label="No evidence collected." /> : null}
      </div>
    </div>
  );
}

function ProjectsGrid({ projects }: { projects: ProjectSignal[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <article key={project.id} className="rounded-lg border border-ink/10 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {project.fullName ?? project.name}
              </p>
              <p className="mt-1 text-xs text-ink/55">{project.source}</p>
            </div>
            {project.url ? (
              <a href={project.url} target="_blank" rel="noreferrer" title="Open project">
                <ExternalLink className="h-4 w-4 text-lake" />
              </a>
            ) : null}
          </div>
          <p className="mt-3 line-clamp-3 min-h-[60px] text-sm leading-5 text-ink/60">
            {project.description ?? "No description captured."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink/60">
            <span className="metric-chip">{project.language ?? "Unknown"}</span>
            <span className="metric-chip">{project.stars ?? 0} stars</span>
            <span className="metric-chip">{project.starVelocity ?? 0}/30d</span>
          </div>
        </article>
      ))}
      {!projects.length ? <EmptyState icon={Github} label="No projects collected." /> : null}
    </div>
  );
}

function ClustersGrid({ clusters }: { clusters: Cluster[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {clusters.map((cluster) => (
        <article key={cluster.id} className="rounded-lg border border-ink/10 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-ink">{cluster.title}</h3>
            <span className="score-pill">{cluster.score ? Math.round(cluster.score) : "-"}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(cluster.sources ?? []).map((source) => (
              <span key={source} className="source-badge">
                {source}
              </span>
            ))}
          </div>
        </article>
      ))}
      {!clusters.length ? <EmptyState icon={Boxes} label="No clusters available." /> : null}
    </div>
  );
}

function Last30DaysPanel({ run }: { run: ResearchRun }) {
  const coverage = Object.entries(run.sourceCoverage ?? {}).filter(([, count]) => count > 0);
  return (
    <div className="panel">
      <div className="section-title">
        <Tags className="h-4 w-4" />
        Last30Days report
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-ink/10 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/45">
            Raw artifact
          </p>
          <p className="mt-2 break-all text-sm text-ink/70">
            {run.last30daysRawPath ?? "No raw file path captured."}
          </p>
        </div>
        <div className="rounded-lg border border-ink/10 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/45">
            Source runs
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {run.sourceRuns.map((source) => (
              <StatusPill key={source.id} label={`${source.source}: ${source.status}`} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {coverage.map(([source, count]) => (
          <span key={source} className="metric-chip">
            {source}: {count}
          </span>
        ))}
        {!coverage.length ? <span className="text-sm text-ink/55">No positive source coverage yet.</span> : null}
      </div>
      <pre className="mt-4 max-h-[360px] overflow-auto rounded-lg bg-ink p-4 text-xs leading-5 text-white thin-scrollbar">
        {run.last30daysPlan ?? "No explicit query plan was stored."}
      </pre>
    </div>
  );
}

function EvidenceLink({ item }: { item: EvidenceItem }) {
  const body = (
    <>
      <span className="source-badge">{item.source}</span>
      <span className="min-w-0 truncate text-xs text-ink/65">{item.title}</span>
    </>
  );

  if (!item.url) {
    return <div className="flex min-h-8 items-center gap-2">{body}</div>;
  }

  return (
    <a
      className="flex min-h-8 items-center gap-2 rounded-lg border border-ink/10 px-2 py-1 hover:border-lake/40 hover:bg-lake/5"
      href={item.url}
      target="_blank"
      rel="noreferrer"
    >
      {body}
      <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-lake" />
    </a>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/45">{label}</p>
      <p className="mt-1 text-sm leading-5 text-ink/70">{value}</p>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-[#f8faf6] p-2 text-center">
      <p className="text-[11px] font-medium text-ink/50">{label}</p>
      <p className="mt-1 text-base font-semibold text-ink">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-ink/10 bg-white px-3 text-sm text-ink/70">
      <span className="font-semibold text-ink">{value}</span>
      {label}
    </span>
  );
}

function StatusPill({
  label,
  tone = "neutral"
}: {
  label: string;
  tone?: "neutral" | "green" | "amber" | "blue";
}) {
  const toneClass =
    tone === "green"
      ? "border-moss/20 bg-moss/10 text-moss"
      : tone === "amber"
        ? "border-amberline/20 bg-amberline/10 text-amberline"
        : tone === "blue"
          ? "border-lake/20 bg-lake/10 text-lake"
          : "border-ink/10 bg-white text-ink/60";
  return (
    <span className={`inline-flex h-8 items-center rounded-lg border px-3 text-sm ${toneClass}`}>
      {label}
    </span>
  );
}

function SourceStatus({ status }: { status: Health["status"] }) {
  const tone = status === "ready" ? "green" : status === "missing" ? "red" : "amber";
  return (
    <span className={`source-status source-status-${tone}`}>
      {status === "ready" ? <Check className="h-3 w-3" /> : null}
      {status}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  label
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="grid min-h-[180px] place-items-center rounded-lg border border-dashed border-ink/15 bg-white/60 p-6 text-center">
      <div>
        <Icon className="mx-auto h-8 w-8 text-ink/35" />
        <p className="mt-3 text-sm text-ink/55">{label}</p>
      </div>
    </div>
  );
}

function listFromText(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const json = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(json.error ?? `Request failed with ${response.status}`);
  }
  return json;
}
