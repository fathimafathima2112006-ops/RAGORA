# RAGORA Pro UI + Reliability Patch — 2026-09-22

## What changed

- Removed the separate conversation rail from AI Chat. Chat now uses the full workspace width.
- Chat history remains available from the main sidebar under **Chat History**.
- Switched the product to a light-first visual system with a cleaner, more professional AI-workspace feel.
- Redesigned the Retrieval Explorer styling for a white/light surface, stronger hierarchy, compact evidence cards, and clearer retrieval states.
- Added a retrieval loading state and a soft retry state instead of exposing raw request errors.
- Added stale conversation recovery: if a conversation ID no longer exists, the API creates a fresh conversation and the browser retries once.
- Added `conversation_id` to chat responses so the browser always follows the server's active conversation.
- Added a server-side safety net so unexpected model/runtime failures return a usable assistant message instead of a raw 500 response.
- Disabled the expensive decorative aurora/grid treatment in light mode for a cleaner and lighter UI.

## Important deployment note

The `not_found` symptom can also be caused by Vercel function-local SQLite storage being ephemeral. The UI/API recovery above prevents a stale ID from becoming a visible dead-end, but persistent chat history and uploaded files still require durable storage.

Vercel serves the Flask app directly through `api/index.py`; it does not require a Render gateway URL. Vercel local storage is ephemeral, so use managed database/object storage if conversations and uploaded files must persist between function instances.
