import { AiGenerationError, generateAiWebsite } from '@/lib/ai-generation';
import { json, readBody, requestOrigin } from '@/lib/request';

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== requestOrigin(request)
        || request.headers.get('sec-fetch-site') === 'cross-site') {
      return json({ error: '请求来源不正确，请在网站创作页面重试。' }, 403);
    }
    let body: unknown;
    try { body = await readBody(request, 24000); }
    catch { return json({ error: '请求格式不正确或内容过长，请检查网站需求后重试。' }, 400); }
    const result = await generateAiWebsite(body, { signal: request.signal });
    return json(result);
  } catch (error) {
    if (error instanceof AiGenerationError) return json({ error: error.message }, error.status);
    return json({ error: '生成服务暂时不可用，请稍后重试。' }, 503);
  }
}
