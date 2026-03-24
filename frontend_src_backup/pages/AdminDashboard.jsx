import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = "http://127.0.0.1:8000";

function authHeader() {
  const token = localStorage.getItem("admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminDashboard() {
  const [stats,    setStats]    = useState(null);
  const [sessions, setSessions] = useState([]);
  const [logs,     setLogs]     = useState([]);
  const [tab,      setTab]      = useState("overview");
  const [clearing, setClearing] = useState(false);
  const navigate = useNavigate();

  const adminName = localStorage.getItem("admin_name") || "Admin";

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_name");
    navigate("/admin");
  };

  async function load() {
    try {
      const [s, sess, l] = await Promise.all([
        axios.get(`${API}/admin/stats`,    { headers: authHeader() }),
        axios.get(`${API}/admin/sessions`, { headers: authHeader() }),
        axios.get(`${API}/admin/logs`,     { headers: authHeader() }),
      ]);
      setStats(s.data);
      setSessions(sess.data);
      setLogs(l.data);
    } catch {
      logout();
    }
  }

  useEffect(() => { load(); }, []);

  async function deleteSession(id) {
    if (!confirm("Delete this session and all its messages?")) return;
    await axios.delete(`${API}/admin/sessions/${id}`, { headers: authHeader() });
    load();
  }

  async function clearAllLogs() {
    if (!confirm("This will delete ALL chat sessions and messages. Are you sure?")) return;
    setClearing(true);
    await axios.delete(`${API}/admin/logs`, { headers: authHeader() });
    setClearing(false);
    load();
  }

  const StatCard = ({ label, value, color }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value ?? "—"}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">

      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            S
          </div>
          <div>
            <span className="font-semibold">SmartBot</span>
            <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
              Admin Dashboard
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">👤 {adminName}</span>
          <a href="/" className="text-sm text-indigo-600 hover:underline">← SmartBot</a>
          <button
            onClick={logout}
            className="text-sm text-red-500 hover:text-red-700 transition"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Sessions"  value={stats.total_sessions}  color="text-indigo-600" />
            <StatCard label="Total Messages"  value={stats.total_messages}  color="text-green-600"  />
            <StatCard label="Documents"       value={stats.total_documents} color="text-amber-600"  />
            <StatCard label="Active Admins"   value={stats.total_admins}    color="text-purple-600" />
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {["overview", "logs"].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                tab === t
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {t === "overview" ? "Sessions" : "Message Logs"}
            </button>
          ))}

          <button
            onClick={clearAllLogs}
            disabled={clearing}
            className="ml-auto px-4 py-2 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition disabled:opacity-60"
          >
            {clearing ? "Clearing..." : "🗑 Clear All Logs"}
          </button>
        </div>

        {tab === "overview" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                  <th className="text-left px-5 py-3">Title</th>
                  <th className="text-left px-5 py-3">Messages</th>
                  <th className="text-left px-5 py-3">Created</th>
                  <th className="text-left px-5 py-3">Last Active</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-400">
                      No sessions found
                    </td>
                  </tr>
                )}
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                    <td className="px-5 py-3 font-medium max-w-xs truncate">{s.title}</td>
                    <td className="px-5 py-3 text-gray-500">{s.message_count}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {s.updated_at ? new Date(s.updated_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => deleteSession(s.id)}
                        className="text-xs text-red-500 hover:text-red-700 transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "logs" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                  <th className="text-left px-5 py-3">Role</th>
                  <th className="text-left px-5 py-3">Message</th>
                  <th className="text-left px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center py-10 text-gray-400">
                      No logs found
                    </td>
                  </tr>
                )}
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        l.role === "user"
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                      }`}>
                        {l.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300 max-w-xl truncate">
                      {l.content}
                    </td>
                    <td className="px-5 py-3 text-gray-400 whitespace-nowrap text-xs">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
