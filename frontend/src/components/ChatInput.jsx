import { useState, useEffect, useRef } from "react";

export default function ChatInput({ onSend, loading, onVoiceAnswer }) {
  const [text,          setText]          = useState("");
  const [listening,     setListening]     = useState(false);
  const [voiceMode,     setVoiceMode]     = useState(false);
  const [speaking,      setSpeaking]      = useState(false);
  const [voiceStatus,   setVoiceStatus]   = useState("");
  const [supported,     setSupported]     = useState(false);

  const recognitionRef  = useRef(null);
  const voiceModeRef    = useRef(false);
  const synthRef        = useRef(window.speechSynthesis);

  // ── Setup Speech Recognition ──────────────────
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    setSupported(true);
    const rec             = new SpeechRecognition();
    rec.continuous        = false;
    rec.interimResults    = false;
    rec.lang              = "en-US";
    rec.maxAlternatives   = 1;

    rec.onstart = () => {
      setListening(true);
      setVoiceStatus("Listening...");
    };

    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setListening(false);
      setVoiceStatus("Processing...");
      setText(transcript);
      // Auto-send in voice mode
      if (voiceModeRef.current) {
        onSend(transcript);
      }
    };

    rec.onerror = (e) => {
      console.error("Speech error:", e.error);
      setListening(false);
      if (e.error === "no-speech" && voiceModeRef.current) {
        // No speech detected — listen again
        setTimeout(() => startListening(), 1000);
      } else {
        setVoiceStatus("Error — tap mic to retry");
      }
    };

    rec.onend = () => {
      setListening(false);
    };

    recognitionRef.current = rec;
  }, []);

  // ── Speak AI answer (called from parent) ─────
  useEffect(() => {
    if (onVoiceAnswer && voiceMode) {
      speakText(onVoiceAnswer);
    }
  }, [onVoiceAnswer]);

  function speakText(text) {
    if (!text || !voiceModeRef.current) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();

    // Clean markdown from text before speaking
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/`{1,3}[^`]*`{1,3}/g, "code block")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[-*•]\s/g, "")
      .replace(/\n+/g, ". ")
      .trim();

    const utterance      = new SpeechSynthesisUtterance(clean);
    utterance.rate       = 1.0;
    utterance.pitch      = 1.0;
    utterance.volume     = 1.0;
    utterance.lang       = "en-US";

    // Pick a good voice if available
    const voices = synthRef.current.getVoices();
    const preferred = voices.find(v =>
      v.name.includes("Samantha") ||
      v.name.includes("Google US English") ||
      v.name.includes("Alex") ||
      (v.lang === "en-US" && v.localService)
    );
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => {
      setSpeaking(true);
      setVoiceStatus("Speaking...");
    };

    utterance.onend = () => {
      setSpeaking(false);
      // Auto-listen again after speaking
      if (voiceModeRef.current) {
        setVoiceStatus("Listening...");
        setTimeout(() => startListening(), 500);
      }
    };

    utterance.onerror = () => {
      setSpeaking(false);
      if (voiceModeRef.current) startListening();
    };

    synthRef.current.speak(utterance);
  }

  function startListening() {
    if (!recognitionRef.current || !voiceModeRef.current) return;
    try {
      recognitionRef.current.start();
    } catch (e) {
      // Already started
    }
  }

  function stopListening() {
    try {
      recognitionRef.current?.stop();
    } catch (e) {}
  }

  function toggleVoiceMode() {
    if (voiceMode) {
      // Exit voice mode
      voiceModeRef.current = false;
      setVoiceMode(false);
      setListening(false);
      setSpeaking(false);
      setVoiceStatus("");
      stopListening();
      synthRef.current.cancel();
    } else {
      // Enter voice mode
      voiceModeRef.current = true;
      setVoiceMode(true);
      setText("");
      setTimeout(() => startListening(), 300);
    }
  }

  // ── Manual mic (single use, not voice mode) ──
  const toggleSingleMic = () => {
    if (listening) {
      stopListening();
      setListening(false);
    } else {
      setText("");
      try { recognitionRef.current?.start(); } catch (e) {}
    }
  };

  const submit = () => {
    if (!text.trim() || loading) return;
    if (listening) stopListening();
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

      {/* Voice mode overlay indicator */}
      {voiceMode && (
        <div className={`mb-2 mx-auto max-w-3xl flex items-center justify-center gap-3 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
          speaking
            ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
            : listening
            ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
            : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
        }`}>
          {/* Animated dots */}
          <span className="flex gap-1">
            <span className={`w-2 h-2 rounded-full ${
              speaking ? "bg-indigo-500 animate-bounce" :
              listening ? "bg-red-500 animate-pulse" :
              "bg-gray-400"
            }`} style={{ animationDelay: "0ms" }}/>
            <span className={`w-2 h-2 rounded-full ${
              speaking ? "bg-indigo-500 animate-bounce" :
              listening ? "bg-red-500 animate-pulse" :
              "bg-gray-400"
            }`} style={{ animationDelay: "150ms" }}/>
            <span className={`w-2 h-2 rounded-full ${
              speaking ? "bg-indigo-500 animate-bounce" :
              listening ? "bg-red-500 animate-pulse" :
              "bg-gray-400"
            }`} style={{ animationDelay: "300ms" }}/>
          </span>
          <span>{voiceStatus || "Voice mode active"}</span>
          <button
            onClick={toggleVoiceMode}
            className="ml-auto text-xs px-2 py-1 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition border border-gray-200 dark:border-gray-600"
          >
            Exit voice mode
          </button>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <div className={`flex items-end gap-2 bg-gray-100 dark:bg-gray-800 rounded-2xl px-3 py-2 border transition ${
          voiceMode
            ? listening
              ? "border-red-400 dark:border-red-500"
              : speaking
              ? "border-indigo-400 dark:border-indigo-500"
              : "border-gray-300 dark:border-gray-600"
            : "border-gray-200 dark:border-gray-700 focus-within:border-indigo-400"
        }`}>

          {/* Single-use mic button (only shown when NOT in voice mode) */}
          {supported && !voiceMode && (
            <button
              onClick={toggleSingleMic}
              disabled={loading}
              title={listening ? "Stop recording" : "Voice input"}
              className={`p-2 rounded-xl flex-shrink-0 transition ${
                listening
                  ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                  : "text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
              }`}
            >
              {listening ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 11-8 0V7a4 4 0 014-4z"/>
                </svg>
              )}
            </button>
          )}

          {/* Text input */}
          <textarea
            className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed text-gray-900 dark:text-gray-100 placeholder-gray-400 max-h-36 py-1"
            placeholder={
              voiceMode
                ? listening ? "🎤 Listening..." : speaking ? "🔊 Speaking..." : "Voice mode active..."
                : "Ask SmartBot a banking question..."
            }
            value={text}
            rows={1}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKey}
            style={{ minHeight: "36px" }}
            onInput={e => {
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            readOnly={voiceMode}
          />

          {/* Voice conversation mode button */}
          {supported && (
            <button
              onClick={toggleVoiceMode}
              disabled={loading}
              title={voiceMode ? "Exit voice conversation mode" : "Start voice conversation mode"}
              className={`p-2 rounded-xl flex-shrink-0 transition ${
                voiceMode
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
              }`}
            >
              {/* Waveform icon for voice mode */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
              </svg>
            </button>
          )}

          {/* Send button */}
          {!voiceMode && (
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
            </button>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-2">
          {voiceMode
            ? "Voice conversation active — SmartBot is listening and will speak responses"
            : "SmartBot can make mistakes. Always verify important banking information with your representative."
          }
        </p>
      </div>
    </div>
  );
}