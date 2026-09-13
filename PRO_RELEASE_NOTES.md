# RAGORA SUPER AI 2.2 PRO

## Production fixes
- Fixed Groq reasoning-parameter compatibility across GPT-OSS and Qwen 3.6/3.8.
- Normal questions no longer automatically trigger web search/source cards.
- Chat history persistence is best-effort so a storage hiccup cannot turn a valid AI answer into a 500.
- Provider errors now surface a useful configuration/status message instead of the old generic restart message.
- Retrieval Explorer Top-K is now a custom readable picker instead of a browser-native select popup.
- Retrieval Explorer scores now correctly treat API scores as percentages (not 0–100 values multiplied twice).
- Retrieval Explorer cache-busted to the 2.2 frontend.

## Existing 2.1 features retained
- Qwen vision model selection for photo questions.
- Tamil + English mixed-script browser voice playback.
- Conditional web/document source cards.
- AI modes, memory, research, study, code, agent and explain modes.
- Mobile navigation and image attachment preview.
