/**
 * Regras do combate, sem Phaser (lógica pura e determinística — sem sorte).
 * A cena só lê o estado e anima os eventos devolvidos.
 */
import { ABILITY, RULES, TERRAIN_COST, UNIT_STATS } from '../config/balance';
import type { AbilityKind, UnitKind } from '../config/balance';
import { ENEMY_SPAWNS, MAP_ROWS, PLAYER_SPAWNS } from '../config/map';
import type { Spawn } from '../config/map';
import { DIRS, add, distance, eq, key, line, neighbors, offsetToAxial, scale } from './hex';
import type { Axial } from './hex';

export type Terrain = 'campo' | 'mata' | 'muro';
export type Team = 'player' | 'enemy';

export interface Tile {
  pos: Axial;
  col: number;
  row: number;
  terrain: Terrain;
  church: boolean;
}

export interface Unit {
  id: string;
  kind: UnitKind;
  team: Team;
  name: string;
  hp: number;
  maxHp: number;
  move: number;
  rangeMin: number;
  rangeMax: number;
  dmg: number;
  ability: AbilityKind;
  pos: Axial;
  moved: boolean;
  acted: boolean;
  cooldown: number;
  alive: boolean;
}

export interface ReachNode {
  cost: number;
  prev: string | null;
}

export interface AbilityOption {
  /** Hexes afetados/realçados por esta opção (clicar em qualquer um deles escolhe a opção). */
  area: Axial[];
  dir?: number;
  targetId?: string;
}

export interface Effect {
  unitId: string;
  dmg: number;
  heal: number;
  hpAfter: number;
  kill: boolean;
  pushTo?: Axial;
}

export type Outcome = 'playing' | 'victory' | 'defeat';

export interface EnemyPlan {
  path: Axial[];
  targetId: string | null;
}

export class Battle {
  readonly tiles = new Map<string, Tile>();
  units: Unit[] = [];
  turn = 1;
  outcome: Outcome = 'playing';
  defeatReason = '';
  private seq = 0;

  constructor(
    rows: readonly string[] = MAP_ROWS,
    players: readonly Spawn[] = PLAYER_SPAWNS,
    enemies: readonly Spawn[] = ENEMY_SPAWNS,
  ) {
    rows.forEach((line, row) => {
      for (let col = 0; col < line.length; col++) {
        const ch = line[col];
        const terrain: Terrain = ch === 'm' ? 'mata' : ch === '#' || ch === 'I' ? 'muro' : 'campo';
        const pos = offsetToAxial(col, row);
        this.tiles.set(key(pos), { pos, col, row, terrain, church: ch === 'I' });
      }
    });
    players.forEach((s) => this.spawn(s, 'player'));
    enemies.forEach((s) => this.spawn(s, 'enemy'));
  }

  private spawn(s: Spawn, team: Team): void {
    const st = UNIT_STATS[s.kind];
    this.units.push({
      id: `${team[0]}${this.seq++}`,
      kind: s.kind,
      team,
      name: st.name,
      hp: st.maxHp,
      maxHp: st.maxHp,
      move: st.move,
      rangeMin: st.rangeMin,
      rangeMax: st.rangeMax,
      dmg: st.dmg,
      ability: st.ability,
      pos: offsetToAxial(s.col, s.row),
      moved: false,
      acted: false,
      cooldown: 0,
      alive: true,
    });
  }

  // ---------- consultas ----------

  tile(h: Axial): Tile | undefined {
    return this.tiles.get(key(h));
  }

  unit(id: string): Unit | undefined {
    return this.units.find((u) => u.id === id);
  }

  unitAt(h: Axial): Unit | undefined {
    return this.units.find((u) => u.alive && eq(u.pos, h));
  }

  alive(team: Team): Unit[] {
    return this.units.filter((u) => u.alive && u.team === team);
  }

  moveCost(h: Axial): number {
    const t = this.tile(h);
    return t ? TERRAIN_COST[t.terrain] : Infinity;
  }

  /** Bloqueiam a visão (entre atirador e alvo): mata e muro. */
  blocksSight(h: Axial): boolean {
    const t = this.tile(h);
    return !t || t.terrain !== 'campo';
  }

