import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { spawnSync } from 'node:child_process';

registerHooks({resolve(specifier,context,next){
  if(specifier.startsWith('@/'))specifier=new URL('../'+specifier.slice(2),import.meta.url).href;
  if(specifier.startsWith('.')||specifier.startsWith('file:')){
    const url=new URL(specifier,context.parentURL);
    if(!url.pathname.endsWith('.ts')&&existsSync(fileURLToPath(url)+'.ts'))return {url:pathToFileURL(fileURLToPath(url)+'.ts').href,shortCircuit:true};
  }
  return next(specifier,context);
}});

const temporary=mkdtempSync(path.join(tmpdir(),'wenbing-payment-'));
assert.equal(path.dirname(path.resolve(temporary)),path.resolve(tmpdir()));
const originalEnv={...process.env};
let storage;
try {
  const keys=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
  Object.assign(process.env,{FORMA_DATA_DIR:temporary,FORMA_MIGRATIONS_DIR:fileURLToPath(new URL('../drizzle',import.meta.url)),FORMA_PUBLIC_ORIGIN:'https://payments.test',FORMA_SALES_ENABLED:'true',ALIPAY_APP_ID:'2026000000000000',ALIPAY_SELLER_ID:'2088000000000000',ALIPAY_PRIVATE_KEY:keys.privateKey,ALIPAY_PUBLIC_KEY:keys.publicKey,ALIPAY_WAP_PAY_ENABLED:'false'});
  const commerce=await import('../lib/commerce.ts');
  const alipay=await import('../lib/alipay.ts');
  const route=await import('../app/api/payments/alipay/checkout/route.ts');
  storage=commerce.storage();
  const config=commerce.commerceConfig().config;
  assert.deepEqual(alipay.paymentConfigIssues(config),[]);
  assert(alipay.paymentConfigIssues({...config,privateKey:'broken'}).includes('ALIPAY_PRIVATE_KEY'));
  assert(alipay.paymentConfigIssues({...config,publicKey:'broken'}).includes('ALIPAY_PUBLIC_KEY'));
  assert(alipay.paymentConfigIssues({...config,appId:'not-an-app'}).includes('ALIPAY_APP_ID'));
  assert(alipay.paymentConfigIssues({...config,origin:'http://payments.test'}).includes('FORMA_PUBLIC_ORIGIN'));
  const weak=generateKeyPairSync('rsa',{modulusLength:1024,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
  assert(alipay.paymentConfigIssues({...config,privateKey:weak.privateKey}).includes('ALIPAY_PRIVATE_KEY'));
  const configCheck=spawnSync(process.execPath,['--experimental-strip-types','scripts/check-payment.mjs'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:process.env,encoding:'utf8'});
  assert.equal(configCheck.status,0,configCheck.stderr);
  assert(!configCheck.stdout.includes(keys.privateKey));assert(!configCheck.stdout.includes(config.appId));
  const blockedBoot=spawnSync(process.execPath,['--experimental-strip-types','scripts/check-runtime.mjs'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,NODE_ENV:'production',ALIPAY_PRIVATE_KEY:'broken'},encoding:'utf8'});
  assert.notEqual(blockedBoot.status,0);assert.match(blockedBoot.stderr,/ALIPAY_PRIVATE_KEY/);assert(!blockedBoot.stderr.includes(keys.privateKey));
  process.env.ALIPAY_PRIVATE_KEY='broken';assert.equal(commerce.commerceConfig().ready,false);process.env.ALIPAY_PRIVATE_KEY=keys.privateKey;

  const firstRequest=new Request('https://payments.test/api/commerce');
  const owner=commerce.guest(firstRequest),cookie=owner.cookie.split(';')[0];
  const brief={kind:'personal',name:'支付流程测试',text:'介绍：仅用于自动化测试。',prompt:'黑白极简',contact:'',image:''};
  const order=await commerce.createOrder(firstRequest,{brief,requestKey:'payment-routing-order-001',quotedPrice:19900},owner.hash);
  const request=(options={})=>new Request(`https://payments.test/api/payments/alipay/checkout?order=${options.id||order.id}`,{headers:{Cookie:options.cookie??cookie,'User-Agent':options.ua||'Desktop Test','Sec-Fetch-Site':options.site||'same-origin'}});
  let queryCount=0,queryMode='missing';
  globalThis.fetch=async(url)=>{
    assert.equal(url,alipay.ALIPAY_GATEWAY);queryCount++;
    if(queryMode==='offline')throw new Error('simulated network interruption');
    const result=queryMode==='missing'?{code:'40004',sub_code:'ACQ.TRADE_NOT_EXIST'}:{code:'10000',out_trade_no:order.id,trade_no:'PAYMENT_TEST_TRADE_001',trade_status:'TRADE_SUCCESS',total_amount:'199.00',app_id:config.appId,seller_id:config.sellerId};
    const raw=JSON.stringify(result),signature=createSign('RSA-SHA256').update(raw).sign(keys.privateKey,'base64');
    return Response.json({alipay_trade_query_response:result,sign:signature});
  };
  const readSigned=response=>{
    assert.equal(response.status,303);assert.equal(response.headers.get('cache-control'),'no-store');
    const location=new URL(response.headers.get('location'));assert.equal(location.origin,'https://openapi.alipay.com');
    const values=Object.fromEntries(location.searchParams);
    const canonical=Object.keys(values).filter(key=>key!=='sign').sort().map(key=>key+'='+values[key]).join('&');
    assert(alipay.verifySignature(canonical,values.sign,keys.publicKey));
    assert.equal(values.return_url,`https://payments.test/checkout?order=${order.id}`);
    assert.equal(values.notify_url,'https://payments.test/api/payments/alipay/notify');
    const biz=JSON.parse(values.biz_content);assert.equal(biz.total_amount,'199.00');assert.equal(biz.out_trade_no,order.id);
    assert.equal(biz.time_expire,new Date(order.created_at+alipay.PAYMENT_WINDOW_MS+8*3600000).toISOString().slice(0,19).replace('T',' '));
    assert(!('timeout_express' in biz));
    return {values,biz};
  };
  assert.equal((await route.GET(request({id:'bad'}))).status,400);
  assert.equal((await route.GET(request({site:'cross-site'}))).status,403);
  for(const deniedCookie of ['', 'forma_guest='+'A'.repeat(43)]){
    const result=await route.GET(request({cookie:deniedCookie}));assert.match(result.headers.get('location'),/^https:\/\/payments\.test\/checkout\?/);
  }
  assert.equal(queryCount,0);
  const desktop=readSigned(await route.GET(request()));assert.equal(desktop.values.method,'alipay.trade.page.pay');assert.equal(desktop.biz.product_code,'FAST_INSTANT_TRADE_PAY');
  const mobileFallback=readSigned(await route.GET(request({ua:'iPhone Mobile'})));assert.equal(mobileFallback.values.method,'alipay.trade.page.pay');
  process.env.ALIPAY_WAP_PAY_ENABLED='true';
  const mobile=readSigned(await route.GET(request({ua:'iPhone Mobile'})));assert.equal(mobile.values.method,'alipay.trade.wap.pay');assert.equal(mobile.biz.product_code,'QUICK_WAP_WAY');assert.equal(mobile.biz.quit_url,mobile.values.return_url);
  assert.equal(mobile.biz.time_expire,desktop.biz.time_expire);
  assert.equal(queryCount,1,'Repeat navigation must respect the server query throttle.');
  await storage.db.prepare('UPDATE orders SET last_checked_at=NULL WHERE id=?').bind(order.id).run();
  queryMode='offline';
  const unavailable=await route.GET(request());assert.equal(new URL(unavailable.headers.get('location')).searchParams.get('payment'),'unverified');
  assert.equal((await commerce.ownedOrder(order.id,owner.hash)).state,'pending');
  process.env.FORMA_SALES_ENABLED='false';
  const closed=await route.GET(request());assert.equal(new URL(closed.headers.get('location')).searchParams.get('payment'),'unavailable');
  process.env.FORMA_SALES_ENABLED='true';
  const originalCreated=order.created_at;
  await storage.db.prepare('UPDATE orders SET created_at=?,last_checked_at=NULL WHERE id=?').bind(Date.now()-alipay.PAYMENT_WINDOW_MS-1,order.id).run();
  queryMode='missing';
  const expired=await route.GET(request());assert.equal(new URL(expired.headers.get('location')).searchParams.get('payment'),'expired');
  assert.equal(commerce.orderView(await commerce.ownedOrder(order.id,owner.hash)).checkoutUrl,null);
  await storage.db.prepare('UPDATE orders SET created_at=?,last_checked_at=NULL WHERE id=?').bind(originalCreated,order.id).run();
  queryMode='paid';
  const paid=await route.GET(request());assert.equal(paid.headers.get('location'),`https://payments.test/checkout?order=${order.id}`);
  const saved=await commerce.ownedOrder(order.id,owner.hash);assert.equal(saved.state,'paid');assert(saved.published_at);
  assert(await storage.bucket.get(`sites/${saved.site_key}.html`));
  const count=queryCount;await route.GET(request());assert.equal(queryCount,count,'Paid orders never start another payment.');
  console.log('PASS payment configuration, safe checkout redirects, mobile product selection, absolute expiry, guest isolation, interrupted query, paid-order delivery and no repeat charging.');
} finally {
  storage?.close();
  for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];
  Object.assign(process.env,originalEnv);
  rmSync(temporary,{recursive:true,force:true});
}
