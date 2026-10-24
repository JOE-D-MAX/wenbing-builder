import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (/^\.{1,2}\//.test(specifier) && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { serializeCheckoutDraft, readCheckoutDraft, checkoutStorageKey } = await import('../lib/checkout-draft.ts');
const id = '6dd35876-997c-46cc-b7bd-5ae5d8d6b572';
const anotherId = '6dd35876-997c-46cc-b7bd-5ae5d8d6b573';
const brief = { kind: 'personal', name: '林远', text: '介绍：用设计记录旅行与日常。', prompt: '黑白，编辑留白', contact: '', image: '', headline: '用设计记录生活。', theme: 'ink', layout: 'editorial', font: 'sans' };
const snapshot = serializeCheckoutDraft(id, brief);
assert.deepEqual(readCheckoutDraft(snapshot, id), { version: 1, id, brief });
assert.notEqual(checkoutStorageKey(id), checkoutStorageKey(anotherId));
assert.throws(() => readCheckoutDraft(snapshot, anotherId), /不匹配/);
assert.throws(() => readCheckoutDraft('broken', id), /无法读取/);
assert.throws(() => readCheckoutDraft(snapshot.replace('"version":1', '"version":2'), id), /不匹配/);
assert.throws(() => readCheckoutDraft('a'.repeat(1800001), id), /过大/);
assert.throws(() => checkoutStorageKey('../another-site'), /编号无效/);
assert.throws(() => serializeCheckoutDraft(id, { ...brief, name: '' }), /先完成/);
assert.throws(() => serializeCheckoutDraft(id, { ...brief, theme: '<script>' }), /风格设置无效/);
const injected = JSON.stringify({ version: 1, id, brief: { ...brief, price: 1 }, amount: 1, html: '<script>alert(1)</script>' });
assert.deepEqual(readCheckoutDraft(injected, id), { version: 1, id, brief });
console.log('PASS: checkout snapshots preserve confirmed design; distinct IDs cannot mix; invalid/stale formats rejected; client prices and HTML discarded.');
