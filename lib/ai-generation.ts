import { createHash } from 'node:crypto';
import {
  AI_MAX_HTML_BYTES, AI_MAX_PROMPT_CHARACTERS, AI_PROVIDERS, AI_SKILLS, AI_TIMEOUT_MS,
  type AiGenerationInput, type AiGenerationResult,
} from './ai-config';
import { AI_DESIGN_SYSTEM_PROMPT } from './ai-design-skills';
import { AiEndpointError, normalizeAiEndpoint } from './ai-endpoint';
import { requestAiCompletion } from './ai-transport';

const MAX_RESPONSE_BYTES = 600000;
const MAX_CONCURRENT = 2;
const CANCELLED_REQUEST_TTL_MS = 120000;
const MAX_CANCELLED_REQUESTS = 256;
const activeKeys = new Set<string>();
// Random task IDs only: credentials never enter this cancellation map.
const activeRequests = new Map<string, AbortController>();
// A cancel POST can arrive before its generate POST has finished uploading.
// Retain only a bounded, short-lived UUID set; no timer or credential storage.
const cancelledRequests = new Map<string, number>();

export class AiGenerationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AiGenerationError';
    this.status = status;
  }
}

function validateRequestId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AiGenerationError('生成任务标识不正确，请刷新创作页面后重试。');
  }
  return value.toLowerCase();
}

function pruneCancelledRequests(now: number): void {
  for (const [id, expiresAt] of cancelledRequests) {
    if (expiresAt <= now) cancelledRequests.delete(id);
  }
}

/** Idempotent: callers cannot discover whether a random task ID is active. */
export function cancelAiGeneration(requestId: unknown): void {
  const id = validateRequestId(requestId);
  const now = Date.now();
  pruneCancelledRequests(now);
  cancelledRequests.delete(id);
  cancelledRequests.set(id, now + CANCELLED_REQUEST_TTL_MS);
  while (cancelledRequests.size > MAX_CANCELLED_REQUESTS) {
    cancelledRequests.delete(cancelledRequests.keys().next().value!);
  }
  activeRequests.get(id)?.abort();
}

export function validateAiInput(value: unknown): AiGenerationInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AiGenerationError('请填写接口配置和网站需求。');
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['provider', 'baseUrl', 'tokenParameter', 'apiKey', 'model', 'prompt', 'requestId'].includes(key))) {
    throw new AiGenerationError('接口配置中包含不支持的字段。');
  }
  const tokenParameter = input.tokenParameter === undefined ? 'max_tokens' : input.tokenParameter;
  if (tokenParameter !== 'max_tokens' && tokenParameter !== 'max_completion_tokens') {
    throw new AiGenerationError('输出长度参数不正确，请选择 max_tokens 或 max_completion_tokens。');
  }
  const provider = AI_PROVIDERS.find(item => item.id === input.provider);
  const custom = input.provider === 'custom';
  if (!custom && !provider) throw new AiGenerationError('请填写有效的 API 配置。');
  if (!custom && input.baseUrl !== undefined) throw new AiGenerationError('自定义地址请使用自定义 API 配置。');
  let baseUrl: string | undefined;
  if (custom) {
    try { baseUrl = normalizeAiEndpoint(input.baseUrl); }
    catch (error) { throw new AiGenerationError(error instanceof AiEndpointError ? error.message : 'API 地址不正确。'); }
  }
  const model = typeof input.model === 'string' ? input.model.trim() : '';
  if (!/^[\x21-\x7e]{1,200}$/.test(model) || model.includes('://') || /^https?:/i.test(model) || /[\u0000-\u001f\u007f]/.test(String(input.model))) {
    throw new AiGenerationError('请填写 1～200 个字符的模型名称，不能包含空格、控制字符或网址。');
  }
  const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : '';
  if (!/^[\x21-\x7e]{1,512}$/.test(apiKey) || /[\u0000-\u001f\u007f]/.test(String(input.apiKey))) {
    throw new AiGenerationError('请检查 API Key，不能包含空格或换行。');
  }
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  if (prompt.length < 10 || prompt.length > AI_MAX_PROMPT_CHARACTERS) {
    throw new AiGenerationError(`请用 10～${AI_MAX_PROMPT_CHARACTERS} 个字符描述网站需求。`);
  }
  const requestId = input.requestId === undefined ? undefined : validateRequestId(input.requestId);
  return { provider: custom ? 'custom' : provider!.id, ...(baseUrl ? { baseUrl } : {}), tokenParameter, apiKey, model, prompt, ...(requestId ? { requestId } : {}) };
}

function upstreamError(status: number): AiGenerationError {
  if (status === 401 || status === 403) return new AiGenerationError('API Key 无法使用，请检查密钥、模型权限和接口地址是否匹配。', 401);
  if (status === 402) return new AiGenerationError('模型账户余额不足，请在对应服务商查看额度。', 402);
  if (status === 429) return new AiGenerationError('模型服务正在限流或额度不足，请稍后再试并检查账户额度。', 429);
  if (status === 400 || status === 404 || status === 422) return new AiGenerationError('模型服务未接受请求，请检查接口地址、模型名称、接口兼容设置和账户权限。', 400);
  return new AiGenerationError('模型服务暂时无法完成生成，请稍后再试。', 502);
}

