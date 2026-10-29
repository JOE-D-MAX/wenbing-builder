import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const candidate = new URL(specifier, context.parentURL);
    if (!/\.[cm]?[jt]s$/.test(specifier) && existsSync(fileURLToPath(candidate) + '.ts')) return { url: pathToFileURL(fileURLToPath(candidate) + '.ts').href, shortCircuit: true };
  }
  return next(specifier, context);
} });
const { randomizePageStyle } = await import('../lib/random-block-style.ts');
const { createBlock, createStarterProject, parseBlockProject, PALETTE_LIBRARY, BACKGROUND_LIBRARY, EFFECT_LIBRARY, MAX_BLOCKS } = await import('../lib/block-model.ts');
const { renderBlockProject } = await import('../lib/block-renderer.ts');

function frozen(value) { Object.freeze(value); for (const child of Object.values(value)) if (child && typeof child === 'object' && !Object.isFrozen(child)) frozen(child); return value; }
const image = 'data:image/png;base64,iVBORw0KGgo=';
const original = createStarterProject();
original.layout = 'portfolio';
const hero = { ...createBlock('hero'), title: '自己的标题 <保留>', text: '原来的正文\n第二段', eyebrow: '原创', image, button: '我的链接', link: { type: 'url', target: 'https://example.test/project' }, span: 'full', highlight: '标题', design: 'editorial-hero', presentation: 'about', items: [{ title: '作品', text: '说明' }] };
const second = { ...createBlock('project'), title: '另一个区块', image: '' };
const embed = { ...createBlock('embed'), html: '<!doctype html><html><body><h1>导入内容</h1></body></html>' };
original.pages[0].blocks = [hero, second, embed];
original.pages.push({ id: 'untouched-page', title: '其他页面', blocks: [createBlock('text')] });
const snapshot = structuredClone(original);
frozen(original);
const result = randomizePageStyle(original.pages[0], { random: () => 0 });
assert.equal(result.changed, 2);
assert.notEqual(result.page, original.pages[0]);
assert.equal(result.page.blocks[2], embed, 'imported HTML is left entirely untouched');
assert.deepEqual(original, snapshot, 'randomization never mutates the project or history snapshots');
const colors = ['backgroundColor', 'secondaryColor', 'textColor', 'accentColor'];
for (let index = 0; index < 2; index++) {
  const { theme, appearance, effects, ...authored } = result.page.blocks[index];
  const { theme: oldTheme, appearance: oldAppearance, effects: oldEffects, ...oldAuthored } = original.pages[0].blocks[index];
  assert.deepEqual(authored, oldAuthored, 'only appearance/theme/effects may change');
  for (const key of colors.filter(key => key !== 'accentColor')) assert.equal(appearance[key], result.page.blocks[0].appearance[key], 'background and text colors stay coherent across the page');
  assert(effects.length >= 1 && effects.length <= 2);
}
assert.notEqual(result.page.blocks[0].appearance.accentColor, result.page.blocks[1].appearance.accentColor, 'default non-unified mode varies block accents even with constant randomness');
const unifiedColors = { backgroundColor: '#142536', secondaryColor: '#293a4b', textColor: '#fefefe', accentColor: '#edac45' };
const unifiedSettings = { unified: true, colors: unifiedColors };
const unified = randomizePageStyle(original.pages[0], { colorSettings: unifiedSettings, random: () => .4 });
for (const block of unified.page.blocks.filter(block => block.kind !== 'embed')) {
  for (const key of colors) assert.equal(block.appearance[key], unifiedColors[key], 'unified mode obeys each user-specified color');
}
assert.equal(unified.page.blocks[2], embed);
assert.notEqual(result.paletteId, 'paper', 'a repeated click must visibly change the first target palette');
const repeated = randomizePageStyle(result.page, { random: () => 0 });
assert.notEqual(repeated.paletteId, result.paletteId);
assert.equal(repeated.page.blocks[0].id, hero.id);
assert.deepEqual(randomizePageStyle(original.pages[0], { random: () => .3 }), randomizePageStyle(original.pages[0], { random: () => .3 }), 'injectable randomness is deterministic for existing blocks');

