  const FABRI_CADABRA_VERSION='1.0.5'; // @generated from package.json by scripts/sync-app-version.mjs

  // ---------------- Shared helpers ----------------
  function gcd(a,b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = b; b = a % b; a = t; }
    return a;
  }

  function trimZeros(n,maxDecimals=6) {
    return Number(n.toFixed(maxDecimals)).toString();
  }


  async function requireRecoverySnapshot(reason) {
    const service=window.FabriCadabraRecovery;
    if (!service || typeof service.create!=='function') {
      throw new Error('Automatic recovery protection is unavailable. Create a manual Fabri-Cadabra backup before retrying.');
    }
    await service.create(reason);
  }


  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }


  async function confirmTaskLogNoteClear(event) {
    const clearBtn=event.target?.closest?.('#taskLogNoteClearBtn');
    if (!clearBtn || clearBtn.dataset.tasklogClearConfirmed==='true') return;

    event.preventDefault();
    event.stopPropagation();

    const noteBackdrop=document.getElementById('taskLogNoteBackdrop');
    const noteDialog=document.getElementById('taskLogNoteDialog');
    const previousBackdropZ=noteBackdrop?.style.zIndex || '';
    const previousDialogZ=noteDialog?.style.zIndex || '';
    const taskLabel=String(document.getElementById('taskLogNoteTaskLabel')?.textContent || '').trim();

    if (noteBackdrop) noteBackdrop.style.zIndex='320';
    if (noteDialog) noteDialog.style.zIndex='321';

    try {
      const confirmed=await confirmAppAction({
        title:'Clear Task Note?',
        message:`Permanently clear this note${taskLabel?` for ${taskLabel}`:''}? This action cannot be undone.`,
        confirmLabel:'Clear Note',
        cancelLabel:'Keep Note',
        danger:true
      });
      if (!confirmed) return;

      clearBtn.dataset.tasklogClearConfirmed='true';
      clearBtn.click();
    } finally {
      delete clearBtn.dataset.tasklogClearConfirmed;
      if (noteBackdrop) noteBackdrop.style.zIndex=previousBackdropZ;
      if (noteDialog) noteDialog.style.zIndex=previousDialogZ;
    }
  }

  document.addEventListener('click',confirmTaskLogNoteClear,true);

