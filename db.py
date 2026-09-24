"""SQLite persistence layer for the Streamlit RAGORA app."""
from __future__ import annotations

import hashlib
import os
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DB = BASE_DIR / "data" / "ragora.db"
DB_PATH = Path(os.getenv("DB_PATH", str(DEFAULT_DB)))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 210_000)
    return f"pbkdf2_sha256$210000${salt.hex()}${digest.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt_hex, digest_hex = stored.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode(),
            bytes.fromhex(salt_hex),
            int(iterations),
        ).hex()
        return secrets.compare_digest(candidate, digest_hex)
    except Exception:
        return False


def init_db() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                pages INTEGER NOT NULL DEFAULT 0,
                uploaded_at TEXT NOT NULL,
                UNIQUE(user_id, filename),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS chats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                sources TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
            CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id, id);
            """
        )

        # Backward-compatible migration for older databases that lacked password.
        columns = {row[1] for row in conn.execute("PRAGMA table_info(users)")}
        if "password" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT ''")


init_db()


def create_user(username: str, password: str):
    username = (username or "").strip()
    if len(username) < 3:
        return False, "Username must contain at least 3 characters."
    if len(username) > 50:
        return False, "Username is too long."
    if len(password or "") < 6:
        return False, "Password must contain at least 6 characters."

    try:
        with _connect() as conn:
            conn.execute(
                "INSERT INTO users(username, password, created_at) VALUES (?, ?, ?)",
                (username, _hash_password(password), _now()),
            )
        return True, "Account created successfully."
    except sqlite3.IntegrityError:
        return False, "That username is already in use."


def authenticate_user(username: str, password: str):
    username = (username or "").strip()
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, username, password FROM users WHERE username = ?",
            (username,),
        ).fetchone()

    if not row or not _verify_password(password or "", row["password"]):
        return None

    return {"id": row["id"], "username": row["username"]}


def add_document(user_id: int, filename: str, pages: int) -> None:
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO documents(user_id, filename, pages, uploaded_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, filename) DO UPDATE SET
                pages = excluded.pages,
                uploaded_at = excluded.uploaded_at
            """,
            (user_id, filename, int(pages), _now()),
        )


def list_documents(user_id: int):
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, filename, pages, uploaded_at FROM documents WHERE user_id = ? ORDER BY id DESC",
            (user_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def delete_document(user_id: int, filename: str) -> None:
    with _connect() as conn:
        conn.execute(
            "DELETE FROM documents WHERE user_id = ? AND filename = ?",
            (user_id, filename),
        )


def save_chat(user_id: int, role: str, content: str, sources: str = "") -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO chats(user_id, role, content, sources, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, role, content, sources or "", _now()),
        )


def list_chats(user_id: int, limit: int = 200):
    limit = max(1, min(int(limit), 1000))
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT role, content, sources, created_at
            FROM chats
            WHERE user_id = ?
            ORDER BY id ASC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    return [dict(row) for row in rows]


def clear_chats(user_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM chats WHERE user_id = ?", (user_id,))


def user_stats(user_id: int):
    with _connect() as conn:
        docs = conn.execute(
            "SELECT COUNT(*) FROM documents WHERE user_id = ?", (user_id,)
        ).fetchone()[0]
        messages = conn.execute(
            "SELECT COUNT(*) FROM chats WHERE user_id = ?", (user_id,)
        ).fetchone()[0]
    return int(docs), int(messages)
