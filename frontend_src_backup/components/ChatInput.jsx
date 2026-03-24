import { useState } from "react";

export default function ChatInput({ onSend, loading }) {
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim() || loading) return;
    onSend(text.trim());
    setText("");
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="px-4 pb-4 pt-2 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2 bg-gray-100 dark:bg-gray-800 rounded-2xl px-3 py-2 border border-gray-200 dark:border-gray-700 focus-within:border-indigo-400 transition">
          <textarea
            className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed text-gray-900 dark:text-gray-100 placeholder-gray-400 max-h-36 py-1"
            placeholder="Ask SmartBot a banking question..."
            value={text}
            rows={1}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKey}
            style={{ minHeight: "36px" }}
            onInput={e => {
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
          />
          <button
            onClick={submit}
            disabled={!text.trim() || loading}
            className={`p-2 rounded-xl transition flex-shrink-0 ${
              text.trim() && !loading
                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                : "bg-gray-300 dark:bg-gray-600 text-gray-400 cursor-not-allowed"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          SmartBot can make mistakes. Always verify important banking information with your representative.
        </p>
      </div>
    </div>
  );
}