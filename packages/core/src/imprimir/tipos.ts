// Achado de verificação: devolvido por funções puras; a mensagem já vem em pt-BR (imprimir/mensagens.ts).
export type Severidade = 'bloqueio' | 'erro' | 'aviso' | 'info' // bloqueio = trava o export (com "exportar mesmo assim")
export interface Achado {
  severidade: Severidade
  codigo: string
  mensagem: string
  corpo?: string // nome do corpo, quando o achado é de um corpo só
}
