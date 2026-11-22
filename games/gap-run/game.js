// Gap Run — a tiny platformer used to test the ghosts.
// Injected design fault (for the benchmark): ?fault=gap makes the third gap impossible to jump.
// Art v2 (22 Nov 2026): shared kit (games/shared/kit.js), 32 px grid. Clean gaps are 2, 3 and 3 tiles;
// the faulty one is 7 tiles (224 px) against ~150 px of reach, and the flag is visible from its edge.
/* global Phaser, ghost, GhostKit */
(function () {
  const K = GhostKit;
  const params = new URLSearchParams(location.search);
  const FAULT = params.get('fault');

  const W = 640;
  const H = 360;
  const TILE = 32;
  const GROUND_Y = 300; // top surface of the ground
  const SPEED = 180;
  const JUMP = 500; // apex ~104 px, ~150 px of horizontal reach at full speed
  const GRAVITY = 1200;
  const COYOTE_MS = 100; // a jump still works this long after running off an edge
  const BUFFER_MS = 120;

  const GAP3 = (FAULT === 'gap' ? 7 : 3) * TILE;
  const SEGMENTS = [
    { x: 0, w: 10 * TILE },
    { x: 12 * TILE, w: 8 * TILE }, // gap 1: 64 px
    { x: 23 * TILE, w: 7 * TILE }, // gap 2: 96 px
  ];
  SEGMENTS.push({ x: 30 * TILE + GAP3, w: 11 * TILE }); // gap 3: 96 px, or 224 px with the fault
  const GAPS = [1, 2, 3].map((i) => SEGMENTS[i].x - (SEGMENTS[i - 1].x + SEGMENTS[i - 1].w));
  const WORLD_W = SEGMENTS[3].x + SEGMENTS[3].w;
  const FLAG_X = SEGMENTS[3].x + 4 * TILE; // visible from the edge of gap 3, even the faulty one
  const SPIKE_TOP = H - 16;

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
      this.wasOnFloor = true;
      this.dustRng = K.rng('gap-run:dust');

      K.heroTextures(this);
      K.flagTextures(this);
      this.physics.world.setBounds(0, -200, WORLD_W, H + 400);

      K.backdrop(this, { seed: 'gap-run', worldW: WORLD_W, horizonY: GROUND_Y });

      // Pits: a dark red floor with spikes, so they read as danger from far away.
      for (let i = 0; i < SEGMENTS.length - 1; i++) {
        const gx = SEGMENTS[i].x + SEGMENTS[i].w;
        const gw = SEGMENTS[i + 1].x - gx;
        this.add.rectangle(gx + gw / 2, H - 10, gw, 20, K.hex(K.PALETTE.pit)).setDepth(-6);
        K.spikes(this, gx, H, gw);
      }

      this.platforms = this.physics.add.staticGroup();
      SEGMENTS.forEach((s, i) => {
        K.groundBlock(this, s.x, GROUND_Y, s.w, H - GROUND_Y, { left: i > 0, right: i < SEGMENTS.length - 1 });
        const r = this.add.rectangle(s.x + s.w / 2, GROUND_Y + 30, s.w, 60).setVisible(false);
        this.platforms.add(r);
        r.segment = i;
      });

      this.flag = this.physics.add.staticSprite(FLAG_X, GROUND_Y - 30, 'kit-flag', 0);
      this.flag.play('kit-flag-wave');

      this.player = this.physics.add.sprite(60, GROUND_Y - 20, 'hero', 0).setDepth(10);
      this.player.body.setSize(20, 26);
      this.physics.add.collider(this.player, this.platforms, (p, plat) => {
        if (p.body.touching.down && plat.segment !== undefined) this.checkpoint = plat.segment;
      });
      this.physics.add.overlap(this.player, this.flag, () => this.win());

      this.cameras.main.setBounds(0, 0, WORLD_W, H);
      this.cameras.main.startFollow(this.player, true, 1, 1, -120, 0);

      this.hud = K.hud(this, [{ keys: ['←', '→'], label: 'move' }, { keys: ['SPACE'], label: 'jump' }, { label: 'Reach the flag' }]);

      this.cursors = this.input.keyboard.createCursorKeys();
      this.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

      ghost.world(WORLD_W, H);
      ghost.state({ game: 'gap-run', fault: FAULT || 'none', gaps: GAPS });
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

        if (Phaser.Input.Keyboard.JustDown(this.space) || Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
          this.lastJumpPress = time;
        }
        const canJump = time - this.lastOnFloor <= COYOTE_MS;
        if (time - this.lastJumpPress <= BUFFER_MS && canJump) {
          p.setVelocityY(-JUMP);
          this.lastJumpPress = -1e9;
          this.lastOnFloor = -1e9;
          K.dust(this, p.x, body.bottom, 3, this.dustRng);
        }
      }

      // Dust: a puff on landing and a light trail while running.
      if (onFloor && !this.wasOnFloor) K.dust(this, p.x, body.bottom, 4, this.dustRng);
      else if (onFloor && body.velocity.x && this.game.loop.frame % 8 === 0) K.dust(this, p.x - Math.sign(body.velocity.x) * 8, body.bottom, 1, this.dustRng);
      this.wasOnFloor = onFloor;
      K.animateHero(p, { onFloor, vx: body.velocity.x, vy: body.velocity.y });

      // Only the pits reach this low: their spikes kill (falling off the world too, just in case).
      if (body.bottom >= SPIKE_TOP + 2 || p.y > H + 30) this.die();

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
      this.hud.setDeaths(this.deaths);
      K.burst(this, this.player.x, Math.min(this.player.y, SPIKE_TOP - 8));
      const s = SEGMENTS[this.checkpoint];
      // body.reset moves the physics body and the sprite together (setPosition alone leaves the body below the pit).
      this.player.body.reset(s.x + 40, GROUND_Y - 20);
      this.wasOnFloor = true;
    }

    win() {
      if (this.won) return;
      this.won = true;
      this.player.setVelocity(0, 0);
      this.player.body.allowGravity = false;
      K.sparkle(this, FLAG_X, GROUND_Y - 40);
      this.hud.banner('LEVEL COMPLETE!');
      ghost.event('win', { deaths: this.deaths });
    }
  }

  new Phaser.Game({
    type: Phaser.CANVAS,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: K.PALETTE.sky,
    pixelArt: true,
    physics: { default: 'arcade', arcade: { gravity: { y: GRAVITY }, debug: false } },
    scene: [Play],
    banner: false,
  });
})();
