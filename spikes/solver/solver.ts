// Solver de restrições 2D do sketch (SPK-1 / R1). MIT, sem dependência.
// Levenberg-Marquardt sobre (x,y) dos pontos e raio dos círculos.
// TS puro, sem DOM, erasableSyntaxOnly: pronto para virar packages/core/src/sketch/solver.ts.

export type Entidade =
  | { tipo: 'ponto'; x: number; y: number }
  | { tipo: 'linha'; a: number; b: number } // a, b = índices de pontos
  | { tipo: 'circulo'; c: number; r: number } // c = índice de ponto (centro)
  | { tipo: 'arco'; c: number; a: number; b: number }; // centro + extremos; |c-a| = |c-b| é implícito

export type TipoRestricao =
  | 'coincidente' | 'horizontal' | 'vertical' | 'paralela' | 'perpendicular' | 'tangente'
  | 'igual' | 'concentrica' | 'pontoNaCurva' | 'simetria' | 'fixa'
  | 'distancia' | 'distanciaH' | 'distanciaV' | 'raio' | 'diametro' | 'angulo';

// e = índices de entidades (ver compilar). v = valor da dimensão (mm; ângulo em rad). xy = alvo da "fixa".
export type Restricao = { tipo: TipoRestricao; e: number[]; v?: number; xy?: [number, number] };
export type Sketch = { entidades: Entidade[]; restricoes: Restricao[] };

export type Resultado = {
  estado: 'subdefinido' | 'definido' | 'conflito';
  dof: number; // graus de liberdade restantes (n - posto do jacobiano)
  residuo: number; // max |resíduo| final
  iteracoes: number;
  redundantes: number; // equações dependentes (só quando não há conflito)
};

type Eq = { vars: number[]; n: number; f: (x: Float64Array, o: Float64Array, k: number) => void; ci: number };

const TOL = 1e-9; // convergência (max |resíduo|)
const TOL_CONFLITO = 1e-6;

