# AI-Assisted Coding — Prompt Record

This project (CareerPilot AI) was generated in a single request to an AI
coding assistant (Claude). No prior prompts, debugging sessions, or
conversations preceded this — the entire project (frontend, Worker/Agent
backend, Cloudflare configuration, and documentation) was produced from the
prompt below in one pass, then verified with a real `npm install`, TypeScript
type-check, `vite build`, and `wrangler deploy --dry-run`.

## The actual prompt used

```
Build the complete CareerPilot AI project described below.

IMPORTANT:
- I do NOT want explanations.
- I do NOT want step-by-step instructions.
- I do NOT want to build the files one by one.
- I only want the finished project folder packaged as a ZIP file.
- Create all required files and code yourself.
- The project must actually run and deploy, not be a mockup.
- Use current, documented Cloudflare APIs/packages. Do not use outdated Cloudflare Agents or Workers AI examples.
- Keep the project SIMPLE and beginner-friendly.
- Do not over-engineer it.

PROJECT: CareerPilot AI

GOAL:
A simple AI career assistant where users can chat with an AI about:
- Career guidance
- Skill-gap analysis
- Interview preparation
- Job description analysis
- Learning roadmaps

REQUIREMENTS:
1. LLM → Cloudflare Workers AI using Llama 3.3 if currently available and compatible.
2. Workflow/coordination → Cloudflare Agents SDK.
3. User input → React + TypeScript chat UI.
4. Memory/state → Agent persistent state / Durable Objects.
5. Deployment → Cloudflare Workers + Wrangler.
6. Actual AI responses — NO fake/mock responses.
7. No authentication.
8. No payments.
9. No voice.
10. No unnecessary database.
11. No unnecessary MCP servers.
12. No complicated dashboard.

CORE FEATURES:

CHAT
- Clean chat interface.
- User can have a normal conversation with the AI career assistant.
- Conversation context must be remembered using Agent persistent state.

CAREER PROFILE ANALYSIS
Create an AI tool/function named: analyzeCareerProfile
Input: target role, skills, experience
Output: strengths, skill gaps, recommended next steps

JOB DESCRIPTION ANALYSIS
Create an AI tool/function named: analyzeJobDescription
Input: pasted job description
Output: required technologies, important skills, responsibilities, preparation topics

CAREER ROADMAP
If the user asks "Create a 3 month roadmap for me", generate a simple
month-by-month roadmap based on the user's previous conversation and
stored context.

UI:
Header: "CareerPilot AI" / "Your AI Career Assistant"
Include: chat area, message bubbles, text input, send button, loading
indicator, clear conversation button.
Starter prompts: "Analyze my career profile", "Analyze this job
description", "What skills should I learn?", "Create a 3-month learning
roadmap".

TECH STACK: React, TypeScript, Cloudflare Workers, Cloudflare Agents SDK,
Cloudflare Workers AI, Llama 3.3, Durable Objects / Agent persistent state,
Simple CSS, Zod only if actually needed, Wrangler, GitHub-ready project.

(Preferred file structure, code requirements, README requirements, and
prompts.md instructions were also specified in the original prompt and were
followed as given.)
```

## What the assistant did with it

1. Looked up the current `agents` npm package (v0.24.0) and its type
   definitions directly, to confirm the `Agent` class, `routeAgentRequest`,
   `onRequest`, `state`/`setState`, and `initialState` APIs before writing
   any code — instead of relying on older, possibly outdated examples.
2. Confirmed the current Workers AI model id for Llama 3.3
   (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`).
3. Wrote the full project (Worker/Agent backend, React frontend, Cloudflare
   config, README, this file).
4. Ran a real `npm install`, `tsc --noEmit`, `vite build`, and
   `wrangler deploy --dry-run` inside a sandbox to catch and fix any
   TypeScript, dependency, or configuration errors before packaging.
5. Packaged the finished, working project into `CareerPilot-AI.zip`.
