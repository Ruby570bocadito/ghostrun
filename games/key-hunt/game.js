// Key Hunt — a tiny top-down level used to test the ghosts.
// Walk from the start room (left) through the middle room into the far room (right), pick up the
// key there, touch the locked door with it and step on the EXIT tile. No gravity, no deaths.
// Injected design fault (for the benchmark): ?fault=hidden-key draws the key in almost exactly the
// floor colour (#182038 on #141726) and without its pulsing glow, so it is practically invisible.
// Everything else (position, hitbox, door, exit) is identical.
// Art v2 (22 Nov 2026): shared kit (games/shared/kit.js), a dungeon: stamped floor (1.05:1), teal stone
// walls, a gold key, a door with a padlock and a gold stairway as the exit. Geometry unchanged.
/* global Phaser, ghost, GhostKit */
(function () {
  const K = GhostKit;
  const P = K.PALETTE;
  const params = new URLSearchParams(location.search);
  const FAULT = params.get('fault');
  const HIDDEN_KEY = FAULT === 'hidden-key';

  const W = 640;
  const H = 360;
  const TOP = 36; // the play area starts below the instructions text
  const T = 16; // wall thickness
  const SPEED = 150;
  // The fault paints the key in the floor's own colours (#1a1e31 / #181c2d on #141726).
  const KEY_COLORS = HIDDEN_KEY ? { k: '#1a1e31', L: '#1a1e31', d: P.floorStamp } : { k: P.gold, L: P.goldLight, d: P.goldDark };
  const TEXT = { fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color: P.text };

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

      K.dungeonFloor(this, 0, TOP, W, H - TOP);
      this.walls = this.physics.add.staticGroup();
      WALLS.forEach(([x, y, w, h]) => {
        this.walls.add(this.add.rectangle(x + w / 2, y + h / 2, w, h).setVisible(false));
        K.solidBlock(this, x, y, w, h, 'top');
      });

      this.exitTile = this.physics.add.staticImage(EXIT.x, EXIT.y, K.exitTile(this, 40));
      this.add.text(EXIT.x, 58, 'EXIT', { ...TEXT, color: P.gold }).setOrigin(0.5, 0);

      // The key. Clean: bright yellow with a pulsing glow. Fault: floor-coloured, no glow, no pulse.
      this.keyFx = [];
      if (!HIDDEN_KEY) {
        const glow = this.add.circle(KEY.x, KEY.y, 18, K.hex(P.gold), 0.25);
        this.tweens.add({ targets: glow, scale: 1.35, alpha: 0.08, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.keyFx.push(glow);
      }
      this.keyItem = this.physics.add.staticImage(KEY.x, KEY.y, 'key');
      if (!HIDDEN_KEY) {
        this.tweens.add({ targets: this.keyItem, scale: 1.15, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      this.keyFx.push(this.keyItem);

      this.door = this.physics.add.staticImage(DOOR.x, DOOR.y, 'door');

      this.player = this.physics.add.sprite(START.x, START.y, K.heroTopDown(this), 0).setDepth(10);
      this.player.body.setSize(16, 18);
      this.physics.add.collider(this.player, this.walls);
      this.doorCollider = this.physics.add.collider(this.player, this.door, () => this.touchDoor());
      this.keyOverlap = this.physics.add.overlap(this.player, this.keyItem, () => this.pickKey());
      this.physics.add.overlap(this.player, this.exitTile, () => this.win());

      this.hud = K.hud(this, [{ keys: ['←', '↑', '→', '↓'], label: 'move' }, { label: 'find the key' }, { label: 'open the door' }], { left: 'Key: -', leftColor: P.text });
      this.lockText = this.add
        .text(528, 154, 'Locked: find the key', { ...TEXT, stroke: P.hudBack, strokeThickness: 4 })
        .setOrigin(0.5, 0)
        .setDepth(30)
        .setVisible(false);

      this.cursors = this.input.keyboard.createCursorKeys();

      ghost.world(W, H);
      ghost.state({
        game: 'key-hunt',
        fault: FAULT || 'none',
        milestones: [
          { name: 'key', x: KEY.x, y: KEY.y, kind: 'object' },
          { name: 'door', x: DOOR.x, y: DOOR.y, kind: 'object' },
        ],
      });
    }

    makeTextures() {
      // Key (28×16): ring, shaft and two teeth.
      K.pixels(this, 'key', ['.kkkk.........', 'kLLLkk........', 'kL..kkkkkkkkkk', 'k....kkkkkkkkd', 'kk..kk...kd.kd', '.kkkk....kd.kd', '..dd.........d', '..............'], KEY_COLORS);
      // Locked door (16×80): dark planks with a gold frame and a padlock.
      const rows = [];
      for (let y = 0; y < 40; y++) {
        if (y === 0 || y === 39) rows.push('GGGGGGGG');
        else if (y >= 15 && y <= 23) rows.push(['GwlllllG', 'Gw.l.lwG', 'Gw.l.lwG', 'GLLLLLLG', 'GLLkkLLG', 'GLLkkLLG', 'GLLLkLLG', 'GLLLLLLG', 'GwwwwwwG'][y - 15]);
        else rows.push(y % 8 === 0 ? 'GwwwwwwG' : 'GwwwbwwG');
      }
      K.pixels(this, 'door', rows, { G: P.gold, w: '#3b2a12', b: '#2b1f0d', l: P.steel, L: P.gold, k: P.ink });
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
      }
      K.animateHero(p, { onFloor: null, vx: body.velocity.x, vy: body.velocity.y });
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
      this.hud.setLeft('Key: ✓', P.gold);
      K.sparkle(this, KEY.x, KEY.y);
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
      K.sparkle(this, EXIT.x, EXIT.y);
      this.hud.banner('LEVEL COMPLETE!');
      ghost.event('win', { deaths: 0 });
    }
  }

  new Phaser.Game({
    type: Phaser.CANVAS,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: P.sky,
    pixelArt: true,
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: [Play],
    banner: false,
  });
})();
