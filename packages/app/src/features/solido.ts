// Controlador do modo Sólido (F2): regenera pelo worker, desenha os corpos, liga árvore, painel de feature, G/R/S, medir e cotas 3D.
// Os módulos de UI não se conhecem; tudo passa por aqui. Prévia = documento clonado com a feature em edição (sem undo).
import * as THREE from 'three'
import type { Documento, Feature } from '@3dm/core/doc'
import { adicionaFeature, editaFeature, idLivre, moveMarcador, removeFeature, suprimeFeature } from '@3dm/core/features'
import { bbox as bboxMalha, fechada, volume as volumeMalha } from '@3dm/core/malha'
import type { StatusFeature } from '@3dm/core/regen'
import type { Projeto } from '../projeto.ts'
import type { Contexto, Registro } from '../linha/registro.ts'
import type { SessaoSketch } from '../sketch/sessao.ts'
import type { Acao } from '../teclado/despachante.ts'
import type { Vista } from '../viewport/vista.ts'
import { el } from '../ui.ts'
import { criaGeometria } from '../worker/cliente.ts'
import { orientacaoParaFeature, soltarNaMesa, centralizar as centralizarMesa } from '@3dm/core/imprimir'
import { impressoraPorId } from '@3dm/core/printers'
import { criaCorSlotCorpo } from '../imprimir/slots.ts'
import { criaArvore } from './arvore.ts'
import type { AcoesArvore, CorpoInfo, DadosSolido, V3 } from './contrato.ts'
import { criaCorpos3d } from './corpos3d.ts'
import { criaCotas3d } from './cotas3d.ts'
import { arrastaAnel, arrastaSeta, pegaAlca, tamanhoGizmo } from './gizmo.ts'
import type { Alca, Raio } from './gizmo.ts'
import { criaGizmo3d } from './gizmo3d.ts'
import { ESQUEMAS, novaFeature } from './esquemas.ts'
import { criaMedicao, snapar } from './medir-modelo.ts'
import type { ModoMedir } from './medir-modelo.ts'
import { criaMedirUI } from './medir-ui.ts'
import { abrePainel } from './painel.ts'
import { T } from '../textos.ts'
import { criaTransformacaoSolido } from './transformar.ts'

export interface DepsSolido {
  projeto: Projeto
  vista: Vista
  sessao: SessaoSketch
  reg: Registro
  aviso(texto: string, erro?: boolean): void
  confirma(texto: string): boolean
  /** Hospedeiros: árvore (esquerda), painel de feature e propriedades (direita), camada da vista (rótulos). */
  hosts: { features: HTMLElement; painel: HTMLElement; propriedades: HTMLElement; vista: HTMLElement }
  aoMs(ms: number): void
  /** Depois de cada redesenho dos corpos (modo inclinação, painel Imprimir). */
  aoCorpos?(): void
}

const PALETA = ['#b8b4ac', '#6a8fb0', '#b08f6a', '#8fb06a', '#a06ab0', '#b06a7e']
const PREFIXO: Record<string, string> = {
  extrude: 'ex', revolve: 'rv', caixa: 'cx', cilindro: 'cl', esfera: 'sp', cone: 'cn', toro: 'to', booleana: 'bo',
  shell: 'sh', furo: 'fu', padrao: 'pa', espelho: 'es', corte: 'co', transformacao: 'tr',
}
/** nome, aliases, tipo de feature, ajuste do rascunho. O alias vale só fora do sketch quando já existe um igual no sketch. */
const COMANDOS: { nome: string; aliases: string[]; tipo: string; op?: string }[] = [
  { nome: 'EXTRUDAR', aliases: ['EXT', 'EXTRUDE', 'E'], tipo: 'extrude' }, { nome: 'REVOLVER', aliases: ['REV'], tipo: 'revolve' },
  { nome: 'UNIAO', aliases: ['UNI', 'UNION'], tipo: 'booleana', op: 'unir' }, { nome: 'SUBTRAIR', aliases: ['SU', 'SUBTRACT'], tipo: 'booleana', op: 'subtrair' },
  { nome: 'INTERSECAO', aliases: ['IN', 'INTERSECT'], tipo: 'booleana', op: 'interseccao' },
  { nome: 'CAIXA', aliases: ['BOX'], tipo: 'caixa' }, { nome: 'CILINDRO', aliases: ['CYL'], tipo: 'cilindro' }, { nome: 'ESFERA', aliases: ['SPH'], tipo: 'esfera' },
  { nome: 'CONE', aliases: ['CONE'], tipo: 'cone' }, { nome: 'TORO', aliases: ['TOR'], tipo: 'toro' }, { nome: 'SHELL', aliases: ['SHELL'], tipo: 'shell' },
  { nome: 'FURO', aliases: ['HOLE'], tipo: 'furo' }, { nome: 'PADRAO', aliases: ['AR'], tipo: 'padrao' }, { nome: 'ESPELHAR', aliases: ['MI'], tipo: 'espelho' },
  { nome: 'CORTE', aliases: ['SLICE'], tipo: 'corte' },
]

