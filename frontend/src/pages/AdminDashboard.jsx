import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = "http://127.0.0.1:8000";

function authHeader() {
  const token = localStorage.getItem("admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  } catch {
    return "—";
  }
}

export default function AdminDashboard() {
  const [stats,        setStats]        = useState(null);
  const [sessions,     setSessions]     = useState([]);
  const [logs,         setLogs]         = useState([]);
  const [files,        setFiles]        = useState([]);
  const [appLog,       setAppLog]       = useState([]);
  const [errorLog,     setErrorLog]     = useState([]);
  const [logInfo,      setLogInfo]      = useState(null);
  const [tab,          setTab]          = useState("overview");
  const [clearing,     setClearing]     = useState(false);
  const [clearingLog,  setClearingLog]  = useState("");
  const [uploading,    setUploading]    = useState(false);
  const [deletingFile, setDeletingFile] = useState(null);
  const [uploadMsg,    setUploadMsg]    = useState("");
  const fileInputRef = useRef(null);
  const navigate     = useNavigate();

  const adminName = localStorage.getItem("admin_name") || "Admin";

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_name");
    navigate("/admin");
  };

  async function load() {
    try {
      const [s, sess, l, f] = await Promise.all([
        axios.get(`${API}/admin/stats`,    { headers: authHeader() }),
        axios.get(`${API}/admin/sessions`, { headers: authHeader() }),
        axios.get(`${API}/admin/chatlogs`, { headers: authHeader() }),
        axios.get(`${API}/admin/files`,    { headers: authHeader() }),
      ]);
      setStats(s.data);
      setSessions(sess.data);
      setLogs(l.data);
      setFiles(f.data);
    } catch {
      logout();
    }
  }

  async function loadLogs() {
    try {
      const [app, err, info] = await Promise.all([
        axios.get(`${API}/admin/logs/app`,   { headers: authHeader() }),
        axios.get(`${API}/admin/logs/error`, { headers: authHeader() }),
        axios.get(`${API}/admin/logs/info`,  { headers: authHeader() }),
      ]);
      setAppLog(app.data.lines   || []);
      setErrorLog(err.data.lines || []);
      setLogInfo(info.data);
    } catch (e) {
      console.error("Could not load logs:", e);
    }
  }

  async function clearLog(type) {
    if (!confirm(`Clear ${type === "app" ? "app.log" : "error.log"}? This cannot be undone.`)) return;
    setClearingLog(type);
    try {
      await axios.delete(`${API}/admin/logs/${type}`, { headers: authHeader() });
      await loadLogs();
    } catch {
      alert("Failed to clear log.");
    } finally {
      setClearingLog("");
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (tab === "applogs" || tab === "errorlogs") loadLogs();
  }, [tab]);

  async function deleteSession(id) {
    if (!confirm("Delete this session and all its messages?")) return;
    await axios.delete(`${API}/admin/sessions/${id}`, { headers: authHeader() });
    load();
  }

  async function clearAllLogs() {
    if (!confirm("This will delete ALL chat sessions and messages. Are you sure?")) return;
    setClearing(true);
    await axios.delete(`${API}/admin/chatlogs`, { headers: authHeader() });
    setClearing(false);
    load();
  }

  async function uploadFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      await axios.post(`${API}/upload`, formData, {
        headers: { ...authHeader(), "Content-Type": "multipart/form-data" }
      });
      setUploadMsg(`✅ "${file.name}" uploaded and ingested successfully!`);
      load();
    } catch (err) {
      setUploadMsg(`❌ Upload failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function deleteFile(filename) {
    if (!confirm(`Delete "${filename}" and rebuild the knowledge base?`)) return;
    setDeletingFile(filename);
    try {
      const res = await axios.delete(
        `${API}/admin/files/${encodeURIComponent(filename)}`,
        { headers: authHeader() }
      );
      setUploadMsg(`✅ "${filename}" deleted. ${res.data.remaining_files} file(s) remaining.`);
      load();
    } catch (err) {
      setUploadMsg(`❌ Delete failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setDeletingFile(null);
    }
  }

  async function downloadFile(filename) {
    const token = localStorage.getItem("admin_token");
    const url   = `${API}/admin/files/download/${encodeURIComponent(filename)}`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Download failed");
      const blob    = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a       = document.createElement("a");
      a.href        = blobUrl;
      a.download    = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  }

  function fileIcon(ext) {
    return {
      ".pdf": "📄", ".xlsx": "📊", ".xls": "📊",
      ".csv": "📋", ".docx": "📝", ".doc": "📝", ".txt": "📃"
    }[ext] || "📁";
  }

  const StatCard = ({ label, value, color }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value ?? "—"}</p>
    </div>
  );

  const tabs     = ["overview", "documents", "logs", "applogs", "errorlogs"];
  const tabLabel = (t) => ({
    overview:  "💬 Sessions",
    documents: "📁 Documents",
    logs:      "📋 Message Logs",
    applogs:   "🖥 App Log",
    errorlogs: "🔴 Error Log"
  })[t] || t;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">

      {/* Top nav */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">S</div>
          <div>
            <span className="font-semibold">SmartBot</span>
            <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">Admin Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">👤 {adminName}</span>
          <a href="/" className="text-sm text-indigo-600 hover:underline">← SmartBot</a>
          <button onClick={logout} className="text-sm text-red-500 hover:text-red-700 transition">Logout</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Sessions"  value={stats.total_sessions}  color="text-indigo-600" />
            <StatCard label="Total Messages"  value={stats.total_messages}  color="text-green-600"  />
            <StatCard label="Documents"       value={stats.total_documents} color="text-amber-600"  />
            <StatCard label="Active Admins"   value={stats.total_admins}    color="text-purple-600" />
          </div>
        )}

        {/* Status message */}
        {uploadMsg && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
            uploadMsg.startsWith("✅")
              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700"
              : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700"
          }`}>
            {uploadMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}>
              {tabLabel(t)}
            </button>
          ))}
          {tab === "overview" && (
            <button onClick={clearAllLogs} disabled={clearing}
              className="ml-auto px-4 py-2 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition disabled:opacity-60">
              {clearing ? "Clearing..." : "🗑 Clear All"}
            </button>
          )}
        </div>

        {/* ── Sessions tab ── */}
        {tab === "overview" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                  <th className="text-left px-5 py-3">Title</th>
                  <th className="text-left px-5 py-3">IP Address</th>
                  <th className="text-left px-5 py-3">Messages</th>
                  <th className="text-left px-5 py-3">Created</th>
                  <th className="text-left px-5 py-3">Last Active</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sessions.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">No sessions found</td></tr>
                )}
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                    <td className="px-5 py-3 font-medium max-w-xs truncate">{s.title}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {s.ip_address || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{s.message_count}</td>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap text-xs">{formatDateTime(s.created_at)}</td>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap text-xs">{formatDateTime(s.updated_at)}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => deleteSession(s.id)} className="text-xs text-red-500 hover:text-red-700 transition">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Documents tab ── */}
        {tab === "documents" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="font-semibold text-base mb-1">Upload New Document</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Supported: PDF, DOCX, TXT, XLSX, XLS, CSV. Auto-ingested immediately.
              </p>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.xlsx,.xls,.csv"
                  onChange={uploadFile}
                  disabled={uploading}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                    file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700
                    dark:file:bg-indigo-900/30 dark:file:text-indigo-300
                    hover:file:bg-indigo-100 file:cursor-pointer disabled:opacity-60"
                />
                {uploading && (
                  <div className="flex items-center gap-2 text-sm text-indigo-600 whitespace-nowrap">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Uploading...
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-base">Knowledge Base Documents</h2>
                <span className="text-sm text-gray-400">{files.length} file(s)</span>
              </div>
              {files.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-4xl mb-3">📂</p>
                  <p className="text-sm">No documents uploaded yet.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                      <th className="text-left px-5 py-3">File Name</th>
                      <th className="text-left px-5 py-3">Type</th>
                      <th className="text-left px-5 py-3">Size</th>
                      <th className="text-left px-5 py-3">Uploaded</th>
                      <th className="px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {files.map(f => (
                      <tr key={f.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                        <td className="px-5 py-3">
                          <button
                            onClick={() => downloadFile(f.name)}
                            className="flex items-center gap-2 group text-left"
                            title="Click to download"
                          >
                            <span className="text-lg">{fileIcon(f.extension)}</span>
                            <span className="font-medium text-indigo-600 dark:text-indigo-400 group-hover:underline truncate max-w-xs">
                              {f.name}
                            </span>
                            <svg className="w-3 h-3 text-gray-400 group-hover:text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                            </svg>
                          </button>
                        </td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            {f.extension.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-500">{f.size_kb} KB</td>
                        <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDateTime(f.uploaded_at)}</td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => deleteFile(f.name)}
                            disabled={deletingFile === f.name}
                            className="text-xs text-red-500 hover:text-red-700 transition disabled:opacity-60 flex items-center gap-1"
                          >
                            {deletingFile === f.name ? (
                              <>
                                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                </svg>
                                Deleting...
                              </>
                            ) : "🗑 Delete"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Message Logs tab ── */}
        {tab === "logs" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-base">Message Logs</h2>
              <span className="text-sm text-gray-400">{logs.length} conversation(s)</span>
            </div>
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                  <th className="text-left px-4 py-3 min-w-48">User Question</th>
                  <th className="text-left px-4 py-3 min-w-64">Assistant Answer</th>
                  <th className="text-left px-4 py-3 min-w-32">User IP</th>
                  <th className="text-left px-4 py-3 min-w-40">Question Time</th>
                  <th className="text-left px-4 py-3 min-w-40">Answer Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {logs.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400">No logs found</td></tr>
                )}
                {logs.map((l, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition align-top">
                    <td className="px-4 py-3 min-w-48">
                      <p className="text-gray-800 dark:text-gray-200 text-xs leading-relaxed" style={{maxWidth:"280px", wordBreak:"break-word"}}>
                        {l.question || "—"}
                      </p>
                      {l.session_title && l.session_title !== "New Chat" && (
                        <p className="text-gray-400 text-xs mt-1 truncate">{l.session_title}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-64">
                      <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed" style={{maxWidth:"360px", wordBreak:"break-word", display:"-webkit-box", WebkitLineClamp:4, WebkitBoxOrient:"vertical", overflow:"hidden"}}>
                        {l.answer || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 min-w-32">
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {l.ip_address || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap min-w-40">
                      {formatDateTime(l.question_time)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap min-w-40">
                      {formatDateTime(l.answer_time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── App Log tab ── */}
        {tab === "applogs" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="font-semibold text-base">Application Log</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Showing last 30 minutes · {appLog.length} entries shown
                  {logInfo ? ` · ${logInfo.app_log.lines} total lines · ${logInfo.app_log.size_kb} KB` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={loadLogs} className="px-3 py-1.5 text-xs rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition">
                  🔄 Refresh
                </button>
                <button onClick={() => clearLog("app")} disabled={clearingLog === "app"}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition disabled:opacity-60">
                  {clearingLog === "app" ? "Clearing..." : "🗑 Clear Log"}
                </button>
              </div>
            </div>
            <div className="bg-gray-950 rounded-xl p-4 overflow-auto max-h-96 font-mono text-xs">
              {appLog.length === 0 ? (
                <p className="text-gray-500">No log entries in the last 30 minutes.</p>
              ) : (
                [...appLog].reverse().map((line, i) => (
                  <div key={i} className={`py-0.5 ${
                    line.includes("ERROR")   ? "text-red-400" :
                    line.includes("WARNING") ? "text-amber-400" :
                    line.includes("startup") || line.includes("complete") ? "text-green-400" :
                    "text-gray-300"
                  }`}>{line}</div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Error Log tab ── */}
        {tab === "errorlogs" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="font-semibold text-base">Error Log</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Showing last 30 minutes · {errorLog.length} entries shown
                  {logInfo ? ` · ${logInfo.error_log.lines} total lines · ${logInfo.error_log.size_kb} KB` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={loadLogs} className="px-3 py-1.5 text-xs rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition">
                  🔄 Refresh
                </button>
                <button onClick={() => clearLog("error")} disabled={clearingLog === "error"}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition disabled:opacity-60">
                  {clearingLog === "error" ? "Clearing..." : "🗑 Clear Log"}
                </button>
              </div>
            </div>
            <div className="bg-gray-950 rounded-xl p-4 overflow-auto max-h-96 font-mono text-xs">
              {errorLog.length === 0 ? (
                <p className="text-green-400">✓ No errors logged. System is healthy.</p>
              ) : (
                [...errorLog].reverse().map((line, i) => (
                  <div key={i} className="text-red-400 py-0.5">{line}</div>
                ))
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
