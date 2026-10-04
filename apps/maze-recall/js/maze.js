/* MAZE RECALL — maze generation (recursive backtracker) + BFS solve.
   A perfect maze has exactly ONE path between any two cells,
   so the BFS solution IS the only valid trace. */
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

// BFS shortest path from cell 0 (top-left) to last cell (bottom-right)
function solveMaze(cols, rows, walls) {
  const goal = cols * rows - 1;
  const prev = new Int32Array(cols * rows).fill(-1);
  const seen = new Uint8Array(cols * rows);
  const q = [0]; seen[0] = 1;
  const DIRS = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];
  for (let i = 0; i < q.length; i++) {
    const c = q[i];
    if (c === goal) break;
    const cx = c % cols, cy = (c / cols) | 0;
    for (const [dx, dy, w] of DIRS) {
      if (walls[c] & w) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const n = ny * cols + nx;
      if (seen[n]) continue;
      seen[n] = 1; prev[n] = c; q.push(n);
    }
  }
  const path = [];
  let c = goal;
  while (c !== -1) { path.push(c); c = prev[c]; }
  path.reverse();
  return path;
}
