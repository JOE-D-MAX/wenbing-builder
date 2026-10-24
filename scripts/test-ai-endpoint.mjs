import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

// No network, credentials, files containing secrets, or paid inference.
globalThis.fetch = async () => { throw new Error('unexpected external request'); };
registerHooks({ resolve(specifier, context, next) {
  if ((specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('file:')) && !/\.(?:mjs|ts)$/.test(specifier)) {
    const url = new URL(specifier, context.parentURL);
    if (existsSync(fileURLToPath(url) + '.ts')) return { url: pathToFileURL(fileURLToPath(url) + '.ts').href, shortCircuit: true };
  }
  return next(specifier, context);
} });
const { normalizeAiEndpoint, isPublicAiAddress, AiEndpointError } = await import('../lib/ai-endpoint.ts');
const { requestAiCompletion } = await import('../lib/ai-transport.ts');
const { generateAiWebsite, AiGenerationError } = await import('../lib/ai-generation.ts');

for (const [source, expected] of [
  ['https://api.example.com', 'https://api.example.com/chat/completions'],
  [' https://api.example.com/v1/ ', 'https://api.example.com/v1/chat/completions'],
  ['https://api.example.com/a/v1/chat/completions/', 'https://api.example.com/a/v1/chat/completions'],
  ['https://api.example.com.:8443/v1', 'https://api.example.com:8443/v1/chat/completions'],
  ['https://8.8.8.8/v1', 'https://8.8.8.8/v1/chat/completions'],
  ['https://[2606:4700:4700::1111]/v1', 'https://[2606:4700:4700::1111]/v1/chat/completions'],
]) assert.equal(normalizeAiEndpoint(source), expected);

for (const address of [
  '0.0.0.0', '0.1.2.3', '10.1.2.3', '100.64.0.1', '100.100.100.200', '127.0.0.1',
  '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.0.0.8', '192.0.2.1',
  '192.88.99.1', '192.168.1.1', '198.18.0.1', '198.19.255.255', '198.51.100.1',
  '203.0.113.1', '224.0.0.1', '239.255.255.255', '240.1.2.3', '255.255.255.255',
  '168.63.129.16', '::', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1',
  'fd00::1', 'fc00::1', 'fe80::1', 'fe80::1%eth0', 'ff02::1', '64:ff9b::a00:1',
  '2001::1', '2001:1ff::1', '2001:db8::1', '2002:7f00:1::1', '3fff::1', '3fff:fff::1',
  'not-an-ip', '1.2.3', '',
]) assert.equal(isPublicAiAddress(address), false, address);
for (const address of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.255.255', '172.32.0.1', '2001:4860:4860::8888', '2606:4700:4700::1111']) {
  assert.equal(isPublicAiAddress(address), true, address);
}
for (const source of [
  null, '', 'api.example.com', 'http://api.example.com/v1', 'file:///etc/passwd',
  'https://localhost/v1', 'https://localhost./v1', 'https://app.local/v1', 'https://app.internal/v1',
  'https://app.home.arpa/v1', 'https://singlelabel/v1', 'https://api.example/v1',
  'https://127.1/v1', 'https://2130706433/v1', 'https://0x7f000001/v1', 'https://0177.0.0.1/v1',
  'https://169.254.169.254/v1', 'https://[::1]/v1', 'https://[::ffff:7f00:1]/v1',
  'https://[2002:a00:1::]/v1', 'https://user:secret@api.example.com/v1',
  'https://api.example.com/v1?key=secret', 'https://api.example.com/v1#key',
  'https://api.example.com/v1?', 'https://api.example.com/v1#',
  'https://api.example.com\\@127.0.0.1/v1', 'https://api.example.com/has space',
  'https://api.example.com/v1\n', 'https://api.example.com/' + 'x'.repeat(2048),
]) assert.throws(() => normalizeAiEndpoint(source), AiEndpointError, String(source));

const endpoint = 'https://gateway.example.com:8443/compatible/v1';
const requestBody = JSON.stringify({ model: 'org/model', messages: [{ role: 'user', content: 'offline test' }] });
const init = { method: 'POST', headers: { Authorization: 'Bearer offline-fixture-token', 'Content-Type': 'application/json' }, body: requestBody, signal: new AbortController().signal };
const publicRecords = [{ address: '2606:4700:4700::1111', family: 6 }, { address: '93.184.216.34', family: 4 }];
let socketCalls = 0;
const neverConnect = () => { socketCalls++; throw new Error('socket must not open'); };
for (const records of [[], [{ address: '10.0.0.1', family: 4 }], [...publicRecords, { address: '127.0.0.1', family: 4 }], [{ address: '93.184.216.34', family: 6 }]]) {
  await assert.rejects(requestAiCompletion(endpoint, init, { lookupImpl: async () => records, requestImpl: neverConnect }), AiEndpointError);
}
assert.equal(socketCalls, 0, 'every DNS result must be public before opening a socket');

