import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Script } from 'node:vm';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const candidate = new URL(specifier, context.parentURL);
    if (!/\.[cm]?[jt]s$/.test(specifier) && existsSync(fileURLToPath(candidate) + '.ts')) return { url: pathToFileURL(fileURLToPath(candidate) + '.ts').href, shortCircuit: true };
  }
  return next(specifier, context);
} });

const { createDesignBlock, createDesignStarterProject, DESIGN_TEMPLATES } = await import('../lib/design-templates.ts');
const { DESIGN_IDS, createBlock, createStarterProject, parseBlockProject, appearanceStyle, getBlockAppearance } = await import('../lib/block-model.ts');
const { renderBlockProject } = await import('../lib/block-renderer.ts');
const { CURTAIN_SCRIPT } = await import('../lib/design-renderer.ts');

assert.equal(DESIGN_TEMPLATES.length, 8);
assert.deepEqual(DESIGN_TEMPLATES.map(item => item.id), [...DESIGN_IDS]);
const legacy = createStarterProject();
legacy.pages[0].blocks = [createBlock('hero'), createBlock('text')];
legacy.pages[0].blocks[0].title = '保留原来的创作';
assert.deepEqual(parseBlockProject(legacy), legacy, 'old projects remain byte-for-byte equivalent as data');
assert(!renderBlockProject(legacy).includes('class="ed-hero"'), 'old projects do not gain a template composition');

const project = createDesignStarterProject();
assert.equal(project.version, 1);
assert.equal(project.pages.length, 2);
assert.equal(project.pages[0].blocks.length, 8);
assert.equal(project.pages[1].title, '详情示例');
assert.equal(project.layout, undefined, 'templates do not change the project-wide layout');
assert.deepEqual(parseBlockProject(JSON.parse(JSON.stringify(project))), project, 'all design fields survive backups');
const blocks = project.pages.flatMap(page => page.blocks);
const ids = new Set(blocks.map(block => block.id));
assert.equal(ids.size, blocks.length);
for (const block of blocks) {
  assert.notEqual(block.kind, 'embed', 'template parts remain independently editable');
  assert.equal(block.image, '', 'no reference images are embedded');
  assert.notEqual(block.link.type, 'url', 'no reference-site external links or contacts');
  if (block.link.type === 'page') assert(project.pages.some(page => page.id === block.link.target));
  if (block.link.type === 'section') assert(ids.has(block.link.target));
  if (block.design === 'editorial-nav') assert(block.items.every(item => ids.has(item.text)));
}
const metric = blocks.find(block => block.design === 'editorial-metrics');
assert(metric.items.every(item => item.title === '—'), 'metrics never fabricate or copy achievement numbers');
const userFacingData = blocks.map(({ title, text, eyebrow, button, items, image, link }) => ({ title, text, eyebrow, button, items, image, link }));
assert(!/hxk|fashion-design|pages\.dev|mailto:|https?:|@/i.test(JSON.stringify(userFacingData)), 'template contains neither reference identity nor prior personal-template data');

for (const template of DESIGN_TEMPLATES) {
  const first = createDesignBlock(template.id);
  const second = createDesignBlock(template.id);
  assert.notEqual(first.id, second.id, 'repeated applications create independent blocks');
  first.items.push({ title: '独立编辑', text: '只改变这一块' });
  first.appearance.backgroundColor = '#112233';
  assert(!second.items.some(item => item.title === '独立编辑'));
  assert.notEqual(second.appearance.backgroundColor, '#112233');
  const fixture = createStarterProject();
  fixture.pages[0].blocks.push(second);
  assert(renderBlockProject(fixture).includes('design-' + template.id), 'standalone drops render without a special page layout');
}

const html = renderBlockProject(project);
assert(!/<iframe/.test(html));
assert(!/src="https?:/.test(html));
assert(html.includes("connect-src 'none'"));
assert(html.includes('href="#/' + project.pages[1].id + '"'), 'project action reaches its detail page');
assert(html.includes('href="#/' + project.pages[0].id + '"'), 'detail page can return home');
for (const marker of ['ed-nav', 'ed-hero-copy', 'ed-intro-heading', 'ed-metric-grid', 'ed-timeline-list', 'ed-project-copy', 'ed-step-list', 'ed-contact-orbit', 'ed-geometry']) assert(html.includes(marker));
assert(html.includes('<details open>'), 'steps expose their text and remain expandable');
assert(html.includes('curtain-shutters'));
assert(html.includes('block-curtain-left') && html.includes('block-curtain-right'));
assert(CURTAIN_SCRIPT.includes('observer.unobserve(entry.target)'), 'the curtain is played once per block');
assert(CURTAIN_SCRIPT.includes("prefers-reduced-motion: reduce"));
for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Script(script[1]);

const uploadedImage = 'data:image/png;base64,iVBORw0KGgo=';
for (const design of ['editorial-hero', 'editorial-intro', 'editorial-project', 'editorial-contact']) {
  const fixture = createStarterProject();
  const block = createDesignBlock(design);
  block.image = uploadedImage;
  fixture.pages[0].blocks.push(block);
  assert.equal((renderBlockProject(fixture).match(new RegExp(uploadedImage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1, 'uploaded media renders once in ' + design);
}

const generic = createStarterProject();
generic.pages[0].blocks.push({ ...createBlock('text'), effects: ['curtain', 'spotlight', 'reveal'] });
const genericHtml = renderBlockProject(generic);
assert(genericHtml.includes('curtain-shutters'), 'curtain works without a template');
assert(genericHtml.includes('fx-spotlight') && genericHtml.includes('fx-reveal'), 'existing effects remain composable');

const poisoned = structuredClone(project);
poisoned.pages[0].blocks[1].title = '<script>alert(1)</script>';
poisoned.pages[0].blocks[2].text = '<img src=x onerror=alert(2)>';
poisoned.pages[0].blocks[3].items[0].title = '</style><script>alert(3)</script>';
poisoned.pages[0].blocks[4].design = 'bad"><script>alert(4)</script>';
const clean = parseBlockProject(poisoned);
assert.equal(clean.pages[0].blocks[4].design, undefined, 'unknown design values cannot reach class attributes');
const safeHtml = renderBlockProject(clean);
assert(!safeHtml.includes('<script>alert('));
assert(safeHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
assert(safeHtml.includes('&lt;img src=x onerror=alert(2)&gt;'));
assert(safeHtml.includes('&lt;/style&gt;&lt;script&gt;alert(3)&lt;/script&gt;'));
const halo = getBlockAppearance(createDesignBlock('editorial-hero'));
assert.equal(halo.background, 'halo');
assert(appearanceStyle(halo).backgroundImage.includes('radial-gradient'));
assert(!appearanceStyle({ ...halo, accentColor: 'red;url(https://bad.test)' }).backgroundImage.includes('bad.test'));
console.log('Design templates: portable data, isolated drafts, matching compositions, media, links, effects and injection checks passed.');
