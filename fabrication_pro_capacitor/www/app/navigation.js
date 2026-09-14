  // ---------------- App navigation + theme ----------------
  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const themeColorMeta = document.getElementById('themeColorMeta');
  const pageLinks = Array.from(document.querySelectorAll('.fab-page-link'));
  const settingsPageBtn = document.getElementById('settingsPageBtn');
  const toolPanels = Array.from(document.querySelectorAll('.tool-panel'));
  const DEFAULT_TOOL = 'tasklog';
  const VALID_TOOLS = new Set(pageLinks.map(link=>link.dataset.tool));
  if (settingsPageBtn?.dataset.tool) VALID_TOOLS.add(settingsPageBtn.dataset.tool);
  let activeTool = DEFAULT_TOOL;
  let suppressToolPersistence = false;

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  registerPersistentStore({
    id:'theme',key:'fabricationTheme',version:1,encoding:'string',label:'Color Theme',
    defaultValue:()=>systemPrefersDark()?'dark':'light',
    normalize:value=>{
      if (!['light','dark'].includes(value)) throw new Error('Saved color theme is invalid.');
      return value;
    }
  });
  registerPersistentStore({
    id:'lastTool',key:'fabricationTool',version:1,encoding:'string',label:'Last Page',
    defaultValue:()=>DEFAULT_TOOL,
    normalize:value=>{
      if (!VALID_TOOLS.has(value)) throw new Error('Saved page preference is invalid.');
      return value;
    }
  });

  function applyTheme(theme) {
    root.dataset.theme = theme;
    themeToggle.textContent = theme === 'dark' ? '☀ Light' : '☾ Dark';
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    themeColorMeta.setAttribute('content', theme === 'dark' ? '#0b2940' : '#0f3b5d');
  }

  function getActiveTool() { return activeTool; }

  const savedThemeResult=loadPersistentStore('theme');
  loadPersistentStore('lastTool');
  applyTheme(savedThemeResult.value);

  themeToggle.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { writePersistentStore('theme',next); }
    catch (error) { console.warn(error); }
  });

  function selectTool(tool) {
    const next=VALID_TOOLS.has(tool)?tool:DEFAULT_TOOL;
    activeTool=next;
    pageLinks.forEach(link=>link.classList.toggle('active',link.dataset.tool===next));
    settingsPageBtn?.classList.toggle('active',settingsPageBtn.dataset.tool===next);
    toolPanels.forEach(panel=>panel.classList.toggle('active',panel.id==='tool-'+next));
    if (!suppressToolPersistence) {
      try { writePersistentStore('lastTool',next); }
      catch (error) { console.warn(error); }
    }
    window.scrollTo({top:0,behavior:'smooth'});
  }

  const pageMenuBtn=document.getElementById('pageMenuBtn');
  const pageMenuDrawer=document.getElementById('pageMenuDrawer');
  const pageMenuBackdrop=document.getElementById('pageMenuBackdrop');
  const pageMenuCloseBtn=document.getElementById('pageMenuCloseBtn');

  function installWizardHatPageMenu() {
    const topbar=document.querySelector('.topbar');
    const brandRow=topbar?.querySelector('.brand-row');
    const brandCopy=topbar?.querySelector('.brand-copy');
    const appHeaderLogo=document.getElementById('appHeaderLogo');
    if (!topbar || !brandRow || !brandCopy || !appHeaderLogo || !pageMenuBtn || !themeToggle) {
      throw new Error('Wizard-hat Pages navigation markup is incomplete.');
    }

    let headerActions=document.getElementById('fabHeaderActions');
    let dockSlot=document.getElementById('pageMenuDockSlot');
    if (!headerActions) {
      headerActions=document.createElement('div');
      headerActions.id='fabHeaderActions';
      headerActions.className='fab-header-actions';
      dockSlot=document.createElement('div');
      dockSlot.id='pageMenuDockSlot';
      dockSlot.className='fab-page-menu-dock-slot';
      brandRow.insertBefore(headerActions,themeToggle);
      headerActions.append(dockSlot,themeToggle);
    }

    pageMenuBtn.replaceChildren(appHeaderLogo);
    dockSlot.appendChild(pageMenuBtn);
    pageMenuBtn.setAttribute('aria-label','Open Pages');
    pageMenuBtn.setAttribute('title','Open Pages');
    appHeaderLogo.draggable=false;
    brandCopy.textContent='Built for efficient shop fabrication. — Tap the wizard hat to open Pages.';

    if (!document.getElementById('fabPageHatNavigationStyles')) {
      const style=document.createElement('style');
      style.id='fabPageHatNavigationStyles';
      style.textContent=`
        .fab-header-actions{
          flex:0 0 112px;
          width:112px;
          display:flex;
          flex-direction:column;
          align-items:stretch;
          gap:10px;
        }
        .fab-page-menu-dock-slot{
          width:100%;
          height:84px;
          display:grid;
          place-items:center;
        }
        #pageMenuBtn.fab-page-menu-btn{
          z-index:185;
          width:84px;
          height:84px;
          min-height:0;
          padding:6px;
          border:1px solid rgba(255,255,255,.44);
          border-radius:18px;
          background:rgba(255,255,255,.12);
          color:#fff;
          overflow:hidden;
          cursor:pointer;
          box-shadow:0 3px 0 var(--button-edge),var(--button-depth);
          transform-origin:center;
          transition:transform .16s cubic-bezier(.2,.8,.2,1),box-shadow .16s ease,background-color .16s ease,border-color .16s ease,filter .16s ease;
          -webkit-tap-highlight-color:transparent;
        }
        #pageMenuBtn.fab-page-menu-btn.is-docked{
          position:relative;
          inset:auto;
        }
        #pageMenuBtn.fab-page-menu-btn.is-floating{
          position:fixed;
          top:max(82px,calc(env(safe-area-inset-top) + 68px));
          right:max(12px,env(safe-area-inset-right));
          width:76px;
          height:76px;
          background:linear-gradient(135deg,var(--nav),var(--nav2));
          border-color:rgba(255,255,255,.42);
          box-shadow:0 3px 0 var(--button-edge),0 11px 24px rgba(0,0,0,.28);
        }
        #pageMenuBtn .app-header-logo{
          display:block;
          width:100%;
          height:100%;
          max-width:none;
          object-fit:cover;
          border:0;
          border-radius:12px;
          box-shadow:none;
          pointer-events:none;
          user-select:none;
        }
        #pageMenuBtn.fab-page-menu-btn:focus-visible{
          outline:3px solid rgba(255,255,255,.92);
          outline-offset:3px;
          box-shadow:0 3px 0 var(--button-edge),var(--button-hover-depth),0 0 0 5px color-mix(in srgb,var(--accent) 58%,transparent);
        }
        @media (hover:hover) and (pointer:fine){
          #pageMenuBtn.fab-page-menu-btn:hover{
            transform:translateY(-2px);
            box-shadow:0 5px 0 var(--button-edge),var(--button-hover-depth);
            filter:brightness(1.055);
            background-color:rgba(255,255,255,.18);
          }
          #pageMenuBtn.fab-page-menu-btn.is-floating:hover{
            background:linear-gradient(135deg,var(--nav2),var(--accent2));
          }
        }
        #pageMenuBtn.fab-page-menu-btn:active{
          transform:translateY(2px) scale(.97);
          box-shadow:0 1px 0 var(--button-edge),var(--button-press-depth);
          filter:brightness(.95);
        }
        .fab-header-actions .theme-toggle{
          width:100%;
          min-width:0;
        }
        @media (max-width:760px){
          .topbar .brand-row{
            display:grid;
            grid-template-columns:minmax(0,1fr) 90px;
            grid-template-areas:
              "brand actions"
              "clock actions";
            column-gap:12px;
            row-gap:12px;
            align-items:stretch;
          }
          .topbar .header-brand{
            grid-area:brand;
            width:100%;
            min-width:0;
            display:block;
          }
          .topbar .brand-copy{
            width:100%;
          }
          .topbar #shiftClockControl{
            grid-area:clock;
            width:100%;
            min-width:0;
            align-self:end;
          }
          .fab-header-actions{
            grid-area:actions;
            flex:none;
            width:90px;
            min-width:90px;
            align-self:stretch;
            justify-content:space-between;
            gap:10px;
          }
          .fab-page-menu-dock-slot{
            height:72px;
            align-self:start;
          }
          #pageMenuBtn.fab-page-menu-btn{width:72px;height:72px;padding:5px;border-radius:16px;}
          #pageMenuBtn.fab-page-menu-btn.is-floating{width:70px;height:70px;}
          .fab-header-actions .theme-toggle{
            width:100%;
            min-width:0;
            min-height:44px;
            align-self:end;
            padding:7px 6px;
            font-size:.8rem;
          }
        }
        @media (max-width:420px){
          .topbar .brand-row{
            grid-template-columns:minmax(0,1fr) 84px;
            column-gap:10px;
          }
          .fab-header-actions{
            width:84px;
            min-width:84px;
          }
          .fab-page-menu-dock-slot{height:66px;}
          #pageMenuBtn.fab-page-menu-btn{width:66px;height:66px;border-radius:15px;}
          #pageMenuBtn.fab-page-menu-btn.is-floating{width:66px;height:66px;}
          .fab-header-actions .theme-toggle{font-size:.76rem;padding-inline:4px;}
        }
        @media (prefers-reduced-motion:reduce){
          #pageMenuBtn.fab-page-menu-btn{transition:none;}
          #pageMenuBtn.fab-page-menu-btn:hover,
          #pageMenuBtn.fab-page-menu-btn:active{transform:none;}
        }
      `;
      document.head.appendChild(style);
    }

    const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let floating=null;
    let scrollFrame=0;

    function setFloating(next,animate=true) {
      if (floating===next) return;
      const before=pageMenuBtn.getBoundingClientRect();
      floating=next;
      pageMenuBtn.classList.toggle('is-floating',next);
      pageMenuBtn.classList.toggle('is-docked',!next);
      const after=pageMenuBtn.getBoundingClientRect();
      if (!animate || reducedMotion?.matches || typeof pageMenuBtn.animate!=='function') return;
      const dx=before.left-after.left;
      const dy=before.top-after.top;
      const sx=after.width ? before.width/after.width : 1;
      const sy=after.height ? before.height/after.height : 1;
      pageMenuBtn.animate([
        {transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`},
        {transform:'translate(0,0) scale(1,1)'}
      ],{duration:210,easing:'cubic-bezier(.2,.8,.2,1)'});
    }

    function updateFloatingState(animate=true) {
      const headerBottom=topbar.getBoundingClientRect().bottom;
      const threshold=Math.max(104,Math.min(132,window.innerHeight*.16));
      setFloating(window.scrollY>12 && headerBottom<=threshold,animate);
    }

    function scheduleFloatingUpdate() {
      if (scrollFrame) return;
      scrollFrame=requestAnimationFrame(()=>{
        scrollFrame=0;
        updateFloatingState(true);
      });
    }

    setFloating(false,false);
    updateFloatingState(false);
    window.addEventListener('scroll',scheduleFloatingUpdate,{passive:true});
    window.addEventListener('resize',scheduleFloatingUpdate,{passive:true});
    if (typeof ResizeObserver==='function') {
      const observer=new ResizeObserver(scheduleFloatingUpdate);
      observer.observe(topbar);
    }
  }

  installWizardHatPageMenu();

  function setPageMenuOpen(open) {
    if (open) openDrawer('pageMenuDrawer',pageMenuBtn); else closeDrawer('pageMenuDrawer',pageMenuBtn);
    pageMenuBtn.setAttribute('aria-expanded',open?'true':'false');
  }
  pageMenuBtn.addEventListener('click',()=>setPageMenuOpen(!isDrawerOpen('pageMenuDrawer')));
  pageMenuCloseBtn.addEventListener('click',()=>setPageMenuOpen(false));
  pageMenuBackdrop.addEventListener('click',()=>setPageMenuOpen(false));
  pageMenuDrawer.addEventListener('click',event=>{
    const link=event.target.closest('.fab-page-link');
    if (!link) return;
    selectTool(link.dataset.tool);
    setPageMenuOpen(false);
  });
  settingsPageBtn?.addEventListener('click',()=>{
    selectTool(settingsPageBtn.dataset.tool);
    setPageMenuOpen(false);
  });
  document.addEventListener('keydown',event=>{
    if (event.key==='Escape' && isDrawerOpen('pageMenuDrawer')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setPageMenuOpen(false);
    }
  });

  function bindPageInfoDrawer(buttonId,drawerId) {
    const button=document.getElementById(buttonId);
    const drawer=document.getElementById(drawerId);
    const backdrop=document.getElementById(drawerId.replace(/Drawer$/,'Backdrop'));
    const closeButton=drawer?.querySelector('.cut-list-close-btn');
    if (!button || !drawer || !backdrop || !closeButton) throw new Error(`Page Info drawer markup is incomplete: ${drawerId}`);
    const setOpen=open=>{
      if (open) openDrawer(drawerId,button); else closeDrawer(drawerId,button);
      button.setAttribute('aria-expanded',open?'true':'false');
    };
    button.addEventListener('click',()=>setOpen(!isDrawerOpen(drawerId)));
    closeButton.addEventListener('click',()=>setOpen(false));
    backdrop.addEventListener('click',()=>setOpen(false));
    drawer.addEventListener('keydown',event=>{
      if (event.key==='Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    });
  }
  [
    ['optimizerInfoBtn','optimizerInfoDrawer'],
    ['sawInfoBtn','sawInfoDrawer'],
    ['overhangInfoBtn','overhangInfoDrawer']
  ].forEach(([buttonId,drawerId])=>bindPageInfoDrawer(buttonId,drawerId));

  suppressToolPersistence=true;
  selectTool(DEFAULT_TOOL);
  suppressToolPersistence=false;

  window.FabriCadabraApp={getActiveTool,openDrawer,closeDrawer,isDrawerOpen,confirmAction:confirmAppAction,version:FABRI_CADABRA_VERSION,storage:persistentStoragePublicApi};

