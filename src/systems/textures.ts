/** Toda a arte é gerada por código uma única vez (Graphics → generateTexture). */
import Phaser from 'phaser';
import type { UnitKind } from '../config/balance';
import { PAL } from '../style/palette';
import { hexCorners } from './hex';
import type { Terrain } from './battle';

export interface TileGfx {
  top: number;
  side: number;
  sideDark: number;
  thick: number;
  elev: number;
}

/**
 * O muro é um bloco elevado (18 px acima do chão) apoiado numa base de 10 px:
 * face lateral total de 28 px, contra 10 px do campo e 12 px da mata.
 */
export const TERRAIN_GFX: Record<Terrain | 'base', TileGfx> = {
  campo: { top: PAL.campo, side: PAL.campoLado, sideDark: PAL.campoLadoEsc, thick: 10, elev: 0 },
  mata: { top: PAL.mata, side: PAL.mataLado, sideDark: PAL.mataLadoEsc, thick: 12, elev: 0 },
  muro: { top: PAL.muro, side: PAL.muroLado, sideDark: PAL.muroLadoEsc, thick: 18, elev: 18 },
  base: { top: PAL.muroLado, side: PAL.muroLado, sideDark: PAL.muroLadoEsc, thick: 10, elev: 0 },
};

/** Centro do topo dentro da textura do hex. */
export const HEX_TEX_W = 100;
export const HEX_TEX_CY = 44;

export const hexTexHeight = (thick: number): number => HEX_TEX_CY + 41 + thick + 3;

type Pt = { x: number; y: number };

const shift = (pts: Pt[], dx: number, dy: number): Pt[] =>
  pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));

function drawHexTile(scene: Phaser.Scene, terrain: Terrain | 'base'): void {
  const gfx = TERRAIN_GFX[terrain];
  const g = scene.add.graphics();
  const cx = HEX_TEX_W / 2;
  const cy = HEX_TEX_CY;
  const c = hexCorners();
  // c[0]=(48.5,-20) c[1]=(48.5,20) c[2]=(0,40) c[3]=(-48.5,20) c[4]=(-48.5,-20) c[5]=(0,-40)
  const t = gfx.thick;
  const left = shift(
    [c[3], c[2], { x: c[2].x, y: c[2].y + t }, { x: c[3].x, y: c[3].y + t }],
    cx,
    cy,
  );
  const right = shift(
    [c[2], c[1], { x: c[1].x, y: c[1].y + t }, { x: c[2].x, y: c[2].y + t }],
    cx,
    cy,
  );
  g.fillStyle(gfx.side, 1).fillPoints(left, true);
  g.fillStyle(gfx.sideDark, 1).fillPoints(right, true);
  if (terrain === 'muro') {
    // fiadas de tijolo na face lateral
    g.lineStyle(2, PAL.muroLadoEsc, 0.6);
    for (let k = 6; k < t; k += 6) {
      g.lineBetween(cx + c[3].x, cy + c[3].y + k, cx + c[2].x, cy + c[2].y + k);
      g.lineBetween(cx + c[2].x, cy + c[2].y + k, cx + c[1].x, cy + c[1].y + k);
    }
    g.fillStyle(PAL.muroLadoEsc, 0.5);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 4; i++) {
        const f = (i + (row % 2) * 0.5 + 0.25) / 4;
        const xl = c[3].x + (c[2].x - c[3].x) * f;
        const yl = c[3].y + (c[2].y - c[3].y) * f + row * 6;
        g.fillRect(cx + xl, cy + yl + 1, 2, 5);
        const xr = c[2].x + (c[1].x - c[2].x) * f;
        const yr = c[2].y + (c[1].y - c[2].y) * f + row * 6;
        g.fillRect(cx + xr, cy + yr + 1, 2, 5);
      }
    }
  }
  const top = shift(c, cx, cy);
  g.fillStyle(gfx.top, 1).fillPoints(top, true);
  // detalhes do topo
  const rnd = new Phaser.Math.RandomDataGenerator([terrain]);
  if (terrain === 'campo') {
    g.lineStyle(2, PAL.campoLado, 0.8);
    for (let i = 0; i < 9; i++) {
      const x = cx + rnd.between(-30, 30);
      const y = cy + rnd.between(-18, 18);
      g.lineBetween(x - 3, y - 4, x, y);
      g.lineBetween(x, y, x + 3, y - 4);
    }
  } else if (terrain === 'mata') {
    g.fillStyle(PAL.mataLado, 0.7);
    for (let i = 0; i < 7; i++)
      g.fillEllipse(cx + rnd.between(-28, 28), cy + rnd.between(-16, 16), 12, 7);
  } else if (terrain === 'muro') {
    g.lineStyle(2, PAL.muroLado, 0.7);
    g.lineBetween(cx - 30, cy - 6, cx + 30, cy - 6);
    g.lineBetween(cx - 30, cy + 8, cx + 30, cy + 8);
    g.lineBetween(cx - 8, cy - 20, cx - 8, cy - 6);
    g.lineBetween(cx + 14, cy - 6, cx + 14, cy + 8);
    g.lineBetween(cx - 14, cy + 8, cx - 14, cy + 22);
  }
  g.lineStyle(2, PAL.tinta, 0.85).strokePoints(top, true, true);
  g.generateTexture(`hex-${terrain}`, HEX_TEX_W, hexTexHeight(t));
  g.destroy();
}

