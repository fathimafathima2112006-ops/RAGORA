const state={currentConversationId:null,view:'chat',docs:[],conversations:[],lastRetrieval:null,activeRequest:null,lastUserPrompt:'',lastMode:'auto'};
const el=id=>document.getElementById(id); const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); const attr=esc;
function toast(m,k='ok'){const t=el('toast');t.textContent=m;t.className=`toast show ${k}`;clearTimeout(toast.t);toast.t=setTimeout(()=>t.className='toast',3200)}
async function api(url,opt={}){
  const r=await fetch(url,{credentials:'same-origin',...opt});
  let d={};
  try{d=await r.json()}catch{}
  if(!r.ok){
    const code=String(d.error||'').toLowerCase();
    const err=new Error(code==='not_found'||code==='notfound'?'not_found':(d.message||d.error||`Request failed (${r.status})`));
    err.code=code; err.status=r.status;
    throw err;
  }
  return d;
}
function setViewport(){document.documentElement.style.setProperty('--vh',(innerHeight*.01)+'px')}setViewport();addEventListener('resize',setViewport);
function iconFile(name){const ext=(name.split('.').pop()||'').toUpperCase();return ext==='PDF'?'PDF':ext||'DOC'}
function nav(){document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>renderView(b.dataset.view));}
function layout(title,subtitle,actions=''){return `<section class="page-head"><div><div class="eyebrow">RAGORA WORKSPACE</div><h1>${title}</h1><p>${subtitle}</p></div><div class="page-actions">${actions}</div></section>`}
function metric(label,value,meta,icon='◫'){return `<div class="metric-card"><span class="metric-icon">${icon}</span><div><small>${label}</small><strong>${value}</strong><em>${meta||''}</em></div></div>`}
function empty(title,text,action=''){return `<div class="empty-state"><div class="empty-icon">⌁</div><h3>${title}</h3><p>${text}</p>${action}</div>`}
async function loadDocs(){state.docs=await api('/api/documents');return state.docs}
async function loadConversations(){state.conversations=await api('/api/conversations');return state.conversations}
async function stats(){const d=await loadDocs();const c=await loadConversations();let chunks=0;try{const s=await api('/api/stats');chunks=s.chunks}catch{}return {documents:d.length,chunks,questions:c.reduce((n,x)=>n+(x.message_count||0),0),conversations:c.length}}
function chatView(){return `<section class="chat-main chat-main-full"><div id="messages" class="messages"><div id="emptyState" class="welcome"><div class="welcome-visual"><div class="welcome-core">R</div><div class="orbit"></div></div><div class="eyebrow">RAGORA AI KNOWLEDGE ENGINE</div><h1>Ask. Explore.<br><span>Understand.</span></h1><p>One workspace for grounded answers, deep research, study help, document analysis and source-level evidence.</p><div class="quick-grid"><button data-prompt="What is the main objective of this project?"><b>Project objective</b><small>Find the core goal</small></button><button data-prompt="Explain the methodology in simple terms."><b>Explain simply</b><small>Plain-language breakdown</small></button><button data-prompt="What are the key findings?"><b>Key findings</b><small>Surface important results</small></button><button data-prompt="Summarize the uploaded document in detail."><b>Deep summary</b><small>Structured overview</small></button><button data-prompt="Create 10 study flashcards from the uploaded documents."><b>Study cards</b><small>Revision-ready cards</small></button><button data-prompt="Create a 10-question quiz from the uploaded documents, with answers at the end."><b>AI quiz</b><small>Test your understanding</small></button></div><div class="ai-capabilities"><span>✦ Grounded RAG</span><span>⌁ Source evidence</span><span>◉ Adaptive modes</span><span>↗ Web-aware</span><span>◌ Voice input</span><span>⌘ 500 MB files</span></div></div></div><div class="composer-area"><div class="composer-shell"><div class="mode-bar"><label for="answerMode">AI mode</label><select id="answerMode"><option value="auto">Auto</option><option value="deep">Deep Think</option><option value="study">Study Tutor</option><option value="summary">Document Summary</option><option value="quiz">Quiz Builder</option><option value="flashcards">Flashcards</option><option value="research">Research</option></select><button type="button" class="mode-help" id="modeHelp">?</button><span class="mode-status" id="modeStatus">Balanced answers</span></div><form id="chatForm" class="composer"><button type="button" id="uploadBtn" class="attach-btn" title="Upload multiple documents">＋</button><textarea id="chatInput" rows="1" placeholder="Ask RAGORA anything about your knowledge…"></textarea><button type="button" id="voiceBtn" class="attach-btn voice-btn" title="Voice input">⌁</button><button class="send-btn" id="sendBtn" aria-label="Send">↑</button></form><div id="uploadDropZone" class="drop-hint">Drop files here to add them · PDF, DOCX, PPTX, TXT, CSV, XLSX, JSON & code · up to 500 MB each</div><div class="composer-meta"><span>Enter to send · Shift + Enter for new line</span><span id="knowledgeHint">Knowledge base ready</span></div></div></div></section>`}
async function renderChat(){el('appView').innerHTML=chatView();await loadDocs().catch(()=>[]);bindChat();}
function renderConversationList(){const box=el('conversationList');if(!box)return;box.innerHTML=state.conversations.length?state.conversations.map(c=>`<button class="conv-item ${c.id===state.currentConversationId?'active':''}" data-id="${c.id}"><span>${esc(c.title)}</span><small>${esc(c.created_at||'')}</small></button>`).join(''):empty('No conversations','Start a new grounded chat.','');box.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>openConversation(+b.dataset.id));}
async function createNewChat(){const d=await api('/api/conversations',{method:'POST'});state.currentConversationId=d.id;await loadConversations();renderConversationList();el('chatInput')?.focus();return d.id}
async function openConversation(id){state.currentConversationId=id;const msgs=await api(`/api/conversations/${id}/messages`);el('emptyState')?.remove();el('messages').innerHTML='';msgs.forEach(m=>renderMessage(m.role,m.content,!!m.used_web,[],{},[]));renderConversationList();}
function latexToReadable(s){return s.replace(/\\text\{([^}]*)\}/g,'$1').replace(/\\left/g,'').replace(/\\right/g,'').replace(/\\sum_\{?([^}\s]+)\}?/g,'Σ<sub>$1</sub>').replace(/\\phi/g,'φ').replace(/\\sigma/g,'σ').replace(/\\alpha/g,'α').replace(/\\beta/g,'β').replace(/\\lambda/g,'λ').replace(/\\mu/g,'μ').replace(/\\sqrt\{([^}]*)\}/g,'√($1)').replace(/\\exp/g,'exp').replace(/\\times/g,'×').replace(/\\cdot/g,'·').replace(/\\leq/g,'≤').replace(/\\geq/g,'≥').replace(/\\in/g,'∈').replace(/\\to/g,'→').replace(/\\approx/g,'≈').replace(/\^\{([^}]*)\}/g,'<sup>$1</sup>').replace(/_\{([^}]*)\}/g,'<sub>$1</sub>').replace(/\^([A-Za-z0-9]+)/g,'<sup>$1</sup>').replace(/_([A-Za-z0-9]+)/g,'<sub>$1</sub>')}
function renderMarkdown(text){let s=esc(text);s=s.replace(/```([\s\S]*?)```/g,'<pre><code>$1</code></pre>');s=latexToReadable(s).replace(/\\\((.*?)\\\)/g,'<span class="math">$1</span>').replace(/\\\[([\s\S]*?)\\\]/g,'<div class="math-block">$1</div>');s=s.replace(/^### (.*)$/gm,'<h4>$1</h4>').replace(/^## (.*)$/gm,'<h3>$1</h3>').replace(/^# (.*)$/gm,'<h2>$1</h2>').replace(/^(\d+)\. (.*)$/gm,'<div class="answer-step"><b>$1.</b> $2</div>').replace(/^- (.*)$/gm,'<div class="answer-bullet">• $1</div>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');return s.replace(/\n/g,'<br>')}
function renderMessage(role,content,usedWeb=false,sources=[],meta={},citations=[]){
  const row=document.createElement('div');
  row.className=`msg-row ${role}`;
  if(role==='assistant')row.innerHTML='<div class="assistant-avatar">R</div>';

  const wrap=document.createElement('div');
  wrap.className='message-wrap';

  const bubble=document.createElement('div');
  bubble.className='bubble';
  bubble.innerHTML=role==='assistant'?renderMarkdown(content):esc(content);
  wrap.appendChild(bubble);

  if(role==='assistant'){
    const metaRow=document.createElement('div');
    metaRow.className='msg-meta';
    metaRow.innerHTML=`
      ${usedWeb?'<span class="web-tag">Web researched</span>':''}
      ${meta.match_percent?`<span class="match-tag">Retrieval ${meta.match_percent}%</span>`:''}
      ${meta.elapsed_ms?`<span class="time-tag">${(meta.elapsed_ms/1000).toFixed(1)}s</span>`:''}
      ${meta.answer_mode==='detailed'?'<span class="detail-tag">Detailed</span>':''}
      <button class="copy-btn">Copy</button><button class="copy-btn regenerate-btn">Regenerate</button><button class="feedback-btn" data-vote="up" title="Helpful">♡</button><button class="feedback-btn" data-vote="down" title="Not helpful">♧</button>`;
    metaRow.querySelector('.copy-btn').onclick=()=>{
      navigator.clipboard?.writeText(content).then(()=>toast('Answer copied'));
    };
    metaRow.querySelector('.regenerate-btn')?.addEventListener('click',()=>regenerateLast());
    metaRow.querySelectorAll('.feedback-btn').forEach(b=>b.onclick=()=>{b.classList.add('selected');toast(b.dataset.vote==='up'?'Thanks — marked helpful':'Thanks — feedback noted','info');localStorage.setItem('ragora:lastFeedback',b.dataset.vote)});
    wrap.appendChild(metaRow);

    if(citations?.length){
      const box=document.createElement('div');
      box.className='citations';
      box.innerHTML='<div class="citation-title"><span>Sources</span><small>Click a source for full evidence</small></div>';

      citations.forEach(c=>{
        const card=document.createElement('button');
        card.type='button';
        card.className='source-card';
        card.innerHTML=`
          <span class="source-num">${c.index}</span>
          <span class="file-badge">${iconFile(c.filename)}</span>
          <span class="source-info">
            <b>${esc(c.filename)}</b>
            <small>${c.page?'Page '+c.page+' · ':''}Chunk #${c.chunk_index??'—'}</small>
          </span>
          <span class="source-confidence">${c.confidence}%</span>
          <span class="source-arrow">›</span>`;
        card.onclick=()=>openSource(c);
        box.appendChild(card);
      });
      wrap.appendChild(box);
    }
  }

  row.appendChild(wrap);
  el('messages').appendChild(row);
  requestAnimationFrame(()=>{el('messages').scrollTop=el('messages').scrollHeight});
}

function openSource(c){
  const m=document.createElement('div');
  m.className='modal-backdrop';
  const evidence=c.text||c.snippet||'No source text available.';
  m.innerHTML=`
    <div class="modal source-modal source-detail-modal">
      <button class="modal-close" aria-label="Close">×</button>
      <div class="eyebrow">SOURCE EVIDENCE</div>
      <div class="source-viewer-head">
        <div>
          <h2>${esc(c.filename)}</h2>
          <p>Evidence retrieved for this answer.</p>
        </div>
        <span class="source-confidence large">${c.confidence}%</span>
      </div>
      <div class="source-meta">
        <span>Page ${c.page??'—'}</span>
        <span>Chunk #${c.chunk_index??'—'}</span>
        <span>Grounded evidence</span>
      </div>
      <div class="highlight source-evidence-text">${esc(evidence)}</div>
      <div class="source-viewer-actions">
        <button class="btn ghost source-copy">Copy evidence</button>
        <button class="btn secondary modal-close-btn">Close</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  m.querySelector('.source-copy').onclick=()=>{
    navigator.clipboard?.writeText(evidence).then(()=>toast('Source evidence copied'));
  };
  m.querySelectorAll('.modal-close,.modal-close-btn').forEach(b=>b.onclick=()=>m.remove());
  m.addEventListener('click',e=>{if(e.target===m)m.remove()});
}

function bindChat(){document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{const i=el('chatInput');i.value=b.dataset.prompt;i.focus();i.dispatchEvent(new Event('input'));});const i=el('chatInput');i.oninput=()=>{i.style.height='auto';i.style.height=Math.min(i.scrollHeight,180)+'px'};i.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();el('chatForm').requestSubmit()}};el('uploadBtn').onclick=()=>el('fileInput').click();el('chatForm').onsubmit=sendChat;el('knowledgeHint').textContent=state.docs.length?`${state.docs.length} documents indexed`:'Add documents or ask a general question';const mode=el('answerMode'),status=el('modeStatus');const labels={auto:'Balanced answers',deep:'Long-form reasoning',study:'Tutor-style learning',summary:'Evidence summary',quiz:'Quiz generation',flashcards:'Revision cards',research:'Research mode'};mode?.addEventListener('change',()=>{state.lastMode=mode.value;if(status)status.textContent=labels[mode.value]||'Balanced answers'});el('modeHelp')?.addEventListener('click',()=>toast('Deep Think = detailed reasoning · Study = tutor · Summary / Quiz / Flashcards = document tools · Research = evidence-first research.','info'));const voice=el('voiceBtn');if(voice){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){voice.disabled=true}else voice.onclick=()=>{const r=new SR();r.lang='en-IN';r.interimResults=false;r.maxAlternatives=1;r.onstart=()=>{voice.classList.add('recording');toast('Listening…','info')};r.onend=()=>voice.classList.remove('recording');r.onerror=()=>{voice.classList.remove('recording');toast('Voice input failed','error')};r.onresult=e=>{i.value=(i.value?i.value+' ':'')+e.results[0][0].transcript;i.dispatchEvent(new Event('input'));i.focus()};r.start()}}const dz=el('uploadDropZone');if(dz){['dragenter','dragover'].forEach(v=>dz.addEventListener(v,e=>{e.preventDefault();dz.classList.add('dragging')}));['dragleave','drop'].forEach(v=>dz.addEventListener(v,e=>{e.preventDefault();dz.classList.remove('dragging')}));dz.addEventListener('drop',e=>handleFiles(Array.from(e.dataTransfer.files||[])))}document.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();i.focus()}if(e.key==='Escape'&&state.activeRequest)state.activeRequest.abort()};}
function handleFiles(files){const input=el('fileInput');if(!files.length)return;const dt=new DataTransfer();files.forEach(f=>dt.items.add(f));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));}

async function sendChat(e){e.preventDefault();const input=el('chatInput'),text=input.value.trim();if(!text)return;const previousId=state.currentConversationId,mode=el('answerMode')?.value||'auto';state.lastUserPrompt=text;state.lastMode=mode;try{if(!state.currentConversationId){const d=await api('/api/conversations',{method:'POST'});state.currentConversationId=d.id}el('emptyState')?.remove();renderMessage('user',text);input.value='';input.style.height='auto';const t=document.createElement('div');t.className='msg-row assistant';t.id='typing';t.innerHTML='<div class="assistant-avatar">R</div><div class="typing-label"><span class="typing-dot"></span> RAGORA is thinking…</div>';el('messages').appendChild(t);el('messages').scrollTop=el('messages').scrollHeight;el('sendBtn').disabled=true;const controller=new AbortController();state.activeRequest=controller;let d;try{d=await api('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversation_id:state.currentConversationId,message:text,mode}),signal:controller.signal})}catch(err){if(err.name==='AbortError'){el('typing')?.remove();toast('Generation stopped','info');return}if(err.code!=='not_found')throw err;const fresh=await api('/api/conversations',{method:'POST'});state.currentConversationId=fresh.id;d=await api('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversation_id:fresh.id,message:text,mode})});toast('New chat session restored','info')}el('typing')?.remove();state.currentConversationId=d.conversation_id||state.currentConversationId;renderMessage('assistant',d.answer,!!d.used_web,d.sources||[],d,d.citations||[]);loadConversations().then(renderConversationList).catch(()=>{})}catch(err){el('typing')?.remove();if(previousId!==null)state.currentConversationId=previousId;if(err.name!=='AbortError'){
  const status=Number(err.status||0);
  const retryable=[429,500,502,503,504].includes(status);
  if(retryable){
    toast('AI service is busy — retrying automatically…','info');
    await new Promise(r=>setTimeout(r,900));
    try{
      const retry=await api('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversation_id:state.currentConversationId,message:text,mode}),signal:state.activeRequest?.signal});
      state.currentConversationId=retry.conversation_id||state.currentConversationId;
      renderMessage('assistant',retry.answer,!!retry.used_web,retry.sources||[],retry,retry.citations||[]);
      loadConversations().then(renderConversationList).catch(()=>{});
      return;
    }catch(retryErr){err=retryErr}
  }
  const safeMessage=(err.message&&String(err.message).length<260)?String(err.message):'The AI service is temporarily unavailable. Your message is safe — please try Send again in a moment.';
  renderMessage('assistant',safeMessage);toast(status===401||status===403?'AI configuration needs attention':'Temporary AI connection issue — please try again','info');
}}finally{state.activeRequest=null;el('sendBtn').disabled=false}}

async function regenerateLast(){if(!state.currentConversationId)return;try{toast('Regenerating answer…','info');const d=await api('/api/chat/regenerate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversation_id:state.currentConversationId})});const rows=el('messages').querySelectorAll('.msg-row.assistant');rows[rows.length-1]?.remove();renderMessage('assistant',d.answer,!!d.used_web,d.sources||[],d,d.citations||[])}catch(err){toast(err.message||'Could not regenerate','error')}}

async function dashboardView(){const s=await stats();return `${layout('Your knowledge, intelligently searchable.','A compact command center for your document-grounded AI workspace.','<button class="btn primary" data-go="chat">Ask a question</button>')}<div class="metrics">${metric('Documents',s.documents,'Indexed files','▤')}${metric('Chunks',s.chunks,'Retrieval units','◈')}${metric('Questions',s.questions,'Conversation messages','?')}${metric('Knowledge Bases','1','Personal workspace','▣')}</div><div class="dashboard-grid"><div class="panel"><div class="panel-title"><span>RECENT DOCUMENTS</span><button class="link-btn" data-go="documents">View all →</button></div>${s.documents?state.docs.slice(0,5).map(d=>`<div class="list-row"><span class="file-badge">${iconFile(d.filename)}</span><div><b>${esc(d.filename)}</b><small>${d.chunk_count||'Indexed'} chunks · Ready</small></div><span class="status ready">Ready</span></div>`).join(''):empty('No documents yet','Build your knowledge base from the Documents page.','<button class="btn secondary" data-go="documents">Upload document</button>')}</div><div class="panel"><div class="panel-title"><span>RAG PIPELINE</span><span class="badge">LIVE</span></div><div class="pipeline-mini">${['Document','Extract','Chunk','Vector score','Top-K','LLM','Citations'].map((x,i)=>`<div><span>${i+1}</span><b>${x}</b></div>`).join('')}</div><p class="panel-note">RAGORA combines TF-IDF similarity, BM25 and keyword signals, then reranks the strongest evidence before generation.</p></div></div>`}
async function knowledgeView(){await loadDocs();return `${layout('Knowledge Bases','Organize documents into a searchable AI knowledge layer.','<button class="btn primary" id="kbUpload">＋ Upload document</button>')}<div class="searchbar"><input id="docSearch" placeholder="Search knowledge…"><span>${state.docs.length} documents</span></div><div class="kb-card"><div class="kb-icon">R</div><div class="kb-copy"><h3>Personal Knowledge Base</h3><p>All uploaded documents available to your RAG retrieval pipeline.</p><div class="chips"><span>${state.docs.length} documents</span><span>${state.docs.reduce((n,d)=>n+(d.chunk_count||0),0)} chunks</span><span>Hybrid retrieval</span></div></div><button class="btn secondary" data-go="documents">Open</button></div><div id="kbDocs" class="doc-grid">${state.docs.map(d=>docCard(d)).join('')||empty('No documents yet','Upload PDF, DOCX, PPTX, TXT, CSV, XLSX and supported source files to start.','<button class="btn primary" id="kbUpload2">Upload document</button>')}</div>`}
function docCard(d){return `<article class="doc-card"><div class="doc-card-top"><span class="file-badge large">${iconFile(d.filename)}</span><span class="status ready">Ready</span></div><h3 title="${attr(d.filename)}">${esc(d.filename)}</h3><p>${d.chunk_count??'—'} chunks · ${esc(d.created_at||'')}</p><div class="doc-actions"><button class="btn ghost" data-chunks="${d.id}">Chunks</button><button class="btn danger" data-delete="${d.id}">Delete</button></div></article>`}
async function documentsView(){await loadDocs();return `${layout('Documents','Upload, inspect and manage the files powering RAGORA. Supports files up to 500 MB each.','<button class="btn primary" id="docUpload">＋ Upload document</button>')}<div class="upload-strip"><div><b>Build your knowledge base</b><span>PDF · DOCX · PPTX · TXT · CSV · XLSX · source code · up to 500 MB each</span></div><button class="btn secondary" id="docUpload2">Choose file</button></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Chunks</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>${state.docs.map(d=>`<tr><td><span class="file-badge">${iconFile(d.filename)}</span><b>${esc(d.filename)}</b></td><td>${iconFile(d.filename)}</td><td>${d.chunk_count??'—'}</td><td><span class="status ready">Ready</span></td><td>${esc(d.created_at||'')}</td><td><button class="btn ghost" data-chunks="${d.id}">View chunks</button> <button class="btn danger" data-delete="${d.id}">Delete</button></td></tr>`).join('')||`<tr><td colspan="6">${empty('No documents yet','Upload your first knowledge source.','')}</td></tr>`}</tbody></table></div>`}
async function chunksView(){const docs=await loadDocs();let selected=state.selectedDocId||docs[0]?.id;let chunks=[];if(selected)chunks=await api(`/api/documents/${selected}/chunks`);return `${layout('Chunk Explorer','Inspect the retrieval units created from your source documents.','<button class="btn secondary" id="refreshChunks">Refresh</button>')}<div class="toolbar"><select id="chunkDoc">${docs.map(d=>`<option value="${d.id}" ${+d.id===+selected?'selected':''}>${esc(d.filename)}</option>`).join('')}</select><input id="chunkSearch" placeholder="Search chunk text…"><span id="chunkCount">${chunks.length} chunks</span></div><div id="chunkGrid" class="chunk-grid">${chunks.map(chunkCard).join('')||empty('No chunks available','Chunks appear after document processing.')}</div>`}
function chunkCard(c){return `<article class="chunk-card"><div class="chunk-head"><b>Chunk #${c.chunk_index}</b><span>Page ${c.page??'—'}</span><span>${c.tokens??Math.ceil(c.chunk_text.length/4)} tokens</span></div><h4>${esc(c.filename)}</h4><p>${esc(c.chunk_text)}</p><div class="chunk-foot"><span class="status ready">Indexed</span><button class="btn ghost" data-full='${attr(c.chunk_text)}' data-filename='${attr(c.filename)}' data-page='${attr(c.page??'')}' data-index='${attr(c.chunk_index??'')}'>View full chunk</button></div></article>`}
async function retrievalView(){return `${layout('Retrieval Explorer','Understand exactly how RAGORA turns a question into ranked evidence.','')}<section class="retrieval-workbench"><div class="retrieval-query-card"><div class="retrieval-query-top"><div><div class="eyebrow">LIVE RETRIEVAL TRACE</div><h3>Ask a question</h3><p>Inspect the evidence RAGORA selects before answer generation.</p></div><span class="live-badge"><i></i> LIVE</span></div><div class="retrieval-input-row"><input id="retrievalQuestion" value="" autocomplete="off" placeholder="What is the main objective of this project?"><div class="retrieval-k"><label>TOP-K</label><select id="retrievalK"><option value="3">3</option><option value="5">5</option><option value="8">8</option></select></div><button class="btn primary retrieval-run-btn" id="runRetrieval">Run retrieval</button></div></div><div id="retrievalResult">${empty('Run a retrieval trace','Enter a question to visualize ranked chunks, similarity scores and context.')}</div></section>`}
function retrievalResult(d){const results=Array.isArray(d.results)?d.results:[];if(!results.length)return `<div class="retrieval-empty panel"><div class="empty-icon">⌕</div><h3>No relevant evidence found</h3><p>Try a different question or upload a document containing the required information.</p></div>`;const best=Number(results[0]?.score||0);return `<div class="retrieval-dashboard"><div class="trace-card panel"><div class="panel-title"><span>RAG PIPELINE TRACE</span><span class="badge">LIVE ANALYSIS</span></div><div class="trace-flow">${[['01','Question','User query'],['02','Query analysis','Lexical representation'],['03','Hybrid retrieval','TF-IDF + BM25 + RRF'],['04','Reranking','Evidence scoring'],['05','Top-K',`${results.length} chunks`]].map((x,i)=>`<div class="trace-node"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>${i<4?'<div class="trace-link">→</div>':''}`).join('')}</div></div><div class="retrieval-overview"><div class="mini-stat panel"><span>QUERY</span><b>${esc(d.question)}</b></div><div class="mini-stat panel"><span>RESULTS</span><b>${results.length}</b><small>Top-K evidence</small></div><div class="mini-stat panel"><span>BEST MATCH</span><b>${best}%</b><small>Highest retrieval score</small></div></div><div class="panel ranked-panel"><div class="panel-title"><span>RANKED EVIDENCE</span><span class="badge">${results.length} SOURCES</span></div><div class="ranked-list">${results.map((r,i)=>{const score=Math.max(0,Math.min(100,Number(r.score||0)));return `<article class="evidence-row"><div class="evidence-rank">#${i+1}</div><div class="evidence-main"><div class="evidence-head"><div><span class="file-badge">${iconFile(r.filename||'DOC')}</span><b>${esc(r.filename||'Unknown document')}</b></div><strong>${score}%</strong></div><div class="evidence-meta"><span>Page ${r.page??'—'}</span><span>Chunk #${r.chunk_index??'—'}</span><span>Retrieval score</span></div><div class="score-track"><i style="width:${score}%"></i></div><p>${esc(r.snippet||'No preview available.')}</p></div></article>`}).join('')}</div></div><details class="context-panel panel"><summary><span>View context used for generation</span><span>⌄</span></summary><pre>${esc(d.context||'No context selected.')}</pre></details></div>`}
async function analyticsView(){let e=null;try{e=await api('/api/evaluation')}catch{}return `${layout('RAG Analytics','Measure retrieval quality and keep evaluation results honest.','<button class="btn primary" id="runEval">Run evaluation</button>')}<div class="metrics">${metric('Hit Rate@K',e?.summary?.hit_rate!=null?e.summary.hit_rate+'%':'—',e?'Evaluation dataset':'Not yet evaluated','◉')}${metric('Precision@K',e?.summary?.precision!=null?e.summary.precision+'%':'—','Relevant chunks retrieved','◎')}${metric('MRR',e?.summary?.mrr!=null?e.summary.mrr.toFixed(3):'—','Mean reciprocal rank','↗')}${metric('Avg retrieval confidence',e?.summary?.avg_match!=null?e.summary.avg_match+'%':'—',e?'Measured on dataset':'Not yet evaluated','◇')}</div><div class="analytics-grid"><div class="panel"><div class="panel-title"><span>EVALUATION STATUS</span><span class="badge">${e?'LIVE DATA':'NOT YET EVALUATED'}</span></div><p class="panel-note">Metrics are computed from <code>eval_dataset.json</code> and the documents currently indexed for your account. No demo numbers are presented as real results.</p><div class="metric-line"><span>Groundedness / citation coverage</span><b>Available after answer evaluation</b></div><div class="metric-line"><span>Retrieval latency</span><b>Captured per retrieval trace</b></div><div class="metric-line"><span>User feedback</span><b>UI-ready</b></div></div><div class="panel"><div class="panel-title"><span>RAG QUALITY MODEL</span></div><div class="quality-bars"><div><span>Retrieval relevance</span><i style="width:${e?.summary?.hit_rate||0}%"></i></div><div><span>Precision</span><i style="width:${e?.summary?.precision||0}%"></i></div><div><span>Confidence</span><i style="width:${e?.summary?.avg_match||0}%"></i></div></div></div></div><div id="evalDetails">${e?evalDetails(e):''}</div>`}
function evalDetails(e){return `<div class="panel"><div class="panel-title"><span>EVALUATION CASES</span><span>${e.results.length} questions</span></div><div class="eval-list">${e.results.map(r=>`<div class="eval-row"><span class="eval-dot ${r.hit?'good':'bad'}">${r.hit?'✓':'!'}</span><div><b>${esc(r.question)}</b><small>Expected: ${esc(r.expected.join(', ')||'ground truth not specified')}</small></div><strong>${r.match_percent}%</strong></div>`).join('')}</div></div>`}
async function historyView(){await loadConversations();return `${layout('Chat History','Revisit your document-grounded conversations.','')}<div class="searchbar"><input id="historySearch" placeholder="Search conversations…"><span>${state.conversations.length} chats</span></div><div id="historyList" class="history-grid">${state.conversations.map(c=>`<article class="history-card"><div><span class="history-icon">⌁</span><div><h3>${esc(c.title)}</h3><small>${esc(c.created_at||'')} · ${c.message_count||0} messages</small></div></div><div><button class="btn secondary" data-open-chat="${c.id}">Open</button><button class="btn danger" data-delete-chat="${c.id}">Delete</button></div></article>`).join('')||empty('No conversations yet','Start your first AI chat.','')}</div>`}
async function settingsView(){return `${layout('Settings','Tune the workspace without hiding the technical controls from your viva.','')}<div class="settings-grid"><div class="panel settings-card"><div class="panel-title"><span>RAG CONFIGURATION</span></div>${[['Chunk Size','900 characters'],['Chunk Overlap','120 characters'],['Top-K','3 chunks'],['Similarity threshold','0.16']].map(x=>`<label><span>${x[0]}</span><b>${x[1]}</b></label>`).join('')}<details><summary>Advanced RAG Settings</summary><p>Hybrid retrieval uses TF-IDF, BM25, keyword overlap, reciprocal-rank fusion and a lexical rerank pass.</p></details></div><div class="panel settings-card"><div class="panel-title"><span>SYSTEM STATUS</span></div>${[['LLM','Groq / GPT OSS','connected'],['Retrieval','Hybrid RRF + rerank','connected'],['Document processor','PDF / DOCX / TXT +','ready'],['Web research','External search fallback','available']].map(x=>`<div class="status-line"><span><b>${x[0]}</b><small>${x[1]}</small></span><em class="status-dot-text">● ${x[2]}</em></div>`).join('')}</div></div>`}
async function renderView(view){state.view=view;document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));el('pageCrumb').textContent={chat:'AI Chat',dashboard:'Dashboard',knowledge:'Knowledge Bases',documents:'Documents',chunks:'Chunk Explorer',retrieval:'Retrieval Explorer',analytics:'Analytics & Evaluation',history:'Chat History',settings:'Settings'}[view];if(view==='chat'){await renderChat();return}const fn={dashboard:dashboardView,knowledge:knowledgeView,documents:documentsView,chunks:chunksView,retrieval:retrievalView,analytics:analyticsView,history:historyView,settings:settingsView}[view];el('appView').innerHTML=await fn();bindView(view);}
function bindView(view){document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>renderView(b.dataset.go));const input=el('fileInput');
const choose=()=>input.click();
['kbUpload','kbUpload2','docUpload','docUpload2'].forEach(id=>el(id)?.addEventListener('click',choose));
input.onchange=async e=>{
  const files=Array.from(e.target.files||[]);
  if(!files.length)return;
  const valid=files.filter(f=>f.size<=500*1024*1024);
  const skipped=files.length-valid.length;
  if(skipped)toast(`${skipped} file(s) skipped: maximum 500 MB per file`,'info');

  let done=0, failed=0;
  const total=valid.length;
  for(const f of valid){
    try{
      toast(`Indexing ${++done}/${total}: ${f.name}`,'info');
      const fd=new FormData();
      fd.append('file',f);
      await api('/api/documents/upload',{method:'POST',body:fd});
    }catch(err){
      failed++;
      toast(`${f.name}: ${err.message}`,'error');
    }
  }
  if(total){
    toast(failed?`${total-failed}/${total} files indexed`:`${total} files indexed successfully`);
    await renderView(state.view);
  }
  input.value='';
};
document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this document?'))return;await api(`/api/documents/${b.dataset.delete}`,{method:'DELETE'});toast('Document deleted');renderView(view)});document.querySelectorAll('[data-chunks]').forEach(b=>b.onclick=()=>{state.selectedDocId=+b.dataset.chunks;renderView('chunks')});document.querySelectorAll('[data-delete-chat]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this chat?'))return;await api(`/api/conversations/${b.dataset.deleteChat}`,{method:'DELETE'});renderView('history')});document.querySelectorAll('[data-open-chat]').forEach(b=>b.onclick=async()=>{state.currentConversationId=+b.dataset.openChat;await renderView('chat');await openConversation(state.currentConversationId)});if(view==='chunks')bindChunks();if(view==='retrieval'){el('runRetrieval').onclick=runRetrieval;el('retrievalQuestion')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runRetrieval()}})}if(view==='analytics')el('runEval').onclick=async()=>{toast('Running retrieval evaluation…','info');try{const e=await api('/api/evaluation/run',{method:'POST'});el('evalDetails').innerHTML=evalDetails(e);document.querySelector('.metrics').outerHTML=`<div class="metrics">${metric('Hit Rate@K',e.summary.hit_rate+'%','Evaluation dataset','◉')}${metric('Precision@K',e.summary.precision+'%','Relevant chunks retrieved','◎')}${metric('MRR',e.summary.mrr.toFixed(3),'Mean reciprocal rank','↗')}${metric('Avg retrieval confidence',e.summary.avg_match+'%','Measured on dataset','◇')}</div>`;toast('Evaluation complete')}catch(err){toast(err.message,'error')}}}
async function bindChunks(){const sel=el('chunkDoc');if(!sel)return;const load=async()=>{state.selectedDocId=+sel.value;const c=await api(`/api/documents/${sel.value}/chunks`);el('chunkGrid').innerHTML=c.map(chunkCard).join('')||empty('No chunks','This document has no indexed chunks.');el('chunkCount').textContent=`${c.length} chunks`;bindChunkCards()};const bindChunkCards=()=>document.querySelectorAll('[data-full]').forEach(b=>b.onclick=()=>openSource({filename:b.dataset.filename||'Chunk',page:b.dataset.page||null,chunk_index:b.dataset.index||'',confidence:100,text:b.dataset.full,snippet:b.dataset.full}));sel.onchange=load;el('chunkSearch').oninput=()=>document.querySelectorAll('.chunk-card').forEach(c=>c.style.display=c.innerText.toLowerCase().includes(el('chunkSearch').value.toLowerCase())?'':'none');el('refreshChunks')?.addEventListener('click',load);bindChunkCards()}
async function runRetrieval(){
  const q=el('retrievalQuestion').value.trim(); if(!q)return;
  const result=el('retrievalResult');
  result.innerHTML='<div class="retrieval-loading"><span class="spinner"></span><div><b>Tracing retrieval…</b><small>Ranking the most relevant evidence.</small></div></div>';
  try{
    const d=await api('/api/retrieval',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,top_k:+el('retrievalK').value})});
    result.innerHTML=retrievalResult(d);
  }catch(e){
    result.innerHTML='<div class="retrieval-soft-error"><b>Retrieval is temporarily unavailable.</b><span>Check the connection and run the trace again.</span><button class="btn secondary" id="retryRetrieval">Retry</button></div>';
    el('retryRetrieval')?.addEventListener('click',runRetrieval);
  }
}
function applyTheme(mode){const light=mode==='light';document.body.classList.toggle('theme-light',light);document.body.classList.toggle('theme-dark',!light);localStorage.setItem('ragora-theme',light?'light':'dark');const b=el('themeToggle');if(b){b.textContent=light?'☾':'☀';b.title=light?'Switch to dark mode':'Switch to light mode';b.setAttribute('aria-label',b.title)}}
function theme(){applyTheme(document.body.classList.contains('theme-light')?'dark':'light')}
nav();el('themeToggle').onclick=theme;el('brandHome').onclick=()=>renderView('chat');el('topBrand').onclick=()=>renderView('chat');el('newChatBtn').onclick=createNewChat;el('openSidebar').onclick=()=>el('sidebar').classList.add('open');el('closeSidebar').onclick=()=>el('sidebar').classList.remove('open');el('sidebarOverlay').onclick=()=>el('sidebar').classList.remove('open');document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();createNewChat()}});applyTheme(localStorage.getItem('ragora-theme')||'light');renderView('chat');

(() => {
 const show=m=>{let e=document.querySelector('.rg-ai-status');if(!e){e=document.createElement('div');e.className='rg-ai-status';document.body.appendChild(e)}e.textContent=m;e.classList.add('show');clearTimeout(window.__rg);window.__rg=setTimeout(()=>e.classList.remove('show'),7000)};
 window.RAGORA_showAIStatus=show;
 const nativeFetch=window.fetch;
 window.fetch=async(...a)=>{try{const r=await nativeFetch(...a);if(!r.ok&&r.status>=500)show('AI service is temporarily busy. Your message is safe — please try Send again in a moment.');return r}catch(e){show('AI service connection is temporarily unavailable. Please try Send again in a moment.');throw e}};
})();
