// Gap Run — a tiny platformer used to test the ghosts.
// Injected design fault (for the benchmark): ?fault=gap makes the third gap impossible to jump.
/* global Phaser, ghost */
(function () {
  const params = new URLSearchParams(location.search);
  const FAULT = params.get('fault');

  const W = 640;
  const H = 360;
  const GROUND_Y = 300; // top surface of the ground
  const SPEED = 180;
  const JUMP = 500; // apex ~104 px, ~150 px of horizontal reach at full speed
  const GRAVITY = 1200;
  const COYOTE_MS = 80;
  const BUFFER_MS = 120;

  const GAP3 = FAULT === 'gap' ? 200 : 120;
  const SEGMENTS = [
    { x: 0, w: 300 },
    { x: 380, w: 240 }, // gap 1: 80 px
    { x: 720, w: 220 }, // gap 2: 100 px
  ];
  SEGMENTS.push({ x: 940 + GAP3, w: 420 }); // gap 3
  const WORLD_W = SEGMENTS[3].x + SEGMENTS[3].w;
  const FLAG_X = WORLD_W - 80;

  class Play extends Phaser.Scene {
    constructor() {
      super('play');
    }

    create() {
      this.deaths = 0;
      this.won = false;
      this.checkpoint = 0;
      this.lastOnFloor = -1e9;
      this.lastJumpPress = -1e9;

      this.makeTextures();
      this.physics.world.setBounds(0, -200, WORLD_W, H + 400);

      // Background details so the level does not look empty.
      for (let i = 0; i < 40; i++) {
        this.add.circle(Phaser.Math.Between(0, WORLD_W), Phaser.Math.Between(10, 200), Phaser.Math.Between(1, 2), 0x2a2f4a);
      }

      this.platforms = this.physics.add.staticGroup();
      SEGMENTS.forEach((s, i) => {
        const r = this.add.rectangle(s.x + s.w / 2, GROUND_Y + 30, s.w, 60, 0x2ec4b6);
        this.platforms.add(r);
        this.add.rectangle(s.x + s.w / 2, GROUND_Y + 3, s.w, 6, 0x9bf6ec);
        r.segment = i;
      });

      // Pits get a dark glow so they read as danger.
      for (let i = 0; i < SEGMENTS.length - 1; i++) {
        const a = SEGMENTS[i];
        const b = SEGMENTS[i + 1];
        const gx = a.x + a.w;
        this.add.rectangle(gx + (b.x - gx) / 2, H - 6, b.x - gx, 12, 0x3a1020);
      }

      this.flag = this.physics.add.staticImage(FLAG_X, GROUND_Y - 30, 'flag');

      this.player = this.physics.add.sprite(60, GROUND_Y - 20, 'player');
      this.player.body.setSize(20, 26);
      this.physics.add.collider(this.player, this.platforms, (p, plat) => {
        if (p.body.touching.down && plat.segment !== undefined) this.checkpoint = plat.segment;
      });
      this.physics.add.overlap(this.player, this.flag, () => this.win());

      this.cameras.main.setBounds(0, 0, WORLD_W, H);
      this.cameras.main.startFollow(this.player, true, 1, 1, -120, 0);

      this.add
        .text(W / 2, 14, '← →  move     SPACE  jump     Reach the flag', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#e7e9ff',
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0);
      this.deathText = this.add
        .text(12, 12, 'Deaths: 0', { fontFamily: 'monospace', fontSize: '14px', color: '#ff8fa3' })
        .setScrollFactor(0);
      this.banner = this.add
        .text(W / 2, H / 2 - 40, '', { fontFamily: 'monospace', fontSize: '28px', color: '#f6d55c' })
        .setOrigin(0.5)
        .setScrollFactor(0);

      this.cursors = this.input.keyboard.createCursorKeys();
      this.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

      ghost.world(WORLD_W, H);
      ghost.state({ game: 'gap-run', fault: FAULT || 'none', gaps: [80, 100, GAP3] });
    }

    makeTextures() {
      const g = this.add.graphics();
      g.fillStyle(0xff6b6b);
      g.fillRoundedRect(0, 0, 22, 28, 6);
      g.fillStyle(0xffffff);
      g.fillRect(11, 7, 6, 7);
      g.fillStyle(0x141726);
      g.fillRect(14, 9, 3, 4);
      g.generateTexture('player', 22, 28);
      g.clear();
      g.fillStyle(0xdddddd);
      g.fillRect(0, 0, 3, 60);
      g.fillStyle(0xf6d55c);
      g.fillTriangle(3, 2, 30, 12, 3, 22);
      g.generateTexture('flag', 32, 60);
      g.destroy();
    }

    update(time) {
      const p = this.player;
      const body = p.body;
      const onFloor = body.blocked.down || body.touching.down;
      if (onFloor) this.lastOnFloor = time;

      if (!this.won) {
        let vx = 0;
        if (this.cursors.left.isDown) vx = -SPEED;
        else if (this.cursors.right.isDown) vx = SPEED;
        p.setVelocityX(vx);
        if (vx !== 0) p.setFlipX(vx < 0);

        if (Phaser.Input.Keyboard.JustDown(this.space) || Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
          this.lastJumpPress = time;
        }
        const canJump = time - this.lastOnFloor <= COYOTE_MS;
        if (time - this.lastJumpPress <= BUFFER_MS && canJump) {
          p.setVelocityY(-JUMP);
          this.lastJumpPress = -1e9;
          this.lastOnFloor = -1e9;
        }
      }

      if (p.y > H + 30) this.die();

      ghost.pos(p.x, p.y, {
        vx: body.velocity.x,
        vy: body.velocity.y,
        onFloor,
        deaths: this.deaths,
        won: this.won,
        checkpoint: this.checkpoint,
        frame: this.game.loop.frame,
        screenX: p.x - this.cameras.main.scrollX,
        screenY: p.y - this.cameras.main.scrollY,
      });
    }

    die() {
      this.deaths += 1;
      ghost.event('death', { segment: this.checkpoint, deaths: this.deaths });
      this.deathText.setText('Deaths: ' + this.deaths);
      const s = SEGMENTS[this.checkpoint];
      // body.reset moves the physics body and the sprite together (setPosition alone leaves the body below the pit).
      this.player.body.reset(s.x + 40, GROUND_Y - 20);
      this.cameras.main.flash(120, 255, 80, 100);
    }

    win() {
      if (this.won) return;
      this.won = true;
      this.player.setVelocity(0, 0);
      this.player.body.allowGravity = false;
      this.banner.setText('LEVEL COMPLETE!');
      ghost.event('win', { deaths: this.deaths });
    }
  }

  new Phaser.Game({
    type: Phaser.CANVAS,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: '#141726',
    pixelArt: true,
    physics: { default: 'arcade', arcade: { gravity: { y: GRAVITY }, debug: false } },
    scene: [Play],
    banner: false,
  });
})();
