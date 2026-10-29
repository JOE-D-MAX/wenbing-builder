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

const { createBlock, createStarterProject, parseBlockProject, safeBackgroundVideoSrc, cleanBackgroundVideo, MAX_BACKGROUND_VIDEO_BYTES } = await import('../lib/block-model.ts');
const { renderBlockProject } = await import('../lib/block-renderer.ts');
const { VIDEO_BACKGROUND_SCRIPT, renderVideoBackground } = await import('../lib/video-background.ts');
const tinyVideo = 'data:video/mp4;base64,AAAA';
const dataUrl = bytes => 'data:video/webm;base64,' + Buffer.alloc(bytes, 1).toString('base64');
assert.equal(MAX_BACKGROUND_VIDEO_BYTES, 2 * 1024 * 1024);
assert.equal(safeBackgroundVideoSrc(tinyVideo), tinyVideo);
const maximumVideo = dataUrl(MAX_BACKGROUND_VIDEO_BYTES);
assert.equal(safeBackgroundVideoSrc(maximumVideo), maximumVideo, 'exact byte limit is accepted');
assert.equal(safeBackgroundVideoSrc(dataUrl(MAX_BACKGROUND_VIDEO_BYTES + 1)), '', 'padding cannot bypass the actual byte limit');
for (const invalid of [null, {}, 'javascript:alert(1)', 'blob:https://example.test/a', 'http://example.test/a.mp4', '//example.test/a.mp4', 'https:example.test/a.mp4', 'https://name:password@example.test/a.mp4', 'https://name@example.test/a.mp4', 'https://example.test/a\n.mp4', 'https://example.test\\a.mp4', 'data:video/ogg;base64,AAAA', 'data:video/mp4;base64,', 'data:video/mp4;base64,A===', 'data:video/mp4;base64,A=AA', 'data:video/mp4;base64,AA', 'data:video/mp4;base64,AA A', 'data:video/mp4;base64,AAAA" onerror="bad']) assert.equal(safeBackgroundVideoSrc(invalid), '', 'reject unsafe or malformed source: ' + String(invalid));
const signed = 'https://cdn.example.test/asset.webm?expires=123&signature=a%2Fb';
assert.equal(safeBackgroundVideoSrc(signed), signed, 'signed HTTPS video links remain usable');
assert.deepEqual(cleanBackgroundVideo({ src: tinyVideo }), { src: tinyVideo, dim: .35 });
assert.deepEqual(cleanBackgroundVideo({ src: tinyVideo, dim: Infinity, poster: 'javascript:bad()', paused: 'yes' }), { src: tinyVideo, dim: .35 });
assert.equal(cleanBackgroundVideo({ src: tinyVideo, dim: 100 }).dim, .8);
assert.equal(cleanBackgroundVideo({ src: tinyVideo, dim: -2 }).dim, 0);
assert.equal(cleanBackgroundVideo({ src: tinyVideo, poster: 'data:image/svg+xml;base64,AAAA' }).poster, undefined);
assert.equal(cleanBackgroundVideo({ src: tinyVideo, poster: 'https://name:password@example.test/poster.jpg' }).poster, undefined);
assert.equal(cleanBackgroundVideo({ src: tinyVideo, poster: 'https://example.test/poster.jpg' }).poster, 'https://example.test/poster.jpg');

