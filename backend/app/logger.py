"""
logger.py — Centralised logging for SmartBot V2
Creates two log files:
  - logs/app.log   : all activity
  - logs/error.log : errors only
"""

import os
import logging
from logging.handlers import RotatingFileHandler

# ─────────────────────────────────────────────
# Log directory — sits inside backend/
# ─────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR  = os.path.join(BASE_DIR, "logs")
os.makedirs(LOG_DIR, exist_ok=True)

APP_LOG_FILE   = os.path.join(LOG_DIR, "app.log")
ERROR_LOG_FILE = os.path.join(LOG_DIR, "error.log")

# ─────────────────────────────────────────────
# Formatter
# ─────────────────────────────────────────────
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
formatter  = logging.Formatter(LOG_FORMAT, datefmt="%Y-%m-%d %H:%M:%S")


def _make_rotating_handler(path: str, level: int) -> RotatingFileHandler:
    """5 MB per file, keep last 5 files."""
    handler = RotatingFileHandler(
        path,
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8"
    )
    handler.setLevel(level)
    handler.setFormatter(formatter)
    return handler


def get_logger(name: str = "smartbot") -> logging.Logger:
    logger = logging.getLogger(name)

    # If already has handlers, return as-is to prevent duplicate logs
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)
    logger.propagate = False  # prevents root logger from duplicating

    # Console handler
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(formatter)

    # App log — INFO and above
    app_handler = _make_rotating_handler(APP_LOG_FILE, logging.INFO)

    # Error log — ERROR and above only
    error_handler = _make_rotating_handler(ERROR_LOG_FILE, logging.ERROR)

    logger.addHandler(console)
    logger.addHandler(app_handler)
    logger.addHandler(error_handler)

    return logger


# ─────────────────────────────────────────────
# Module-level default logger
# ─────────────────────────────────────────────
logger = get_logger("smartbot")