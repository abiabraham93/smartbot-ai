import { useEffect, useRef, useState } from "react";
import { t, isRTL } from "../i18n";
import MessageBubble from "./MessageBubble";
import axios from "axios";

const API = "http://127.0.0.1:8000";

function userAuthHeader() {
  const token = localStorage.getItem("user_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ChatWindow({ messages, loading, internetEnabled, streamingContent, suggestions, onSuggestionClick, onRefreshSuggestions, lang = "en" }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, loading]);

  async function submitFeedback(messageId, rating) {
    try {
      await axios.post(`${API}/feedback`,
        { message_id: messageId, rating },
        { headers: userAuthHeader() }
      );
    } catch (e) { console.error("Feedback error:", e); }
  }

  const isEmpty = messages.length === 0 && !loading && !streamingContent;

  return (
    <div className={`flex-1 overflow-y-auto px-4 py-6 space-y-4 ${isRTL(lang) ? "rtl" : "ltr"}`} dir={isRTL(lang) ? "rtl" : "ltr"}>
      {isEmpty && (
        <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold">S</div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("welcome_title", lang)}</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm max-w-sm">{t("welcome_subtitle", lang)}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
            <span className={`w-2 h-2 rounded-full ${internetEnabled ? "bg-green-500" : "bg-gray-400"}`}/>
            {internetEnabled ? t("online_mode", lang) : t("offline_mode", lang)}
          </div>
          <div className={`grid grid-cols-2 gap-3 w-full max-w-md ${isRTL(lang) ? "text-right" : ""}`}>
            {[t("suggestion_1",lang), t("suggestion_2",lang), t("suggestion_3",lang), t("suggestion_4",lang)].map((q, i) => (
              <button key={i} onClick={() => onSuggestionClick && onSuggestionClick(q)}
                className="text-left px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg, i) => (
        <div key={i}>
          <MessageBubble
            role={msg.role}
            content={msg.content}
            sources={msg.sources}
            messageId={msg.messageId}
            onFeedback={msg.role === "assistant" && msg.messageId ? submitFeedback : null}
          />
        </div>
      ))}

      {/* Streaming message — live typing */}
      {streamingContent && (
        <div className="flex gap-3 justify-start">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-1">S</div>
          <div className="max-w-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm">
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
              {streamingContent}
              <span className="inline-block w-1 h-4 bg-indigo-500 ml-0.5 animate-pulse align-middle"/>
            </p>
          </div>
        </div>
      )}

      {/* Follow-up suggestions */}
      {suggestions && suggestions.length > 0 && !loading && !streamingContent && (
        <div className="flex flex-col gap-2 pl-11">
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-400 font-medium">{t("suggested_followups", lang)}</p>
            {onRefreshSuggestions && (
              <button onClick={onRefreshSuggestions}
                className="text-xs text-gray-400 hover:text-indigo-500 transition"
                title="Refresh suggestions">
                ↻
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => onSuggestionClick && onSuggestionClick(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading dots (non-streaming fallback) */}
      {loading && !streamingContent && (
        <div className="flex gap-3 justify-start">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">S</div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm">
            <div className="flex gap-1.5 items-center h-5">
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{animationDelay:"0ms"}}/>
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{animationDelay:"150ms"}}/>
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{animationDelay:"300ms"}}/>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef}/>
    </div>
  );
}
