import { useEffect, useRef, useState } from "react";

/**
 * App.tsx
 * -------
 * The whole CareerPilot AI frontend: a chat interface plus two small forms
 * for the "analyze my profile" and "analyze this job description" tools.
 *
 * Every user gets a random session id stored in the browser (localStorage).
 * That id becomes the "name" of their CareerAgent Durable Object on the
 * backend (see server.ts), which is what gives each visitor their own
 * private, persistent conversation with no login required.
 */

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Get (or create) a stable per-browser session id.
function getSessionId(): string {
  const key = "careerpilot-session-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

const SESSION_ID = getSessionId();
// Every request for this session's agent instance goes through this path.
// The Agents SDK routes /agents/<binding-name-in-kebab-case>/<session id>/*
// straight to the matching CareerAgent Durable Object.
const AGENT_BASE = `/agents/career-agent/${SESSION_ID}`;

const STARTER_PROMPTS = [
  "Analyze my career profile",
  "Analyze this job description",
  "What skills should I learn?",
  "Create a 3-month learning roadmap",
] as const;

type Panel = "none" | "profile" | "job";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState<Panel>("none");
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Profile form fields
  const [targetRole, setTargetRole] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");

  // Job description form field
  const [jobDescription, setJobDescription] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  // Load any previously saved conversation for this browser session.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${AGENT_BASE}/history`);
        if (res.ok) {
          const data = (await res.json()) as { messages: Message[] };
          setMessages(data.messages);
        }
      } catch (err) {
        console.error("Failed to load history:", err);
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendChatMessage(text: string) {
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${AGENT_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || data.error || "Something went wrong." },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function submitProfileForm() {
    if (!targetRole.trim() || !skills.trim() || loading) return;
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: `Analyze my career profile\nTarget role: ${targetRole}\nSkills: ${skills}\nExperience: ${experience || "Not specified"}`,
      },
    ]);
    setPanel("none");
    setLoading(true);
    try {
      const res = await fetch(`${AGENT_BASE}/analyze-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole, skills, experience }),
      });
      const data = (await res.json()) as { result?: string; error?: string };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.result || data.error || "Something went wrong." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error. Please try again." },
      ]);
    } finally {
      setLoading(false);
      setTargetRole("");
      setSkills("");
      setExperience("");
    }
  }

  async function submitJobForm() {
    if (!jobDescription.trim() || loading) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: `Analyze this job description:\n\n${jobDescription}` },
    ]);
    setPanel("none");
    setLoading(true);
    try {
      const res = await fetch(`${AGENT_BASE}/analyze-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription }),
      });
      const data = (await res.json()) as { result?: string; error?: string };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.result || data.error || "Something went wrong." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error. Please try again." },
      ]);
    } finally {
      setLoading(false);
      setJobDescription("");
    }
  }

  async function clearConversation() {
    if (loading) return;
    try {
      await fetch(`${AGENT_BASE}/clear`, { method: "POST" });
    } catch (err) {
      console.error("Failed to clear conversation:", err);
    }
    setMessages([]);
    setPanel("none");
  }

  function handleStarterPrompt(prompt: (typeof STARTER_PROMPTS)[number]) {
    if (prompt === "Analyze my career profile") {
      setPanel("profile");
      return;
    }
    if (prompt === "Analyze this job description") {
      setPanel("job");
      return;
    }
    sendChatMessage(prompt);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendChatMessage(input);
  }

  return (
    <div className="app">
      <header className="header">
        <h1>CareerPilot AI</h1>
        <p>Your AI Career Assistant</p>
      </header>

      <main className="chat-area">
        {loadingHistory ? (
          <div className="empty-state">Loading your conversation…</div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <p>👋 Hi! I'm CareerPilot AI. Ask me anything about your career, or try a starter prompt below.</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`bubble-row ${m.role}`}>
              <div className={`bubble ${m.role}`}>{m.content}</div>
            </div>
          ))
        )}

        {loading && (
          <div className="bubble-row assistant">
            <div className="bubble assistant loading-bubble">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      {panel === "profile" && (
        <div className="panel">
          <h3>Analyze my career profile</h3>
          <input
            placeholder="Target role (e.g. Backend Developer)"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
          />
          <input
            placeholder="Current skills (e.g. Java, SQL, Git)"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
          />
          <input
            placeholder="Experience (e.g. Fresher, 1 year internship)"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
          />
          <div className="panel-actions">
            <button className="secondary" onClick={() => setPanel("none")}>
              Cancel
            </button>
            <button className="primary" onClick={submitProfileForm}>
              Analyze
            </button>
          </div>
        </div>
      )}

      {panel === "job" && (
        <div className="panel">
          <h3>Analyze this job description</h3>
          <textarea
            placeholder="Paste the job description here…"
            rows={5}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
          <div className="panel-actions">
            <button className="secondary" onClick={() => setPanel("none")}>
              Cancel
            </button>
            <button className="primary" onClick={submitJobForm}>
              Analyze
            </button>
          </div>
        </div>
      )}

      <div className="starter-prompts">
        {STARTER_PROMPTS.map((p) => (
          <button key={p} onClick={() => handleStarterPrompt(p)} disabled={loading}>
            {p}
          </button>
        ))}
      </div>

      <form className="input-bar" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask CareerPilot AI anything…"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
        <button type="button" className="clear-btn" onClick={clearConversation} disabled={loading}>
          Clear
        </button>
      </form>
    </div>
  );
}
