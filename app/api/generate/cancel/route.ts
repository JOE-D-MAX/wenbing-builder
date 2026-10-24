import { AiGenerationError, cancelAiGeneration } from '@/lib/ai-generation';
import { json, readBody, requestOrigin } from '@/lib/request';

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== requestOrigin(request)
        || request.headers.get('sec-fetch-site') === 'cross-site') {
      return json({ error: '请求来源不正确，请在网站创作页面重试。' }, 403);
    }
    let body: unknown;
    try { body = await readBody(request, 1024); }
    catch { return json({ error: '取消请求格式不正确。' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).some(key => key !== 'requestId')) {
      return json({ error: '取消请求格式不正确。' }, 400);
    }
    cancelAiGeneration((body as { requestId?: unknown }).requestId);
    // Same response for active, finished, already cancelled and unknown IDs.
    return json({ accepted: true }, 202);
  } catch (error) {
    if (error instanceof AiGenerationError) return json({ error: error.message }, error.status);
    return json({ error: '暂时无法取消，请稍后重试。' }, 503);
  }
}
