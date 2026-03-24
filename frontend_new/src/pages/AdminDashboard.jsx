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
  } catch { return "—"; }
}

// ── Mini bar chart ────────────────────────────
function BarChart({ data, color }) {
  if (!data || data.length === 0)
    return <p className="text-sm text-gray-400 py-4 text-center">No data for this period.</p>;
  const max = Math.max(...data.map(d => d.count), 1);
  const colors = { indigo:"bg-indigo-500", green:"bg-green-500", purple:"bg-purple-500", amber:"bg-amber-500" };
  const barColor = colors[color] || colors.indigo;
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1 min-w-max" style={{height:"140px"}}>
        {data.map((d, i) => {
          const h   = Math.max((d.count / max) * 100, d.count > 0 ? 4 : 0);
          const lbl = d.day ? d.day.slice(5) : "";
          return (
            <div key={i} className="flex flex-col items-center gap-1 group" style={{minWidth:"28px"}}>
              <span className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition whitespace-nowrap bg-gray-900 text-white px-1.5 py-0.5 rounded text-xs absolute -mt-6">
                {d.count}
              </span>
              <div className="w-full flex items-end relative" style={{height:"90px"}}>
                <div className={`w-full rounded-t transition-all ${barColor} opacity-80 hover:opacity-100 cursor-default`}
                  style={{height:`${h}%`, minHeight: d.count > 0 ? "3px" : "0"}}
                  title={`${lbl}: ${d.count}`}
                />
              </div>
              <span className="text-gray-400" style={{fontSize:"9px"}}>{lbl}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Peak hours heatmap ────────────────────────
function PeakHoursChart({ data }) {
  const [tooltip, setTooltip] = useState(null);
  const max = Math.max(...data.map(d => d.count), 1);
  const labels = [
    "12am","1am","2am","3am","4am","5am","6am","7am","8am","9am","10am","11am",
    "12pm","1pm","2pm","3pm","4pm","5pm","6pm","7pm","8pm","9pm","10pm","11pm"
  ];
  return (
    <div className="relative">
      <div className="flex items-end gap-1.5 flex-wrap">
        {data.map((d, i) => {
          const intensity = max > 0 ? d.count / max : 0;
          const bg = intensity === 0       ? "bg-gray-100 dark:bg-gray-700"
                   : intensity < 0.25     ? "bg-indigo-100 dark:bg-indigo-900/40"
                   : intensity < 0.5      ? "bg-indigo-300 dark:bg-indigo-700"
                   : intensity < 0.75     ? "bg-indigo-500"
                   :                        "bg-indigo-700";
          return (
            <div key={i} className="flex flex-col items-center gap-1 relative group">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {labels[i]}: {d.count} msg{d.count !== 1 ? "s" : ""}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"/>
              </div>
              <div className={`w-9 h-9 rounded-lg cursor-default transition-all hover:ring-2 hover:ring-indigo-400 ${bg}`}/>
              <span className="text-gray-400" style={{fontSize:"9px"}}>{labels[i].replace("am","a").replace("pm","p")}</span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
        <span>Low</span>
        <div className="flex gap-1">
          {[
            "bg-gray-100 dark:bg-gray-700",
            "bg-indigo-100 dark:bg-indigo-900/40",
            "bg-indigo-300 dark:bg-indigo-700",
            "bg-indigo-500",
            "bg-indigo-700"
          ].map((c,i) => <div key={i} className={`w-4 h-4 rounded ${c}`}/>)}
        </div>
        <span>High</span>
      </div>
    </div>
  );
}

// ── Top questions bar ─────────────────────────
function TopQuestionsChart({ data }) {
  if (!data || data.length === 0)
    return <p className="text-sm text-gray-400 py-4 text-center">No conversation topics yet.</p>;
  const max = data[0]?.count || 1; // first item always has highest count
  return (
    <div className="space-y-3">
      {data.map((q, i) => {
        const pct = Math.round((q.count / max) * 100); // top item = 100%, others proportional
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-sm">{q.title}</span>
                <span className="text-xs text-gray-400 ml-3 flex-shrink-0 font-medium">{q.count}x</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{width: `${pct}%`}}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main dashboard ────────────────────────────
export default function AdminDashboard() {
  const [stats,           setStats]           = useState(null);
  const [sessions,        setSessions]        = useState([]);
  const [logs,            setLogs]            = useState([]);
  const [files,           setFiles]           = useState([]);
  const [appLog,          setAppLog]          = useState([]);
  const [errorLog,        setErrorLog]        = useState([]);
  const [logInfo,         setLogInfo]         = useState(null);
  const [auditLogs,       setAuditLogs]       = useState([]);
  const [users,           setUsers]           = useState([]);
  const [endUsers,        setEndUsers]        = useState([]);
  const [analytics,       setAnalytics]       = useState(null);
  const [peakHours,       setPeakHours]       = useState([]);
  const [topQuestions,    setTopQuestions]    = useState([]);
  const [analyticsdays,   setAnalyticsDays]   = useState(30);
  const [loadingCharts,   setLoadingCharts]   = useState(false);
  const [exporting,       setExporting]       = useState("");
  const [feedbackStats,    setFeedbackStats]   = useState(null);
  const [tab,             setTab]             = useState("overview");
  const [clearing,        setClearing]        = useState(false);
  const [clearingLog,     setClearingLog]     = useState("");
  const [uploading,       setUploading]       = useState(false);
  const [deletingFile,    setDeletingFile]    = useState(null);
  const [uploadMsg,       setUploadMsg]       = useState("");
  const [userMsg,         setUserMsg]         = useState("");
  const [endUserMsg,      setEndUserMsg]      = useState("");
  const [showCreateForm,  setShowCreateForm]  = useState(false);
  const [newUser,         setNewUser]         = useState({ email:"", full_name:"", password:"", role:"admin" });
  const [creatingUser,    setCreatingUser]    = useState(false);
  const [resetUserId,     setResetUserId]     = useState(null);
  const [newPassword,     setNewPassword]     = useState("");
  const [resetting,       setResetting]       = useState(false);
  const [changingRole,    setChangingRole]    = useState(null);
  const [togglingUser,    setTogglingUser]    = useState(null);
  const [togglingEndUser, setTogglingEndUser] = useState(null);
  const [apiKeys,         setApiKeys]         = useState([]);
  const [apiKeyMsg,       setApiKeyMsg]       = useState("");
  const [newKeyName,      setNewKeyName]      = useState("");
  const [newKeyDesc,      setNewKeyDesc]      = useState("");
  const [creatingKey,     setCreatingKey]     = useState(false);
  const [newKeyRevealed,  setNewKeyRevealed]  = useState(null);
  const [togglingKey,     setTogglingKey]     = useState(null);
  const [deletingKey,     setDeletingKey]     = useState(null);
  const [notifMsg,        setNotifMsg]        = useState("");
  const [sendingNotif,    setSendingNotif]    = useState("");

  const fileInputRef = useRef(null);
  const navigate     = useNavigate();

  const adminName    = localStorage.getItem("admin_name") || "Admin";
  const adminRole    = localStorage.getItem("admin_role") || "admin";
  const isSuperAdmin = adminRole === "super_admin";
  const isViewer     = adminRole === "viewer";

  const logout = () => {
    // Clear admin session
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_name");
    localStorage.removeItem("admin_role");
    // Also clear any end user session for clean separation
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_prefs");
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
      setStats(s.data); setSessions(sess.data); setLogs(l.data); setFiles(f.data);
    } catch { logout(); }
  }

  async function loadLogs() {
    try {
      const [app, err, info] = await Promise.all([
        axios.get(`${API}/admin/logs/app`,   { headers: authHeader() }),
        axios.get(`${API}/admin/logs/error`, { headers: authHeader() }),
        axios.get(`${API}/admin/logs/info`,  { headers: authHeader() }),
      ]);
      setAppLog(app.data.lines || []); setErrorLog(err.data.lines || []); setLogInfo(info.data);
    } catch (e) { console.error(e); }
  }

  async function loadAuditAndUsers() {
    try {
      const [a, u] = await Promise.all([
        axios.get(`${API}/admin/audit`, { headers: authHeader() }),
        axios.get(`${API}/admin/users`, { headers: authHeader() }).catch(() => ({ data:[] }))
      ]);
      setAuditLogs(a.data || []); setUsers(u.data || []);
    } catch (e) { console.error(e); }
  }

  async function loadEndUsers() {
    try {
      const res = await axios.get(`${API}/admin/end-users`, { headers: authHeader() });
      setEndUsers(res.data || []);
    } catch (e) { console.error(e); }
  }

  async function loadAnalytics(days = 30) {
    setLoadingCharts(true);
    try {
      const [ov, ph, tq, fb] = await Promise.all([
        axios.get(`${API}/admin/analytics/overview?days=${days}`,      { headers: authHeader() }),
        axios.get(`${API}/admin/analytics/peak-hours?days=${days}`,    { headers: authHeader() }),
        axios.get(`${API}/admin/analytics/top-questions?days=${days}`, { headers: authHeader() }),
        axios.get(`${API}/admin/feedback/stats`,                       { headers: authHeader() }),
      ]);
      setAnalytics(ov.data);
      setPeakHours(ph.data.hours || []);
      setTopQuestions(tq.data.questions || []);
      setFeedbackStats(fb.data);
      setAnalyticsDays(days);
    } catch (e) { console.error("Analytics error:", e); }
    finally { setLoadingCharts(false); }
  }

  async function loadApiKeys() {
    try {
      const res = await axios.get(`${API}/admin/api-keys`, { headers: authHeader() });
      setApiKeys(res.data || []);
    } catch (e) { console.error("Could not load API keys:", e); }
  }

  async function createApiKey() {
    if (!newKeyName.trim()) { setApiKeyMsg("❌ Key name is required."); return; }
    setCreatingKey(true); setApiKeyMsg(""); setNewKeyRevealed(null);
    try {
      const res = await axios.post(`${API}/admin/api-keys`,
        { name: newKeyName, description: newKeyDesc },
        { headers: authHeader() }
      );
      setNewKeyRevealed(res.data.api_key);
      setNewKeyName(""); setNewKeyDesc("");
      setApiKeyMsg("✅ API key created. Copy it now — it won't be shown again.");
      loadApiKeys();
    } catch (err) { setApiKeyMsg(`❌ ${err.response?.data?.detail || err.message}`); }
    finally { setCreatingKey(false); }
  }

  async function toggleApiKey(keyId, isActive) {
    setTogglingKey(keyId);
    try {
      await axios.patch(`${API}/admin/api-keys/${keyId}/${isActive?"deactivate":"activate"}`, {}, { headers: authHeader() });
      setApiKeyMsg(`✅ Key ${isActive?"deactivated":"reactivated"}`);
      loadApiKeys();
    } catch (err) { setApiKeyMsg(`❌ ${err.response?.data?.detail || err.message}`); }
    finally { setTogglingKey(null); }
  }

  async function deleteApiKey(keyId, name) {
    if (!confirm(`Permanently delete API key "${name}"? This cannot be undone.`)) return;
    setDeletingKey(keyId);
    try {
      await axios.delete(`${API}/admin/api-keys/${keyId}`, { headers: authHeader() });
      setApiKeyMsg(`✅ Key "${name}" permanently deleted`);
      if (newKeyRevealed) setNewKeyRevealed(null);
      loadApiKeys();
    } catch (err) { setApiKeyMsg(`❌ ${err.response?.data?.detail || err.message}`); }
    finally { setDeletingKey(null); }
  }

  async function sendTestNotification() {
    setSendingNotif("test"); setNotifMsg("");
    try {
      await axios.post(`${API}/admin/notifications/test`, {}, { headers: authHeader() });
      setNotifMsg("✅ Test notification sent to Teams");
    } catch (err) { setNotifMsg(`❌ ${err.response?.data?.detail || err.message}`); }
    finally { setSendingNotif(""); }
  }

  async function sendDailySummary() {
    setSendingNotif("summary"); setNotifMsg("");
    try {
      const res = await axios.post(`${API}/admin/notifications/daily-summary`, {}, { headers: authHeader() });
      setNotifMsg(`✅ Daily summary sent — ${res.data.sessions} sessions, ${res.data.messages} messages, ${res.data.new_users} new users`);
    } catch (err) { setNotifMsg(`❌ ${err.response?.data?.detail || err.message}`); }
    finally { setSendingNotif(""); }
  }

  async function exportData(format) {
    setExporting(format);
    try {
      const token = localStorage.getItem("admin_token");
      const res   = await fetch(
        `${API}/admin/analytics/export?format=${format}&days=${analyticsdays}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `smartbot_export_${analyticsdays}days.${format}`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (err) { alert(`Export failed: ${err.message}`); }
    finally { setExporting(""); }
  }

  async function clearLog(type) {
    if (!confirm(`Clear ${type === "app" ? "app.log" : "error.log"}? This cannot be undone.`)) return;
    setClearingLog(type);
    try {
      await axios.delete(`${API}/admin/logs/${type}`, { headers: authHeader() });
      await loadLogs();
    } catch { alert("Failed to clear log."); }
    finally { setClearingLog(""); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (tab === "applogs"   || tab === "errorlogs") loadLogs();
    if (tab === "audit"     || tab === "users")     loadAuditAndUsers();
    if (tab === "endusers")                         loadEndUsers();
    if (tab === "analytics")                        loadAnalytics(30);
    if (tab === "apikeys")                          loadApiKeys();
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
    setClearing(false); load();
  }

  async function uploadFile(e) {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true); setUploadMsg("");
    const fd = new FormData(); fd.append("file", file);
    try {
      await axios.post(`${API}/upload`, fd, { headers: { ...authHeader(), "Content-Type": "multipart/form-data" } });
      setUploadMsg(`✅ "${file.name}" uploaded and ingested successfully!`); load();
    } catch (err) { setUploadMsg(`❌ Upload failed: ${err.response?.data?.detail || err.message}`); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  async function deleteFile(filename) {
    if (!confirm(`Delete "${filename}" and rebuild the knowledge base?`)) return;
    setDeletingFile(filename);
    try {
      const res = await axios.delete(`${API}/admin/files/${encodeURIComponent(filename)}`, { headers: authHeader() });
      setUploadMsg(`✅ "${filename}" deleted. ${res.data.remaining_files} file(s) remaining.`); load();
    } catch (err) { setUploadMsg(`❌ Delete failed: ${err.response?.data?.detail || err.message}`); }
    finally { setDeletingFile(null); }
  }

  async function downloadFile(filename) {
    const token = localStorage.getItem("admin_token");
    try {
      const r = await fetch(`${API}/admin/files/download/${encodeURIComponent(filename)}`, { headers: { Authorization:`Bearer ${token}` } });
      if (!r.ok) throw new Error("Download failed");
      const blob = await r.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href=url; a.download=filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (err) { alert(`Download failed: ${err.message}`); }
  }

  async function createUser() {
    if (!newUser.email||!newUser.password||!newUser.full_name) { setUserMsg("❌ All fields are required."); return; }
    if (newUser.password.length<8) { setUserMsg("❌ Password must be at least 8 characters."); return; }
    setCreatingUser(true); setUserMsg("");
    try {
      await axios.post(`${API}/admin/users`, newUser, { headers: authHeader() });
      setUserMsg(`✅ User "${newUser.email}" created with role: ${newUser.role}`);
      setNewUser({ email:"", full_name:"", password:"", role:"admin" }); setShowCreateForm(false); loadAuditAndUsers();
    } catch (err) { setUserMsg(`❌ ${err.response?.data?.detail || err.message}`); }
    finally { setCreatingUser(false); }
  }

  async function changeRole(userId, newRole) {
    setChangingRole(userId);
    try {
      await axios.patch(`${API}/admin/users/${userId}/role?role=${newRole}`, {}, { headers: authHeader() });
      setUserMsg(`✅ Role updated to ${newRole}`); loadAuditAndUsers();
    } catch (err) { setUserMsg(`❌ ${err.response?.data?.detail || err.message}`); }
    finally { setChangingRole(null); }
  }

  async function toggleUserStatus(userId, isActive) {
    if (!confirm(`${isActive?"Deactivate":"Reactivate"} this user?`)) return;
    setTogglingUser(userId);
    try {
      await axios.patch(`${API}/admin/users/${userId}/${isActive?"deactivate":"activate"}`, {}, { headers: authHeader() });
      setUserMsg(`✅ User ${isActive?"deactivated":"reactivated"} successfully`); loadAuditAndUsers();
    } catch (err) { setUserMsg(`❌ ${err.response?.data?.detail || err.message}`); }
    finally { setTogglingUser(null); }
  }

  async function resetPassword(userId) {
    if (newPassword.length<8) { setUserMsg("❌ Password must be at least 8 characters."); return; }
    setResetting(true);
    try {
      await axios.patch(`${API}/admin/users/${userId}/reset-password`, { new_password: newPassword }, { headers: authHeader() });
      setUserMsg("✅ Password reset successfully"); setResetUserId(null); setNewPassword(""); loadAuditAndUsers();
    } catch (err) { setUserMsg(`❌ ${err.response?.data?.detail || err.message}`); }
    finally { setResetting(false); }
  }

  async function toggleEndUser(userId, isActive) {
    if (!confirm(`${isActive?"Deactivate":"Reactivate"} this user?`)) return;
    setTogglingEndUser(userId);
    try {
      await axios.patch(`${API}/admin/end-users/${userId}/${isActive?"deactivate":"activate"}`, {}, { headers: authHeader() });
      setEndUserMsg(`✅ User ${isActive?"deactivated":"reactivated"}`); loadEndUsers();
    } catch (err) { setEndUserMsg(`❌ ${err.response?.data?.detail || "Failed"}`); }
    finally { setTogglingEndUser(null); }
  }

  function fileIcon(ext) {
    return {".pdf":"📄",".xlsx":"📊",".xls":"📊",".csv":"📋",".docx":"📝",".doc":"📝",".txt":"📃"}[ext]||"📁";
  }

  const StatCard = ({ label, value, color }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value ?? "—"}</p>
    </div>
  );

  const tabs = ["overview","documents","logs","applogs","errorlogs","audit","users","endusers","analytics","apikeys"];
  const tabLabel = (t) => ({
    overview:"💬 Sessions", documents:"📁 Documents", logs:"📋 Message Logs",
    applogs:"🖥 App Log", errorlogs:"🔴 Error Log", audit:"🔍 Audit Trail",
    users:"👥 Admin Users", endusers:"🧑‍💼 Chat Users", analytics:"📊 Analytics"
  })[t] || t;

  const roleBadge = (role) => {
    const s = { super_admin:"bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
                admin:"bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
                viewer:"bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s[role]||s.viewer}`}>{role}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">

      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">S</div>
          <div>
            <span className="font-semibold">SmartBot</span>
            <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">Admin Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">👤 {adminName}</span>
            {roleBadge(adminRole)}
          </div>
          {isViewer && <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">Read Only</span>}
          <button
            onClick={() => {
              // Clear end user session — admin returns to anonymous chat
              localStorage.removeItem("user_token");
              localStorage.removeItem("user_name");
              localStorage.removeItem("user_email");
              localStorage.removeItem("user_id");
              localStorage.removeItem("user_prefs");
              window.location.href = "/";
            }}
            className="text-sm text-indigo-600 hover:underline">
            ← SmartBot
          </button>
          <button onClick={logout} className="text-sm text-red-500 hover:text-red-700 transition">Logout</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Sessions"  value={stats.total_sessions}  color="text-indigo-600"/>
            <StatCard label="Total Messages"  value={stats.total_messages}  color="text-green-600"/>
            <StatCard label="Documents"       value={stats.total_documents} color="text-amber-600"/>
            <StatCard label="Active Admins"   value={stats.total_admins}    color="text-purple-600"/>
          </div>
        )}

        {isViewer && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-amber-500">⚠️</span>
            <p className="text-sm text-amber-700 dark:text-amber-300">You are logged in as a <strong>Viewer</strong>. Read-only access only.</p>
          </div>
        )}

        {(uploadMsg || userMsg) && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border ${
            (uploadMsg||userMsg).startsWith("✅")
              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700"
              : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700"
          }`}>
            {uploadMsg || userMsg}
            <button onClick={() => { setUploadMsg(""); setUserMsg(""); }} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab===t ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}>
              {tabLabel(t)}
            </button>
          ))}
          {tab === "overview" && !isViewer && (
            <button onClick={clearAllLogs} disabled={clearing}
              className="ml-auto px-4 py-2 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition disabled:opacity-60">
              {clearing ? "Clearing..." : "🗑 Clear All"}
            </button>
          )}
        </div>

        {/* ── Sessions ── */}
        {tab === "overview" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                  <th className="text-left px-5 py-3">Title</th><th className="text-left px-5 py-3">User</th>
                  <th className="text-left px-5 py-3">IP</th><th className="text-left px-5 py-3">Messages</th>
                  <th className="text-left px-5 py-3">Created</th><th className="text-left px-5 py-3">Last Active</th>
                  {!isViewer && <th className="px-5 py-3"/>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sessions.length===0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400">No sessions found</td></tr>}
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                    <td className="px-5 py-3 font-medium max-w-xs truncate">{s.title}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{s.user_name||"Anonymous"}</span>
                        {s.user_email && <span className="text-xs text-gray-400 truncate max-w-32">{s.user_email}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3"><span className="px-2 py-0.5 rounded text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{s.ip_address||"—"}</span></td>
                    <td className="px-5 py-3 text-gray-500">{s.message_count}</td>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap text-xs">{formatDateTime(s.created_at)}</td>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap text-xs">{formatDateTime(s.updated_at)}</td>
                    {!isViewer && <td className="px-5 py-3"><button onClick={() => deleteSession(s.id)} className="text-xs text-red-500 hover:text-red-700 transition">Delete</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Documents ── */}
        {tab === "documents" && (
          <div className="space-y-4">
            {!isViewer && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="font-semibold text-base mb-1">Upload New Document</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Supported: PDF, DOCX, TXT, XLSX, XLS, CSV. Auto-ingested immediately.</p>
                <div className="flex items-center gap-3">
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt,.xlsx,.xls,.csv" onChange={uploadFile} disabled={uploading}
                    className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-900/30 dark:file:text-indigo-300 hover:file:bg-indigo-100 file:cursor-pointer disabled:opacity-60"/>
                  {uploading && <div className="flex items-center gap-2 text-sm text-indigo-600 whitespace-nowrap"><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Uploading...</div>}
                </div>
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-base">Knowledge Base Documents</h2>
                <span className="text-sm text-gray-400">{files.length} file(s)</span>
              </div>
              {files.length===0 ? (
                <div className="text-center py-12 text-gray-400"><p className="text-4xl mb-3">📂</p><p className="text-sm">No documents uploaded yet.</p></div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                    <th className="text-left px-5 py-3">File Name</th><th className="text-left px-5 py-3">Type</th>
                    <th className="text-left px-5 py-3">Size</th><th className="text-left px-5 py-3">Uploaded</th>
                    {!isViewer && <th className="px-5 py-3">Actions</th>}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {files.map(f => (
                      <tr key={f.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                        <td className="px-5 py-3">
                          <button onClick={() => downloadFile(f.name)} className="flex items-center gap-2 group text-left">
                            <span className="text-lg">{fileIcon(f.extension)}</span>
                            <span className="font-medium text-indigo-600 dark:text-indigo-400 group-hover:underline truncate max-w-xs">{f.name}</span>
                            <svg className="w-3 h-3 text-gray-400 group-hover:text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                          </button>
                        </td>
                        <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{f.extension.toUpperCase()}</span></td>
                        <td className="px-5 py-3 text-gray-500">{f.size_kb} KB</td>
                        <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDateTime(f.uploaded_at)}</td>
                        {!isViewer && <td className="px-5 py-3">
                          <button onClick={() => deleteFile(f.name)} disabled={deletingFile===f.name}
                            className="text-xs text-red-500 hover:text-red-700 transition disabled:opacity-60 flex items-center gap-1">
                            {deletingFile===f.name ? (<><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Deleting...</>) : "🗑 Delete"}
                          </button>
                        </td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Message Logs ── */}
        {tab === "logs" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-base">Message Logs</h2>
              <span className="text-sm text-gray-400">{logs.length} conversation(s)</span>
            </div>
            <table className="w-full text-sm min-w-max">
              <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                <th className="text-left px-4 py-3 min-w-32">User</th><th className="text-left px-4 py-3 min-w-48">Question</th>
                <th className="text-left px-4 py-3 min-w-64">Answer</th><th className="text-left px-4 py-3 min-w-32">IP</th>
                <th className="text-left px-4 py-3 min-w-40">Question Time</th><th className="text-left px-4 py-3 min-w-40">Answer Time</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {logs.length===0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">No logs found</td></tr>}
                {logs.map((l,i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition align-top">
                    <td className="px-4 py-3 min-w-32">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{l.user_name||"Anonymous"}</span>
                        {l.user_id && <span className="text-xs text-gray-400 font-mono">#{l.user_id.slice(-6)}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-48">
                      <p className="text-gray-800 dark:text-gray-200 text-xs leading-relaxed" style={{maxWidth:"280px",wordBreak:"break-word"}}>{l.question||"—"}</p>
                      {l.session_title && l.session_title!=="New Chat" && <p className="text-gray-400 text-xs mt-1 truncate">{l.session_title}</p>}
                    </td>
                    <td className="px-4 py-3 min-w-64"><p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed" style={{maxWidth:"360px",wordBreak:"break-word",display:"-webkit-box",WebkitLineClamp:4,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{l.answer||"—"}</p></td>
                    <td className="px-4 py-3 min-w-32"><span className="px-2 py-0.5 rounded text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 whitespace-nowrap">{l.ip_address||"—"}</span></td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap min-w-40">{formatDateTime(l.question_time)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap min-w-40">{formatDateTime(l.answer_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── App Log ── */}
        {tab === "applogs" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="font-semibold text-base">Application Log</h2>
                <p className="text-xs text-gray-400 mt-0.5">Last 30 mins · {appLog.length} entries{logInfo ? ` · ${logInfo.app_log.lines} total · ${logInfo.app_log.size_kb} KB` : ""}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={loadLogs} className="px-3 py-1.5 text-xs rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition">🔄 Refresh</button>
                {!isViewer && <button onClick={() => clearLog("app")} disabled={clearingLog==="app"} className="px-3 py-1.5 text-xs rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition disabled:opacity-60">{clearingLog==="app"?"Clearing...":"🗑 Clear Log"}</button>}
              </div>
            </div>
            <div className="bg-gray-950 rounded-xl p-4 overflow-auto max-h-96 font-mono text-xs">
              {appLog.length===0 ? <p className="text-gray-500">No log entries in the last 30 minutes.</p> : (
                [...appLog].reverse().map((line,i) => (
                  <div key={i} className={`py-0.5 ${line.includes("ERROR")?"text-red-400":line.includes("WARNING")?"text-amber-400":line.includes("startup")||line.includes("complete")||line.includes("ready")?"text-green-400":"text-gray-300"}`}>{line}</div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Error Log ── */}
        {tab === "errorlogs" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="font-semibold text-base">Error Log</h2>
                <p className="text-xs text-gray-400 mt-0.5">Last 30 mins · {errorLog.length} entries{logInfo ? ` · ${logInfo.error_log.lines} total · ${logInfo.error_log.size_kb} KB` : ""}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={loadLogs} className="px-3 py-1.5 text-xs rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition">🔄 Refresh</button>
                {!isViewer && <button onClick={() => clearLog("error")} disabled={clearingLog==="error"} className="px-3 py-1.5 text-xs rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition disabled:opacity-60">{clearingLog==="error"?"Clearing...":"🗑 Clear Log"}</button>}
              </div>
            </div>
            <div className="bg-gray-950 rounded-xl p-4 overflow-auto max-h-96 font-mono text-xs">
              {errorLog.length===0 ? <p className="text-green-400">No errors logged. System is healthy.</p> : (
                [...errorLog].reverse().map((line,i) => <div key={i} className="text-red-400 py-0.5">{line}</div>)
              )}
            </div>
          </div>
        )}

        {/* ── Audit Trail ── */}
        {tab === "audit" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div><h2 className="font-semibold text-base">Audit Trail</h2><p className="text-xs text-gray-400 mt-0.5">Every admin action tracked</p></div>
              <div className="flex items-center gap-3">
                <button onClick={loadAuditAndUsers} className="px-3 py-1.5 text-xs rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition">🔄 Refresh</button>
                <span className="text-sm text-gray-400">{auditLogs.length} entries</span>
              </div>
            </div>
            <table className="w-full text-sm min-w-max">
              <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                <th className="text-left px-4 py-3">Admin</th><th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Resource</th><th className="text-left px-4 py-3">Detail</th>
                <th className="text-left px-4 py-3">IP</th><th className="text-left px-4 py-3">Time</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {auditLogs.length===0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">No audit entries yet.</td></tr>}
                {auditLogs.map((l,i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                    <td className="px-4 py-3 text-xs font-medium text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{l.admin_email}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-mono font-medium whitespace-nowrap ${l.action.includes("FAILED")||l.action.includes("DELETE")||l.action.includes("DEACTIVATE")?"bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300":l.action.includes("LOGIN")||l.action.includes("CREATE")||l.action.includes("ACTIVATE")?"bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300":"bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}>{l.action}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{l.resource||"—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{l.detail||"—"}</td>
                    <td className="px-4 py-3"><span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded whitespace-nowrap">{l.ip_address||"—"}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Admin Users ── */}
        {tab === "users" && (
          <div className="space-y-4">
            {isSuperAdmin && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-base">Create New Admin User</h2>
                  <button onClick={() => setShowCreateForm(v => !v)} className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition">{showCreateForm?"✕ Cancel":"+ New User"}</button>
                </div>
                {showCreateForm && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name</label><input type="text" placeholder="John Smith" value={newUser.full_name} onChange={e => setNewUser(p=>({...p,full_name:e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                    <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label><input type="email" placeholder="john@bank.com" value={newUser.email} onChange={e => setNewUser(p=>({...p,email:e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                    <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Password</label><input type="password" placeholder="Min 8 characters" value={newUser.password} onChange={e => setNewUser(p=>({...p,password:e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                    <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Role</label>
                      <select value={newUser.role} onChange={e => setNewUser(p=>({...p,role:e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="admin">Admin — manage content</option><option value="viewer">Viewer — read only</option><option value="super_admin">Super Admin — full access</option>
                      </select>
                    </div>
                    <div className="md:col-span-2"><button onClick={createUser} disabled={creatingUser} className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition disabled:opacity-60">{creatingUser?"Creating...":"Create User"}</button></div>
                  </div>
                )}
              </div>
            )}
            {!isSuperAdmin && <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3"><p className="text-sm text-amber-700 dark:text-amber-300">⚠️ User management requires Super Admin access.</p></div>}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-base">All Admin Users</h2>
                <span className="text-sm text-gray-400">{users.length} user(s)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                    <th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3">Email</th>
                    <th className="text-left px-5 py-3">Role</th><th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Last Login</th>{isSuperAdmin && <th className="text-left px-5 py-3">Actions</th>}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {users.length===0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">No users found</td></tr>}
                    {users.map(u => (
                      <>
                        <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                          <td className="px-5 py-3 font-medium">{u.full_name||"—"}</td>
                          <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-xs">{u.email}</td>
                          <td className="px-5 py-3">{isSuperAdmin ? (
                            <select value={u.role} onChange={e => changeRole(u.id,e.target.value)} disabled={changingRole===u.id}
                              className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60">
                              <option value="super_admin">super_admin</option><option value="admin">admin</option><option value="viewer">viewer</option>
                            </select>
                          ) : roleBadge(u.role)}</td>
                          <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active?"bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300":"bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300"}`}>{u.is_active?"Active":"Inactive"}</span></td>
                          <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDateTime(u.last_login)}</td>
                          {isSuperAdmin && <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => toggleUserStatus(u.id,u.is_active)} disabled={togglingUser===u.id}
                                className={`text-xs px-2 py-1 rounded-lg transition disabled:opacity-60 ${u.is_active?"bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100":"bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100"}`}>
                                {togglingUser===u.id?"...":u.is_active?"Deactivate":"Reactivate"}
                              </button>
                              <button onClick={() => { setResetUserId(resetUserId===u.id?null:u.id); setNewPassword(""); }}
                                className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition">🔑 Reset PW</button>
                            </div>
                          </td>}
                        </tr>
                        {isSuperAdmin && resetUserId===u.id && (
                          <tr key={`${u.id}-reset`} className="bg-indigo-50 dark:bg-indigo-900/10">
                            <td colSpan={6} className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">New password for {u.email}:</span>
                                <input type="password" placeholder="Min 8 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"/>
                                <button onClick={() => resetPassword(u.id)} disabled={resetting||newPassword.length<8} className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-60">{resetting?"Saving...":"Save Password"}</button>
                                <button onClick={() => { setResetUserId(null); setNewPassword(""); }} className="px-3 py-1.5 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 transition">Cancel</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Chat Users ── */}
        {tab === "endusers" && (
          <div className="space-y-4">
            {endUserMsg && (
              <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${endUserMsg.startsWith("✅")?"bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700":"bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700"}`}>
                {endUserMsg}<button onClick={() => setEndUserMsg("")} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div><h2 className="font-semibold text-base">Registered Chat Users</h2><p className="text-xs text-gray-400 mt-0.5">End users registered via /register</p></div>
                <div className="flex items-center gap-3">
                  <button onClick={loadEndUsers} className="px-3 py-1.5 text-xs rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition">🔄 Refresh</button>
                  <span className="text-sm text-gray-400">{endUsers.length} user(s)</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                    <th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3">Email / Phone</th>
                    <th className="text-left px-5 py-3">Login Method</th><th className="text-left px-5 py-3">Language</th>
                    <th className="text-left px-5 py-3">Status</th><th className="text-left px-5 py-3">Registered</th>
                    <th className="text-left px-5 py-3">Last Login</th><th className="text-left px-5 py-3">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {endUsers.length===0 && <tr><td colSpan={8} className="text-center py-10 text-gray-400">No registered users yet.</td></tr>}
                    {endUsers.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                        <td className="px-5 py-3 font-medium">{u.full_name}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-xs">{u.email||u.phone||"—"}</td>
                        <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.auth_provider==="google"?"bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300":u.auth_provider==="phone"?"bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300":"bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}>{u.auth_provider==="google"?"Google":u.auth_provider==="phone"?"Phone OTP":"Email"}</span></td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{u.preferences?.language?.toUpperCase()||"EN"}</td>
                        <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active?"bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300":"bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300"}`}>{u.is_active?"Active":"Inactive"}</span></td>
                        <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDateTime(u.created_at)}</td>
                        <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDateTime(u.last_login)}</td>
                        <td className="px-5 py-3">
                          <button onClick={() => toggleEndUser(u.id,u.is_active)} disabled={togglingEndUser===u.id}
                            className={`text-xs px-2 py-1 rounded-lg transition disabled:opacity-60 ${u.is_active?"bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100":"bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100"}`}>
                            {togglingEndUser===u.id?"...":u.is_active?"Deactivate":"Reactivate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Analytics ── */}
        {tab === "analytics" && (
          <div className="space-y-6">

            {/* Controls row */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Time range:</span>
                {[7, 30, 90].map(d => (
                  <button key={d} onClick={() => loadAnalytics(d)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${analyticsdays===d?"bg-indigo-600 text-white":"bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"}`}>
                    {d===7?"Last 7 days":d===30?"Last 30 days":"Last 90 days"}
                  </button>
                ))}
                {loadingCharts && (
                  <div className="flex items-center gap-2 text-sm text-indigo-500">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    <span className="text-xs">Loading...</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Export last {analyticsdays} days:</span>
                <button onClick={() => exportData("csv")} disabled={!!exporting}
                  className="px-3 py-1.5 text-xs rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 transition disabled:opacity-60 border border-green-200 dark:border-green-700">
                  {exporting==="csv"?"Exporting...":"⬇ CSV"}
                </button>
                <button onClick={() => exportData("json")} disabled={!!exporting}
                  className="px-3 py-1.5 text-xs rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition disabled:opacity-60 border border-blue-200 dark:border-blue-700">
                  {exporting==="json"?"Exporting...":"⬇ JSON"}
                </button>
              </div>
            </div>

            {/* Loading skeleton */}
            {loadingCharts && !analytics && (
              <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4"/>
                    <div className="h-24 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse"/>
                  </div>
                ))}
              </div>
            )}

            {analytics && !loadingCharts && (
              <>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <h2 className="font-semibold text-base mb-1">Sessions per day</h2>
                  <p className="text-xs text-gray-400 mb-4">Number of chat sessions started each day</p>
                  <BarChart data={analytics.sessions_by_day} color="indigo"/>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <h2 className="font-semibold text-base mb-1">Messages per day</h2>
                  <p className="text-xs text-gray-400 mb-4">User messages sent each day (bot replies excluded)</p>
                  <BarChart data={analytics.messages_by_day} color="green"/>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <h2 className="font-semibold text-base mb-1">User registrations per day</h2>
                  <p className="text-xs text-gray-400 mb-4">New end users who signed up each day</p>
                  <BarChart data={analytics.registrations_by_day} color="purple"/>
                </div>
              </>
            )}

            {peakHours.length > 0 && !loadingCharts && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="font-semibold text-base mb-1">Peak usage hours</h2>
                <p className="text-xs text-gray-400 mb-5">Hover each square to see exact message count per hour</p>
                <PeakHoursChart data={peakHours}/>
              </div>
            )}

            {topQuestions.length > 0 && !loadingCharts && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="font-semibold text-base mb-1">Top 10 conversation topics</h2>
                <p className="text-xs text-gray-400 mb-5">Most frequent session titles — bar length is relative to the top topic</p>
                <TopQuestionsChart data={topQuestions}/>
              </div>
            )}

            {feedbackStats && !loadingCharts && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="font-semibold text-base mb-4">User feedback summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{feedbackStats.total}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total ratings</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{feedbackStats.positive}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">👍 Thumbs up</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-red-500 dark:text-red-400">{feedbackStats.negative}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">👎 Thumbs down</p>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{feedbackStats.score}%</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Satisfaction score</p>
                  </div>
                </div>
                {feedbackStats.total > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>Satisfaction</span>
                      <span>{feedbackStats.score}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{width: `${feedbackStats.score}%`}}/>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!analytics && !loadingCharts && (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-sm">No analytics data yet.</p>
                <p className="text-xs mt-1">Charts appear once users start chatting.</p>
              </div>
            )}
          </div>
        )}

        {/* ── API Keys tab ── */}
        {tab === "apikeys" && (
          <div className="space-y-6">

            {/* Notifications section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="font-semibold text-base mb-1">Teams Notifications</h2>
              <p className="text-xs text-gray-400 mb-4">
                Set <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">TEAMS_WEBHOOK_URL</code> in <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env</code> to enable. Leave blank to use console print.
              </p>
              {notifMsg && (
                <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border ${notifMsg.startsWith("✅")?"bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700":"bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700"}`}>
                  {notifMsg}<button onClick={() => setNotifMsg("")} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <button onClick={sendTestNotification} disabled={!!sendingNotif}
                  className="px-4 py-2 text-sm rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition border border-indigo-200 dark:border-indigo-700 disabled:opacity-60">
                  {sendingNotif==="test" ? "Sending..." : "📨 Send test notification"}
                </button>
                <button onClick={sendDailySummary} disabled={!!sendingNotif}
                  className="px-4 py-2 text-sm rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition border border-purple-200 dark:border-purple-700 disabled:opacity-60">
                  {sendingNotif==="summary" ? "Sending..." : "📊 Send daily summary now"}
                </button>
              </div>
              <div className="mt-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Auto-triggered notifications:</p>
                <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                  <p>✓ Welcome email → sent to user on registration (console if no SMTP)</p>
                  <p>✓ New user alert → posted to Teams when anyone registers</p>
                  <p>✓ Error alert → posted to Teams on critical backend errors</p>
                </div>
              </div>
            </div>

            {/* API Key creation */}
            {!isViewer && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="font-semibold text-base mb-1">Create API Key</h2>
                <p className="text-xs text-gray-400 mb-4">API keys allow external apps to query SmartBot via <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">POST /api/chat</code> using the <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">X-API-Key</code> header.</p>

                {apiKeyMsg && (
                  <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border ${apiKeyMsg.startsWith("✅")?"bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700":"bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700"}`}>
                    {apiKeyMsg}<button onClick={() => setApiKeyMsg("")} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
                  </div>
                )}

                {/* Revealed key — shown once */}
                {newKeyRevealed && (
                  <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-2">⚠️ Copy this key now — it will never be shown again</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 font-mono text-amber-900 dark:text-amber-100 break-all">{newKeyRevealed}</code>
                      <button onClick={() => { navigator.clipboard.writeText(newKeyRevealed); setApiKeyMsg("✅ Key copied to clipboard"); }}
                        className="flex-shrink-0 px-3 py-2 text-xs rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition">Copy</button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Key name *</label>
                    <input type="text" placeholder="e.g. Mobile App, CRM Integration" value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description (optional)</label>
                    <input type="text" placeholder="What this key is used for" value={newKeyDesc} onChange={e => setNewKeyDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                  </div>
                  <div className="md:col-span-2">
                    <button onClick={createApiKey} disabled={creatingKey || !newKeyName.trim()}
                      className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition disabled:opacity-60">
                      {creatingKey ? "Generating..." : "Generate API Key"}
                    </button>
                  </div>
                </div>

                {/* Usage example */}
                <div className="mt-5 bg-gray-950 rounded-xl p-4 font-mono text-xs text-gray-300">
                  <p className="text-gray-500 mb-1"># Example usage:</p>
                  <p>curl -X POST http://localhost:8000/api/chat \</p>
                  <p className="pl-4">-H <span className="text-green-400">"X-API-Key: sk-smb-your-key-here"</span> \</p>
                  <p className="pl-4">-H <span className="text-green-400">"Content-Type: application/json"</span> \</p>
                  <p className="pl-4">-d <span className="text-amber-400">'{`{"question": "What are the loan rates?"}`}'</span></p>
                </div>
              </div>
            )}

            {/* API Keys list */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-base">Active API Keys</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Full keys are never stored — only the prefix is shown</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={loadApiKeys} className="px-3 py-1.5 text-xs rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition">🔄 Refresh</button>
                  <span className="text-sm text-gray-400">{apiKeys.length} key(s)</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                      <th className="text-left px-5 py-3">Name</th>
                      <th className="text-left px-5 py-3">Key prefix</th>
                      <th className="text-left px-5 py-3">Status</th>
                      <th className="text-left px-5 py-3">Created by</th>
                      <th className="text-left px-5 py-3">Last used</th>
                      <th className="text-left px-5 py-3">Created</th>
                      {!isViewer && <th className="text-left px-5 py-3">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {apiKeys.length === 0 && (
                      <tr><td colSpan={7} className="text-center py-10 text-gray-400">No API keys yet. Create one above.</td></tr>
                    )}
                    {apiKeys.map(k => (
                      <tr key={k.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                        <td className="px-5 py-3">
                          <p className="font-medium">{k.name}</p>
                          {k.description && <p className="text-xs text-gray-400 mt-0.5">{k.description}</p>}
                        </td>
                        <td className="px-5 py-3">
                          <code className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded font-mono">{k.key_prefix}</code>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${k.is_active?"bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300":"bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300"}`}>
                            {k.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{k.created_by}</td>
                        <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{k.last_used ? formatDateTime(k.last_used) : "Never"}</td>
                        <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDateTime(k.created_at)}</td>
                        {!isViewer && (
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => toggleApiKey(k.id, k.is_active)} disabled={togglingKey === k.id}
                                className={`text-xs px-2 py-1 rounded-lg transition disabled:opacity-60 ${k.is_active?"bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100":"bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100"}`}>
                                {togglingKey === k.id ? "..." : k.is_active ? "Disable" : "Enable"}
                              </button>
                              {isSuperAdmin && (
                                <button onClick={() => deleteApiKey(k.id, k.name)} disabled={deletingKey === k.id}
                                  className="text-xs px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition disabled:opacity-60">
                                  {deletingKey === k.id ? "..." : "Delete"}
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
