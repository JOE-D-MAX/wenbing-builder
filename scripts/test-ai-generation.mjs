import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

// No real credentials, external requests, persistent storage or paid inference.
globalThis.fetch = async () => { throw new Error('unexpected external request'); };
globalThis.__aiTestEnv = { FORMA_PUBLIC_ORIGIN: 'https://wenbing.test' };
registerHooks({ resolve(specifier, context, next) {
  // Route integration gets the same offline stub as explicit fetchImpl tests.
  // Actual DNS pinning and TLS request options have separate transport tests.
  if (specifier === './ai-transport') {
    return { url: 'data:text/javascript,export const requestAiCompletion=(url,init)=>globalThis.fetch(url,init);', shortCircuit: true };
  }
  if (specifier === './runtime') {
    return { url: 'data:text/javascript,export const setting=key=>String(globalThis.__aiTestEnv[key]||%22%22).trim();export const getStorage=()=>{throw new Error(%22AI must not access storage%22)};', shortCircuit: true };
  }
  if (specifier.startsWith('@/')) specifier = new URL('../' + specifier.slice(2), import.meta.url).href;
  if ((specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('file:')) && !/\.(?:mjs|ts)$/.test(specifier)) {
    const url = new URL(specifier, context.parentURL);
    if (existsSync(fileURLToPath(url) + '.ts')) return { url: pathToFileURL(fileURLToPath(url) + '.ts').href, shortCircuit: true };
  }
  return next(specifier, context);
} });

const { generateAiWebsite, validateAiInput, cancelAiGeneration, AiGenerationError } = await import('../lib/ai-generation.ts');
const { AI_PROVIDERS, AI_SKILLS, AI_MAX_HTML_BYTES } = await import('../lib/ai-config.ts');
const { POST } = await import('../app/api/generate/route.ts');
const { POST: CANCEL_POST } = await import('../app/api/generate/cancel/route.ts');
const key = 'sk-offline-fixture-not-a-real-key';
const input = { provider: 'bailian', apiKey: key, model: 'qwen-plus', prompt: '为手工咖啡馆制作有作品介绍和联系方式的中文网站。' };
const requestId = '11111111-1111-4111-8111-111111111111';
const html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>咖啡馆</title></head><body><h1>每天一杯好咖啡</h1></body></html>';
const completion = (content = html, finish_reason = 'stop') => Response.json({ choices: [{ message: { content }, finish_reason }] });
const rejection = (status, text) => error => error instanceof AiGenerationError && error.status === status && (!text || error.message.includes(text));

let providerCalls = 0;
for (const provider of AI_PROVIDERS) {
  const result = await generateAiWebsite({ ...input, provider: provider.id, model: provider.defaultModel }, {
    fetchImpl: async (url, init) => {
      providerCalls++;
      assert.equal(url, provider.baseUrl + '/chat/completions');
      assert.equal(init.headers.Authorization, 'Bearer ' + key);
      assert.equal(init.redirect, 'error', 'redirects may not leak visitor credentials to another host');
      assert.equal(init.cache, 'no-store');
      const body = JSON.parse(init.body);
      assert.equal(body.model, provider.defaultModel);
      assert.equal(body.messages[0].role, 'system');
      for (const skill of AI_SKILLS) assert(body.messages[0].content.includes('[Skill: ' + skill + ']'));
      assert(body.messages[0].content.includes('用户的具体品牌与视觉要求优先'));
      assert.equal(body.messages[1].content, input.prompt);
      assert(!init.body.includes(key), 'key must only be an authorization header');
      assert.equal(body.max_tokens, 8192);
      assert(!('max_completion_tokens' in body), 'legacy requests retain only the default output limit field');
      assert.equal(body.stream, false);
      if (provider.id === 'bailian') assert.equal(body.enable_thinking, false);
      else assert.deepEqual(body.thinking, { type: 'disabled' });
      return completion('```html\n' + html + '\n```');
    },
  });
  assert.equal(result.html, html);
  assert.deepEqual(result.skills, AI_SKILLS);
  assert.equal(result.provider, provider.id);
  assert(!JSON.stringify(result).includes(key));
}
assert.equal(providerCalls, 2);

