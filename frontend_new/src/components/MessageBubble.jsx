import { useState } from "react";
import { t } from "../i18n";
import ReactMarkdown from "react-markdown";

export default function MessageBubble({ role, content, sources, messageId, onFeedback, lang = "en" }) {
  const [feedback, setFeedback] = useState(null); // null | 1 | -1
  const [feedbackSent, setFeedbackSent] = useState(false);

  const isUser = role === "user";

  async function handleFeedback(rating) {
    if (feedbackSent || !onFeedback) return;
    setFeedback(rating);
    setFeedbackSent(true);
    await onFeedback(messageId, rating);
  }

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>

      {/* Bot avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-1">S</div>
      )}

      <div className={`max-w-2xl flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>

        {/* Message bubble */}
        <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed ${
          isUser
            ? "bg-indigo-600 text-white rounded-br-sm"
            : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm"
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sources */}
        {!isUser && sources && sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {sources.filter(s => s.source && s.source !== "Unknown").map((s, i) => (
              <span key={i}
                className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                📄 {s.source}{s.page != null ? ` p.${s.page + 1}` : ""}
              </span>
            ))}
          </div>
        )}

        {/* Feedback buttons — only for bot messages with messageId */}
        {!isUser && messageId && onFeedback && (
          <div className="flex items-center gap-2 mt-1">
            {!feedbackSent ? (
              <>
                <span className="text-xs text-gray-400">{t("was_helpful", lang)}</span>
                <button
                  onClick={() => handleFeedback(1)}
                  className="text-xs px-2 py-1 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-400 hover:text-green-600 transition"
                  title="Thumbs up">
                  👍
                </button>
                <button
                  onClick={() => handleFeedback(-1)}
                  className="text-xs px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 transition"
                  title="Thumbs down">
                  👎
                </button>
              </>
            ) : (
              <span className={`text-xs flex items-center gap-1 ${feedback === 1 ? "text-green-500" : "text-red-500"}`}>
                {feedback === 1 ? "👍" : "👎"} {t("thanks_feedback", lang)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 text-sm font-bold flex-shrink-0 mt-1">
          {localStorage.getItem("user_name")?.charAt(0)?.toUpperCase() || "U"}
        </div>
      )}
    </div>
  );
}
