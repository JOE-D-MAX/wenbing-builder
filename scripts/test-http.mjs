import assert from 'node:assert/strict';

// Run against the built application. Creates nothing and needs no credentials.
const origin = process.argv[2] || 'http://127.0.0.1:4175';
const target = new URL(origin);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) throw new Error('Use only a local verification server.');
const get = path => fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000) });
const home = await get('/');
assert.equal(home.status, 200);
assert((await home.text()).includes('文炳建站'));
const health = await get('/api/health');
assert.equal(health.status, 200);
const brief = {kind:'restaurant', name:'文炳测试小店', text:'介绍：这是一份本地验证资料。\n菜单：手作面条｜每日现做', prompt:'墨绿简约', contact:'', image:''};
const post = (path, body, source = origin) => fetch(new URL(path, origin), {method:'POST', headers:{'Content-Type':'application/json', Origin:source}, body:JSON.stringify(body), signal:AbortSignal.timeout(15000)});
const preview = await post('/api/preview', brief);
assert.equal(preview.status, 200);
const generated = await preview.json();
assert(generated.html.includes('文炳测试小店'));
assert(generated.html.includes('手作面条'));
assert(!generated.html.includes('href="about:srcdoc#'), 'The downloadable document must not contain iframe-only links.');
const fragmentLinks = [...generated.html.matchAll(/href="#([^"]+)"/g)];
assert(fragmentLinks.length >= 5, 'The generated website must retain its page navigation.');
for (const [, id] of fragmentLinks) assert(generated.html.includes(`id="${id}"`), `Navigation target must exist: ${id}`);
assert.equal(generated.preview.name, brief.name);
assert.equal((await post('/api/preview', brief, 'https://untrusted.invalid')).status, 400);
for (const path of ['/data/orders.sqlite', '/.data/forma/orders.sqlite', '/lib/runtime.ts', '/.env', '/objects/drafts/F'+'a'.repeat(30)+'.json']) {
  assert.equal((await get(path)).status, 404, `Private server file must not be public: ${path}`);
}
console.log('PASS built HTTP routes: brand, health, free generation, origin checks, private-file isolation.');
