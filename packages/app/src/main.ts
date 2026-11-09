import './boot.ts'
import './tokens.css'
import './layout.css'
import './sketch/sketch.css'
import './features/features.css'
import './features/painel.css'
import './features/parametros.css'
import './features/medir.css'
import './imprimir/imprimir.css'
import './customizar/customizar.css'
import { definirImpressora, lerDocumento, novoDocumento } from '@3dm/core/doc'
import exemploCaixa from '../../../examples/caixa-com-tampa.3dm.json'
import { impressoraPorId } from '@3dm/core/printers'
import { instalaAtalhos } from './atalhos.ts'
import { criaBarra } from './barra.ts'
import { criaCards } from './cards.ts'
import { criaDialogoPrefs } from './dialogoPrefs.ts'
import { criaLinha } from './linha/linha.ts'
import { registraBasicos } from './linha/basicos.ts'
import { criaRegistro } from './linha/registro.ts'
import { criaPaineis } from './paineis.ts'
import { abreArquivo, autosave, baixaDocumento, carregaAtual } from './persistencia.ts'
import { lePrefs, salvaPrefs } from './prefs.ts'
import type { Prefs } from './prefs.ts'
import { criaProjeto } from './projeto.ts'
import { aoMudarSistema, aplicaTema } from './tema.ts'
import { T } from './textos.ts'
import { botao } from './ui.ts'
import { criaTopo } from './topo.ts'
import { criaVista } from './viewport/vista.ts'
import { registraSketch } from './comandos/sketch.ts'
import { criaDesenho } from './sketch/desenho.ts'
import { ligaInteracao } from './sketch/interacao.ts'
import { criaSessaoSketch } from './sketch/sessao.ts'
import type { SessaoSketch } from './sketch/sessao.ts'
import { criaBarraSketch } from './sketch/barra.ts'
import { criaLigacao } from './teclado/ligacao.ts'
import { criaSolido } from './features/solido.ts'
import { criaTabelaParametros } from './features/parametros-ui.ts'
import { criaCartaoAjuda } from './ajuda/cartao.ts'
import { criaBuscaComando } from './ajuda/busca.ts'
import { instalaPonte } from './ponte/instala.ts'
import { criaExportador } from './imprimir/exportar.ts'
import { criaPainelImprimir } from './imprimir/painel.ts'
import { criaTabelaSlots } from './imprimir/slots.ts'
import { criaOverhang } from './imprimir/overhang.ts'
import { criaOrientacaoUi } from './imprimir/orientacao-ui.ts'
import { criaCustomizar } from './customizar/modo.ts'
import { criaExpor } from './customizar/expor.ts'
import { lerHash } from './customizar/schema.ts'
import { criaImportar } from './importar/ui.ts'
import { criaArquivos } from './arquivos.ts'
import { aplicaAliases, leAliases, parseAliases, salvaAliases } from './linha/aliases.ts'

const $ = (id: string) => document.getElementById(id)!
document.title = T.titulo

const projeto = criaProjeto(novoDocumento())
let prefs = lePrefs()
let tema = aplicaTema(prefs.tema)

const vista = criaVista($('vista'))
vista.setNavegacao(prefs.navegacao)
vista.setPixelRatioMax(prefs.pixels)

// ---- aviso: linha de comando (histórico) + toast, porque a linha some no celular ----
const toast = $('toast')
let tToast = 0
const linhaReg = criaRegistro()
registraBasicos(linhaReg, projeto)
let sessao!: SessaoSketch // criada depois da barra de status (precisa dos modos); a linha só a consulta quando já existe
const linha = criaLinha($('linha'), linhaReg, {
  ativo: () => !!sessao && sessao.ferramenta !== null, prompt: () => sessao.prompt,
  texto: t => void sessao.texto(t), vazio: () => sessao.enter(), esc: () => sessao.esc(),
})
function aviso(texto: string, erro = false) {
  linha.aviso(texto, erro)
  toast.textContent = texto; toast.classList.toggle('erro', erro); toast.hidden = false
  clearTimeout(tToast); tToast = window.setTimeout(() => { toast.hidden = true }, 6000)
}

