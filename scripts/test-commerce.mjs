import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,existsSync } from 'node:fs';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { generateKeyPairSync,createSign } from 'node:crypto';

// This test runs against memory-only storage and generated test keys. No payment/network requests.
globalThis.fetch=async()=>{throw new Error('unexpected external request');};
registerHooks({resolve(s,ctx,next){
 if(s==='./runtime'||s.endsWith('/lib/runtime.ts'))return {url:'data:text/javascript,export const setting=key=>String(globalThis.__formaTestEnv[key]||%22%22).trim();export const getStorage=()=>({db:globalThis.__formaTestEnv.DB,bucket:globalThis.__formaTestEnv.BUCKET});',shortCircuit:true};
 if(s.startsWith('@/'))s=new URL('../'+s.slice(2),import.meta.url).href;
 if((s.startsWith('./')||s.startsWith('../')||s.startsWith('file:'))&&!s.endsWith('.mjs')&&!s.endsWith('.ts')){
   const url=new URL(s,ctx.parentURL);if(existsSync(fileURLToPath(url)+'.ts'))return {url:pathToFileURL(fileURLToPath(url)+'.ts').href,shortCircuit:true};
 }return next(s,ctx);
}});
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0000_breezy_anthem.sql',import.meta.url),'utf8'));
const db={
 prepare(sql){
   return {
     bind(...args){
       return {
         async first(){return sqlite.prepare(sql).get(...args)||null;},
         async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}
       };
     }
   };
 }
};
const objects=new Map();let failPublish=false;
const bucket={async put(key,value){if(failPublish&&key.startsWith('sites/'))throw new Error('test storage unavailable');objects.set(key,value);},async get(key){const s=objects.get(key);return s===undefined?null:{text:async()=>s,json:async()=>JSON.parse(s),body:s};},async delete(k){objects.delete(k);}};
const keys=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
globalThis.__formaTestEnv={DB:db,BUCKET:bucket,FORMA_PUBLIC_ORIGIN:'https://forma.test'};
const originalEnv=globalThis.__formaTestEnv;
const commerce=await import('../lib/commerce.ts'),alipay=await import('../lib/alipay.ts'),previewRoute=await import('../app/api/preview/route.ts');
const ordersRoute=await import('../app/api/orders/route.ts'),downloadRoute=await import('../app/api/orders/download/route.ts'),notify=await import('../app/api/payments/alipay/notify/route.ts'),publicRoute=await import('../app/s/[slug]/route.ts');
const configRoute=await import('../app/api/commerce/route.ts');
const configResponse=await configRoute.GET(new Request('https://forma.test/api/commerce'));
const publicConfig=await configResponse.json();
assert.deepEqual(publicConfig.prices,{personal:{template:19900,refine:69900,signature:119900},merchant:{template:80000,refine:130000,signature:180000}});
assert.equal(publicConfig.ready,false);
const {priceFor}=await import('../lib/pricing.ts');
assert.equal(priceFor('business','template'),80000);assert.equal(priceFor('restaurant','signature'),180000);assert.throws(()=>priceFor('unknown'));assert.throws(()=>priceFor('personal','__proto__'));
const guestCookie=configResponse.headers.get('set-cookie').split(';')[0];
assert(configResponse.headers.get('set-cookie').includes('HttpOnly'));assert(configResponse.headers.get('set-cookie').includes('Secure'));
const requestSafety=await import('../lib/request.ts');
const behindProxy=()=>new Request('http://127.0.0.1:3000/api/preview',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://forma.test','X-Forwarded-Host':'attacker.test','X-Forwarded-Proto':'http'},body:'{"safe":true}'});
assert.deepEqual(await requestSafety.readBody(behindProxy()),{safe:true});
assert(commerce.guest(behindProxy()).cookie.includes('; Secure'));
const foreignRequest=new Request('http://127.0.0.1:3000/api/preview',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://attacker.test','X-Forwarded-Host':'attacker.test'},body:'{}'});
await assert.rejects(requestSafety.readBody(foreignRequest),/来源/);
await assert.rejects(requestSafety.readBody(new Request('http://127.0.0.1:3000/api/preview',{method:'POST',headers:{'Content-Type':'application/json','Sec-Fetch-Site':'cross-site'},body:'{}'})),/来源/);
for(const origin of ['http://public.test','https://user:password@public.test','https://public.test/subpath','https://public.test/?x=1','not a URL']){originalEnv.FORMA_PUBLIC_ORIGIN=origin;assert.throws(()=>requestSafety.publicOrigin());}
originalEnv.FORMA_PUBLIC_ORIGIN='';
assert.equal(requestSafety.requestOrigin(new Request('http://localhost:5173/api/preview')),'http://localhost:5173');
assert(!commerce.guest(new Request('http://localhost:5173/api/commerce')).cookie.includes('; Secure'));
assert.throws(()=>requestSafety.requestOrigin(new Request('https://unconfigured.test/api/preview')),/FORMA_PUBLIC_ORIGIN/);
originalEnv.FORMA_PUBLIC_ORIGIN='https://forma.test';
const brief={kind:'restaurant',name:'测试门店',text:'介绍：只用于本地测试的一家小店。\n菜单：面条｜当日新鲜制作',prompt:'墨绿菜单',contact:'',image:''};
const req=(data,cookie='')=>new Request('https://forma.test/api/orders',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://forma.test',Cookie:cookie,'CF-Connecting-IP':'1.2.3.4','X-Forwarded-For':'1.2.3.4','X-Forma-Client-IP':'1.2.3.4'},body:JSON.stringify(data)});
assert.equal(commerce.commerceConfig().ready,false);
assert.equal((await ordersRoute.POST(req({action:'create',brief,requestKey:'sales-closed-request',quotedPrice:80000},guestCookie))).status,400);
assert.equal((await ordersRoute.POST(req({action:'create',brief,requestKey:'test-order-request-key',quotedPrice:80000}))).status,400);
const preview=await (await previewRoute.POST(req(brief))).json();assert(preview.preview);assert(preview.html.includes('<!DOCTYPE html>'));assert(preview.html.includes('当日新鲜制作'));assert(preview.html.includes('href="about:srcdoc#offering"'));assert(!('draft' in preview));assert.equal(objects.size,0);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM orders').get().n,0);
Object.assign(commerceConfigEnv(),{FORMA_SALES_ENABLED:'true',FORMA_PRICE_CENTS:'9900',ALIPAY_APP_ID:'2026000000000000',ALIPAY_SELLER_ID:'2088000000000000',ALIPAY_PRIVATE_KEY:keys.privateKey,ALIPAY_PUBLIC_KEY:keys.publicKey});
function commerceConfigEnv(){return originalEnv;}
function sign(raw){return createSign('RSA-SHA256').update(raw).sign(keys.privateKey,'base64');}
function notification(id,changes={}){const p={out_trade_no:id,trade_no:'T'+id,total_amount:'800.00',trade_status:'TRADE_SUCCESS',seller_id:'2088000000000000',app_id:'2026000000000000',sign_type:'RSA2',...changes};p.sign=sign(alipay.canonical(p));return new Request('https://forma.test/api/payments/alipay/notify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(p)});}
function row(id){return sqlite.prepare('SELECT * FROM orders WHERE id=?').get(id);}
assert.equal(commerce.commerceConfig().ready,true);
assert.equal((await ordersRoute.POST(req({action:'create',brief,requestKey:'test-order-request-key',quotedPrice:80000}))).status,400);
assert.equal((await ordersRoute.POST(req({action:'create',brief,requestKey:'test-order-request-key',quotedPrice:1},guestCookie))).status,400);
for(const tier of ['refine','signature','bogus']){const refused=await ordersRoute.POST(req({action:'create',brief,tier,requestKey:'test-tier-blocked-'+tier,quotedPrice:130000},guestCookie));assert.equal(refused.status,400);assert((await refused.json()).error.includes('暂未开放'));}
for(const quotedPrice of [19900,'80000',79999])assert.equal((await ordersRoute.POST(req({action:'create',brief,requestKey:'test-bad-amount-'+quotedPrice,quotedPrice},guestCookie))).status,400);
for(const [kind,price] of [['personal',19900],['business',80000]]){const orderResponse=await ordersRoute.POST(req({action:'create',brief:{...brief,kind},tier:'template',requestKey:'test-kind-'+kind+'-request',quotedPrice:price},guestCookie));assert.equal(orderResponse.status,200);const {order}=await orderResponse.json();assert.equal(order.amount,price);assert.equal(JSON.parse(new URL(alipay.paymentUrl(commerce.commerceConfig().config,row(order.id))).searchParams.get('biz_content')).total_amount,(price/100).toFixed(2));}
const created=await ordersRoute.POST(req({action:'create',brief,requestKey:'test-order-request-key',quotedPrice:80000},guestCookie));assert.equal(created.status,200);
const cookie=created.headers.get('set-cookie').split(';')[0],data=await created.json(),id=data.order.id;
assert.equal(row(id).ip_hash,commerce.digest(commerce.guest(req({},cookie)).hash));
assert(data.recoveryCode);assert(!('site_key' in data.order));assert(!('draft' in data));assert.equal(data.order.url,null);
assert.equal(data.order.checkoutUrl,'/api/payments/alipay/checkout?order='+data.order.id);
const checkout=new URL(alipay.paymentUrl(commerce.commerceConfig().config,row(data.order.id)));assert.equal(checkout.origin,'https://openapi.alipay.com');assert.equal(new URL(checkout.searchParams.get('return_url')).pathname,'/checkout');assert.equal(new URL(checkout.searchParams.get('return_url')).searchParams.get('order'),data.order.id);assert.equal(JSON.parse(checkout.searchParams.get('biz_content')).total_amount,'800.00');
assert.equal((await ordersRoute.POST(req({action:'status',orderId:id},'forma_guest='+'A'.repeat(43)))).status,400);
assert.equal((await downloadRoute.GET(new Request('https://forma.test/api/orders/download?id='+id,{headers:{cookie}}))).status,402);
assert.equal((await publicRoute.GET(new Request('https://forma.test/s/'+row(id).site_key))).status,404);
for(const changes of [{total_amount:'0.01'},{app_id:'wrong'},{seller_id:'wrong'},{out_trade_no:'unknown'}])assert.equal((await notify.POST(notification(id,changes))).status,400);
assert.equal(row(id).state,'pending');
const duplicate=await (await ordersRoute.POST(req({action:'create',brief,requestKey:'test-order-request-key',quotedPrice:80000},cookie))).json();assert.equal(duplicate.order.id,id);
// A lost initial response can be repaired by the authenticated owner, without
// retaining plaintext recovery credentials in storage or issuing another order.
assert.equal(duplicate.recoveryCode,undefined);
const originalRecoveryHash=row(id).recovery_hash;
assert.equal((await ordersRoute.POST(req({action:'receipt',orderId:id}))).status,403);
assert.equal((await ordersRoute.POST(req({action:'receipt',orderId:id},'forma_guest='+'A'.repeat(43)))).status,400);
assert.equal(row(id).recovery_hash,originalRecoveryHash);
const receiptResponse=await ordersRoute.POST(req({action:'receipt',orderId:id},cookie));assert.equal(receiptResponse.status,200);
const receipt=await receiptResponse.json();assert.equal(receipt.order.id,id);assert.match(receipt.recoveryCode,/^[A-Za-z0-9_-]{32}$/);assert.notEqual(receipt.recoveryCode,data.recoveryCode);
assert.equal(row(id).recovery_hash,commerce.digest(receipt.recoveryCode));assert(!('recovery_hash' in receipt.order));
assert.equal((await ordersRoute.POST(req({action:'recover',orderId:id,code:data.recoveryCode}))).status,400);
assert.equal(row(id).owner_hash,commerce.guest(req({},cookie)).hash);
const retried=await (await ordersRoute.POST(req({action:'create',brief:{...brief,kind:'personal'},requestKey:'test-order-request-key',quotedPrice:19900},cookie))).json();assert.equal(retried.order.id,id);assert.equal(retried.order.amount,80000);assert.equal(JSON.parse(objects.get('drafts/'+id+'.json')).kind,'restaurant');
failPublish=true;assert.equal((await notify.POST(notification(id))).status,400);assert.equal(row(id).state,'paid');assert.equal(row(id).published_at,null);
failPublish=false;assert.equal(await (await notify.POST(notification(id))).text(),'success');assert.equal(await (await notify.POST(notification(id))).text(),'success');assert(row(id).published_at);
assert.equal((await downloadRoute.GET(new Request('https://forma.test/api/orders/download?id='+id,{headers:{cookie}}))).status,200);
assert.equal((await publicRoute.GET(new Request('https://forma.test/s/'+row(id).site_key))).status,200);
assert.equal((await ordersRoute.POST(req({action:'recover',orderId:id,code:'B'.repeat(32)}))).status,400);
const recovered=await ordersRoute.POST(req({action:'recover',orderId:id,code:receipt.recoveryCode}));assert.equal(recovered.status,200);assert((await recovered.json()).order.published);
assert.equal((await ordersRoute.POST(req({action:'status',orderId:id},cookie))).status,400);
const legacyResponse=await ordersRoute.POST(req({action:'create',brief,requestKey:'legacy-price-request',quotedPrice:80000},guestCookie));const legacyData=await legacyResponse.json();const legacyId=legacyData.order.id;
sqlite.prepare('UPDATE orders SET amount=9900 WHERE id=?').run(legacyId);
const legacyView=commerce.orderView(row(legacyId));assert.equal(legacyView.amount,9900);assert.equal(JSON.parse(new URL(alipay.paymentUrl(commerce.commerceConfig().config,row(legacyId))).searchParams.get('biz_content')).total_amount,'99.00');
assert.equal((await notify.POST(notification(legacyId))).status,400);assert.equal((await notify.POST(notification(legacyId,{total_amount:'99.00'}))).status,200);
const legacyRecovered=await (await ordersRoute.POST(req({action:'recover',orderId:legacyId,code:legacyData.recoveryCode}))).json();assert.equal(legacyRecovered.order.amount,9900);assert(legacyRecovered.order.published);
assert.equal(alipay.cents('99.00'),9900);assert.equal(alipay.cents(99),9900);assert.equal(alipay.cents('99.001'),-1);
const raw='{ "code":"10000", "nested":{"brace":"} \\""}, "total_amount":"99.00" }';assert.equal(alipay.signedObject('{"alipay_trade_query_response":'+raw+',"sign":"x"}','alipay_trade_query_response'),raw);
const unsigned=new URLSearchParams({out_trade_no:id,sign:'nope',sign_type:'RSA2'});assert.throws(()=>alipay.verifyNotification(unsigned,commerce.commerceConfig().config));
const queryRaw=JSON.stringify({code:'10000',out_trade_no:id,trade_no:'T'+id,total_amount:99,trade_status:'TRADE_SUCCESS'});
globalThis.fetch=async()=>new Response('{"alipay_trade_query_response":'+queryRaw+',"sign":'+JSON.stringify(sign(queryRaw))+'}');
const queried=await alipay.queryTrade(commerce.commerceConfig().config,id);
assert(alipay.tradeMatches(queried,{id,amount:9900},commerce.commerceConfig().config));
globalThis.fetch=async()=>new Response('{"alipay_trade_query_response":'+queryRaw.replace('99,','1,')+',"sign":'+JSON.stringify(sign(queryRaw))+'}');
await assert.rejects(()=>alipay.queryTrade(commerce.commerceConfig().config,id),/验签失败/);
globalThis.fetch=async()=>{throw new Error('unexpected external request');};
// Recovering a browser must remain usable even when payment verification fails.
const interruptedData=await (await ordersRoute.POST(req({action:'create',brief,requestKey:'recovery-network-failure',quotedPrice:80000},guestCookie))).json();
const interruptedId=interruptedData.order.id;
let failedQueries=0;globalThis.fetch=async()=>{failedQueries++;throw new Error('test payment provider unavailable');};
const offlineRecoveryResponse=await ordersRoute.POST(req({action:'recover',orderId:interruptedId,code:interruptedData.recoveryCode}));
assert.equal(offlineRecoveryResponse.status,200);assert.equal(failedQueries,1);
const offlineCookie=offlineRecoveryResponse.headers.get('set-cookie')?.split(';')[0];assert(offlineCookie);
const offlineRecovery=await offlineRecoveryResponse.json();assert.equal(offlineRecovery.order.id,interruptedId);assert.equal(offlineRecovery.order.state,'pending');assert.equal(offlineRecovery.order.published,false);assert.equal(offlineRecovery.order.url,null);assert(offlineRecovery.warning);
assert.equal(row(interruptedId).owner_hash,commerce.guest(req({},offlineCookie)).hash);
assert.equal((await ordersRoute.POST(req({action:'status',orderId:interruptedId},guestCookie))).status,400);
sqlite.prepare('UPDATE orders SET last_checked_at=NULL WHERE id=?').run(interruptedId);
const offlineStatusResponse=await ordersRoute.POST(req({action:'status',orderId:interruptedId},offlineCookie));assert.equal(offlineStatusResponse.status,200);
const offlineStatus=await offlineStatusResponse.json();assert.equal(offlineStatus.order.state,'pending');assert(offlineStatus.warning);assert.equal(failedQueries,2);
assert.equal((await downloadRoute.GET(new Request('https://forma.test/api/orders/download?id='+interruptedId,{headers:{cookie:offlineCookie}}))).status,402);
assert.equal((await publicRoute.GET(new Request('https://forma.test/s/'+row(interruptedId).site_key))).status,404);

// If payment was verified before storage failed, the response must reflect the
// persisted paid state and allow a later status request to retry publication.
sqlite.prepare('UPDATE orders SET last_checked_at=NULL WHERE id=?').run(interruptedId);
const interruptedTrade=JSON.stringify({code:'10000',out_trade_no:interruptedId,trade_no:'T'+interruptedId,total_amount:'800.00',trade_status:'TRADE_SUCCESS'});
globalThis.fetch=async()=>new Response('{"alipay_trade_query_response":'+interruptedTrade+',"sign":'+JSON.stringify(sign(interruptedTrade))+'}');
failPublish=true;
const interruptedStatusResponse=await ordersRoute.POST(req({action:'status',orderId:interruptedId},offlineCookie));assert.equal(interruptedStatusResponse.status,200);
const interruptedStatus=await interruptedStatusResponse.json();assert.equal(interruptedStatus.order.state,'paid');assert.equal(interruptedStatus.order.published,false);assert.equal(interruptedStatus.order.checkoutUrl,null);assert.equal(interruptedStatus.order.url,null);assert(interruptedStatus.warning);assert.equal(row(interruptedId).state,'paid');assert.equal(row(interruptedId).published_at,null);
failPublish=false;globalThis.fetch=async()=>{throw new Error('unexpected external request');};
const resumedStatus=await (await ordersRoute.POST(req({action:'status',orderId:interruptedId},offlineCookie))).json();assert.equal(resumedStatus.order.state,'paid');assert(resumedStatus.order.published);assert.equal(resumedStatus.warning,undefined);
assert.equal((await downloadRoute.GET(new Request('https://forma.test/api/orders/download?id='+interruptedId,{headers:{cookie:offlineCookie}}))).status,200);

// Existing orders remain deliverable while the production sales switch is off.
commerceConfigEnv().FORMA_SALES_ENABLED='false';assert.equal(commerce.commerceConfig().ready,false);
assert.equal((await ordersRoute.POST(req({action:'create',brief,requestKey:'disabled-sales-final-check',quotedPrice:80000},guestCookie))).status,400);
const closedSalesReceipt=await ordersRoute.POST(req({action:'receipt',orderId:interruptedId},offlineCookie));assert.equal(closedSalesReceipt.status,200);assert((await closedSalesReceipt.json()).recoveryCode);
// Legacy publication is still retired; generation now has a separate BYOK flow.
const retiredDeploy=await import('../app/api/deploy/route.ts');assert.equal((await retiredDeploy.POST()).status,410);
const aiGenerate=await import('../app/api/generate/route.ts');assert.equal((await aiGenerate.POST(req({}))).status,400);
console.log('PASS: closed sales; free template preview without order or publication; category/tier prices; blocked premium tiers; legacy order amount; guest isolation; unpaid download/public denial; forged and mismatched payments; replay; publish recovery; authenticated receipt rotation; old-code invalidation; offline browser recovery; persisted payment status and publication retry; retired endpoints.');
