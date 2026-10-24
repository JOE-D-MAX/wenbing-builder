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
const { renderBlockProject } = await import('../lib/block-renderer.ts');
const { createBlock, createStarterProject, PALETTE_LIBRARY } = await import('../lib/block-model.ts');

const project = createStarterProject();
const blankOutput = renderBlockProject(project);
assert(!blankOutput.includes('<section '), 'new projects export a blank canvas');
assert(!blankOutput.includes('这一页，留给下一个想法'), 'empty pages contain no reference copy');
assert(blankOutput.includes('<body style="background:#ffffff;color:#172033"'), 'new pages do not inherit a black frame');
project.pages[0].id = 'home';
project.pages[0].blocks = ['nav', 'hero', 'project', 'signature'].map(createBlock);
project.pages[0].blocks.forEach((block, index) => { block.id = 'block-' + index; });
const [nav, hero, card, signature] = project.pages[0].blocks;
hero.link = { type: 'section', target: card.id };
hero.effects = ['spotlight', 'stars', 'reveal'];
card.link = { type: 'modal', target: '' };
card.effects = ['zoom', 'lift'];
const second = { id: 'about', title: '关于与联系', blocks: [createBlock('nav'), createBlock('text'), createBlock('accordion'), createBlock('contact')] };
second.blocks.forEach((block, index) => { block.id = 'about-' + index; });
project.pages.push(second);
second.blocks[3].link = { type: 'url', target: 'mailto:hello@example.test' };
second.blocks[1].button = '返回作品';
second.blocks[1].link = { type: 'section', target: card.id };
let output = renderBlockProject(project);
assert(output.startsWith('<!DOCTYPE html>'));
assert(output.endsWith('</html>'));
assert(output.includes('href="#/home/block-2"'), 'section links include the owning page');
assert(output.includes('href="#/about"'), 'navigation links every page');
assert(output.includes('href="mailto:hello@example.test"'));
assert(output.includes('data-page="about" data-page-title="关于与联系" hidden'));
assert(!renderBlockProject(project, { pageId: 'about' }).includes('data-page="about" data-page-title="关于与联系" hidden'));
assert(renderBlockProject(project, { pageId: 'unknown' }).includes('data-start="home"'));
assert(output.includes('<details><summary>'));
assert(output.includes('<dialog id="dialog:block-2" aria-labelledby="dialog-title:block-2">'));
assert(output.includes('data-dialog="dialog:block-2"'));
assert(output.includes('<section id="block:block-2" data-block="block-2"'));
assert(output.includes('<main id="page:home"'));
assert(output.includes('aria-haspopup="dialog"'));
assert(output.includes('dialog.addEventListener(\'close\''));
assert(output.includes('opener.focus({preventScroll:true})'));
for (const effect of ['spotlight', 'stars', 'reveal', 'lift', 'zoom']) assert(output.includes('fx-' + effect));
assert(output.includes('prefers-reduced-motion:reduce'));
assert(output.includes('(hover:none),(pointer:coarse)'));
assert(output.includes('hashchange'));
assert(output.includes("if(link){event.preventDefault();const next=link.getAttribute('href')"), 'srcdoc internal links must not resolve against the parent editor URL');
assert(output.includes('else location.hash=next'), 'internal routes navigate inside the preview document');
assert(output.includes("pages.find(p=>p.dataset.page===home)"), 'unknown route falls back to homepage');
assert(output.includes('document.title=page.dataset.pageTitle'));
assert(output.includes("connect-src 'none'"));
assert(output.includes("form-action 'none'"));
assert(!output.includes('https://'), 'default website needs no remote assets');
assert(!output.includes('持续探索中'));
assert(!output.includes('保持好奇，继续前行'));

const surfaceProject = createStarterProject();
const surface = createBlock('surface');
surface.id = 'color-surface';
surface.appearance = { ...PALETTE_LIBRARY.find(item => item.id === 'mint').appearance, background: 'grid' };
surfaceProject.pages[0].blocks.push(surface);
let surfaceOutput = renderBlockProject(surfaceProject);
assert(surfaceOutput.includes('class="site-block block-surface theme-light"'));
assert(surfaceOutput.includes('background-color:#eaf5ef;background-image:linear-gradient('));
assert(surfaceOutput.includes('--accent:#21765b'));
assert(surfaceOutput.includes('min-height:280px'));
assert(surfaceOutput.includes('<div class="block-content"></div>'), 'an untouched surface is genuinely empty');
surface.title = '用户自己填写的标题';
surface.text = '用户自己填写的说明';
surfaceOutput = renderBlockProject(surfaceProject);
assert(surfaceOutput.includes('<h2>用户自己填写的标题</h2>'));
assert(surfaceOutput.includes('用户自己填写的说明'));
surface.appearance = { background: 'url(https://css-injection.test)', backgroundColor: '#000;}</style><script>evil()</script>', secondaryColor: 'red', textColor: 'var(--secret)', accentColor: '#fff' };
surfaceOutput = renderBlockProject(surfaceProject);
assert(!surfaceOutput.includes('css-injection.test'));
assert(!surfaceOutput.includes('<script>evil()'));
assert(!surfaceOutput.includes('var(--secret)'));

