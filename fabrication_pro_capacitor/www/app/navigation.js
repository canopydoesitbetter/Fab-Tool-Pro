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

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    themeToggle.textContent = theme === 'dark' ? '☀ Light' : '☾ Dark';
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    themeColorMeta.setAttribute('content', theme === 'dark' ? '#0b2940' : '#0f3b5d');
  }

  function getActiveTool() { return activeTool; }

  const savedTheme = storageGet('fabricationTheme');
  applyTheme(savedTheme || (systemPrefersDark() ? 'dark' : 'light'));

  themeToggle.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    storageSet('fabricationTheme', next);
  });

  function selectTool(tool) {
    const next=VALID_TOOLS.has(tool)?tool:DEFAULT_TOOL;
    activeTool=next;
    pageLinks.forEach(link=>link.classList.toggle('active',link.dataset.tool===next));
    settingsPageBtn?.classList.toggle('active',settingsPageBtn.dataset.tool===next);
    toolPanels.forEach(panel=>panel.classList.toggle('active',panel.id==='tool-'+next));
    storageSet('fabricationTool',next);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  const pageMenuBtn=document.getElementById('pageMenuBtn');
  const pageMenuDrawer=document.getElementById('pageMenuDrawer');
  const pageMenuBackdrop=document.getElementById('pageMenuBackdrop');
  const pageMenuCloseBtn=document.getElementById('pageMenuCloseBtn');
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

  selectTool(DEFAULT_TOOL);

  window.FabriCadabraApp={getActiveTool,openDrawer,closeDrawer,isDrawerOpen,version:FABRI_CADABRA_VERSION};

