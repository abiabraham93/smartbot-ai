import { useState, useEffect, useRef, useCallback } from "react";
import { t } from "../i18n";
import ReactMarkdown from "react-markdown";
import mermaid from "mermaid";

// Initialize mermaid once
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
  fontFamily: "inherit",
  flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" },
  sequence: { useMaxWidth: true },
  themeVariables: {
    primaryColor: "#4f46e5",
    primaryTextColor: "#ffffff",
    primaryBorderColor: "#4338ca",
    lineColor: "#6366f1",
    secondaryColor: "#e0e7ff",
    tertiaryColor: "#f5f3ff",
    fontSize: "14px",
  },
});

// ── Mermaid Diagram Component ────────────────────────────────────────────────
function MermaidDiagram({ chart }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg: rendered } = await mermaid.render(id, chart.trim());
        if (!cancelled) { setSvg(rendered); setError(null); }
      } catch (err) {
        if (!cancelled) { setError(err.message || "Render failed"); }
      }
    }
    render();
    return () => { cancelled = true; };
  }, [chart]);

  const handleDownload = useCallback(() => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "smartbot-diagram.svg";
    a.click();
    URL.revokeObjectURL(url);
  }, [svg]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(chart.trim());
  }, [chart]);

  if (error) {
    return (
      <div className="my-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Diagram error</p>
        <pre className="text-xs text-red-500 whitespace-pre-wrap">{error}</pre>
        <details className="mt-2">
          <summary className="text-xs text-red-400 cursor-pointer">Show raw code</summary>
          <pre className="mt-1 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-2 rounded">{chart}</pre>
        </details>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-3 p-6 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          Rendering diagram...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="my-3 group relative">
        {/* Hover toolbar */}
        <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setIsFullscreen(true)} className="p-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-indigo-600 transition shadow-sm" title="Fullscreen">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
          </button>
          <button onClick={handleDownload} className="p-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-indigo-600 transition shadow-sm" title="Download SVG">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </button>
          <button onClick={handleCopy} className="p-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-indigo-600 transition shadow-sm" title="Copy code">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
          </button>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 overflow-x-auto cursor-pointer" onClick={() => setIsFullscreen(true)} dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="flex items-center gap-1.5 mt-1.5 px-1">
          <svg className="w-3 h-3 text-indigo-400" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/></svg>
          <span className="text-xs text-gray-400">Diagram by SmartBot</span>
        </div>
      </div>

      {/* Fullscreen modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-8" onClick={() => setIsFullscreen(false)}>
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-auto p-8" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsFullscreen(false)} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <div className="flex items-center justify-center min-h-[300px]" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="flex justify-center gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition">Download SVG</button>
              <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition">Copy Code</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// ── Markdown renderer with Mermaid detection ─────────────────────────────────
function MarkdownWithMermaid({ content }) {
  const parts = [];
  const regex = /```mermaid\s*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "mermaid", content: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  if (parts.length === 0) {
    parts.push({ type: "text", content });
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "mermaid") return <MermaidDiagram key={i} chart={part.content} />;
        const trimmed = part.content.trim();
        if (!trimmed) return null;
        return (
          <div key={i} className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
            <ReactMarkdown>{trimmed}</ReactMarkdown>
          </div>
        );
      })}
    </>
  );
}


// ── Main Component ───────────────────────────────────────────────────────────
export default function MessageBubble({ role, content, sources, messageId, onFeedback, lang = "en" }) {
  const [feedback, setFeedback] = useState(null);
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

      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-1">S</div>
      )}

      <div className={`max-w-2xl flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>

        <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed ${
          isUser
            ? "bg-indigo-600 text-white rounded-br-sm"
            : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm"
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <MarkdownWithMermaid content={content} />
          )}
        </div>

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

        {!isUser && messageId && onFeedback && (
          <div className="flex items-center gap-2 mt-1">
            {!feedbackSent ? (
              <>
                <span className="text-xs text-gray-400">{t("was_helpful", lang)}</span>
                <button onClick={() => handleFeedback(1)} className="text-xs px-2 py-1 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-400 hover:text-green-600 transition" title="Thumbs up">👍</button>
                <button onClick={() => handleFeedback(-1)} className="text-xs px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 transition" title="Thumbs down">👎</button>
              </>
            ) : (
              <span className={`text-xs flex items-center gap-1 ${feedback === 1 ? "text-green-500" : "text-red-500"}`}>
                {feedback === 1 ? "👍" : "👎"} {t("thanks_feedback", lang)}
              </span>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 text-sm font-bold flex-shrink-0 mt-1">
          {localStorage.getItem("user_name")?.charAt(0)?.toUpperCase() || "U"}
        </div>
      )}
    </div>
  );
}