// ---- preferências ----
function muda(p: Prefs) {
  prefs = p
  salvaPrefs(p)
  tema = aplicaTema(p.tema)
  vista.aplicaTema(); vista.setNavegacao(p.navegacao); vista.setPixelRatioMax(p.pixels)
  cards.marcaPixels(p.pixels)
  topo.atualiza(projeto, tema)
}
const dialogo = criaDialogoPrefs(() => prefs, muda, {
  texto: () => leAliases(),
  aplica(t) {
    const { defs, erros } = parseAliases(t), r = aplicaAliases(linhaReg, defs)
    salvaAliases(t)
    return { aplicados: r.aplicados, erros: [...erros.map(e => T.ajuda.aliases.linhaInvalida(e.linha, e.texto)), ...r.erros.map(e => T.ajuda.aliases.comandoInexistente(e.alias, e.comando))] }
  },
  restaura: () => { salvaAliases(''); return '' }, // aliases tirados do texto só somem do registro ao recarregar
})
aoMudarSistema(() => { if (prefs.tema === 'auto') muda(prefs) })

// ---- arquivo ----
const arquivo = {
  novo() {
    if (!confirm(T.arquivo.novoConfirma)) return
    projeto.substitui(novoDocumento(projeto.doc.impressora)); aviso(T.arquivo.novoOk)
  },
}
const arquivos = criaArquivos({ projeto, aviso })

// ---- UI ----
const topo = criaTopo($('topo'), {
  novo: arquivo.novo, abrir: () => void arquivos.abrir(), salvar: () => void arquivos.salvar(), salvarComo: () => void arquivos.salvarComo(),
  recentes: () => arquivos.recentes(), abreRecente: id => void arquivos.abreRecente(id), importar: () => importar.abreSeletor(),
  abasVivas: [0, 1, 3],
  desfazer: () => void projeto.desfaz(), refazer: () => void projeto.refaz(),
  alternaTema: () => muda({ ...prefs, tema: tema === 'claro' ? 'escuro' : 'claro' }),
  prefs: () => dialogo.abre(),
  impressora: id => projeto.executa(definirImpressora(id)),
  aba: i => {
    if (i === 0) sessao.entra(); else sessao.sai()
    if (i === 3) { const d = paineis.hosts.imprimir.closest('details'); if (d) d.open = true; paineis.hosts.imprimir.scrollIntoView({ block: 'nearest' }) }
  },
})
const paineis = criaPaineis($('esq'), $('dir'))
const cards = criaCards($('vista'), vista, prefs.pixels, pixels => muda({ ...prefs, pixels }))
const barra = criaBarra($('status'), (m, e) => { if (m === 'grid') vista.ligaGrade(e.grid) })

const abaDir = $('abaDir'), corpo = $('corpo')
abaDir.textContent = T.dir.recolher
const alternaPainelDir = () => corpo.classList.toggle('sem-dir')
abaDir.onclick = alternaPainelDir

