import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

export default function ChatWindow({ messages, loading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2 bg-white dark:bg-gray-900">
      {messages.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center h-full text-center pb-20">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg">
            S
          </div>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Welcome to SmartBot
          </h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-md text-sm">
            Your secure banking AI assistant. Ask me about products, policies, procedures, or any banking query.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-6 max-w-sm w-full">
            {[
              "What are the loan eligibility criteria?",
              "Explain fixed vs floating interest rates",
              "How do I open a savings account?",
              "What documents are needed for a mortgage?"
            ].map(q => (
              <button
                key={q}
                className="text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg, i) => (
        <MessageBubble key={i} role={msg.role} content={msg.content} sources={msg.sources} />
      ))}

      {loading && (
        <div className="flex items-start gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            S
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}