  const drawerReturnFocus = new Map();

  function getDrawerParts(drawerId) {
    const drawer=document.getElementById(drawerId);
    const backdrop=document.getElementById(drawerId.replace(/Drawer$/,'Backdrop'));
    if (!drawer || !backdrop) return null;
    return {drawer,backdrop,close:drawer.querySelector('.cut-list-close-btn')};
  }

  function syncBodyDrawerState() {
    document.body.classList.toggle('cut-list-drawer-open',!!document.querySelector('.cut-list-drawer.open'));
  }

  function isDrawerOpen(drawerId) {
    return !!document.getElementById(drawerId)?.classList.contains('open');
  }

  function openDrawer(drawerId,returnFocusElement=document.activeElement) {
    const parts=getDrawerParts(drawerId);
    if (!parts) return false;
    drawerReturnFocus.set(drawerId,returnFocusElement || null);
    parts.drawer.classList.add('open');
    parts.backdrop.classList.add('open');
    parts.drawer.setAttribute('aria-hidden','false');
    parts.backdrop.setAttribute('aria-hidden','false');
    syncBodyDrawerState();
    if (parts.close) requestAnimationFrame(()=>parts.close.focus({preventScroll:true}));
    return true;
  }

  function closeDrawer(drawerId,returnFocusElement) {
    const parts=getDrawerParts(drawerId);
    if (!parts) return false;
    parts.drawer.classList.remove('open');
    parts.backdrop.classList.remove('open');
    parts.drawer.setAttribute('aria-hidden','true');
    parts.backdrop.setAttribute('aria-hidden','true');
    syncBodyDrawerState();
    const focusTarget=returnFocusElement || drawerReturnFocus.get(drawerId);
    drawerReturnFocus.delete(drawerId);
    if (focusTarget && typeof focusTarget.focus==='function') requestAnimationFrame(()=>focusTarget.focus({preventScroll:true}));
    return true;
  }

  function trapDrawerFocus(drawer,event) {
    if (event.key!=='Tab' || !drawer?.classList.contains('open')) return;
    const focusable=Array.from(drawer.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')).filter(el=>el.offsetParent!==null);
    if (!focusable.length) { event.preventDefault(); return; }
    const first=focusable[0],last=focusable[focusable.length-1];
    if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
  }

  document.addEventListener('keydown',event=>{
    const drawer=document.querySelector('.cut-list-drawer.open');
    if (drawer) trapDrawerFocus(drawer,event);
  });



  const appConfirmBackdrop=document.getElementById('appConfirmBackdrop');
  const appConfirmDialog=document.getElementById('appConfirmDialog');
  const appConfirmTitle=document.getElementById('appConfirmTitle');
  const appConfirmMessage=document.getElementById('appConfirmMessage');
  const appConfirmCancelBtn=document.getElementById('appConfirmCancelBtn');
  const appConfirmConfirmBtn=document.getElementById('appConfirmConfirmBtn');
  let appConfirmResolve=null;
  let appConfirmReturnFocus=null;

  function appConfirmationFromInput(input) {
    if (input && typeof input==='object' && !Array.isArray(input)) {
      return {
        title:String(input.title || 'Confirm Action'),
        message:String(input.message || ''),
        confirmLabel:String(input.confirmLabel || 'Confirm'),
        cancelLabel:String(input.cancelLabel || 'Cancel'),
        danger:input.danger===true
      };
    }
    const message=String(input || '');
    const lower=message.toLocaleLowerCase();
    let title='Confirm Action',confirmLabel='Confirm',danger=false;
    if (lower.startsWith('clock out')) { title='Clock Out?'; confirmLabel='Clock Out'; danger=true; }
    else if (lower.includes('clock in')) { title='Clock In?'; confirmLabel='Clock In'; }
    else if (lower.startsWith('enable shift schedule')) { title='Enable Shift Schedule?'; confirmLabel='Enable'; }
    else if (lower.startsWith('disable shift schedule')) { title='Disable Shift Schedule?'; confirmLabel='Disable'; danger=true; }
    else if (lower.startsWith('delete')) { title='Delete?'; confirmLabel='Delete'; danger=true; }
    else if (lower.startsWith('remove')) { title='Remove?'; confirmLabel='Remove'; danger=true; }
    else if (lower.startsWith('clear')) { title='Clear?'; confirmLabel='Clear'; danger=true; }
    else if (lower.includes('restore')) { title='Restore Data?'; confirmLabel='Restore'; danger=true; }
    else if (lower.includes('replace') || lower.includes('discard')) { title='Replace Existing Data?'; confirmLabel=lower.includes('import')?'Import':'Replace'; danger=true; }
    else if (lower.startsWith('mark ')) { title='Update Cut Status?'; confirmLabel='Update'; }
    return {title,message,confirmLabel,cancelLabel:'Cancel',danger};
  }

  function settleAppConfirmation(result) {
    if (!appConfirmResolve) return;
    const resolve=appConfirmResolve;
    const returnFocus=appConfirmReturnFocus;
    appConfirmResolve=null;
    appConfirmReturnFocus=null;
    appConfirmDialog.classList.remove('open');
    appConfirmBackdrop.classList.remove('open');
    appConfirmDialog.setAttribute('aria-hidden','true');
    appConfirmBackdrop.setAttribute('aria-hidden','true');
    document.body.classList.remove('app-confirm-open');
    resolve(result===true);
    if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus==='function') {
      requestAnimationFrame(()=>returnFocus.focus({preventScroll:true}));
    }
  }

  function confirmAppAction(input={}) {
    if (!appConfirmDialog || !appConfirmBackdrop || !appConfirmTitle || !appConfirmMessage || !appConfirmCancelBtn || !appConfirmConfirmBtn) {
      return Promise.resolve(false);
    }
    if (appConfirmResolve) settleAppConfirmation(false);
    const options=appConfirmationFromInput(input);
    appConfirmReturnFocus=document.activeElement;
    appConfirmTitle.textContent=options.title;
    appConfirmMessage.textContent=options.message;
    appConfirmCancelBtn.textContent=options.cancelLabel;
    appConfirmConfirmBtn.textContent=options.confirmLabel;
    appConfirmConfirmBtn.classList.toggle('danger',options.danger===true);
    appConfirmDialog.classList.add('open');
    appConfirmBackdrop.classList.add('open');
    appConfirmDialog.setAttribute('aria-hidden','false');
    appConfirmBackdrop.setAttribute('aria-hidden','false');
    document.body.classList.add('app-confirm-open');
    return new Promise(resolve=>{
      appConfirmResolve=resolve;
      requestAnimationFrame(()=>{
        const target=options.danger ? appConfirmCancelBtn : appConfirmConfirmBtn;
        target.focus({preventScroll:true});
      });
    });
  }

  function trapAppConfirmationFocus(event) {
    if (event.key!=='Tab' || !appConfirmDialog.classList.contains('open')) return;
    const focusable=Array.from(appConfirmDialog.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(el=>el.offsetParent!==null);
    if (!focusable.length) { event.preventDefault(); return; }
    const first=focusable[0],last=focusable[focusable.length-1];
    if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
  }

  appConfirmCancelBtn?.addEventListener('click',()=>settleAppConfirmation(false));
  appConfirmConfirmBtn?.addEventListener('click',()=>settleAppConfirmation(true));
  appConfirmBackdrop?.addEventListener('click',()=>settleAppConfirmation(false));
  appConfirmDialog?.addEventListener('keydown',event=>{
    if (event.key==='Escape') { event.preventDefault(); event.stopPropagation(); settleAppConfirmation(false); return; }
    trapAppConfirmationFocus(event);
  });
