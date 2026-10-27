import Phaser from 'phaser';
import { generateAllTextures } from '../systems/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generateAllTextures(this);
    this.scene.start('Title');
  }
}
