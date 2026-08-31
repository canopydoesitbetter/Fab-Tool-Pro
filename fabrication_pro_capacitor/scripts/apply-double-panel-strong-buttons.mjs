import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const stylesPath=join(root,'www','styles.css');
const featuresPath=join(root,'scripts','verify-features.mjs');
let styles=readFileSync(stylesPath,'utf8');
let features=readFileSync(featuresPath,'utf8');

function replaceOnce(text,before,after,label){
  const count=text.split(before).length-1;
  if(count!==1) throw new Error(`${label}: expected one match, found ${count}`);
  return text.replace(before,after);
}

styles=replaceOnce(styles,
`      --panel-pencil:#b8c6d0;\n      --panel-pencil-soft:#ccd6dd;\n      --panel-depth:0 10px 24px rgba(22,34,43,.13);`,
`      --panel-border-inner:#9eafbb;\n      --panel-border-outer:#c4cfd6;\n      --panel-depth:0 11px 24px rgba(22,34,43,.15);\n      --button-edge:rgba(15,59,93,.34);\n      --button-depth:0 7px 14px rgba(22,34,43,.22);\n      --button-hover-depth:0 11px 18px rgba(22,34,43,.24);\n      --button-press-depth:0 2px 4px rgba(22,34,43,.14);`,
'light theme variables');

styles=replaceOnce(styles,
`      --panel-pencil:#506174;\n      --panel-pencil-soft:#405065;\n      --panel-depth:0 12px 28px rgba(0,0,0,.34);`,
`      --panel-border-inner:#5c6f83;\n      --panel-border-outer:#3f5165;\n      --panel-depth:0 13px 30px rgba(0,0,0,.38);\n      --button-edge:rgba(0,0,0,.72);\n      --button-depth:0 8px 16px rgba(0,0,0,.42);\n      --button-hover-depth:0 12px 20px rgba(0,0,0,.46);\n      --button-press-depth:0 2px 5px rgba(0,0,0,.28);`,
'dark theme variables');

styles=replaceOnce(styles,
`    button:not(:disabled) {\n      cursor:pointer;\n      transform-origin:center;\n      -webkit-tap-highlight-color:transparent;\n      transition:transform .16s cubic-bezier(.2,.8,.2,1),filter .16s ease,background-color .16s ease,border-color .16s ease,color .16s ease;\n    }\n    button:disabled { cursor:not-allowed; }\n    @media (hover:hover) and (pointer:fine) {\n      button:not(:disabled):hover {\n        transform:translateY(-1px);\n        filter:brightness(1.025) drop-shadow(0 3px 4px rgba(22,34,43,.16));\n      }\n    }\n    button:not(:disabled):active {\n      transform:translateY(1px) scale(.985);\n      filter:brightness(.97) drop-shadow(0 1px 1px rgba(22,34,43,.16));\n      transition-duration:.07s;\n    }`,
`    button:not(:disabled) {\n      cursor:pointer;\n      transform-origin:center;\n      -webkit-tap-highlight-color:transparent;\n      box-shadow:0 3px 0 var(--button-edge),var(--button-depth);\n      transition:transform .15s cubic-bezier(.2,.8,.2,1),box-shadow .15s ease,filter .15s ease,background-color .15s ease,border-color .15s ease,color .15s ease;\n    }\n    button:disabled { cursor:not-allowed; }\n    @media (hover:hover) and (pointer:fine) {\n      button:not(:disabled):hover {\n        transform:translateY(-2px);\n        box-shadow:0 5px 0 var(--button-edge),var(--button-hover-depth);\n        filter:brightness(1.045);\n      }\n    }\n    button:not(:disabled):active {\n      transform:translateY(2px) scale(.97);\n      box-shadow:0 1px 0 var(--button-edge),var(--button-press-depth);\n      filter:brightness(.95);\n      transition-duration:.07s;\n    }`,
'global tactile button block');

styles=replaceOnce(styles,
`    ) {\n      border-color:var(--panel-pencil);\n      box-shadow:\n        0 0 0 2px var(--card),\n        0 0 0 3px var(--panel-pencil),\n        0 0 0 5px var(--card),\n        0 0 0 6px var(--panel-pencil-soft),\n        var(--panel-depth);\n    }`,
`    ) {\n      border:2px solid var(--panel-border-inner);\n      box-shadow:\n        0 0 0 2px var(--card),\n        0 0 0 3px var(--panel-border-outer),\n        var(--panel-depth);\n    }`,
'outer panel border block');

for(const [before,after,label] of [
  ["'transform:translateY(1px) scale(.985)'","'transform:translateY(2px) scale(.97)'",'button press verifier'],
  ["'--panel-pencil:'","'--panel-border-inner:'",'inner border verifier'],
  ["'--panel-pencil-soft:'","'--panel-border-outer:'",'outer border verifier'],
  ["'0 0 0 3px var(--panel-pencil)'","'border:2px solid var(--panel-border-inner)'",'inner geometry verifier'],
  ["'0 0 0 6px var(--panel-pencil-soft)'","'0 0 0 3px var(--panel-border-outer)'",'outer geometry verifier'],
  ["if(/.metric[^}]*--panel-pencil|.checklist-item[^}]*--panel-pencil|.rule[^}]*--panel-pencil/s.test(styles)) {\n  throw new Error('Triple-pencil panel treatment must stay on outer panels and not bleed into protected subpanels.');\n}","if(/.metric[^}]*(--panel-border-inner|--panel-border-outer)|.checklist-item[^}]*(--panel-border-inner|--panel-border-outer)|.rule[^}]*(--panel-border-inner|--panel-border-outer)/s.test(styles)) {\n  throw new Error('Double-border panel treatment must stay on outer panels and not bleed into protected subpanels.');\n}",'subpanel scope verifier']
]) features=replaceOnce(features,before,after,label);

features=replaceOnce(features,
`  '--panel-depth:',\n  '.tool-panel > .card',`,
`  '--panel-depth:',\n  '--button-edge:',\n  '--button-depth:',\n  '--button-hover-depth:',\n  '--button-press-depth:',\n  'box-shadow:0 3px 0 var(--button-edge),var(--button-depth);',\n  'transform:translateY(-2px)',\n  'box-shadow:0 5px 0 var(--button-edge),var(--button-hover-depth);',\n  'box-shadow:0 1px 0 var(--button-edge),var(--button-press-depth);',\n  '.tool-panel > .card',`,
'pronounced button verifier markers');

writeFileSync(stylesPath,styles);
writeFileSync(featuresPath,features);
console.log('Applied double outer-panel borders and pronounced tactile button styling.');