let lookupCalls = 0;
let sentBody;
let tlsOptions;
const responseBody = JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '<!DOCTYPE html><html><head><title>test</title></head><body>Hello</body></html>' } }] });
function stubRequest(status = 200, text = responseBody, headers = { 'content-type': 'application/json' }, hooks = {}) {
  return (url, options, callback) => {
    socketCalls++;
    tlsOptions = options;
    assert.equal(url.hostname, 'gateway.example.com');
    assert.equal(url.port, '8443');
    assert.equal(url.pathname, '/compatible/v1/chat/completions');
    assert.equal(options.agent, false);
    assert.notEqual(options.rejectUnauthorized, false);
    assert.equal(options.checkServerIdentity, undefined, 'native TLS hostname verification stays enabled');
    assert.equal(options.servername, undefined, 'HTTPS derives SNI from the original URL, never the pinned IP');
    assert.equal(options.headers['accept-encoding'], 'identity');
    options.lookup(url.hostname, {}, (error, address, family) => { assert.equal(error, null); assert.equal(address, '93.184.216.34'); assert.equal(family, 4); });
    options.lookup(url.hostname, { all: true }, (error, records) => { assert.equal(error, null); assert.deepEqual(records, [{ address: '93.184.216.34', family: 4 }]); });
    const outgoing = new EventEmitter();
    outgoing.end = body => {
      assert.equal(options.headers['content-length'], String(Buffer.byteLength(body)));
      sentBody = body;
      queueMicrotask(() => {
        const incoming = new PassThrough();
        incoming.statusCode = status;
        incoming.headers = headers;
        const onAbort = () => { incoming.destroy(new Error('aborted body')); outgoing.emit('error', new Error('aborted request')); };
        options.signal?.addEventListener('abort', onAbort, { once: true });
        incoming.on('close', () => options.signal?.removeEventListener('abort', onAbort));
        callback(incoming);
        hooks.onIncoming?.(incoming, outgoing, options);
        if (text !== null) incoming.end(text);
      });
    };
    return outgoing;
  };
}
const secureResponse = await requestAiCompletion(endpoint, init, {
  lookupImpl: async (hostname, options) => {
    lookupCalls++;
    assert.equal(hostname, 'gateway.example.com');
    assert.deepEqual(options, { all: true, verbatim: true });
    return lookupCalls === 1 ? publicRecords : [{ address: '127.0.0.1', family: 4 }];
  },
  requestImpl: stubRequest(),
});
assert.equal(await secureResponse.text(), responseBody);
assert.equal(sentBody, requestBody);
assert.equal(tlsOptions.signal, init.signal);
assert.equal(tlsOptions.family, 4, 'prefer public IPv4 for IPv4-only VPS compatibility');
assert.equal(lookupCalls, 1, 'TLS uses the pinned address, not a second attacker-controlled DNS result');

const redirectResponse = await requestAiCompletion(endpoint, init, { lookupImpl: async () => publicRecords, requestImpl: stubRequest(302, '', { location: 'https://attacker.example.com' }) });
assert.equal(redirectResponse.status, 302);
await redirectResponse.body.cancel();
assert.equal(socketCalls, 2, 'redirects are returned, never followed');

const beforeAbort = new AbortController();
beforeAbort.abort();
await assert.rejects(requestAiCompletion(endpoint, { ...init, signal: beforeAbort.signal }, { lookupImpl: async () => { throw new Error('DNS must not run'); }, requestImpl: neverConnect }));
const duringDns = new AbortController();
let finishLookup;
const dnsTask = requestAiCompletion(endpoint, { ...init, signal: duringDns.signal }, { lookupImpl: async () => new Promise(resolve => { finishLookup = resolve; }), requestImpl: neverConnect });
await Promise.resolve();
duringDns.abort();
await assert.rejects(dnsTask);
finishLookup(publicRecords);
await Promise.resolve();
assert.equal(socketCalls, 2, 'late DNS completion after cancellation must never open a socket');

const bodyAbort = new AbortController();
const streaming = await requestAiCompletion(endpoint, { ...init, signal: bodyAbort.signal }, { lookupImpl: async () => publicRecords, requestImpl: stubRequest(200, null) });
const streamFailure = assert.rejects(streaming.text());
bodyAbort.abort();
await streamFailure;

const testInput = { provider: 'custom', baseUrl: endpoint, apiKey: 'offline-fixture-token', model: 'org/model', prompt: 'Create a complete website for my handmade coffee store.' };
const rejectStatus = status => error => error instanceof AiGenerationError && error.status === status;
await assert.rejects(generateAiWebsite(testInput, {
  timeoutMs: 5,
  fetchImpl: (url, requestInit) => requestAiCompletion(url, requestInit, { lookupImpl: async () => new Promise(() => {}), requestImpl: neverConnect }),
}), rejectStatus(504));
await assert.rejects(generateAiWebsite(testInput, {
  fetchImpl: (url, requestInit) => requestAiCompletion(url, requestInit, { lookupImpl: async () => [{ address: '127.0.0.1', family: 4 }], requestImpl: neverConnect }),
}), rejectStatus(400));
await generateAiWebsite({ ...testInput, apiKey: 'a' }, { fetchImpl: async () => new Response(responseBody) });

for (const fakeRequest of [
  stubRequest(302, '', { location: 'https://attacker.example.com' }),
  stubRequest(200, 'x', { 'content-length': '600001' }),
  stubRequest(200, 'x'.repeat(600001)),
  stubRequest(200, null, {}, { onIncoming(incoming) { setImmediate(() => incoming.destroy(new Error('private upstream diagnostic ' + testInput.apiKey))); } }),
]) {
  await assert.rejects(generateAiWebsite(testInput, {
    fetchImpl: (url, requestInit) => requestAiCompletion(url, requestInit, { lookupImpl: async () => publicRecords, requestImpl: fakeRequest }),
  }), error => {
    assert(!error.message.includes(testInput.apiKey));
    return rejectStatus(502)(error);
  });
  // Transport/body failure releases the same credential's concurrency slot.
  await generateAiWebsite(testInput, { fetchImpl: async () => new Response(responseBody) });
}

for (const file of ['ai-endpoint.ts', 'ai-transport.ts']) {
  const source = readFileSync(new URL('../lib/' + file, import.meta.url), 'utf8');
  assert(!/console\.|getStorage|writeFile|appendFile|process\.env/.test(source), file + ' must not log or persist credentials');
}
console.log('Custom API endpoint: URL/IP validation, mixed DNS rejection, address pinning, original TLS hostname, no redirects, DNS/body abort and timeout verified with offline socket stubs.');
