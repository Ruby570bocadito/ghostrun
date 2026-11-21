// Lever Room — a one-screen puzzle used to test the ghosts.
// A tall door on the right blocks the exit flag. A lever on the low ledge to the left opens it:
// stand on the lever and press E, then walk through the open door to the flag. Nothing can kill you here.
// Injected design fault (for the benchmark): ?fault=no-hint hides the lever. The instructions no longer
// mention E, the lever is painted in the dull colour of the background decoration and no "E" prompt
// appears over it. It still works with E, but nothing tells the player that it exists or how to use it.
/* global Phaser, ghost */
(function () {
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
  const FLAG_X = 584;
  const START_X = 260;
  const LEVER_COLOR = HINTS ? 0xf6d55c : 0x2a2f4a; // the fault paints it like the background dots
  const HELP = HINTS ? '← → move     SPACE jump     E use' : '← → move     SPACE jump';
  const MILESTONES = [
    { name: 'lever', x: LEVER_X, y: LEDGE.top - 14, kind: 'object' },
    { name: 'door', x: DOOR.x, y: DOOR.top + DOOR_H / 2, kind: 'object' },
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

      this.makeTextures();

      // Background details (seeded, so every run and every ghost sees the same room).
      const rnd = new Phaser.Math.RandomDataGenerator(['lever-room']);
      for (let i = 0; i < 40; i++) {
        this.add.circle(rnd.between(0, W), rnd.between(40, 280), rnd.between(1, 2), 0x2a2f4a);
      }

      // The door is created before the walls so that it slides up behind the lintel.
      this.door = this.physics.add.staticImage(DOOR.x, DOOR.top + DOOR_H / 2, 'door');

      this.solids = this.physics.add.staticGroup();
      this.block(0, GROUND_Y, W, H - GROUND_Y, 'top'); // floor
      this.block(0, 0, WALL, GROUND_Y, 'right'); // left wall
      this.block(W - WALL, 0, WALL, GROUND_Y, 'left'); // right wall
      this.block(LEDGE.x, LEDGE.top, LEDGE.w, GROUND_Y - LEDGE.top, 'top'); // the ledge with the lever
      this.block(DOOR.x - 14, 0, 28, DOOR.top, 'bottom'); // lintel: no way over the door

      // The lever pivots on its base; the area around it is where E works.
      this.add.rectangle(LEVER_X, LEDGE.top - 3, 20, 6, LEVER_COLOR);
      this.lever = this.add.image(LEVER_X, LEDGE.top - 4, 'lever').setOrigin(0.5, 1).setAngle(-35);
      this.leverArea = new Phaser.Geom.Rectangle(LEVER_X - 32, LEDGE.top - 40, 64, 40); // from the wall to just past the lever

      this.flag = this.physics.add.staticImage(FLAG_X, GROUND_Y - 30, 'flag');

      this.player = this.physics.add.sprite(START_X, GROUND_Y - 20, 'player');
      this.player.body.setSize(20, 26);
      this.player.setCollideWorldBounds(true);
      this.physics.add.collider(this.player, this.solids);
      this.physics.add.collider(this.player, this.door);
      this.physics.add.overlap(this.player, this.flag, () => this.win());

      // "E" bubble over the lever, shown while the player stands on it (clean version only).
      const key = this.add.text(0, -3, 'E', { fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color: '#141726' });
      this.prompt = this.add.container(LEVER_X, LEDGE.top - 50, [this.add.image(0, 0, 'bubble'), key.setOrigin(0.5)]).setVisible(false);
      this.tweens.add({ targets: this.prompt, y: this.prompt.y - 3, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      this.add
        .text(W / 2, 14, HELP, { fontFamily: 'monospace', fontSize: '14px', color: '#e7e9ff' })
        .setOrigin(0.5, 0)
        .setScrollFactor(0);
      this.banner = this.add
        .text(W / 2, H / 2 - 40, '', { fontFamily: 'monospace', fontSize: '28px', color: '#f6d55c' })
        .setOrigin(0.5)
        .setScrollFactor(0);

      this.cursors = this.input.keyboard.createCursorKeys();
      this.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.useKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

      ghost.world(W, H);
      ghost.state({ game: 'lever-room', fault: FAULT || 'none', milestones: MILESTONES });
    }

    // A solid teal block with a lighter 6 px edge on the side the player sees.
    block(x, y, w, h, edge) {
      this.solids.add(this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x2ec4b6));
      const e = { top: [x, y, w, 6], bottom: [x, y + h - 6, w, 6], left: [x, y, 6, h], right: [x + w - 6, y, 6, h] }[edge];
      this.add.rectangle(e[0] + e[2] / 2, e[1] + e[3] / 2, e[2], e[3], 0x9bf6ec);
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
      g.clear();
      // Door: a teal bar with yellow bands and a light edge.
      g.fillStyle(0x2ec4b6);
      g.fillRect(0, 0, DOOR.w, DOOR_H);
      g.fillStyle(0xf6d55c);
      for (let y = 12; y < DOOR_H - 8; y += 28) g.fillRect(0, y, DOOR.w, 8);
      g.fillStyle(0x9bf6ec);
      g.fillRect(0, 0, 3, DOOR_H);
      g.generateTexture('door', DOOR.w, DOOR_H);
      g.clear();
      // Lever: a stick with a knob; it pivots at the bottom.
      g.fillStyle(LEVER_COLOR);
      g.fillRect(3, 6, 4, 20);
      g.fillCircle(5, 5, 5);
      g.generateTexture('lever', 10, 26);
      g.clear();
      // Speech bubble for the "E" prompt.
      g.fillStyle(0xe7e9ff);
      g.fillRoundedRect(0, 0, 22, 20, 5);
      g.fillTriangle(7, 19, 15, 19, 11, 25);
      g.generateTexture('bubble', 22, 26);
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

        if (atLever && usePressed) this.pullLever();
      }
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
      ghost.event('milestone', { name: 'lever' });
      // The door slides up behind the lintel (2 px extra: canvas draws images 1 px oversize); its static body follows it.
      this.tweens.add({
        targets: this.door, y: this.door.y - DOOR_H - 2, delay: 200, duration: 800, ease: 'Sine.easeInOut',
        onStart: () => this.cameras.main.shake(250, 0.003),
        onUpdate: () => this.door.refreshBody(),
        onComplete: () => {
          this.doorOpen = true;
          ghost.event('milestone', { name: 'door' });
        },
      });
    }

    win() {
      if (this.won) return;
      this.won = true;
      this.player.setVelocity(0, 0);
      this.player.body.allowGravity = false;
      this.banner.setText('LEVEL COMPLETE!');
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
    physics: { default: 'arcade', arcade: { gravity: { y: GRAVITY }, debug: false } },
    scene: [Play],
    banner: false,
  });
})();
