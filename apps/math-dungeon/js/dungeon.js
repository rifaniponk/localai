/* Math Dungeon — dungeon themes, room templates, enemy roster, procedural assembly. */
(function (root) {
  'use strict';
  const MD = (root.MD = root.MD || {});

  MD.TS = 40; // tile size (world px)
  MD.RW = 26; MD.RH = 16; // room grid size

  // ---------- themes (all colors procedural, no art) ----------
  MD.THEMES = [
    { name: 'Forgotten Cellar', wall: '#3a3f52', wallTop: '#4a5068', floor: '#23283a', floorAlt: '#262c40', accent: '#8fb4ff', deco: 'barrel', particle: 'dust', torch: '#ffb45c' },
    { name: 'Goblin Mine', wall: '#4a3b2a', wallTop: '#5d4a33', floor: '#2c2418', floorAlt: '#31291c', accent: '#7ee2a0', deco: 'ore', particle: 'ember', torch: '#ff9a3c' },
    { name: 'Ancient Temple', wall: '#5a5340', wallTop: '#6d654e', floor: '#39352a', floorAlt: '#3e3a2e', accent: '#ffd35c', deco: 'statue', particle: 'mote', torch: '#ffd35c' },
    { name: 'Frozen Cavern', wall: '#33505e', wallTop: '#40606f', floor: '#1e3140', floorAlt: '#223748', accent: '#9fe8ff', deco: 'crystal', particle: 'snow', torch: '#7fd4ff' },
    { name: 'Wizard Tower', wall: '#3d2f55', wallTop: '#4c3b68', floor: '#251d38', floorAlt: '#2a2140', accent: '#c79fff', deco: 'book', particle: 'spark', torch: '#c79fff' },
    { name: 'Dragon Keep', wall: '#552f2f', wallTop: '#684040', floor: '#331d1d', floorAlt: '#3a2222', accent: '#ff8a5c', deco: 'skull', particle: 'ember', torch: '#ff6a3c' }
  ];

  // ---------- enemies ----------
  MD.ENEMIES = [
    { id: 'slime', name: 'Slime', hp: 20, atk: 6, color: '#6fd06f', dark: '#3f8f3f', shape: 'slime', tier: 1 },
    { id: 'bat', name: 'Cave Bat', hp: 24, atk: 7, color: '#9a7fd4', dark: '#5f4a8f', shape: 'bat', tier: 1 },
    { id: 'spider', name: 'Fuzzy Spider', hp: 30, atk: 8, color: '#7a6a5a', dark: '#4a3f33', shape: 'spider', tier: 2 },
    { id: 'goblin', name: 'Goblin', hp: 36, atk: 9, color: '#5fae5f', dark: '#37703a', shape: 'goblin', tier: 2 },
    { id: 'skeleton', name: 'Skeleton', hp: 42, atk: 10, color: '#d8d8c8', dark: '#8f8f7f', shape: 'skeleton', tier: 3 },
    { id: 'ghost', name: 'Lantern Ghost', hp: 46, atk: 11, color: '#a8c8e8', dark: '#6a8aa8', shape: 'ghost', tier: 3 },
    { id: 'orc', name: 'Orc Brute', hp: 55, atk: 12, color: '#8a9a4a', dark: '#5a6a2f', shape: 'orc', tier: 4 },
    { id: 'mage', name: 'Dark Mage', hp: 50, atk: 13, color: '#7a5aa8', dark: '#4a3468', shape: 'mage', tier: 4 }
  ];
  MD.BOSSES = [
    { id: 'skeletonking', name: 'Skeleton King', hp: 100, atk: 10, color: '#e8e8d8', dark: '#9a9a88', shape: 'boss_skull', crown: '#ffd35c' },
    { id: 'golem', name: 'Stone Golem', hp: 130, atk: 11, color: '#8a8a9a', dark: '#5a5a6a', shape: 'boss_golem' },
    { id: 'darkwizard', name: 'Dark Wizard', hp: 150, atk: 12, color: '#5a3a8a', dark: '#38245a', shape: 'boss_wizard' },
    { id: 'frosttroll', name: 'Frost Troll', hp: 170, atk: 13, color: '#7ab8d8', dark: '#4a7a9a', shape: 'boss_golem' },
    { id: 'archmage', name: 'Archmage Vex', hp: 190, atk: 14, color: '#8a5ad4', dark: '#563a85', shape: 'boss_wizard' },
    { id: 'dragon', name: 'Dungeon Dragon', hp: 220, atk: 15, color: '#d45a3a', dark: '#8f3a24', shape: 'boss_dragon' }
  ];

  // ---------- dungeon definitions ----------
  MD.DUNGEONS = [
    { name: 'Forgotten Cellar', rooms: 9, enemies: ['slime', 'bat'], elite: 'spider', handcrafted: true },
    { name: 'Goblin Mine', rooms: 9, enemies: ['goblin', 'bat', 'slime'], elite: 'skeleton' },
    { name: 'Ancient Temple', rooms: 10, enemies: ['skeleton', 'spider', 'ghost'], elite: 'orc' },
    { name: 'Frozen Cavern', rooms: 10, enemies: ['ghost', 'orc', 'bat'], elite: 'mage' },
    { name: 'Wizard Tower', rooms: 11, enemies: ['mage', 'skeleton', 'ghost'], elite: 'orc' },
    { name: 'Dragon Keep', rooms: 12, enemies: ['orc', 'mage', 'skeleton', 'spider'], elite: 'ghost' }
  ];

  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];

  // ---------- room assembly ----------
  // tiles: 0 floor, 1 wall. Doors carved at left/right mid.
  function blankRoom() {
    const t = [];
    for (let y = 0; y < MD.RH; y++) {
      const row = [];
      for (let x = 0; x < MD.RW; x++) row.push(x === 0 || y === 0 || x === MD.RW - 1 || y === MD.RH - 1 ? 1 : 0);
      t.push(row);
    }
    return t;
  }
  const INTERIORS = [
    // pillars grid
    t => { for (const [x, y] of [[6, 4], [6, 11], [19, 4], [19, 11], [12, 7], [13, 7], [12, 8], [13, 8]]) t[y][x] = 1; },
    // two side alcoves
    t => { for (let y = 3; y <= 6; y++) { t[y][4] = 1; t[y][MD.RW - 5] = 1; } for (let y = 9; y <= 12; y++) { t[y][4] = 1; t[y][MD.RW - 5] = 1; } },
    // cross corridor walls
    t => { for (let x = 5; x <= 9; x++) { t[5][x] = 1; t[10][x] = 1; } for (let x = 16; x <= 20; x++) { t[5][x] = 1; t[10][x] = 1; } },
    // diagonal steps
    t => { for (let i = 0; i < 4; i++) { t[4 + i][7 + i] = 1; t[11 - i][18 - i] = 1; } },
    // center ring (open top/bottom)
    t => { for (let x = 10; x <= 15; x++) { t[4][x] = 1; t[11][x] = 1; } for (let y = 5; y <= 10; y++) { t[y][10] = 1; t[y][15] = 1; } t[4][12] = 0; t[4][13] = 0; t[11][12] = 0; t[11][13] = 0; },
    // sparse rubble
    t => { for (let i = 0; i < 7; i++) { const x = ri(4, MD.RW - 5), y = ri(3, MD.RH - 4); t[y][x] = 1; } }
  ];

  function carveDoors(t) {
    const my = Math.floor(MD.RH / 2);
    t[my][0] = 0; t[my][MD.RW - 1] = 0;
    return my;
  }

  // ensure spawn->exit walkable via BFS; retry interior if blocked
  function buildTiles() {
    for (let attempt = 0; attempt < 12; attempt++) {
      const t = blankRoom();
      const my = carveDoors(t);
      INTERIORS[Math.floor(Math.random() * INTERIORS.length)](t);
      t[my][0] = 0; t[my][MD.RW - 1] = 0;
      if (walkable(t, 2, my, MD.RW - 3, my)) return { t, my };
    }
    const t = blankRoom(); const my = carveDoors(t);
    return { t, my };
  }
  function walkable(t, x0, y0, x1, y1) {
    const seen = new Set([x0 + ',' + y0]); const q = [[x0, y0]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === x1 && y === y1) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MD.RW || ny >= MD.RH) continue;
        const k = nx + ',' + ny;
        if (t[ny][nx] === 1 || seen.has(k)) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return false;
  }

  function enemyFor(def, dungeonIdx, elite) {
    const pool = elite ? [def.elite] : def.enemies;
    const e = MD.ENEMIES.find(x => x.id === pick(pool)) || MD.ENEMIES[0];
    const scale = 1 + dungeonIdx * 0.12;
    return { id: e.id, name: e.name, hp: Math.round(e.hp * scale), maxHp: Math.round(e.hp * scale), atk: Math.round(e.atk * scale), color: e.color, dark: e.dark, shape: e.shape, elite: !!elite };
  }

  // handcrafted first dungeon sequence (spec #50)
  const HAND = ['start', 'treasure', 'puzzle', 'monster', 'healing', 'monster', 'monster', 'treasure', 'boss'];

  function roomSequence(def, dungeonIdx) {
    if (def.handcrafted) return HAND.slice();
    const n = def.rooms;
    const seq = ['start'];
    const mid = n - 2; // rooms between start and boss
    const bag = [];
    const counts = { monster: Math.max(2, Math.round(mid * 0.45)), treasure: Math.max(1, Math.round(mid * 0.2)), puzzle: Math.max(1, Math.round(mid * 0.18)), healing: Math.max(1, Math.round(mid * 0.15)) };
    for (const k in counts) for (let i = 0; i < counts[k]; i++) bag.push(k);
    while (bag.length < mid) bag.push('monster');
    // shuffle bag but avoid 3 healing in a row etc. (simple shuffle is fine)
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp; }
    // sprinkle one elite monster in the second half
    for (let i = 0; i < bag.length; i++) if (bag[i] === 'monster' && i > mid / 2 && Math.random() < 0.3) { bag[i] = 'elite'; break; }
    return seq.concat(bag.slice(0, mid), ['boss']);
  }

  // Build one room object: {type, tiles, doorY, objects[], spawn{x,y}, exit{x,y}, cleared}
  function buildRoom(type, def, dungeonIdx, roomIdx, totalRooms) {
    const { t, my } = buildTiles();
    const TS = MD.TS;
    const room = {
      type, tiles: t, doorY: my, objects: [], decorations: [],
      spawn: { x: 2.5 * TS, y: (my + 0.5) * TS },
      exit: { x: (MD.RW - 1.5) * TS, y: (my + 0.5) * TS },
      cleared: type === 'start' || type === 'healing'
    };
    // torches on walls
    for (let x = 3; x < MD.RW - 2; x += 5) { room.decorations.push({ k: 'torch', x: x * TS + TS / 2, y: TS }); room.decorations.push({ k: 'torch', x: x * TS + TS / 2, y: (MD.RH - 1) * TS + TS / 2 }); }
    // deco props
    const theme = MD.THEMES[dungeonIdx % MD.THEMES.length];
    for (let i = 0; i < 5; i++) {
      const x = ri(2, MD.RW - 3), y = ri(2, MD.RH - 3);
      if (t[y][x] === 1) room.decorations.push({ k: theme.deco, x: x * TS + TS / 2, y: y * TS + TS / 2 - 6 });
    }

    const freeSpot = () => {
      for (let i = 0; i < 60; i++) {
        const x = ri(4, MD.RW - 5), y = ri(3, MD.RH - 4);
        if (t[y][x] === 0) return { x: (x + 0.5) * TS, y: (y + 0.5) * TS };
      }
      return { x: (MD.RW / 2) * TS, y: (MD.RH / 2) * TS };
    };

    if (type === 'monster' || type === 'elite') {
      const e = enemyFor(def, dungeonIdx, type === 'elite');
      if (type === 'elite') { e.name = 'Elite ' + e.name; e.hp = Math.round(e.hp * 1.6); e.maxHp = e.hp; e.atk = Math.round(e.atk * 1.3); }
      const p = freeSpot();
      room.objects.push({ kind: 'enemy', enemy: e, x: p.x, y: p.y, r: 26 });
    } else if (type === 'treasure') {
      const p = freeSpot();
      const locked = Math.random() < 0.6;
      room.objects.push({ kind: 'chest', x: p.x, y: p.y, r: 24, locked, opened: false, big: locked });
      if (Math.random() < 0.5) { const p2 = freeSpot(); room.objects.push({ kind: 'coins', x: p2.x, y: p2.y, r: 16, taken: false }); }
      room.cleared = false; // chest must be opened
    } else if (type === 'puzzle') {
      const p = freeSpot();
      room.objects.push({ kind: 'stone', x: p.x, y: p.y, r: 26, solved: false });
    } else if (type === 'healing') {
      room.objects.push({ kind: 'fountain', x: (MD.RW / 2) * TS, y: (MD.RH / 2) * TS, r: 26, used: false });
    } else if (type === 'boss') {
      room.objects.push({ kind: 'boss', enemy: Object.assign({}, MD.BOSSES[dungeonIdx % MD.BOSSES.length]), x: (MD.RW - 6) * TS, y: (MD.RH / 2) * TS, r: 40 });
    } else if (type === 'start') {
      // a couple of coins to discover
      const p = freeSpot();
      room.objects.push({ kind: 'coins', x: p.x, y: p.y, r: 16, taken: false });
    }
    return room;
  }

  MD.DungeonGen = { buildRoom, roomSequence, enemyFor };
})(window);