function compilar(sk: Sketch, vi: Int32Array, x: Float64Array): Eq[] {
  const ent = sk.entidades;
  const eqs: Eq[] = [];
  const add = (ci: number, vars: number[], n: number, f: Eq['f']) => eqs.push({ vars: [...new Set(vars)], n, f, ci }); // sem duplicatas: linhas vizinhas compartilham pontos
  const pb = (p: number) => vi[p]; // base (x em pb, y em pb+1)
  const extremos = (e: number[]): [number, number] => {
    const t = ent[e[0]];
    return t.tipo === 'linha' ? [t.a, t.b] : [e[0], e[1]];
  };
  const centro = (i: number): number => {
    const t = ent[i];
    return t.tipo === 'ponto' ? i : t.tipo === 'linha' ? -1 : t.c;
  };
  // raio como função das variáveis
  const raio = (i: number): { vars: number[]; get: (x: Float64Array) => number } => {
    const t = ent[i];
    if (t.tipo === 'circulo') return { vars: [vi[i]], get: (x) => x[vi[i]] };
    if (t.tipo !== 'arco') throw new Error('raio: entidade sem raio');
    const c = pb(t.c), a = pb(t.a);
    return { vars: [c, c + 1, a, a + 1], get: (x) => Math.hypot(x[a] - x[c], x[a + 1] - x[c + 1]) };
  };
  const ehLinha = (i: number) => ent[i].tipo === 'linha';

  ent.forEach((t) => {
    if (t.tipo !== 'arco') return;
    const c = pb(t.c), a = pb(t.a), b = pb(t.b);
    add(-1, [c, c + 1, a, a + 1, b, b + 1], 1, (x, o, k) => {
      o[k] = Math.hypot(x[a] - x[c], x[a + 1] - x[c + 1]) - Math.hypot(x[b] - x[c], x[b + 1] - x[c + 1]);
    });
  });

  sk.restricoes.forEach((r, ci) => {
    const e = r.e, v = r.v ?? 0;
    switch (r.tipo) {
      case 'coincidente': {
        const a = pb(e[0]), b = pb(e[1]);
        add(ci, [a, a + 1, b, b + 1], 2, (x, o, k) => { o[k] = x[a] - x[b]; o[k + 1] = x[a + 1] - x[b + 1]; });
        break;
      }
      case 'horizontal': case 'vertical': {
        const [p, q] = extremos(e);
        const a = pb(p), b = pb(q), d = r.tipo === 'horizontal' ? 1 : 0;
        add(ci, [a + d, b + d], 1, (x, o, k) => { o[k] = x[a + d] - x[b + d]; });
        break;
      }
      case 'paralela': case 'perpendicular': {
        const [a1, b1] = extremos([e[0]]), [a2, b2] = extremos([e[1]]);
        const A = pb(a1), B = pb(b1), C = pb(a2), D = pb(b2), par = r.tipo === 'paralela';
        add(ci, [A, A + 1, B, B + 1, C, C + 1, D, D + 1], 1, (x, o, k) => {
          const ux = x[B] - x[A], uy = x[B + 1] - x[A + 1], wx = x[D] - x[C], wy = x[D + 1] - x[C + 1];
          o[k] = par ? ux * wy - uy * wx : ux * wx + uy * wy;
        });
        break;
      }
      case 'pontoNaCurva': {
        const p = pb(e[0]), t = ent[e[1]];
        if (t.tipo === 'linha') {
          const a = pb(t.a), b = pb(t.b);
          add(ci, [p, p + 1, a, a + 1, b, b + 1], 1, (x, o, k) => {
            const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1];
            o[k] = (dx * (x[p + 1] - x[a + 1]) - dy * (x[p] - x[a])) / (Math.hypot(dx, dy) || 1);
          });
        } else {
          const c = pb(centro(e[1])), R = raio(e[1]);
          add(ci, [p, p + 1, c, c + 1, ...R.vars], 1, (x, o, k) => {
            o[k] = Math.hypot(x[p] - x[c], x[p + 1] - x[c + 1]) - R.get(x);
          });
        }
        break;
      }
      case 'tangente': {
        let [i, j] = e;
        if (!ehLinha(i) && ehLinha(j)) [i, j] = [j, i];
        if (ehLinha(i)) {
          const l = ent[i] as Extract<Entidade, { tipo: 'linha' }>;
          const a = pb(l.a), b = pb(l.b), c = pb(centro(j)), R = raio(j);
          const dist = (x: Float64Array) => {
            const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1];
            return (dx * (x[c + 1] - x[a + 1]) - dy * (x[c] - x[a])) / (Math.hypot(dx, dy) || 1);
          };
          const s = dist(x) < 0 ? -1 : 1; // lado em que o centro está agora
          add(ci, [a, a + 1, b, b + 1, c, c + 1, ...R.vars], 1, (xx, o, k) => { o[k] = dist(xx) - s * R.get(xx); });
        } else {
          const c1 = pb(centro(i)), c2 = pb(centro(j)), R1 = raio(i), R2 = raio(j);
          const d0 = Math.hypot(x[c1] - x[c2], x[c1 + 1] - x[c2 + 1]);
          const r1 = R1.get(x), r2 = R2.get(x);
          // externa: d = r1 + r2; interna: d = |r1 - r2| (sinal escolhido pela geometria atual)
          const interna = d0 < Math.max(r1, r2), sg = r1 >= r2 ? 1 : -1;
          add(ci, [c1, c1 + 1, c2, c2 + 1, ...R1.vars, ...R2.vars], 1, (xx, o, k) => {
            const d = Math.hypot(xx[c1] - xx[c2], xx[c1 + 1] - xx[c2 + 1]);
            o[k] = interna ? d - sg * (R1.get(xx) - R2.get(xx)) : d - R1.get(xx) - R2.get(xx);
          });
        }
        break;
      }
      case 'igual': {
        if (ehLinha(e[0])) {
          const [a1, b1] = extremos([e[0]]), [a2, b2] = extremos([e[1]]);
          const A = pb(a1), B = pb(b1), C = pb(a2), D = pb(b2);
          add(ci, [A, A + 1, B, B + 1, C, C + 1, D, D + 1], 1, (x, o, k) => {
            o[k] = Math.hypot(x[B] - x[A], x[B + 1] - x[A + 1]) - Math.hypot(x[D] - x[C], x[D + 1] - x[C + 1]);
          });
        } else {
          const R1 = raio(e[0]), R2 = raio(e[1]);
          add(ci, [...R1.vars, ...R2.vars], 1, (x, o, k) => { o[k] = R1.get(x) - R2.get(x); });
        }
        break;
      }
      case 'concentrica': {
        const a = pb(centro(e[0])), b = pb(centro(e[1]));
        add(ci, [a, a + 1, b, b + 1], 2, (x, o, k) => { o[k] = x[a] - x[b]; o[k + 1] = x[a + 1] - x[b + 1]; });
        break;
      }
      case 'simetria': { // e = [p, q, linha-eixo]
        const p = pb(e[0]), q = pb(e[1]), l = ent[e[2]] as Extract<Entidade, { tipo: 'linha' }>;
        const a = pb(l.a), b = pb(l.b);
        add(ci, [p, p + 1, q, q + 1, a, a + 1, b, b + 1], 2, (x, o, k) => {
          const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], n = Math.hypot(dx, dy) || 1;
          const mx = (x[p] + x[q]) / 2 - x[a], my = (x[p + 1] + x[q + 1]) / 2 - x[a + 1];
          o[k] = (dx * my - dy * mx) / n; // ponto médio no eixo
          o[k + 1] = (dx * (x[q] - x[p]) + dy * (x[q + 1] - x[p + 1])) / n; // pq ⟂ eixo
        });
        break;
      }
      case 'fixa': {
        const p = pb(e[0]), [tx, ty] = r.xy ?? [x[p], x[p + 1]];
        add(ci, [p, p + 1], 2, (xx, o, k) => { o[k] = xx[p] - tx; o[k + 1] = xx[p + 1] - ty; });
        break;
      }
      case 'distancia': case 'distanciaH': case 'distanciaV': {
        const [p, q] = extremos(e);
        const a = pb(p), b = pb(q), t = r.tipo;
        add(ci, [a, a + 1, b, b + 1], 1, (xx, o, k) => {
          const dx = xx[b] - xx[a], dy = xx[b + 1] - xx[a + 1];
          o[k] = (t === 'distancia' ? Math.hypot(dx, dy) : t === 'distanciaH' ? dx : dy) - v;
        });
        break;
      }
      case 'raio': case 'diametro': {
        const R = raio(e[0]), f = r.tipo === 'raio' ? 1 : 2;
        add(ci, R.vars, 1, (xx, o, k) => { o[k] = f * R.get(xx) - v; });
        break;
      }
      case 'angulo': { // ângulo orientado da linha e[0] para a e[1]
        const [a1, b1] = extremos([e[0]]), [a2, b2] = extremos([e[1]]);
        const A = pb(a1), B = pb(b1), C = pb(a2), D = pb(b2);
        add(ci, [A, A + 1, B, B + 1, C, C + 1, D, D + 1], 1, (x, o, k) => {
          const ux = x[B] - x[A], uy = x[B + 1] - x[A + 1], wx = x[D] - x[C], wy = x[D + 1] - x[C + 1];
          let d = Math.atan2(ux * wy - uy * wx, ux * wx + uy * wy) - v;
          d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
          o[k] = d;
        });
        break;
      }
    }
  });
  return eqs;
}