export function criaSolido(d: DepsSolido) {
  const { projeto, vista, sessao } = d
  const geo = criaGeometria()
  const corpos3d = criaCorpos3d(vista)
  const medicao = criaMedicao()
  const medirUI = criaMedirUI(vista, d.hosts.vista)
  const cotas3d = criaCotas3d(vista, d.hosts.vista)
  const tf = criaTransformacaoSolido()
  const gizmo3d = criaGizmo3d(vista)
  let gizmoLigado = false

  // ---- estado ----
  const dados = {
    status: new Map<string, StatusFeature>(), corpos: new Map<string, CorpoInfo>(), selecionada: null as string | null,
    ocultos: new Set<string>(), corposSelecionados: new Set<string>(), msUltima: 0,
  }
  const dadosLeitura = (): DadosSolido => dados
  let recalculadas: string[] = []
  let previa: Documento | null = null
  let cotasLigadas = false
  let apoiando = false // LF: o próximo clique numa face apoia o corpo na mesa
  const TOL_EXPORT_APP = 0.01 // igual a TOL_EXPORT do kernel (o kernel só pode ser importado no worker)
  let seq = 0
  let pendente: Promise<void> = Promise.resolve()
  const docAtivo = (): Documento => previa ?? projeto.doc
  const ehSketch = (f: Feature) => f.tipo === 'sketch'

  // ---- regeneração ----
  function infoDe(id: string, pos: Float32Array, idx: Uint32Array): CorpoInfo {
    const m = { posicoes: pos, indices: idx }
    return { id, pos, idx, bbox: bboxMalha(m), volume: volumeMalha(m), fechada: fechada(m), tri: idx.length / 3 }
  }
  function redesenha() {
    const doc = docAtivo()
    const cores: Record<string, string> = {}
    ;[...dados.corpos.keys()].forEach((id, i) => { cores[id] = doc.aparencia[id]?.cor ?? PALETA[i % PALETA.length] })
    corpos3d.atualiza(dados.corpos.values(), cores, dados.ocultos, dados.corposSelecionados)
    const vis = [...dados.corpos.values()].filter(c => !dados.ocultos.has(c.id))
    const caixa = vis.length ? {
      min: [0, 1, 2].map(i => Math.min(...vis.map(c => c.bbox.min[i]))) as V3,
      max: [0, 1, 2].map(i => Math.max(...vis.map(c => c.bbox.max[i]))) as V3,
    } : null
    cotas3d.atualiza(caixa, cotasLigadas)
    arvore.atualiza(); propriedades(); atualizaGizmo(); d.aoCorpos?.()
  }
  function pede(): Promise<void> {
    const meu = ++seq
    pendente = geo.pede(docAtivo()).then(r => {
      if (!r || meu !== seq) return
      if ('erro' in r) return d.aviso(T.solido.falhouRegen(r.erro), true)
      dados.status = new Map(r.status); dados.msUltima = r.ms; recalculadas = r.recalculadas
      dados.corpos = new Map(r.corpos.map(c => [c.id, infoDe(c.id, c.pos, c.idx)]))
      for (const s of [dados.ocultos, dados.corposSelecionados]) for (const id of s) if (!dados.corpos.has(id)) s.delete(id)
      redesenha(); d.aoMs(r.ms)
    }).catch(e => d.aviso(T.solido.falhouRegen((e as Error).message), true))
    return pendente
  }
  projeto.aoMudar(() => { if (!previa) { void pede() } else arvore.atualiza() })

  // ---- prévia (documento clonado, sem undo) ----
  function comPrevia(fs: Feature[], substitui?: string) {
    const c = structuredClone(projeto.doc)
    if (substitui) { const i = c.features.findIndex(f => f.id === substitui); if (i >= 0) c.features[i] = fs[0] } else for (const f of fs) adicionaFeature(f).fazer(c)
    previa = c; void pede()
  }
  function limpaPrevia() { previa = null; void pede() }

  // ---- árvore ----
  const acoesArvore: AcoesArvore = {
    seleciona(id) { dados.selecionada = id; dados.corposSelecionados = new Set(id && dados.corpos.has(id) ? [id] : []); redesenha() },
    edita(id) { const f = projeto.doc.features.find(x => x.id === id); if (!f) return; if (ehSketch(f)) { sessao.entra(); return } abre(structuredClone(f), false) },
    alternaOlho(id) { if (dados.ocultos.has(id)) dados.ocultos.delete(id); else dados.ocultos.add(id); redesenha() },
    moveMarcador: id => executa(moveMarcador(id)),
    suprime: (id, s) => executa(suprimeFeature(id, s)),
    remove(id) { if (d.confirma(T.solido.confirmaRemover(id))) executa(removeFeature(id)) },
  }
  const arvore = criaArvore(d.hosts.features, () => ({ features: projeto.doc.features, marcador: projeto.doc.marcadorHistorico }), dadosLeitura, acoesArvore)
  function executa(c: Parameters<Projeto['executa']>[0]) {
    try { projeto.executa(c) } catch (e) { d.aviso(T.solido.falhouComando((e as Error).message), true) }
  }

  // ---- painel de feature ----
  let painel: ReturnType<typeof abrePainel> | null = null
  function fechaPainel() { painel?.fecha(); painel = null; d.hosts.painel.replaceChildren() }
  function abre(f: Feature, nova: boolean) {
    fechaPainel()
    const doc = projeto.doc
    const original = nova ? null : structuredClone(doc.features.find(x => x.id === f.id) ?? f)
    painel = abrePainel(d.hosts.painel, {
      feature: f, nova, corpos: [...dados.corpos.keys()], sketches: doc.features.filter(ehSketch).map(x => x.id),
      aoPrevia: g => comPrevia([g], nova ? undefined : f.id),
      aoConfirma(g) {
        fechaPainel(); previa = null
        if (nova) executa(adicionaFeature(g))
        else {
          const patch: Record<string, unknown> = { ...g }
          for (const k of Object.keys(original ?? {})) if (!(k in g)) patch[k] = undefined
          delete patch.id; delete patch.tipo
          executa(editaFeature(f.id, patch))
        }
        void pede()
      },
      aoCancela() { fechaPainel(); limpaPrevia() },
    })
    comPrevia([f], nova ? undefined : f.id)
    painel.foco()
  }
  function nova(tipo: string, op?: string) {
    if (sessao.ativo) sessao.sai()
    const doc = projeto.doc
    const f = novaFeature(tipo, idLivre(doc, PREFIXO[tipo] ?? 'f'), { corpos: [...dados.corpos.keys()], sketches: doc.features.filter(ehSketch).map(x => x.id) })
    if (op) f.op = op
    abre(f, true)
  }
  function chanfro(modo: 'chanfro' | 'fillet') {
    const alvo = projeto.doc.features.find(f => f.id === dados.selecionada && f.tipo === 'extrude') ?? [...projeto.doc.features].reverse().find(f => f.tipo === 'extrude')
    if (!alvo) return d.aviso(T.solido.semExtrusao, true)
    const f = structuredClone(alvo)
    f.borda = { modo, tamanho: '1', onde: 'topo' }
    abre(f, false)
  }

  // ---- propriedades (direita) ----
  function propriedades() {
    const h = d.hosts.propriedades
    const f = projeto.doc.features.find(x => x.id === dados.selecionada)
    const c = dados.selecionada ? dados.corpos.get(dados.selecionada) : [...dados.corposSelecionados].map(i => dados.corpos.get(i))[0]
    const linhas: Node[] = []
    const par = (k: string, v: string) => linhas.push(el('dt', { textContent: k }), el('dd', { textContent: v }))
    if (f) {
      const st = dados.status.get(f.id)
      par(T.solido.prop.tipo, ESQUEMAS[f.tipo]?.rotulo ?? f.tipo); par(T.solido.prop.instancia, f.id)
      par(T.solido.prop.estado, T.solido.prop.estados[st?.estado ?? 'ok'] ?? '')
      if (st?.erro) par(T.solido.prop.erro, `${st.erro.causa} ${st.erro.correcao}`)
    }
    if (c) {
      const n = (x: number) => (+x.toFixed(2)).toString()
      par(T.solido.prop.corpo, c.id)
      par(T.solido.prop.bbox, `${n(c.bbox.max[0] - c.bbox.min[0])} × ${n(c.bbox.max[1] - c.bbox.min[1])} × ${n(c.bbox.max[2] - c.bbox.min[2])} mm`)
      par(T.solido.prop.volume, `${n(c.volume)} mm³`); par(T.solido.prop.triangulos, String(c.tri)); par(T.solido.prop.fechada, c.fechada ? T.solido.prop.sim : T.solido.prop.nao)
    }
    h.replaceChildren(...(linhas.length ? [el('dl', { id: 'info-selecao' }, ...linhas), ...(c ? [criaCorSlotCorpo(projeto, c.id)] : []), ...(f && !ehSketch(f) ? [el('button', { type: 'button', textContent: T.solido.prop.editar, onclick: () => acoesArvore.edita(f.id) })] : [])] : []))
  }

  // ---- orientação para impressão (viram feature de transformação) ----
  const alvosOrient = (): string[] => { const sel = [...dados.corposSelecionados]; return sel.length ? sel : [...dados.corpos.keys()].filter(id => !dados.ocultos.has(id)) }
  const volMesa = () => impressoraPorId(projeto.doc.impressora)?.volume ?? { x: 256, y: 256, z: 256 }
  function novaTransf(mover: V3, alvo: string): Feature {
    return { id: idLivre(projeto.doc, 'tr'), tipo: 'transformacao', alvo, mover }
  }
  function orienta(modo: 'soltar' | 'centralizar') {
    const ids = alvosOrient()
    if (!ids.length) return d.aviso(T.orient.semCorpo, true)
    for (const id of ids) {
      const c = dados.corpos.get(id)!
      const mover = modo === 'soltar' ? soltarNaMesa(c.bbox) : centralizarMesa(c.bbox, volMesa())
      executa(adicionaFeature(novaTransf(modo === 'soltar' ? mover : [mover[0], mover[1], 0], id)))
      d.aviso(T.orient.aplicado(id))
    }
  }
  function apoiaNaFace(id: string, tri: number) {
    const c = dados.corpos.get(id)
    if (!c) return
    executa(adicionaFeature(orientacaoParaFeature(idLivre(projeto.doc, 'tr'), { posicoes: c.pos, indices: c.idx }, tri, volMesa(), true, id) as unknown as Feature))
    d.aviso(T.orient.aplicado(id))
  }
  function iniciaApoiar() {
    if (sessao.ativo) sessao.sai()
    apoiando = true; d.aviso(T.orient.apoiarPrompt)
  }
  /** Regenera com tolerância de export (fina). null = cancelado. A prévia volta a ser calculada depois. */
  async function corposFinos(): Promise<Map<string, { posicoes: Float32Array; indices: Uint32Array }> | null> {
    const r = await geo.pede(projeto.doc, TOL_EXPORT_APP)
    void pede()
    if (!r) return null
    if ('erro' in r) throw new Error(r.erro)
    return new Map(r.corpos.map(c => [c.id, { posicoes: c.pos, indices: c.idx }]))
  }

  // ---- ponteiro: selecionar, transformar, medir ----
  const centroDe = (id: string): V3 => { const b = dados.corpos.get(id)!.bbox; return [0, 1, 2].map(i => (b.min[i] + b.max[i]) / 2) as V3 }
  let eixoTf: 'X' | 'Y' | 'Z' | null = null
  let inicioTf: THREE.Vector3 | null = null
  let centroTf = new THREE.Vector3()
  function atualizaPreviaTf() { const p = tf.previa(); if (p?.length) comPrevia(p); else limpaPrevia() }
  function inicia(letra: 'G' | 'R' | 'S', duplicar = false) {
    const ids = [...dados.corposSelecionados]
    if (!ids.length) return d.aviso(T.solido.semCorpo, true)
    tf.inicia(letra, ids.map(id => ({ id, centro: centroDe(id) })), { duplicar })
    eixoTf = null; inicioTf = null
    const cs = ids.map(centroDe); centroTf = new THREE.Vector3(...[0, 1, 2].map(i => cs.reduce((s, c) => s + c[i], 0) / cs.length) as V3)
    d.aviso(tf.rotulo)
  }
  function confirmaTf() {
    const usados = new Set(projeto.doc.features.map(f => f.id))
    const fs = tf.confirma(p => { let n = 1; while (usados.has(p + n)) n++; usados.add(p + n); return p + n })
    previa = null
    for (const f of fs) executa(adicionaFeature(f))
    void pede()
  }
  function cancelaTf() { tf.cancela(); limpaPrevia() }
  function moveTf(e: PointerEvent) {
    const n = new THREE.Vector3(...(vista.inspeciona().dir as V3))
    const plano = new THREE.Plane().setFromNormalAndCoplanarPoint(n, centroTf)
    const h = vista.raio(e.clientX, e.clientY).intersectPlane(plano, new THREE.Vector3())
    if (!h) return
    if (!inicioTf) inicioTf = h.clone()
    const a = inicioTf.clone().sub(centroTf), b = h.clone().sub(centroTf)
    const eixoV = new THREE.Vector3(eixoTf === 'X' ? 1 : 0, eixoTf === 'Y' ? 1 : 0, eixoTf === null || eixoTf === 'Z' ? 1 : 0)
    let ang = Math.atan2(n.dot(a.clone().cross(b)), a.dot(b)) * 180 / Math.PI
    if (n.dot(eixoV) < 0) ang = -ang
    const d3 = h.clone().sub(inicioTf)
    tf.mouse({ delta: [d3.x, d3.y, d3.z], angulo: ang, razao: a.length() > 1e-9 ? b.length() / a.length() : 1 }, e.ctrlKey)
    atualizaPreviaTf(); d.aviso(tf.rotulo)
  }
  function clicaMedir(e: PointerEvent) {
    const h = corpos3d.pega(e.clientX, e.clientY)
    const c = h ? dados.corpos.get(h.corpoId) : undefined
    if (!h || !c) return d.aviso(T.solido.medirSemCorpo, true)
    pontoMedir(c, h.ponto, h.tri)
  }
  function pontoMedir(c: CorpoInfo, ponto: V3, tri: number) {
    const m = medicao.modo
    const r = m === 'area' ? medicao.face(c, tri) : m === 'volume' ? medicao.corpo(c)
      : medicao.ponto(snapar(c, ponto, 10 * vista.mmPorPixel())?.p ?? ponto)
    medirUI.mostra(medicao.resultados, medicao.pendentes)
    d.aviso(r ? r.texto : medicao.prompt)
  }
  // ---- gizmo W: setas movem, anéis giram; arrastar vira a mesma feature de transformação do G/R/S ----
  function caixaSelecao(): { min: V3; max: V3 } | null {
    const cs = [...dados.corposSelecionados].map(i => dados.corpos.get(i)).filter((c): c is CorpoInfo => !!c)
    if (!cs.length) return null
    return { min: [0, 1, 2].map(i => Math.min(...cs.map(c => c.bbox.min[i]))) as V3, max: [0, 1, 2].map(i => Math.max(...cs.map(c => c.bbox.max[i]))) as V3 }
  }
  const centroCaixa = (b: { min: V3; max: V3 }): V3 => [0, 1, 2].map(i => (b.min[i] + b.max[i]) / 2) as V3
  function atualizaGizmo() {
    const b = gizmoLigado && !tf.ativa ? caixaSelecao() : null
    if (b) gizmo3d.mostra(centroCaixa(b), tamanhoGizmo(b)); else gizmo3d.esconde()
  }
  const raioDe = (e: PointerEvent): Raio => { const r = vista.raio(e.clientX, e.clientY); return { origem: [r.origin.x, r.origin.y, r.origin.z], dir: [r.direction.x, r.direction.y, r.direction.z] } }
  let arrasto: { alca: Alca; centro: V3; ini: Raio } | null = null
  function aplicaArrasto(delta: V3, angulo: number, ctrl: boolean) { tf.mouse({ delta, angulo, razao: 1 }, ctrl); atualizaPreviaTf(); d.aviso(tf.rotulo) }
  function iniciaArrasto(alca: Alca, ini: Raio, centro: V3) {
    const ids = [...dados.corposSelecionados]
    tf.inicia(alca.tipo === 'seta' ? 'G' : 'R', ids.map(id => ({ id, centro: centroDe(id) })), {})
    tf.eixo(alca.eixo, false); eixoTf = alca.eixo
    arrasto = { alca, centro, ini }; gizmo3d.destaca(alca)
  }
  function fimArrasto(confirma: boolean) { if (!arrasto) return; arrasto = null; gizmo3d.destaca(null); if (confirma) confirmaTf(); else cancelaTf() }
  function alternaGizmo() { gizmoLigado = !gizmoLigado; atualizaGizmo() }

  const canvas = vista.canvas
  canvas.addEventListener('pointermove', e => {
    if (arrasto) {
      const atual = raioDe(e)
      if (arrasto.alca.tipo === 'seta') aplicaArrasto(arrastaSeta(arrasto.alca.eixo, arrasto.centro, arrasto.ini, atual), 0, e.ctrlKey)
      else aplicaArrasto([0, 0, 0], arrastaAnel(arrasto.alca.eixo, arrasto.centro, arrasto.ini, atual), e.ctrlKey)
    } else if (tf.ativa) moveTf(e)
  })
  canvas.addEventListener('pointerup', e => { if (arrasto && e.button === 0) fimArrasto(true) })
  canvas.addEventListener('pointerdown', e => {
    if (sessao.ativo) return
    if (arrasto) { if (e.button === 2) fimArrasto(false); return }
    if (tf.ativa) { if (e.button === 0) confirmaTf(); else if (e.button === 2) cancelaTf(); return }
    if (e.button !== 0) return
    if (apoiando) { const h = corpos3d.pega(e.clientX, e.clientY); apoiando = false; if (h) apoiaNaFace(h.corpoId, h.tri); else d.aviso(T.solido.medirSemCorpo, true); return }
    if (medicao.modo) return clicaMedir(e)
    const cx = gizmoLigado ? caixaSelecao() : null
    if (cx) {
      const centro = centroCaixa(cx), ini = raioDe(e), alca = pegaAlca(ini, centro, tamanhoGizmo(cx), 12 * vista.mmPorPixel())
      if (alca) { canvas.setPointerCapture(e.pointerId); iniciaArrasto(alca, ini, centro); return }
    }
    const h = corpos3d.pega(e.clientX, e.clientY)
    if (!h) { dados.corposSelecionados = new Set(); dados.selecionada = null }
    else if (e.shiftKey) { if (!dados.corposSelecionados.delete(h.corpoId)) dados.corposSelecionados.add(h.corpoId); dados.selecionada = h.corpoId }
    else { dados.corposSelecionados = new Set([h.corpoId]); dados.selecionada = h.corpoId }
    redesenha()
  })

  // ---- teclado (ações do despachante fora do sketch). true = tratou ----
  function acao(a: Acao): boolean {
    switch (a.tipo) {
      case 'iniciaTransformacao': inicia(a.letra); return true
      case 'eixo': if (!tf.ativa) return false; eixoTf = a.eixo; tf.eixo(a.eixo, a.plano); atualizaPreviaTf(); d.aviso(tf.rotulo); return true
      case 'numero': if (!tf.ativa) return false; tf.numero(a.texto); atualizaPreviaTf(); d.aviso(tf.rotulo); return true
      case 'confirmaTransformacao': if (tf.ativa) confirmaTf(); return true
      case 'cancelaTransformacao': if (tf.ativa) cancelaTf(); return true
      case 'duplicaMove': inicia('G', true); return true
      case 'esconde': for (const id of dados.corposSelecionados) dados.ocultos.add(id); redesenha(); return true
      case 'mostraTudo': dados.ocultos.clear(); redesenha(); return true
      case 'isola': dados.ocultos = new Set([...dados.corpos.keys()].filter(id => !dados.corposSelecionados.has(id))); redesenha(); return true
      case 'menuAdicionar': menuAdicionar(); return true
      case 'apaga': case 'apagaConfirma': { const ids = [...dados.corposSelecionados].filter(id => projeto.doc.features.some(f => f.id === id)); for (const id of ids) acoesArvore.remove(id); return ids.length > 0 }
      case 'limpaSelecao': case 'cancelaComando':
        if (apoiando) { apoiando = false; return true }
        if (medicao.modo || medicao.resultados.length) { medicao.limpa(); medirUI.limpa(); return true }
        if (painel) { painel.fecha(); fechaPainel(); limpaPrevia(); return true }
        dados.corposSelecionados = new Set(); dados.selecionada = null; redesenha(); return true
      default: return false
    }
  }
  let menu: HTMLElement | null = null
  function menuAdicionar() {
    menu?.remove()
    menu = el('div', { class: 'menu-adicionar', id: 'menu-adicionar' }, el('b', { textContent: T.solido.menuAdicionar }),
      ...COMANDOS.map(c => el('button', { type: 'button', textContent: T.solido.cmd[c.nome] ?? c.nome, onclick: () => { menu?.remove(); menu = null; nova(c.tipo, c.op) } })))
    d.hosts.vista.append(menu)
  }

  // ---- comandos da linha (o alias do sketch tem prioridade enquanto o sketch está ativo) ----
  for (const c of COMANDOS) {
    for (const alias of c.aliases) {
      const anterior = d.reg.resolve(alias)
      d.reg.registra({
        nome: `${c.nome}#${alias}`, aliases: [alias], descricao: T.solido.cmd[c.nome] ?? c.nome,
        executa(ctx) { if (anterior && sessao.ativo) return anterior.executa(ctx); nova(c.tipo, c.op) },
      })
    }
  }
  const cmd = (nome: string, aliases: string[], executaFn: (ctx: Contexto) => void | Promise<void>) => {
    for (const alias of aliases) {
      const anterior = d.reg.resolve(alias)
      d.reg.registra({ nome: `${nome}#${alias}`, aliases: [alias], descricao: T.solido.cmd[nome] ?? nome, executa(ctx) { if (anterior && sessao.ativo) return anterior.executa(ctx); return executaFn(ctx) } })
    }
  }
  cmd('CHANFRO', ['CHA'], () => chanfro('chanfro'))
  cmd('CHANFRO', ['F'], () => chanfro('fillet'))
  cmd('MEDIR', ['DI', 'DIST'], () => { medicao.inicia('distancia'); d.aviso(medicao.prompt) })
  cmd('MEDIR', ['MEA', 'MEDIR'], async ctx => {
    const r = ((await ctx.pergunta(T.solido.modoMedir)) ?? '').trim().toUpperCase()
    if (!r) return
    const m = T.solido.modos[r[0]]
    if (!m) return ctx.escreve(T.solido.modoMedirInvalido(r), 'erro')
    medicao.inicia(m); d.aviso(medicao.prompt)
  })
  cmd('GIZMO', ['W'], () => alternaGizmo())
  cmd('LF', ['LF'], () => iniciaApoiar())
  cmd('SOLTAR', ['SOLTAR'], () => orienta('soltar'))
  cmd('CENTRAR', ['CENTRAR'], () => orienta('centralizar'))
  cmd('COTAS', ['COTAS', 'COT'], () => { cotasLigadas = !cotasLigadas; redesenha(); d.aviso(cotasLigadas ? T.solido.cotasLigadas : T.solido.cotasDesligadas) })

  // ---- API de conferência (window.__3dm.solido) ----
  const api = {
    inspeciona: () => ({
      features: projeto.doc.features.map(f => ({ id: f.id, tipo: f.tipo, estado: dados.status.get(f.id)?.estado ?? (ehSketch(f) ? 'ok' : 'pendente'), erro: dados.status.get(f.id)?.erro ?? null, suprimida: !!f.suprimida })),
      marcador: projeto.doc.marcadorHistorico,
      corpos: [...dados.corpos.values()].map(c => ({ id: c.id, bbox: c.bbox, volume: c.volume, tri: c.tri, fechada: c.fechada, oculto: dados.ocultos.has(c.id) })),
      ms: dados.msUltima, recalculadas, selecionada: dados.selecionada, corposSelecionados: [...dados.corposSelecionados],
      previa: previa !== null, painelAberto: painel !== null, transformando: tf.ativa ? tf.rotulo : null,
      medidas: medicao.resultados.map(r => ({ modo: r.modo, valor: r.valor, unidade: r.unidade, texto: r.texto })), medindo: medicao.modo,
      cotas: cotasLigadas, triangulosVisiveis: corpos3d.triangulosVisiveis(),
    }),
    aguarda: () => pendente,
    seleciona(ids: string[]) { dados.corposSelecionados = new Set(ids); dados.selecionada = ids[0] ?? null; redesenha() },
    abre: (tipo: string) => nova(tipo),
    painelFeature: () => painel?.feature() ?? null,
    confirmaPainel() { if (painel) { const g = painel.feature(); fechaPainel(); previa = null; executa(adicionaFeature(g)) } },
    medirPonto(p: V3) { medicao.ponto(p); medirUI.mostra(medicao.resultados, medicao.pendentes) },
    medirFace(id: string, tri: number) { const c = dados.corpos.get(id); if (c) pontoMedir(c, [0, 0, 0], tri) },
    medirCorpo(id: string) { const c = dados.corpos.get(id); if (c) pontoMedir(c, [0, 0, 0], 0) },
    corpos: () => dados.corpos,
    gizmo: (ligado?: boolean) => { gizmoLigado = ligado ?? !gizmoLigado; atualizaGizmo(); return { ligado: gizmoLigado, visivel: gizmo3d.visivel } },
    /** Simula o arraste do gizmo: seta = mm ao longo do eixo; anel = graus. Confirma como feature. */
    gizmoArrasta(tipo: 'seta' | 'anel', eixo: 'X' | 'Y' | 'Z', valor: number) {
      const ids = [...dados.corposSelecionados]; if (!ids.length) return
      tf.inicia(tipo === 'seta' ? 'G' : 'R', ids.map(id => ({ id, centro: centroDe(id) })), {}); tf.eixo(eixo, false)
      tf.mouse({ delta: [eixo === 'X' ? valor : 0, eixo === 'Y' ? valor : 0, eixo === 'Z' ? valor : 0], angulo: tipo === 'anel' ? valor : 0, razao: 1 }, false)
      confirmaTf()
    },
  }

  return {
    acao, api, dados, get selecao() { return dados.corposSelecionados }, get ativo() { return tf.ativa },
    /** Tecla W (liga/desliga o gizmo) com a linha vazia, fora do sketch. */
    tecla(t: { key: string; ctrl?: boolean; alt?: boolean; shift?: boolean }, linhaVazia: boolean): boolean {
      if (!linhaVazia || t.ctrl || t.alt || t.shift || t.key.toLowerCase() !== 'w') return false
      alternaGizmo(); return true
    },
    reposiciona() { medirUI.reposiciona(); cotas3d.reposiciona() },
    pede, atualiza: () => { arvore.atualiza(); propriedades() },
    corposFinos, cancelaGeracao: () => geo.reinicia(), iniciaApoiar, orienta, apoiaNaFace,
    dispose() { gizmo3d.dispose(); geo.dispose(); corpos3d.dispose(); medirUI.dispose(); cotas3d.dispose() },
  }
}
export type Solido = ReturnType<typeof criaSolido>
