import {mkdir,readdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
export class LocalBucket{
 constructor(directory=null){this.directory=directory;this.map=new Map}
 async load(){if(!this.directory)return;await mkdir(this.directory,{recursive:true});for(const filename of await readdir(this.directory)){if(!filename.endsWith('.json'))continue;const record=JSON.parse(await readFile(resolve(this.directory,filename),'utf8'));this.map.set(record.key,{bytes:Buffer.from(record.bytes,'base64'),etag:record.etag})}}
 path(key){return resolve(this.directory,Buffer.from(key).toString('base64url')+'.json')}
 async get(key){const record=this.map.get(key);if(!record)return null;const bytes=Buffer.from(record.bytes);return {etag:record.etag,body:new ReadableStream({start(c){c.enqueue(new Uint8Array(bytes));c.close()}}),async json(){return JSON.parse(bytes.toString())},async text(){return bytes.toString()},async arrayBuffer(){return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}}}
 async put(key,value,options={}){const old=this.map.get(key),condition=options.onlyIf;if(condition?.etagMatches&&old?.etag!==condition.etagMatches)return null;if(condition?.etagDoesNotMatch==='*'&&old)return null;const bytes=typeof value==='string'?Buffer.from(value):Buffer.from(value),etag=createHash('sha256').update(bytes).digest('hex'),record={bytes,etag};this.map.set(key,record);if(this.directory){const path=this.path(key),temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify({key,etag,bytes:bytes.toString('base64')}));await rename(temp,path)}return {etag}}
 async delete(keys){for(const key of Array.isArray(keys)?keys:[keys]){this.map.delete(key);if(this.directory)await unlink(this.path(key)).catch(()=>{})}}
}
