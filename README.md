# Idea Synthesizer

Idea Synthesizer is a local-first Next.js app for turning vague builder intent into evidence-backed product ideas, working demos, and project-specific learning plans.

It is built for moments like:

- "I want to get hired at AI labs. What should I build?"
- "I want app ideas that could make $10k/month."
- "I want to build something in AI infra, but I do not know where to start."

The app expands the user's intent into multiple research briefs, collects recent signals, scouts active GitHub projects, synthesizes opportunity cards, and lets the user build or learn from any idea.

## What It Does

- **Intent-first research**: accepts natural-language goals instead of exact keyword queries.
- **Last30Days research**: uses the local `last30days` skill to collect recent conversations and market signals across available sources.
- **GitHub Scout**: searches recent and active repositories, then scores freshness and rough star velocity.
- **Opportunity synthesis**: creates structured opportunity cards with target user, pain signal, product wedge, MVP scope, "why now", citations, related repos, and scores.
- **Model provider switching**: supports OpenAI-compatible providers such as OpenAI, Ollama, OpenRouter, Groq, Gemini-compatible endpoints, and custom base URLs.
- **Build Mode**: turns an opportunity into a saved build artifact with a product plan, architecture plan, implementation plan, and self-contained demo HTML.
- **Full demo launch**: opens built demos in a dedicated full-screen tab.
- **Learn Mode**: generates a project-specific technology map, build explanation, 7-day learning path, hands-on tasks, interview prep, and concept checks.
- **Full learning plan launch**: opens learning artifacts in a dedicated reading view.
- **Local persistence**: stores research runs, evidence, projects, opportunities, builds, and learning artifacts in SQLite via Prisma.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- SQLite
- Vitest
- Last30Days local skill integration
- OpenAI-compatible chat completions API

## Getting Started

Install dependencies:

```bash
npm install
```

Create local environment config:

```bash
cp .env.example .env.local
```

Initialize the SQLite database:

```bash
npm run db:init
npx prisma generate
```

Run the app:

```bash
npm run dev -- --port 3000
```

Open:

```text
http://localhost:3000
```

## Environment

Required:

- `DATABASE_URL`
- `LAST30DAYS_SKILL_DIR`
- `LAST30DAYS_PYTHON`

Recommended:

- `GITHUB_TOKEN` for higher GitHub rate limits.
- An OpenAI-compatible model provider for better intent planning, synthesis, Build Mode, and Learn Mode.

For local model usage, run Ollama locally and set:

```bash
LLM_BASE_URL="http://127.0.0.1:11434/v1"
LLM_MODEL="your-local-model"
```

For OpenAI-compatible providers, set:

```bash
LLM_BASE_URL="https://api.openai.com/v1"
OPENAI_API_KEY="..."
LLM_MODEL="gpt-4.1-mini"
```

You can also configure the active provider from the app UI.

## Useful Scripts

```bash
npm run dev          # start local dev server
npm run build        # generate Prisma client and build Next.js app
npm run typecheck    # run TypeScript checks
npm test             # run Vitest tests
npm run db:init      # create/update local SQLite schema from prisma/init.sql
npm run db:studio    # open Prisma Studio
```

## Data And Privacy

This app is designed to run locally.

- `.env`, `.env.local`, SQLite databases, generated research output, and build artifacts are ignored by git.
- API keys are not required to be committed.
- The app can run in degraded mode when optional provider credentials are missing.

## Current Scope

This is an MVP for single-user local research and project exploration.

Out of scope for the current version:

- hosted SaaS
- auth
- billing
- teams
- scheduled monitors
- custom scraping beyond `last30days`

## Demo Flow

1. Enter an intent.
2. Run research.
3. Review evidence, projects, clusters, and opportunity cards.
4. Click **Build** on an opportunity to create a working demo.
5. Open the full demo in a new tab.
6. Click **Learn** to generate a project-specific study plan.
7. Open the learning plan in a new tab and use it as a build-and-learn roadmap.
