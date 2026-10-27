import Phaser from 'phaser';
import { ABILITY, RULES, TIMING, UNIT_STATS } from '../config/balance';
import { UnitView } from '../entities/UnitView';
import { FONT_TITLE, PAL, PALS } from '../style/palette';
import { sfx } from '../systems/audio';
import { Battle } from '../systems/battle';
import type { AbilityOption, Effect, Unit } from '../systems/battle';
import {
  HEX_W,
  axialToOffset,
  distance,
  eq,
  fromPixel,
  key,
  offsetToAxial,
  toPixel,
} from '../systems/hex';
import type { Axial, Layout } from '../systems/hex';
import { isDebug, settings } from '../systems/settings';
import { HEX_TEX_CY, TERRAIN_GFX, hexTexHeight } from '../systems/textures';
import { Button, panel, pop, textStyle, tweenP, wait } from '../systems/ui';

type Phase = 'player' | 'enemy' | 'ended';
type Mode = 'normal' | 'ability';

const LAYOUT: Layout = { x0: 179 + HEX_W / 2, y0: 140 };
const MAP_COLS = 9;
const MAP_ROWS_N = 7;

const ABILITY_TEXT: Record<string, string> = {
  estocada: `Atinge 2 hexes em linha (${ABILITY.estocada.dmg} de dano cada) e empurra o 1º alvo 1 hex. Se o empurrão for bloqueado: +${ABILITY.estocada.collisionBonus} de dano.`,
  perfurante: `Flecha em linha reta (até ${ABILITY.perfurante.length} hexes): ${ABILITY.perfurante.dmg} de dano em cada inimigo. Atravessa mata, para no muro.`,
  cura: `Cura ${ABILITY.cura.heal} de vida em si mesma ou num aliado adjacente.`,
  none: '—',
};

interface Tooltip {
  box: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
}

export class GameScene extends Phaser.Scene {
  battle!: Battle;
  private views = new Map<string, UnitView>();
  private phase: Phase = 'player';
  private mode: Mode = 'normal';
  private busy = false;
  private selectedId: string | null = null;
  private undo: { id: string; from: Axial } | null = null;
  private cursor: Axial = offsetToAxial(2, 5);
  private gen = 0;
  private stats = { dealt: 0, taken: 0, kills: 0 };

  private hlPool: Phaser.GameObjects.Image[] = [];
  private dotPool: Phaser.GameObjects.Image[] = [];
  private cursorImg!: Phaser.GameObjects.Image;
  private selRing!: Phaser.GameObjects.Image;
  private tips: Tooltip[] = [];

  private emSand!: Phaser.GameObjects.Particles.ParticleEmitter;
  private emPlayer!: Phaser.GameObjects.Particles.ParticleEmitter;
  private emEnemy!: Phaser.GameObjects.Particles.ParticleEmitter;
  private emSpark!: Phaser.GameObjects.Particles.ParticleEmitter;

