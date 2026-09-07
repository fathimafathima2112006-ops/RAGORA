/* ============================================================
   RAGORA - PROFESSIONAL FRONTEND CONTROLLER
   ============================================================ */

const state = {
    currentConversationId: null,
    view: "chat",
    docs: [],
    conversations: [],
    lastRetrieval: null,
    selectedDocId: null,
    chunkCache: {}
};


/* ============================================================
   DOM / HELPERS
   ============================================================ */

const el = (id) => document.getElementById(id);

const esc = (value) =>
    String(value ?? "").replace(
        /[&<>'"]/g,
        (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"
        })[char]
    );

const attr = esc;


function toast(message, kind = "ok") {
    const target = el("toast");

    if (!target) return;

    target.textContent = message;
    target.className = `toast show ${kind}`;

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
        target.className = "toast";
    }, 3200);
}


async function api(url, options = {}) {
    try {
        const response = await fetch(url, options);

        let data = {};

        try {
            data = await response.json();
        } catch (_) {
            data = {};
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                data.message ||
                `Request failed (${response.status})`
            );
        }

        return data;

    } catch (error) {
        console.error("RAGORA API error:", url, error);
        throw error;
    }
}


/* ============================================================
   VIEWPORT
   ============================================================ */

function setViewport() {
    document.documentElement.style.setProperty(
        "--vh",
        `${window.innerHeight * 0.01}px`
    );
}

setViewport();

window.addEventListener(
    "resize",
    setViewport
);


/* ============================================================
   FILE HELPERS
   ============================================================ */

function iconFile(filename) {
    const ext = (
        filename?.split(".").pop() || "DOC"
    ).toUpperCase();

    if (ext === "PDF") return "PDF";

    return ext || "DOC";
}


/* ============================================================
   NAVIGATION
   ============================================================ */

function nav() {
    document.querySelectorAll(".nav-item").forEach((button) => {

        button.onclick = () => {
            renderView(button.dataset.view);
        };

    });
}


/* ============================================================
   LAYOUT
   ============================================================ */

function layout(
    title,
    subtitle,
    actions = ""
) {
    return `
        <section class="page-head">
            <div>
                <div class="eyebrow">
                    RAGORA WORKSPACE
                </div>

                <h1>${title}</h1>

                <p>${subtitle}</p>
            </div>

            <div class="page-actions">
                ${actions}
            </div>
        </section>
    `;
}


function metric(
    label,
    value,
    meta,
    icon = "◫"
) {
    return `
        <div class="metric-card">
            <span class="metric-icon">${icon}</span>

            <div>
                <small>${label}</small>
                <strong>${value}</strong>
                <em>${meta || ""}</em>
            </div>
        </div>
    `;
}


function empty(
    title,
    text,
    action = ""
) {
    return `
        <div class="empty-state">
            <div class="empty-icon">⌁</div>

            <h3>${title}</h3>

            <p>${text}</p>

            ${action}
        </div>
    `;
}


/* ============================================================
   DATA LOADING
   ============================================================ */

async function loadDocs() {
    state.docs = await api("/api/documents");
    return state.docs;
}


async function loadConversations() {
    state.conversations =
        await api("/api/conversations");

    return state.conversations;
}


async function stats() {

    const documents = await loadDocs();

    const conversations =
        await loadConversations();

    let chunks = 0;

    try {
        const result =
            await api("/api/stats");

        chunks = result.chunks || 0;

    } catch (_) {
        chunks = documents.reduce(
            (total, document) =>
                total +
                Number(document.chunk_count || 0),
            0
        );
    }

    return {
        documents: documents.length,

        chunks,

        questions: conversations.reduce(
            (total, conversation) =>
                total +
                Number(
                    conversation.message_count || 0
                ),
            0
        ),

        conversations:
            conversations.length
    };
}


/* ============================================================
   CHAT VIEW
   ============================================================ */

function chatView() {

    return `
        <div class="chat-layout">

            <aside class="chat-history">

                <div class="panel-title">
                    <span>CONVERSATIONS</span>

                    <button
                        class="mini-add"
                        id="sideNew"
                        aria-label="New chat"
                    >
                        ＋
                    </button>
                </div>

                <div
                    id="conversationList"
                    class="conversation-list"
                ></div>

            </aside>


            <section class="chat-main">

                <div
                    id="messages"
                    class="messages"
                >

                    <div
                        id="emptyState"
                        class="welcome"
                    >

                        <div class="welcome-visual">
                            <div class="welcome-core">
                                R
                            </div>

                            <div class="orbit"></div>
                        </div>


                        <div class="eyebrow">
                            RAGORA ·
                            RETRIEVAL-AUGMENTED AI
                        </div>


                        <h1>
                            Ask your knowledge.<br>
                            <span>
                                Get answers with evidence.
                            </span>
                        </h1>


                        <p>
                            Upload your documents,
                            ask naturally, and let
                            RAGORA retrieve the strongest
                            evidence before generating
                            a cited answer.
                        </p>


                        <div class="quick-grid">

                            <button
                                class="topic-card"
                                data-prompt="Summarize the uploaded document in clear bullet points."
                            >
                                <span class="topic-icon">✦</span>
                                <b>Summarize documents</b>
                                <small>
                                    Get the essential
                                    points quickly.
                                </small>
                                <span class="topic-arrow">↗</span>
                            </button>


                            <button
                                class="topic-card"
                                data-prompt="What is the main objective and purpose of this project?"
                            >
                                <span class="topic-icon">⌕</span>
                                <b>Explore knowledge</b>
                                <small>
                                    Find answers across
                                    your files.
                                </small>
                                <span class="topic-arrow">↗</span>
                            </button>


                            <button
                                class="topic-card"
                                data-prompt="Explain the main concepts in this document in simple terms."
                            >
                                <span class="topic-icon">◈</span>
                                <b>Understand concepts</b>
                                <small>
                                    Turn technical content
                                    into simple language.
                                </small>
                                <span class="topic-arrow">↗</span>
                            </button>


                            <button
                                class="topic-card"
                                data-prompt="What are the key findings, insights, and important facts?"
                            >
                                <span class="topic-icon">⌁</span>
                                <b>Analyze information</b>
                                <small>
                                    Extract useful insights
                                    and findings.
                                </small>
                                <span class="topic-arrow">↗</span>
                            </button>

                        </div>


                        <div class="welcome-note">
                            <span>●</span>
                            Answers are grounded in your
                            indexed knowledge base
                        </div>

                    </div>

                </div>


                <div class="composer-area">

                    <div class="composer-shell">

                        <form
                            id="chatForm"
                            class="composer"
                        >

                            <button
                                type="button"
                                id="uploadBtn"
                                class="attach-btn"
                                title="Upload documents"
                                aria-label="Upload documents"
                            >
                                ＋
                            </button>


                            <textarea
                                id="chatInput"
                                rows="1"
                                placeholder="Ask RAGORA anything…"
                            ></textarea>


                            <button
                                class="send-btn"
                                id="sendBtn"
                                aria-label="Send"
                            >
                                ↑
                            </button>

                        </form>


                        <div class="composer-meta">
                            <span>
                                Enter to send ·
                                Shift + Enter for new line
                            </span>

                            <span id="knowledgeHint">
                                Knowledge base ready
                            </span>
                        </div>

                    </div>

                </div>

            </section>

        </div>
    `;
}


