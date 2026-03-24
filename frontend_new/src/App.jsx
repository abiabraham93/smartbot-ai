import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import UserLogin from "./pages/UserLogin";
import UserRegister from "./pages/UserRegister";
import UserProfile from "./pages/UserProfile";
import axios from "axios";
import { t, detectLanguage, getUserLanguage, isRTL } from "./i18n";

const API = "http://127.0.0.1:8000";

function userAuthHeader() {
  const token = localStorage.getItem("user_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Theme ─────────────────────────────────────
function useTheme() {
  const [dark, setDark] = useState(() => {
    const prefs = JSON.parse(localStorage.getItem("user_prefs") || "{}");
    if (prefs.theme === "light")  return false;
    if (prefs.theme === "dark")   return true;
    if (prefs.theme === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches;
    return localStorage.getItem("theme") === "dark";
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, setDark];
}

// ── Session cache ─────────────────────────────
let _sessionCache  = [];
let _activeIdCache = null;
let _messagesCache = [];
let _cacheUserId   = null;

// ── Admin guard ───────────────────────────────
function RequireAdmin({ children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const token = localStorage.getItem("admin_token");
      if (!token) { if (!cancelled) setStatus("denied"); return; }
      const role = localStorage.getItem("admin_role");
      if (role === "viewer") {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_name");
        localStorage.removeItem("admin_role");
        if (!cancelled) setStatus("denied");
        return;
      }
      try {
        await axios.get(`${API}/admin/stats`, { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 });
        const serverRole = localStorage.getItem("admin_role");
        if (!serverRole || serverRole === "viewer") {
          localStorage.removeItem("admin_token");
          localStorage.removeItem("admin_name");
          localStorage.removeItem("admin_role");
          if (!cancelled) setStatus("denied");
        } else {
          if (!cancelled) setStatus("allowed");
        }
      } catch {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_name");
        localStorage.removeItem("admin_role");
        if (!cancelled) setStatus("denied");
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  if (status === "checking") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">S</div>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Verifying admin credentials...
        </div>
      </div>
    );
  }
  if (status === "denied") return <Navigate to="/admin" replace />;
  return children;
}

// ── Main Chat App ─────────────────────────────
function ChatApp({ dark, setDark }) {
  const [sessions,         setSessions]        = useState(_sessionCache);
  const [activeId,         setActiveId]        = useState(_activeIdCache);
  const [messages,         setMessages]        = useState(_messagesCache);
  const [loading,          setLoading]         = useState(false);
  const [sidebarOpen,      setSidebarOpen]     = useState(true);
  const [internetEnabled,  setInternet]        = useState(false);
  const [streamingContent, setStreamingContent]= useState("");
  const [suggestions,      setSuggestions]     = useState([]);
  const [currentLang,      setCurrentLang]     = useState(() => getUserLanguage());

  const userName = localStorage.getItem("user_name") || null;

  useEffect(() => { _sessionCache  = sessions;  }, [sessions]);
  useEffect(() => { _activeIdCache = activeId;  }, [activeId]);
  useEffect(() => { _messagesCache = messages;  }, [messages]);

  function logout() {
    _sessionCache = []; _activeIdCache = null; _messagesCache = []; _cacheUserId = null;
    localStorage.removeItem("user_token"); localStorage.removeItem("user_name");
    localStorage.removeItem("user_email"); localStorage.removeItem("user_id");
    localStorage.removeItem("user_prefs");
    window.location.reload();
  }

  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    if (_cacheUserId && _cacheUserId !== userId) {
      _sessionCache = []; _activeIdCache = null; _messagesCache = [];
      setSessions([]); setActiveId(null); setMessages([]);
    }
    if (_sessionCache.length === 0) loadRecentSessions();
    _cacheUserId = userId;
  }, []);

  async function loadRecentSessions() {
    const userId = localStorage.getItem("user_id");
    const token  = localStorage.getItem("user_token");
    if (!userId || !token) return;
    try {
      const res  = await axios.get(`${API}/user/me/sessions`, { headers: { Authorization: `Bearer ${token}` } });
      const mine = (res.data || []).filter(s => s.message_count > 0).map(s => ({ id: s.id, title: s.title }));
      setSessions(mine); _sessionCache = mine;
    } catch (e) { console.error("Could not load sessions:", e); }
  }

  async function createSession() {
    const res     = await axios.post(`${API}/sessions`, { title: "New Chat" }, { headers: userAuthHeader() });
    const session = { id: res.data.session_id, title: res.data.title };
    setSessions(prev => [session, ...prev]);
    return session;
  }

  function newChat() {
    setActiveId(null); setMessages([]); setSuggestions([]);
    _activeIdCache = null; _messagesCache = [];
  }

  function refreshSuggestions() {
    // Regenerate suggestions based on the last Q&A pair
    const lastBot  = [...messages].reverse().find(m => m.role === "assistant");
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    if (!lastBot || !lastUser) return;

    const stop = new Set(["what","how","when","where","why","is","are","the","a","an",
                          "i","can","do","does","will","my","me","about","tell","explain",
                          "give","please","get","for"]);
    const words = lastUser.content.split(" ")
      .map(w => w.toLowerCase().replace(/[?.,!]/g,""))
      .filter(w => !stop.has(w) && w.length > 3);
    const topic = words.slice(0,3).join(" ") || "this topic";

    const templates = [
      `What are the requirements for ${topic}?`,
      `Can you explain ${topic} in simpler terms?`,
      `What are the risks associated with ${topic}?`,
      `How does ${topic} compare to other options?`,
      `What is the timeline for ${topic}?`,
      `Are there any exceptions to ${topic}?`,
      `What documents are needed for ${topic}?`,
      `Who is eligible for ${topic}?`,
    ];
    const shuffled = templates.sort(() => Math.random() - 0.5).slice(0, 3);
    setSuggestions(shuffled);
  }

  async function loadSession(id) {
    setActiveId(id); _activeIdCache = id; setSuggestions([]);
    try {
      const res  = await axios.get(`${API}/sessions/${id}/messages`);
      const msgs = (res.data.messages || []).map(m => ({
        role:      m.role,
        content:   m.content,
        sources:   m.sources,
        messageId: m.message_id || null
      }));
      setMessages(msgs); _messagesCache = msgs;
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: res.data.title } : s));
    } catch { setMessages([]); }
  }

  // ── Streaming send message ─────────────────
  async function sendMessage(text) {
    if (!text.trim() || loading) return;
    setSuggestions([]);
    // Auto-detect language from message
    const detected = detectLanguage(text);
    const lang     = getUserLanguage(detected);
    setCurrentLang(lang);
    // Apply RTL direction to document
    document.documentElement.dir  = isRTL(lang) ? "rtl" : "ltr";
    document.documentElement.lang = lang;

    let sessionId = activeId;
    if (!sessionId) {
      try {
        const session = await createSession();
        sessionId = session.id;
        setActiveId(session.id); _activeIdCache = session.id;
      } catch { alert("Could not create session."); return; }
    }

    const userMsg = { role: "user", content: text, sources: [], messageId: null };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setStreamingContent("");

    const token = localStorage.getItem("user_token");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    try {
      const response = await fetch(`${API}/chat/stream`, {
        method:  "POST",
        headers,
        body:    JSON.stringify({ session_id: sessionId, question: text, internet: internetEnabled, user_language: currentLang })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";
      let   fullAnswer = "";
      let   finalSources = [];
      let   finalMessageId = null;
      let   finalSuggestions = [];

      setLoading(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "chunk") {
              fullAnswer += data.content;
              setStreamingContent(fullAnswer);
            } else if (data.type === "done") {
              finalSources     = data.sources || [];
              finalMessageId   = data.message_id || null;
              finalSuggestions = data.suggestions || [];
            } else if (data.type === "error") {
              throw new Error(data.content);
            }
          } catch (parseErr) {
            // ignore malformed SSE lines
          }
        }
      }

      // Streaming complete — replace streaming content with final message
      setStreamingContent("");
      const botMsg = {
        role:      "assistant",
        content:   fullAnswer || "I could not generate a response.",
        sources:   finalSources,
        messageId: finalMessageId
      };
      setMessages(prev => {
        const updated = [...prev, botMsg]; _messagesCache = updated; return updated;
      });
      setSessions(prev => {
        const updated = prev.map(s =>
          s.id === sessionId && s.title === "New Chat"
            ? { ...s, title: text.slice(0, 35) + (text.length > 35 ? "..." : "") } : s
        );
        _sessionCache = updated; return updated;
      });
      setSuggestions(finalSuggestions);

    } catch (err) {
      setLoading(false);
      setStreamingContent("");
      const errMsg = { role: "assistant", content: `⚠️ ${t("error_backend", currentLang)}`, sources: [], messageId: null };
      setMessages(prev => [...prev, errMsg]);
    }
  }

  return (
    <div className="h-screen flex bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {sidebarOpen && (
        <Sidebar sessions={sessions} activeId={activeId} onNewChat={newChat}
          onSelectSession={loadSession} dark={dark} onToggleDark={() => setDark(d => !d)}/>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(o => !o)}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">S</div>
              <span className="font-semibold text-base">SmartBot</span>
              <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">Banking AI</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setInternet(v => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition border ${
                internetEnabled
                  ? "bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300"
                  : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
              }`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${internetEnabled ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}/>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span className="hidden sm:inline">{internetEnabled ? "Internet ON" : "Internet OFF"}</span>
            </button>

            {userName ? (
              <div className="flex items-center gap-2">
                <Link to="/profile"
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition border border-indigo-200 dark:border-indigo-700">
                  <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline text-indigo-700 dark:text-indigo-300 font-medium max-w-24 truncate">{userName}</span>
                </Link>
                <button onClick={logout} className="px-3 py-1.5 text-sm text-red-500 hover:text-red-700 transition hidden sm:block">{t("logout", currentLang)}</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-600 transition">Sign in</Link>
                <Link to="/register" className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition">Register</Link>
              </div>
            )}

            <button
              onClick={() => {
                localStorage.removeItem("user_token"); localStorage.removeItem("user_name");
                localStorage.removeItem("user_email"); localStorage.removeItem("user_id");
                localStorage.removeItem("user_prefs");
                window.location.href = "/admin";
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition border border-gray-200 dark:border-gray-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
              <span className="hidden sm:inline">Admin</span>
            </button>
          </div>
        </header>

        <ChatWindow
          messages={messages}
          loading={loading}
          internetEnabled={internetEnabled}
          streamingContent={streamingContent}
          suggestions={suggestions}
          onSuggestionClick={sendMessage}
          onRefreshSuggestions={refreshSuggestions}
          lang={currentLang}
        />
        <ChatInput onSend={sendMessage} loading={loading || !!streamingContent} lang={currentLang}/>
      </div>
    </div>
  );
}

export default function App() {
  const [dark, setDark] = useTheme();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<ChatApp dark={dark} setDark={setDark}/>}/>
        <Route path="/login"    element={<UserLogin/>}/>
        <Route path="/register" element={<UserRegister/>}/>
        <Route path="/profile"  element={<UserProfile/>}/>
        <Route path="/admin"    element={<AdminLogin/>}/>
        <Route path="/admin/dashboard" element={<RequireAdmin><AdminDashboard/></RequireAdmin>}/>
        <Route path="/admin/*"  element={<Navigate to="/admin" replace/>}/>
        <Route path="*"         element={<Navigate to="/"/>}/>
      </Routes>
    </BrowserRouter>
  );
}