const customInput = { ...input, provider: 'custom', baseUrl: 'https://gateway.example.com/compatible/v1', model: 'org/Qwen-2.5:free', apiKey: 'gateway+token/with=chars:ok' };
for (const baseUrl of ['https://gateway.example.com/compatible/v1', 'https://gateway.example.com/compatible/v1/', 'https://gateway.example.com/compatible/v1/chat/completions', 'https://gateway.example.com/compatible/v1/chat/completions/']) {
  const result = await generateAiWebsite({ ...customInput, baseUrl }, { fetchImpl: async (url, init) => {
    assert.equal(url, 'https://gateway.example.com/compatible/v1/chat/completions');
    assert.equal(init.headers.Authorization, 'Bearer ' + customInput.apiKey);
    const body = JSON.parse(init.body);
    assert.equal(body.model, customInput.model);
    assert.equal(body.max_tokens, 8192);
    assert(!('max_completion_tokens' in body));
    assert(!('thinking' in body));
    assert(!('enable_thinking' in body));
    return completion();
  } });
  assert.equal(result.provider, 'custom');
  assert.equal(result.model, customInput.model);
  assert(!JSON.stringify(result).includes(customInput.apiKey));
}
assert.equal(validateAiInput({ ...input, model: 'new-provider-model' }).model, 'new-provider-model', 'legacy presets do not restrict model names');
assert.equal(validateAiInput({ ...customInput, model: ' @cf/openai/gpt-oss-120b ' }).model, '@cf/openai/gpt-oss-120b');
assert.equal(validateAiInput({ ...customInput, apiKey: 'x' }).apiKey, 'x', 'opaque credentials have no provider-specific minimum length');
assert.equal(validateAiInput(input).tokenParameter, 'max_tokens', 'legacy payloads default to max_tokens');
assert.equal(validateAiInput(customInput).tokenParameter, 'max_tokens', 'custom payloads default to max_tokens');

for (const tokenParameter of ['max_tokens', 'max_completion_tokens']) {
  const otherParameter = tokenParameter === 'max_tokens' ? 'max_completion_tokens' : 'max_tokens';
  assert.equal(validateAiInput({ ...customInput, tokenParameter }).tokenParameter, tokenParameter);
  let calls = 0;
  await generateAiWebsite({ ...customInput, tokenParameter }, { fetchImpl: async (_url, init) => {
    calls++;
    const body = JSON.parse(init.body);
    assert.equal(body[tokenParameter], 8192);
    assert(!(otherParameter in body), 'only the selected output limit field is sent');
    assert(!('tokenParameter' in body), 'local configuration is not an upstream request parameter');
    return completion();
  } });
  assert.equal(calls, 1);
  let failedCalls = 0;
  await assert.rejects(generateAiWebsite({ ...customInput, tokenParameter }, { fetchImpl: async () => {
    failedCalls++;
    return new Response('unsupported parameter', { status: 400 });
  } }), rejection(400));
  assert.equal(failedCalls, 1, 'parameter failures must not trigger automatic paid retries');
}

for (const bad of [
  null, [], { ...input, provider: 'https://127.0.0.1' }, { ...input, model: 'http://169.254.169.254' },
  { ...input, baseUrl: 'http://127.0.0.1' }, { ...input, endpoint: 'https://attacker.test' },
  { ...input, apiKey: '' }, { ...input, apiKey: key + '\r\nHeader:value' },
  { ...customInput, baseUrl: 'http://api.example.com' }, { ...customInput, baseUrl: 'https://127.0.0.1/v1' },
  { ...customInput, baseUrl: 'https://user:pass@api.example.com/v1' },
  { ...customInput, baseUrl: 'https://api.example.com/v1?key=secret' },
  { ...customInput, model: 'x'.repeat(201) }, { ...customInput, model: 'model\n' },
  { ...customInput, apiKey: 'x'.repeat(513) }, { ...customInput, apiKey: 'token with space' },
  { ...input, prompt: '短' }, { ...input, prompt: '文'.repeat(6001) },
  { ...input, requestId: null }, { ...input, requestId: 'guessable-task' },
  { ...input, requestId: '11111111-1111-1111-8111-111111111111' },
  { ...input, requestId: requestId + '\n' },
  ...[null, true, 8192, [], {}, '', 'max_output_tokens', ' max_tokens ', 'MAX_TOKENS'].map(tokenParameter => ({ ...customInput, tokenParameter })),
]) {
  assert.throws(() => validateAiInput(bad), AiGenerationError);
  await assert.rejects(generateAiWebsite(bad), AiGenerationError);
}

for (const [upstreamStatus, expected] of [[400, 400], [401, 401], [403, 401], [402, 402], [404, 400], [422, 400], [429, 429], [500, 502], [302, 502]]) {
  await assert.rejects(generateAiWebsite(input, { fetchImpl: async () => new Response('secret diagnostic: ' + key, { status: upstreamStatus }) }), error => {
    assert(!error.message.includes(key));
    return rejection(expected)(error);
  });
}
await assert.rejects(generateAiWebsite(input, { fetchImpl: async () => { throw new Error('network debug ' + key); } }), error => {
  assert(!error.message.includes(key)); return rejection(502)(error);
});

