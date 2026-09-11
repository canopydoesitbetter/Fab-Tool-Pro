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
  const maxSpacingInput = document.getElementById('maxSpacing');
  const fastenerLengthInput = document.getElementById('fastenerLength');
  const fastenerError = document.getElementById('fastenerError');
  const fastenerResults = document.getElementById('fastenerResults');
  const spaceCountEl = document.getElementById('spaceCount');
  const spacingFractionEl = document.getElementById('spacingFraction');
  const spacingDecimalEl = document.getElementById('spacingDecimal');
  const fastenerCountEl = document.getElementById('fastenerCount');
  const locationsEl = document.getElementById('locations');
  const diagramEl = document.getElementById('diagram');

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

  function calculateFasteners() {
    clearFastenerError();
    const maxSpacingText = maxSpacingInput.value.trim();
    const lengthText = fastenerLengthInput.value.trim();
    if (maxSpacingText === '' || lengthText === '') {
      showFastenerError('Enter both Max Spacing and Length.');
      return;
    }
    const maxSpacing = Number(maxSpacingText);
    const length = Number(lengthText);

    if (!Number.isFinite(maxSpacing) || !Number.isFinite(length)) {
      showFastenerError('Enter valid numbers for Max Spacing and Length.');
      return;
    }
    if (maxSpacing < 4 || maxSpacing > 36) {
      showFastenerError('Max Spacing must be between 4" and 36".');
      return;
    }
    if (length <= 0 || length > 400) {
      showFastenerError('Length must be greater than 0" and no more than 400".');
      return;
    }

    const spaces = Math.max(1, Math.ceil((length / maxSpacing) - 1e-12));
    const exactSpacing = length / spaces;
    const fasteners = spaces + 1;

    spaceCountEl.textContent = spaces;
    spacingFractionEl.textContent = toFraction16(exactSpacing);
    spacingDecimalEl.textContent = decimalText(exactSpacing);
    fastenerCountEl.textContent = fasteners;
    locationsEl.innerHTML = '';
    diagramEl.innerHTML = '<div class="rail"></div>';

    for (let i=0; i<=spaces; i++) {
      const exactPosition = (length * i) / spaces;
      const displayPosition = i === spaces ? length : roundToSixteenth(exactPosition);

      const item = document.createElement('div');
      item.className = 'location';
      item.innerHTML = `<span class="num">Fastener ${i+1}</span><span class="pos">${toFraction16(displayPosition)}</span>`;
      locationsEl.appendChild(item);

      const dot = document.createElement('div');
      dot.className = 'dot';
      dot.style.left = ((i / spaces) * 100) + '%';
      dot.title = `Fastener ${i+1}: ${toFraction16(displayPosition)}`;
      diagramEl.appendChild(dot);

      if (i === 0 || i === spaces) {
        const label = document.createElement('div');
        label.className = 'end-label';
        label.style.left = ((i / spaces) * 100) + '%';
        label.textContent = toFraction16(displayPosition);
        diagramEl.appendChild(label);
      }
    }

    fastenerResults.classList.add('show');
    fastenerResults.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function clearFasteners() {
    maxSpacingInput.value = '';
    fastenerLengthInput.value = '';
    clearFastenerError();
    fastenerResults.classList.remove('show');
    locationsEl.innerHTML = '';
    maxSpacingInput.focus();
  }

  document.getElementById('fastenerCalculateBtn').addEventListener('click', calculateFasteners);
  document.getElementById('fastenerClearBtn').addEventListener('click', clearFasteners);
  [maxSpacingInput,fastenerLengthInput].forEach(input => {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') calculateFasteners(); });
    input.addEventListener('change', () => {
      if (maxSpacingInput.value !== '' && fastenerLengthInput.value !== '') calculateFasteners();
    });
  });



