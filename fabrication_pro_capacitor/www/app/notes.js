  // ---------------- Fabricator Notes ----------------
  const FABRICATOR_NOTES_KEY = 'fabricationFabricatorNotesV1';
  const FABRICATOR_NOTES_FORMAT = 'FabricationFabricatorNotes';
  const FABRICATOR_NOTES_VERSION = 2;
  const MAX_FABRICATOR_NOTE_TOPICS = 200;
  const MAX_FABRICATOR_NOTE_TITLE = 120;
  const MAX_FABRICATOR_NOTE_CONTENT = 200000;
  const MAX_FABRICATOR_NOTE_HTML = 600000;
  const MAX_FABRICATOR_NOTES_IMPORT_BYTES = 2 * 1024 * 1024;

  const fabricatorNotesNewBtn = document.getElementById('fabricatorNotesNewBtn');
  const fabricatorNotesExportBtn = document.getElementById('fabricatorNotesExportBtn');
  const fabricatorNotesImportBtn = document.getElementById('fabricatorNotesImportBtn');
  const fabricatorNotesImportFile = document.getElementById('fabricatorNotesImportFile');
  const fabricatorNotesStatus = document.getElementById('fabricatorNotesStatus');
  const fabricatorNotesCount = document.getElementById('fabricatorNotesCount');
  const fabricatorNotesTopicList = document.getElementById('fabricatorNotesTopicList');
  const fabricatorNotesEmpty = document.getElementById('fabricatorNotesEmpty');
  const fabricatorNotesEditor = document.getElementById('fabricatorNotesEditor');
  const fabricatorNotesTitle = document.getElementById('fabricatorNotesTitle');
  const fabricatorNotesContent = document.getElementById('fabricatorNotesContent');
  const fabricatorNotesFormatToolbar = document.getElementById('fabricatorNotesFormatToolbar');
  const fabricatorNotesFormatButtons = Array.from(fabricatorNotesFormatToolbar.querySelectorAll('[data-notes-command]'));
  const fabricatorNotesSaveState = document.getElementById('fabricatorNotesSaveState');
  const fabricatorNotesDeleteBtn = document.getElementById('fabricatorNotesDeleteBtn');

  let fabricatorNotes = [];
  let fabricatorNotesActiveId = null;
  let fabricatorNotesNextId = 1;
  let fabricatorNotesSaveTimer = null;
  let fabricatorNotesSavedSelection = null;

  function fabricatorNotesNow() {
    return new Date().toISOString();
  }

  function escapeFabricatorNotesText(text) {
    return String(text).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function plainTextToFabricatorNoteHtml(text) {
    return escapeFabricatorNotesText(String(text || '')).replace(/\r\n?/g,'\n').replace(/\n/g,'<br>');
  }

  function sanitizeFabricatorNoteHtml(html) {
    const source = document.createElement('template');
    source.innerHTML = String(html || '');
    const allowed = new Set(['B','STRONG','I','EM','U','BR','DIV','P']);
    const out = document.createElement('div');

    function appendClean(node,parent) {
      if (node.nodeType === Node.TEXT_NODE) {
        parent.appendChild(document.createTextNode(node.nodeValue || ''));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toUpperCase();
      if (allowed.has(tag)) {
        const normalizedTag = tag === 'STRONG' ? 'b' : tag === 'EM' ? 'i' : tag.toLowerCase();
        const clean = document.createElement(normalizedTag);
        for (const child of node.childNodes) appendClean(child,clean);
        parent.appendChild(clean);
      } else {
        for (const child of node.childNodes) appendClean(child,parent);
      }
    }

    for (const node of source.content.childNodes) appendClean(node,out);
    return out.innerHTML;
  }

  function fabricatorNotePlainTextLength(html) {
    const holder = document.createElement('div');
    holder.innerHTML = String(html || '');
    return (holder.textContent || '').length;
  }

  function migrateFabricatorNotesV1ToV2(raw) {
    const data=raw && raw.fabricatorNotes ? raw.fabricatorNotes : raw;
    if (!data || typeof data!=='object' || Array.isArray(data)) throw new Error('The file does not contain valid Fabricator Notes data.');
    if (!Array.isArray(data.topics)) throw new Error('The Fabricator Notes file is missing its topics list.');
    return {
      ...data,
      version:2,
      topics:data.topics.map((topic,index)=>{
        if (!topic || typeof topic!=='object' || Array.isArray(topic)) throw new Error(`Topic ${index+1} is invalid.`);
        if (typeof topic.content!=='string') throw new Error(`Topic ${index+1} has invalid note content.`);
        if (topic.content.length>MAX_FABRICATOR_NOTE_CONTENT) throw new Error(`Topic ${index+1} content exceeds ${MAX_FABRICATOR_NOTE_CONTENT.toLocaleString()} characters.`);
        const {content,...rest}=topic;
        return {...rest,contentHtml:plainTextToFabricatorNoteHtml(content)};
      })
    };
  }

  function normalizeFabricatorNotesRecord(raw) {
    const data = raw && raw.fabricatorNotes ? raw.fabricatorNotes : raw;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The file does not contain valid Fabricator Notes data.');
    if (data.format && data.format !== FABRICATOR_NOTES_FORMAT) throw new Error('This JSON file is not a Fabricator Notes export.');
    const version = Number(data.version || 1);
    if (!Number.isInteger(version) || version < 1) throw new Error('The Fabricator Notes file has an invalid version number.');
    if (version > FABRICATOR_NOTES_VERSION) throw new Error('These Fabricator Notes were created by a newer version of Fabrication Calculators and cannot be safely imported here.');
    if (version===1) return normalizeFabricatorNotesRecord(migrateFabricatorNotesV1ToV2(data));
    if (!Array.isArray(data.topics)) throw new Error('The Fabricator Notes file is missing its topics list.');
    if (data.topics.length > MAX_FABRICATOR_NOTE_TOPICS) throw new Error(`The file contains more than ${MAX_FABRICATOR_NOTE_TOPICS} topics.`);

    const ids = new Set();
    const topics = data.topics.map((topic,index) => {
      if (!topic || typeof topic !== 'object' || Array.isArray(topic)) throw new Error(`Topic ${index+1} is invalid.`);
      const id = Number(topic.id);
      if (!Number.isInteger(id) || id < 1 || ids.has(id)) throw new Error(`Topic ${index+1} has an invalid or duplicate ID.`);
      ids.add(id);
      if (typeof topic.title !== 'string') throw new Error(`Topic ${index+1} has an invalid title.`);
      const title = topic.title.trim();
      if (!title) throw new Error(`Topic ${index+1} is missing a title.`);
      if (title.length > MAX_FABRICATOR_NOTE_TITLE) throw new Error(`Topic ${index+1} title exceeds ${MAX_FABRICATOR_NOTE_TITLE} characters.`);

      let contentHtml;
      if (version >= 2) {
        const rawHtml = topic.contentHtml ?? topic.content;
        if (typeof rawHtml !== 'string') throw new Error(`Topic ${index+1} has invalid note content.`);
        if (rawHtml.length > MAX_FABRICATOR_NOTE_HTML) throw new Error(`Topic ${index+1} formatted content is too large.`);
        contentHtml = sanitizeFabricatorNoteHtml(rawHtml);
      } else {
        if (typeof topic.content !== 'string') throw new Error(`Topic ${index+1} has invalid note content.`);
        if (topic.content.length > MAX_FABRICATOR_NOTE_CONTENT) throw new Error(`Topic ${index+1} content exceeds ${MAX_FABRICATOR_NOTE_CONTENT.toLocaleString()} characters.`);
        contentHtml = plainTextToFabricatorNoteHtml(topic.content);
      }
      if (contentHtml.length > MAX_FABRICATOR_NOTE_HTML || fabricatorNotePlainTextLength(contentHtml) > MAX_FABRICATOR_NOTE_CONTENT) {
        throw new Error(`Topic ${index+1} content exceeds the Fabricator Notes size limit.`);
      }

      const createdAt = typeof topic.createdAt === 'string' && Number.isFinite(Date.parse(topic.createdAt)) ? topic.createdAt : fabricatorNotesNow();
      const updatedAt = typeof topic.updatedAt === 'string' && Number.isFinite(Date.parse(topic.updatedAt)) ? topic.updatedAt : createdAt;
      return {id,title,contentHtml,createdAt,updatedAt};
    });

    const maxId = topics.reduce((max,topic)=>Math.max(max,topic.id),0);
    const requestedActive = Number(data.activeTopicId);
    const activeTopicId = topics.some(topic=>topic.id===requestedActive) ? requestedActive : (topics[0]?.id ?? null);
    const requestedNext = Number(data.nextId);
    const nextId = Math.max(maxId+1, Number.isInteger(requestedNext) && requestedNext > 0 ? requestedNext : 1);
    return {format:FABRICATOR_NOTES_FORMAT,version:FABRICATOR_NOTES_VERSION,activeTopicId,nextId,topics};
  }

  function serializeFabricatorNotesRecord() {
    const now = fabricatorNotesNow();
    return {
      format:FABRICATOR_NOTES_FORMAT,
      version:FABRICATOR_NOTES_VERSION,
      exportedAt:now,
      activeTopicId:fabricatorNotesActiveId,
      nextId:fabricatorNotesNextId,
      topics:fabricatorNotes.map(topic=>({
        id:topic.id,
        title:(String(topic.title || '').trim() || 'Untitled Topic').slice(0,MAX_FABRICATOR_NOTE_TITLE),
        contentHtml:sanitizeFabricatorNoteHtml(String(topic.contentHtml || '')).slice(0,MAX_FABRICATOR_NOTE_HTML),
        createdAt:topic.createdAt || now,
        updatedAt:topic.updatedAt || now
      }))
    };
  }

  function showFabricatorNotesStatus(message,type='ok') {
    fabricatorNotesStatus.textContent = message;
    fabricatorNotesStatus.className = `status show ${type}`;
  }

  function clearFabricatorNotesStatus() {
    fabricatorNotesStatus.textContent = '';
    fabricatorNotesStatus.className = 'status';
  }

  function activeFabricatorNote() {
    return fabricatorNotes.find(topic=>topic.id===fabricatorNotesActiveId) || null;
  }

  function formatFabricatorNoteUpdated(iso) {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return 'Saved';
    return `Updated ${date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`;
  }

  registerPersistentStore({
    id:'fabricatorNotes',key:FABRICATOR_NOTES_KEY,version:FABRICATOR_NOTES_VERSION,encoding:'json',label:'Fabricator Notes',
    defaultValue:()=>({format:FABRICATOR_NOTES_FORMAT,version:FABRICATOR_NOTES_VERSION,activeTopicId:null,nextId:1,topics:[]}),
    getVersion:value=>Number(value?.version || 1),
    migrations:{1:migrateFabricatorNotesV1ToV2},
    normalize:value=>{
      const data=value && value.fabricatorNotes ? value.fabricatorNotes : value;
      if (Number(data?.version)!==FABRICATOR_NOTES_VERSION) throw new Error('Fabricator Notes did not reach the current schema version.');
      return normalizeFabricatorNotesRecord(data);
    }
  });

  function persistFabricatorNotes(showError=true) {
    if (fabricatorNotesSaveTimer) {
      clearTimeout(fabricatorNotesSaveTimer);
      fabricatorNotesSaveTimer = null;
    }
    try {
      writePersistentStore('fabricatorNotes',serializeFabricatorNotesRecord());
      fabricatorNotesSaveState.textContent = 'Saved on this device';
      return true;
    } catch (error) {
      fabricatorNotesSaveState.textContent = 'Unable to save locally';
      if (showError) showFabricatorNotesStatus('This browser could not save Fabricator Notes locally. Export your notes as a backup file.','error');
      return false;
    }
  }

  function scheduleFabricatorNotesSave() {
    fabricatorNotesSaveState.textContent = 'Saving…';
    if (fabricatorNotesSaveTimer) clearTimeout(fabricatorNotesSaveTimer);
    fabricatorNotesSaveTimer = setTimeout(()=>persistFabricatorNotes(true),250);
  }

  function renderFabricatorNotesTopics() {
    fabricatorNotesCount.textContent = fabricatorNotes.length;
    fabricatorNotesExportBtn.disabled = fabricatorNotes.length===0;
    fabricatorNotesTopicList.innerHTML = '';
    if (!fabricatorNotes.length) {
      const empty = document.createElement('div');
      empty.className = 'notes-empty';
      empty.textContent = 'No topics yet.';
      fabricatorNotesTopicList.appendChild(empty);
      return;
    }
    const ordered = fabricatorNotes.slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.id-b.id);
    for (const topic of ordered) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `notes-topic-item${topic.id===fabricatorNotesActiveId?' active':''}`;
      button.dataset.noteTopicId = String(topic.id);
      button.setAttribute('aria-pressed',topic.id===fabricatorNotesActiveId?'true':'false');
      const title = document.createElement('strong');
      title.textContent = topic.title || 'Untitled Topic';
      const meta = document.createElement('small');
      meta.textContent = formatFabricatorNoteUpdated(topic.updatedAt);
      button.append(title,meta);
      fabricatorNotesTopicList.appendChild(button);
    }
  }

  function renderFabricatorNotesEditor() {
    const topic = activeFabricatorNote();
    fabricatorNotesEmpty.style.display = topic ? 'none' : 'block';
    fabricatorNotesEditor.classList.toggle('show',!!topic);
    if (!topic) {
      fabricatorNotesTitle.value = '';
      fabricatorNotesContent.innerHTML = '';
      fabricatorNotesSavedSelection = null;
      updateFabricatorNotesFormatButtons();
      return;
    }
    fabricatorNotesTitle.value = topic.title;
    fabricatorNotesContent.innerHTML = sanitizeFabricatorNoteHtml(topic.contentHtml || '');
    fabricatorNotesSavedSelection = null;
    fabricatorNotesSaveState.textContent = 'Saved on this device';
    updateFabricatorNotesFormatButtons();
  }

  function renderFabricatorNotes() {
    renderFabricatorNotesTopics();
    renderFabricatorNotesEditor();
  }

  function createFabricatorNoteTopic() {
    clearFabricatorNotesStatus();
    if (fabricatorNotes.length >= MAX_FABRICATOR_NOTE_TOPICS) {
      showFabricatorNotesStatus(`Fabricator Notes supports up to ${MAX_FABRICATOR_NOTE_TOPICS} topics.`,'error');
      return;
    }
    const now = fabricatorNotesNow();
    const topic = {id:fabricatorNotesNextId++,title:'New Topic',contentHtml:'',createdAt:now,updatedAt:now};
    fabricatorNotes.push(topic);
    fabricatorNotesActiveId = topic.id;
    persistFabricatorNotes();
    renderFabricatorNotes();
    requestAnimationFrame(()=>{ fabricatorNotesTitle.focus(); fabricatorNotesTitle.select(); });
  }

  function selectFabricatorNoteTopic(id) {
    if (!fabricatorNotes.some(topic=>topic.id===id)) return;
    fabricatorNotesActiveId = id;
    persistFabricatorNotes(false);
    renderFabricatorNotes();
  }

  function updateActiveFabricatorNoteTitle(value) {
    const topic = activeFabricatorNote();
    if (!topic) return;
    topic.title = String(value).slice(0,MAX_FABRICATOR_NOTE_TITLE);
    topic.updatedAt = fabricatorNotesNow();
    renderFabricatorNotesTopics();
    scheduleFabricatorNotesSave();
  }

  function normalizeActiveFabricatorNoteTitle() {
    const topic = activeFabricatorNote();
    if (!topic) return;
    const clean = String(topic.title || '').trim() || 'Untitled Topic';
    topic.title = clean.slice(0,MAX_FABRICATOR_NOTE_TITLE);
    fabricatorNotesTitle.value = topic.title;
    topic.updatedAt = fabricatorNotesNow();
    renderFabricatorNotesTopics();
    persistFabricatorNotes();
  }

  function updateActiveFabricatorNoteContent() {
    const topic = activeFabricatorNote();
    if (!topic) return;
    const cleanHtml = sanitizeFabricatorNoteHtml(fabricatorNotesContent.innerHTML);
    if (cleanHtml.length > MAX_FABRICATOR_NOTE_HTML || fabricatorNotePlainTextLength(cleanHtml) > MAX_FABRICATOR_NOTE_CONTENT) {
      fabricatorNotesContent.innerHTML = sanitizeFabricatorNoteHtml(topic.contentHtml || '');
      fabricatorNotesSavedSelection = null;
      showFabricatorNotesStatus(`Note content is limited to ${MAX_FABRICATOR_NOTE_CONTENT.toLocaleString()} text characters.`,'error');
      return;
    }
    topic.contentHtml = cleanHtml;
    topic.updatedAt = fabricatorNotesNow();
    scheduleFabricatorNotesSave();
  }

  function notesSelectionIsInsideEditor(range) {
    if (!range) return false;
    const node = range.commonAncestorContainer;
    return node === fabricatorNotesContent || fabricatorNotesContent.contains(node.nodeType===Node.ELEMENT_NODE ? node : node.parentNode);
  }

  function rememberFabricatorNotesSelection() {
    const selection = window.getSelection && window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (notesSelectionIsInsideEditor(range)) fabricatorNotesSavedSelection = range.cloneRange();
  }

  function restoreFabricatorNotesSelection() {
    if (!fabricatorNotesSavedSelection) return false;
    const selection = window.getSelection && window.getSelection();
    if (!selection) return false;
    try {
      selection.removeAllRanges();
      selection.addRange(fabricatorNotesSavedSelection);
      return true;
    } catch (error) {
      fabricatorNotesSavedSelection = null;
      return false;
    }
  }

  function updateFabricatorNotesFormatButtons() {
    const selection = window.getSelection && window.getSelection();
    const hasEditorSelection = !!(selection && selection.rangeCount && notesSelectionIsInsideEditor(selection.getRangeAt(0)));
    for (const button of fabricatorNotesFormatButtons) {
      let active = false;
      if (hasEditorSelection) {
        try { active = !!document.queryCommandState(button.dataset.notesCommand); } catch (error) {}
      }
      button.setAttribute('aria-pressed',active?'true':'false');
    }
  }

  function applyFabricatorNotesFormat(command) {
    const topic = activeFabricatorNote();
    if (!topic || !['bold','italic','underline'].includes(command)) return;
    fabricatorNotesContent.focus({preventScroll:true});
    restoreFabricatorNotesSelection();
    try { document.execCommand('styleWithCSS',false,false); } catch (error) {}
    try { document.execCommand(command,false,null); } catch (error) { return; }
    rememberFabricatorNotesSelection();
    updateActiveFabricatorNoteContent();
    updateFabricatorNotesFormatButtons();
  }

  function deleteActiveFabricatorNote() {
    const topic = activeFabricatorNote();
    if (!topic) return;
    if (!window.confirm(`Delete the topic “${topic.title || 'Untitled Topic'}”? This cannot be undone unless you have an exported backup.`)) return;
    const index = fabricatorNotes.findIndex(item=>item.id===topic.id);
    fabricatorNotes.splice(index,1);
    const remaining = fabricatorNotes.slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.id-b.id);
    fabricatorNotesActiveId = remaining[0]?.id ?? null;
    persistFabricatorNotes();
    renderFabricatorNotes();
    showFabricatorNotesStatus('Topic deleted.','ok');
  }

  function safeFabricatorNotesExportName() {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    return `Fabricator-Notes-${y}-${m}-${d}.json`;
  }

  function exportFabricatorNotes() {
    clearFabricatorNotesStatus();
    if (!fabricatorNotes.length) {
      showFabricatorNotesStatus('Create at least one topic before exporting notes.','error');
      return;
    }
    normalizeActiveFabricatorNoteTitle();
    const payload = {fabricatorNotes:serializeFabricatorNotesRecord()};
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFabricatorNotesExportName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    showFabricatorNotesStatus(`Exported ${fabricatorNotes.length} topic${fabricatorNotes.length===1?'':'s'} as a portable JSON backup.`,'ok');
  }

  function applyFabricatorNotesRecord(record) {
    fabricatorNotes = record.topics.map(topic=>({...topic}));
    fabricatorNotesActiveId = record.activeTopicId;
    fabricatorNotesNextId = record.nextId;
    persistFabricatorNotes();
    renderFabricatorNotes();
  }

  function importFabricatorNotesFile(file) {
    if (!file) return;
    clearFabricatorNotesStatus();
    if (file.size > MAX_FABRICATOR_NOTES_IMPORT_BYTES) {
      showFabricatorNotesStatus(`That notes file is too large. Maximum import size is ${Math.round(MAX_FABRICATOR_NOTES_IMPORT_BYTES/1024/1024)} MB.`,'error');
      fabricatorNotesImportFile.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const record = normalizeFabricatorNotesRecord(parsed);
        if (fabricatorNotes.length && !window.confirm(`Import ${record.topics.length} topic${record.topics.length===1?'':'s'} and replace the Fabricator Notes currently saved on this device?`)) return;
        if (fabricatorNotes.length) await requireRecoverySnapshot('before-notes-import');
        applyFabricatorNotesRecord(record);
        showFabricatorNotesStatus(`Imported ${record.topics.length} topic${record.topics.length===1?'':'s'} and saved them on this device.`,'ok');
      } catch (error) {
        showFabricatorNotesStatus(error.message || 'Unable to import that Fabricator Notes file.','error');
      } finally {
        fabricatorNotesImportFile.value = '';
      }
    };
    reader.onerror = () => {
      showFabricatorNotesStatus('The selected Fabricator Notes file could not be read.','error');
      fabricatorNotesImportFile.value = '';
    };
    reader.readAsText(file);
  }

  function loadFabricatorNotesFromStorage() {
    const result=loadPersistentStore('fabricatorNotes');
    const record=result.value;
    fabricatorNotes=record.topics.map(topic=>({...topic}));
    fabricatorNotesActiveId=record.activeTopicId;
    fabricatorNotesNextId=record.nextId;
    if (result.status==='invalid' || result.status==='unsupported') {
      showFabricatorNotesStatus('Saved Fabricator Notes data could not be read. The original saved data was retained for recovery.','error');
    }
    renderFabricatorNotes();
  }

  fabricatorNotesNewBtn.addEventListener('click',createFabricatorNoteTopic);
  fabricatorNotesExportBtn.addEventListener('click',exportFabricatorNotes);
  fabricatorNotesImportBtn.addEventListener('click',()=>fabricatorNotesImportFile.click());
  fabricatorNotesImportFile.addEventListener('change',()=>importFabricatorNotesFile(fabricatorNotesImportFile.files && fabricatorNotesImportFile.files[0]));
  fabricatorNotesTopicList.addEventListener('click',event=>{
    const button = event.target.closest('[data-note-topic-id]');
    if (button) selectFabricatorNoteTopic(Number(button.dataset.noteTopicId));
  });
  fabricatorNotesTitle.addEventListener('input',()=>updateActiveFabricatorNoteTitle(fabricatorNotesTitle.value));
  fabricatorNotesTitle.addEventListener('blur',normalizeActiveFabricatorNoteTitle);
  fabricatorNotesContent.addEventListener('input',()=>{ updateActiveFabricatorNoteContent(); rememberFabricatorNotesSelection(); updateFabricatorNotesFormatButtons(); });
  fabricatorNotesContent.addEventListener('focus',()=>{ rememberFabricatorNotesSelection(); updateFabricatorNotesFormatButtons(); });
  fabricatorNotesContent.addEventListener('keyup',()=>{ rememberFabricatorNotesSelection(); updateFabricatorNotesFormatButtons(); });
  fabricatorNotesContent.addEventListener('pointerup',()=>{ rememberFabricatorNotesSelection(); updateFabricatorNotesFormatButtons(); });
  fabricatorNotesContent.addEventListener('blur',()=>persistFabricatorNotes(false));
  fabricatorNotesContent.addEventListener('paste',event=>{
    const text = event.clipboardData && event.clipboardData.getData('text/plain');
    if (typeof text !== 'string') return;
    event.preventDefault();
    fabricatorNotesContent.focus({preventScroll:true});
    try { document.execCommand('insertText',false,text); }
    catch (error) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(text);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    updateActiveFabricatorNoteContent();
    rememberFabricatorNotesSelection();
  });
  for (const button of fabricatorNotesFormatButtons) {
    button.addEventListener('mousedown',event=>event.preventDefault());
    button.addEventListener('click',()=>applyFabricatorNotesFormat(button.dataset.notesCommand));
  }
  document.addEventListener('selectionchange',()=>{
    const selection = window.getSelection && window.getSelection();
    if (selection && selection.rangeCount && notesSelectionIsInsideEditor(selection.getRangeAt(0))) {
      rememberFabricatorNotesSelection();
      updateFabricatorNotesFormatButtons();
    }
  });
  fabricatorNotesDeleteBtn.addEventListener('click',deleteActiveFabricatorNote);
  window.addEventListener('beforeunload',()=>{ if (fabricatorNotesSaveTimer) persistFabricatorNotes(false); });
  loadFabricatorNotesFromStorage();

