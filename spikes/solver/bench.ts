// node spikes/solver/bench.ts  — números do RESULTADO.md
import { resolver } from './solver.ts';
import type { Sketch } from './solver.ts';
function cadeia(n: number): Sketch { // n pontos em cadeia: distância 5 entre vizinhos, H/V alternados, 1ª fixa (n vars = 2n)
  const sk: Sketch = { entidades: [], restricoes: [] };
  let s = 7; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5);
  for (let i = 0; i < n; i++) sk.entidades.push({ tipo: 'ponto', x: i * 5 + rnd(), y: rnd() * 3 });
  sk.restricoes.push({ tipo: 'fixa', e: [0], xy: [0, 0] });
  for (let i = 0; i + 1 < n; i++) sk.restricoes.push({ tipo: i % 2 ? 'vertical' : 'horizontal', e: [i, i + 1] }, { tipo: 'distancia', e: [i, i + 1], v: 5 });
  return sk;
}
function grade(c: number, r: number): Sketch {
  const sk: Sketch = { entidades: [], restricoes: [] }; let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 2;
  for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) sk.entidades.push({ tipo: 'ponto', x: i * 10 + rnd(), y: j * 10 + rnd() });
  sk.restricoes.push({ tipo: 'fixa', e: [0], xy: [0, 0] });
  const id = (i: number, j: number) => j * c + i;
  for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) {
    if (i + 1 < c) { sk.entidades.push({ tipo: 'linha', a: id(i, j), b: id(i + 1, j) }); const l = sk.entidades.length - 1; sk.restricoes.push({ tipo: 'horizontal', e: [l] }); if (j === 0) sk.restricoes.push({ tipo: 'distancia', e: [l], v: 10 }); }
    if (j + 1 < r) { sk.entidades.push({ tipo: 'linha', a: id(i, j), b: id(i, j + 1) }); const l = sk.entidades.length - 1; sk.restricoes.push({ tipo: 'vertical', e: [l] }); if (i === 0) sk.restricoes.push({ tipo: 'distancia', e: [l], v: 10 }); }
  }
  return sk;
}
function medir(nome: string, mk: () => Sketch) {
  const ts: number[] = []; let it = 0, info = '';
  for (let k = 0; k < 15; k++) {
    const sk = mk(); const t = performance.now(); const res = resolver(sk, { analisar: false }); ts.push(performance.now() - t);
    it = res.iteracoes; info = `res=${res.residuo.toExponential(1)}`;
  }
  ts.sort((a, b) => a - b); const med = ts[7];
  const sk = mk(); const t = performance.now(); const full = resolver(sk); const tf = performance.now() - t;
  console.log(`${nome}: ${sk.entidades.length} entidades, ${it} iter, mediana ${med.toFixed(1)} ms (${(med / it).toFixed(2)} ms/iter), ${info}; com análise de posto: ${tf.toFixed(0)} ms, ${full.estado}/dof=${full.dof}`);
}
medir('grade 9x8 (n=144 vars)', () => grade(9, 8));
medir('cadeia 200 pontos (n=400 vars)', () => cadeia(200));
