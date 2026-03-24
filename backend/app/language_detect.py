"""
language_detect.py — Language detection and prompt injection (Phase 6)

Detects language from user message and injects a language instruction
into the AI prompt so it responds in the correct language.
"""

import re

# ─────────────────────────────────────────────
# Language detection
# ─────────────────────────────────────────────
def detect_language(text: str) -> str:
    """
    Detect language from text using Unicode ranges and word patterns.
    Returns language code: 'ar', 'hi', 'ta', 'fr', 'en'
    """
    if not text or len(text) < 3:
        return "en"

    # Arabic — \u0600–\u06FF
    arabic = len(re.findall(r'[\u0600-\u06FF]', text))
    if arabic / len(text) > 0.15:
        return "ar"

    # Hindi — Devanagari \u0900–\u097F
    hindi = len(re.findall(r'[\u0900-\u097F]', text))
    if hindi / len(text) > 0.15:
        return "hi"

    # Tamil — \u0B80–\u0BFF
    tamil = len(re.findall(r'[\u0B80-\u0BFF]', text))
    if tamil / len(text) > 0.15:
        return "ta"

    # French — common French function words
    french_pattern = r'\b(je|tu|il|elle|nous|vous|ils|elles|le|la|les|un|une|des|et|est|que|qui|dans|sur|avec|pour|par|mais|bonjour|merci|oui|non|comment|pourquoi|quand|où)\b'
    if re.search(french_pattern, text, re.IGNORECASE):
        french_count = len(re.findall(french_pattern, text, re.IGNORECASE))
        if french_count >= 2:
            return "fr"

    return "en"


# ─────────────────────────────────────────────
# Language instruction injection
# ─────────────────────────────────────────────
LANGUAGE_INSTRUCTIONS = {
    "ar": (
        "IMPORTANT: The user is writing in Arabic. You MUST respond entirely in Arabic (العربية). "
        "Use formal Modern Standard Arabic (الفصحى). Do not mix languages. "
        "Format numbers and dates in Arabic style where appropriate."
    ),
    "hi": (
        "IMPORTANT: The user is writing in Hindi. You MUST respond entirely in Hindi (हिन्दी). "
        "Use formal Hindi. Do not mix languages or use English words unnecessarily."
    ),
    "ta": (
        "IMPORTANT: The user is writing in Tamil. You MUST respond entirely in Tamil (தமிழ்). "
        "Use formal Tamil. Do not mix languages."
    ),
    "fr": (
        "IMPORTANT: The user is writing in French. You MUST respond entirely in French. "
        "Use formal French (vous). Do not mix languages."
    ),
    "en": ""  # No instruction needed for English
}


def inject_language_instruction(question: str, user_lang: str = None) -> tuple[str, str]:
    """
    Language detection priority:
      1. If the message contains non-Latin script (Arabic, Hindi, Tamil) → use detected language
      2. If the message is in plain English/Latin script → ALWAYS respond in English,
         regardless of profile preference. User is choosing to communicate in English.
      3. Profile language preference only applies as a fallback when detection is ambiguous.

    This ensures: "if user asks in English → answer in English, even if profile is Tamil/Arabic"
    """
    detected = detect_language(question)

    # Check if message uses Latin script only (English, French, etc.)
    non_latin = len(re.findall(r'[؀-ۿऀ-ॿ஀-௿]', question))
    is_latin_script = non_latin == 0

    if is_latin_script:
        # User typed in Latin script — detect English vs French only
        # Never override with profile language (Tamil/Arabic/Hindi)
        lang = detected  # "en" or "fr"
    else:
        # Non-Latin script detected — use detected language
        lang = detected if detected != "en" else (user_lang or "en")

    instruction = LANGUAGE_INSTRUCTIONS.get(lang, "")
    if instruction:
        modified = f"{instruction}\n\nUser question: {question}"
    else:
        modified = question

    return lang, modified


def get_language_name(lang_code: str) -> str:
    names = {
        "en": "English", "ar": "Arabic", "hi": "Hindi",
        "ta": "Tamil",   "fr": "French", "es": "Spanish", "de": "German"
    }
    return names.get(lang_code, "English")
