import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import { defaultViteConfig } from 'markedit-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(mergeConfig(defaultViteConfig(), {
  resolve: {
    alias: [
      {
        find: /^shiki(?:\/wasm)?$/,
        replacement: fileURLToPath(new URL('./src/shiki.ts', import.meta.url)),
      },
      {
        find: /^@pierre\/theming\/themes$/,
        replacement: fileURLToPath(new URL('./src/pierre-themes.ts', import.meta.url)),
      },
    ],
  },
  plugins: [viteSingleFile()],
}));
