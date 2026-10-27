import Phaser from 'phaser';
import { RULES } from '../config/balance';
import { FONT_TITLE, PAL, PALS } from '../style/palette';
import { sfx } from '../systems/audio';
import { HEX_VSTEP, HEX_W } from '../systems/hex';
import { isDebug } from '../systems/settings';
import { HEX_TEX_CY, hexTexHeight, TERRAIN_GFX } from '../systems/textures';
import { textStyle } from '../systems/ui';

export class TitleScene extends Phaser.Scene {
  private starting = false;

  constructor() {
    super('Title');
  }

  create(): void {
    this.starting = false;
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.drawBackdrop();

    const title = this.add
      .text(640, 220, 'Sete Povos', {
        fontFamily: FONT_TITLE,
        fontStyle: '800',
        fontSize: '104px',
        color: PALS.areiaTerra,
        stroke: PALS.tinta,
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setShadow(0, 6, PALS.preto, 0, true, true);
    this.tweens.add({
      targets: title,
      y: 214,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(
        640,
        300,
        'Tática por turnos na praça de uma redução missioneira',
        textStyle(24, PALS.branco),
      )
      .setOrigin(0.5);

    const press = this.add
      .text(640, 430, 'Pressione Espaço para começar', textStyle(32, PALS.turquesa))
      .setOrigin(0.5);
    this.tweens.add({ targets: press, alpha: 0.45, duration: 700, yoyo: true, repeat: -1 });

    const controls = [
      'Mouse: clique para selecionar, mover e atacar · botão direito cancela',
      'Setas/WASD: cursor · Z/Espaço: confirmar · X/Shift: habilidade/cancelar',
      'Q: próxima unidade · E: encerrar turno · Esc: pausa · R: reiniciar',
      `Objetivo: elimine os 4 invasores em até ${RULES.maxTurns} turnos`,
    ];
    controls.forEach((c, i) =>
      this.add
        .text(640, 496 + i * 32, c, textStyle(20, i === 3 ? PALS.hlHabilidade : PALS.areiaTerra))
        .setOrigin(0.5),
    );

    this.add
      .text(
        640,
        690,
        `v0.1 · arte gerada por código · fontes Google (OFL)${isDebug() ? ' · DEBUG' : ''}`,
        textStyle(16),
      )
      .setOrigin(0.5)
      .setDepth(20)
      .setAlpha(0.5);

    const go = () => this.startGame();
    this.input.keyboard?.on('keydown-SPACE', go);
    this.input.keyboard?.on('keydown-ENTER', go);
    this.input.keyboard?.on('keydown-Z', go);
    this.input.on('pointerdown', go);
  }

  private drawBackdrop(): void {
    // diorama de hexes ao fundo
    const layout = ['..m.#..m..m.', '.m..m..#..m.', 'm..#..m...#.', '..m...m..m..'];
    const x0 = 640 - HEX_W * 5.75;
    const y0 = 380;
    layout.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        const t = ch === 'm' ? 'mata' : ch === '#' ? 'muro' : 'campo';
        const gfx = TERRAIN_GFX[t];
        const x = x0 + c * HEX_W + (r & 1 ? HEX_W / 2 : 0);
        const y = y0 + r * HEX_VSTEP;
        const H = hexTexHeight(gfx.thick);
        this.add
          .image(x, y, `hex-${t}`)
          .setOrigin(0.5, (HEX_TEX_CY + gfx.elev) / H)
          .setAlpha(0.28)
          .setDepth(r - 50);
        if (t === 'mata')
          this.add
            .image(x - 8, y - 4, 'tree')
            .setOrigin(0.5, 0.92)
            .setAlpha(0.3)
            .setDepth(r - 49.5);
      }
    });
    this.add.rectangle(640, 360, 1280, 720, PAL.fundo, 0.35).setDepth(-10);
    this.add
      .particles(0, 0, 'leaf', {
        x: { min: 0, max: 1280 },
        y: -20,
        speedY: { min: 20, max: 40 },
        speedX: { min: -15, max: 25 },
        rotate: { min: 0, max: 360 },
        lifespan: 16000,
        frequency: 900,
        maxAliveParticles: 14,
        tint: [PAL.mata, PAL.folha, PAL.arvoreClara],
        alpha: 0.8,
      })
      .setDepth(-5);
  }

  private startGame(): void {
    if (this.starting) return;
    this.starting = true;
    sfx.unlock();
    sfx.select();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start('Game'),
    );
  }
}
