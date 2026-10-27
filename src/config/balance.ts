/** TODAS as constantes de balanceamento ficam aqui. */

export type UnitKind =
  'lanceiro' | 'arqueiro' | 'curandeira' | 'saqueador' | 'fundeiro' | 'capitao';

export type AbilityKind = 'estocada' | 'perfurante' | 'cura' | 'none';

export interface UnitStats {
  name: string;
  maxHp: number;
  move: number;
  rangeMin: number;
  rangeMax: number;
  dmg: number;
  ability: AbilityKind;
}

export const UNIT_STATS: Record<UnitKind, UnitStats> = {
  // Jogador
  lanceiro: {
    name: 'Lanceiro',
    maxHp: 16,
    move: 3,
    rangeMin: 1,
    rangeMax: 1,
    dmg: 5,
    ability: 'estocada',
  },
  arqueiro: {
    name: 'Arqueiro',
    maxHp: 10,
    move: 3,
    rangeMin: 1,
    rangeMax: 4,
    dmg: 4,
    ability: 'perfurante',
  },
  curandeira: {
    name: 'Curandeira',
    maxHp: 11,
    move: 4,
    rangeMin: 1,
    rangeMax: 1,
    dmg: 2,
    ability: 'cura',
  },
  // Inimigos
  saqueador: {
    name: 'Saqueador',
    maxHp: 10,
    move: 3,
    rangeMin: 1,
    rangeMax: 1,
    dmg: 4,
    ability: 'none',
  },
  fundeiro: {
    name: 'Fundeiro',
    maxHp: 7,
    move: 3,
    rangeMin: 2,
    rangeMax: 3,
    dmg: 3,
    ability: 'none',
  },
  capitao: {
    name: 'Capitão',
    maxHp: 14,
    move: 2,
    rangeMin: 1,
    rangeMax: 1,
    dmg: 5,
    ability: 'none',
  },
};

export const ABILITY = {
  /** Lanceiro: estocada em linha (hex adjacente + o seguinte na mesma direção). */
  estocada: { name: 'Estocada', dmg: 4, collisionBonus: 2, cooldown: 2 },
  /** Arqueiro: tiro perfurante em linha reta, atravessa mata, para em muro. */
  perfurante: { name: 'Tiro perfurante', dmg: 5, length: 5, cooldown: 3 },
  /** Curandeira: cura a si ou a um aliado adjacente. */
  cura: { name: 'Chá de ervas', heal: 6, cooldown: 2 },
} as const;

export const TERRAIN_COST = { campo: 1, mata: 2, muro: Infinity } as const;

export const RULES = {
  maxTurns: 8,
} as const;

export const TIMING = {
  stepMs: 150,
  enemyThinkMs: 380,
  attackLungeMs: 120,
  projectileMs: 320,
  betweenEnemiesMs: 220,
  autoEndTurnMs: 450,
} as const;
