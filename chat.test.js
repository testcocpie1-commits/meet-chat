import {test,after} from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {readFileSync} from 'node:fs';
process.env.NODE_ENV='test';process.env.ADMIN_PASSWORD='integration-test-only';process.env.DB_PATH=mkdtempSync(tmpdir()+'/meet-test-')+'/db.sqlite';
const {server,internals}=await import('./server.js');
const sessionOf=c=>internals.sessions.get(c.cookies().match(/session=([a-f0-9]+)/)[1]);
const ago=ms=>Date.now()-ms;
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
function client(){let cookies='';const f=async(path,b)=>{const r=await fetch(base+'/api/'+path,{method:b===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookies},body:b===undefined?undefined:JSON.stringify(b)});if(r.headers.getSetCookie().length)cookies=r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');return {status:r.status,data:await r.json()};};f.cookies=()=>cookies;return f;}
const delay=()=>new Promise(r=>setTimeout(r,850));
after(()=>new Promise(r=>server.close(r)));
test('anonymous matching, reciprocal preferences, secret pools, replies, reports and persistent moderation',async()=>{
 const a=client(),b=client(),c=client(),admin=client(),intruder=client();
 await a('session',{});await b('session',{});await c('session',{});
 assert.equal((await a('join',{consent:true,gender:'male',mode:'opposite',phrase:'密语'})).data.state,'waiting');
 assert.equal((await b('join',{consent:true,gender:'female',mode:'random',phrase:'不同'})).data.state,'waiting');
 assert.equal((await c('join',{consent:true,gender:'male',mode:'random',phrase:'密语'})).data.state,'waiting');
 await delay();assert.equal((await b('join',{consent:true,gender:'female',mode:'random',phrase:'密语'})).data.state,'chat');
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
 assert.equal((await b('join',{consent:true,gender:'female',mode:'random',phrase:''})).status,403);
 assert.equal((await admin('admin/stats')).data.bans.length,1);
 await delay();await a('join',{consent:true,gender:'male',mode:'random',phrase:'密语'});assert.equal((await c('state')).data.state,'chat');
 await a('leave',{});assert.equal((await c('state')).data.state,'ended');
 const csrf=await fetch(base+'/api/session',{method:'POST',headers:{Origin:'https://foreign.example','Content-Type':'application/json'},body:'{}'});assert.equal(csrf.status,403);
 const page=await fetch(base);assert.match(await page.text(),/reportDialog/);
});

test('Chinese text split across network chunks is decoded intact',async()=>{
 const a=client(),b=client();const p='split-'+Math.random();await a('session',{});await b('session',{});
 await a('join',{consent:true,gender:'male',mode:'random',phrase:p});await b('join',{consent:true,gender:'female',mode:'random',phrase:p});await delay();
 const body=Buffer.from(JSON.stringify({text:'你好世界'}));
 const text=await new Promise((resolve,reject)=>{const req=http.request(base+'/api/message',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':body.length,Cookie:a.cookies()}},res=>{let d='';res.setEncoding('utf8');res.on('data',x=>d+=x);res.on('end',()=>resolve(JSON.parse(d).messages?.at(-1)?.text));});req.on('error',reject);req.flushHeaders();req.write(body.subarray(0,10));setTimeout(()=>req.end(body.subarray(10)),50);});
 assert.equal(text,'你好世界');
});
test('user can still report after the other person leaves',async()=>{
 const a=client(),b=client(),admin=client();const p='leave-'+Math.random();await a('session',{});await b('session',{});
 await a('join',{consent:true,gender:'male',mode:'random',phrase:p});await b('join',{consent:true,gender:'female',mode:'random',phrase:p});await delay();
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
test('joining requires the 18+ and conduct confirmation',async()=>{
 const a=client();await a('session',{});
 const r=await a('join',{gender:'male',mode:'random'});assert.equal(r.status,400);assert.match(r.data.error,/18/);
});
test('polling returns only new messages for the current chat',async()=>{
 const a=client(),b=client();const p='delta-'+Math.random();await a('session',{});await b('session',{});
 await a('join',{consent:true,gender:'male',mode:'random',phrase:p});await b('join',{consent:true,gender:'female',mode:'random',phrase:p});await delay();
 await a('message',{text:'一'});await delay();await a('message',{text:'二'});
 const full=(await b('state')).data;assert.equal(full.delta,false);assert.deepEqual(full.messages.map(m=>m.text),['一','二']);
 const since=full.messages[0].seq;
 const d=(await b(`state?chat=${full.chat}&since=${since}`)).data;assert.equal(d.delta,true);assert.deepEqual(d.messages.map(m=>m.text),['二']);
 const none=(await b(`state?chat=${full.chat}&since=${full.messages[1].seq}`)).data;assert.deepEqual(none.messages,[]);
 const stale=(await b(`state?chat=old-chat&since=${since}`)).data;assert.equal(stale.delta,false);assert.equal(stale.messages.length,2);
});
test('oversized request bodies get a clear 413 error',async()=>{
 const a=client();await a('session',{});
 const r=await a('message',{text:'字'.repeat(6000)});assert.equal(r.status,413);assert.equal(r.data.error,'内容过长');
});
test('every server error message has a Traditional Chinese translation',async()=>{
 const {traditional}=await import('./public/errors.js');
 const errors=[...readFileSync(new URL('./server.js',import.meta.url),'utf8').matchAll(/(?:error:|Error\(|\?)'([^']*[一-鿿][^']*)'/g)].map(m=>m[1]).filter(x=>!/^聊天服务/.test(x));
 assert.ok(errors.length>20);
 for(const e of errors)assert.ok(traditional[e],'missing translation: '+e);
});
test('sessions survive an hour of inactivity, then expire',async()=>{
 const a=client(),b=client();const p='keep-'+Math.random();await a('session',{});await b('session',{});
 await a('join',{consent:true,gender:'male',mode:'random',phrase:p});await b('join',{consent:true,gender:'female',mode:'random',phrase:p});
 sessionOf(a).seen=ago(59*60000);internals.expire();
 assert.equal((await a('state')).data.state,'chat');
 sessionOf(a).seen=ago(61*60000);internals.expire();
 assert.equal((await a('state')).status,401);assert.equal((await b('state')).data.state,'ended');
});
test('partner is shown as away after 90 seconds and back when they return',async()=>{
 const a=client(),b=client();const p='away-'+Math.random();await a('session',{});await b('session',{});
 await a('join',{consent:true,gender:'male',mode:'random',phrase:p});await b('join',{consent:true,gender:'female',mode:'random',phrase:p});
 assert.equal((await a('state')).data.peerAway,false);
 sessionOf(b).seen=ago(100000);
 const v=(await a('state')).data;assert.equal(v.state,'chat');assert.equal(v.peerAway,true);
 await b('state');assert.equal((await a('state')).data.peerAway,false);
});
test('people who stepped away are not matched with newcomers',async()=>{
 const a=client(),b=client();const p='ghost-'+Math.random();await a('session',{});await b('session',{});
 await a('join',{consent:true,gender:'male',mode:'random',phrase:p});sessionOf(a).seen=ago(100000);
 assert.equal((await b('join',{consent:true,gender:'female',mode:'random',phrase:p})).data.state,'waiting');
});
test('when full, the longest-inactive idle session makes room for a new visitor',async()=>{
 const fakes=[];for(let i=internals.sessions.size;i<2000;i++){const id='fake'+i;fakes.push(id);internals.sessions.set(id,{id,device:'d'+i,seen:ago(i===1999?3000000:200000+i),state:'idle',messages:[],blocked:new Set(),peer:null,queued:false});}
 try{
  const n=client();assert.equal((await n('session',{})).status,200);assert.equal(internals.sessions.has('fake1999'),false);
 }finally{for(const id of fakes)internals.sessions.delete(id);}
});
test('one IP cannot flood new sessions, existing sessions keep working',async()=>{
 const keep=client();await keep('session',{});
 let limited=false;for(let i=0;i<31&&!limited;i++)limited=(await fetch(base+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status===429;
 assert.ok(limited);assert.equal((await keep('session',{})).status,200);assert.equal((await keep('state')).status,200);
});