const legacy = createStarterProject();
const authored = createBlock('hero');
Object.assign(authored, { title: '我的内容 <保留>', text: '原有正文', image: 'data:image/png;base64,AAAA', items: [{ title: '原有标签', text: '原有项目' }], button: '原有跳转', link: { type: 'url', target: 'https://example.test/my-work' }, effects: ['ambient', 'reveal'] });
legacy.pages[0].blocks.push(authored);
assert.deepEqual(parseBlockProject(legacy), legacy, 'old projects do not gain video properties');
const legacyHtml = renderBlockProject(legacy);
assert(!legacyHtml.includes('data-background-video') && !legacyHtml.includes('media-src'), 'unused feature does not add a player or loosen the existing CSP');
const videoProject = structuredClone(legacy);
const videoBlock = videoProject.pages[0].blocks[0];
videoBlock.appearance.background = 'video';
videoBlock.backgroundVideo = { src: tinyVideo, poster: 'data:image/jpeg;base64,AAAA', dim: .4, paused: true };
assert.deepEqual(parseBlockProject(videoProject), videoProject, 'backup round-trip preserves source, poster, shade and paused state');
const beforeRender = structuredClone(videoProject);
const html = renderBlockProject(videoProject);
assert.deepEqual(videoProject, beforeRender, 'export does not change author data');
assert.equal((html.match(/<video /g) || []).length, 1);
assert(html.includes('data-paused="true"') && html.includes('muted loop playsinline preload="none"'));
assert(html.includes('data-src="' + tinyVideo + '"') && !html.includes('<video src='), 'media is loaded only when playback becomes allowed');
assert(html.includes('style="opacity:0.4"') && html.includes('object-fit:cover'));
assert(html.includes('我的内容 &lt;保留&gt;') && html.includes('原有正文') && html.includes('href="https://example.test/my-work"'));
assert(html.includes('src="data:image/png;base64,AAAA"'), 'foreground images remain independent');
assert(html.includes('media-src data: https:;') && html.includes("connect-src 'none'"));
assert(html.includes('data-video-toggle') && html.includes('min-height:44px'));
for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Script(script[1]);
const unrelated = structuredClone(videoProject);
unrelated.pages[0].blocks[0].appearance.background = 'gradient';
assert.equal(renderVideoBackground(unrelated.pages[0].blocks[0]), '', 'switching backgrounds retains the saved video without rendering it');
assert(!renderBlockProject(unrelated).includes('data-background-video'));
const broken = structuredClone(videoProject);
broken.pages[0].blocks[0].backgroundVideo.src = 'javascript:alert(1)';
assert(!renderBlockProject(broken).includes('data-background-video'), 'invalid imported video falls back to the color');
const embedded = createBlock('embed');
embedded.html = '<p>Imported content</p>';
embedded.appearance.background = 'video';
embedded.backgroundVideo = videoBlock.backgroundVideo;
assert.equal(renderVideoBackground(embedded), '', 'imported full pages remain isolated');
const escaped = structuredClone(videoProject);
escaped.pages[0].blocks[0].backgroundVideo = { src: 'https://example.test/a.mp4?q="</video><script>bad()</script>', dim: .35 };
const escapedHtml = renderBlockProject(escaped);
assert(!escapedHtml.includes('<script>bad()') && escapedHtml.includes('&lt;/video&gt;&lt;script&gt;'));

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function runtime({ reduced = false, saveData = false, hidden = false, observer = true, savedPaused = [false, false] } = {}) {
  const listeners = () => ({ handlers: new Map(), addEventListener(type, handler) { const entries = this.handlers.get(type) || []; entries.push(handler); this.handlers.set(type, entries); }, fire(type) { (this.handlers.get(type) || []).forEach(handler => handler()); } });
  const media = { ...listeners(), matches: reduced };
  const connection = { ...listeners(), saveData };
  const document = { ...listeners(), hidden, querySelectorAll(selector) { assert.equal(selector, '[data-background-video]'); return videos; } };
  const window = { ...listeners(), innerWidth: 1200, innerHeight: 800 };
  const buttons = [], blocks = [], layers = [];
  const videos = [0, 1].map(index => {
    const button = { ...listeners(), textContent: '', disabled: false, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
    const layer = { classes: new Set(), classList: { add(name) { layer.classes.add(name); } } };
    const block = { hidden: false, rect: { top: 100, bottom: 400, left: 0, right: 800 }, closest(selector) { assert.equal(selector, '[hidden]'); return this.hidden ? {} : null; }, querySelector(selector) { assert.equal(selector, '[data-video-toggle]'); return button; }, getBoundingClientRect() { return this.rect; } };
    const video = { ...listeners(), dataset: { src: tinyVideo, ...(savedPaused[index] ? { paused: 'true' } : {}) }, parentElement: layer, paused: true, ended: false, muted: false, src: '', playCount: 0, pauseCount: 0, reject: false, defer: false,
      closest(selector) { assert.equal(selector, '.site-block'); return block; }, getAttribute(name) { return name === 'src' ? this.src : null; },
      play() { this.playCount++; if (this.reject) return Promise.reject(new Error('blocked')); if (this.defer) return new Promise((resolve, reject) => { this.resolve = () => { this.paused = false; this.fire('play'); resolve(); }; this.rejectPending = reject; }); this.paused = false; this.fire('play'); return Promise.resolve(); },
      pause() { this.pauseCount++; this.paused = true; this.fire('pause'); },
    };
    buttons.push(button); blocks.push(block); layers.push(layer); return video;
  });
  let intersection;
  class IntersectionObserver { constructor(callback) { this.callback = callback; this.observed = []; intersection = this; } observe(element) { this.observed.push(element); } }
  if (observer) window.IntersectionObserver = IntersectionObserver;
  const context = { document, window, navigator: { connection }, matchMedia() { return media; }, ...(observer ? { IntersectionObserver } : {}), requestAnimationFrame() { throw new Error('No frame loop'); }, setInterval() { throw new Error('No polling'); } };
  new Script(VIDEO_BACKGROUND_SCRIPT).runInNewContext(context, { timeout: 500 });
  return { videos, buttons, blocks, layers, observed: () => intersection?.observed,
    async enter(index, visible) { intersection.callback([{ target: blocks[index], isIntersecting: visible }]); await flush(); },
    async hide(value) { document.hidden = value; document.fire('visibilitychange'); await flush(); },
    async reduce(value) { media.matches = value; media.fire('change'); await flush(); },
    async saveData(value) { connection.saveData = value; connection.fire('change'); await flush(); },
    async click(index) { buttons[index].fire('click'); await flush(); },
    async routeHidden(index, value) { blocks[index].hidden = value; window.fire('hashchange'); await flush(); },
    async scroll() { window.fire('scroll'); await flush(); },
    async error(index) { videos[index].fire('error'); await flush(); },
  };
}

const motion = runtime();
assert.deepEqual(motion.observed(), motion.blocks);
assert(motion.videos.every(video => video.src === '' && video.paused), 'initially offscreen video does not fetch or play');
await motion.enter(0, true);
assert.equal(motion.videos[0].paused, false);
assert.equal(motion.videos[1].src, '', 'another block remains unloaded');
assert.equal(motion.buttons[0].textContent, '暂停背景视频');
await motion.click(0);
assert(motion.videos[0].paused, 'user pause takes effect immediately');
await motion.hide(true); await motion.hide(false);
assert(motion.videos[0].paused, 'visibility events never undo a user pause');
await motion.click(0);
assert(!motion.videos[0].paused);
await motion.enter(0, false);
assert(motion.videos[0].paused, 'leaving viewport pauses even manually started media');
await motion.enter(0, true);
assert(!motion.videos[0].paused, 'manual intent resumes when the block returns');
await motion.hide(true);
assert(motion.videos[0].paused);
await motion.enter(1, true);
assert.equal(motion.videos[1].src, '', 'hidden document does not start a newly intersecting video');
await motion.hide(false);
assert(motion.videos.every(video => !video.paused));
await motion.routeHidden(0, true);
assert(motion.videos[0].paused && !motion.videos[1].paused, 'page navigation pauses only the hidden page');
await motion.routeHidden(0, false);
assert(!motion.videos[0].paused);

const preferences = runtime({ reduced: true });
await preferences.enter(0, true);
assert.equal(preferences.videos[0].src, '', 'reduced motion does not preload or autoplay');
await preferences.click(0);
assert(!preferences.videos[0].paused, 'explicit play overrides reduced motion');
await preferences.hide(true);
assert(preferences.videos[0].paused, 'manual play still stops in hidden documents');
await preferences.hide(false);
assert(!preferences.videos[0].paused);
await preferences.enter(1, true);
assert.equal(preferences.videos[1].src, '');
await preferences.reduce(false);
assert(!preferences.videos[1].paused);
await preferences.saveData(true);
assert(preferences.videos[1].paused && !preferences.videos[0].paused, 'save-data only suspends automatic playback');
await preferences.saveData(false);
assert(!preferences.videos[1].paused);
const lowData = runtime({ saveData: true });
await lowData.enter(0, true);
assert.equal(lowData.videos[0].src, '');
await lowData.click(0);
assert(!lowData.videos[0].paused);

const paused = runtime({ savedPaused: [true, false] });
await paused.enter(0, true); await paused.enter(1, true);
assert.equal(paused.videos[0].src, '', 'saved paused state prevents autoplay after export');
assert(!paused.videos[1].paused);
await paused.click(0);
assert(!paused.videos[0].paused);
await paused.error(0);
assert(paused.videos[0].paused && paused.buttons[0].disabled && paused.layers[0].classes.has('video-failed'), 'failed media reveals the original color and a disabled status');
assert(!paused.videos[1].paused, 'one failed video does not stop other blocks');

const denied = runtime();
denied.videos[0].reject = true;
await denied.enter(0, true);
assert.equal(denied.buttons[0].textContent, '播放背景视频', 'autoplay rejection has a usable fallback');
assert.equal(denied.videos[0].playCount, 1);
await denied.hide(true); await denied.hide(false);
assert.equal(denied.videos[0].playCount, 1, 'a blocked player does not repeatedly retry autoplay');
denied.videos[0].reject = false;
await denied.click(0);
assert(!denied.videos[0].paused, 'manual play retries a blocked request');
const race = runtime();
race.videos[0].defer = true;
await race.enter(0, true); await race.enter(0, false);
race.videos[0].resolve(); await flush();
assert(race.videos[0].paused, 'a delayed play resolution cannot restart an offscreen video');

for (const interrupt of ['viewport', 'button']) {
  const resumed = runtime();
  resumed.videos[0].defer = true;
  await resumed.enter(0, true);
  const rejectInterruptedPlay = resumed.videos[0].rejectPending;
  if (interrupt === 'viewport') { await resumed.enter(0, false); await resumed.enter(0, true); }
  else { await resumed.click(0); await resumed.click(0); }
  assert.equal(resumed.videos[0].playCount, 2, `${interrupt} resume can start a fresh request before the paused play promise rejects`);
  rejectInterruptedPlay(new Error('AbortError: play was interrupted by pause'));
  await flush();
  resumed.videos[0].resolve();
  await flush();
  assert(!resumed.videos[0].paused, 'an older aborted play cannot mark the resumed video as blocked');
  resumed.videos[0].defer = false;
  await resumed.enter(0, false); await resumed.enter(0, true);
  assert(!resumed.videos[0].paused, 'the recovered video keeps working on later viewport changes');
}

const fallback = runtime({ observer: false });
await flush();
assert(fallback.videos.every(video => !video.paused));
fallback.blocks[0].rect = { top: 1000, bottom: 1200, left: 0, right: 800 };
await fallback.scroll();
assert(fallback.videos[0].paused && !fallback.videos[1].paused, 'older-browser fallback still stops offscreen media');

console.log('Video backgrounds passed: bounded source validation, draft round-trip, authored-content preservation, safe portable export, per-video playback, route/viewport/visibility pausing, motion/save-data preferences, media failure and rejected playback.');
