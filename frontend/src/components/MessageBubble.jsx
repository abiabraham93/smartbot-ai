import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="copy-btn">
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function MessageBubble({ role, content, sources }) {
  const isUser = role === "user";

  return (
    <div className={`flex items-start gap-3 px-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${
        isUser ? "bg-gray-400" : "bg-indigo-600"
      }`}>
        {isUser ? "U" : "S"}
      </div>

      <div className={`max-w-2xl px-4 py-3 rounded-2xl shadow-sm ${
        isUser
          ? "bg-indigo-600 text-white rounded-tr-sm"
          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm"
      }`}>
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const code  = String(children).replace(/\n$/, "");
                  if (!inline && match) {
                    return (
                      <div className="relative">
                        <CopyButton text={code} />
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{ margin: 0, borderRadius: "8px", fontSize: "0.875rem" }}
                          {...props}
                        >
                          {code}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }
                  return <code className={className} {...props}>{children}</code>;
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}

        {sources && sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Sources:</p>
            {sources.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded mr-1 mb-1">
                📄 {s.source}{s.page != null ? ` · p.${s.page}` : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}