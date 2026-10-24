import assert from 'node:assert/strict';

// Run against the built application with purchasing disabled. Creates no orders.
const origin = process.argv[2] || 'http://127.0.0.1:4175';
const target = new URL(origin);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) throw new Error('Use only a local verification server.');
const get = path => fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000) });
const home = await get('/');
assert.equal(home.status, 200);
assert((await home.text()).includes('文炳建站'));
const checkout = await get('/checkout');
assert.equal(checkout.status, 200);
assert((await checkout.text()).includes('发布与付款'));
const health = await get('/api/health');
assert.equal(health.status, 200);
const config = await get('/api/commerce');
assert.equal(config.status, 200);
const commerce = await config.json();
assert.equal(commerce.ready, false, 'HTTP smoke test requires purchasing disabled.');
assert.equal(commerce.prices.personal.template, 19900);
assert.equal(commerce.prices.merchant.template, 80000);
const cookie = config.headers.get('set-cookie')?.split(';')[0];
assert(cookie?.startsWith('forma_guest='));
assert(config.headers.get('set-cookie').includes('HttpOnly'));
const brief = {kind:'restaurant', name:'文炳测试小店', text:'介绍：这是一份本地验证资料。\n菜单：手作面条｜每日现做', prompt:'墨绿简约', contact:'', image:''};
const post = (path, body, source = origin) => fetch(new URL(path, origin), {method:'POST', headers:{'Content-Type':'application/json', Origin:source, Cookie:cookie}, body:JSON.stringify(body), signal:AbortSignal.timeout(15000)});
const preview = await post('/api/preview', brief);
assert.equal(preview.status, 200);
const generated = await preview.json();
assert(generated.html.includes('文炳测试小店'));
assert(generated.html.includes('手作面条'));
assert.equal(generated.preview.name, brief.name);
assert.equal((await post('/api/preview', brief, 'https://untrusted.invalid')).status, 400);
const refused = await post('/api/orders', {action:'create', brief, requestKey:'http-verification-no-order', quotedPrice:80000, tier:'template'});
assert.equal(refused.status, 400);
assert((await refused.json()).error.includes('暂未开放'));
assert.equal((await get('/api/orders/download?id=F'+'a'.repeat(30))).status, 403);
assert.equal((await get('/s/'+'a'.repeat(36))).status, 404);
const paymentEntry=await fetch(new URL('/api/payments/alipay/checkout?order=F'+'a'.repeat(30),origin),{redirect:'manual'});
assert.equal(paymentEntry.status,303);
assert.equal(new URL(paymentEntry.headers.get('location')).origin,target.origin);
assert.equal(paymentEntry.headers.get('cache-control'),'no-store');
for (const path of ['/data/orders.sqlite', '/.data/forma/orders.sqlite', '/lib/runtime.ts', '/.env', '/objects/drafts/F'+'a'.repeat(30)+'.json']) {
  assert.equal((await get(path)).status, 404, `Private server file must not be public: ${path}`);
}
console.log('PASS built HTTP routes: brand, checkout, health, free generation, pricing, origin checks, closed purchasing, paid-file isolation.');
