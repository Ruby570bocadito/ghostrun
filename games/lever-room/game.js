// Lever Room — a one-screen puzzle used to test the ghosts.
// A tall door on the right blocks the exit flag. A lever on the low ledge to the left opens it:
// stand on the lever and press E, then walk through the open door to the flag. Nothing can kill you here.
// Injected design fault (for the benchmark): ?fault=no-hint hides the lever. The instructions no longer
// mention E, the lever is painted in the dull colour of the wall ornaments next to it (same shape, same
// place), it has no glow and no cable to the door, and no "E" prompt appears over it. It still works
// with E, but nothing tells the player that it exists or how to use it.
// Art v2 (22 Nov 2026): shared kit (games/shared/kit.js). The door is an iron gate with vertical grooves
// only (the old yellow bands read as a ladder) and a light over it that turns from red to green.
/* global Phaser, ghost, GhostKit */
(function () {
  const K = GhostKit;
  const P = K.PALETTE;
  const params = new URLSearchParams(location.search);
  const FAULT = params.get('fault');
  const HINTS = FAULT !== 'no-hint';

  const W = 640;
  const H = 360;
  const GROUND_Y = 300; // top surface of the floor
  const SPEED = 180;
  const JUMP = 500; // apex ~104 px
  const GRAVITY = 1200;
  const COYOTE_MS = 80;
  const BUFFER_MS = 120;

  const WALL = 16; // thickness of the side walls
  const LEDGE = { x: WALL, w: 112, top: 240 }; // 60 px above the floor: one jump
  const LEVER_X = 64;
  const DOOR = { x: 520, w: 20, top: 150 }; // fills the doorway from DOOR.top down to the floor
  const DOOR_H = GROUND_Y - DOOR.top;
  const LINTEL = { x: DOOR.x - 14, w: 28 };
  const FLAG_X = 584;
  const START_X = 260;
  const ORNAMENTS = [150, 270, 390]; // lever-shaped wall brackets, always in the dull ornament colour
  const HELP = HINTS
    ? [{ keys: ['←', '→'], label: 'move' }, { keys: ['SPACE'], label: 'jump' }, { keys: ['E'], label: 'use' }]
    : [{ keys: ['←', '→'], label: 'move' }, { keys: ['SPACE'], label: 'jump' }];
  const MILESTONES = [
    { name: 'lever', x: LEVER_X, y: LEDGE.top - 14, kind: 'object' },
    { name: 'door', x: DOOR.x, y: DOOR.top + DOOR_H / 2, kind: 'object' },
  ];
  const CABLE = [
    [LEVER_X, LEDGE.top],
    [LEVER_X, 318],
    [DOOR.x, 318],
    [DOOR.x, GROUND_Y],
  ];

  class Play extends Phaser.Scene {
    constructor() {
      super('play');
    }

    create() {
      this.won = false;
      this.leverOn = false;
      this.doorOpen = false;
      this.lastOnFloor = -1e9;
      this.lastJumpPress = -1e9;

      K.heroTextures(this);
      K.flagTextures(this);
      this.makeTextures();

      // The room: a dark brick back wall (scenery, 1.1:1) with lever-shaped brackets on it.
      K.bricks(this, 0, 0, W, GROUND_Y);
      ORNAMENTS.forEach((x) => {
        this.add.rectangle(x, 203, 20, 6, K.hex(P.deco)).setDepth(-20);
        this.add.image(x, 202, 'lever-dull').setOrigin(0.5, 1).setAngle(-35).setDepth(-20);
      });

      // The door is drawn behind the lintel so that it slides up behind it.
      this.door = this.physics.add.staticImage(DOOR.x, DOOR.top + DOOR_H / 2, 'gate').setDepth(-6);

      this.solids = this.physics.add.staticGroup();
      this.block(0, GROUND_Y, W, H - GROUND_Y, 'top'); // floor
      this.block(0, 0, WALL, GROUND_Y, 'right'); // left wall
      this.block(W - WALL, 0, WALL, GROUND_Y, 'left'); // right wall
      this.block(LEDGE.x, LEDGE.top, LEDGE.w, GROUND_Y - LEDGE.top, 'top'); // the ledge with the lever
      this.block(LINTEL.x, 0, LINTEL.w, DOOR.top, 'bottom'); // lintel: no way over the door

      // The light over the door: red while closed, green once open.
      this.light = this.add.rectangle(DOOR.x, DOOR.top - 14, 10, 10, K.hex(P.red)).setStrokeStyle(2, K.hex(P.hudBack)).setDepth(-4);

      // Clean build: a cable runs inside the ledge and the floor from the lever to the door.
      this.cable = this.add.graphics().setDepth(-4);
      if (HINTS) this.drawCable(P.goldDark);

      // The lever pivots on its base; the area around it is where E works.
      const texture = HINTS ? 'lever-gold' : 'lever-dull';
      if (HINTS) {
        const glow = this.add.circle(LEVER_X, LEDGE.top - 14, 16, K.hex(P.gold), 0.12).setDepth(-8);
        this.tweens.add({ targets: glow, scale: 1.3, alpha: 0.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.glow = glow;
      }
      this.add.rectangle(LEVER_X, LEDGE.top - 3, 20, 6, K.hex(HINTS ? P.goldDark : P.deco));
      this.lever = this.add.image(LEVER_X, LEDGE.top - 4, texture).setOrigin(0.5, 1).setAngle(-35);
      this.leverArea = new Phaser.Geom.Rectangle(LEVER_X - 32, LEDGE.top - 40, 64, 40); // from the wall to just past the lever

      this.flag = this.physics.add.staticSprite(FLAG_X, GROUND_Y - 30, 'kit-flag', 0);
      this.flag.play('kit-flag-wave');

      this.player = this.physics.add.sprite(START_X, GROUND_Y - 20, 'hero', 0).setDepth(10);
      this.player.body.setSize(20, 26);
      this.player.setCollideWorldBounds(true);
      this.physics.add.collider(this.player, this.solids);
      this.physics.add.collider(this.player, this.door);
      this.physics.add.overlap(this.player, this.flag, () => this.win());

      // "E" bubble over the lever, shown while the player stands on it (clean version only).
      const key = this.add.text(0, -3, 'E', { fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color: P.ink });
      this.prompt = this.add.container(LEVER_X, LEDGE.top - 50, [this.add.image(0, 0, 'bubble'), key.setOrigin(0.5)]).setVisible(false).setDepth(20);
      this.tweens.add({ targets: this.prompt, y: this.prompt.y - 3, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      this.hud = K.hud(this, HELP, { deaths: false });

      this.cursors = this.input.keyboard.createCursorKeys();
      this.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.useKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

      ghost.world(W, H);
      ghost.state({ game: 'lever-room', fault: FAULT || 'none', milestones: MILESTONES });
    }

    // A solid teal block (collision + kit tiles) with the light edge on the side the player sees.
    block(x, y, w, h, edge) {
      this.solids.add(this.add.rectangle(x + w / 2, y + h / 2, w, h).setVisible(false));
      if (edge === 'top') K.groundBlock(this, x, y, w, h, { left: false, right: false });
      else K.solidBlock(this, x, y, w, h, edge);
    }

    drawCable(color) {
      const g = this.cable;
      g.clear();
      for (let i = 1; i < CABLE.length; i++) {
        const [x0, y0] = CABLE[i - 1];
        const [x1, y1] = CABLE[i];
        g.fillStyle(K.hex(P.groundDeep));
        g.fillRect(Math.min(x0, x1) - 3, Math.min(y0, y1) - 3, Math.abs(x1 - x0) + 6, Math.abs(y1 - y0) + 6);
      }
      for (let i = 1; i < CABLE.length; i++) {
        const [x0, y0] = CABLE[i - 1];
        const [x1, y1] = CABLE[i];
        g.fillStyle(K.hex(color));
        g.fillRect(Math.min(x0, x1) - 1, Math.min(y0, y1) - 1, Math.abs(x1 - x0) + 2, Math.abs(y1 - y0) + 2);
      }
    }

    makeTextures() {
      // Lever: a knob on a stick (12×26); it pivots at the bottom. Same shape in both builds.
      const lever = ['.kkkk.', 'kLLkkk', 'kLLkkk', 'kkkkkk', 'kkkkkd', '.kkkd.', '..kk..', '..kk..', '..kk..', '..kk..', '..kk..', '..kk..', '..kd..'];
      K.pixels(this, 'lever-gold', lever, { k: P.gold, L: P.goldLight, d: P.goldDark, s: P.gold });
      K.pixels(this, 'lever-dull', lever, { k: P.deco, L: P.deco, d: P.deco, s: P.deco });
      // Gate: steel with vertical grooves and teeth at the bottom. No horizontal bands (they read as a ladder).
      const rows = [];
      for (let y = 0; y < DOOR_H / 2; y++) rows.push(y >= DOOR_H / 2 - 3 ? (y % 2 ? 'S.S..S..S.' : 'SSS.SSS.SS') : 'eSSgSSSgSs');
      K.pixels(this, 'gate', rows, { e: P.text, S: '#b9c0e0', g: '#6c7499', s: '#8b93b8' });
      // Speech bubble for the "E" prompt.
      const g = this.add.graphics();
      g.fillStyle(K.hex(P.capSide));
      g.fillRoundedRect(0, 2, 24, 20, 5);
      g.fillStyle(K.hex(P.capFace));
      g.fillRoundedRect(0, 0, 24, 20, 5);
      g.fillTriangle(8, 19, 16, 19, 12, 25);
      g.generateTexture('bubble', 24, 26);
      g.destroy();
    }

    update(time) {
      const p = this.player;
      const body = p.body;
      const onFloor = body.blocked.down || body.touching.down;
      if (onFloor) this.lastOnFloor = time;
      // Plain rectangle test: an Arcade overlap would mark the falling body as touching down (mid-air jumps).
      const atLever = !this.leverOn && Phaser.Geom.Intersects.RectangleToValues(this.leverArea, body.left, body.right, body.top, body.bottom);
      const usePressed = Phaser.Input.Keyboard.JustDown(this.useKey);

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
          K.dust(this, p.x, body.bottom, 3);
        }

        if (atLever && usePressed) this.pullLever();
      }
      if (onFloor && !this.wasOnFloor) K.dust(this, p.x, body.bottom, 4);
      this.wasOnFloor = onFloor;
      K.animateHero(p, { onFloor, vx: body.velocity.x, vy: body.velocity.y });
      this.prompt.setVisible(HINTS && atLever && !this.leverOn);

      ghost.pos(p.x, p.y, {
        vx: body.velocity.x,
        vy: body.velocity.y,
        onFloor,
        deaths: 0, // nothing can hurt you in this room
        won: this.won,
        lever: this.leverOn,
        door: this.doorOpen,
        frame: this.game.loop.frame,
        screenX: p.x - this.cameras.main.scrollX,
        screenY: p.y - this.cameras.main.scrollY,
      });
    }

    pullLever() {
      this.leverOn = true;
      this.tweens.add({ targets: this.lever, angle: 35, duration: 150, ease: 'Back.easeOut' });
      if (this.glow) this.glow.destroy();
      if (HINTS) this.drawCable(P.goldLight);
      K.sparkle(this, LEVER_X, LEDGE.top - 16);
      ghost.event('milestone', { name: 'lever' });
      // The door slides up behind the lintel (2 px extra: canvas draws images 1 px oversize); its static body follows it.
      this.tweens.add({
        targets: this.door, y: this.door.y - DOOR_H - 2, delay: 200, duration: 800, ease: 'Sine.easeInOut',
        onUpdate: () => this.door.refreshBody(),
        onComplete: () => {
          this.doorOpen = true;
          this.light.setFillStyle(K.hex(P.green));
          ghost.event('milestone', { name: 'door' });
        },
      });
    }

    win() {
      if (this.won) return;
      this.won = true;
      this.player.setVelocity(0, 0);
      this.player.body.allowGravity = false;
      K.sparkle(this, FLAG_X, GROUND_Y - 40);
      this.hud.banner('LEVEL COMPLETE!');
      ghost.event('win', { deaths: 0 });
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
