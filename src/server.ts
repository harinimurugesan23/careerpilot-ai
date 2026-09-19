/**
 * server.ts
 * ---------
 * This is the Cloudflare Worker entry point AND the Agent (Durable Object)
 * definition for CareerPilot AI.
 *
 * WORKER  -> the `fetch` handler at the bottom. It receives every request
 *            and hands chat/analysis requests off to the Agent using
 *            `routeAgentRequest` (from the Cloudflare Agents SDK).
 * AGENT   -> the `CareerAgent` class below. Cloudflare's Agents SDK gives
 *            every named agent its own Durable Object, so each visitor's
 *            conversation lives in its own isolated, persistent instance.
 * MEMORY  -> `this.state` / `this.setState(...)`. The Agents SDK stores
 *            this automatically in the Durable Object's SQLite storage,
 *            so the conversation survives page reloads and Worker restarts.
 * AI      -> `this.env.AI.run(...)` calls Cloudflare Workers AI, running
 *            Meta's Llama 3.3 model directly on Cloudflare's network.
 */

import { Agent, routeAgentRequest } from "agents";

// The Workers AI model we use for every response in this app.
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Environment bindings declared in wrangler.jsonc.
export interface Env {
  AI: Ai;
  CareerAgent: DurableObjectNamespace<CareerAgent>;
}

// One chat message, in the shape Workers AI expects.
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Everything we persist for a single user's session.
interface CareerAgentState {
  messages: ChatMessage[];
}

// The system prompt tells the model what kind of assistant it is.
// It is sent with every request but never shown to the user or stored
// in the visible chat history.
const SYSTEM_PROMPT = `You are CareerPilot AI, a friendly and knowledgeable career assistant.
You help users with:
- General career guidance and advice
- Identifying skill gaps for a target role
- Interview preparation (common questions, how to answer them, what to practice)
- Analyzing job descriptions
- Building learning roadmaps (for example, a 3-month plan)

Remember details the user shares about themselves (their background, current skills,
target role, experience level) and use them in later answers. When asked to create a
roadmap, base it on what you already know about the user from the conversation, and
lay it out month by month with clear, practical goals. Keep answers concise, encouraging,
and use simple formatting (short paragraphs or bullet points).`;

/**
 * CareerAgent is a Cloudflare Agent. Each unique "name" passed in the URL
 * (see routeAgentRequest below) gets its own instance, backed by its own
 * Durable Object, with its own private state and storage. That is what
 * gives every user a persistent, isolated conversation with no database
 * required.
 */
export class CareerAgent extends Agent<Env, CareerAgentState> {
  // The state a brand-new agent instance starts with.
  initialState: CareerAgentState = { messages: [] };

