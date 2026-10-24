'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Download, FileCheck2, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { PRICING, audienceFor, priceFor, type Pricing } from '@/lib/pricing';
import { checkoutStorageKey, readCheckoutDraft, type CheckoutDraft } from '@/lib/checkout-draft';
import { withRequestTimeout } from '@/lib/client-compat';
import './checkout.css';
import { StudioLanguageSwitch, useStudioI18n } from '@/components/studio/studio-i18n';

type Order = {id:string;name:string;amount:number;state:string;published:boolean;url:string|null;checkoutUrl:string|null;expiresAt:number;expired:boolean};
type Config = {prices:Pricing;ready:boolean;support:string};
type Preview = {name:string;kind:'personal'|'business'|'restaurant';theme:string;layout:string};
type OrderResponse = {order:Order;recoveryCode?:string;warning?:string};
type ReceiptRecord = {id:string;name:string;amount:number;code:string};
const orderIdValid = (value:string) => /^F[a-f0-9]{30}$/.test(value);
const codeValid = (value:string) => /^[A-Za-z0-9_-]{32}$/.test(value);
const money = (value:number) => '¥' + (value / 100).toFixed(value % 100 ? 2 : 0);
const themeNames:Record<string,string> = {forest:'森林墨绿',ink:'黑白极简',blue:'深蓝商务',clay:'陶土暖调'};
const layoutNames:Record<string,string> = {editorial:'编辑留白',studio:'品牌工作室',menu:'菜单画册'};
const paymentNotices = {
  expired:'这笔订单的付款入口已过期。若你已在支付宝完成付款，请检查付款与交付状态，勿重复付款。',
  unavailable:'支付宝付款入口暂时不可用，请稍后再试。若已付款，请先检查付款与交付状态。',
  unverified:'已返回订单页，正在向服务器查询付款结果。页面跳转不代表付款成功，请以这里的到账与交付状态为准。',
};
function stored(key:string) {try{return localStorage.getItem(key);}catch{return null;}}
function remember(key:string,value:string) {try{localStorage.setItem(key,value);return true;}catch{return false;}}
function receiptHistory():ReceiptRecord[] {
  try{const rows=JSON.parse(stored('forma-orders-v1')||'[]');return Array.isArray(rows)?rows.filter(r=>r&&typeof r.id==='string'&&orderIdValid(r.id)&&typeof r.name==='string'&&Number.isSafeInteger(r.amount)&&typeof r.code==='string'&&codeValid(r.code)).slice(0,10):[];}catch{return [];}
}
function knownCode(id:string) {return receiptHistory().find(r=>r.id===id)?.code||(stored('forma-order-id')===id?stored('forma-recovery-code')||'':'');}
async function api<T=OrderResponse>(path:string,body?:unknown):Promise<T> {
  let response:Response,result:(T & {error?:string})|null;
  try{({response,data:result}=await withRequestTimeout(async signal=>{const response=await fetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal});const data=await response.json().catch(()=>null) as (T & {error?:string})|null;return {response,data};}));}catch{throw new Error('网络暂时没有响应，请稍后重试。请勿重复付款。');}
  if(!response.ok||!result)throw new Error(result?.error||'暂时无法完成请求，请稍后重试。');return result;
}

