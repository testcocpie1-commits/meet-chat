import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
process.env.NODE_ENV='test';process.env.ADMIN_PASSWORD='integration-test-only';process.env.DB_PATH=mkdtempSync(tmpdir()+'/meet-test-')+'/db.sqlite';
const {server}=await import('./server.js');
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
function client(){let cookies='';return async(path,b)=>{const r=await fetch(base+'/api/'+path,{method:b===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookies},body:b===undefined?undefined:JSON.stringify(b)});if(r.headers.getSetCookie().length)cookies=r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');return {status:r.status,data:await r.json()};};}
const delay=()=>new Promise(r=>setTimeout(r,850));
test('anonymous matching, reciprocal preferences, secret pools, replies, reports and persistent moderation',async()=>{
 try{
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
 }finally{await new Promise(r=>server.close(r));}
});
