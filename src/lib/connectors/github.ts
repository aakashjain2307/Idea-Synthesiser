import { parseDate } from "@/lib/json";
import type { NormalizedProject } from "@/lib/types";

export type GitHubScoutInput = {
  topic: string;
  lookbackDays: number;
  languages?: string[];
  topics?: string[];
  limit?: number;
};

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  owner: { login: string };
  created_at: string;
  pushed_at: string;
  topics?: string[];
};

type GitHubSearchResponse = {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepo[];
};

export async function scoutGitHub(input: GitHubScoutInput): Promise<{
  projects: NormalizedProject[];
  warnings: string[];
}> {
  const from = isoDateDaysAgo(input.lookbackDays);
  const limit = input.limit ?? 30;
  const queries = buildQueries(input, from);
  const warnings: string[] = [];
  const projects = new Map<string, NormalizedProject>();

  for (const query of queries) {
    const url = new URL("https://api.github.com/search/repositories");
    url.searchParams.set("q", query);
    url.searchParams.set("sort", "stars");
    url.searchParams.set("order", "desc");
    url.searchParams.set("per_page", String(Math.min(limit, 50)));

    const response = await fetch(url, {
      headers: githubHeaders()
    });

    if (!response.ok) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      warnings.push(
        `GitHub search failed with ${response.status}${
          remaining === "0" ? " because the rate limit is exhausted" : ""
        }.`
      );
      continue;
    }

    const data = (await response.json()) as GitHubSearchResponse;
    if (data.incomplete_results) {
      warnings.push("GitHub returned incomplete search results for one query.");
    }

    for (const repo of data.items ?? []) {
      if (projects.size >= limit) {
        break;
      }
      projects.set(repo.full_name, repoToProject(repo));
    }
  }

  if (!process.env.GITHUB_TOKEN) {
    warnings.push("GITHUB_TOKEN is not set, so GitHub Scout is using lower rate limits.");
  }

  return {
    projects: [...projects.values()].sort(
      (a, b) => (b.starVelocity ?? 0) - (a.starVelocity ?? 0)
    ),
    warnings
  };
}

export function buildQueries(input: GitHubScoutInput, from: string): string[] {
  const safeTopic = input.topic.trim().replace(/\s+/g, " ");
  const filters = [
    "in:name,description,readme",
    `pushed:>=${from}`,
    "stars:>=5",
    ...(input.languages ?? []).map((language) => `language:${quoteIfNeeded(language)}`),
    ...(input.topics ?? []).map((topic) => `topic:${quoteIfNeeded(topic)}`)
  ];

  return [
    `${safeTopic} ${filters.join(" ")}`,
    `${safeTopic} created:>=${from} in:name,description,readme`
  ];
}

export function repoToProject(repo: GitHubRepo): NormalizedProject {
  const createdAtSource = parseDate(repo.created_at);
  const ageDays = Math.max(
    1,
    (Date.now() - (createdAtSource?.getTime() ?? Date.now())) / (1000 * 60 * 60 * 24)
  );

  return {
    source: "github",
    externalId: String(repo.id),
    name: repo.name,
    fullName: repo.full_name,
    url: repo.html_url,
    description: repo.description ?? undefined,
    language: repo.language ?? undefined,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    owner: repo.owner.login,
    createdAtSource,
    pushedAtSource: parseDate(repo.pushed_at),
    starVelocity: Number(((repo.stargazers_count / ageDays) * 30).toFixed(2)),
    topics: repo.topics ?? [],
    raw: repo
  };
}

function githubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "idea-synthesizer-local"
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

function isoDateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function quoteIfNeeded(value: string) {
  const clean = value.trim();
  return /\s/.test(clean) ? `"${clean}"` : clean;
}
