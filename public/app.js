const $=s=>document.querySelector(s);
const words={
  "sc": {
    "eyebrow": "匿名文字聊天室",
    "headline": "找个人，聊两句。",
    "subtitle": "不用账号，不用自我介绍。<br>选好配对方式，就可以开始。",
    "anonymous": "无需注册",
    "instant": "即时配对",
    "private": "匿名交流",
    "privacy": "请勿透露真实姓名、地址或财务信息。一般消息仅暂存在内存；举报会保存最近 30 条消息供审核。",
    "admin": "管理",
    "report": "举报",
    "setupTitle": "开始聊天",
    "setupHint": "双方的配对条件相符后，即可连接。",
    "gender": "我是",
    "male": "男生",
    "female": "女生",
    "mode": "想聊",
    "random": "随机",
    "opposite": "异性",
    "phrase": "密语",
    "phraseHint": "相同密语才能配对，仍须符合双方性别偏好。",
    "consent": "我已阅读并同意聊天守则",
    "start": "开始配对",
    "send": "发送",
    "leave": "结束对话",
    "again": "再次配对",
    "replyHint": "点击消息即可引用回复",
    "ad": "广告",
    "adHint": "",
    "footer": "请勿分享个人资料。遇到骚扰，可使用聊天室右上方的举报。",
    "reportTitle": "举报这位聊天对象",
    "reportHint": "提交最近 30 条消息供管理员审核，并结束对话。",
    "harassment": "骚扰或辱骂",
    "spam": "广告或诈骗",
    "sexual": "不当色情内容",
    "other": "其他违规行为",
    "cancel": "取消",
    "submitReport": "举报并结束",
    "idle": "尚未连接",
    "waiting": "正在等待配对",
    "chat": "对方已连接",
    "ended": "对方已离开",
    "welcome": "对方已连接",
    "waitHint": "配对中…",
    "endHint": "对话已结束",
    "placeholder": "输入消息…",
    "needConsent": "请先同意文明交流约定。",
    "reported": "举报已提交，谢谢你帮助维护聊天环境。",
    "reply": "回复",
    "me": "你",
    "stranger": "对方",
    "online": "人在线",
    "roomInfo": "一对一 · 纯文字",
    "rulesTitle": "聊之前，请记住",
    "rules": "不骚扰、不发广告。性别由使用者自行填写。",
    "brandNote": "匿名聊天",
    "guidelines": "聊天守则与隐私",
    "phrasePlaceholder": "选填"
  },
  "tc": {
    "eyebrow": "匿名文字聊天室",
    "headline": "找個人，聊兩句。",
    "subtitle": "不用帳號，不用自我介紹。<br>選好配對方式，就可以開始。",
    "anonymous": "無需註冊",
    "instant": "即時配對",
    "private": "匿名交流",
    "privacy": "請勿透露真實姓名、地址或財務資訊。一般訊息僅暫存在記憶體；檢舉會保存最近 30 則訊息供審核。",
    "admin": "管理",
    "report": "檢舉",
    "setupTitle": "開始聊天",
    "setupHint": "雙方的配對條件相符後，即可連線。",
    "gender": "我是",
    "male": "男生",
    "female": "女生",
    "mode": "想聊",
    "random": "隨機",
    "opposite": "異性",
    "phrase": "密語",
    "phraseHint": "相同密語才能配對，仍須符合雙方性別偏好。",
    "consent": "我已閱讀並同意聊天守則",
    "start": "開始配對",
    "send": "傳送",
    "leave": "結束對話",
    "again": "再次配對",
    "replyHint": "點擊訊息即可引用回覆",
    "ad": "廣告",
    "adHint": "",
    "footer": "請勿分享個人資料。遇到騷擾，可使用聊天室右上方的檢舉。",
    "reportTitle": "檢舉這位聊天對象",
    "reportHint": "提交最近 30 則訊息供管理員審核，並結束對話。",
    "harassment": "騷擾或辱罵",
    "spam": "廣告或詐騙",
    "sexual": "不當色情內容",
    "other": "其他違規行為",
    "cancel": "取消",
    "submitReport": "檢舉並結束",
    "idle": "尚未連線",
    "waiting": "正在等待配對",
    "chat": "對方已連線",
    "ended": "對方已離開",
    "welcome": "對方已連線",
    "waitHint": "配對中…",
    "endHint": "對話已結束",
    "placeholder": "輸入訊息…",
    "needConsent": "請先同意文明交流約定。",
    "reported": "檢舉已提交，謝謝你幫助維護聊天環境。",
    "reply": "回覆",
    "me": "你",
    "stranger": "對方",
    "online": "人在線",
    "roomInfo": "一對一 · 純文字",
    "rulesTitle": "聊之前，請記住",
    "rules": "不騷擾、不發廣告。性別由使用者自行填寫。",
    "brandNote": "匿名聊天",
    "guidelines": "聊天守則與隱私",
    "phrasePlaceholder": "選填"
  }
};
let lang=localStorage.getItem('lang')==='tc'?'tc':'sc',state={state:'idle',messages:[]},reply=null,lastSignature='',busy=false;
const t=k=>words[lang][k]??k;
async function api(path,data){const r=await fetch('/api/'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const v=await r.json();if(!r.ok)throw Error(v.error);return v;}
function error(e){$('#error').textContent=e.message||'';}
function translate(){document.documentElement.lang=lang==='sc'?'zh-Hans':'zh-Hant';document.title=lang==='sc'?'遇见 · 匿名聊天':'遇見 · 匿名聊天';$('.brand').firstChild.textContent=lang==='sc'?'遇见':'遇見';document.querySelectorAll('[data-i]').forEach(el=>{el.innerHTML=t(el.dataset.i);});$('#lang').textContent=lang==='sc'?'繁體中文':'简体中文';$('#text').placeholder=t('placeholder');$('#phrase').placeholder=t('phrasePlaceholder');lastSignature='';render();}
function render(){document.body.dataset.state=state.state;const active=state.state!=='idle';$('#setup').hidden=active;$('#conversation').hidden=!active;$('#status').textContent=t(state.state);$('#online').textContent=`● ${state.online||0} ${t('online')}`;$('#report').disabled=state.state!=='chat';$('#send').disabled=$('#text').disabled=state.state!=='chat';$('#leave').hidden=state.state==='ended';$('#leave').textContent=state.state==='waiting'?t('cancel'):t('leave');$('#again').hidden=state.state!=='ended';
 const sig=JSON.stringify([state.state,state.messages,lang]);if(sig===lastSignature)return;lastSignature=sig;const box=$('#messages'),nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<80;box.replaceChildren();if(state.state==='waiting'||state.state==='ended'||!state.messages.length){const e=document.createElement('div');e.className='system';e.innerHTML=t(state.state==='waiting'?'waitHint':state.state==='ended'?'endHint':'welcome');box.append(e);}for(const m of state.messages){const el=document.createElement('button');el.type='button';el.className='message'+(m.mine?' mine':'');el.title=t('reply');if(m.reply){const q=document.createElement('blockquote');q.textContent=m.reply.text;el.append(q);}const text=document.createElement('span');text.textContent=m.text;el.append(text);const time=document.createElement('small');time.textContent=(m.mine?t('me'):t('stranger'))+' · '+new Date(m.time).toLocaleTimeString(lang==='sc'?'zh-CN':'zh-TW',{hour:'2-digit',minute:'2-digit'});el.append(time);el.onclick=()=>{if(state.state!=='chat')return;reply=m;$('#reply').hidden=false;$('#reply span').textContent=t('reply')+'：'+m.text;$('#text').focus();};box.append(el);}if(nearBottom)box.scrollTop=box.scrollHeight;if(state.state!=='chat')clearReply();}
function clearReply(){reply=null;$('#reply').hidden=true;}
async function action(fn){if(busy)return;busy=true;error({});try{await fn();}catch(e){error(e);}finally{busy=false;}}
async function join(){if(!$('#consent').checked)throw Error(t('needConsent'));state=await api('join',{gender:$('input[name=gender]:checked').value,mode:$('input[name=mode]:checked').value,phrase:$('#phrase').value});$('#text').value='';clearReply();render();}
$('#join').onclick=()=>action(join);$('#again').onclick=()=>action(join);$('#leave').onclick=()=>action(async()=>{state=await api('leave',{});clearReply();render();});$('#cancelReply').onclick=clearReply;
$('#lang').onclick=()=>{lang=lang==='sc'?'tc':'sc';localStorage.setItem('lang',lang);translate();};
for(const emoji of ['😀','😂','🥰','😢','👍']){const b=document.createElement('button');b.type='button';b.textContent=emoji;b.onclick=()=>{if(!$('#text').disabled&&$('#text').value.length+emoji.length<=1000){$('#text').value+=emoji;$('#text').focus();}};$('#emojis').append(b);}
$('#composer').onsubmit=e=>{e.preventDefault();action(async()=>{if(!$('#text').value.trim())return;state=await api('message',{text:$('#text').value,reply:reply?.id});$('#text').value='';clearReply();render();$('#messages').scrollTop=$('#messages').scrollHeight;});};
$('#text').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#composer').requestSubmit();}};
$('#report').onclick=()=>$('#reportDialog').showModal();$('#cancelReport').onclick=()=>$('#reportDialog').close();$('#reportForm').onsubmit=e=>{e.preventDefault();action(async()=>{state=await api('report',{reason:$('#reason').value});$('#reportDialog').close();render();error({message:t('reported')});});};
translate();
try{state=await api('session',{});render();}catch(e){error(e);}
setInterval(async()=>{try{state=await api('state');render();}catch(e){error(e);}},1500);
// AdSense is loaded only when both publisher and slot IDs are configured.
try{const c=await api('config');if(/^ca-pub-\d+$/.test(c.adsClient)&&/^\d+$/.test(c.adsSlot)){const box=$('#ad');box.hidden=false;box.replaceChildren();const label=document.createElement('small');label.dataset.i='ad';label.textContent=t('ad');box.append(label);const ad=document.createElement('ins');ad.className='adsbygoogle';ad.style.display='block';ad.dataset.adClient=c.adsClient;ad.dataset.adSlot=c.adsSlot;ad.dataset.adFormat='auto';ad.dataset.fullWidthResponsive='true';box.append(ad);const s=document.createElement('script');s.async=true;s.crossOrigin='anonymous';s.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+c.adsClient;s.onload=()=>{(window.adsbygoogle=window.adsbygoogle||[]).push({});};document.head.append(s);}}catch{}
