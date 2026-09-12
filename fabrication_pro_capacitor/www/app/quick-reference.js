  // ---------------- Quick Reference ----------------
  const quickReferenceSelect = document.getElementById('quickReferenceSelect');
  const quickReferenceCount = document.getElementById('quickReferenceCount');
  const quickReferenceTitle = document.getElementById('quickReferenceTitle');
  const quickReferenceDescription = document.getElementById('quickReferenceDescription');
  const quickReferenceTableHeading = document.getElementById('quickReferenceTableHeading');
  const quickReferenceBadge = document.getElementById('quickReferenceBadge');
  const quickReferenceExample = document.getElementById('quickReferenceExample');
  const quickReferenceTable = document.getElementById('quickReferenceTable');
  const quickReferenceDecimalMode = document.getElementById('quickReferenceDecimalMode');
  const quickReferenceDisplayMode = document.querySelector('.quick-ref-display-mode');
  const quickReferenceFractionLabel = document.getElementById('quickReferenceFractionLabel');
  const quickReferenceDecimalLabel = document.getElementById('quickReferenceDecimalLabel');
  const quickReferenceKeyElements = [1,2,3].map(n=>({
    icon:document.getElementById(`quickReferenceKey${n}Icon`),
    title:document.getElementById(`quickReferenceKey${n}Title`),
    text:document.getElementById(`quickReferenceKey${n}Text`)
  }));
  const QUICK_REFERENCE_DECIMAL_KEY = 'fabricationQuickReferenceDecimalMode';
  const quickReferenceSelections = {
    'fraction-addition': null,
    'fraction-decimal': null,
    'fraction-sixtyfourths': null,
    'gauge-thickness': null
  };

  function fractionFromSixteenths(totalSixteenths) {
    const whole = Math.floor(totalSixteenths / 16);
    const rem = totalSixteenths % 16;
    if (rem === 0) return `${whole}"`;
    const d = gcd(rem,16);
    const num = rem / d;
    const den = 16 / d;
    return whole > 0 ? `${whole} ${num}/${den}"` : `${num}/${den}"`;
  }

  function fractionFromThirtySeconds(totalThirtySeconds) {
    const whole = Math.floor(totalThirtySeconds / 32);
    const rem = totalThirtySeconds % 32;
    if (rem === 0) return `${whole}"`;
    const d = gcd(rem,32);
    const num = rem / d;
    const den = 32 / d;
    return whole > 0 ? `${whole} ${num}/${den}"` : `${num}/${den}"`;
  }

  function fractionFromSixtyFourths(totalSixtyFourths) {
    const whole = Math.floor(totalSixtyFourths / 64);
    const rem = totalSixtyFourths % 64;
    if (rem === 0) return `${whole}"`;
    const d = gcd(rem,64);
    const num = rem / d;
    const den = 64 / d;
    return whole > 0 ? `${whole} ${num}/${den}"` : `${num}/${den}"`;
  }

  function quickReferenceDecimal(value) {
    return Number(value).toFixed(3);
  }

  function quickReferenceSixteenthText(totalSixteenths) {
    return quickReferenceDecimalMode.checked
      ? quickReferenceDecimal(totalSixteenths / 16)
      : fractionFromSixteenths(totalSixteenths);
  }

  function quickReferenceThirtySecondText(totalThirtySeconds) {
    return quickReferenceDecimalMode.checked
      ? quickReferenceDecimal(totalThirtySeconds / 32)
      : fractionFromThirtySeconds(totalThirtySeconds);
  }

  function quickReferenceSixtyFourthText(totalSixtyFourths) {
    return quickReferenceDecimalMode.checked
      ? quickReferenceDecimal(totalSixtyFourths / 64)
      : fractionFromSixtyFourths(totalSixtyFourths);
  }

  function renderFractionAdditionReference() {
    const values = Array.from({length:16},(_,i)=>i+1);
    const headerCells = values.map(v =>
      `<th scope="col" data-qr-sixteenths="${v}" data-add-sixteenths="${v}">${fractionFromSixteenths(v)}</th>`
    ).join('');

    const rows = values.map(start => {
      const cells = values.map(add => {
        const sum = start + add;
        const classAttr = sum % 16 === 0 ? ' class="whole-result"' : '';
        return `<td${classAttr} data-qr-sixteenths="${sum}" data-start-sixteenths="${start}" data-add-sixteenths="${add}" tabindex="0" role="button" aria-label="${fractionFromSixteenths(start)} plus ${fractionFromSixteenths(add)} equals ${fractionFromSixteenths(sum)}">${fractionFromSixteenths(sum)}</td>`;
      }).join('');
      return `<tr><th scope="row" data-qr-sixteenths="${start}" data-start-sixteenths="${start}">${fractionFromSixteenths(start)}</th>${cells}</tr>`;
    }).join('');

    quickReferenceTable.innerHTML = `
      <table class="quick-ref-table">
        <thead>
          <tr>
            <th scope="col">START ↓<br>ADD →</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderThirtySecondAdditionReference() {
    const values = Array.from({length:32},(_,i)=>i+1);
    const headerCells = values.map(v =>
      `<th scope="col" data-qr-thirtyseconds="${v}" data-add-thirtyseconds="${v}">${fractionFromThirtySeconds(v)}</th>`
    ).join('');

    const rows = values.map(start => {
      const cells = values.map(add => {
        const sum = start + add;
        const classAttr = sum % 32 === 0 ? ' class="whole-result"' : '';
        return `<td${classAttr} data-qr-thirtyseconds="${sum}" data-start-thirtyseconds="${start}" data-add-thirtyseconds="${add}" tabindex="0" role="button" aria-label="${fractionFromThirtySeconds(start)} plus ${fractionFromThirtySeconds(add)} equals ${fractionFromThirtySeconds(sum)}">${fractionFromThirtySeconds(sum)}</td>`;
      }).join('');
      return `<tr><th scope="row" data-qr-thirtyseconds="${start}" data-start-thirtyseconds="${start}">${fractionFromThirtySeconds(start)}</th>${cells}</tr>`;
    }).join('');

    quickReferenceTable.innerHTML = `
      <table class="quick-ref-table">
        <thead>
          <tr>
            <th scope="col">START ↓<br>ADD →</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderSixtyFourthAdditionReference() {
    const values = Array.from({length:64},(_,i)=>i+1);
    const headerCells = values.map(v =>
      `<th scope="col" data-qr-sixtyfourths="${v}" data-add-sixtyfourths="${v}">${fractionFromSixtyFourths(v)}</th>`
    ).join('');

    const rows = values.map(start => {
      const cells = values.map(add => {
        const sum = start + add;
        const classAttr = sum % 64 === 0 ? ' class="whole-result"' : '';
        return `<td${classAttr} data-qr-sixtyfourths="${sum}" data-start-sixtyfourths="${start}" data-add-sixtyfourths="${add}" tabindex="0" role="button" aria-label="${fractionFromSixtyFourths(start)} plus ${fractionFromSixtyFourths(add)} equals ${fractionFromSixtyFourths(sum)}">${fractionFromSixtyFourths(sum)}</td>`;
      }).join('');
      return `<tr><th scope="row" data-qr-sixtyfourths="${start}" data-start-sixtyfourths="${start}">${fractionFromSixtyFourths(start)}</th>${cells}</tr>`;
    }).join('');

    quickReferenceTable.innerHTML = `
      <table class="quick-ref-table">
        <thead>
          <tr>
            <th scope="col">START ↓<br>ADD →</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }


  const GAUGE_THICKNESS_DATA = [
    {gauge:3, steel:0.2391, aluminum:0.2294, stainless:0.2500},
    {gauge:4, steel:0.2242, aluminum:0.2043, stainless:0.2344},
    {gauge:5, steel:0.2092, aluminum:0.1819, stainless:0.2187},
    {gauge:6, steel:0.1943, aluminum:0.1620, stainless:0.2031},
    {gauge:7, steel:0.1793, aluminum:0.1443, stainless:0.1875},
    {gauge:8, steel:0.1644, aluminum:0.1285, stainless:0.1719},
    {gauge:9, steel:0.1495, aluminum:0.1144, stainless:0.1562},
    {gauge:10, steel:0.1345, aluminum:0.1019, stainless:0.1406},
    {gauge:11, steel:0.1196, aluminum:0.0907, stainless:0.1250},
    {gauge:12, steel:0.1046, aluminum:0.0808, stainless:0.1094},
    {gauge:13, steel:0.0897, aluminum:0.0720, stainless:0.0937},
    {gauge:14, steel:0.0747, aluminum:0.0641, stainless:0.0781},
    {gauge:15, steel:0.0673, aluminum:0.0571, stainless:0.0703},
    {gauge:16, steel:0.0598, aluminum:0.0508, stainless:0.0625},
    {gauge:17, steel:0.0538, aluminum:0.0453, stainless:0.0562},
    {gauge:18, steel:0.0478, aluminum:0.0403, stainless:0.0500},
    {gauge:19, steel:0.0418, aluminum:0.0359, stainless:0.0437},
    {gauge:20, steel:0.0359, aluminum:0.0320, stainless:0.0375},
    {gauge:21, steel:0.0329, aluminum:0.0285, stainless:0.0344},
    {gauge:22, steel:0.0299, aluminum:0.0253, stainless:0.0312},
    {gauge:23, steel:0.0269, aluminum:0.0226, stainless:0.0281},
    {gauge:24, steel:0.0239, aluminum:0.0201, stainless:0.0250},
    {gauge:25, steel:0.0209, aluminum:0.0179, stainless:0.0219},
    {gauge:26, steel:0.0179, aluminum:0.0159, stainless:0.0187},
    {gauge:27, steel:0.0164, aluminum:0.0142, stainless:0.0172},
    {gauge:28, steel:0.0149, aluminum:0.0126, stainless:0.0156},
    {gauge:29, steel:0.0135, aluminum:0.0113, stainless:0.0141}
  ];

  const GAUGE_MATERIALS = [
    {key:'steel',label:'Sheet Steel'},
    {key:'aluminum',label:'Aluminum'},
    {key:'stainless',label:'Stainless Steel'}
  ];

  function gaugeReferenceThickness(gauge,materialKey) {
    const row=GAUGE_THICKNESS_DATA.find(entry=>entry.gauge===Number(gauge));
    return row && Object.prototype.hasOwnProperty.call(row,materialKey) ? row[materialKey] : NaN;
  }

  function renderGaugeThicknessReference() {
    const headerCells=GAUGE_MATERIALS.map(material=>
      `<th scope="col" data-gauge-material="${material.key}">${escapeHtml(material.label)}</th>`
    ).join('');

    const rows=GAUGE_THICKNESS_DATA.map(row=>{
      const cells=GAUGE_MATERIALS.map(material=>{
        const thickness=row[material.key];
        const display=`${Number(thickness).toFixed(4)}"`;
        return `<td data-gauge="${row.gauge}" data-gauge-material="${material.key}" tabindex="0" role="button" aria-label="${row.gauge} gauge ${material.label}: ${Number(thickness).toFixed(4)} inches">${display}</td>`;
      }).join('');
      return `<tr><th scope="row" data-gauge-row="${row.gauge}">${row.gauge} ga</th>${cells}</tr>`;
    }).join('');

    quickReferenceTable.innerHTML=`
      <table class="quick-ref-table gauge-ref-table">
        <thead>
          <tr>
            <th scope="col">GAUGE ↓<br>MATERIAL →</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  const QUICK_REFERENCE_TABLES = {
    'fraction-addition': {
      title:'Fraction Addition Chart',
      description:'Add common shop fractions in 1/16" increments. Pick the starting measurement on the left, then move across to the amount being added.',
      heading:'Start ↓ + Add →',
      badge:'1/16" increments',
      fractionExample:'Example: 5/16" + 7/16" = 3/4"',
      decimalExample:'Example: 0.313 + 0.438 = 0.750',
      keyItems:[['↓','Start','Find it on the left'],['→','Add','Move across the top'],['=','Result','Read the intersecting cell']],
      ariaLabel:'Fraction addition reference table',
      render:renderFractionAdditionReference
    },
    'fraction-decimal': {
      title:'Fraction Addition Chart — 1/32',
      description:'Add common shop fractions in 1/32" increments. Pick the starting measurement on the left, then move across to the amount being added.',
      heading:'Start ↓ + Add →',
      badge:'1/32" increments',
      fractionExample:'Example: 5/32" + 7/32" = 3/8"',
      decimalExample:'Example: 0.156 + 0.219 = 0.375',
      keyItems:[['↓','Start','Find it on the left'],['→','Add','Move across the top'],['=','Result','Read the intersecting cell']],
      ariaLabel:'Fraction addition reference table in one thirty-second inch increments',
      render:renderThirtySecondAdditionReference
    },
    'fraction-sixtyfourths': {
      title:'Fraction Addition Chart — 1/64',
      description:'Add common shop fractions in 1/64" increments. Pick the starting measurement on the left, then move across to the amount being added.',
      heading:'Start ↓ + Add →',
      badge:'1/64" increments',
      fractionExample:'Example: 5/64" + 7/64" = 3/16"',
      decimalExample:'Example: 0.078 + 0.109 = 0.188',
      keyItems:[['↓','Start','Find it on the left'],['→','Add','Move across the top'],['=','Result','Read the intersecting cell']],
      ariaLabel:'Fraction addition reference table in one sixty-fourth inch increments',
      render:renderSixtyFourthAdditionReference
    },
    'gauge-thickness': {
      title:'Gauge → Decimal Thickness',
      description:'Nominal decimal-inch thickness by material. Gauge is not universal: the same gauge number can represent different thicknesses in sheet steel, aluminum, and stainless steel.',
      heading:'Gauge ↓ → Decimal Thickness',
      badge:'Nominal inches',
      fixedExample:'Example: 16 ga — Steel 0.0598" • Aluminum 0.0508" • Stainless 0.0625"',
      keyItems:[['#','Gauge','Find the gauge on the left'],['▦','Material','Choose the material column'],['✓','Thickness','Tap a value to highlight it']],
      ariaLabel:'Gauge to decimal thickness reference table',
      hideDisplayMode:true,
      render:renderGaugeThicknessReference
    }
  };

  function updateQuickReferenceModeLabels() {
    const decimals=quickReferenceDecimalMode.checked;
    quickReferenceFractionLabel.classList.toggle('active',!decimals);
    quickReferenceDecimalLabel.classList.toggle('active',decimals);
  }

  function updateQuickReferenceDisplayValues({persist=true}={}) {
    const decimals=quickReferenceDecimalMode.checked;
    updateQuickReferenceModeLabels();

    quickReferenceTable.querySelectorAll('[data-qr-sixteenths]').forEach(el=>{
      el.textContent=quickReferenceSixteenthText(Number(el.dataset.qrSixteenths));
    });
    quickReferenceTable.querySelectorAll('[data-qr-thirtyseconds]').forEach(el=>{
      const value=Number(el.dataset.qrThirtyseconds);
      el.textContent=quickReferenceThirtySecondText(value);
    });
    quickReferenceTable.querySelectorAll('[data-qr-sixtyfourths]').forEach(el=>{
      const value=Number(el.dataset.qrSixtyfourths);
      el.textContent=quickReferenceSixtyFourthText(value);
    });

    quickReferenceTable.querySelectorAll('td[data-start-sixteenths][data-add-sixteenths]').forEach(cell=>{
      const start=Number(cell.dataset.startSixteenths);
      const add=Number(cell.dataset.addSixteenths);
      const sum=start+add;
      const label=decimals
        ? `${quickReferenceDecimal(start/16)} plus ${quickReferenceDecimal(add/16)} equals ${quickReferenceDecimal(sum/16)}`
        : `${fractionFromSixteenths(start)} plus ${fractionFromSixteenths(add)} equals ${fractionFromSixteenths(sum)}`;
      cell.setAttribute('aria-label',label);
    });
    quickReferenceTable.querySelectorAll('td[data-start-thirtyseconds][data-add-thirtyseconds]').forEach(cell=>{
      const start=Number(cell.dataset.startThirtyseconds);
      const add=Number(cell.dataset.addThirtyseconds);
      const sum=start+add;
      const label=decimals
        ? `${quickReferenceDecimal(start/32)} plus ${quickReferenceDecimal(add/32)} equals ${quickReferenceDecimal(sum/32)}`
        : `${fractionFromThirtySeconds(start)} plus ${fractionFromThirtySeconds(add)} equals ${fractionFromThirtySeconds(sum)}`;
      cell.setAttribute('aria-label',label);
    });
    quickReferenceTable.querySelectorAll('td[data-start-sixtyfourths][data-add-sixtyfourths]').forEach(cell=>{
      const start=Number(cell.dataset.startSixtyfourths);
      const add=Number(cell.dataset.addSixtyfourths);
      const sum=start+add;
      const label=decimals
        ? `${quickReferenceDecimal(start/64)} plus ${quickReferenceDecimal(add/64)} equals ${quickReferenceDecimal(sum/64)}`
        : `${fractionFromSixtyFourths(start)} plus ${fractionFromSixtyFourths(add)} equals ${fractionFromSixtyFourths(sum)}`;
      cell.setAttribute('aria-label',label);
    });

    const entry=QUICK_REFERENCE_TABLES[quickReferenceSelect.value] || QUICK_REFERENCE_TABLES['fraction-addition'];
    quickReferenceExample.textContent=entry.fixedExample || (decimals ? entry.decimalExample : entry.fractionExample);
    if (persist) {
      try { writePersistentStore('quickReferenceDisplayMode',decimals?'decimal':'fraction'); }
      catch (error) { console.warn(error); }
    }
  }

  function clearQuickReferenceSelectionClasses() {
    quickReferenceTable.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
    quickReferenceTable.querySelectorAll('.is-selected-axis').forEach(el => el.classList.remove('is-selected-axis'));
  }

  function restoreQuickReferenceSelection(key) {
    clearQuickReferenceSelectionClasses();
    const selection=quickReferenceSelections[key];
    if (!selection) return;

    if (key==='fraction-addition') {
      const cell=quickReferenceTable.querySelector(`td[data-start-sixteenths="${selection.start}"][data-add-sixteenths="${selection.add}"]`);
      const rowHeader=quickReferenceTable.querySelector(`tbody th[data-start-sixteenths="${selection.start}"]`);
      const colHeader=quickReferenceTable.querySelector(`thead th[data-add-sixteenths="${selection.add}"]`);
      if (cell) cell.classList.add('is-selected');
      if (rowHeader) rowHeader.classList.add('is-selected-axis');
      if (colHeader) colHeader.classList.add('is-selected-axis');
      return;
    }

    if (key==='fraction-decimal') {
      const cell=quickReferenceTable.querySelector(`td[data-start-thirtyseconds="${selection.start}"][data-add-thirtyseconds="${selection.add}"]`);
      const rowHeader=quickReferenceTable.querySelector(`tbody th[data-start-thirtyseconds="${selection.start}"]`);
      const colHeader=quickReferenceTable.querySelector(`thead th[data-add-thirtyseconds="${selection.add}"]`);
      if (cell) cell.classList.add('is-selected');
      if (rowHeader) rowHeader.classList.add('is-selected-axis');
      if (colHeader) colHeader.classList.add('is-selected-axis');
      return;
    }

    if (key==='fraction-sixtyfourths') {
      const cell=quickReferenceTable.querySelector(`td[data-start-sixtyfourths="${selection.start}"][data-add-sixtyfourths="${selection.add}"]`);
      const rowHeader=quickReferenceTable.querySelector(`tbody th[data-start-sixtyfourths="${selection.start}"]`);
      const colHeader=quickReferenceTable.querySelector(`thead th[data-add-sixtyfourths="${selection.add}"]`);
      if (cell) cell.classList.add('is-selected');
      if (rowHeader) rowHeader.classList.add('is-selected-axis');
      if (colHeader) colHeader.classList.add('is-selected-axis');
      return;
    }

    if (key==='gauge-thickness') {
      const cell=quickReferenceTable.querySelector(`td[data-gauge="${selection.gauge}"][data-gauge-material="${selection.material}"]`);
      const rowHeader=quickReferenceTable.querySelector(`tbody th[data-gauge-row="${selection.gauge}"]`);
      const colHeader=quickReferenceTable.querySelector(`thead th[data-gauge-material="${selection.material}"]`);
      if (cell) cell.classList.add('is-selected');
      if (rowHeader) rowHeader.classList.add('is-selected-axis');
      if (colHeader) colHeader.classList.add('is-selected-axis');
    }
  }

  function renderQuickReference(key,{persist=true}={}) {
    const resolvedKey=Object.prototype.hasOwnProperty.call(QUICK_REFERENCE_TABLES,key) ? key : 'fraction-addition';
    const entry = QUICK_REFERENCE_TABLES[resolvedKey];
    quickReferenceSelect.value = resolvedKey;
    quickReferenceTitle.textContent = entry.title;
    quickReferenceDescription.textContent = entry.description;
    quickReferenceTableHeading.textContent = entry.heading;
    quickReferenceBadge.textContent = entry.badge || '';
    (entry.keyItems || []).forEach((item,index)=>{
      const target=quickReferenceKeyElements[index];
      if (!target) return;
      target.icon.textContent=item[0];
      target.title.textContent=item[1];
      target.text.textContent=item[2];
    });
    quickReferenceTable.setAttribute('aria-label', entry.ariaLabel || entry.title);
    if (quickReferenceDisplayMode) quickReferenceDisplayMode.style.display=entry.hideDisplayMode ? 'none' : '';
    entry.render();
    updateQuickReferenceDisplayValues({persist});
    restoreQuickReferenceSelection(resolvedKey);
    if (persist) {
      try { writePersistentStore('quickReferenceTable',resolvedKey); }
      catch (error) { console.warn(error); }
    }
  }

  function selectQuickReferenceAdditionCell(cell) {
    const start=Number(cell.dataset.startSixteenths);
    const add=Number(cell.dataset.addSixteenths);
    const selected=quickReferenceSelections['fraction-addition'];
    const same=selected && selected.start===start && selected.add===add;
    quickReferenceSelections['fraction-addition']=same ? null : {start,add};
    restoreQuickReferenceSelection('fraction-addition');
  }

  function selectQuickReferenceThirtySecondAdditionCell(cell) {
    const start=Number(cell.dataset.startThirtyseconds);
    const add=Number(cell.dataset.addThirtyseconds);
    const selected=quickReferenceSelections['fraction-decimal'];
    const same=selected && selected.start===start && selected.add===add;
    quickReferenceSelections['fraction-decimal']=same ? null : {start,add};
    restoreQuickReferenceSelection('fraction-decimal');
  }

  function selectQuickReferenceSixtyFourthAdditionCell(cell) {
    const start=Number(cell.dataset.startSixtyfourths);
    const add=Number(cell.dataset.addSixtyfourths);
    const selected=quickReferenceSelections['fraction-sixtyfourths'];
    const same=selected && selected.start===start && selected.add===add;
    quickReferenceSelections['fraction-sixtyfourths']=same ? null : {start,add};
    restoreQuickReferenceSelection('fraction-sixtyfourths');
  }

  function selectQuickReferenceGaugeCell(cell) {
    const gauge=Number(cell.dataset.gauge);
    const material=String(cell.dataset.gaugeMaterial || '');
    const selected=quickReferenceSelections['gauge-thickness'];
    const same=selected && selected.gauge===gauge && selected.material===material;
    quickReferenceSelections['gauge-thickness']=same ? null : {gauge,material};
    restoreQuickReferenceSelection('gauge-thickness');
  }

  registerPersistentStore({
    id:'quickReferenceTable',key:'fabricationQuickReferenceTable',version:1,encoding:'string',label:'Quick Reference Table',
    defaultValue:()=> 'fraction-addition',
    normalize:value=>{
      if (!Object.prototype.hasOwnProperty.call(QUICK_REFERENCE_TABLES,value)) throw new Error('Saved Quick Reference table is invalid.');
      return value;
    }
  });
  registerPersistentStore({
    id:'quickReferenceDisplayMode',key:QUICK_REFERENCE_DECIMAL_KEY,version:1,encoding:'string',label:'Quick Reference Display Mode',
    defaultValue:()=> 'fraction',
    normalize:value=>{
      if (!['fraction','decimal'].includes(value)) throw new Error('Saved Quick Reference display mode is invalid.');
      return value;
    }
  });

  const quickReferenceTableCount = Object.keys(QUICK_REFERENCE_TABLES).length;
  quickReferenceCount.textContent = `${quickReferenceTableCount} table${quickReferenceTableCount === 1 ? '' : 's'}`;
  const quickReferenceDisplayResult=loadPersistentStore('quickReferenceDisplayMode');
  const quickReferenceTableResult=loadPersistentStore('quickReferenceTable');
  quickReferenceDecimalMode.checked=quickReferenceDisplayResult.value==='decimal';
  updateQuickReferenceModeLabels();
  quickReferenceSelect.addEventListener('change', () => renderQuickReference(quickReferenceSelect.value));
  quickReferenceDecimalMode.addEventListener('change',()=>updateQuickReferenceDisplayValues());
  renderQuickReference(quickReferenceTableResult.value,{persist:false});

  quickReferenceTable.addEventListener('click', e => {
    const additionCell=e.target.closest('td[data-start-sixteenths][data-add-sixteenths]');
    if (additionCell) {
      selectQuickReferenceAdditionCell(additionCell);
      return;
    }
    const thirtySecondAdditionCell=e.target.closest('td[data-start-thirtyseconds][data-add-thirtyseconds]');
    if (thirtySecondAdditionCell) {
      selectQuickReferenceThirtySecondAdditionCell(thirtySecondAdditionCell);
      return;
    }
    const sixtyFourthAdditionCell=e.target.closest('td[data-start-sixtyfourths][data-add-sixtyfourths]');
    if (sixtyFourthAdditionCell) {
      selectQuickReferenceSixtyFourthAdditionCell(sixtyFourthAdditionCell);
      return;
    }
    const gaugeCell=e.target.closest('td[data-gauge][data-gauge-material]');
    if (gaugeCell) selectQuickReferenceGaugeCell(gaugeCell);
  });

  quickReferenceTable.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const additionCell=e.target.closest && e.target.closest('td[data-start-sixteenths][data-add-sixteenths]');
    if (additionCell) {
      e.preventDefault();
      selectQuickReferenceAdditionCell(additionCell);
      return;
    }
    const thirtySecondAdditionCell=e.target.closest && e.target.closest('td[data-start-thirtyseconds][data-add-thirtyseconds]');
    if (thirtySecondAdditionCell) {
      e.preventDefault();
      selectQuickReferenceThirtySecondAdditionCell(thirtySecondAdditionCell);
      return;
    }
    const sixtyFourthAdditionCell=e.target.closest && e.target.closest('td[data-start-sixtyfourths][data-add-sixtyfourths]');
    if (sixtyFourthAdditionCell) {
      e.preventDefault();
      selectQuickReferenceSixtyFourthAdditionCell(sixtyFourthAdditionCell);
      return;
    }
    const gaugeCell=e.target.closest && e.target.closest('td[data-gauge][data-gauge-material]');
    if (gaugeCell) {
      e.preventDefault();
      selectQuickReferenceGaugeCell(gaugeCell);
    }
  });

