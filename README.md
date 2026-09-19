# CareerPilot AI

A simple AI career assistant you can chat with about career guidance, skill
gaps, interview prep, job descriptions, and learning roadmaps — built entirely
on Cloudflare (Workers, Agents SDK, Workers AI, Durable Objects) with a React
+ TypeScript frontend.
## https://careerpilot-ai.harinimurugesan23.workers.dev

## Overview

CareerPilot AI is a single Cloudflare Worker that serves a React chat UI and
runs an AI "Agent" for every visitor. Each visitor's conversation is
remembered automatically (no login, no external database) using the
Cloudflare Agents SDK's persistent state, which is backed by a Durable
Object. Every reply is generated live by Meta's Llama 3.3 model running on
Cloudflare Workers AI — there are no fake or hardcoded responses.

## Features

- **Chat** — a normal back-and-forth conversation with the assistant. It
  remembers what you've told it earlier in the same session (e.g. "I'm a
  Java developer" → later "What should I learn next?" is answered with that
  in mind).
- **Career Profile Analysis** (`analyzeCareerProfile`) — give it your target
  role, current skills, and experience level; it returns your strengths,
  skill gaps, and recommended next steps.
- **Job Description Analysis** (`analyzeJobDescription`) — paste any job
  description; it returns the required technologies, important skills,
  responsibilities, and topics to prepare for.
- **Career Roadmap** — ask "Create a 3-month roadmap for me" and it builds a
  month-by-month plan using everything it has learned about you so far in
  the conversation.
- **Clear conversation** — wipes the current session's memory and starts
  fresh.

## Architecture

```
Browser (React chat UI)
   │  fetch("/agents/career-agent/<session-id>/...")
   ▼
Cloudflare Worker  (src/server.ts)
   │  routeAgentRequest(...)
   ▼
CareerAgent  (Durable Object, one per browser session)
   │  this.state / this.setState(...)   ← persistent memory
   │  this.env.AI.run(...)              ← Workers AI (Llama 3.3)
   ▼
Response streamed back to the browser
```

- **One Worker, one codebase.** The same `wrangler deploy` publishes both the
  built React app (as static assets) and the Worker/Agent backend.
- **One Durable Object per session.** The frontend generates a random id on
  first visit and stores it in `localStorage`. That id is used as the Agent's
  "name," so every browser gets its own isolated, persistent conversation
  with zero authentication.

## Technologies

| Requirement | Implementation |
|---|---|
| LLM | Cloudflare Workers AI — `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| Workflow / coordination | Cloudflare Agents SDK (`agents` npm package) |
| User input | React + TypeScript chat UI (Vite) |
| Memory / state | Agent persistent state, backed by a Durable Object |
| Deployment | Cloudflare Workers + Wrangler |

## How Workers AI is used

`src/server.ts` calls `this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages, max_tokens })`
directly from inside the Agent, using the `AI` binding declared in
`wrangler.jsonc`. No API key or external SDK is required — Workers AI runs
the model on Cloudflare's own network. Every chat reply, career profile
analysis, and job description analysis goes through this same call — there
is no mocked or hardcoded AI output anywhere in the app.

## How Agents are used

`CareerAgent` (in `src/server.ts`) extends `Agent` from the `agents` package.
The Worker's `fetch` handler calls `routeAgentRequest(request, env)`, which
is the Agents SDK's built-in router: it looks for URLs shaped like
`/agents/career-agent/<name>/...` and forwards the request to the matching
Durable Object instance (creating it the first time that name is seen). The
Agent class implements `onRequest()` to handle four simple JSON endpoints:

- `POST /chat` — a normal chat turn
- `POST /analyze-profile` — the `analyzeCareerProfile` tool
- `POST /analyze-job` — the `analyzeJobDescription` tool
- `GET /history` — returns the saved conversation (used on page load)
- `POST /clear` — wipes the saved conversation

## How persistent state / memory works

Every `CareerAgent` instance has a typed `state` object:

```ts
interface CareerAgentState {
  messages: { role: "user" | "assistant"; content: string }[];
}
```

Calling `this.setState({ messages: [...] })` persists the new state into the
Durable Object's own storage automatically — that's the Agents SDK's
"persistent state" feature. Because each browser session maps to its own
Durable Object, the conversation survives page reloads, tab closes, and
Worker restarts, without any separate database.

## Local setup

**Requirements:** Node.js 22+, npm, and a free Cloudflare account.

```bash
npm install
```

## Required Cloudflare configuration

Everything needed is already declared in `wrangler.jsonc`:

- an `ai` binding named `AI` (Workers AI — no extra setup needed)
- a `durable_objects` binding named `CareerAgent` for the `CareerAgent` class
- a `migrations` entry that creates the SQLite-backed Durable Object class
- `assets` configuration that serves the built React app

The first time you deploy, Wrangler will provision the Durable Object
namespace and enable Workers AI for your account automatically. No manual
dashboard setup is required.

## How to run locally

```bash
npm run dev
```

This starts Vite with the Cloudflare Vite plugin, which runs your Worker,
Agent, Durable Object, and Workers AI binding locally (via `workerd`) right
alongside the React frontend. Open the printed local URL (typically
`http://localhost:5173`) and start chatting.

