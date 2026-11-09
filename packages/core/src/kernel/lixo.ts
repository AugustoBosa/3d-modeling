import type { Lixo } from './tipos.ts'

/** Guarda sólidos intermediários do manifold e os libera de uma vez. */
export function criaLixo(): Lixo {
  const itens: { delete(): void }[] = []
  return {
    add(x) {
      itens.push(x)
      return x
    },
    limpa() {
      for (const x of itens) {
        try { x.delete() } catch { /* já deletado */ }
      }
      itens.length = 0
    },
    get tamanho() {
      return itens.length
    },
  }
}