// ---------- álgebra densa ----------

function residuos(eqs: Eq[], x: Float64Array, r: Float64Array): void {
  let k = 0;
  for (const q of eqs) { q.f(x, r, k); k += q.n; }
}

// Jacobiano esparso por diferenças finitas (só as variáveis de cada equação). cen = diferença central.
function jacobiano(eqs: Eq[], x: Float64Array, m: number, cen: boolean) {
  const rows: { cols: number[]; vals: Float64Array }[] = [];
  const a = new Float64Array(8), b = new Float64Array(8);
  for (const q of eqs) {
    const nv = q.vars.length;
    const blk: Float64Array[] = [];
    for (let i = 0; i < q.n; i++) blk.push(new Float64Array(nv));
    const f0 = new Float64Array(q.n);
    if (!cen) q.f(x, f0, 0);
    for (let j = 0; j < nv; j++) {
      const c = q.vars[j], x0 = x[c], h = 1e-6 * Math.max(1, Math.abs(x0));
      x[c] = x0 + h; q.f(x, a, 0);
      if (cen) { x[c] = x0 - h; q.f(x, b, 0); }
      x[c] = x0;
      for (let i = 0; i < q.n; i++) blk[i][j] = cen ? (a[i] - b[i]) / (2 * h) : (a[i] - f0[i]) / h;
    }
    for (let i = 0; i < q.n; i++) rows.push({ cols: q.vars, vals: blk[i] });
  }
  return rows;
}

