import './build.mjs';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {LocalBucket} from './local-bucket.mjs';
const {default:worker}=await import('../dist/server/index.js?local='+Date.now());
const bucket=new LocalBucket(resolve('.local/r2'));await bucket.load();
const port=Number(process.env.PORT||4173);
createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const host=req.headers.host||`127.0.0.1:${port}`,request=new Request(`http://${host}${req.url}`,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),response=await worker.fetch(request,{BUCKET:bucket,ADMIN_ID:process.env.ADMIN_ID,ADMIN_PASSWORD:process.env.ADMIN_PASSWORD},{});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch{res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:'預覽服務錯誤。'}))}}).listen(port,'0.0.0.0',()=>console.log(`Preview listening on ${port}`));
