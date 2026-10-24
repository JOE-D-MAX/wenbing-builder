import { getStorage, setting } from './runtime';
import { publicOrigin, requestOrigin } from './request';
import { randomBytes, createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { readBrief } from './brief';
import { renderSite, validateDraft } from './generator';
import { queryTrade, tradeMatches, paymentConfigIssues, PAYMENT_WINDOW_MS, type PayConfig, type Trade } from './alipay';
import { PRICING, priceFor } from './pricing';

type Order={recovery_hash:string; recoveryCode?:string; id:string;owner_hash:string;request_key:string;site_key:string;name:string;amount:number;state:string;trade_no:string|null;created_at:number;paid_at:number|null;published_at:number|null;last_checked_at:number|null;ip_hash:string};
export function commerceConfig(){
  const origin=publicOrigin()||'';
  const config:PayConfig={appId:setting('ALIPAY_APP_ID'),sellerId:setting('ALIPAY_SELLER_ID'),privateKey:setting('ALIPAY_PRIVATE_KEY'),publicKey:setting('ALIPAY_PUBLIC_KEY'),origin};
  const configured=paymentConfigIssues(config).length===0;
  const {db,bucket}=getStorage();
  return {config,prices:PRICING,ready:setting('FORMA_SALES_ENABLED')==='true'&&configured&&!!db&&!!bucket,
    support:setting('FORMA_SUPPORT_EMAIL'),mobilePayment:setting('ALIPAY_WAP_PAY_ENABLED')==='true'};
}
export const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export function guest(request:Request){
  const found=request.headers.get('cookie')?.match(/(?:^|;\s*)forma_guest=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
  const token=found||randomBytes(32).toString('base64url');
  return {hash:digest(token),exists:!!found,cookie:`forma_guest=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${new URL(requestOrigin(request)).protocol==='https:'?'; Secure':''}`};
}
export function storage(){return getStorage();}
export async function ownedOrder(id:unknown,owner:string){
  if(typeof id!=='string'||!/^F[a-f0-9]{30}$/.test(id))throw new Error('订单不存在或无法访问。');
  const {db}=storage();const row=await db.prepare('SELECT * FROM orders WHERE id = ? AND owner_hash = ?').bind(id,owner).first<Order>();
  if(!row)throw new Error('订单不存在或此浏览器没有访问凭证。请使用下单时的浏览器。');return row;
}
export async function recoverOrder(id:unknown,code:unknown,owner:string){
  if(typeof id!=='string'||typeof code!=='string'||!/^F[a-f0-9]{30}$/.test(id)||!/^[A-Za-z0-9_-]{32}$/.test(code))throw new Error('领取凭证无效。');
  const {db}=storage();const row=await db.prepare('SELECT * FROM orders WHERE id=? AND recovery_hash=?').bind(id,digest(code)).first<Order>();
  if(!row)throw new Error('领取凭证无效。');
  const claimed=await db.prepare('UPDATE orders SET owner_hash=? WHERE id=? AND recovery_hash=?').bind(owner,id,row.recovery_hash).run();
  if(!claimed.meta.changes)throw new Error('领取凭证已更新，请使用最新的领取码。');
  return {...row,owner_hash:owner};
}
export async function issueReceipt(id:unknown,owner:string){
  const order=await ownedOrder(id,owner),{db}=storage();
  const recoveryCode=randomBytes(24).toString('base64url'),recovery_hash=digest(recoveryCode);
  const updated=await db.prepare('UPDATE orders SET recovery_hash=? WHERE id=? AND owner_hash=? AND recovery_hash=?').bind(recovery_hash,order.id,owner,order.recovery_hash).run();
  if(!updated.meta.changes)throw new Error('订单凭证已变更，请重新读取订单后再试。');
  return {...order,recovery_hash,recoveryCode};
}
export async function createOrder(request:Request,input:{brief:unknown;requestKey:unknown;quotedPrice:unknown;tier?:unknown},owner:string){
  const c=commerceConfig();if(!c.ready)throw new Error('暂未开放购买。支付宝收款配置完成后才能下单。');
  if((input.tier??'template')!=='template')throw new Error('该档次暂未开放购买。当前仅支持模板基础款。');
  if(typeof input.requestKey!=='string'||!/^[-a-zA-Z0-9]{16,64}$/.test(input.requestKey))throw new Error('请求编号无效，请刷新重试。');
  const d=readBrief(input.brief),{db,bucket}=storage();
  const old=await db.prepare('SELECT * FROM orders WHERE owner_hash = ? AND request_key = ?').bind(owner,input.requestKey).first<Order>();
  if(old)return old;
  const price=priceFor(d.kind,'template');
  if(input.quotedPrice!==price)throw new Error('报价与所选网站类型不一致，请刷新页面后重新确认。');
  // Only a private reverse proxy that overwrites this header may enable this switch.
  const proxyIp=setting('FORMA_TRUST_PROXY')==='true'?request.headers.get('x-forma-client-ip')||'':'';
  const ip=digest(isIP(proxyIp)?proxyIp:owner),now=Date.now();
  const rate=await db.prepare('SELECT COUNT(*) AS n FROM orders WHERE created_at > ? AND (ip_hash = ? OR owner_hash = ?)').bind(now-3600000,ip,owner).first<{n:number}>();
  if((rate?.n||0)>=8)throw new Error('创建次数较多，请一小时后再试。');
  const recoveryCode=randomBytes(24).toString('base64url');
  const order:Order={recovery_hash:digest(recoveryCode),recoveryCode,id:'F'+randomBytes(15).toString('hex'),owner_hash:owner,request_key:input.requestKey,site_key:randomBytes(18).toString('hex'),name:d.name,amount:price,state:'pending',trade_no:null,created_at:now,paid_at:null,published_at:null,last_checked_at:null,ip_hash:ip};
  await bucket.put(`drafts/${order.id}.json`,JSON.stringify(d),{httpMetadata:{contentType:'application/json'}});
  try {await db.prepare('INSERT INTO orders (id,owner_hash,request_key,site_key,name,amount,state,created_at,ip_hash,recovery_hash) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(order.id,owner,order.request_key,order.site_key,order.name,order.amount,'pending',now,ip,order.recovery_hash).run();}
  catch(error){await bucket.delete(`drafts/${order.id}.json`);const existing=await db.prepare('SELECT * FROM orders WHERE owner_hash = ? AND request_key = ?').bind(owner,order.request_key).first<Order>();if(existing)return existing;throw error;}
  return order;
}
export async function fulfill(order:Order){
  const {db,bucket}=storage();
  const latest=await db.prepare('SELECT * FROM orders WHERE id = ?').bind(order.id).first<Order>();
  if(!latest||latest.state!=='paid')throw new Error('订单尚未确认付款。');
  if(latest.published_at)return latest;
  const file=await bucket.get(`drafts/${order.id}.json`);if(!file)throw new Error('设计资料暂不可用，请联系服务方。');
  const html=renderSite(validateDraft(await file.json()));
  await bucket.put(`sites/${latest.site_key}.html`,html,{httpMetadata:{contentType:'text/html;charset=utf-8'}});
  await db.prepare("UPDATE orders SET published_at = ? WHERE id = ? AND state = 'paid' AND published_at IS NULL").bind(Date.now(),latest.id).run();
  return {...latest,published_at:Date.now()};
}
export async function confirmTrade(id:string,trade:Trade,notification=false){
  const {db}=storage(),c=commerceConfig();
  const row=await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Order>();
  if(!row||!trade.trade_no||!tradeMatches(trade,row,c.config,notification))throw new Error('付款信息与订单不匹配。');
  if(row.trade_no&&row.trade_no!==trade.trade_no)throw new Error('交易编号不匹配。');
  await db.prepare("UPDATE orders SET state='paid', trade_no=?, paid_at=COALESCE(paid_at,?) WHERE id=? AND state IN ('pending','paid')").bind(trade.trade_no,Date.now(),row.id).run();
  return fulfill({...row,state:'paid'});
}
export async function refreshOrder(order:Order){
  if(order.state==='paid')return fulfill(order);
  if(Date.now()-(order.last_checked_at||0)<5000)return order;
  const c=commerceConfig();if(!c.config.appId||!c.config.privateKey||!c.config.publicKey)return order;
  const {db}=storage();const claimed=await db.prepare('UPDATE orders SET last_checked_at=? WHERE id=? AND (last_checked_at IS NULL OR last_checked_at < ?)').bind(Date.now(),order.id,Date.now()-5000).run();
  if(!claimed.meta.changes)return order;
  const trade=await queryTrade(c.config,order.id);
  if(trade&&['TRADE_SUCCESS','TRADE_FINISHED'].includes(trade.trade_status||''))return confirmTrade(order.id,trade);
  return order;
}
export function orderView(order:Order){
  const {config,ready}=commerceConfig();const published=order.state==='paid'&&!!order.published_at;
  const expiresAt=order.created_at+PAYMENT_WINDOW_MS;
  return {id:order.id,name:order.name,amount:order.amount,state:order.state,published,url:published?`${config.origin}/s/${order.site_key}`:null,
    checkoutUrl:ready&&order.state==='pending'&&Date.now()<expiresAt?`/api/payments/alipay/checkout?order=${encodeURIComponent(order.id)}`:null,
    expiresAt,expired:order.state==='pending'&&Date.now()>=expiresAt};
}
