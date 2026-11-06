import {test,after} from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
process.env.NODE_ENV='test';process.env.ADMIN_PASSWORD='integration-test-only';process.env.DB_PATH=mkdtempSync(tmpdir()+'/meet-test-')+'/db.sqlite';
const {server}=await import('./server.js');
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
function client(){let cookies='';const f=async(path,b)=>{const r=await fetch(base+'/api/'+path,{method:b===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookies},body:b===undefined?undefined:JSON.stringify(b)});if(r.headers.getSetCookie().length)cookies=r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');return {status:r.status,data:await r.json()};};f.cookies=()=>cookies;return f;}
const delay=()=>new Promise(r=>setTimeout(r,850));
after(()=>new Promise(r=>server.close(r)));
test('anonymous matching, reciprocal preferences, secret pools, replies, reports and persistent moderation',async()=>{
 const a=client(),b=client(),c=client(),admin=client(),intruder=client();
 await a('session',{});await b('session',{});await c('session',{});
 assert.equal((await a('join',{gender:'male',mode:'opposite',phrase:'密语'})).data.state,'waiting');
 assert.equal((await b('join',{gender:'female',mode:'random',phrase:'不同'})).data.state,'waiting');
 assert.equal((await c('join',{gender:'male',mode:'random',phrase:'密语'})).data.state,'waiting');
 await delay();assert.equal((await b('join',{gender:'female',mode:'random',phrase:'密语'})).data.state,'chat');
 assert.equal((await a('state')).data.state,'chat');assert.equal((await c('state')).data.state,'waiting');
 await delay();const msg=await a('message',{text:'你好 <script>alert(1)</script> 😀'});assert.equal(msg.status,200);
 const seen=(await b('state')).data.messages[0];assert.equal(seen.mine,false);assert.equal(seen.text,'你好 <script>alert(1)</script> 😀');
 const reply=await b('message',{text:'你好！',reply:seen.id});assert.equal(reply.data.messages[1].reply.id,seen.id);
 await delay();assert.equal((await a('message',{text:'无效引用',reply:'not-real'})).status,400);
 assert.equal((await intruder('admin/stats')).status,401);
 assert.equal((await admin('admin/login',{password:'wrong'})).status,401);
 assert.equal((await admin('admin/login',{password:'integration-test-only'})).status,200);
 assert.equal((await a('report',{reason:'spam'})).data.reported,true);
 assert.equal((await b('state')).data.state,'ended');
 let stats=(await admin('admin/stats')).data;assert.equal(stats.reports.length,1);assert.equal(JSON.parse(stats.reports[0].evidence).length,2);
 assert.equal((await admin('admin/action',{id:stats.reports[0].id,action:'ban'})).status,200);
 assert.equal((await b('join',{gender:'female',mode:'random',phrase:''})).status,403);
 assert.equal((await admin('admin/stats')).data.bans.length,1);
 await delay();await a('join',{gender:'male',mode:'random',phrase:'密语'});assert.equal((await c('state')).data.state,'chat');
 await a('leave',{});assert.equal((await c('state')).data.state,'ended');
 const csrf=await fetch(base+'/api/session',{method:'POST',headers:{Origin:'https://foreign.example','Content-Type':'application/json'},body:'{}'});assert.equal(csrf.status,403);
 const page=await fetch(base);assert.match(await page.text(),/reportDialog/);
});

test('Chinese text split across network chunks is decoded intact',async()=>{
 const a=client(),b=client();const p='split-'+Math.random();await a('session',{});await b('session',{});
 await a('join',{gender:'male',mode:'random',phrase:p});await b('join',{gender:'female',mode:'random',phrase:p});await delay();
 const body=Buffer.from(JSON.stringify({text:'你好世界'}));
 const text=await new Promise((resolve,reject)=>{const req=http.request(base+'/api/message',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':body.length,Cookie:a.cookies()}},res=>{let d='';res.setEncoding('utf8');res.on('data',x=>d+=x);res.on('end',()=>resolve(JSON.parse(d).messages?.at(-1)?.text));});req.on('error',reject);req.flushHeaders();req.write(body.subarray(0,10));setTimeout(()=>req.end(body.subarray(10)),50);});
 assert.equal(text,'你好世界');
});
test('user can still report after the other person leaves',async()=>{
 const a=client(),b=client(),admin=client();const p='leave-'+Math.random();await a('session',{});await b('session',{});
 await a('join',{gender:'male',mode:'random',phrase:p});await b('join',{gender:'female',mode:'random',phrase:p});await delay();
 await b('message',{text:'难听的话'});await b('leave',{});
 assert.equal((await a('state')).data.state,'ended');
 const r=await a('report',{reason:'harassment'});assert.equal(r.status,200);assert.equal(r.data.reported,true);
 assert.equal((await a('report',{reason:'harassment'})).status,409);
 await admin('admin/login',{password:'integration-test-only'});
 const rep=(await admin('admin/stats')).data.reports.find(x=>JSON.parse(x.evidence).some(m=>m.text==='难听的话'));assert.ok(rep);assert.equal(rep.reason,'harassment');
});
test('admin login limit counts failures per real client IP and resets on success',async()=>{
 process.env.TRUST_PROXY='true';
 try{
  const login=(ip,password)=>fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':ip},body:JSON.stringify({password})}).then(r=>r.status);
  for(let i=0;i<7;i++)assert.equal(await login('203.0.113.1','wrong'),401);
  assert.equal(await login('203.0.113.1','integration-test-only'),200);
  for(let i=0;i<7;i++)assert.equal(await login('203.0.113.1','wrong'),401);
  assert.equal(await login('203.0.113.1','integration-test-only'),200);
  for(let i=0;i<8;i++)await login('203.0.113.66','wrong');
  assert.equal(await login('203.0.113.66','integration-test-only'),429);
  assert.equal(await login('203.0.113.2','integration-test-only'),200);
 }finally{delete process.env.TRUST_PROXY;}
});
test('one IP cannot flood new sessions, existing sessions keep working',async()=>{
 const keep=client();await keep('session',{});
 let limited=false;for(let i=0;i<31&&!limited;i++)limited=(await fetch(base+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status===429;
 assert.ok(limited);assert.equal((await keep('session',{})).status,200);assert.equal((await keep('state')).status,200);
});