const selected = randomizePageStyle(original.pages[0], { blockId: second.id, random: () => .5 });
assert.equal(selected.changed, 1);
assert.equal(selected.page.blocks[0], hero);
assert.equal(selected.page.blocks[2], embed);
assert.notEqual(selected.page.blocks[1], second);
for (const blockId of ['missing', '', embed.id]) {
  const unchanged = randomizePageStyle(original.pages[0], { blockId });
  assert.equal(unchanged.page, original.pages[0]);
  assert.equal(unchanged.changed, 0);
}
const embedPage = { id: 'only-embed', title: '导入网页', blocks: [embed] };
assert.equal(randomizePageStyle(embedPage).page, embedPage);

const blank = createStarterProject().pages[0];
const starter = randomizePageStyle(blank, { random: () => .2 });
assert.equal(blank.blocks.length, 0);
assert.equal(starter.changed, 1);
assert.equal(starter.page.blocks.length, 1);
assert.equal(starter.page.blocks[0].kind, 'surface');
for (const field of ['title', 'text', 'eyebrow', 'image', 'button']) assert.equal(starter.page.blocks[0][field], '');
assert.equal(randomizePageStyle(blank, { blockId: '' }).page, blank, 'invalid selection does not create a block');

const video = { src: 'https://example.test/background.webm', poster: 'https://example.test/poster.jpg', dim: .4, paused: true };
const videoBlock = { ...createBlock('hero'), backgroundVideo: video, appearance: { ...PALETTE_LIBRARY[0].appearance, background: 'video' } };
const inactiveVideo = { ...createBlock('text'), backgroundVideo: video };
const videoPage = { id: 'video-page', title: 'Video', blocks: [videoBlock, inactiveVideo] };
const videoResult = randomizePageStyle(videoPage, { random: () => .75 });
assert.equal(videoResult.page.blocks[0].appearance.background, 'video');
assert.equal(videoResult.page.blocks[0].backgroundVideo, video, 'active video source/poster/dim/pause state are preserved');
assert.equal(videoResult.page.blocks[0].theme, 'dark', 'video overlay keeps light foreground text');
assert.equal(videoResult.page.blocks[1].backgroundVideo, video, 'unused video metadata is also preserved');
assert.notEqual(videoResult.page.blocks[1].appearance.background, 'video', 'an unused video is not enabled by randomization');
const lightUnifiedColors = { backgroundColor: '#fffefd', secondaryColor: '#ecebea', textColor: '#132435', accentColor: '#654321' };
const unifiedVideo = randomizePageStyle(videoPage, { colorSettings: { unified: true, colors: lightUnifiedColors }, random: () => .2 });
for (const block of unifiedVideo.page.blocks) for (const key of colors) assert.equal(block.appearance[key], lightUnifiedColors[key], 'explicit unified colors take precedence over the default video palette choice');
assert.equal(unifiedVideo.page.blocks[0].backgroundVideo, video);
assert.equal(unifiedVideo.page.blocks[0].appearance.background, 'video');

for (let step = 0; step < 200; step++) {
  let seed = step + 1;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const generated = randomizePageStyle(original.pages[0], { random });
  assert(PALETTE_LIBRARY.some(palette => palette.id === generated.paletteId));
  for (const block of generated.page.blocks.filter(block => block.kind !== 'embed')) {
    assert(BACKGROUND_LIBRARY.some(background => background.id === block.appearance.background));
    assert.notEqual(block.appearance.background, 'video');
    assert.notEqual(block.appearance.background, 'grid', 'random styling never restores the removed grid background');
    assert.equal(new Set(block.effects).size, block.effects.length);
    assert(block.effects.length <= 2);
    for (const effect of block.effects) assert(EFFECT_LIBRARY.some(item => item.id === effect));
    if (!block.image) assert(!block.effects.includes('zoom'));
    if (block.theme === 'light') assert(!block.effects.includes('stars'));
    assert(!(block.effects.includes('curtain') && block.effects.includes('reveal')));
    assert(!(block.effects.includes('ambient') && block.effects.includes('stars')));
  }
  const project = { ...original, pages: [generated.page, original.pages[1]] };
  assert.deepEqual(parseBlockProject(project), project, 'random styles remain portable through the saved project parser');
  const html = renderBlockProject(project);
  assert(html.includes('自己的标题 &lt;保留&gt;'));
  assert(html.includes('https://example.test/project'));
  assert(html.includes(image));
  assert.equal(project.pages[1], original.pages[1], 'other pages are unchanged');
}
const fullPage = { id: 'full-page', title: 'Full', blocks: Array.from({ length: MAX_BLOCKS }, () => createBlock('surface')) };
assert.equal(randomizePageStyle(fullPage).page.blocks.length, MAX_BLOCKS, 'randomize never adds blocks to an existing page');
for (const invalid of [NaN, Infinity, -1, 1, 2]) assert(randomizePageStyle(original.pages[0], { random: () => invalid }).changed > 0, 'boundary RNG values remain safe');

