import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createInstance } from 'i18next';

const root = process.cwd();
const directory = path.join(root, 'lib/i18n');
const dictionaries = fs.readdirSync(directory).filter(name => name.endsWith('.en.ts'));
const dictionaryModules = new Map();
const dictionaryKeys = new Set();
const variables = text => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map(match => match[1]).sort();
for (const name of dictionaries) {
  const source = fs.readFileSync(path.join(directory, name), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports }, { timeout: 1000 });
  dictionaryModules.set('./' + name.replace(/\.ts$/, ''), exports);
  for (const dictionary of Object.values(exports)) {
    for (const [key, value] of Object.entries(dictionary)) {
      assert.equal(typeof value, 'string', `${name}: ${key}`);
      assert.ok(value.trim(), `Empty translation: ${key}`);
      assert.deepEqual(variables(value), variables(key), `Interpolation mismatch: ${key}`);
      dictionaryKeys.add(key);
    }
  }
}
const merged = {};
const mergedSource = ts.transpileModule(fs.readFileSync(path.join(directory, 'messages.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(mergedSource, { exports: merged, require: id => { assert.ok(dictionaryModules.has(id), `Unknown dictionary import: ${id}`); return dictionaryModules.get(id); } }, { timeout: 1000 });
const translations = merged.englishMessages;
for (const key of dictionaryKeys) assert.ok(translations[key], `Dictionary not wired to the site: ${key}`);
assert.ok(Object.keys(translations).length > 300, 'The site dictionary is incomplete');

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}
const files = [...filesIn(path.join(root, 'components/studio')), path.join(root, 'app/page.tsx')].filter(file => file.endsWith('.tsx'));
const missing = new Set();
for (const filename of files) {
  const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      const key = node.arguments[0].text;
      if (/[\u4e00-\u9fff]/.test(key) && !translations[key]) missing.add(key);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
assert.deepEqual([...missing], [], 'Missing English interface messages');

const engine = createInstance();
await engine.init({ lng: 'zh', fallbackLng: 'zh', supportedLngs: ['zh', 'en'], initAsync: false, keySeparator: false, nsSeparator: false, resources: { zh: { translation: {} }, en: { translation: translations } }, interpolation: { escapeValue: false } });
const original = JSON.stringify(translations);
for (const locale of ['en', 'zh', 'en', 'zh']) {
  await engine.changeLanguage(locale);
  for (const [key, english] of Object.entries(translations)) {
    const values = Object.fromEntries(variables(key).map(variable => [variable, variable === 'count' ? 3 : 'TEST']));
    const expected = (locale === 'en' ? english : key).replace(/{{\s*(\w+)\s*}}/g, (_, name) => String(values[name]));
    assert.equal(engine.t(key, { ...values, defaultValue: key, nest: false }), expected, `${locale}: ${key}`);
  }
  const authored = '我的自定义内容 / my own words';
  assert.equal(engine.t(authored, { defaultValue: authored }), authored, 'Unknown authored content must remain unchanged');
  const literal = 'Literal $t(文炳建站) and {{notProvided}}';
  assert.equal(engine.t(literal, { defaultValue: literal, nest: false }), literal, 'Unknown messages must not expand nested translations');
}
assert.equal(JSON.stringify(translations), original, 'Switching languages must not modify source dictionaries');
console.log(`Interface language checks passed: ${dictionaries.length} dictionaries, ${Object.keys(translations).length} messages, interpolation and language round trips.`);
