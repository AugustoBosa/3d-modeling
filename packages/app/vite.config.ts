import { defineConfig } from 'vite'

// base './' para o GitHub Pages (subpasta). O worker (F2) usa top-level await do WASM, que só existe no formato "es".
export default defineConfig({ base: './', build: { target: 'es2022', chunkSizeWarningLimit: 900 }, worker: { format: 'es' } })
