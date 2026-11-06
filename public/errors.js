// Server errors are written in Simplified Chinese; this maps each one to Traditional Chinese.
// chat.test.js checks that every error string in server.js has an entry here.
export const NETWORK_ERROR='网络连接中断，正在重试…';
export const RECONNECTED='连接已恢复，可以重新开始配对。';
export const traditional={
 '内容过长':'內容過長',
 '举报不存在':'檢舉不存在',
 '会话已过期，请刷新页面':'工作階段已過期，請重新整理頁面',
 '发送太快，请稍候':'傳送太快，請稍候',
 '密码错误':'密碼錯誤',
 '对话已结束':'對話已結束',
 '尚未配置管理员密码（至少 16 个字符）':'尚未設定管理員密碼（至少 16 個字元）',
 '引用消息不存在':'引用的訊息不存在',
 '当前人数已满':'目前人數已滿',
 '当前设备已被限制使用':'目前裝置已被限制使用',
 '找不到接口':'找不到介面',
 '找不到页面':'找不到頁面',
 '操作太快':'操作太快',
 '操作太频繁，请稍后再试':'操作太頻繁，請稍後再試',
 '操作无效':'操作無效',
 '消息须为 1–1000 字':'訊息須為 1–1000 字',
 '请先登录':'請先登入',
 '请求方式无效':'請求方式無效',
 '请求来源无效':'請求來源無效',
 '请稍后重试':'請稍後重試',
 '请选择举报原因':'請選擇檢舉原因',
 '请选择配对选项':'請選擇配對選項',
 '请确认已年满 18 岁并同意文明交流约定':'請確認已年滿 18 歲並同意文明交流約定',
 '请求格式错误':'請求格式錯誤',
 '请求失败，请稍后再试':'請求失敗，請稍後再試',
 [NETWORK_ERROR]:'網路連線中斷，正在重試…',
 [RECONNECTED]:'連線已恢復，可以重新開始配對。'
};
export const localize=(message,lang)=>lang==='tc'?traditional[message]||message:message;
