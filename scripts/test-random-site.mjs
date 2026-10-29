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
const { randomizeSite } = await import('../lib/random-site.ts');
const { createBlock, createStarterProject, parseBlockProject, PALETTE_LIBRARY, MAX_BLOCKS, MAX_PAGES } = await import('../lib/block-model.ts');
const { renderBlockProject } = await import('../lib/block-renderer.ts');
const frozen = value => { Object.freeze(value); for (const child of Object.values(value)) if (child && typeof child === 'object' && !Object.isFrozen(child)) frozen(child); return value; };
const authored = ({ theme, appearance, effects, ...content }) => content;
const image = 'data:image/png;base64,iVBORw0KGgo=';

assert.equal(MAX_PAGES, 10);
for (let expected = 1; expected <= 10; expected++) {
  const source = frozen(createStarterProject());
  const result = randomizeSite(source, { pageCount: expected, random: () => expected / 10 });
  assert.equal(result.pageCount, expected);
  assert.equal(result.added, expected - 1);
  assert.equal(result.removed, 0);
  assert.equal(source.pages[0].blocks.length, 0, 'generation cannot mutate a saved history snapshot');
  assert.equal(result.project.pages[0].id, source.pages[0].id);
  assert.equal(result.project.pages[0].title, source.pages[0].title);
  assert(result.changed > expected, 'generate content on each page, not one block per page');
  const ids = result.project.pages.flatMap(page => [page.id, ...page.blocks.map(block => block.id)]);
  assert.equal(new Set(ids).size, ids.length, 'page and block IDs are globally unique');
  const parsed = parseBlockProject(result.project);
  assert.equal(parsed.pages.length, expected);
  const colors = new Set(result.project.pages.flatMap(page => page.blocks.map(block => JSON.stringify([
    block.appearance.backgroundColor, block.appearance.secondaryColor, block.appearance.textColor,
  ]))));
  assert.equal(colors.size, 1, 'default mode keeps the same background and text colors across all pages');
  assert(new Set(result.project.pages.flatMap(page => page.blocks.map(block => block.appearance.accentColor))).size > 1, 'default mode assigns varied block accents even with constant randomness');
  for (const page of result.project.pages) {
    assert(page.blocks.length >= 4 && page.blocks.length <= MAX_BLOCKS);
    assert.equal(page.blocks[0].kind, 'nav');
    assert(page.blocks.some(block => block.kind === 'hero' || block.kind === 'text'));
    assert(page.blocks.some(block => block.link.type === (expected === 1 ? 'section' : 'page')));
    for (const block of page.blocks) {
      if (block.link.type === 'page') assert(result.project.pages.some(target => target.id === block.link.target));
      if (block.link.type === 'section') assert(page.blocks.some(target => target.id === block.link.target && target.id !== block.id), 'single-page CTA reaches another content block');
      assert.notEqual(block.kind, 'embed', 'generated pages remain native editable blocks');
      assert.equal(block.image, '', 'no external asset is copied or downloaded');
      assert.notEqual(block.appearance.background, 'grid', 'random site generation does not restore removed grid backgrounds');
    }
  }
  const html = renderBlockProject(result.project);
  assert.equal((html.match(/<main /g) || []).length, expected, 'export contains every complete page');
  for (const page of result.project.pages) {
    assert(html.includes('data-page="' + page.id + '"'));
    assert(html.includes('href="#/' + page.id + '"'), 'export contains a valid route to every page');
  }
  if (expected === 1) {
    const closing = result.project.pages[0].blocks.at(-1);
    assert(!/下一页|next page/.test(closing.text));
    assert(html.includes('href="#/' + result.project.pages[0].id + '/' + closing.link.target + '"'), 'single-page export links to the intended section');
  }
  assert(!/jjoe|wenbingx\.cn|Wenbing-X|hxk-fashion/i.test(JSON.stringify(result.project)), 'generic example has no reference-site identity');
}