for (const response of [
  () => new Response('not JSON ' + key),
  () => Response.json({ choices: [] }),
  () => completion('Here is your website: ' + html),
  () => completion('<!DOCTYPE html><html><head></head><body>truncated'),
  () => completion(html, 'length'),
  () => completion(html, 'content_filter'),
  () => completion(html.replace('</body>', key + '</body>')),
  () => completion(html.replace('</body>', 'x'.repeat(AI_MAX_HTML_BYTES) + '</body>')),
  () => new Response('x', { headers: { 'Content-Length': '600001' } }),
  () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(600001))); controller.close(); } })),
]) await assert.rejects(generateAiWebsite(input, { fetchImpl: async () => response() }), rejection(502));

const noDoctype = await generateAiWebsite(input, { fetchImpl: async () => completion(html.replace('<!DOCTYPE html>', '')) });
assert(noDoctype.html.startsWith('<!DOCTYPE html>'));

const abortableFetch = async (_url, init) => new Promise((resolve, reject) => {
  if (init.signal.aborted) return reject(new Error('aborted'));
  init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
});
await assert.rejects(generateAiWebsite(input, { fetchImpl: abortableFetch, timeoutMs: 5 }), rejection(504));
const abortController = new AbortController();
const cancelled = generateAiWebsite(input, { fetchImpl: abortableFetch, signal: abortController.signal });
abortController.abort();
await assert.rejects(cancelled, rejection(499));
await assert.rejects(generateAiWebsite(input, { signal: abortController.signal }), rejection(499));

// Explicit cancellation works even when the Node adapter does not abort Request.signal.
let explicitSignal;
const explicitTask = generateAiWebsite({ ...input, requestId }, {
  fetchImpl: async (url, init) => {
    explicitSignal = init.signal;
    assert(!init.body.includes(requestId), 'private cancellation IDs are not sent to the model');
    return abortableFetch(url, init);
  },
});
await assert.rejects(generateAiWebsite({ ...input, requestId, apiKey: key + '-another' }), rejection(429));
cancelAiGeneration(requestId);
cancelAiGeneration(requestId);
assert.equal(explicitSignal.aborted, true);
await assert.rejects(explicitTask, rejection(499));
cancelAiGeneration(requestId); // Completed and missing IDs have the same result.
await assert.rejects(generateAiWebsite({ ...input, requestId }), rejection(499));
await generateAiWebsite(input, { fetchImpl: async () => completion() });
assert.throws(() => cancelAiGeneration('short'), AiGenerationError);

const streamingRequestId = '22222222-2222-4222-8222-222222222222';
const streamingTask = generateAiWebsite({ ...input, requestId: streamingRequestId }, {
  fetchImpl: async (_url, init) => new Response(new ReadableStream({ start(controller) {
    init.signal.addEventListener('abort', () => controller.error(new Error('cancelled response body')), { once: true });
  } })),
});
await Promise.resolve();
cancelAiGeneration(streamingRequestId);
await assert.rejects(streamingTask, rejection(499));

// Only two simultaneous jobs; same key has one slot. Every path releases it.
let finishFirst, finishSecond;
const first = generateAiWebsite(input, { fetchImpl: async () => new Promise(resolve => { finishFirst = resolve; }) });
await assert.rejects(generateAiWebsite(input), rejection(429));
const second = generateAiWebsite({ ...input, apiKey: key + '-second' }, { fetchImpl: async () => new Promise(resolve => { finishSecond = resolve; }) });
await assert.rejects(generateAiWebsite({ ...input, apiKey: key + '-third' }), rejection(429));
finishFirst(completion()); finishSecond(completion());
await Promise.all([first, second]);
await generateAiWebsite(input, { fetchImpl: async () => completion() });

const request = (body = input, options = {}) => new Request('https://wenbing.test/api/generate', {
  method: 'POST', headers: { Origin: 'https://wenbing.test', 'Content-Type': 'application/json', ...options.headers },
  body: options.rawBody ?? JSON.stringify(body), signal: options.signal,
});
globalThis.fetch = async () => completion();
const response = await POST(request());
assert.equal(response.status, 200);
assert.equal(response.headers.get('cache-control'), 'no-store');
assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
assert.equal((await response.json()).html, html);
for (const req of [
  request(input, { headers: { Origin: 'https://attacker.test' } }),
  request(input, { headers: { Origin: '' } }),
  request(input, { headers: { 'sec-fetch-site': 'cross-site' } }),
]) assert.equal((await POST(req)).status, 403);
for (const req of [
  request(input, { rawBody: '{"apiKey":"' + key }),
  request(input, { headers: { 'Content-Type': 'text/plain' } }),
  request({ ...input, prompt: '长'.repeat(24000) }),
]) {
  const failure = await POST(req);
  assert.equal(failure.status, 400);
  assert(!(await failure.text()).includes(key));
  assert.equal(failure.headers.get('cache-control'), 'no-store');
}
globalThis.fetch = async () => new Response('private upstream ' + key, { status: 401 });
const denied = await POST(request());
assert.equal(denied.status, 401);
assert(!(await denied.text()).includes(key));

