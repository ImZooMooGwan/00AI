import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [react(), cloudflare()],
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
            { name: 'editor-vendor', test: /node_modules[\\/](@tiptap|prosemirror)[\\/]/, maxSize: 350_000, priority: 15 },
            { name: 'collaboration-vendor', test: /node_modules[\\/](yjs|y-indexeddb|lib0|y-protocols)[\\/]/, priority: 15 },
          ],
        },
      },
    },
  },
});
