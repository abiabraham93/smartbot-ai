"""
utils.py — Shared utility helpers for SmartBot V2
"""

import json
import re
from datetime import datetime, timezone
from typing import Optional


def sanitize_input(text: str, max_length: int = 2000) -> str:
    if not text:
        return ""
    text = text.strip()
    text = text.replace("\x00", "")
    text = re.sub(r"\s+", " ", text)
    return text[:max_length]


def sources_to_json(sources: list) -> Optional[str]:
    if not sources:
        return None
    try:
        cleaned = []
        for s in sources:
            if isinstance(s, dict):
                cleaned.append({
                    "source": s.get("source") or "Unknown",
                    "page":   s.get("page")
                })
        return json.dumps(cleaned) if cleaned else None
    except Exception:
        return None


def json_to_sources(json_str: Optional[str]) -> list:
    if not json_str:
        return []
    try:
        return json.loads(json_str)
    except Exception:
        return []


def auto_title_from_message(message: str, max_chars: int = 40) -> str:
    clean = sanitize_input(message, max_chars + 10)
    if len(clean) <= max_chars:
        return clean
    return clean[:max_chars].rstrip() + "..."


def utc_now() -> datetime:
    return datetime.now(timezone.utc)