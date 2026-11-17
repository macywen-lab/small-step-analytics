import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {normalizedQuarter,normalizedStories} from '../web/import-model.js';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),web=resolve(root,'web');
const types={'.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json; charset=utf-8'};
async function files(dir){let all=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,entry.name);if(entry.isDirectory())all.push(...await files(p));else all.push(p)}return all}
const revision=createHash('sha256');for(const path of (await files(web)).sort())revision.update(await readFile(path));const pwaRevision=revision.digest('hex').slice(0,16);
const assets={};for(const path of await files(web)){if(path.endsWith('/package.json'))continue;let bytes=await readFile(path);if(path.endsWith('/sw.js'))bytes=Buffer.from(bytes.toString().replaceAll('__PWA_REVISION__',pwaRevision));assets['/'+relative(web,path).replaceAll('\\','/')]={type:types[extname(path)]||'application/octet-stream',bytes:gzipSync(bytes,{level:9}).toString('base64'),etag:'"'+createHash('sha256').update(bytes).digest('hex').slice(0,24)+'"'}}
const data=JSON.parse(await readFile(resolve(web,'data.json'),'utf8')).map(normalizedQuarter),sourceStories=JSON.parse(await readFile(resolve(web,'stories.json'),'utf8')),stories=data.flatMap(q=>normalizedStories(sourceStories.filter(s=>s.quarter===q.id),q)).sort((a,b)=>a.month-b.month||a.source.localeCompare(b.source)||a.row-b.row),initial={data,stories,notes:JSON.parse(await readFile(resolve(web,'electronic-notes.json'),'utf8')),roster:JSON.parse(await readFile(resolve(web,'roster.json'),'utf8'))};
const rawShared=(await readFile(resolve(web,'raw-model.js'),'utf8')).replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const shared=(await readFile(resolve(web,'import-model.js'),'utf8')).replace(/^export /gm,''),worker=await readFile(resolve(root,'worker/index.js'),'utf8');
const directory=await readFile(resolve(root,'worker/directory.js'),'utf8');
const employees=await readFile(resolve(root,'worker/employees.js'),'utf8');
const auth=await readFile(resolve(root,'worker/auth.js'),'utf8');
const reviews=await readFile(resolve(root,'worker/reviews.js'),'utf8'),legacy=await readFile(resolve(root,'worker/legacy-electronic.json'),'utf8');
const source=`const LEGACY_DIGITAL_RECORDS=${legacy};\n${reviews}\nconst ASSETS=${JSON.stringify(assets)};\nconst INITIAL=${JSON.stringify(initial)};\n${shared}\n${rawShared}\n${auth}\n${employees}\n${directory}\n${worker}`;
await rm(resolve(root,'dist'),{recursive:true,force:true});await mkdir(resolve(root,'dist/server'),{recursive:true});await mkdir(resolve(root,'dist/.openai'),{recursive:true});await writeFile(resolve(root,'dist/server/index.js'),source);await writeFile(resolve(root,'dist/.openai/hosting.json'),await readFile(resolve(root,'.openai/hosting.json')));
console.log(`Built Worker with ${Object.keys(assets).length} embedded assets and ${stories.length} initial highlights.`);
