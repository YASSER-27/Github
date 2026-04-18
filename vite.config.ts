import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: { 
              external: ['archiver', 'os', 'fs', 'path', 'electron', 'child_process'],
              output: { format: 'cjs' }
            },
            outDir: 'dist-electron'
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            rollupOptions: { 
              external: ['electron', 'os', 'fs', 'path'],
              output: { format: 'cjs' }
            },
            outDir: 'dist-electron'
          },
        },
      },
    ]),
    renderer(),
  ],
})
