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