for (const random of [0, .499, .5, 1, -1, NaN]) {
  const result = randomizeSite(createStarterProject(), { random: () => random });
  assert.equal(result.project.pages.length, 7, 'omitted count defaults to seven regardless of style randomness');
}
for (const invalid of [0, -1, 11, 2.5, NaN, Infinity, -Infinity, '7', '', null]) {
  const source = frozen(createStarterProject());
  assert.throws(() => randomizeSite(source, { pageCount: invalid }), /1–10.*整数/, 'invalid count must be rejected instead of silently replaced');
  assert.equal(source.pages.length, 1);
  assert.equal(source.pages[0].blocks.length, 0);
}
assert.throws(() => randomizeSite(createStarterProject(), { pageCount: 11, locale: 'en' }), /whole number from 1 to 10/);
for (const pageCount of [1, 5, 10]) {
  const colorSettings = { unified: true, colors: { backgroundColor: '#172839', secondaryColor: '#28394a', textColor: '#fdfcfb', accentColor: '#d7a432' } };
  const source = { ...createStarterProject(), colorSettings };
  const snapshot = structuredClone(source);
  frozen(source);
  const result = randomizeSite(source, { pageCount, random: () => .6 });
  assert.deepEqual(result.project.colorSettings, colorSettings, 'site generation persists the unified palette preference');
  for (const page of result.project.pages) for (const block of page.blocks) {
    for (const [key, value] of Object.entries(colorSettings.colors)) assert.equal(block.appearance[key], value, 'unified colors are used throughout the generated site');
    assert.notEqual(block.appearance.background, 'grid');
  }
  assert.deepEqual(parseBlockProject(result.project), result.project);
  assert.deepEqual(source, snapshot);
}
const tenPages = randomizeSite(createStarterProject(), { pageCount: 10, random: () => .3 }).project;
assert.deepEqual(parseBlockProject(tenPages), tenPages, 'ten-page projects round-trip without dropping pages');
assert.throws(() => parseBlockProject({ ...tenPages, pages: [...tenPages.pages, { id: 'page-eleven', title: 'Eleven', blocks: [] }] }), /页面数量/);
const tenSnapshot = structuredClone(tenPages);
frozen(tenPages);
for (let requested = 1; requested <= 10; requested++) {
  const result = randomizeSite(tenPages, { pageCount: requested, random: () => .3 });
  assert.equal(result.pageCount, requested, 'existing sites shrink to the exact requested count');
  assert.equal(result.project.pages.length, requested);
  assert.equal(result.added, 0);
  assert.equal(result.removed, 10 - requested);
  assert.deepEqual(result.project.pages.map(page => page.id), tenPages.pages.slice(0, requested).map(page => page.id), 'the first requested pages are kept in order');
  assert.deepEqual(parseBlockProject(result.project), result.project);
  if (requested === 1) assert(!/下一页|next page/.test(result.project.pages[0].blocks.at(-1).text), 'generated closing copy is meaningful after reducing to one page');
  for (const page of result.project.pages) for (const block of page.blocks) {
    if (block.link.type === 'page') assert(result.project.pages.some(target => target.id === block.link.target));
    if (block.link.type === 'section') assert(result.project.pages.some(target => target.blocks.some(item => item.id === block.link.target)));
  }
}
assert.deepEqual(tenPages, tenSnapshot, 'shrinking never mutates the draft used by undo');

const original = createStarterProject();
original.name = 'Keep my project name';
original.accent = '#924488';
original.layout = 'portfolio';
const hero = {
  ...createBlock('hero'), title: '自己的标题', text: '原创正文\n第二段', eyebrow: '原创', image,
  button: '页面跳转', link: { type: 'page', target: 'authored-page' },
  span: 'full', highlight: '自己的', design: 'editorial-hero', presentation: 'about',
  items: [{ title: '自写条目', text: '自写内容' }],
  appearance: { ...PALETTE_LIBRARY[0].appearance, background: 'video' },
  backgroundVideo: { src: 'https://example.test/background.webm', poster: 'https://example.test/poster.jpg', dim: .4, paused: true },
};
const embed = { ...createBlock('embed'), html: '<html><body><h1>Imported content</h1></body></html>' };
original.pages[0].blocks = [hero, embed];
original.pages.push({ id: 'authored-page', title: '自写页面名称', blocks: [{ ...createBlock('text'), title: '自写区块名称' }] });
const snapshot = structuredClone(original);
frozen(original);
const generated = randomizeSite(original, { pageCount: 8, random: () => .6 });
assert.deepEqual(original, snapshot);
assert.equal(generated.project.name, original.name);
assert.equal(generated.project.accent, original.accent);
assert.equal(generated.project.layout, original.layout);
assert.equal(generated.pageCount, 8);
assert.equal(generated.added, 6);
assert.equal(generated.removed, 0);
for (const oldPage of original.pages) {
  const page = generated.project.pages.find(page => page.id === oldPage.id);
  assert.equal(page.title, oldPage.title);
  assert.deepEqual(page.blocks.filter(block => oldPage.blocks.some(old => old.id === block.id)).map(authored), oldPage.blocks.map(authored), 'authored IDs, content, media, links, and order survive');
  assert.equal(page.blocks[0].kind, 'nav', 'existing content gets a route to the added pages');
}
assert.equal(generated.project.pages[0].blocks.find(block => block.id === embed.id), embed, 'imported HTML retains object identity');
const savedVideo = generated.project.pages[0].blocks.find(block => block.id === hero.id);
assert.equal(savedVideo.appearance.background, 'video');
assert.equal(savedVideo.backgroundVideo, hero.backgroundVideo);
assert(generated.project.pages.flatMap(page => page.blocks).filter(block => block.kind !== 'embed').every(block => block.theme === 'dark'), 'active video keeps text legible across coherent palette');

