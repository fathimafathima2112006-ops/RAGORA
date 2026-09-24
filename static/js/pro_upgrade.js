
/* RAGORA PRO UI UPGRADE
   - Browser voice playback for assistant answers
   - Language/voice selection using installed browser voices
   - Per-answer thumbs up/down feedback
   - Cleaner account controls
   - Animated voice status
*/
(() => {
  const LANGS = [
    ["en-US","English"],["ta-IN","தமிழ்"],["hi-IN","हिन्दी"],["te-IN","తెలుగు"],
    ["ml-IN","മലയാളം"],["kn-IN","ಕನ್ನಡ"],["bn-IN","বাংলা"],["mr-IN","मराठी"],
    ["gu-IN","ગુજરાતી"],["pa-IN","ਪੰਜਾਬੀ"],["ur-PK","اردو"],["ar-SA","العربية"],
    ["fr-FR","Français"],["de-DE","Deutsch"],["es-ES","Español"],["it-IT","Italiano"],
    ["pt-BR","Português"],["ru-RU","Русский"],["ja-JP","日本語"],["ko-KR","한국어"],
    ["zh-CN","中文"],["id-ID","Bahasa Indonesia"]
  ];

  let voices = [];
  let currentUtterance = null;
  let currentButton = null;

  const getVoices = () => {
    voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    return voices;
  };
  if ("speechSynthesis" in window) {
    getVoices();
    speechSynthesis.onvoiceschanged = getVoices;
  }

  const escapeHtml = s => String(s ?? "").replace(/[&<>'"]/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
  }[c]));

  function addTools() {
    const composer = document.querySelector("#chatForm");
    if (composer && !document.querySelector(".rg-composer-tools")) {
      const tools = document.createElement("div");
      tools.className = "rg-composer-tools";
      tools.innerHTML = `
        <label class="rg-language-wrap" title="Voice language">
          <span>🌐</span>
          <select id="rgVoiceLanguage" aria-label="Voice language">
            ${LANGS.map(([v,n])=>`<option value="${v}">${n}</option>`).join("")}
          </select>
        </label>
        <label class="rg-voice-toggle" title="Automatically read new AI answers">
          <input id="rgAutoVoice" type="checkbox">
          <span>🔊 Auto voice</span>
        </label>
      `;
      composer.parentElement.appendChild(tools);
      const saved = localStorage.getItem("ragora-voice-language") || "en-US";
      document.querySelector("#rgVoiceLanguage").value = saved;
      document.querySelector("#rgVoiceLanguage").onchange = e => {
        localStorage.setItem("ragora-voice-language", e.target.value);
      };
      document.querySelector("#rgAutoVoice").checked = localStorage.getItem("ragora-auto-voice") === "1";
      document.querySelector("#rgAutoVoice").onchange = e => {
        localStorage.setItem("ragora-auto-voice", e.target.checked ? "1" : "0");
      };
    }
  }

  function cleanTextFromBubble(bubble) {
    const clone = bubble.cloneNode(true);
    clone.querySelectorAll("pre,code").forEach(x => x.remove());
    return clone.textContent.replace(/\s+/g," ").trim();
  }

  function chooseVoice(lang) {
    getVoices();
    const exact = voices.find(v => v.lang.toLowerCase() === lang.toLowerCase());
    if (exact) return exact;
    const base = lang.split("-")[0].toLowerCase();
    return voices.find(v => v.lang.toLowerCase().startsWith(base)) || voices[0] || null;
  }

  function showPlayer(lang) {
    let p = document.querySelector(".rg-voice-player");
    if (!p) {
      p = document.createElement("div");
      p.className = "rg-voice-player";
      p.innerHTML = `<div class="rg-wave"><i></i><i></i><i></i><i></i></div><small id="rgVoiceStatus">Reading answer</small><button id="rgStopVoice" type="button">Stop</button>`;
      document.body.appendChild(p);
      p.querySelector("#rgStopVoice").onclick = stopVoice;
    }
    p.querySelector("#rgVoiceStatus").textContent = `Reading · ${lang}`;
    p.classList.add("show");
  }

  function hidePlayer() {
    document.querySelector(".rg-voice-player")?.classList.remove("show");
  }

  function stopVoice() {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    if (currentButton) currentButton.classList.remove("rg-active");
    currentButton = null;
    currentUtterance = null;
    hidePlayer();
  }

  function speak(button, text) {
    if (!("speechSynthesis" in window)) {
      window.RAGORA_showAIStatus?.("Voice playback is not available in this browser.");
      return;
    }
    if (currentButton === button) {
      stopVoice();
      return;
    }
    stopVoice();

    const lang = document.querySelector("#rgVoiceLanguage")?.value || "en-US";
    const voice = chooseVoice(lang);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    if (voice) u.voice = voice;
    u.rate = 1;
    u.pitch = 1;

    currentUtterance = u;
    currentButton = button;
    button.classList.add("rg-active");
    showPlayer(document.querySelector("#rgVoiceLanguage option:checked")?.textContent || lang);

    u.onend = u.onerror = () => {
      if (currentButton === button) {
        button.classList.remove("rg-active");
        currentButton = null;
        currentUtterance = null;
        hidePlayer();
      }
    };
    speechSynthesis.speak(u);
  }

  function feedbackKey(content) {
    return "ragora-feedback-" + btoa(unescape(encodeURIComponent(content))).slice(0,48);
  }

  function addAnswerTools(row) {
    if (!row || row.classList.contains("rg-enhanced")) return;
    if (!row.classList.contains("assistant")) return;
    const bubble = row.querySelector(".bubble");
    if (!bubble) return;

    row.classList.add("rg-enhanced");
    const actions = document.createElement("div");
    actions.className = "rg-answer-actions";

    const content = cleanTextFromBubble(bubble);
    const key = feedbackKey(content);
    const saved = localStorage.getItem(key);

    actions.innerHTML = `
      <button type="button" class="rg-speak" title="Read answer aloud">🔊 Listen</button>
      <button type="button" class="rg-stop" title="Stop voice">■ Stop</button>
      <button type="button" class="rg-feedback-good" title="Helpful answer">👍 Helpful</button>
      <button type="button" class="rg-feedback-bad" title="Needs improvement">👎 Improve</button>
    `;

    const speakBtn = actions.querySelector(".rg-speak");
    const stopBtn = actions.querySelector(".rg-stop");
    speakBtn.onclick = () => speak(speakBtn, content);
    stopBtn.onclick = stopVoice;

    const setFeedback = value => {
      localStorage.setItem(key, value);
      actions.querySelector(".rg-feedback-good").classList.toggle("rg-active", value === "up");
      actions.querySelector(".rg-feedback-bad").classList.toggle("rg-active", value === "down");
      window.RAGORA_showAIStatus?.(value === "up" ? "Thanks — marked helpful." : "Thanks — feedback saved.");
    };
    actions.querySelector(".rg-feedback-good").onclick = () => setFeedback("up");
    actions.querySelector(".rg-feedback-bad").onclick = () => setFeedback("down");

    if (saved) {
      actions.querySelector(saved === "up" ? ".rg-feedback-good" : ".rg-feedback-bad").classList.add("rg-active");
    }

    const meta = row.querySelector(".msg-meta");
    if (meta) meta.after(actions);
    else row.querySelector(".message-wrap")?.appendChild(actions);

    // Auto voice for newly generated answers.
    if (localStorage.getItem("ragora-auto-voice") === "1") {
      setTimeout(() => speak(speakBtn, content), 150);
    }
  }

  function enhanceExisting() {
    addTools();
    document.querySelectorAll(".msg-row.assistant").forEach(addAnswerTools);
  }

  const observer = new MutationObserver(() => {
    addTools();
    document.querySelectorAll(".msg-row.assistant").forEach(addAnswerTools);
  });
  observer.observe(document.body, {childList:true, subtree:true});

  document.addEventListener("DOMContentLoaded", enhanceExisting);
  setTimeout(enhanceExisting, 300);
  setTimeout(enhanceExisting, 1200);
})();
