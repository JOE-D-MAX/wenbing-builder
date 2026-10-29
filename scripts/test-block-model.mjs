import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const url = new URL(specifier, context.parentURL);
    if (!/\.[cm]?[jt]s$/.test(specifier) && existsSync(fileURLToPath(url) + '.ts')) return { url: pathToFileURL(fileURLToPath(url) + '.ts').href, shortCircuit: true };
  }
  return next(specifier, context);
} });
const { createStarterProject, createBlock, parseBlockProject, safeBlockUrl, safeBlockImage, MAX_EMBED_HTML_CHARS, MAX_PAGES, BLOCK_LIBRARY, BACKGROUND_LIBRARY, PALETTE_LIBRARY, getBlockAppearance, appearanceStyle } = await import('../lib/block-model.ts');
const { renderBlockProject } = await import('../lib/block-renderer.ts');
const { getProjectColorSettings, applyProjectColorSettings } = await import('../lib/project-colors.ts');
const project = createStarterProject();
assert.deepEqual(parseBlockProject(project), project);
assert.deepEqual(createStarterProject(), createStarterProject(), 'initial render has stable IDs');
assert.equal(project.name, '未命名网站');
assert.equal(project.accent, '#2563eb');
assert.deepEqual(project.pages[0].blocks, [], 'a fresh project never contains reference-site content');
assert.equal(getProjectColorSettings(project).unified, false, 'unified colors are off by default');
for (const { kind } of BLOCK_LIBRARY) assert.deepEqual(createBlock(kind).effects, [], 'effects are selected separately');
const surface = createBlock('surface');
assert.equal(surface.title, '');
assert.equal(surface.text, '');
assert.equal(surface.button, '');
assert.equal(getBlockAppearance(surface).backgroundColor, '#ffffff');
project.pages[0].blocks.push(createBlock('hero'), createBlock('text'));
for (const url of ['javascript:alert(1)', 'data:text/html,hello', '/relative', 'https://example.test\n@evil.test', 'file:///secret']) assert.equal(safeBlockUrl(url), '');
for (const url of ['https://example.test/path?q=1', 'http://localhost:8080/', 'mailto:hello@example.test', 'tel:+8612345678']) assert.equal(safeBlockUrl(url), url);
assert.equal(safeBlockImage('https://example.test/image.jpg'), '');
assert.equal(safeBlockImage('data:image/svg+xml;base64,PHN2Zz4='), '');
assert.equal(safeBlockImage('data:image/png;base64,iVBORw0KGgo='), 'data:image/png;base64,iVBORw0KGgo=');
const corrupted = structuredClone(project);
corrupted.pages[0].blocks[1].id = corrupted.pages[0].blocks[0].id;
assert.throws(() => parseBlockProject(corrupted), /重复/);
assert.equal(MAX_PAGES, 10);
for (const count of [8, 10]) {
  const pages = Array.from({ length: count }, (_, index) => ({ id: 'page-' + index, title: 'Page ' + index, blocks: [] }));
  assert.deepEqual(parseBlockProject({ ...project, pages }).pages, pages, 'legacy eight-page and new ten-page projects are accepted');
}
assert.throws(() => parseBlockProject({ ...project, pages: Array(11).fill(project.pages[0]) }), /页面数量/);
assert.throws(() => parseBlockProject({ ...project, pages: [{ ...project.pages[0], blocks: Array(25).fill(createBlock('text')) }] }), /最多/);
const raw = structuredClone(project);
raw.apiKey = 'not-a-real-key';
raw.accent = 'red; background:url(https://evil.test)';
raw.pages[0].blocks[1].link = { type: 'url', target: 'javascript:alert(1)' };
raw.pages[0].blocks[1].effects = ['spotlight', 'spotlight', 'unknown'];
const parsed = parseBlockProject(raw);
assert(!('apiKey' in parsed));
assert.equal(parsed.accent, '#2563eb');
assert.equal(parsed.pages[0].blocks[1].link.target, '');
assert.deepEqual(parsed.pages[0].blocks[1].effects, ['spotlight']);
const unicodeText = createStarterProject();
unicodeText.pages[0].title = 'a' + '😀'.repeat(30);
unicodeText.pages[0].blocks = [{ ...createBlock('hero'), title: 'a' + '😀'.repeat(80), button: '前往 ' + '😀'.repeat(30) }];
const boundedUnicode = parseBlockProject(unicodeText);
assert.equal(boundedUnicode.pages[0].title, 'a' + '😀'.repeat(29));
assert.equal(boundedUnicode.pages[0].blocks[0].title, 'a' + '😀'.repeat(79));
assert.equal(boundedUnicode.pages[0].blocks[0].button, '前往 ' + '😀'.repeat(28));
assert(boundedUnicode.pages[0].title.isWellFormed() && boundedUnicode.pages[0].blocks[0].title.isWellFormed() && boundedUnicode.pages[0].blocks[0].button.isWellFormed(), 'length limits never leave half an emoji at the boundary');
const legacy = structuredClone(project);
legacy.accent = '#f5b544';
for (const block of legacy.pages[0].blocks) { delete block.appearance; block.theme = 'dark'; }
legacy.pages[0].blocks[0].title = '保留我原来的标题';
assert.deepEqual(parseBlockProject(legacy), legacy, 'existing v1 data and authored content are preserved without migration');
assert.deepEqual(getBlockAppearance(legacy.pages[0].blocks[0], legacy.accent), { background: 'solid', backgroundColor: '#090909', secondaryColor: '#181815', textColor: '#f0efed', accentColor: '#f5b544' });
assert.equal(getBlockAppearance({ theme: 'light' }).backgroundColor, '#eceae4');
assert(!BACKGROUND_LIBRARY.some(item => item.id === 'grid'), 'removed grid backgrounds are not offered to new projects or random generation');
const oldGrid = createStarterProject();
oldGrid.pages[0].blocks.push({
  ...createBlock('text'), title: '保留旧项目标题', text: '保留旧项目正文', button: '继续阅读',
  link: { type: 'url', target: 'https://example.test/original' }, effects: ['reveal'],
  appearance: { background: 'grid', backgroundColor: '#123456', secondaryColor: '#345678', textColor: '#fedcba', accentColor: '#abdd63' },
});
const oldGridSnapshot = structuredClone(oldGrid);
const expectedGridMigration = structuredClone(oldGrid);
expectedGridMigration.pages[0].blocks[0].appearance.background = 'solid';
assert.deepEqual(parseBlockProject(oldGrid), expectedGridMigration, 'legacy grid becomes solid while preserving all four colors and authored content');
assert.deepEqual(getBlockAppearance(oldGrid.pages[0].blocks[0]), expectedGridMigration.pages[0].blocks[0].appearance, 'live canvas callers also normalize old grid backgrounds');
const migratedGridStyle = appearanceStyle(oldGrid.pages[0].blocks[0].appearance);
assert.equal(migratedGridStyle.backgroundImage, 'none');
assert.equal(migratedGridStyle.backgroundSize, 'auto');
assert.equal(migratedGridStyle.backgroundColor, '#123456');
const oldGridHtml = renderBlockProject(oldGrid);
assert(oldGridHtml.includes('background-color:#123456;background-image:none'), 'export removes the old grid texture without replacing its background color');
assert(!oldGridHtml.includes('background-size:32px 32px'));
assert(oldGridHtml.includes('保留旧项目标题') && oldGridHtml.includes('保留旧项目正文') && oldGridHtml.includes('https://example.test/original'));
assert.deepEqual(oldGrid, oldGridSnapshot, 'reading, migration and export never mutate the original legacy draft');
const colorProject = createStarterProject();
const savedVideo = { src: 'https://example.test/background.mp4', poster: 'https://example.test/poster.jpg', dim: .4, paused: true };
colorProject.pages[0].blocks = [
  { ...createBlock('hero'), title: 'Keep title', text: 'Keep body', effects: ['reveal'], appearance: { ...PALETTE_LIBRARY[0].appearance, background: 'gradient' }, image: 'data:image/png;base64,AAAA', link: { type: 'url', target: 'https://example.test/kept' } },
  { ...createBlock('embed'), html: '<p>Preserved imported page</p>' },
];
colorProject.pages.push({ id: 'video-colors', title: 'Video colors', blocks: [{ ...createBlock('surface'), backgroundVideo: savedVideo, appearance: { ...PALETTE_LIBRARY[0].appearance, background: 'video' }, effects: ['spotlight'] }] });
const colorSnapshot = structuredClone(colorProject);
const colorSettings = { unified: true, colors: { backgroundColor: '#142536', secondaryColor: '#293a4b', textColor: '#fefefe', accentColor: '#edac45' } };
const appliedColors = applyProjectColorSettings(colorProject, colorSettings, { random: () => 0 });
assert.deepEqual(appliedColors.colorSettings, colorSettings);
assert.deepEqual(getProjectColorSettings(appliedColors), colorSettings);
assert.deepEqual(parseBlockProject(appliedColors), appliedColors, 'saved projects round-trip the unified preference and custom colors');
for (const [pageIndex, page] of appliedColors.pages.entries()) for (const [blockIndex, block] of page.blocks.entries()) {
  const originalBlock = colorProject.pages[pageIndex].blocks[blockIndex];
  if (block.kind === 'embed') { assert.equal(block, originalBlock); continue; }
  for (const [key, value] of Object.entries(colorSettings.colors)) assert.equal(block.appearance[key], value);
  assert.equal(block.appearance.background, originalBlock.appearance.background, 'color changes preserve each background type');
  const { appearance, theme, ...content } = block;
  const { appearance: oldAppearance, theme: oldTheme, ...originalContent } = originalBlock;
  assert.deepEqual(content, originalContent, 'color changes preserve effects, media, links and authored content');
}
assert.deepEqual(colorProject, colorSnapshot, 'applying colors never mutates the source project');
const variedColors = applyProjectColorSettings(appliedColors, { ...colorSettings, unified: false }, { random: () => 0 });
const variedNative = variedColors.pages.flatMap(page => page.blocks).filter(block => block.kind !== 'embed');
assert.equal(variedColors.colorSettings.unified, false);
for (const key of ['backgroundColor', 'secondaryColor', 'textColor']) assert(variedNative.every(block => block.appearance[key] === colorSettings.colors[key]));
assert(new Set(variedNative.map(block => block.appearance.accentColor)).size > 1, 'turning unified colors off varies accents even with constant randomness');
assert.deepEqual(parseBlockProject(variedColors), variedColors);
const emptyColors = applyProjectColorSettings(createStarterProject(), colorSettings);
assert.deepEqual(emptyColors.pages[0].blocks, [], 'an empty site can save colors without creating unwanted blocks');
assert.deepEqual(getProjectColorSettings(emptyColors), colorSettings);
const poisonedColors = { ...colorProject, colorSettings: { unified: 'yes', colors: { backgroundColor: 'red; background:url(https://evil.test)', secondaryColor: '#12345', textColor: 'var(--secret)', accentColor: '#aabbcc' } } };
const sanitizedColors = parseBlockProject(poisonedColors).colorSettings;
assert.equal(sanitizedColors.unified, false);
assert(Object.values(sanitizedColors.colors).every(value => /^#[\da-f]{6}$/i.test(value)), 'saved colors are strictly sanitized');
assert.equal(sanitizedColors.colors.accentColor, '#aabbcc');
for (const invalid of [null, [], 'invalid']) assert(!('colorSettings' in parseBlockProject({ ...colorProject, colorSettings: invalid })), 'malformed optional color settings are ignored');
for (const { appearance } of PALETTE_LIBRARY) {
  for (const { id: background } of BACKGROUND_LIBRARY) {
    const fixture = structuredClone(project);
    fixture.pages[0].blocks[0].appearance = { ...appearance, background };
    assert.deepEqual(parseBlockProject(fixture), fixture, 'every palette and background survives project export/import');
    const style = appearanceStyle(fixture.pages[0].blocks[0].appearance);
    assert.equal(style.color, appearance.textColor);
    assert.equal(style['--accent'], appearance.accentColor);
    assert.equal(style.backgroundImage === 'none', background === 'solid' || background === 'video');
  }
}
const poisonedAppearance = {
  background: 'url(https://evil.test)', backgroundColor: '#000000;}</style><script>evil()</script>', secondaryColor: 'red',
  textColor: 'var(--secret)', accentColor: '#fff', backgroundImage: 'url(https://evil.test)',
};
const poisoned = structuredClone(project);
poisoned.pages[0].blocks[0].appearance = poisonedAppearance;
const sanitized = parseBlockProject(poisoned).pages[0].blocks[0].appearance;
assert.deepEqual(sanitized, getBlockAppearance({ theme: 'light' }, project.accent));
assert(!JSON.stringify(appearanceStyle(poisonedAppearance)).includes('evil'), 'the public CSS helper sanitizes even an unchecked caller');
assert.equal(appearanceStyle({ ...PALETTE_LIBRARY[0].appearance, accentColor: '#000000' })['--accent-text'], '#ffffff');
assert.equal(appearanceStyle({ ...PALETTE_LIBRARY[0].appearance, accentColor: '#ffffff' })['--accent-text'], '#090909');
const colorLuminance = color => [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255)
  .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
  .reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
const colorContrast = (left, right) => (Math.max(colorLuminance(left), colorLuminance(right)) + .05) / (Math.min(colorLuminance(left), colorLuminance(right)) + .05);
assert.equal(appearanceStyle({ ...PALETTE_LIBRARY[0].appearance, accentColor: '#767676' })['--accent-text'], '#ffffff', 'near-threshold gray uses the actually readable foreground');
assert.equal(appearanceStyle({ ...PALETTE_LIBRARY[0].appearance, accentColor: '#777777' })['--accent-text'], '#000000', 'pure black covers the gap where off-black and white both fail contrast');
for (let value = 0; value <= 255; value++) {
  const accentColor = '#' + value.toString(16).padStart(2, '0').repeat(3);
  const foreground = appearanceStyle({ ...PALETTE_LIBRARY[0].appearance, accentColor })['--accent-text'];
  assert(colorContrast(accentColor, foreground) >= 4.5, 'every gray accent has readable automatic button text: ' + accentColor);
}
const buttonColorProject = createStarterProject();
buttonColorProject.pages[0].blocks = [{ ...createBlock('hero'), design: 'editorial-hero', appearance: { ...PALETTE_LIBRARY[0].appearance, accentColor: '#777777' } }];
assert(renderBlockProject(buttonColorProject).includes('--accent-text:#000000'), 'the corrected foreground also reaches exported button CSS');
const embed = createBlock('embed');
embed.html = '<!doctype html><body>' + 'x'.repeat(1600000) + '</body>';
project.pages[0].blocks.push(embed);
assert.equal(parseBlockProject(project).pages[0].blocks.at(-1).html, embed.html, 'image-sized template survives transfer without truncation');
embed.html = 'x'.repeat(MAX_EMBED_HTML_CHARS + 1);
assert.throws(() => parseBlockProject(project), /过大/);
console.log('Block model checks passed: blank starters, independent appearance/effects, legacy compatibility, CSS safety, limits and complete embedded documents.');
