import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = "http://127.0.0.1:8000";

export default function AdminLogin() {
  const [step,     setStep]     = useState(1);
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [otp,      setOtp]      = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  const submitPassword = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const form = new URLSearchParams();
      form.append("username", email);
      form.append("password", password);
      await axios.post(`${API}/admin/login`, form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const form = new URLSearchParams();
      form.append("username", email);
      form.append("password", otp);
      const res = await axios.post(`${API}/admin/verify-otp`, form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      localStorage.setItem("admin_token", res.data.access_token);
      localStorage.setItem("admin_name",  res.data.admin_name);
      localStorage.setItem("admin_role",  res.data.role);
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-700 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-8">

        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-3">S</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">SmartBot Admin</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {step === 1 ? "Sign in to access the dashboard" : "Enter the OTP from your terminal"}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            step >= 1 ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500"
          }`}>1</div>
          <div className={`h-0.5 w-12 transition-all ${step >= 2 ? "bg-indigo-600" : "bg-gray-200"}`}/>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            step >= 2 ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500"
          }`}>2</div>
        </div>

        {step === 1 && (
          <form onSubmit={submitPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@smartbot.com"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <input
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition disabled:opacity-60">
              {loading ? "Verifying..." : "Continue →"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submitOtp} className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3">
              <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">OTP sent!</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Check your backend terminal window for the 6-digit code. Valid for 5 minutes.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Enter 6-digit OTP</label>
              <input
                type="text" required value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            <button type="submit" disabled={loading || otp.length < 6}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition disabled:opacity-60">
              {loading ? "Verifying OTP..." : "Sign In"}
            </button>
            <button type="button"
              onClick={() => { setStep(1); setOtp(""); setError(""); }}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition">
              ← Back to password
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          <a href="/" className="hover:text-indigo-500 transition">← Back to SmartBot</a>
        </p>
      </div>
    </div>
  );
}
