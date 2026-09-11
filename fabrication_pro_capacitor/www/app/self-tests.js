  function runFabricationSelfTests() {
    const checks=[];
    const check=(name,condition,detail='')=>checks.push({name,pass:!!condition,detail:condition?'':detail});
    try {
      const taskTimerFixture={accumulatedMs:60000,running:true,startedAt:1000};
      check('Task Logging running timer derives elapsed time from timestamp',taskLogElapsedMs(taskTimerFixture,61000)===120000);
      const taskPresetFixture=normalizeTaskLogPresetsRecord({
        format:TASK_LOG_PRESETS_FORMAT,version:1,nextPresetId:3,
        presets:[{id:1,name:'Frame Fabrication'},{id:2,name:'Exterior Panels'}]
      });
      check('Task Logging preset import preserves independent preset library',taskPresetFixture.presets.length===2 && taskPresetFixture.presets[1].name==='Exterior Panels');
      const taskJobsFixture=normalizeTaskLogJobsRecord({
        format:TASK_LOG_JOBS_FORMAT,version:1,exportedAt:'2026-01-01T10:30:00.000Z',activeJobId:1,nextJobId:2,nextTaskId:2,
        jobs:[{id:1,title:'26-TEST',tasks:[{id:1,presetId:1,name:'Frame Fabrication',accumulatedMs:60000,running:true,startedAt:Date.parse('2026-01-01T10:00:00.000Z'),sessions:[]}]}]
      });
      check('Task Logging job import preserves running timestamp before transfer normalization',taskJobsFixture.jobs[0].tasks[0].running===true && taskJobsFixture.jobs[0].tasks[0].startedAt===Date.parse('2026-01-01T10:00:00.000Z'));
      const finalizedCount=finalizeImportedRunningTaskLogJobs(taskJobsFixture);
      check('Task Logging import stops running backup at export timestamp',finalizedCount===1 && taskJobsFixture.jobs[0].tasks[0].running===false && taskJobsFixture.jobs[0].tasks[0].accumulatedMs===1860000);
      check('Task Logging imported running session is retained for audit',taskJobsFixture.jobs[0].tasks[0].sessions.length===1 && taskJobsFixture.jobs[0].tasks[0].sessions[0].durationMs===1800000);
      let taskJobsFutureRejected=false;
      try { normalizeTaskLogJobsRecord({format:TASK_LOG_JOBS_FORMAT,version:TASK_LOG_JOBS_VERSION+1,jobs:[]}); } catch (e) { taskJobsFutureRejected=true; }
      check('Task Logging rejects future jobs file versions',taskJobsFutureRejected);
      let taskPresetsFutureRejected=false;
      try { normalizeTaskLogPresetsRecord({format:TASK_LOG_PRESETS_FORMAT,version:TASK_LOG_PRESETS_VERSION+1,presets:[]}); } catch (e) { taskPresetsFutureRejected=true; }
      check('Task Logging rejects future preset file versions',taskPresetsFutureRejected);

      const notesRoundTrip=normalizeFabricatorNotesRecord({
        format:FABRICATOR_NOTES_FORMAT,version:1,activeTopicId:2,nextId:3,
        topics:[
          {id:1,title:'Brake setup',content:'Use back gauge at 24 1/2.',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-02T00:00:00.000Z'},
          {id:2,title:'Door notes',content:'Check hinge side first.',createdAt:'2026-01-03T00:00:00.000Z',updatedAt:'2026-01-04T00:00:00.000Z'}
        ]
      });
      check('Fabricator Notes legacy import preserves topics and content',notesRoundTrip.topics.length===2 && notesRoundTrip.topics[0].contentHtml==='Use back gauge at 24 1/2.');
      check('Fabricator Notes import preserves active topic',notesRoundTrip.activeTopicId===2 && notesRoundTrip.nextId===3);
      const notesFormatted=normalizeFabricatorNotesRecord({
        format:FABRICATOR_NOTES_FORMAT,version:2,activeTopicId:1,nextId:2,
        topics:[{id:1,title:'Formatted',contentHtml:'Use <b>back gauge</b>, <i>verify</i>, and <u>mark</u>.<script>alert(1)<\/script>',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-02T00:00:00.000Z'}]
      });
      check('Fabricator Notes preserves bold italic underline formatting',notesFormatted.topics[0].contentHtml.includes('<b>back gauge</b>') && notesFormatted.topics[0].contentHtml.includes('<i>verify</i>') && notesFormatted.topics[0].contentHtml.includes('<u>mark</u>'));
      check('Fabricator Notes strips unsafe imported markup',!notesFormatted.topics[0].contentHtml.includes('<script'));
      let notesFutureRejected=false;
      try { normalizeFabricatorNotesRecord({format:FABRICATOR_NOTES_FORMAT,version:FABRICATOR_NOTES_VERSION+1,topics:[]}); } catch (e) { notesFutureRejected=true; }
      check('Fabricator Notes rejects future file versions',notesFutureRejected);
      check('Long overhang 117 1/2 uses one blank',longPieces(117.5).count===1);
      check('Long overhang above 117 1/2 splits',longPieces(117.625).count===2);
      check('Short overhang 119 1/2 uses one blank',shortPieces(119.5).count===1);

      const spacingLength=100, spacingMax=24;
      const spaces=Math.max(1,Math.ceil((spacingLength/spacingMax)-1e-12));
      check('Fastener exact spacing never exceeds max',spacingLength/spaces<=spacingMax+1e-12);

      check('1/32 addition example 5/32 + 7/32 = 3/8',fractionFromThirtySeconds(5+7)==='3/8"');
      check('1/64 addition example 5/64 + 7/64 = 3/16',fractionFromSixtyFourths(5+7)==='3/16"');
      check('1/64 addition maximum 1 + 1 = 2',fractionFromSixtyFourths(128)==='2"');
      check('Quick Reference decimal mode rounds to three places',quickReferenceDecimal(5/32)==='0.156');
      check('Quick Reference 1/64 decimal rounds to three places',quickReferenceDecimal(5/64)==='0.078');
      check('Gauge reference 16 ga steel thickness',Math.abs(gaugeReferenceThickness(16,'steel')-0.0598)<1e-9);
      check('Gauge reference 16 ga aluminum thickness',Math.abs(gaugeReferenceThickness(16,'aluminum')-0.0508)<1e-9);
      check('Gauge reference 16 ga stainless thickness',Math.abs(gaugeReferenceThickness(16,'stainless')-0.0625)<1e-9);
      check('Gauge reference keeps material-specific values distinct',gaugeReferenceThickness(16,'steel')!==gaugeReferenceThickness(16,'aluminum'));

      const sawExactOne=optimizeSawItems([
        {uid:'SW1',length:40,size:40.25,label:''},
        {uid:'SW2',length:40,size:40.25,label:''},
        {uid:'SW3',length:39.5,size:39.75,label:''}
      ],120);
      check('Saw kerf: three pieces can exactly consume 120 inches',sawExactOne.bins.length===1 && Math.abs(sawExactOne.bins[0].offcut)<1e-9);
      const sawKerfSplit=optimizeSawItems([
        {uid:'SK1',length:60,size:60.25,label:''},
        {uid:'SK2',length:60,size:60.25,label:''}
      ],120);
      check('Saw kerf prevents two 60 inch pieces sharing 120 stock',sawKerfSplit.bins.length===2);
      check('Saw minimum-confirmed result is not below its lower bound',sawKerfSplit.bins.length>=sawKerfSplit.lowerBound);
      const savedSawTestJob=sawJob;
      sawJob=[{id:42,label:'Cut tracking test',length:10,qty:2}];
      const sawTrackingItems=expandedSawItems();
      sawJob=savedSawTestJob;
      check('Saw cut tracking has stable physical piece IDs',sawTrackingItems.map(item=>item.uid).join('|')==='42-1|42-2');
      const sawImportRecord=normalizeSawJobRecord({
        format:'FabricationSawOptimizerJob',version:1,tubeLength:240,kerf:0.25,nextId:8,
        parts:[{id:7,label:'B2',length:93,qty:2}],cutPartIds:['7-2']
      });
      check('Saw import preserves tube length and part data',sawImportRecord.tubeLength===240 && sawImportRecord.parts[0].label==='B2' && sawImportRecord.parts[0].length===93 && sawImportRecord.parts[0].qty===2);
      check('Saw import preserves individual cut status',sawImportRecord.cutPartIds.length===1 && sawImportRecord.cutPartIds[0]==='7-2');
      let rejectedFutureSawVersion=false;
      try { normalizeSawJobRecord({format:'FabricationSawOptimizerJob',version:SAW_JOB_FILE_VERSION+1,tubeLength:120,parts:[],cutPartIds:[]}); }
      catch (error) { rejectedFutureSawVersion=true; }
      check('Saw import rejects unsupported future versions',rejectedFutureSawVersion);

      const checklistRecord=normalizeChecklistRecord({
        format:'FabricationChecklist',version:1,activeTopicId:4,nextTopicId:5,nextItemId:12,
        topics:[{id:4,title:'Final Inspection',items:[{id:10,text:'Check hinges',checked:true},{id:11,text:'Check sweep',checked:false}]}]
      });
      check('Checklist import preserves topic and item data',checklistRecord.topics[0].title==='Final Inspection' && checklistRecord.topics[0].items.length===2);
      check('Checklist import preserves checked status',checklistRecord.topics[0].items[0].checked===true && checklistRecord.topics[0].items[1].checked===false);
      check('Checklist import preserves active topic',checklistRecord.activeTopicId===4);
      let rejectedDuplicateChecklistItem=false;
      try {
        normalizeChecklistRecord({format:'FabricationChecklist',version:1,topics:[
          {id:1,title:'A',items:[{id:1,text:'One',checked:false}]},
          {id:2,title:'B',items:[{id:1,text:'Duplicate',checked:false}]}
        ]});
      } catch (error) { rejectedDuplicateChecklistItem=true; }
      check('Checklist import rejects duplicate item IDs',rejectedDuplicateChecklistItem);
      let rejectedFutureChecklistVersion=false;
      try { normalizeChecklistRecord({format:'FabricationChecklist',version:FABRICATION_CHECKLIST_VERSION+1,topics:[]}); }
      catch (error) { rejectedFutureChecklistVersion=true; }
      check('Checklist import rejects unsupported future versions',rejectedFutureChecklistVersion);

      const productExpectations={
        exterior:[22,32], door:[21.5,31.5], acp:[19.875,29.875],
        insulation:[19.5,29.5], plywood:[19.25,29.25]
      };
      for (const [key,[w,h]] of Object.entries(productExpectations)) {
        const cut=optimizerCutSize(key,20,30);
        check(`${key} cut rule`,Math.abs(cut.width-w)<1e-9 && Math.abs(cut.height-h)<1e-9,`${cut.width} × ${cut.height}`);
      }

      // Grain-flow orientation regression tests. Width is the long/grain axis;
      // Height is the short axis when Grain Flow Rotation is ON (allowRotate=false).
      const aluminumWideCut=optimizerCutSize('exterior',100,40); // 102 W × 42 H
      const savedSelfTestJob=optimizerJob;
      optimizerJob=[{id:999,productKey:'exterior',label:'Axis test',finishedWidth:100,finishedHeight:40,qty:1,cutWidth:aluminumWideCut.width,cutHeight:aluminumWideCut.height}];
      const expandedAxisTest=expandedOptimizerItems().al063[0];
      optimizerJob=savedSelfTestJob;
      check('Expanded item maps Width to long/grain axis',expandedAxisTest.cutL===aluminumWideCut.width && expandedAxisTest.cutW===aluminumWideCut.height,`cutL=${expandedAxisTest.cutL}, cutW=${expandedAxisTest.cutW}`);

      const aluminumWide=[{uid:'GA1',cutL:aluminumWideCut.width,cutW:aluminumWideCut.height,cutWidth:aluminumWideCut.width,cutHeight:aluminumWideCut.height,productKey:'exterior',label:''}];
      const aluminumWideLocked=optimizeMaterialGroup(aluminumWide,MATERIALS.al063,false);
      check('Grain ON: wide aluminum follows Width along 0–120',!aluminumWideLocked.error && aluminumWideLocked.bins.length===1);
      check('Grain ON: locked aluminum placement is not marked rotated',!aluminumWideLocked.error && aluminumWideLocked.bins[0].used[0].rotated===false);

      const aluminumTallCut=optimizerCutSize('exterior',40,100); // 42 W × 102 H
      const aluminumTall=[{uid:'GA2',cutL:aluminumTallCut.width,cutW:aluminumTallCut.height,cutWidth:aluminumTallCut.width,cutHeight:aluminumTallCut.height,productKey:'exterior',label:''}];
      const aluminumTallLocked=optimizeMaterialGroup(aluminumTall,MATERIALS.al063,false);
      const aluminumTallFree=optimizeMaterialGroup(aluminumTall,MATERIALS.al063,true);
      check('Grain ON: tall aluminum cannot swap Width/Height',!!aluminumTallLocked.error);
      check('Grain OFF: tall aluminum may rotate to fit',!aluminumTallFree.error && aluminumTallFree.bins.length===1);
      check('Grain OFF: rotated aluminum placement is marked rotated for its label',!aluminumTallFree.error && aluminumTallFree.bins[0].used[0].rotated===true);

      const plywoodWideCut=optimizerCutSize('plywood',90,40); // 89.25 W × 39.25 H
      const plywoodWide=[{uid:'GP1',cutL:plywoodWideCut.width,cutW:plywoodWideCut.height,cutWidth:plywoodWideCut.width,cutHeight:plywoodWideCut.height,productKey:'plywood',label:''}];
      const plywoodWideLocked=optimizeMaterialGroup(plywoodWide,MATERIALS.plywood,false);
      check('Grain ON: wide plywood follows Width along long axis',!plywoodWideLocked.error && plywoodWideLocked.bins.length===1);

      const plywoodTallCut=optimizerCutSize('plywood',40,90); // 39.25 W × 89.25 H
      const plywoodTall=[{uid:'GP2',cutL:plywoodTallCut.width,cutW:plywoodTallCut.height,cutWidth:plywoodTallCut.width,cutHeight:plywoodTallCut.height,productKey:'plywood',label:''}];
      const plywoodTallLocked=optimizeMaterialGroup(plywoodTall,MATERIALS.plywood,false);
      const plywoodTallFree=optimizeMaterialGroup(plywoodTall,MATERIALS.plywood,true);
      check('Grain ON: tall plywood cannot swap Width/Height',!!plywoodTallLocked.error);
      check('Grain OFF: tall plywood may rotate to fit',!plywoodTallFree.error && plywoodTallFree.bins.length===1);

      const knownRegression=[[12,36],[60,12],[24,48],[48,12],[12,12],[36,48],[84,12]].map((d,i)=>({
        uid:`R${i+1}`,cutL:d[0],cutW:d[1],cutHeight:d[0],cutWidth:d[1],productKey:'insulation',label:''
      }));
      const regressionResult=optimizeMaterialGroup(knownRegression,MATERIALS.cellulose,true);
      check('Optimizer never falsely proves regression layout',!regressionResult.minimumConfirmed || regressionResult.bins.length===regressionResult.lowerBound,`bins=${regressionResult.bins.length}, lower=${regressionResult.lowerBound}`);
      check('Minimum-confirmed invariant',!regressionResult.minimumConfirmed || regressionResult.bins.length===regressionResult.lowerBound);

      const shearItems=[
        {uid:'S1',cutL:50,cutW:20,cutHeight:50,cutWidth:20,productKey:'exterior',label:''},
        {uid:'S2',cutL:40,cutW:20,cutHeight:40,cutWidth:20,productKey:'exterior',label:''}
      ];
      const shear=optimizeMaterialGroup(shearItems,MATERIALS.al063,true);
      check('Generated shear layout validates',!shear.error && !shear.internalError && validateShearPacking(shear.bins,shearItems,MATERIALS.al063.usableL,MATERIALS.al063.usableW,true).ok);

      const sampleRecord=normalizeOptimizerJobRecord({
        format:'FabricationCutOptimizerJob',version:2,jobNumber:'SELFTEST',rotate:true,nextId:2,
        parts:[{id:1,productKey:'plywood',label:'Test',finishedWidth:20,finishedHeight:30,qty:1}],cutPartIds:['1-1']
      });
      check('Import normalization preserves cut mark',sampleRecord.cutPartIds[0]==='1-1');
      check('Import normalization preserves Width × Height',sampleRecord.parts[0].finishedWidth===20 && sampleRecord.parts[0].finishedHeight===30);
      check('Legacy rotate=true migrates to Grain Flow Rotation OFF',sampleRecord.grainFlowRotation===false);
      const legacyLocked=normalizeOptimizerJobRecord({
        format:'FabricationCutOptimizerJob',version:2,jobNumber:'SELFTEST-LOCKED',rotate:false,nextId:2,
        parts:[{id:1,productKey:'plywood',label:'Test',finishedWidth:20,finishedHeight:30,qty:1}],cutPartIds:[]
      });
      check('Legacy rotate=false migrates to Grain Flow Rotation ON',legacyLocked.grainFlowRotation===true);
      const v3Locked=normalizeOptimizerJobRecord({
        format:'FabricationCutOptimizerJob',version:3,jobNumber:'SELFTEST-V3',grainFlowRotation:true,nextId:2,
        parts:[{id:1,productKey:'plywood',label:'Test',finishedWidth:20,finishedHeight:30,qty:1}],cutPartIds:[]
      });
      check('V3 Grain Flow Rotation setting is preserved',v3Locked.grainFlowRotation===true);
    } catch (error) {
      checks.push({name:'Self-test execution',pass:false,detail:String(error && error.stack || error)});
    }
    const passed=checks.filter(c=>c.pass).length;
    const summary={passed,total:checks.length,failed:checks.filter(c=>!c.pass),checks};
    if (console && console.table) console.table(checks);
    if (summary.failed.length) console.error('Fabrication self-tests failed',summary);
    else console.info(`Fabrication self-tests passed: ${passed}/${checks.length}`);
    return summary;
  }
  window.runFabricationSelfTests=runFabricationSelfTests;
  async function runFabricationBrowserSelfTests() {
    const summary=runFabricationSelfTests();
    try {
      const workerGroups={cellulose:[
        {uid:'W1',cutL:20,cutW:20,cutHeight:20,cutWidth:20,productKey:'insulation',label:''},
        {uid:'W2',cutL:30,cutW:20,cutHeight:30,cutWidth:20,productKey:'insulation',label:''}
      ]};
      const workerResults=await optimizeGroupsInWorker(workerGroups,true,++optimizerRunSerial);
      const workerOk=!!(workerResults.cellulose && workerResults.cellulose.bins && workerResults.cellulose.bins.length===1);
      summary.checks.push({name:'Inline Web Worker optimization',pass:workerOk,detail:workerOk?'':'Worker did not return the expected one-sheet layout.'});
      if (!workerOk) summary.failed.push(summary.checks[summary.checks.length-1]);
      else summary.passed++;
      summary.total++;
    } catch (error) {
      const failure={name:'Inline Web Worker optimization',pass:false,detail:String(error && error.message || error)};
      summary.checks.push(failure); summary.failed.push(failure); summary.total++;
    }
    document.documentElement.dataset.selfTest=`${summary.passed}/${summary.total}`;
    const pre=document.createElement('pre');
    pre.id='selfTestReport';
    pre.textContent=JSON.stringify(summary,null,2);
    pre.style.whiteSpace='pre-wrap';
    document.body.appendChild(pre);
    return summary;
  }
  window.runFabricationBrowserSelfTests=runFabricationBrowserSelfTests;
  if (location.hash==='#selftest') setTimeout(runFabricationBrowserSelfTests,0);
