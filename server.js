import http from 'node:http';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
mkdirSync(root+'data',{recursive:true});
const db=new DatabaseSync(process.env.DB_PATH||root+'data/moderation.sqlite');
db.exec('CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,target TEXT,reason TEXT,evidence TEXT,status TEXT,created INTEGER); CREATE TABLE IF NOT EXISTS bans(target TEXT PRIMARY KEY,expires INTEGER)');
const sessions=new Map(), admins=new Map(), attempts=new Map();
const secret=process.env.ADMIN_PASSWORD;
const token=()=>randomBytes(32).toString('hex');
const hash=s=>createHash('sha256').update(s).digest('hex');
const cookie=(req,name)=>req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);
const banned=s=>!!db.prepare('SELECT 1 FROM bans WHERE target=? AND expires>?').get(s.device,Date.now());
function leave(s){s.queued=false;if(s.peer){const p=sessions.get(s.peer);if(p){p.peer=null;p.state='ended';}s.peer=null;}s.state='idle';}
function expire(){for(const [id,s] of sessions)if(Date.now()-s.seen>45000){leave(s);sessions.delete(id);}for(const [id,t]of admins)if(t<Date.now())admins.delete(id);for(const[k,a]of attempts)if(a.until<Date.now())attempts.delete(k);}
setInterval(expire,10000).unref();
const compatible=(a,b)=>a.phrase===b.phrase&&(a.mode==='random'||a.gender!==b.gender)&&(b.mode==='random'||a.gender!==b.gender)&&a.device!==b.device&&!a.blocked.has(b.device)&&!b.blocked.has(a.device);
function match(s){for(const p of sessions.values())if(p!==s&&p.queued&&!banned(p)&&compatible(s,p)){s.peer=p.id;p.peer=s.id;s.state=p.state='chat';s.queued=p.queued=false;s.messages=[];p.messages=[];return;}s.queued=true;s.state='waiting';}
function view(s){return {state:s.state,messages:s.messages,online:sessions.size,waiting:[...sessions.values()].filter(x=>x.queued).length};}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>12000)throw Error('内容过长');}return JSON.parse(text||'{}');}
const equal=(a,b)=>{const x=Buffer.from(hash(a)),y=Buffer.from(hash(b));return timingSafeEqual(x,y);};
export const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&!url.pathname.startsWith('/api/')){const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/admin':'admin.html','/admin.js':'admin.js'};const f=files[url.pathname];if(!f)return send(404,{error:'找不到页面'});res.setHeader('Content-Type',f.endsWith('js')?'text/javascript; charset=utf-8':f.endsWith('css')?'text/css; charset=utf-8':'text/html; charset=utf-8');return res.end(readFileSync(root+'public/'+f));}
 if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'请求来源无效'});
 if(url.pathname==='/api/config')return send(200,{adsClient:process.env.ADSENSE_CLIENT||'',adsSlot:process.env.ADSENSE_SLOT||''});
 const b=req.method==='POST'?await body(req):{};
 if(url.pathname==='/api/admin/login'&&req.method==='POST'){
 const ip=req.socket.remoteAddress,a=attempts.get(ip)||{n:0,until:Date.now()+900000};if(a.n>=8)return send(429,{error:'请稍后重试'});a.n++;attempts.set(ip,a);
 if(!secret)return send(503,{error:'尚未配置管理员密码'});if(!equal(String(b.password||''),secret))return send(401,{error:'密码错误'});
 const id=token();admins.set(id,Date.now()+3600000);res.setHeader('Set-Cookie',`admin=${id}; HttpOnly; SameSite=Strict; Path=/api/admin${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);return send(200,{ok:true});}
 if(url.pathname.startsWith('/api/admin/')){
 const id=cookie(req,'admin');if(!id||!admins.has(id)||admins.get(id)<Date.now())return send(401,{error:'请先登录'});
 if(url.pathname==='/api/admin/logout'){admins.delete(id);return send(200,{ok:true});}
 if(url.pathname==='/api/admin/stats')return send(200,{online:sessions.size,waiting:[...sessions.values()].filter(s=>s.queued).length,reports:db.prepare('SELECT * FROM reports ORDER BY created DESC LIMIT 200').all(),bans:db.prepare('SELECT * FROM bans WHERE expires>?').all(Date.now())});
 if(url.pathname==='/api/admin/action'&&req.method==='POST'){const r=db.prepare('SELECT * FROM reports WHERE id=?').get(String(b.id));if(!r)return send(404,{error:'举报不存在'});if(!['ban','resolve','dismiss'].includes(b.action))return send(400,{error:'操作无效'});if(b.action==='ban'){db.prepare('INSERT OR REPLACE INTO bans VALUES(?,?)').run(r.target,Date.now()+86400000);for(const s of sessions.values())if(s.device===r.target)leave(s);}db.prepare('UPDATE reports SET status=? WHERE id=?').run(b.action,r.id);return send(200,{ok:true});}
 return send(404,{error:'找不到接口'});}
 if(url.pathname==='/api/session'&&req.method==='POST'){
 let s=sessions.get(cookie(req,'session'));if(!s){if(sessions.size>=2000)return send(503,{error:'当前人数已满'});const raw=cookie(req,'device');const device=/^[a-f0-9]{64}$/.test(raw||'')?raw:token();s={id:token(),device:hash(device),seen:Date.now(),state:'idle',messages:[],blocked:new Set(),peer:null,queued:false,last:0};sessions.set(s.id,s);res.setHeader('Set-Cookie',[`session=${s.id}; HttpOnly; SameSite=Strict; Path=/${process.env.COOKIE_SECURE==='true'?'; Secure':''}`,`device=${device}; HttpOnly; SameSite=Strict; Max-Age=31536000; Path=/${process.env.COOKIE_SECURE==='true'?'; Secure':''}`]);}s.seen=Date.now();return send(200,view(s));}
 const s=sessions.get(cookie(req,'session'));if(!s)return send(401,{error:'会话已过期，请刷新页面'});s.seen=Date.now();if(banned(s)){leave(s);return send(403,{error:'当前设备已被限制使用'});}
 if(url.pathname==='/api/state'&&req.method==='GET')return send(200,view(s));
 if(req.method!=='POST')return send(405,{error:'请求方式无效'});
 if(url.pathname==='/api/join'){if(!['male','female'].includes(b.gender)||!['random','opposite'].includes(b.mode))return send(400,{error:'请选择配对选项'});if(Date.now()-s.last<800)return send(429,{error:'操作太快'});leave(s);s.gender=b.gender;s.mode=b.mode;s.phrase=hash(String(b.phrase||'').trim().slice(0,64));s.last=Date.now();s.messages=[];match(s);return send(200,view(s));}
 if(url.pathname==='/api/leave'){leave(s);return send(200,view(s));}
 if(url.pathname==='/api/message'){const p=sessions.get(s.peer);if(!p||s.state!=='chat')return send(409,{error:'对话已结束'});if(Date.now()-s.last<400)return send(429,{error:'发送太快，请稍候'});const text=String(b.text||'').trim();if(!text||text.length>1000)return send(400,{error:'消息须为 1–1000 字'});const quoted=b.reply?s.messages.find(m=>m.id===b.reply):null;if(b.reply&&!quoted)return send(400,{error:'引用消息不存在'});const m={id:token().slice(0,16),text,time:Date.now(),reply:quoted?{text:quoted.text.slice(0,100),id:quoted.id}:null};s.messages.push({...m,mine:true});p.messages.push({...m,mine:false});s.messages=s.messages.slice(-100);p.messages=p.messages.slice(-100);s.last=Date.now();return send(200,view(s));}
 if(url.pathname==='/api/report'){const p=sessions.get(s.peer);if(!p)return send(409,{error:'对话已结束'});if(!['harassment','spam','sexual','other'].includes(b.reason))return send(400,{error:'请选择举报原因'});db.prepare('INSERT INTO reports VALUES(?,?,?,?,?,?)').run(token().slice(0,16),p.device,b.reason,JSON.stringify(s.messages.slice(-30)),'open',Date.now());s.blocked.add(p.device);p.blocked.add(s.device);leave(s);return send(200,{...view(s),reported:true});}
 send(404,{error:'找不到接口'});
 }catch(e){send(400,{error:e instanceof SyntaxError?'请求格式错误':'请求失败，请稍后再试'});}
});
if(process.env.NODE_ENV!=='test')server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('聊天服务已启动，端口 '+(process.env.PORT||3000)));
