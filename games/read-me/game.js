// Read Me — a one-screen platformer used to test the ghosts.
// Cross the pit and touch the flag. The pit (220 px) is too wide for a normal jump (~185 px at best),
// so you have to JUMP and then DASH in mid-air. The dash (X) is a fast horizontal burst (380 px/s for
// 0.35 s, gravity off), one per airtime, recharged on landing.
// Injected design fault (for the benchmark): ?fault=wrong-key makes the instructions and the sign say
// "Z dash" while the dash still only works with X (Z does nothing), so players who read the controls
// press Z at the edge, nothing happens and they fall into the pit.
// Art v2 (22 Nov 2026): shared kit (games/shared/kit.js). The sign at the edge is a wooden board with the
// dash key drawn as a key cap (X, or Z with the fault); dashing leaves a gold trail.
/* global Phaser, ghost, GhostKit */
(function () {
  const K = GhostKit;
  const P = K.PALETTE;
  const params = new URLSearchParams(location.search);
  const FAULT = params.get('fault');
  const WRONG_KEY = FAULT === 'wrong-key'; // the texts name Z, but the dash is always X

  const W = 640;
  const H = 360;
  const GROUND_Y = 300; // top surface of both platforms
  const SPEED = 180;
  const JUMP = 500; // apex ~104 px, ~150 px of horizontal reach at full speed
  const GRAVITY = 1200;
  const COYOTE_MS = 80;
  const BUFFER_MS = 120;
  const DASH_SPEED = 380;
  const DASH_MS = 350; // ~133 px with gravity off; jump + dash covers ~280-330 px

  const PIT_X0 = 240; // right edge of the start platform
  const PIT_X1 = 460; // left edge of the goal platform
  const PLATFORMS = [{ x: 0, w: PIT_X0 }, { x: PIT_X1, w: W - PIT_X1 }];
  const SPAWN_X = 50;
  const FLAG_X = W - 40;
  const SPIKE_Y = H - 26; // tips of the spikes at the bottom of the pit
  const DEATH_Y = SPIKE_Y - 10; // player center at which its feet touch the spikes

  class Play extends Phaser.Scene {
    constructor() {
      super('play');
    }

    create() {
      Object.assign(this, { deaths: 0, won: false, lastOnFloor: -1e9, lastJumpPress: -1e9 });
      Object.assign(this, { canDash: true, dashUntil: -1e9, dashDir: 1, dashUsed: false }); // dash state

      K.heroTextures(this);
      K.heroTrail(this);
      K.flagTextures(this);
      this.physics.world.setBounds(0, -200, W, H + 400);
      K.backdrop(this, { seed: 'read-me', worldW: W, horizonY: GROUND_Y });

      // The pit: dark red glow with spikes at the bottom.
      this.add.rectangle((PIT_X0 + PIT_X1) / 2, (SPIKE_Y - 10 + H) / 2, PIT_X1 - PIT_X0, H - SPIKE_Y + 10, K.hex(P.pit)).setDepth(-6);
      K.spikes(this, PIT_X0, SPIKE_Y + 16, PIT_X1 - PIT_X0); // tips at SPIKE_Y

      this.platforms = this.physics.add.staticGroup();
      PLATFORMS.forEach((s, i) => {
        this.platforms.add(this.add.rectangle(s.x + s.w / 2, GROUND_Y + 30, s.w, 60).setVisible(false));
        K.groundBlock(this, s.x, GROUND_Y, s.w, H - GROUND_Y, { left: i === 1, right: i === 0 });
      });

      // Wooden sign at the edge: the dash key drawn as a key cap (the faulty build names the wrong key).
      this.makeSign(PIT_X0 - 44, WRONG_KEY ? 'Z' : 'X');

      this.flag = this.physics.add.staticSprite(FLAG_X, GROUND_Y - 30, 'kit-flag', 0);
      this.flag.play('kit-flag-wave');

      this.player = this.physics.add.sprite(SPAWN_X, GROUND_Y - 20, 'hero', 0).setDepth(10);
      this.player.body.setSize(20, 26);
      this.player.setCollideWorldBounds(true);
      this.physics.add.collider(this.player, this.platforms);
      this.physics.add.overlap(this.player, this.flag, () => this.win());

      this.hud = K.hud(this, [{ keys: ['←', '→'], label: 'move' }, { keys: ['SPACE'], label: 'jump' }, { keys: [WRONG_KEY ? 'Z' : 'X'], label: 'dash' }]);

      this.cursors = this.input.keyboard.createCursorKeys();
      this.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.dashKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X); // every build; Z is never bound

      ghost.world(W, H);
      ghost.state({
        game: 'read-me',
        fault: FAULT || 'none',
        // Finishing is reported with the 'win' event, so it is not a milestone.
        milestones: [{ name: 'dash', x: PIT_X0, y: GROUND_Y - 14, kind: 'place' }], // where to dash: a place, not an object
      });
    }

    // A post and a board (wood), with "<key> DASH →" on it; the key is drawn as a cap.
    makeSign(x, key) {
      const g = this.add.graphics().setDepth(-2);
      g.fillStyle(K.hex(P.woodDark));
      g.fillRect(x - 3, GROUND_Y - 36, 6, 36);
      g.fillStyle(K.hex(P.woodDark));
      g.fillRect(x - 44, GROUND_Y - 70, 88, 36);
      g.fillStyle(K.hex(P.wood));
      g.fillRect(x - 42, GROUND_Y - 68, 84, 32);
      g.fillStyle(K.hex(P.woodLight));
      g.fillRect(x - 42, GROUND_Y - 68, 84, 2);
      g.fillStyle(K.hex(P.woodDark));
      g.fillRect(x - 42, GROUND_Y - 56, 84, 1);
      g.fillRect(x - 42, GROUND_Y - 46, 84, 1);
      // Key cap
      g.fillStyle(K.hex(P.capSide));
      g.fillRoundedRect(x - 36, GROUND_Y - 63, 22, 23, 4);
      g.fillStyle(K.hex(P.capFace));
      g.fillRoundedRect(x - 36, GROUND_Y - 63, 22, 20, 4);
      this.add.text(x - 25, GROUND_Y - 53, key, { fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color: P.ink }).setOrigin(0.5).setDepth(-1);
      this.add.text(x + 12, GROUND_Y - 52, 'DASH →', { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#2b1608' }).setOrigin(0.5).setDepth(-1);
    }

    update(time) {
      const p = this.player;
      const body = p.body;
      const onFloor = body.blocked.down || body.touching.down;
      const dashing = time < this.dashUntil;
      if (onFloor) this.lastOnFloor = time;
      if (onFloor && !dashing) this.canDash = true; // the dash recharges on landing

      if (!this.won) {
        let dir = 0;
        if (this.cursors.left.isDown) dir = -1;
        else if (this.cursors.right.isDown) dir = 1;

        if (Phaser.Input.Keyboard.JustDown(this.space) || Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
          this.lastJumpPress = time;
        }
        if (Phaser.Input.Keyboard.JustDown(this.dashKey) && this.canDash && !dashing) this.startDash(time, dir);

        if (time < this.dashUntil) {
          // Dashing: straight line, no gravity, no steering.
          p.setVelocity(DASH_SPEED * this.dashDir, 0);
          if (this.game.loop.frame % 3 === 0) this.afterimage();
        } else {
          body.allowGravity = true;
          p.setVelocityX(dir * SPEED);
          const canJump = time - this.lastOnFloor <= COYOTE_MS;
          if (time - this.lastJumpPress <= BUFFER_MS && canJump) {
            p.setVelocityY(-JUMP);
            this.lastJumpPress = -1e9;
            this.lastOnFloor = -1e9;
            K.dust(this, p.x, body.bottom, 3);
          }
        }
      }
      if (onFloor && !this.wasOnFloor) K.dust(this, p.x, body.bottom, 4);
      this.wasOnFloor = onFloor;
      K.animateHero(p, { onFloor, vx: time < this.dashUntil ? 0 : body.velocity.x, vy: body.velocity.y });
      if (time < this.dashUntil) p.setFlipX(this.dashDir < 0);

      if (p.y > DEATH_Y) this.die();

      ghost.pos(p.x, p.y, {
        vx: body.velocity.x,
        vy: body.velocity.y,
        onFloor,
        dashing: time < this.dashUntil,
        canDash: this.canDash,
        deaths: this.deaths,
        won: this.won,
        frame: this.game.loop.frame,
        screenX: p.x - this.cameras.main.scrollX,
        screenY: p.y - this.cameras.main.scrollY,
      });
    }

    startDash(time, dir) {
      this.canDash = false;
      this.dashUntil = time + DASH_MS;
      this.dashDir = dir || (this.player.flipX ? -1 : 1); // held direction, else the way we face
      this.player.setFlipX(this.dashDir < 0);
      this.player.body.allowGravity = false;
      if (!this.dashUsed) {
        this.dashUsed = true;
        ghost.event('milestone', { name: 'dash' });
      }
    }

    afterimage() {
      const img = this.add.image(this.player.x, this.player.y, 'hero-trail').setFlipX(this.dashDir < 0).setAlpha(0.7).setDepth(9);
      this.tweens.add({ targets: img, alpha: 0, duration: 250, onComplete: () => img.destroy() });
      const line = this.add.rectangle(this.player.x - this.dashDir * 16, this.player.y + (this.game.loop.frame % 2 ? -6 : 6), 18, 2, K.hex(P.goldLight), 0.8).setDepth(9);
      this.tweens.add({ targets: line, alpha: 0, scaleX: 0.3, duration: 200, onComplete: () => line.destroy() });
    }

    die() {
      this.deaths += 1;
      ghost.event('death', { deaths: this.deaths, dashed: !this.canDash });
      this.hud.setDeaths(this.deaths);
      K.burst(this, this.player.x, Math.min(this.player.y, SPIKE_Y - 6));
      this.dashUntil = -1e9;
      this.canDash = true;
      this.player.body.allowGravity = true;
      // body.reset moves the physics body and the sprite together (setPosition alone leaves the body in the pit).
      this.player.body.reset(SPAWN_X, GROUND_Y - 20);
      this.wasOnFloor = true;
    }

    win() {
      if (this.won) return;
      this.won = true;
      this.dashUntil = -1e9;
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
    backgroundColor: P.sky,
    pixelArt: true,
    physics: { default: 'arcade', arcade: { gravity: { y: GRAVITY }, debug: false } },
    scene: [Play],
    banner: false,
  });
})();