const effectPage = frozen({ id: 'effects-policy', title: 'Effects', blocks: ['nav', 'hero', 'text', 'project', 'signature'].map(kind => ({ ...createBlock(kind), title: `Authored ${kind}`, effects: ['spotlight'] })) });
const forced = randomizePageStyle(effectPage, { random: () => 0 });
assert(forced.page.blocks.every(block => block.effects.includes('spotlight')), 'eligible blocks can still receive the low-probability effect');
const blocked = randomizePageStyle(effectPage, { random: () => 0, spotlightEligible: () => false });
for (const block of blocked.page.blocks) {
  assert(!block.effects.includes('spotlight'), 'an ineligible block loses previously assigned spotlight when randomized');
  assert(block.kind === 'nav' ? block.effects.length === 0 : block.effects.length >= 1 && block.effects.length <= 2);
  assert.equal(block.title, `Authored ${block.kind}`, 'effect policy never replaces authored content');
}
assert(effectPage.blocks.every(block => block.effects.includes('spotlight')), 'effect cleanup does not mutate the original undo snapshot');
const heroOnly = randomizePageStyle(effectPage, { random: () => 0, spotlightEligible: block => block.kind === 'hero' });
assert.deepEqual(heroOnly.page.blocks.filter(block => block.effects.includes('spotlight')).map(block => block.id), [effectPage.blocks[1].id], 'the eligibility predicate is evaluated for each block');
for (const [roll, expectedSpotlight] of [[0.1499, true], [0.15, false], [0.99, false]]) {
  const nav = randomizePageStyle({ ...effectPage, blocks: [effectPage.blocks[0]] }, { random: () => roll }).page.blocks[0];
  assert.equal(nav.effects.includes('spotlight'), expectedSpotlight, 'navigation uses the same 15% threshold');
  assert.equal(nav.effects.length, expectedSpotlight ? 1 : 0, 'navigation remains static when spotlight is not chosen');
}
let effectSeed = 20261029;
const effectRandom = () => ((effectSeed = (effectSeed * 1664525 + 1013904223) >>> 0) / 4294967296);
let eligibleSamples = 0, spotlightSamples = 0, staticNavigation = 0;
for (let iteration = 0; iteration < 1200; iteration++) {
  const sample = randomizePageStyle(effectPage, { random: effectRandom });
  for (const block of sample.page.blocks) {
    eligibleSamples++;
    if (block.effects.includes('spotlight')) spotlightSamples++;
    if (block.kind === 'nav' && block.effects.length === 0) staticNavigation++;
    assert(block.effects.length <= 2, 'spotlight never adds a third effect');
    if (block.kind !== 'nav') assert(block.effects.length >= 1, 'lower spotlight weight does not remove ordinary page effects');
  }
}
const spotlightRate = spotlightSamples / eligibleSamples;
assert(spotlightRate > 0.10 && spotlightRate < 0.20, `fixed-seed spotlight rate ${spotlightRate} must be sparse, without disabling the effect`);
assert(staticNavigation > 900, 'most generated navigation blocks remain static');
console.log(`Spotlight sampling: ${spotlightSamples}/${eligibleSamples} eligible blocks (${(100 * spotlightRate).toFixed(2)}%); ${staticNavigation}/1200 navigation blocks static.`);
console.log('PASS random styles: content preservation, scoped edits, empty canvas, videos, bounded effects, sparse eligible spotlight, static navigation, varied palettes, model round-trip and rendered output.');
