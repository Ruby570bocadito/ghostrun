// Key Hunt — a tiny top-down level used to test the ghosts.
// Walk from the start room (left) through the middle room into the far room (right), pick up the
// key there, touch the locked door with it and step on the EXIT tile. No gravity, no deaths.
// Injected design fault (for the benchmark): ?fault=hidden-key draws the key in almost exactly the
// floor colour (#182038 on #141726) and without its pulsing glow, so it is practically invisible.
// Everything else (position, hitbox, door, exit) is identical.
/* global Phaser, ghost */
(function () {
  const params = new URLSearchParams(location.search);
  const FAULT = params.get('fault');
  const HIDDEN_KEY = FAULT === 'hidden-key';

  const W = 640;
  const H = 360;
  const TOP = 36; // the play area starts below the instructions text
  const T = 16; // wall thickness
  const SPEED = 150;
  const KEY_COLOR = HIDDEN_KEY ? 0x182038 : 0xf6d55c;
  const TEXT = { fontFamily: 'monospace', fontSize: '14px', color: '#e7e9ff' };

  // Walls as [x, y, width, height] in world pixels (the world is exactly one screen).
  const WALLS = [
    [0, TOP, W, T], // outer top
    [0, H - T, W, T], // outer bottom
    [0, TOP, T, H - TOP], // outer left
    [W - T, TOP, T, H - TOP], // outer right
    [208, TOP, T, 228], // start room | middle room, open at the bottom (y 264-344)
    [416, 132, T, H - T - 132], // middle room | far room, open at the top (y 52-132)
    [528, 132, W - T - 528, T], // floor of the exit room in the far room's top-right corner
  ];
  const START = { x: 64, y: 100 };
  const KEY = { x: 568, y: 296 }; // far room, bottom-right
  const DOOR = { x: 536, y: 92 }; // 16x80 block that closes the exit room's left side
  const EXIT = { x: 584, y: 100 };

  class Play extends Phaser.Scene {
    constructor() {
      super('play');
    }

    create() {
      this.won = false;
      this.hasKey = false;
      this.doorOpen = false;
      this.lockedAt = -1e9;

      this.makeTextures();

      // Faint floor studs so the rooms do not look empty.
      const floor = this.add.graphics();
      floor.fillStyle(0x1e2236);
      for (let x = 32; x < W; x += 32) for (let y = 68; y < H - T; y += 32) floor.fillRect(x - 1, y - 1, 2, 2);

      this.walls = this.physics.add.staticGroup();
      WALLS.forEach(([x, y, w, h]) => this.walls.add(this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x2ec4b6)));
      WALLS.forEach(([x, y, w]) => this.add.rectangle(x + w / 2, y + 2, w, 4, 0x9bf6ec)); // lit top edges

      this.exitTile = this.physics.add.staticImage(EXIT.x, EXIT.y, 'exit');
      this.add.text(EXIT.x, 58, 'EXIT', TEXT).setOrigin(0.5, 0);

      // The key. Clean: bright yellow with a pulsing glow. Fault: floor-coloured, no glow, no pulse.
      this.keyFx = [];
      if (!HIDDEN_KEY) {
        const glow = this.add.circle(KEY.x, KEY.y, 18, 0xf6d55c, 0.25);
        this.tweens.add({ targets: glow, scale: 1.35, alpha: 0.08, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.keyFx.push(glow);
      }
      this.keyItem = this.physics.add.staticImage(KEY.x, KEY.y, 'key');
      if (!HIDDEN_KEY) {
        this.tweens.add({ targets: this.keyItem, scale: 1.15, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      this.keyFx.push(this.keyItem);

      this.door = this.physics.add.staticImage(DOOR.x, DOOR.y, 'door');

      this.player = this.physics.add.sprite(START.x, START.y, 'player');
      this.player.body.setSize(16, 18);
      this.physics.add.collider(this.player, this.walls);
      this.doorCollider = this.physics.add.collider(this.player, this.door, () => this.touchDoor());
      this.keyOverlap = this.physics.add.overlap(this.player, this.keyItem, () => this.pickKey());
      this.physics.add.overlap(this.player, this.exitTile, () => this.win());

      this.add
        .text(W / 2, 14, '← ↑ → ↓ move     find the key     open the door', TEXT)
        .setOrigin(0.5, 0)
        .setScrollFactor(0);
      this.keyText = this.add.text(12, 12, 'Key: -', TEXT).setScrollFactor(0);
      this.lockText = this.add.text(528, 154, 'Locked: find the key', TEXT).setOrigin(0.5, 0).setVisible(false);
      this.banner = this.add
        .text(W / 2, H / 2 - 40, 'LEVEL COMPLETE!', {
          fontFamily: 'monospace',
          fontSize: '28px',
          color: '#f6d55c',
          backgroundColor: '#141726',
          padding: { x: 12, y: 6 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setVisible(false);

      this.cursors = this.input.keyboard.createCursorKeys();

      ghost.world(W, H);
      ghost.state({
        game: 'key-hunt',
        fault: FAULT || 'none',
        milestones: [
          { name: 'key', x: KEY.x, y: KEY.y },
          { name: 'door', x: DOOR.x, y: DOOR.y },
        ],
      });
    }

    makeTextures() {
      const g = this.add.graphics();
      // Player: coral rounded rect with one eye.
      g.fillStyle(0xff6b6b);
      g.fillRoundedRect(0, 0, 20, 22, 6);
      g.fillStyle(0xffffff);
      g.fillRect(10, 5, 6, 7);
      g.fillStyle(0x141726);
      g.fillRect(13, 7, 3, 4);
      g.generateTexture('player', 20, 22);
      // Key: ring, shaft and two teeth.
      g.clear();
      g.lineStyle(3, KEY_COLOR);
      g.strokeCircle(7, 8, 5);
      g.fillStyle(KEY_COLOR);
      g.fillRect(12, 6, 14, 4);
      g.fillRect(18, 10, 3, 4);
      g.fillRect(23, 10, 3, 5);
      g.generateTexture('key', 28, 16);
      // Locked door: dark block with a yellow border and a keyhole.
      g.clear();
      g.fillStyle(0x2b2412);
      g.fillRect(0, 0, 16, 80);
      g.lineStyle(2, 0xf6d55c);
      g.strokeRect(1, 1, 14, 78);
      g.fillStyle(0xf6d55c);
      g.fillCircle(8, 36, 3);
      g.fillRect(7, 37, 2, 7);
      g.generateTexture('door', 16, 80);
      // Exit tile: yellow, with dark stairs going down.
      g.clear();
      g.fillStyle(0xf6d55c);
      g.fillRect(0, 0, 40, 40);
      g.fillStyle(0x141726);
      g.fillRect(6, 8, 28, 5);
      g.fillRect(10, 17, 20, 5);
      g.fillRect(14, 26, 12, 5);
      g.generateTexture('exit', 40, 40);
      g.destroy();
    }

    update() {
      const p = this.player;
      const body = p.body;

      if (!this.won) {
        const c = this.cursors;
        const dx = (c.right.isDown ? 1 : 0) - (c.left.isDown ? 1 : 0);
        const dy = (c.down.isDown ? 1 : 0) - (c.up.isDown ? 1 : 0);
        const len = Math.hypot(dx, dy) || 1; // same speed on diagonals
        p.setVelocity((dx / len) * SPEED, (dy / len) * SPEED);
        if (dx !== 0) p.setFlipX(dx < 0);
      }
      this.lockText.setVisible(!this.doorOpen && this.time.now - this.lockedAt < 1500);

      ghost.pos(p.x, p.y, {
        vx: body.velocity.x,
        vy: body.velocity.y,
        deaths: 0,
        won: this.won,
        hasKey: this.hasKey,
        doorOpen: this.doorOpen,
        frame: this.game.loop.frame,
        screenX: p.x - this.cameras.main.scrollX,
        screenY: p.y - this.cameras.main.scrollY,
      });
    }

    pickKey() {
      if (this.hasKey) return;
      this.hasKey = true;
      this.keyOverlap.active = false;
      this.keyFx.forEach((o) => {
        this.tweens.killTweensOf(o);
        o.destroy();
      });
      this.keyText.setText('Key: ✓').setColor('#f6d55c');
      ghost.event('milestone', { name: 'key' });
    }

    touchDoor() {
      if (this.doorOpen) return;
      if (!this.hasKey) {
        this.lockedAt = this.time.now; // shows "Locked: find the key" for a moment
        return;
      }
      this.doorOpen = true;
      this.doorCollider.active = false;
      this.tweens.add({ targets: this.door, alpha: 0, duration: 250, onComplete: () => this.door.destroy() });
      ghost.event('milestone', { name: 'door' });
    }

    win() {
      if (this.won) return;
      this.won = true;
      this.player.setVelocity(0, 0);
      this.banner.setVisible(true);
      ghost.event('win', { deaths: 0 });
    }
  }

  new Phaser.Game({
    type: Phaser.CANVAS,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: '#141726',
    pixelArt: true,
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: [Play],
    banner: false,
  });
})();
