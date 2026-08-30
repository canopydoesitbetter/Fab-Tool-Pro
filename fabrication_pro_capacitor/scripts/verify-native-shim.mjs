import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../www/native-compat.js',import.meta.url),'utf8');
if(source.includes('fabri-cadabra.js') || /createElement\(\s*['"]script['"]\s*\)/.test(source)) throw new Error('Native compatibility layer still loads application features.');
const calls={write:[],uri:[],share:[],fallback:0}; let urlId=0;
class MockAnchor{constructor(){this.href='';this.download='';}click(){calls.fallback++;}}
class MockFileReader{readAsDataURL(blob){blob.arrayBuffer().then(buffer=>{this.result=`data:${blob.type||'application/octet-stream'};base64,${Buffer.from(buffer).toString('base64')}`;this.onload?.();}).catch(error=>{this.error=error;this.onerror?.();});}}
const URLMock={createObjectURL(){return `blob:mock-${++urlId}`;},revokeObjectURL(){}};
const context={Blob,Buffer,FileReader:MockFileReader,HTMLAnchorElement:MockAnchor,URL:URLMock,console,setTimeout,clearTimeout,Capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'android',Plugins:{Filesystem:{async writeFile(options){calls.write.push(options);},async getUri(options){calls.uri.push(options);return{uri:`file:///cache/${options.path}`};}},Share:{async share(options){calls.share.push(options);return{};}}}}};
context.window=context;vm.createContext(context);new vm.Script(source,{filename:'native-compat.js'}).runInContext(context);
const payload=JSON.stringify({hello:'fabri-cadabra'});const blob=new Blob([payload],{type:'application/json'});const href=context.URL.createObjectURL(blob);const anchor=new context.HTMLAnchorElement();anchor.href=href;anchor.download='Job-TEST-Fabri-Cadabra.json';anchor.click();
await new Promise(resolve=>setTimeout(resolve,50));
if(calls.fallback!==0) throw new Error('Native Blob export unexpectedly used browser fallback.');
if(calls.write.length!==1) throw new Error('Filesystem.writeFile was not called exactly once.');
if(calls.share.length!==1) throw new Error('Share.share was not called exactly once.');
if(calls.write[0].directory!=='CACHE') throw new Error('Export was not written to Capacitor cache.');
if(calls.write[0].path!==anchor.download) throw new Error('Export filename changed unexpectedly.');
const decoded=Buffer.from(calls.write[0].data,'base64').toString('utf8');if(decoded!==payload) throw new Error('Export JSON bytes changed in the native bridge.');
if(!Array.isArray(calls.share[0].files)||calls.share[0].files.length!==1) throw new Error('Native share sheet did not receive the exported file.');
console.log('Native compatibility responsibility boundary: OK');
console.log('Native Blob export compatibility test: OK');
console.log('Export JSON byte preservation: OK');
