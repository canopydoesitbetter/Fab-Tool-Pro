import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const stylesPath=join(root,'www','styles.css');
const verifyPath=join(root,'scripts','verify-features.mjs');
let styles=readFileSync(stylesPath,'utf8');
let verify=readFileSync(verifyPath,'utf8');

function replaceOnce(source,needle,replacement,label) {
  const count=source.split(needle).length-1;
  if(count!==1) throw new Error(`${label}: expected exactly one source match, found ${count}.`);
  return source.replace(needle,replacement);
}

styles=replaceOnce(styles,
`      --rail:#8799a5;
      --fastener:#f59e0b;
    }`,
`      --rail:#8799a5;
      --fastener:#f59e0b;
      --panel-pencil:#b8c6d0;
      --panel-pencil-soft:#ccd6dd;
      --panel-depth:0 10px 24px rgba(22,34,43,.13);
    }`,
'Light panel depth variables');

styles=replaceOnce(styles,
`      --rail:#64748b;
      --fastener:#f59e0b;
    }`,
`      --rail:#64748b;
      --fastener:#f59e0b;
      --panel-pencil:#506174;
      --panel-pencil-soft:#405065;
      --panel-depth:0 12px 28px rgba(0,0,0,.34);
    }`,
'Dark panel depth variables');

styles=replaceOnce(styles,
`    button,input { font:inherit; }
    button { touch-action:manipulation; }`,
`    button,input { font:inherit; }
    button { touch-action:manipulation; }
    button:not(:disabled) {
      cursor:pointer;
      transform-origin:center;
      -webkit-tap-highlight-color:transparent;
      transition:transform .16s cubic-bezier(.2,.8,.2,1),filter .16s ease,background-color .16s ease,border-color .16s ease,color .16s ease;
    }
    button:disabled { cursor:not-allowed; }
    @media (hover:hover) and (pointer:fine) {
      button:not(:disabled):hover {
        transform:translateY(-1px);
        filter:brightness(1.025) drop-shadow(0 3px 4px rgba(22,34,43,.16));
      }
    }
    button:not(:disabled):active {
      transform:translateY(1px) scale(.985);
      filter:brightness(.97) drop-shadow(0 1px 1px rgba(22,34,43,.16));
      transition-duration:.07s;
    }
    @media (prefers-reduced-motion: reduce) {
      button:not(:disabled) { transition:none; }
      button:not(:disabled):hover,
      button:not(:disabled):active { transform:none; }
    }`,
'Global tactile button treatment');

styles=replaceOnce(styles,
`    .card { padding:16px; margin-bottom:14px; }
    .card h2 {`,
`    .card { padding:16px; margin-bottom:14px; }
    :where(
      .tool-panel > .card,
      .tool-panel > .result,
      .tool-panel > .grid-two > .result,
      .tool-panel > .tasklog-workspace > .card,
      .tool-panel > .notes-workspace > .card,
      .tool-panel > .checklist-workspace > .card,
      .tool-panel > .optimizer-results > .card,
      .tool-panel > .saw-results > .card
    ) {
      border-color:var(--panel-pencil);
      box-shadow:
        0 0 0 2px var(--card),
        0 0 0 3px var(--panel-pencil),
        0 0 0 5px var(--card),
        0 0 0 6px var(--panel-pencil-soft),
        var(--panel-depth);
    }
    .card h2 {`,
'Outer panel triple pencil treatment');

verify=replaceOnce(verify,
`if(!app.includes("topic.items.map(item=>({id:item.id,text:String(item.text || '').trim().slice(0,MAX_CHECKLIST_ITEM_TEXT),checked:item.checked===true}))")) {
  throw new Error('Checklist export must continue serializing items in their stored array order without changing the protected format.');
}

if(config.appId!=='com.fabricationpro.app')`,
`if(!app.includes("topic.items.map(item=>({id:item.id,text:String(item.text || '').trim().slice(0,MAX_CHECKLIST_ITEM_TEXT),checked:item.checked===true}))")) {
  throw new Error('Checklist export must continue serializing items in their stored array order without changing the protected format.');
}

for(const marker of [
  'button:not(:disabled)',
  '@media (hover:hover) and (pointer:fine)',
  'transform:translateY(1px) scale(.985)',
  '@media (prefers-reduced-motion: reduce)',
  '--panel-pencil:',
  '--panel-pencil-soft:',
  '--panel-depth:',
  '.tool-panel > .card',
  '.tool-panel > .tasklog-workspace > .card',
  '.tool-panel > .notes-workspace > .card',
  '.tool-panel > .checklist-workspace > .card',
  '0 0 0 3px var(--panel-pencil)',
  '0 0 0 6px var(--panel-pencil-soft)'
]) {
  if(!styles.includes(marker)) throw new Error(\`App-wide tactile styling contract missing: \${marker}\`);
}
if(/\.metric[^}]*--panel-pencil|\.checklist-item[^}]*--panel-pencil|\.rule[^}]*--panel-pencil/s.test(styles)) {
  throw new Error('Triple-pencil panel treatment must stay on outer panels and not bleed into protected subpanels.');
}

if(config.appId!=='com.fabricationpro.app')`,
'Permanent tactile styling verifier');

verify=replaceOnce(verify,
`console.log('Checklist drag/reorder compatibility contract: OK');
console.log('Official Fabri-Cadabra naming and compatibility-sensitive identity: OK');`,
`console.log('Checklist drag/reorder compatibility contract: OK');
console.log('App-wide tactile buttons and outer-panel styling contract: OK');
console.log('Official Fabri-Cadabra naming and compatibility-sensitive identity: OK');`,
'Visual style verifier status');

writeFileSync(stylesPath,styles);
writeFileSync(verifyPath,verify);
console.log('App-wide tactile styling update applied.');
