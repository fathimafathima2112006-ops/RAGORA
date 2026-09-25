# RAGORA Vercel SQLite Lock Fix

This build keeps the current SQLite architecture for the submission-ready Vercel deployment.

Fixes:
- SQLite connection timeout increased to 30 seconds.
- SQLite busy timeout increased to 30 seconds.
- WAL mode retained where supported.
- Write operations now retry transient `database is locked` / `database is busy` errors with exponential backoff.
- Conversation creation, messages, documents, companion messages, and user updates use the retry wrapper.
- Existing app/UI/API structure is preserved.

Note: SQLite on Vercel remains a lightweight submission/runtime solution, not a durable multi-instance production database. A hosted Postgres/Supabase database is the long-term architecture for persistent production data.