// posto por QR de Householder com pivô de coluna
function posto(rows: { cols: number[]; vals: Float64Array }[], n: number): number {
  const m = rows.length;
  if (m === 0 || n === 0) return 0;
  const col: Float64Array[] = Array.from({ length: n }, () => new Float64Array(m));
  rows.forEach((rw, i) => rw.cols.forEach((c, j) => { col[c][i] += rw.vals[j]; }));
  const idx = Array.from({ length: n }, (_, i) => i);
  let r0 = 0, rank = 0;
  for (let k = 0; k < Math.min(m, n); k++) {
    let best = -1, bn = 0;
    for (let j = k; j < n; j++) {
      let s = 0; const c = col[idx[j]];
      for (let i = k; i < m; i++) s += c[i] * c[i];
      if (s > bn) { bn = s; best = j; }
    }
    const nrm = Math.sqrt(bn);
    if (k === 0) r0 = nrm;
    if (best < 0 || nrm <= 1e-7 * r0 || nrm < 1e-12) break;
    [idx[k], idx[best]] = [idx[best], idx[k]];
    const ck = col[idx[k]];
    const alfa = ck[k] > 0 ? -nrm : nrm;
    ck[k] -= alfa;
    let vn = 0; for (let i = k; i < m; i++) vn += ck[i] * ck[i];
    if (vn > 0) {
      for (let j = k + 1; j < n; j++) {
        const c = col[idx[j]];
        let d = 0; for (let i = k; i < m; i++) d += ck[i] * c[i];
        d = (2 * d) / vn;
        for (let i = k; i < m; i++) c[i] -= d * ck[i];
      }
    }
    ck[k] = alfa;
    rank++;
  }
  return rank;
}

// Cholesky in-place (triângulo inferior de A, n×n) com envelope: f[i] = 1ª coluna não nula da linha i
// (o envelope se preserva na fatoração). false se não for definida positiva.
function cholesky(A: Float64Array, n: number, f: Int32Array): boolean {
  for (let i = 0; i < n; i++) {
    const ri = i * n;
    for (let j = f[i]; j <= i; j++) {
      const rj = j * n;
      let s = A[ri + j];
      for (let k = Math.max(f[i], f[j]); k < j; k++) s -= A[ri + k] * A[rj + k];
      if (i === j) { if (s <= 0) return false; A[ri + i] = Math.sqrt(s); } else A[ri + j] = s / A[rj + j];
    }
  }
  return true;
}
function cholResolve(L: Float64Array, n: number, b: Float64Array, f: Int32Array): void {
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = f[i]; k < i; k++) s -= L[i * n + k] * b[k]; b[i] = s / L[i * n + i]; }
  for (let i = n - 1; i >= 0; i--) { const v = (b[i] /= L[i * n + i]); for (let k = f[i]; k < i; k++) b[k] -= L[i * n + k] * v; }
}

// ---------- solver ----------

