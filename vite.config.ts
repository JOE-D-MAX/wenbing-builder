import { defineConfig } from 'vite';
import vinext from 'vinext';

// This checkout runs on Node. No Workers bindings or hosting-platform plugins.
export default defineConfig({
  plugins: [vinext()],
  // Keep optimized ESM dependencies inside node_modules, outside CommonJS transforms.
  cacheDir: 'node_modules/.vite',
});
