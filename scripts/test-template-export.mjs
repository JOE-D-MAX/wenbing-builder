import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real preview route and browser download callback without a server or credentials.
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return next(new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, context);
  if (/^\.{1,2}\//.test(specifier) && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { POST } = await import('../app/api/preview/route.ts');
process.env.FORMA_PUBLIC_ORIGIN = 'https://template-export.test';

const source = readFileSync(new URL('../components/studio/manual-studio.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('manual-studio.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let download, frameDocument;
const frameBindings = [];
function walk(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'downloadPreview') download = node;
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'previewDocument') frameDocument = node.initializer;
  if (ts.isJsxSelfClosingElement(node) && ['iframe', 'PreviewDialog'].includes(node.tagName.getText(ast))) {
    const prop = node.tagName.getText(ast) === 'iframe' ? 'srcDoc' : 'html';
    const attribute = node.attributes.properties.find(value => ts.isJsxAttribute(value) && value.name.text === prop);
    if (attribute?.initializer && ts.isJsxExpression(attribute.initializer)) frameBindings.push(attribute.initializer.expression?.getText(ast));
  }
  ts.forEachChild(node, walk);
}
walk(ast);
assert(download && frameDocument, 'The actual download and frame preparation paths must be exercised.');
assert.deepEqual(frameBindings, ['previewDocument', 'previewDocument'], 'Both preview surfaces must receive the iframe-only copy.');
const executable = ts.transpileModule(`const previewDocument = ${frameDocument.getText(ast)}; ${download.getText(ast)}; downloadPreview(); globalThis.frameHtml = previewDocument;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

for (const kind of ['restaurant', 'personal', 'business']) {
  for (const withItems of [false, true]) {
    const brief = { kind, name: '导出验证网站', text: '介绍：验证导出的网站可以独立打开并使用导航。' + (withItems ? '\n项目：示例项目｜项目内容' : ''), contact: '邮箱：hello@example.com\n电话：12345678901', prompt: '', image: '' };
    const response = await POST(new Request('https://template-export.test/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://template-export.test' }, body: JSON.stringify(brief) }));
    assert.equal(response.status, 200);
    const result = await response.json();
    let savedBlob;
    let clicked = false;
    const anchor = { href: '', download: '', click() { clicked = true; }, remove() {} };
    const context = vm.createContext({
      preview: result.preview, previewHtml: result.html, Blob,
      URL: { createObjectURL(blob) { savedBlob = blob; return 'blob:download-test'; }, revokeObjectURL() {} },
      document: { createElement(tag) { assert.equal(tag, 'a'); return anchor; }, body: { appendChild() {} } },
      setTimeout() {}, setError(message) { assert.fail(message); },
    });
    vm.runInContext(executable, context);
    assert(clicked, 'The download action must create a downloadable document.');
    assert.equal(anchor.download, '导出验证网站.html');
    assert.equal(savedBlob.type, 'text/html;charset=utf-8');
    const exported = await savedBlob.text();
    assert.equal(exported, result.html, 'Download must preserve the unmodified generated document.');
    assert(!exported.includes('about:srcdoc'), 'A standalone download cannot link to an iframe URL.');
    const links = [...exported.matchAll(/href="#([^"]+)"/g)];
    assert(links.length >= 5);
    for (const [, id] of links) {
      assert(exported.includes(`id="${id}"`), `Exported anchor target must exist: ${id}`);
      assert(context.frameHtml.includes(`href="about:srcdoc#${id}"`), `Iframe anchor must stay within its srcdoc: ${id}`);
    }
    assert(!context.frameHtml.includes('href="#'));
    for (const target of ['mailto:hello@example.com', 'tel:12345678901']) {
      assert(exported.includes(`href="${target}"`));
      assert(context.frameHtml.includes(`href="${target}"`), 'Preview adaptation must not change contact links.');
    }
  }
}
console.log('PASS template export: actual route + download callback, three site types, standalone/iframe anchors, existing targets and contact links.');
