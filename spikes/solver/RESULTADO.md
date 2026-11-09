# SPK-1 — Solver de restrições (R1)

**Decisão: GO.** Solver próprio MIT, sem dependência, 20 sketches de referência convergem e o orçamento de 16 ms/iteração passa com folga.

## Como rodar
```
node --test spikes/solver/*.test.ts     # 21 testes (20 sketches + desempenho)
node spikes/solver/bench.ts             # números abaixo
```
Obs.: `node --test spikes/solver/` (só o diretório) não funciona no Node 25 (trata como módulo). Use o glob.

## Números (Node 25.8, mediana de 15 execuções, com resolução de 1 mm de ruído inicial)
| Cenário | Variáveis | Iterações | Tempo total | **ms/iteração** |
|---|---|---|---|---|
| Grade 9x8: 72 pontos + 127 linhas = **199 entidades** (H/V + dimensões) | 144 | 6 | 0,7 ms | **0,11** |
| Cadeia de 200 pontos (pior caso: n=400, tudo conectado) | 400 | 14 | 5,3 ms | **0,38** |
| Análise de posto (QR) após resolver, grade / cadeia | | | 20 ms / 47 ms | só ao soltar o mouse |

A meta era ≤ 16 ms/iteração. Antes do Cholesky por envelope, a cadeia de 400 variáveis dava 14 ms/iter (Cholesky denso, O(n³)); o envelope derrubou para 0,38.

## O que foi implementado (`solver.ts`)
- Entidades: ponto, linha, círculo, arco (centro + 2 extremos, com |c-a|=|c-b| implícito).
- Restrições (todas as do §5.4): coincidente, horizontal, vertical, paralela, perpendicular, tangente (linha-círculo/arco, círculo-círculo externa e interna), igual (linhas ou raios), concêntrica, ponto-na-curva (linha, círculo, arco), simetria, fixa; distância, distância H, distância V, raio, diâmetro, ângulo.
- LM com amortecimento de Marquardt, Jacobiano esparso por diferenças finitas (só as variáveis de cada equação), normal equations densas + Cholesky com envelope.
- **Estado:** `definido` = n − posto(J) = 0 (QR com pivô, Jacobiano por diferença central); `subdefinido` = dof > 0; `conflito` = resíduo final > 1e-6. `redundantes` = equações − posto.
- `diagnosticarConflito(original)`: devolve as restrições cuja remoção resolve o sketch (O(m) resoluções; chamar sob demanda, não a cada arrasto).

## Cobertura (20 sketches)
retângulo definido e subdefinido (dof=1), triângulo 3-4-5, L com paralela/perpendicular, círculo por diâmetro, concêntricos, linha tangente a círculo, tangentes externo e interno, ponto no círculo, ponto na linha, simetria, linhas iguais, círculos iguais, ângulo 30°, "D" (linha + arco tangente), 2 conflitos (larguras 80×60; coincidente + distância 10) com culpados identificados, redundância (não vira conflito), losango 60°.

## Achados e riscos para a F1
1. **Bug que custou tempo:** variáveis duplicadas na lista de uma equação (linhas vizinhas compartilham ponto) dobravam o Jacobiano e travavam a convergência. Já corrigido com `new Set` em `add()`; manter ao promover.
2. **Tangência é quase-singular:** com resíduo 1e-10 a posição fica a ~1e-4 mm (teste 16 usa tolerância 1e-3). Aceitável para CAD em mm; se incomodar, normalizar a restrição ou tolerar no estado "definido".
3. **Lado da tangente/arco** é fixado pela geometria no momento da compilação (como Fusion). Recompilar a cada edição de restrição, não a cada arrasto.
4. Sem restrição de comprimento, `perpendicular`+`paralela` convergem devagar (residual 5e-4 em 100 iterações): caso subdefinido degenerado, sem impacto em estado definido.
5. Não feito (fora do SPK): inferência ao desenhar, arrasto com ponto-alvo (usar `fixa` temporária com `xy`), decomposição em componentes, `maxIter` adaptativo, mensagem por restrição. `fixa` precisa do `xy` explícito ou usa a posição atual.
6. Plano B (planegcs) **não** acionado.
