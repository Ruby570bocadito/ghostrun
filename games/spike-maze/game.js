// Spike Maze — a tiny top-down maze used to test the ghosts.
// Walk from the start (bottom-left) to the yellow exit (top-right). Spikes kill you and send you back
// to the start, or to the checkpoint flag once you have reached it. The straight corridor from the
// start to the checkpoint is spiked; a slightly longer safe detour runs just above it.
// Injected design fault (for the benchmark): ?fault=hidden-spikes stops drawing the spikes on that
// straight corridor. They still kill, so players keep dying on hazards they cannot see.
/* global Phaser, ghost */
(function () {
  const params = new URLSearchParams(location.search);
  const FAULT = params.get('fault');
  const HIDE_STRAIGHT = FAULT === 'hidden-spikes';

  const W = 640;
  const H = 360;
  const T = 32; // tile size; corridors are one tile wide
  const TOP = 40; // the maze starts below the instructions
  const SPEED = 140;
  const PLAYER = 20; // player size (texture and body)
  const SPIKE_HIT = 20; // spike hitbox, a bit smaller than the drawn tile

  // #  wall   .  floor   S  start   C  checkpoint   E  exit
  // ^  spike  h  spike on the straight route to the checkpoint (not drawn with ?fault=hidden-spikes)
  const MAP = [
    '####################',
    '###########.....^.E#',
    '#.....#...#..^.....#',
    '#.#####.###.########',
    '#...........#.....##',
    '###########.#.######',
    '###.....###.......##',
    '###.###.###.###.#.##',
    '#S...hh..C..#...#.##',
    '####################',
  ];
  const tileAt = (c, r) => (MAP[r] && MAP[r][c]) || '#';
  const cx = (c) => c * T + T / 2;
  const cy = (r) => TOP + r * T + T / 2;
  const find = (ch) => {
    const r = MAP.findIndex((row) => row.includes(ch));
    return { x: cx(MAP[r].indexOf(ch)), y: cy(r) };
  };
  const START = find('S');
  const CHECKPOINT = find('C');
  const EXIT = find('E');
  const DIRS = [
    { key: 'left', dx: -1, dy: 0 },
    { key: 'right', dx: 1, dy: 0 },
    { key: 'up', dx: 0, dy: -1 },
    { key: 'down', dx: 0, dy: 1 },
  ];
  const TEXT = { fontFamily: 'monospace', fontSize: '14px', color: '#e7e9ff' };

  class Play extends Phaser.Scene {
    constructor() {
      super('play');
    }

    create() {
      this.deaths = 0;
      this.won = false;
      this.reached = false;
      this.respawn = START;

      this.makeTextures();
      this.walls = this.physics.add.staticGroup();
      this.spikes = this.physics.add.staticGroup();
      const g = this.add.graphics();
      MAP.forEach((row, r) => {
        [...row].forEach((ch, c) => {
          const x = cx(c);
          const y = cy(r);
          if (ch === '#') {
            g.fillStyle(0x2ec4b6).fillRect(c * T, TOP + r * T, T, T);
            if (r > 0 && tileAt(c, r - 1) !== '#') g.fillStyle(0x9bf6ec).fillRect(c * T, TOP + r * T, T, 4);
            this.walls.add(this.add.zone(x, y, T, T));
            return;
          }
          g.fillStyle(0x2a2f4a).fillRect(x - 1, y - 1, 2, 2); // faint floor dot
          if (ch === '^' || ch === 'h') {
            if (!(HIDE_STRAIGHT && ch === 'h')) this.add.image(x, y, 'spike');
            this.spikes.add(this.add.zone(x, y, SPIKE_HIT, SPIKE_HIT));
          }
        });
      });

      this.flag = this.physics.add.staticImage(CHECKPOINT.x, CHECKPOINT.y, 'checkpoint').setAlpha(0.45);
      this.exit = this.physics.add.staticImage(EXIT.x, EXIT.y, 'exit');

      this.player = this.physics.add.sprite(START.x, START.y, 'player');
      this.physics.add.collider(this.player, this.walls);
      this.physics.add.overlap(this.player, this.spikes, () => this.die());
      this.physics.add.overlap(this.player, this.flag, () => this.reachCheckpoint());
      this.physics.add.overlap(this.player, this.exit, () => this.win());

      this.add.text(W / 2, 14, '← ↑ → ↓ move     avoid the spikes     reach the exit', TEXT).setOrigin(0.5, 0);
      this.deathText = this.add.text(12, 12, 'Deaths: 0', { ...TEXT, color: '#ff8fa3' });
      this.banner = this.add
        .text(W / 2, H / 2 - 20, 'LEVEL COMPLETE!', {
          ...TEXT,
          fontSize: '28px',
          color: '#f6d55c',
          backgroundColor: '#141726',
          padding: { x: 14, y: 8 },
        })
        .setOrigin(0.5)
        .setVisible(false);

      this.cursors = this.input.keyboard.createCursorKeys();
      // Remember the order the arrows were pressed in (event timestamps tie while the game clock is frozen).
      this.pressOrder = {};
      let presses = 0;
      DIRS.forEach((d) => this.cursors[d.key].on('down', () => (this.pressOrder[d.key] = ++presses)));

      ghost.world(W, H);
      ghost.state({
        game: 'spike-maze',
        fault: FAULT || 'none',
        milestones: [{ name: 'checkpoint', x: CHECKPOINT.x, y: CHECKPOINT.y }],
      });
    }

    makeTextures() {
      const g = this.add.graphics();
      // Player: coral block with one eye (faces right, flipped when walking left).
      g.fillStyle(0xff6b6b).fillRoundedRect(0, 0, PLAYER, PLAYER, 5);
      g.fillStyle(0xffffff).fillRect(10, 5, 6, 6);
      g.fillStyle(0x141726).fillRect(13, 7, 3, 3);
      g.generateTexture('player', PLAYER, PLAYER);
      g.clear();
      // Spikes: red triangles on a dark red tile.
      g.fillStyle(0x3a1020).fillRect(0, 0, T, T);
      g.fillStyle(0xff4d6d);
      [[2, 3], [17, 3], [2, 17], [17, 17]].forEach(([x, y]) => g.fillTriangle(x, y + 12, x + 6.5, y, x + 13, y + 12));
      g.generateTexture('spike', T, T);
      g.clear();
      // Checkpoint flag (dim until reached).
      g.fillStyle(0xdddddd).fillRect(9, 4, 3, 24);
      g.fillStyle(0xf6d55c).fillTriangle(12, 5, 26, 11, 12, 17);
      g.generateTexture('checkpoint', T, T);
      g.clear();
      // Exit: yellow pad.
      g.fillStyle(0xf6d55c).fillRect(1, 1, T - 2, T - 2);
      g.fillStyle(0x141726).fillRect(6, 6, T - 12, T - 12);
      g.fillStyle(0xf6d55c).fillRect(11, 11, T - 22, T - 22);
      g.generateTexture('exit', T, T);
      g.destroy();
    }

    update() {
      const p = this.player;
      const { x, y } = p.body.center; // inside update() the sprite still lags the body by one step
      const c = Math.floor(x / T);
      const r = Math.floor((y - TOP) / T);
      // Can the player still go that way? Room left in its tile, or the next tile is not a wall.
      const canGo = (d) => d.dx * (cx(c) - x) > 1 || d.dy * (cy(r) - y) > 1 || tileAt(c + d.dx, r + d.dy) !== '#';
      let vx = 0;
      let vy = 0;
      if (!this.won) {
        // 4-way movement: the most recently pressed arrow wins, unless a wall blocks it.
        const held = DIRS.filter((d) => this.cursors[d.key].isDown);
        held.sort((a, b) => this.pressOrder[b.key] - this.pressOrder[a.key]);
        const dir = held.find(canGo) || held[0];
        if (dir) {
          // Pull the player to the middle of its lane so side corridors are easy to enter.
          vx = dir.dx ? dir.dx * SPEED : Phaser.Math.Clamp((cx(c) - x) * 10, -SPEED, SPEED);
          vy = dir.dy ? dir.dy * SPEED : Phaser.Math.Clamp((cy(r) - y) * 10, -SPEED, SPEED);
          if (dir.dx) p.setFlipX(dir.dx < 0);
        }
      }
      p.setVelocity(vx, vy);

      ghost.pos(x, y, {
        vx,
        vy,
        deaths: this.deaths,
        won: this.won,
        checkpoint: this.reached,
        frame: this.game.loop.frame,
        screenX: x - this.cameras.main.scrollX,
        screenY: y - this.cameras.main.scrollY,
      });
    }

    die() {
      if (this.won) return;
      this.deaths += 1;
      ghost.event('death', { deaths: this.deaths, respawn: this.reached ? 'checkpoint' : 'start' });
      this.deathText.setText('Deaths: ' + this.deaths);
      // body.reset moves the physics body and the sprite together (setPosition alone would desync them).
      this.player.body.reset(this.respawn.x, this.respawn.y);
      this.cameras.main.flash(120, 255, 80, 100);
    }

    reachCheckpoint() {
      if (this.reached) return;
      this.reached = true;
      this.respawn = CHECKPOINT;
      this.flag.setAlpha(1);
      this.tweens.add({ targets: this.flag, scale: 1.35, duration: 120, yoyo: true });
      ghost.event('milestone', { name: 'checkpoint' });
    }

    win() {
      if (this.won) return;
      this.won = true;
      this.player.setVelocity(0, 0);
      this.banner.setVisible(true);
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
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: [Play],
    banner: false,
  });
})();