async function readProviderJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get('content-length') || 0) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new AiGenerationError('生成结果过大，请简化网站需求后重试。', 502);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new AiGenerationError('模型没有返回内容，请稍后重试。', 502);
  let size = 0;
  const decoder = new TextDecoder();
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new AiGenerationError('生成结果过大，请简化网站需求后重试。', 502);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    try { return JSON.parse(text); }
    catch { throw new AiGenerationError('模型服务返回了无法读取的内容，请稍后重试。', 502); }
  } finally { reader.releaseLock(); }
}

function extractHtml(payload: unknown): string {
  const data = payload as { choices?: { finish_reason?: string; message?: { content?: unknown } }[] } | null;
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new AiGenerationError('页面内容超过了单次生成长度，请减少区块或缩短需求后重试。', 502);
  }
  if (choice?.finish_reason && choice.finish_reason !== 'stop') {
    throw new AiGenerationError('模型未完成本次页面生成，请调整需求后重试。', 502);
  }
  if (typeof choice?.message?.content !== 'string') {
    throw new AiGenerationError('模型没有返回完整网页，请调整需求后重试。', 502);
  }
  const raw = choice.message.content.trim();
  const fenced = /^```(?:html)?\s*\n?([\s\S]*?)\n?```$/i.exec(raw);
  let html = (fenced ? fenced[1] : raw).trim();
  if (!/^(?:<!doctype\s+html\s*>\s*)?<html(?:\s|>)/i.test(html)
      || !/<head(?:\s|>)[\s\S]*<\/head\s*>/i.test(html)
      || !/<body(?:\s|>)[\s\S]*<\/body\s*>\s*<\/html\s*>\s*$/i.test(html)) {
    throw new AiGenerationError('模型返回的网页不完整，请调整需求后重新生成。', 502);
  }
  if (!/^<!doctype/i.test(html)) html = '<!DOCTYPE html>\n' + html;
  if (new TextEncoder().encode(html).byteLength > AI_MAX_HTML_BYTES) {
    throw new AiGenerationError('网页体积超过限制，请简化需求后重试。', 502);
  }
  return html;
}

/** No storage, logging, automatic retries or server-owned key fallback. */
export async function generateAiWebsite(
  value: unknown,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<AiGenerationResult> {
  const input = validateAiInput(value);
  pruneCancelledRequests(Date.now());
  if (input.requestId && cancelledRequests.has(input.requestId)) throw new AiGenerationError('本次生成已取消。', 499);
  const endpoint = input.baseUrl ?? AI_PROVIDERS.find(item => item.id === input.provider)!.baseUrl + '/chat/completions';
  const keyId = createHash('sha256').update(endpoint + ':' + input.apiKey).digest('hex');
  if (input.requestId && activeRequests.has(input.requestId)) throw new AiGenerationError('这个任务正在生成网页，请等待完成后再试。', 429);
  if (activeKeys.has(keyId)) throw new AiGenerationError('这个 API 正在生成网页，请等待完成后再试。', 429);
  if (activeKeys.size >= MAX_CONCURRENT) throw new AiGenerationError('当前生成任务较多，请稍后重试。', 429);
  activeKeys.add(keyId);
  const controller = new AbortController();
  if (input.requestId) activeRequests.set(input.requestId, controller);
  let timedOut = false;
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs ?? AI_TIMEOUT_MS);
  try {
    if (controller.signal.aborted) throw new AiGenerationError('本次生成已取消。', 499);
    const response = await (options.fetchImpl ?? requestAiCompletion)(endpoint, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + input.apiKey },
      body: JSON.stringify({
        model: input.model,
        messages: [
          { role: 'system', content: AI_DESIGN_SYSTEM_PROMPT },
          { role: 'user', content: input.prompt },
        ],
        stream: false, [input.tokenParameter ?? 'max_tokens']: 8192,
        ...(input.provider === 'bailian' ? { enable_thinking: false } : input.provider === 'deepseek' ? { thinking: { type: 'disabled' } } : {}),
      }),
    });
    if (!response.ok) {
      // Never echo upstream error bodies: some services repeat submitted credentials.
      await response.body?.cancel();
      throw upstreamError(response.status);
    }
    const payload = await readProviderJson(response);
    if (controller.signal.aborted) throw new AiGenerationError('本次生成已取消。', 499);
    const html = extractHtml(payload);
    // Very short gateway tokens overlap ordinary HTML words and cannot be
    // identified reliably in generated prose. Credentials never enter prompts.
    if (input.apiKey.length >= 8 && html.includes(input.apiKey)) throw new AiGenerationError('返回内容异常，请重新生成。', 502);
    return { html, provider: input.provider, model: input.model, skills: AI_SKILLS };
  } catch (error) {
    if (timedOut) throw new AiGenerationError('生成超过 90 秒，请缩短需求或稍后重试。', 504);
    if (controller.signal.aborted) throw new AiGenerationError('本次生成已取消。', 499);
    if (error instanceof AiGenerationError) throw error;
    if (error instanceof AiEndpointError) throw new AiGenerationError(error.message);
    throw new AiGenerationError('暂时无法连接模型服务，请检查接口地址和服务状态后重试。', 502);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
    if (input.requestId) activeRequests.delete(input.requestId);
    activeKeys.delete(keyId);
  }
}
