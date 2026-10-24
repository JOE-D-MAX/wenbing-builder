import { registerHooks } from 'node:module';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const candidate = new URL(specifier, context.parentURL);
    if (!/\.[cm]?[jt]s$/.test(specifier) && existsSync(fileURLToPath(candidate) + '.ts')) return { url: pathToFileURL(fileURLToPath(candidate) + '.ts').href, shortCircuit: true };
  }
  return next(specifier, context);
} });
const { createDesignStarterProject } = await import('../lib/design-templates.ts');
const { renderBlockProject } = await import('../lib/block-renderer.ts');
const project = createDesignStarterProject();
const preview = renderBlockProject(project);
const output = new URL('../public/showcase/editorial/', import.meta.url);
mkdirSync(output, { recursive: true });
writeFileSync(new URL('index.html', output), preview);
writeFileSync(new URL('project.json', output), JSON.stringify(project));
console.log('Generated neutral design kit preview and editable project: ' + Buffer.byteLength(preview) + ' bytes');
