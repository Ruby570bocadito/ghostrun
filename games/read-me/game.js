// Read Me — a one-screen platformer used to test the ghosts.
// Cross the pit and touch the flag. The pit (220 px) is too wide for a normal jump (~185 px at best),
// so you have to JUMP and then DASH in mid-air. The dash (X) is a fast horizontal burst (380 px/s for
// 0.35 s, gravity off), one per airtime, recharged on landing.
// Injected design fault (for the benchmark): ?fault=wrong-key makes the instructions and the sign say
// "Z dash" while the dash still only works with X (Z does nothing), so players who read the controls
// press Z at the edge, nothing happens and they fall into the pit.
/* global Phaser, ghost */
(function () {
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
  const TEXT = { fontFamily: 'monospace', fontSize: '14px', color: '#e7e9ff' };

  class Play extends Phaser.Scene {
    constructor() {
      super('play');
    }

    create() {
      Object.assign(this, { deaths: 0, won: false, lastOnFloor: -1e9, lastJumpPress: -1e9 });
      Object.assign(this, { canDash: true, dashUntil: -1e9, dashDir: 1, dashUsed: false }); // dash state

      this.makeTextures();
      this.physics.world.setBounds(0, -200, W, H + 400);

      // Background details so the level does not look empty.
      for (let i = 0; i < 24; i++) {
        this.add.circle(Phaser.Math.Between(0, W), Phaser.Math.Between(40, 220), Phaser.Math.Between(1, 2), 0x2a2f4a);
      }

      // The pit: dark red glow with spikes at the bottom.
      const pit = this.add.graphics();
      pit.fillStyle(0x3a1020);
      pit.fillRect(PIT_X0, SPIKE_Y - 10, PIT_X1 - PIT_X0, H - SPIKE_Y + 10);
      pit.fillStyle(0xff4d6d);
      for (let x = PIT_X0; x < PIT_X1; x += 20) pit.fillTriangle(x + 2, H - 6, x + 10, SPIKE_Y, x + 18, H - 6);
      pit.fillRect(PIT_X0, H - 6, PIT_X1 - PIT_X0, 6);

      this.platforms = this.physics.add.staticGroup();
      PLATFORMS.forEach((s) => {
        this.platforms.add(this.add.rectangle(s.x + s.w / 2, GROUND_Y + 30, s.w, 60, 0x2ec4b6));
        this.add.rectangle(s.x + s.w / 2, GROUND_Y + 3, s.w, 6, 0x9bf6ec);
      });

      // Sign post at the edge, for flavour (in the faulty build it names the wrong key too).
      const signX = PIT_X0 - 44;
      const signStyle = { ...TEXT, fontSize: '12px', color: '#f6d55c', backgroundColor: '#2a2f4a', padding: { x: 6, y: 4 } };
      this.add.rectangle(signX, GROUND_Y - 20, 4, 40, 0xdddddd);
      this.add.text(signX, GROUND_Y - 50, WRONG_KEY ? 'Z: DASH →' : 'DASH →', signStyle).setOrigin(0.5);

      this.flag = this.physics.add.staticImage(FLAG_X, GROUND_Y - 30, 'flag');

      this.player = this.physics.add.sprite(SPAWN_X, GROUND_Y - 20, 'player');
      this.player.body.setSize(20, 26);
      this.player.setCollideWorldBounds(true);
      this.physics.add.collider(this.player, this.platforms);
      this.physics.add.overlap(this.player, this.flag, () => this.win());

      const help = `← → move     SPACE jump     ${WRONG_KEY ? 'Z' : 'X'} dash`;
      this.add.text(W / 2, 14, help, TEXT).setOrigin(0.5, 0).setScrollFactor(0);
      this.deathText = this.add.text(12, 12, 'Deaths: 0', { ...TEXT, color: '#ff8fa3' }).setScrollFactor(0);
      this.banner = this.add
        .text(W / 2, H / 2 - 40, '', { ...TEXT, fontSize: '28px', color: '#f6d55c' })
        .setOrigin(0.5)
        .setScrollFactor(0);

      this.cursors = this.input.keyboard.createCursorKeys();
      this.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.dashKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X); // every build; Z is never bound

      ghost.world(W, H);
      ghost.state({
        game: 'read-me',
        fault: FAULT || 'none',
        // Finishing is reported with the 'win' event, so it is not a milestone.
        milestones: [{ name: 'dash', x: PIT_X0, y: GROUND_Y - 14 }],
      });
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
      g.fillStyle(0xf6d55c);
      g.fillRoundedRect(0, 0, 22, 28, 6);
      g.generateTexture('trail', 22, 28);
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
          if (dir !== 0) p.setFlipX(dir < 0);
          const canJump = time - this.lastOnFloor <= COYOTE_MS;
          if (time - this.lastJumpPress <= BUFFER_MS && canJump) {
            p.setVelocityY(-JUMP);
            this.lastJumpPress = -1e9;
            this.lastOnFloor = -1e9;
          }
        }
      }

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
      const img = this.add.image(this.player.x, this.player.y, 'trail').setAlpha(0.6).setDepth(-1);
      this.tweens.add({ targets: img, alpha: 0, duration: 250, onComplete: () => img.destroy() });
    }

    die() {
      this.deaths += 1;
      ghost.event('death', { deaths: this.deaths, dashed: !this.canDash });
      this.deathText.setText('Deaths: ' + this.deaths);
      this.dashUntil = -1e9;
      this.canDash = true;
      this.player.body.allowGravity = true;
      // body.reset moves the physics body and the sprite together (setPosition alone leaves the body in the pit).
      this.player.body.reset(SPAWN_X, GROUND_Y - 20);
      this.cameras.main.flash(120, 255, 80, 100);
    }

    win() {
      if (this.won) return;
      this.won = true;
      this.dashUntil = -1e9;
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