  hasLineOfSight(a: Axial, b: Axial): boolean {
    const hexes = line(a, b);
    for (let i = 1; i < hexes.length - 1; i++) if (this.blocksSight(hexes[i])) return false;
    return true;
  }

  canAttackFrom(u: Unit, from: Axial, target: Axial): boolean {
    const d = distance(from, target);
    if (d < u.rangeMin || d > u.rangeMax) return false;
    return d === 1 || this.hasLineOfSight(from, target);
  }

  /**
   * Dijkstra a partir da unidade. Pode atravessar aliados, não inimigos nem muro.
   * `budget` = Infinity para distâncias completas.
   */
  reach(u: Unit, budget = u.move): Map<string, ReachNode> {
    const out = new Map<string, ReachNode>();
    out.set(key(u.pos), { cost: 0, prev: null });
    const open: { h: Axial; cost: number }[] = [{ h: u.pos, cost: 0 }];
    while (open.length) {
      open.sort((a, b) => a.cost - b.cost);
      const cur = open.shift()!;
      if (cur.cost > (out.get(key(cur.h))?.cost ?? Infinity)) continue;
      for (const n of neighbors(cur.h)) {
        const c = this.moveCost(n);
        if (!isFinite(c)) continue;
        const occ = this.unitAt(n);
        if (occ && occ.team !== u.team) continue;
        const nc = cur.cost + c;
        if (nc > budget) continue;
        const k = key(n);
        if (nc < (out.get(k)?.cost ?? Infinity)) {
          out.set(k, { cost: nc, prev: key(cur.h) });
          open.push({ h: n, cost: nc });
        }
      }
    }
    return out;
  }

  /** Hexes onde a unidade pode terminar o movimento neste turno (livres). */
  moveTargets(u: Unit): Map<string, ReachNode> {
    const r = this.reach(u);
    for (const [k] of r) {
      const occ = this.units.find((o) => o.alive && key(o.pos) === k);
      if (occ && occ !== u) r.delete(k);
    }
    return r;
  }

  static path(reach: Map<string, ReachNode>, to: Axial): Axial[] {
    const out: Axial[] = [];
    let k: string | null = key(to);
    while (k) {
      const [q, r] = k.split(',').map(Number);
      out.unshift({ q, r });
      k = reach.get(k)?.prev ?? null;
    }
    return out;
  }

  /** Hexes cobertos pelo alcance de ataque a partir de `from` (com visão). */
  attackArea(u: Unit, from: Axial = u.pos): Axial[] {
    const out: Axial[] = [];
    for (const t of this.tiles.values()) {
      if (t.terrain === 'muro') continue;
      if (this.canAttackFrom(u, from, t.pos)) out.push(t.pos);
    }
    return out;
  }

  attackTargets(u: Unit, from: Axial = u.pos): Unit[] {
    return this.units.filter(
      (o) => o.alive && o.team !== u.team && this.canAttackFrom(u, from, o.pos),
    );
  }

  previewAttack(attacker: Unit, target: Unit): Effect {
    const dmg = attacker.dmg;
    const hpAfter = Math.max(0, target.hp - dmg);
    return { unitId: target.id, dmg, heal: 0, hpAfter, kill: hpAfter === 0 };
  }

  // ---------- habilidades ----------

  abilityReady(u: Unit): boolean {
    return u.ability !== 'none' && u.cooldown === 0 && !u.acted && u.alive;
  }

  private isFree(h: Axial): boolean {
    const t = this.tile(h);
    return !!t && t.terrain !== 'muro' && !this.unitAt(h);
  }

  abilityOptions(u: Unit): AbilityOption[] {
    const opts: AbilityOption[] = [];
    if (u.ability === 'estocada') {
      DIRS.forEach((d, i) => {
        const h1 = add(u.pos, d);
        const h2 = add(u.pos, scale(d, 2));
        const t1 = this.tile(h1);
        if (!t1 || t1.terrain === 'muro') return;
        const area = [h1];
        const t2 = this.tile(h2);
        if (t2 && t2.terrain !== 'muro') area.push(h2);
        opts.push({ area, dir: i });
      });
    } else if (u.ability === 'perfurante') {
      DIRS.forEach((d, i) => {
        const area: Axial[] = [];
        for (let s = 1; s <= ABILITY.perfurante.length; s++) {
          const h = add(u.pos, scale(d, s));
          const t = this.tile(h);
          if (!t || t.terrain === 'muro') break;
          area.push(h);
        }
        if (area.length) opts.push({ area, dir: i });
      });
    } else if (u.ability === 'cura') {
      for (const a of this.alive(u.team)) {
        if (distance(a.pos, u.pos) <= 1 && a.hp < a.maxHp) {
          opts.push({ area: [a.pos], targetId: a.id });
        }
      }
    }
    // Só oferece opções que de fato afetam alguém.
    return opts.filter((o) => this.previewAbility(u, o).length > 0);
  }

