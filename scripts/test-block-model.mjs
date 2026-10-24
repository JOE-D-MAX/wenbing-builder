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
const { createStarterProject, createBlock, parseBlockProject, safeBlockUrl, safeBlockImage, MAX_EMBED_HTML_CHARS, BLOCK_LIBRARY, BACKGROUND_LIBRARY, PALETTE_LIBRARY, getBlockAppearance, appearanceStyle } = await import('../lib/block-model.ts');
const project = createStarterProject();
assert.deepEqual(parseBlockProject(project), project);
assert.deepEqual(createStarterProject(), createStarterProject(), 'initial render has stable IDs');
assert.equal(project.name, '未命名网站');
assert.equal(project.accent, '#2563eb');
assert.deepEqual(project.pages[0].blocks, [], 'a fresh project never contains reference-site content');
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
assert.throws(() => parseBlockProject({ ...project, pages: Array(9).fill(project.pages[0]) }), /页面数量/);
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
const legacy = structuredClone(project);
legacy.accent = '#f5b544';
for (const block of legacy.pages[0].blocks) { delete block.appearance; block.theme = 'dark'; }
legacy.pages[0].blocks[0].title = '保留我原来的标题';
assert.deepEqual(parseBlockProject(legacy), legacy, 'existing v1 data and authored content are preserved without migration');
assert.deepEqual(getBlockAppearance(legacy.pages[0].blocks[0], legacy.accent), { background: 'solid', backgroundColor: '#090909', secondaryColor: '#181815', textColor: '#f0efed', accentColor: '#f5b544' });
assert.equal(getBlockAppearance({ theme: 'light' }).backgroundColor, '#eceae4');
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
const embed = createBlock('embed');
embed.html = '<!doctype html><body>' + 'x'.repeat(1600000) + '</body>';
project.pages[0].blocks.push(embed);
assert.equal(parseBlockProject(project).pages[0].blocks.at(-1).html, embed.html, 'image-sized template survives transfer without truncation');
embed.html = 'x'.repeat(MAX_EMBED_HTML_CHARS + 1);
assert.throws(() => parseBlockProject(project), /过大/);
console.log('Block model checks passed: blank starters, independent appearance/effects, legacy compatibility, CSS safety, limits and complete embedded documents.');
