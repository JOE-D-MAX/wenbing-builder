import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDraftPersistence } from '../lib/draft-persistence.ts';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const candidate = new URL(specifier, context.parentURL);
    if (!/\.[cm]?[jt]s$/.test(specifier) && existsSync(fileURLToPath(candidate) + '.ts')) {
      return { url: pathToFileURL(fileURLToPath(candidate) + '.ts').href, shortCircuit: true };
    }
  }
  return next(specifier, context);
} });
const { randomizePageStyle } = await import('../lib/random-block-style.ts');
const { randomizeSite } = await import('../lib/random-site.ts');
const { MAX_BLOCKS, MAX_PAGES, PALETTE_LIBRARY, createBlock, createStarterProject } = await import('../lib/block-model.ts');
const { getProjectColorSettings, applyProjectColorSettings } = await import('../lib/project-colors.ts');

// Execute the real component handlers and disabled condition, without a browser or React copy.
const source = readFileSync(new URL('../components/studio/block-studio.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('block-studio.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
const stateDefaults = new Map();
let disabledExpression;
let scopeChange;
let pageCountChange;
let pageCountInput;
let pageCountInvalid;
let pageChange;
let pageTotalExpression;
let canvasPageMap;
let editViewChange;
let previewViewChange;
let colorControlProps;
const scopeValues = [];
function attribute(node, name) {
  return node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.text === name)?.initializer;
}
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'project.pages.map' && node.getText(ast).includes('data-canvas-page')) canvasPageMap = node;
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, node.initializer);
  if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name)
    && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === 'useState') {
    stateDefaults.set(node.name.elements[0].name.getText(ast), node.initializer.arguments[0]);
  }
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    if (node.tagName.getText(ast) === 'ProjectColorControls') colorControlProps = node;
    if (node.tagName.getText(ast) === 'button' && attribute(node, 'onClick')?.expression?.getText(ast) === 'applyRandomStyle') {
      disabledExpression = attribute(node, 'disabled')?.expression;
    }
    if (node.tagName.getText(ast) === 'button') {
      const pressed = attribute(node, 'aria-pressed')?.expression?.getText(ast);
      if (pressed === "view === 'edit'") editViewChange = attribute(node, 'onClick')?.expression;
      if (pressed === "view === 'preview'") previewViewChange = attribute(node, 'onClick')?.expression;
    }
    if (node.tagName.getText(ast) === 'select' && attribute(node, 'id')?.text === 'random-style-scope') {
      scopeChange = attribute(node, 'onChange')?.expression;
      for (const child of node.parent.children.filter(ts.isJsxElement)) scopeValues.push(attribute(child.openingElement, 'value')?.text);
    }
    if (node.tagName.getText(ast) === 'input' && attribute(node, 'id')?.text === 'random-site-page-count') {
      pageCountInput = node;
      pageCountChange = attribute(node, 'onChange')?.expression;
      pageCountInvalid = attribute(node, 'aria-invalid')?.expression;
    }
    if (node.tagName.getText(ast) === 'select' && attribute(node, 'value')?.expression?.getText(ast) === 'currentPage.id') {
      pageChange = attribute(node, 'onChange')?.expression;
    }
    if (attribute(node, 'className')?.text === 'bs-page-total') {
      assert.equal(attribute(node, 'aria-live')?.text, 'polite');
      pageTotalExpression = node.parent.children.find(ts.isJsxExpression)?.expression;
    }
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert(disabledExpression, 'the actual randomize button must expose its disabled condition');
assert(scopeChange, 'the actual scope selector must be wired');
assert(pageCountChange, 'the actual site page count input must be wired');
assert(pageCountInvalid, 'invalid page counts must be exposed accessibly');
assert(pageChange, 'all generated pages must be reachable through the editor page menu');
assert(pageTotalExpression, 'the page menu must display the actual project page total');
assert(editViewChange && previewViewChange, 'the combination workspace retains edit and preview modes');
assert(colorControlProps, 'the actual workspace exposes project color controls');
assert.equal(attribute(colorControlProps, 'onToggle')?.expression?.getText(ast), 'toggleUnifiedColors');
assert.equal(attribute(colorControlProps, 'onColorChange')?.expression?.getText(ast), 'changeUnifiedColor');
assert.equal(attribute(colorControlProps, 'onPreset')?.expression?.getText(ast), 'applyUnifiedPalette');
assert(canvasPageMap, 'the actual editable canvas renders every project page');
assert(canvasPageMap.getText(ast).includes('<CanvasDrop') && canvasPageMap.getText(ast).includes('<SortableBlock'), 'each page contains real drop targets and editable sortable blocks');
let canvasAncestor = canvasPageMap.parent;
while (canvasAncestor && !(ts.isJsxElement(canvasAncestor) && attribute(canvasAncestor.openingElement, 'className')?.text === 'bs-center')) canvasAncestor = canvasAncestor.parent;
assert(canvasAncestor, 'all page canvases live inside the original combination workspace');
assert(!source.includes('SiteOverview') && !source.includes('bs-overview-mode') && !source.includes('bs-configured-pages'), 'there is no additional gallery, miniature-card stage, or full-width overview mode');
assert.deepEqual(scopeValues, ['site', 'page', 'block']);
assert.equal(attribute(pageCountInput, 'type')?.text, 'number');
assert.equal(attribute(pageCountInput, 'min')?.text ?? attribute(pageCountInput, 'min')?.expression?.getText(ast), '1');
assert.equal(attribute(pageCountInput, 'max')?.text ?? attribute(pageCountInput, 'max')?.expression?.getText(ast), 'MAX_PAGES');
assert.equal(attribute(pageCountInput, 'step')?.text ?? attribute(pageCountInput, 'step')?.expression?.getText(ast), '1');
assert(pageCountInput.attributes.properties.some(item => ts.isJsxAttribute(item) && item.name.text === 'required'));
assert.equal(MAX_PAGES, 10, 'the project model must accept all counts offered by the input');
assert.equal(stateDefaults.get('randomScope')?.text, 'site', 'one click must configure the whole site by default');
assert.equal(stateDefaults.get('randomPageCount')?.text, '7', 'the numeric input starts at seven pages');
assert.equal(stateDefaults.get('view')?.text, 'edit', 'the combination workspace opens with all editable page canvases');
const compiled = new Map();
for (const name of ['commit', 'revealWorkspaceRegion', 'toggleUnifiedColors', 'changeUnifiedColor', 'applyUnifiedPalette', 'applyRandomStyle', 'selectCanvasPage', 'selectCanvasBlock', 'undo', 'redo']) {
  const node = declarations.get(name);
  assert(node, `Missing actual handler: ${name}`);
  compiled.set(name, ts.transpileModule(`globalThis.${name} = ${node.getText(ast)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText);
}
compiled.set('isDisabled', ts.transpileModule(`globalThis.isDisabled = () => (${disabledExpression.getText(ast)}); globalThis.isPageCountInvalid = () => (${pageCountInvalid.getText(ast)}); globalThis.renderPageTotal = () => (${pageTotalExpression.getText(ast)}); globalThis.changeScope = ${scopeChange.getText(ast)}; globalThis.changePageCount = ${pageCountChange.getText(ast)}; globalThis.changePage = ${pageChange.getText(ast)}; globalThis.openEditView = ${editViewChange.getText(ast)}; globalThis.openPreviewView = ${previewViewChange.getText(ast)}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText);
compiled.set('getColorControlProps', ts.transpileModule(`globalThis.getColorControlProps = () => ({${['settings', 'disabled', 'onToggle', 'onColorChange', 'onPreset'].map(name => `${name}: ${attribute(colorControlProps, name).expression.getText(ast)}`).join(',')}})`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText);

// Render the real pure controls and call their actual event props against the handlers above.
const require = createRequire(import.meta.url);
const controlSource = readFileSync(new URL('../components/studio/project-color-controls.tsx', import.meta.url), 'utf8');
const controlModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(controlSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, {
  exports: controlModule.exports,
  module: controlModule,
  require(id) {
    if (id === '@/lib/block-model') return { PALETTE_LIBRARY };
    if (id === './studio-i18n') return { useStudioI18n: () => ({ t: (key, values = {}) => key.replace(/\{\{(\w+)\}\}/g, (_, name) => values[name] ?? '') }) };
    return require(id);
  },
});
function controls(test) {
  test.refresh();
  const tree = controlModule.exports.ProjectColorControls(test.context.getColorControlProps());
  const elements = [];
  function collect(node) {
    React.Children.forEach(node, child => {
      if (!React.isValidElement(child)) return;
      elements.push(child);
      collect(child.props.children);
    });
  }
  collect(tree);
  return {
    html: renderToStaticMarkup(tree),
    toggle: elements.find(node => node.props.role === 'switch'),
    fieldset: elements.find(node => node.type === 'fieldset'),
    inputs: elements.filter(node => node.type === 'input' && node.props.type === 'color'),
    presets: elements.filter(node => node.type === 'button' && node.props['aria-pressed'] !== undefined),
  };
}

function fixture(pageCount = 2) {
  const project = createStarterProject();
  project.pages[0].blocks = [
    { ...createBlock('hero'), title: 'Authored title', text: 'Keep this content', button: 'Explore', link: { type: 'url', target: 'https://example.test/work' } },
    { ...createBlock('project'), title: 'My work', image: 'https://example.test/work.jpg' },
    { ...createBlock('embed'), html: '<html><body>Imported page</body></html>' },
  ];
  project.pages.push({ id: 'other-page', title: 'Other page', blocks: [createBlock('text')] });
  while (project.pages.length < pageCount) {
    const index = project.pages.length;
    project.pages.push({ id: `authored-page-${index}`, title: `Authored page ${index + 1}`, blocks: [{ ...createBlock('text'), title: `Original heading ${index + 1}`, text: `Keep this page ${index + 1}` }] });
  }
  return project;
}

function harness(project = fixture(), { scope = 'page', count = '7', locale = 'zh', random = () => 0, pageIndex = 0 } = {}) {
  const initial = structuredClone(project);
  const initialRaw = JSON.stringify(initial);
  const storage = { raw: initialRaw, writes: 0, getItem() { return this.raw; }, setItem(key, raw) { this.raw = raw; this.writes++; } };
  const controller = createDraftPersistence(storage, 'project', initialRaw);
  const calls = { model: 0, siteModel: 0, colorModel: 0, siteOptions: [], stage: [], history: [], notices: [], regions: [], focused: [], scrolled: [] };
  const context = vm.createContext({
    Blob, JSON, Date: { now: () => 1000 }, JSON_LIMIT: 3 * 1024 * 1024, MAX_PAGES,
    t: (key, values) => key.replace('{{count}}', String(values?.count)),
    previewMotion: { reduced: false },
    requestAnimationFrame(callback) { callback(); return 1; },
    document: { getElementById(id) {
      calls.regions.push(id);
      return { focus(options) { calls.focused.push({ id, ...options }); }, scrollIntoView(options) { calls.scrolled.push({ id, ...options }); } };
    } },
    historyRef: { current: { past: [], current: initial, future: [] } },
    viewContext: { current: { pageId: initial.pages[pageIndex].id, selectedId: initial.pages[pageIndex].blocks[0]?.id || '' } },
    mergeRef: { current: { key: '', time: 0 } },
    persistence: { current: { stage(raw) { calls.stage.push(raw); controller.stage(raw); } } },
    randomizePageStyle(page, options) { calls.model++; return randomizePageStyle(page, { ...options, random: () => 0 }); },
    randomizeSite(project, options) { calls.siteModel++; calls.siteOptions.push(options); return randomizeSite(project, { ...options, random }); },
    PALETTE_LIBRARY, getProjectColorSettings,
    applyProjectColorSettings(project, settings) { calls.colorModel++; return applyProjectColorSettings(project, settings, { random: () => 0 }); },
    useCallback: fn => fn, imageRequest: { current: 0 }, videoRequest: { current: 0 },
    imageBusy: false, videoBusy: false, randomScope: stateDefaults.get('randomScope').text,
    randomPageCount: stateDefaults.get('randomPageCount').text, locale, pageId: initial.pages[pageIndex].id,
    effectDemos: { old: 'demo' }, zoomTarget: 'old', videoTarget: 'old', view: 'preview', mobilePanel: 'inspector',
    setHistory(value) { calls.history.push(value); },
    setError(value) { context.error = value; },
    setNotice(value) { calls.notices.push(value); },
    ...Object.fromEntries(['ImageBusy', 'VideoBusy', 'ZoomTarget', 'VideoTarget', 'SelectedId', 'View', 'MobilePanel', 'EffectDemos', 'RandomScope', 'RandomPageCount', 'PageId'].map(name => [
      `set${name}`, value => { context[name[0].toLowerCase() + name.slice(1)] = value; },
    ])),
  });
  for (const code of compiled.values()) vm.runInContext(code, context);
  context.changeScope({ target: { value: scope } });
  context.changePageCount({ target: { value: count } });
  function refresh() {
    context.project = context.historyRef.current.current;
    context.currentPage = context.project.pages.find(page => page.id === context.pageId) || context.project.pages[0];
    context.selected = context.currentPage.blocks.find(block => block.id === context.selectedId);
  }
  context.selectedId = initial.pages[pageIndex].blocks[0]?.id || '';
  refresh();
  return { context, calls, controller, storage, initial, initialRaw, refresh };
}

function authoredFields(block) {
  const { appearance, theme, effects, ...authored } = block;
  return authored;
}

// A single UI action generates all pages, stages one complete draft, and creates one undo entry.
for (let expected = 1; expected <= 10; expected++) {
  const count = String(expected);
  const site = harness(fixture(5), { scope: 'site', count, pageIndex: 4 });
  const before = site.context.historyRef.current.current;
  const currentPageId = site.context.currentPage.id;
  const selectedId = site.context.selectedId;
  assert.equal(site.context.randomScope, 'site');
  assert.equal(site.context.randomPageCount, count);
  assert.equal(site.context.renderPageTotal(), '共 5 页', 'editing the requested count cannot claim that pages already changed');
  assert.equal(site.context.isPageCountInvalid(), false);
  assert.equal(site.context.isDisabled(), false);
  site.context.applyRandomStyle();
  const after = site.context.historyRef.current.current;
  site.refresh();
  assert.equal(after.pages.length, expected, `UI page count ${count} reaches the real model`);
  assert.equal(site.context.renderPageTotal(), `共 ${expected} 页`, 'the visible total follows the generated project');
  assert.equal(site.calls.siteModel, 1);
  assert.equal(site.calls.model, 0, 'whole-site scope must not silently fall back to current-page styling');
  assert.equal(site.calls.siteOptions[0].pageCount, expected);
  assert.equal(site.calls.siteOptions[0].locale, 'zh');
  assert.equal(site.calls.history.length, 1, 'all generated pages are committed in one action');
  assert.equal(site.context.historyRef.current.past.length, 1);
  assert.equal(site.context.historyRef.current.past[0], before);
  for (const oldPage of before.pages.slice(0, expected)) {
    const keptPage = after.pages.find(page => page.id === oldPage.id);
    assert(keptPage, 'retained authored pages keep their IDs');
    assert.equal(keptPage.title, oldPage.title);
    for (const oldBlock of oldPage.blocks) {
      assert.deepEqual(authoredFields(keptPage.blocks.find(block => block.id === oldBlock.id)), authoredFields(oldBlock));
    }
  }
  if (after.pages.some(page => page.id === currentPageId)) {
    assert.equal(site.context.pageId, currentPageId, 'an active page that remains in the site stays selected');
    assert.equal(site.context.selectedId, selectedId, 'the retained editable selection remains active');
  } else {
    assert.equal(site.context.pageId, after.pages[0].id, 'removing the active page selects the first retained page');
    assert(after.pages[0].blocks.some(block => block.id === site.context.selectedId && block.kind !== 'embed'), 'the selected block must belong to the surviving page');
  }
  assert.equal(site.context.view, 'edit', 'whole-site generation stays in the combination workspace while all page previews update');
  assert.equal(site.calls.regions.at(-1), 'bs-page-editor', 'generation reveals all vertical editable pages in the existing canvas');
  assert.equal(site.context.mobilePanel, 'canvas');
  assert.equal(JSON.stringify(site.context.effectDemos), '{}');
  assert.equal(site.context.zoomTarget, null);
  assert.equal(site.context.videoTarget, null);
  assert.equal(site.calls.notices.at(-1).values.count, expected);
  assert.equal(site.calls.notices.at(-1).values.added, Math.max(0, expected - before.pages.length));
  assert.equal(site.calls.notices.at(-1).values.removed, Math.max(0, before.pages.length - expected));
  assert.equal(site.calls.stage.length, 1);
  assert.equal(site.calls.stage[0], JSON.stringify(after));
  assert.equal(site.controller.save(), 'saved');
  assert.equal(site.storage.raw, JSON.stringify(after));
  site.context.undo();
  assert.equal(site.context.historyRef.current.current, before);
  assert.equal(JSON.stringify(site.context.historyRef.current.current), site.initialRaw, 'one undo restores every original page');
  assert.equal(site.controller.save(), 'saved');
  assert.equal(site.storage.raw, site.initialRaw);
  site.context.redo();
  assert.equal(site.context.historyRef.current.current, after);
  assert.equal(site.controller.save(), 'saved');
  assert.equal(site.storage.raw, JSON.stringify(after));

  // The next click must also match a smaller requested count exactly, with one-step recovery.
  site.refresh();
  site.context.changePageCount({ target: { value: '1' } });
  const ids = after.pages.map(page => page.id);
  site.context.applyRandomStyle();
  const next = site.context.historyRef.current.current;
  assert.equal(next.pages.length, 1);
  assert.deepEqual(next.pages.map(page => page.id), ids.slice(0, 1));
  assert.equal(site.calls.notices.at(-1).values.count, 1);
  assert.equal(site.calls.notices.at(-1).values.removed, expected - 1);
  assert.equal(site.context.historyRef.current.past.length, 2, 'repeated clicks remain separately undoable');
  assert.notEqual(JSON.stringify(next), JSON.stringify(after), 'a repeat click still refreshes the visual configuration');
  site.context.undo();
  assert.equal(site.context.historyRef.current.current, after);
}

for (const [fromCount, targetCount] of [[8, 7], [8, 1], [10, 3]]) {
  const sourceProject = fixture(fromCount);
  const removedPage = sourceProject.pages.at(-1);
  sourceProject.pages[0].blocks[0].link = { type: 'page', target: removedPage.id };
  sourceProject.pages[0].blocks[1].link = { type: 'section', target: removedPage.blocks[0].id };
  sourceProject.pages[0].blocks[1].button = 'See original section';
  const shrink = harness(sourceProject, { scope: 'site', count: String(targetCount), pageIndex: fromCount - 1 });
  const before = shrink.context.historyRef.current.current;
  shrink.context.applyRandomStyle();
  const after = shrink.context.historyRef.current.current;
  shrink.refresh();
  assert.equal(after.pages.length, targetCount, `${fromCount} to ${targetCount} applies the exact requested total`);
  assert.equal(shrink.context.renderPageTotal(), `共 ${targetCount} 页`);
  assert.equal(shrink.context.pageId, after.pages[0].id);
  assert(after.pages[0].blocks.some(block => block.id === shrink.context.selectedId));
  assert.equal(shrink.calls.history.length, 1);
  assert.equal(shrink.calls.notices.at(-1).values.added, 0);
  assert.equal(shrink.calls.notices.at(-1).values.removed, fromCount - targetCount);
  const pageIds = new Set(after.pages.map(page => page.id));
  const blockIds = new Set(after.pages.flatMap(page => page.blocks.map(block => block.id)));
  for (const block of after.pages.flatMap(page => page.blocks)) {
    if (block.link.type === 'page') assert(pageIds.has(block.link.target), 'shrinking leaves no page links pointing at removed pages');
    if (block.link.type === 'section') assert(blockIds.has(block.link.target), 'shrinking leaves no section links pointing at removed blocks');
  }
  assert.equal(shrink.controller.save(), 'saved');
  assert.equal(JSON.parse(shrink.storage.raw).pages.length, targetCount);
  shrink.context.undo();
  shrink.refresh();
  assert.equal(shrink.context.historyRef.current.current, before);
  assert.equal(shrink.context.renderPageTotal(), `共 ${fromCount} 页`, 'undo restores the displayed page total');
  assert.equal(JSON.stringify(shrink.context.historyRef.current.current), shrink.initialRaw, 'one undo restores removed pages and their original link targets exactly');
  assert.equal(shrink.controller.save(), 'saved');
  assert.equal(shrink.storage.raw, shrink.initialRaw);
  shrink.context.redo();
  shrink.refresh();
  assert.equal(shrink.context.historyRef.current.current, after);
  assert.equal(shrink.context.renderPageTotal(), `共 ${targetCount} 页`, 'redo restores the displayed reduced total');
  assert.equal(shrink.controller.save(), 'saved');
  assert.equal(shrink.storage.raw, JSON.stringify(after), 'redo saves the exact reduced site and repaired links');
}

const importedOnly = createStarterProject();
importedOnly.pages[0].blocks = Array.from({ length: MAX_BLOCKS }, () => ({ ...createBlock('embed'), html: '<p>Preserved import</p>' }));
importedOnly.pages.push({ id: 'imported-page-to-remove', title: 'Remove this page', blocks: [createBlock('embed')] });
const importedShrink = harness(importedOnly, { scope: 'site', count: '1', pageIndex: 1 });
importedShrink.context.applyRandomStyle();
assert.equal(importedShrink.context.historyRef.current.current.pages.length, 1, 'count-only removal works even when no retained block can be restyled');
assert.equal(importedShrink.context.selectedId, '', 'an imported-only remaining page has no stale editable selection');
assert.equal(importedShrink.calls.history.length, 1);
assert.equal(importedShrink.calls.notices.at(-1).values.removed, 1);
importedShrink.context.undo();
assert.equal(JSON.stringify(importedShrink.context.historyRef.current.current), importedShrink.initialRaw);

const emptySite = harness(createStarterProject(), { scope: 'site', count: '10', locale: 'en' });
emptySite.context.applyRandomStyle();
const generated = emptySite.context.historyRef.current.current;
assert.equal(generated.pages.length, 10);
assert.equal(emptySite.calls.siteOptions[0].locale, 'en', 'the selected interface language reaches the page generator');
assert(generated.pages.every(page => page.blocks.length > 1), 'a complete site contains useful editable page layouts');
assert(generated.pages[0].blocks.some(block => block.id === emptySite.context.selectedId), 'an empty starting page gains an editable selection');
const overviewSnapshot = emptySite.context.historyRef.current;
const overviewStages = emptySite.calls.stage.length;
for (const generatedPage of generated.pages) {
  emptySite.context.view = 'edit';
  emptySite.context.mobilePanel = 'inspector';
  emptySite.context.zoomTarget = 'old';
  emptySite.context.videoTarget = 'old';
  emptySite.context.mergeRef.current.key = 'previous-page-edit';
  const previousPageId = emptySite.context.viewContext.current.pageId;
  emptySite.context.selectCanvasPage(generatedPage.id);
  emptySite.refresh();
  assert.equal(emptySite.context.currentPage, generatedPage, 'each page menu entry focuses its own editable section');
  assert.equal(emptySite.context.selectedId, '', 'opening a page clears the previous block selection');
  assert.equal(emptySite.context.view, 'edit');
  assert.equal(emptySite.context.mobilePanel, 'canvas');
  assert.equal(emptySite.calls.regions.at(-1), `canvas-page-${generatedPage.id}`, 'page selection focuses its own editable section');
  assert.deepEqual(emptySite.calls.focused.at(-1), { id: `canvas-page-${generatedPage.id}`, preventScroll: true });
  assert.deepEqual(emptySite.calls.scrolled.at(-1), { id: `canvas-page-${generatedPage.id}`, behavior: 'smooth', block: 'start' });
  assert.equal(emptySite.context.zoomTarget, null);
  assert.equal(emptySite.context.videoTarget, null);
  if (previousPageId !== generatedPage.id) assert.equal(emptySite.context.mergeRef.current.key, '', 'editing the new page must not merge with another page');
  assert.equal(emptySite.context.historyRef.current, overviewSnapshot, 'opening an overview card changes view state only');
  assert.equal(emptySite.calls.stage.length, overviewStages, 'browsing page previews must not rewrite drafts');
}
const selectedBeforeInvalidCard = emptySite.context.pageId;
const revealsBeforeInvalidCard = emptySite.calls.regions.length;
emptySite.context.view = 'preview';
emptySite.context.selectCanvasPage('removed-page');
assert.equal(emptySite.context.pageId, selectedBeforeInvalidCard, 'stale cards cannot select a deleted page');
assert.equal(emptySite.context.view, 'preview');
assert.equal(emptySite.context.historyRef.current, overviewSnapshot);
assert.equal(emptySite.calls.regions.length, revealsBeforeInvalidCard, 'a stale card cannot move focus or scroll the workspace');
emptySite.context.previewMotion.reduced = true;
emptySite.context.selectCanvasPage(generated.pages[0].id);
emptySite.refresh();
assert.equal(emptySite.calls.scrolled.at(-1).behavior, 'instant', 'card navigation honors reduced-motion preference');
emptySite.context.openEditView();
assert.equal(emptySite.context.view, 'edit');
assert.equal(emptySite.calls.regions.at(-1), `canvas-page-${emptySite.context.currentPage.id}`);
emptySite.context.openPreviewView();
assert.equal(emptySite.context.view, 'preview');
assert.equal(emptySite.calls.regions.at(-1), 'bs-page-editor');
assert.equal(emptySite.context.historyRef.current, overviewSnapshot);
assert.equal(emptySite.calls.stage.length, overviewStages);
for (const generatedPage of generated.pages) {
  emptySite.context.changePage({ target: { value: generatedPage.id } });
  emptySite.refresh();
  assert.equal(emptySite.context.currentPage, generatedPage, 'the page menu can select each independently editable generated page');
  assert.equal(emptySite.context.selectedId, '', 'switching pages clears stale block selection');
  assert.equal(emptySite.context.view, 'preview', 'the page menu preserves the interactive preview mode');
  assert.equal(emptySite.calls.regions.at(-1), 'bs-page-editor');
}
assert.equal(emptySite.calls.history.length, 1, 'switching pages does not add undo entries to whole-site generation');
emptySite.context.undo();
assert.equal(JSON.stringify(emptySite.context.historyRef.current.current), emptySite.initialRaw);
assert.equal(emptySite.controller.hasPending(), false, 'undo before autosave does not save a partial generated site');

const page = harness();
const pageBefore = page.context.historyRef.current.current;
assert.equal(page.context.isDisabled(), false);
page.context.applyRandomStyle();
const pageAfter = page.context.historyRef.current.current;
assert.equal(page.calls.model, 1);
assert.equal(page.calls.history.length, 1, 'one click commits exactly once');
assert.equal(page.context.historyRef.current.past.length, 1);
assert.equal(page.context.historyRef.current.past[0], pageBefore, 'history keeps the exact original snapshot');
assert.notEqual(pageAfter.pages[0].blocks[0], pageBefore.pages[0].blocks[0]);
assert.notEqual(pageAfter.pages[0].blocks[1], pageBefore.pages[0].blocks[1]);
assert.equal(pageAfter.pages[0].blocks[2], pageBefore.pages[0].blocks[2], 'embedded HTML is untouched');
assert.equal(pageAfter.pages[1], pageBefore.pages[1], 'another page is not changed or cloned');
assert.equal(pageAfter.pages[0].blocks[0].text, 'Keep this content');
assert.equal(page.calls.notices.at(-1).values.count, 2);
assert.equal(page.context.view, 'edit');
assert.equal(page.context.mobilePanel, 'canvas', 'the changed page is immediately visible on mobile');
assert.equal(JSON.stringify(page.context.effectDemos), '{}');
assert.equal(page.context.zoomTarget, null);
assert.equal(page.context.videoTarget, null);
assert.equal(page.context.selectedId, pageBefore.pages[0].blocks[0].id, 'existing native selection is preserved');
assert.equal(page.calls.stage.length, 1);
assert.equal(page.calls.stage[0], JSON.stringify(pageAfter));
assert(page.controller.hasPending());
assert.equal(page.controller.save(), 'saved');
assert.equal(page.storage.raw, JSON.stringify(pageAfter));

page.context.undo();
assert.equal(page.context.historyRef.current.current, pageBefore);
assert.equal(JSON.stringify(page.context.historyRef.current.current), page.initialRaw, 'undo restores all content and style exactly');
assert.equal(page.controller.save(), 'saved');
assert.equal(page.storage.raw, page.initialRaw, 'undo stages the restored draft');
page.context.redo();
assert.equal(page.context.historyRef.current.current, pageAfter);
assert.equal(page.controller.save(), 'saved');
assert.equal(page.storage.raw, JSON.stringify(pageAfter), 'redo stages exactly the generated result');

// Even two clicks within the typing-merge window must be independently undoable.
page.context.applyRandomStyle();
const secondAfter = page.context.historyRef.current.current;
assert.equal(page.context.historyRef.current.past.length, 2);
assert.notEqual(JSON.stringify(secondAfter), JSON.stringify(pageAfter));
page.context.undo();
assert.equal(page.context.historyRef.current.current, pageAfter);
page.context.undo();
assert.equal(page.context.historyRef.current.current, pageBefore);

const block = harness();
block.context.selectedId = block.initial.pages[0].blocks[1].id;
block.refresh();
block.context.changeScope({ target: { value: 'block' } });
assert.equal(block.context.randomScope, 'block');
block.context.applyRandomStyle();
const selectedAfter = block.context.historyRef.current.current;
assert.equal(selectedAfter.pages[0].blocks[0], block.initial.pages[0].blocks[0]);
assert.notEqual(selectedAfter.pages[0].blocks[1], block.initial.pages[0].blocks[1]);
assert.equal(selectedAfter.pages[0].blocks[2], block.initial.pages[0].blocks[2]);
assert.equal(selectedAfter.pages[1], block.initial.pages[1]);
assert.equal(block.calls.notices.at(-1).values.count, 1);
assert.equal(block.calls.history.length, 1);
block.context.changeScope({ target: { value: 'page' } });
assert.equal(block.context.randomScope, 'page');

// Current-page and selected-block randomization obey the same site position policy.
// The harness RNG always returns zero, so eligible spotlight is guaranteed here.
for (const scope of ['page', 'block']) {
  for (const pageIndex of [0, 2, 4]) {
    const original = fixture(5);
    original.pages[pageIndex].blocks.push(createBlock('nav'));
    for (const target of original.pages[pageIndex].blocks) if (target.kind !== 'embed') target.effects = ['spotlight'];
    const test = harness(original, { scope, pageIndex });
    const before = test.context.historyRef.current.current;
    const selectedId = test.context.selectedId;
    test.context.applyRandomStyle();
    const after = test.context.historyRef.current.current;
    const page = after.pages[pageIndex];
    const affected = page.blocks.filter(target => target.kind !== 'embed' && (scope === 'page' || target.id === selectedId));
    assert(affected.length > 0);
    assert(affected.every(target => target.effects.includes('spotlight') === (pageIndex !== 2)), `${scope} randomization limits spotlight to first/last pages`);
    for (const target of affected) assert.deepEqual(authoredFields(target), authoredFields(before.pages[pageIndex].blocks.find(old => old.id === target.id)));
    if (scope === 'block') {
      assert.equal(page.blocks.at(-1), before.pages[pageIndex].blocks.at(-1), 'unselected manually configured blocks are untouched');
    }
    assert.equal(test.calls.history.length, 1);
    assert.equal(test.calls.stage.length, 1);
    test.context.undo();
    assert.equal(JSON.stringify(test.context.historyRef.current.current), test.initialRaw, 'undo restores the previous effects and content exactly');
  }
}
const emptyMiddleProject = fixture(5);
emptyMiddleProject.pages[2].blocks = [];
const emptyMiddle = harness(emptyMiddleProject, { scope: 'page', pageIndex: 2 });
emptyMiddle.context.applyRandomStyle();
assert.equal(emptyMiddle.context.historyRef.current.current.pages[2].blocks.length, 1);
assert(!emptyMiddle.context.historyRef.current.current.pages[2].blocks[0].effects.includes('spotlight'), 'a new style block on an empty middle page is also ineligible');
emptyMiddle.context.undo();
assert.equal(JSON.stringify(emptyMiddle.context.historyRef.current.current), emptyMiddle.initialRaw);

function assertNoChange(test, message, expectedModelCalls = 0) {
  const previous = test.context.historyRef.current;
  test.context.applyRandomStyle();
  assert.equal(test.context.historyRef.current, previous, message);
  assert.equal(test.calls.history.length, 0, message);
  assert.equal(test.calls.stage.length, 0, message);
  assert.equal(test.calls.model, expectedModelCalls, message);
  assert.equal(test.controller.hasPending(), false, message);
}
for (const count of ['', '0', '-1', '11', '2.5', 'Infinity', 'NaN', 'random']) {
  const invalid = harness(createStarterProject(), { scope: 'site', count });
  assert.equal(invalid.context.randomPageCount, count, 'typing does not silently clamp or replace the entered value');
  assert.equal(invalid.context.isPageCountInvalid(), true);
  assertNoChange(invalid, `invalid count ${JSON.stringify(count)} must not generate or save a site`);
  assert.equal(invalid.calls.siteModel, 0, 'invalid input is rejected before generation');
  assert(invalid.context.error, 'an invalid count has a visible explanation');
  assert.equal(invalid.calls.notices.length, 0, 'an invalid count cannot claim success');
  assert.equal(invalid.context.view, 'preview');
}
const typing = harness(createStarterProject(), { scope: 'site' });
typing.context.changePageCount({ target: { value: '' } });
assert.equal(typing.context.randomPageCount, '', 'users can clear the field to replace its value');
typing.context.applyRandomStyle();
assert(typing.context.error);
typing.context.changePageCount({ target: { value: '1' } });
assert.equal(typing.context.randomPageCount, '1');
typing.context.changePageCount({ target: { value: '10' } });
assert.equal(typing.context.randomPageCount, '10', 'typing ten does not get clamped at the first digit');
assert.equal(typing.context.isPageCountInvalid(), false);
assert.equal(typing.calls.siteModel, 0, 'editing the count does not generate before clicking');
assert.equal(typing.calls.history.length, 0);
typing.context.applyRandomStyle();
assert.equal(typing.context.historyRef.current.current.pages.length, 10);
assert.equal(typing.context.error, '', 'a successful retry clears the previous validation error');
assert.equal(typing.calls.history.length, 1);

for (const busy of ['imageBusy', 'videoBusy']) {
  const test = harness(fixture(), { scope: 'site' });
  test.context[busy] = true;
  assert.equal(test.context.isDisabled(), true);
  assertNoChange(test, `${busy} prevents a conflicting site generation`);
  assert.equal(test.calls.siteModel, 0);
}
for (const busy of ['imageBusy', 'videoBusy']) {
  const test = harness();
  test.context[busy] = true;
  assert.equal(test.context.isDisabled(), true);
  assertNoChange(test, `${busy} prevents a conflicting randomization`);
}
for (const selected of [undefined, { id: 'deleted-block', kind: 'text' }, { id: 'embedded', kind: 'embed' }]) {
  const test = harness();
  test.context.randomScope = 'block';
  test.context.selected = selected;
  if (!selected || selected.kind === 'embed') assert.equal(test.context.isDisabled(), true);
  assertNoChange(test, 'missing, stale, and imported selections preserve the whole project', selected?.kind === 'text' ? 1 : 0);
  assert(test.context.error, 'unusable selection is explained');
}
const embeddedProject = fixture();
embeddedProject.pages[0].blocks = [createBlock('embed')];
const embedded = harness(embeddedProject);
assert.equal(embedded.context.isDisabled(), true);
assertNoChange(embedded, 'an imported-only page cannot be randomized', 1);
const embeddedSite = harness(embeddedProject, { scope: 'site', count: '7' });
assert.equal(embeddedSite.context.isDisabled(), false, 'an imported current page must not prevent creation of the rest of the site');
embeddedSite.context.applyRandomStyle();
assert.equal(embeddedSite.context.historyRef.current.current.pages.length, 7);
assert.deepEqual(embeddedSite.context.historyRef.current.current.pages[0].blocks.find(block => block.id === embeddedSite.initial.pages[0].blocks[0].id), embeddedSite.initial.pages[0].blocks[0]);

const emptyProject = fixture();
emptyProject.pages[0].blocks = [];
const empty = harness(emptyProject);
assert.equal(empty.context.isDisabled(), false);
empty.context.applyRandomStyle();
const created = empty.context.historyRef.current.current.pages[0].blocks;
assert.equal(created.length, 1);
assert.equal(created[0].kind, 'surface');
assert.equal(empty.context.selectedId, created[0].id, 'new style block becomes selected');
assert.equal(empty.context.historyRef.current.past.length, 1, 'creation and styling are one undo operation');
assert.equal(empty.calls.stage.length, 1);
empty.context.undo();
assert.equal(JSON.stringify(empty.context.historyRef.current.current), empty.initialRaw);
assert.equal(empty.controller.hasPending(), false, 'undo to the saved empty draft clears pending writes');

const rejected = harness();
rejected.context.JSON_LIMIT = 1;
assertNoChange(rejected, 'project-size guard leaves history, persistence, and UI state intact', 1);
assert.equal(rejected.context.view, 'preview');
assert.equal(rejected.calls.notices.length, 0, 'a rejected commit cannot claim successful randomization');
assert(rejected.context.error);

const rejectedSite = harness(fixture(), { scope: 'site' });
rejectedSite.context.JSON_LIMIT = 1;
assertNoChange(rejectedSite, 'site generation obeys the project-size guard');
assert.equal(rejectedSite.calls.siteModel, 1);
assert.equal(rejectedSite.context.view, 'preview');
assert.equal(rejectedSite.calls.notices.length, 0);
assert(rejectedSite.context.error);

const colorKeys = ['backgroundColor', 'secondaryColor', 'textColor', 'accentColor'];
const customColors = { backgroundColor: '#faf9f8', secondaryColor: '#dedcda', textColor: '#142536', accentColor: '#654321' };
function nativeBlocks(project) { return project.pages.flatMap(page => page.blocks).filter(block => block.kind !== 'embed'); }
function assertColors(project, colors) {
  for (const block of nativeBlocks(project)) for (const key of colorKeys) assert.equal(block.appearance[key], colors[key], `${block.kind} ${key} follows the shared settings`);
}
function withoutProjectColors(project) {
  const copy = structuredClone(project);
  delete copy.colorSettings;
  for (const block of nativeBlocks(copy)) {
    delete block.theme;
    for (const key of colorKeys) delete block.appearance[key];
  }
  return copy;
}
const colorFixture = fixture();
colorFixture.pages[0].blocks[0].appearance.background = 'gradient';
colorFixture.pages[0].blocks[0].effects = ['spotlight', 'reveal'];
colorFixture.pages[1].blocks[0].appearance.background = 'video';
colorFixture.pages[1].blocks[0].backgroundVideo = { src: 'https://example.test/background.mp4', poster: 'https://example.test/poster.jpg', paused: true, dim: .4 };
const colorSession = harness(colorFixture);
const defaultControls = controls(colorSession);
assert.equal(defaultControls.toggle.props['aria-checked'], false, 'unified colors start off for existing drafts');
assert.match(defaultControls.html, /role="switch" aria-checked="false"/);
assert.equal(defaultControls.inputs.length, 0);
assert.equal(defaultControls.fieldset, undefined, 'the color palette opens only after enabling unified colors');
defaultControls.toggle.props.onClick();
const unified = colorSession.context.historyRef.current.current;
assert.equal(unified.colorSettings.unified, true);
assertColors(unified, getProjectColorSettings(colorSession.initial).colors);
assert.deepEqual(withoutProjectColors(unified), withoutProjectColors(colorSession.initial), 'the switch preserves page structure, background types, effects, links, text and all media');
assert.equal(unified.pages[0].blocks[2], colorSession.initial.pages[0].blocks[2], 'imported HTML is not restyled');
assert.equal(colorSession.context.historyRef.current.past.length, 1, 'enabling the whole-site palette is one undo action');
assert.equal(colorSession.calls.stage.length, 1);
assert.equal(colorSession.controller.save(), 'saved');
assert.equal(colorSession.storage.raw, JSON.stringify(unified));
colorSession.context.undo();
assert.equal(JSON.stringify(colorSession.context.historyRef.current.current), colorSession.initialRaw);
assert.equal(controls(colorSession).fieldset, undefined, 'undo restores the previous switch and hides the palette');
assert.equal(colorSession.controller.save(), 'saved');
assert.equal(colorSession.storage.raw, colorSession.initialRaw);
colorSession.context.redo();
assert.equal(colorSession.context.historyRef.current.current, unified);
assert.equal(colorSession.controller.save(), 'saved');
const enabledControls = controls(colorSession);
assert.equal(enabledControls.toggle.props['aria-checked'], true);
assert.equal(enabledControls.fieldset.props.id, 'project-color-palette');
assert.equal(enabledControls.inputs.length, 4, 'the actual palette exposes all four editable colors');
assert.equal(enabledControls.presets.length, PALETTE_LIBRARY.length);
assert.match(enabledControls.html, /id="project-color-palette"/);
for (const [index, key] of colorKeys.entries()) enabledControls.inputs[index].props.onChange({ target: { value: customColors[key] } });
const editedColors = colorSession.context.historyRef.current.current;
assertColors(editedColors, customColors);
assert.deepEqual(editedColors.colorSettings.colors, customColors, 'successive inputs read the latest draft even before a React render');
assert.deepEqual(withoutProjectColors(editedColors), withoutProjectColors(colorSession.initial));
assert.equal(editedColors.pages[1].blocks[0].appearance.backgroundColor, customColors.backgroundColor, 'an explicit light palette is not overridden for video backgrounds');
assert.equal(colorSession.controller.save(), 'saved');
assert.equal(colorSession.storage.raw, JSON.stringify(editedColors));
assert.equal(controls(colorSession).inputs[3].props.value, customColors.accentColor);

const mergeColors = harness(applyProjectColorSettings(fixture(), { unified: true, colors: customColors }));
const firstColorInput = controls(mergeColors).inputs[0];
firstColorInput.props.onChange({ target: { value: '#fafaf9' } });
firstColorInput.props.onChange({ target: { value: '#f8f8f7' } });
assert.equal(mergeColors.context.historyRef.current.past.length, 1, 'continuous changes of one color merge into one undo action');
mergeColors.context.undo();
assert.equal(JSON.stringify(mergeColors.context.historyRef.current.current), mergeColors.initialRaw);
mergeColors.context.redo();
assertColors(mergeColors.context.historyRef.current.current, { ...customColors, backgroundColor: '#f8f8f7' });
controls(mergeColors).inputs[3].props.onChange({ target: { value: '#783256' } });
assert.equal(mergeColors.context.historyRef.current.past.length, 2, 'a different color field has an independent undo step');

for (const [index, palette] of PALETTE_LIBRARY.entries()) {
  const before = colorSession.context.historyRef.current.current;
  const beforeCount = colorSession.context.historyRef.current.past.length;
  controls(colorSession).presets[index].props.onClick();
  const after = colorSession.context.historyRef.current.current;
  assertColors(after, palette.appearance);
  assert.equal(controls(colorSession).presets[index].props['aria-pressed'], true, 'the chosen preset reflects the saved colors');
  assert.deepEqual(withoutProjectColors(after), withoutProjectColors(before));
  assert.equal(colorSession.context.historyRef.current.past.length, beforeCount + 1);
}
const beforeOff = colorSession.context.historyRef.current.current;
controls(colorSession).toggle.props.onClick();
const afterOff = colorSession.context.historyRef.current.current;
assert.equal(afterOff.colorSettings.unified, false);
for (const key of colorKeys.slice(0, 3)) assert(nativeBlocks(afterOff).every(block => block.appearance[key] === beforeOff.colorSettings.colors[key]), 'turning the switch off keeps base and text colors unified');
assert(new Set(nativeBlocks(afterOff).map(block => block.appearance.accentColor)).size > 1, 'turning the switch off gives blocks varied effect colors even with constant RNG');
assert.equal(controls(colorSession).fieldset, undefined);
assert.deepEqual(withoutProjectColors(afterOff), withoutProjectColors(colorSession.initial));
assert.equal(colorSession.controller.save(), 'saved');
assert.equal(JSON.parse(colorSession.storage.raw).colorSettings.unified, false);
colorSession.context.undo();
assert.equal(colorSession.context.historyRef.current.current, beforeOff);
assert.equal(controls(colorSession).toggle.props['aria-checked'], true);

for (const busy of ['imageBusy', 'videoBusy']) {
  const guarded = harness(applyProjectColorSettings(colorFixture, { unified: true, colors: customColors }));
  guarded.context[busy] = true;
  const currentControls = controls(guarded);
  assert.equal(currentControls.toggle.props.disabled, true);
  assert.equal(currentControls.fieldset.props.disabled, true, 'uploading disables the entire color palette');
  currentControls.toggle.props.onClick();
  currentControls.inputs[0].props.onChange({ target: { value: '#123456' } });
  currentControls.presets[0].props.onClick();
  assert.equal(guarded.context.historyRef.current.current, guarded.initial);
  assert.equal(guarded.calls.colorModel, 0, 'each handler also blocks conflicting edits when called directly');
  assert.equal(guarded.calls.stage.length, 0);
}
const invalidColors = harness(applyProjectColorSettings(fixture(), { unified: true, colors: customColors }));
for (const value of ['', '#fff', 'red', '#1234567', '#GGGGGG', 'url(https://example.test)']) invalidColors.context.changeUnifiedColor('accentColor', value);
invalidColors.context.applyUnifiedPalette('removed-palette');
assert.equal(invalidColors.context.historyRef.current.current, invalidColors.initial);
assert.equal(invalidColors.calls.colorModel, 0);
const hiddenColors = harness();
hiddenColors.context.changeUnifiedColor('accentColor', '#123456');
hiddenColors.context.applyUnifiedPalette(PALETTE_LIBRARY[0].id);
assert.equal(hiddenColors.calls.colorModel, 0, 'a closed palette cannot alter the default random-color mode');
assert.equal(hiddenColors.calls.stage.length, 0);
const rejectedColors = harness();
rejectedColors.context.JSON_LIMIT = 1;
controls(rejectedColors).toggle.props.onClick();
assert.equal(rejectedColors.context.historyRef.current.current, rejectedColors.initial);
assert.equal(rejectedColors.calls.stage.length, 0);
assert.equal(rejectedColors.calls.notices.length, 0);
assert(rejectedColors.context.error, 'a rejected palette change reports the same project-size guard');

const emptyColors = harness(createStarterProject(), { scope: 'site', count: '7' });
controls(emptyColors).toggle.props.onClick();
const emptyPaletteInputs = controls(emptyColors).inputs;
for (const [index, key] of colorKeys.entries()) emptyPaletteInputs[index].props.onChange({ target: { value: customColors[key] } });
const savedEmptyColors = emptyColors.context.historyRef.current.current;
assert.equal(savedEmptyColors.pages[0].blocks.length, 0, 'choosing colors on an empty site does not create placeholder blocks');
emptyColors.context.applyRandomStyle();
assert.equal(emptyColors.context.historyRef.current.current.pages.length, 7);
assertColors(emptyColors.context.historyRef.current.current, customColors);
emptyColors.context.undo();
assert.equal(emptyColors.context.historyRef.current.current, savedEmptyColors, 'one undo removes generated pages and keeps the chosen palette');

for (const scope of ['site', 'page', 'block']) {
  const randomized = harness(applyProjectColorSettings(fixture(), { unified: true, colors: customColors }), { scope, count: '8' });
  randomized.context.applyRandomStyle();
  assertColors(randomized.context.historyRef.current.current, customColors);
  assert.deepEqual(randomized.context.historyRef.current.current.colorSettings.colors, customColors);
  assert.equal(randomized.calls.history.length, 1);
  randomized.context.undo();
  assert.equal(JSON.stringify(randomized.context.historyRef.current.current), randomized.initialRaw, `${scope} randomization preserves the unified palette and exact undo`);
}

console.log('PASS random style UI: vertical page canvases, exact 1–10-page counts, sparse edge-page spotlight, actual color switch/picker/presets, merged color edits, media/content preservation, all randomization scopes, persistence, exact undo/redo, and guards.');