/* ============================================================
   CHAT RENDER
   ============================================================ */

async function renderChat() {

    el("appView").innerHTML =
        chatView();

    await loadConversations();

    renderConversationList();

    bindChat();
}


function renderConversationList() {

    const box =
        el("conversationList");

    if (!box) return;


    if (!state.conversations.length) {

        box.innerHTML =
            empty(
                "No conversations",
                "Start a new grounded chat."
            );

        return;
    }


    box.innerHTML =
        state.conversations
            .map(
                (conversation) => `
                    <button
                        class="conv-item ${
                            conversation.id ===
                            state.currentConversationId
                                ? "active"
                                : ""
                        }"
                        data-id="${conversation.id}"
                    >

                        <span>
                            ${esc(
                                conversation.title ||
                                "New Chat"
                            )}
                        </span>

                        <small>
                            ${esc(
                                conversation.created_at ||
                                ""
                            )}
                        </small>

                    </button>
                `
            )
            .join("");


    box
        .querySelectorAll("[data-id]")
        .forEach((button) => {

            button.onclick = () =>
                openConversation(
                    Number(button.dataset.id)
                );

        });
}


/* ============================================================
   CREATE / OPEN CHAT
   ============================================================ */

async function createNewChat() {

    try {

        const data =
            await api(
                "/api/conversations",
                {
                    method: "POST"
                }
            );

        state.currentConversationId =
            data.id;

        await renderChat();

        el("chatInput")?.focus();

    } catch (error) {

        toast(
            error.message,
            "error"
        );
    }
}


async function openConversation(id) {

    try {

        state.currentConversationId =
            id;

        const messages =
            await api(
                `/api/conversations/${id}/messages`
            );


        el("emptyState")?.remove();


        const messagesBox =
            el("messages");

        if (!messagesBox) return;


        messagesBox.innerHTML = "";


        messages.forEach((message) => {

            renderMessage(
                message.role,
                message.content,
                Boolean(message.used_web),
                [],
                {},
                []
            );

        });


        renderConversationList();

    } catch (error) {

        toast(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   MARKDOWN / LATEX
   ============================================================ */

function latexToReadable(text) {

    return text
        .replace(
            /\\text\{([^}]*)\}/g,
            "$1"
        )
        .replace(
            /\\left/g,
            ""
        )
        .replace(
            /\\right/g,
            ""
        )
        .replace(
            /\\sum_\{?([^}\s]+)\}?/g,
            "Σ<sub>$1</sub>"
        )
        .replace(
            /\\phi/g,
            "φ"
        )
        .replace(
            /\\sigma/g,
            "σ"
        )
        .replace(
            /\\alpha/g,
            "α"
        )
        .replace(
            /\\beta/g,
            "β"
        )
        .replace(
            /\\lambda/g,
            "λ"
        )
        .replace(
            /\\mu/g,
            "μ"
        )
        .replace(
            /\\sqrt\{([^}]*)\}/g,
            "√($1)"
        )
        .replace(
            /\\exp/g,
            "exp"
        )
        .replace(
            /\\times/g,
            "×"
        )
        .replace(
            /\\cdot/g,
            "·"
        )
        .replace(
            /\\leq/g,
            "≤"
        )
        .replace(
            /\\geq/g,
            "≥"
        )
        .replace(
            /\\in/g,
            "∈"
        )
        .replace(
            /\\to/g,
            "→"
        )
        .replace(
            /\\approx/g,
            "≈"
        )
        .replace(
            /\^\{([^}]*)\}/g,
            "<sup>$1</sup>"
        )
        .replace(
            /_\{([^}]*)\}/g,
            "<sub>$1</sub>"
        )
        .replace(
            /\^([A-Za-z0-9]+)/g,
            "<sup>$1</sup>"
        )
        .replace(
            /_([A-Za-z0-9]+)/g,
            "<sub>$1</sub>"
        );
}