## How to deploy

```bash
npm run build
npx wrangler login   # first time only
npm run deploy
```

`npm run deploy` builds the frontend and Worker, then runs `wrangler deploy`
to publish everything to your Cloudflare account. Wrangler will print your
live `*.workers.dev` URL when it finishes.

## Example conversations

**Context memory:**

> **You:** I'm a Java developer.
> **CareerPilot AI:** Great! Java is a solid foundation — used heavily in
> backend systems, Android development, and enterprise software...
>
> **You:** What should I learn next?
> **CareerPilot AI:** Since you're coming from Java, I'd suggest building on
> that with Spring Boot for backend APIs, learning SQL and a cloud platform
> like AWS or Azure, and picking up Docker for containerization...

**Job description analysis:**

> **You:** *(pastes a "Full Stack Developer" job description)*
> **CareerPilot AI:**
> **Required Technologies:** React, Node.js, MongoDB, REST APIs...
> **Important Skills:** Problem-solving, Git, API design...
> **Responsibilities:** Building UI components, integrating backend
> services...
> **Preparation Topics:** JavaScript fundamentals, system design basics...

**Roadmap:**

> **You:** Create a 3-month roadmap for me.
> **CareerPilot AI:**
> **Month 1:** Strengthen core Java and SQL, build one small backend project...
> **Month 2:** Learn Spring Boot and REST APIs, deploy a project to the
> cloud...
> **Month 3:** Practice system design and mock interviews, apply to roles...

## Assignment mapping

| Requirement | Where it's implemented |
|---|---|
| LLM → Cloudflare Workers AI / Llama 3.3 | `src/server.ts`, `callModel()`, model `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| Workflow/coordination → Cloudflare Agents | `src/server.ts`, `CareerAgent extends Agent`, `routeAgentRequest` |
| User input → React chat interface | `src/App.tsx`, `src/main.tsx`, `src/styles.css` |
| Memory/state → Agent persistent state / Durable Objects | `src/server.ts`, `this.state` / `this.setState()`, `durable_objects` binding in `wrangler.jsonc` |
| Deployment → Cloudflare Workers | `wrangler.jsonc`, `npm run deploy` |

## Project structure

```
careerpilot-ai/
├── src/
│   ├── App.tsx        # Chat UI, starter prompts, analysis forms
│   ├── server.ts       # Worker + Agent (Durable Object) + Workers AI calls
│   ├── main.tsx        # React entry point
│   └── styles.css      # Simple CSS styling
├── public/              # Static assets folder (empty by default)
├── index.html            # Vite HTML entry point
├── vite.config.ts        # Vite + React + Cloudflare plugin config
├── wrangler.jsonc        # Cloudflare Worker/Agent/AI/Durable Object config
├── package.json
├── tsconfig.json
├── prompts.md            # AI-assisted coding prompt record
└── README.md
```
