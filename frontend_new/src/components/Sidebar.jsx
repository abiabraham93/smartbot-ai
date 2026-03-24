export default function Sidebar({ sessions, activeId, onNewChat, onSelectSession, dark, onToggleDark }) {
  return (
    <div className="w-64 flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">S</div>
          <div>
            <div className="font-semibold text-sm leading-none">SmartBot</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Banking AI Assistant</div>
          </div>
        </div>
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <p className="text-xs text-gray-400 text-center mt-6 px-4">No conversations yet. Start chatting!</p>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-medium px-2 mb-2 mt-1">Recent</p>
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                  activeId === s.id
                    ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                <svg className="w-4 h-4 flex-shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                </svg>
                <span className="truncate">{s.title || "New Chat"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span className="text-xs text-gray-400">v2.0.0</span>
        <button
          onClick={onToggleDark}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          title="Toggle dark mode"
        >
          {dark ? (
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"/>
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}