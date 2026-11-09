// Viewport 3D (base: vista.ts do modular_terrain_system, reduzida ao que a F0 precisa).
// Z para cima, origem no canto da mesa (como nos fatiadores). Grade adaptativa 1/10 mm, volume da impressora em
// wireframe + mesa, eixos, gizmo, vistas do numpad e presets de navegação. Renderiza só quando algo muda.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper.js'
import { acaoDoMouse, passoGrade, teclaNumpad } from './nav.ts'
import type { Preset, Vec3 } from './nav.ts'

export interface Volume { x: number; y: number; z: number }

const FOV = 35
const css = (nome: string) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim()

export function criaVista(el: HTMLElement) {
  const render = new THREE.WebGLRenderer({ antialias: true })
  render.autoClear = false // o gizmo desenha por cima da cena
  render.setPixelRatio(Math.min(devicePixelRatio, 2))
  el.appendChild(render.domElement)
  render.domElement.addEventListener('contextmenu', e => e.preventDefault()) // botão direito fica para o menu de contexto (F1)

  const cena = new THREE.Scene()
  cena.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.2))
  const sol = new THREE.DirectionalLight(0xffffff, 2)
  sol.position.set(-40, -60, 120)
  cena.add(sol)

  const persp = new THREE.PerspectiveCamera(FOV, 1, 1, 5000)
  const orto = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000)
  persp.up.set(0, 0, 1); orto.up.set(0, 0, 1)
  let cam: THREE.PerspectiveCamera | THREE.OrthographicCamera = persp
  let metadeOrto = 100 // meia altura da vista ortográfica com zoom 1

  const ctl = new OrbitControls(cam, render.domElement)
  ctl.zoomToCursor = true // a roda dá zoom no cursor
  ctl.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
  const gizmo = new ViewHelper(cam, render.domElement)
  gizmo.setLabels('X', 'Y', 'Z')

  let sujo = true
  const pedeRender = () => { sujo = true }
  ctl.addEventListener('change', pedeRender)

  // ---- navegação (presets) ----
  let preset: Preset = 'blender'
  function setNavegacao(p: Preset) {
    preset = p
    // OrbitControls já troca orbitar por pan quando Shift está apertado, igual a acaoDoMouse.
    ctl.mouseButtons = { LEFT: null, MIDDLE: acaoDoMouse(p, 1, false) === 'orbitar' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN, RIGHT: null }
  }
  setNavegacao('blender')

  // duplo clique do meio: enquadrar tudo. Captura: roda antes do OrbitControls, para o pivô da órbita valer já no arrasto.
  let ultimoMeio = 0
  render.domElement.addEventListener('pointerdown', e => {
    anim = null
    if (e.button !== 1) return
    if (acaoDoMouse(preset, 1, e.shiftKey) === 'orbitar') pivotaNoCursor(e)
    if (e.timeStamp - ultimoMeio < 350) enquadra()
    ultimoMeio = e.timeStamp
  }, { capture: true })

  // ---- cena fixa: mesa, volume, grade, eixos ----
  let vol: Volume = { x: 256, y: 256, z: 256 }
  const impressora = new THREE.Group(), grade = new THREE.Group(), eixos = new THREE.Group()
  impressora.name = 'impressora'; grade.name = 'grade'; eixos.name = 'eixos' // a captura MCP os esconde
  cena.add(impressora, grade, eixos)
  const matVolume = new THREE.LineBasicMaterial(), matMenor = new THREE.LineBasicMaterial(), matMaior = new THREE.LineBasicMaterial()
  const matMesa = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
  const matEixo = (['--eixo-x', '--eixo-y', '--eixo-z'] as const).map(() => new THREE.LineBasicMaterial())

  function limpa(g: THREE.Group) {
    for (const k of g.children) if (k instanceof THREE.Mesh || k instanceof THREE.LineSegments) k.geometry.dispose()
    g.clear()
  }
  const segmentos = (pts: number[], m: THREE.LineBasicMaterial) =>
    new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), m)

  function montaImpressora() {
    limpa(impressora)
    const mesa = new THREE.Mesh(new THREE.PlaneGeometry(vol.x, vol.y), matMesa)
    mesa.position.set(vol.x / 2, vol.y / 2, -0.1) // um pouco abaixo da grade, sem brigar com ela
    const caixa = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(vol.x, vol.y, vol.z)), matVolume)
    caixa.position.set(vol.x / 2, vol.y / 2, vol.z / 2)
    impressora.add(mesa, caixa)
    limpa(eixos)
    const n = Math.min(30, Math.min(vol.x, vol.y) / 4)
    ;[[n, 0, 0], [0, n, 0], [0, 0, n]].forEach((p, i) => eixos.add(segmentos([0, 0, 0, ...p], matEixo[i])))
    nivelGrade = 0 // força refazer a grade
    pedeRender()
  }

  let nivelGrade = 0
  function montaGrade(menor: number) {
    limpa(grade)
    nivelGrade = menor
    const maior = menor * 10, a: number[] = [], b: number[] = []
    const linhas = (limite: number, outro: number, vertical: boolean) => {
      for (let v = 0; v <= limite + 1e-9; v += menor) {
        const dest = Math.abs(v / maior - Math.round(v / maior)) < 1e-9 ? b : a
        dest.push(...(vertical ? [v, 0, 0, v, outro, 0] : [0, v, 0, outro, v, 0]))
      }
    }
    linhas(vol.x, vol.y, true); linhas(vol.y, vol.x, false)
    grade.add(segmentos(a, matMenor), segmentos(b, matMaior))
  }

  /** Pixels na tela por mm no plano do alvo. */
  function pxPorMm() {
    const h = el.clientHeight || 1
    if (cam instanceof THREE.OrthographicCamera) return h / (2 * metadeOrto / cam.zoom)
    return h / (2 * cam.position.distanceTo(ctl.target) * Math.tan(THREE.MathUtils.degToRad(FOV / 2)))
  }

  function aplicaTema() {
    cena.background = new THREE.Color(css('--bg'))
    matVolume.color.set(css('--volume-impressora'))
    matMenor.color.set(css('--grid-menor')); matMaior.color.set(css('--grid-maior'))
    matMesa.color.set(css('--mesa'))
    ;(['--eixo-x', '--eixo-y', '--eixo-z'] as const).forEach((t, i) => matEixo[i].color.set(css(t)))
    pedeRender()
  }

  function setImpressora(v: Volume) {
    vol = v
    montaImpressora()
    enquadra()
  }

  const ligaGrade = (on: boolean) => { grade.visible = on; pedeRender() }

  // ---- câmera: vistas, animação, enquadrar ----
  let anim: { d0: THREE.Vector3; q: THREE.Quaternion; dist: number; t0: number } | null = null
  const dir = new THREE.Vector3()

  /** Câmera do lado `d` do alvo (o desvio mínimo em Y põe +Y no alto da tela nas vistas de cima/baixo), com animação de 300 ms. */
  function vistaPara(d: Vec3) {
    const d0 = cam.position.clone().sub(ctl.target), dist = d0.length()
    const d1 = new THREE.Vector3(...d)
    if (d1.z) d1.y -= .001
    d0.normalize()
    anim = { d0, q: new THREE.Quaternion().setFromUnitVectors(d0, d1.normalize()), dist, t0: performance.now() }
    pedeRender()
  }
  function anima() {
    if (!anim) return
    const t = Math.min(1, (performance.now() - anim.t0) / 300)
    const q = new THREE.Quaternion().slerp(anim.q, t * t * (3 - 2 * t))
    cam.position.copy(ctl.target).addScaledVector(anim.d0.clone().applyQuaternion(q), anim.dist)
    if (t >= 1) anim = null
    pedeRender()
  }

  /** Enquadra o volume da impressora na pose isométrica (Home). */
  function enquadra() {
    anim = null
    const centro = new THREE.Vector3(vol.x / 2, vol.y / 2, vol.z / 2), r = centro.length()
    ctl.target.copy(centro)
    const meia = THREE.MathUtils.degToRad(FOV / 2), f = Math.min(meia, Math.atan(Math.tan(meia) * Math.max(persp.aspect, .1)))
    const dist = r * 1.25 / Math.sin(f)
    cam.position.copy(centro).addScaledVector(new THREE.Vector3(1, -1, 1).normalize(), dist)
    metadeOrto = dist * Math.tan(meia)
    orto.zoom = 1
    ajustaOrto()
    ctl.update()
    pedeRender()
  }

  function ajustaOrto() {
    const a = persp.aspect
    orto.left = -metadeOrto * a; orto.right = metadeOrto * a; orto.top = metadeOrto; orto.bottom = -metadeOrto
    orto.updateProjectionMatrix()
  }

  /** Alterna perspectiva/ortográfica mantendo o enquadramento. Devolve true se ficou ortográfica. */
  function alternaProjecao(): boolean {
    const meia = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const para = cam === persp ? orto : persp
    para.quaternion.copy(cam.quaternion)
    if (para === orto) {
      metadeOrto = cam.position.distanceTo(ctl.target) * meia; orto.zoom = 1; ajustaOrto()
      orto.position.copy(cam.position)
    } else { // mantém o tamanho aparente: distância = meia altura visível / tan(fov/2)
      persp.position.copy(ctl.target).addScaledVector(cam.position.clone().sub(ctl.target).normalize(), metadeOrto / orto.zoom / meia)
    }
    cam = para
    ctl.object = cam as THREE.PerspectiveCamera // OrbitControls aceita as duas; o tipo só declara a perspectiva
    ;(gizmo as unknown as { camera: THREE.Camera }).camera = cam // o ViewHelper aceita trocar de câmera, mas o tipo não declara
    ctl.update(); pedeRender()
    return cam === orto
  }

  // gizmo: o clique é nosso (o do ViewHelper supõe y para cima). A esfera de um eixo leva a câmera para aquele lado.
  const EIXOS = ([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as Vec3[]).map(a => new THREE.Vector3(...a))
  let apertou: [number, number] | null = null
  render.domElement.addEventListener('pointerdown', e => { apertou = [e.clientX, e.clientY] })
  render.domElement.addEventListener('click', e => {
    if (!apertou || Math.hypot(e.clientX - apertou[0], e.clientY - apertou[1]) > 4) return // arrastar não conta como clique
    const r = render.domElement.getBoundingClientRect(), dx = e.clientX - (r.right - 64), dy = e.clientY - (r.bottom - 64)
    if (Math.abs(dx) > 64 || Math.abs(dy) > 64) return
    cam.updateMatrixWorld()
    const col = (i: number) => new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, i) // direita, cima, para o observador
    const dr = col(0), dc = col(1), dv = col(2)
    let alvo: Vec3 | null = null, prof = -Infinity
    for (const a of EIXOS) { // 32 px por unidade no gizmo; vence a esfera mais perto do observador
      if (Math.hypot(a.dot(dr) * 32 - dx, -a.dot(dc) * 32 - dy) < 14 && a.dot(dv) > prof) { alvo = a.toArray() as Vec3; prof = a.dot(dv) }
    }
    if (alvo) vistaPara(alvo)
  })

  /** Trata uma tecla do numpad. Devolve true se era de navegação. */
  function tecla(code: string, ctrl: boolean): boolean {
    const a = teclaNumpad(code, ctrl)
    if (!a) return false
    switch (a.tipo) {
      case 'vista': vistaPara(a.dir); break
      case 'oposta': vistaPara(cam.position.clone().sub(ctl.target).negate().normalize().toArray() as Vec3); break
      case 'persp': alternaProjecao(); break
      case 'enquadra': enquadra(); break
      case 'zoom': zoom(a.fator); break
      case 'orbita': orbita(a.az, a.el); break
      case 'pan': pan(a.dx, a.dy); break
    }
    return true
  }
  function zoom(f: number) {
    if (cam instanceof THREE.OrthographicCamera) { cam.zoom /= f; cam.updateProjectionMatrix() }
    else cam.position.copy(ctl.target).addScaledVector(cam.position.clone().sub(ctl.target), f)
    ctl.update(); pedeRender()
  }
  function orbita(az: number, el: number) {
    const o = cam.position.clone().sub(ctl.target), r = o.length()
    const theta = Math.atan2(o.y, o.x) - THREE.MathUtils.degToRad(az)
    const phi = Math.min(Math.PI - .01, Math.max(.01, Math.acos(o.z / r) - THREE.MathUtils.degToRad(el)))
    cam.position.copy(ctl.target).add(new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)).multiplyScalar(r))
    ctl.update(); pedeRender()
  }
  function pan(dx: number, dy: number) {
    const altura = cam instanceof THREE.OrthographicCamera ? 2 * metadeOrto / cam.zoom : 2 * cam.position.distanceTo(ctl.target) * Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    cam.updateMatrixWorld()
    const d = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(dx * altura * persp.aspect)
      .addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1), dy * altura)
    cam.position.add(d); ctl.target.add(d)
    ctl.update(); pedeRender()
  }

  // ---- cursor no plano da mesa (z = 0) ----
  const ray = new THREE.Raycaster(), plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), ponto = new THREE.Vector3(), ndc = new THREE.Vector2()
  let aoCursor: (p: { x: number; y: number } | null) => void = () => {}
  render.domElement.addEventListener('pointermove', e => {
    const r = render.domElement.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, cam)
    aoCursor(ray.ray.intersectPlane(plano, ponto) ? { x: ponto.x, y: ponto.y } : null)
  })
  render.domElement.addEventListener('pointerleave', () => aoCursor(null))

  /** Pivô da órbita: move o alvo para a reta de visão central, na profundidade do ponto sob o cursor (imagem não muda). */
  function pivotaNoCursor(e: PointerEvent) {
    const r = render.domElement.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, cam)
    const malhas: THREE.Mesh[] = []
    const colhe = (o: THREE.Object3D) => {
      for (const k of o.children) if (k.visible && k !== impressora) { if (k instanceof THREE.Mesh) malhas.push(k); colhe(k) }
    }
    colhe(cena)
    const p = ray.intersectObjects(malhas, false)[0]?.point ?? ray.ray.intersectPlane(plano, ponto)
    if (!p) return
    const fwd = cam.getWorldDirection(dir)
    const d = p.clone().sub(cam.position).dot(fwd)
    if (cam === persp && d <= 1) return // perspectiva: P precisa estar na frente da câmera
    ctl.target.copy(cam.position).addScaledVector(fwd, d)
    ctl.update(); pedeRender()
  }

  // ---- ferramentas de sketch: ponto do mouse no plano do sketch, projeção para a tela, vista alinhada ----
  type Base = 'XY' | 'XZ' | 'YZ'
  const NORMAL: Record<Base, [number, number, number]> = { XY: [0, 0, 1], XZ: [0, 1, 0], YZ: [1, 0, 0] }
  /** Cliente (clientX/Y) → coordenadas (u,v) no plano do sketch, ou null se o raio não cruza o plano. */
  function noPlano(cx: number, cy: number, base: Base, offset: number): { x: number; y: number } | null {
    const r = render.domElement.getBoundingClientRect()
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, cam)
    const q = new THREE.Plane(new THREE.Vector3(...NORMAL[base]), -offset), h = new THREE.Vector3()
    if (!ray.ray.intersectPlane(q, h)) return null
    return base === 'XY' ? { x: h.x, y: h.y } : base === 'XZ' ? { x: h.x, y: h.z } : { x: h.y, y: h.z }
  }
  /** Raio do mundo sob o ponto do cliente (clientX/Y). */
  function raio(cx: number, cy: number): THREE.Ray {
    const r = render.domElement.getBoundingClientRect()
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, cam)
    return ray.ray.clone()
  }
  /** Ponto do mundo → pixels dentro da vista (null se atrás da câmera). */
  function paraTela(x: number, y: number, z: number): { x: number; y: number } | null {
    const v = new THREE.Vector3(x, y, z).project(cam)
    if (v.z > 1) return null
    return { x: (v.x + 1) / 2 * el.clientWidth, y: (1 - v.y) / 2 * el.clientHeight }
  }
  const alinhaAoPlano = (base: Base) => vistaPara(base === 'XY' ? [0, 0, 1] : base === 'XZ' ? [0, -1, 0] : [1, 0, 0])

  // ---- tamanho e laço ----
  let pronto = false
  function tamanho() {
    render.setSize(el.clientWidth, el.clientHeight)
    persp.aspect = el.clientWidth / Math.max(1, el.clientHeight)
    persp.updateProjectionMatrix(); ajustaOrto()
    if (!pronto && el.clientWidth > 0 && el.clientHeight > 0) { pronto = true; enquadra() } // primeira medida válida
    pedeRender()
  }
  new ResizeObserver(tamanho).observe(el)

  let aoFrame: (ms: number) => void = () => {}
  render.setAnimationLoop(() => {
    anima()
    ctl.update()
    const px = pxPorMm(), passo = passoGrade(px).menor
    if (passo !== nivelGrade) { montaGrade(passo); sujo = true }
    if (!sujo) return
    sujo = false
    const t0 = performance.now()
    render.clear()
    render.render(cena, cam)
    gizmo.render(render)
    aoFrame(performance.now() - t0)
  })

  /** PNG (bytes) da vista isométrica, no máximo `max` px de lado; restaura a câmera. Só vale chamado de forma síncrona (o canvas WebGL não guarda o quadro). */
  function capturaIso(max = 256): Uint8Array {
    const pos = cam.position.clone(), alvo = ctl.target.clone(), dir0 = anim, zoom0 = orto.zoom, meia0 = metadeOrto
    enquadra()
    render.clear(); render.render(cena, cam)
    const w = render.domElement.width, h = render.domElement.height, k = Math.min(1, max / Math.max(w, h))
    const c2 = document.createElement('canvas'); c2.width = Math.max(1, Math.round(w * k)); c2.height = Math.max(1, Math.round(h * k))
    c2.getContext('2d')!.drawImage(render.domElement, 0, 0, c2.width, c2.height)
    const b64 = c2.toDataURL('image/png').split(',')[1], bin = atob(b64), out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    cam.position.copy(pos); ctl.target.copy(alvo); anim = dir0; orto.zoom = zoom0; metadeOrto = meia0; ajustaOrto(); ctl.update(); pedeRender()
    return out
  }

  aplicaTema()
  tamanho()
  montaImpressora()
  enquadra()

  return {
    cena, pedeRender, noPlano, paraTela, raio, alinhaAoPlano, canvas: render.domElement, mmPorPixel: () => 1 / pxPorMm(),
    aplicaTema, setImpressora, setNavegacao, ligaGrade, vistaPara, enquadra, alternaProjecao, tecla, capturaIso,
    get navegacao() { return preset },
    get ortografica() { return cam === orto },
    setPixelRatioMax(max: number) { render.setPixelRatio(Math.min(devicePixelRatio, max)); tamanho() },
    aoCursor(f: typeof aoCursor) { aoCursor = f },
    aoFrame(f: typeof aoFrame) { aoFrame = f },
    /** Estado para conferência manual e testes no navegador. */
    inspeciona: () => ({ vol, ortografica: cam === orto, passoGrade: nivelGrade, alvo: ctl.target.toArray(), pos: cam.position.toArray(), botaoMeio: ctl.mouseButtons.MIDDLE === THREE.MOUSE.ROTATE ? 'orbitar' : 'pan', dir: cam.getWorldDirection(dir).toArray() }),
  }
}

export type Vista = ReturnType<typeof criaVista>
