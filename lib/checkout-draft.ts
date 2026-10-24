import { normalizeBrief, type Brief } from './studio';

export type CheckoutDraft = { version: 1; id: string; brief: Brief };
const validId = (id: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);

export function checkoutStorageKey(id: string) {
  if (!validId(id)) throw new Error('待发布设计编号无效，请返回重新预览。');
  return 'forma-checkout-v1:' + id;
}

export function serializeCheckoutDraft(id: string, input: Brief): string {
  checkoutStorageKey(id);
  const brief = normalizeBrief(input);
  if (!brief.name.trim() || brief.text.trim().length < 8) throw new Error('请先完成网站资料并生成预览。');
  return JSON.stringify({ version: 1, id, brief } satisfies CheckoutDraft);
}

export function readCheckoutDraft(raw: string, expectedId: string): CheckoutDraft {
  checkoutStorageKey(expectedId);
  if (raw.length > 1800000) throw new Error('待发布资料过大，请返回重新预览。');
  let data: CheckoutDraft;
  try { data = JSON.parse(raw); } catch { throw new Error('待发布设计无法读取，请返回重新预览。'); }
  if (!data || data.version !== 1 || data.id !== expectedId) throw new Error('待发布设计与当前页面不匹配，请返回重新预览。');
  // Only known, validated fields cross the page boundary; never trust cached HTML or a client price.
  return JSON.parse(serializeCheckoutDraft(expectedId, data.brief)) as CheckoutDraft;
}