// ---- sketch (F1): sessão, desenho, ponteiro, barra e teclado ----
sessao = criaSessaoSketch({
  projeto, escreve: (t, tipo) => linha.escreve(t, tipo), modos: () => barra.estado,
  mmPorPixel: () => vista.mmPorPixel(), confirma: t => confirm(t),
})
registraSketch(linhaReg, sessao, projeto)
aplicaAliases(linhaReg, parseAliases(leAliases()).defs) // aliases do usuário (Preferências); depois de registrar todos os comandos
const cartaoAjuda = criaCartaoAjuda(linhaReg), buscaComando = criaBuscaComando(linhaReg, n => void linha.sessao.envia(n))
const desenho = criaDesenho(vista, $('vista'))
const barraSketch = criaBarraSketch($('vista'), sessao)
const interacao = ligaInteracao({ vista, sessao, desenho, host: $('vista'), modos: () => barra.estado, aoCursor: p => barra.cursor(p) })
let regenMs = 0
let painelImprimir: ReturnType<typeof criaPainelImprimir> | undefined, orientacaoUi: ReturnType<typeof criaOrientacaoUi> | undefined
const solido = criaSolido({
  projeto, vista, sessao, reg: linhaReg, aviso, confirma: t => confirm(t),
  hosts: { ...paineis.hosts, vista: $('vista') },
  aoMs: ms => { regenMs = ms },
  aoCorpos: () => { painelImprimir?.atualiza(); orientacaoUi?.atualiza() },
})
instalaPonte({ projeto, vista, status: $('status'), reg: linhaReg, aviso, aguarda: solido.api.aguarda })
const malhasPrevia = () => new Map([...solido.dados.corpos].map(([id, c]) => [id, { posicoes: c.pos, indices: c.idx }]))
const entrega = (a: { nome: string; bytes: Uint8Array }) => {
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([a.bytes as BlobPart])), download: a.nome })
  link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
const exportador = criaExportador({
  doc: () => projeto.doc, corposFinos: () => solido.corposFinos(), ocultos: () => solido.dados.ocultos,
  miniatura: async () => vista.capturaIso(), cancelaGeracao: () => solido.cancelaGeracao(), entrega,
})
painelImprimir = criaPainelImprimir(paineis.hosts.imprimir, { projeto, corpos: malhasPrevia, ocultos: () => solido.dados.ocultos, exportador, aviso })
const tabelaSlots = criaTabelaSlots(paineis.hosts.slots, projeto)
const overhang = criaOverhang(vista)
orientacaoUi = criaOrientacaoUi(paineis.hosts.orientacao, {
  projeto, overhang, corpos: () => solido.dados.corpos.values(), ocultos: () => solido.dados.ocultos, aviso,
  acoes: { apoiar: () => solido.iniciaApoiar(), soltar: () => solido.orienta('soltar'), centralizar: () => solido.orienta('centralizar') },
})
const expor = criaExpor(paineis.hosts.expor, projeto, aviso)
const customizar = criaCustomizar({ projeto, host: paineis.hosts.customizar, aviso, confirma: t => confirm(t) })
const importar = criaImportar({ projeto, vista, reg: linhaReg, aviso })
paineis.hosts.importar.append(botao(T.importar.botao, () => importar.abreSeletor()))
linhaReg.registra({ nome: 'OVERHANG', aliases: ['OV'], descricao: T.orient.cmd.OVERHANG, executa: () => orientacaoUi!.alterna() })
linhaReg.registra({ nome: 'CUSTOMIZAR', aliases: ['CUST'], descricao: T.customizar.titulo, executa: () => customizar.entra() })
const tabelaParametros = criaTabelaParametros(paineis.hosts.parametros, projeto, aviso)
const teclado = criaLigacao({ sessao, linha, imediatasBlender: () => prefs.teclasBlender, proximoCampo: () => interacao.proximoCampo(), solido })
let sketchAtivo = ''
sessao.aoMudar(() => {
  linha.refresca(); barraSketch.atualiza(); topo.marcaAba(sessao.ativo ? 0 : 1)
  const id = sessao.ativo ? sessao.sketchId ?? '' : ''
  if (id && id !== sketchAtivo) { const pl = sessao.vista()?.sk.plano; if (pl) vista.alinhaAoPlano(pl.base) }
  sketchAtivo = id
})

instalaAtalhos({
  vista, linha, barra, alternaPainelDir, teclado, ajuda: () => cartaoAjuda.abre(), busca: () => buscaComando.abre(),
  desfazer: () => void projeto.desfaz(), refazer: () => void projeto.refaz(), salvar: () => void arquivos.salvar(),
  aoNavegar: () => cards.marcaProjecao(vista.ortografica),
})

