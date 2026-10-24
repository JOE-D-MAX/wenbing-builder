import { createSign, createVerify, createPrivateKey, createPublicKey } from 'node:crypto';

export type PayConfig = { appId:string; sellerId:string; privateKey:string; publicKey:string; origin:string };
export type Trade = { out_trade_no?:string; trade_no?:string; total_amount?:string; trade_status?:string; seller_id?:string; app_id?:string; code?:string };
export const ALIPAY_GATEWAY='https://openapi.alipay.com/gateway.do';
export const PAYMENT_WINDOW_MS=30*60*1000;
export type PaymentChannel='page'|'wap';
const chinaTime=(time:number)=>new Date(time+8*3600000).toISOString().slice(0,19).replace('T',' ');
export function cents(value:unknown) {
  if(typeof value==='number'&&Number.isFinite(value))value=String(value);
  if(typeof value!=='string'||!/^\d{1,8}(\.\d{1,2})?$/.test(value))return -1;
  const [whole,fraction='']=value.split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
export function canonical(params:Record<string,string>) {return Object.keys(params).filter(k=>k!=='sign'&&k!=='sign_type'&&params[k]!=='').sort().map(k=>`${k}=${params[k]}`).join('&');}
function pem(key:string,kind:'PRIVATE'|'PUBLIC') {return key.includes('-----BEGIN')?key.replace(/\\n/g,'\n'):`-----BEGIN ${kind} KEY-----\n${key}\n-----END ${kind} KEY-----`;}
export function paymentConfigIssues(config:PayConfig) {
  const issues:string[]=[];
  if(!/^\d{10,32}$/.test(config.appId))issues.push('ALIPAY_APP_ID');
  if(!/^\d{10,32}$/.test(config.sellerId))issues.push('ALIPAY_SELLER_ID');
  try {const origin=new URL(config.origin);if(origin.protocol!=='https:'||origin.origin!==config.origin||origin.username||origin.password)issues.push('FORMA_PUBLIC_ORIGIN');}catch{issues.push('FORMA_PUBLIC_ORIGIN');}
  for(const [name,value,kind] of [['ALIPAY_PRIVATE_KEY',config.privateKey,'PRIVATE'],['ALIPAY_PUBLIC_KEY',config.publicKey,'PUBLIC']] as const){
    try {const key=kind==='PRIVATE'?createPrivateKey(pem(value,kind)):createPublicKey(pem(value,kind));if(key.asymmetricKeyType!=='rsa'||(key.asymmetricKeyDetails?.modulusLength||0)<2048)issues.push(name);}catch{issues.push(name);}
  }
  return issues;
}
export function verifySignature(text:string,signature:string,publicKey:string) {
  try {const verifier=createVerify('RSA-SHA256');verifier.update(text,'utf8');return verifier.verify(pem(publicKey,'PUBLIC'),signature,'base64');}catch{return false;}
}
function params(config:PayConfig,method:string,biz:object) {
  const timestamp=chinaTime(Date.now());
  return {app_id:config.appId,method,format:'JSON',charset:'utf-8',sign_type:'RSA2',timestamp,version:'1.0',biz_content:JSON.stringify(biz)} as Record<string,string>;
}
function signed(config:PayConfig,p:Record<string,string>) {
  // Request signing includes sign_type; notification verification excludes it.
  const text=Object.keys(p).filter(k=>k!=='sign'&&p[k]!=='').sort().map(k=>`${k}=${p[k]}`).join('&');
  const signer=createSign('RSA-SHA256');signer.update(text,'utf8');return {...p,sign:signer.sign(pem(config.privateKey,'PRIVATE'),'base64')};
}
export function paymentUrl(config:PayConfig,order:{id:string;amount:number;created_at:number},channel:PaymentChannel='page') {
  const returnUrl=`${config.origin}/checkout?order=${encodeURIComponent(order.id)}`;
  // An absolute expiry prevents refreshing a link from extending the payment window.
  const p=params(config,channel==='wap'?'alipay.trade.wap.pay':'alipay.trade.page.pay',{out_trade_no:order.id,total_amount:(order.amount/100).toFixed(2),subject:'文炳建站 网站设计与发布',product_code:channel==='wap'?'QUICK_WAP_WAY':'FAST_INSTANT_TRADE_PAY',time_expire:chinaTime(order.created_at+PAYMENT_WINDOW_MS),...(channel==='wap'?{quit_url:returnUrl}:{})});
  p.return_url=returnUrl;
  p.notify_url=`${config.origin}/api/payments/alipay/notify`;
  return `${ALIPAY_GATEWAY}?${new URLSearchParams(signed(config,p))}`;
}
// Signatures cover the literal response object, not a reserialized JSON object.
export function signedObject(raw:string,key:string) {
  const match=new RegExp(`"${key}"\\s*:\\s*`).exec(raw);if(!match)throw new Error('支付响应格式无效');
  const start=match.index+match[0].length;if(raw[start]!=='{')throw new Error('支付响应格式无效');
  let depth=0,string=false,escape=false;
  for(let i=start;i<raw.length;i++){const c=raw[i];if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;}else if(c==='"')string=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return raw.slice(start,i+1);}
  throw new Error('支付响应不完整');
}
export async function queryTrade(config:PayConfig,id:string):Promise<Trade|null> {
  const response=await fetch(ALIPAY_GATEWAY,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(signed(config,params(config,'alipay.trade.query',{out_trade_no:id}))),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('暂时无法连接支付宝，请稍后检查订单。');
  const raw=await response.text();if(raw.length>100000)throw new Error('支付响应过长');
  const data=JSON.parse(raw),object=signedObject(raw,'alipay_trade_query_response');
  if(!verifySignature(object,data.sign,config.publicKey))throw new Error('支付宝响应验签失败，请稍后重试。');
  const result=JSON.parse(object);
  if(result.code==='40004'&&result.sub_code==='ACQ.TRADE_NOT_EXIST')return null;
  if(result.code!=='10000')throw new Error('暂时无法确认付款，请稍后检查订单。');
  return result;
}
export function tradeMatches(trade:Trade,order:{id:string;amount:number},config:PayConfig,notification=false) {
  return trade.out_trade_no===order.id&&cents(trade.total_amount)===order.amount&&!!trade.trade_no&&
    ['TRADE_SUCCESS','TRADE_FINISHED'].includes(trade.trade_status||'')&&
    (notification?trade.seller_id===config.sellerId:!trade.seller_id||trade.seller_id===config.sellerId)&&
    (notification?trade.app_id===config.appId:!trade.app_id||trade.app_id===config.appId);
}
export function verifyNotification(form:URLSearchParams,config:PayConfig):Trade {
  const p:Record<string,string>={};for(const [key,value] of form){if(key in p)throw new Error('重复支付参数');p[key]=value;}
  if(p.sign_type!=='RSA2'||!verifySignature(canonical(p),p.sign,config.publicKey)||p.app_id!==config.appId||p.seller_id!==config.sellerId)throw new Error('支付通知无效');
  return p;
}