function drawHighlights(scene: Phaser.Scene): void {
  const c = shift(hexCorners(53), HEX_TEX_W / 2, HEX_TEX_CY);
  let g = scene.add.graphics();
  g.fillStyle(PAL.branco, 0.5).fillPoints(c, true);
  g.lineStyle(3, PAL.branco, 1).strokePoints(c, true, true);
  g.generateTexture('hl', HEX_TEX_W, 88);
  g.destroy();
  g = scene.add.graphics();
  g.lineStyle(3, PAL.branco, 1).strokePoints(c, true, true);
  g.generateTexture('hl-border', HEX_TEX_W, 88);
  g.destroy();
}

function drawTree(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(PAL.tinta, 0.25).fillEllipse(18, 44, 26, 8);
  g.fillStyle(PAL.tronco, 1).fillRoundedRect(15, 28, 7, 16, 3);
  g.lineStyle(2, PAL.tinta, 0.9).strokeRoundedRect(15, 28, 7, 16, 3);
  g.fillStyle(PAL.mataLado, 1).fillCircle(18, 22, 13);
  g.fillStyle(PAL.mata, 1).fillCircle(14, 17, 10);
  g.fillStyle(PAL.arvoreClara, 1).fillCircle(21, 12, 8);
  g.lineStyle(2, PAL.tinta, 0.8).strokeCircle(18, 22, 13);
  g.generateTexture('tree', 36, 48);
  g.destroy();
}

function drawChurch(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const W = 170;
  const H = 150;
  // sombra
  g.fillStyle(PAL.tinta, 0.3).fillEllipse(W / 2, H - 10, 150, 22);
  // nave
  g.fillStyle(PAL.areiaTerra, 1).fillRect(30, 70, 110, 70);
  g.fillStyle(PAL.muroLado, 0.35).fillRect(30, 120, 110, 20);
  g.lineStyle(3, PAL.tinta, 1).strokeRect(30, 70, 110, 70);
  // frontão
  g.fillStyle(PAL.areiaTerra, 1).fillTriangle(24, 72, 146, 72, 85, 36);
  g.lineStyle(3, PAL.tinta, 1).strokeTriangle(24, 72, 146, 72, 85, 36);
  g.fillStyle(PAL.muro, 1).fillCircle(85, 58, 7);
  g.lineStyle(2, PAL.tinta, 1).strokeCircle(85, 58, 7);
  // porta e janelas
  g.fillStyle(PAL.tronco, 1).fillRoundedRect(72, 100, 26, 40, { tl: 13, tr: 13, bl: 0, br: 0 });
  g.lineStyle(2, PAL.tinta, 1).strokeRoundedRect(72, 100, 26, 40, { tl: 13, tr: 13, bl: 0, br: 0 });
  g.fillStyle(PAL.tinta, 0.8)
    .fillRoundedRect(44, 88, 12, 18, 5)
    .fillRoundedRect(114, 88, 12, 18, 5);
  // torre
  g.fillStyle(PAL.areiaTerra, 1).fillRect(132, 24, 28, 116);
  g.lineStyle(3, PAL.tinta, 1).strokeRect(132, 24, 28, 116);
  g.fillStyle(PAL.tinta, 0.8).fillRoundedRect(140, 40, 12, 16, 5);
  g.fillStyle(PAL.telhado, 1).fillTriangle(128, 26, 164, 26, 146, 6);
  g.lineStyle(3, PAL.tinta, 1).strokeTriangle(128, 26, 164, 26, 146, 6);
  g.lineStyle(3, PAL.tinta, 1).lineBetween(146, 6, 146, -2);
  g.lineBetween(141, 1, 151, 1);
  g.generateTexture('church', W, H);
  g.destroy();
}