// Adding an image is independent of a block's original structure and motion.
const pixelImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBnUAAAAASUVORK5CYII=';
const imageProject = createStarterProject();
const imageBlocks = ['surface', 'text', 'nav', 'hero', 'accordion', 'contact', 'signature', 'project'].map(kind => {
  const block = createBlock(kind);
  block.id = 'image-' + kind;
  block.title = kind + ' 自己的标题';
  block.text = '自己的说明';
  block.button = '查看内容';
  block.link = { type: 'url', target: 'https://example.test/own-content' };
  block.image = pixelImage;
  block.effects = ['zoom', 'stars'];
  block.appearance = { ...PALETTE_LIBRARY.find(item => item.id === 'mint').appearance, background: 'grid' };
  return block;
});
imageProject.pages[0].blocks = imageBlocks;
const beforeImageRender = structuredClone(imageProject);
const imageOutput = renderBlockProject(imageProject);
const sectionOf = (html, id) => {
  const section = html.split('<section id="block:' + id + '"')[1]?.split('</section>')[0];
  assert(section, 'expected exported block ' + id);
  return section;
};
for (const block of imageBlocks) {
  const section = sectionOf(imageOutput, block.id);
  assert(section.includes('block-' + block.kind + ' theme-light fx-zoom fx-stars'), 'image retains structure and all selected effects');
  assert(section.includes('background-color:#eaf5ef;background-image:linear-gradient('), 'image retains existing appearance');
  assert.equal((section.match(/<img /g) || []).length, 1, 'each native block renders its image exactly once');
  assert(section.includes('src="' + pixelImage + '"'));
  assert(!section.includes('project-placeholder'), 'a valid attached image has no placeholder');
  assert(section.includes(block.title), 'image retains existing title');
  if (block.kind === 'nav') assert(section.includes('<nav class="site-nav"') && section.includes('href="#/start-home"'), 'adding a navigation image keeps its links');
  else assert(section.includes('href="https://example.test/own-content"'), 'image retains existing action URL');
}
assert.deepEqual(imageProject, beforeImageRender, 'export never rewrites the project');
for (const block of imageBlocks.filter(item => ['surface', 'text'].includes(item.kind))) {
  block.effects = ['stars'];
  let section = sectionOf(renderBlockProject(imageProject), block.id);
  assert(!section.includes('fx-zoom'), 'removing zoom removes the effect class');
  assert(section.includes('src="' + pixelImage + '"') && section.includes(block.title) && section.includes(block.text), 'removing zoom keeps image and content');
  assert(section.includes('href="https://example.test/own-content"'), 'removing zoom keeps the link');
  block.link = { type: 'modal', target: '' };
  section = sectionOf(renderBlockProject(imageProject), block.id);
  assert.equal((section.split('<dialog')[0].match(/<img /g) || []).length, 1, 'main block image is not duplicated');
  assert.equal((section.split('<dialog')[1].match(/<img /g) || []).length, 1, 'native block modal shows its attached image');
  for (const unsafe of ['', 'https://example.test/remote.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,abc" onerror="alert(1)']) {
    block.image = unsafe;
    section = sectionOf(renderBlockProject(imageProject), block.id);
    assert(!section.includes('<img ') && !section.includes('project-placeholder'), 'empty or unsafe image does not produce media or a placeholder');
    assert(!section.includes('onerror='));
  }
  block.image = pixelImage;
}
const imageCard = imageBlocks.find(block => block.kind === 'project');
imageCard.link = { type: 'modal', target: '' };
const imageCardSection = sectionOf(renderBlockProject(imageProject), imageCard.id);
assert.equal((imageCardSection.split('<dialog')[0].match(/<img /g) || []).length, 1, 'project card keeps only its original main image');
assert.equal((imageCardSection.split('<dialog')[1].match(/<img /g) || []).length, 1, 'project modal has its own image');
const imageEmbed = createBlock('embed');
imageEmbed.id = 'image-embed';
imageEmbed.image = pixelImage;
imageEmbed.html = '<p>完整网页保持原样</p>';
imageProject.pages[0].blocks.push(imageEmbed);
assert(!sectionOf(renderBlockProject(imageProject), imageEmbed.id).includes('<img '), 'embedded website does not acquire native image content');

