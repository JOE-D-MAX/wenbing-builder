import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as icons from 'lucide-react';
import { arrayMove } from '@dnd-kit/sortable';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const candidate = new URL(specifier, context.parentURL);
    if (!/\.[cm]?[jt]s$/.test(specifier) && existsSync(fileURLToPath(candidate) + '.ts')) return { url: pathToFileURL(fileURLToPath(candidate) + '.ts').href, shortCircuit: true };
  }
  return next(specifier, context);
} });
const model = await import('../lib/block-model.ts');
const projectColors = await import('../lib/project-colors.ts');
const { randomizeSite } = await import('../lib/random-site.ts');
const source = readFileSync(new URL('../components/studio/block-studio.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('block-studio.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
let pagesExpression;
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, node.initializer);
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'project.pages.map' && node.getText(ast).includes('data-canvas-page')) pagesExpression = node;
  ts.forEachChild(node, visit);
}
visit(ast);
assert(pagesExpression, 'the existing canvas must map the actual project pages');
const handlers = ['commit', 'revealWorkspaceRegion', 'selectCanvasBlock', 'selectCanvasPage', 'updateBlock', 'updateAppearance', 'applyPageAppearance', 'addBlock', 'replayEffect', 'cancelZoom', 'applyEffect', 'cancelVideo', 'openVideoPicker', 'saveBackgroundVideo', 'uploadBackgroundVideo', 'useVideoUrl', 'toggleBackgroundVideo', 'applyMaterial', 'moveBlock', 'copyBlock', 'deleteBlock', 'endDrag', 'uploadImage', 'undo', 'redo'];
const compile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
const compiled = handlers.map(name => {
  assert(declarations.get(name), `actual handler ${name} must exist`);
  return compile(`globalThis.${name} = ${declarations.get(name).getText(ast)}`);
});
const renderCode = compile(`globalThis.renderPages = () => (${pagesExpression.getText(ast)});`);
const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const first = model.createStarterProject();
  first.pages[0].blocks = [{ ...model.createBlock('hero'), title: 'Page A original' }, model.createBlock('text')];
  first.pages.push({ id: 'page-b', title: 'Page B', blocks: [
    { ...model.createBlock('project'), title: 'Page B image', image: 'https://example.test/image.jpg' },
    { ...model.createBlock('text'), title: 'Page B body' },
    { ...model.createBlock('signature'), title: 'Page B closing' },
  ] }, { id: 'page-c', title: 'Empty C', blocks: [] });
  return first;
}
function harness(project = fixture()) {
  const initial = structuredClone(project);
  const calls = { stage: [], notices: [], regions: [] };
  const blockComponent = ({ block, children }) => React.createElement('div', { 'data-test-block': block.id }, block.title, children);
  const dropComponent = ({ pageId, children }) => React.createElement('div', { 'data-test-drop-page': pageId }, children);
  const context = vm.createContext({
    ...model, ...projectColors, ...icons, React, Blob, JSON, Date: { now: () => 1000 }, JSON_LIMIT: 3 * 1024 * 1024,
    historyRef: { current: { past: [], current: initial, future: [] } },
    mergeRef: { current: { key: '', time: 0 } },
    viewContext: { current: { pageId: initial.pages[0].id, selectedId: initial.pages[0].blocks[0]?.id || '' } },
    alive: { current: true }, imageRequest: { current: 0 }, videoRequest: { current: 0 },
    persistence: { current: { stage(value) { calls.stage.push(value); } } },
    imageBusy: false, videoBusy: false, zoomTarget: null, videoTarget: null, effectDemos: {},
    view: 'edit', mobilePanel: 'canvas', selectedId: initial.pages[0].blocks[0]?.id || '', pageId: initial.pages[0].id,
    previewMotion: { reduced: true, playing: true }, arrayMove, useCallback: fn => fn,
    labelFor: kind => model.BLOCK_LIBRARY.find(item => item.kind === kind)?.name || '',
    t: (text, values) => text.replace(/\{\{(\w+)\}\}/g, (match, key) => String(values?.[key] ?? match)),
    window: { innerWidth: 1200, innerHeight: 900 },
    requestAnimationFrame(callback) { callback(); return 1; },
    document: { getElementById(id) { calls.regions.push(id); return { focus() {}, scrollIntoView() {}, getBoundingClientRect: () => ({ top: 30, bottom: 400 }) }; } },
    setHistory() {}, setNotice(value) { calls.notices.push(value); },
    SortableBlock: blockComponent, CanvasDrop: dropComponent,
    SortableContext: ({ children }) => React.createElement(React.Fragment, null, children), verticalListSortingStrategy: () => [],
    CanvasImagePicker: () => null, BackgroundVideoPicker: () => null,
    compressImage: async () => 'data:image/png;base64,AAAA',
    readBackgroundVideo: async () => ({ src: 'https://example.test/video.mp4', dim: 0.35 }),
    ...Object.fromEntries(['Error', 'ImageBusy', 'VideoBusy', 'ZoomTarget', 'VideoTarget', 'SelectedId', 'View', 'MobilePanel', 'EffectDemos', 'PageId', 'DragItem'].map(name => [`set${name}`, value => {
      const key = name[0].toLowerCase() + name.slice(1);
      context[key] = typeof value === 'function' ? value(context[key]) : value;
    }])),
  });
  for (const code of compiled) vm.runInContext(code, context);
  vm.runInContext(renderCode, context);
  function refresh() {
    context.project = context.historyRef.current.current;
    context.currentPage = context.project.pages.find(page => page.id === context.pageId) || context.project.pages[0];
    context.selected = context.currentPage.blocks.find(block => block.id === context.selectedId);
    context.viewContext.current = { pageId: context.currentPage.id, selectedId: context.selectedId };
  }
  refresh();
  return { context, calls, initial, refresh, blockComponent, dropComponent };
}
function drop(test, active, over) {
  test.context.endDrag({ active: { data: { current: active } }, over: { data: { current: over } } });
}
function assertOnlyPage(test, pageId) {
  const current = test.context.historyRef.current.current;
  for (const original of test.initial.pages) if (original.id !== pageId) assert.equal(current.pages.find(page => page.id === original.id), original, `page ${original.id} must not be changed`);
  assert.equal(test.context.historyRef.current.past.length, 1, 'the operation has one undo entry');
  assert.equal(test.calls.stage.length, 1);
  test.context.undo();
  assert.equal(test.context.historyRef.current.current, test.initial, 'one undo restores the complete original site');
}

