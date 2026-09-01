import sqlite3
import os
from datetime import datetime
from config import Config

os.makedirs(os.path.dirname(Config.DB_PATH), exist_ok=True)


def get_db():
    conn = sqlite3.connect(Config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            google_id TEXT UNIQUE NOT NULL,
            email TEXT NOT NULL,
            name TEXT,
            picture TEXT,
            created_at TEXT NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT DEFAULT 'New Chat',
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            used_web INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            conversation_id INTEGER,
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS doc_chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            chunk_index INTEGER NOT NULL,
            chunk_text TEXT NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        )
    """)

    # AI Chat (friendly companion side-panel) — kept fully separate from the
    # main document-first conversations/messages tables above.
    cur.execute("""
        CREATE TABLE IF NOT EXISTS companion_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Knowledge is user-level, not chat-level. Older versions attached files to a
    # conversation; detach them once so they survive new-chat creation/deletion.
    cur.execute("UPDATE documents SET conversation_id = NULL WHERE conversation_id IS NOT NULL")

    conn.commit()
    conn.close()


def now():
    return datetime.utcnow().isoformat()


# ---------- Users ----------
def get_or_create_user(google_id, email, name, picture):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE google_id = ?", (google_id,))
    user = cur.fetchone()
    if user is None:
        cur.execute(
            "INSERT INTO users (google_id, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?)",
            (google_id, email, name, picture, now()),
        )
        conn.commit()
        user_id = cur.lastrowid
        cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cur.fetchone()
    else:
        cur.execute(
            "UPDATE users SET name = ?, picture = ? WHERE id = ?",
            (name, picture, user["id"]),
        )
        conn.commit()
    conn.close()
    return dict(user)


def get_user(user_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


# ---------- Conversations ----------
def create_conversation(user_id, title="New Chat"):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO conversations (user_id, title, created_at) VALUES (?, ?, ?)",
        (user_id, title, now()),
    )
    conn.commit()
    conv_id = cur.lastrowid
    conn.close()
    return conv_id


def list_conversations(user_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM conversations WHERE user_id = ? ORDER BY id DESC", (user_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_conversation(conv_id, user_id):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM conversations WHERE id = ? AND user_id = ?", (conv_id, user_id)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def rename_conversation(conv_id, title):
    conn = get_db()
    conn.execute("UPDATE conversations SET title = ? WHERE id = ?", (title, conv_id))
    conn.commit()
    conn.close()


def delete_conversation(conv_id, user_id):
    conn = get_db()
    conn.execute(
        "DELETE FROM conversations WHERE id = ? AND user_id = ?", (conv_id, user_id)
    )
    conn.commit()
    conn.close()


# ---------- Messages ----------
def add_message(conversation_id, role, content, used_web=0):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO messages (conversation_id, role, content, used_web, created_at) VALUES (?, ?, ?, ?, ?)",
        (conversation_id, role, content, used_web, now()),
    )
    conn.commit()
    msg_id = cur.lastrowid
    conn.close()
    return msg_id


def list_messages(conversation_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC",
        (conversation_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_last_assistant_message(conversation_id):
    conn = get_db()
    row = conn.execute(
        "SELECT id FROM messages WHERE conversation_id = ? AND role = 'assistant' ORDER BY id DESC LIMIT 1",
        (conversation_id,),
    ).fetchone()
    if row:
        conn.execute("DELETE FROM messages WHERE id = ?", (row["id"],))
        conn.commit()
    conn.close()


# ---------- Documents ----------
def add_document(user_id, conversation_id, filename, filepath):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO documents (user_id, conversation_id, filename, filepath, created_at) VALUES (?, ?, ?, ?, ?)",
        (user_id, conversation_id, filename, filepath, now()),
    )
    conn.commit()
    doc_id = cur.lastrowid
    conn.close()
    return doc_id


def add_chunks(document_id, chunks):
    conn = get_db()
    cur = conn.cursor()
    cur.executemany(
        "INSERT INTO doc_chunks (document_id, chunk_index, chunk_text) VALUES (?, ?, ?)",
        [(document_id, i, c) for i, c in enumerate(chunks)],
    )
    conn.commit()
    conn.close()


def list_documents(user_id, conversation_id=None):
    # Documents belong to the user's Knowledge base. conversation_id is accepted
    # for API compatibility, but intentionally does not filter the collection.
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM documents WHERE user_id = ? ORDER BY id DESC", (user_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_chunks_for_user(user_id):
    conn = get_db()
    rows = conn.execute(
        """SELECT dc.chunk_text, d.filename FROM doc_chunks dc
           JOIN documents d ON dc.document_id = d.id
           WHERE d.user_id = ? ORDER BY d.id DESC, dc.chunk_index ASC""",
        (user_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_chunks_for_conversation(conversation_id):
    # Backward-compatible helper; knowledge is now global per user.
    conn = get_db()
    rows = conn.execute(
        """SELECT dc.chunk_text, d.filename FROM doc_chunks dc
           JOIN documents d ON dc.document_id = d.id
           WHERE d.conversation_id = ?""",
        (conversation_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_document(doc_id, user_id):
    conn = get_db()
    conn.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (doc_id, user_id))
    conn.commit()
    conn.close()


def user_document_stats(user_id):
    """Total documents + total chunks collected across ALL of a user's chats."""
    conn = get_db()
    doc_count = conn.execute(
        "SELECT COUNT(*) FROM documents WHERE user_id = ?", (user_id,)
    ).fetchone()[0]
    chunk_count = conn.execute(
        """SELECT COUNT(*) FROM doc_chunks dc
           JOIN documents d ON dc.document_id = d.id
           WHERE d.user_id = ?""",
        (user_id,),
    ).fetchone()[0]
    conn.close()
    return {"documents": doc_count, "chunks": chunk_count}


# ---------- AI Chat (companion) ----------
def add_companion_message(user_id, role, content):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO companion_messages (user_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (user_id, role, content, now()),
    )
    conn.commit()
    msg_id = cur.lastrowid
    conn.close()
    return msg_id


def list_companion_messages(user_id, limit=60):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM companion_messages WHERE user_id = ? ORDER BY id ASC",
        (user_id,),
    ).fetchall()
    conn.close()
    rows = [dict(r) for r in rows]
    return rows[-limit:]


def clear_companion_messages(user_id):
    conn = get_db()
    conn.execute("DELETE FROM companion_messages WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