const second = randomizeSite(generated.project, { pageCount: 8, random: () => .6 });
assert.equal(second.pageCount, 8);
assert.equal(second.added, 0);
assert.equal(second.removed, 0);
assert.notEqual(second.paletteName, generated.paletteName, 'repeat changes the palette');
for (let index = 0; index < generated.project.pages.length; index++) {
  const previous = generated.project.pages[index], page = second.project.pages[index];
  assert.equal(page.id, previous.id);
  assert.equal(page.title, previous.title);
  assert.deepEqual(page.blocks.map(authored), previous.blocks.map(authored), 'repeat neither adds blocks nor resets generated/user content');
}
parseBlockProject(second.project);

const linkedProject = structuredClone(generated.project);
const removedPage = linkedProject.pages.at(-1);
const retainedPage = linkedProject.pages[0];
const retainedSection = retainedPage.blocks.find(block => block.kind === 'hero');
const missingPageLink = { ...createBlock('contact'), title: '保留标题', text: '保留正文', image, button: '前往即将移除的页面', link: { type: 'page', target: removedPage.id } };
const missingSectionLink = { ...createBlock('text'), title: '保留区块', button: '被移除页面中的区块', link: { type: 'section', target: removedPage.blocks[1].id } };
const validPageLink = { ...createBlock('text'), button: '原有有效页面', link: { type: 'page', target: retainedPage.id } };
const validSectionLink = { ...createBlock('text'), button: '原有有效区块', link: { type: 'section', target: retainedSection.id } };
const externalLink = { ...createBlock('contact'), button: '外链文字', link: { type: 'url', target: 'https://example.test/kept' } };
const modalLink = { ...createBlock('project'), button: '原有弹窗', link: { type: 'modal', target: '' } };
const navItems = [{ title: '有效内容', text: retainedSection.id }, { title: '删除页面内的内容', text: removedPage.blocks[1].id }, { title: '自定义条目', text: 'keep-custom-value' }];
retainedPage.blocks[0].items = navItems;
const editorialNav = { ...createBlock('nav'), title: '保留导航名称', design: 'editorial-nav', items: structuredClone(navItems) };
const ordinaryItems = { ...createBlock('accordion'), title: '内容不是导航链接', items: structuredClone(navItems) };
retainedPage.blocks.push(missingPageLink, missingSectionLink, validPageLink, validSectionLink, externalLink, modalLink, editorialNav, ordinaryItems);
const linkedSnapshot = structuredClone(linkedProject);
frozen(linkedProject);
for (const [requested, locale] of [[1, 'zh'], [3, 'en']]) {
  const result = randomizeSite(linkedProject, { pageCount: requested, locale, random: () => .4 });
  assert.equal(result.pageCount, requested);
  assert.equal(result.added, 0);
  assert.equal(result.removed, 8 - requested);
  assert.deepEqual(parseBlockProject(result.project), result.project);
  const blocks = result.project.pages[0].blocks;
  for (const old of [missingPageLink, missingSectionLink]) {
    const repaired = blocks.find(block => block.id === old.id);
    const { link, button, ...kept } = authored(repaired);
    const { link: oldLink, button: oldButton, ...expected } = authored(old);
    assert.deepEqual(kept, expected, 'repair retains titles, body copy, images, and IDs');
    assert.equal(button, locale === 'en' ? 'Continue exploring' : '继续浏览');
    assert(!removedPage.blocks.some(block => block.id === link.target));
    assert.notEqual(link.target, removedPage.id);
    if (requested === 1) assert.equal(link.type, 'section', 'single-page repair selects an actual remaining content section');
  }
  for (const old of [validPageLink, validSectionLink, externalLink, modalLink]) {
    assert.deepEqual(authored(blocks.find(block => block.id === old.id)), authored(old), 'unrelated valid links and labels stay unchanged');
  }
  for (const nav of [retainedPage.blocks[0], editorialNav]) {
    assert.deepEqual(blocks.find(block => block.id === nav.id).items, [navItems[0], navItems[2]], 'portfolio and editorial navigation remove only targets belonging to removed pages');
  }
  assert.deepEqual(blocks.find(block => block.id === ordinaryItems.id).items, navItems, 'ordinary list content is never treated as navigation');
}
assert.deepEqual(linkedProject, linkedSnapshot, 'removed pages and their original links remain available for undo');
const { layout: portfolioLayout, ...ordinaryProject } = linkedProject;
const ordinaryResult = randomizeSite(ordinaryProject, { pageCount: 1, random: () => .2 });
assert.deepEqual(ordinaryResult.project.pages[0].blocks.find(block => block.id === editorialNav.id).items, [navItems[0], navItems[2]], 'editorial navigation repairs section targets independently of portfolio layout');
assert.deepEqual(ordinaryResult.project.pages[0].blocks[0].items, navItems, 'ordinary native navigation does not interpret arbitrary item text as section targets');
const onlyBlock = { ...createBlock('text'), button: '', link: { type: 'section', target: removedPage.blocks[1].id } };
const fallback = randomizeSite({ ...createStarterProject(), pages: [{ id: 'keep-only', title: 'Keep', blocks: [onlyBlock] }, removedPage] }, { pageCount: 1, random: () => .2 });
const repairedOnly = fallback.project.pages[0].blocks.find(block => block.id === onlyBlock.id);
assert.deepEqual(repairedOnly.link, { type: 'page', target: 'keep-only' }, 'a page without another content section uses a valid page route');
assert.equal(repairedOnly.button, '', 'link repair does not introduce an unwanted visible button');