function renderMarkdown(text) {

    let output =
        esc(text);


    output =
        output.replace(
            /```([\s\S]*?)```/g,
            "<pre><code>$1</code></pre>"
        );


    output =
        latexToReadable(
            output
        );


    output =
        output
            .replace(
                /\\\((.*?)\\\)/g,
                '<span class="math">$1</span>'
            )
            .replace(
                /\\\[([\s\S]*?)\\\]/g,
                '<div class="math-block">$1</div>'
            )
            .replace(
                /^### (.*)$/gm,
                "<h4>$1</h4>"
            )
            .replace(
                /^## (.*)$/gm,
                "<h3>$1</h3>"
            )
            .replace(
                /^# (.*)$/gm,
                "<h2>$1</h2>"
            )
            .replace(
                /^(\d+)\. (.*)$/gm,
                '<div class="answer-step"><b>$1.</b> $2</div>'
            )
            .replace(
                /^- (.*)$/gm,
                '<div class="answer-bullet">• $1</div>'
            )
            .replace(
                /\*\*(.*?)\*\*/g,
                "<strong>$1</strong>"
            )
            .replace(
                /`([^`]+)`/g,
                "<code>$1</code>"
            );


    return output.replace(
        /\n/g,
        "<br>"
    );
}


/* ============================================================
   MESSAGE RENDERING
   ============================================================ */

function renderMessage(
    role,
    content,
    usedWeb = false,
    sources = [],
    meta = {},
    citations = []
) {

    const row =
        document.createElement("div");

    row.className =
        `msg-row ${role}`;


    if (role === "assistant") {

        row.innerHTML =
            '<div class="assistant-avatar">R</div>';
    }


    const wrap =
        document.createElement("div");

    wrap.className =
        "message-wrap";


    const bubble =
        document.createElement("div");

    bubble.className =
        "bubble";


    bubble.innerHTML =
        role === "assistant"
            ? renderMarkdown(content)
            : esc(content);


    wrap.appendChild(
        bubble
    );


    if (role === "assistant") {

        const metaRow =
            document.createElement("div");

        metaRow.className =
            "msg-meta";


        metaRow.innerHTML = `
            ${
                usedWeb
                    ? '<span class="web-tag">Web researched</span>'
                    : ""
            }

            ${
                meta.match_percent
                    ? `<span class="match-tag">
                        Retrieval ${meta.match_percent}%
                       </span>`
                    : ""
            }

            ${
                meta.elapsed_ms
                    ? `<span class="time-tag">
                        ${(meta.elapsed_ms / 1000).toFixed(1)}s
                       </span>`
                    : ""
            }

            <button class="copy-btn">
                Copy
            </button>
        `;


        const copyButton =
            metaRow.querySelector(
                ".copy-btn"
            );


        if (copyButton) {

            copyButton.onclick = async () => {

                try {

                    await navigator.clipboard.writeText(
                        content
                    );

                    toast(
                        "Answer copied"
                    );

                } catch (_) {

                    toast(
                        "Copy failed",
                        "error"
                    );
                }
            };
        }


        wrap.appendChild(
            metaRow
        );


        if (citations?.length) {

            const box =
                document.createElement("div");

            box.className =
                "citations";


            box.innerHTML =
                '<div class="citation-title">Sources</div>';


            citations.forEach((citation) => {

                const card =
                    document.createElement("button");

                card.className =
                    "source-card";


                card.innerHTML = `
                    <span class="source-num">
                        ${citation.index ?? ""}
                    </span>

                    <span class="file-badge">
                        ${iconFile(
                            citation.filename
                        )}
                    </span>

                    <span class="source-info">

                        <b>
                            ${esc(
                                citation.filename
                            )}
                        </b>

                        <small>
                            ${
                                citation.page
                                    ? `Page ${citation.page} · `
                                    : ""
                            }

                            Chunk #
                            ${
                                citation.chunk_index ??
                                "—"
                            }

                            ·

                            ${
                                citation.confidence ??
                                0
                            }% match
                        </small>

                        <em>
                            ${esc(
                                citation.snippet || ""
                            )}
                        </em>

                    </span>

                    <span>›</span>
                `;


                card.onclick = () =>
                    openSource(
                        citation
                    );


                box.appendChild(
                    card
                );
            });


            wrap.appendChild(
                box
            );
        }
    }


    row.appendChild(
        wrap
    );


    const messages =
        el("messages");


    if (!messages) return;


    messages.appendChild(
        row
    );


    requestAnimationFrame(() => {

        messages.scrollTop =
            messages.scrollHeight;

    });
}


/* ============================================================
   SOURCE MODAL
   ============================================================ */

function openSource(citation) {

    const modal =
        document.createElement("div");

    modal.className =
        "modal-backdrop";


    modal.innerHTML = `
        <div class="modal source-modal">

            <button
                class="modal-close"
                aria-label="Close"
            >
                ×
            </button>

            <div class="eyebrow">
                SOURCE VIEWER
            </div>

            <h2>
                ${esc(
                    citation.filename ||
                    "Source"
                )}
            </h2>

            <div class="source-meta">

                <span>
                    Page ${citation.page ?? "—"}
                </span>

                <span>
                    Chunk #${
                        citation.chunk_index ??
                        "—"
                    }
                </span>

                <span>
                    ${
                        citation.confidence ??
                        100
                    }% retrieval confidence
                </span>

            </div>

            <div class="highlight">
                ${esc(
                    citation.text ||
                    citation.chunk_text ||
                    citation.snippet ||
                    ""
                )}
            </div>

            <button
                class="btn secondary modal-close-btn"
            >
                Close
            </button>

        </div>
    `;


    document.body.appendChild(
        modal
    );


    modal
        .querySelectorAll(
            ".modal-close, .modal-close-btn"
        )
        .forEach((button) => {

            button.onclick = () =>
                modal.remove();

        });


    modal.onclick = (event) => {

        if (
            event.target === modal
        ) {
            modal.remove();
        }

    };
}


/* ============================================================
   CHAT BINDINGS
   ============================================================ */

function bindChat() {

    const sideNew =
        el("sideNew");


    if (sideNew) {
        sideNew.onclick =
            createNewChat;
    }


    document
        .querySelectorAll("[data-prompt]")
        .forEach((button) => {

            button.onclick = () => {

                const input =
                    el("chatInput");

                if (!input) return;


                input.value =
                    button.dataset.prompt;

                input.focus();

                input.dispatchEvent(
                    new Event("input")
                );


                document
                    .querySelector(".composer")
                    ?.classList.add(
                        "composer-pulse"
                    );


                setTimeout(() => {

                    document
                        .querySelector(".composer")
                        ?.classList.remove(
                            "composer-pulse"
                        );

                }, 700);
            };

        });


    const input =
        el("chatInput");


    if (input) {

        input.oninput = () => {

            input.style.height =
                "auto";

            input.style.height =
                `${Math.min(
                    input.scrollHeight,
                    180
                )}px`;
        };


        input.onkeydown = (event) => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                el("chatForm")
                    ?.requestSubmit();
            }
        };
    }


    const uploadButton =
        el("uploadBtn");


    if (uploadButton) {

        uploadButton.onclick = () =>
            renderView("documents");
    }


    const form =
        el("chatForm");


    if (form) {
        form.onsubmit =
            sendChat;
    }


    const hint =
        el("knowledgeHint");


    if (hint) {

        hint.textContent =
            state.docs.length
                ? `${state.docs.length} documents indexed`
                : "No documents yet";
    }
}


/* ============================================================
   SEND CHAT
   ============================================================ */

async function sendChat(event) {

    event.preventDefault();


    const input =
        el("chatInput");


    if (!input) return;


    const text =
        input.value.trim();


    if (!text) return;


    if (!state.currentConversationId) {

        await createNewChat();
    }


    el("emptyState")?.remove();


    renderMessage(
        "user",
        text
    );


    input.value = "";

    input.style.height =
        "auto";


    const typing =
        document.createElement("div");


    typing.className =
        "msg-row assistant";

    typing.id =
        "typing";


    typing.innerHTML = `
        <div class="assistant-avatar">
            R
        </div>

        <div class="typing-label">
            Searching knowledge base
            <span>···</span>
        </div>
    `;


    el("messages")
        ?.appendChild(typing);


    try {

        const data =
            await api(
                "/api/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        conversation_id:
                            state.currentConversationId,

                        message:
                            text
                    })
                }
            );


        el("typing")?.remove();


        renderMessage(
            "assistant",
            data.answer,
            Boolean(data.used_web),
            data.sources || [],
            data,
            data.citations || []
        );


        state.lastRetrieval =
            data.retrieval ||
            null;


        await loadConversations();

        renderConversationList();


    } catch (error) {

        el("typing")?.remove();


        renderMessage(
            "assistant",
            `I could not complete that request.\n\n${error.message}`
        );


        toast(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   DASHBOARD
   ============================================================ */

async function dashboardView() {

    const data =
        await stats();


    return `
        ${layout(
            "Your knowledge, intelligently searchable.",
            "A compact command center for your document-grounded AI workspace.",
            '<button class="btn primary" data-go="chat">Ask a question</button>'
        )}

        <div class="metrics">

            ${metric(
                "Documents",
                data.documents,
                "Indexed files",
                "▤"
            )}

            ${metric(
                "Chunks",
                data.chunks,
                "Retrieval units",
                "◈"
            )}

            ${metric(
                "Questions",
                data.questions,
                "Conversation messages",
                "?"
            )}

            ${metric(
                "Knowledge Bases",
                "1",
                "Personal workspace",
                "▣"
            )}

        </div>


        <div class="dashboard-grid">

            <div class="panel">

                <div class="panel-title">

                    <span>
                        RECENT DOCUMENTS
                    </span>

                    <button
                        class="link-btn"
                        data-go="documents"
                    >
                        View all →
                    </button>

                </div>


                ${
                    data.documents
                        ? state.docs
                            .slice(0, 5)
                            .map(
                                (document) => `
                                    <div class="list-row">

                                        <span class="file-badge">
                                            ${iconFile(
                                                document.filename
                                            )}
                                        </span>

                                        <div>
                                            <b>
                                                ${esc(
                                                    document.filename
                                                )}
                                            </b>

                                            <small>
                                                ${
                                                    document.chunk_count ||
                                                    "Indexed"
                                                }
                                                chunks · Ready
                                            </small>
                                        </div>

                                        <span class="status ready">
                                            Ready
                                        </span>

                                    </div>
                                `
                            )
                            .join("")
                        : empty(
                            "No documents yet",
                            "Build your knowledge base from the Documents page.",
                            '<button class="btn secondary" data-go="documents">Upload document</button>'
                        )
                }

            </div>


            <div class="panel">

                <div class="panel-title">
                    <span>RAG PIPELINE</span>
                    <span class="badge">LIVE</span>
                </div>


                <div class="pipeline-mini">

                    ${
                        [
                            "Document",
                            "Extract",
                            "Chunk",
                            "Vector score",
                            "Top-K",
                            "LLM",
                            "Citations"
                        ]
                            .map(
                                (name, index) => `
                                    <div>
                                        <span>
                                            ${index + 1}
                                        </span>

                                        <b>
                                            ${name}
                                        </b>
                                    </div>
                                `
                            )
                            .join("")
                    }

                </div>


                <p class="panel-note">
                    RAGORA combines TF-IDF similarity,
                    BM25 and keyword signals, then
                    reranks the strongest evidence
                    before generation.
                </p>

            </div>

        </div>
    `;
}


/* ============================================================
   KNOWLEDGE BASE
   ============================================================ */

async function knowledgeView() {

    await loadDocs();


    return `
        ${layout(
            "Knowledge Bases",
            "Organize documents into a searchable AI knowledge layer.",
            '<button class="btn primary" id="kbUpload">＋ Upload document</button>'
        )}


        <div class="searchbar">

            <input
                id="docSearch"
                placeholder="Search knowledge…"
            >

            <span>
                ${state.docs.length}
                documents
            </span>

        </div>


        <div class="kb-card">

            <div class="kb-icon">
                R
            </div>

            <div class="kb-copy">

                <h3>
                    Personal Knowledge Base
                </h3>

                <p>
                    All uploaded documents available
                    to your RAG retrieval pipeline.
                </p>

                <div class="chips">

                    <span>
                        ${state.docs.length}
                        documents
                    </span>

                    <span>
                        ${
                            state.docs.reduce(
                                (total, document) =>
                                    total +
                                    Number(
                                        document.chunk_count ||
                                        0
                                    ),
                                0
                            )
                        }
                        chunks
                    </span>

                    <span>
                        Hybrid retrieval
                    </span>

                </div>

            </div>

            <button
                class="btn secondary"
                data-go="documents"
            >
                Open
            </button>

        </div>


        <div
            id="kbDocs"
            class="doc-grid"
        >

            ${
                state.docs
                    .map(docCard)
                    .join("")
                    ||
                    empty(
                        "No documents yet",
                        "Upload PDFs, DOCX, TXT and supported files to start.",
                        '<button class="btn primary" id="kbUpload2">Upload document</button>'
                    )
            }

        </div>
    `;
}


function docCard(document) {

    return `
        <article class="doc-card">

            <div class="doc-card-top">

                <span class="file-badge large">
                    ${iconFile(
                        document.filename
                    )}
                </span>

                <span class="status ready">
                    Ready
                </span>

            </div>


            <h3
                title="${attr(
                    document.filename
                )}"
            >
                ${esc(
                    document.filename
                )}
            </h3>


            <p>
                ${
                    document.chunk_count ??
                    "—"
                }
                chunks ·
                ${esc(
                    document.created_at ||
                    ""
                )}
            </p>


            <div class="doc-actions">

                <button
                    class="btn ghost"
                    data-chunks="${document.id}"
                >
                    Chunks
                </button>

                <button
                    class="btn danger"
                    data-delete="${document.id}"
                >
                    Delete
                </button>

            </div>

        </article>
    `;
}


/* ============================================================
   DOCUMENTS
   ============================================================ */

async function documentsView() {

    await loadDocs();


    return `
        ${layout(
            "Documents",
            "Upload, inspect and manage the files powering RAGORA.",
            '<button class="btn primary" id="docUpload">＋ Upload document</button>'
        )}


        <div class="upload-strip">

            <div>

                <b>
                    Build your knowledge base
                </b>

                <span>
                    PDF · DOCX · TXT · CSV ·
                    XLSX · source code
                </span>

            </div>


            <button
                class="btn secondary"
                id="docUpload2"
            >
                Choose file
            </button>

        </div>


        <div class="table-wrap">

            <table>

                <thead>

                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Chunks</th>
                        <th>Status</th>
                        <th>Updated</th>
                        <th></th>
                    </tr>

                </thead>


                <tbody>

                    ${
                        state.docs
                            .map(
                                (document) => `
                                    <tr>

                                        <td>
                                            <span class="file-badge">
                                                ${iconFile(
                                                    document.filename
                                                )}
                                            </span>

                                            <b>
                                                ${esc(
                                                    document.filename
                                                )}
                                            </b>
                                        </td>

                                        <td>
                                            ${iconFile(
                                                document.filename
                                            )}
                                        </td>

                                        <td>
                                            ${
                                                document.chunk_count ??
                                                "—"
                                            }
                                        </td>

                                        <td>
                                            <span class="status ready">
                                                Ready
                                            </span>
                                        </td>

                                        <td>
                                            ${esc(
                                                document.created_at ||
                                                ""
                                            )}
                                        </td>

                                        <td>

                                            <button
                                                class="btn ghost"
                                                data-chunks="${document.id}"
                                            >
                                                View chunks
                                            </button>

                                            <button
                                                class="btn danger"
                                                data-delete="${document.id}"
                                            >
                                                Delete
                                            </button>

                                        </td>

                                    </tr>
                                `
                            )
                            .join("")
                        ||
                        `
                            <tr>
                                <td colspan="6">
                                    ${empty(
                                        "No documents yet",
                                        "Upload your first knowledge source."
                                    )}
                                </td>
                            </tr>
                        `
                    }

                </tbody>

            </table>

        </div>
    `;
}


/* ============================================================
   CHUNK EXPLORER
   ============================================================ */

async function chunksView() {

    const documents =
        await loadDocs();


    const selected =
        state.selectedDocId ||
        documents[0]?.id;


    state.selectedDocId =
        selected;


    let chunks = [];


    if (selected) {

        chunks =
            await api(
                `/api/documents/${selected}/chunks`
            );
    }


    return `
        ${layout(
            "Chunk Explorer",
            "Inspect the retrieval units created from your source documents.",
            '<button class="btn secondary" id="refreshChunks">Refresh</button>'
        )}


        <div class="toolbar">

            <select id="chunkDoc">

                ${
                    documents
                        .map(
                            (document) => `
                                <option
                                    value="${document.id}"
                                    ${
                                        Number(
                                            document.id
                                        ) ===
                                        Number(
                                            selected
                                        )
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    ${esc(
                                        document.filename
                                    )}
                                </option>
                            `
                        )
                        .join("")
                }

            </select>


            <input
                id="chunkSearch"
                placeholder="Search chunk text…"
            >


            <span id="chunkCount">
                ${chunks.length} chunks
            </span>

        </div>


        <div
            id="chunkGrid"
            class="chunk-grid"
        >

            ${
                chunks
                    .map(chunkCard)
                    .join("")
                    ||
                    empty(
                        "No chunks available",
                        "Chunks appear after document processing."
                    )
            }

        </div>
    `;
}


function chunkCard(chunk) {

    const key =
        `chunk-${
            chunk.id ??
            `${chunk.filename}-${chunk.chunk_index}`
        }`;


    state.chunkCache[key] = {

        filename:
            chunk.filename ||
            "Chunk",

        page:
            chunk.page ??
            null,

        chunk_index:
            chunk.chunk_index ??
            "",

        confidence:
            100,

        text:
            chunk.chunk_text ||
            ""
    };


    return `
        <article
            class="chunk-card"
            data-chunk-search="${attr(
                chunk.chunk_text ||
                ""
            )}"
        >

            <div class="chunk-head">

                <b>
                    Chunk #${chunk.chunk_index}
                </b>

                <span>
                    Page ${chunk.page ?? "—"}
                </span>

                <span>
                    ${
                        chunk.tokens ??
                        Math.ceil(
                            (
                                chunk.chunk_text ||
                                ""
                            ).length / 4
                        )
                    }
                    tokens
                </span>

            </div>


            <h4>
                ${esc(
                    chunk.filename
                )}
            </h4>


            <p>
                ${esc(
                    chunk.chunk_text
                )}
            </p>


            <div class="chunk-foot">

                <span class="status ready">
                    Indexed
                </span>


                <button
                    type="button"
                    class="btn ghost chunk-view-btn"
                    data-chunk-id="${attr(key)}"
                >
                    View full chunk
                </button>

            </div>

        </article>
    `;
}


async function bindChunks() {

    const select =
        el("chunkDoc");


    if (!select) return;


    const load =
        async () => {

            try {

                state.selectedDocId =
                    Number(
                        select.value
                    );


                const chunks =
                    await api(
                        `/api/documents/${select.value}/chunks`
                    );


                state.chunkCache = {};


                const grid =
                    el("chunkGrid");


                if (!grid) return;


                grid.innerHTML =
                    chunks
                        .map(chunkCard)
                        .join("")
                        ||
                        empty(
                            "No chunks",
                            "This document has no indexed chunks."
                        );


                const count =
                    el("chunkCount");


                if (count) {

                    count.textContent =
                        `${chunks.length} chunks`;
                }


                bindChunkCards();


            } catch (error) {

                toast(
                    error.message,
                    "error"
                );
            }
        };


    const bindChunkCards =
        () => {

            document
                .querySelectorAll(
                    ".chunk-view-btn"
                )
                .forEach((button) => {

                    button.onclick = () => {

                        const chunk =
                            state.chunkCache?.[
                                button.dataset.chunkId
                            ];


                        if (!chunk) {

                            toast(
                                "Chunk content unavailable. Refresh and try again.",
                                "error"
                            );

                            return;
                        }


                        openSource(
                            chunk
                        );
                    };

                });
        };


    select.onchange =
        load;


    const search =
        el("chunkSearch");


    if (search) {

        search.oninput = () => {

            const query =
                search.value
                    .toLowerCase()
                    .trim();


            document
                .querySelectorAll(
                    ".chunk-card"
                )
                .forEach((card) => {

                    card.style.display =
                        card.innerText
                            .toLowerCase()
                            .includes(query)
                            ? ""
                            : "none";

                });
        };
    }


    el("refreshChunks")
        ?.addEventListener(
            "click",
            load
        );


    bindChunkCards();
}


/* ============================================================
   RETRIEVAL EXPLORER
   ============================================================ */

function retrievalView() {

    return `
        ${layout(
            "Retrieval Explorer",
            "Test RAG retrieval and inspect the evidence selected for a query."
        )}


        <div class="panel retrieval-panel">

            <div class="panel-title">

                <div>
                    <span>RETRIEVAL TEST</span>

                    <p class="panel-note">
                        Enter a question to see the
                        strongest matching knowledge chunks.
                    </p>
                </div>

                <span class="badge">
                    HYBRID RAG
                </span>

            </div>


            <div class="retrieval-controls">

                <input
                    id="retrievalQuestion"
                    type="text"
                    placeholder="Ask a question about your documents…"
                    autocomplete="off"
                >


                <select id="retrievalK">

                    <option value="3">
                        Top 3
                    </option>

                    <option value="5" selected>
                        Top 5
                    </option>

                    <option value="8">
                        Top 8
                    </option>

                </select>


                <button
                    id="runRetrievalBtn"
                    class="btn primary"
                    type="button"
                >
                    Run Retrieval
                </button>

            </div>


            <div
                id="retrievalStatus"
                class="retrieval-status"
            >
                Ready to search your indexed knowledge.
            </div>

        </div>


        <div
            id="retrievalResult"
            class="retrieval-results"
        >

            ${empty(
                "No retrieval run yet",
                "Enter a question above and RAGORA will show the strongest matching chunks."
            )}

        </div>
    `;
}


/* ============================================================
   RETRIEVAL RESULT RENDERER
   ============================================================ */

function retrievalResult(data) {

    const results =
        Array.isArray(data?.results)
            ? data.results
            : [];


    if (!results.length) {

        return `
            ${empty(
                "No relevant evidence found",
                "Try a different question or upload a document containing the required information."
            )}
        `;
    }


    const average =
        Math.round(
            results.reduce(
                (total, result) =>
                    total +
                    Number(
                        result.score || 0
                    ),
                0
            ) / results.length
        );


    return `
        <div class="panel retrieval-summary">

            <div class="panel-title">

                <span>
                    RETRIEVAL RESULTS
                </span>

                <span class="badge">
                    ${results.length}
                    SOURCES
                </span>

            </div>


            <div class="retrieval-summary-grid">

                <div>
                    <small>
                        Query
                    </small>

                    <strong>
                        ${esc(
                            data.question ||
                            ""
                        )}
                    </strong>
                </div>


                <div>
                    <small>
                        Evidence
                    </small>

                    <strong>
                        ${results.length}
                        chunks
                    </strong>
                </div>


                <div>
                    <small>
                        Avg. match
                    </small>

                    <strong>
                        ${average}%
                    </strong>
                </div>

            </div>

        </div>


        <div class="retrieval-result-list">

            ${
                results
                    .map(
                        (result, index) => {

                            const score =
                                Math.max(
                                    0,
                                    Math.min(
                                        100,
                                        Number(
                                            result.score ||
                                            0
                                        )
                                    )
                                );


                            return `
                                <article
                                    class="retrieval-card"
                                >

                                    <div
                                        class="retrieval-rank"
                                    >
                                        #${index + 1}
                                    </div>


                                    <div
                                        class="retrieval-content"
                                    >

                                        <div
                                            class="retrieval-card-head"
                                        >

                                            <div>

                                                <span
                                                    class="file-badge"
                                                >
                                                    ${iconFile(
                                                        result.filename
                                                    )}
                                                </span>

                                                <b>
                                                    ${esc(
                                                        result.filename ||
                                                        "Unknown document"
                                                    )}
                                                </b>

                                            </div>


                                            <span
                                                class="match-tag"
                                            >
                                                ${score}%
                                                match
                                            </span>

                                        </div>


                                        <div
                                            class="retrieval-meta"
                                        >

                                            ${
                                                result.page
                                                    ? `
                                                        <span>
                                                            Page
                                                            ${result.page}
                                                        </span>
                                                      `
                                                    : ""
                                            }


                                            ${
                                                result.chunk_index !==
                                                undefined
                                                    ? `
                                                        <span>
                                                            Chunk #
                                                            ${result.chunk_index}
                                                        </span>
                                                      `
                                                    : ""
                                            }


                                            <span>
                                                Evidence
                                                ${index + 1}
                                            </span>

                                        </div>


                                        <p>
                                            ${esc(
                                                result.snippet ||
                                                "No preview available."
                                            )}
                                        </p>


                                        <div
                                            class="retrieval-score"
                                        >
                                            <span
                                                style="width:${score}%"
                                            ></span>
                                        </div>

                                    </div>

                                </article>
                            `;
                        }
                    )
                    .join("")
            }

        </div>
    `;
}


/* ============================================================
   RUN RETRIEVAL
   ============================================================ */

async function runRetrieval() {

    const questionInput =
        el("retrievalQuestion");


    const topKInput =
        el("retrievalK");


    const resultBox =
        el("retrievalResult");


    const status =
        el("retrievalStatus");


    if (!questionInput) {

        toast(
            "Retrieval question box not found.",
            "error"
        );

        return;
    }


    const question =
        questionInput.value.trim();


    if (!question) {

        toast(
            "Please enter a question.",
            "error"
        );

        questionInput.focus();

        return;
    }


    const topK =
        Number(
            topKInput?.value || 5
        );


    const button =
        el("runRetrievalBtn");


    const originalText =
        button?.textContent ||
        "Run Retrieval";


    if (button) {

        button.disabled = true;

        button.textContent =
            "Searching…";
    }


    if (status) {

        status.textContent =
            "Searching your indexed knowledge base…";
    }


    if (resultBox) {

        resultBox.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    ◌
                </div>

                <h3>
                    Retrieving evidence…
                </h3>

                <p>
                    RAGORA is ranking the strongest
                    matching chunks.
                </p>
            </div>
        `;
    }


    try {

        const data =
            await api(
                "/api/retrieval",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        question,
                        top_k: topK
                    })
                }
            );


        state.lastRetrieval =
            data;


        if (resultBox) {

            resultBox.innerHTML =
                retrievalResult(data);
        }


        if (status) {

            status.textContent =
                data.results?.length
                    ? `Found ${data.results.length} relevant evidence chunks.`
                    : "No relevant evidence found.";
        }


    } catch (error) {

        console.error(
            "Retrieval failed:",
            error
        );


        if (resultBox) {

            resultBox.innerHTML =
                empty(
                    "Retrieval failed",
                    error.message ||
                    "Unable to complete retrieval."
                );
        }


        if (status) {

            status.textContent =
                "Retrieval request failed.";
        }


        toast(
            error.message ||
            "Retrieval failed",
            "error"
        );


    } finally {

        if (button) {

            button.disabled =
                false;

            button.textContent =
                originalText;
        }
    }
}


