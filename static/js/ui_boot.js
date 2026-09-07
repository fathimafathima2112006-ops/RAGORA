/* RAGORA UI boot/recovery layer.
   Current chat.js calls renderView('chat') but does not define renderView.
   This file restores the router and binds dynamic upload/chunk controls. */
(function(){
  const E=id=>document.getElementById(id);
  const toastMsg=(m,k='ok')=>{
    const t=E('toast'); if(!t)return;
    t.textContent=m;t.className=`toast show ${k}`;
    clearTimeout(window.__ragoraToast);
    window.__ragoraToast=setTimeout(()=>t.className='toast',3200);
  };
  const setCrumb=v=>{
    const labels={chat:'AI Chat',dashboard:'Dashboard',knowledge:'Knowledge Bases',documents:'Documents',chunks:'Chunk Explorer',retrieval:'Retrieval Explorer',analytics:'Analytics & Evaluation',history:'Chat History',settings:'Settings'};
    if(E('pageCrumb'))E('pageCrumb').textContent=labels[v]||'RAGORA';
  };
  async function uploadFiles(files){
    const list=Array.from(files||[]); if(!list.length)return;
    const input=E('fileInput'); let ok=0;
    for(const file of list){
      const fd=new FormData(); fd.append('file',file);
      try{
        toastMsg(`Uploading ${file.name}…`);
        const r=await fetch('/api/documents/upload',{method:'POST',body:fd});
        let d={}; try{d=await r.json()}catch{}
        if(!r.ok)throw new Error(d.error||`Upload failed (${r.status})`);
        ok++; toastMsg(`${file.name} indexed • ${d.chunks||0} chunks`);
      }catch(e){toastMsg(`${file.name}: ${e.message}`,'error')}
    }
    if(input)input.value='';
    if(ok)await window.renderView('documents');
  }
  function bindUpload(){
    const input=E('fileInput');
    ['docUpload','docUpload2','kbUpload','kbUpload2'].forEach(id=>E(id)?.addEventListener('click',()=>input?.click()));
    if(input){input.multiple=true;input.onchange=()=>uploadFiles(input.files)}
  }
  function bindCommon(){
    document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>window.renderView(b.dataset.go));
    document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{
      if(!confirm('Delete this document?'))return;
      try{await fetch(`/api/documents/${b.dataset.delete}`,{method:'DELETE'});toastMsg('Document deleted');await window.renderView(state.view)}
      catch(e){toastMsg(e.message,'error')}
    });
    document.querySelectorAll('[data-chunks]').forEach(b=>b.onclick=()=>{state.selectedDocId=+b.dataset.chunks;window.renderView('chunks')});
    bindUpload();
  }
  async function renderView(view){
    state.view=view; setCrumb(view);
    const host=E('appView'); if(!host)return;
    try{
      if(view==='chat'){
        host.innerHTML=chatView();
        try{await loadConversations();renderConversationList()}catch(e){toastMsg('Conversation history unavailable','error')}
        bindChat(); return;
      }
      if(view==='dashboard')host.innerHTML=await dashboardView();
      else if(view==='knowledge')host.innerHTML=await knowledgeView();
      else if(view==='documents')host.innerHTML=await documentsView();
      else if(view==='chunks'){host.innerHTML=await chunksView();await bindChunks()}
      else if(view==='retrieval'){
        host.innerHTML=`${layout('Retrieval Explorer','See how RAGORA ranks evidence for a question.','')}<div class="panel" style="max-width:900px;margin:auto"><div class="composer-shell"><input id="retrievalQuestion" class="search-input" placeholder="Ask a retrieval question…"><div style="display:flex;gap:10px;margin-top:12px"><input id="retrievalK" type="number" min="1" max="8" value="3"><button class="btn primary" id="runRetrievalBtn">Run retrieval</button></div></div><div id="retrievalResult" style="margin-top:16px"></div></div>`;
        E('runRetrievalBtn')?.addEventListener('click',runRetrieval);
      }else if(view==='analytics')host.innerHTML=`${layout('Analytics & Evaluation','Measure your knowledge pipeline and retrieval quality.','')}<div class="metrics">${metric('Evaluation','Ready','Run retrieval evaluation','◒')}${metric('Pipeline','Live','Hybrid retrieval','⌁')}</div>`;
      else if(view==='history'){
        await loadConversations();
        host.innerHTML=`${layout('Chat History','Review your previous grounded conversations.','')}<div class="panel">${state.conversations.map(c=>`<button class="conv-item" data-history-id="${c.id}"><b>${esc(c.title)}</b><small>${esc(c.created_at||'')}</small></button>`).join('')||empty('No chat history','Start a conversation from AI Chat.')}</div>`;
        host.querySelectorAll('[data-history-id]').forEach(b=>b.onclick=()=>openConversation(+b.dataset.historyId));
      }else if(view==='settings'){
        host.innerHTML=`${layout('Settings','Manage your RAGORA workspace preferences.','')}<div class="panel" style="max-width:760px"><div class="panel-title"><span>APPEARANCE</span></div><p class="panel-note">Use the theme button in the top-right to switch between light and dark mode.</p><button class="btn secondary" id="settingsTheme">Toggle theme</button></div>`;
      }
      bindCommon();
      E('settingsTheme')?.addEventListener('click',()=>theme());
    }catch(e){
      console.error(e);
      host.innerHTML=`<div class="empty-state" style="margin:auto"><div class="empty-icon">!</div><h3>RAGORA view could not load</h3><p>${esc(e.message)}</p><button class="btn primary" onclick="renderView('chat')">Back to AI Chat</button></div>`;
      toastMsg(e.message,'error');
    }
  }
  window.renderView=renderView;
  window.RAGORA_UPLOAD=uploadFiles;
  E('themeToggle')?.addEventListener('click',()=>applyTheme(document.body.classList.contains('theme-light')?'dark':'light'));
  applyTheme(localStorage.getItem('ragora-theme')||'dark');
  renderView('chat');
})();