export function resolver(sk: Sketch, opc: { maxIter?: number; analisar?: boolean } = {}): Resultado {
  const maxIter = opc.maxIter ?? 100;
  const ent = sk.entidades;
  const vi = new Int32Array(ent.length);
  let n = 0;
  ent.forEach((t, i) => { vi[i] = n; n += t.tipo === 'ponto' ? 2 : t.tipo === 'circulo' ? 1 : 0; });
  const x = new Float64Array(n);
  ent.forEach((t, i) => { if (t.tipo === 'ponto') { x[vi[i]] = t.x; x[vi[i] + 1] = t.y; } else if (t.tipo === 'circulo') x[vi[i]] = t.r; });
  // linhas/arcos usam as variáveis dos pontos referenciados: vi deles
  const eqs = compilar(sk, vi, x);
  const m = eqs.reduce((s, q) => s + q.n, 0);

  const r = new Float64Array(m), rn = new Float64Array(m), g = new Float64Array(n), dx = new Float64Array(n);
  const A = new Float64Array(n * n), L = new Float64Array(n * n), xn = new Float64Array(n), fe = new Int32Array(n);
  const maxAbs = (v: Float64Array) => { let s = 0; for (let i = 0; i < v.length; i++) s = Math.max(s, Math.abs(v[i])); return s; };
  const sq = (v: Float64Array) => { let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * v[i]; return s; };

  residuos(eqs, x, r);
  let custo = sq(r), lambda = 1e-3, it = 0;
  for (; it < maxIter && maxAbs(r) > TOL; it++) {
    const J = jacobiano(eqs, x, m, false);
    A.fill(0); g.fill(0);
    let k = 0;
    for (const rw of J) {
      const cs = rw.cols, vs = rw.vals;
      for (let a = 0; a < cs.length; a++) {
        g[cs[a]] += vs[a] * r[k];
        for (let b = 0; b < cs.length; b++) A[cs[a] * n + cs[b]] += vs[a] * vs[b];
      }
      k++;
    }
    for (let i = 0; i < n; i++) { let c = 0; while (c < i && A[i * n + c] === 0) c++; fe[i] = c; }
    let ok = false;
    for (let t = 0; t < 20 && !ok; t++) {
      L.set(A);
      for (let i = 0; i < n; i++) L[i * n + i] += lambda * A[i * n + i] + 1e-12;
      if (!cholesky(L, n, fe)) { lambda *= 10; continue; }
      for (let i = 0; i < n; i++) dx[i] = -g[i];
      cholResolve(L, n, dx, fe);
      for (let i = 0; i < n; i++) xn[i] = x[i] + dx[i];
      residuos(eqs, xn, rn);
      const c2 = sq(rn);
      if (c2 < custo) { x.set(xn); r.set(rn); custo = c2; lambda = Math.max(lambda / 3, 1e-12); ok = true; } else lambda *= 4;
    }
    if (!ok || maxAbs(dx) < 1e-13) { it++; break; }
  }

  const residuo = maxAbs(r);
  // grava de volta (mesmo em conflito: mínimos quadrados; o chamador decide se reverte)
  ent.forEach((t, i) => { if (t.tipo === 'ponto') { t.x = x[vi[i]]; t.y = x[vi[i] + 1]; } else if (t.tipo === 'circulo') t.r = x[vi[i]]; });

  const res: Resultado = { estado: 'subdefinido', dof: 0, residuo, iteracoes: it, redundantes: 0 };
  if (residuo > TOL_CONFLITO) {
    res.estado = 'conflito';
    return res;
  }
  if (opc.analisar !== false) {
    const rk = posto(jacobiano(eqs, x, m, true), n);
    res.dof = n - rk;
    res.redundantes = m - rk;
    res.estado = res.dof === 0 ? 'definido' : 'subdefinido';
  }
  return res;
}

// Diagnóstico de conflito: recebe o sketch ORIGINAL (antes de resolver), pois resolver() grava o resultado.
export function diagnosticarConflito(original: Sketch): number[] {
  const out: number[] = [];
  original.restricoes.forEach((_, i) => {
    const sk: Sketch = structuredClone(original);
    sk.restricoes.splice(i, 1);
    if (resolver(sk, { analisar: false }).residuo <= TOL_CONFLITO) out.push(i);
  });
  return out;
}
