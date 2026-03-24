import { useState, useRef } from "react";
import { t, isRTL } from "../i18n";

export default function ChatInput({ onSend, loading, lang = "en" }) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleInput(e) {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  const rtl = isRTL(lang);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
      <div className={`max-w-3xl mx-auto flex items-end gap-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 focus-within:border-indigo-400 dark:focus-within:border-indigo-500 transition ${rtl ? "flex-row-reverse" : ""}`}>
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={loading}
          dir={rtl ? "rtl" : "ltr"}
          placeholder={t("input_placeholder", lang)}
          className={`flex-1 bg-transparent resize-none outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 max-h-40 disabled:opacity-60 ${rtl ? "text-right" : ""}`}
        />
        <button
          onClick={submit}
          disabled={!text.trim() || loading}
          className="flex-shrink-0 w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition"
          title="Send">
          {loading ? (
            <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          ) : (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
          )}
        </button>
      </div>
      <p className={`text-center text-xs text-gray-400 dark:text-gray-500 mt-2 ${rtl ? "text-right" : ""}`}>
        {t("input_disclaimer", lang)}
      </p>
    </div>
  );
}
