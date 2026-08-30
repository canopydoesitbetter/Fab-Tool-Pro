/* Fabri-Cadabra Basic Calculator behavior. Markup lives in index.html; styling lives in styles.css. */
(() => {
  'use strict';
  const FabriCadabraApp=window.FabriCadabraApp;
  if (!FabriCadabraApp) throw new Error('FabriCadabraApp interface is unavailable.');
  const calculatorPanel=document.getElementById('tool-calculator');
  const guideBtn=document.getElementById('calculatorGuideBtn');
  const guideDrawer=document.getElementById('calculatorGuideDrawer');
  const guideBackdrop=document.getElementById('calculatorGuideBackdrop');
  const guideCloseBtn=document.getElementById('calculatorGuideCloseBtn');
  if (!calculatorPanel || !guideBtn || !guideDrawer || !guideBackdrop || !guideCloseBtn) throw new Error('Calculator static markup is incomplete.');

  function setGuideOpen(open) {
    if (open) FabriCadabraApp.openDrawer('calculatorGuideDrawer',guideBtn); else FabriCadabraApp.closeDrawer('calculatorGuideDrawer',guideBtn);
    guideBtn.setAttribute('aria-expanded',open?'true':'false');
  }
  guideBtn.addEventListener('click',()=>setGuideOpen(!FabriCadabraApp.isDrawerOpen('calculatorGuideDrawer')));
  guideCloseBtn.addEventListener('click',()=>setGuideOpen(false));
  guideBackdrop.addEventListener('click',()=>setGuideOpen(false));
  document.addEventListener('keydown',event=>{
    if (event.key==='Escape' && FabriCadabraApp.isDrawerOpen('calculatorGuideDrawer')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setGuideOpen(false);
    }
  });

const display = document.getElementById('calculatorDisplay');
  const memoryLabel = document.getElementById('calculatorMemory');
  const status = document.getElementById('calculatorStatus');
  const clearBtn = document.getElementById('calculatorClearBtn');
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
    clearBtn.textContent = !state.waiting && !state.error ? 'CE' : 'AC';
    clearBtn.setAttribute('aria-label', clearBtn.textContent === 'CE' ? 'Clear entry' : 'All clear');
    if (message) status.textContent = message;
  }
  function fail(message) {
    state.display='Error'; state.error=true; state.accumulator=null; state.pendingOp=null; state.waiting=true; state.lastOp=null; state.lastOperand=null;
    render(message);
  }
  function resetIfError() { if (state.error) clearAll(); }
  function clearAll() {
    state.display='0'; state.accumulator=null; state.pendingOp=null; state.waiting=true; state.lastOp=null; state.lastOperand=null; state.error=false;
    render('Calculation cleared. Memory preserved.');
  }
  function clearEntry() {
    if (state.error) { clearAll(); return; }
    state.display='0';
    state.waiting=true;
    render('Entry cleared.');
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
    render('Result calculated.');
  }
  function percent() {
    resetIfError();
    let value=numberFromDisplay();
    if (state.pendingOp && state.accumulator !== null && (state.pendingOp==='+' || state.pendingOp==='-')) value=state.accumulator*value/100;
    else value=value/100;
    if (setDisplayNumber(value,'Percentage applied.')) state.waiting=true;
    render('Percentage applied.');
  }
  function sqrt() {
    resetIfError(); const value=numberFromDisplay();
    if (value < 0) { fail('Square root requires a non-negative value.'); return; }
    if (setDisplayNumber(Math.sqrt(value),'Square root calculated.')) state.waiting=true;
    render('Square root calculated.');
  }
  function sign() {
    resetIfError(); const value=numberFromDisplay(); if (setDisplayNumber(-value)) state.waiting=false;
    render();
  }
  function pi() { resetIfError(); state.display=formatNumber(Math.PI); state.waiting=false; render('π entered.'); }
  function roundTo(decimals) {
    resetIfError(); const factor=10**decimals; const value=Math.round((numberFromDisplay()+Number.EPSILON)*factor)/factor;
    if (setDisplayNumber(value,decimals===2?'Rounded to 2 decimal places.':'Rounded to a whole number.')) state.waiting=true;
    render(decimals===2?'Rounded to 2 decimal places.':'Rounded to a whole number.');
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
    render(action==='memory-clear'?'Memory cleared.':action==='memory-recall'?'Memory recalled.':'Memory updated.');
  }

  calculatorPanel.addEventListener('click', event => {
    const key=event.target.closest('[data-calc-action]'); if (!key) return;
    const action=key.dataset.calcAction, value=key.dataset.calcValue;
    if (action==='digit') inputDigit(value);
    else if (action==='decimal') inputDecimal();
    else if (action==='operator') chooseOperator(value);
    else if (action==='power') chooseOperator('^');
    else if (action==='equals') equals();
    else if (action==='clear-context') state.waiting ? clearAll() : clearEntry();
    else if (action==='sqrt') sqrt();
    else if (action==='percent') percent();
    else if (action==='sign') sign();
    else if (action==='pi') pi();
    else if (action==='round-2') roundTo(2);
    else if (action==='round-0') roundTo(0);
    else if (action.startsWith('memory-')) memory(action);
  });

  document.addEventListener('keydown', event => {
    if (FabriCadabraApp.getActiveTool() !== 'calculator' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    const key=event.key;
    if (/^\d$/.test(key)) { event.preventDefault(); inputDigit(key); }
    else if (key==='.') { event.preventDefault(); inputDecimal(); }
    else if (['+','-','*','/','^'].includes(key)) { event.preventDefault(); chooseOperator(key); }
    else if (key==='%' ) { event.preventDefault(); percent(); }
    else if (key==='Enter' || key==='=') { event.preventDefault(); equals(); }
    else if (key==='Backspace' || key==='Delete') { event.preventDefault(); backspace(); }
    else if (key==='Escape') { event.preventDefault(); clearAll(); }
  });
  render();
})();