  // HUD
  private turnText!: Phaser.GameObjects.Text;
  private foesText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private portrait!: Phaser.GameObjects.Image;
  private nameText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private statText!: Phaser.GameObjects.Text;
  private abilityTitle!: Phaser.GameObjects.Text;
  private abilityDesc!: Phaser.GameObjects.Text;
  private abilityStatus!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private btnAbility!: Button;
  private btnWait!: Button;
  private btnEnd!: Button;
  private info!: Phaser.GameObjects.Container;
  private infoText!: Phaser.GameObjects.Text;
  private fpsText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('Game');
  }

  create(): void {
    this.gen++;
    this.battle = new Battle();
    this.views.clear();
    this.phase = 'player';
    this.mode = 'normal';
    this.busy = false;
    this.selectedId = null;
    this.undo = null;
    this.cursor = offsetToAxial(2, 5);
    this.stats = { dealt: 0, taken: 0, kills: 0 };
    this.hlPool = [];
    this.dotPool = [];
    this.tips = [];
    this.fpsText = null;

    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.cameras.main.postFX?.addVignette(0.5, 0.5, 0.9, 0.2);

    this.buildMap();
    this.buildUnits();
    this.buildOverlays();
    this.buildFx();
    this.buildHud();
    this.bindInput();

    this.refresh();
    this.showBanner(`Turno 1 · Sua vez`);
    // seleciona a primeira unidade para guiar o jogador
    const first = this.battle.alive('player')[0];
    if (first) this.select(first, false);
  }

  update(): void {
    if (this.fpsText) this.fpsText.setText(`${Math.round(this.game.loop.actualFps)} fps`);
  }

  // ======================= construção =======================

  private px(h: Axial): { x: number; y: number } {
    return toPixel(h, LAYOUT);
  }

  private elevOf(h: Axial): number {
    const t = this.battle.tile(h);
    return t ? TERRAIN_GFX[t.terrain].elev : 0;
  }

  private buildMap(): void {
    const tiles = [...this.battle.tiles.values()].sort((a, b) => a.row - b.row || a.col - b.col);
    for (const t of tiles) {
      const { x, y } = this.px(t.pos);
      const ground = t.terrain === 'muro' ? 'base' : t.terrain;
      const gg = TERRAIN_GFX[ground];
      this.add
        .image(x, y, `hex-${ground}`)
        .setOrigin(0.5, HEX_TEX_CY / hexTexHeight(gg.thick))
        .setDepth(t.row * 0.01);
      if (t.terrain === 'muro') {
        const gw = TERRAIN_GFX.muro;
        this.add
          .image(x, y, 'hex-muro')
          .setOrigin(0.5, (HEX_TEX_CY + gw.elev) / hexTexHeight(gw.thick))
          .setDepth(100 + y + 0.5);
      }
      if (t.terrain === 'mata') {
        const spots = [
          { dx: -24, dy: -8, s: 0.95 },
          { dx: 22, dy: -12, s: 1.05 },
          { dx: -2, dy: -22, s: 0.9 },
        ];
        for (const s of spots) {
          const tree = this.add
            .image(x + s.dx, y + s.dy, 'tree')
            .setOrigin(0.5, 0.92)
            .setScale(s.s)
            .setDepth(100 + y + s.dy);
          this.tweens.add({
            targets: tree,
            angle: { from: -1.5, to: 1.5 },
            duration: 1800 + Math.random() * 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      }
    }
    // Igreja sobre os hexes 'I'
    const church = tiles.filter((t) => t.church);
    if (church.length) {
      const cx = church.reduce((a, t) => a + this.px(t.pos).x, 0) / church.length;
      const cy = Math.max(...church.map((t) => this.px(t.pos).y));
      this.add
        .image(cx, cy - TERRAIN_GFX.muro.elev + 22, 'church')
        .setOrigin(0.5, 1)
        .setDepth(100 + cy + 0.55);
    }
  }

  private buildUnits(): void {
    for (const u of this.battle.units) {
      const { x, y } = this.px(u.pos);
      const v = new UnitView(this, u, x, y);
      this.views.set(u.id, v);
    }
  }

  private buildOverlays(): void {
    for (let i = 0; i < MAP_COLS * MAP_ROWS_N; i++) {
      this.hlPool.push(
        this.add
          .image(0, 0, 'hl')
          .setOrigin(0.5, HEX_TEX_CY / 88)
          .setDepth(1)
          .setVisible(false),
      );
    }
    for (let i = 0; i < 12; i++) {
      this.dotPool.push(this.add.image(0, 0, 'dot').setDepth(2).setVisible(false));
    }
    this.selRing = this.add
      .image(0, 0, 'sel-ring')
      .setTint(PAL.turquesa)
      .setDepth(3)
      .setVisible(false);
    this.tweens.add({
      targets: this.selRing,
      scale: 1.1,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.cursorImg = this.add.image(0, 0, 'hl-border').setOrigin(0.5, HEX_TEX_CY / 88);
    this.tweens.add({
      targets: this.cursorImg,
      alpha: { from: 1, to: 0.5 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
    for (let i = 0; i < 4; i++) {
      const bg = this.add.graphics();
      const text = this.add
        .text(0, 0, '', textStyle(16, PALS.branco, { align: 'center', strokeThickness: 0 }))
        .setOrigin(0.5);
      const box = this.add.container(0, 0, [bg, text]).setDepth(9000).setVisible(false);
      this.tips.push({ box, bg, text });
    }
  }

  private buildFx(): void {
    const burst = (tint: number, add = false) =>
      this.add
        .particles(0, 0, 'dot', {
          lifespan: { min: 250, max: 450 },
          speed: { min: 120, max: 260 },
          scale: { start: 1, end: 0 },
          gravityY: 200,
          tint,
          emitting: false,
          blendMode: add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL,
        })
        .setDepth(9000);
    this.emSand = burst(PAL.areiaTerra);
    this.emPlayer = burst(PAL.turquesa);
    this.emEnemy = burst(PAL.inimigo);
    this.emSpark = burst(PAL.hlHabilidade, true);
    // folhas da mata caindo (ambiente)
    this.add
      .particles(0, 0, 'leaf', {
        x: { min: 160, max: 1120 },
        y: -10,
        speedY: { min: 18, max: 34 },
        speedX: { min: -12, max: 20 },
        rotate: { min: 0, max: 360 },
        lifespan: 20000,
        frequency: 1400,
        maxAliveParticles: 8,
        tint: [PAL.mata, PAL.folha],
        alpha: 0.85,
      })
      .setDepth(8000);
  }

  private buildHud(): void {
    // topo
    panel(this, 48, 12, 1184, 56).setDepth(10000);
    this.foesText = this.add
      .text(72, 40, '', textStyle(22, PALS.areiaTerra))
      .setOrigin(0, 0.5)
      .setDepth(10001);
    this.turnText = this.add.text(640, 40, '', textStyle(28)).setOrigin(0.5).setDepth(10001);
    this.phaseText = this.add.text(1208, 40, '', textStyle(22)).setOrigin(1, 0.5).setDepth(10001);

    // painel de info (hover) à direita
    const ibg = panel(this, 0, 0, 136, 178, 0.55);
    this.infoText = this.add.text(
      12,
      10,
      '',
      textStyle(16, PALS.branco, { lineSpacing: 2, strokeThickness: 0 }),
    );
    this.info = this.add
      .container(1112, 96, [ibg, this.infoText])
      .setDepth(10000)
      .setVisible(false);

    // rodapé
    panel(this, 48, 588, 1184, 124).setDepth(10000);
    const D = 10001;
    this.portrait = this.add.image(104, 650, 'unit-lanceiro').setScale(1.25).setDepth(D);
    this.nameText = this.add.text(160, 598, '', textStyle(28)).setDepth(D);
    this.hpText = this.add.text(160, 638, '', textStyle(20, PALS.vida)).setDepth(D);
    this.statText = this.add.text(160, 668, '', textStyle(20, PALS.areiaTerra)).setDepth(D);
    this.abilityTitle = this.add.text(470, 598, '', textStyle(20, PALS.hlHabilidade)).setDepth(D);
    this.abilityDesc = this.add
      .text(
        470,
        626,
        '',
        textStyle(16, PALS.branco, { wordWrap: { width: 430 }, strokeThickness: 3 }),
      )
      .setDepth(D);
    this.abilityStatus = this.add.text(470, 680, '', textStyle(16, PALS.areiaTerra)).setDepth(D);
    this.hintText = this.add
      .text(84, 650, '', textStyle(20, PALS.areiaTerra, { lineSpacing: 6 }))
      .setOrigin(0, 0.5)
      .setDepth(D);

    this.btnAbility = new Button(
      this,
      1086,
      612,
      240,
      36,
      'Habilidade (X)',
      () => this.secondary(),
      20,
    );
    this.btnWait = new Button(
      this,
      1086,
      652,
      240,
      36,
      'Esperar (Z)',
      () => this.waitSelected(),
      20,
    );
    this.btnEnd = new Button(
      this,
      1086,
      692,
      240,
      36,
      'Encerrar turno (E)',
      () => this.endTurn(),
      20,
    );
    [this.btnAbility, this.btnWait, this.btnEnd].forEach((b) => b.setDepth(D));

    this.banner = this.add
      .text(640, 330, '', {
        fontFamily: FONT_TITLE,
        fontStyle: '800',
        fontSize: '56px',
        color: PALS.areiaTerra,
        stroke: PALS.tinta,
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(9500)
      .setAlpha(0);
  }

  private bindInput(): void {
    this.input.mouse?.disableContextMenu();
    const kb = this.input.keyboard;
    kb?.addCapture('UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,TAB,F1,F2,F3,F4');
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.y > 580 || p.y < 72) return;
      const h = this.pickHex(p.worldX, p.worldY);
      if (h && !eq(h, this.cursor)) {
        this.cursor = h;
        this.refresh();
      }
    });
    this.input.on(
      'pointerdown',
      (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (over.length) return; // clique em botão do HUD
        if (p.rightButtonDown()) {
          this.cancel();
          return;
        }
        if (p.y > 580 || p.y < 72) return;
        const h = this.pickHex(p.worldX, p.worldY);
        if (!h) return;
        this.cursor = h;
        this.confirm(h);
      },
    );
    kb?.on('keydown', (ev: KeyboardEvent) => this.onKey(ev));
  }

  private onKey(ev: KeyboardEvent): void {
    if (this.phase === 'ended') {
      if (ev.code === 'Space' || ev.code === 'KeyR' || ev.code === 'KeyZ') this.restart();
      else if (ev.code === 'KeyM') this.toMenu();
      return;
    }
    if (isDebug() && this.debugKey(ev.code)) return;
    switch (ev.code) {
      case 'ArrowLeft':
      case 'KeyA':
        return this.moveCursor(-1, 0);
      case 'ArrowRight':
      case 'KeyD':
        return this.moveCursor(1, 0);
      case 'ArrowUp':
      case 'KeyW':
        return this.moveCursor(0, -1);
      case 'ArrowDown':
      case 'KeyS':
        return this.moveCursor(0, 1);
      case 'KeyZ':
      case 'Space':
      case 'Enter':
        return this.confirm(this.cursor);
      case 'KeyX':
      case 'ShiftLeft':
      case 'ShiftRight':
        return this.secondary();
      case 'Backspace':
        return this.cancel();
      case 'KeyQ':
      case 'Tab':
        return this.cycleUnit();
      case 'KeyE':
        return this.endTurn();
      case 'Escape':
        this.scene.launch('Pause');
        this.scene.pause();
        return;
      case 'KeyR':
        return this.restart();
    }
  }

  private debugKey(code: string): boolean {
    if (this.busy) return false;
    if (code === 'F1') {
      for (const e of this.battle.alive('enemy')) this.killNow(e);
      this.afterAction();
      return true;
    }
    if (code === 'F2') {
      for (const p of this.battle.alive('player')) this.killNow(p);
      this.afterAction();
      return true;
    }
    if (code === 'F3') {
      const foes = this.battle.alive('enemy');
      if (foes.length) this.killNow(Phaser.Utils.Array.GetRandom(foes));
      this.afterAction();
      return true;
    }
    if (code === 'F4') {
      if (this.fpsText) {
        this.fpsText.destroy();
        this.fpsText = null;
      } else
        this.fpsText = this.add.text(1232, 84, '', textStyle(16)).setOrigin(1, 0).setDepth(10002);
      return true;
    }
    return false;
  }

  private killNow(u: Unit): void {
    this.battle.kill(u);
    if (u.team === 'enemy') this.stats.kills++;
    const v = this.views.get(u.id);
    if (v) {
      this.views.delete(u.id);
      void v.die();
    }
    if (this.selectedId === u.id) this.deselect();
  }

  // ======================= seleção / cursor =======================

  private pickHex(x: number, y: number): Axial | null {
    // primeiro, as unidades (o sprite ultrapassa o hex para cima)
    const vs = [...this.views.values()].sort((a, b) => b.depth - a.depth);
    for (const v of vs) {
      if (v.sprite.getBounds().contains(x, y)) {
        const u = this.battle.unit(v.unitId);
        if (u?.alive) return u.pos;
      }
    }
    const lifted = fromPixel(x, y + TERRAIN_GFX.muro.elev, LAYOUT);
    if (this.battle.tile(lifted)?.terrain === 'muro') return lifted;
    const h = fromPixel(x, y, LAYOUT);
    return this.battle.tile(h) ? h : null;
  }

  private moveCursor(dc: number, dr: number): void {
    const o = axialToOffset(this.cursor);
    const col = Phaser.Math.Clamp(o.col + dc, 0, MAP_COLS - 1);
    const row = Phaser.Math.Clamp(o.row + dr, 0, MAP_ROWS_N - 1);
    this.cursor = offsetToAxial(col, row);
    this.refresh();
  }

  private get selected(): Unit | undefined {
    return this.selectedId ? this.battle.unit(this.selectedId) : undefined;
  }

  private canCommand(): boolean {
    return this.phase === 'player' && !this.busy && this.battle.outcome === 'playing';
  }

  private select(u: Unit, sound = true): void {
    const prev = this.selected;
    if (prev && prev !== u && prev.moved && !prev.acted) {
      // trocar de unidade depois de mover encerra a ação da anterior
      this.battle.wait(prev);
      this.views.get(prev.id)?.setDone(true);
    }
    this.views.get(this.selectedId ?? '')?.setGlow(false);
    this.selectedId = u.id;
    this.mode = 'normal';
    this.undo = null;
    this.views.get(u.id)?.setGlow(true);
    this.cursor = u.pos;
    if (sound) sfx.select();
    this.refresh();
    pop(this, this.portrait);
  }

  private deselect(): void {
    this.views.get(this.selectedId ?? '')?.setGlow(false);
    this.selectedId = null;
    this.mode = 'normal';
    this.undo = null;
    this.refresh();
  }

  private cycleUnit(): void {
    if (!this.canCommand()) return;
    const ready = this.battle.alive('player').filter((u) => !u.acted);
    if (!ready.length) return;
    const idx = ready.findIndex((u) => u.id === this.selectedId);
    this.select(ready[(idx + 1) % ready.length]);
  }

  /** Z / Espaço / clique esquerdo no hex `h`. */
  private confirm(h: Axial): void {
    if (!this.canCommand()) return;
    const u = this.selected;
    const at = this.battle.unitAt(h);
    if (u && !u.acted) {
      if (this.mode === 'ability') {
        const opt = this.optionAt(u, h);
        if (opt) {
          void this.doAbility(u, opt);
          return;
        }
        if (!at || at.team !== 'player') {
          this.mode = 'normal';
          sfx.cancel();
          this.refresh();
          return;
        }
      } else {
        if (at && at.team === 'enemy' && this.battle.canAttackFrom(u, u.pos, at.pos)) {
          void this.doAttack(u, at);
          return;
        }
        if (!u.moved && !at && this.battle.moveTargets(u).has(key(h))) {
          void this.doMove(u, h);
          return;
        }
        if (at === u) {
          this.waitSelected();
          return;
        }
      }
    }
    if (at && at.team === 'player' && !at.acted) {
      if (at !== u) this.select(at);
      return;
    }
    if (at && at.team === 'enemy') {
      sfx.deny();
      return;
    }
    if (u) {
      sfx.cancel();
      this.deselect();
    }
  }

  /** X / Shift: alterna habilidade; se indisponível, cancela. */
  private secondary(): void {
    if (!this.canCommand()) return;
    const u = this.selected;
    if (!u) return;
    if (this.mode === 'ability') {
      this.mode = 'normal';
      sfx.cancel();
      this.refresh();
      return;
    }
    if (this.battle.abilityReady(u) && this.battle.abilityOptions(u).length) {
      this.mode = 'ability';
      sfx.ability();
      this.refresh();
      return;
    }
    if (this.battle.abilityReady(u) || (u.cooldown > 0 && !u.acted)) {
      sfx.deny();
      pop(this, this.btnAbility);
      this.flashHint(
        u.cooldown > 0 ? `Habilidade em recarga (${u.cooldown})` : 'Nenhum alvo para a habilidade',
      );
    }
    this.cancel();
  }

  /** Botão direito / Backspace: sai do modo habilidade → desfaz movimento → desseleciona. */
  private cancel(): void {
    if (!this.canCommand()) return;
    const u = this.selected;
    if (!u) return;
    if (this.mode === 'ability') {
      this.mode = 'normal';
      sfx.cancel();
      this.refresh();
      return;
    }
    if (this.undo && this.undo.id === u.id && u.moved && !u.acted) {
      u.pos = this.undo.from;
      u.moved = false;
      this.undo = null;
      const v = this.views.get(u.id);
      if (v) {
        const p = this.px(u.pos);
        v.setPosition(p.x, p.y);
        v.syncDepth();
      }
      this.cursor = u.pos;
      sfx.cancel();
      this.refresh();
      return;
    }
    sfx.cancel();
    this.deselect();
  }

  private waitSelected(): void {
    if (!this.canCommand()) return;
    const u = this.selected;
    if (!u || u.acted) return;
    this.battle.wait(u);
    this.views.get(u.id)?.setDone(true);
    sfx.cancel();
    this.afterAction();
  }

  private optionAt(u: Unit, h: Axial): AbilityOption | undefined {
    return this.battle.abilityOptions(u).find((o) => o.area.some((a) => eq(a, h)));
  }

  // ======================= ações do jogador =======================

  private async doMove(u: Unit, to: Axial): Promise<void> {
    const gen = this.gen;
    const from = u.pos;
    const path = this.battle.moveUnit(u, to);
    if (!path.length) return;
    this.busy = true;
    this.refresh();
    await this.animatePath(u, path);
    if (gen !== this.gen) return;
    this.busy = false;
    this.undo = { id: u.id, from };
    this.cursor = u.pos;
    this.refresh();
  }

  private async doAttack(u: Unit, target: Unit): Promise<void> {
    const gen = this.gen;
    const fx = this.battle.attack(u, target);
    if (!fx) return;
    this.busy = true;
    this.refresh();
    await this.animateAttack(u, target, fx);
    if (gen !== this.gen) return;
    this.busy = false;
    this.views.get(u.id)?.setDone(true);
    this.afterAction();
  }

  private async doAbility(u: Unit, opt: AbilityOption): Promise<void> {
    const gen = this.gen;
    const fx = this.battle.useAbility(u, opt);
    if (!fx.length) return;
    this.busy = true;
    this.mode = 'normal';
    this.refresh();
    sfx.ability();
    const v = this.views.get(u.id)!;
    if (u.ability === 'estocada') {
      const tgt = opt.area[0];
      await this.lunge(v, this.px(tgt), 0.45, async () => {
        for (const a of opt.area) this.ring(a, PAL.hlHabilidade);
        await Promise.all(fx.map((f) => this.applyHit(f)));
      });
    } else if (u.ability === 'perfurante') {
      const last = opt.area[opt.area.length - 1];
      sfx.shoot();
      await this.projectile(u.pos, last, 'arrow', 0, TIMING.projectileMs + 120);
      for (const a of opt.area) this.ring(a, PAL.hlHabilidade);
      await Promise.all(fx.map((f, i) => wait(this, i * 70).then(() => this.applyHit(f))));
    } else {
      const tgt = this.battle.unit(fx[0].unitId)!;
      await tweenP(this, {
        targets: v,
        y: v.y - 14,
        duration: 140,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
      this.ring(tgt.pos, PAL.folha);
      await this.applyHit(fx[0]);
    }
    if (gen !== this.gen) return;
    this.busy = false;
    this.views.get(u.id)?.setDone(true);
    this.afterAction();
  }

  private afterAction(): void {
    for (const u of this.battle.units) {
      if (u.alive) this.views.get(u.id)?.drawBar(u);
    }
    const sel = this.selected;
    if (sel && (sel.acted || !sel.alive)) {
      this.views.get(sel.id)?.setGlow(false);
      this.selectedId = null;
      this.mode = 'normal';
      this.undo = null;
    }
    this.refresh();
    if (this.battle.outcome !== 'playing') {
      this.time.delayedCall(500, () => this.showEnd());
      return;
    }
    if (this.phase !== 'player') return;
    const ready = this.battle.alive('player').filter((p) => !p.acted);
    if (!ready.length) {
      const gen = this.gen;
      this.time.delayedCall(TIMING.autoEndTurnMs, () => gen === this.gen && this.endTurn());
    } else if (!this.selectedId) {
      this.select(ready[0], false);
    }
  }

  private endTurn(): void {
    if (!this.canCommand()) return;
    for (const u of this.battle.alive('player')) {
      if (!u.acted) this.battle.wait(u);
    }
    this.deselect();
    void this.enemyPhase();
  }

  // ======================= fase inimiga =======================

  private async enemyPhase(): Promise<void> {
    const gen = this.gen;
    this.phase = 'enemy';
    this.battle.startEnemyPhase();
    this.refresh();
    sfx.enemyTurn();
    this.showBanner('Vez dos invasores', PALS.inimigo);
    await wait(this, 700);
    for (const e of [...this.battle.alive('enemy')]) {
      if (gen !== this.gen) return;
      if (!e.alive || this.battle.outcome !== 'playing') continue;
      this.cursor = e.pos;
      this.refresh();
      await wait(this, TIMING.enemyThinkMs);
      if (gen !== this.gen) return;
      const plan = this.battle.planEnemy(e);
      this.battle.applyEnemyMove(e, plan);
      await this.animatePath(e, plan.path);
      if (gen !== this.gen) return;
      const t = plan.targetId ? this.battle.unit(plan.targetId) : undefined;
      if (t && t.alive) {
        this.cursor = t.pos;
        this.refresh();
        const fx = this.battle.attack(e, t);
        if (fx) await this.animateAttack(e, t, fx);
        if (gen !== this.gen) return;
      }
      await wait(this, TIMING.betweenEnemiesMs);
    }
    if (gen !== this.gen) return;
    this.battle.startPlayerPhase();
    if (this.battle.outcome !== 'playing') {
      this.refresh();
      this.showEnd();
      return;
    }
    this.phase = 'player';
    for (const u of this.battle.alive('player')) this.views.get(u.id)?.setDone(false);
    sfx.turn();
    const last = this.battle.turn === RULES.maxTurns;
    this.showBanner(
      last ? `Último turno!` : `Turno ${this.battle.turn} · Sua vez`,
      last ? PALS.hlAtaque : PALS.areiaTerra,
    );
    pop(this, this.turnText);
    const first = this.battle.alive('player')[0];
    if (first) this.select(first, false);
    else this.refresh();
  }

  // ======================= animações =======================

  private async animatePath(u: Unit, path: Axial[]): Promise<void> {
    const v = this.views.get(u.id);
    if (!v) return;
    for (let i = 1; i < path.length; i++) {
      const p = this.px(path[i]);
      sfx.step();
      await tweenP(this, {
        targets: v,
        x: p.x,
        y: p.y,
        duration: TIMING.stepMs,
        ease: 'Sine.easeInOut',
        onUpdate: () => v.syncDepth(),
      });
    }
    v.syncDepth();
  }

  /** Avança na direção do alvo, executa `onHit` no ápice e recua. */
  private async lunge(
    v: UnitView,
    to: { x: number; y: number },
    frac: number,
    onHit: () => Promise<void>,
  ): Promise<void> {
    const ox = v.x;
    const oy = v.y;
    await tweenP(this, {
      targets: v,
      x: ox + (to.x - ox) * frac,
      y: oy + (to.y - oy) * frac,
      duration: TIMING.attackLungeMs,
      ease: 'Quad.easeIn',
    });
    const hit = onHit();
    await tweenP(this, {
      targets: v,
      x: ox,
      y: oy,
      duration: TIMING.attackLungeMs + 40,
      ease: 'Quad.easeOut',
    });
    await hit;
  }

  private async animateAttack(u: Unit, target: Unit, fx: Effect): Promise<void> {
    const v = this.views.get(u.id);
    const tp = this.views.get(target.id);
    if (!v || !tp) return;
    const ranged = distance(u.pos, target.pos) > 1;
    if (!ranged) {
      await this.lunge(v, { x: tp.x, y: tp.y }, 0.4, () => this.applyHit(fx));
    } else {
      await this.lunge(v, { x: tp.x, y: tp.y }, 0.08, async () => {
        sfx.shoot();
        await this.projectile(
          u.pos,
          target.pos,
          u.kind === 'fundeiro' ? 'stone' : 'arrow',
          60,
          TIMING.projectileMs,
        );
        await this.applyHit(fx);
      });
    }
  }

  private projectile(from: Axial, to: Axial, tex: string, arc: number, ms: number): Promise<void> {
    const a = this.px(from);
    const b = this.px(to);
    a.y -= 40;
    b.y -= 36;
    const img = this.add.image(a.x, a.y, tex).setDepth(9000);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    img.setRotation(angle);
    return new Promise((res) => {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: ms,
        ease: 'Linear',
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * arc;
          const dy = b.y - a.y - Math.cos(Math.PI * t) * Math.PI * arc;
          img.setPosition(x, y).setRotation(arc ? Math.atan2(dy, b.x - a.x) : angle);
        },
        onComplete: () => {
          img.destroy();
          res();
        },
      });
    });
  }

  private ring(h: Axial, color: number): void {
    const p = this.px(h);
    const r = this.add
      .image(p.x, p.y - 10, 'ring')
      .setTint(color)
      .setScale(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(8999);
    this.tweens.add({
      targets: r,
      scaleX: 1.5,
      scaleY: 1.5 * 0.72,
      alpha: { from: 1, to: 0 },
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => r.destroy(),
    });
    this.emSpark.explode(16, p.x, p.y - 20);
  }

  private shake(strong: boolean): void {
    if (settings.reduceMotion) return;
    if (strong) this.cameras.main.shake(180, 0.007);
    else this.cameras.main.shake(90, 0.003);
  }

  private floatText(x: number, y: number, txt: string, color: string, size = 28): void {
    const t = this.add.text(x, y, txt, textStyle(size, color)).setOrigin(0.5).setDepth(9100);
    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: { from: 1, to: 0 },
      duration: 600,
      delay: 150,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  /** Aplica visualmente um efeito já resolvido no Battle. */
  private async applyHit(f: Effect): Promise<void> {
    const u = this.battle.unit(f.unitId);
    const v = this.views.get(f.unitId);
    if (!u || !v) return;
    if (f.heal > 0) {
      sfx.heal();
      this.emPlayer.explode(12, v.x, v.y - 30);
      this.floatText(v.x, v.y - 80, `+${f.heal}`, PALS.vida);
      v.drawBar(u);
      return;
    }
    sfx.hit();
    v.flash();
    this.emSand.explode(10, v.x, v.y - 24);
    (u.team === 'player' ? this.emPlayer : this.emEnemy).explode(4, v.x, v.y - 24);
    this.floatText(v.x, v.y - 80, `-${f.dmg}`, u.team === 'player' ? PALS.hlAtaque : PALS.branco);
    this.shake(u.team === 'player');
    if (u.team === 'player') this.stats.taken += f.dmg;
    else this.stats.dealt += f.dmg;
    v.drawBar(u);
    if (f.kill) {
      sfx.kill();
      if (u.team === 'enemy') this.stats.kills++;
      this.floatText(v.x, v.y - 110, 'ABATE!', PALS.hlHabilidade, 24);
      this.views.delete(u.id);
      await wait(this, 120);
      await v.die();
      return;
    }
    if (f.pushTo) {
      const p = this.px(f.pushTo);
      await tweenP(this, {
        targets: v,
        x: p.x,
        y: p.y,
        duration: 160,
        ease: 'Back.easeOut',
        onUpdate: () => v.syncDepth(),
      });
      v.syncDepth();
    }
  }

  // ======================= realces e HUD =======================

  private refresh(): void {
    for (const s of this.hlPool) s.setVisible(false);
    for (const d of this.dotPool) d.setVisible(false);
    for (const t of this.tips) t.box.setVisible(false);
    let hi = 0;
    const mark = (h: Axial, color: number, alpha = 0.9) => {
      const s = this.hlPool[hi++];
      if (!s) return;
      const p = this.px(h);
      s.setPosition(p.x, p.y - this.elevOf(h))
        .setTint(color)
        .setAlpha(alpha)
        .setVisible(true);
    };

    const u = this.selected;
    const cmd = this.canCommand();
    const previews: Effect[] = [];

    if (u && cmd && !u.acted) {
      if (this.mode === 'ability') {
        const opts = this.battle.abilityOptions(u);
        const hov = opts.find((o) => o.area.some((a) => eq(a, this.cursor)));
        for (const o of opts)
          for (const a of o.area) mark(a, PAL.hlHabilidade, o === hov ? 1 : 0.45);
        if (hov) previews.push(...this.battle.previewAbility(u, hov));
      } else {
        const moves = u.moved ? null : this.battle.moveTargets(u);
        if (moves) {
          for (const [k] of moves) {
            const [q, r] = k.split(',').map(Number);
            if (q === u.pos.q && r === u.pos.r) continue;
            mark({ q, r }, PAL.hlMove, 0.9);
          }
        }
        const targets = this.battle.attackTargets(u);
        for (const a of this.battle.attackArea(u)) {
          if (moves?.has(key(a))) continue;
          const isTarget = targets.some((t) => eq(t.pos, a));
          mark(a, PAL.hlAtaque, isTarget ? 0.95 : 0.4);
        }
        for (const t of targets) if (moves?.has(key(t.pos))) mark(t.pos, PAL.hlAtaque, 0.95);
        const hovered = targets.find((t) => eq(t.pos, this.cursor));
        if (hovered) previews.push(this.battle.previewAttack(u, hovered));
        // caminho planejado
        if (moves && moves.has(key(this.cursor)) && !this.battle.unitAt(this.cursor)) {
          const path = Battle.path(moves, this.cursor);
          path.slice(1).forEach((h, i) => {
            const d = this.dotPool[i];
            if (!d) return;
            const p = this.px(h);
            d.setPosition(p.x, p.y).setVisible(true);
          });
        }
      }
    }

    // anel de seleção
    if (u && u.alive) {
      const p = this.px(u.pos);
      this.selRing.setPosition(p.x, p.y + 2).setVisible(true);
    } else this.selRing.setVisible(false);

    // cursor
    const cp = this.px(this.cursor);
    this.cursorImg
      .setPosition(cp.x, cp.y - this.elevOf(this.cursor))
      .setDepth(100 + cp.y + 0.58)
      .setVisible(this.phase !== 'ended');

    this.showPreviews(previews);
    this.updateHud();
  }

  private showPreviews(fx: Effect[]): void {
    fx.slice(0, this.tips.length).forEach((f, i) => {
      const tip = this.tips[i];
      const u = this.battle.unit(f.unitId);
      const v = this.views.get(f.unitId);
      if (!u || !v) return;
      const lines =
        f.heal > 0
          ? [`Cura +${f.heal}`, `Vida ${u.hp} → ${f.hpAfter}`]
          : [
              `Dano ${f.dmg}`,
              `Vida ${u.hp} → ${f.hpAfter}`,
              ...(f.kill ? ['ABATE!'] : f.pushTo ? ['empurrado'] : []),
            ];
      tip.text.setText(lines.join('\n'));
      tip.text.setColor(f.kill ? PALS.hlHabilidade : PALS.branco);
      const w = tip.text.width + 20;
      const h = tip.text.height + 12;
      tip.bg.clear();
      tip.bg.fillStyle(PAL.tinta, 0.92).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      tip.bg
        .lineStyle(2, f.heal > 0 ? PAL.vida : f.kill ? PAL.hlHabilidade : PAL.hlAtaque, 1)
        .strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      const x = Phaser.Math.Clamp(v.x, 60 + w / 2, 1220 - w / 2);
      tip.box.setPosition(x, Math.max(92 + h / 2, v.y - 84 - h / 2)).setVisible(true);
    });
  }

  private flashHint(msg: string): void {
    const t = this.add
      .text(640, 560, msg, textStyle(20, PALS.hlHabilidade))
      .setOrigin(0.5)
      .setDepth(10002);
    this.tweens.add({
      targets: t,
      alpha: 0,
      y: 540,
      delay: 700,
      duration: 500,
      onComplete: () => t.destroy(),
    });
  }

  private updateHud(): void {
    const b = this.battle;
    const foes = b.alive('enemy').length;
    this.foesText.setText(`Invasores: ${foes}/${b.units.filter((x) => x.team === 'enemy').length}`);
    this.turnText.setText(`Turno ${Math.min(b.turn, RULES.maxTurns)}/${RULES.maxTurns}`);
    this.turnText.setColor(b.turn >= RULES.maxTurns - 1 ? PALS.hlAtaque : PALS.branco);
    if (this.phase === 'player') this.phaseText.setText('Sua vez').setColor(PALS.turquesa);
    else if (this.phase === 'enemy')
      this.phaseText.setText('Vez dos invasores').setColor(PALS.inimigo);
    else this.phaseText.setText('Fim de jogo').setColor(PALS.areiaTerra);

    // painel lateral: unidade sob o cursor
    const hov = b.unitAt(this.cursor);
    if (hov) {
      const st = UNIT_STATS[hov.kind];
      const tile = b.tile(hov.pos);
      const rng =
        hov.rangeMin === hov.rangeMax ? `${hov.rangeMax}` : `${hov.rangeMin}–${hov.rangeMax}`;
      this.infoText.setText(
        [
          hov.name,
          hov.team === 'player' ? '(seu time)' : '(invasor)',
          `Vida ${hov.hp}/${hov.maxHp}`,
          `Movimento ${st.move}`,
          `Alcance ${rng}`,
          `Dano ${hov.dmg}`,
          `Terreno: ${tile?.terrain ?? ''}`,
        ].join('\n'),
      );
      this.infoText.setColor(hov.team === 'player' ? PALS.turquesa : PALS.inimigoClaro);
      this.info.setVisible(true);
    } else {
      const tile = b.tile(this.cursor);
      if (tile) {
        const desc =
          tile.terrain === 'campo'
            ? 'Campo\nCusto 1\nVisão livre'
            : tile.terrain === 'mata'
              ? 'Mata\nCusto 2\nBloqueia tiros\nque passam\npor ela'
              : 'Muro\nIntransponível\nBloqueia tiros';
        this.infoText.setText(desc).setColor(PALS.areiaTerra);
        this.info.setVisible(true);
      } else this.info.setVisible(false);
    }

    const u = this.selected;
    const showUnit = !!u && u.alive;
    [
      this.portrait,
      this.nameText,
      this.hpText,
      this.statText,
      this.abilityTitle,
      this.abilityDesc,
      this.abilityStatus,
    ].forEach((o) => o.setVisible(showUnit));
    this.hintText.setVisible(!showUnit && this.phase !== 'ended');
    if (u && showUnit) {
      this.portrait.setTexture(`unit-${u.kind}`);
      this.nameText.setText(u.name);
      this.hpText.setText(`Vida ${u.hp}/${u.maxHp}`);
      const rng = u.rangeMin === u.rangeMax ? `${u.rangeMax}` : `${u.rangeMin}–${u.rangeMax}`;
      this.statText.setText(`Mov ${u.move} · Alcance ${rng} · Dano ${u.dmg}`);
      const ab = u.ability === 'none' ? null : ABILITY[u.ability];
      this.abilityTitle.setText(ab ? `${ab.name} (X) · recarga ${ab.cooldown}` : '');
      this.abilityDesc.setText(ABILITY_TEXT[u.ability]);
      const status = u.acted
        ? 'Já agiu neste turno'
        : u.cooldown > 0
          ? `Em recarga: ${u.cooldown} turno(s)`
          : this.mode === 'ability'
            ? 'Escolha a área amarela · X volta ao ataque'
            : u.moved
              ? 'Ataque, habilidade ou Esperar · botão direito desfaz'
              : 'Pronta · mova (turquesa) ou ataque (vermelho)';
      this.abilityStatus.setText(status);
    } else {
      this.hintText.setText(
        this.phase === 'enemy'
          ? 'Os invasores estão agindo…'
          : 'Selecione uma unidade turquesa (clique ou Q).\nTurquesa = mover · Vermelho = atacar · Amarelo = habilidade',
      );
    }
    const cmd = this.canCommand();
    this.btnAbility.setEnabled(cmd && !!u && b.abilityReady(u) && b.abilityOptions(u).length > 0);
    this.btnAbility.setText(this.mode === 'ability' ? 'Voltar ao ataque (X)' : 'Habilidade (X)');
    this.btnWait.setEnabled(cmd && !!u && !u.acted);
    this.btnEnd.setEnabled(cmd);
  }

  private showBanner(text: string, color: string = PALS.areiaTerra): void {
    this.banner.setText(text).setColor(color).setAlpha(0).setScale(0.8);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({
      targets: this.banner,
      alpha: 1,
      scale: 1,
      duration: 260,
      ease: 'Back.easeOut',
    });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 1000, duration: 350 });
  }

  // ======================= fim de jogo =======================

  private showEnd(): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.busy = false;
    this.deselect();
    const win = this.battle.outcome === 'victory';
    if (win) sfx.win();
    else sfx.lose();
    const layer = this.add.container(0, 0).setDepth(20000);
    layer.add(this.add.rectangle(640, 360, 1280, 720, PAL.painel, 0.6).setInteractive());
    const title = this.add
      .text(640, 260, win ? 'Vitória!' : 'Derrota', {
        fontFamily: FONT_TITLE,
        fontStyle: '800',
        fontSize: '64px',
        color: win ? PALS.turquesa : PALS.inimigo,
        stroke: PALS.tinta,
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScale(0.6);
    this.tweens.add({ targets: title, scale: 1, duration: 300, ease: 'Back.easeOut' });
    const b = this.battle;
    const alive = b.alive('player').length;
    const lines = [
      win ? `A praça da redução está a salvo em ${b.turn} turno(s).` : b.defeatReason,
      `Turnos usados: ${Math.min(b.turn, RULES.maxTurns)}/${RULES.maxTurns} · Unidades de pé: ${alive}/3`,
      `Invasores abatidos: ${this.stats.kills}/4 · Dano causado: ${this.stats.dealt} · Dano sofrido: ${this.stats.taken}`,
    ];
    const stats = lines.map((l, i) =>
      this.add.text(640, 360 + i * 44, l, textStyle(i === 0 ? 24 : 20)).setOrigin(0.5),
    );
    const again = new Button(
      this,
      640 - 136,
      560,
      240,
      56,
      'Tentar de novo',
      () => this.restart(),
      26,
    );
    const menu = new Button(this, 640 + 136, 560, 240, 56, 'Menu', () => this.toMenu(), 26);
    const hint = this.add
      .text(640, 616, 'Espaço ou R: jogar de novo · M: menu', textStyle(16))
      .setOrigin(0.5)
      .setAlpha(0.7);
    layer.add([title, ...stats, again, menu, hint]);
    if (win) {
      for (let i = 0; i < 3; i++) {
        this.time.delayedCall(i * 220, () => {
          this.emSpark.explode(14, 400 + i * 240, 250);
          this.emPlayer.explode(10, 400 + i * 240, 250);
        });
      }
    }
    this.refresh();
  }

  private restart(): void {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.restart(),
    );
  }

  private toMenu(): void {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start('Title'),
    );
  }
}
