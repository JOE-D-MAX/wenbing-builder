import {
  BACKGROUND_LIBRARY, EFFECT_LIBRARY, PALETTE_LIBRARY, cleanProjectColorSettings, createBlock, getBlockAppearance,
  safeBackgroundVideoSrc, safeBlockImage,
  type BlockAppearance, type BlockPage, type EffectId, type ProjectColorSettings, type SiteBlock,
} from './block-model';
import { isDarkProjectColor, variedAccentColors } from './project-colors';

type RandomStyleOptions = { blockId?: string; random?: () => number; spotlightEligible?: (block: SiteBlock) => boolean; colorSettings?: ProjectColorSettings };
type RandomStyleResult = { page: BlockPage; changed: number; paletteId: string; paletteName: string };
const baseColorKeys = ['backgroundColor', 'secondaryColor', 'textColor'] as const;
const availableEffects = new Set(EFFECT_LIBRARY.map(effect => effect.id));

function fraction(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? Math.min(1 - Number.EPSILON, Math.max(0, value)) : 0;
}

function pick<T>(values: readonly T[], random: () => number): T {
  return values[Math.floor(fraction(random) * values.length)];
}

function activeVideo(block: SiteBlock): boolean {
  return getBlockAppearance(block).background === 'video' && Boolean(safeBackgroundVideoSrc(block.backgroundVideo?.src));
}

function randomEffects(block: SiteBlock, dark: boolean, random: () => number, spotlightEligible: boolean): EffectId[] {
  // Spotlight is a rare accent, never the mandatory navigation effect.
  const spotlight = spotlightEligible && availableEffects.has('spotlight') && fraction(random) < .15;
  if (block.kind === 'nav') return spotlight ? ['spotlight'] : [];
  // Keep navigation steady, and reserve full background animations for large blocks.
  const immersive = ['surface', 'hero', 'signature'].includes(block.kind);
  const candidates: EffectId[] = immersive ? ['ambient', 'reveal', 'curtain', ...(dark && !activeVideo(block) ? ['stars' as const] : [])]
    : ['reveal', 'lift'];
  if (safeBlockImage(block.image)) candidates.push('zoom');
  const allowed = candidates.filter(effect => availableEffects.has(effect));
  const first = pick(allowed, random);
  const effects: EffectId[] = [first];
  const second = allowed.filter(effect => effect !== first
    // Two entry animations or two full background animations obscure each other.
    && !(['reveal', 'curtain'].includes(first) && ['reveal', 'curtain'].includes(effect))
    && !(['ambient', 'stars'].includes(first) && ['ambient', 'stars'].includes(effect)));
  if (spotlight) effects.push('spotlight');
  else if (second.length && fraction(random) >= .5) effects.push(pick(second, random));
  return effects;
}

/** Share base colors and vary accents by default; unified mode respects the chosen colors. */
export function randomizePageStyle(page: BlockPage, options: RandomStyleOptions = {}): RandomStyleResult {
  const random = options.random || Math.random;
  const createFirstBlock = options.blockId === undefined && page.blocks.length === 0;
  const blocks = createFirstBlock ? [createBlock('surface')] : page.blocks;
  const targets = blocks.filter(block => block.kind !== 'embed' && (options.blockId === undefined || block.id === options.blockId));
  if (!targets.length) return { page, changed: 0, paletteId: '', paletteName: '' };

  const previous = getBlockAppearance(targets[0]);
  // A video already has a dark overlay; keep a palette with light foreground text.
  const palettes = targets.some(activeVideo) ? PALETTE_LIBRARY.filter(item => isDarkProjectColor(item.appearance.backgroundColor)) : PALETTE_LIBRARY;
  const different = palettes.filter(item => baseColorKeys.some(key => item.appearance[key] !== previous[key]));
  const saved = cleanProjectColorSettings(options.colorSettings, previous);
  const palette = saved?.unified
    ? { id: 'custom', name: '自定义配色', appearance: { background: 'solid' as const, ...saved.colors } }
    : pick(different.length ? different : palettes, random);
  const dark = isDarkProjectColor(palette.appearance.backgroundColor);
  const accents = saved?.unified ? [] : variedAccentColors(palette.appearance, targets.length, random);
  const backgrounds = BACKGROUND_LIBRARY.filter(background => background.id !== 'video' && background.id !== 'grid');
  const targetIds = new Set(targets.map(block => block.id));
  let changed = 0, colorIndex = 0;
  const styled = blocks.map(block => {
    if (!targetIds.has(block.id)) return block;
    const appearance: BlockAppearance = {
      ...palette.appearance,
      accentColor: saved?.unified ? palette.appearance.accentColor : accents[colorIndex++],
      background: activeVideo(block) ? 'video' : pick(backgrounds, random).id,
    };
    const effects = randomEffects(block, dark, random, options.spotlightEligible?.(block) ?? true);
    const theme = dark ? 'dark' : 'light';
    if (!createFirstBlock && block.theme === theme && JSON.stringify(block.appearance) === JSON.stringify(appearance)
      && JSON.stringify(block.effects) === JSON.stringify(effects)) return block;
    changed++;
    return { ...block, theme, appearance, effects } satisfies SiteBlock;
  });
  return { page: changed ? { ...page, blocks: styled } : page, changed, paletteId: palette.id, paletteName: palette.name };
}