interface UnitLook {
  team: number;
  teamDark: number;
}

function drawUnit(scene: Phaser.Scene, kind: UnitKind, look: UnitLook): void {
  const g = scene.add.graphics();
  const ink = PAL.tinta;
  const W = 64;
  const H = 72;
  // estandarte (atrás)
  g.lineStyle(3, ink, 1).lineBetween(10, 8, 10, 52);
  g.fillStyle(look.team, 1).fillTriangle(11, 9, 11, 25, 26, 17);
  g.lineStyle(2, ink, 1).strokeTriangle(11, 9, 11, 25, 26, 17);
  // cabelo atrás (curandeira)
  if (kind === 'curandeira') {
    g.fillStyle(PAL.cabelo, 1).fillRoundedRect(17, 18, 30, 30, 10);
    g.lineStyle(3, ink, 1).strokeRoundedRect(17, 18, 30, 30, 10);
  }
  // corpo
  g.fillStyle(look.team, 1).fillRoundedRect(15, 34, 34, 34, 11);
  g.fillStyle(look.teamDark, 1).fillRoundedRect(15, 56, 34, 12, { tl: 0, tr: 0, bl: 11, br: 11 });
  g.lineStyle(3, ink, 1).strokeRoundedRect(15, 34, 34, 34, 11);
  // cinto
  g.fillStyle(PAL.tronco, 1).fillRect(16, 52, 32, 4);
  // cabeça
  g.fillStyle(PAL.pele, 1).fillCircle(32, 24, 14);
  g.fillStyle(PAL.peleSombra, 1).fillEllipse(32, 33, 18, 6);
  g.lineStyle(3, ink, 1).strokeCircle(32, 24, 14);
  g.fillStyle(ink, 1).fillCircle(27, 24, 2).fillCircle(37, 24, 2);
  // detalhes por tipo
  switch (kind) {
    case 'lanceiro':
      g.fillStyle(look.team, 1).fillRect(18, 13, 28, 5);
      g.lineStyle(2, ink, 1).strokeRect(18, 13, 28, 5);
      g.lineStyle(4, PAL.tronco, 1).lineBetween(54, 6, 54, 68);
      g.fillStyle(PAL.metal, 1).fillTriangle(50, 10, 58, 10, 54, 0);
      g.lineStyle(2, ink, 1).strokeTriangle(50, 10, 58, 10, 54, 0);
      g.fillStyle(PAL.pele, 1).fillCircle(52, 46, 5);
      g.lineStyle(2, ink, 1).strokeCircle(52, 46, 5);
      break;
    case 'arqueiro':
      g.fillStyle(PAL.tronco, 1).fillRoundedRect(42, 30, 8, 22, 3);
      g.lineStyle(3, PAL.tronco, 1);
      g.beginPath();
      g.arc(46, 42, 16, -1.2, 1.2, false);
      g.strokePath();
      g.lineStyle(1, PAL.areiaTerra, 1).lineBetween(51.8, 27, 51.8, 57);
      g.fillStyle(look.teamDark, 1).fillTriangle(18, 14, 46, 14, 32, 4);
      g.lineStyle(2, ink, 1).strokeTriangle(18, 14, 46, 14, 32, 4);
      break;
    case 'curandeira':
      g.lineStyle(4, PAL.tronco, 1).lineBetween(54, 14, 54, 68);
      g.fillStyle(PAL.mata, 1).fillCircle(54, 12, 7);
      g.fillStyle(PAL.folha, 1).fillCircle(51, 9, 4).fillCircle(58, 12, 3);
      g.lineStyle(2, ink, 1).strokeCircle(54, 12, 7);
      g.fillStyle(PAL.areiaTerra, 1).fillCircle(32, 12, 4);
      break;
    case 'saqueador':
      g.fillStyle(look.teamDark, 1).fillRect(18, 12, 28, 6);
      g.lineStyle(2, ink, 1).strokeRect(18, 12, 28, 6);
      g.lineStyle(6, PAL.tronco, 1).lineBetween(52, 66, 56, 30);
      g.fillStyle(PAL.tronco, 1).fillCircle(56, 28, 7);
      g.lineStyle(2, ink, 1).strokeCircle(56, 28, 7);
      break;
    case 'fundeiro':
      g.fillStyle(look.teamDark, 1).fillRoundedRect(17, 8, 30, 14, {
        tl: 14,
        tr: 14,
        bl: 0,
        br: 0,
      });
      g.lineStyle(2, ink, 1).strokeRoundedRect(17, 8, 30, 14, { tl: 14, tr: 14, bl: 0, br: 0 });
      g.lineStyle(2, PAL.areiaTerra, 1).lineBetween(46, 46, 56, 24);
      g.lineBetween(46, 46, 60, 30);
      g.fillStyle(PAL.metal, 1).fillCircle(58, 27, 4);
      g.lineStyle(2, ink, 1).strokeCircle(58, 27, 4);
      break;
    case 'capitao':
      g.fillStyle(PAL.tinta, 1).fillEllipse(32, 13, 40, 9);
      g.fillStyle(PAL.tinta, 1).fillRoundedRect(22, 0, 20, 14, 5);
      g.fillStyle(look.team, 1).fillRect(22, 9, 20, 3);
      g.lineStyle(3, PAL.metal, 1).lineBetween(50, 64, 58, 26);
      g.lineStyle(3, PAL.areiaTerra, 1).lineBetween(46, 56, 56, 58);
      g.fillStyle(PAL.areiaTerra, 1).fillRect(17, 36, 6, 6).fillRect(41, 36, 6, 6);
      break;
  }
  g.generateTexture(`unit-${kind}`, W, H);
  g.destroy();
}

