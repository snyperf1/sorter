const mazeRefs = {
  statusText: document.getElementById('mazeStatusText'),
  metricsText: document.getElementById('mazeMetricsText'),
  runMeta: document.getElementById('mazeRunMeta'),
  infoText: document.getElementById('mazeInfoText'),
  algoSelect: document.getElementById('pathAlgoSelect'),
  sizeInput: document.getElementById('mazeSizeInput'),
  sizeValue: document.getElementById('mazeSizeValue'),
  speedInput: document.getElementById('mazeSpeedInput'),
  speedValue: document.getElementById('mazeSpeedValue'),
  generateBtn: document.getElementById('mazeGenerateBtn'),
  randomWallsBtn: document.getElementById('mazeRandomWallsBtn'),
  clearWallsBtn: document.getElementById('mazeClearWallsBtn'),
  resetSearchBtn: document.getElementById('mazeResetSearchBtn'),
  solveBtn: document.getElementById('mazeSolveBtn'),
  playPauseBtn: document.getElementById('mazePlayPauseBtn'),
  stepBtn: document.getElementById('mazeStepBtn'),
  clearTraceBtn: document.getElementById('mazeClearTraceBtn'),
  modeWallBtn: document.getElementById('modeWallBtn'),
  modeEraseBtn: document.getElementById('modeEraseBtn'),
  modeStartBtn: document.getElementById('modeStartBtn'),
  modeGoalBtn: document.getElementById('modeGoalBtn'),
  errorBox: document.getElementById('mazeErrorBox'),
  canvas: document.getElementById('mazeCanvas'),
};

const MAZE_COLORS = {
  backgroundTop: 'rgba(8, 10, 15, 0.96)',
  backgroundBottom: 'rgba(4, 5, 8, 0.98)',
  gridLine: 'rgba(255,255,255,0.03)',
  open: 'rgba(10, 14, 20, 0.95)',
  wall: 'rgba(166, 171, 180, 0.16)',
  frontier: 'rgba(19, 216, 255, 0.55)',
  visited: 'rgba(107, 193, 255, 0.35)',
  path: 'rgba(245, 230, 26, 0.75)',
  start: 'rgba(59, 240, 127, 0.95)',
  goal: 'rgba(255, 75, 120, 0.95)',
  current: 'rgba(162, 139, 255, 0.9)',
};

const mazeState = {
  rows: 25,
  cols: 25,
  walls: new Set(),
  start: { r: 1, c: 1 },
  goal: { r: 23, c: 23 },
  frontier: new Set(),
  visited: new Set(),
  path: new Set(),
  current: null,
  trace: [],
  traceIndex: 0,
  playing: false,
  accumulator: 0,
  lastFrameTs: performance.now(),
  canvasSize: { width: 0, height: 0, dpr: 1 },
  layout: { cell: 16, originX: 0, originY: 0, gridPx: 0 },
  editMode: 'wall',
  dragging: false,
  dragAction: null,
  metrics: null,
};

initMaze();
requestAnimationFrame(mazeFrameLoop);

function initMaze() {
  bindMazeEvents();
  updateMazeSliderLabels();
  resetGrid(Number(mazeRefs.sizeInput.value));
  generateMaze();
  setMazeStatus('Idle');
  setMazeMetrics('No run yet');
  setMazeRunMeta('No trace yet');
  updateModeButtons();
  updateMazeControlState();
  resizeMazeCanvasIfNeeded();
  drawMaze();
}

