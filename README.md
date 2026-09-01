# RAGORA Professional 2.0

This build fixes the recurring Groq 120B TPM problem by **hard-locking normal RAG/companion traffic to `openai/gpt-oss-20b`** and never honoring stale `openai/gpt-oss-120b` or retired Llama 3.1 8B values from older `.env` files.

## Routing
- Strong document match -> compact GPT-OSS 20B RAG request.
- No document match / current question -> `groq/compound-mini` live web route.
- If the 20B request hits 429/413/5xx -> no repeated retry storm; a local document-evidence fallback is returned.
- If web summarization is unavailable -> lightweight DuckDuckGo snippet fallback is used.
- GPT-OSS uses `reasoning_effort=low` to reduce unnecessary reasoning tokens.
- Prompt/history/context are deliberately capped for the user's 8K TPM environment.

## Important
Groq rate limits are organization-level. A code change cannot raise an 8K TPM account limit. This build is designed to avoid wasteful token usage and to fail gracefully instead of showing raw Groq errors.

## Run
1. Extract this folder.
2. Copy `.env.example` to `.env` and set `GROQ_API_KEY`.
3. If you have an old `.env`, it is safe to leave an old model value there; RAGORA ignores it and uses the safe model selection.
4. Run the same startup command you used for the previous build.

## Production note
Use persistent storage for `DB_PATH` and `UPLOAD_DIR` on hosted platforms.
