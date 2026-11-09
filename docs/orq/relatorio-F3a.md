# Relatório F3a — Export core

Sem commit, sem push. Posse respeitada (`malha/`, `export/`, `imprimir/` e testes `malha-`, `export-`, `imprimir-`). Editei por fora da posse, só como manager: `packages/core/package.json` (exports + `fflate`), `THIRD_PARTY.md`.

## Tarefas

| Tarefa | Estado | Check | Resultado |
|---|---|---|---|
| F3a-01 Malha (`fechada`, `stl`, `bbox`, `volume`, `area`) | ✅ | `malha-malha.test.ts` | 10 testes |
| F3a-02 3MF (core, Prusa, Bambu/Orca, cor+slot, miniatura PNG, determinístico) | ✅ | `export-3mf.test.ts` | 8 testes; gera 3 arquivos em `packages/core/test/saida/` |
| F3a-03 Verificação | ✅ | `imprimir-verificar.test.ts` | 13 testes |
| F3a-04 Filamento + nome de arquivo | ✅ | `imprimir-filamento.test.ts`, `export-nome.test.ts` | 13 testes |

Verificação na raiz: `npm run build` ok; `npm test` 100 testes, 0 falhas.

## Workers Haiku: 4
1. malha.ts + teste; 2. 3mf.ts + perfis3mf.ts + teste (promoção do spike); 3. verificar.ts + teste; 4. filamento.ts + nome.ts + testes. Eu escrevi só as interfaces/integração: `malha/tipos.ts`, `imprimir/tipos.ts`, `imprimir/mensagens.ts`, `test/malha-fixtures.ts`, os `index.ts` e `test/.gitignore`.

## API
- Malha: `Malha {vertProps, triVerts, numProp?}` ou `{posicoes, indices}`; `normaliza()`. Imports: `@3dm/core/malha`, `/export`, `/imprimir`.
- `escrever3mf({corpos:[{nome,malha,cor,slot}], sabor, config?, miniaturaPng?}) -> Uint8Array`; `saborDe(impressora)`, `config3mfDe(impressora, filamento?)`; `nomeArquivo(projeto, corpo, impressoraId, ext)`.
- `verificar({impressora, filamento?, corpos, baseMinMm2?}) -> Achado[]`; `avisosFilamento(...)`; `massaGramas(malha, filamento)`. `Achado {severidade: bloqueio|erro|aviso|info, codigo, mensagem, corpo?}`. Todo texto em `imprimir/mensagens.ts`.

## Decisões
- Determinismo: `mtime` fixo (2000-01-01 local), ordem de chaves fixa, números com `toFixed(6)`. Sem teste de hash entre fusos.
- STL com normais calculadas e cabeçalho zerado.
- Overhang: inclinação = asin(-nz) > menor limiar entre impressora e filamento; ignora a base na mesa; avisa se > 1 mm². Base de apoio mínima 25 mm² (arbitrário).
- Detalhe mínimo usa a menor dimensão da bbox (ponytail; parede fina por raio fica para depois).
- Massa considera peça 100 % sólida.
- Mega S: `printer_settings_id` = nome do perfil (não confirmado).

## Pendências / riscos
- H2 continua: abrir os 3 arquivos de `packages/core/test/saida/` no PrusaSlicer e no Bambu Studio. Não confirmados (herdados do SPK): id de perfil da Mega S, `printer_model` da P2S, nível do `extruder` no Prusa, `<part>` mínimo no Bambu.
- `fflate` agora é dependência de `@3dm/core`.
- F3b: render da miniatura é dela; este módulo só recebe os bytes.