const legacy = structuredClone(project);
legacy.accent = '#f5b544';
legacy.pages[0].blocks.forEach(block => { delete block.appearance; block.theme = 'dark'; });
assert(renderBlockProject(legacy).includes('background-color:#090909;background-image:none'));
assert(renderBlockProject(legacy).includes('--accent:#f5b544;--block-text:#f0efed'));

const collisionProject = structuredClone(project);
for (const id of ['dialog-block-2', 'dialog-title-block-2', 'page-home', 'block-block-2']) {
  const block = createBlock('text');
  block.id = id;
  collisionProject.pages[0].blocks.push(block);
}
const collisionOutput = renderBlockProject(collisionProject);
const domIds = [...collisionOutput.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(domIds).size, domIds.length, 'imported block IDs cannot collide with derived dialog, heading, page or section IDs');
assert(collisionOutput.includes('data-dialog="dialog:block-2"'));
assert(collisionOutput.includes('id="block:dialog-block-2"'));
assert(collisionOutput.includes('href="#/home/block-2"'), 'DOM namespacing does not change project routes');

project.name = '"><script>globalThis.pwned=1</script>';
hero.title = '</h1><script>globalThis.pwned=2</script>';
hero.text = '<img src=x onerror=globalThis.pwned=3>';
hero.eyebrow = '" autofocus onfocus="evil()';
hero.button = '<img src=x onerror=evil()>';
hero.link = { type: 'url', target: 'javascript:alert(1)' };
card.image = 'data:image/svg+xml;base64,PHN2Zz4=';
second.blocks[2].items = [{ title: '<script>evil()</script>', text: '<img src=x onerror=evil()>' }];
output = renderBlockProject(project);
assert(!output.includes('<script>globalThis.pwned'));
assert(!output.includes('<img src=x'));
assert(output.includes('&lt;script&gt;globalThis.pwned=2&lt;/script&gt;'));
assert(!output.includes('href="javascript:'));
assert(!output.includes('data:image/svg+xml'));
assert.equal((output.match(/<script>/g) || []).length, 1, 'only the trusted static runtime is executable');
const executable = output.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert(executable);
new Script(executable);
assert(!executable.includes('globalThis.pwned'), 'user text is never interpolated into JavaScript');

hero.link = { type: 'url', target: 'https://example.test/a?q=one&b="two"' };
output = renderBlockProject(project);
assert(output.includes('href="https://example.test/a?q=one&amp;b=&quot;two&quot;" target="_blank" rel="noopener noreferrer"'));
hero.link = { type: 'page', target: 'missing' };
assert(!renderBlockProject(project).includes('href="#/missing"'), 'removed page target is inert');
hero.link = { type: 'page', target: 'about' };
assert(renderBlockProject(project).includes('href="#/about"'));
card.image = 'data:image/png;base64,aGVsbG8=';
assert(renderBlockProject(project).includes('src="data:image/png;base64,aGVsbG8="'));

const embedded = createBlock('embed');
embedded.id = 'imported';
embedded.html = '<!doctype html><html><head><script>parent.location="https://attacker.test"</script></head><body><img src="https://attacker.test/track"><iframe src="https://attacker.test"></iframe><form action="https://attacker.test"><input></form></body></html>';
project.pages[0].blocks.push(embedded);
output = renderBlockProject(project);
assert(output.includes('sandbox="" referrerpolicy="no-referrer" srcdoc="&lt;!doctype html&gt;'));
assert(output.includes('script-src &#39;none&#39;'));
assert(output.includes('frame-src &#39;none&#39;'));
assert(output.includes('form-action &#39;none&#39;'));
assert(!output.includes('<script>parent.location'));
assert.equal((output.match(/<script>/g) || []).length, 1);
assert(!output.includes('allow-same-origin'));

assert.throws(() => renderBlockProject({ ...project, accent: '#000;}</style><script>bad()</script>', pages: [] }));
project.accent = '#000;}</style><script>bad()</script>';
assert(renderBlockProject(project).includes(':root{--accent:#2563eb}'));
const duplicate = structuredClone(project);
duplicate.pages[1].id = duplicate.pages[0].id;
assert.throws(() => renderBlockProject(duplicate));

console.log('Block renderer checks passed: routes, dialogs, effects, escaping, sandbox and offline export.');