/* ============================================================
   DOCUMENT UPLOAD
   ============================================================ */

function openFilePicker() {

    const input =
        el("fileInput");


    if (input) {
        input.click();
    }
}


async function uploadSelectedFiles(files) {

    if (!files?.length) return;


    for (const file of files) {

        const formData =
            new FormData();


        formData.append(
            "file",
            file
        );


        try {

            toast(
                `Uploading ${file.name}…`
            );


            await api(
                "/api/documents/upload",
                {
                    method: "POST",
                    body: formData
                }
            );


            toast(
                `${file.name} uploaded successfully.`
            );


        } catch (error) {

            toast(
                `${file.name}: ${error.message}`,
                "error"
            );
        }
    }


    await loadDocs();

    if (state.view === "documents") {
        await renderView("documents");
    }
}


/* ============================================================
   VIEW BINDINGS
   ============================================================ */

function bindViewActions() {

    /* Navigation shortcuts */

    document
        .querySelectorAll("[data-go]")
        .forEach((button) => {

            button.onclick = () =>
                renderView(
                    button.dataset.go
                );

        });


    /* Upload buttons */

    [
        "docUpload",
        "docUpload2",
        "kbUpload",
        "kbUpload2"
    ].forEach((id) => {

        el(id)?.addEventListener(
            "click",
            openFilePicker
        );

    });


    /* Retrieval */

    const retrievalButton =
        el("runRetrievalBtn");


    if (retrievalButton) {

        retrievalButton.onclick =
            runRetrieval;
    }


    const retrievalQuestion =
        el("retrievalQuestion");


    if (retrievalQuestion) {

        retrievalQuestion.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    runRetrieval();
                }

            }
        );
    }


    /* Chunk buttons */

    document
        .querySelectorAll(
            "[data-chunks]"
        )
        .forEach((button) => {

            button.onclick = () => {

                state.selectedDocId =
                    Number(
                        button.dataset.chunks
                    );

                renderView(
                    "chunks"
                );
            };

        });


    /* Delete document */

    document
        .querySelectorAll(
            "[data-delete]"
        )
        .forEach((button) => {

            button.onclick =
                async () => {

                    const id =
                        Number(
                            button.dataset.delete
                        );


                    if (!id) return;


                    const confirmed =
                        window.confirm(
                            "Delete this document from your knowledge base?"
                        );


                    if (!confirmed) return;


                    try {

                        await api(
                            `/api/documents/${id}`,
                            {
                                method:
                                    "DELETE"
                            }
                        );


                        toast(
                            "Document deleted."
                        );


                        await loadDocs();

                        await renderView(
                            state.view
                        );


                    } catch (error) {

                        toast(
                            error.message,
                            "error"
                        );
                    }
                };

        });


    /* Document search */

    const documentSearch =
        el("docSearch");


    if (documentSearch) {

        documentSearch.oninput =
            () => {

                const query =
                    documentSearch.value
                        .toLowerCase()
                        .trim();


                document
                    .querySelectorAll(
                        ".doc-card"
                    )
                    .forEach((card) => {

                        card.style.display =
                            card.innerText
                                .toLowerCase()
                                .includes(query)
                                ? ""
                                : "none";
                    });
            };
    }
}


