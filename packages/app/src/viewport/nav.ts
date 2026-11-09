// Navegação do viewport: lógica pura (sem DOM, sem three) para poder ser testada em Node.
// Padrão Blender: meio orbita, Shift+meio faz pan. Preset AutoCAD: meio faz pan, Shift+meio orbita (PROJETO_BASE §6.2, §7.4, D15).

export type Preset = 'blender' | 'autocad'
export type AcaoMouse = 'orbitar' | 'pan' | 'nada'

/** O que um botão do mouse faz no viewport. Esquerdo e direito ficam livres para seleção e menu de contexto. */
export function acaoDoMouse(preset: Preset, botao: number, shift: boolean): AcaoMouse {
  if (botao !== 1) return 'nada'
  const orbita = (preset === 'blender') !== shift // Shift troca orbitar por pan e vice-versa
  return orbita ? 'orbitar' : 'pan'
}

export type Vec3 = [number, number, number]
export type AcaoTecla =
  | { tipo: 'vista'; dir: Vec3 } // câmera no lado `dir` do alvo, olhando para ele
  | { tipo: 'oposta' }
  | { tipo: 'orbita'; az: number; el: number } // graus
  | { tipo: 'pan'; dx: number; dy: number } // frações da tela
  | { tipo: 'zoom'; fator: number }
  | { tipo: 'persp' }
  | { tipo: 'enquadra' }

/** Numpad do Blender (PROJETO_BASE §6.2). Ctrl inverte 1/3/7 e, em 2/4/6/8, vira pan. null = tecla não é de navegação. */
export function teclaNumpad(code: string, ctrl: boolean): AcaoTecla | null {
  const s = ctrl ? -1 : 1
  switch (code) {
    case 'Numpad1': return { tipo: 'vista', dir: [0, -s, 0] } // frente: câmera em −Y
    case 'Numpad3': return { tipo: 'vista', dir: [s, 0, 0] } // direita: câmera em +X
    case 'Numpad7': return { tipo: 'vista', dir: [0, 0, s] } // topo: câmera em +Z
    case 'Numpad9': return { tipo: 'oposta' }
    case 'Numpad5': return { tipo: 'persp' }
    case 'NumpadDecimal': return { tipo: 'enquadra' }
    case 'NumpadAdd': return { tipo: 'zoom', fator: 1 / 1.2 }
    case 'NumpadSubtract': return { tipo: 'zoom', fator: 1.2 }
    case 'Numpad8': return ctrl ? { tipo: 'pan', dx: 0, dy: .1 } : { tipo: 'orbita', az: 0, el: 15 }
    case 'Numpad2': return ctrl ? { tipo: 'pan', dx: 0, dy: -.1 } : { tipo: 'orbita', az: 0, el: -15 }
    case 'Numpad4': return ctrl ? { tipo: 'pan', dx: -.1, dy: 0 } : { tipo: 'orbita', az: -15, el: 0 }
    case 'Numpad6': return ctrl ? { tipo: 'pan', dx: .1, dy: 0 } : { tipo: 'orbita', az: 15, el: 0 }
  }
  return null
}

/** Grade adaptativa (§6.2): passo menor = o primeiro de 1/10/100 mm que fica com ≥ 6 px; o maior é 10×. */
export function passoGrade(pxPorMm: number): { menor: number; maior: number } {
  const menor = [1, 10, 100].find(s => s * pxPorMm >= 6) ?? 100
  return { menor, maior: menor * 10 }
}