  /**
   * onRequest is called by the Agents SDK for any plain HTTP request
   * routed to this agent instance. We use it as a tiny router for our
   * four endpoints: chat, the two analysis tools, and clearing history.
   */
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "POST" && url.pathname.endsWith("/chat")) {
        return await this.handleChat(request);
      }

      if (request.method === "POST" && url.pathname.endsWith("/analyze-profile")) {
        return await this.handleAnalyzeCareerProfile(request);
      }

      if (request.method === "POST" && url.pathname.endsWith("/analyze-job")) {
        return await this.handleAnalyzeJobDescription(request);
      }

      if (request.method === "GET" && url.pathname.endsWith("/history")) {
        // Returns everything the Agent remembers, so the frontend can
        // redraw the chat after a page refresh.
        return Response.json({ messages: this.state.messages });
      }

      if (request.method === "POST" && url.pathname.endsWith("/clear")) {
        this.setState({ messages: [] });
        return Response.json({ ok: true });
      }

      return new Response("Not found", { status: 404 });
    } catch (err) {
      console.error("CareerAgent error:", err);
      return Response.json(
        { error: err instanceof Error ? err.message : "Something went wrong" },
        { status: 500 }
      );
    }
  }

  /**
   * Calls Cloudflare Workers AI (Llama 3.3) with the full conversation so
   * far, so the model can use earlier context (e.g. "I'm a Java developer").
   */
  private async callModel(messages: ChatMessage[]): Promise<string> {
    const result = await this.env.AI.run(MODEL, {
      messages,
      max_tokens: 1024,
    });

    // Workers AI returns { response: string } for this model.
    const text = (result as { response?: string }).response;
    return text?.trim() || "Sorry, I couldn't come up with a response. Please try again.";
  }

  /**
   * Plain chat turn. Appends the user's message to persistent state,
   * asks the model to reply using the whole history, then appends and
   * persists the assistant's reply too.
   */
  private async handleChat(request: Request): Promise<Response> {
    const { message } = (await request.json()) as { message?: string };
    if (!message || !message.trim()) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    const history = [...this.state.messages, { role: "user" as const, content: message }];
    // Persist immediately so the user's message is never lost, even if
    // the AI call below fails.
    this.setState({ messages: history });

    const reply = await this.callModel([
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
    ]);

    this.setState({
      messages: [...history, { role: "assistant", content: reply }],
    });

    return Response.json({ reply });
  }

  /**
   * Tool: analyzeCareerProfile
   * Input:  target role, current skills, experience
   * Output: strengths, skill gaps, recommended next steps
   *
   * The result is also saved into the chat history (as a user/assistant
   * turn) so later questions like "create a roadmap for me" can build on it.
   */
  private async handleAnalyzeCareerProfile(request: Request): Promise<Response> {
    const { targetRole, skills, experience } = (await request.json()) as {
      targetRole?: string;
      skills?: string;
      experience?: string;
    };

    if (!targetRole || !skills) {
      return Response.json(
        { error: "targetRole and skills are required" },
        { status: 400 }
      );
    }

    const userTurn = `Please analyze my career profile.
Target role: ${targetRole}
Current skills: ${skills}
Experience: ${experience || "Not specified"}`;

    const prompt = `${userTurn}

Respond with three clearly labeled sections using these exact headings:
**Strengths**
**Skill Gaps**
**Recommended Next Steps**
Keep each section to a short bulleted list.`;

    const history = [...this.state.messages, { role: "user" as const, content: userTurn }];
    this.setState({ messages: history });

    const reply = await this.callModel([
      { role: "system", content: SYSTEM_PROMPT },
      ...this.state.messages.slice(0, -1),
      { role: "user", content: prompt },
    ]);

    this.setState({
      messages: [...history, { role: "assistant", content: reply }],
    });

    return Response.json({ result: reply });
  }

  /**
   * Tool: analyzeJobDescription
   * Input:  a pasted job description
   * Output: required technologies, important skills, responsibilities,
   *         preparation topics
   */
  private async handleAnalyzeJobDescription(request: Request): Promise<Response> {
    const { jobDescription } = (await request.json()) as { jobDescription?: string };

    if (!jobDescription || !jobDescription.trim()) {
      return Response.json({ error: "jobDescription is required" }, { status: 400 });
    }

    const userTurn = `Please analyze this job description:\n\n${jobDescription}`;

    const prompt = `${userTurn}

Respond with four clearly labeled sections using these exact headings:
**Required Technologies**
**Important Skills**
**Responsibilities**
**Preparation Topics**
Keep each section to a short bulleted list.`;

    const history = [...this.state.messages, { role: "user" as const, content: userTurn }];
    this.setState({ messages: history });

    const reply = await this.callModel([
      { role: "system", content: SYSTEM_PROMPT },
      ...this.state.messages.slice(0, -1),
      { role: "user", content: prompt },
    ]);

    this.setState({
      messages: [...history, { role: "assistant", content: reply }],
    });

    return Response.json({ result: reply });
  }
}

/**
 * The Worker's fetch handler. Every request to the deployed site arrives
 * here first. `routeAgentRequest` looks for URLs shaped like
 * `/agents/career-agent/<session-id>/...` and forwards them straight to
 * the matching CareerAgent Durable Object instance (creating it on first
 * use). Anything else (like static frontend assets) falls through to the
 * Cloudflare Vite plugin's asset handling.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      return agentResponse;
    }
    return new Response("Not found", { status: 404 });
  },
};
