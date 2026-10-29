import {
  PALETTE_LIBRARY, cleanProjectColorSettings, getBlockAppearance,
  type BlockColors, type BlockProject, type ProjectColorSettings, type SiteBlock,
} from './block-model';

function colorsOnly(colors: BlockColors): BlockColors {
  const { backgroundColor, secondaryColor, textColor, accentColor } = colors;
  return { backgroundColor, secondaryColor, textColor, accentColor };
}

/** Read the live base colors when switching on, instead of stale stored colors. */
export function getProjectColorSettings(project: BlockProject): ProjectColorSettings {
  const first = project.pages.flatMap(page => page.blocks).find(block => block.kind !== 'embed');
  const colors = colorsOnly(first ? getBlockAppearance(first, project.accent) : PALETTE_LIBRARY[0].appearance);
  const saved = cleanProjectColorSettings(project.colorSettings, colors);
  return saved?.unified ? saved : { unified: false, colors };
}

function luminance(color: string): number {
  const channels = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

export function isDarkProjectColor(color: string): boolean { return luminance(color) < .179; }

/** Newly inserted native blocks inherit an enabled project palette without touching their behavior. */
export function inheritUnifiedColors(block: SiteBlock, project: BlockProject): SiteBlock {
  if (block.kind === 'embed') return block;
  const settings = getProjectColorSettings(project);
  if (!settings.unified) return block;
  return {
    ...block, appearance: { ...getBlockAppearance(block, project.accent), ...settings.colors },
    theme: isDarkProjectColor(settings.colors.backgroundColor) ? 'dark' : 'light',
  };
}

function contrast(left: string, right: string): number {
  const a = luminance(left), b = luminance(right);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

/** Readable accent colors; rotating the pool prevents identical neighbors even with a fixed RNG. */
export function variedAccentColors(colors: BlockColors, count: number, random: () => number = Math.random): string[] {
  const candidates = [...new Set([
    colors.accentColor.toLowerCase(),
    '#f5b544', '#66c5f5', '#d9fb68', '#f5a3c7', '#b9a3f5', '#7fdec5',
    '#2355b7', '#8b2b52', '#2b6a55', '#8543a3', '#98500f', '#a02a36',
    '#100514', '#040f12', '#151207', '#120a1e',
    '#000000', '#010101', '#fefefe', '#ffffff',
  ])];
  const readable = candidates.filter(color => contrast(color, colors.backgroundColor) >= 4.5);
  const bothBackgrounds = readable.filter(color => contrast(color, colors.secondaryColor) >= 4.5);
  const pool = bothBackgrounds.length >= 2 ? bothBackgrounds : readable;
  const roll = random();
  const fraction = Number.isFinite(roll) ? Math.min(1 - Number.EPSILON, Math.max(0, roll)) : 0;
  const offset = Math.floor(fraction * pool.length);
  return Array.from({ length: count }, (_, index) => pool[(offset + index) % pool.length]);
}

/** Change only project color settings and the four native block colors, in one history update. */
export function applyProjectColorSettings(project: BlockProject, settings: ProjectColorSettings, options: { random?: () => number } = {}): BlockProject {
  const current = getProjectColorSettings(project);
  const safe = cleanProjectColorSettings(settings, current.colors) || current;
  const count = project.pages.reduce((total, page) => total + page.blocks.filter(block => block.kind !== 'embed').length, 0);
  const accents = safe.unified ? [] : variedAccentColors(safe.colors, count, options.random);
  const theme = isDarkProjectColor(safe.colors.backgroundColor) ? 'dark' : 'light';
  let index = 0;
  const pages = project.pages.map(page => ({ ...page, blocks: page.blocks.map(block => {
    if (block.kind === 'embed') return block;
    const appearance = {
      ...getBlockAppearance(block, project.accent), ...safe.colors,
      accentColor: safe.unified ? safe.colors.accentColor : accents[index++],
    };
    return { ...block, appearance, theme } satisfies SiteBlock;
  }) }));
  return { ...project, pages, colorSettings: safe };
}
