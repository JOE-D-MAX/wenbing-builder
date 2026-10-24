export type Audience = 'personal' | 'merchant';
export type Tier = 'template' | 'refine' | 'signature';
export type Pricing = Record<Audience, Record<Tier, number>>;

// Amounts are integer CNY cents. Both upgrades are relative to the base price.
export const PRICING: Pricing = {
  personal: { template: 19900, refine: 69900, signature: 119900 },
  merchant: { template: 80000, refine: 130000, signature: 180000 },
};
export function audienceFor(kind: unknown): Audience {
  if (kind === 'personal') return 'personal';
  if (kind === 'business' || kind === 'restaurant') return 'merchant';
  throw new Error('网站类型无效。');
}
export function priceFor(kind: unknown, tier: unknown = 'template', pricing: Pricing = PRICING): number {
  if (tier !== 'template' && tier !== 'refine' && tier !== 'signature') throw new Error('服务档次无效。');
  return pricing[audienceFor(kind)][tier];
}
