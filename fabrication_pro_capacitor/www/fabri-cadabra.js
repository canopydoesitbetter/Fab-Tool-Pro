/* Fabrication Pro approved UI enhancements: floating navigation + basic calculator. */
(() => {
  'use strict';

  if (typeof document === 'undefined' || document.getElementById('pageMenuBtn')) return;

  const storageGet = key => {
    try { return localStorage.getItem(key); } catch { return null; }
  };
  const storageSet = (key, value) => {
    try { localStorage.setItem(key, value); } catch { /* existing app already handles unavailable storage */ }
  };

  const style = document.createElement('style');
  style.textContent = `
    .fab-page-menu-btn {
      position:fixed; top:max(12px, env(safe-area-inset-top)); right:max(12px, env(safe-area-inset-right));
      z-index:185; min-height:44px; border:1px solid rgba(255,255,255,.32); border-radius:13px;
      padding:9px 12px; background:linear-gradient(135deg,var(--nav),var(--nav2)); color:#fff;
      box-shadow:0 7px 20px rgba(0,0,0,.22); font-weight:900; cursor:pointer;
    }
    .fab-page-menu-btn:active { transform:translateY(1px); }
    .fab-page-drawer { width:min(330px,88vw); }
    .fab-page-list { display:grid; gap:8px; }
    .fab-page-link {
      width:100%; min-height:48px; border:1px solid var(--border); border-radius:12px; padding:10px 12px;
      background:var(--card2); color:var(--text); font-weight:850; text-align:left; cursor:pointer;
    }
    .fab-page-link.active { border-color:var(--accent); background:var(--accent-soft); color:var(--accent); }
    .fab-calculator-title-row { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
    .fab-calculator-title-row > div { min-width:0; }
    .fab-calc-shell { max-width:560px; margin:0 auto 14px; }
    .fab-calc-display {
      min-height:86px; display:flex; align-items:flex-end; justify-content:flex-end; text-align:right;
      width:100%; border:2px solid var(--input-border); border-radius:15px; background:var(--input); color:var(--text);
      padding:14px; font-variant-numeric:tabular-nums; font-size:clamp(2rem,9vw,3.25rem); font-weight:900;
      overflow-wrap:anywhere; line-height:1.05;
    }
    .fab-calc-memory { min-height:22px; margin:8px 2px 4px; color:var(--muted); font-size:.78rem; font-weight:850; text-align:right; }
    .fab-calc-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-top:10px; }
    .fab-calc-key {
      min-height:54px; border:1px solid var(--border); border-radius:12px; background:var(--card2); color:var(--text);
      font-size:1.05rem; font-weight:900; cursor:pointer; touch-action:manipulation;
    }
    .fab-calc-key.operator { background:var(--accent-soft); color:var(--accent); }
    .fab-calc-key.equals { background:var(--accent); color:#fff; border-color:var(--accent); }
    .fab-calc-key.danger { background:var(--danger-bg); color:var(--danger); }
    .fab-calc-key:active { transform:translateY(1px); }
    .fab-calc-status { min-height:20px; margin-top:9px; color:var(--muted); font-size:.8rem; line-height:1.35; }
    .fab-guide-section { margin-bottom:16px; }
    .fab-guide-section h3 { margin:0 0 8px; color:var(--accent); font-size:1rem; }
    .fab-guide-list { display:grid; gap:7px; margin:0; padding:0; list-style:none; }
    .fab-guide-list li { background:var(--card2); border:1px solid var(--border); border-radius:10px; padding:9px 10px; line-height:1.38; }
    .fab-guide-list b { color:var(--text); }
    @media (max-width:520px) {
      .fab-page-menu-btn { padding:8px 10px; font-size:.82rem; }
      .fab-calculator-title-row { align-items:stretch; flex-direction:column; }
      .fab-calc-grid { gap:7px; }
      .fab-calc-key { min-height:50px; }
    }
    @media print { .fab-page-menu-btn,#pageMenuBackdrop,#pageMenuDrawer,#calculatorGuideBackdrop,#calculatorGuideDrawer { display:none!important; } }
  `;
  document.head.appendChild(style);

  document.title = 'Fabri-Cadabra';
  const brandHeading = document.querySelector('.brand h1');
  if (brandHeading) brandHeading.textContent = 'Fabri-Cadabra';

  const originalNav = document.querySelector('.tool-menu');
  const originalTabs = originalNav ? Array.from(originalNav.querySelectorAll('.tool-tab')) : [];
  const originalTabByTool = new Map(originalTabs.map(tab => [tab.dataset.tool, tab]));
  if (originalNav) originalNav.remove();

  function syncBodyDrawerState() {
    document.body.classList.toggle('cut-list-drawer-open', !!document.querySelector('.cut-list-drawer.open'));
  }

  function createDrawer({ id, title, widthClass = '', bodyHtml = '' }) {
    const backdrop = document.createElement('div');
    backdrop.id = `${id}Backdrop`;
    backdrop.className = 'cut-list-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    const drawer = document.createElement('aside');
    drawer.id = id;
    drawer.className = `cut-list-drawer ${widthClass}`.trim();
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('aria-labelledby', `${id}Title`);
    drawer.innerHTML = `<div class="cut-list-drawer-head"><strong id="${id}Title">${title}</strong><button class="cut-list-close-btn" type="button" aria-label="Close ${title}">×</button></div><div class="cut-list-drawer-body">${bodyHtml}</div>`;
    document.body.append(backdrop, drawer);
    return { backdrop, drawer, close: drawer.querySelector('.cut-list-close-btn') };
  }

  function setDrawerOpen(parts, open, returnFocus) {
    parts.drawer.classList.toggle('open', open);
    parts.backdrop.classList.toggle('open', open);
    parts.drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    parts.backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
    syncBodyDrawerState();
    if (open) requestAnimationFrame(() => parts.close.focus({ preventScroll:true }));
    else if (returnFocus) requestAnimationFrame(() => returnFocus.focus({ preventScroll:true }));
  }

  const pageMenuBtn = document.createElement('button');
  pageMenuBtn.id = 'pageMenuBtn';
  pageMenuBtn.className = 'fab-page-menu-btn';
  pageMenuBtn.type = 'button';
  pageMenuBtn.setAttribute('aria-expanded', 'false');
  pageMenuBtn.setAttribute('aria-controls', 'pageMenuDrawer');
  pageMenuBtn.innerHTML = '<span aria-hidden="true">☰</span> Pages';
  document.body.appendChild(pageMenuBtn);

  const pageItems = [
    ['overhang','Aluminum Overhang'], ['fasteners','Fastener Spacing'], ['optimizer','Material Optimizer'],
    ['saw','Saw Optimizer'], ['tasklog','Task Logging'], ['notes','Fabricator Notes'],
    ['checklist','Checklist'], ['reference','Quick Reference'], ['calculator','Basic Calculator']
  ];
  const pageDrawer = createDrawer({
    id:'pageMenuDrawer', title:'Pages', widthClass:'fab-page-drawer',
    bodyHtml:`<nav class="fab-page-list" aria-label="Fabrication tools">${pageItems.map(([tool,label]) => `<button class="fab-page-link" type="button" data-tool="${tool}">${label}</button>`).join('')}</nav>`
  });

  const appMain = document.querySelector('main.app');
  const footer = appMain && appMain.querySelector('.footer');
  const calculatorPanel = document.createElement('section');
  calculatorPanel.id = 'tool-calculator';
  calculatorPanel.className = 'tool-panel';
  calculatorPanel.innerHTML = `
    <div class="tool-title fab-calculator-title-row">
      <div><h2>Basic Calculator</h2><p>Fast shop arithmetic with memory, percentages, roots, powers, rounding, keyboard input, and repeated operations.</p></div>
      <button id="calculatorGuideBtn" class="cut-list-menu-btn" type="button" aria-expanded="false" aria-controls="calculatorGuideDrawer"><span class="hamburger" aria-hidden="true">☰</span><span>Calculator Guide</span></button>
    </div>
    <section class="card fab-calc-shell" aria-label="Basic calculator">
      <div id="calculatorDisplay" class="fab-calc-display" role="status" aria-live="polite">0</div>
      <div id="calculatorMemory" class="fab-calc-memory" aria-live="polite"></div>
      <div class="fab-calc-grid">
        <button class="fab-calc-key" type="button" data-calc-action="memory-clear">mc</button>
        <button class="fab-calc-key" type="button" data-calc-action="memory-recall">mr</button>
        <button class="fab-calc-key" type="button" data-calc-action="memory-subtract">m−</button>
        <button class="fab-calc-key" type="button" data-calc-action="memory-add">m+</button>
        <button class="fab-calc-key danger" type="button" data-calc-action="clear">AC</button>
        <button class="fab-calc-key operator" type="button" data-calc-action="sqrt">√x</button>
        <button class="fab-calc-key operator" type="button" data-calc-action="percent">%</button>
        <button class="fab-calc-key operator" type="button" data-calc-action="operator" data-calc-value="/">÷</button>
        <button class="fab-calc-key" type="button" data-calc-action="digit" data-calc-value="7">7</button>
        <button class="fab-calc-key" type="button" data-calc-action="digit" data-calc-value="8">8</button>
        <button class="fab-calc-key" type="button" data-calc-action="digit" data-calc-value="9">9</button>
        <button class="fab-calc-key operator" type="button" data-calc-action="operator" data-calc-value="*">×</button>
        <button class="fab-calc-key" type="button" data-calc-action="digit" data-calc-value="4">4</button>
        <button class="fab-calc-key" type="button" data-calc-action="digit" data-calc-value="5">5</button>
        <button class="fab-calc-key" type="button" data-calc-action="digit" data-calc-value="6">6</button>
        <button class="fab-calc-key operator" type="button" data-calc-action="operator" data-calc-value="-">−</button>
        <button class="fab-calc-key" type="button" data-calc-action="digit" data-calc-value="1">1</button>
        <button class="fab-calc-key" type="button" data-calc-action="digit" data-calc-value="2">2</button>
        <button class="fab-calc-key" type="button" data-calc-action="digit" data-calc-value="3">3</button>
        <button class="fab-calc-key operator" type="button" data-calc-action="operator" data-calc-value="+">+</button>
        <button class="fab-calc-key" type="button" data-calc-action="digit" data-calc-value="0">0</button>
        <button class="fab-calc-key" type="button" data-calc-action="decimal">.</button>
        <button class="fab-calc-key" type="button" data-calc-action="sign">+/−</button>
        <button class="fab-calc-key equals" type="button" data-calc-action="equals">=</button>
        <button class="fab-calc-key operator" type="button" data-calc-action="pi">π</button>
        <button class="fab-calc-key operator" type="button" data-calc-action="power">xʸ</button>
        <button class="fab-calc-key" type="button" data-calc-action="round-2">R2</button>
        <button class="fab-calc-key" type="button" data-calc-action="round-0">R0</button>
      </div>
      <div id="calculatorStatus" class="fab-calc-status">Keyboard: 0–9, +, −, ×, ÷, ^, %, Enter/=, Backspace, Delete/Escape.</div>
    </section>`;
  if (appMain) appMain.insertBefore(calculatorPanel, footer || null);

  const guideDrawer = createDrawer({
    id:'calculatorGuideDrawer', title:'Calculator Guide',
    bodyHtml:`
      <section class="fab-guide-section"><h3>Function definitions</h3><ul class="fab-guide-list">
        <li><b>mc</b> clears calculator memory.</li><li><b>mr</b> recalls memory to the display.</li><li><b>m− / m+</b> subtracts from or adds the displayed value to memory.</li>
        <li><b>AC</b> resets the current calculation.</li><li><b>√x</b> returns the square root of the displayed value.</li><li><b>%</b> applies percentage behavior to the current operation.</li>
        <li><b>π</b> enters pi.</li><li><b>xʸ</b> raises the first value to the power entered next.</li><li><b>R2 / R0</b> rounds the displayed value to 2 decimal places or a whole number.</li>
        <li><b>+/−</b> switches the sign of the displayed value.</li><li><b>=</b> completes the operation; pressing it again repeats the last operation.</li>
      </ul></section>
      <section class="fab-guide-section"><h3>Basic operations</h3><ul class="fab-guide-list">
        <li><b>Add / subtract:</b> enter a value, choose + or −, enter the next value, then press =.</li>
        <li><b>Multiply / divide:</b> enter a value, choose × or ÷, enter the next value, then press =.</li>
        <li><b>Repeat:</b> after a completed calculation, press = again to repeat the last operator and operand.</li>
        <li><b>Percent:</b> with + or −, the percent is based on the first value; with × or ÷, the entered percent is converted to its decimal fraction.</li>
        <li><b>Powers:</b> enter x, press xʸ, enter y, then press =.</li>
        <li><b>Roots:</b> enter a non-negative value and press √x.</li>
        <li><b>Memory:</b> use m+ or m− to update memory and mr to bring it back to the display.</li>
        <li><b>Correcting input:</b> Backspace removes the last typed digit. Delete or Escape clears the current calculation.</li>
        <li><b>Keyboard:</b> number keys and standard arithmetic keys work while the Calculator page is selected.</li>
      </ul></section>`
  });

  const pageLinks = Array.from(pageDrawer.drawer.querySelectorAll('.fab-page-link'));
  const guideBtn = calculatorPanel.querySelector('#calculatorGuideBtn');
  let activeTool = null;

  function markActive(tool) {
    activeTool = tool;
    pageLinks.forEach(link => link.classList.toggle('active', link.dataset.tool === tool));
  }

  function activateCalculator() {
    document.querySelectorAll('.tool-panel').forEach(panel => panel.classList.toggle('active', panel === calculatorPanel));
    originalTabs.forEach(tab => tab.classList.remove('active'));
    storageSet('fabricationTool', 'calculator');
    markActive('calculator');
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  function activateExistingTool(tool) {
    calculatorPanel.classList.remove('active');
    const original = originalTabByTool.get(tool);
    if (original) original.click();
    markActive(tool);
  }

  function activateTool(tool) {
    if (tool === 'calculator') activateCalculator();
    else activateExistingTool(tool);
    setDrawerOpen(pageDrawer, false, pageMenuBtn);
    pageMenuBtn.setAttribute('aria-expanded', 'false');
  }

  pageMenuBtn.addEventListener('click', () => {
    const open = !pageDrawer.drawer.classList.contains('open');
    setDrawerOpen(pageDrawer, open, open ? null : pageMenuBtn);
    pageMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  pageDrawer.close.addEventListener('click', () => { setDrawerOpen(pageDrawer, false, pageMenuBtn); pageMenuBtn.setAttribute('aria-expanded','false'); });
  pageDrawer.backdrop.addEventListener('click', () => { setDrawerOpen(pageDrawer, false, pageMenuBtn); pageMenuBtn.setAttribute('aria-expanded','false'); });
  pageDrawer.drawer.addEventListener('click', event => {
    const link = event.target.closest('.fab-page-link');
    if (link) activateTool(link.dataset.tool);
  });

  guideBtn.addEventListener('click', () => {
    const open = !guideDrawer.drawer.classList.contains('open');
    setDrawerOpen(guideDrawer, open, open ? null : guideBtn);
    guideBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  guideDrawer.close.addEventListener('click', () => { setDrawerOpen(guideDrawer, false, guideBtn); guideBtn.setAttribute('aria-expanded','false'); });
  guideDrawer.backdrop.addEventListener('click', () => { setDrawerOpen(guideDrawer, false, guideBtn); guideBtn.setAttribute('aria-expanded','false'); });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && pageDrawer.drawer.classList.contains('open')) {
      event.preventDefault(); setDrawerOpen(pageDrawer, false, pageMenuBtn); pageMenuBtn.setAttribute('aria-expanded','false'); return;
    }
    if (event.key === 'Escape' && guideDrawer.drawer.classList.contains('open')) {
      event.preventDefault(); setDrawerOpen(guideDrawer, false, guideBtn); guideBtn.setAttribute('aria-expanded','false'); return;
    }
  });

  const display = calculatorPanel.querySelector('#calculatorDisplay');
  const memoryLabel = calculatorPanel.querySelector('#calculatorMemory');
  const status = calculatorPanel.querySelector('#calculatorStatus');
  const state = { display:'0', accumulator:null, pendingOp:null, waiting:true, lastOp:null, lastOperand:null, memory:0, error:false };

  function numberFromDisplay() { return Number(state.display); }
  function formatNumber(value) {
    if (!Number.isFinite(value)) return 'Error';
    if (Object.is(value, -0)) value = 0;
    const abs = Math.abs(value);
    if ((abs >= 1e12) || (abs > 0 && abs < 1e-9)) return value.toExponential(10).replace(/\.0+e/,'e').replace(/(\.\d*?[1-9])0+e/,'$1e');
    return Number(value.toPrecision(12)).toString();
  }
  function render(message = '') {
    display.textContent = state.display;
    memoryLabel.textContent = state.memory ? `Memory: ${formatNumber(state.memory)}` : '';
    if (message) status.textContent = message;
  }
  function fail(message) {
    state.display='Error'; state.error=true; state.accumulator=null; state.pendingOp=null; state.waiting=true; state.lastOp=null; state.lastOperand=null;
    render(message);
  }
  function resetIfError() { if (state.error) clearAll(); }
  function clearAll() {
    state.display='0'; state.accumulator=null; state.pendingOp=null; state.waiting=true; state.lastOp=null; state.lastOperand=null; state.error=false;
    render('Calculator cleared.');
  }
  function inputDigit(digit) {
    resetIfError();
    if (state.waiting) { state.display=digit; state.waiting=false; }
    else if (state.display.replace('-','').replace('.','').length < 15) state.display = state.display === '0' ? digit : state.display + digit;
    render();
  }
  function inputDecimal() {
    resetIfError();
    if (state.waiting) { state.display='0.'; state.waiting=false; }
    else if (!state.display.includes('.')) state.display += '.';
    render();
  }
  function calculate(a, b, op) {
    if (op === '+') return a+b;
    if (op === '-') return a-b;
    if (op === '*') return a*b;
    if (op === '/') return b === 0 ? NaN : a/b;
    if (op === '^') return Math.pow(a,b);
    return b;
  }
  function setDisplayNumber(value, message='') {
    if (!Number.isFinite(value)) { fail('That operation does not produce a valid finite result.'); return false; }
    state.display=formatNumber(value); state.error=false; render(message); return true;
  }
  function chooseOperator(op) {
    resetIfError();
    const input=numberFromDisplay();
    if (state.pendingOp && !state.waiting) {
      const result=calculate(state.accumulator,input,state.pendingOp);
      if (!setDisplayNumber(result)) return;
      state.accumulator=result;
    } else if (state.accumulator === null || !state.waiting) state.accumulator=input;
    state.pendingOp=op; state.waiting=true; state.lastOp=null; state.lastOperand=null; render(`Operator ${op === '^' ? 'power' : op} selected.`);
  }
  function equals() {
    if (state.error) return;
    let op=state.pendingOp, operand=numberFromDisplay(), left=state.accumulator;
    if (!op) {
      if (!state.lastOp) return;
      op=state.lastOp; operand=state.lastOperand; left=numberFromDisplay();
    }
    if (left === null) left=numberFromDisplay();
    const result=calculate(left,operand,op);
    if (!setDisplayNumber(result,'Result calculated.')) return;
    state.accumulator=result; state.lastOp=op; state.lastOperand=operand; state.pendingOp=null; state.waiting=true;
  }
  function percent() {
    resetIfError();
    let value=numberFromDisplay();
    if (state.pendingOp && state.accumulator !== null && (state.pendingOp==='+' || state.pendingOp==='-')) value=state.accumulator*value/100;
    else value=value/100;
    if (setDisplayNumber(value,'Percentage applied.')) state.waiting=true;
  }
  function sqrt() {
    resetIfError(); const value=numberFromDisplay();
    if (value < 0) { fail('Square root requires a non-negative value.'); return; }
    if (setDisplayNumber(Math.sqrt(value),'Square root calculated.')) state.waiting=true;
  }
  function sign() {
    resetIfError(); const value=numberFromDisplay(); if (setDisplayNumber(-value)) state.waiting=false;
  }
  function pi() { resetIfError(); state.display=formatNumber(Math.PI); state.waiting=false; render('π entered.'); }
  function roundTo(decimals) {
    resetIfError(); const factor=10**decimals; const value=Math.round((numberFromDisplay()+Number.EPSILON)*factor)/factor;
    if (setDisplayNumber(value,decimals===2?'Rounded to 2 decimal places.':'Rounded to a whole number.')) state.waiting=true;
  }
  function backspace() {
    resetIfError(); if (state.waiting) return;
    state.display = state.display.length <= 1 || (state.display.startsWith('-') && state.display.length===2) ? '0' : state.display.slice(0,-1);
    render('Last digit removed.');
  }
  function memory(action) {
    resetIfError(); const value=numberFromDisplay();
    if (action==='memory-clear') state.memory=0;
    if (action==='memory-add') state.memory+=value;
    if (action==='memory-subtract') state.memory-=value;
    if (action==='memory-recall') { state.display=formatNumber(state.memory); state.waiting=true; }
    render(action==='memory-clear'?'Memory cleared.':'Memory updated.');
  }

  calculatorPanel.addEventListener('click', event => {
    const key=event.target.closest('[data-calc-action]'); if (!key) return;
    const action=key.dataset.calcAction, value=key.dataset.calcValue;
    if (action==='digit') inputDigit(value);
    else if (action==='decimal') inputDecimal();
    else if (action==='operator') chooseOperator(value);
    else if (action==='power') chooseOperator('^');
    else if (action==='equals') equals();
    else if (action==='clear') clearAll();
    else if (action==='sqrt') sqrt();
    else if (action==='percent') percent();
    else if (action==='sign') sign();
    else if (action==='pi') pi();
    else if (action==='round-2') roundTo(2);
    else if (action==='round-0') roundTo(0);
    else if (action.startsWith('memory-')) memory(action);
  });

  document.addEventListener('keydown', event => {
    if (activeTool !== 'calculator' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    const key=event.key;
    if (/^\d$/.test(key)) { event.preventDefault(); inputDigit(key); }
    else if (key==='.') { event.preventDefault(); inputDecimal(); }
    else if (['+','-','*','/','^'].includes(key)) { event.preventDefault(); chooseOperator(key); }
    else if (key==='%' ) { event.preventDefault(); percent(); }
    else if (key==='Enter' || key==='=') { event.preventDefault(); equals(); }
    else if (key==='Backspace') { event.preventDefault(); backspace(); }
    else if (key==='Delete' || key==='Escape') { event.preventDefault(); clearAll(); }
  });

  const savedTool = storageGet('fabricationTool');
  if (savedTool === 'calculator') activateCalculator();
  else {
    const current = originalTabs.find(tab => tab.classList.contains('active'))?.dataset.tool || savedTool || 'overhang';
    markActive(pageItems.some(([tool]) => tool===current) ? current : 'overhang');
  }
  render();
})();
