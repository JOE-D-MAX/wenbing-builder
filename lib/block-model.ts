import { secureRandomUUID } from './client-compat';

export type BlockKind = 'surface' | 'nav' | 'hero' | 'text' | 'project' | 'accordion' | 'contact' | 'signature' | 'embed';
export type EffectId = 'spotlight' | 'reveal' | 'lift' | 'zoom' | 'stars' | 'curtain' | 'ambient';
export type BackgroundId = 'solid' | 'gradient' | 'grid' | 'dots' | 'halo' | 'video';
export type BackgroundVideo = { src: string; poster?: string; dim: number; paused?: boolean };
export const MAX_BACKGROUND_VIDEO_BYTES = 2 * 1024 * 1024;
export const DESIGN_IDS = ['editorial-nav', 'editorial-hero', 'editorial-intro', 'editorial-metrics', 'editorial-timeline', 'editorial-project', 'editorial-steps', 'editorial-contact'] as const;
export type DesignId = (typeof DESIGN_IDS)[number];
export type BlockAppearance = { background: BackgroundId; backgroundColor: string; secondaryColor: string; textColor: string; accentColor: string };
export type BlockLink = { type: 'none' | 'page' | 'section' | 'url' | 'modal'; target: string };
export type SiteBlock = {
  id: string; kind: BlockKind; title: string; text: string; eyebrow: string;
  theme: 'dark' | 'light'; button: string; link: BlockLink; effects: EffectId[];
  image: string; items: { title: string; text: string }[]; html?: string; appearance?: BlockAppearance;
  /** Optional native portfolio composition. Omitted values retain existing drafts. */
  span?: 'half' | 'full'; presentation?: 'section-heading' | 'about' | 'business' | 'detail'; highlight?: string;
  /** Optional reusable design; absent in existing drafts. */
  design?: DesignId;
  /** A decorative video layer; independent from the block's foreground image. */
  backgroundVideo?: BackgroundVideo;
};
export type BlockPage = { id: string; title: string; blocks: SiteBlock[] };
export type BlockProject = { version: 1; name: string; accent: string; pages: BlockPage[]; layout?: 'portfolio' };
export const BLOCK_STORAGE_KEY = 'wenbing-block-project-v1';
export const BLOCK_IMPORT_KEY = 'wenbing-block-html-import-v1';
export const MAX_EMBED_HTML_CHARS = 2000000;
export const MAX_BLOCKS = 24;
export const MAX_PAGES = 8;
export const BACKGROUND_LIBRARY: { id: BackgroundId; name: string; description: string }[] = [
  { id: 'solid', name: '纯色背景', description: '用一块颜色承托内容' },
  { id: 'gradient', name: '柔和渐变', description: '让两种背景色自然过渡' },
  { id: 'grid', name: '细线网格', description: '以规则线条增加空间感' },
  { id: 'dots', name: '点阵底纹', description: '为背景增加轻微纹理' },
  { id: 'halo', name: '雾光背景', description: '柔和静态光晕，让深浅配色产生空间感' },
  { id: 'video', name: '视频背景', description: '让视频铺在内容后方，可暂停并调整遮罩' },
];
export const PALETTE_LIBRARY: { id: string; name: string; appearance: BlockAppearance }[] = [
  { id: 'paper', name: '纸白', appearance: { background: 'solid', backgroundColor: '#ffffff', secondaryColor: '#edf2f7', textColor: '#172033', accentColor: '#2563eb' } },
  { id: 'black-gold', name: '黑金', appearance: { background: 'solid', backgroundColor: '#090909', secondaryColor: '#29251b', textColor: '#f0efed', accentColor: '#f5b544' } },
  { id: 'ocean', name: '深海蓝', appearance: { background: 'solid', backgroundColor: '#10243a', secondaryColor: '#214b66', textColor: '#edf6ff', accentColor: '#66c5f5' } },
  { id: 'mint', name: '薄荷绿', appearance: { background: 'solid', backgroundColor: '#eaf5ef', secondaryColor: '#cce7d9', textColor: '#173c2e', accentColor: '#21765b' } },
  { id: 'sand', name: '暖砂', appearance: { background: 'solid', backgroundColor: '#f4eee4', secondaryColor: '#dfcdb6', textColor: '#443322', accentColor: '#9c4f2a' } },
  { id: 'ink-lime', name: '墨黑荧绿', appearance: { background: 'solid', backgroundColor: '#080a08', secondaryColor: '#1a2114', textColor: '#f2f3ed', accentColor: '#d9fb68' } },
];
const NEUTRAL_ACCENT = '#2563eb';
function safeColor(value: unknown, fallback: string): string { return typeof value === 'string' && /^#[a-fA-F0-9]{6}$/.test(value) ? value : fallback; }
function cleanAppearance(value: unknown, fallback: BlockAppearance): BlockAppearance {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    background: BACKGROUND_LIBRARY.some(item => item.id === input.background) ? input.background as BackgroundId : fallback.background,
    backgroundColor: safeColor(input.backgroundColor, fallback.backgroundColor), secondaryColor: safeColor(input.secondaryColor, fallback.secondaryColor),
    textColor: safeColor(input.textColor, fallback.textColor), accentColor: safeColor(input.accentColor, fallback.accentColor),
  };
}
/** Resolve legacy themes without changing their saved project data. */
export function getBlockAppearance(block: Pick<SiteBlock, 'theme' | 'appearance'>, accent = NEUTRAL_ACCENT): BlockAppearance {
  const fallback: BlockAppearance = block.theme === 'light'
    ? { background: 'solid', backgroundColor: '#eceae4', secondaryColor: '#d5d1c6', textColor: '#141414', accentColor: safeColor(accent, NEUTRAL_ACCENT) }
    : { background: 'solid', backgroundColor: '#090909', secondaryColor: '#181815', textColor: '#f0efed', accentColor: safeColor(accent, NEUTRAL_ACCENT) };
  return cleanAppearance(block.appearance, fallback);
}
/** Only enum values and six-digit HEX colors reach generated CSS. */
export function appearanceStyle(value: BlockAppearance): Record<string, string> {
  const appearance = cleanAppearance(value, PALETTE_LIBRARY[0].appearance);
  const { background, backgroundColor, secondaryColor, textColor, accentColor } = appearance;
  const line = `color-mix(in srgb, ${textColor} 12%, transparent)`;
  const backgroundImage = background === 'gradient' ? `linear-gradient(135deg, ${backgroundColor}, ${secondaryColor})`
    : background === 'grid' ? `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`
    : background === 'dots' ? `radial-gradient(${line} 1px, transparent 1px)`
    : background === 'halo' ? `radial-gradient(ellipse at 78% 24%, color-mix(in srgb, ${accentColor} 16%, transparent), transparent 57%), radial-gradient(ellipse at 18% 90%, ${secondaryColor}, transparent 62%)` : 'none';
  const channels = [1, 3, 5].map(index => parseInt(accentColor.slice(index, index + 2), 16) / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  return {
    backgroundColor, backgroundImage, backgroundSize: background === 'grid' ? '32px 32px' : background === 'dots' ? '20px 20px' : 'auto', color: textColor,
    '--accent': accentColor, '--block-text': textColor, '--block-bg': backgroundColor, '--block-secondary': secondaryColor,
    '--muted': `color-mix(in srgb, ${textColor} 72%, ${backgroundColor})`, '--block-border': `color-mix(in srgb, ${textColor} 18%, transparent)`,
    '--accent-text': luminance > .179 ? '#090909' : '#ffffff',
  };
}
export const BLOCK_LIBRARY: { kind: BlockKind; name: string; description: string }[] = [
  { kind: 'surface', name: '空白区块', description: '先搭配背景、颜色与动态效果' },
  { kind: 'nav', name: '导航栏', description: '连接页面与区块' },
  { kind: 'hero', name: '首屏', description: '标题、简介与行动入口' },
  { kind: 'text', name: '文字区块', description: '用于标题、说明与正文' },
  { kind: 'project', name: '图片卡片', description: '上传图片并设置点击行为' },
  { kind: 'accordion', name: '折叠列表', description: '点击展开列表内容' },
  { kind: 'contact', name: '行动区块', description: '说明文字与跳转按钮' },
  { kind: 'signature', name: '大字展示', description: '独立文字，可选配鼠标追光' },
];
export const EFFECT_LIBRARY: { id: EffectId; name: string; description: string }[] = [
  { id: 'ambient', name: '雾光流动', description: '强调色与辅助色光晕缓慢漂移，保留区块原有内容' },
  { id: 'curtain', name: '开场揭幕', description: '进入视野时双侧幕布向外揭开，仅播放一次' },
  { id: 'spotlight', name: '鼠标追光', description: '光晕跟随鼠标，使用区块强调色' },
  { id: 'zoom', name: '图片放大', description: '悬停时缓慢推近图片' },
  { id: 'reveal', name: '滚动渐入', description: '进入视野时轻轻浮现' },
  { id: 'lift', name: '悬停浮起', description: '鼠标经过时轻微抬升' },
  { id: 'stars', name: '星空漂移', description: '沿用建站首页的星点氛围' },
];
export function blockId(prefix = 'b') { return prefix + '-' + secureRandomUUID(); }
export function createBlock(kind: BlockKind): SiteBlock {
  const shared: SiteBlock = { id: blockId(), kind, title: '', text: '', eyebrow: '', theme: 'light', button: '', link: { type: 'none', target: '' }, effects: [], image: '', items: [], appearance: { ...PALETTE_LIBRARY[0].appearance } };
  const content: Partial<SiteBlock> = {
    surface: {},
    nav: { title: '网站名称' },
    hero: { title: '输入标题', text: '填写内容', button: '按钮文字' },
    text: { title: '输入标题', text: '填写内容' },
    project: { title: '输入标题', text: '填写内容', button: '按钮文字' },
    accordion: { title: '输入标题', items: [{ title: '列表标题', text: '填写内容' }, { title: '列表标题', text: '填写内容' }] },
    contact: { title: '输入标题', text: '填写内容', button: '按钮文字' },
    signature: { title: '输入文字' },
    embed: { title: '导入网页', text: '保留静态布局，可在前后添加区块。', html: '' },
  }[kind] as Partial<SiteBlock>;
  return { ...shared, ...content };
}
export function createStarterProject(): BlockProject {
  return { version: 1, name: '未命名网站', accent: NEUTRAL_ACCENT, pages: [{ id: 'start-home', title: '首页', blocks: [] }] };
}
export function safeBlockUrl(value: string): string {
  if (typeof value !== 'string' || /[\u0000-\u0020\u007f]/.test(value)) return '';
  try { const url = new URL(value); return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? value : ''; } catch { return ''; }
}
export function safeBlockImage(value: string): string {
  return /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value) && value.length <= 2000000 ? value : '';
}
function safeBackgroundHttps(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4000 || !/^https:\/\//i.test(value) || /[\u0000-\u0020\u007f\\]/.test(value)) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !!url.hostname ? value : '';
  } catch { return ''; }
}
/** Strict, bounded media sources. URLs may include signed CDN query parameters. */
export function safeBackgroundVideoSrc(value: unknown): string {
  if (typeof value !== 'string') return '';
  if (value.startsWith('data:')) {
    const prefix = /^data:video\/(?:mp4|webm);base64,/.exec(value)?.[0];
    if (!prefix || value.length > prefix.length + Math.ceil(MAX_BACKGROUND_VIDEO_BYTES / 3) * 4) return '';
    const encoded = value.slice(prefix.length);
    if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return '';
    const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
    const bytes = encoded.length / 4 * 3 - padding;
    if (bytes > MAX_BACKGROUND_VIDEO_BYTES) return '';
    return value;
  }
  return safeBackgroundHttps(value);
}
export function cleanBackgroundVideo(value: unknown): BackgroundVideo | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;
  const src = safeBackgroundVideoSrc(input.src);
  if (!src) return undefined;
  const poster = typeof input.poster === 'string' ? safeBlockImage(input.poster) || safeBackgroundHttps(input.poster) : '';
  const dim = typeof input.dim === 'number' && Number.isFinite(input.dim) ? Math.max(0, Math.min(.8, input.dim)) : .35;
  return { src, ...(poster ? { poster } : {}), dim, ...(typeof input.paused === 'boolean' ? { paused: input.paused } : {}) };
}
function text(value: unknown, max: number) { return typeof value === 'string' ? value.slice(0, max) : ''; }
function identifier(value: unknown) { return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : ''; }
export function parseBlockProject(value: unknown): BlockProject {
  if (!value || typeof value !== 'object') throw new Error('这不是有效的模块项目。');
  const input = value as Record<string, unknown>;
  if (input.version !== 1 || !Array.isArray(input.pages) || input.pages.length < 1 || input.pages.length > MAX_PAGES) throw new Error('项目版本或页面数量不受支持。');
  const seen = new Set<string>();
  const unique = (id: unknown) => { const next = identifier(id); if (!next || seen.has(next)) throw new Error('项目中存在无效或重复的区块标识。'); seen.add(next); return next; };
  const pages = input.pages.map((raw: unknown): BlockPage => {
    if (!raw || typeof raw !== 'object') throw new Error('页面资料不完整。');
    const page = raw as Record<string, unknown>;
    if (!Array.isArray(page.blocks) || page.blocks.length > MAX_BLOCKS) throw new Error(`每页最多添加 ${MAX_BLOCKS} 个模块。`);
    return { id: unique(page.id), title: text(page.title, 60) || '新页面', blocks: page.blocks.map((item: unknown): SiteBlock => {
      if (!item || typeof item !== 'object') throw new Error('模块资料不完整。');
      const b = item as Record<string, unknown>, kind = b.kind as BlockKind;
      if (![...BLOCK_LIBRARY.map(x => x.kind), 'embed'].includes(kind)) throw new Error('包含不支持的模块类型。');
      if (kind === 'embed' && (typeof b.html !== 'string' || b.html.length > MAX_EMBED_HTML_CHARS)) throw new Error('导入的完整网页过大或内容不正确。');
      const link = b.link && typeof b.link === 'object' ? b.link as Record<string, unknown> : {};
      const linkType = ['none', 'page', 'section', 'url', 'modal'].includes(link.type as string) ? link.type as BlockLink['type'] : 'none';
      const theme = b.theme === 'light' ? 'light' : 'dark';
      const appearance = b.appearance && typeof b.appearance === 'object' ? getBlockAppearance({ theme, appearance: b.appearance as BlockAppearance }, safeColor(input.accent, NEUTRAL_ACCENT)) : undefined;
      const backgroundVideo = cleanBackgroundVideo(b.backgroundVideo);
      return { id: unique(b.id), kind, title: text(b.title, 160), text: text(b.text, 5000), eyebrow: text(b.eyebrow, 100), button: text(b.button, 60), theme, image: safeBlockImage(text(b.image, 2000001)), effects: Array.isArray(b.effects) ? [...new Set(b.effects.filter((x): x is EffectId => EFFECT_LIBRARY.some(e => e.id === x)))] : [], link: { type: linkType, target: linkType === 'url' ? safeBlockUrl(text(link.target, 2000)) : text(link.target, 80) }, items: Array.isArray(b.items) ? b.items.slice(0, 12).map(x => ({ title: text(x?.title, 100), text: text(x?.text, 3000) })) : [], ...(kind === 'embed' ? { html: text(b.html, MAX_EMBED_HTML_CHARS) } : {}), ...(appearance ? { appearance } : {}), ...(b.span === 'half' || b.span === 'full' ? { span: b.span } : {}), ...(['section-heading', 'about', 'business', 'detail'].includes(b.presentation as string) ? { presentation: b.presentation as SiteBlock['presentation'] } : {}), ...(typeof b.highlight === 'string' ? { highlight: text(b.highlight, 160) } : {}), ...(DESIGN_IDS.includes(b.design as DesignId) ? { design: b.design as DesignId } : {}), ...(backgroundVideo ? { backgroundVideo } : {}) };
    }) };
  });
  return { version: 1, name: text(input.name, 100) || '未命名网站', accent: safeColor(input.accent, NEUTRAL_ACCENT), pages, ...(input.layout === 'portfolio' ? { layout: 'portfolio' as const } : {}) };
}
