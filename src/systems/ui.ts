import Phaser from 'phaser';
import { FONT_UI, PAL, PALS } from '../style/palette';

export const textStyle = (
  size: number,
  color: string = PALS.branco,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONT_UI,
  fontSize: `${size}px`,
  fontStyle: '700',
  color,
  stroke: PALS.tinta,
  strokeThickness: size >= 28 ? 6 : 4,
  ...extra,
});

/** Pop de UI: scale 1 → 1.1 → 1 em 140 ms. */
export const pop = (scene: Phaser.Scene, target: Phaser.GameObjects.GameObject): void => {
  scene.tweens.add({
    targets: target,
    scale: 1.1,
    duration: 140,
    ease: 'Quad.easeOut',
    yoyo: true,
  });
};

export const panel = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 0.45,
): Phaser.GameObjects.Graphics => {
  const g = scene.add.graphics();
  g.fillStyle(PAL.painel, alpha).fillRoundedRect(x, y, w, h, 12);
  return g;
};

export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly bw: number,
    private readonly bh: number,
    text: string,
    onClick: () => void,
    size = 22,
  ) {
    super(scene, x, y);
    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, text, textStyle(size, PALS.tinta, { strokeThickness: 0 }))
      .setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.setSize(bw, bh);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => this.enabled && this.draw(true));
    this.on('pointerout', () => this.draw(false));
    this.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.enabled || p.rightButtonDown()) return;
      pop(scene, this);
      onClick();
    });
    this.draw(false);
    scene.add.existing(this);
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.draw(false);
    return this;
  }

  setText(t: string): this {
    this.label.setText(t);
    return this;
  }

  private draw(hover: boolean): void {
    const g = this.bg;
    g.clear();
    const fill = !this.enabled ? 0x6d6a63 : hover ? PAL.turquesa : PAL.areiaTerra;
    g.fillStyle(PAL.tinta, 1).fillRoundedRect(-this.bw / 2, -this.bh / 2 + 4, this.bw, this.bh, 12);
    g.fillStyle(fill, 1).fillRoundedRect(-this.bw / 2, -this.bh / 2, this.bw, this.bh, 12);
    g.lineStyle(3, PAL.tinta, 1).strokeRoundedRect(
      -this.bw / 2,
      -this.bh / 2,
      this.bw,
      this.bh,
      12,
    );
    this.label.setColor(this.enabled ? PALS.tinta : '#3b3833');
  }
}

export const wait = (scene: Phaser.Scene, ms: number): Promise<void> =>
  new Promise((res) => scene.time.delayedCall(ms, () => res()));

export const tweenP = (
  scene: Phaser.Scene,
  cfg: Phaser.Types.Tweens.TweenBuilderConfig,
): Promise<void> =>
  new Promise((res) => {
    scene.tweens.add({ ...cfg, onComplete: () => res() });
  });
