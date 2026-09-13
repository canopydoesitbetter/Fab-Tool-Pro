  // ---------------- Aluminum overhang calculator ----------------
  const MAX_CUT = 119.5;
  const SEAM = 1;
  const MIN_SIZE = 48;
  const MAX_SIZE = 400;

  const longInput = document.getElementById('longSide');
  const shortInput = document.getElementById('shortSide');
  const longResult = document.getElementById('longResult');
  const shortResult = document.getElementById('shortResult');
  const overhangStatus = document.getElementById('overhangStatus');

  function fractionTextEighth(value) {
    const eighths = Math.round(value * 8);
    if (Math.abs(eighths / 8 - value) > 0.000001) return `${trimZeros(value)}"`;
    const whole = Math.floor(eighths / 8);
    const rem = eighths % 8;
    if (rem === 0) return `${whole}"`;
    const g = gcd(rem,8);
    const num = rem/g, den = 8/g;
    return whole > 0 ? `${whole} ${num}/${den}"` : `${num}/${den}"`;
  }

  function longPieces(size) {
    const count = Math.ceil(size / (MAX_CUT - 2));
    const coverage = size / count;
    const cut = coverage + 2;
    const pieces = [];
    for (let i=0; i<count; i++) {
      let flange;
      if (count === 1) flange = '1" corner flange on both ends';
      else if (i === 0) flange = '1" corner flange + 1" seam flange';
      else if (i === count - 1) flange = '1" seam flange + 1" corner flange';
      else flange = '1" seam flange on both ends';
      pieces.push({cut,flange});
    }
    return {count,coverage,pieces};
  }

  function shortPieces(size) {
    for (let count=1; count<=10; count++) {
      const coverage = size / count;
      const pieces = [];
      let fits = true;
      for (let i=0; i<count; i++) {
        let flanges = 0;
        let flange = 'No flanges';
        if (count > 1) {
          if (i === 0 || i === count - 1) { flanges = 1; flange = '1" seam flange'; }
          else { flanges = 2; flange = '1" seam flange on both ends'; }
        }
        const cut = coverage + flanges * SEAM;
        if (cut > MAX_CUT + 1e-9) fits = false;
        pieces.push({cut,flange});
      }
      if (fits) return {count,coverage,pieces};
    }
    throw new Error('Unable to calculate a valid short-side split.');
  }

  function renderOverhangResult(target,title,size,result) {
    const maxCut = Math.max(...result.pieces.map(p => p.cut));
    const pieceList = result.pieces.map((p,i) => `
      <div class="piece">
        <div class="piece-num">${i+1}</div>
        <div><strong>Cut ${fractionTextEighth(p.cut)}</strong><small>${p.flange}</small></div>
      </div>`).join('');

    target.innerHTML = `
      <div class="result-head">
        <strong>${title}</strong>
        <span class="badge">${result.count} piece${result.count === 1 ? '' : 's'}</span>
      </div>
      <div class="result-body">
        <div class="big">${fractionTextEighth(size)} finished</div>
        <div class="sub">Equal finished coverage: ${fractionTextEighth(result.coverage)} per piece</div>
        <div class="pieces">${pieceList}</div>
        <div class="summary">
          <div class="metric"><span>Longest blank</span><b>${fractionTextEighth(maxCut)}</b></div>
          <div class="metric"><span>Usable maximum</span><b>119 1/2"</b></div>
        </div>
      </div>`;
  }

  function validateOverhang(value,name) {
    if (!Number.isFinite(value)) return `${name} must be a number.`;
    if (value < MIN_SIZE || value > MAX_SIZE) return `${name} must be between 48" and 400".`;
    return '';
  }

  function calculateOverhang(showMessage=false) {
    const longSide = parseFloat(longInput.value);
    const shortSide = parseFloat(shortInput.value);
    const errors = [validateOverhang(longSide,'Long side'),validateOverhang(shortSide,'Short side')].filter(Boolean);
    if (errors.length) {
      overhangStatus.className = 'status show error';
      overhangStatus.textContent = errors.join(' ');
      longResult.innerHTML = '';
      shortResult.innerHTML = '';
      return;
    }
    renderOverhangResult(longResult,'Long Side',longSide,longPieces(longSide));
    renderOverhangResult(shortResult,'Short Side',shortSide,shortPieces(shortSide));
    if (showMessage) {
      overhangStatus.className = 'status show ok';
      overhangStatus.textContent = 'Cuts calculated.';
      setTimeout(() => { if (overhangStatus.classList.contains('ok')) overhangStatus.className = 'status'; }, 1400);
    } else overhangStatus.className = 'status';
  }

  document.getElementById('overhangCalculateBtn').addEventListener('click', () => calculateOverhang(true));
  document.getElementById('swapBtn').addEventListener('click', () => {
    const temp = longInput.value;
    longInput.value = shortInput.value;
    shortInput.value = temp;
    calculateOverhang();
  });
  [longInput,shortInput].forEach(el => {
    el.addEventListener('input', () => calculateOverhang());
    el.addEventListener('keydown', e => { if (e.key === 'Enter') calculateOverhang(true); });
  });

  // ---------------- Fastener spacing calculator ----------------
  const FASTENER_SPACING_STORE_ID='fastenerSpacing';
  const FASTENER_SPACING_STATE_KEY='fabricationFastenerSpacingV1';
  const FASTENER_SPACING_STATE_VERSION=1;
  const maxSpacingInput = document.getElementById('maxSpacing');
  const fastenerLengthInput = document.getElementById('fastenerLength');

  function installFastenerSpacingEnhancements() {
    const inputs=maxSpacingInput?.closest('.fastener-inputs');
    if (inputs && !document.getElementById('cornerTolerance')) {
      const field=document.createElement('div');
      field.className='fastener-corner-tolerance-field';
      field.innerHTML=`
        <label for="cornerTolerance">Corner Tolerance</label>
        <input id="cornerTolerance" type="number" min="0" step="any" inputmode="decimal" value="0" placeholder="Example: 2" />
        <span class="hint">Applied equally at both ends. Every fastener location remains measured from the true edge.</span>`;
      inputs.appendChild(field);
    }
    if (!document.getElementById('fastenerSpacingEnhancementStyles')) {
      const style=document.createElement('style');
      style.id='fastenerSpacingEnhancementStyles';
      style.textContent=`
        #tool-fasteners .fastener-inputs{grid-template-columns:repeat(3,minmax(0,1fr));}
        #tool-fasteners .fastener-location-toggle{position:relative;width:100%;color:var(--text);font:inherit;cursor:pointer;box-shadow:none;transition:transform .14s ease,border-color .14s ease,background-color .14s ease,box-shadow .14s ease;}
        #tool-fasteners .fastener-location-toggle:hover{transform:translateY(-1px);box-shadow:0 5px 12px rgba(22,34,43,.10);filter:none;}
        #tool-fasteners .fastener-location-toggle:active{transform:scale(.98);box-shadow:none;filter:none;}
        #tool-fasteners .fastener-location-toggle:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 32%,transparent);outline-offset:2px;}
        #tool-fasteners .fastener-location-toggle .fastener-check{position:absolute;top:6px;right:7px;width:19px;height:19px;border-radius:999px;display:grid;place-items:center;border:1px solid var(--border);background:var(--card);color:transparent;font-size:.72rem;font-weight:950;transition:background-color .14s ease,color .14s ease,border-color .14s ease;}
        #tool-fasteners .fastener-location-toggle.fastener-complete{background:var(--good-bg);border-color:var(--good);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--good) 35%,transparent);}
        #tool-fasteners .fastener-location-toggle.fastener-complete .num,#tool-fasteners .fastener-location-toggle.fastener-complete .pos{color:var(--good);}
        #tool-fasteners .fastener-location-toggle.fastener-complete .fastener-check{background:var(--good);border-color:var(--good);color:var(--card);}
        #tool-fasteners .dot.fastener-complete{background:var(--good);box-shadow:0 0 0 4px color-mix(in srgb,var(--good) 22%,transparent);}
        @media (max-width:700px){#tool-fasteners .fastener-inputs{grid-template-columns:1fr;}}
        @media (prefers-reduced-motion:reduce){#tool-fasteners .fastener-location-toggle,#tool-fasteners .fastener-location-toggle .fastener-check{transition:none;}}
      `;
      document.head.appendChild(style);
    }
  }

  installFastenerSpacingEnhancements();

  const cornerToleranceInput = document.getElementById('cornerTolerance');
  const fastenerError = document.getElementById('fastenerError');
  const fastenerResults = document.getElementById('fastenerResults');
  const spaceCountEl = document.getElementById('spaceCount');
  const spacingFractionEl = document.getElementById('spacingFraction');
  const spacingDecimalEl = document.getElementById('spacingDecimal');
  const fastenerCountEl = document.getElementById('fastenerCount');
  const locationsEl = document.getElementById('locations');
  const diagramEl = document.getElementById('diagram');

  function defaultFastenerSpacingState() {
    return {
      version:FASTENER_SPACING_STATE_VERSION,
      maxSpacing:'',
      length:'',
      cornerTolerance:'0',
      layoutSignature:'',
      completedFasteners:[]
    };
  }

  function normalizeFastenerSpacingState(value) {
    const source=value && typeof value==='object' && !Array.isArray(value) ? value : {};
    const text=(candidate,fallback='')=>String(candidate ?? fallback).trim().slice(0,40);
    const completed=Array.isArray(source.completedFasteners)
      ? Array.from(new Set(source.completedFasteners.map(Number).filter(index=>Number.isInteger(index) && index>=0 && index<=1000))).sort((a,b)=>a-b)
      : [];
    return {
      version:FASTENER_SPACING_STATE_VERSION,
      maxSpacing:text(source.maxSpacing),
      length:text(source.length),
      cornerTolerance:text(source.cornerTolerance,'0'),
      layoutSignature:text(source.layoutSignature),
      completedFasteners:completed
    };
  }

  registerPersistentStore({
    id:FASTENER_SPACING_STORE_ID,
    key:FASTENER_SPACING_STATE_KEY,
    version:FASTENER_SPACING_STATE_VERSION,
    label:'Fastener Spacing',
    defaultValue:defaultFastenerSpacingState,
    getVersion:value=>Number(value?.version || 1),
    normalize:normalizeFastenerSpacingState
  });

  // @fastener-spacing-core-start
  function buildFastenerSpacingLayout(maxSpacing,length,cornerTolerance=0) {
    const usableSpan=length-(cornerTolerance*2);
    const spaces=Math.max(1,Math.ceil((usableSpan/maxSpacing)-1e-12));
    const exactSpacing=usableSpan/spaces;
    const positions=Array.from({length:spaces+1},(_,index)=>cornerTolerance+(exactSpacing*index));
    positions[positions.length-1]=length-cornerTolerance;
    return {maxSpacing,length,cornerTolerance,usableSpan,spaces,exactSpacing,fasteners:spaces+1,positions};
  }

  function fastenerLayoutSignature(layout) {
    return [layout.maxSpacing,layout.length,layout.cornerTolerance,layout.spaces,...layout.positions]
      .map(value=>Number(value).toFixed(8)).join('|');
  }
  // @fastener-spacing-core-end

  let selectedFastenerIndexes=new Set();
  let fastenerProgressSignature='';

  function roundToSixteenth(value) {
    return Math.round((value + Number.EPSILON) * 16) / 16;
  }

  function toFraction16(value) {
    const rounded = roundToSixteenth(value);
    let whole = Math.floor(rounded + 1e-10);
    let numerator = Math.round((rounded - whole) * 16);
    if (numerator === 16) { whole += 1; numerator = 0; }
    if (numerator === 0) return whole + '"';
    const d = gcd(numerator,16);
    const n = numerator/d, den = 16/d;
    return whole === 0 ? `${n}/${den}"` : `${whole} ${n}/${den}"`;
  }

  function decimalText(value) {
    return 'Calculated (decimal): ' + value.toFixed(4).replace(/0+$/,'').replace(/\.$/,'') + '"';
  }

  function showFastenerError(message) {
    fastenerError.textContent = message;
    fastenerError.classList.add('show');
    fastenerResults.classList.remove('show');
  }

  function clearFastenerError() {
    fastenerError.textContent = '';
    fastenerError.classList.remove('show');
  }

  function saveFastenerSpacingState() {
    const state={
      version:FASTENER_SPACING_STATE_VERSION,
      maxSpacing:maxSpacingInput.value.trim(),
      length:fastenerLengthInput.value.trim(),
      cornerTolerance:cornerToleranceInput.value.trim(),
      layoutSignature:fastenerProgressSignature,
      completedFasteners:Array.from(selectedFastenerIndexes).sort((a,b)=>a-b)
    };
    try { writePersistentStore(FASTENER_SPACING_STORE_ID,state); }
    catch (error) { console.warn('Fastener Spacing could not be saved.',error); }
  }

  function setFastenerCompletionVisual(index,complete) {
    const item=locationsEl.querySelector(`[data-fastener-index="${index}"]`);
    if (item) {
      item.classList.toggle('fastener-complete',complete);
      item.setAttribute('aria-pressed',complete?'true':'false');
      item.title=complete?'Marked complete — tap to unmark':'Tap to mark this fastener complete';
    }
    const dot=diagramEl.querySelector(`[data-fastener-dot="${index}"]`);
    if (dot) dot.classList.toggle('fastener-complete',complete);
  }

  function calculateFasteners(options={}) {
    const settings=options && options.type ? {} : options;
    clearFastenerError();
    const maxSpacingText = maxSpacingInput.value.trim();
    const lengthText = fastenerLengthInput.value.trim();
    const cornerToleranceText = cornerToleranceInput.value.trim();
    if (maxSpacingText === '' || lengthText === '') {
      showFastenerError('Enter both Max Spacing and Length.');
      saveFastenerSpacingState();
      return;
    }
    const maxSpacing = Number(maxSpacingText);
    const length = Number(lengthText);
    const cornerTolerance = cornerToleranceText === '' ? 0 : Number(cornerToleranceText);

    if (!Number.isFinite(maxSpacing) || !Number.isFinite(length) || !Number.isFinite(cornerTolerance)) {
      showFastenerError('Enter valid numbers for Max Spacing, Length, and Corner Tolerance.');
      saveFastenerSpacingState();
      return;
    }
    if (maxSpacing < 4 || maxSpacing > 36) {
      showFastenerError('Max Spacing must be between 4" and 36".');
      saveFastenerSpacingState();
      return;
    }
    if (length <= 0 || length > 400) {
      showFastenerError('Length must be greater than 0" and no more than 400".');
      saveFastenerSpacingState();
      return;
    }
    if (cornerTolerance < 0) {
      showFastenerError('Corner Tolerance must be 0" or greater.');
      saveFastenerSpacingState();
      return;
    }
    if (cornerTolerance * 2 >= length) {
      showFastenerError('Corner Tolerance must be less than half of the Length so there is usable space between both ends.');
      saveFastenerSpacingState();
      return;
    }

    const layout=buildFastenerSpacingLayout(maxSpacing,length,cornerTolerance);
    const {spaces,exactSpacing,fasteners,positions}=layout;
    const layoutSignature=fastenerLayoutSignature(layout);
    if (layoutSignature !== fastenerProgressSignature) selectedFastenerIndexes.clear();
    fastenerProgressSignature=layoutSignature;
    selectedFastenerIndexes=new Set(Array.from(selectedFastenerIndexes).filter(index=>index>=0 && index<fasteners));

    spaceCountEl.textContent = spaces;
    spacingFractionEl.textContent = toFraction16(exactSpacing);
    spacingDecimalEl.textContent = decimalText(exactSpacing);
    fastenerCountEl.textContent = fasteners;
    locationsEl.innerHTML = '';
    diagramEl.innerHTML = '<div class="rail"></div>';

    for (let i=0; i<=spaces; i++) {
      const exactPosition=positions[i];
      const displayPosition=roundToSixteenth(exactPosition);
      const complete=selectedFastenerIndexes.has(i);

      const item = document.createElement('button');
      item.type='button';
      item.className = `location fastener-location-toggle${complete?' fastener-complete':''}`;
      item.dataset.fastenerIndex=String(i);
      item.setAttribute('aria-pressed',complete?'true':'false');
      item.setAttribute('aria-label',`Fastener ${i+1} at ${toFraction16(displayPosition)} from the true edge${complete?', marked complete':''}`);
      item.title=complete?'Marked complete — tap to unmark':'Tap to mark this fastener complete';
      item.innerHTML = `<span class="fastener-check" aria-hidden="true">✓</span><span class="num">Fastener ${i+1}</span><span class="pos">${toFraction16(displayPosition)}</span>`;
      locationsEl.appendChild(item);

      const dot = document.createElement('div');
      dot.className = `dot${complete?' fastener-complete':''}`;
      dot.dataset.fastenerDot=String(i);
      dot.style.left = ((exactPosition / length) * 100) + '%';
      dot.title = `Fastener ${i+1}: ${toFraction16(displayPosition)} from true edge`;
      diagramEl.appendChild(dot);

      if (i === 0 || i === spaces) {
        const label = document.createElement('div');
        label.className = 'end-label';
        label.style.left = ((exactPosition / length) * 100) + '%';
        label.textContent = toFraction16(displayPosition);
        diagramEl.appendChild(label);
      }
    }

    fastenerResults.classList.add('show');
    saveFastenerSpacingState();
    if (settings.scroll !== false) fastenerResults.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function restoreFastenerSpacingState() {
    const loaded=loadPersistentStore(FASTENER_SPACING_STORE_ID);
    const state=loaded?.value || defaultFastenerSpacingState();
    maxSpacingInput.value=state.maxSpacing || '';
    fastenerLengthInput.value=state.length || '';
    cornerToleranceInput.value=state.cornerTolerance === '' ? '0' : state.cornerTolerance;
    fastenerProgressSignature=state.layoutSignature || '';
    selectedFastenerIndexes=new Set(Array.isArray(state.completedFasteners)?state.completedFasteners:[]);
    if (maxSpacingInput.value !== '' && fastenerLengthInput.value !== '') calculateFasteners({scroll:false,restoring:true});
  }

  function clearFasteners() {
    maxSpacingInput.value = '';
    fastenerLengthInput.value = '';
    cornerToleranceInput.value = '0';
    fastenerProgressSignature='';
    selectedFastenerIndexes.clear();
    clearFastenerError();
    fastenerResults.classList.remove('show');
    locationsEl.innerHTML = '';
    diagramEl.innerHTML = '';
    try { writePersistentStore(FASTENER_SPACING_STORE_ID,defaultFastenerSpacingState()); }
    catch (error) { console.warn('Fastener Spacing saved state could not be cleared.',error); }
    maxSpacingInput.focus();
  }

  locationsEl.addEventListener('click',event=>{
    const item=event.target.closest('[data-fastener-index]');
    if (!item || !locationsEl.contains(item)) return;
    const index=Number(item.dataset.fastenerIndex);
    if (!Number.isInteger(index)) return;
    if (selectedFastenerIndexes.has(index)) selectedFastenerIndexes.delete(index);
    else selectedFastenerIndexes.add(index);
    setFastenerCompletionVisual(index,selectedFastenerIndexes.has(index));
    saveFastenerSpacingState();
  });

  document.getElementById('fastenerCalculateBtn').addEventListener('click',()=>calculateFasteners());
  document.getElementById('fastenerClearBtn').addEventListener('click', clearFasteners);
  [maxSpacingInput,fastenerLengthInput,cornerToleranceInput].forEach(input => {
    input.addEventListener('input',saveFastenerSpacingState);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') calculateFasteners(); });
    input.addEventListener('change', () => {
      if (maxSpacingInput.value !== '' && fastenerLengthInput.value !== '') calculateFasteners();
    });
  });

  restoreFastenerSpacingState();



