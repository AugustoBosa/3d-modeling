// Pilha de undo/redo sobre comandos (não snapshots). Toda ação — UI ou MCP — entra aqui (PROJETO_BASE §6.15).

export interface Comando<D> {
  nome: string
  fazer(doc: D): void
  desfazer(doc: D): void
}

export interface Pilha<D> {
  executa(c: Comando<D>): void
  desfaz(): Comando<D> | null
  refaz(): Comando<D> | null
  /** Desfaz o último comando SEM guardá-lo para refazer (restrição por letra desfeita pela letra seguinte, §7.3 2b). Com `so`, só desfaz se esse comando for o topo. */
  desfazSemRefazer(so?: Comando<D>): Comando<D> | null
  readonly podeDesfazer: boolean
  readonly podeRefazer: boolean
  /** Esvazia as duas pilhas (novo projeto, abrir arquivo). */
  limpa(): void
}

/** `aoMudar` é chamado depois de cada executa/desfaz/refaz/limpa. */
export function criaPilha<D>(doc: D, aoMudar: () => void = () => {}): Pilha<D> {
  const feitos: Comando<D>[] = [], desfeitos: Comando<D>[] = []
  return {
    executa(c) { c.fazer(doc); feitos.push(c); desfeitos.length = 0; aoMudar() },
    desfaz() { const c = feitos.pop(); if (!c) return null; c.desfazer(doc); desfeitos.push(c); aoMudar(); return c },
    desfazSemRefazer(so) { if (so && feitos[feitos.length - 1] !== so) return null; const c = feitos.pop(); if (!c) return null; c.desfazer(doc); aoMudar(); return c },
    refaz() { const c = desfeitos.pop(); if (!c) return null; c.fazer(doc); feitos.push(c); aoMudar(); return c },
    get podeDesfazer() { return feitos.length > 0 },
    get podeRefazer() { return desfeitos.length > 0 },
    limpa() { feitos.length = 0; desfeitos.length = 0; aoMudar() },
  }
}