  previewAbility(u: Unit, o: AbilityOption): Effect[] {
    const fx: Effect[] = [];
    const hit = (target: Unit, dmg: number, pushTo?: Axial) => {
      const hpAfter = Math.max(0, target.hp - dmg);
      fx.push({ unitId: target.id, dmg, heal: 0, hpAfter, kill: hpAfter === 0, pushTo });
    };
    if (u.ability === 'estocada' && o.dir !== undefined) {
      const d = DIRS[o.dir];
      const h1 = add(u.pos, d);
      const h2 = add(u.pos, scale(d, 2));
      const e1 = this.unitAt(h1);
      const e2 = this.unitAt(h2);
      const base = ABILITY.estocada.dmg;
      if (e1 && e1.team !== u.team) {
        if (e1.hp > base) {
          if (this.isFree(h2)) hit(e1, base, h2);
          else hit(e1, base + ABILITY.estocada.collisionBonus);
        } else hit(e1, base);
      }
      if (e2 && e2.team !== u.team && o.area.length > 1) hit(e2, base);
    } else if (u.ability === 'perfurante') {
      for (const h of o.area) {
        const e = this.unitAt(h);
        if (e && e.team !== u.team) hit(e, ABILITY.perfurante.dmg);
      }
    } else if (u.ability === 'cura' && o.targetId) {
      const a = this.unit(o.targetId);
      if (a && a.alive) {
        const hpAfter = Math.min(a.maxHp, a.hp + ABILITY.cura.heal);
        fx.push({ unitId: a.id, dmg: 0, heal: hpAfter - a.hp, hpAfter, kill: false });
      }
    }
    return fx;
  }

  // ---------- ações (mutam o estado) ----------

  moveUnit(u: Unit, to: Axial): Axial[] {
    const reach = this.moveTargets(u);
    if (u.moved || u.acted || !reach.has(key(to))) return [];
    const p = Battle.path(reach, to);
    u.pos = to;
    u.moved = true;
    return p;
  }

  attack(attacker: Unit, target: Unit): Effect | null {
    if (attacker.acted || !this.canAttackFrom(attacker, attacker.pos, target.pos)) return null;
    const fx = this.previewAttack(attacker, target);
    this.applyEffects([fx]);
    attacker.acted = true;
    attacker.moved = true;
    this.checkOutcome();
    return fx;
  }

  useAbility(u: Unit, o: AbilityOption): Effect[] {
    if (!this.abilityReady(u)) return [];
    const fx = this.previewAbility(u, o);
    if (!fx.length) return [];
    this.applyEffects(fx);
    u.acted = true;
    u.moved = true;
    u.cooldown = ABILITY[u.ability as Exclude<AbilityKind, 'none'>].cooldown;
    this.checkOutcome();
    return fx;
  }

  wait(u: Unit): void {
    u.acted = true;
    u.moved = true;
  }

  private applyEffects(fx: Effect[]): void {
    for (const f of fx) {
      const t = this.unit(f.unitId);
      if (!t) continue;
      t.hp = f.hpAfter;
      if (t.hp <= 0) t.alive = false;
      else if (f.pushTo) t.pos = f.pushTo;
    }
  }

  /** Mata uma unidade na hora (atalho de debug). */
  kill(u: Unit): void {
    u.hp = 0;
    u.alive = false;
    this.checkOutcome();
  }

  checkOutcome(): Outcome {
    if (this.outcome !== 'playing') return this.outcome;
    if (this.alive('enemy').length === 0) this.outcome = 'victory';
    else if (this.alive('player').length === 0) {
      this.outcome = 'defeat';
      this.defeatReason = 'Todas as suas unidades caíram.';
    }
    return this.outcome;
  }

