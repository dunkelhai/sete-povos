import Phaser from 'phaser';
import { FONT_TITLE, PAL, PALS } from '../style/palette';
import { sfx } from '../systems/audio';
import { settings } from '../systems/settings';
import { Button, textStyle } from '../systems/ui';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(): void {
    this.add.rectangle(640, 360, 1280, 720, PAL.painel, 0.6).setInteractive();
    const title = this.add
      .text(640, 220, 'Pausa', {
        fontFamily: FONT_TITLE,
        fontStyle: '800',
        fontSize: '64px',
        color: PALS.areiaTerra,
        stroke: PALS.tinta,
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScale(0.6);
    this.tweens.add({ targets: title, scale: 1, duration: 300, ease: 'Back.easeOut' });

    const resume = () => this.resumeGame();
    const motionLabel = () => `Reduzir tremor/flash: ${settings.reduceMotion ? 'Sim' : 'Não'} (T)`;
    const toggle = () => {
      settings.reduceMotion = !settings.reduceMotion;
      motion.setText(motionLabel());
      sfx.select();
    };
    const restart = () => {
      this.scene.stop();
      this.scene.stop('Game');
      this.scene.start('Game');
    };
    const menu = () => {
      this.scene.stop();
      this.scene.stop('Game');
      this.scene.start('Title');
    };

    new Button(this, 640, 340, 420, 56, 'Continuar (Esc)', resume, 28);
    const motion = new Button(this, 640, 412, 420, 56, motionLabel(), toggle, 22);
    new Button(this, 640, 484, 420, 56, 'Reiniciar (R)', restart, 28);
    new Button(this, 640, 556, 420, 56, 'Menu (M)', menu, 28);
    this.add
      .text(640, 616, 'A partida fica congelada enquanto a pausa está aberta.', textStyle(18))
      .setOrigin(0.5)
      .setAlpha(0.7);

    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', resume);
    kb?.on('keydown-T', toggle);
    kb?.on('keydown-R', restart);
    kb?.on('keydown-M', menu);
  }

  private resumeGame(): void {
    this.scene.stop();
    this.scene.resume('Game');
  }
}
