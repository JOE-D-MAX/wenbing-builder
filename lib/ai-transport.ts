import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import type { IncomingMessage } from 'node:http';
import { AiEndpointError, isPublicAiAddress, normalizeAiEndpoint } from './ai-endpoint';

type Address = { address: string; family: number };
type Resolver = (hostname: string, options: { all: true; verbatim: true }) => Promise<Address[]>;
type TransportOptions = { lookupImpl?: Resolver; requestImpl?: typeof request };

function abortError(): Error { return new Error('API request aborted'); }

function responseStream(incoming: IncomingMessage): ReadableStream<Uint8Array> {
  const iterator = incoming[Symbol.asyncIterator]();
  let closed = false;
  // An abort can arrive before the web reader's first pull. Keep the native
  // stream error handled; the iterator still propagates it to the reader.
  incoming.on('error', () => {});
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (closed) return;
        if (next.done) { closed = true; controller.close(); }
        else controller.enqueue(next.value);
      } catch (error) { if (!closed) { closed = true; controller.error(error); } }
    },
    async cancel() {
      closed = true;
      incoming.destroy();
      await iterator.return?.().catch(() => {});
    },
  });
}

async function resolvePublicAddress(host: string, signal: AbortSignal | null | undefined, resolver: Resolver): Promise<Address> {
  if (signal?.aborted) throw abortError();
  const records = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await new Promise<Address[]>((resolve, reject) => {
      const abort = () => reject(abortError());
      signal?.addEventListener('abort', abort, { once: true });
      Promise.resolve().then(() => resolver(host, { all: true, verbatim: true })).then(resolve, reject).finally(() => signal?.removeEventListener('abort', abort));
    });
  if (signal?.aborted) throw abortError();
  if (!records.length || records.some(record => !isPublicAiAddress(record.address) || record.family !== isIP(record.address))) {
    throw new AiEndpointError('API 域名解析到了内网或保留地址，请使用公网接口。');
  }
  // Many small servers have no IPv6 egress. Prefer a verified IPv4 address when
  // both are present; choosing it here never repeats a potentially billable POST.
  return records.find(record => record.family === 4) ?? records[0];
}

/**
 * DNS is checked once and the exact validated address is pinned to TLS lookup.
 * The original hostname remains the HTTP Host and TLS verification/SNI name.
 * No proxy, redirect, retry, persistent agent or credential storage is involved.
 */
export async function requestAiCompletion(endpoint: string, init: RequestInit, options: TransportOptions = {}): Promise<Response> {
  const url = new URL(normalizeAiEndpoint(endpoint));
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const address = await resolvePublicAddress(host, init.signal, options.lookupImpl ?? lookup);
  if (init.signal?.aborted) throw abortError();
  if (init.method !== 'POST' || typeof init.body !== 'string') throw new Error('Invalid API request');
  const headers = new Headers(init.headers);
  headers.set('Accept-Encoding', 'identity');
  headers.set('Content-Length', String(Buffer.byteLength(init.body)));
  return new Promise<Response>((resolve, reject) => {
    const outgoing = (options.requestImpl ?? request)(url, {
      method: 'POST', headers: Object.fromEntries(headers), signal: init.signal ?? undefined,
      agent: false, family: address.family, maxHeaderSize: 16384,
      lookup: (_hostname, lookupOptions, callback) => {
        if (lookupOptions.all) callback(null, [{ address: address.address, family: address.family }]);
        else callback(null, address.address, address.family);
      },
    }, incoming => {
      try {
        const responseHeaders = new Headers();
        for (const name of ['content-type', 'content-length']) {
          const value = incoming.headers[name];
          if (value) responseHeaders.set(name, Array.isArray(value) ? value.join(', ') : value);
        }
        resolve(new Response(responseStream(incoming), {
          status: incoming.statusCode ?? 502, headers: responseHeaders,
        }));
      } catch (error) { incoming.destroy(); reject(error); }
    });
    outgoing.on('error', reject);
    outgoing.end(init.body);
  });
}