function bindMazeEvents() {
  mazeRefs.sizeInput.addEventListener('input', () => {
    updateMazeSliderLabels();
    const size = Number(mazeRefs.sizeInput.value);
    resetGrid(size);
    generateMaze();
    clearMazeTrace({ keepVisited: false });
    setMazeInfo('Grid resized and maze regenerated.');
  });

  mazeRefs.speedInput.addEventListener('input', updateMazeSliderLabels);

  mazeRefs.generateBtn.addEventListener('click', () => {
    generateMaze();
    clearMazeTrace({ keepVisited: false });
    setMazeInfo('New recursive-backtracker maze generated.');
  });

  mazeRefs.randomWallsBtn.addEventListener('click', () => {
    randomWalls();
    clearMazeTrace({ keepVisited: false });
    setMazeInfo('Random walls generated.');
  });

  mazeRefs.clearWallsBtn.addEventListener('click', () => {
    mazeState.walls.clear();
    ensureStartGoalClear();
    clearMazeTrace({ keepVisited: false });
    setMazeInfo('Walls cleared.');
  });

  mazeRefs.resetSearchBtn.addEventListener('click', () => {
    clearMazeTrace({ keepVisited: false });
    setMazeInfo('Search state reset; walls preserved.');
  });

  mazeRefs.clearTraceBtn.addEventListener('click', () => {
    clearMazeTrace({ keepVisited: false });
    setMazeInfo('Trace cleared.');
  });

  mazeRefs.solveBtn.addEventListener('click', () => {
    runPathfinding({ autoplay: true });
  });

  mazeRefs.playPauseBtn.addEventListener('click', () => {
    if (!mazeState.trace.length) {
      runPathfinding({ autoplay: true });
      return;
    }
    mazeState.playing = !mazeState.playing;
    setMazeStatus(mazeState.playing ? 'Playing' : 'Paused');
    if (mazeState.playing && mazeState.traceIndex >= mazeState.trace.length) {
      clearMazeTrace({ keepVisited: false });
      runPathfinding({ autoplay: true });
      return;
    }
    updateMazeControlState();
  });

  mazeRefs.stepBtn.addEventListener('click', () => {
    if (!mazeState.trace.length) {
      runPathfinding({ autoplay: false });
      return;
    }
    mazeState.playing = false;
    applyMazeTraceSteps(1);
    updateMazeControlState();
  });

  const modeButtons = [
    [mazeRefs.modeWallBtn, 'wall'],
    [mazeRefs.modeEraseBtn, 'erase'],
    [mazeRefs.modeStartBtn, 'start'],
    [mazeRefs.modeGoalBtn, 'goal'],
  ];
  for (const [button, mode] of modeButtons) {
    button.addEventListener('click', () => {
      mazeState.editMode = mode;
      updateModeButtons();
      setMazeInfo(
        mode === 'wall'
          ? 'Draw walls by clicking/dragging the grid.'
          : mode === 'erase'
            ? 'Erase walls by clicking/dragging the grid.'
            : mode === 'start'
              ? 'Click a cell to move the start position.'
              : 'Click a cell to move the goal position.'
      );
    });
  }

  mazeRefs.canvas.addEventListener('pointerdown', onMazePointerDown);
  mazeRefs.canvas.addEventListener('pointermove', onMazePointerMove);
  window.addEventListener('pointerup', onMazePointerUp);
  window.addEventListener('resize', resizeMazeCanvasIfNeeded);
}

function updateMazeSliderLabels() {
  const size = Number(mazeRefs.sizeInput.value);
  mazeRefs.sizeValue.textContent = `${size}x${size}`;
  mazeRefs.speedValue.textContent = `${mazeRefs.speedInput.value}/s`;
}

function resetGrid(size) {
  const oddSize = forceOdd(clamp(Math.floor(size || 25), 11, 51));
  mazeState.rows = oddSize;
  mazeState.cols = oddSize;
  mazeState.walls.clear();
  mazeState.start = { r: 1, c: 1 };
  mazeState.goal = { r: oddSize - 2, c: oddSize - 2 };
  clearMazeTrace({ keepVisited: false });
  resizeMazeCanvasIfNeeded();
}

function clearMazeTrace({ keepVisited }) {
  mazeState.trace = [];
  mazeState.traceIndex = 0;
  mazeState.playing = false;
  mazeState.accumulator = 0;
  mazeState.current = null;
  if (!keepVisited) {
    mazeState.frontier.clear();
    mazeState.visited.clear();
    mazeState.path.clear();
  }
  mazeState.metrics = null;
  setMazeStatus('Idle');
  setMazeMetrics('No run yet');
  setMazeRunMeta('No trace yet');
  updateMazeControlState();
}