// cursor X/Y e HUD (tempo do último quadro; as regenerações da F2 chamam o mesmo ponto)
vista.aoCursor(p => barra.cursor(p))
let tHud = 0
vista.aoFrame(ms => {
  desenho.reposiciona(); solido.reposiciona()
  const agora = performance.now()
  if (agora - tHud < 500) return
  tHud = agora
  const h = cards.hud(ms)
  barra.hud(regenMs ? (regenMs > 450 ? 'erro' : regenMs > 300 ? 'aviso' : h.nivel) : h.nivel, regenMs ? `${h.texto} · ${T.status.regen(regenMs)}` : h.texto)
})

// ---- projeto → UI ----
let impressoraNaVista = ''
function atualiza() {
  topo.atualiza(projeto, tema)
  paineis.atualiza(projeto); tabelaParametros.atualiza(); tabelaSlots.atualiza(); expor.atualiza(); painelImprimir?.atualiza(); orientacaoUi?.atualiza()
  if (customizar.ativo) customizar.atualiza()
  if (projeto.doc.impressora !== impressoraNaVista) {
    impressoraNaVista = projeto.doc.impressora
    const imp = impressoraPorId(impressoraNaVista)
    if (imp) vista.setImpressora(imp.volume)
  }
}
projeto.aoMudar(atualiza)
atualiza()

// ---- persistência: recupera o projeto salvo e só então liga o autosave (para não sobrescrevê-lo com um vazio) ----
let semAutosave = false
void (async () => {
  try {
    if (lerHash(location.hash).ativo) {
      // modo customizar por link: o projeto do link não pode sobrescrever o projeto salvo no navegador (sem autosave)
      projeto.substitui(lerDocumento(JSON.stringify(exemploCaixa)))
      await customizar.iniciaPorHash(location.hash)
      semAutosave = true
    } else {
      const salvo = await carregaAtual()
      if (salvo) { projeto.substitui(salvo); aviso(T.arquivo.recuperado) }
      else { projeto.substitui(lerDocumento(JSON.stringify(exemploCaixa))); aviso(T.status.exemploCarregado) }
    }
  } catch { aviso(T.arquivo.recuperarFalhou, true) }
  if (!semAutosave) autosave(projeto, msg => aviso(msg, true))
})()

const imprimirApi = {
  /** Achados, massa, filamento, último export (nome, tamanho, hash) e estado do modo inclinação/customizar. */
  inspeciona: () => ({
    ...painelImprimir!.inspeciona(), ultimoExport: exportador.ultimo(), emAndamento: exportador.emAndamento(),
    overhang: overhang.ligado, slots: projeto.doc.slots ?? {}, expostos: projeto.doc.expostos ?? [], customizar: customizar.ativo,
    referencias: importar.quantidade(),
  }),
  /** Exporta sem diálogo de download (padrão): devolve nome, tamanho e hash do que seria baixado. */
  exporta: (formato: 'stl' | 'stl-tudo' | '3mf', opcoes: { ignoraBloqueio?: boolean; semDownload?: boolean } = {}) => exportador.exporta(formato, { semDownload: true, ...opcoes }),
  cancela: () => exportador.cancela(),
  overhangLigado: (ligado?: boolean) => { if (ligado !== undefined && ligado !== overhang.ligado) orientacaoUi!.alterna(); return overhang.ligado },
  customizar,
}
Object.assign(window, { __3dm: { projeto, vista, barra, linha, solido: solido.api, imprimir: imprimirApi, sketch: {
  sessao, inspeciona: () => sessao.inspeciona(),
  /** Tecla sem teclado real: tecla('g'), tecla('x'), tecla('Enter'). */
  tecla: (key: string, m: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) => teclado.tecla({ key, ...m }),
  /** Linha de comando sem digitar: executa('REC'), executa('0,0'), executa('@80,50'). */
  executa: (texto: string) => linha.sessao.envia(texto),
} } }) // conferência manual e testes no navegador (checklist do relatório)
