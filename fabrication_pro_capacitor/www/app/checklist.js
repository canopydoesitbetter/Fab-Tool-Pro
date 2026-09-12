  // ---------------- Checklist ----------------
  const FABRICATION_CHECKLIST_KEY = 'fabricationChecklistV1';
  const FABRICATION_CHECKLIST_FORMAT = 'FabricationChecklist';
  const FABRICATION_CHECKLIST_VERSION = 1;
  const MAX_CHECKLIST_TOPICS = 200;
  const MAX_CHECKLIST_ITEMS_PER_TOPIC = 500;
  const MAX_CHECKLIST_TITLE = 120;
  const MAX_CHECKLIST_ITEM_TEXT = 240;
  const MAX_CHECKLIST_IMPORT_BYTES = 2 * 1024 * 1024;

  const checklistNewTopicBtn = document.getElementById('checklistNewTopicBtn');
  const checklistExportBtn = document.getElementById('checklistExportBtn');
  const checklistImportBtn = document.getElementById('checklistImportBtn');
  const checklistImportFile = document.getElementById('checklistImportFile');
  const checklistStatus = document.getElementById('checklistStatus');
  const checklistTopicCount = document.getElementById('checklistTopicCount');
  const checklistTopicList = document.getElementById('checklistTopicList');
  const checklistEmpty = document.getElementById('checklistEmpty');
  const checklistEditor = document.getElementById('checklistEditor');
  const checklistTitle = document.getElementById('checklistTitle');
  const checklistNewItem = document.getElementById('checklistNewItem');
  const checklistAddItemBtn = document.getElementById('checklistAddItemBtn');
  const checklistProgressFill = document.getElementById('checklistProgressFill');
  const checklistProgressText = document.getElementById('checklistProgressText');
  const checklistItems = document.getElementById('checklistItems');
  const checklistSaveState = document.getElementById('checklistSaveState');
  const checklistDeleteTopicBtn = document.getElementById('checklistDeleteTopicBtn');

  let fabricationChecklists = [];
  let checklistActiveTopicId = null;
  let checklistNextTopicId = 1;
  let checklistNextItemId = 1;
  let checklistSaveTimer = null;
  let checklistDragState = null;
  let checklistDragAutoScrollFrame = null;

  function checklistNow() { return new Date().toISOString(); }

  function showChecklistStatus(message,type='ok') {
    checklistStatus.textContent = message;
    checklistStatus.className = `status show ${type}`;
  }

  function clearChecklistStatus() {
    checklistStatus.textContent = '';
    checklistStatus.className = 'status';
  }

  function activeChecklistTopic() {
    return fabricationChecklists.find(topic=>topic.id===checklistActiveTopicId) || null;
  }

  function normalizeChecklistRecord(raw) {
    const data = raw && raw.fabricationChecklist ? raw.fabricationChecklist : raw;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The file does not contain valid Checklist data.');
    if (data.format && data.format !== FABRICATION_CHECKLIST_FORMAT) throw new Error('This JSON file is not a Fabrication Checklist export.');
    const version = Number(data.version || 1);
    if (!Number.isInteger(version) || version < 1) throw new Error('The Checklist file has an invalid version number.');
    if (version > FABRICATION_CHECKLIST_VERSION) throw new Error('These checklists were created by a newer version of Fabrication Calculators and cannot be safely imported here.');
    if (!Array.isArray(data.topics)) throw new Error('The Checklist file is missing its topics list.');
    if (data.topics.length > MAX_CHECKLIST_TOPICS) throw new Error(`The file contains more than ${MAX_CHECKLIST_TOPICS} checklist topics.`);

    const topicIds = new Set();
    const itemIds = new Set();
    const topics = data.topics.map((topic,index)=>{
      if (!topic || typeof topic !== 'object' || Array.isArray(topic)) throw new Error(`Checklist topic ${index+1} is invalid.`);
      const id = Number(topic.id);
      if (!Number.isInteger(id) || id < 1 || topicIds.has(id)) throw new Error(`Checklist topic ${index+1} has an invalid or duplicate ID.`);
      topicIds.add(id);
      if (typeof topic.title !== 'string') throw new Error(`Checklist topic ${index+1} has an invalid title.`);
      const title = topic.title.trim();
      if (!title) throw new Error(`Checklist topic ${index+1} is missing a title.`);
      if (title.length > MAX_CHECKLIST_TITLE) throw new Error(`Checklist topic ${index+1} title exceeds ${MAX_CHECKLIST_TITLE} characters.`);
      if (!Array.isArray(topic.items)) throw new Error(`Checklist topic ${index+1} is missing its items list.`);
      if (topic.items.length > MAX_CHECKLIST_ITEMS_PER_TOPIC) throw new Error(`Checklist topic ${index+1} contains more than ${MAX_CHECKLIST_ITEMS_PER_TOPIC} items.`);
      const items = topic.items.map((item,itemIndex)=>{
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`Item ${itemIndex+1} in checklist topic ${index+1} is invalid.`);
        const itemId = Number(item.id);
        if (!Number.isInteger(itemId) || itemId < 1 || itemIds.has(itemId)) throw new Error(`Item ${itemIndex+1} in checklist topic ${index+1} has an invalid or duplicate ID.`);
        itemIds.add(itemId);
        if (typeof item.text !== 'string') throw new Error(`Item ${itemIndex+1} in checklist topic ${index+1} has invalid text.`);
        const text = item.text.trim();
        if (!text) throw new Error(`Item ${itemIndex+1} in checklist topic ${index+1} is blank.`);
        if (text.length > MAX_CHECKLIST_ITEM_TEXT) throw new Error(`Item ${itemIndex+1} in checklist topic ${index+1} exceeds ${MAX_CHECKLIST_ITEM_TEXT} characters.`);
        return {id:itemId,text,checked:item.checked===true};
      });
      const createdAt = typeof topic.createdAt === 'string' && Number.isFinite(Date.parse(topic.createdAt)) ? topic.createdAt : checklistNow();
      const updatedAt = typeof topic.updatedAt === 'string' && Number.isFinite(Date.parse(topic.updatedAt)) ? topic.updatedAt : createdAt;
      return {id,title,items,createdAt,updatedAt};
    });

    const maxTopicId = topics.reduce((max,topic)=>Math.max(max,topic.id),0);
    const maxItemId = topics.reduce((max,topic)=>Math.max(max,...topic.items.map(item=>item.id),0),0);
    const requestedActive = Number(data.activeTopicId);
    const activeTopicId = topics.some(topic=>topic.id===requestedActive) ? requestedActive : (topics[0]?.id ?? null);
    const requestedNextTopic = Number(data.nextTopicId);
    const requestedNextItem = Number(data.nextItemId);
    const nextTopicId = Math.max(maxTopicId+1,Number.isInteger(requestedNextTopic)&&requestedNextTopic>0?requestedNextTopic:1);
    const nextItemId = Math.max(maxItemId+1,Number.isInteger(requestedNextItem)&&requestedNextItem>0?requestedNextItem:1);
    return {format:FABRICATION_CHECKLIST_FORMAT,version:FABRICATION_CHECKLIST_VERSION,activeTopicId,nextTopicId,nextItemId,topics};
  }

  function serializeChecklistRecord() {
    return {
      format:FABRICATION_CHECKLIST_FORMAT,
      version:FABRICATION_CHECKLIST_VERSION,
      exportedAt:checklistNow(),
      activeTopicId:checklistActiveTopicId,
      nextTopicId:checklistNextTopicId,
      nextItemId:checklistNextItemId,
      topics:fabricationChecklists.map(topic=>({
        id:topic.id,
        title:(String(topic.title || '').trim() || 'Untitled Checklist').slice(0,MAX_CHECKLIST_TITLE),
        items:topic.items.map(item=>({id:item.id,text:String(item.text || '').trim().slice(0,MAX_CHECKLIST_ITEM_TEXT),checked:item.checked===true})),
        createdAt:topic.createdAt,
        updatedAt:topic.updatedAt
      }))
    };
  }

  registerPersistentStore({
    id:'checklists',key:FABRICATION_CHECKLIST_KEY,version:FABRICATION_CHECKLIST_VERSION,encoding:'json',label:'Checklist',
    defaultValue:()=>({format:FABRICATION_CHECKLIST_FORMAT,version:FABRICATION_CHECKLIST_VERSION,activeTopicId:null,nextTopicId:1,nextItemId:1,topics:[]}),
    getVersion:value=>Number(value?.version || 1),
    normalize:normalizeChecklistRecord
  });

  function persistChecklists(showError=true) {
    if (checklistSaveTimer) {
      clearTimeout(checklistSaveTimer);
      checklistSaveTimer = null;
    }
    try {
      writePersistentStore('checklists',serializeChecklistRecord());
      checklistSaveState.textContent = 'Saved on this device';
      return true;
    } catch (error) {
      checklistSaveState.textContent = 'Unable to save locally';
      if (showError) showChecklistStatus('This browser could not save checklists locally. Export them as a backup file.','error');
      return false;
    }
  }

  function scheduleChecklistSave() {
    checklistSaveState.textContent = 'Saving…';
    if (checklistSaveTimer) clearTimeout(checklistSaveTimer);
    checklistSaveTimer = setTimeout(()=>persistChecklists(true),250);
  }

  function checklistUpdatedText(iso) {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return 'Saved';
    return `Updated ${date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`;
  }

  function checklistProgress(topic) {
    const total = topic?.items?.length || 0;
    const checked = topic ? topic.items.filter(item=>item.checked).length : 0;
    return {checked,total,pct:total ? checked/total*100 : 0};
  }

  function renderChecklistTopics() {
    checklistTopicCount.textContent = fabricationChecklists.length;
    checklistExportBtn.disabled = fabricationChecklists.length===0;
    checklistTopicList.innerHTML = '';
    if (!fabricationChecklists.length) {
      const empty = document.createElement('div');
      empty.className = 'checklist-empty';
      empty.textContent = 'No checklist topics yet.';
      checklistTopicList.appendChild(empty);
      return;
    }
    const ordered = fabricationChecklists.slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.id-b.id);
    for (const topic of ordered) {
      const progress = checklistProgress(topic);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `checklist-topic-item${topic.id===checklistActiveTopicId?' active':''}`;
      button.dataset.checklistTopicId = String(topic.id);
      button.setAttribute('aria-pressed',topic.id===checklistActiveTopicId?'true':'false');
      const title = document.createElement('strong');
      title.textContent = topic.title || 'Untitled Checklist';
      const meta = document.createElement('small');
      meta.textContent = `${progress.checked} of ${progress.total} complete • ${checklistUpdatedText(topic.updatedAt)}`;
      button.append(title,meta);
      checklistTopicList.appendChild(button);
    }
  }

  function renderChecklistItems() {
    const topic = activeChecklistTopic();
    checklistItems.innerHTML = '';
    if (!topic || !topic.items.length) {
      const empty = document.createElement('div');
      empty.className = 'checklist-empty';
      empty.textContent = topic ? 'No checklist items yet. Add the first item above.' : '';
      if (topic) checklistItems.appendChild(empty);
    } else {
      for (const item of topic.items) {
        const row = document.createElement('div');
        row.className = `checklist-item${item.checked?' checked':''}`;
        row.dataset.checklistItemId = String(item.id);

        const dragHandle = document.createElement('button');
        dragHandle.type = 'button';
        dragHandle.className = 'checklist-drag-handle';
        dragHandle.setAttribute('data-checklist-drag-id',String(item.id));
        dragHandle.setAttribute('aria-label',`Reorder checklist item: ${item.text}. Drag to move, or use Arrow Up, Arrow Down, Home, or End.`);
        dragHandle.setAttribute('aria-keyshortcuts','ArrowUp ArrowDown Home End');
        dragHandle.setAttribute('aria-pressed','false');
        dragHandle.title = 'Hold and drag to reorder';
        dragHandle.textContent = '☷';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checklist-box';
        checkbox.checked = item.checked;
        checkbox.dataset.checklistToggleId = String(item.id);
        checkbox.setAttribute('aria-label',`${item.checked?'Mark incomplete':'Mark complete'}: ${item.text}`);

        const text = document.createElement('input');
        text.type = 'text';
        text.className = 'checklist-item-text';
        text.maxLength = MAX_CHECKLIST_ITEM_TEXT;
        text.value = item.text;
        text.dataset.checklistTextId = String(item.id);
        text.setAttribute('aria-label','Checklist item');

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'checklist-remove-item';
        remove.dataset.checklistRemoveId = String(item.id);
        remove.setAttribute('aria-label',`Remove checklist item: ${item.text}`);
        remove.textContent = '×';
        row.append(dragHandle,checkbox,text,remove);
        checklistItems.appendChild(row);
      }
    }
    const progress = checklistProgress(topic);
    checklistProgressText.textContent = `${progress.checked} of ${progress.total} complete`;
    checklistProgressFill.style.width = `${progress.pct}%`;
  }

  function renderChecklistEditor() {
    const topic = activeChecklistTopic();
    checklistEmpty.style.display = topic ? 'none' : 'block';
    checklistEditor.classList.toggle('show',!!topic);
    checklistNewItem.disabled = !topic;
    checklistAddItemBtn.disabled = !topic;
    if (!topic) {
      checklistTitle.value = '';
      checklistNewItem.value = '';
      checklistItems.innerHTML = '';
      checklistProgressText.textContent = '0 of 0 complete';
      checklistProgressFill.style.width = '0%';
      return;
    }
    checklistTitle.value = topic.title;
    checklistSaveState.textContent = 'Saved on this device';
    renderChecklistItems();
  }

  function renderChecklists() {
    renderChecklistTopics();
    renderChecklistEditor();
  }

  function createChecklistTopic() {
    clearChecklistStatus();
    if (fabricationChecklists.length >= MAX_CHECKLIST_TOPICS) {
      showChecklistStatus(`Checklist supports up to ${MAX_CHECKLIST_TOPICS} topics.`,'error');
      return;
    }
    const now = checklistNow();
    const topic = {id:checklistNextTopicId++,title:'New Checklist',items:[],createdAt:now,updatedAt:now};
    fabricationChecklists.push(topic);
    checklistActiveTopicId = topic.id;
    persistChecklists();
    renderChecklists();
    requestAnimationFrame(()=>{ checklistTitle.focus(); checklistTitle.select(); });
  }

  function selectChecklistTopic(id) {
    if (!fabricationChecklists.some(topic=>topic.id===id)) return;
    checklistActiveTopicId = id;
    persistChecklists(false);
    renderChecklists();
  }

  function updateChecklistTitle(value) {
    const topic = activeChecklistTopic();
    if (!topic) return;
    topic.title = String(value).slice(0,MAX_CHECKLIST_TITLE);
    topic.updatedAt = checklistNow();
    renderChecklistTopics();
    scheduleChecklistSave();
  }

  function normalizeChecklistTitle() {
    const topic = activeChecklistTopic();
    if (!topic) return;
    topic.title = (String(topic.title || '').trim() || 'Untitled Checklist').slice(0,MAX_CHECKLIST_TITLE);
    topic.updatedAt = checklistNow();
    checklistTitle.value = topic.title;
    renderChecklistTopics();
    persistChecklists();
  }

  function addChecklistItem() {
    clearChecklistStatus();
    const topic = activeChecklistTopic();
    if (!topic) {
      showChecklistStatus('Create a checklist topic first.','error');
      return;
    }
    if (topic.items.length >= MAX_CHECKLIST_ITEMS_PER_TOPIC) {
      showChecklistStatus(`A checklist topic supports up to ${MAX_CHECKLIST_ITEMS_PER_TOPIC} items.`,'error');
      return;
    }
    const text = String(checklistNewItem.value || '').trim();
    if (!text) {
      showChecklistStatus('Enter a checklist item before adding it.','error');
      checklistNewItem.focus();
      return;
    }
    topic.items.push({id:checklistNextItemId++,text:text.slice(0,MAX_CHECKLIST_ITEM_TEXT),checked:false});
    topic.updatedAt = checklistNow();
    checklistNewItem.value = '';
    persistChecklists();
    renderChecklistTopics();
    renderChecklistItems();
    checklistNewItem.focus();
  }

  function focusChecklistDragHandle(id) {
    requestAnimationFrame(()=>{
      const handle=checklistItems.querySelector(`[data-checklist-drag-id="${id}"]`);
      if(handle) handle.focus({preventScroll:true});
    });
  }

  function reorderChecklistItem(id,targetId,before=true) {
    const topic=activeChecklistTopic();
    if(!topic || id===targetId) return false;
    const fromIndex=topic.items.findIndex(item=>item.id===id);
    const originalTargetIndex=topic.items.findIndex(item=>item.id===targetId);
    if(fromIndex<0 || originalTargetIndex<0) return false;
    const originalIds=topic.items.map(item=>item.id);
    const [moved]=topic.items.splice(fromIndex,1);
    const targetIndex=topic.items.findIndex(item=>item.id===targetId);
    const insertIndex=Math.max(0,Math.min(topic.items.length,before?targetIndex:targetIndex+1));
    topic.items.splice(insertIndex,0,moved);
    const changed=topic.items.some((item,index)=>item.id!==originalIds[index]);
    if(!changed) return false;
    topic.updatedAt=checklistNow();
    persistChecklists();
    renderChecklistTopics();
    renderChecklistItems();
    focusChecklistDragHandle(id);
    return true;
  }

  function moveChecklistItem(id,direction) {
    const topic=activeChecklistTopic();
    if(!topic) return false;
    const index=topic.items.findIndex(item=>item.id===id);
    if(index<0 || topic.items.length<2) return false;
    if(direction==='up' && index>0) return reorderChecklistItem(id,topic.items[index-1].id,true);
    if(direction==='down' && index<topic.items.length-1) return reorderChecklistItem(id,topic.items[index+1].id,false);
    if(direction==='start' && index>0) return reorderChecklistItem(id,topic.items[0].id,true);
    if(direction==='end' && index<topic.items.length-1) return reorderChecklistItem(id,topic.items[topic.items.length-1].id,false);
    return false;
  }

  function findChecklistItem(id) {
    const topic = activeChecklistTopic();
    if (!topic) return null;
    return topic.items.find(item=>item.id===id) || null;
  }

  function toggleChecklistItem(id,checked) {
    const topic = activeChecklistTopic();
    const item = findChecklistItem(id);
    if (!topic || !item) return;
    item.checked = !!checked;
    topic.updatedAt = checklistNow();
    persistChecklists();
    renderChecklistTopics();
    renderChecklistItems();
  }

  function updateChecklistItemText(id,value) {
    const topic = activeChecklistTopic();
    const item = findChecklistItem(id);
    if (!topic || !item) return;
    item.text = String(value).slice(0,MAX_CHECKLIST_ITEM_TEXT);
    topic.updatedAt = checklistNow();
    scheduleChecklistSave();
  }

  async function normalizeChecklistItemText(id,input) {
    const topic = activeChecklistTopic();
    const item = findChecklistItem(id);
    if (!topic || !item) return;
    const text = String(item.text || '').trim();
    if (!text) {
      if (!await confirmAppAction('This checklist item is blank. Remove it?')) {
        input.value = 'Checklist Item';
        item.text = 'Checklist Item';
      } else {
        topic.items = topic.items.filter(entry=>entry.id!==id);
      }
    } else {
      item.text = text.slice(0,MAX_CHECKLIST_ITEM_TEXT);
      input.value = item.text;
    }
    topic.updatedAt = checklistNow();
    persistChecklists();
    renderChecklistTopics();
    renderChecklistItems();
  }

  async function removeChecklistItem(id) {
    const topic = activeChecklistTopic();
    const item = findChecklistItem(id);
    if (!topic || !item) return;
    if (!await confirmAppAction(`Remove “${item.text}” from this checklist?`)) return;
    topic.items = topic.items.filter(entry=>entry.id!==id);
    topic.updatedAt = checklistNow();
    persistChecklists();
    renderChecklistTopics();
    renderChecklistItems();
  }

  async function deleteChecklistTopic() {
    const topic = activeChecklistTopic();
    if (!topic) return;
    if (!await confirmAppAction(`Delete the checklist “${topic.title || 'Untitled Checklist'}”? This cannot be undone unless you have an exported backup.`)) return;
    fabricationChecklists = fabricationChecklists.filter(entry=>entry.id!==topic.id);
    const ordered = fabricationChecklists.slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.id-b.id);
    checklistActiveTopicId = ordered[0]?.id ?? null;
    persistChecklists();
    renderChecklists();
    showChecklistStatus('Checklist topic deleted.','ok');
  }

  function checklistExportFileName() {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    return `Fabrication-Checklists-${y}-${m}-${d}.json`;
  }

  function exportChecklists() {
    clearChecklistStatus();
    if (!fabricationChecklists.length) {
      showChecklistStatus('Create at least one checklist topic before exporting.','error');
      return;
    }
    normalizeChecklistTitle();
    const payload = {fabricationChecklist:serializeChecklistRecord()};
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = checklistExportFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    showChecklistStatus(`Exported ${fabricationChecklists.length} checklist topic${fabricationChecklists.length===1?'':'s'} as a portable JSON backup.`,'ok');
  }

  function applyChecklistRecord(record) {
    fabricationChecklists = record.topics.map(topic=>({...topic,items:topic.items.map(item=>({...item}))}));
    checklistActiveTopicId = record.activeTopicId;
    checklistNextTopicId = record.nextTopicId;
    checklistNextItemId = record.nextItemId;
    persistChecklists();
    renderChecklists();
  }

  function importChecklistFile(file) {
    if (!file) return;
    clearChecklistStatus();
    if (file.size > MAX_CHECKLIST_IMPORT_BYTES) {
      showChecklistStatus(`That checklist file is too large. Maximum import size is ${Math.round(MAX_CHECKLIST_IMPORT_BYTES/1024/1024)} MB.`,'error');
      checklistImportFile.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const record = normalizeChecklistRecord(parsed);
        if (fabricationChecklists.length && !await confirmAppAction(`Import ${record.topics.length} checklist topic${record.topics.length===1?'':'s'} and replace the checklists currently saved on this device?`)) return;
        if (fabricationChecklists.length) await requireRecoverySnapshot('before-checklist-import');
        applyChecklistRecord(record);
        showChecklistStatus(`Imported ${record.topics.length} checklist topic${record.topics.length===1?'':'s'} and saved them on this device.`,'ok');
      } catch (error) {
        showChecklistStatus(error.message || 'Unable to import that Checklist file.','error');
      } finally {
        checklistImportFile.value = '';
      }
    };
    reader.onerror = () => {
      showChecklistStatus('The selected Checklist file could not be read.','error');
      checklistImportFile.value = '';
    };
    reader.readAsText(file);
  }

  function loadChecklistsFromStorage() {
    const result=loadPersistentStore('checklists');
    const record=result.value;
    fabricationChecklists=record.topics.map(topic=>({...topic,items:topic.items.map(item=>({...item}))}));
    checklistActiveTopicId=record.activeTopicId;
    checklistNextTopicId=record.nextTopicId;
    checklistNextItemId=record.nextItemId;
    if (result.status==='invalid' || result.status==='unsupported') {
      showChecklistStatus('Saved Checklist data could not be read. The original saved data was retained for recovery.','error');
    }
    renderChecklists();
  }

  checklistNewTopicBtn.addEventListener('click',createChecklistTopic);
  checklistExportBtn.addEventListener('click',exportChecklists);
  checklistImportBtn.addEventListener('click',()=>checklistImportFile.click());
  checklistImportFile.addEventListener('change',()=>importChecklistFile(checklistImportFile.files && checklistImportFile.files[0]));
  checklistTopicList.addEventListener('click',event=>{
    const button = event.target.closest('[data-checklist-topic-id]');
    if (button) selectChecklistTopic(Number(button.dataset.checklistTopicId));
  });
  checklistTitle.addEventListener('input',()=>updateChecklistTitle(checklistTitle.value));
  checklistTitle.addEventListener('blur',normalizeChecklistTitle);
  checklistNewItem.addEventListener('keydown',event=>{ if (event.key==='Enter') addChecklistItem(); });
  checklistAddItemBtn.addEventListener('click',addChecklistItem);
  function clearChecklistDragIndicators() {
    checklistItems.querySelectorAll('.drag-before,.drag-after,.dragging,.drag-pending').forEach(row=>row.classList.remove('drag-before','drag-after','dragging','drag-pending'));
  }

  function stopChecklistDragAutoScroll() {
    if(checklistDragAutoScrollFrame!==null) cancelAnimationFrame(checklistDragAutoScrollFrame);
    checklistDragAutoScrollFrame=null;
  }

  function updateChecklistDragTarget(clientX,clientY) {
    const state=checklistDragState;
    if(!state || !state.active) return;
    state.lastClientX=clientX;
    state.lastClientY=clientY;
    checklistItems.querySelectorAll('.drag-before,.drag-after').forEach(row=>row.classList.remove('drag-before','drag-after'));
    let target=document.elementFromPoint(clientX,clientY)?.closest('.checklist-item');
    if(!target || target===state.row || !checklistItems.contains(target)) {
      const rows=Array.from(checklistItems.querySelectorAll('.checklist-item')).filter(row=>row!==state.row);
      if(!rows.length) { state.targetId=null; return; }
      target=rows.reduce((best,row)=>{
        const rect=row.getBoundingClientRect();
        const distance=Math.abs(clientY-(rect.top+rect.height/2));
        return !best || distance<best.distance ? {row,distance} : best;
      },null)?.row || null;
    }
    if(!target) { state.targetId=null; return; }
    const rect=target.getBoundingClientRect();
    state.targetId=Number(target.dataset.checklistItemId);
    state.before=clientY<rect.top+rect.height/2;
    target.classList.add(state.before?'drag-before':'drag-after');
  }

  function runChecklistDragAutoScroll() {
    const state=checklistDragState;
    if(!state || !state.active) { checklistDragAutoScrollFrame=null; return; }
    const threshold=72;
    const y=state.lastClientY;
    let speed=0;
    if(y<threshold) speed=-Math.ceil((threshold-y)/6);
    else if(y>window.innerHeight-threshold) speed=Math.ceil((y-(window.innerHeight-threshold))/6);
    speed=Math.max(-14,Math.min(14,speed));
    if(speed!==0) {
      window.scrollBy(0,speed);
      updateChecklistDragTarget(state.lastClientX,state.lastClientY);
    }
    checklistDragAutoScrollFrame=requestAnimationFrame(runChecklistDragAutoScroll);
  }

  function activateChecklistDrag(state) {
    if(checklistDragState!==state || state.active) return;
    state.active=true;
    state.holdTimer=null;
    state.row.classList.remove('drag-pending');
    state.row.classList.add('dragging');
    state.handle.setAttribute('aria-pressed','true');
    updateChecklistDragTarget(state.lastClientX,state.lastClientY);
    stopChecklistDragAutoScroll();
    checklistDragAutoScrollFrame=requestAnimationFrame(runChecklistDragAutoScroll);
  }

  function finishChecklistDrag(commit) {
    const state=checklistDragState;
    if(!state) return;
    if(state.holdTimer!==null) clearTimeout(state.holdTimer);
    stopChecklistDragAutoScroll();
    try {
      if(state.handle.hasPointerCapture?.(state.pointerId)) state.handle.releasePointerCapture(state.pointerId);
    } catch (error) {}
    const {itemId,targetId,before,active,handle}=state;
    checklistDragState=null;
    clearChecklistDragIndicators();
    handle.setAttribute('aria-pressed','false');
    if(commit && active && Number.isInteger(targetId)) {
      if(reorderChecklistItem(itemId,targetId,before)) showChecklistStatus('Checklist item reordered.','ok');
      else focusChecklistDragHandle(itemId);
    } else {
      focusChecklistDragHandle(itemId);
    }
  }

  checklistItems.addEventListener('pointerdown',event=>{
    const handle=event.target.closest('[data-checklist-drag-id]');
    if(!handle || checklistDragState || (event.button!==undefined && event.button!==0)) return;
    const row=handle.closest('.checklist-item');
    if(!row) return;
    event.preventDefault();
    handle.focus({preventScroll:true});
    const state={
      pointerId:event.pointerId,
      itemId:Number(handle.getAttribute('data-checklist-drag-id')),
      handle,row,
      active:false,
      targetId:null,
      before:true,
      lastClientX:event.clientX,
      lastClientY:event.clientY,
      holdTimer:null
    };
    checklistDragState=state;
    row.classList.add('drag-pending');
    try { handle.setPointerCapture?.(event.pointerId); } catch (error) {}
    const delay=event.pointerType==='mouse'?0:180;
    state.holdTimer=setTimeout(()=>activateChecklistDrag(state),delay);
  });

  checklistItems.addEventListener('pointermove',event=>{
    const state=checklistDragState;
    if(!state || event.pointerId!==state.pointerId) return;
    state.lastClientX=event.clientX;
    state.lastClientY=event.clientY;
    if(state.active) {
      event.preventDefault();
      updateChecklistDragTarget(event.clientX,event.clientY);
    }
  });

  checklistItems.addEventListener('pointerup',event=>{
    const state=checklistDragState;
    if(!state || event.pointerId!==state.pointerId) return;
    event.preventDefault();
    finishChecklistDrag(true);
  });

  checklistItems.addEventListener('pointercancel',event=>{
    const state=checklistDragState;
    if(!state || event.pointerId!==state.pointerId) return;
    finishChecklistDrag(false);
  });

  checklistItems.addEventListener('keydown',event=>{
    const handle=event.target.closest('[data-checklist-drag-id]');
    if(!handle) return;
    const directions={ArrowUp:'up',ArrowDown:'down',Home:'start',End:'end'};
    const direction=directions[event.key];
    if(!direction) return;
    event.preventDefault();
    if(moveChecklistItem(Number(handle.getAttribute('data-checklist-drag-id')),direction)) {
      showChecklistStatus('Checklist item reordered.','ok');
    }
  });

  checklistItems.addEventListener('change',event=>{
    const checkbox = event.target.closest('[data-checklist-toggle-id]');
    if (checkbox) toggleChecklistItem(Number(checkbox.dataset.checklistToggleId),checkbox.checked);
  });
  checklistItems.addEventListener('input',event=>{
    const input = event.target.closest('[data-checklist-text-id]');
    if (input) updateChecklistItemText(Number(input.dataset.checklistTextId),input.value);
  });
  checklistItems.addEventListener('focusout',event=>{
    const input = event.target.closest('[data-checklist-text-id]');
    if (input) normalizeChecklistItemText(Number(input.dataset.checklistTextId),input);
  });
  checklistItems.addEventListener('click',event=>{
    const button = event.target.closest('[data-checklist-remove-id]');
    if (button) removeChecklistItem(Number(button.dataset.checklistRemoveId));
  });
  checklistDeleteTopicBtn.addEventListener('click',deleteChecklistTopic);
  window.addEventListener('beforeunload',()=>{ if (checklistSaveTimer) persistChecklists(false); });
  loadChecklistsFromStorage();