const full = createStarterProject();
full.pages[0].blocks = Array.from({ length: MAX_BLOCKS }, (_, index) => ({ ...createBlock('text'), title: 'Kept ' + index }));
const fullResult = randomizeSite(frozen(full), { pageCount: 7, random: () => .3 });
assert.equal(fullResult.project.pages[0].blocks.length, MAX_BLOCKS, 'adding navigation cannot exceed the block limit');
assert.deepEqual(fullResult.project.pages[0].blocks.map(authored), full.pages[0].blocks.map(authored));
parseBlockProject(fullResult.project);

const imported = createStarterProject();
imported.pages[0].blocks = [embed];
const importedResult = randomizeSite(imported, { pageCount: 7, random: () => .2 });
assert.equal(importedResult.pageCount, 7, 'an imported current page still allows site generation');
assert.equal(importedResult.project.pages[0].blocks[1], embed);

const longTitle = createStarterProject();
longTitle.pages[0].title = 'A'.repeat(60);
const longResult = randomizeSite(longTitle, { pageCount: 8, locale: 'en', random: () => .2 });
for (const page of longResult.project.pages) for (const block of page.blocks) assert(block.button.length <= 60);
assert.deepEqual(parseBlockProject(longResult.project), longResult.project, 'generated fields round-trip without truncation');
const emojiTitle = createStarterProject();
emojiTitle.pages[0].title = '😀'.repeat(30);
const emojiResult = randomizeSite(emojiTitle, { pageCount: 2, random: () => 0 });
const emojiLink = emojiResult.project.pages[1].blocks.at(-1);
assert(emojiLink.button.length <= 60 && emojiLink.button.isWellFormed(), 'generated page links truncate at a complete character');
assert.equal(emojiLink.link.target, emojiTitle.pages[0].id);
assert.deepEqual(parseBlockProject(emojiResult.project), emojiResult.project);
const duplicateTitle = createStarterProject();
duplicateTitle.pages[0].title = 'About';
const namedResult = randomizeSite(duplicateTitle, { pageCount: 7, locale: 'en', random: () => .2 });
assert.equal(namedResult.project.pages[0].title, 'About');
assert.equal(new Set(namedResult.project.pages.map(page => page.title)).size, 7, 'new page names avoid existing authored names');

for (const locale of ['zh', 'en']) {
  const result = randomizeSite(createStarterProject(), { pageCount: 10, locale, random: () => .2 });
  const newPages = result.project.pages.slice(1);
  assert.equal(newPages[0].title, locale === 'en' ? 'About' : '关于');
  assert.equal(newPages[7].title, locale === 'en' ? 'Resources' : '资源');
  assert.equal(newPages[8].title, locale === 'en' ? 'Updates' : '动态');
  const single = randomizeSite(result.project, { pageCount: 1, locale, random: () => .2 });
  assert.equal(single.project.pages[0].blocks.at(-1).text, locale === 'en' ? 'Return to the introduction and work on this page.' : '回到上方，继续查看本页介绍与作品。');
  for (const page of newPages) {
    const text = [page.title, ...page.blocks.flatMap(block => [block.title, block.text, block.eyebrow, ...block.items.flatMap(item => [item.title, item.text])])].join(' ');
    assert.equal(/[\u3400-\u9fff]/.test(text), locale === 'zh', 'generated copy follows selected language');
  }
}

