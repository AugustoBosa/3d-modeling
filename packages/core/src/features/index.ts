// Despachante das features de geometria. `plano` do sketch só é usado por extrude/revolve (rodada 2: vem do sketch).
import type { Ctx, Delta, FeatureGeo } from './tipos.ts'
import type { PlanoLocal } from '../kernel/tipos.ts'
import { ErroFeature } from './tipos.ts'
import { executaExtrude, executaRevolve } from './perfis.ts'
import { executaBooleana, executaCorte, executaEspelho, executaPadrao, executaPrimitiva, executaShell, executaTransformacao } from './solidos.ts'
import { executaFuro } from './furo.ts'

export * from './tipos.ts'
export * from './operacao.ts'
export { PRESETS } from './furo.ts'

export function executa(f: FeatureGeo, ctx: Ctx, planoDe: (sketchId: string) => PlanoLocal): Delta {
  switch (f.tipo) {
    case 'extrude': return executaExtrude(f, ctx, planoDe(f.sketch))
    case 'revolve': return executaRevolve(f, ctx, planoDe(f.sketch))
    case 'caixa': case 'cilindro': case 'esfera': case 'cone': case 'toro': return executaPrimitiva(f, ctx)
    case 'booleana': return executaBooleana(f, ctx)
    case 'shell': return executaShell(f, ctx)
    case 'furo': return executaFuro(f, ctx)
    case 'padrao': return executaPadrao(f, ctx)
    case 'espelho': return executaEspelho(f, ctx)
    case 'corte': return executaCorte(f, ctx)
    case 'transformacao': return executaTransformacao(f, ctx)
    default: throw new ErroFeature(`Tipo de feature desconhecido: ${(f as { tipo: string }).tipo}.`, 'Use uma feature da lista.')
  }
}
export * from './doc.ts'
export * from './comandos.ts'
export * from './tabela.ts'