  /** Fim da fase do jogador: prepara a fase inimiga. */
  startEnemyPhase(): void {
    for (const u of this.alive('enemy')) {
      u.moved = false;
      u.acted = false;
    }
  }

  /** Fim da fase inimiga: avança o turno e prepara o jogador. */
  startPlayerPhase(): void {
    if (this.checkOutcome() !== 'playing') return;
    if (this.turn >= RULES.maxTurns) {
      this.outcome = 'defeat';
      this.defeatReason = `Os invasores resistiram por ${RULES.maxTurns} turnos.`;
      return;
    }
    this.turn++;
    for (const u of this.alive('player')) {
      u.moved = false;
      u.acted = false;
      if (u.cooldown > 0) u.cooldown--;
    }
  }

  // ---------- IA inimiga ----------

  /**
   * Ataca a unidade do jogador de MENOR vida atual que consiga alcançar neste turno;
   * se ninguém está ao alcance, aproxima-se da de menor vida pelo caminho mais curto.
   */
  planEnemy(e: Unit): EnemyPlan {
    const targets = this.alive('player').sort(
      (a, b) => a.hp - b.hp || distance(a.pos, e.pos) - distance(b.pos, e.pos),
    );
    const moves = this.moveTargets(e);
    for (const t of targets) {
      let best: { k: string; cost: number } | null = null;
      for (const [k, n] of moves) {
        const [q, r] = k.split(',').map(Number);
        if (!this.canAttackFrom(e, { q, r }, t.pos)) continue;
        if (!best || n.cost < best.cost) best = { k, cost: n.cost };
      }
      if (best) {
        const [q, r] = best.k.split(',').map(Number);
        return { path: Battle.path(moves, { q, r }), targetId: t.id };
      }
    }
    // Ninguém ao alcance: aproxima-se da de menor vida (campo de distâncias até as
    // posições de ataque) terminando no hex livre mais próximo do objetivo.
    for (const t of targets) {
      const goals: Axial[] = [];
      for (const tile of this.tiles.values()) {
        if (tile.terrain === 'muro') continue;
        const occ = this.unitAt(tile.pos);
        if (occ && occ !== e && occ.team !== e.team) continue;
        if (this.canAttackFrom(e, tile.pos, t.pos)) goals.push(tile.pos);
      }
      const field = this.distanceField(goals, e.team);
      let best: { k: string; d: number; cost: number } | null = null;
      for (const [k, n] of moves) {
        const d = field.get(k) ?? Infinity;
        if (!isFinite(d)) continue;
        if (!best || d < best.d || (d === best.d && n.cost < best.cost))
          best = { k, d, cost: n.cost };
      }
      if (!best) continue;
      const [q, r] = best.k.split(',').map(Number);
      return { path: Battle.path(moves, { q, r }), targetId: null };
    }
    return { path: [e.pos], targetId: null };
  }

  /** Distância (custo de movimento) de cada hex até o conjunto `goals`, para o time `team`. */
  distanceField(goals: Axial[], team: Team): Map<string, number> {
    const dist = new Map<string, number>();
    const open: { h: Axial; d: number }[] = [];
    for (const g of goals) {
      dist.set(key(g), 0);
      open.push({ h: g, d: 0 });
    }
    while (open.length) {
      open.sort((a, b) => a.d - b.d);
      const cur = open.shift()!;
      if (cur.d > (dist.get(key(cur.h)) ?? Infinity)) continue;
      // custo de sair de `n` em direção a `cur` = custo de entrar em `cur`
      const enter = this.moveCost(cur.h);
      for (const n of neighbors(cur.h)) {
        const t = this.tile(n);
        if (!t || t.terrain === 'muro') continue;
        const occ = this.unitAt(n);
        if (occ && occ.team !== team) continue;
        const nd = cur.d + enter;
        if (nd < (dist.get(key(n)) ?? Infinity)) {
          dist.set(key(n), nd);
          open.push({ h: n, d: nd });
        }
      }
    }
    return dist;
  }

  /** Executa o movimento do plano (o ataque é feito à parte, após a animação). */
  applyEnemyMove(e: Unit, plan: EnemyPlan): void {
    const last = plan.path[plan.path.length - 1];
    if (last) e.pos = last;
    e.moved = true;
  }
}
