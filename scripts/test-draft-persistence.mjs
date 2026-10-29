import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createDraftPersistence } from '../lib/draft-persistence.ts';

class Storage {
  data = new Map();
  writes = 0;
  fail = false;
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, raw) { if (this.fail) throw new Error('quota'); this.writes++; this.data.set(key, raw); }
}
const storage = new Storage();
const a = createDraftPersistence(storage, 'draft', null);
a.stage('A saved');
assert.equal(a.save(), 'saved');
const b = createDraftPersistence(storage, 'draft', storage.getItem('draft'));
b.stage('B latest');
assert.equal(b.save(), 'saved');
const writes = storage.writes;
assert.equal(a.save(), 'unchanged', 'a clean old tab never rewrites on pagehide');
assert.equal(storage.writes, writes);
assert.equal(storage.getItem('draft'), 'B latest');
a.stage('A unsaved');
assert.equal(a.save(), 'conflict', 'detect a changed draft even before the storage event arrives');
assert(a.hasPending(), 'conflicting changes stay available for recovery');
assert.equal(storage.getItem('draft'), 'B latest');
assert.equal(a.save(), 'conflict', 'retries cannot silently overwrite the newer draft');
a.discardPending();
assert.equal(a.save(), 'unchanged', 'explicit reload cannot flush the discarded local draft');

const restored = createDraftPersistence(storage, 'draft', storage.getItem('draft'));
restored.stage('B edited');
storage.fail = true;
assert.throws(() => restored.save(), /quota/);
assert(restored.hasPending());
storage.fail = false;
assert.equal(restored.save(), 'saved', 'failed saves can be retried');
restored.stage('temporary edit');
restored.stage('B edited');
assert(!restored.hasPending(), 'undoing to the saved value clears pending changes');

const template = createDraftPersistence(storage, 'template', null);
template.stage('new template');
assert.equal(template.save(), 'saved', 'template and ordinary drafts have independent keys');
assert(!restored.observeExternalChange());
storage.data.delete('draft');
assert(restored.observeExternalChange(), 'external removal also invalidates a stale tab');
restored.stage('should not recreate');
assert.equal(restored.save(), 'conflict');
assert.equal(storage.getItem('draft'), null);

