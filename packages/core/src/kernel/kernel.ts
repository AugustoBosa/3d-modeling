// Inicializa o manifold-3d uma vez (top-level await), com a mesma API em Node e no navegador.
// No navegador quem importa isto é o worker de geometria: o Vite empacota o manifold.wasm sozinho,
// como no projeto terrain (`import ... from '@3dm/core/kernel'`). No Node basta importar.
import Module from 'manifold-3d'

const wasm = await Module()
wasm.setup()

export { wasm }
export const Manifold = wasm.Manifold
export const CrossSection = wasm.CrossSection
