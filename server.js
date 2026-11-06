import http from 'node:http';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
mkdirSync(root+'data',{recursive:true});
const db=new DatabaseSync(process.env.DB_PATH||root+'data/moderation.sqlite');
db.exec('CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,target TEXT,reason TEXT,evidence TEXT,status TEXT,created INTEGER); CREATE TABLE IF NOT EXISTS bans(target TEXT PRIMARY KEY,expires INTEGER)');
const sessions=new Map(), admins=new Map(), attempts=new Map(), creations=new Map();
// Behind a reverse proxy set TRUST_PROXY=true so the proxy-appended X-Forwarded-For entry is used instead of the proxy's own address.
const clientIp=req=>process.env.TRUST_PROXY==='true'&&req.headers['x-forwarded-for']?req.headers['x-forwarded-for'].split(',').at(-1).trim():req.socket.remoteAddress;
const secret=process.env.ADMIN_PASSWORD;
const token=()=>randomBytes(32).toString('hex');
const hash=s=>createHash('sha256').update(s).digest('hex');
const cookie=(req,name)=>req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);
const banned=s=>!!db.prepare('SELECT 1 FROM bans WHERE target=? AND expires>?').get(s.device,Date.now());
function leave(s){s.queued=false;if(s.peer){const p=sessions.get(s.peer);if(p){p.peer=null;p.state='ended';p.lastPeer=s.device;}s.peer=null;}s.lastPeer=null;s.state='idle';}
function expire(){for(const [id,s] of sessions)if(Date.now()-s.seen>90000){leave(s);sessions.delete(id);}for(const [id,t]of admins)if(t<Date.now())admins.delete(id);for(const m of [attempts,creations])for(const[k,a]of m)if(a.until<Date.now())m.delete(k);}
setInterval(expire,10000).unref();
const compatible=(a,b)=>a.phrase===b.phrase&&(a.mode==='random'||a.gender!==b.gender)&&(b.mode==='random'||a.gender!==b.gender)&&a.device!==b.device&&!a.blocked.has(b.device)&&!b.blocked.has(a.device);
function match(s){for(const p of sessions.values())if(p!==s&&p.queued&&!banned(p)&&compatible(s,p)){s.peer=p.id;p.peer=s.id;s.state=p.state='chat';s.queued=p.queued=false;s.messages=[];p.messages=[];s.chat=p.chat=token().slice(0,16);return;}s.queued=true;s.state='waiting';}
// Online/waiting counts are polled by every client; recount at most once per second instead of on every request.
let counts={at:0,online:0,waiting:0};
function stats(){if(Date.now()-counts.at>1000){let waiting=0;for(const x of sessions.values())if(x.queued)waiting++;counts={at:Date.now(),online:sessions.size,waiting};}return counts;}
// With ?chat=<id>&since=<seq> matching the current chat, only newer messages are returned (delta:true); otherwise the full list.
function view(s,url){const since=Number(url?.searchParams.get('since')),delta=!!url&&url.searchParams.get('chat')===s.chat&&Number.isInteger(since)&&since>=0;const {online,waiting}=stats();return {state:s.state,chat:s.chat,delta,messages:delta?s.messages.filter(m=>m.seq>since):s.messages,online,waiting};}
function push(x,m){x.messages.push({...m,seq:++x.seq});if(x.messages.length>100)x.messages=x.messages.slice(-100);}
async function body(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384)throw Object.assign(Error('内容过长'),{status:413});chunks.push(chunk);}const text=Buffer.concat(chunks).toString('utf8');return JSON.parse(text||'{}');}
const equal=(a,b)=>{const x=Buffer.from(hash(a)),y=Buffer.from(hash(b));return timingSafeEqual(x,y);};
export const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&!url.pathname.startsWith('/api/')){const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/admin':'admin.html','/admin.js':'admin.js','/errors.js':'errors.js'};const f=files[url.pathname];if(!f)return send(404,{error:'找不到页面'});res.setHeader('Content-Type',f.endsWith('js')?'text/javascript; charset=utf-8':f.endsWith('css')?'text/css; charset=utf-8':'text/html; charset=utf-8');return res.end(readFileSync(root+'public/'+f));}
 if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'请求来源无效'});
 if(url.pathname==='/api/config')return send(200,{adsClient:process.env.ADSENSE_CLIENT||'',adsSlot:process.env.ADSENSE_SLOT||''});
 const b=req.method==='POST'?await body(req):{};
 if(url.pathname==='/api/admin/login'&&req.method==='POST'){
 const ip=clientIp(req),a=attempts.get(ip);if(a&&a.n>=8&&a.until>Date.now())return send(429,{error:'请稍后重试'});
 if(!secret||secret.length<16)return send(503,{error:'尚未配置管理员密码（至少 16 个字符）'});
 if(!equal(String(b.password||''),secret)){const f=a&&a.until>Date.now()?a:{n:0,until:Date.now()+900000};f.n++;attempts.set(ip,f);return send(401,{error:'密码错误'});}
 attempts.delete(ip);const id=token();admins.set(id,Date.now()+3600000);res.setHeader('Set-Cookie',`admin=${id}; HttpOnly; SameSite=Strict; Path=/api/admin${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);return send(200,{ok:true});}
 if(url.pathname.startsWith('/api/admin/')){
 const id=cookie(req,'admin');if(!id||!admins.has(id)||admins.get(id)<Date.now())return send(401,{error:'请先登录'});
 if(url.pathname==='/api/admin/logout'){admins.delete(id);return send(200,{ok:true});}
 if(url.pathname==='/api/admin/stats')return send(200,{online:sessions.size,waiting:[...sessions.values()].filter(s=>s.queued).length,reports:db.prepare('SELECT * FROM reports ORDER BY created DESC LIMIT 200').all(),bans:db.prepare('SELECT * FROM bans WHERE expires>?').all(Date.now())});
 if(url.pathname==='/api/admin/action'&&req.method==='POST'){const r=db.prepare('SELECT * FROM reports WHERE id=?').get(String(b.id));if(!r)return send(404,{error:'举报不存在'});if(!['ban','resolve','dismiss'].includes(b.action))return send(400,{error:'操作无效'});if(b.action==='ban'){db.prepare('INSERT OR REPLACE INTO bans VALUES(?,?)').run(r.target,Date.now()+86400000);for(const s of sessions.values())if(s.device===r.target)leave(s);}db.prepare('UPDATE reports SET status=? WHERE id=?').run(b.action,r.id);return send(200,{ok:true});}
 return send(404,{error:'找不到接口'});}
 if(url.pathname==='/api/session'&&req.method==='POST'){
 let s=sessions.get(cookie(req,'session'));if(!s){const ip=clientIp(req),c=creations.get(ip)?.until>Date.now()?creations.get(ip):{n:0,until:Date.now()+60000};if(c.n>=30)return send(429,{error:'操作太频繁，请稍后再试'});c.n++;creations.set(ip,c);if(sessions.size>=2000)return send(503,{error:'当前人数已满'});const raw=cookie(req,'device');const device=/^[a-f0-9]{64}$/.test(raw||'')?raw:token();s={id:token(),device:hash(device),seen:Date.now(),state:'idle',messages:[],seq:0,chat:token().slice(0,16),blocked:new Set(),peer:null,lastPeer:null,queued:false,last:0};sessions.set(s.id,s);res.setHeader('Set-Cookie',[`session=${s.id}; HttpOnly; SameSite=Strict; Path=/${process.env.COOKIE_SECURE==='true'?'; Secure':''}`,`device=${device}; HttpOnly; SameSite=Strict; Max-Age=31536000; Path=/${process.env.COOKIE_SECURE==='true'?'; Secure':''}`]);}s.seen=Date.now();return send(200,view(s));}
 const s=sessions.get(cookie(req,'session'));if(!s)return send(401,{error:'会话已过期，请刷新页面'});s.seen=Date.now();if(banned(s)){leave(s);return send(403,{error:'当前设备已被限制使用'});}
 if(url.pathname==='/api/state'&&req.method==='GET')return send(200,view(s,url));
 if(req.method!=='POST')return send(405,{error:'请求方式无效'});
 if(url.pathname==='/api/join'){if(b.consent!==true)return send(400,{error:'请确认已年满 18 岁并同意文明交流约定'});if(!['male','female'].includes(b.gender)||!['random','opposite'].includes(b.mode))return send(400,{error:'请选择配对选项'});if(Date.now()-s.last<800)return send(429,{error:'操作太快'});leave(s);s.gender=b.gender;s.mode=b.mode;s.phrase=hash(String(b.phrase||'').trim().slice(0,64));s.last=Date.now();s.messages=[];s.chat=token().slice(0,16);match(s);return send(200,view(s));}
 if(url.pathname==='/api/leave'){leave(s);return send(200,view(s));}
 if(url.pathname==='/api/message'){const p=sessions.get(s.peer);if(!p||s.state!=='chat')return send(409,{error:'对话已结束'});if(Date.now()-s.last<400)return send(429,{error:'发送太快，请稍候'});const text=String(b.text||'').trim();if(!text||text.length>1000)return send(400,{error:'消息须为 1–1000 字'});const quoted=b.reply?s.messages.find(m=>m.id===b.reply):null;if(b.reply&&!quoted)return send(400,{error:'引用消息不存在'});const m={id:token().slice(0,16),text,time:Date.now(),reply:quoted?{text:quoted.text.slice(0,100),id:quoted.id}:null};push(s,{...m,mine:true});push(p,{...m,mine:false});s.last=Date.now();return send(200,view(s));}
 if(url.pathname==='/api/report'){const p=sessions.get(s.peer),target=p?p.device:s.state==='ended'?s.lastPeer:null;if(!target)return send(409,{error:'对话已结束'});if(!['harassment','spam','sexual','other'].includes(b.reason))return send(400,{error:'请选择举报原因'});db.prepare('INSERT INTO reports VALUES(?,?,?,?,?,?)').run(token().slice(0,16),target,b.reason,JSON.stringify(s.messages.slice(-30).map(({seq,...m})=>m)),'open',Date.now());s.blocked.add(target);for(const x of sessions.values())if(x.device===target)x.blocked.add(s.device);leave(s);return send(200,{...view(s),reported:true});}
 send(404,{error:'找不到接口'});
 }catch(e){if(e.status===413)return send(413,{error:e.message});send(400,{error:e instanceof SyntaxError?'请求格式错误':'请求失败，请稍后再试'});}
});
if(process.env.NODE_ENV!=='test')server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('聊天服务已启动，端口 '+(process.env.PORT||3000)));
