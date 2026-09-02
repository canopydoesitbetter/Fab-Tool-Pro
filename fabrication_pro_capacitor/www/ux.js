(() => {
  const FABRI_CADABRA_VERSION='1.0.1'; // @generated from package.json by scripts/sync-app-version.mjs

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
  const fabricatorNotesEditor=document.getElementById('fabricatorNotesEditor');

  if (fabricatorNotesTopicsBtn && fabricatorNotesEditor) {
    fabricatorNotesTopicsBtn.classList.add('notes-topics-inline-btn');
    fabricatorNotesEditor.insertBefore(fabricatorNotesTopicsBtn,fabricatorNotesEditor.firstElementChild);
  }

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

  function currentFeaturesChangelogMarkup() {
    return `
      <article class='changelog-entry changelog-current-features' data-changelog-version='1.0.0'>
        <div class='changelog-entry-heading'>
          <div>
            <span class='changelog-version-label'>Version 1.0.0</span>
            <h2>Fabri-Cadabra — Current Features</h2>
          </div>
        </div>

        <section class='changelog-feature-section'>
          <h3>Task Logging</h3>
          <ul>
            <li>Create and manage jobs.</li>
            <li>Add reusable preset tasks to jobs.</li>
            <li>Select all presets for quick job setup.</li>
            <li>Persistent Start/Stop timers that continue correctly when the phone locks or pages change.</li>
            <li>Automatic task session history.</li>
            <li>Job and task time totals.</li>
            <li>Import/export jobs and presets separately.</li>
            <li>Preset Tasks drawer used to add/remove assigned tasks.</li>
            <li>Collapsible Task Logging Management panel.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>Fabricator Notes</h3>
          <ul>
            <li>Create and manage note topics.</li>
            <li>Rich-text notes with bold, italic, and underline.</li>
            <li>Automatic local saving.</li>
            <li>Topics drawer inside the note editor.</li>
            <li>Import/export note backups.</li>
            <li>Collapsible Notes Management panel.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>Checklist</h3>
          <ul>
            <li>Create checklist topics.</li>
            <li>Add, delete, complete, and reorder checklist items.</li>
            <li>Drag/touch reordering.</li>
            <li>Completion progress bar.</li>
            <li>Automatic local saving.</li>
            <li>Import/export checklist backups.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>Basic Calculator</h3>
          <ul>
            <li>Standard arithmetic.</li>
            <li>Percentages, square roots, powers, π, and rounding.</li>
            <li>Memory functions.</li>
            <li>Repeating operations.</li>
            <li>Keyboard support.</li>
            <li>Built-in Calculator Guide.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>Quick Reference</h3>
          <ul>
            <li>Fraction addition charts for 1/16&quot;, 1/32&quot;, and 1/64&quot; increments.</li>
            <li>Gauge → Decimal Thickness chart.</li>
            <li>Selectable/highlightable table cells.</li>
            <li>Fraction/decimal display toggle.</li>
            <li>Remembers selected table and display preference.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>Fastener Spacing</h3>
          <ul>
            <li>Calculates equal fastener spacing.</li>
            <li>Calculates total fastener count.</li>
            <li>Displays fastener locations.</li>
            <li>Measurements rounded to the nearest 1/16&quot;.</li>
            <li>Visual spacing diagram.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>Sheet Optimizer</h3>
          <ul>
            <li>Whole-job sheet optimization.</li>
            <li>Automatic fabrication allowances by product type.</li>
            <li>Supports .063 Exterior Panels, .063 Door Panels, ACP, Insulation, and Plywood.</li>
            <li>Guillotine/shear-compatible layouts for aluminum and ACP.</li>
            <li>Free-form nesting for insulation and plywood.</li>
            <li>Grain Flow Rotation control.</li>
            <li>Cut List drawer.</li>
            <li>Save/load local jobs.</li>
            <li>Import/export job files.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>Saw Optimizer</h3>
          <ul>
            <li>Optimize tube/linear stock usage.</li>
            <li>Custom stock lengths.</li>
            <li>Part labels, lengths, and quantities.</li>
            <li>Fixed 1/4&quot; kerf between adjacent pieces.</li>
            <li>Optimized tube diagrams and remaining offcut.</li>
            <li>Individual Cut / Uncut tracking.</li>
            <li>Part List drawer.</li>
            <li>Import/export saw jobs.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>Aluminum Overhang</h3>
          <ul>
            <li>Calculates long- and short-side blanks.</li>
            <li>Automatically adds corner and seam flanges.</li>
            <li>Automatically splits oversized pieces.</li>
            <li>Enforces maximum usable stock length.</li>
            <li>Displays fabrication rules and cut dimensions.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>App-Wide Features</h3>
          <ul>
            <li>9 fabrication tools.</li>
            <li>Task Logging opens by default.</li>
            <li>Pages navigation drawer.</li>
            <li>Light and dark themes.</li>
            <li>Persistent local storage.</li>
            <li>Portable JSON import/export.</li>
            <li>Responsive mobile interface.</li>
            <li>Android and iPhone Capacitor apps.</li>
            <li>Permanently signed Android APK builds.</li>
            <li>Unsigned iPhone IPA builds.</li>
            <li>GitHub Pages web deployment.</li>
          </ul>
        </section>
      </article>`;
  }

  function changelogMarkup() {
    return `
      <article class='changelog-entry changelog-release' data-changelog-version='current'>
        <div class='changelog-entry-heading'>
          <div>
            <span class='changelog-version-label'>Version ${FABRI_CADABRA_VERSION}</span>
            <h2>Settings &amp; Changelog</h2>
          </div>
        </div>
        <ul>
          <li>Added Settings page.</li>
          <li>Added permanent Settings access at the bottom of the Pages drawer.</li>
          <li>Added in-app Changelog.</li>
          <li>Added application version tracking.</li>
          <li>Established newest-first changelog ordering.</li>
        </ul>
      </article>
      ${currentFeaturesChangelogMarkup()}`;
  }

  function installSettingsPage() {
    if (document.getElementById('tool-settings')) return;
    const appRoot=document.querySelector('main.app');
    const pageMenuDrawer=document.getElementById('pageMenuDrawer');
    const pageMenuBody=pageMenuDrawer?.querySelector('.cut-list-drawer-body');
    const pageMenuBtn=document.getElementById('pageMenuBtn');
    if (!appRoot || !pageMenuDrawer || !pageMenuBody || !pageMenuBtn || !window.FabriCadabraApp) return;

    const settingsPage=document.createElement('section');
    settingsPage.id='tool-settings';
    settingsPage.className='tool-panel settings-page';
    settingsPage.innerHTML=`
      <div class='tool-title'>
        <h2>Settings</h2>
        <p>App information, release history, and Fabri-Cadabra settings.</p>
      </div>
      <section class='card settings-overview-card'>
        <h2>Application</h2>
        <div class='settings-version-row'>
          <div>
            <span class='settings-row-label'>Current Version</span>
            <strong id='settingsVersionValue' class='settings-version-value'>${FABRI_CADABRA_VERSION}</strong>
          </div>
          <button id='settingsChangelogBtn' class='btn settings-changelog-btn' type='button' aria-expanded='false' aria-controls='settingsChangelogDrawer'>Changelog</button>
        </div>
      </section>`;
    const footer=appRoot.querySelector(':scope > .footer');
    if (footer) appRoot.insertBefore(settingsPage,footer);
    else appRoot.appendChild(settingsPage);

    const settingsFooter=document.createElement('div');
    settingsFooter.className='fab-settings-drawer-footer';
    const settingsButton=document.createElement('button');
    settingsButton.className='fab-settings-link';
    settingsButton.type='button';
    settingsButton.textContent='Settings';
    settingsButton.setAttribute('aria-controls','tool-settings');
    settingsFooter.appendChild(settingsButton);
    pageMenuBody.appendChild(settingsFooter);

    const changelogBackdrop=document.createElement('div');
    changelogBackdrop.id='settingsChangelogBackdrop';
    changelogBackdrop.className='cut-list-backdrop settings-changelog-backdrop';
    changelogBackdrop.setAttribute('aria-hidden','true');

    const changelogDrawer=document.createElement('aside');
    changelogDrawer.id='settingsChangelogDrawer';
    changelogDrawer.className='cut-list-drawer settings-changelog-drawer';
    changelogDrawer.setAttribute('role','dialog');
    changelogDrawer.setAttribute('aria-modal','true');
    changelogDrawer.setAttribute('aria-hidden','true');
    changelogDrawer.setAttribute('aria-labelledby','settingsChangelogTitle');
    changelogDrawer.innerHTML=`
      <div class='cut-list-drawer-head settings-changelog-head'>
        <strong id='settingsChangelogTitle'>Changelog</strong>
        <span class='cut-list-drawer-meta'>Newest first</span>
        <button id='settingsChangelogCloseBtn' class='cut-list-close-btn' type='button' aria-label='Close Changelog'>×</button>
      </div>
      <div class='cut-list-drawer-body settings-changelog-body'>${changelogMarkup()}</div>`;
    document.body.append(changelogBackdrop,changelogDrawer);

    const changelogButton=document.getElementById('settingsChangelogBtn');
    const changelogCloseBtn=document.getElementById('settingsChangelogCloseBtn');
    const originalGetActiveTool=window.FabriCadabraApp.getActiveTool.bind(window.FabriCadabraApp);
    let settingsOpen=false;

    function openSettingsPage() {
      settingsOpen=true;
      document.querySelectorAll('.tool-panel').forEach(panel=>panel.classList.toggle('active',panel===settingsPage));
      document.querySelectorAll('.fab-page-link').forEach(link=>link.classList.remove('active'));
      settingsButton.classList.add('active');
      window.FabriCadabraApp.closeDrawer('pageMenuDrawer',pageMenuBtn);
      pageMenuBtn.setAttribute('aria-expanded','false');
      window.scrollTo({top:0,behavior:'smooth'});
    }

    function setSettingsChangelogOpen(open) {
      if (!changelogButton) return;
      if (open) window.FabriCadabraApp.openDrawer('settingsChangelogDrawer',changelogButton);
      else window.FabriCadabraApp.closeDrawer('settingsChangelogDrawer',changelogButton);
      changelogButton.setAttribute('aria-expanded',open?'true':'false');
    }

    window.FabriCadabraApp.version=FABRI_CADABRA_VERSION;
    window.FabriCadabraApp.getActiveTool=()=>settingsOpen?'settings':originalGetActiveTool();

    settingsButton.addEventListener('click',openSettingsPage);
    pageMenuDrawer.addEventListener('click',event=>{
      const normalPage=event.target.closest('.fab-page-link');
      if (!normalPage) return;
      settingsOpen=false;
      settingsPage.classList.remove('active');
      settingsButton.classList.remove('active');
    });

    changelogButton?.addEventListener('click',()=>setSettingsChangelogOpen(!changelogDrawer.classList.contains('open')));
    changelogCloseBtn?.addEventListener('click',()=>setSettingsChangelogOpen(false));
    changelogBackdrop.addEventListener('click',()=>setSettingsChangelogOpen(false));
    changelogDrawer.addEventListener('keydown',event=>{
      if (event.key==='Escape') {
        event.preventDefault();
        setSettingsChangelogOpen(false);
      }
    });
    document.addEventListener('keydown',event=>{
      if (event.key==='Escape' && changelogDrawer.classList.contains('open')) setSettingsChangelogOpen(false);
    });
  }

  installSettingsPage();
})();
