// Todas as mensagens de verificação e de filamento (pt-BR, tom "causa + correção", sem "Ops!").
// Funções puras: recebem números/nomes e devolvem texto. Único lugar com texto do core.
const n1 = (x: number) => x.toFixed(1).replace('.', ',')
const dims = (d: number[]) => d.map(n1).join(' × ')

export const MSG = {
  malhaVazia: (c: string) => `O corpo "${c}" não tem triângulos. Verifique se a última feature gerou sólido; se a booleana ficou vazia, ajuste as medidas.`,
  malhaAberta: (c: string) => `O corpo "${c}" tem furo ou aresta solta na malha, e o fatiador pode errar o preenchimento. Revise o perfil do sketch (sem lacunas nem linhas duplicadas) e as booleanas da última feature; depois exporte de novo. Para exportar assim mesmo, confirme "exportar mesmo assim".`,
  volumeInvertido: (c: string) => `O corpo "${c}" está com as faces viradas para dentro (volume negativo). Reverta a direção da extrusão ou do perfil.`,
  foraDoVolume: (c: string, tam: number[], vol: number[]) => `O corpo "${c}" mede ${dims(tam)} mm e a mesa permite ${dims(vol)} mm. Reduza as medidas, gire a peça para caber ou corte por plano em duas partes.`,
  overhang: (c: string, area: number, max: number) => `O corpo "${c}" tem ${n1(area)} mm² de face voltada para baixo, mais inclinada que ${n1(max)}° da vertical, e vai precisar de suporte. Gire a peça (apoiar na face), reduza o ângulo para ${n1(max)}° ou menos, ou ative suporte no fatiador.`,
  detalheMinimo: (c: string, menor: number, min: number) => `O corpo "${c}" tem uma dimensão de ${n1(menor)} mm, menor que o detalhe mínimo de ${n1(min)} mm do bico. O bico não reproduz isso. Engrosse a peça para ${n1(min)} mm ou mais.`,
  baseMenor: (c: string, area: number, min: number) => `O corpo "${c}" encosta na mesa em apenas ${n1(area)} mm² (mínimo recomendado: ${n1(min)} mm²), e a peça pode soltar durante a impressão. Apoie numa face maior ou adicione aba/brim no fatiador.`,

  camaraAberta: (fil: string, imp: string) => `${fil} encolhe e empena sem câmara fechada, e a ${imp} é aberta. Imprima em ambiente sem corrente de ar, use enclosure, ou troque para PLA/PETG.`,
  flexivelBowden: (fil: string, imp: string) => `${fil} é flexível e a ${imp} usa extrusora Bowden, que imprime mal e devagar com material mole. Use velocidade baixa e retração mínima, ou escolha PLA/PETG.`,
  compatAviso: (fil: string, imp: string) => `${fil} não é recomendado na ${imp}. Confira as condições de impressão antes de exportar.`,
  semAms: (c: string, slot: number, imp: string) => `O corpo "${c}" usa o slot ${slot} do AMS, mas a ${imp} não tem AMS. Mude o corpo para o slot 1 ou use a P2S.`,
  encolhimento: (fil: string, pct: number) => `${fil} encolhe cerca de ${n1(pct)}% no plano XY. Aplique a compensação de encolhimento no fatiador ou aumente o corpo na mesma proporção.`,
  paredeFilamento: (fil: string, min: number) => `${fil} pede paredes de ${n1(min)} mm ou mais. Engrosse as paredes finas do projeto.`,
}
