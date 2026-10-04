/* MAZE RECALL — braided mazes: MANY routes exist from start to finish,
   but only ONE target path is shown during memorize. The player must
   reproduce exactly that path — any other valid route is a wrong turn. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Wall bitmask per cell: N=1, E=2, S=4, W=8
function genMaze(cols, rows, rng) {
  const walls = new Uint8Array(cols * rows).fill(15);
  const visited = new Uint8Array(cols * rows);
  const stack = [0];
  visited[0] = 1;
  const DIRS = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]]; // dx dy wallSelf wallNeighbor
  while (stack.length) {
    const c = stack[stack.length - 1];
    const cx = c % cols, cy = (c / cols) | 0;
    const opts = [];
    for (const [dx, dy, w1, w2] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const n = ny * cols + nx;
      if (!visited[n]) opts.push([n, w1, w2]);
    }
    if (!opts.length) { stack.pop(); continue; }
    const [n, w1, w2] = opts[(rng() * opts.length) | 0];
    walls[c] &= ~w1; walls[n] &= ~w2;
    visited[n] = 1;
    stack.push(n);
  }
  return walls;
}

// Braid: knock down `extra` internal walls -> loops -> many possible routes
function braidMaze(cols, rows, walls, rng, extra) {
  const openings = [];
  for (let c = 0; c < cols * rows; c++) {
    const x = c % cols, y = (c / cols) | 0;
    if (x + 1 < cols && (walls[c] & 2)) openings.push([c, c + 1, 2, 8]);
    if (y + 1 < rows && (walls[c] & 4)) openings.push([c, c + cols, 4, 1]);
  }
  for (let i = openings.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = openings[i]; openings[i] = openings[j]; openings[j] = t;
  }
  for (let i = 0; i < Math.min(extra, openings.length); i++) {
    const [a, b, w1, w2] = openings[i];
    walls[a] &= ~w1; walls[b] &= ~w2;
  }
}

// Random WINDING path from cell 0 to last cell (randomized DFS, stops at goal).
// Deliberately not the shortest route — it wanders, so it must be memorized.
function randomPath(cols, rows, walls, rng) {
  const goal = cols * rows - 1;
  const prev = new Int32Array(cols * rows).fill(-1);
  const seen = new Uint8Array(cols * rows);
  const stack = [0]; seen[0] = 1;
  const DIRS = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];
  while (stack.length) {
    const c = stack[stack.length - 1];
    if (c === goal) break;
    const x = c % cols, y = (c / cols) | 0;
    const opts = [];
    for (const [dx, dy, w] of DIRS) {
      if (walls[c] & w) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const n = ny * cols + nx;
      if (seen[n]) continue;
      opts.push(n);
    }
    if (!opts.length) { stack.pop(); continue; }
    const n = opts[(rng() * opts.length) | 0];
    seen[n] = 1; prev[n] = c; stack.push(n);
  }
  const path = [];
  let c = goal;
  while (c !== -1) { path.push(c); c = prev[c]; }
  path.reverse();
  return path;
}

// Count simple routes start->goal, stopping early at `cap`
function countRoutes(cols, rows, walls, cap) {
  const goal = cols * rows - 1;
  const seen = new Uint8Array(cols * rows); seen[0] = 1;
  let count = 0;
  const D = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];
  (function dfs(c) {
    if (count >= cap) return;
    if (c === goal) { count++; return; }
    const x = c % cols, y = (c / cols) | 0;
    for (const [dx, dy, w] of D) {
      if (walls[c] & w) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const n = ny * cols + nx;
      if (seen[n]) continue;
      seen[n] = 1; dfs(n); seen[n] = 0;
    }
  })(0);
  return count;
}

// Does the target path have at least one OPEN branch off the path?
// (guarantees real decoy routes the player can accidentally take)
function hasDecoyBranch(cols, rows, walls, path) {
  const onPath = new Set(path);
  for (const c of path) {
    const x = c % cols, y = (c / cols) | 0;
    const DIRS = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];
    for (const [dx, dy, w] of DIRS) {
      if (walls[c] & w) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const n = ny * cols + nx;
      if (!onPath.has(n)) return true;
    }
  }
  return false;
}
