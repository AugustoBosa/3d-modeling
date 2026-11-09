// Primeiro módulo carregado: se algo falhar ao iniciar (WebGL desligado, Worker/WASM bloqueado), avisa em vez de deixar a tela vazia.
// Depois que o app iniciou (main.ts cria #vista canvas), o erro vai para a linha de comando e o toast, sem banner.
import { T } from './textos.ts'

export const iniciou = (doc: Pick<Document, 'querySelector'>) => !!doc.querySelector('#vista canvas')

let tToast = 0

if (typeof addEventListener === 'function') addEventListener('error', e => {
  if (!e.error) return
  if (!iniciou(document)) {
    if (document.getElementById('falha')) return
    const d = document.createElement('div')
    d.id = 'falha'; d.setAttribute('role', 'alert')
    d.textContent = T.falhaInicio(e.error.message)
    document.body.prepend(d)
    return
  }
  const msg = T.erroDepoisDoInicio(e.error.message)
  const hist = document.querySelector<HTMLElement>('#linha .hist')
  if (hist) {
    const l = document.createElement('div')
    l.className = 'l-erro'; l.textContent = msg
    hist.appendChild(l); hist.scrollTop = hist.scrollHeight
  }
  const toast = document.getElementById('toast')
  if (toast) {
    toast.textContent = msg; toast.classList.add('erro'); toast.hidden = false
    clearTimeout(tToast); tToast = window.setTimeout(() => { toast.hidden = true }, 6000)
  }
})
