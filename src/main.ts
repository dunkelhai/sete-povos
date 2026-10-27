import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { PauseScene } from './scenes/PauseScene';
import { PALS } from './style/palette';

async function waitFonts(): Promise<void> {
  const loads = ['800 64px "Alegreya SC"', '600 20px "Baloo 2"', '700 20px "Baloo 2"'].map((f) =>
    document.fonts.load(f),
  );
  const timeout = new Promise<void>((res) => setTimeout(res, 3000));
  await Promise.race([Promise.all(loads).then(() => document.fonts.ready), timeout]);
}

async function start(): Promise<void> {
  await waitFonts();
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game',
    width: 1280,
    height: 720,
    backgroundColor: PALS.fundo,
    antialias: true,
    roundPixels: true,
    fps: { target: 60 },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, TitleScene, GameScene, PauseScene],
  };
  const game = new Phaser.Game(config);
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

void start();