const routeRequestId = '33333333-3333-4333-8333-333333333333';
const cancelRequest = (body = { requestId: routeRequestId }, options = {}) => new Request('https://wenbing.test/api/generate/cancel', {
  method: 'POST', headers: { Origin: 'https://wenbing.test', 'Content-Type': 'application/json', ...options.headers },
  body: options.rawBody ?? JSON.stringify(body),
});
const routeTask = generateAiWebsite({ ...input, requestId: routeRequestId }, { fetchImpl: abortableFetch });
const routeRejection = assert.rejects(routeTask, rejection(499));
for (let attempt = 0; attempt < 3; attempt++) {
  const accepted = await CANCEL_POST(cancelRequest());
  assert.equal(accepted.status, 202);
  assert.equal(accepted.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await accepted.json(), { accepted: true });
}
await routeRejection;
for (const req of [
  cancelRequest({ requestId }, { headers: { Origin: 'https://attacker.test' } }),
  cancelRequest({ requestId }, { headers: { Origin: '' } }),
  cancelRequest({ requestId }, { headers: { 'sec-fetch-site': 'cross-site' } }),
]) assert.equal((await CANCEL_POST(req)).status, 403);
for (const req of [
  cancelRequest(null), cancelRequest([]), cancelRequest({}), cancelRequest({ requestId: 'short' }),
  cancelRequest({ requestId, apiKey: key }),
  cancelRequest({ requestId }, { rawBody: '{' }),
  cancelRequest({ requestId }, { headers: { 'Content-Type': 'text/plain' } }),
  cancelRequest({ requestId: 'x'.repeat(1025) }),
]) {
  const failure = await CANCEL_POST(req);
  assert.equal(failure.status, 400);
  assert(!(await failure.text()).includes(key));
}
await generateAiWebsite(input, { fetchImpl: async () => completion() });

// Cancellation arriving first prevents any billable provider request.
const earlyRequestId = '44444444-4444-4444-8444-444444444444';
let earlyProviderCalls = 0;
const realDateNow = Date.now;
let testNow = realDateNow();
Date.now = () => testNow;
try {
  const earlyCancel = await CANCEL_POST(cancelRequest({ requestId: earlyRequestId }));
  assert.equal(earlyCancel.status, 202);
  globalThis.fetch = async () => { earlyProviderCalls++; return completion(); };
  const delayedGeneration = await POST(request({ ...input, requestId: earlyRequestId }));
  assert.equal(delayedGeneration.status, 499);
  assert.equal(earlyProviderCalls, 0);
  testNow += 120001;
  const afterExpiry = await POST(request({ ...input, requestId: earlyRequestId }));
  assert.equal(afterExpiry.status, 200, 'cancel records expire after two minutes');
  assert.equal(earlyProviderCalls, 1);
} finally { Date.now = realDateNow; }

// Floods of valid-but-unknown cancellation IDs have a fixed memory ceiling.
const boundedId = index => '55555555-5555-4555-8555-' + index.toString(16).padStart(12, '0');
for (let index = 0; index <= 256; index++) cancelAiGeneration(boundedId(index));
await generateAiWebsite({ ...input, requestId: boundedId(0) }, { fetchImpl: async () => completion() });
await assert.rejects(generateAiWebsite({ ...input, requestId: boundedId(256) }), rejection(499));

// Production paths must never import storage or write credentials/requests to disk.
const backend = readFileSync(new URL('../lib/ai-generation.ts', import.meta.url), 'utf8');
assert(!/console\.|getStorage|writeFile|appendFile|process\.env/.test(backend));
for (const skill of AI_SKILLS) {
  const license = readFileSync(new URL('../vendor/design-skills/' + skill + '/LICENSE', import.meta.url), 'utf8');
  assert(license.includes('MIT License'));
}
console.log('AI generation: custom endpoint/model contracts, selectable output limit fields without retries, optional presets, both skill prompts, limits, explicit/early cancellation with bounded expiry, concurrency, private errors and request-origin checks passed (offline mocks only).');
