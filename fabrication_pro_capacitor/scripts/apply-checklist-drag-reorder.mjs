import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const appPath=join(root,'www','app.js');
const stylesPath=join(root,'www','styles.css');
let app=readFileSync(appPath,'utf8');
let styles=readFileSync(stylesPath,'utf8');

function replaceOnce(source,needle,replacement,label) {
  const count=source.split(needle).length-1;
  if(count!==1) throw new Error(`${label}: expected exactly one source match, found ${count}.`);
  return source.replace(needle,replacement);
}

app=replaceOnce(app,
`  let checklistNextItemId = 1;
  let checklistSaveTimer = null;

  function checklistNow() { return new Date().toISOString(); }`,
`  let checklistNextItemId = 1;
  let checklistSaveTimer = null;
  let checklistDragState = null;
  let checklistDragAutoScrollFrame = null;

  function checklistNow() { return new Date().toISOString(); }`,
'Checklist drag state');

app=replaceOnce(app,
`        row.className = \`checklist-item\${item.checked?' checked':''}\`;
        row.dataset.checklistItemId = String(item.id);

        const checkbox = document.createElement('input');`,
`        row.className = \`checklist-item\${item.checked?' checked':''}\`;
        row.dataset.checklistItemId = String(item.id);

        const dragHandle = document.createElement('button');
        dragHandle.type = 'button';
        dragHandle.className = 'checklist-drag-handle';
        dragHandle.setAttribute('data-checklist-drag-id',String(item.id));
        dragHandle.setAttribute('aria-label',\`Reorder checklist item: \${item.text}. Drag to move, or use Arrow Up, Arrow Down, Home, or End.\`);
        dragHandle.setAttribute('aria-keyshortcuts','ArrowUp ArrowDown Home End');
        dragHandle.setAttribute('aria-pressed','false');
        dragHandle.title = 'Hold and drag to reorder';
        dragHandle.textContent = '☷';

        const checkbox = document.createElement('input');`,
'Checklist drag handle');

app=replaceOnce(app,
`        remove.textContent = '×';
        row.append(checkbox,text,remove);`,
`        remove.textContent = '×';
        row.append(dragHandle,checkbox,text,remove);`,
'Checklist row composition');

app=replaceOnce(app,
`  function findChecklistItem(id) {
    const topic = activeChecklistTopic();`,
`  function focusChecklistDragHandle(id) {
    requestAnimationFrame(()=>{
      const handle=checklistItems.querySelector(\`[data-checklist-drag-id="\${id}"]\`);
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
    const topic = activeChecklistTopic();`,
'Checklist reorder helpers');

const listenerNeedle=`  checklistItems.addEventListener('change',event=>{
    const checkbox = event.target.closest('[data-checklist-toggle-id]');`;
const dragListeners=`  function clearChecklistDragIndicators() {
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

${listenerNeedle}`;
app=replaceOnce(app,listenerNeedle,dragListeners,'Checklist pointer and keyboard listeners');

styles=replaceOnce(styles,
`    .checklist-item {
      display:grid;
      grid-template-columns:44px minmax(0,1fr) 42px;
      gap:8px;
      align-items:center;
      min-height:56px;
      padding:7px 8px;
      border:1px solid var(--border);
      border-radius:11px;
      background:var(--card2);
    }
    .checklist-item.checked {
      background:color-mix(in srgb, var(--good-bg) 58%, var(--card2));
    }
    .checklist-box {`,
`    .checklist-item {
      position:relative;
      display:grid;
      grid-template-columns:40px 44px minmax(0,1fr) 42px;
      gap:8px;
      align-items:center;
      min-height:56px;
      padding:7px 8px;
      border:1px solid var(--border);
      border-radius:11px;
      background:var(--card2);
      transition:border-color .12s ease,box-shadow .12s ease,opacity .12s ease;
    }
    .checklist-item.checked {
      background:color-mix(in srgb, var(--good-bg) 58%, var(--card2));
    }
    .checklist-drag-handle {
      width:40px;
      min-width:40px;
      height:40px;
      border:1px solid transparent;
      border-radius:9px;
      background:transparent;
      color:var(--muted);
      font-size:1.35rem;
      font-weight:900;
      line-height:1;
      cursor:grab;
      touch-action:none;
      user-select:none;
      -webkit-user-select:none;
    }
    .checklist-drag-handle:hover,
    .checklist-drag-handle:focus-visible {
      border-color:var(--border);
      background:var(--card);
      color:var(--accent);
      outline:none;
      box-shadow:0 0 0 3px rgba(28,109,161,.14);
    }
    .checklist-item.drag-pending .checklist-drag-handle,
    .checklist-item.dragging .checklist-drag-handle {
      cursor:grabbing;
      color:var(--accent);
    }
    .checklist-item.dragging {
      z-index:2;
      opacity:.76;
      border-color:var(--accent);
      box-shadow:0 8px 22px rgba(22,34,43,.16);
    }
    .checklist-item.drag-before::before,
    .checklist-item.drag-after::after {
      content:'';
      position:absolute;
      left:4px;
      right:4px;
      height:3px;
      border-radius:999px;
      background:var(--accent);
      pointer-events:none;
    }
    .checklist-item.drag-before::before { top:-6px; }
    .checklist-item.drag-after::after { bottom:-6px; }
    .checklist-box {`,
'Checklist drag styles');

writeFileSync(appPath,app);
writeFileSync(stylesPath,styles);
console.log('Checklist drag/reorder source update applied.');
