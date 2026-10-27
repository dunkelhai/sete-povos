import type { UnitKind } from './balance';

/**
 * Mapa 9×7 em coordenadas "offset" (linhas ímpares deslocadas para a direita).
 * Legenda: '.' campo · 'm' mata · '#' muro · 'I' muro com a igreja (prop)
 */
export const MAP_ROWS: readonly string[] = [
  '...m.....',
  '.m..II...',
  '.m...#.m.',
  '...m...m.',
  '.##m.....',
  '.....m#..',
  '.....m...',
];

export interface Spawn {
  kind: UnitKind;
  col: number;
  row: number;
}

export const PLAYER_SPAWNS: readonly Spawn[] = [
  { kind: 'lanceiro', col: 2, row: 5 },
  { kind: 'arqueiro', col: 1, row: 6 },
  { kind: 'curandeira', col: 0, row: 5 },
];

export const ENEMY_SPAWNS: readonly Spawn[] = [
  { kind: 'saqueador', col: 7, row: 0 },
  { kind: 'saqueador', col: 8, row: 3 },
  { kind: 'fundeiro', col: 8, row: 1 },
  { kind: 'capitao', col: 6, row: 1 },
];