// Execute the actual page-name callback and history actions, not a test copy.
const source = readFileSync(new URL('../components/studio/block-studio.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('block-studio.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const variables = new Map();
let renameCallback;
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) variables.set(node.name.text, node.initializer);
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'input' && node.getText(ast).includes('value={currentPage.title}')) {
    renameCallback = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.text === 'onChange').initializer.expression;
  }
  ts.forEachChild(node, visit);
}
visit(ast);
const project = { pages: [{ id: 'a', title: 'First' }, { id: 'b', title: 'Second' }] };
const historyStorage = new Storage();
const controller = createDraftPersistence(historyStorage, 'project', null);
const context = vm.createContext({
  Blob, JSON, Date: { now: () => 1000 }, JSON_LIMIT: 3 * 1024 * 1024,
  historyRef: { current: { past: [], current: structuredClone(project), future: [] } },
  mergeRef: { current: { key: '', time: 0 } }, persistence: { current: controller },
  useCallback: fn => fn, imageRequest: { current: 0 }, videoRequest: { current: 0 },
  setHistory() {}, setError() {}, setImageBusy() {}, setVideoBusy() {}, setZoomTarget() {}, setVideoTarget() {}, setNotice() {},
});
for (const [name, node] of [['commit', variables.get('commit')], ['undo', variables.get('undo')], ['redo', variables.get('redo')], ['rename', renameCallback]]) {
  assert(node, `Missing real callback: ${name}`);
  vm.runInContext(ts.transpileModule(`globalThis.${name} = ${node.getText(ast)}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context);
}
context.currentPage = context.historyRef.current.current.pages[0];
context.rename({ target: { value: 'First renamed' } });
context.currentPage = context.historyRef.current.current.pages[1];
context.rename({ target: { value: 'Second renamed' } });
assert.equal(context.historyRef.current.past.length, 2, 'different pages need separate undo steps even within 850 ms');
context.undo();
assert.equal(context.historyRef.current.current.pages[0].title, 'First renamed');
assert.equal(context.historyRef.current.current.pages[1].title, 'Second');
controller.save();
assert.equal(JSON.parse(historyStorage.getItem('project')).pages[1].title, 'Second', 'undo is staged for persistence');
context.redo();
controller.save();
assert.equal(JSON.parse(historyStorage.getItem('project')).pages[1].title, 'Second renamed', 'redo is staged too');
context.rename({ target: { value: 'Second typing' } });
context.rename({ target: { value: 'Second typing more' } });
assert.equal(context.historyRef.current.past.length, 3, 'continuous typing in the same field still groups normally');
// Exercise the template studio's real hooks and edit/replace callbacks too.
// A React-free hook scheduler controls timers/events without browser automation.
const { draftBackup, readDraftBackup, normalizeBrief } = await import('../lib/studio.ts');
const manualSource = readFileSync(new URL('../components/studio/manual-studio.tsx', import.meta.url), 'utf8');
const manualAst = ts.createSourceFile('manual-studio.tsx', manualSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const manualComponent = manualAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ManualStudio');
const setup = manualAst.statements.filter(node =>
  ts.isFunctionDeclaration(node) && ['stored', 'remember', 'forget'].includes(node.name?.text)
  || ts.isVariableStatement(node) && node.declarationList.declarations.some(item => ['empty', 'examples'].includes(item.name.getText(manualAst))))
  .map(node => node.getText(manualAst)).join('\n');
const componentBody = manualComponent.body.statements.slice(0, manualComponent.body.statements.findIndex(ts.isReturnStatement)).map(node => node.getText(manualAst)).join('\n');
const manualCode = ts.transpileModule(`${setup}\nglobalThis.renderManual = function() { ${componentBody}\nreturn {edit, replaceBrief, brief, draftStatus, reload: typeof reloadLatestDraft === 'function' ? reloadLatestDraft : null, retry: typeof saveDraft === 'function' ? saveDraft : null}; };`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
function manualHarness(storage, search = '') {
  const hooks = [], effects = [], timers = new Map(), listeners = new Map();
  let cursor = 0, dirty = false, nextTimer = 0, result, reloaded = false;
  const ctx = vm.createContext({
    draftBackup, readDraftBackup, normalizeBrief, createDraftPersistence,
    localStorage: storage, location: { search }, URLSearchParams, JSON,
    useStudioI18n: () => ({ t: value => value }),
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], value => { const next = typeof value === 'function' ? value(hooks[index]) : value; if (!Object.is(hooks[index], next)) { hooks[index] = next; dirty = true; } }];
    },
    useRef(initial) { const index = cursor++; return hooks[index] ||= { current: initial }; },
    useEffect(callback, deps) { const index = cursor++; const old = hooks[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) effects.push(() => { old?.cleanup?.(); hooks[index] = { deps, cleanup: callback() }; }); },
    setTimeout(callback) { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
    window: {
      addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
      removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
      history: { replaceState() {} }, location: { reload() { reloaded = true; } }, confirm: () => true,
    },
  });
  vm.runInContext(manualCode, ctx);
  function render() { let loops = 0; do { assert(++loops < 20, 'template effects must settle'); dirty = false; cursor = 0; result = ctx.renderManual(); effects.splice(0).forEach(run => run()); } while (dirty); }
  render();
  return {
    get value() { return result; }, get reloaded() { return reloaded; },
    edit(change) { result.edit(change); render(); },
    replace(next) { result.replaceBrief(next, 'replaced'); render(); },
    flushTimers() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); render(); },
    event(name, event = {}) { for (const handler of listeners.get(name) || []) handler(event); render(); return event; },
    retry() { assert(result.retry); result.retry(); render(); },
    reload() { assert(result.reload); result.reload(); render(); },
    unmount() { for (const hook of hooks) hook?.cleanup?.(); },
  };
}
const manualStorage = new Storage();
const originalBrief = { kind: 'restaurant', name: 'Original', text: 'Original introduction', prompt: '', contact: '', image: '' };
manualStorage.setItem('forma-brief-v3', draftBackup(originalBrief));
const manualA = manualHarness(manualStorage), manualB = manualHarness(manualStorage);
manualB.edit({ name: 'Latest in tab B' }); manualB.flushTimers();
manualA.event('pagehide');
assert.equal(readDraftBackup(manualStorage.getItem('forma-brief-v3')).name, 'Latest in tab B', 'leaving a clean template tab must not overwrite another tab');
manualA.flushTimers();
assert.equal(readDraftBackup(manualStorage.getItem('forma-brief-v3')).name, 'Latest in tab B', 'mounting a clean template tab must not schedule stale saves');
manualA.edit({ name: 'Unsaved in tab A' }); manualA.flushTimers();
assert.equal(readDraftBackup(manualStorage.getItem('forma-brief-v3')).name, 'Latest in tab B', 'template edits detect a conflict even before the storage event');
assert.equal(manualA.value.brief.name, 'Unsaved in tab A', 'keep conflicting data available to download');
let prevented = false;
manualA.event('beforeunload', { preventDefault() { prevented = true; } });
assert(prevented, 'warn before leaving with unsaved conflicting template data');
manualA.reload(); manualA.event('pagehide');
assert(manualA.reloaded);
assert.equal(readDraftBackup(manualStorage.getItem('forma-brief-v3')).name, 'Latest in tab B');

const retryStorage = new Storage(), manualRetry = manualHarness(retryStorage);
retryStorage.fail = true; manualRetry.edit({ name: 'Keep after quota error' }); manualRetry.flushTimers();
assert.equal(retryStorage.getItem('forma-brief-v3'), null);
retryStorage.fail = false; manualRetry.retry();
assert.equal(readDraftBackup(retryStorage.getItem('forma-brief-v3')).name, 'Keep after quota error', 'retry saves the pending draft without another edit');
manualRetry.edit({ name: 'Leave before debounce' }); manualRetry.unmount();
assert.equal(readDraftBackup(retryStorage.getItem('forma-brief-v3')).name, 'Leave before debounce', 'in-app navigation flushes pending template edits');

const legacyStorage = new Storage(); legacyStorage.setItem('forma-brief-v2', draftBackup(originalBrief));
const legacy = manualHarness(legacyStorage); legacy.flushTimers();
assert.equal(legacy.value.brief.name, 'Original'); assert.equal(legacyStorage.getItem('forma-brief-v3'), null);
legacy.edit({ contact: 'new@example.test' }); legacy.flushTimers();
assert.equal(readDraftBackup(legacyStorage.getItem('forma-brief-v3')).contact, 'new@example.test');
const sample = manualHarness(new Storage(), '?example=restaurant'); sample.flushTimers();
assert.notEqual(sample.value.brief.name, '', 'explicitly selected examples still initialize and save');
console.log('PASS draft persistence: block/template stale tabs, conflicts, recovery, quota retry, navigation flush, legacy drafts, and cross-page undo/redo.');