function generateMaze() {
  const rows = mazeState.rows;
  const cols = mazeState.cols;
  mazeState.walls.clear();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      mazeState.walls.add(cellKey(r, c));
    }
  }

  const stack = [{ r: 1, c: 1 }];
  mazeState.walls.delete(cellKey(1, 1));

  while (stack.length) {
    const current = stack[stack.length - 1];
    const neighbors = [];
    for (const [dr, dc] of [
      [0, 2],
      [0, -2],
      [2, 0],
      [-2, 0],
    ]) {
      const nr = current.r + dr;
      const nc = current.c + dc;
      if (nr <= 0 || nc <= 0 || nr >= rows - 1 || nc >= cols - 1) continue;
      if (mazeState.walls.has(cellKey(nr, nc))) {
        neighbors.push({ r: nr, c: nc, betweenR: current.r + dr / 2, betweenC: current.c + dc / 2 });
      }
    }

    if (!neighbors.length) {
      stack.pop();
      continue;
    }

    const next = neighbors[Math.floor(Math.random() * neighbors.length)];
    mazeState.walls.delete(cellKey(next.betweenR, next.betweenC));
    mazeState.walls.delete(cellKey(next.r, next.c));
    stack.push({ r: next.r, c: next.c });
  }

  ensureStartGoalClear();
}

function randomWalls() {
  mazeState.walls.clear();
  for (let r = 0; r < mazeState.rows; r++) {
    for (let c = 0; c < mazeState.cols; c++) {
      const boundary = r === 0 || c === 0 || r === mazeState.rows - 1 || c === mazeState.cols - 1;
      if (boundary) {
        mazeState.walls.add(cellKey(r, c));
      } else if (Math.random() < 0.28) {
        mazeState.walls.add(cellKey(r, c));
      }
    }
  }
  ensureStartGoalClear();
}

function ensureStartGoalClear() {
  mazeState.walls.delete(cellKey(mazeState.start.r, mazeState.start.c));
  mazeState.walls.delete(cellKey(mazeState.goal.r, mazeState.goal.c));
}

function runPathfinding({ autoplay }) {
  clearMazeError();
  mazeState.frontier.clear();
  mazeState.visited.clear();
  mazeState.path.clear();
  mazeState.current = null;
  mazeState.trace = [];
  mazeState.traceIndex = 0;
  mazeState.playing = false;
  mazeState.accumulator = 0;

  const algorithm = mazeRefs.algoSelect.value;
  const started = performance.now();

  try {
    const result = solveMaze(algorithm);
    mazeState.trace = result.events;
    mazeState.metrics = {
      visited: result.visitedCount,
      pathLength: result.pathLength,
      found: result.found,
      computeMs: Math.max(0, Math.round(performance.now() - started)),
    };

    setMazeMetrics(
      `${result.found ? 'Path found' : 'No path'} • ${result.visitedCount} visited • ${result.pathLength} path • ${mazeState.metrics.computeMs}ms`
    );
    setMazeRunMeta(`${result.events.length.toLocaleString()} steps • ${prettyAlgorithmName(algorithm)}`);
    setMazeStatus(result.events.length ? 'Trace ready' : 'No steps');
    setMazeInfo(
      result.found
        ? 'Frontier expansion is animated first, then the final path is drawn in yellow.'
        : 'Search completed with no path. Try clearing walls or regenerating the maze.'
    );

    if (autoplay && result.events.length) {
      mazeState.playing = true;
      setMazeStatus('Playing');
    }
  } catch (error) {
    showMazeError(error instanceof Error ? error.message : String(error));
    setMazeStatus('Error');
  }

  updateMazeControlState();
}