for (let seed = 0; seed < 40; seed++) {
  let state = seed + 1;
  const random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  const project = randomizeSite(createStarterProject(), { pageCount: seed % 10 + 1, random }).project;
  const parsed = parseBlockProject(project);
  assert.equal(parsed.pages.length, seed % 10 + 1);
  for (const block of parsed.pages.flatMap(page => page.blocks)) {
    assert(block.effects.length >= (block.kind === 'nav' ? 0 : 1) && block.effects.length <= 2);
    if (block.kind === 'nav') assert(block.effects.every(effect => effect === 'spotlight'), 'navigation otherwise stays static');
    assert(!block.effects.includes('zoom'), 'image zoom needs an actual image');
  }
}

function assertSpotlightPages(project, expectEligibleHits = false) {
  project.pages.forEach((page, index) => {
    const allowed = index === 0 || index === project.pages.length - 1;
    const native = page.blocks.filter(block => block.kind !== 'embed');
    if (!allowed) assert(native.every(block => !block.effects.includes('spotlight')), `middle page ${index + 1} cannot receive random spotlight`);
    else if (expectEligibleHits) assert(native.some(block => block.effects.includes('spotlight')), 'first and last pages remain eligible');
    for (const block of native) assert(block.effects.length <= 2);
  });
}
for (let count = 1; count <= 10; count++) {
  const result = randomizeSite(createStarterProject(), { pageCount: count, random: () => 0 });
  assertSpotlightPages(result.project, true);
}
const twoWithSpotlight = randomizeSite(createStarterProject(), { pageCount: 2, random: () => 0 }).project;
assertSpotlightPages(twoWithSpotlight, true);
const formerlyLastId = twoWithSpotlight.pages[1].id;
const expanded = randomizeSite(twoWithSpotlight, { pageCount: 10, random: () => 0 }).project;
assertSpotlightPages(expanded, true);
assert(expanded.pages.find(page => page.id === formerlyLastId).blocks.every(block => !block.effects.includes('spotlight')), 'growing a site clears spotlight from its former last page');
const oldSpotlights = structuredClone(expanded);
for (const page of oldSpotlights.pages) for (const block of page.blocks) block.effects = ['spotlight'];
const oldSpotlightSnapshot = structuredClone(oldSpotlights);
frozen(oldSpotlights);
for (let count = 1; count <= 10; count++) {
  const resized = randomizeSite(oldSpotlights, { pageCount: count, random: () => 0 });
  assertSpotlightPages(resized.project, true);
  assert.equal(resized.project.pages.at(-1).id, oldSpotlights.pages[count - 1].id, 'eligibility follows the final page order after shrinking');
}
assertSpotlightPages(randomizeSite(expanded, { pageCount: 10, random: () => 0 }).project, true);
assert.deepEqual(oldSpotlights, oldSpotlightSnapshot, 'cleaning old middle-page spotlight leaves the full original snapshot recoverable');
let policySeed = 1337, eligibleSamples = 0, totalSamples = 0, spotlightSamples = 0;
const policyRandom = () => ((policySeed = (policySeed * 1664525 + 1013904223) >>> 0) / 4294967296);
for (let iteration = 0; iteration < 250; iteration++) {
  const project = randomizeSite(createStarterProject(), { pageCount: 10, random: policyRandom }).project;
  assertSpotlightPages(project);
  project.pages.forEach((page, index) => {
    totalSamples += page.blocks.length;
    if (index === 0 || index === project.pages.length - 1) eligibleSamples += page.blocks.length;
    spotlightSamples += page.blocks.filter(block => block.effects.includes('spotlight')).length;
  });
}
assert(spotlightSamples / eligibleSamples > 0.10 && spotlightSamples / eligibleSamples < 0.20, 'eligible first/last blocks retain a sparse, nonzero fixed-seed chance');
assert(spotlightSamples / totalSamples < 0.06, 'a ten-page website uses spotlight on only a small minority of its blocks');
console.log(`Site spotlight sampling: ${spotlightSamples}/${eligibleSamples} eligible edge-page blocks (${(100 * spotlightSamples / eligibleSamples).toFixed(2)}%); ${(100 * spotlightSamples / totalSamples).toFixed(2)}% of all blocks; middle pages: 0.`);
console.log('Random site tests passed: 1–10 complete pages, exact counts, first/last-only sparse spotlight, grow/shrink/repeat cleanup, shared palette, preservation, media, links, locale, and export.');
