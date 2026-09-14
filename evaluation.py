"""Small offline evaluation helpers for the RAG pipeline."""
from __future__ import annotations


def keyword_recall(answer: str, expected_keywords: list[str]) -> float:
    text = (answer or "").lower()
    if not expected_keywords:
        return 1.0
    hits = sum(1 for word in expected_keywords if word.lower() in text)
    return hits / len(expected_keywords)
