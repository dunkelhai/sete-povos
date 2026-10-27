/** Matemática de hexágonos pointy-top em coordenadas axiais (q, r). */

export interface Axial {
  q: number;
  r: number;
}

export const DIRS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const key = (h: Axial): string => `${h.q},${h.r}`;

export const fromKey = (k: string): Axial => {
  const [q, r] = k.split(',').map(Number);
  return { q, r };
};

export const eq = (a: Axial, b: Axial): boolean => a.q === b.q && a.r === b.r;

export const add = (a: Axial, b: Axial): Axial => ({ q: a.q + b.q, r: a.r + b.r });

export const scale = (a: Axial, k: number): Axial => ({ q: a.q * k, r: a.r * k });

export const neighbors = (h: Axial): Axial[] => DIRS.map((d) => add(h, d));

export const distance = (a: Axial, b: Axial): number => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

/** Offset "odd-r" (linhas ímpares deslocadas) → axial. */
export const offsetToAxial = (col: number, row: number): Axial => ({
  q: col - (row - (row & 1)) / 2,
  r: row,
});

export const axialToOffset = (h: Axial): { col: number; row: number } => ({
  col: h.q + (h.r - (h.r & 1)) / 2,
  row: h.r,
});

/** Arredondamento cúbico de coordenadas fracionárias. */
export const roundAxial = (qf: number, rf: number): Axial => {
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q: q + 0, r: r + 0 };
};

/** Linha de hexes de a até b (inclusive), por interpolação cúbica com pequeno desvio. */
export const line = (a: Axial, b: Axial): Axial[] => {
  const n = distance(a, b);
  const out: Axial[] = [];
  const eps = 1e-6;
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    const qf = a.q + eps + (b.q - a.q) * t;
    const rf = a.r + eps + (b.r - a.r) * t;
    out.push(roundAxial(qf, rf));
  }
  return out;
};

/** Layout de tela: hex pointy-top de raio R, achatado em Y por FLAT. */
export const HEX_R = 56;
export const FLAT = 0.72;
export const HEX_W = Math.sqrt(3) * HEX_R;
export const HEX_VSTEP = 1.5 * HEX_R * FLAT;

export interface Layout {
  x0: number;
  y0: number;
}

export const toPixel = (h: Axial, l: Layout): { x: number; y: number } => ({
  x: l.x0 + HEX_W * (h.q + h.r / 2),
  y: l.y0 + HEX_VSTEP * h.r,
});

export const fromPixel = (x: number, y: number, l: Layout): Axial => {
  const rf = (y - l.y0) / HEX_VSTEP;
  const qf = (x - l.x0) / HEX_W - rf / 2;
  return roundAxial(qf, rf);
};

/** Vértices do topo do hex (achatado), relativos ao centro. */
export const hexCorners = (r = HEX_R, flat = FLAT): { x: number; y: number }[] => {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const a = ((60 * i - 30) * Math.PI) / 180;
    pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) * flat });
  }
  return pts;
};