function solveMaze(algorithm) {
  const startKey = cellKey(mazeState.start.r, mazeState.start.c);
  const goalKey = cellKey(mazeState.goal.r, mazeState.goal.c);
  const events = [];
  const parent = new Map();
  const visited = new Set();

  if (startKey === goalKey) {
    events.push({ type: 'path', key: startKey });
    return { events, visitedCount: 1, pathLength: 1, found: true };
  }

  const neighborsOf = (key) => {
    const { r, c } = parseCellKey(key);
    const out = [];
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= mazeState.rows || nc >= mazeState.cols) continue;
      const nk = cellKey(nr, nc);
      if (mazeState.walls.has(nk)) continue;
      out.push(nk);
    }
    return out;
  };

  let found = false;

  if (algorithm === 'dfs') {
    const stack = [startKey];
    const seen = new Set([startKey]);
    events.push({ type: 'frontier', key: startKey });

    while (stack.length) {
      const current = stack.pop();
      events.push({ type: 'visit', key: current });
      visited.add(current);
      if (current === goalKey) {
        found = true;
        break;
      }
      const neighbors = neighborsOf(current).reverse();
      for (const next of neighbors) {
        if (seen.has(next)) continue;
        seen.add(next);
        parent.set(next, current);
        stack.push(next);
        events.push({ type: 'frontier', key: next });
      }
    }
  } else if (algorithm === 'bfs') {
    const queue = [startKey];
    const seen = new Set([startKey]);
    events.push({ type: 'frontier', key: startKey });

    while (queue.length) {
      const current = queue.shift();
      events.push({ type: 'visit', key: current });
      visited.add(current);
      if (current === goalKey) {
        found = true;
        break;
      }
      for (const next of neighborsOf(current)) {
        if (seen.has(next)) continue;
        seen.add(next);
        parent.set(next, current);
        queue.push(next);
        events.push({ type: 'frontier', key: next });
      }
    }
  } else if (algorithm === 'dijkstra') {
    const dist = new Map([[startKey, 0]]);
    const frontier = [{ key: startKey, priority: 0 }];
    events.push({ type: 'frontier', key: startKey });

    while (frontier.length) {
      frontier.sort((a, b) => a.priority - b.priority);
      const { key: current } = frontier.shift();
      if (visited.has(current)) continue;
      visited.add(current);
      events.push({ type: 'visit', key: current });
      if (current === goalKey) {
        found = true;
        break;
      }
      for (const next of neighborsOf(current)) {
        if (visited.has(next)) continue;
        const nextCost = (dist.get(current) || 0) + 1;
        if (nextCost < (dist.get(next) ?? Infinity)) {
          dist.set(next, nextCost);
          parent.set(next, current);
          frontier.push({ key: next, priority: nextCost });
          events.push({ type: 'frontier', key: next });
        }
      }
    }
  } else {
    const heuristic = (key) => {
      const a = parseCellKey(key);
      return Math.abs(a.r - mazeState.goal.r) + Math.abs(a.c - mazeState.goal.c);
    };
    const gScore = new Map([[startKey, 0]]);
    const fScore = new Map([[startKey, heuristic(startKey)]]);
    const open = [{ key: startKey, priority: fScore.get(startKey) }];
    const openSet = new Set([startKey]);
    events.push({ type: 'frontier', key: startKey });

    while (open.length) {
      open.sort((a, b) => a.priority - b.priority);
      const { key: current } = open.shift();
      openSet.delete(current);
      if (visited.has(current)) continue;
      visited.add(current);
      events.push({ type: 'visit', key: current });
      if (current === goalKey) {
        found = true;
        break;
      }

      for (const next of neighborsOf(current)) {
        const tentative = (gScore.get(current) || 0) + 1;
        if (tentative < (gScore.get(next) ?? Infinity)) {
          parent.set(next, current);
          gScore.set(next, tentative);
          const score = tentative + heuristic(next);
          fScore.set(next, score);
          if (!openSet.has(next) && !visited.has(next)) {
            open.push({ key: next, priority: score });
            openSet.add(next);
            events.push({ type: 'frontier', key: next });
          }
        }
      }
    }
  }

  let pathLength = 0;
  if (found) {
    const path = [];
    let cur = goalKey;
    while (cur) {
      path.push(cur);
      if (cur === startKey) break;
      cur = parent.get(cur);
    }
    path.reverse();
    pathLength = path.length;
    for (const key of path) {
      events.push({ type: 'path', key });
    }
  }

  return {
    events,
    visitedCount: visited.size,
    pathLength,
    found,
  };
}

function applyMazeTraceSteps(count) {
  let remaining = Math.max(0, Math.floor(count));
  while (remaining > 0 && mazeState.traceIndex < mazeState.trace.length) {
    applyMazeEvent(mazeState.trace[mazeState.traceIndex]);
    mazeState.traceIndex += 1;
    remaining -= 1;
  }

  if (mazeState.traceIndex >= mazeState.trace.length && mazeState.trace.length) {
    mazeState.playing = false;
    setMazeStatus('Complete');
  }
  updateMazeControlState();
}

