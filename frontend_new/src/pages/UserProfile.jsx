import { useState, useEffect } from "react";
import { t as tr, isRTL, getUserLanguage, LANGUAGE_NAMES } from "../i18n";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function userHeader() {
  const token = localStorage.getItem("user_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-GB", {
      day:"2-digit", month:"2-digit", year:"numeric",
      hour:"2-digit", minute:"2-digit"
    });
  } catch { return "—"; }
}

export default function UserProfile() {
  const [tab,          setTab]          = useState("profile");
  const [user,         setUser]         = useState(null);
  const [sessions,     setSessions]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState("");

  // Phase 6 — language
  const lang = getUserLanguage();

  // Profile form
  const [fullName,     setFullName]     = useState("");
  const [oldPassword,  setOldPassword]  = useState("");
  const [newPassword,  setNewPassword]  = useState("");
  const [confirmPw,    setConfirmPw]    = useState("");

  // Preferences
  const [theme,        setTheme]        = useState("dark");
  const [language,     setLanguage]     = useState("en");
  const [notifications,setNotifications]= useState(true);
  const [memoryDepth,  setMemoryDepth]   = useState(6);

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("user_token");
    if (!token) { navigate("/login"); return; }
    loadProfile();
    loadSessions();
  }, []);

  async function loadProfile() {
    try {
      const res = await axios.get(`${API}/user/me`, { headers: userHeader() });
      setUser(res.data);
      setFullName(res.data.full_name || "");
      const prefs = res.data.preferences || {};
      setTheme(prefs.theme || "dark");
      setLanguage(prefs.language || "en");
      setNotifications(prefs.notifications !== false);
      setMemoryDepth(prefs.memory_depth || 6);
    } catch { navigate("/login"); }
    finally { setLoading(false); }
  }

  async function loadSessions() {
    try {
      const res = await axios.get(`${API}/user/me/sessions`, { headers: userHeader() });
      setSessions(res.data || []);
    } catch (e) { console.error(e); }
  }

  async function saveProfile(e) {
    e.preventDefault();
    setMsg("");
    if (newPassword && newPassword !== confirmPw) { setMsg("❌ Passwords do not match"); return; }
    if (newPassword && newPassword.length < 8)    { setMsg("❌ Password must be at least 8 characters"); return; }
    setSaving(true);
    try {
      const body = { full_name: fullName };
      if (newPassword) { body.new_password = newPassword; body.old_password = oldPassword; }
      const res = await axios.patch(`${API}/user/me`, body, { headers: userHeader() });
      localStorage.setItem("user_name", res.data.user.full_name);
      setMsg("✅ Profile updated successfully");
      setOldPassword(""); setNewPassword(""); setConfirmPw("");
    } catch (err) { setMsg(`❌ ${err.response?.data?.detail || "Update failed"}`); }
    finally { setSaving(false); }
  }

  async function savePreferences() {
    setMsg("");
    setSaving(true);
    try {
      await axios.patch(`${API}/user/me/preferences`,
        { theme, language, notifications, memory_depth: memoryDepth },
        { headers: userHeader() }
      );
      localStorage.setItem("user_prefs", JSON.stringify({ theme, language, notifications }));
      setMsg("✅ Preferences saved");
    } catch (err) { setMsg(`❌ ${err.response?.data?.detail || "Failed to save preferences"}`); }
    finally { setSaving(false); }
  }

  async function deleteSession(id) {
    if (!confirm("Delete this chat session?")) return;
    try {
      await axios.delete(`${API}/user/me/sessions/${id}`, { headers: userHeader() });
      setSessions(prev => prev.filter(s => s.id !== id));
      setMsg("✅ Session deleted");
    } catch (err) { setMsg(`❌ ${err.response?.data?.detail || "Delete failed"}`); }
  }

  async function deleteAccount() {
    if (!confirm("This will permanently delete your account and all your data. This cannot be undone. Are you sure?")) return;
    if (!confirm("Last warning — are you absolutely sure?")) return;
    try {
      await axios.delete(`${API}/user/me`, { headers: userHeader() });
      localStorage.clear();
      navigate("/");
    } catch (err) { setMsg(`❌ ${err.response?.data?.detail || "Delete failed"}`); }
  }

  function logout() {
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_prefs");
    navigate("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"/>
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{animationDelay:"0.1s"}}/>
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{animationDelay:"0.2s"}}/>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100" dir={isRTL(lang) ? "rtl" : "ltr"}>

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">S</div>
            <span className="font-semibold">SmartBot</span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-sm text-indigo-600 hover:underline">← Back to Chat</Link>
          <button onClick={logout} className="text-sm text-red-500 hover:text-red-700 transition">Logout</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* User card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div>
            <h1 className="text-xl font-bold">{user?.full_name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email || user?.phone || "—"}</p>
            <p className="text-xs text-gray-400 mt-0.5">Member since {formatDateTime(user?.created_at)}</p>
          </div>
        </div>

        {/* Status message */}
        {msg && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border ${
            msg.startsWith("✅") ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700"
            : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700"
          }`}>
            {msg}
            <button onClick={() => setMsg("")} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {["profile", "preferences", "history"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
                tab === t ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}>
              {t === "history" ? `💬 ${tr("chat_history", lang)}` : t === "preferences" ? `⚙️ ${tr("preferences_title", lang)}` : `👤 ${tr("profile_title", lang)}`}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {tab === "profile" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="font-semibold text-base mb-4">Edit Profile</h2>
              <form onSubmit={saveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr("full_name", lang)}</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Change Password</h3>
                  <div className="space-y-3">
                    <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)}
                      placeholder="Current password"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      placeholder="New password (min 8 characters)"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <button type="submit" disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition disabled:opacity-60">
                  {saving ? "..." : tr("save_changes", lang)}
                </button>
              </form>
            </div>

            {/* Danger zone */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/30 p-6">
              <h2 className="font-semibold text-base text-red-600 dark:text-red-400 mb-2">Danger Zone</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Permanently delete your account and all your chat history. This cannot be undone.</p>
              <button onClick={deleteAccount}
                className="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 text-sm font-medium transition border border-red-200 dark:border-red-800">
                Delete My Account
              </button>
            </div>
          </div>
        )}

        {/* Preferences tab */}
        {tab === "preferences" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
            <h2 className="font-semibold text-base">{tr("preferences_title", lang)}</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Theme</label>
              <div className="flex gap-3">
                {["light", "dark", "system"].map(t => (
                  <button key={t} onClick={() => setTheme(t)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition capitalize border ${
                      theme === t ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400"
                    }`}>
                    {t === "light" ? "☀️ Light" : t === "dark" ? "🌙 Dark" : "💻 System"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Language</label>
              <select value={language} onChange={e => setLanguage(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="en">English</option>
                <option value="ar">Arabic — العربية</option>
                <option value="hi">Hindi — हिन्दी</option>
                <option value="ta">Tamil — தமிழ்</option>
                <option value="fr">French — Français</option>
                <option value="es">Spanish — Español</option>
                <option value="de">German — Deutsch</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Notifications</p>
                <p className="text-xs text-gray-400 mt-0.5">Receive system updates and alerts</p>
              </div>
              <button onClick={() => setNotifications(v => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors ${notifications ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifications ? "translate-x-6" : ""}`}/>
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr("memory_depth", lang)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{tr("memory_desc", lang)}</p>
                </div>
                <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400 min-w-16 text-right">
                  {memoryDepth === 0 ? "Off" : `${memoryDepth} messages`}
                </span>
              </div>
              <input type="range" min="0" max="20" step="2" value={memoryDepth}
                onChange={e => setMemoryDepth(Number(e.target.value))}
                className="w-full accent-indigo-600"/>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Off</span>
                <span>4</span>
                <span>8</span>
                <span>12</span>
                <span>20</span>
              </div>
            </div>

            <button onClick={savePreferences} disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition disabled:opacity-60">
              {saving ? "..." : tr("save_preferences", lang)}
            </button>
          </div>
        )}

        {/* Chat History tab */}
        {tab === "history" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-base">Chat History</h2>
              <span className="text-sm text-gray-400">{sessions.length} session(s)</span>
            </div>
            {sessions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-3">💬</p>
                <p className="text-sm">No chat sessions yet.</p>
                <Link to="/" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">Start a conversation →</Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {sessions.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.title || "New Chat"}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{s.message_count} messages · {formatDateTime(s.updated_at)}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                      <Link to="/" onClick={() => localStorage.setItem("load_session", s.id)}
                        className="text-xs text-indigo-600 hover:underline">Open</Link>
                      <button onClick={() => deleteSession(s.id)}
                        className="text-xs text-red-500 hover:text-red-700 transition">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
