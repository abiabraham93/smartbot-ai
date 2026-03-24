/**
 * ProtectedRoute.jsx — Admin route guard
 *
 * Verifies admin JWT against the backend on EVERY load.
 * Handles all cases:
 *   - No token at all         → redirect to /admin
 *   - Token expired           → clear + redirect to /admin
 *   - Token valid             → show the dashboard
 *   - Network error           → show retry screen (don't lock out)
 */

import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("checking"); // checking | allowed | denied | error

  useEffect(() => {
    verify();
  }, []);

  async function verify() {
    const token = localStorage.getItem("admin_token");

    // No token — deny immediately, no network call needed
    if (!token) {
      setStatus("denied");
      return;
    }

    // Verify token is still valid against backend
    try {
      await axios.get(`${API}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000
      });
      setStatus("allowed");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        // Token invalid or expired — clear it and redirect
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_name");
        localStorage.removeItem("admin_role");
        setStatus("denied");
      } else {
        // Network error or backend down — show error screen
        setStatus("error");
      }
    }
  }

  // Verifying — show loading screen
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

  // Token invalid or missing — redirect to login
  if (status === "denied") {
    return <Navigate to="/admin" replace />;
  }

  // Backend unreachable — show friendly error (don't redirect, might be temporary)
  if (status === "error") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 text-xl">!</div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cannot reach backend</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Make sure the SmartBot backend is running on port 8000.</p>
        </div>
        <button
          onClick={() => { setStatus("checking"); verify(); }}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition">
          Try again
        </button>
        <a href="/admin" className="text-sm text-indigo-600 hover:underline">← Back to login</a>
      </div>
    );
  }

  // All good — render the protected page
  return children;
}
