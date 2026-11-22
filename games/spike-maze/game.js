// Spike Maze — a tiny top-down maze used to test the ghosts.
// Walk from the start (bottom-left) to the yellow exit (top-right). Spikes kill you and send you back
// to the start, or to the checkpoint flag once you have reached it. The straight corridor from the
// start to the checkpoint is spiked; a slightly longer safe detour runs just above it.
// Injected design fault (for the benchmark): ?fault=hidden-spikes stops drawing the spikes on that
// straight corridor. They still kill, so players keep dying on hazards they cannot see.
// Art v2 (22 Nov 2026): shared kit (games/shared/kit.js), the same dungeon as Key Hunt. Geometry unchanged.
/* global Phaser, ghost, GhostKit */
(function () {
  const K = GhostKit;
  const P = K.PALETTE;
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
      K.dungeonFloor(this, 0, TOP, W, MAP.length * T);
      K.groundTextures(this);
      K.spikeTile(this);
      const g = this.add.graphics().setDepth(-4);
      MAP.forEach((row, r) => {
        [...row].forEach((ch, c) => {
          const x = cx(c);
          const y = cy(r);
          if (ch === '#') {
            this.add.tileSprite(c * T, TOP + r * T, T, T, 'kit-ground').setOrigin(0, 0).setDepth(-5);
            if (r > 0 && tileAt(c, r - 1) !== '#') g.fillStyle(K.hex(P.groundLight)).fillRect(c * T, TOP + r * T, T, 6);
            this.walls.add(this.add.zone(x, y, T, T));
            return;
          }
          if (ch === '^' || ch === 'h') {
            if (!(HIDE_STRAIGHT && ch === 'h')) this.add.image(x, y, 'kit-spike-td').setDepth(-3);
            this.spikes.add(this.add.zone(x, y, SPIKE_HIT, SPIKE_HIT));
          }
        });
      });

      this.flag = this.physics.add.staticImage(CHECKPOINT.x, CHECKPOINT.y, 'checkpoint', 0);
      this.exit = this.physics.add.staticImage(EXIT.x, EXIT.y, K.exitTile(this, T));

      this.player = this.physics.add.sprite(START.x, START.y, K.heroTopDown(this), 0).setDepth(10);
      this.physics.add.collider(this.player, this.walls);
      this.physics.add.overlap(this.player, this.spikes, () => this.die());
      this.physics.add.overlap(this.player, this.flag, () => this.reachCheckpoint());
      this.physics.add.overlap(this.player, this.exit, () => this.win());

      this.hud = K.hud(this, [{ keys: ['←', '↑', '→', '↓'], label: 'move' }, { label: 'avoid the spikes' }, { label: 'reach the exit' }]);

      this.cursors = this.input.keyboard.createCursorKeys();
      // Remember the order the arrows were pressed in (event timestamps tie while the game clock is frozen).
      this.pressOrder = {};
      let presses = 0;
      DIRS.forEach((d) => this.cursors[d.key].on('down', () => (this.pressOrder[d.key] = ++presses)));

      ghost.world(W, H);
      ghost.state({
        game: 'spike-maze',
        fault: FAULT || 'none',
        milestones: [{ name: 'checkpoint', x: CHECKPOINT.x, y: CHECKPOINT.y, kind: 'object' }],
      });
    }

    makeTextures() {
      // Checkpoint flag (32×32): frame 0 lowered (not reached yet), frame 1 raised (reached). Gold both times.
      const pole = (cloth, at) => {
        const rows = [];
        for (let y = 0; y < 16; y++) {
          const c = cloth[y - at];
          rows.push('....' + (y === 1 ? 'LL' : y > 1 && y < 15 ? '.P' : y === 15 ? 'PPP' : '..') + (c && y > 1 && y < 15 ? c : ''));
        }
        return rows;
      };
      const cloth = ['GGGGGG', 'GgGGGGGG', 'GggGGGGGG', 'GgGGGGGG', 'GGGGGG'];
      K.pixels(this, 'checkpoint', [pole(cloth, 8), pole(cloth, 2)], { P: P.text, L: P.goldLight, G: P.gold, g: P.goldDark });
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
        }
      }
      p.setVelocity(vx, vy);
      K.animateHero(p, { onFloor: null, vx, vy });

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
      this.hud.setDeaths(this.deaths);
      K.burst(this, this.player.body.center.x, this.player.body.center.y);
      // body.reset moves the physics body and the sprite together (setPosition alone would desync them).
      this.player.body.reset(this.respawn.x, this.respawn.y);
    }

    reachCheckpoint() {
      if (this.reached) return;
      this.reached = true;
      this.respawn = CHECKPOINT;
      this.flag.setFrame(1);
      K.sparkle(this, CHECKPOINT.x, CHECKPOINT.y);
      ghost.event('milestone', { name: 'checkpoint' });
    }

    win() {
      if (this.won) return;
      this.won = true;
      this.player.setVelocity(0, 0);
      K.sparkle(this, EXIT.x, EXIT.y);
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
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: [Play],
    banner: false,
  });
})();
