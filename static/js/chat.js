const state = { currentConversationId:null };
const el = id => document.getElementById(id);
/* Mobile browsers resize the viewport when the URL bar hides/shows, which
   breaks plain `100vh` layouts (content jumps/clips). Track the real
   viewport height in a CSS var instead so the app feels like a native app. */
function setRealViewportHeight(){document.documentElement.style.setProperty('--vh',(window.innerHeight*0.01)+'px');}
setRealViewportHeight();
window.addEventListener('resize',setRealViewportHeight);
window.addEventListener('orientationchange',setRealViewportHeight);
const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const attr = esc;
function scrollBottom(){const b=el('messages'); requestAnimationFrame(()=>b.scrollTop=b.scrollHeight);}
function toast(message,kind='ok'){const t=el('toast');t.textContent=message;t.className=`toast show ${kind}`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.className='toast',3600);}
function welcomeHtml(){return `<div id="emptyState" class="welcome"><div class="welcome-visual"><div class="welcome-ring ring-x"></div><div class="welcome-ring ring-y"></div><div class="welcome-core">R</div></div><p class="welcome-eyebrow">RAGORA WORKSPACE</p><h1>What are we exploring<br><span>today?</span></h1><p class="welcome-copy">Bring a document into the conversation, then ask anything in English, தமிழ், or Tanglish.</p><div class="quick-grid"><button data-prompt="Summarize the uploaded document"><span>01</span><b>Summarize</b><small>Get the key ideas fast</small></button><button data-prompt="Explain the document in simple Tamil"><span>02</span><b>Explain simply</b><small>Clear Tamil explanation</small></button><button data-prompt="Find the most important points in the document"><span>03</span><b>Find key points</b><small>Important details only</small></button><button data-prompt="What information is missing from the document?"><span>04</span><b>Check the gaps</b><small>Know what the file doesn't say</small></button></div></div>`;}
function applyTheme(t){document.body.classList.toggle('theme-light',t==='light');document.body.classList.toggle('theme-dark',t!=='light');el('themeToggle').textContent=t==='light'?'☀':'◐';el('themeToggle').title=t==='light'?'Switch to dark':'Switch to light';localStorage.setItem('ragora-theme',t);}
applyTheme(localStorage.getItem('ragora-theme')||'light');
el('themeToggle').addEventListener('click',()=>applyTheme(document.body.classList.contains('theme-dark')?'light':'dark'));
function closeSidebar(){el('sidebar').classList.remove('open');el('sidebarOverlay').classList.remove('show');}
el('openSidebar')?.addEventListener('click',()=>{el('sidebar').classList.add('open');el('sidebarOverlay').classList.add('show')});el('closeSidebar')?.addEventListener('click',closeSidebar);el('sidebarOverlay')?.addEventListener('click',closeSidebar);
el('brandHome').addEventListener('click',()=>createNewChat());
async function api(url,options={}){const r=await fetch(url,options);let d={};try{d=await r.json()}catch{}if(r.status===401){location.href='/login';throw new Error('Session expired. Please sign in again.')}if(!r.ok||d.error)throw new Error(d.error||`Request failed (${r.status})`);return d;}
async function loadConversations(){try{const convs=await api('/api/conversations');const list=el('conversationList');list.innerHTML='';convs.forEach(c=>{const item=document.createElement('button');item.className='conv-item'+(c.id===state.currentConversationId?' active':'');item.innerHTML=`<span class="conv-dot"></span><span class="conv-title">${esc(c.title||'New chat')}</span><button class="conv-del" title="Delete">×</button>`;item.addEventListener('click',async e=>{if(e.target.classList.contains('conv-del')){e.stopPropagation();if(confirm('Delete this chat?')){await api(`/api/conversations/${c.id}`,{method:'DELETE'});if(state.currentConversationId===c.id)state.currentConversationId=null;await loadConversations();if(!state.currentConversationId)await createNewChat();}return;}await selectConversation(c.id,c.title)});list.appendChild(item)});if(!state.currentConversationId&&convs.length)await selectConversation(convs[0].id,convs[0].title);if(!convs.length&&!state.currentConversationId)await createNewChat();}catch(e){toast(e.message,'error')}}
async function createNewChat(){const c=await api('/api/conversations',{method:'POST'});state.currentConversationId=c.id;el('chatTitle').textContent='New chat';el('messages').innerHTML=welcomeHtml();await loadKnowledge();await loadConversations();bindSuggestions();closeSidebar();el('chatInput').focus();}
async function selectConversation(id,title){state.currentConversationId=id;el('chatTitle').textContent=title||'New chat';await loadMessages(id);await loadKnowledge();await loadConversations();closeSidebar();}
async function loadMessages(id){const msgs=await api(`/api/conversations/${id}/messages`);const box=el('messages');box.innerHTML='';if(!msgs.length){box.innerHTML=welcomeHtml();bindSuggestions();return}msgs.forEach(m=>renderMessage(m.role,m.content,!!m.used_web));scrollBottom();}
function barcodeHtml(count, cls='barcode'){const n=Math.max(0,Math.min(36,Number(count)||0));if(!n)return '<span class="barcode-empty"></span>';let out='';for(let i=0;i<n;i++){const h=7+((i*13)%12);out+=`<i style="height:${h}px"></i>`;}return out;}
function updateKnowledgeUI(stats){const docs=Number(stats?.documents||0),chunks=Number(stats?.chunks||0);if(el('knowledgeChunks'))el('knowledgeChunks').textContent=`${chunks} chunks`;if(el('knowledgeDocs'))el('knowledgeDocs').textContent=`${docs} documents`;if(el('inlineChunks'))el('inlineChunks').textContent=`${chunks} chunks`;if(el('inlineDocs'))el('inlineDocs').textContent=`${docs} docs`;if(el('knowledgeBarcode'))el('knowledgeBarcode').innerHTML=barcodeHtml(chunks);if(el('inlineBarcode'))el('inlineBarcode').innerHTML=barcodeHtml(chunks,'inline-barcode');if(el('companionBarcode'))el('companionBarcode').innerHTML=barcodeHtml(chunks,'companion-barcode');if(el('companionStats'))el('companionStats').textContent=`${docs} docs · ${chunks} chunks`;}
async function loadKnowledge(){try{const stats=await api('/api/companion/stats');updateKnowledgeUI(stats);const docs=await api('/api/documents');const box=el('sidebarDocs');if(box){box.innerHTML='';if(!docs.length)box.innerHTML='<div class="empty-docs">No documents yet</div>';docs.forEach(d=>box.appendChild(docCard(d,true)));}}catch(e){}}
function docCard(d,removable=true){const chip=document.createElement('div');chip.className='doc-chip';chip.innerHTML=`<div class="file-icon">▤</div><div class="doc-copy"><strong title="${attr(d.filename)}">${esc(d.filename)}</strong><span>Knowledge base</span></div>${removable?'<button title="Remove">×</button>':''}`;if(removable)chip.querySelector('button').addEventListener('click',async()=>{try{await api(`/api/documents/${d.id}`,{method:'DELETE'});await loadKnowledge();toast('Document removed','info')}catch(e){toast(e.message,'error')}});return chip;}
async function uploadFile(file){if(!file)return;const fd=new FormData();fd.append('file',file);toast(`Uploading ${file.name}…`,'info');try{const d=await api('/api/documents/upload',{method:'POST',body:fd});await loadKnowledge();toast(`${d.filename} · ${d.chunks} chunks indexed`);}catch(e){toast(e.message||'Upload failed','error')}}
el('uploadBtn').addEventListener('click',()=>el('fileInput').click());el('uploadSideBtn').addEventListener('click',()=>el('fileInput').click());el('fileInput').addEventListener('change',e=>{uploadFile(e.target.files[0]);e.target.value='';});
const form=el('chatForm'),input=el('chatInput');input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,190)+'px'});input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit()}});
form.addEventListener('submit',async e=>{e.preventDefault();const text=input.value.trim();if(!text)return;if(!state.currentConversationId)await createNewChat();el('emptyState')?.remove();renderMessage('user',text);input.value='';input.style.height='auto';scrollBottom();const tid=renderTyping();el('sendBtn').disabled=true;try{const d=await api('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversation_id:state.currentConversationId,message:text})});el(tid)?.remove();renderMessage('assistant',d.answer,!!d.used_web,d.sources||[],d,d.citations||[]);updateKnowledgeUI({documents:d.knowledge_docs,chunks:d.knowledge_chunks});await loadConversations()}catch(err){el(tid)?.remove();renderMessage('assistant',`I couldn't complete that request.\n\n${err.message}`);toast(err.message,'error')}finally{el('sendBtn').disabled=false;input.focus();scrollBottom()}});
function renderTyping(){const id='typing'+Date.now();const row=document.createElement('div');row.className='msg-row assistant';row.id=id;row.innerHTML='<div class="assistant-avatar">R</div><div class="typing"><span></span><span></span><span></span></div>';el('messages').appendChild(row);scrollBottom();return id;}
function renderMarkdown(text){let s=esc(text);s=s.replace(/```([\s\S]*?)```/g,'<pre><code>$1</code></pre>');s=s.replace(/^### (.*)$/gm,'<h4>$1</h4>').replace(/^## (.*)$/gm,'<h3>$1</h3>').replace(/^# (.*)$/gm,'<h2>$1</h2>');s=s.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code class="inline-code">$1</code>');s=s.replace(/^[-•] (.*)$/gm,'<li>$1</li>');s=s.replace(/(<li>.*<\/li>)/gs,'<ul>$1</ul>');return s.replace(/\n/g,'<br>');}
function renderMessage(role,content,usedWeb=false,sources=[],metaData={},citations=[]){const row=document.createElement('div');row.className=`msg-row ${role}`;if(role==='assistant'){const av=document.createElement('div');av.className='assistant-avatar';av.textContent='R';row.appendChild(av)}const wrap=document.createElement('div');wrap.className='message-wrap';const bubble=document.createElement('div');bubble.className='bubble';bubble.innerHTML=role==='assistant'?renderMarkdown(content):esc(content);wrap.appendChild(bubble);if(role==='assistant'){const meta=document.createElement('div');meta.className='msg-meta';meta.innerHTML=`${usedWeb?'<span class="web-tag">Web researched</span>':''}${metaData.match_percent?`<span class="match-tag">Document match ${metaData.match_percent}%</span>`:''}${metaData.elapsed_ms?`<span class="time-tag">${(metaData.elapsed_ms/1000).toFixed(1)}s</span>`:''}<button class="copy-btn">Copy</button>`;meta.querySelector('.copy-btn').addEventListener('click',()=>navigator.clipboard?.writeText(content).then(()=>toast('Copied')));wrap.appendChild(meta);if(citations.length){const cwrap=document.createElement('div');cwrap.className='citations';citations.forEach(c=>{const chip=document.createElement('button');chip.type='button';chip.className='cite-chip';chip.innerHTML=`<span class="cite-num">${c.index}</span><span class="cite-name" title="${attr(c.filename)}">${esc(c.filename)}${c.page?` · p.${c.page}`:''}</span>`;const panel=document.createElement('div');panel.className='cite-panel';panel.hidden=true;panel.innerHTML=`<div class="cite-conf">Match confidence: ${c.confidence}%</div><div class="cite-snippet">${esc(c.snippet)}</div>`;chip.addEventListener('click',()=>{panel.hidden=!panel.hidden;scrollBottom()});cwrap.appendChild(chip);cwrap.appendChild(panel)});wrap.appendChild(cwrap)}if(sources.length){const src=document.createElement('div');src.className='sources';sources.forEach(s=>{const a=document.createElement('a');a.href=s.url;a.target='_blank';a.rel='noopener';a.textContent=s.title||s.url;src.appendChild(a)});wrap.appendChild(src)}}row.appendChild(wrap);el('messages').appendChild(row)}
function bindSuggestions(){document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{input.value=b.dataset.prompt;input.focus();input.dispatchEvent(new Event('input'))}))}
el('newChatBtn').addEventListener('click',createNewChat);el('exportBtn').addEventListener('click',()=>{if(state.currentConversationId)location.href=`/api/conversations/${state.currentConversationId}/export`});document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();createNewChat()}});bindSuggestions();loadKnowledge();loadConversations();

/* ---------------- AI Chat (friendly companion side-panel) ---------------- */
/* Fully separate from the document-first chat above: its own history, its  */
/* own endpoints, its own casual/warm personality.                          */
const companionState={idleTimer:null};
function companionScrollBottom(){const b=el('companionMessages');if(b)requestAnimationFrame(()=>b.scrollTop=b.scrollHeight)}
function renderCompanionMsg(role,content){const box=el('companionMessages');const row=document.createElement('div');row.className=`companion-msg ${role}`;row.textContent=content;box.appendChild(row);companionScrollBottom()}
function timeGreeting(){const h=new Date().getHours();if(h<5)return"Late night ah? 🌙 Innum thoongala, enna panreenga?";if(h<12)return"Good morning! 🌞 Eppadi irukeenga today?";if(h<17)return"Good afternoon! 😊 Sapadu aachaa?";if(h<21)return"Good evening! 🌆 Naal eppadi ponuchu?";return"Night ah nalla iruku! 🌙 Innum thoongala, enna panreenga?"}
function scheduleCompanionNudge(){clearTimeout(companionState.idleTimer);companionState.idleTimer=setTimeout(()=>{const inp=el('companionInput');if(inp&&!inp.value.trim())renderCompanionMsg('assistant',"Ennada, mounama irukeenga? 🤔 Oru joke sollatuma, konjam sirikalam! 😄")},25000)}
async function loadCompanionStats(){try{const s=await api('/api/companion/stats');updateKnowledgeUI(s)}catch(e){}}
async function loadCompanionMessages(){try{const msgs=await api('/api/companion/messages');const box=el('companionMessages');box.innerHTML='';if(!msgs.length){renderCompanionMsg('assistant',timeGreeting());return 0}msgs.forEach(m=>renderCompanionMsg(m.role,m.content));companionScrollBottom();return msgs.length}catch(e){return 0}}
function openCompanion(){el('companionPanel').classList.add('open');el('companionPanel').setAttribute('aria-hidden','false');el('companionOverlay').classList.add('show');el('companionDot').hidden=true;loadCompanionStats();loadCompanionMessages().then(count=>{if(!count)scheduleCompanionNudge()});setTimeout(()=>el('companionInput')?.focus(),200)}
function closeCompanion(){el('companionPanel').classList.remove('open');el('companionPanel').setAttribute('aria-hidden','true');el('companionOverlay').classList.remove('show');clearTimeout(companionState.idleTimer)}
el('companionOpenBtn')?.addEventListener('click',openCompanion);
el('companionCloseBtn')?.addEventListener('click',closeCompanion);
el('companionOverlay')?.addEventListener('click',closeCompanion);
el('companionDeleteBtn')?.addEventListener('click',async()=>{
  if(!confirm('Delete this AI Chat conversation? This cannot be undone.'))return;
  try{
    await api('/api/companion/messages',{method:'DELETE'});
    clearTimeout(companionState.idleTimer);
    const box=el('companionMessages');
    if(box)box.innerHTML='';
    renderCompanionMsg('assistant',timeGreeting());
    scheduleCompanionNudge();
    toast('AI Chat cleared','info');
  }catch(e){
    toast(e.message||'Could not delete chat','error');
  }
});
el('companionForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  clearTimeout(companionState.idleTimer);
  const input=el('companionInput');
  const text=input.value.trim();
  if(!text)return;
  renderCompanionMsg('user',text);
  input.value='';
  const typingId='ctyping'+Date.now();
  const box=el('companionMessages');
  const row=document.createElement('div');row.className='companion-msg assistant';row.id=typingId;row.textContent='···';box.appendChild(row);companionScrollBottom();
  try{
    const d=await api('/api/companion/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text})});
    el(typingId)?.remove();
    renderCompanionMsg('assistant',d.answer);
    if(d.stats)updateKnowledgeUI(d.stats);
  }catch(err){
    el(typingId)?.remove();
    renderCompanionMsg('assistant','Aiyo, konjam problem வந்துச்சு 🙏 Try pannunga again.');
  }
  scheduleCompanionNudge();
});
