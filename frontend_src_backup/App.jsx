import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import axios from "axios";

const API = "http://127.0.0.1:8000";

function useTheme() {
  const [dark, setDark] = useState(
    () => localStorage.getItem("theme") === "dark"
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, setDark];
}

function ChatApp({ dark, setDark }) {
  const [sessions, setSessions]       = useState([]);
  const [activeId, setActiveId]       = useState(null);
  const [messages, setMessages]       = useState([]);
  const [loading, setLoading]         = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  async function newChat() {
    try {
      const res = await axios.post(`${API}/sessions`, { title: "New Chat" });
      const session = { id: res.data.session_id, title: res.data.title };
      setSessions(prev => [session, ...prev]);
      setActiveId(session.id);
      setMessages([]);
    } catch {
      alert("Could not create session. Is the backend running?");
    }
  }

  async function loadSession(id) {
    setActiveId(id);
    try {
      const res = await axios.get(`${API}/sessions/${id}/messages`);
      setMessages(res.data.messages || []);
      setSessions(prev =>
        prev.map(s => s.id === id ? { ...s, title: res.data.title } : s)
      );
    } catch {
      setMessages([]);
    }
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return;
    if (!activeId) { await newChat(); return; }

    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await axios.post(`${API}/chat`, {
        session_id: activeId,
        question: text
      });
      const botMsg = {
        role: "assistant",
        content: res.data.answer,
        sources: res.data.sources || []
      };
      setMessages(prev => [...prev, botMsg]);
      setSessions(prev =>
        prev.map(s =>
          s.id === activeId && s.title === "New Chat"
            ? { ...s, title: text.slice(0, 35) + (text.length > 35 ? "..." : "") }
            : s
        )
      );
    } catch {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "⚠️ Error: Could not reach the SmartBot backend. Please ensure it is running." }
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { newChat(); }, []);

  return (
    <div className="h-screen flex bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {sidebarOpen && (
        <Sidebar
          sessions={sessions}
          activeId={activeId}
          onNewChat={newChat}
          onSelectSession={loadSession}
          dark={dark}
          onToggleDark={() => setDark(d => !d)}
        />
      )}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
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
          
            <a href="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            Admin
          </a>
        </header>
        <ChatWindow messages={messages} loading={loading} />
        <ChatInput onSend={sendMessage} loading={loading} />
      </div>
    </div>
  );
}

export default function App() {
  const [dark, setDark] = useTheme();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                element={<ChatApp dark={dark} setDark={setDark} />} />
        <Route path="/admin"           element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="*"                element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}