/* ============================================================
   FILE INPUT
   ============================================================ */

function bindFileInput() {

    const input =
        el("fileInput");


    if (!input) return;


    input.onchange =
        async () => {

            const files =
                Array.from(
                    input.files || []
                );


            await uploadSelectedFiles(
                files
            );


            input.value = "";
        };
}


/* ============================================================
   MAIN VIEW RENDERER
   ============================================================ */

async function renderView(view) {

    const host =
        el("appView");


    if (!host) return;


    state.view =
        view || "chat";


    /* Update active navigation */

    document
        .querySelectorAll(
            ".nav-item"
        )
        .forEach((button) => {

            button.classList.toggle(
                "active",
                button.dataset.view ===
                state.view
            );

        });


    /* Update breadcrumb */

    const labels = {
        chat: "AI Chat",
        dashboard: "Dashboard",
        knowledge: "Knowledge Bases",
        documents: "Documents",
        chunks: "Chunk Explorer",
        retrieval: "Retrieval Explorer",
        analytics: "Analytics & Evaluation",
        history: "Chat History",
        settings: "Settings"
    };


    const breadcrumb =
        el("pageCrumb");


    if (breadcrumb) {

        breadcrumb.textContent =
            labels[state.view] ||
            "RAGORA";
    }


    /* Loading state */

    host.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">
                ◌
            </div>

            <h3>
                Loading RAGORA…
            </h3>

            <p>
                Preparing your workspace.
            </p>
        </div>
    `;


    try {

        switch (state.view) {

            case "chat":

                await renderChat();

                break;


            case "dashboard":

                host.innerHTML =
                    await dashboardView();

                bindViewActions();

                break;


            case "knowledge":

                host.innerHTML =
                    await knowledgeView();

                bindViewActions();

                break;


            case "documents":

                host.innerHTML =
                    await documentsView();

                bindViewActions();

                break;


            case "chunks":

                host.innerHTML =
                    await chunksView();

                await bindChunks();

                bindViewActions();

                break;


            case "retrieval":

                host.innerHTML =
                    retrievalView();

                bindViewActions();

                break;


            case "analytics":

                host.innerHTML = `
                    ${layout(
                        "Analytics & Evaluation",
                        "Evaluate retrieval quality and monitor your RAG workspace."
                    )}

                    ${empty(
                        "Evaluation workspace",
                        "Use the evaluation module to measure retrieval quality against your dataset."
                    )}
                `;

                bindViewActions();

                break;


            case "history":

                await loadConversations();

                host.innerHTML = `
                    ${layout(
                        "Chat History",
                        "Browse your previous RAGORA conversations."
                    )}

                    <div class="panel">

                        <div class="panel-title">
                            <span>
                                CONVERSATIONS
                            </span>

                            <span class="badge">
                                ${
                                    state.conversations.length
                                }
                            </span>
                        </div>


                        ${
                            state.conversations.length
                                ? state.conversations
                                    .map(
                                        (conversation) => `
                                            <button
                                                class="conv-item"
                                                data-history-id="${conversation.id}"
                                            >
                                                <span>
                                                    ${esc(
                                                        conversation.title ||
                                                        "New Chat"
                                                    )}
                                                </span>

                                                <small>
                                                    ${esc(
                                                        conversation.created_at ||
                                                        ""
                                                    )}
                                                </small>
                                            </button>
                                        `
                                    )
                                    .join("")
                                : empty(
                                    "No chat history",
                                    "Your conversations will appear here."
                                )
                        }

                    </div>
                `;


                document
                    .querySelectorAll(
                        "[data-history-id]"
                    )
                    .forEach((button) => {

                        button.onclick = () => {

                            state.currentConversationId =
                                Number(
                                    button.dataset.historyId
                                );

                            renderView(
                                "chat"
                            );

                            setTimeout(
                                () =>
                                    openConversation(
                                        state.currentConversationId
                                    ),
                                0
                            );
                        };

                    });

                break;


            case "settings":

                host.innerHTML = `
                    ${layout(
                        "Settings",
                        "Manage your RAGORA workspace preferences."
                    )}

                    <div class="panel">

                        <div class="panel-title">
                            <span>
                                WORKSPACE
                            </span>
                        </div>

                        <div class="list-row">
                            <div>
                                <b>
                                    RAG pipeline
                                </b>

                                <small>
                                    Hybrid retrieval enabled
                                </small>
                            </div>

                            <span class="status ready">
                                Ready
                            </span>
                        </div>

                    </div>
                `;

                break;


            default:

                await renderChat();

                break;
        }


    } catch (error) {

        console.error(
            "RAGORA view error:",
            error
        );


        host.innerHTML =
            empty(
                "Unable to load this view",
                error.message ||
                "An unexpected error occurred."
            );


        toast(
            error.message ||
            "Unable to load view",
            "error"
        );
    }


    /* Close mobile sidebar */

    el("sidebar")
        ?.classList.remove(
            "open"
        );

    el("sidebarOverlay")
        ?.classList.remove(
            "show"
        );
}


/* ============================================================
   THEME
   ============================================================ */

function applyTheme(mode) {

    const light =
        mode === "light";


    document.body.classList.toggle(
        "theme-light",
        light
    );


    document.body.classList.toggle(
        "theme-dark",
        !light
    );


    localStorage.setItem(
        "ragora-theme",
        light
            ? "light"
            : "dark"
    );


    const button =
        el("themeToggle");


    if (button) {

        button.textContent =
            light
                ? "☾"
                : "☀";


        button.title =
            light
                ? "Switch to dark mode"
                : "Switch to light mode";


        button.setAttribute(
            "aria-label",
            button.title
        );
    }
}


function theme() {

    applyTheme(
        document.body.classList.contains(
            "theme-light"
        )
            ? "dark"
            : "light"
    );
}


/* ============================================================
   SIDEBAR
   ============================================================ */

function closeSidebar() {

    el("sidebar")
        ?.classList.remove(
            "open"
        );

    el("sidebarOverlay")
        ?.classList.remove(
            "show"
        );
}


function openSidebar() {

    el("sidebar")
        ?.classList.add(
            "open"
        );

    el("sidebarOverlay")
        ?.classList.add(
            "show"
        );
}


/* ============================================================
   GLOBAL INITIALIZATION
   ============================================================ */

function initializeRagora() {

    nav();


    /* Theme */

    el("themeToggle")
        ?.addEventListener(
            "click",
            theme
        );


    /* Brand */

    el("brandHome")
        ?.addEventListener(
            "click",
            () =>
                renderView("chat")
        );


    el("topBrand")
        ?.addEventListener(
            "click",
            () =>
                renderView("chat")
        );


    /* New chat */

    el("newChatBtn")
        ?.addEventListener(
            "click",
            createNewChat
        );


    /* Mobile sidebar */

    el("openSidebar")
        ?.addEventListener(
            "click",
            openSidebar
        );


    el("closeSidebar")
        ?.addEventListener(
            "click",
            closeSidebar
        );


    el("sidebarOverlay")
        ?.addEventListener(
            "click",
            closeSidebar
        );


    /* Keyboard shortcuts */

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                (event.ctrlKey ||
                    event.metaKey) &&
                event.key.toLowerCase() ===
                    "k"
            ) {

                event.preventDefault();

                createNewChat();
            }


            if (
                event.key ===
                "Escape"
            ) {

                closeSidebar();
            }
        }
    );


    /* Close sidebar after navigation */

    document
        .querySelectorAll(
            ".nav-item"
        )
        .forEach((button) => {

            button.addEventListener(
                "click",
                closeSidebar
            );

        });


    /* File input */

    bindFileInput();


    /* Theme restore */

    applyTheme(
        localStorage.getItem(
            "ragora-theme"
        ) || "dark"
    );


    /* Initial view */

    renderView(
        "chat"
    );
}


/* ============================================================
   START
   ============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeRagora
    );

} else {

    initializeRagora();
}