export default function CheckoutPage() {
  const { t } = useStudioI18n();
  const [config,setConfig]=useState<Config>({prices:PRICING,ready:false,support:''});
  const [configLoaded,setConfigLoaded]=useState(false),[configError,setConfigError]=useState('');
  const [draft,setDraft]=useState<CheckoutDraft|null>(null),[preview,setPreview]=useState<Preview|null>(null),[html,setHtml]=useState('');
  const [order,setOrder]=useState<Order|null>(null),[code,setCode]=useState(''),[receiptDownloadedFor,setReceiptDownloadedFor]=useState(''),[receiptConfirmedFor,setReceiptConfirmedFor]=useState('');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[checking,setChecking]=useState(false),[consent,setConsent]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[history,setHistory]=useState<ReceiptRecord[]>([]);
  const [paymentNotice,setPaymentNotice]=useState(''),[isWechat,setIsWechat]=useState(false),[now,setNow]=useState(Date.now);
  const [recentId,setRecentId]=useState(''),[recoverId,setRecoverId]=useState(''),[recoverCode,setRecoverCode]=useState(''),[recoveryOpen,setRecoveryOpen]=useState(false);
  const activeOrder=useRef(''),epoch=useRef(0),statusInFlight=useRef('');
  const receiptSavedFor=order&&(receiptDownloadedFor===order.id||receiptConfirmedFor===order.id)?order.id:'';
  const amount=order?.amount??(draft?priceFor(draft.brief.kind,'template',config.prices):null);
  const editHref=draft?'/?editDraft='+encodeURIComponent(draft.id):'/studio';
  const title=order?.published?'你的网站，已正式上线。':order?.state==='paid'?'付款已确认，正在交付。':order?'查看付款与交付进度。':'确认设计，准备上线。';
  const hasPaymentWindow=!!order&&Number.isFinite(order.expiresAt)&&order.expiresAt>0;
  const remainingSeconds=order&&hasPaymentWindow?Math.max(0,Math.ceil((order.expiresAt-now)/1000)):0;
  const paymentExpired=!!order&&(order.expired||hasPaymentWindow&&remainingSeconds===0);
  const paymentWindow=Math.floor(remainingSeconds/60).toString().padStart(2,'0')+':'+(remainingSeconds%60).toString().padStart(2,'0');

  function saveReceiptRecord(current:Order,receiptCode:string) {
    remember('forma-order-id',current.id);remember('forma-recovery-code',codeValid(receiptCode)?receiptCode:'');setRecentId(current.id);
    if(!codeValid(receiptCode))return;
    const entries=[{id:current.id,name:current.name,amount:current.amount,code:receiptCode},...receiptHistory().filter(r=>r.id!==current.id)].slice(0,10);
    setHistory(entries);if(!remember('forma-orders-v1',JSON.stringify(entries)))setNotice('此浏览器无法保存领取码，请下载领取凭证妥善保管。');
  }
  function clearForOrder(id:string,receiptCode:string) {
    epoch.current++;activeOrder.current=id;setOrder(null);setDraft(null);setPreview(null);setHtml('');setCode(codeValid(receiptCode)?receiptCode:'');setReceiptDownloadedFor('');setReceiptConfirmedFor('');setConsent(false);setChecking(false);setError('');setNotice('');setPaymentNotice('');return epoch.current;
  }
  async function checkOrder(id:string,silent=false) {
    const version=epoch.current,token=id+':'+version;
    if(activeOrder.current!==id||statusInFlight.current===token)return;
    statusInFlight.current=token;if(!silent){setChecking(true);setError('');}
    try{
      const result=await api('/api/orders',{action:'status',orderId:id});if(epoch.current!==version||activeOrder.current!==id)return;
      setOrder(previous=>previous?.id===id&&(previous.published||previous.state==='paid'&&result.order.state!=='paid')?previous:result.order);
      setNotice(result.warning||'');
    }catch(e){if(!silent&&epoch.current===version)setError((e as Error).message);}
    finally{if(statusInFlight.current===token)statusInFlight.current='';if(epoch.current===version)setChecking(false);}
  }
  async function openOrder(id:string,receiptCode='',recover=false) {
    if(busy||loading||(!configLoaded&&!configError))return;
    if(!orderIdValid(id)||recover&&!codeValid(receiptCode)){setError('请输入有效的订单号和领取码。');return;}
    const version=clearForOrder(id,receiptCode);setLoading(true);
    window.history.replaceState(null,'','/checkout?order='+encodeURIComponent(id));
    try{
      const result=await api('/api/orders',recover?{action:'recover',orderId:id,code:receiptCode}:{action:'status',orderId:id});
      if(epoch.current!==version)return;
      setOrder(result.order);setNotice(result.warning||'');saveReceiptRecord(result.order,receiptCode);window.history.replaceState(null,'','/checkout?order='+encodeURIComponent(id));setRecoveryOpen(false);
      document.getElementById('checkout-title')?.focus();
    }catch(e){if(epoch.current===version){setError((e as Error).message);setRecoveryOpen(true);}}
    finally{if(epoch.current===version)setLoading(false);}
  }
  useEffect(()=>{
    let alive=true;const version=++epoch.current;
    setIsWechat(/MicroMessenger/i.test(navigator.userAgent));
    setHistory(receiptHistory());const recent=stored('forma-order-id');if(recent&&orderIdValid(recent))setRecentId(recent);
    api<Config>('/api/commerce').then(value=>{if(alive){setConfig(value);setConfigLoaded(true);}}).catch(()=>{if(alive)setConfigError('暂时无法读取收款服务状态，购买入口已关闭。请刷新后重试。');});
    const search=new URLSearchParams(location.search),id=search.get('order'),draftId=search.get('draft');
    const paymentReason=search.get('payment');
    if(paymentReason==='expired'||paymentReason==='unavailable'||paymentReason==='unverified')setPaymentNotice(paymentNotices[paymentReason]);
    setRecoveryOpen(location.hash==='#orders'||(!id&&!draftId));
    const load=async()=>{
      try{
        // An explicit order always wins, even if a draft query is also present.
        if(search.has('order')){
          if(!id||!orderIdValid(id))throw new Error('订单编号无效，请使用下方订单找回入口。');
          activeOrder.current=id;setCode(knownCode(id));
          const result=await api('/api/orders',{action:'status',orderId:id});if(!alive||epoch.current!==version)return;
          setOrder(result.order);setNotice(result.warning||'');
        }else if(search.has('draft')){
          if(!draftId)throw new Error('没有找到待发布资料，请返回制作页面重新预览。');
          let raw:string|null;try{raw=sessionStorage.getItem(checkoutStorageKey(draftId));}catch{throw new Error('无法读取此标签页的待发布资料，请返回制作页面重新预览。');}
          if(!raw)throw new Error('待发布资料不在此标签页中，请返回制作页面重新预览。');
          const snapshot=readCheckoutDraft(raw,draftId);setDraft(snapshot);
          const result=await api<{preview:Preview;html:string}>('/api/preview',snapshot.brief);if(!alive||epoch.current!==version)return;
          setPreview(result.preview);setHtml(result.html);
        }
      }catch(e){if(alive&&epoch.current===version){setError((e as Error).message);if(search.has('order'))setRecoveryOpen(true);}}
      finally{if(alive&&epoch.current===version)setLoading(false);}
    };
    void load();return()=>{alive=false;epoch.current++;};
  },[]);
  useEffect(()=>{
    if(!order||order.state!=='pending'||order.expired)return;
    setNow(Date.now());
    const timer=setInterval(()=>setNow(Date.now()),1000);
    return()=>clearInterval(timer);
  },[order?.id,order?.state,order?.expired,order?.expiresAt]);
  useEffect(()=>{
    if(!order||order.published)return;
    // A return from Alipay (including the back-forward cache) only triggers a
    // fresh server check; no browser query parameter can confirm payment.
    const refresh=()=>{setNow(Date.now());if(document.visibilityState==='visible')void checkOrder(order.id,true);};
    window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('pageshow',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[order?.id,order?.published]);
  useEffect(()=>{
    if(!order||order.published||(order.expired&&order.state!=='paid'))return;
    let cancelled=false;let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{if(cancelled)return;if(document.visibilityState==='visible')await checkOrder(order.id,true);if(!cancelled)timer=setTimeout(poll,7000);};
    timer=setTimeout(poll,7000);return()=>{cancelled=true;clearTimeout(timer);};
  },[order?.id,order?.state,order?.published,order?.expired]);
  async function purchase() {
    if(busy||loading||!configLoaded||!config.ready||!draft||!preview||!consent)return;
    const snapshot=draft,version=epoch.current;setBusy(true);setError('');setNotice('');
    try{
      const result=await api('/api/orders',{action:'create',brief:snapshot.brief,requestKey:snapshot.id,tier:'template',quotedPrice:priceFor(snapshot.brief.kind,'template',config.prices)});
      if(epoch.current!==version)return;
      const receiptCode=result.recoveryCode||knownCode(result.order.id);
      activeOrder.current=result.order.id;setOrder(result.order);setCode(receiptCode);setReceiptDownloadedFor('');setReceiptConfirmedFor('');setDraft(null);setPreview(null);setHtml('');saveReceiptRecord(result.order,receiptCode);
      window.history.replaceState(null,'','/checkout?order='+encodeURIComponent(result.order.id));
    }catch(e){if(epoch.current===version)setError((e as Error).message);}finally{if(epoch.current===version)setBusy(false);}
  }
  async function renewReceipt() {
    if(!order||busy)return;const current=order,version=epoch.current;setBusy(true);setError('');
    try{
      const result=await api('/api/orders',{action:'receipt',orderId:current.id});if(epoch.current!==version)return;
      const receiptCode=result.recoveryCode||'';setCode(receiptCode);setReceiptDownloadedFor('');setReceiptConfirmedFor('');saveReceiptRecord(current,receiptCode);setNotice('领取码已更新，请重新保存领取凭证，旧凭证已失效。');
    }catch(e){if(epoch.current===version)setError((e as Error).message);}finally{if(epoch.current===version)setBusy(false);}
  }
  function downloadReceipt() {
    if(!order||!codeValid(code))return;
    const text=t('文炳建站 · 网站领取凭证\n网站：{{name}}\n订单金额：{{amount}}\n订单号：{{id}}\n领取码：{{code}}\n\n回到 {{url}}，输入订单号和领取码即可找回。领取码具有访问权限，请妥善保管。', { name: order.name, amount: money(order.amount), id: order.id, code, url: location.origin+'/checkout#orders' });
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');
    link.href=url;link.download='Wenbing-'+order.id+'-'+t('领取凭证')+'.txt';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);setReceiptDownloadedFor(order.id);
  }
  const receiptFallback=order&&codeValid(code)?<details key={order.id+':'+code} className="checkout-receipt-fallback"><summary>{t("无法下载？展开并手动保存凭证")}</summary><p>{t("请将以下信息复制到安全位置，或截图保存。领取码可找回订单和交付内容，请勿公开分享。")}</p><dl><dt>{t("订单号")}</dt><dd>{order.id}</dd><dt>{t("领取码")}</dt><dd>{code}</dd></dl><p>{t("换浏览器后，回到本站结算页，在“已有订单？”中输入这两项信息。")}</p><label className="checkout-consent"><input type="checkbox" checked={receiptConfirmedFor===order.id} onChange={e=>setReceiptConfirmedFor(e.target.checked?order.id:'')}/>{t("我已保存订单号和领取码，可以在其他浏览器中找回。")}</label></details>:null;

  return <main className="checkout-page">
    <header className="checkout-nav"><a href="/" className="checkout-brand" aria-label={t("文炳建站首页")}>{t("文炳建站")}</a><a className="checkout-back" href={editHref}><ArrowLeft/>{draft?t("返回修改网站"):t("返回建站工作台")}</a><StudioLanguageSwitch /></header>
    <div className="checkout-shell">
      <div className="checkout-heading"><p className="checkout-eyebrow">YOUR WEBSITE / THE NEXT STEP</p><h1 id="checkout-title" tabIndex={-1}>{t(title)}</h1><p>{order?.published?t("网站已发布，现在可以打开网址或下载完整源码。"):order?.state==='paid'?t("已确认到账，正在准备交付。完成后会自动显示网站和源码领取入口。"):t("核对设计和费用，确认后再付款。无需注册账号。")}</p><ol className="checkout-progress"><li>{t("01 免费预览")}</li><li aria-current={!order?.published?'step':undefined}>{t("02 确认与付款")}</li><li aria-current={order?.published?'step':undefined}>{t("03 领取网站")}</li></ol></div>
      {loading?<div className="checkout-loading" role="status"><LoaderCircle className="spin"/><p>{t("正在读取你的设计与订单…")}</p></div>:draft||order?<div className="checkout-grid">
        <section className="checkout-summary" aria-label={t("待发布网站")}>
          <div className="checkout-summary-top"><small>YOUR WEBSITE</small><h2>{order?.name||preview?.name||draft?.brief.name}</h2><p>{order?t('订单号：{{id}}', { id: order.id }):preview?t(themeNames[preview.theme] || preview.theme)+' / '+t(layoutNames[preview.layout] || preview.layout):t("模板设计")}</p></div>
          {html?<div className="checkout-preview-wrap"><iframe title={t("待发布网站预览")} srcDoc={html} sandbox="" referrerPolicy="no-referrer"/><p>{t("免费模板预览 · 尚未发布")}</p></div>:<div className="checkout-empty-preview"><FileCheck2/><p>{order?.published?t("设计已发布，可打开网站或领取完整源码。"):order?.state==='paid'?t("已确认到账，正在准备网站和源码交付。"):order?t("设计已随订单保存。确认到账后可领取网站和源码。"):t("设计预览暂时无法读取，请返回重新生成。")}</p></div>}
        </section>
        <section className="checkout-panel" aria-label={t("发布费用与付款")}>
          <div className="checkout-panel-head"><small>DESIGN & PUBLISH</small><h2>{order?.published?t("你的交付内容"):t("模板基础款 · 发布服务")}</h2></div>
          <div className="checkout-price"><span>{order?t("订单金额"):draft&&audienceFor(draft.brief.kind)==='personal'?t("个人网站"):t("商户网站")}<small>{order?.state==='paid'||order?.published?t("已确认到账"):order?t("按已创建订单的金额支付"):t("完整预览免费")}</small></span><strong>{amount!==null?money(amount):'—'}</strong></div>
          {order?.published?<div className="checkout-success"><Check/><h3>{t("已完成发布")}</h3><a href={order.url!} target="_blank" rel="noreferrer" className="checkout-site-url"><span>{order.url}</span><ArrowUpRight/></a><a className="checkout-button primary" href={'/api/orders/download?id='+order.id}><Download/>{t("下载完整网站 ZIP")}</a><div className="checkout-actions"><button className="checkout-button secondary" disabled={busy} onClick={codeValid(code)?downloadReceipt:()=>void renewReceipt()}><Download/>{codeValid(code)?t("下载领取凭证"):t("补发领取凭证")}</button>{receiptFallback}</div></div>:<>
            <ul className="checkout-includes"><li><Check/>{t("发布已确认的模板网站")}</li><li><Check/>{t("获得可分享的公开网址")}</li><li><Check/>{t("交付完整网站源码 ZIP")}</li></ul>
            {order?<div className="checkout-actions">
              <div className={'checkout-payment-status'+(order.state==='paid'?' is-paid':'')} role="status">
                <strong>{order.state==='paid'?t("已确认到账 · 正在交付"):paymentExpired?t("付款窗口已结束"):t("等待付款确认")}</strong>
                <p>{order.state==='paid'?t("服务器已确认付款，正在准备网站和源码。交付完成后会自动显示领取入口，请勿重复付款。"):paymentExpired?t("付款入口已关闭。若已在支付宝付款，仍可查询到账与交付状态，请勿重复付款。"):t("支付宝确认到账后会自动交付。付款后返回本页即可查询进度，无需提交截图。")}</p>
              </div>
              {order.state==='pending'&&hasPaymentWindow&&!paymentExpired&&<p className="checkout-payment-window">{t("剩余付款时间")}<strong role="timer" aria-live="off" aria-label={t('剩余付款时间 {{minutes}} 分 {{seconds}} 秒', { minutes: Math.floor(remainingSeconds/60), seconds: remainingSeconds%60 })}>{paymentWindow}</strong><span>{t("请在此时间内完成支付宝付款。")}</span></p>}
              {order.state==='pending'&&!paymentExpired&&<p>{t("先保存领取凭证，再前往支付宝付款。凭证可用于换设备找回订单。")}</p>}
              <button className="checkout-button secondary" disabled={busy} onClick={codeValid(code)?downloadReceipt:()=>void renewReceipt()}><Download/>{codeValid(code)?receiptDownloadedFor===order.id?t("再次下载领取凭证"):t("下载领取凭证"):t("补发领取凭证")}</button>
              {receiptFallback}
              {order.state==='pending'&&isWechat&&!paymentExpired&&<div className="checkout-browser-hint"><strong>{t("请在系统浏览器中付款")}</strong><p>{t("微信内可能无法打开支付宝。请先保存领取凭证，再点右上角菜单，选择“在浏览器中打开”。若新浏览器无法读取订单，请用凭证中的订单号和领取码在下方找回。")}</p></div>}
              {order.state==='pending'&&(paymentExpired?<button className="checkout-button primary" disabled>{t("付款入口已过期")}</button>:order.checkoutUrl&&hasPaymentWindow?(isWechat?<button className="checkout-button primary" disabled>{t("请在系统浏览器中付款")}</button>:receiptSavedFor===order.id?<a className="checkout-button primary" href={order.checkoutUrl} onClick={event=>{if(order.expired||Date.now()>=order.expiresAt){event.preventDefault();setNow(Date.now());void checkOrder(order.id);}}}>{t("前往支付宝付款")}<ArrowUpRight/></a>:<button className="checkout-button primary" disabled>{t("保存凭证后继续付款")}</button>):<p className="checkout-muted">{t("付款入口暂不可用，请稍后重试。若已付款，请先检查交付状态。")}</p>)}
              <button className="checkout-button secondary" disabled={checking||busy} onClick={()=>void checkOrder(order.id)}>{checking?<><LoaderCircle className="spin"/>{t("正在查询…")}</>:t("检查付款与交付状态")}</button>
              <p className="checkout-muted">{t("系统会自动查询；从支付宝返回或重新打开本页时，也会检查最新状态。")}</p>
            </div>:config.ready&&configLoaded&&preview?<><label className="checkout-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{t("我已确认设计和价格，同意付款确认后公开发布这些资料。")}</label><button className="checkout-button primary" disabled={!consent||busy} onClick={()=>void purchase()}>{busy?<LoaderCircle className="spin"/>:<ShieldCheck/>}{busy?t("正在创建订单…"):t('确认并创建订单 · {{amount}}', { amount: money(amount!) })}</button></>:<><button className="checkout-button primary" disabled><LockKeyhole/>{!preview?t("请返回重新生成预览"):!configLoaded&&!configError?t("正在读取服务状态…"):t("暂未开放购买")}</button><p className="checkout-muted">{!preview?t("设计预览尚未通过校验，请返回重新生成后再发布。"):t(configError)||t("支付宝网页收款正在准备中。你可以返回继续调整，当前不会扣款。")}</p></>}
          </>}
          <details className="checkout-help"><summary>{t("发布与交付说明")}</summary><p>{t("发布后，介绍、图片与联系方式会公开。请确认你有权使用上传的内容。")}</p><p>{t("本服务交付静态介绍页及源码，不含商城、预约后台或自动注册域名。自有域名需另行配置。")}</p><p>{t("只有服务器确认到账后才会交付；关闭支付宝页面不代表付款成功。领取凭证可用于换设备找回订单，请妥善保管。")}</p></details>
          {config.support&&<p className="checkout-muted"><a href={'mailto:'+config.support}>{t("凭订单号联系服务方")}<ArrowUpRight size={12}/></a></p>}
        </section>
      </div>:<section className="checkout-empty"><FileCheck2/><h2>{activeOrder.current?t("暂时无法读取这笔订单"):t("先看见你的网站，再决定。")}</h2><p>{activeOrder.current?t("可以重试查询，或使用下方的领取凭证找回。"):t("免费生成完整模板预览，满意后再来这里确认发布费用。")}</p>{activeOrder.current?<button className="checkout-button secondary" disabled={checking} onClick={()=>void checkOrder(activeOrder.current)}>{t("重新读取订单")}</button>:<a className="checkout-button primary" href="/studio">{t("返回免费制作")}<ArrowUpRight/></a>}</section>}
      {error&&<p className="checkout-error" role="alert">{t(error)}</p>}{paymentNotice&&order?.state!=='paid'&&!order?.published&&<p className="checkout-notice" role="status">{t(paymentNotice)}</p>}{notice&&<p className="checkout-notice" role="status">{t(notice)}</p>}
      <section id="orders" className="checkout-recovery"><details open={recoveryOpen} onToggle={e=>setRecoveryOpen(e.currentTarget.open)}><summary>{t("已有订单？找回设计与交付")}</summary><p>{t("输入下单时保存的订单号和领取码，无需登录。")}</p><form className="checkout-recovery-form" onSubmit={e=>{e.preventDefault();void openOrder(recoverId.trim(),recoverCode.trim(),true);}}><label>{t("订单号")}<input required value={recoverId} onChange={e=>setRecoverId(e.target.value)} placeholder={t("F 开头的订单编号")} autoComplete="off"/></label><label>{t("领取码")}<input required type="password" value={recoverCode} onChange={e=>setRecoverCode(e.target.value)} placeholder={t("凭证里的领取码")} autoComplete="off"/></label><button className="checkout-button primary" disabled={busy||loading||(!configLoaded&&!configError)}>{t("找回订单")}</button></form>{recentId&&!history.some(r=>r.id===recentId)&&<div className="checkout-actions"><button className="checkout-button secondary" disabled={busy||loading||(!configLoaded&&!configError)} onClick={()=>void openOrder(recentId,knownCode(recentId))}>{t("查看此浏览器最近的订单")}</button></div>}{history.length>0&&<div className="checkout-history"><p>{t("此浏览器保存的最近订单")}</p>{history.map(item=><button key={item.id} disabled={busy||loading||(!configLoaded&&!configError)} onClick={()=>void openOrder(item.id,item.code,true)}><span>{item.name}<small>{item.id}</small></span><span>{money(item.amount)} <ArrowUpRight/></span></button>)}</div>}</details></section>
    </div>
  </main>;
}
