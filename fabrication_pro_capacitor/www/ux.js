(() => {
  function moveStatusOutsideManagement(detailsId,statusId) {
    const details=document.getElementById(detailsId);
    const status=document.getElementById(statusId);
    if (details && status && details.contains(status)) details.after(status);
  }

  moveStatusOutsideManagement('taskLogManagementDetails','taskLogStatus');
  moveStatusOutsideManagement('fabricatorNotesManagementDetails','fabricatorNotesStatus');

  const taskLogPresetList=document.getElementById('taskLogPresetList');
  const taskLogTaskList=document.getElementById('taskLogTaskList');

  function normalizeAssignedPresetActions() {
    if (!taskLogPresetList) return;
    for (const row of taskLogPresetList.querySelectorAll('.tasklog-preset-row.assigned')) {
      const button=row.querySelector('[data-tasklog-delete-preset]');
      if (!button) continue;
      const presetId=button.getAttribute('data-tasklog-delete-preset');
      button.removeAttribute('data-tasklog-delete-preset');
      button.setAttribute('data-tasklog-remove-assigned',presetId || '');
      button.classList.add('tasklog-remove-assigned-btn');
      button.textContent='−';
      const name=row.querySelector('.tasklog-preset-copy strong')?.textContent?.trim() || 'task';
      button.setAttribute('aria-label',`Remove ${name} from this job`);
      button.title='Remove from this job';
    }
  }

  function removeAssignedTaskLogPreset(button) {
    const row=button.closest('.tasklog-preset-row');
    const name=row?.querySelector('.tasklog-preset-copy strong')?.textContent?.trim();
    if (!name || !taskLogTaskList) return;
    const taskRow=Array.from(taskLogTaskList.querySelectorAll('.tasklog-task-row')).find(candidate=>
      candidate.querySelector('.tasklog-task-main > strong')?.textContent?.trim()===name
    );
    const removeButton=taskRow?.querySelector('[data-tasklog-remove-task]');
    if (removeButton) removeButton.click();
  }

  if (taskLogPresetList) {
    normalizeAssignedPresetActions();
    const observer=new MutationObserver(normalizeAssignedPresetActions);
    observer.observe(taskLogPresetList,{childList:true,subtree:true});
    taskLogPresetList.addEventListener('click',event=>{
      const button=event.target.closest('[data-tasklog-remove-assigned]');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      removeAssignedTaskLogPreset(button);
    },true);
  }

  const fabricatorNotesTopicsBtn=document.getElementById('fabricatorNotesTopicsBtn');
  const fabricatorNotesTopicsDrawer=document.getElementById('fabricatorNotesTopicsDrawer');
  const fabricatorNotesTopicsBackdrop=document.getElementById('fabricatorNotesTopicsBackdrop');
  const fabricatorNotesTopicsCloseBtn=document.getElementById('fabricatorNotesTopicsCloseBtn');
  const fabricatorNotesTopicList=document.getElementById('fabricatorNotesTopicList');

  function setFabricatorNotesTopicsDrawerOpen(open) {
    if (!fabricatorNotesTopicsBtn || !window.FabriCadabraApp) return;
    if (open) window.FabriCadabraApp.openDrawer('fabricatorNotesTopicsDrawer',fabricatorNotesTopicsBtn);
    else window.FabriCadabraApp.closeDrawer('fabricatorNotesTopicsDrawer',fabricatorNotesTopicsBtn);
    fabricatorNotesTopicsBtn.setAttribute('aria-expanded',open?'true':'false');
  }

  if (fabricatorNotesTopicsBtn && fabricatorNotesTopicsDrawer && fabricatorNotesTopicsBackdrop && fabricatorNotesTopicsCloseBtn) {
    fabricatorNotesTopicsBtn.addEventListener('click',()=>setFabricatorNotesTopicsDrawerOpen(!fabricatorNotesTopicsDrawer.classList.contains('open')));
    fabricatorNotesTopicsCloseBtn.addEventListener('click',()=>setFabricatorNotesTopicsDrawerOpen(false));
    fabricatorNotesTopicsBackdrop.addEventListener('click',()=>setFabricatorNotesTopicsDrawerOpen(false));
    fabricatorNotesTopicsDrawer.addEventListener('keydown',event=>{
      if (event.key==='Escape') {
        event.preventDefault();
        setFabricatorNotesTopicsDrawerOpen(false);
      }
    });
    fabricatorNotesTopicList?.addEventListener('click',event=>{
      if (!event.target.closest('[data-note-topic-id]')) return;
      requestAnimationFrame(()=>setFabricatorNotesTopicsDrawerOpen(false));
    });
    document.addEventListener('keydown',event=>{
      if (event.key==='Escape' && fabricatorNotesTopicsDrawer.classList.contains('open')) setFabricatorNotesTopicsDrawerOpen(false);
    });
  }
})();