function drawMisc(scene: Phaser.Scene): void {
  let g = scene.add.graphics();
  g.fillStyle(PAL.tinta, 0.3).fillEllipse(30, 10, 56, 18);
  g.generateTexture('shadow', 60, 20);
  g.destroy();

  g = scene.add.graphics();
  g.lineStyle(4, PAL.branco, 1).strokeEllipse(36, 14, 66, 24);
  g.generateTexture('sel-ring', 72, 28);
  g.destroy();

  g = scene.add.graphics();
  g.lineStyle(6, PAL.branco, 1).strokeCircle(48, 48, 44);
  g.generateTexture('ring', 96, 96);
  g.destroy();

  g = scene.add.graphics();
  g.fillStyle(PAL.branco, 1).fillCircle(4, 4, 4);
  g.generateTexture('dot', 8, 8);
  g.destroy();

  g = scene.add.graphics();
  g.fillStyle(PAL.branco, 1).fillRect(0, 0, 6, 6);
  g.generateTexture('px', 6, 6);
  g.destroy();

  g = scene.add.graphics();
  g.fillStyle(PAL.folha, 1).fillEllipse(6, 4, 12, 7);
  g.lineStyle(1, PAL.mataLado, 1).lineBetween(1, 4, 11, 4);
  g.generateTexture('leaf', 12, 8);
  g.destroy();

  g = scene.add.graphics();
  g.lineStyle(3, PAL.tronco, 1).lineBetween(2, 5, 26, 5);
  g.fillStyle(PAL.metal, 1).fillTriangle(24, 1, 24, 9, 32, 5);
  g.fillStyle(PAL.areiaTerra, 1).fillTriangle(0, 1, 6, 5, 0, 9);
  g.generateTexture('arrow', 32, 10);
  g.destroy();

  g = scene.add.graphics();
  g.fillStyle(PAL.metal, 1).fillCircle(6, 6, 5);
  g.lineStyle(2, PAL.tinta, 1).strokeCircle(6, 6, 5);
  g.generateTexture('stone', 12, 12);
  g.destroy();
}

export function generateAllTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('hex-campo')) return;
  (['campo', 'mata', 'muro', 'base'] as const).forEach((t) => drawHexTile(scene, t));
  drawHighlights(scene);
  drawTree(scene);
  drawChurch(scene);
  const player: UnitLook = { team: PAL.turquesa, teamDark: PAL.turquesaEscuro };
  const enemy: UnitLook = { team: PAL.inimigo, teamDark: PAL.inimigoEscuro };
  drawUnit(scene, 'lanceiro', player);
  drawUnit(scene, 'arqueiro', player);
  drawUnit(scene, 'curandeira', player);
  drawUnit(scene, 'saqueador', enemy);
  drawUnit(scene, 'fundeiro', enemy);
  drawUnit(scene, 'capitao', enemy);
  drawMisc(scene);
}
