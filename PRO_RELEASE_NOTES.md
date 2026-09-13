# RAGORA SUPER AI 2.1 PRO

## This release
- Professional Retrieval Explorer / RAG Intelligence Lab redesign.
- Retrieval trace now clearly separates query, signals, fusion, reranking and Top-K evidence.
- Document evidence cards show page/chunk/confidence details.
- Sources are conditional: ordinary answers show no source panel; web-researched answers show web sources; document-grounded answers show document sources only when the answer actually cites the retrieved evidence.
- Mixed Tamil + English voice playback now switches browser voices by script segment instead of forcing the entire answer through English.
- Photo questions now use current Groq multimodal models (`qwen/qwen3.6-27b` / `qwen/qwen3.8-27b`) rather than the deprecated Llama 4 Scout vision model.
- Image questions bypass the text-only web path so the attached image reaches the vision model.
- Composer shows a thumbnail/filename preview before sending an image and supports removing it.
- Existing multilingual chat, math, diagrams, document RAG, chat deletion and mobile drawer improvements are retained.
