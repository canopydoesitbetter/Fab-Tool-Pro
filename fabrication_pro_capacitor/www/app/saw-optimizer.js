  // ---------------- Saw optimizer ----------------
  const SAW_KERF = 0.25;
  const MAX_SAW_PIECES = 500;
  const MAX_SAW_ROWS = 150;
  const MAX_SAW_TUBE_LENGTH = 10000;
  const SAW_JOB_FILE_VERSION = 1;
  const MAX_SAW_IMPORT_BYTES = 2 * 1024 * 1024;
  const sawTubeLength = document.getElementById('sawTubeLength');
  const sawPartLabel = document.getElementById('sawPartLabel');
  const sawPartLength = document.getElementById('sawPartLength');
  const sawPartQty = document.getElementById('sawPartQty');
  const sawStatus = document.getElementById('sawStatus');
  const sawPartList = document.getElementById('sawPartList');
  const sawCutListMenuBtn = document.getElementById('sawCutListMenuBtn');
  const sawCutListDrawer = document.getElementById('sawCutListDrawer');
  const sawCutListBackdrop = document.getElementById('sawCutListBackdrop');
  const sawCutListCloseBtn = document.getElementById('sawCutListCloseBtn');
  const sawCutListMeta = document.getElementById('sawCutListMeta');
  const sawCutListDrawerMeta = document.getElementById('sawCutListDrawerMeta');
  const sawResults = document.getElementById('sawResults');
  const sawSummary = document.getElementById('sawSummary');
  const sawOptimizationNote = document.getElementById('sawOptimizationNote');
  const sawTubeResults = document.getElementById('sawTubeResults');
  const sawExportJobBtn = document.getElementById('sawExportJobBtn');
  const sawImportJobBtn = document.getElementById('sawImportJobBtn');
  const sawImportFile = document.getElementById('sawImportFile');
  const sawJobFileStatus = document.getElementById('sawJobFileStatus');
  let sawJob = [];
  let sawNextId = 1;
  let sawCutIds = new Set();
  let sawLastResult = null;
  let sawLastTubeLength = NaN;

  function showSawStatus(message,type='error') {
    sawStatus.textContent=message;
    sawStatus.className=`status show ${type}`;
  }

  function clearSawStatus() {
    sawStatus.textContent='';
    sawStatus.className='status';
  }

  function sawPhysicalPieceCount(parts=sawJob) {
    return parts.reduce((sum,row)=>sum+Number(row.qty || 0),0);
  }

  function showSawJobFileStatus(message,type='ok') {
    sawJobFileStatus.textContent=message;
    sawJobFileStatus.className=`status show ${type}`;
  }

  function clearSawJobFileStatus() {
    sawJobFileStatus.textContent='';
    sawJobFileStatus.className='status';
  }

  function validSawPhysicalUids(parts) {
    const valid=new Set();
    for (const row of parts) for (let i=1;i<=row.qty;i++) valid.add(`${row.id}-${i}`);
    return valid;
  }

  function serializeSawJob() {
    const tubeLength=parseShopMeasurement(sawTubeLength.value);
    return {
      format:'FabricationSawOptimizerJob',
      version:SAW_JOB_FILE_VERSION,
      savedAt:new Date().toISOString(),
      tubeLength,
      kerf:SAW_KERF,
      nextId:sawNextId,
      parts:sawJob.map(row=>({
        id:row.id,
        label:row.label || '',
        length:row.length,
        qty:row.qty
      })),
      cutPartIds:Array.from(sawCutIds).sort()
    };
  }

  function normalizeSawJobRecord(raw) {
    const data=raw && raw.fabricationSawOptimizerJob ? raw.fabricationSawOptimizerJob : raw;
    if (!data || typeof data!=='object' || Array.isArray(data)) throw new Error('The file does not contain a valid Saw Optimizer job.');
    if (data.format && data.format!=='FabricationSawOptimizerJob') throw new Error('This JSON file is not a Saw Optimizer job.');
    const version=data.version == null ? 1 : Number(data.version);
    if (!Number.isInteger(version) || version<1) throw new Error('The Saw Optimizer job file has an invalid version number.');
    if (version>SAW_JOB_FILE_VERSION) throw new Error('This Saw Optimizer job was created by a newer version of Fabrication Calculators and cannot be safely imported here.');
    const tubeLength=Number(data.tubeLength);
    if (!Number.isFinite(tubeLength) || tubeLength<=0 || tubeLength>MAX_SAW_TUBE_LENGTH) throw new Error(`The Saw Optimizer job has an invalid tube length. It must be greater than 0 and no more than ${MAX_SAW_TUBE_LENGTH} inches.`);
    const kerf=Number(data.kerf ?? SAW_KERF);
    if (!Number.isFinite(kerf) || Math.abs(kerf-SAW_KERF)>1e-9) throw new Error('This Saw Optimizer job uses a different kerf rule. This version requires a fixed 1/4 inch kerf between adjacent pieces.');
    if (!Array.isArray(data.parts)) throw new Error('The Saw Optimizer job is missing its parts list.');
    if (data.parts.length>MAX_SAW_ROWS) throw new Error(`The Saw Optimizer job contains more than ${MAX_SAW_ROWS} part rows.`);

    const ids=new Set();
    const parts=data.parts.map((row,index)=>{
      if (!row || typeof row!=='object' || Array.isArray(row)) throw new Error(`Saw part ${index+1} is invalid.`);
      const id=Number(row.id);
      const length=Number(row.length);
      const qty=Number(row.qty);
      const label=String(row.label || '').trim();
      if (!Number.isInteger(id) || id<1 || ids.has(id)) throw new Error(`Saw part ${index+1} has an invalid or duplicate ID.`);
      if (!Number.isFinite(length) || length<=0 || length>MAX_SAW_TUBE_LENGTH) throw new Error(`Saw part ${index+1} has an invalid length.`);
      if (!Number.isInteger(qty) || qty<1 || qty>500) throw new Error(`Saw part ${index+1} has an invalid quantity.`);
      if (label.length>MAX_OPTIMIZER_LABEL_LENGTH) throw new Error(`Saw part ${index+1} label exceeds ${MAX_OPTIMIZER_LABEL_LENGTH} characters.`);
      ids.add(id);
      return {id,label,length,qty};
    });
    const total=sawPhysicalPieceCount(parts);
    if (total>MAX_SAW_PIECES) throw new Error(`The Saw Optimizer job contains ${total} pieces; the limit is ${MAX_SAW_PIECES}.`);
    const validUids=validSawPhysicalUids(parts);
    const rawCutIds=Array.isArray(data.cutPartIds) ? data.cutPartIds.map(String) : [];
    const cutPartIds=[];
    const seenCutIds=new Set();
    for (const uid of rawCutIds) {
      if (!validUids.has(uid)) throw new Error(`The Saw Optimizer job contains an invalid cut-status part ID: ${uid}.`);
      if (!seenCutIds.has(uid)) { seenCutIds.add(uid); cutPartIds.push(uid); }
    }
    const maxId=parts.reduce((max,row)=>Math.max(max,row.id),0);
    const requestedNextId=Number(data.nextId);
    return {
      format:'FabricationSawOptimizerJob',
      version:SAW_JOB_FILE_VERSION,
      savedAt:typeof data.savedAt==='string' ? data.savedAt : new Date().toISOString(),
      tubeLength,
      kerf:SAW_KERF,
      nextId:Math.max(maxId+1,Number.isInteger(requestedNextId)&&requestedNextId>0 ? requestedNextId : 1),
      parts,
      cutPartIds
    };
  }

  function applySawJobRecord(record) {
    sawJob=record.parts.map(row=>({...row}));
    sawNextId=record.nextId;
    sawCutIds=new Set(record.cutPartIds || []);
    sawTubeLength.value=measurementTextNoQuote(record.tubeLength);
    sawLastResult=null;
    sawLastTubeLength=NaN;
    sawPartLabel.value='';
    sawPartLength.value='';
    sawPartQty.value='1';
    sawResults.classList.remove('show');
    sawSummary.innerHTML='';
    sawTubeResults.innerHTML='';
    clearSawStatus();
    renderSawJob();
  }

  function exportSawJob() {
    clearSawJobFileStatus();
    const tubeLength=parseShopMeasurement(sawTubeLength.value);
    if (!Number.isFinite(tubeLength) || tubeLength<=0 || tubeLength>MAX_SAW_TUBE_LENGTH) {
      showSawJobFileStatus(`Enter a valid tube length greater than 0 and no more than ${MAX_SAW_TUBE_LENGTH} inches before exporting.`,'error');
      sawTubeLength.focus();
      return;
    }
    if (!sawJob.length) {
      showSawJobFileStatus('Add at least one saw part before exporting the job.','error');
      return;
    }
    const payload={fabricationSawOptimizerJob:serializeSawJob()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='Saw-Optimizer-Job.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    showSawJobFileStatus(`Saw job exported with ${sawPhysicalPieceCount()} piece${sawPhysicalPieceCount()===1?'':'s'} and all current cut-status marks.`,'ok');
  }

  function importSawJobFile(file) {
    if (!file) return;
    if (file.size>MAX_SAW_IMPORT_BYTES) {
      showSawJobFileStatus(`That Saw Optimizer job file is too large. Maximum import size is ${Math.round(MAX_SAW_IMPORT_BYTES/1024/1024)} MB.`,'error');
      sawImportFile.value='';
      return;
    }
    clearSawJobFileStatus();
    const reader=new FileReader();
    reader.onload=async ()=>{
      try {
        const parsed=JSON.parse(String(reader.result || ''));
        const record=normalizeSawJobRecord(parsed);
        if ((sawJob.length || sawCutIds.size) && !await confirmAppAction('Import this Saw Optimizer job and replace the current saw job?')) return;
        applySawJobRecord(record);
        showSawJobFileStatus(`Saw job imported with ${sawPhysicalPieceCount()} piece${sawPhysicalPieceCount()===1?'':'s'}. Press Optimize Job to calculate the tube layout.`,'ok');
      } catch (error) {
        showSawJobFileStatus(error.message || 'Unable to import that Saw Optimizer job file.','error');
      } finally {
        sawImportFile.value='';
      }
    };
    reader.onerror=()=>{
      showSawJobFileStatus('The selected Saw Optimizer job file could not be read.','error');
      sawImportFile.value='';
    };
    reader.readAsText(file);
  }

  function renderSawJob() {
    const total=sawPhysicalPieceCount();
    sawCutListMeta.textContent=total;
    sawCutListDrawerMeta.textContent=`${total} piece${total===1?'':'s'}`;
    if (!sawJob.length) {
      sawPartList.innerHTML='<div class="optimizer-empty">No saw parts added yet.</div>';
      return;
    }
    sawPartList.innerHTML=sawJob.map((row,index)=>{
      const label=row.label || `${measurementText(row.length)} part`;
      let cutCount=0;
      for (let i=1;i<=row.qty;i++) if (sawCutIds.has(`${row.id}-${i}`)) cutCount++;
      const allCut=cutCount===row.qty && row.qty>0;
      return `<div class="saw-part-row${allCut?' all-cut':''}">
        <div class="saw-part-index">${index+1}</div>
        <div><strong>${escapeHtml(label)} × ${row.qty}</strong><small>${measurementText(row.length)} each</small><span class="saw-part-cut-summary">${cutCount} of ${row.qty} cut</span></div>
        <button class="icon-btn" type="button" aria-label="Remove saw part" data-remove-saw="${row.id}">×</button>
      </div>`;
    }).join('');
  }

  function setSawCutListDrawerOpen(open) {
    if (open) openDrawer('sawCutListDrawer',document.activeElement); else closeDrawer('sawCutListDrawer');
    sawCutListMenuBtn.setAttribute('aria-expanded',open?'true':'false');
  }

  sawCutListMenuBtn.addEventListener('click',()=>{
    setSawCutListDrawerOpen(!sawCutListDrawer.classList.contains('open'));
  });
  sawCutListCloseBtn.addEventListener('click',()=>setSawCutListDrawerOpen(false));
  sawCutListBackdrop.addEventListener('click',()=>setSawCutListDrawerOpen(false));
  document.addEventListener('keydown',e=>{
    if (e.key==='Escape' && sawCutListDrawer.classList.contains('open')) setSawCutListDrawerOpen(false);
  });


  function addSawPart() {
    clearSawStatus();
    const length=parseShopMeasurement(sawPartLength.value);
    const qty=Number(sawPartQty.value);
    const label=sawPartLabel.value.trim();
    if (!Number.isFinite(length) || length<=0) {
      showSawStatus('Enter a valid part length. Decimals and shop fractions such as 46 3/4 are accepted.');
      return;
    }
    if (!Number.isInteger(qty) || qty<1 || qty>500) {
      showSawStatus('Quantity must be a whole number from 1 through 500.');
      return;
    }
    if (label.length>MAX_OPTIMIZER_LABEL_LENGTH) {
      showSawStatus(`Part labels are limited to ${MAX_OPTIMIZER_LABEL_LENGTH} characters.`);
      return;
    }
    if (sawJob.length>=MAX_SAW_ROWS) {
      showSawStatus(`This saw job has reached the ${MAX_SAW_ROWS}-row limit.`);
      return;
    }
    if (sawPhysicalPieceCount()+qty>MAX_SAW_PIECES) {
      showSawStatus(`This addition would exceed the ${MAX_SAW_PIECES}-piece saw optimizer limit.`);
      return;
    }
    sawJob.push({id:sawNextId++,label,length,qty});
    sawPartLength.value='';
    sawPartQty.value='1';
    sawPartLabel.value='';
    sawLastResult=null;
    sawLastTubeLength=NaN;
    sawResults.classList.remove('show');
    renderSawJob();
    sawPartLength.focus();
  }

  function expandedSawItems() {
    const items=[];
    for (const row of sawJob) {
      for (let i=1;i<=row.qty;i++) {
        items.push({uid:`${row.id}-${i}`,rowId:row.id,instance:i,label:row.label,length:row.length,size:row.length+SAW_KERF});
      }
    }
    return items;
  }

  function greedySawPacking(items,capacity) {
    const sorted=items.slice().sort((a,b)=>b.size-a.size || String(a.uid).localeCompare(String(b.uid)));
    const bins=[];
    for (const item of sorted) {
      let bestIndex=-1;
      let bestRemaining=Infinity;
      for (let i=0;i<bins.length;i++) {
        const next=bins[i].remaining-item.size;
        if (next>=-1e-9 && next<bestRemaining-1e-9) {
          bestRemaining=next;
          bestIndex=i;
        }
      }
      if (bestIndex<0) bins.push({remaining:capacity-item.size,items:[item]});
      else {
        bins[bestIndex].remaining-=item.size;
        bins[bestIndex].items.push(item);
      }
    }
    return bins;
  }

  function exactSawPacking(items,capacity,binCount,deadlineMs) {
    const ordered=items.slice().sort((a,b)=>b.size-a.size || String(a.uid).localeCompare(String(b.uid)));
    const remaining=Array(binCount).fill(capacity);
    const bins=Array.from({length:binCount},()=>[]);
    const suffix=new Array(ordered.length+1).fill(0);
    for (let i=ordered.length-1;i>=0;i--) suffix[i]=suffix[i+1]+ordered[i].size;
    let nodes=0,timedOut=false;

    function search(depth) {
      if ((++nodes & 1023)===0 && performance.now()>deadlineMs) { timedOut=true; return false; }
      if (depth===ordered.length) return true;
      const totalFree=remaining.reduce((sum,r)=>sum+r,0);
      if (suffix[depth]>totalFree+1e-9) return false;
      const item=ordered[depth];
      let maxFree=0;
      for (const r of remaining) if (r>maxFree) maxFree=r;
      if (item.size>maxFree+1e-9) return false;

      const choices=Array.from({length:binCount},(_,i)=>i)
        .filter(i=>item.size<=remaining[i]+1e-9)
        .sort((a,b)=>(remaining[a]-item.size)-(remaining[b]-item.size));
      const seenRemaining=new Set();
      for (const i of choices) {
        const key=remaining[i].toFixed(8);
        if (seenRemaining.has(key)) continue;
        seenRemaining.add(key);
        const wasEmpty=Math.abs(remaining[i]-capacity)<1e-9;
        remaining[i]-=item.size;
        bins[i].push(item);
        if (search(depth+1)) return true;
        bins[i].pop();
        remaining[i]+=item.size;
        if (timedOut) return false;
        if (wasEmpty) break;
      }
      return false;
    }

    const found=search(0);
    if (!found) return {bins:null,timedOut,nodes};
    return {
      bins:bins.map((list,i)=>({items:list.slice(),remaining:remaining[i]})).filter(b=>b.items.length),
      timedOut:false,nodes
    };
  }

  function optimizeSawItems(items,tubeLength) {
    const capacity=tubeLength+SAW_KERF;
    for (const item of items) if (item.length>tubeLength+1e-9) return {error:item};
    let best=greedySawPacking(items,capacity);
    const totalSize=items.reduce((sum,item)=>sum+item.size,0);
    const lowerBound=Math.max(1,Math.ceil(totalSize/capacity-1e-12));
    let minimumConfirmed=best.length===lowerBound;
    let searchTimedOut=false;
    let exactSearchUsed=false;

    if (!minimumConfirmed && items.length<=80) {
      const budget=items.length<=30?3000:items.length<=50?1800:900;
      const deadline=performance.now()+budget;
      for (let count=lowerBound;count<best.length;count++) {
        exactSearchUsed=true;
        if (performance.now()>deadline) { searchTimedOut=true; break; }
        const attempt=exactSawPacking(items,capacity,count,deadline);
        if (attempt.bins) {
          best=attempt.bins;
          minimumConfirmed=true;
          break;
        }
        if (attempt.timedOut) { searchTimedOut=true; break; }
      }
    }

    // Restore physical leftover. The transformed capacity contains one kerf
    // credit per tube, exactly matching kerf only between adjacent pieces.
    const bins=best.map(bin=>{
      const itemLength=bin.items.reduce((sum,item)=>sum+item.length,0);
      const kerfLoss=Math.max(0,bin.items.length-1)*SAW_KERF;
      const offcut=Math.max(0,tubeLength-itemLength-kerfLoss);
      return {items:bin.items.slice(),itemLength,kerfLoss,offcut};
    });
    return {bins,lowerBound,minimumConfirmed,searchTimedOut,exactSearchUsed};
  }

  function sawRulerMarkup(tubeLength) {
    const ticks=[0,.25,.5,.75,1];
    return `<div class="saw-ruler" aria-hidden="true">${ticks.map((ratio,index)=>{
      const cls=index===0?' start':index===ticks.length-1?' end':'';
      return `<span class="saw-ruler-tick${cls}" style="left:${ratio*100}%"><b>${measurementText(tubeLength*ratio)}</b></span>`;
    }).join('')}</div>`;
  }

  function renderSawOutput(result,tubeLength,scrollToResults=true) {
    const bins=result.bins;
    const totalPartLength=bins.reduce((sum,b)=>sum+b.itemLength,0);
    const totalKerf=bins.reduce((sum,b)=>sum+b.kerfLoss,0);
    const totalOffcut=bins.reduce((sum,b)=>sum+b.offcut,0);
    const stockTotal=bins.length*tubeLength;
    const partYield=stockTotal ? totalPartLength/stockTotal*100 : 0;

    sawSummary.innerHTML=`
      <div class="metric"><span>Tubes required</span><b>${bins.length}</b><div class="subline">${measurementText(tubeLength)} stock length</div></div>
      <div class="metric"><span>Finished parts</span><b>${measurementText(totalPartLength)}</b><div class="subline">${partYield.toFixed(1)}% part yield</div></div>
      <div class="metric"><span>Kerf loss</span><b>${measurementText(totalKerf)}</b><div class="subline">1/4&quot; between adjacent pieces</div></div>
      <div class="metric"><span>Total offcut</span><b>${measurementText(totalOffcut)}</b><div class="subline">Remaining reusable/scrap length</div></div>`;

    if (result.minimumConfirmed) {
      sawOptimizationNote.innerHTML=`<b>Minimum confirmed:</b> ${bins.length} tube${bins.length===1?'':'s'} is the minimum for this job under the 1/4&quot; between-piece kerf rule. The optimizer ${bins.length===result.lowerBound?'reached the calculated lower bound':'completed an exhaustive 1-D packing search for all smaller tube counts'}.`;
    } else {
      sawOptimizationNote.innerHTML=`<b>Best layout found:</b> ${bins.length} tube${bins.length===1?'':'s'}. The calculated lower bound is ${result.lowerBound}. This large/complex job is not being presented as a mathematically proven minimum.${result.searchTimedOut?' The deeper exact search reached its browser time budget.':''}`;
    }

    sawTubeResults.innerHTML=bins.map((bin,bi)=>{
      const parts=bin.items.slice();
      let cursor=0;
      const positioned=parts.map((item,index)=>{
        const start=cursor;
        const end=start+item.length;
        const kerfStart=end;
        const kerfEnd=index<parts.length-1 ? end+SAW_KERF : end;
        cursor=kerfEnd;
        return {item,index,start,end,kerfStart,kerfEnd};
      });
      const bar=[];
      positioned.forEach(({item,index})=>{
        const piecePct=Math.max(0,item.length/tubeLength*100);
        const display=item.label || `${measurementText(item.length)} part`;
        const isCut=sawCutIds.has(String(item.uid));
        bar.push(`<div class="saw-bar-piece${isCut?' is-cut':''}" style="flex:0 0 ${piecePct.toFixed(8)}%" title="${escapeHtml(display)} — ${measurementText(item.length)}${isCut?' — CUT':''}"><span class="saw-piece-name">${escapeHtml(display)}</span><span class="saw-piece-length">${measurementText(item.length)}</span></div>`);
        if (index<parts.length-1) {
          const kerfPct=SAW_KERF/tubeLength*100;
          bar.push(`<div class="saw-bar-kerf" style="flex:0 0 ${kerfPct.toFixed(8)}%" title="1/4 inch kerf" aria-label="1/4 inch kerf"></div>`);
        }
      });
      if (bin.offcut>1e-9) {
        const offcutPct=bin.offcut/tubeLength*100;
        bar.push(`<div class="saw-bar-offcut" style="flex:0 0 ${offcutPct.toFixed(8)}%" title="Offcut ${measurementText(bin.offcut)}"><span>OFFCUT</span><b>${measurementText(bin.offcut)}</b></div>`);
      }
      const cutRows=positioned.map(({item,index})=>{
        const name=item.label || `Part ${index+1}`;
        const isCut=sawCutIds.has(String(item.uid));
        return `<div class="saw-cut-row${isCut?' is-cut':''}" data-saw-part-uid="${escapeHtml(item.uid)}"><strong>${escapeHtml(name)} — Cut ${measurementText(item.length)}</strong><button class="saw-cut-toggle-btn${isCut?' is-cut':''}" type="button" data-toggle-saw-cut="${escapeHtml(item.uid)}">${isCut?'Mark Uncut':'Mark Cut'}</button></div>`;
      }).join('');
      const used=bin.itemLength+bin.kerfLoss;
      const cutCount=parts.filter(item=>sawCutIds.has(String(item.uid))).length;
      return `<section class="saw-tube-card">
        <div class="saw-tube-head"><strong>Tube ${bi+1} • ${measurementText(tubeLength)} stock</strong><span class="badge">${cutCount}/${parts.length} cut • ${measurementText(bin.offcut)} offcut</span></div>
        <div class="saw-tube-body">
          ${sawRulerMarkup(tubeLength)}
          <div class="saw-bar" role="img" aria-label="Tube ${bi+1}: ${measurementText(used)} used including kerf, ${measurementText(bin.offcut)} offcut">${bar.join('')}</div>
          <div class="saw-tube-detail-grid">
            <div class="metric"><span>Stock length</span><b>${measurementText(tubeLength)}</b></div>
            <div class="metric"><span>Part length</span><b>${measurementText(bin.itemLength)}</b></div>
            <div class="metric"><span>Kerf loss</span><b>${measurementText(bin.kerfLoss)}</b></div>
            <div class="metric"><span>Offcut starts</span><b>${measurementText(used)}</b><div class="subline">${measurementText(bin.offcut)} remains</div></div>
          </div>
          <div class="saw-cut-order">${cutRows}</div>
        </div>
      </section>`;
    }).join('');
    sawResults.classList.add('show');
    if (scrollToResults) sawResults.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function runSawOptimizer() {
    clearSawStatus();
    const tubeLength=parseShopMeasurement(sawTubeLength.value);
    if (!Number.isFinite(tubeLength) || tubeLength<=0 || tubeLength>MAX_SAW_TUBE_LENGTH) {
      showSawStatus(`Enter a valid tube length greater than 0 and no more than ${MAX_SAW_TUBE_LENGTH} inches.`);
      return;
    }
    if (!sawJob.length) {
      showSawStatus('Add at least one saw part before optimizing.');
      return;
    }
    const items=expandedSawItems();
    const result=optimizeSawItems(items,tubeLength);
    if (result.error) {
      const name=result.error.label || 'A part';
      showSawStatus(`${name} is ${measurementText(result.error.length)} long and does not fit the ${measurementText(tubeLength)} stock tube.`);
      sawResults.classList.remove('show');
      sawLastResult=null;
      sawLastTubeLength=NaN;
      return;
    }
    sawLastResult=result;
    sawLastTubeLength=tubeLength;
    renderSawOutput(result,tubeLength,true);
    showSawStatus(`Saw job optimized with a fixed 1/4&quot; kerf between adjacent pieces. Entry order was ignored and parts were regrouped to reduce stock usage.`,'ok');
  }

  function findSawPhysicalPart(uid) {
    return expandedSawItems().find(item=>String(item.uid)===String(uid)) || null;
  }

  async function toggleSawPartCut(uid) {
    const item=findSawPhysicalPart(uid);
    if (!item) return;
    const isCut=sawCutIds.has(String(uid));
    const row=sawJob.find(r=>r.id===item.rowId);
    const base=item.label || `${measurementText(item.length)} part`;
    const instanceText=row && row.qty>1 ? ` piece ${item.instance} of ${row.qty}` : '';
    const nextWord=isCut?'NOT CUT':'CUT';
    if (!await confirmAppAction(`Mark ${base}${instanceText} as ${nextWord}?`)) return;
    if (isCut) sawCutIds.delete(String(uid)); else sawCutIds.add(String(uid));
    renderSawJob();
    if (sawLastResult && Number.isFinite(sawLastTubeLength)) renderSawOutput(sawLastResult,sawLastTubeLength,false);
    showSawStatus(`${base}${instanceText} marked ${isCut?'not cut':'cut'}.`,'ok');
  }

  async function clearSawJob() {
    if (sawJob.length && !await confirmAppAction('Clear the current saw job, cut-status marks, and optimized layout?')) return;
    sawJob=[];
    sawNextId=1;
    sawCutIds=new Set();
    sawLastResult=null;
    sawLastTubeLength=NaN;
    sawPartLabel.value='';
    sawPartLength.value='';
    sawPartQty.value='1';
    sawResults.classList.remove('show');
    sawSummary.innerHTML='';
    sawTubeResults.innerHTML='';
    clearSawStatus();
    clearSawJobFileStatus();
    renderSawJob();
  }

  sawPartList.addEventListener('click',e=>{
    const btn=e.target.closest('[data-remove-saw]');
    if (!btn) return;
    const id=Number(btn.dataset.removeSaw);
    sawJob=sawJob.filter(row=>row.id!==id);
    for (const uid of Array.from(sawCutIds)) if (uid.startsWith(`${id}-`)) sawCutIds.delete(uid);
    sawLastResult=null;
    sawLastTubeLength=NaN;
    sawResults.classList.remove('show');
    renderSawJob();
  });
  sawTubeResults.addEventListener('click',e=>{
    const btn=e.target.closest('[data-toggle-saw-cut]');
    if (!btn) return;
    toggleSawPartCut(btn.dataset.toggleSawCut);
  });
  document.getElementById('sawAddPartBtn').addEventListener('click',addSawPart);
  document.getElementById('sawOptimizeBtn').addEventListener('click',runSawOptimizer);
  document.getElementById('sawClearBtn').addEventListener('click',clearSawJob);
  sawExportJobBtn.addEventListener('click',exportSawJob);
  sawImportJobBtn.addEventListener('click',()=>sawImportFile.click());
  sawImportFile.addEventListener('change',()=>importSawJobFile(sawImportFile.files && sawImportFile.files[0]));
  [sawPartLength,sawPartQty].forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter') addSawPart();}));
  sawTubeLength.addEventListener('keydown',e=>{if(e.key==='Enter') runSawOptimizer();});
  sawTubeLength.addEventListener('input',()=>{
    if (!sawLastResult) return;
    sawLastResult=null;
    sawLastTubeLength=NaN;
    sawResults.classList.remove('show');
    clearSawStatus();
  });
  renderSawJob();

