import { defineConfig } from 'vitest/config';
import { tomlConfig } from './build/toml-config.ts';

export default defineConfig({
  // Relative asset paths, so the build works under a GitHub Pages subpath.
  base: './',
  plugins: [tomlConfig()],
  build: {
    target: 'es2022',
    // Three.js alone is about 530 kB minified (130 kB gzipped), within budget.
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ['src/**/*.test.ts', 'build/**/*.test.ts'],
  },
});
