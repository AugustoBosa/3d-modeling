/** Parte de nome de arquivo: minúsculas, sem acentos, só [a-z0-9] separados por "-". Vazia vira "sem-nome". */
const slug = (s: string): string => {
  const limpo = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return limpo || 'sem-nome'
}

/** Nome do arquivo de export: <projeto>-<corpo>-<impressora>.<ext>. */
export function nomeArquivo(projeto: string, corpo: string, impressoraId: string, ext = '3mf'): string {
  return `${slug(projeto)}-${slug(corpo)}-${slug(impressoraId)}.${ext}`
}