function applyMazeEvent(event) {
  if (!event) return;
  if (event.type === 'frontier') {
    mazeState.frontier.add(event.key);
  } else if (event.type === 'visit') {
    mazeState.current = event.key;
    mazeState.frontier.delete(event.key);
    mazeState.visited.add(event.key);
  } else if (event.type === 'path') {
    mazeState.path.add(event.key);
    mazeState.current = event.key;
  }
}

function mazeFrameLoop(ts) {
  const dt = Math.min(0.05, (ts - mazeState.lastFrameTs) / 1000 || 0);
  mazeState.lastFrameTs = ts;

  if (mazeState.playing && mazeState.trace.length) {
    mazeState.accumulator += dt * (Number(mazeRefs.speedInput.value) || 0);
    const batch = Math.min(2000, Math.floor(mazeState.accumulator));
    if (batch > 0) {
      mazeState.accumulator -= batch;
      applyMazeTraceSteps(batch);
    }
  }

  drawMaze();
  requestAnimationFrame(mazeFrameLoop);
}

function drawMaze() {
  resizeMazeCanvasIfNeeded();
  const ctx = mazeRefs.canvas.getContext('2d');
  if (!ctx) return;
  const { width, height, dpr } = mazeState.canvasSize;
  if (!width || !height) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, MAZE_COLORS.backgroundTop);
  bg.addColorStop(1, MAZE_COLORS.backgroundBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const { cell, originX, originY } = mazeState.layout;
  const rows = mazeState.rows;
  const cols = mazeState.cols;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = cellKey(r, c);
      let fill = MAZE_COLORS.open;
      if (mazeState.walls.has(key)) fill = MAZE_COLORS.wall;
      if (mazeState.frontier.has(key)) fill = MAZE_COLORS.frontier;
      if (mazeState.visited.has(key)) fill = MAZE_COLORS.visited;
      if (mazeState.path.has(key)) fill = MAZE_COLORS.path;
      if (sameCellKey(key, cellKey(mazeState.start.r, mazeState.start.c))) fill = MAZE_COLORS.start;
      if (sameCellKey(key, cellKey(mazeState.goal.r, mazeState.goal.c))) fill = MAZE_COLORS.goal;
      if (mazeState.current && sameCellKey(key, mazeState.current)) fill = MAZE_COLORS.current;

      const x = originX + c * cell;
      const y = originY + r * cell;
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, cell, cell);
    }
  }

  if (cell >= 10) {
    ctx.strokeStyle = MAZE_COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) {
      const x = originX + c * cell + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, originY);
      ctx.lineTo(x, originY + rows * cell);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      const y = originY + r * cell + 0.5;
      ctx.beginPath();
      ctx.moveTo(originX, y);
      ctx.lineTo(originX + cols * cell, y);
      ctx.stroke();
    }
  }

  drawMazeHud(ctx, width, height);
}

function drawMazeHud(ctx, width) {
  const stepText = mazeState.trace.length
    ? `Step ${mazeState.traceIndex.toLocaleString()} / ${mazeState.trace.length.toLocaleString()}`
    : 'Step 0 / 0';
  const statusText = `${prettyAlgorithmName(mazeRefs.algoSelect.value)} • ${mazeState.rows}x${mazeState.cols}`;
  const boxW = Math.min(width - 20, 310);

  ctx.fillStyle = 'rgba(5, 7, 11, 0.72)';
  roundedRect(ctx, 10, 10, boxW, 44, 10);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(232, 238, 248, 0.96)';
  ctx.font = '600 12px "JetBrains Mono", monospace';
  ctx.fillText(stepText, 18, 29);
  ctx.fillStyle = 'rgba(154, 164, 180, 0.95)';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillText(statusText, 18, 46);
}

function resizeMazeCanvasIfNeeded() {
  const rect = mazeRefs.canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const dpr = window.devicePixelRatio || 1;
  if (width === mazeState.canvasSize.width && height === mazeState.canvasSize.height && dpr === mazeState.canvasSize.dpr) {
    return;
  }
  mazeState.canvasSize = { width, height, dpr };
  mazeRefs.canvas.width = Math.round(width * dpr);
  mazeRefs.canvas.height = Math.round(height * dpr);

  const cell = Math.floor(Math.min(width / mazeState.cols, height / mazeState.rows));
  const safeCell = Math.max(4, cell);
  const gridPx = safeCell * mazeState.cols;
  const gridPy = safeCell * mazeState.rows;
  mazeState.layout = {
    cell: safeCell,
    originX: Math.floor((width - gridPx) / 2),
    originY: Math.floor((height - gridPy) / 2),
    gridPx,
    gridPy,
  };
}

