import Phaser from 'phaser';
import type { Unit } from '../systems/battle';
import { PAL } from '../style/palette';

/** Representação visual de uma unidade: sombra, sprite "chunky", barra de vida. */
export class UnitView extends Phaser.GameObjects.Container {
  readonly unitId: string;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly idle: Phaser.Tweens.Tween;
  private glow: Phaser.FX.Glow | null = null;
  private dimmed = false;

  constructor(scene: Phaser.Scene, unit: Unit, x: number, y: number) {
    super(scene, x, y);
    this.unitId = unit.id;
    const shadow = scene.add.image(0, 2, 'shadow');
    this.sprite = scene.add.sprite(0, 6, `unit-${unit.kind}`).setOrigin(0.5, 1);
    if (unit.team === 'enemy') this.sprite.setFlipX(true);
    this.bar = scene.add.graphics();
    this.add([shadow, this.sprite, this.bar]);
    this.idle = scene.tweens.add({
      targets: this.sprite,
      y: 4,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: Math.random() * 600,
    });
    this.drawBar(unit);
    this.setSize(56, 72);
    scene.add.existing(this);
    this.syncDepth();
  }

  syncDepth(): void {
    this.setDepth(100 + this.y + 0.6);
  }

  drawBar(unit: Unit): void {
    const g = this.bar;
    g.clear();
    const w = 44;
    const x = -w / 2;
    const y = -74;
    g.fillStyle(PAL.tinta, 0.9).fillRoundedRect(x - 2, y - 2, w + 4, 10, 4);
    g.fillStyle(PAL.vidaPerdida, 1).fillRect(x, y, w, 6);
    const frac = Math.max(0, unit.hp / unit.maxHp);
    const col = unit.team === 'player' ? PAL.turquesa : PAL.inimigo;
    g.fillStyle(col, 1).fillRect(x, y, Math.round(w * frac), 6);
    // marcas a cada 2 de vida
    g.fillStyle(PAL.tinta, 0.6);
    for (let i = 2; i < unit.maxHp; i += 2) g.fillRect(x + (w * i) / unit.maxHp, y, 1, 6);
  }

  setDone(done: boolean): void {
    this.dimmed = done;
    if (done) this.sprite.setTint(PAL.esgotado);
    else this.sprite.clearTint();
  }

  flash(): void {
    this.sprite.setTintFill(PAL.branco);
    this.scene.time.delayedCall(80, () => {
      if (!this.active) return;
      this.sprite.clearTint();
      if (this.dimmed) this.sprite.setTint(PAL.esgotado);
    });
  }

  setGlow(on: boolean): void {
    const fx = this.sprite.postFX;
    if (!fx) return;
    if (on && !this.glow) this.glow = fx.addGlow(PAL.turquesa, 2, 0, false, 0.1, 10);
    else if (!on && this.glow) {
      fx.remove(this.glow);
      this.glow = null;
    }
  }

  die(): Promise<void> {
    this.setGlow(false);
    this.idle.stop();
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        scaleX: 1.3,
        scaleY: 0.2,
        y: this.y + 10,
        duration: 360,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          this.destroy();
          resolve();
        },
      });
    });
  }
}
