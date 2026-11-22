// Ghostrun test games — shared art kit (v2, 22 Nov 2026). Plain script, no modules: load it after Phaser
// and before the game (<script src="../shared/kit.js"></script>) and use window.GhostKit.
//
// Rules the art follows, so the ghosts (and people) read the games the way we mean:
// - colour has a meaning: GOLD = something you can use or reach, RED = it hurts, CORAL = you,
//   TEAL = solid ground, and the scenery is muted, always below 1.5:1 against the sky, so it never
//   looks like a platform, a ladder or a button;
// - everything is pixel art drawn from text arrays at 2x, nothing from image files or AI generators;
// - the hero animates at 100 ms per frame, the rate the ghosts' frames are captured at;
// - deaths are a short burst with a skull: no red flash, no camera shake, no slow motion;
// - anything random takes a seed, so every run and every ghost sees the same level;
// - no WebGL (games run with Phaser.CANVAS), no sound, no title screens.
/* global Phaser */
(function () {
  const PALETTE = {
    sky: '#141726', // background of every game (do not change: contrasts are measured against it)
    skyFar: '#181c2e', // far parallax layer, 1.1:1 against the sky
    skyMid: '#1c2134', // near parallax layer, 1.2:1
    deco: '#2a2f4a', // stars and wall ornaments, 1.4:1: the brightest any scenery may be
    ground: '#2ec4b6', // solid ground (teal)
    groundLight: '#9bf6ec', // the walkable edge
    groundDark: '#1f8f85',
    groundDeep: '#166b63',
    gold: '#f6d55c', // interactive: flags, levers, keys, signs' keys
    goldLight: '#fff1a8',
    goldDark: '#b8901f',
    red: '#ff4d6d', // damage: spikes
    redDark: '#a3203b',
    pit: '#3a1020',
    hero: '#ff7b6b', // the player (coral)
    heroLight: '#ffb3a7',
    heroDark: '#d24f48',
    heroLine: '#5a1e2a',
    white: '#ffffff',
    ink: '#141726',
    text: '#e7e9ff',
    textDim: '#9aa0c8',
    deaths: '#ff8fa3',
    hudBack: '#0b0d17',
    capFace: '#e7e9ff',
    capSide: '#9aa0c8',
    wood: '#a86b3c',
    woodLight: '#d39a5f',
    woodDark: '#6e4424',
    steel: '#8b93b8',
    steelDark: '#4b5275',
    green: '#5ce08a',
    floorStamp: '#181c2d', // dungeon floor stamps, 1.06:1
  };
  const hex = (c) => parseInt(c.slice(1), 16);

  /** WCAG contrast ratio of two '#rrggbb' colours. */
  function contrast(a, b) {
    const lum = (c) => {
      const n = hex(c);
      const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    };
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  /** Seeded random numbers (mulberry32): rng() in [0, 1), rng.int(a, b) inclusive. */
  function rng(seed) {
    let s = 0;
    for (const ch of String(seed)) s = (Math.imul(s, 31) + ch.charCodeAt(0)) | 0;
    const next = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.int = (a, b) => a + Math.floor(next() * (b - a + 1));
    next.pick = (list) => list[Math.floor(next() * list.length)];
    return next;
  }

  /**
   * Pixel art from text rows: each character is a colour from `colors` ('.' or a space is transparent),
   * drawn at `scale` (2 by default). `frames` is a list of row arrays laid side by side in one texture,
   * named 0, 1, 2… Returns the texture key.
   */
  function pixels(scene, key, frames, colors, scale = 2) {
    if (scene.textures.exists(key)) return key;
    const list = typeof frames[0] === 'string' ? [frames] : frames;
    const fh = list[0].length;
    const fw = Math.max(...list.flat().map((r) => r.length));
    const tex = scene.textures.createCanvas(key, fw * scale * list.length, fh * scale);
    const ctx = tex.getContext();
    list.forEach((rows, f) => {
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const c = colors[row[x]];
          if (!c) continue;
          ctx.fillStyle = c;
          ctx.fillRect((f * fw + x) * scale, y * scale, scale, scale);
        }
      });
      tex.add(f, 0, f * fw * scale, 0, fw * scale, fh * scale);
    });
    tex.refresh();
    return key;
  }

  // ---------------------------------------------------------------- the hero (22×28, coral, looks right)
  const HERO_BODY = [
    '...ooooo...',
    '..olllcco..',
    '.olcccccco.',
    'olccccwwwco',
    'olccccwwpco',
    'occcccwwpco',
    'occcccccbco',
    'occccccccco',
    'odcccccccdo',
    '.oddddddddo',
    '..oooooooo.',
  ];
  const HERO_BLINK = HERO_BODY.map((r, i) => (i === 3 ? 'olcccccccco' : i === 4 ? 'olccccoooco' : i === 5 ? 'occccccccco' : r));
  const LEGS = {
    stand: ['...oo.oo...', '...ff.ff...', '..fff.fff..'],
    run0: ['..oo...oo..', '.ff.....ff.', '.f.......f.'],
    run1: ['...oo.oo...', '....fff....', '....ff.....'],
    run2: ['...oo..oo..', '..ff....ff.', '..f......ff'],
    run3: ['....ooo....', '....fff....', '.....ff....'],
    jump: ['..oo...oo..', '..ff...ff..', '...........'],
    fall: ['.oo.....oo.', '.f.......f.', '...........'],
  };
  const HERO_COLORS = {
    o: PALETTE.heroLine,
    c: PALETTE.hero,
    l: PALETTE.heroLight,
    d: PALETTE.heroDark,
    w: PALETTE.white,
    p: PALETTE.ink,
    b: '#ff9a8c',
    f: PALETTE.heroLine,
  };
  const BOB = (rows) => ['...........', ...rows.slice(0, -1)]; // the body one pixel lower (step down)
  const HERO_FRAMES = [
    [...HERO_BODY, ...LEGS.stand], // 0 idle
    [...HERO_BLINK, ...LEGS.stand], // 1 idle, blinking
    [...HERO_BODY, ...LEGS.run0], // 2 run
    [...BOB(HERO_BODY), ...LEGS.run1], // 3
    [...HERO_BODY, ...LEGS.run2], // 4
    [...BOB(HERO_BODY), ...LEGS.run3], // 5
    [...HERO_BODY, ...LEGS.jump], // 6 jump (going up)
    [...HERO_BODY, ...LEGS.fall], // 7 fall
  ];

  /** Makes the 'hero' texture (22×28 frames) and its animations. Call once in create(). */
  function heroTextures(scene) {
    pixels(scene, 'hero', HERO_FRAMES, HERO_COLORS);
    const anim = (key, frames, repeat = -1) => {
      if (!scene.anims.exists(key)) scene.anims.create({ key, frames: frames.map((frame) => ({ key: 'hero', frame })), frameRate: 10, repeat });
    };
    anim('hero-idle', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]);
    anim('hero-run', [2, 3, 4, 5]);
    anim('hero-jump', [6]);
    anim('hero-fall', [7]);
    return 'hero';
  }

  /** Picks the hero's animation from its state; call every frame. Platformers pass onFloor; top-down games pass null. */
  function animateHero(sprite, { onFloor, vx, vy }) {
    let key;
    if (onFloor === null) key = vx || vy ? 'hero-run' : 'hero-idle';
    else if (!onFloor) key = vy < 0 ? 'hero-jump' : 'hero-fall';
    else key = vx ? 'hero-run' : 'hero-idle';
    if (sprite.anims.currentAnim?.key !== key) sprite.play(key);
    if (vx) sprite.setFlipX(vx < 0);
  }

  // ---------------------------------------------------------------- effects
  /** A small puff of dust at the hero's feet (running, landing, jumping). */
  function dust(scene, x, y, count = 1, seedRng) {
    const r = seedRng || (scene.__kitRng ??= rng('dust'));
    for (let i = 0; i < count; i++) {
      const s = r.int(2, 3) * 2;
      const d = scene.add.rectangle(x + r.int(-8, 8), y - r.int(0, 3), s, s, hex(PALETTE.groundLight), 0.55).setDepth(5);
      scene.tweens.add({ targets: d, y: d.y - r.int(4, 9), x: d.x + r.int(-6, 6), alpha: 0, duration: 320, onComplete: () => d.destroy() });
    }
  }

  /** Death: coral pieces fly out and a small skull rises. Short (≈0.5 s), no flash, no shake. */
  function burst(scene, x, y) {
    pixels(scene, 'kit-skull', ['.wwww.', 'wwwwww', 'wpwwpw', 'wwwwww', '.wppw.', '.w.ww.'], { w: PALETTE.text, p: PALETTE.ink });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bit = scene.add.rectangle(x, y, 6, 6, hex(i % 2 ? PALETTE.hero : PALETTE.heroLight)).setDepth(20);
      scene.tweens.add({ targets: bit, x: x + Math.cos(a) * 30, y: y + Math.sin(a) * 30, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => bit.destroy() });
    }
    const skull = scene.add.image(x, y - 4, 'kit-skull').setDepth(21);
    scene.tweens.add({ targets: skull, y: y - 26, alpha: 0, duration: 600, ease: 'Sine.easeOut', onComplete: () => skull.destroy() });
  }

  /** Gold sparkles (reaching a goal, a lever pulled). */
  function sparkle(scene, x, y) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const s = scene.add.rectangle(x, y, 4, 4, hex(i % 2 ? PALETTE.gold : PALETTE.goldLight)).setDepth(20);
      scene.tweens.add({ targets: s, x: x + Math.cos(a) * 36, y: y + Math.sin(a) * 36, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => s.destroy() });
    }
  }

  // ---------------------------------------------------------------- HUD
  const HUD_H = 28;
  const FONT = { fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold' };

  /** A drawn key cap ("SPACE", "←", "E"…) with its label, fixed to the screen. Returns its width. */
  function keyCap(scene, x, y, label) {
    const t = scene.add.text(0, 0, label, { ...FONT, color: PALETTE.ink }).setScrollFactor(0).setDepth(101);
    const w = Math.max(20, Math.ceil(t.width) + 10);
    const g = scene.add.graphics().setScrollFactor(0).setDepth(100);
    g.fillStyle(hex(PALETTE.capSide));
    g.fillRoundedRect(x, y, w, 21, 4);
    g.fillStyle(hex(PALETTE.capFace));
    g.fillRoundedRect(x, y, w, 18, 4);
    t.setPosition(x + Math.round((w - t.width) / 2), y);
    return w;
  }

  /**
   * The top bar: "Deaths: N" on the left (if deaths is not false) and the controls on the right, with the
   * same words as before but the keys drawn as caps. parts: [{ keys: ['←', '→'], label: 'move' }, { label: 'Reach the flag' }].
   * left: the text on the left ('Deaths: 0' unless deaths is false). Returns { setDeaths(n), setLeft(text, color), banner(text) }.
   */
  function hud(scene, parts, { deaths = true, left = deaths ? 'Deaths: 0' : false, leftColor = PALETTE.deaths } = {}) {
    const W = scene.scale.width;
    scene.add.rectangle(W / 2, HUD_H / 2, W, HUD_H, hex(PALETTE.hudBack), 0.85).setScrollFactor(0).setDepth(99);
    // Measure, then lay out right-aligned.
    const GAP = 18;
    const measure = (s) => {
      const t = scene.add.text(0, 0, s, FONT);
      const w = t.width;
      t.destroy();
      return w;
    };
    const widths = parts.map((p) => (p.keys || []).reduce((a, k) => a + Math.max(20, Math.ceil(measure(k)) + 10) + 4, 0) + (p.label ? measure(p.label) + (p.keys ? 4 : 0) : 0));
    let x = W - 10 - widths.reduce((a, b) => a + b, 0) - GAP * (parts.length - 1);
    parts.forEach((p, i) => {
      const x0 = x;
      for (const k of p.keys || []) x += keyCap(scene, x, 4, k) + 4;
      if (p.label) scene.add.text(x + (p.keys ? 4 : 0), 5, p.label, { ...FONT, color: PALETTE.text }).setScrollFactor(0).setDepth(101);
      x = x0 + widths[i] + GAP;
    });
    const deathText = left ? scene.add.text(10, 5, left, { ...FONT, color: leftColor }).setScrollFactor(0).setDepth(101) : null;
    const bannerText = scene.add
      .text(W / 2, scene.scale.height / 2 - 40, '', { fontFamily: 'monospace', fontSize: '28px', fontStyle: 'bold', color: PALETTE.gold, stroke: PALETTE.hudBack, strokeThickness: 6 })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102);
    return {
      setDeaths: (n) => deathText && deathText.setText('Deaths: ' + n),
      setLeft: (text, color) => {
        if (!deathText) return;
        deathText.setText(text);
        if (color) deathText.setColor(color);
      },
      banner: (text) => bannerText.setText(text),
    };
  }

  // ---------------------------------------------------------------- backdrop
  /**
   * Night sky with seeded stars and two layers of hills that scroll slower than the level (parallax).
   * Everything stays below 1.5:1 against the sky. horizonY: where the hills stand (usually the ground).
   */
  function backdrop(scene, { seed, worldW, horizonY, hills = true }) {
    const W = scene.scale.width;
    const H = scene.scale.height;
    const r = rng(seed + ':sky');
    const g = scene.add.graphics().setDepth(-30);
    g.fillStyle(hex(PALETTE.deco));
    const starsW = W + (worldW - W) * 0.1;
    for (let i = 0; i < Math.round(starsW / 14); i++) {
      const s = r() < 0.8 ? 2 : 4;
      g.fillRect(r.int(0, starsW), r.int(HUD_H + 4, horizonY - 90), s, s);
    }
    g.setScrollFactor(0.1, 1);
    if (!hills) return;
    const layer = (color, factor, base, amp, step, depth) => {
      const lw = W + (worldW - W) * factor + step;
      const hg = scene.add.graphics().setDepth(depth).setScrollFactor(factor, 1);
      hg.fillStyle(hex(color));
      // Rounded hills from stacked 4 px steps (pixel look, no smooth curve that could read as a slope to stand on).
      let x = 0;
      while (x < lw) {
        const w = r.int(step, step * 2);
        const h = r.int(amp / 2, amp);
        for (let k = 0; k < w; k += 4) {
          const u = k / w;
          const hh = Math.round((Math.sin(u * Math.PI) * h) / 4) * 4;
          hg.fillRect(x + k, base - hh, 4, H - base + hh);
        }
        x += w;
      }
    };
    layer(PALETTE.skyFar, 0.25, horizonY - 40, 70, 90, -25);
    layer(PALETTE.skyMid, 0.5, horizonY - 10, 50, 70, -20);
  }

  // ---------------------------------------------------------------- tiles
  /** Teal ground tiles (32×32): 'kit-ground-top' with the light walkable edge, 'kit-ground' for the fill. */
  function groundTextures(scene) {
    const colors = { L: PALETTE.groundLight, g: PALETTE.ground, d: PALETTE.groundDark, D: PALETTE.groundDeep };
    pixels(
      scene,
      'kit-ground-top',
      [
        'LLLLLLLLLLLLLLLL',
        'LLLLLLLLLLLLLLLL',
        'LLLLLLLLLLLLLLLL',
        'gggggggdgggggggd',
        'gggggggdgggggggd',
        'gggggggdgggggggd',
        'dddddddddddddddd',
        'gggdgggggggdgggg',
        'gggdgggggggdgggg',
        'gggdgggggggdgggg',
        'gggdgggggggdgggg',
        'dddddddddddddddd',
        'gggggggdgggggggd',
        'gggggggdgggggggd',
        'gggggggdgggggggd',
        'dddddddddddddddd',
      ],
      colors,
    );
    pixels(
      scene,
      'kit-ground',
      [
        'gggdgggggggdgggg',
        'gggdgggggggdgggg',
        'gggdgggggggdgggg',
        'dddddddddddddddd',
        'gggggggdgggggggd',
        'gggggggdgggggggd',
        'gggggggdgggggggd',
        'dddddddddddddddd',
        'gggdgggggggdgggg',
        'gggdgggggggdgggg',
        'gggdgggggggdgggg',
        'dddddddddddddddd',
        'gggggggdgggggggd',
        'gggggggdgggggggd',
        'gggggggdgggggggd',
        'dddddddddddddddd',
      ],
      { g: PALETTE.groundDark, d: PALETTE.groundDeep },
    );
  }

  /**
   * Draws a block of ground (x, y, w, h in px, top-left) with tiles and a darker side where it ends,
   * so every edge reads clearly. Purely visual: add the collision body yourself.
   */
  function groundBlock(scene, x, y, w, h, { left = true, right = true } = {}) {
    groundTextures(scene);
    scene.add.tileSprite(x, y, w, Math.min(32, h), 'kit-ground-top').setOrigin(0, 0).setDepth(-5);
    if (h > 32) scene.add.tileSprite(x, y + 32, w, h - 32, 'kit-ground').setOrigin(0, 0).setDepth(-5);
    const g = scene.add.graphics().setDepth(-4);
    g.fillStyle(hex(PALETTE.groundDeep));
    if (left) g.fillRect(x, y + 6, 4, h - 6);
    if (right) g.fillRect(x + w - 4, y + 6, 4, h - 6);
    g.fillStyle(hex(PALETTE.white), 0.9);
    if (left) g.fillRect(x, y, 4, 2);
    if (right) g.fillRect(x + w - 4, y, 4, 2);
  }

  /** A row of red spikes (16 px wide each, 16 px tall) standing on y, from x over width w. */
  function spikes(scene, x, y, w) {
    pixels(scene, 'kit-spike', ['...wR...', '...rR...', '..rrRR..', '..rrRR..', '.rrrRRR.', '.rrrRRR.', 'rrrrRRRR', 'RRRRRRRR'], { w: '#ffc2cc', r: PALETTE.red, R: PALETTE.redDark });
    return scene.add.tileSprite(x, y - 16, w, 16, 'kit-spike').setOrigin(0, 0).setDepth(-3);
  }

  /** The goal flag (32×60 like before): gold cloth that waves at 200 ms per frame on a light pole. */
  function flagTextures(scene) {
    const pole = 'P';
    const rows = (cloth) => {
      const out = [];
      for (let y = 0; y < 30; y++) out.push(pole + (cloth[y] || ''));
      return out;
    };
    const wave = [
      ['GGGGGGGG', 'GgGGGGGGGGG', 'GgggGGGGGGGGGG', 'GgggggGGGGGGGGG', 'GgggggggGGGGGG', 'GggggggGGGGG', 'GgggGGGGG', 'GGGGG'],
      ['GGGGGGG', 'GgGGGGGGGGGG', 'GgggGGGGGGGGGGG', 'GgggggGGGGGGGG', 'GgggggggGGGGG', 'GggggggGGGGGG', 'GgggGGGGGG', 'GGGG'],
      ['GGGGGGGGG', 'GgGGGGGGGG', 'GgggGGGGGGGGG', 'GgggggGGGGGGGGGG', 'GgggggggGGGGGGG', 'GggggggGGGG', 'GgggGGGG', 'GGGGGG'],
    ];
    const frames = wave.map((cloth) => {
      const c = ['', ...cloth];
      const r = rows(c.map((s) => s.slice(0, 15)));
      r[0] = 'Ww';
      return r;
    });
    pixels(scene, 'kit-flag', frames, { P: PALETTE.text, W: PALETTE.goldLight, w: PALETTE.goldLight, G: PALETTE.gold, g: PALETTE.goldDark });
    if (!scene.anims.exists('kit-flag-wave')) scene.anims.create({ key: 'kit-flag-wave', frames: [0, 1, 2, 1].map((frame) => ({ key: 'kit-flag', frame })), frameRate: 5, repeat: -1 });
    return 'kit-flag';
  }


  /**
   * A solid block (walls, lintels) with brick tiles and the light 6 px edge on the side the player sees
   * (edge: 'top' | 'bottom' | 'left' | 'right' | null). Purely visual.
   */
  function solidBlock(scene, x, y, w, h, edge = 'top', depth = -5) {
    groundTextures(scene);
    scene.add.tileSprite(x, y, w, h, 'kit-ground').setOrigin(0, 0).setDepth(depth);
    const g = scene.add.graphics().setDepth(depth);
    g.fillStyle(hex(PALETTE.ground));
    g.fillRect(x, y, w, 2);
    g.fillRect(x, y + h - 2, w, 2);
    g.fillRect(x, y, 2, h);
    g.fillRect(x + w - 2, y, 2, h);
    const e = { top: [x, y, w, 6], bottom: [x, y + h - 6, w, 6], left: [x, y, 6, h], right: [x + w - 6, y, 6, h] }[edge];
    if (e) {
      g.fillStyle(hex(PALETTE.groundLight));
      g.fillRect(e[0], e[1], e[2], e[3]);
    }
  }

  /** The back wall of an indoor room: dark bricks, 1.1:1 against the sky (pure scenery). */
  function bricks(scene, x, y, w, h) {
    pixels(
      scene,
      'kit-bricks',
      ['mmmmmmmmmmmmmmmm', '.......m........', '.......m........', '.......m........', 'mmmmmmmmmmmmmmmm', 'm...............', 'm...............', 'm...............'],
      { m: PALETTE.skyMid },
    );
    scene.add.tileSprite(x, y, w, h, 'kit-bricks').setOrigin(0, 0).setDepth(-30);
  }

  // ---------------------------------------------------------------- top-down games (a dungeon)
  const TD_BODY = ['..oooooo..', '.ollcccco.', 'olccccwwco', 'olcccwwpco', 'occccwwpco', 'occcccccco', 'odccccccdo', '.oddddddo.'];
  const TD_FRAMES = [
    [...TD_BODY, '..ff..ff..', '..ff..ff..'], // 0 idle
    [...TD_BODY.map((r, i) => (i === 3 ? 'olcccoooco' : i === 4 ? 'occcccccco' : r)), '..ff..ff..', '..ff..ff..'], // 1 blink
    [...TD_BODY, '.ff....ff.', '.f......f.'], // 2 walk
    [...TD_BODY, '...ffff...', '...ff.....'], // 3
    [...TD_BODY, '.ff....ff.', '.ff......f'], // 4
    [...TD_BODY, '...ffff...', '.....ff...'], // 5
  ];

  /** The hero seen from above (20×20 frames) as texture 'hero-td', with 'hero-idle' / 'hero-run' animations. */
  function heroTopDown(scene) {
    pixels(scene, 'hero-td', TD_FRAMES, HERO_COLORS);
    const anim = (key, frames) => {
      if (!scene.anims.exists(key)) scene.anims.create({ key, frames: frames.map((frame) => ({ key: 'hero-td', frame })), frameRate: 10, repeat: -1 });
    };
    anim('hero-idle', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]);
    anim('hero-run', [2, 3, 4, 5]);
    return 'hero-td';
  }

  /** A gold silhouette of the side-view hero, for dash trails: texture 'hero-trail' (frame 0). */
  function heroTrail(scene) {
    const gold = { o: PALETTE.goldDark, c: PALETTE.gold, l: PALETTE.goldLight, d: PALETTE.goldDark, w: PALETTE.goldLight, p: PALETTE.goldDark, b: PALETTE.gold, f: PALETTE.goldDark };
    return pixels(scene, 'hero-trail', [HERO_FRAMES[2]], gold);
  }

  /** Dungeon floor: faint stamped stones, 1.06:1 against the sky. Fills (x, y, w, h). */
  function dungeonFloor(scene, x, y, w, h) {
    pixels(
      scene,
      'kit-floor',
      [
        's.......s.......',
        '................',
        '................',
        '................',
        '.......ss.......',
        '.......ss.......',
        '................',
        '................',
        's.......s.......',
        '................',
        '................',
        '................',
        '...........s....',
        '................',
        '................',
        '................',
      ],
      { s: PALETTE.floorStamp },
    );
    scene.add.tileSprite(x, y, w, h, 'kit-floor').setOrigin(0, 0).setDepth(-30);
  }

  /** A spike tile seen from above (32×32): dark red plate with four red spikes. Texture 'kit-spike-td'. */
  function spikeTile(scene) {
    return pixels(
      scene,
      'kit-spike-td',
      [
        'PPPPPPPPPPPPPPPP',
        'P..............P',
        'P..w.......w...P',
        'P..r.......r...P',
        'P.rrR.....rrR..P',
        'P.rrR.....rrR..P',
        'PrrrRR...rrrRR.P',
        'P..............P',
        'P..............P',
        'P..w.......w...P',
        'P..r.......r...P',
        'P.rrR.....rrR..P',
        'P.rrR.....rrR..P',
        'PrrrRR...rrrRR.P',
        'P..............P',
        'PPPPPPPPPPPPPPPP',
      ],
      { P: PALETTE.redDark, '.': PALETTE.pit, w: '#ffc2cc', r: PALETTE.red, R: PALETTE.redDark },
    );
  }

  /** A gold stairway going down (the exit), size × size px. Texture 'kit-exit-<size>'. */
  function exitTile(scene, size) {
    const n = size / 2;
    const rows = [];
    for (let y = 0; y < n; y++) {
      let r = '';
      for (let x = 0; x < n; x++) {
        const edge = x === 0 || y === 0 || x === n - 1 || y === n - 1;
        const step = Math.max(0, Math.min(3, Math.floor(((y - 1) / (n - 2)) * 4))); // four steps, darker going down
        const inset = 1 + step;
        r += edge ? 'L' : x < inset || x >= n - inset ? 'G' : ['g', 'd', 'D', 'k'][step];
      }
      rows.push(r);
    }
    return pixels(scene, 'kit-exit-' + size, rows, { L: PALETTE.goldLight, G: PALETTE.gold, g: PALETTE.goldDark, d: '#7a5e12', D: '#3d3009', k: PALETTE.ink });
  }

  window.GhostKit = {
    PALETTE,
    hex,
    contrast,
    rng,
    pixels,
    heroTextures,
    animateHero,
    dust,
    burst,
    sparkle,
    hud,
    HUD_H,
    keyCap,
    backdrop,
    groundTextures,
    groundBlock,
    spikes,
    flagTextures,
    solidBlock,
    bricks,
    heroTopDown,
    heroTrail,
    dungeonFloor,
    spikeTile,
    exitTile,
  };
})();