function onMazePointerDown(event) {
  mazeRefs.canvas.setPointerCapture?.(event.pointerId);
  mazeState.dragging = true;
  mazeState.dragAction = null;
  applyMazePointerEdit(event, true);
}

function onMazePointerMove(event) {
  if (!mazeState.dragging) return;
  applyMazePointerEdit(event, false);
}

function onMazePointerUp() {
  mazeState.dragging = false;
  mazeState.dragAction = null;
}

function applyMazePointerEdit(event, isStart) {
  const cell = cellFromPointer(event);
  if (!cell) return;
  const key = cellKey(cell.r, cell.c);

  if (mazeState.editMode === 'start') {
    if (sameCellKey(key, cellKey(mazeState.goal.r, mazeState.goal.c))) return;
    mazeState.start = { r: cell.r, c: cell.c };
    mazeState.walls.delete(key);
    clearMazeTrace({ keepVisited: false });
    return;
  }

  if (mazeState.editMode === 'goal') {
    if (sameCellKey(key, cellKey(mazeState.start.r, mazeState.start.c))) return;
    mazeState.goal = { r: cell.r, c: cell.c };
    mazeState.walls.delete(key);
    clearMazeTrace({ keepVisited: false });
    return;
  }

  if (sameCellKey(key, cellKey(mazeState.start.r, mazeState.start.c))) return;
  if (sameCellKey(key, cellKey(mazeState.goal.r, mazeState.goal.c))) return;

  if (isStart) {
    if (mazeState.editMode === 'wall') {
      mazeState.dragAction = mazeState.walls.has(key) ? 'erase' : 'wall';
    } else if (mazeState.editMode === 'erase') {
      mazeState.dragAction = 'erase';
    }
  }

  const action = mazeState.dragAction || mazeState.editMode;
  if (action === 'wall') {
    mazeState.walls.add(key);
  } else if (action === 'erase') {
    mazeState.walls.delete(key);
  }
  clearMazeTrace({ keepVisited: false });
}

function cellFromPointer(event) {
  const rect = mazeRefs.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const { cell, originX, originY } = mazeState.layout;
  const c = Math.floor((x - originX) / cell);
  const r = Math.floor((y - originY) / cell);
  if (r < 0 || c < 0 || r >= mazeState.rows || c >= mazeState.cols) return null;
  return { r, c };
}

function updateModeButtons() {
  const mapping = {
    wall: mazeRefs.modeWallBtn,
    erase: mazeRefs.modeEraseBtn,
    start: mazeRefs.modeStartBtn,
    goal: mazeRefs.modeGoalBtn,
  };
  for (const [mode, button] of Object.entries(mapping)) {
    button.classList.toggle('is-selected', mazeState.editMode === mode);
  }
}

function updateMazeControlState() {
  mazeRefs.playPauseBtn.textContent = mazeState.playing ? 'Pause' : 'Play';
}

function setMazeStatus(text) {
  mazeRefs.statusText.textContent = text;
}

function setMazeMetrics(text) {
  mazeRefs.metricsText.textContent = text;
}

function setMazeRunMeta(text) {
  mazeRefs.runMeta.textContent = text;
}

function setMazeInfo(text) {
  mazeRefs.infoText.textContent = text;
}

function showMazeError(text) {
  mazeRefs.errorBox.textContent = text;
  mazeRefs.errorBox.classList.remove('is-hidden');
}

function clearMazeError() {
  mazeRefs.errorBox.textContent = '';
  mazeRefs.errorBox.classList.add('is-hidden');
}

function prettyAlgorithmName(value) {
  if (value === 'astar') return 'A*';
  if (value === 'dijkstra') return 'Dijkstra';
  if (value === 'bfs') return 'BFS';
  if (value === 'dfs') return 'DFS';
  return value;
}

function cellKey(r, c) {
  return `${r},${c}`;
}

function parseCellKey(key) {
  const [r, c] = String(key).split(',').map(Number);
  return { r, c };
}

function sameCellKey(a, b) {
  return a === b;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function forceOdd(value) {
  return value % 2 === 0 ? value + 1 : value;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