for (let count = 1; count <= 10; count++) {
  const project = randomizeSite(model.createStarterProject(), { pageCount: count, random: () => 0 }).project;
  const test = harness(project);
  // Render the real page loop; drag-and-drop providers/blocks are lightweight probes
  // so this verifies routing/data, without pretending to be a browser visual test.
  const tree = test.context.renderPages();
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, tree));
  assert.deepEqual([...html.matchAll(/data-canvas-page="([^"]+)"/g)].map(match => match[1]), project.pages.map(page => page.id));
  assert.deepEqual([...html.matchAll(/data-test-drop-page="([^"]+)"/g)].map(match => match[1]), project.pages.map(page => page.id));
  assert.deepEqual([...html.matchAll(/data-test-block="([^"]+)"/g)].map(match => match[1]), project.pages.flatMap(page => page.blocks.map(block => block.id)), 'every block remains editable in the actual vertical canvas');
  const leaves = [];
  function walk(node) {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!React.isValidElement(node)) return;
    if (node.type === test.blockComponent) leaves.push(node);
    React.Children.forEach(node.props.children, walk);
  }
  walk(tree);
  const last = leaves.at(-1);
  last.props.onSelect();
  assert.equal(test.context.pageId, project.pages.at(-1).id);
  assert.equal(test.context.selectedId, last.props.block.id);
  assert.equal(test.context.viewContext.current.pageId, project.pages.at(-1).id, 'selection refs update before asynchronous media callbacks');
  assert.equal(test.calls.stage.length, 0, 'selecting an existing block never saves or changes history');
}

for (const operation of ['copy', 'move', 'delete']) {
  const test = harness();
  const page = test.initial.pages[1], target = page.blocks[1];
  if (operation === 'copy') test.context.copyBlock(target.id);
  if (operation === 'move') test.context.moveBlock(target.id, -1);
  if (operation === 'delete') test.context.deleteBlock(target.id);
  const result = test.context.historyRef.current.current.pages[1];
  if (operation === 'copy') {
    assert.equal(result.blocks.length, 4);
    assert.equal(result.blocks[2].title, target.title);
    assert.notEqual(result.blocks[2].id, target.id);
  }
  if (operation === 'move') assert.deepEqual(result.blocks.map(block => block.id), [target.id, page.blocks[0].id, page.blocks[2].id]);
  if (operation === 'delete') assert(!result.blocks.some(block => block.id === target.id));
  assertOnlyPage(test, page.id);
}
for (const active of [{ type: 'background', background: 'gradient' }, { type: 'palette', palette: 'ocean' }, { type: 'effect', effect: 'reveal' }, { type: 'library', kind: 'text' }]) {
  const test = harness();
  const page = test.initial.pages[1], target = page.blocks[1];
  drop(test, active, { type: 'block', pageId: page.id, blockId: target.id });
  const result = test.context.historyRef.current.current.pages[1];
  if (active.type === 'background') assert.equal(model.getBlockAppearance(result.blocks.find(block => block.id === target.id)).background, 'gradient');
  if (active.type === 'palette') assert.equal(model.getBlockAppearance(result.blocks.find(block => block.id === target.id)).backgroundColor, model.PALETTE_LIBRARY.find(item => item.id === 'ocean').appearance.backgroundColor);
  if (active.type === 'effect') assert(result.blocks.find(block => block.id === target.id).effects.includes('reveal'));
  if (active.type === 'library') assert.equal(result.blocks.length, page.blocks.length + 1);
  assert.equal(test.context.pageId, page.id);
  assertOnlyPage(test, page.id);
}
for (const active of [{ type: 'background', background: 'dots' }, { type: 'effect', effect: 'stars' }, { type: 'library', kind: 'hero' }]) {
  const test = harness();
  drop(test, active, { type: 'canvas', pageId: 'page-c' });
  assert.equal(test.context.historyRef.current.current.pages[2].blocks.length, 1, 'empty destination pages gain their own block');
  assertOnlyPage(test, 'page-c');
}
const pageBackground = harness();
drop(pageBackground, { type: 'background', background: 'gradient' }, { type: 'canvas', pageId: 'page-b' });
assert.equal(model.getBlockAppearance(pageBackground.context.historyRef.current.current.pages[1].blocks[0]).background, 'gradient', 'dropping onto another page uses a block on that page, not the selected block elsewhere');
assertOnlyPage(pageBackground, 'page-b');

const invalidDrop = harness();
for (const over of [{ type: 'block', pageId: 'deleted-page', blockId: 'missing' }, { type: 'block', pageId: 'page-b', blockId: 'missing' }]) {
  drop(invalidDrop, { type: 'background', background: 'gradient' }, over);
  assert.equal(invalidDrop.context.historyRef.current.current, invalidDrop.initial, 'stale drop targets cannot mutate the wrong page');
}
drop(invalidDrop, { type: 'block', pageId: invalidDrop.initial.pages[0].id, blockId: invalidDrop.initial.pages[0].blocks[0].id }, { type: 'block', pageId: 'page-b', blockId: invalidDrop.initial.pages[1].blocks[0].id });
assert.equal(invalidDrop.context.historyRef.current.current, invalidDrop.initial, 'unsupported cross-page block moves preserve the original site');
assert.equal(invalidDrop.calls.stage.length, 0);
assert(invalidDrop.calls.notices.at(-1), 'unsupported cross-page moves explain what the user can do');

const fullProject = fixture();
fullProject.pages[1].blocks = Array.from({ length: model.MAX_BLOCKS }, () => model.createBlock('text'));
const full = harness(fullProject);
full.context.copyBlock(full.initial.pages[1].blocks[0].id);
assert.equal(full.context.historyRef.current.current, full.initial, 'copy checks destination capacity even when another page is selected');
drop(full, { type: 'library', kind: 'hero' }, { type: 'canvas', pageId: 'page-b' });
assert.equal(full.context.historyRef.current.current, full.initial);
assert.equal(full.calls.stage.length, 0);
assert(full.context.error);
const reorder = harness();
const reorderPage = reorder.initial.pages[1];
drop(reorder, { type: 'block', pageId: reorderPage.id, blockId: reorderPage.blocks[2].id }, { type: 'block', pageId: reorderPage.id, blockId: reorderPage.blocks[0].id });
assert.equal(reorder.context.historyRef.current.current.pages[1].blocks[0].id, reorderPage.blocks[2].id);
assertOnlyPage(reorder, reorderPage.id);

const image = harness();
let finishImage;
image.context.compressImage = () => new Promise(resolve => { finishImage = resolve; });
const imageTarget = image.initial.pages[1].blocks[0];
image.context.selectCanvasBlock('page-b', imageTarget.id);
const imageUpload = image.context.uploadImage({ name: 'image.png' }, imageTarget.id, 'page-b', true);
image.context.selectCanvasBlock(image.initial.pages[0].id, image.initial.pages[0].blocks[0].id);
finishImage('data:image/png;base64,BBBB');
await imageUpload;
assert.equal(image.context.historyRef.current.current.pages[1].blocks[0].image, 'data:image/png;base64,BBBB', 'delayed image stays attached to the explicit destination page');
assert.equal(image.context.pageId, image.initial.pages[0].id, 'finishing media does not steal selection after switching pages');
assertOnlyPage(image, 'page-b');

const video = harness();
const videoTarget = video.initial.pages[1].blocks[1];
video.context.openVideoPicker(videoTarget.id, 'page-b');
assert.equal(video.context.videoTarget.pageId, 'page-b');
assert.equal(video.context.viewContext.current.pageId, 'page-b');
await video.context.uploadBackgroundVideo({ name: 'clip.mp4' }, videoTarget.id, 'page-b');
assert.equal(video.context.historyRef.current.current.pages[1].blocks[1].backgroundVideo.src, 'https://example.test/video.mp4');
assertOnlyPage(video, 'page-b');

const switchedVideo = harness();
let finishVideo;
switchedVideo.context.readBackgroundVideo = () => new Promise(resolve => { finishVideo = resolve; });
const switchedVideoTarget = switchedVideo.initial.pages[1].blocks[1];
switchedVideo.context.openVideoPicker(switchedVideoTarget.id, 'page-b');
assert.equal(switchedVideo.context.viewContext.current.pageId, 'page-b');
const pendingVideo = switchedVideo.context.uploadBackgroundVideo({ name: 'clip.mp4' }, switchedVideoTarget.id, 'page-b');
switchedVideo.context.selectCanvasBlock(switchedVideo.initial.pages[0].id, switchedVideo.initial.pages[0].blocks[0].id);
finishVideo({ src: 'https://example.test/cancelled.mp4', dim: 0.35 });
await pendingVideo;
assert.equal(switchedVideo.calls.stage.length, 0, 'switching pages while video reads cancels stale completion');
assert.equal(switchedVideo.context.historyRef.current.current, switchedVideo.initial);

const colorKeys = ['backgroundColor', 'secondaryColor', 'textColor', 'accentColor'];
const unifiedColors = { backgroundColor: '#fcfaf8', secondaryColor: '#e4e1de', textColor: '#172839', accentColor: '#654321' };
function unifiedFixture() {
  const project = fixture();
  project.pages[0].blocks[0].appearance.background = 'gradient';
  project.pages[0].blocks[0].effects = ['reveal', 'spotlight'];
  project.pages[1].blocks[0].appearance.background = 'video';
  project.pages[1].blocks[0].backgroundVideo = { src: 'https://example.test/existing.mp4', poster: 'https://example.test/poster.jpg', dim: .45, paused: true };
  project.pages[1].blocks.push({ ...model.createBlock('embed'), html: '<p>Keep imported HTML colors</p>' });
  return projectColors.applyProjectColorSettings(project, { unified: true, colors: unifiedColors });
}
function assertUnified(project, colors = unifiedColors) {
  assert.equal(project.colorSettings.unified, true);
  for (const key of colorKeys) assert.equal(project.colorSettings.colors[key], colors[key]);
  for (const block of project.pages.flatMap(page => page.blocks).filter(block => block.kind !== 'embed')) {
    for (const key of colorKeys) assert.equal(model.getBlockAppearance(block)[key], colors[key], `${block.kind} inherits ${key}`);
  }
}
function withoutColors(project) {
  const copy = structuredClone(project);
  delete copy.colorSettings;
  for (const block of copy.pages.flatMap(page => page.blocks).filter(block => block.kind !== 'embed')) {
    delete block.theme;
    for (const key of colorKeys) delete block.appearance[key];
  }
  return copy;
}
function assertWholeSiteUndo(test, after) {
  assert.equal(test.context.historyRef.current.past.length, 1);
  assert.equal(test.calls.stage.length, 1, 'the complete global update is staged once');
  assert.equal(test.calls.stage[0], JSON.stringify(after));
  test.context.undo();
  assert.equal(test.context.historyRef.current.current, test.initial);
  assert.equal(test.calls.stage.at(-1), JSON.stringify(test.initial));
  test.context.redo();
  assert.equal(test.context.historyRef.current.current, after);
  assert.equal(test.calls.stage.at(-1), JSON.stringify(after));
}

// Every creation path in the real vertical canvas must respect an enabled palette.
for (const operation of ['library', 'effect', 'background', 'image', 'video']) {
  const test = harness(unifiedFixture());
  if (operation === 'library') drop(test, { type: 'library', kind: 'hero' }, { type: 'canvas', pageId: 'page-c' });
  if (operation === 'effect') drop(test, { type: 'effect', effect: 'stars' }, { type: 'canvas', pageId: 'page-c' });
  if (operation === 'background') drop(test, { type: 'background', background: 'dots' }, { type: 'canvas', pageId: 'page-c' });
  if (operation === 'image') {
    test.context.selectCanvasBlock('page-c', '');
    await test.context.uploadImage({ name: 'new.png' }, '', 'page-c', true);
  }
  if (operation === 'video') {
    test.context.openVideoPicker('', 'page-c');
    await test.context.uploadBackgroundVideo({ name: 'new.mp4' }, '', 'page-c');
  }
  const after = test.context.historyRef.current.current;
  assert.equal(after.pages[2].blocks.length, 1, `${operation} creates one editable block in the destination`);
  assertUnified(after);
  assert.equal(test.context.pageId, 'page-c');
  if (operation === 'effect') assert(after.pages[2].blocks[0].effects.includes('stars'));
  if (operation === 'background') assert.equal(after.pages[2].blocks[0].appearance.background, 'dots');
  if (operation === 'image') assert.equal(after.pages[2].blocks[0].image, 'data:image/png;base64,AAAA');
  if (operation === 'video') {
    assert.equal(after.pages[2].blocks[0].appearance.background, 'video');
    assert.equal(after.pages[2].blocks[0].backgroundVideo.src, 'https://example.test/video.mp4');
    assert.equal(after.pages[2].blocks[0].appearance.backgroundColor, unifiedColors.backgroundColor, 'video creation respects an explicit light palette');
  }
  assertOnlyPage(test, 'page-c');
}
const copiedColors = harness(unifiedFixture());
const copiedTarget = copiedColors.initial.pages[1].blocks[0];
copiedColors.context.copyBlock(copiedTarget.id);
const copiedResult = copiedColors.context.historyRef.current.current;
assertUnified(copiedResult);
const actualCopy = copiedResult.pages[1].blocks[1];
assert.notEqual(actualCopy.id, copiedTarget.id);
assert.deepEqual(actualCopy.backgroundVideo, copiedTarget.backgroundVideo);
assert.equal(actualCopy.image, copiedTarget.image);
assertOnlyPage(copiedColors, 'page-b');

for (const patch of [{ accentColor: '#247658' }, { backgroundColor: '#203142', textColor: '#f4f5f6' }]) {
  const test = harness(unifiedFixture());
  const target = test.initial.pages[1].blocks[1];
  test.context.selectCanvasBlock('page-b', target.id);
  test.refresh();
  test.context.updateAppearance(patch);
  const after = test.context.historyRef.current.current;
  assertUnified(after, { ...unifiedColors, ...patch });
  assert.deepEqual(withoutColors(after), withoutColors(test.initial), 'right-side color changes preserve authored content, media, background types and effects everywhere');
  assertWholeSiteUndo(test, after);
}
const localBackground = harness(unifiedFixture());
const backgroundTarget = localBackground.initial.pages[1].blocks[1];
localBackground.context.selectCanvasBlock('page-b', backgroundTarget.id);
localBackground.refresh();
localBackground.context.updateAppearance({ background: 'dots' });
assertUnified(localBackground.context.historyRef.current.current);
assert.equal(localBackground.context.historyRef.current.current.pages[1].blocks[1].appearance.background, 'dots');
assertOnlyPage(localBackground, 'page-b');

const pageAppearance = harness(unifiedFixture());
pageAppearance.context.applyPageAppearance();
const appliedPageAppearance = pageAppearance.context.historyRef.current.current;
assertUnified(appliedPageAppearance);
assert(appliedPageAppearance.pages[0].blocks.every(block => block.appearance.background === 'gradient'), 'applying to the page copies the selected background to that page only');
assert.deepEqual(appliedPageAppearance.pages.slice(1), pageAppearance.initial.pages.slice(1), 'other pages keep their own background types, media and content');
assertWholeSiteUndo(pageAppearance, appliedPageAppearance);

for (const destination of [
  { type: 'block', pageId: 'page-b' },
  { type: 'canvas', pageId: 'page-c' },
]) {
  const test = harness(unifiedFixture());
  if (destination.type === 'block') destination.blockId = test.initial.pages[1].blocks[1].id;
  drop(test, { type: 'palette', palette: 'ocean' }, destination);
  const after = test.context.historyRef.current.current;
  const expected = model.PALETTE_LIBRARY.find(palette => palette.id === 'ocean').appearance;
  assertUnified(after, expected);
  if (destination.type === 'canvas') assert.equal(after.pages[2].blocks.length, 1, 'a palette dropped on an empty page creates its block and updates all colors in one action');
  for (const original of test.initial.pages) for (const block of original.blocks) {
    const current = after.pages.find(page => page.id === original.id).blocks.find(item => item.id === block.id);
    if (block.kind === 'embed') assert.equal(current, block);
    else {
      assert.equal(current.appearance.background, block.appearance.background, 'a palette never replaces an existing background kind');
      assert.deepEqual(current.backgroundVideo, block.backgroundVideo);
      assert.deepEqual(current.effects, block.effects);
      assert.equal(current.title, block.title);
      assert.deepEqual(current.link, block.link);
    }
  }
  assertWholeSiteUndo(test, after);
}

const localColor = harness();
localColor.context.selectCanvasBlock('page-b', localColor.initial.pages[1].blocks[1].id);
localColor.refresh();
localColor.context.updateAppearance({ accentColor: '#347856' });
assert.equal(localColor.context.historyRef.current.current.pages[1].blocks[1].appearance.accentColor, '#347856');
assert.equal(localColor.context.historyRef.current.current.pages[1].blocks[0], localColor.initial.pages[1].blocks[0], 'with unified mode off, editing one block does not recolor its neighbors');
assert.equal(localColor.context.historyRef.current.current.colorSettings, undefined);
assertOnlyPage(localColor, 'page-b');
const rejectedPalette = harness(unifiedFixture());
rejectedPalette.context.JSON_LIMIT = 1;
drop(rejectedPalette, { type: 'palette', palette: 'ocean' }, { type: 'canvas', pageId: 'page-c' });
assert.equal(rejectedPalette.context.historyRef.current.current, rejectedPalette.initial, 'rejected global palette changes cannot leave a newly created block or partial colors behind');
assert.equal(rejectedPalette.calls.stage.length, 0);

console.log('PASS vertical canvas: all 1–10 pages editable together, inactive-page actions/drops, async media routing, unified color inheritance and global inspector/palette edits, local off-mode edits, exact undo/redo, and guards.');
