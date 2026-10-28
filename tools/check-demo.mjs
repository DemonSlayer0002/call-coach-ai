// Structural checks supplement (and do not replace) a browser rendering test.
import {readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const root=new URL('../public/',import.meta.url);
const html=await readFile(new URL('index.html',root),'utf8');
const js=await readFile(new URL('sales-desk.js',root),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
const duplicate=ids.filter((id,index)=>ids.indexOf(id)!==index);
if(duplicate.length)throw new Error('Duplicate demo IDs: '+duplicate.join(', '));
for(const match of js.matchAll(/\$\('([^']+)'\)/g))if(!ids.includes(match[1]))throw new Error('Missing demo element: '+match[1]);
const seen=new Set();
async function checkModule(url){
 if(seen.has(url.href))return;seen.add(url.href);
 const code=await readFile(url,'utf8');
 const syntax=spawnSync(process.execPath,['--input-type=module','--check'],{input:code,encoding:'utf8'});
 if(syntax.status)throw new Error(syntax.stderr);
 for(const match of code.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)){
  const spec=match[1];if(spec.startsWith('https:'))continue;
  const target=spec.startsWith('/')?new URL('.'+spec,root):new URL(spec,url);
  await access(target);await checkModule(target);
 }
}
await checkModule(new URL('sales-desk.js',root));
console.log('Demo checks passed: '+ids.length+' unique elements, '+seen.size+' local modules; all control references resolve.');
