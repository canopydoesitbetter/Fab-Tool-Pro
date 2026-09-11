  // ---------------- Material cut optimizer ----------------
  const MATERIALS = {
    al063: { name: '.063 Aluminum', rawL:120, rawW:48, usableL:119.5, usableW:47.5, cutMethod:'shear' },
    acp: { name: 'ACP Aluminum', rawL:120, rawW:48, usableL:119.5, usableW:47.5, cutMethod:'shear' },
    cellulose: { name: 'Cellulose', rawL:120, rawW:48, usableL:120, usableW:48, cutMethod:'freeform' },
    plywood: { name: 'Plywood', rawL:95.875, rawW:47.875, usableL:95.875, usableW:47.875, cutMethod:'freeform' }
  };

  const PRODUCTS = {
    exterior: {
      name: '.063 Exterior Panel', shortName:'.063 Wall', material:'al063', deltaH:2, deltaW:2, color:'#00D2FF',
      rule: 'Add 1" flange each side (+2" overall)'
    },
    door: {
      name: '.063 Exterior Door Panel', shortName:'.063 Door', material:'al063', deltaH:1.5, deltaW:1.5, color:'#70FFB3',
      rule: 'Add 3/4" flange each side (+1 1/2" overall)'
    },
    acp: {
      name: 'Interior ACP Panel', shortName:'ACP', material:'acp', deltaH:-0.125, deltaW:-0.125, color:'#FF70A3',
      rule: 'Subtract 1/8" from height and width'
    },
    insulation: {
      name: 'Insulation Panel', shortName:'Cellulose', material:'cellulose', deltaH:-0.5, deltaW:-0.5, color:'#B7B7B7',
      rule: 'Subtract 1/2" from height and width'
    },
    plywood: {
      name: 'Plywood Reinforcement', shortName:'Plywood', material:'plywood', deltaH:-0.75, deltaW:-0.75, color:'#F5D17A',
      rule: 'Subtract 3/4" from height and width'
    }
  };

  const COPY_COMPATIBLE_PRODUCTS = ['exterior','door','insulation','acp'];

  const optimizerProduct = document.getElementById('optimizerProduct');
  const optimizerLabel = document.getElementById('optimizerLabel');
  const optimizerWidth = document.getElementById('optimizerWidth');
  const optimizerHeight = document.getElementById('optimizerHeight');
  const optimizerQty = document.getElementById('optimizerQty');
  const optimizerGrainFlowRotation = document.getElementById('optimizerGrainFlowRotation');
  const optimizerRule = document.getElementById('optimizerRule');
  const optimizerMaterial = document.getElementById('optimizerMaterial');
  const optimizerSheet = document.getElementById('optimizerSheet');
  const optimizerStatus = document.getElementById('optimizerStatus');
  const optimizerJobList = document.getElementById('optimizerJobList');
  const optimizerCutListMenuBtn = document.getElementById('optimizerCutListMenuBtn');
  const optimizerCutListDrawer = document.getElementById('optimizerCutListDrawer');
  const optimizerCutListBackdrop = document.getElementById('optimizerCutListBackdrop');
  const optimizerCutListCloseBtn = document.getElementById('optimizerCutListCloseBtn');
  const optimizerCutListMeta = document.getElementById('optimizerCutListMeta');
  const optimizerCutListDrawerMeta = document.getElementById('optimizerCutListDrawerMeta');
  const optimizerCopySource = document.getElementById('optimizerCopySource');
  const optimizerCopyTarget = document.getElementById('optimizerCopyTarget');
  const optimizerCopyBtn = document.getElementById('optimizerCopyBtn');
  const optimizerCopyStatus = document.getElementById('optimizerCopyStatus');
  const optimizerResults = document.getElementById('optimizerResults');
  const optimizerMaterialTotals = document.getElementById('optimizerMaterialTotals');
  const optimizerSheets = document.getElementById('optimizerSheets');
  const optimizerJobNumber = document.getElementById('optimizerJobNumber');
  const optimizerSavedJobs = document.getElementById('optimizerSavedJobs');
  const optimizerJobStatus = document.getElementById('optimizerJobStatus');
  const optimizerActiveJobChip = document.getElementById('optimizerActiveJobChip');
  const optimizerImportFile = document.getElementById('optimizerImportFile');
  const OPTIMIZER_JOBS_KEY = 'fabricationOptimizerJobsV1';
  const OPTIMIZER_JOB_FILE_VERSION = 3;
  const MAX_OPTIMIZER_PIECES = 500;
  const MAX_OPTIMIZER_ROWS = 150;
  const MAX_OPTIMIZER_IMPORT_BYTES = 2 * 1024 * 1024;
  const MAX_OPTIMIZER_LABEL_LENGTH = 120;
  let optimizerJob = [];
  let optimizerNextId = 1;
  let optimizerCutIds = new Set();
  let optimizerLastResults = null;
  let optimizerLoadedJobNumber = '';
  let optimizerDirty = false;
  let optimizerWorker = null;
  let optimizerWorkerReject = null;
  let optimizerRunSerial = 0;
  let sheetSvgClipCounter = 0;

  function showOptimizerJobStatus(message,type='ok') {
    optimizerJobStatus.textContent = message;
    optimizerJobStatus.className = `status show ${type}`;
  }

  function clearOptimizerJobStatus() {
    optimizerJobStatus.textContent = '';
    optimizerJobStatus.className = 'status';
  }

  function cleanJobNumber(value) {
    return String(value ?? '').trim().replace(/\s+/g,' ');
  }

  function markOptimizerDirty() {
    optimizerDirty = true;
    updateActiveJobChip();
  }

  function markOptimizerClean() {
    optimizerDirty = false;
    updateActiveJobChip();
  }

  function currentOptimizerPieceCount(parts=optimizerJob) {
    return parts.reduce((sum,row)=>sum + Number(row.qty || 0),0);
  }

  function hasOwn(obj,key) {
    return Object.prototype.hasOwnProperty.call(obj,key);
  }

  function createJobDictionary(source={}) {
    const out=Object.create(null);
    if (source && typeof source==='object' && !Array.isArray(source)) {
      for (const [key,value] of Object.entries(source)) out[key]=value;
    }
    return out;
  }

  function updateActiveJobChip() {
    const number=cleanJobNumber(optimizerJobNumber.value);
    if (number) {
      optimizerActiveJobChip.textContent = `Job #${number}${optimizerDirty ? ' • Unsaved' : ' • Saved'}`;
      optimizerActiveJobChip.style.display = 'inline-flex';
    } else {
      optimizerActiveJobChip.textContent = '';
      optimizerActiveJobChip.style.display = 'none';
    }
  }

  function readSavedOptimizerJobs() {
    const raw=storageGet(OPTIMIZER_JOBS_KEY);
    if (!raw) return createJobDictionary();
    try {
      const parsed=JSON.parse(raw);
      return createJobDictionary(parsed);
    } catch (e) { return createJobDictionary(); }
  }

  function writeSavedOptimizerJobs(jobs) {
    try {
      localStorage.setItem(OPTIMIZER_JOBS_KEY, JSON.stringify(jobs));
      return true;
    } catch (e) {
      showOptimizerJobStatus('This browser could not save the job locally. Use Export Job File as a backup instead.','error');
      return false;
    }
  }

  function refreshSavedOptimizerJobs(selected='') {
    const jobs=readSavedOptimizerJobs();
    const numbers=Object.keys(jobs).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));
    optimizerSavedJobs.innerHTML = numbers.length
      ? '<option value="">Select a saved job…</option>' + numbers.map(n=>`<option value="${escapeHtml(n)}">Job #${escapeHtml(n)}</option>`).join('')
      : '<option value="">No saved jobs</option>';
    if (selected && numbers.includes(selected)) optimizerSavedJobs.value=selected;
  }

  function validPhysicalUids(parts) {
    const set=new Set();
    for (const row of parts) for (let q=1;q<=row.qty;q++) set.add(`${row.id}-${q}`);
    return set;
  }

  function serializeOptimizerJob() {
    const jobNumber=cleanJobNumber(optimizerJobNumber.value);
    return {
      format:'FabricationCutOptimizerJob',
      version:OPTIMIZER_JOB_FILE_VERSION,
      jobNumber,
      savedAt:new Date().toISOString(),
      grainFlowRotation:!!optimizerGrainFlowRotation.checked,
      nextId:optimizerNextId,
      dimensionOrder:'width-height',
      parts:optimizerJob.map(row=>({
        id:row.id,
        productKey:row.productKey,
        label:row.label || '',
        finishedWidth:row.finishedWidth,
        finishedHeight:row.finishedHeight,
        qty:row.qty
      })),
      cutPartIds:Array.from(optimizerCutIds).sort()
    };
  }

  function normalizeOptimizerJobRecord(raw) {
    const data = raw && raw.fabricationOptimizerJob ? raw.fabricationOptimizerJob : raw;
    if (!data || typeof data!=='object') throw new Error('The file does not contain a valid optimizer job.');
    if (data.format && data.format!=='FabricationCutOptimizerJob') throw new Error('This JSON file is not a Fabrication Cut Optimizer job.');
    const incomingVersion=Number(data.version || 1);
    if (!Number.isInteger(incomingVersion) || incomingVersion < 1) throw new Error('The job file has an invalid version number.');
    if (incomingVersion > OPTIMIZER_JOB_FILE_VERSION) throw new Error('This job was created by a newer version of Fabrication Calculators and cannot be safely imported here.');
    const jobNumber=cleanJobNumber(data.jobNumber);
    if (!jobNumber) throw new Error('The job file is missing a Job #.');
    if (!Array.isArray(data.parts)) throw new Error('The job file is missing its parts list.');
    if (data.parts.length > MAX_OPTIMIZER_ROWS) throw new Error(`The job contains more than ${MAX_OPTIMIZER_ROWS} part rows.`);

    const ids=new Set();
    const parts=data.parts.map((row,index)=>{
      if (!row || typeof row!=='object' || !PRODUCTS[row.productKey]) throw new Error(`Part ${index+1} has an invalid product type.`);
      const id=Number(row.id);
      // Version 2 stores explicit Width/Height. Version 1 used finishedW/finishedL,
      // where finishedL was the panel height dimension.
      const finishedWidth=Number(row.finishedWidth ?? row.finishedW);
      const finishedHeight=Number(row.finishedHeight ?? row.finishedL);
      const qty=Number(row.qty);
      if (!Number.isInteger(id) || id<1 || ids.has(id)) throw new Error(`Part ${index+1} has an invalid or duplicate ID.`);
      if (!Number.isFinite(finishedWidth) || !Number.isFinite(finishedHeight) || finishedWidth<=0 || finishedHeight<=0) throw new Error(`Part ${index+1} has invalid Width/Height dimensions.`);
      if (!Number.isInteger(qty) || qty<1 || qty>500) throw new Error(`Part ${index+1} has an invalid quantity.`);
      ids.add(id);
      const cut=optimizerCutSize(row.productKey,finishedWidth,finishedHeight);
      if (cut.width<=0 || cut.height<=0) throw new Error(`Part ${index+1} produces an invalid cut size.`);
      const label=String(row.label||'').trim();
      if (label.length > MAX_OPTIMIZER_LABEL_LENGTH) throw new Error(`Part ${index+1} label exceeds ${MAX_OPTIMIZER_LABEL_LENGTH} characters.`);
      return {id,productKey:row.productKey,label,finishedWidth,finishedHeight,qty,cutWidth:cut.width,cutHeight:cut.height};
    });
    const totalPieces=currentOptimizerPieceCount(parts);
    if (totalPieces > MAX_OPTIMIZER_PIECES) throw new Error(`The job contains ${totalPieces} pieces; the optimizer limit is ${MAX_OPTIMIZER_PIECES}.`);
    const valid=validPhysicalUids(parts);
    const cutPartIds=Array.isArray(data.cutPartIds) ? data.cutPartIds.map(String).filter(uid=>valid.has(uid)) : [];
    const maxId=parts.reduce((m,row)=>Math.max(m,row.id),0);
    // Version 3 renamed and inverted the legacy free-rotation setting.
    // Legacy v1/v2: rotate=true meant free rotation was allowed.
    // v3+: grainFlowRotation=true means orientation is LOCKED to entered Width × Height.
    const grainFlowRotation = incomingVersion >= 3
      ? data.grainFlowRotation === true
      : data.rotate === false;
    return {
      format:'FabricationCutOptimizerJob',version:OPTIMIZER_JOB_FILE_VERSION,jobNumber,
      savedAt:typeof data.savedAt==='string'?data.savedAt:new Date().toISOString(),
      grainFlowRotation,
      nextId:Math.max(maxId+1,Number.isInteger(Number(data.nextId))?Number(data.nextId):1),
      parts,cutPartIds
    };
  }

  function applyOptimizerJobRecord(record,autoOptimize=true) {
    optimizerJob=record.parts.map(row=>({...row}));
    optimizerNextId=record.nextId;
    optimizerCutIds=new Set(record.cutPartIds || []);
    optimizerGrainFlowRotation.checked=record.grainFlowRotation===true;
    optimizerJobNumber.value=record.jobNumber;
    optimizerLoadedJobNumber=record.jobNumber;
    optimizerDirty=false;
    optimizerLastResults=null;
    optimizerResults.classList.remove('show');
    optimizerSheets.innerHTML='';
    optimizerMaterialTotals.innerHTML='';
    clearOptimizerStatus();
    renderOptimizerJob();
    updateActiveJobChip();
    refreshSavedOptimizerJobs(record.jobNumber);
    if (autoOptimize && optimizerJob.length) runOptimizer(false);
  }

  function saveOptimizerJob() {
    clearOptimizerJobStatus();
    const number=cleanJobNumber(optimizerJobNumber.value);
    if (!number) { showOptimizerJobStatus('Enter a Job # before saving.','error'); optimizerJobNumber.focus(); return; }
    if (!optimizerJob.length) { showOptimizerJobStatus('Add at least one part before saving the job.','error'); return; }
    optimizerJobNumber.value=number;
    const jobs=readSavedOptimizerJobs();
    if (hasOwn(jobs,number) && number!==optimizerLoadedJobNumber && !window.confirm(`Job #${number} already exists. Replace the saved job?`)) return;
    if (hasOwn(jobs,number) && number===optimizerLoadedJobNumber && !window.confirm(`Save the current changes to Job #${number}?`)) return;
    const record=serializeOptimizerJob();
    jobs[number]=record;
    if (!writeSavedOptimizerJobs(jobs)) return;
    optimizerLoadedJobNumber=number;
    markOptimizerClean();
    refreshSavedOptimizerJobs(number);
    showOptimizerJobStatus(`Job #${number} saved on this device.`,'ok');
  }

  function loadOptimizerJob() {
    clearOptimizerJobStatus();
    const number=cleanJobNumber(optimizerSavedJobs.value);
    if (!number) { showOptimizerJobStatus('Select a saved job to load.','error'); return; }
    const jobs=readSavedOptimizerJobs();
    if (!hasOwn(jobs,number)) { showOptimizerJobStatus(`Job #${number} was not found on this device.`,'error'); return; }
    if (optimizerDirty && !window.confirm(`The current job has unsaved changes. Load Job #${number} and discard those changes?`)) return;
    try {
      const record=normalizeOptimizerJobRecord(jobs[number]);
      applyOptimizerJobRecord(record,true);
      showOptimizerJobStatus(`Job #${number} loaded.`,'ok');
    } catch (e) { showOptimizerJobStatus(e.message || 'Unable to load that saved job.','error'); }
  }

  function deleteOptimizerSavedJob() {
    clearOptimizerJobStatus();
    const number=cleanJobNumber(optimizerSavedJobs.value);
    if (!number) { showOptimizerJobStatus('Select a saved job to delete.','error'); return; }
    const jobs=readSavedOptimizerJobs();
    if (!hasOwn(jobs,number)) { showOptimizerJobStatus(`Job #${number} was not found on this device.`,'error'); return; }
    if (!window.confirm(`Delete the saved copy of Job #${number}? This does not delete an exported backup file.`)) return;
    delete jobs[number];
    if (!writeSavedOptimizerJobs(jobs)) return;
    if (optimizerLoadedJobNumber===number) { optimizerLoadedJobNumber=''; markOptimizerDirty(); }
    refreshSavedOptimizerJobs();
    showOptimizerJobStatus(`Saved Job #${number} deleted.`,'ok');
  }

  function safeExportFileName(value) {
    const safe=String(value).trim().replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'');
    return safe || 'job';
  }

  function exportOptimizerJob() {
    clearOptimizerJobStatus();
    const number=cleanJobNumber(optimizerJobNumber.value);
    if (!number) { showOptimizerJobStatus('Enter a Job # before exporting.','error'); optimizerJobNumber.focus(); return; }
    if (!optimizerJob.length) { showOptimizerJobStatus('Add at least one part before exporting.','error'); return; }
    optimizerJobNumber.value=number;
    const payload={fabricationOptimizerJob:serializeOptimizerJob()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`Job-${safeExportFileName(number)}-Fabrication.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    showOptimizerJobStatus(`Job #${number} exported as a portable JSON file.`,'ok');
  }

  function importOptimizerJobFile(file) {
    if (!file) return;
    if (file.size > MAX_OPTIMIZER_IMPORT_BYTES) {
      showOptimizerJobStatus(`That job file is too large. Maximum import size is ${Math.round(MAX_OPTIMIZER_IMPORT_BYTES/1024/1024)} MB.`,'error');
      optimizerImportFile.value='';
      return;
    }
    clearOptimizerJobStatus();
    const reader=new FileReader();
    reader.onload=async ()=>{
      try {
        const parsed=JSON.parse(String(reader.result||''));
        const record=normalizeOptimizerJobRecord(parsed);
        const jobs=readSavedOptimizerJobs();
        if (optimizerDirty && !window.confirm('The current job has unsaved changes. Import another job and discard those changes? Automatic recovery does not preserve unsaved optimizer work; save or export it first if you need a backup.')) return;
        if (hasOwn(jobs,record.jobNumber) && !window.confirm(`Job #${record.jobNumber} already exists on this device. Replace it with the imported job?`)) return;
        if (hasOwn(jobs,record.jobNumber)) await requireRecoverySnapshot('before-optimizer-import');
        jobs[record.jobNumber]=record;
        if (!writeSavedOptimizerJobs(jobs)) return;
        applyOptimizerJobRecord(record,false);
        markOptimizerClean();
        showOptimizerJobStatus(`Job #${record.jobNumber} imported, saved, and loaded. Press Optimize Job to calculate the layout.`,'ok');
      } catch (e) {
        showOptimizerJobStatus(e.message || 'Unable to import that job file.','error');
      } finally {
        optimizerImportFile.value='';
      }
    };
    reader.onerror=()=>{ showOptimizerJobStatus('The selected job file could not be read.','error'); optimizerImportFile.value=''; };
    reader.readAsText(file);
  }

  function parseShopMeasurement(value) {
    let text = String(value ?? '').trim().toLowerCase().replace(/["”]/g,'');
    if (!text) return NaN;
    text = text.replace(/\s*[-–]\s*(?=\d+\s*\/)/, ' ');
    if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
    let m = text.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
    if (m) {
      const den = Number(m[3]);
      return den ? Number(m[1]) + Number(m[2]) / den : NaN;
    }
    m = text.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) {
      const den = Number(m[2]);
      return den ? Number(m[1]) / den : NaN;
    }
    return NaN;
  }

  function measurementText(value) {
    const rounded16 = Math.round(value * 16) / 16;
    if (Math.abs(value - rounded16) < 0.00001) return toFraction16(value);
    return trimZeros(value,4) + '"';
  }

  function updateOptimizerProductColor() {
    const product = PRODUCTS[optimizerProduct.value];
    if (!product) return;
    optimizerProduct.style.setProperty('--product-color', product.color || '#00D2FF');
  }

  function updateOptimizerRulePreview() {
    const product = PRODUCTS[optimizerProduct.value];
    const material = MATERIALS[product.material];
    updateOptimizerProductColor();
    optimizerRule.textContent = product.rule;
    optimizerMaterial.textContent = `${material.name}${material.cutMethod==='shear'?' • full-edge shear':''}`;
    optimizerSheet.textContent = `${measurementText(material.rawL)} × ${measurementText(material.rawW)} / ${measurementText(material.usableL)} × ${measurementText(material.usableW)}`;
  }

  function showOptimizerStatus(message,type='error') {
    optimizerStatus.textContent = message;
    optimizerStatus.className = `status show ${type}`;
  }

  function clearOptimizerStatus() {
    optimizerStatus.textContent = '';
    optimizerStatus.className = 'status';
  }

  function optimizerCutSize(productKey, finishedWidth, finishedHeight) {
    const product = PRODUCTS[productKey];
    return {
      width: finishedWidth + product.deltaW,
      height: finishedHeight + product.deltaH
    };
  }

  function addOptimizerPart() {
    clearOptimizerStatus();
    const productKey = optimizerProduct.value;
    const finishedWidth = parseShopMeasurement(optimizerWidth.value);
    const finishedHeight = parseShopMeasurement(optimizerHeight.value);
    const qty = Number(optimizerQty.value);
    if (!Number.isFinite(finishedWidth) || !Number.isFinite(finishedHeight) || finishedWidth <= 0 || finishedHeight <= 0) {
      showOptimizerStatus('Enter a valid finished width and height. Decimals and fractions such as 23-3/4 or 47 1/2 are accepted.');
      return;
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 500) {
      showOptimizerStatus('Quantity must be a whole number from 1 through 500.');
      return;
    }
    if (optimizerJob.length >= MAX_OPTIMIZER_ROWS) {
      showOptimizerStatus(`This job has reached the ${MAX_OPTIMIZER_ROWS}-row optimizer limit.`);
      return;
    }
    if (currentOptimizerPieceCount() + qty > MAX_OPTIMIZER_PIECES) {
      showOptimizerStatus(`This addition would exceed the ${MAX_OPTIMIZER_PIECES}-piece optimizer limit.`);
      return;
    }
    if (optimizerLabel.value.trim().length > MAX_OPTIMIZER_LABEL_LENGTH) {
      showOptimizerStatus(`Part labels are limited to ${MAX_OPTIMIZER_LABEL_LENGTH} characters.`);
      return;
    }
    const cut = optimizerCutSize(productKey, finishedWidth, finishedHeight);
    if (cut.width <= 0 || cut.height <= 0) {
      showOptimizerStatus('The selected product rule makes this cut zero or negative. Increase the finished size.');
      return;
    }
    optimizerJob.push({
      id: optimizerNextId++,
      productKey,
      label: optimizerLabel.value.trim(),
      finishedWidth, finishedHeight, qty,
      cutWidth:cut.width, cutHeight:cut.height
    });
    optimizerLastResults=null;
    markOptimizerDirty();
    renderOptimizerJob();
    optimizerResults.classList.remove('show');
    optimizerWidth.value = '';
    optimizerHeight.value = '';
    optimizerQty.value = '1';
    optimizerLabel.value = '';
    optimizerWidth.focus();
  }

  function clearOptimizerCopyStatus() {
    optimizerCopyStatus.textContent='';
    optimizerCopyStatus.className='status';
  }

  function showOptimizerCopyStatus(message,type='ok') {
    optimizerCopyStatus.textContent=message;
    optimizerCopyStatus.className=`status show ${type}`;
  }

  function updateOptimizerCopyControls() {
    const previousSource=optimizerCopySource.value;
    const previousTarget=optimizerCopyTarget.value;
    const counts={};
    for (const row of optimizerJob) counts[row.productKey]=(counts[row.productKey]||0)+row.qty;
    const available=COPY_COMPATIBLE_PRODUCTS.filter(key=>counts[key]>0);

    if (!available.length) {
      optimizerCopySource.innerHTML='<option value="">No compatible parts available</option>';
      optimizerCopyTarget.innerHTML='<option value="">Select destination</option>';
      optimizerCopySource.disabled=true;
      optimizerCopyTarget.disabled=true;
      optimizerCopyBtn.disabled=true;
      optimizerCopyBtn.textContent='Copy Entire List';
      clearOptimizerCopyStatus();
      return;
    }

    optimizerCopySource.disabled=false;
    optimizerCopySource.innerHTML=available.map(key=>`<option value="${key}">${escapeHtml(PRODUCTS[key].shortName)} — ${counts[key]} pc${counts[key]===1?'':'s'}</option>`).join('');
    optimizerCopySource.value=available.includes(previousSource)?previousSource:available[0];
    const sourceKey=optimizerCopySource.value;
    const targets=COPY_COMPATIBLE_PRODUCTS.filter(key=>key!==sourceKey);
    optimizerCopyTarget.disabled=false;
    optimizerCopyTarget.innerHTML=targets.map(key=>`<option value="${key}">${escapeHtml(PRODUCTS[key].shortName)}</option>`).join('');
    optimizerCopyTarget.value=targets.includes(previousTarget)?previousTarget:targets[0];
    optimizerCopyBtn.disabled=!optimizerCopyTarget.value;
    optimizerCopyBtn.textContent=optimizerCopyTarget.value ? `Copy to ${PRODUCTS[optimizerCopyTarget.value].shortName}` : 'Copy Entire List';
  }

  function copyOptimizerProductList() {
    clearOptimizerCopyStatus();
    const sourceKey=optimizerCopySource.value;
    const targetKey=optimizerCopyTarget.value;
    if (!sourceKey || !targetKey || sourceKey===targetKey) {
      showOptimizerCopyStatus('Choose two different products.','error');
      return;
    }
    if (!COPY_COMPATIBLE_PRODUCTS.includes(sourceKey) || !COPY_COMPATIBLE_PRODUCTS.includes(targetKey)) {
      showOptimizerCopyStatus('Part-list copying is only available between .063 Wall, .063 Door, Cellulose, and ACP.','error');
      updateOptimizerCopyControls();
      return;
    }
    const sourceRows=optimizerJob.filter(row=>row.productKey===sourceKey);
    if (!sourceRows.length) {
      showOptimizerCopyStatus('There are no parts in the selected source product.','error');
      updateOptimizerCopyControls();
      return;
    }
    const sourcePieceCount=sourceRows.reduce((sum,row)=>sum+row.qty,0);
    if (optimizerJob.length + sourceRows.length > MAX_OPTIMIZER_ROWS || currentOptimizerPieceCount() + sourcePieceCount > MAX_OPTIMIZER_PIECES) {
      showOptimizerCopyStatus(`Copying this list would exceed the optimizer limit of ${MAX_OPTIMIZER_ROWS} rows or ${MAX_OPTIMIZER_PIECES} total pieces.`,'error');
      return;
    }

    const targetMaterial=MATERIALS[PRODUCTS[targetKey].material];
    const copies=[];
    for (const row of sourceRows) {
      const cut=optimizerCutSize(targetKey,row.finishedWidth,row.finishedHeight);
      // Entered Width follows the sheet's long/grain axis; entered Height follows the short axis.
      const fitsNormal=cut.width<=targetMaterial.usableL+1e-9 && cut.height<=targetMaterial.usableW+1e-9;
      const freeRotation=!optimizerGrainFlowRotation.checked;
      const fitsRotated=freeRotation && cut.height<=targetMaterial.usableL+1e-9 && cut.width<=targetMaterial.usableW+1e-9;
      if (cut.width<=0 || cut.height<=0 || (!fitsNormal && !fitsRotated)) {
        const rowName=row.label || PRODUCTS[sourceKey].shortName;
        const orientationNote=optimizerGrainFlowRotation.checked
          ? ' while Grain Flow Rotation is ON. Turn it OFF to allow free 90° nesting'
          : ' even with free 90° nesting';
        showOptimizerCopyStatus(`${rowName} would require a ${measurementText(cut.width)} W × ${measurementText(cut.height)} H ${PRODUCTS[targetKey].shortName} cut, which does not fit the destination sheet${orientationNote}. Nothing was copied.`,'error');
        return;
      }
      copies.push({
        id:optimizerNextId++,
        productKey:targetKey,
        label:row.label,
        finishedWidth:row.finishedWidth,
        finishedHeight:row.finishedHeight,
        qty:row.qty,
        cutWidth:cut.width,
        cutHeight:cut.height
      });
    }

    const hadResults=optimizerResults.classList.contains('show');
    optimizerJob.push(...copies);
    optimizerLastResults=null;
    markOptimizerDirty();
    renderOptimizerJob();
    const pieceCount=copies.reduce((sum,row)=>sum+row.qty,0);
    showOptimizerCopyStatus(`Copied ${pieceCount} piece${pieceCount===1?'':'s'} from ${PRODUCTS[sourceKey].shortName} to ${PRODUCTS[targetKey].shortName}. Finished sizes, quantities, and labels were preserved; destination cut rules were recalculated. New pieces start uncut.`,'ok');
    if (hadResults) runOptimizer(false);
  }

  function setOptimizerCutListDrawerOpen(open) {
    if (open) openDrawer('optimizerCutListDrawer',document.activeElement); else closeDrawer('optimizerCutListDrawer');
    optimizerCutListMenuBtn.setAttribute('aria-expanded',open?'true':'false');
  }

  optimizerCutListMenuBtn.addEventListener('click', () => {
    setOptimizerCutListDrawerOpen(!optimizerCutListDrawer.classList.contains('open'));
  });
  optimizerCutListCloseBtn.addEventListener('click', () => setOptimizerCutListDrawerOpen(false));
  optimizerCutListBackdrop.addEventListener('click', () => setOptimizerCutListDrawerOpen(false));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && optimizerCutListDrawer.classList.contains('open')) {
      setOptimizerCutListDrawerOpen(false);
    }
  });



  function renderOptimizerJob() {
    const totalPieces = optimizerJob.reduce((sum,item) => sum + Number(item.qty || 0), 0);
    optimizerCutListMeta.textContent = totalPieces;
    optimizerCutListDrawerMeta.textContent = `${totalPieces} piece${totalPieces === 1 ? '' : 's'}`;
    updateOptimizerCopyControls();
    if (!optimizerJob.length) {
      optimizerJobList.innerHTML = '<div class="optimizer-empty">No parts added yet.</div>';
      return;
    }
    optimizerJobList.innerHTML = optimizerJob.map((item,index) => {
      const p = PRODUCTS[item.productKey];
      const m = MATERIALS[p.material];
      const name = item.label ? `${item.label} — ${p.name}` : p.name;
      let cutCount=0;
      for (let q=1;q<=item.qty;q++) if (optimizerCutIds.has(`${item.id}-${q}`)) cutCount++;
      const allCut=cutCount===item.qty && item.qty>0;
      return `<div class="job-row${allCut?' all-cut':''}" style="--part-color:${p.color || '#00D2FF'}">
        <div class="job-index">${index+1}</div>
        <div class="job-main">
          <strong>${escapeHtml(name)} × ${item.qty}</strong>
          <small>Finished ${measurementText(item.finishedWidth)} W × ${measurementText(item.finishedHeight)} H → Cut <b>${measurementText(item.cutWidth)} W × ${measurementText(item.cutHeight)} H</b> • ${escapeHtml(m.name)}</small>
          <span class="job-cut-summary">${cutCount} of ${item.qty} cut</span>
        </div>
        <button class="icon-btn" type="button" aria-label="Remove part" data-remove-job="${item.id}">×</button>
      </div>`;
    }).join('');
  }

  optimizerJobList.addEventListener('click', e => {
    const btn = e.target.closest('[data-remove-job]');
    if (!btn) return;
    const id = Number(btn.dataset.removeJob);
    optimizerJob = optimizerJob.filter(item => item.id !== id);
    for (const uid of Array.from(optimizerCutIds)) if (uid.startsWith(`${id}-`)) optimizerCutIds.delete(uid);
    optimizerLastResults=null;
    markOptimizerDirty();
    renderOptimizerJob();
    optimizerResults.classList.remove('show');
  });

  function rectIntersects(a,b) {
    return !(b.x >= a.x + a.w - 1e-9 || b.x + b.w <= a.x + 1e-9 || b.y >= a.y + a.h - 1e-9 || b.y + b.h <= a.y + 1e-9);
  }

  function splitFreeRects(freeRects, used) {
    const out = [];
    for (const f of freeRects) {
      if (!rectIntersects(f,used)) { out.push(f); continue; }
      if (used.x > f.x + 1e-9) out.push({x:f.x,y:f.y,w:used.x-f.x,h:f.h});
      if (used.x + used.w < f.x + f.w - 1e-9) out.push({x:used.x+used.w,y:f.y,w:f.x+f.w-(used.x+used.w),h:f.h});
      if (used.y > f.y + 1e-9) out.push({x:f.x,y:f.y,w:f.w,h:used.y-f.y});
      if (used.y + used.h < f.y + f.h - 1e-9) out.push({x:f.x,y:used.y+used.h,w:f.w,h:f.y+f.h-(used.y+used.h)});
    }
    return pruneFreeRects(out);
  }

  function pruneFreeRects(rects) {
    const clean = rects.filter(r => r.w > 1e-8 && r.h > 1e-8);
    const keep = new Array(clean.length).fill(true);
    for (let i=0;i<clean.length;i++) {
      if (!keep[i]) continue;
      for (let j=0;j<clean.length;j++) {
        if (i === j || !keep[j]) continue;
        const a=clean[i], b=clean[j];
        if (a.x >= b.x-1e-9 && a.y >= b.y-1e-9 && a.x+a.w <= b.x+b.w+1e-9 && a.y+a.h <= b.y+b.h+1e-9) {
          keep[i]=false; break;
        }
      }
    }
    return clean.filter((_,i) => keep[i]);
  }

  function placementScore(f, rw, rh, heuristic) {
    const lw = f.w-rw, lh=f.h-rh;
    const shortFit=Math.min(lw,lh), longFit=Math.max(lw,lh), areaFit=f.w*f.h-rw*rh;
    if (heuristic === 'area') return [areaFit,shortFit,longFit,f.y,f.x];
    if (heuristic === 'bottom') return [f.y+rh,f.x,shortFit,longFit,areaFit];
    if (heuristic === 'long') return [longFit,shortFit,areaFit,f.y,f.x];
    return [shortFit,longFit,areaFit,f.y,f.x];
  }

  function lexLess(a,b) {
    if (!b) return true;
    for (let i=0;i<a.length;i++) {
      if (a[i] < b[i]-1e-9) return true;
      if (a[i] > b[i]+1e-9) return false;
    }
    return false;
  }

  function bestPlacementAcrossBins(bins,item,allowRotate,heuristic) {
    let best=null, bestScore=null;
    for (let bi=0;bi<bins.length;bi++) {
      const bin=bins[bi];
      for (let fi=0;fi<bin.free.length;fi++) {
        const f=bin.free[fi];
        const orientations = [{w:item.cutL,h:item.cutW,rotated:false}];
        if (allowRotate && Math.abs(item.cutL-item.cutW)>1e-9) orientations.push({w:item.cutW,h:item.cutL,rotated:true});
        for (const o of orientations) {
          if (o.w <= f.w+1e-9 && o.h <= f.h+1e-9) {
            const base=placementScore(f,o.w,o.h,heuristic);
            const score=[...base,bin.used.length===0?1:0,bi];
            if (lexLess(score,bestScore)) {
              bestScore=score;
              best={binIndex:bi,x:f.x,y:f.y,w:o.w,h:o.h,rotated:o.rotated};
            }
          }
        }
      }
    }
    return best;
  }

  function deterministicShuffle(n,seed) {
    const a=Array.from({length:n},(_,i)=>i);
    let x=seed>>>0;
    for (let i=n-1;i>0;i--) {
      x=(1664525*x+1013904223)>>>0;
      const j=x%(i+1);
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function buildOrders(items) {
    const base=Array.from({length:items.length},(_,i)=>i);
    const sortBy=fn=>base.slice().sort((a,b)=>fn(items[b])-fn(items[a]) || a-b);
    const orders=[
      sortBy(p=>p.cutL*p.cutW),
      sortBy(p=>Math.max(p.cutL,p.cutW)),
      sortBy(p=>p.cutL+p.cutW),
      sortBy(p=>p.cutL),
      sortBy(p=>p.cutW),
      sortBy(p=>Math.min(p.cutL,p.cutW)),
      sortBy(p=>Math.abs(p.cutL-p.cutW))
    ];
    // Extra whole-job orderings help find a strong upper bound before
    // the backtracking search starts.
    for (let seed=1;seed<=48;seed++) orders.push(deterministicShuffle(items.length,seed*7919));
    return orders;
  }

  function packWithOrder(items,W,H,allowRotate,order,heuristic) {
    const bins=[];
    for (const idx of order) {
      const item=items[idx];
      let place=bestPlacementAcrossBins(bins,item,allowRotate,heuristic);
      if (!place) {
        bins.push({free:[{x:0,y:0,w:W,h:H}],used:[]});
        place=bestPlacementAcrossBins(bins,item,allowRotate,heuristic);
        if (!place) return null;
      }
      const bin=bins[place.binIndex];
      const used={x:place.x,y:place.y,w:place.w,h:place.h,item,rotated:place.rotated};
      bin.used.push(used);
      bin.free=splitFreeRects(bin.free,used);
    }
    return bins;
  }

  function bestGreedyPacking(items,W,H,allowRotate) {
    const orders=buildOrders(items);
    const heuristics=['short','area','bottom','long'];
    let best=null;
    for (const h of heuristics) {
      for (const order of orders) {
        const packed=packWithOrder(items,W,H,allowRotate,order,h);
        if (!packed) continue;
        if (!best || packed.length<best.length) best=packed;
        if (best && best.length===1) return best;
      }
    }
    return best;
  }

  function itemOrientations(item,W,H,allowRotate) {
    const out=[];
    if (item.cutL<=W+1e-9 && item.cutW<=H+1e-9) out.push({w:item.cutL,h:item.cutW,rotated:false});
    if (allowRotate && Math.abs(item.cutL-item.cutW)>1e-9 && item.cutW<=W+1e-9 && item.cutL<=H+1e-9) out.push({w:item.cutW,h:item.cutL,rotated:true});
    return out;
  }

  function twoItemsCanShareSheet(a,b,W,H,allowRotate) {
    const ao=itemOrientations(a,W,H,allowRotate), bo=itemOrientations(b,W,H,allowRotate);
    for (const x of ao) for (const y of bo) {
      if (x.w+y.w<=W+1e-9 && Math.max(x.h,y.h)<=H+1e-9) return true;
      if (x.h+y.h<=H+1e-9 && Math.max(x.w,y.w)<=W+1e-9) return true;
    }
    return false;
  }

  function incompatibilityCliqueLowerBound(items,W,H,allowRotate) {
    const n=items.length;
    if (n<=1) return n;
    const incompatible=Array.from({length:n},()=>new Set());
    for (let i=0;i<n;i++) for (let j=i+1;j<n;j++) {
      if (!twoItemsCanShareSheet(items[i],items[j],W,H,allowRotate)) {
        incompatible[i].add(j); incompatible[j].add(i);
      }
    }
    const degreeOrder=Array.from({length:n},(_,i)=>i).sort((a,b)=>incompatible[b].size-incompatible[a].size);
    let best=1;
    const starts=n<=100?degreeOrder:degreeOrder.slice(0,40);
    for (const seed of starts) {
      const clique=[seed];
      for (const v of degreeOrder) {
        if (v===seed) continue;
        if (clique.every(c=>incompatible[v].has(c))) clique.push(v);
      }
      if (clique.length>best) best=clique.length;
    }
    return best;
  }

  function exactCandidatePlacements(bins,item,W,H,allowRotate) {
    const candidates=[];
    const seen=new Set();
    const seenBinShapes=new Set();
    const orientations=itemOrientations(item,W,H,allowRotate);

    for (let bi=0;bi<bins.length;bi++) {
      const bin=bins[bi];
      // Identical bins are interchangeable. Skipping duplicate geometric states
      // removes a huge amount of symmetry without changing the solution space.
      const binShape=bin.used.length===0
        ? 'EMPTY'
        : bin.free.map(r=>`${r.x.toFixed(8)},${r.y.toFixed(8)},${r.w.toFixed(8)},${r.h.toFixed(8)}`).sort().join('|');
      if (seenBinShapes.has(binShape)) continue;
      seenBinShapes.add(binShape);

      for (const f of bin.free) {
        for (const o of orientations) {
          if (o.w>f.w+1e-9 || o.h>f.h+1e-9) continue;
          const xs=[f.x, f.x+f.w-o.w];
          const ys=[f.y, f.y+f.h-o.h];
          for (const x of xs) for (const y of ys) {
            const key=`${bi}|${x.toFixed(8)}|${y.toFixed(8)}|${o.w.toFixed(8)}|${o.h.toFixed(8)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const shortFit=Math.min(f.w-o.w,f.h-o.h);
            const longFit=Math.max(f.w-o.w,f.h-o.h);
            candidates.push({
              binIndex:bi,x,y,w:o.w,h:o.h,rotated:o.rotated,
              score:[bin.used.length===0?1:0,shortFit,longFit,f.w*f.h-o.w*o.h,y,x]
            });
          }
        }
      }
    }
    candidates.sort((a,b)=>{
      for (let i=0;i<a.score.length;i++) {
        if (a.score[i]!==b.score[i]) return a.score[i]-b.score[i];
      }
      return a.binIndex-b.binIndex;
    });
    return candidates;
  }

  function cloneBins(bins) {
    return bins.map(b=>({
      free:b.free.map(r=>({...r})),
      used:b.used.map(u=>({...u}))
    }));
  }

  function boundedBacktrackingPack(items,W,H,binCount,allowRotate,deadlineMs) {
    // A fixed item order does NOT force a sheet order: every item is tried in
    // every feasible sheet/location and earlier choices are backtracked.
    // Largest / hardest pieces first keeps the search practical.
    const ordered=items.slice().sort((a,b)=>
      (b.cutL*b.cutW)-(a.cutL*a.cutW) ||
      Math.max(b.cutL,b.cutW)-Math.max(a.cutL,a.cutW) ||
      Math.min(b.cutL,b.cutW)-Math.min(a.cutL,a.cutW) ||
      String(a.uid).localeCompare(String(b.uid))
    );
    const bins=Array.from({length:binCount},()=>({free:[{x:0,y:0,w:W,h:H}],used:[]}));
    const sheetArea=W*H;
    const suffixArea=new Array(ordered.length+1).fill(0);
    for (let i=ordered.length-1;i>=0;i--) suffixArea[i]=suffixArea[i+1]+ordered[i].cutL*ordered[i].cutW;
    let timedOut=false;
    let nodes=0;

    function search(depth,usedArea) {
      if ((++nodes & 511)===0 && performance.now()>deadlineMs) { timedOut=true; return null; }
      if (depth===ordered.length) return cloneBins(bins).filter(b=>b.used.length);

      // Pure area capacity prune across all requested sheets.
      if (suffixArea[depth] > binCount*sheetArea-usedArea+1e-8) return null;

      const item=ordered[depth];
      const placements=exactCandidatePlacements(bins,item,W,H,allowRotate);
      if (!placements.length) return null;

      for (const place of placements) {
        if (timedOut) return null;
        const bin=bins[place.binIndex];
        const oldFree=bin.free;
        const used={x:place.x,y:place.y,w:place.w,h:place.h,item,rotated:place.rotated};
        bin.used.push(used);
        bin.free=splitFreeRects(oldFree,used);
        const result=search(depth+1,usedArea+place.w*place.h);
        if (result) return result;
        bin.used.pop();
        bin.free=oldFree;
      }
      return null;
    }

    const result=search(0,0);
    return {bins:result,timedOut,nodes};
  }

  function validatePackingGeometry(bins,items,W,H,allowRotate) {
    if (!Array.isArray(bins)) return {ok:false, reason:'No sheet layout was produced.'};
    const expected = new Map(items.map(item => [String(item.uid), item]));
    const seen = new Set();
    const eps = 1e-7;

    for (let bi=0; bi<bins.length; bi++) {
      const used = Array.isArray(bins[bi].used) ? bins[bi].used : [];
      for (let i=0; i<used.length; i++) {
        const a = used[i];
        const uid = String(a.item && a.item.uid);
        if (!expected.has(uid)) return {ok:false, reason:`Sheet ${bi+1} contains an unknown part.`};
        if (seen.has(uid)) return {ok:false, reason:`Part ${uid} was assigned more than once.`};
        seen.add(uid);

        if (a.x < -eps || a.y < -eps || a.w <= 0 || a.h <= 0 || a.x+a.w > W+eps || a.y+a.h > H+eps) {
          return {ok:false, reason:`Part ${uid} falls outside the usable sheet boundary.`};
        }

        const item = expected.get(uid);
        const normal = Math.abs(a.w-item.cutL)<=eps && Math.abs(a.h-item.cutW)<=eps;
        const rotated = allowRotate && Math.abs(a.w-item.cutW)<=eps && Math.abs(a.h-item.cutL)<=eps;
        if (!normal && !rotated) return {ok:false, reason:`Part ${uid} has an invalid placed size.`};

        for (let j=0; j<i; j++) {
          if (rectIntersects(a,used[j])) return {ok:false, reason:`Two parts overlap on Sheet ${bi+1}.`};
        }
      }
    }

    if (seen.size !== expected.size) return {ok:false, reason:`Only ${seen.size} of ${expected.size} parts were assigned to sheets.`};
    return {ok:true};
  }

  function isShearMaterial(material) {
    return material && material.cutMethod === 'shear';
  }

  function shearSplitOptions(f,w,h) {
    const eps=1e-9;
    const remW=f.w-w, remH=f.h-h;
    const options=[];

    function add(mode) {
      const free=[];
      const cuts=[];
      if (mode==='vertical') {
        if (remW>eps) {
          cuts.push({axis:'x',line:f.x+w,offset:w,region:{...f}});
          free.push({x:f.x+w,y:f.y,w:remW,h:f.h});
          if (remH>eps) {
            const strip={x:f.x,y:f.y,w:w,h:f.h};
            cuts.push({axis:'y',line:f.y+h,offset:h,region:strip});
            free.push({x:f.x,y:f.y+h,w:w,h:remH});
          }
        } else if (remH>eps) {
          cuts.push({axis:'y',line:f.y+h,offset:h,region:{...f}});
          free.push({x:f.x,y:f.y+h,w:f.w,h:remH});
        }
      } else {
        if (remH>eps) {
          cuts.push({axis:'y',line:f.y+h,offset:h,region:{...f}});
          free.push({x:f.x,y:f.y+h,w:f.w,h:remH});
          if (remW>eps) {
            const strip={x:f.x,y:f.y,w:f.w,h:h};
            cuts.push({axis:'x',line:f.x+w,offset:w,region:strip});
            free.push({x:f.x+w,y:f.y,w:remW,h:h});
          }
        } else if (remW>eps) {
          cuts.push({axis:'x',line:f.x+w,offset:w,region:{...f}});
          free.push({x:f.x+w,y:f.y,w:remW,h:f.h});
        }
      }
      const key=free.map(r=>`${r.x.toFixed(7)},${r.y.toFixed(7)},${r.w.toFixed(7)},${r.h.toFixed(7)}`).sort().join('|');
      if (!options.some(o=>o.key===key)) options.push({mode,free,cuts,key});
    }

    add('vertical');
    add('horizontal');
    return options;
  }

  function shearCandidateScore(f,w,h,split,newSheet,heuristic) {
    const remW=Math.max(0,f.w-w), remH=Math.max(0,f.h-h);
    const areas=split.free.map(r=>r.w*r.h);
    const largest=areas.length?Math.max(...areas):0;
    const smallest=areas.length?Math.min(...areas):0;
    const widestShort=split.free.length?Math.max(...split.free.map(r=>Math.min(r.w,r.h))):0;
    const shortFit=Math.min(remW,remH), longFit=Math.max(remW,remH);
    const fragments=split.free.length;
    if (heuristic==='largest') return [newSheet,-largest,-widestShort,fragments,shortFit,longFit,f.y,f.x];
    if (heuristic==='balanced') return [newSheet,areas.length>1?Math.abs(areas[0]-areas[1]):0,-largest,-smallest,shortFit,longFit,f.y,f.x];
    if (heuristic==='fragment') return [newSheet,fragments,shortFit,longFit,-largest,-widestShort,f.y,f.x];
    return [newSheet,shortFit,longFit,-largest,fragments,f.y,f.x];
  }

  function bestShearPlacementAcrossBins(bins,item,W,H,allowRotate,heuristic) {
    let best=null, bestScore=null;
    const orientations=itemOrientations(item,W,H,allowRotate);
    for (let bi=0;bi<bins.length;bi++) {
      const bin=bins[bi];
      for (let fi=0;fi<bin.free.length;fi++) {
        const f=bin.free[fi];
        for (const o of orientations) {
          if (o.w>f.w+1e-9 || o.h>f.h+1e-9) continue;
          for (const split of shearSplitOptions(f,o.w,o.h)) {
            const score=shearCandidateScore(f,o.w,o.h,split,bin.used.length===0?1:0,heuristic);
            if (lexLess(score,bestScore)) {
              bestScore=score;
              best={binIndex:bi,freeIndex:fi,x:f.x,y:f.y,w:o.w,h:o.h,rotated:o.rotated,split};
            }
          }
        }
      }
    }
    return best;
  }

  function applyShearPlacement(bin,place,item) {
    const f=bin.free[place.freeIndex];
    const used={x:f.x,y:f.y,w:place.w,h:place.h,item,rotated:place.rotated};
    const before=bin.free.slice(0,place.freeIndex);
    const after=bin.free.slice(place.freeIndex+1);
    bin.free=before.concat(place.split.free.map(r=>({...r})),after);
    bin.used.push(used);
    if (!bin.shearCuts) bin.shearCuts=[];
    for (const c of place.split.cuts) bin.shearCuts.push({...c,region:{...c.region},partUid:String(item.uid)});
    return used;
  }

  function buildShearOrders(items) {
    const base=Array.from({length:items.length},(_,i)=>i);
    const sortBy=fn=>base.slice().sort((a,b)=>fn(items[b])-fn(items[a]) || String(items[a].uid).localeCompare(String(items[b].uid)));
    const orders=[
      sortBy(p=>p.cutL*p.cutW),
      sortBy(p=>Math.max(p.cutL,p.cutW)),
      sortBy(p=>p.cutL),
      sortBy(p=>p.cutW),
      sortBy(p=>Math.min(p.cutL,p.cutW)),
      sortBy(p=>p.cutL+p.cutW),
      sortBy(p=>Math.abs(p.cutL-p.cutW))
    ];
    const randomCount=items.length<=60?24:items.length<=150?12:6;
    for (let seed=1;seed<=randomCount;seed++) orders.push(deterministicShuffle(items.length,seed*104729));
    return orders;
  }

  function packShearWithOrder(items,W,H,allowRotate,order,heuristic) {
    const bins=[];
    for (const idx of order) {
      const item=items[idx];
      let place=bestShearPlacementAcrossBins(bins,item,W,H,allowRotate,heuristic);
      if (!place) {
        bins.push({free:[{x:0,y:0,w:W,h:H}],used:[],shearCuts:[]});
        place=bestShearPlacementAcrossBins(bins,item,W,H,allowRotate,heuristic);
        if (!place) return null;
      }
      applyShearPlacement(bins[place.binIndex],place,item);
    }
    return bins.filter(b=>b.used.length);
  }

  function bestShearPacking(items,W,H,allowRotate) {
    const orders=buildShearOrders(items);
    const heuristics=['tight','largest','fragment','balanced'];
    let best=null;
    for (const heuristic of heuristics) {
      for (const order of orders) {
        const packed=packShearWithOrder(items,W,H,allowRotate,order,heuristic);
        if (!packed) continue;
        if (!best || packed.length<best.length) best=packed;
        if (best && best.length===1) return best;
      }
    }
    return best;
  }

  function cloneShearBins(bins) {
    return bins.map(b=>({
      free:b.free.map(r=>({...r})),
      used:b.used.map(u=>({...u})),
      shearCuts:(b.shearCuts||[]).map(c=>({...c,region:{...c.region}}))
    }));
  }

  function exactShearCandidatePlacements(bins,item,W,H,allowRotate) {
    const candidates=[];
    const seen=new Set();
    const seenBinShapes=new Set();
    const orientations=itemOrientations(item,W,H,allowRotate);
    for (let bi=0;bi<bins.length;bi++) {
      const bin=bins[bi];
      const shape=bin.used.length===0?'EMPTY':bin.free.map(r=>`${r.x.toFixed(6)},${r.y.toFixed(6)},${r.w.toFixed(6)},${r.h.toFixed(6)}`).sort().join('|');
      if (seenBinShapes.has(shape)) continue;
      seenBinShapes.add(shape);
      for (let fi=0;fi<bin.free.length;fi++) {
        const f=bin.free[fi];
        for (const o of orientations) {
          if (o.w>f.w+1e-9 || o.h>f.h+1e-9) continue;
          for (const split of shearSplitOptions(f,o.w,o.h)) {
            const key=`${bi}|${fi}|${o.w.toFixed(6)}|${o.h.toFixed(6)}|${split.key}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const score=shearCandidateScore(f,o.w,o.h,split,bin.used.length===0?1:0,'largest');
            candidates.push({binIndex:bi,freeIndex:fi,x:f.x,y:f.y,w:o.w,h:o.h,rotated:o.rotated,split,score});
          }
        }
      }
    }
    candidates.sort((a,b)=>{
      const n=Math.max(a.score.length,b.score.length);
      for (let i=0;i<n;i++) {
        const av=a.score[i]??0,bv=b.score[i]??0;
        if (Math.abs(av-bv)>1e-9) return av-bv;
      }
      return a.binIndex-b.binIndex;
    });
    return candidates;
  }

  function globalShearBacktrackingPack(items,W,H,binCount,allowRotate,deadlineMs) {
    const ordered=items.slice().sort((a,b)=>
      (b.cutL*b.cutW)-(a.cutL*a.cutW) ||
      Math.max(b.cutL,b.cutW)-Math.max(a.cutL,a.cutW) ||
      Math.min(b.cutL,b.cutW)-Math.min(a.cutL,a.cutW) ||
      String(a.uid).localeCompare(String(b.uid))
    );
    const bins=Array.from({length:binCount},()=>({free:[{x:0,y:0,w:W,h:H}],used:[],shearCuts:[]}));
    const sheetArea=W*H;
    const suffixArea=new Array(ordered.length+1).fill(0);
    for (let i=ordered.length-1;i>=0;i--) suffixArea[i]=suffixArea[i+1]+ordered[i].cutL*ordered[i].cutW;
    let timedOut=false,nodes=0;

    function search(depth,usedArea) {
      if ((++nodes & 255)===0 && performance.now()>deadlineMs) { timedOut=true; return null; }
      if (depth===ordered.length) return cloneShearBins(bins).filter(b=>b.used.length);
      if (suffixArea[depth] > binCount*sheetArea-usedArea+1e-8) return null;
      const item=ordered[depth];
      const placements=exactShearCandidatePlacements(bins,item,W,H,allowRotate);
      if (!placements.length) return null;
      for (const place of placements) {
        if (timedOut) return null;
        const bin=bins[place.binIndex];
        const oldFree=bin.free;
        const oldCutLen=bin.shearCuts.length;
        const f=oldFree[place.freeIndex];
        bin.free=oldFree.slice(0,place.freeIndex).concat(place.split.free.map(r=>({...r})),oldFree.slice(place.freeIndex+1));
        bin.used.push({x:f.x,y:f.y,w:place.w,h:place.h,item,rotated:place.rotated});
        for (const c of place.split.cuts) bin.shearCuts.push({...c,region:{...c.region},partUid:String(item.uid)});
        const result=search(depth+1,usedArea+place.w*place.h);
        if (result) return result;
        bin.used.pop();
        bin.shearCuts.length=oldCutLen;
        bin.free=oldFree;
      }
      return null;
    }
    const binsResult=search(0,0);
    return {bins:binsResult,timedOut,nodes};
  }

  function sameRect(a,b,eps=1e-6) {
    return Math.abs(a.x-b.x)<=eps && Math.abs(a.y-b.y)<=eps && Math.abs(a.w-b.w)<=eps && Math.abs(a.h-b.h)<=eps;
  }

  function validateShearSequence(bin,W,H) {
    const eps=1e-6;
    let regions=[{x:0,y:0,w:W,h:H}];
    for (let ci=0;ci<(bin.shearCuts||[]).length;ci++) {
      const cut=bin.shearCuts[ci];
      const ri=regions.findIndex(r=>sameRect(r,cut.region,eps));
      if (ri<0) return {ok:false,reason:`Shear cut ${ci+1} does not span a currently separated rectangular section.`};
      const r=regions[ri];
      const next=[];
      if (cut.axis==='x') {
        if (cut.line<=r.x+eps || cut.line>=r.x+r.w-eps) return {ok:false,reason:`Shear cut ${ci+1} has an invalid X position.`};
        next.push({x:r.x,y:r.y,w:cut.line-r.x,h:r.h},{x:cut.line,y:r.y,w:r.x+r.w-cut.line,h:r.h});
      } else if (cut.axis==='y') {
        if (cut.line<=r.y+eps || cut.line>=r.y+r.h-eps) return {ok:false,reason:`Shear cut ${ci+1} has an invalid Y position.`};
        next.push({x:r.x,y:r.y,w:r.w,h:cut.line-r.y},{x:r.x,y:cut.line,w:r.w,h:r.y+r.h-cut.line});
      } else return {ok:false,reason:`Shear cut ${ci+1} has an invalid direction.`};
      regions.splice(ri,1,...next);
    }
    for (const used of bin.used) {
      if (!regions.some(r=>sameRect(r,{x:used.x,y:used.y,w:used.w,h:used.h},eps))) {
        return {ok:false,reason:`Part ${used.item.uid} cannot be isolated using the required full-edge shear geometry.`};
      }
    }
    return {ok:true};
  }

  function validateShearPacking(bins,items,W,H,allowRotate) {
    const geometry=validatePackingGeometry(bins,items,W,H,allowRotate);
    if (!geometry.ok) return geometry;
    for (let i=0;i<bins.length;i++) {
      const sequence=validateShearSequence(bins[i],W,H);
      if (!sequence.ok) return {ok:false,reason:`Sheet ${i+1}: ${sequence.reason}`};
    }
    return {ok:true};
  }

  function optimizeShearMaterialGroup(items,material,allowRotate) {
    const W=material.usableL,H=material.usableW;
    for (const item of items) {
      const fitsNormal=item.cutL<=W+1e-9 && item.cutW<=H+1e-9;
      const fitsRot=allowRotate && item.cutW<=W+1e-9 && item.cutL<=H+1e-9;
      if (!fitsNormal && !fitsRot) return {error:item};
    }

    const upperBins=bestShearPacking(items,W,H,allowRotate);
    if (!upperBins) return {error:items[0]};
    const upperCheck=validateShearPacking(upperBins,items,W,H,allowRotate);
    if (!upperCheck.ok) return {internalError:upperCheck.reason};

    const totalArea=items.reduce((s,p)=>s+p.cutL*p.cutW,0);
    const areaLower=Math.max(1,Math.ceil(totalArea/(W*H)-1e-12));
    const cliqueLower=incompatibilityCliqueLowerBound(items,W,H,allowRotate);
    const lower=Math.max(areaLower,cliqueLower);
    let best=upperBins;
    let searchTimedOut=false,globallySearched=false;
    const budget=items.length<=16?5000:items.length<=26?3200:items.length<=40?1800:800;
    const deadline=performance.now()+budget;

    for (let count=lower;count<best.length;count++) {
      if (performance.now()>deadline) { searchTimedOut=true; break; }
      globallySearched=true;
      const attempt=globalShearBacktrackingPack(items,W,H,count,allowRotate,deadline);
      if (attempt.bins) {
        const check=validateShearPacking(attempt.bins,items,W,H,allowRotate);
        if (!check.ok) return {internalError:check.reason};
        best=attempt.bins;
        break;
      }
      if (attempt.timedOut) { searchTimedOut=true; break; }
    }

    const finalCheck=validateShearPacking(best,items,W,H,allowRotate);
    if (!finalCheck.ok) return {internalError:finalCheck.reason};
    // For shear-constrained layouts, only call the minimum mathematically confirmed
    // when the layout reaches a universal lower bound. The time-limited guillotine
    // search may rule out smaller patterns within its explored slicing states, but
    // that alone is not presented as an absolute proof.
    const minimumConfirmed=best.length===lower;
    return {bins:best,lowerBound:lower,minimumConfirmed,quality:minimumConfirmed?'proven-minimum':'best-found',globallySearched,searchTimedOut,optimizerMode:'shear-guillotine'};
  }

  function optimizeMaterialGroup(items,material,allowRotate) {
    if (isShearMaterial(material)) return optimizeShearMaterialGroup(items,material,allowRotate);
    const W=material.usableL, H=material.usableW;
    for (const item of items) {
      const fitsNormal=item.cutL<=W+1e-9 && item.cutW<=H+1e-9;
      const fitsRot=allowRotate && item.cutW<=W+1e-9 && item.cutL<=H+1e-9;
      if (!fitsNormal && !fitsRot) return {error:item};
    }

    // First find a strong complete-job solution. This is only an upper bound;
    // the global search below is allowed to move every part between sheets.
    const upperBins=bestGreedyPacking(items,W,H,allowRotate);
    if (!upperBins) return {error:items[0]};
    const upperCheck=validatePackingGeometry(upperBins,items,W,H,allowRotate);
    if (!upperCheck.ok) return {internalError:upperCheck.reason};

    const totalArea=items.reduce((s,p)=>s+p.cutL*p.cutW,0);
    const areaLower=Math.max(1,Math.ceil(totalArea/(W*H)-1e-12));
    const cliqueLower=incompatibilityCliqueLowerBound(items,W,H,allowRotate);
    const lower=Math.max(areaLower,cliqueLower);
    let best=upperBins;
    let searchTimedOut=false;
    let globallySearched=false;

    // Search the entire part list against progressively larger sheet counts.
    // For normal fabrication jobs this gives the optimizer freedom to pair a
    // later-entered small part with an earlier large part on any sheet.
    const now=performance.now();
    const budget = items.length<=18 ? 4500 : items.length<=28 ? 3000 : items.length<=40 ? 1800 : 900;
    const deadline=now+budget;

    for (let count=lower;count<best.length;count++) {
      if (performance.now()>deadline) { searchTimedOut=true; break; }
      globallySearched=true;
      const attempt=boundedBacktrackingPack(items,W,H,count,allowRotate,deadline);
      if (attempt.bins) {
        const attemptCheck=validatePackingGeometry(attempt.bins,items,W,H,allowRotate);
        if (!attemptCheck.ok) return {internalError:attemptCheck.reason};
        best=attempt.bins;
        break; // Counts are tested smallest-first; all smaller counts were already ruled out.
      }
      if (attempt.timedOut) { searchTimedOut=true; break; }
    }

    const finalCheck=validatePackingGeometry(best,items,W,H,allowRotate);
    if (!finalCheck.ok) return {internalError:finalCheck.reason};

    // A layout is proven minimal when it reaches the lower bound, or when the
    // complete search exhaustively ruled out every smaller count without timing out.
    // Only a universal lower-bound match is a mathematical proof. The bounded
    // search is a heuristic improvement pass and must never prove optimality by failure.
    const minimumConfirmed=best.length===lower;
    return {
      bins:best,
      lowerBound:lower,
      minimumConfirmed,
      quality:minimumConfirmed?'proven-minimum':'best-found',
      globallySearched,
      searchTimedOut,
      optimizerMode:'whole-job'
    };
  }

  function expandedOptimizerItems() {
    const groups={};
    optimizerJob.forEach((row,rowIndex) => {
      const product=PRODUCTS[row.productKey];
      const key=product.material;
      if (!groups[key]) groups[key]=[];
      for (let q=0;q<row.qty;q++) {
        groups[key].push({
          uid:`${row.id}-${q+1}`,
          rowId:row.id,
          instance:q+1,
          productKey:row.productKey,
          label:row.label,
          finishedWidth:row.finishedWidth, finishedHeight:row.finishedHeight,
          cutWidth:row.cutWidth, cutHeight:row.cutHeight,
          // Packing engine axes: sheet long/grain axis = entered panel width;
          // sheet short axis = entered panel height. Free rotation may swap them later.
          cutL:row.cutWidth, cutW:row.cutHeight
        });
      }
    });
    return groups;
  }

  function measurementTextNoQuote(value) {
    return measurementText(value).replace(/"/g,'');
  }

  function partCutLabel(item) {
    return `${measurementTextNoQuote(item.cutWidth)} × ${measurementTextNoQuote(item.cutHeight)}`;
  }

  function estimatedSvgTextUnits(text) {
    let units = 0;
    for (const ch of String(text)) {
      if (ch === ' ') units += .32;
      else if ('1Iil|'.includes(ch)) units += .34;
      else if ('MW@#%'.includes(ch)) units += .82;
      else if ('×'.includes(ch)) units += .68;
      else if ('./-'.includes(ch)) units += .38;
      else units += .58;
    }
    return Math.max(units, .8);
  }

  function fitSvgFontSize(text, availableWidth, maxSize) {
    const widthLimited = availableWidth / estimatedSvgTextUnits(text);
    return Math.max(.55, Math.min(maxSize, widthLimited));
  }

  function partListBadge(item,fallback='') {
    return (item.label && item.label.trim()) || fallback || partCutLabel(item);
  }

  function renderSheetSvg(bin,material) {
    const usableW=material.usableL, usableH=material.usableW;
    const stockW=material.rawL, stockH=material.rawW;
    const gridW=Math.max(1, Math.ceil(stockW - 1e-9));
    const gridH=Math.max(1, Math.ceil(stockH - 1e-9));
    const padL=4.2, padT=3.2, padR=1.2, padB=1.2;
    const stockX=padL, stockY=padT;
    const totalW=padL + stockW + padR;
    const totalH=padT + stockH + padB;
    const clipId=`stock-clip-${++sheetSvgClipCounter}`;
    const axisXs=[];
    for (let x=0;x<=gridW;x+=12) axisXs.push(x);
    if (Math.abs(axisXs[axisXs.length-1] - stockW)>1e-9) axisXs.push(stockW);
    const axisYs=[];
    for (let y=0;y<=gridH;y+=12) axisYs.push(y);
    if (Math.abs(axisYs[axisYs.length-1] - stockH)>1e-9) axisYs.push(stockH);

    const minorV=[];
    for (let x=1;x<gridW;x++) minorV.push(`<line x1="${stockX+x}" y1="${stockY}" x2="${stockX+x}" y2="${stockY+gridH}" />`);
    const minorH=[];
    for (let y=1;y<gridH;y++) minorH.push(`<line x1="${stockX}" y1="${stockY+y}" x2="${stockX+gridW}" y2="${stockY+y}" />`);
    const majorV=[];
    for (let x=0;x<=gridW;x+=12) majorV.push(`<line x1="${stockX+x}" y1="${stockY}" x2="${stockX+x}" y2="${stockY+gridH}" />`);
    const majorH=[];
    for (let y=0;y<=gridH;y+=12) majorH.push(`<line x1="${stockX}" y1="${stockY+y}" x2="${stockX+gridW}" y2="${stockY+y}" />`);

    const axisLabelsX = axisXs.map(x => `<text class="axis-text" x="${stockX+x}" y="${stockY-1.35}">${measurementTextNoQuote(x)}</text>`).join('');
    const axisLabelsY = axisYs.map(y => `<text class="axis-text left" x="${stockX-0.7}" y="${stockY+y}">${measurementTextNoQuote(y)}</text>`).join('');

    const offcut = [];
    if (usableW < stockW-1e-9) {
      offcut.push(`<rect class="offcut-zone" x="${stockX+usableW}" y="${stockY}" width="${stockW-usableW}" height="${stockH}" />`);
    }
    if (usableH < stockH-1e-9) {
      offcut.push(`<rect class="offcut-zone" x="${stockX}" y="${stockY+usableH}" width="${stockW}" height="${stockH-usableH}" />`);
    }

    const cutLines = (() => {
      if (isShearMaterial(material)) {
        return (bin.shearCuts||[]).map((c)=>{
          let x1,y1,x2,y2;
          if (c.axis==='x') {
            x1=x2=stockX+c.line;
            y1=stockY+c.region.y;
            y2=stockY+c.region.y+c.region.h;
          } else {
            y1=y2=stockY+c.line;
            x1=stockX+c.region.x;
            x2=stockX+c.region.x+c.region.w;
          }
          return `<line class="shear-cut-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
        }).join('');
      }

      // Cellulose and plywood are free-form nests. Show the actual internal
      // cut edges around each placed part. Edges already on the outside of
      // the usable stock do not need a cut line, and exact shared edges are
      // de-duplicated so the dotted path stays visually consistent.
      const eps=1e-7;
      const seen=new Set();
      const lines=[];
      const addLine=(x1,y1,x2,y2)=>{
        const ax=Math.round(x1*1000000)/1000000;
        const ay=Math.round(y1*1000000)/1000000;
        const bx=Math.round(x2*1000000)/1000000;
        const by=Math.round(y2*1000000)/1000000;
        const a=`${ax},${ay}`;
        const b=`${bx},${by}`;
        const key=a<b ? `${a}|${b}` : `${b}|${a}`;
        if (seen.has(key)) return;
        seen.add(key);
        lines.push(`<line class="shear-cut-line" x1="${stockX+ax}" y1="${stockY+ay}" x2="${stockX+bx}" y2="${stockY+by}" />`);
      };
      for (const u of bin.used) {
        if (u.x > eps) addLine(u.x,u.y,u.x,u.y+u.h);
        if (u.y > eps) addLine(u.x,u.y,u.x+u.w,u.y);
        if (u.x+u.w < usableW-eps) addLine(u.x+u.w,u.y,u.x+u.w,u.y+u.h);
        if (u.y+u.h < usableH-eps) addLine(u.x,u.y+u.h,u.x+u.w,u.y+u.h);
      }
      return lines.join('');
    })();

    const labels=bin.used.map((u,i)=>{
      const rawPartName=(u.item.label && u.item.label.trim()) ? u.item.label.trim() : `Part ${i+1}`;
      const partName=escapeHtml(rawPartName);
      const isCut=optimizerCutIds.has(String(u.item.uid));
      const product=PRODUCTS[u.item.productKey];
      const productColor=product.color || '#00D2FF';
      const partClass=isCut?'part cut':'part';
      const partStyle=isCut?'':`fill:${productColor};stroke:${productColor};`;
      const labelClass=isCut?'part-label cut-text':'part-label';
      const rx=stockX+u.x, ry=stockY+u.y;
      const cx=rx+u.w/2, cy=ry+u.h/2;
      const innerW=Math.max(.8,u.w-1.5);
      const innerH=Math.max(.8,u.h-1.35);
      // Keep the label upright relative to the physical part. A placement marked
      // rotated is treated as a consistent 90° clockwise part rotation, so the
      // label rotates with it and visually identifies the part's original top.
      const labelAvailableWidth=u.rotated ? innerH : innerW;
      const labelAvailableHeight=u.rotated ? innerW : innerH;
      let labelSize=fitSvgFontSize(rawPartName,labelAvailableWidth,4.4);
      labelSize=Math.min(labelSize,labelAvailableHeight*.78) * .95;
      const labelTransform=u.rotated ? ` transform="rotate(90 ${cx} ${cy})"` : '';
      return `<rect class="${partClass}" style="${partStyle}" x="${rx}" y="${ry}" width="${u.w}" height="${u.h}" rx=".45" /><text class="${labelClass}" style="font-size:${labelSize.toFixed(3)}px" x="${cx}" y="${cy}"${labelTransform}>${partName}</text>`;
    }).join('');

    return `<div class="sheet-visual"><svg class="sheet-svg" viewBox="0 0 ${totalW} ${totalH}" role="img" aria-label="Sheet nesting layout with one-inch grid; grain flows along the long horizontal sheet axis"><defs><clipPath id="${clipId}"><rect x="${stockX}" y="${stockY}" width="${stockW}" height="${stockH}" rx=".45" /></clipPath></defs><rect class="stock" x="${stockX}" y="${stockY}" width="${stockW}" height="${stockH}" rx=".45" /><g clip-path="url(#${clipId})"><g class="grid-minor">${minorV.join('')}${minorH.join('')}</g><g class="grid-major">${majorV.join('')}${majorH.join('')}</g>${offcut.join('')}</g><rect class="usable-boundary" x="${stockX}" y="${stockY}" width="${usableW}" height="${usableH}" rx=".45" />${cutLines}${labels}${axisLabelsX}${axisLabelsY}</svg></div>`;
  }

  function renderOptimizerOutput(results,scrollToResults=true) {
    const materialCards=[];
    const blocks=[];
    let totalSheets=0;
    for (const [materialKey,data] of Object.entries(results)) {
      const material=MATERIALS[materialKey];
      if (data.error) continue;
      const bins=data.bins;
      totalSheets += bins.length;
      const usedArea=bins.reduce((s,b)=>s+b.used.reduce((x,u)=>x+u.w*u.h,0),0);
      const usableArea=bins.length*material.usableL*material.usableW;
      const util=usableArea ? usedArea/usableArea*100 : 0;
      materialCards.push(`<div class="metric"><span>${escapeHtml(material.name)}</span><b>${bins.length} sheet${bins.length===1?'':'s'}</b><div class="subline">${measurementText(material.rawL)} × ${measurementText(material.rawW)} stock • ${util.toFixed(1)}% usable-area yield</div></div>`);

      const sheetCards=bins.map((bin,bi)=>{
        const area=bin.used.reduce((s,u)=>s+u.w*u.h,0);
        const pct=area/(material.usableL*material.usableW)*100;
        const cutRows=bin.used.map((u,i)=>{
          const p=PRODUCTS[u.item.productKey];
          const badge=partListBadge(u.item, `Part ${i+1}`);
          const isCut=optimizerCutIds.has(String(u.item.uid));
          return `<div class="sheet-cut${isCut?' is-cut':''}" style="--part-color:${p.color || '#00D2FF'}" data-part-uid="${escapeHtml(u.item.uid)}">
            <div class="sheet-cut-swatch" aria-hidden="true"></div>
            <div><strong>${escapeHtml(badge)} — Cut ${measurementText(u.item.cutWidth)} × ${measurementText(u.item.cutHeight)}</strong></div>
            <button class="cut-toggle-btn${isCut?' is-cut':''}" type="button" data-toggle-cut="${escapeHtml(u.item.uid)}">${isCut?'Mark Uncut':'Mark Cut'}</button>
          </div>`;
        }).join('');
        const sheetProductKeys=[...new Set(bin.used.map(u=>u.item.productKey))];
        const sheetHeaderColors=sheetProductKeys.map(key=>PRODUCTS[key].color || '#00D2FF');
        const sheetHeaderA=sheetHeaderColors[0] || '#00D2FF';
        const sheetHeaderB=sheetHeaderColors.length>1 ? sheetHeaderColors[1] : sheetHeaderA;
        return `<div class="sheet-card">
          <div class="sheet-head material-sheet-head" style="--sheet-color-a:${sheetHeaderA};--sheet-color-b:${sheetHeaderB}"><strong>Sheet ${bi+1}</strong><span class="badge">${bin.used.length} cut${bin.used.length===1?'':'s'} • ${pct.toFixed(1)}% used</span></div>
          <div class="sheet-body">
            ${renderSheetSvg(bin,material)}
            <div class="sheet-cuts">${cutRows}</div>
          </div>
        </div>`;
      }).join('');

      const productKeysOnMaterial=[...new Set(bins.flatMap(b=>b.used.map(u=>u.item.productKey)))];
      const colorLegend=`<div class="product-color-legend">${productKeysOnMaterial.map(key=>{const p=PRODUCTS[key];return `<span class="product-color-key"><i style="background:${p.color}"></i>${escapeHtml(p.shortName || p.name)}</span>`;}).join('')}</div>`;
      const materialHeaderColors=productKeysOnMaterial.map(key=>PRODUCTS[key].color || '#00D2FF');
      const materialHeaderA=materialHeaderColors[0] || '#00D2FF';
      const materialHeaderB=materialHeaderColors.length>1 ? materialHeaderColors[1] : materialHeaderA;

      blocks.push(`<section class="card material-block">
        <div class="result-head material-result-head" style="margin:-16px -16px 14px;border-radius:17px 17px 0 0;--material-color-a:${materialHeaderA};--material-color-b:${materialHeaderB}">
          <strong>${escapeHtml(material.name)}</strong>
          <span class="badge">${bins.length} sheet${bins.length===1?'':'s'}${data.minimumConfirmed?' • minimum confirmed':''}</span>
        </div>
        <div class="material-summary">
          <div class="metric"><span>Raw sheet</span><b>${measurementText(material.rawL)} × ${measurementText(material.rawW)}</b></div>
          <div class="metric"><span>Usable cut area</span><b>${measurementText(material.usableL)} × ${measurementText(material.usableW)}</b></div>
          <div class="metric"><span>Parts</span><b>${bins.reduce((s,b)=>s+b.used.length,0)}</b></div>
          <div class="metric"><span>Overall yield</span><b>${util.toFixed(1)}%</b></div>
        </div>
        ${colorLegend}
        <div class="sheet-list">${sheetCards}</div>
        <div class="material-warning">Part dimensions in the optimizer are Width × Height. The nesting diagram uses a true one-inch grid clipped to the exact physical stock dimensions. Coordinates are measured from the upper-left origin. <b>Grain flow follows the long horizontal sheet axis</b> — 0–120 on 120&quot; stock — not the 0–48 short axis. The green dashed boundary marks the exact usable cut area; shaded strips are outside the permitted cut size. ${isShearMaterial(material)?`<b>Shear constrained:</b> dotted orange lines depict full-edge shear-compatible divisions. The optimizer internally validates that no stopped/interior cut is required. `:`<b>Cut paths:</b> dotted orange lines trace the internal edges around the nested parts. `}${data.minimumConfirmed?`<b>Minimum confirmed:</b> this layout uses ${bins.length} sheet${bins.length===1?'':'s'} and exactly matches the universal calculated lower bound of ${data.lowerBound}, so fewer sheets are impossible.`:`<b>Best layout found:</b> ${bins.length} sheet${bins.length===1?'':'s'}. The universal calculated lower bound is ${data.lowerBound}. A layout at that lower bound was not found by the bounded search, so this result is not presented as a mathematical minimum.${data.searchTimedOut?' The deeper search reached its browser time limit.':''}`} No kerf or gap allowance is added.</div>
      </section>`);
    }
    optimizerMaterialTotals.innerHTML = `<div class="summary" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">${materialCards.join('')}</div><div class="note"><b>Total stock sheets:</b> ${totalSheets}. Different material types are counted separately and cannot share a sheet.</div>`;
    optimizerSheets.innerHTML=blocks.join('');
    optimizerResults.classList.add('show');
    if (scrollToResults) optimizerResults.scrollIntoView({behavior:'smooth',block:'start'});
  }

  const OPTIMIZER_WORKER_FUNCTIONS = [
    rectIntersects, splitFreeRects, pruneFreeRects, placementScore, lexLess,
    bestPlacementAcrossBins, deterministicShuffle, buildOrders, packWithOrder,
    bestGreedyPacking, itemOrientations, twoItemsCanShareSheet,
    incompatibilityCliqueLowerBound, exactCandidatePlacements, cloneBins,
    boundedBacktrackingPack, validatePackingGeometry, isShearMaterial,
    shearSplitOptions, shearCandidateScore, bestShearPlacementAcrossBins,
    applyShearPlacement, buildShearOrders, packShearWithOrder, bestShearPacking,
    cloneShearBins, exactShearCandidatePlacements, globalShearBacktrackingPack,
    sameRect, validateShearSequence, validateShearPacking,
    optimizeShearMaterialGroup, optimizeMaterialGroup
  ];

  function buildOptimizerWorkerSource() {
    const functionSource=OPTIMIZER_WORKER_FUNCTIONS.map(fn=>fn.toString()).join('\n\n');
    return `'use strict';\n${functionSource}\n\nself.onmessage = event => {\n  try {\n    const { groups, materials, allowRotate, runId } = event.data;\n    const results = {};\n    for (const [materialKey,items] of Object.entries(groups)) {\n      results[materialKey] = optimizeMaterialGroup(items,materials[materialKey],allowRotate);\n    }\n    self.postMessage({ ok:true, runId, results });\n  } catch (error) {\n    self.postMessage({ ok:false, runId, error:String(error && error.message || error) });\n  }\n};`;
  }

  function optimizeGroupsSynchronously(groups,allowRotate) {
    const results={};
    for (const [materialKey,items] of Object.entries(groups)) {
      results[materialKey]=optimizeMaterialGroup(items,MATERIALS[materialKey],allowRotate);
    }
    return results;
  }

  function optimizeGroupsInWorker(groups,allowRotate,runId) {
    return new Promise((resolve,reject)=>{
      if (typeof Worker==='undefined' || typeof Blob==='undefined' || !URL || typeof URL.createObjectURL!=='function') {
        try { resolve(optimizeGroupsSynchronously(groups,allowRotate)); }
        catch (error) { reject(error); }
        return;
      }
      if (optimizerWorker) {
        optimizerWorker.terminate();
        optimizerWorker=null;
        if (optimizerWorkerReject) optimizerWorkerReject(new Error('Optimizer run was superseded.'));
        optimizerWorkerReject=null;
      }
      let objectUrl='';
      try {
        const blob=new Blob([buildOptimizerWorkerSource()],{type:'text/javascript'});
        objectUrl=URL.createObjectURL(blob);
        const worker=new Worker(objectUrl);
        optimizerWorker=worker;
        optimizerWorkerReject=reject;
        URL.revokeObjectURL(objectUrl);
        objectUrl='';
        worker.onmessage=event=>{
          if (optimizerWorker===worker) optimizerWorker=null;
          optimizerWorkerReject=null;
          worker.terminate();
          const data=event.data || {};
          if (data.runId!==runId) return reject(new Error('Optimizer run was superseded.'));
          if (!data.ok) return reject(new Error(data.error || 'Optimizer worker failed.'));
          resolve(data.results);
        };
        worker.onerror=event=>{
          if (optimizerWorker===worker) optimizerWorker=null;
          optimizerWorkerReject=null;
          worker.terminate();
          try { resolve(optimizeGroupsSynchronously(groups,allowRotate)); }
          catch (fallbackError) { reject(fallbackError || new Error(event.message || 'Optimizer worker failed.')); }
        };
        worker.postMessage({groups,materials:MATERIALS,allowRotate,runId});
      } catch (error) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (optimizerWorker) { optimizerWorker.terminate(); optimizerWorker=null; }
        optimizerWorkerReject=null;
        // Some browsers restrict Blob workers for locally opened files. Keep the
        // calculator functional there, but use the same bounded core synchronously.
        try { resolve(optimizeGroupsSynchronously(groups,allowRotate)); }
        catch (fallbackError) { reject(fallbackError || error); }
      }
    });
  }

  async function runOptimizer(showCompletionStatus=true) {
    clearOptimizerStatus();
    if (!optimizerJob.length) {
      showOptimizerStatus('Add at least one part before optimizing.');
      return;
    }
    const groups=expandedOptimizerItems();
    const runId=++optimizerRunSerial;
    // Grain Flow Rotation OFF = free 90° nesting. ON = preserve entered Width × Height orientation.
    const allowRotate=!optimizerGrainFlowRotation.checked;
    showOptimizerStatus('Optimizing job… You can continue using the page while layouts are calculated.','ok');
    let results;
    try {
      results=await optimizeGroupsInWorker(groups,allowRotate,runId);
    } catch (error) {
      if (runId!==optimizerRunSerial) return;
      showOptimizerStatus(error && error.message==='Optimizer run was superseded.' ? 'Optimizer run replaced by a newer request.' : `The optimizer could not complete: ${error.message || error}`,'error');
      optimizerResults.classList.remove('show');
      return;
    }
    if (runId!==optimizerRunSerial) return;
    for (const [materialKey,result] of Object.entries(results)) {
      if (result.internalError) {
        showOptimizerStatus(`The optimizer stopped because its layout integrity check failed: ${result.internalError} No cut list was produced.`);
        optimizerResults.classList.remove('show');
        return;
      }
      if (result.error) {
        const item=result.error;
        const p=PRODUCTS[item.productKey];
        const m=MATERIALS[materialKey];
        const name=item.label ? `${item.label} (${p.name})` : p.name;
        const orientationNote=optimizerGrainFlowRotation.checked
          ? ' while Grain Flow Rotation is ON. Turn it OFF to allow free 90° nesting'
          : ' even with free 90° nesting';
        showOptimizerStatus(`${name} requires a ${measurementText(item.cutWidth)} W × ${measurementText(item.cutHeight)} H cut, which does not fit the ${measurementText(m.usableL)} × ${measurementText(m.usableW)} usable ${m.name} sheet${orientationNote}.`);
        optimizerResults.classList.remove('show');
        return;
      }
    }
    optimizerLastResults=results;
    renderOptimizerOutput(results);
    if (showCompletionStatus) {
      const grainMode=optimizerGrainFlowRotation.checked
        ? 'Grain Flow Rotation ON: entered Width × Height orientation was preserved.'
        : 'Grain Flow Rotation OFF: free 90° nesting was allowed.';
      showOptimizerStatus(`Whole-job optimization complete. ${grainMode} .063 Aluminum and ACP were constrained to full-edge shear-compatible layouts; other materials used free-form nesting. Minimum is only claimed when the result reaches the universal lower bound.`,'ok');
    }
    else clearOptimizerStatus();
  }

  function findOptimizerPhysicalPart(uid) {
    const groups=expandedOptimizerItems();
    for (const items of Object.values(groups)) {
      const found=items.find(item=>String(item.uid)===String(uid));
      if (found) return found;
    }
    return null;
  }

  function toggleOptimizerPartCut(uid) {
    const item=findOptimizerPhysicalPart(uid);
    if (!item) return;
    const isCut=optimizerCutIds.has(String(uid));
    const product=PRODUCTS[item.productKey];
    const base=item.label ? item.label : product.name;
    const row=optimizerJob.find(r=>r.id===item.rowId);
    const instanceText=row && row.qty>1 ? ` piece ${item.instance} of ${row.qty}` : '';
    const nextWord=isCut?'NOT CUT':'CUT';
    if (!window.confirm(`Mark ${base}${instanceText} as ${nextWord}?`)) return;
    if (isCut) optimizerCutIds.delete(String(uid)); else optimizerCutIds.add(String(uid));
    markOptimizerDirty();
    renderOptimizerJob();
    if (optimizerLastResults) renderOptimizerOutput(optimizerLastResults,false);
    showOptimizerJobStatus(`${base}${instanceText} marked ${isCut?'not cut':'cut'}. Save the Job # to keep this status.`,'ok');
  }

  optimizerSheets.addEventListener('click',e=>{
    const btn=e.target.closest('[data-toggle-cut]');
    if (!btn) return;
    toggleOptimizerPartCut(btn.dataset.toggleCut);
  });

  function clearOptimizerJob() {
    if ((optimizerJob.length || optimizerDirty) && !window.confirm('Clear the current optimizer job and all cut-status marks? Unsaved changes will be discarded.')) return;
    optimizerRunSerial++;
    if (optimizerWorker) { optimizerWorker.terminate(); optimizerWorker=null; }
    if (optimizerWorkerReject) optimizerWorkerReject(new Error('Optimizer run was superseded.'));
    optimizerWorkerReject=null;
    optimizerJob=[];
    optimizerNextId=1;
    optimizerCutIds=new Set();
    optimizerLastResults=null;
    optimizerLoadedJobNumber='';
    optimizerDirty=false;
    optimizerGrainFlowRotation.checked=false;
    optimizerJobNumber.value='';
    optimizerSavedJobs.value='';
    optimizerResults.classList.remove('show');
    optimizerSheets.innerHTML='';
    optimizerMaterialTotals.innerHTML='';
    clearOptimizerStatus();
    clearOptimizerJobStatus();
    updateActiveJobChip();
    renderOptimizerJob();
  }


  optimizerProduct.addEventListener('change', updateOptimizerRulePreview);
  optimizerCopySource.addEventListener('change',()=>{ clearOptimizerCopyStatus(); updateOptimizerCopyControls(); });
  optimizerCopyTarget.addEventListener('change',()=>{ clearOptimizerCopyStatus(); optimizerCopyBtn.textContent=optimizerCopyTarget.value ? `Copy to ${PRODUCTS[optimizerCopyTarget.value].shortName}` : 'Copy Entire List'; });
  optimizerCopyBtn.addEventListener('click',copyOptimizerProductList);
  document.getElementById('optimizerAddBtn').addEventListener('click', addOptimizerPart);
  document.getElementById('optimizerRunBtn').addEventListener('click', ()=>runOptimizer(true));
  document.getElementById('optimizerClearBtn').addEventListener('click', clearOptimizerJob);
  document.getElementById('optimizerSaveJobBtn').addEventListener('click', saveOptimizerJob);
  document.getElementById('optimizerLoadJobBtn').addEventListener('click', loadOptimizerJob);
  document.getElementById('optimizerDeleteJobBtn').addEventListener('click', deleteOptimizerSavedJob);
  document.getElementById('optimizerExportJobBtn').addEventListener('click', exportOptimizerJob);
  document.getElementById('optimizerImportJobBtn').addEventListener('click', ()=>optimizerImportFile.click());
  optimizerImportFile.addEventListener('change',()=>importOptimizerJobFile(optimizerImportFile.files && optimizerImportFile.files[0]));
  optimizerJobNumber.addEventListener('input',()=>{ optimizerSavedJobs.value=''; markOptimizerDirty(); });
  optimizerSavedJobs.addEventListener('change',()=>{ clearOptimizerJobStatus(); });
  [optimizerWidth,optimizerHeight,optimizerQty].forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter') addOptimizerPart();}));
  optimizerGrainFlowRotation.addEventListener('change',()=>{ markOptimizerDirty(); if (optimizerResults.classList.contains('show')) runOptimizer(false); });
  window.addEventListener('beforeunload',e=>{
    if (!optimizerDirty) return;
    e.preventDefault();
    e.returnValue='';
  });

  optimizerGrainFlowRotation.checked=false;
  updateOptimizerRulePreview();
  refreshSavedOptimizerJobs();
  updateActiveJobChip();
  renderOptimizerJob();


  calculateOverhang();
