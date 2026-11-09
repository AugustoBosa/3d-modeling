// Parte comum das features: achar o corpo-alvo e combinar o sólido-ferramenta com ele (nova/unir/subtrair/interseccao).
import type { Manifold } from 'manifold-3d'
import { ErroFeature } from './tipos.ts'
import type { Ctx, Delta, Operacao } from './tipos.ts'

/** Id do corpo-alvo: `alvo` explícito, ou o corpo mais recente. Lança ErroFeature se não existe. */
export function idAlvo(ctx: Ctx, alvo?: string): string {
  const id = alvo ?? [...ctx.corpos.keys()].pop()
  if (id === undefined || !ctx.corpos.has(id))
    throw new ErroFeature(alvo ? `O corpo "${alvo}" não existe neste ponto do histórico.` : 'Não há nenhum corpo para modificar.', 'Crie um corpo antes (extrusão ou primitiva "nova") ou escolha outro alvo.')
  return id
}

/** `ferr` deve estar no `ctx.lixo` (esta função não o libera). Devolve o Delta da feature `id`. */
export function aplicaOperacao(ctx: Ctx, id: string, ferr: Manifold, operacao: Operacao = 'nova', alvo?: string): Delta {
  if (operacao === 'nova') return { [id]: ferr.translate(0, 0, 0) }
  const a = idAlvo(ctx, alvo)
  const base = ctx.corpos.get(a)!
  const r = operacao === 'unir' ? base.add(ferr) : operacao === 'subtrair' ? base.subtract(ferr) : base.intersect(ferr)
  if (r.isEmpty()) { r.delete(); throw new ErroFeature('A operação deixou o corpo vazio.', operacao === 'interseccao' ? 'As peças não se tocam: mova uma delas.' : 'A ferramenta cobre o corpo inteiro: reduza-a.') }
  return { [a]: r }
}
