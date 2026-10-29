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

const { createBlock, createStarterProject, parseBlockProject, EFFECT_LIBRARY, PALETTE_LIBRARY } = await import('../lib/block-model.ts');
const { renderBlockProject } = await import('../lib/block-renderer.ts');
const { createDesignStarterProject } = await import('../lib/design-templates.ts');
const { AMBIENT_SCRIPT } = await import('../lib/ambient-effect.ts');

const original = createStarterProject();
const authored = createBlock('hero');
Object.assign(authored, {
  title: '作者自己的标题 <保留>', text: '第一段说明\n第二段内容', eyebrow: '自己的栏目', button: '阅读我的项目',
  image: 'data:image/png;base64,iVBORw0KGgo=',
  items: [{ title: '原有项目标签', text: '原有说明' }],
  link: { type: 'url', target: 'https://example.test/my-project?view=full' },
  appearance: { background: 'gradient', backgroundColor: '#123456', secondaryColor: '#345678', textColor: '#fedcba', accentColor: '#abdd63' },
  effects: ['reveal'],
});
original.pages[0].blocks.push(authored);
const applied = structuredClone(original);
applied.pages[0].blocks[0].effects.push('ambient');
assert.deepEqual(parseBlockProject(applied), applied, 'ambient survives backup without changing any author data');
const withoutAddedEffect = structuredClone(parseBlockProject(applied));
withoutAddedEffect.pages[0].blocks[0].effects = withoutAddedEffect.pages[0].blocks[0].effects.filter(effect => effect !== 'ambient');
assert.deepEqual(withoutAddedEffect, original, 'applying ambient changes only the effect list');
assert.equal(applied.pages[0].blocks[0].design, undefined, 'the effect is independent of a template');
assert.deepEqual(EFFECT_LIBRARY.slice(0, 2).map(item => item.id), ['ambient', 'curtain']);
assert.equal(PALETTE_LIBRARY[0].id, 'paper', 'the default palette is unchanged');
assert.deepEqual(createBlock('surface').effects, [], 'new blocks do not gain effects automatically');

const html = renderBlockProject(applied);
for (const value of ['作者自己的标题 &lt;保留&gt;', '第一段说明<br>第二段内容', '自己的栏目', '阅读我的项目', authored.image, 'href="https://example.test/my-project?view=full"']) assert(html.includes(value), 'export preserves ' + value);
for (const color of Object.values(authored.appearance).filter(value => value.startsWith('#'))) assert(html.includes(color), 'all authored colors survive');
assert(html.includes('fx-ambient') && html.includes('fx-reveal'), 'new and existing effects coexist');
assert(html.includes('class="ambient-field"'));
assert(html.includes("connect-src 'none'"));
assert(!/<(?:img|script|iframe|source|link)\b[^>]*(?:src|href)\s*=\s*["']https?:/i.test(html), 'no external assets are requested');
assert(!/url\(\s*["']?https?:/i.test(html), 'no CSS asset requests are added');
for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Script(script[1]);
assert(!renderBlockProject(original).includes('class="ambient-field"'), 'unused effect does not alter old exports');

const legacyDesign = createDesignStarterProject();
assert.deepEqual(parseBlockProject(legacyDesign), legacyDesign, 'previous design drafts are still supported');
const withDesignEffect = structuredClone(legacyDesign);
withDesignEffect.pages[0].blocks[1].effects.push('ambient');
assert.deepEqual(parseBlockProject(withDesignEffect), withDesignEffect);
const designHtml = renderBlockProject(withDesignEffect);
assert(designHtml.includes('design-editorial-hero') && designHtml.includes('ambient-field'));
const untrusted = structuredClone(applied);
untrusted.pages[0].blocks[0].effects.push('ambient"><script>alert(1)</script>');
assert.deepEqual(parseBlockProject(untrusted).pages[0].blocks[0].effects, ['reveal', 'ambient'], 'effect names remain allowlisted');

function runtime({ observer = true, hidden = false, reduced = false } = {}) {
  const listeners = new Map();
  const mediaListeners = new Map();
  const blocks = Array.from({ length: 2 }, () => {
    const classes = new Set(['fx-ambient']);
    return { classes, classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } } };
  });
  const media = { matches: reduced, addEventListener(type, listener) { mediaListeners.set(type, listener); } };
  const document = {
    hidden,
    querySelectorAll(selector) { assert.equal(selector, '.fx-ambient'); return blocks; },
    addEventListener(type, listener) { listeners.set(type, listener); },
  };
  let observerInstance;
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; this.observed = []; observerInstance = this; }
    observe(block) { this.observed.push(block); }
  }
  const window = observer ? { IntersectionObserver } : {};
  const context = {
    document, window, matchMedia(query) { assert.equal(query, '(prefers-reduced-motion: reduce)'); return media; },
    requestAnimationFrame() { throw new Error('Ambient must not use a JavaScript frame loop'); },
    setInterval() { throw new Error('Ambient must not use a polling timer'); },
    ...(observer ? { IntersectionObserver } : {}),
  };
  new Script(AMBIENT_SCRIPT).runInNewContext(context, { timeout: 500 });
  return {
    blocks,
    get observed() { return observerInstance?.observed || []; },
    running() { return blocks.map(block => block.classes.has('ambient-running')); },
    enter(index, visible) { assert(observerInstance, 'expected an IntersectionObserver'); observerInstance.callback([{ target: blocks[index], isIntersecting: visible }]); },
    hide(value) { document.hidden = value; assert(listeners.has('visibilitychange')); listeners.get('visibilitychange')(); },
    reduce(value) { media.matches = value; assert(mediaListeners.has('change')); mediaListeners.get('change')(); },
  };
}

const motion = runtime();
assert.deepEqual(motion.observed, motion.blocks);
assert.deepEqual(motion.running(), [false, false], 'offscreen blocks initially pause');
motion.enter(0, true);
assert.deepEqual(motion.running(), [true, false], 'only a visible block animates');
motion.enter(1, true);
assert.deepEqual(motion.running(), [true, true]);
motion.enter(0, false);
assert.deepEqual(motion.running(), [false, true], 'leaving the viewport pauses that block');
motion.hide(true);
assert.deepEqual(motion.running(), [false, false], 'background tabs pause every layer');
motion.enter(0, true);
assert.deepEqual(motion.running(), [false, false], 'intersection callbacks cannot restart a hidden document');
motion.hide(false);
assert.deepEqual(motion.running(), [true, true], 'visible blocks resume when the document returns');
motion.reduce(true);
assert.deepEqual(motion.running(), [false, false], 'changing to reduced motion stops animation');
motion.enter(0, false);
motion.reduce(false);
assert.deepEqual(motion.running(), [false, true], 'leaving reduced motion only resumes visible blocks');
motion.enter(1, false);
assert.deepEqual(motion.running(), [false, false]);

const initiallyReduced = runtime({ reduced: true });
initiallyReduced.enter(0, true);
assert.deepEqual(initiallyReduced.running(), [false, false]);
initiallyReduced.reduce(false);
assert.deepEqual(initiallyReduced.running(), [true, false]);

const fallback = runtime({ observer: false, hidden: true });
assert.deepEqual(fallback.running(), [false, false]);
fallback.hide(false);
assert.deepEqual(fallback.running(), [true, true], 'older browsers safely animate without an observer');
fallback.reduce(true);
assert.deepEqual(fallback.running(), [false, false], 'fallback still respects motion preferences');

console.log('Style materials passed: authored content, colors, links, portable export, legacy designs, and actual visibility/reduced-motion state transitions.');
