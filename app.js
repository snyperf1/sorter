const EXAMPLES = {
  quickSort: {
    name: 'Quick Sort',
    description:
      "Picks a pivot and partitions the array: values smaller than the pivot move left, larger values move right.",
    time: 'O(n log n) avg',
    space: 'O(log n)',
    entryCall: 'quickSort(arr, 0, arr.length - 1)',
    defaultSize: 32,
    code: `function quickSort(arr, low, high) {
  if (low < high) {
    const pi = partition(arr, low, high);
    quickSort(arr, low, pi - 1);
    quickSort(arr, pi + 1, high);
  }
}

function partition(arr, low, high) {
  const pivot = arr[high];
  let i = low - 1;

  for (let j = low; j < high; j++) {
    if (arr[j] < pivot) {
      i++;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
  return i + 1;
}`,
  },
  insertionSort: {
    name: 'Insertion Sort',
    description: 'Builds a sorted prefix one value at a time by shifting larger elements to the right.',
    time: 'O(n²)',
    space: 'O(1)',
    entryCall: 'insertionSort(arr)',
    defaultSize: 28,
    code: `function insertionSort(arr) {
  for (let i = 1; i < arr.length; i++) {
    let key = arr[i];
    let j = i - 1;

    while (j >= 0 && arr[j] > key) {
      arr[j + 1] = arr[j];
      j--;
    }

    arr[j + 1] = key;
  }
}`,
  },
  bubbleSort: {
    name: 'Bubble Sort',
    description: 'Repeatedly swaps adjacent out-of-order values until the array is sorted.',
    time: 'O(n²)',
    space: 'O(1)',
    entryCall: 'bubbleSort(arr)',
    defaultSize: 24,
    code: `function bubbleSort(arr) {
  for (let i = 0; i < arr.length - 1; i++) {
    let swapped = false;

    for (let j = 0; j < arr.length - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        swapped = true;
      }
    }

    if (!swapped) break;
  }
}`,
  },
};

const refs = {
  algoTitle: document.getElementById('algoTitle'),
  algoDescription: document.getElementById('algoDescription'),
  timeComplexity: document.getElementById('timeComplexity'),
  spaceComplexity: document.getElementById('spaceComplexity'),
  traceMode: document.getElementById('traceMode'),
  statusText: document.getElementById('statusText'),
  opsMeta: document.getElementById('opsMeta'),
  traceInfo: document.getElementById('traceInfo'),
  presetSelect: document.getElementById('presetSelect'),
  loadPresetBtn: document.getElementById('loadPresetBtn'),
  arrayInput: document.getElementById('arrayInput'),
  sizeInput: document.getElementById('sizeInput'),
  sizeValue: document.getElementById('sizeValue'),
  randomizeBtn: document.getElementById('randomizeBtn'),
  entryInput: document.getElementById('entryInput'),
  speedInput: document.getElementById('speedInput'),
  speedValue: document.getElementById('speedValue'),
  volumeInput: document.getElementById('volumeInput'),
  volumeValue: document.getElementById('volumeValue'),
  soundToggle: document.getElementById('soundToggle'),
  traceBtn: document.getElementById('traceBtn'),
  playPauseBtn: document.getElementById('playPauseBtn'),
  stepBtn: document.getElementById('stepBtn'),
  resetBtn: document.getElementById('resetBtn'),
  errorBox: document.getElementById('errorBox'),
  codeInput: document.getElementById('codeInput'),
  lineNumbers: document.getElementById('lineNumbers'),
  canvas: document.getElementById('sortCanvas'),
};

const state = {
  selectedPreset: 'quickSort',
  baseArray: [],
  displayArray: [],
  ops: [],
  pointer: 0,
  playing: false,
  opAccumulator: 0,
  highlights: new Map(),
  worker: null,
  workerTimeoutId: null,
  activeRequestId: 0,
  tracing: false,
  traceMetrics: null,
  lastEntryCall: refs.entryInput.value,
  canvasSize: { width: 0, height: 0, dpr: 1 },
  lastFrameTs: performance.now(),
};

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.volume = 0.24;
    this.lastWriteAt = 0;
    this.lastReadAt = 0;
  }

  async prime() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  setVolume(percent) {
    const normalized = clamp(Number(percent) / 100, 0, 1);
    this.volume = normalized;
    if (this.master) {
      this.master.gain.setTargetAtTime(normalized, this.ctx.currentTime, 0.01);
    }
  }

  ping({ value, maxValue, kind }) {
    if (!this.enabled || !this.ctx || !this.master) return;

    const now = performance.now();
    const minGap = kind === 'write' ? 12 : 32;
    if (kind === 'write') {
      if (now - this.lastWriteAt < minGap) return;
      this.lastWriteAt = now;
    } else {
      if (now - this.lastReadAt < minGap) return;
      this.lastReadAt = now;
    }

    const v = Number.isFinite(value) ? value : 0;
    const max = Math.max(1, Number.isFinite(maxValue) ? maxValue : 1);
    const ratio = clamp(v / max, 0, 1);
    const freq = 170 + ratio * 980;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const duration = kind === 'write' ? 0.045 : 0.02;

    osc.type = kind === 'write' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(kind === 'write' ? 0.16 : 0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration);
  }
}

const sound = new SoundEngine();

init();
requestAnimationFrame(frameLoop);

function init() {
  populatePresetSelect();
  loadPreset(state.selectedPreset);
  bindEvents();
  updateSliderLabels();
  updateLineNumbers();
  resizeCanvasIfNeeded();
  setStatus('Idle');
  setTraceMeta('No trace yet');
  updateControlState();
}

function populatePresetSelect() {
  refs.presetSelect.innerHTML = '';
  for (const [key, preset] of Object.entries(EXAMPLES)) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = preset.name;
    refs.presetSelect.append(option);
  }
  refs.presetSelect.value = state.selectedPreset;
}

function loadPreset(key) {
  const preset = EXAMPLES[key];
  if (!preset) return;

  state.selectedPreset = key;
  refs.presetSelect.value = key;
  refs.algoTitle.textContent = preset.name;
  refs.algoDescription.textContent = preset.description;
  refs.timeComplexity.textContent = preset.time;
  refs.spaceComplexity.textContent = preset.space;
  refs.codeInput.value = preset.code;
  refs.entryInput.value = preset.entryCall;
  refs.sizeInput.value = String(preset.defaultSize);
  updateSliderLabels();
  setRandomArray(preset.defaultSize);
  updateLineNumbers();
  clearTrace({ keepArray: true });
  setTraceInfo('Preset loaded. Press Trace + Play to run it on the current array.');
}

function bindEvents() {
  refs.loadPresetBtn.addEventListener('click', () => {
    loadPreset(refs.presetSelect.value);
  });

  refs.presetSelect.addEventListener('change', () => {
    const preset = EXAMPLES[refs.presetSelect.value];
    if (!preset) return;
    refs.algoTitle.textContent = preset.name;
    refs.algoDescription.textContent = preset.description;
    refs.timeComplexity.textContent = preset.time;
    refs.spaceComplexity.textContent = preset.space;
  });

  refs.randomizeBtn.addEventListener('click', () => {
    setRandomArray(Number(refs.sizeInput.value));
    clearTrace({ keepArray: true });
    setTraceInfo('Random array generated. Trace again to animate the new values.');
  });

  refs.sizeInput.addEventListener('input', updateSliderLabels);
  refs.speedInput.addEventListener('input', updateSliderLabels);
  refs.volumeInput.addEventListener('input', () => {
    updateSliderLabels();
    sound.setVolume(Number(refs.volumeInput.value));
  });
  refs.soundToggle.addEventListener('change', () => {
    sound.setEnabled(refs.soundToggle.checked);
  });

  refs.traceBtn.addEventListener('click', async () => {
    await sound.prime();
    await traceAndPlay({ autoplay: true });
  });

  refs.playPauseBtn.addEventListener('click', async () => {
    if (!state.ops.length) {
      await sound.prime();
      await traceAndPlay({ autoplay: true });
      return;
    }

    await sound.prime();
    state.playing = !state.playing;
    if (state.playing && state.pointer >= state.ops.length) {
      resetPlayback();
      state.playing = true;
    }
    setStatus(state.playing ? 'Playing' : 'Paused');
    updateControlState();
  });

  refs.stepBtn.addEventListener('click', async () => {
    if (!state.ops.length) {
      await sound.prime();
      await traceAndPlay({ autoplay: false });
      return;
    }
    if (state.pointer >= state.ops.length) {
      resetPlayback();
    }
    state.playing = false;
    applySteps(1);
    setStatus(state.pointer >= state.ops.length ? 'Complete' : 'Stepping');
    updateControlState();
  });

  refs.resetBtn.addEventListener('click', () => {
    resetPlayback();
    setStatus('Reset');
    updateControlState();
  });

  refs.codeInput.addEventListener('input', () => {
    updateLineNumbers();
    clearError();
    clearTrace({ keepArray: true });
  });

  refs.codeInput.addEventListener('scroll', syncEditorScroll);
  refs.arrayInput.addEventListener('input', () => {
    clearError();
    clearTrace({ keepArray: true });
  });
  refs.entryInput.addEventListener('input', () => {
    clearError();
    clearTrace({ keepArray: true });
  });

  window.addEventListener('keydown', async (event) => {
    const isTraceShortcut = (event.ctrlKey || event.metaKey) && event.key === 'Enter';
    if (!isTraceShortcut) return;
    event.preventDefault();
    await sound.prime();
    await traceAndPlay({ autoplay: true });
  });

  window.addEventListener('resize', resizeCanvasIfNeeded);
  window.addEventListener('beforeunload', () => cleanupWorker());

  sound.setEnabled(refs.soundToggle.checked);
  sound.setVolume(Number(refs.volumeInput.value));
}

function updateSliderLabels() {
  refs.sizeValue.textContent = `${refs.sizeInput.value}`;
  refs.speedValue.textContent = `${refs.speedInput.value} ops/s`;
  refs.volumeValue.textContent = `${refs.volumeInput.value}%`;
}

function updateLineNumbers() {
  const lines = refs.codeInput.value.split('\n').length;
  let text = '';
  for (let i = 1; i <= lines; i += 1) {
    text += `${i}${i === lines ? '' : '\n'}`;
  }
  refs.lineNumbers.textContent = text || '1';
  syncEditorScroll();
}

function syncEditorScroll() {
  refs.lineNumbers.scrollTop = refs.codeInput.scrollTop;
}

function setRandomArray(size) {
  const n = clamp(Math.floor(Number(size) || 32), 2, 180);
  const array = Array.from({ length: n }, (_, i) => {
    const base = 12 + Math.floor(((i + 1) / n) * 88);
    const jitter = Math.floor(Math.random() * 32);
    return base + jitter;
  });
  shuffleInPlace(array);
  refs.arrayInput.value = array.join(', ');
  state.baseArray = array.slice();
  state.displayArray = array.slice();
  state.highlights.clear();
}

function parseArrayInput() {
  const raw = refs.arrayInput.value.trim();
  if (!raw) {
    throw new Error('Array input is empty. Add numbers like 4, 2, 9, 1');
  }

  let parsed;
  if (raw.startsWith('[')) {
    parsed = JSON.parse(raw);
  } else {
    parsed = raw
      .split(/[\s,]+/)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Array input must parse to an array.');
  }

  const numbers = parsed.map((value, index) => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      throw new Error(`Array value at index ${index} is not a finite number.`);
    }
    return n;
  });

  if (numbers.length < 2) {
    throw new Error('Use at least 2 values.');
  }
  if (numbers.length > 256) {
    throw new Error('Use at most 256 values for tracing.');
  }

  return numbers;
}

async function traceAndPlay({ autoplay }) {
  clearError();

  let inputArray;
  try {
    inputArray = parseArrayInput();
  } catch (error) {
    showError(error);
    setStatus('Input error');
    return;
  }

  const code = refs.codeInput.value;
  const entryCall = refs.entryInput.value.trim();
  if (!code.trim()) {
    showError('Code editor is empty. Paste a sorting function first.');
    setStatus('Input error');
    return;
  }

  cleanupWorker();
  state.playing = false;
  state.tracing = true;
  state.ops = [];
  state.pointer = 0;
  state.opAccumulator = 0;
  state.highlights.clear();
  state.baseArray = inputArray.slice();
  state.displayArray = inputArray.slice();
  setStatus('Tracing...');
  setTraceMeta('Running your code in a worker');
  setTraceInfo('Capturing array reads/writes. If the code loops forever, the trace is automatically stopped.');
  updateControlState();

  const requestId = ++state.activeRequestId;
  const worker = new Worker('./worker.js');
  state.worker = worker;
  const maxOps = Math.min(120000, Math.max(12000, inputArray.length * inputArray.length * 12));

  const result = await new Promise((resolve) => {
    const timeoutMs = inputArray.length > 90 ? 9000 : 6000;
    state.workerTimeoutId = window.setTimeout(() => {
      if (state.worker === worker) {
        worker.terminate();
        state.worker = null;
      }
      resolve({
        ok: false,
        error:
          `Trace timed out after ${timeoutMs / 1000}s. Try a smaller array or reduce recursion/work in your code.`,
      });
    }, timeoutMs);

    worker.onmessage = (event) => {
      const data = event.data || {};
      if (data.requestId !== requestId) return;
      resolve(data.type === 'result' ? { ok: true, data } : { ok: false, error: data.error || 'Worker error' });
    };

    worker.onerror = (event) => {
      resolve({ ok: false, error: event.message || 'Worker crashed' });
    };

    worker.postMessage({
      type: 'trace',
      requestId,
      code,
      entryCall,
      array: inputArray,
      maxOps,
    });
  });

  if (state.workerTimeoutId) {
    window.clearTimeout(state.workerTimeoutId);
    state.workerTimeoutId = null;
  }
  if (state.worker === worker) {
    worker.terminate();
    state.worker = null;
  }

  state.tracing = false;

  if (!result.ok) {
    showError(result.error);
    setStatus('Trace failed');
    updateControlState();
    return;
  }

  const payload = result.data;
  state.ops = Array.isArray(payload.ops) ? payload.ops : [];
  state.pointer = 0;
  state.opAccumulator = 0;
  state.highlights.clear();
  state.baseArray = Array.isArray(payload.inputArray) ? payload.inputArray.slice() : inputArray.slice();
  state.displayArray = state.baseArray.slice();
  state.traceMetrics = payload.metrics || null;
  if (payload.entryCall) {
    refs.entryInput.value = payload.entryCall;
  }

  const opCountText = state.traceMetrics?.operationCount?.toLocaleString?.() || state.ops.length.toLocaleString();
  const durationText = `${Math.max(0, Math.round(state.traceMetrics?.durationMs || 0))}ms`;
  setTraceMeta(`${opCountText} ops • traced in ${durationText}`);
  setTraceInfo(
    state.ops.length
      ? 'Trace ready. Reads glow cyan, writes glow red. Increase speed for a denser soundscape.'
      : 'Trace completed but recorded 0 array operations. This visualizer expects an in-place sort that reads/writes arr[index].'
  );
  setStatus('Trace ready');

  if (autoplay && state.ops.length) {
    state.playing = true;
    setStatus('Playing');
  }

  updateControlState();
}

function clearTrace({ keepArray }) {
  state.ops = [];
  state.pointer = 0;
  state.playing = false;
  state.opAccumulator = 0;
  state.traceMetrics = null;
  state.highlights.clear();
  if (!keepArray) {
    state.baseArray = [];
    state.displayArray = [];
  } else if (state.baseArray.length) {
    state.displayArray = state.baseArray.slice();
  }
  cleanupWorker();
  updateControlState();
  setTraceMeta('No trace yet');
  if (!state.tracing) {
    setStatus('Idle');
  }
}

function resetPlayback() {
  state.playing = false;
  state.pointer = 0;
  state.opAccumulator = 0;
  state.highlights.clear();
  if (state.baseArray.length) {
    state.displayArray = state.baseArray.slice();
  }
  updateControlState();
}

function applySteps(stepCount) {
  let remaining = Math.max(0, Math.floor(stepCount));
  while (remaining > 0 && state.pointer < state.ops.length) {
    const op = state.ops[state.pointer];
    applyOperation(op);
    state.pointer += 1;
    remaining -= 1;
  }

  if (state.pointer >= state.ops.length && state.ops.length > 0) {
    state.playing = false;
    setStatus(isNonDecreasing(state.displayArray) ? 'Complete' : 'Playback ended');
  }

  updateControlState();
}

function applyOperation(op) {
  if (!op || typeof op !== 'object') return;

  switch (op.type) {
    case 'read': {
      const index = Number(op.index);
      markIndex(index, 'read', 0.16);
      const value = state.displayArray[index];
      sound.ping({ value, maxValue: getMaxArrayValue(state.displayArray), kind: 'read' });
      break;
    }
    case 'write': {
      const index = Number(op.index);
      if (index >= 0 && index < state.displayArray.length) {
        const nextValue = Number(op.value);
        if (Number.isFinite(nextValue)) {
          state.displayArray[index] = nextValue;
        }
      }
      markIndex(index, 'write', 0.32);
      sound.ping({ value: state.displayArray[index], maxValue: getMaxArrayValue(state.displayArray), kind: 'write' });
      break;
    }
    case 'mark': {
      const indices = Array.isArray(op.indices) ? op.indices : [];
      for (const idx of indices) {
        markIndex(Number(idx), op.label === 'swap' ? 'write' : 'read', 0.2);
      }
      break;
    }
    case 'compare': {
      // Comparison events are optional helper-based traces. We keep playback simple.
      break;
    }
    default:
      break;
  }
}

function markIndex(index, kind, ttl) {
  if (!Number.isInteger(index) || index < 0 || index >= state.displayArray.length) return;
  state.highlights.set(index, { kind, ttl });
}

function frameLoop(timestamp) {
  const dt = Math.min(0.05, (timestamp - state.lastFrameTs) / 1000 || 0);
  state.lastFrameTs = timestamp;

  if (state.playing && state.ops.length) {
    const opsPerSecond = Number(refs.speedInput.value) || 0;
    state.opAccumulator += dt * opsPerSecond;
    const batch = Math.min(3000, Math.floor(state.opAccumulator));
    if (batch > 0) {
      state.opAccumulator -= batch;
      applySteps(batch);
    }
  }

  decayHighlights(dt);
  drawCanvas();
  requestAnimationFrame(frameLoop);
}

function decayHighlights(dt) {
  if (!state.highlights.size) return;
  for (const [index, highlight] of state.highlights.entries()) {
    highlight.ttl -= dt;
    if (highlight.ttl <= 0) {
      state.highlights.delete(index);
    }
  }
}

function drawCanvas() {
  resizeCanvasIfNeeded();
  const canvas = refs.canvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height, dpr } = state.canvasSize;
  if (!width || !height) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  drawCanvasBackground(ctx, width, height);

  const array = state.displayArray;
  if (!array.length) {
    ctx.fillStyle = 'rgba(232, 238, 248, 0.72)';
    ctx.font = '600 16px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No array loaded', width / 2, height / 2 - 6);
    ctx.fillStyle = 'rgba(154, 164, 180, 0.9)';
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.fillText('Paste values or generate a random set', width / 2, height / 2 + 18);
    return;
  }

  const minVal = Math.min(...array);
  const maxVal = Math.max(...array);
  const spread = maxVal - minVal || 1;
  const n = array.length;
  const padX = 12;
  const padTop = 12;
  const padBottom = 18;
  const plotW = Math.max(1, width - padX * 2);
  const plotH = Math.max(1, height - padTop - padBottom);
  const gap = n > 80 ? 1 : 2;
  const barW = Math.max(1, (plotW - gap * (n - 1)) / n);
  const done = state.ops.length > 0 && state.pointer >= state.ops.length && isNonDecreasing(array);

  for (let i = 0; i < n; i += 1) {
    const value = array[i];
    const normalized = clamp((value - minVal) / spread, 0, 1);
    const h = Math.max(4, normalized * plotH);
    const x = padX + i * (barW + gap);
    const y = height - padBottom - h;

    const hl = state.highlights.get(i);
    let fill = 'rgba(201, 204, 212, 0.9)';
    if (done) {
      fill = 'rgba(59, 240, 127, 0.95)';
    } else if (hl?.kind === 'write') {
      fill = `rgba(255, 75, 120, ${0.72 + clamp(hl.ttl / 0.32, 0, 1) * 0.28})`;
    } else if (hl?.kind === 'read') {
      fill = `rgba(19, 216, 255, ${0.62 + clamp(hl.ttl / 0.18, 0, 1) * 0.3})`;
    }

    const radius = Math.min(6, barW * 0.35);
    roundedRect(ctx, x, y, barW, h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  drawHudOverlay(ctx, width, height);
}

function drawCanvasBackground(ctx, width, height) {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, 'rgba(8, 10, 15, 0.96)');
  bg.addColorStop(1, 'rgba(4, 5, 8, 0.98)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  const gridX = 34;
  const gridY = 28;
  for (let x = 0.5; x < width; x += gridX) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0.5; y < height; y += gridY) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawHudOverlay(ctx, width, height) {
  const stepText = state.ops.length ? `Step ${state.pointer.toLocaleString()} / ${state.ops.length.toLocaleString()}` : 'Step 0 / 0';
  const arrayText = state.displayArray.length
    ? `${state.displayArray.length} bars • ${isNonDecreasing(state.displayArray) && state.pointer >= state.ops.length && state.ops.length ? 'sorted' : 'tracing playback'}`
    : 'No array';

  ctx.fillStyle = 'rgba(5, 7, 11, 0.72)';
  roundedRect(ctx, 10, 10, Math.min(width - 20, 250), 44, 10);
  ctx.fill();

  ctx.fillStyle = 'rgba(232, 238, 248, 0.96)';
  ctx.font = '600 12px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(stepText, 18, 29);
  ctx.fillStyle = 'rgba(154, 164, 180, 0.95)';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillText(arrayText, 18, 46);
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

function resizeCanvasIfNeeded() {
  const rect = refs.canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const dpr = window.devicePixelRatio || 1;

  if (
    width === state.canvasSize.width &&
    height === state.canvasSize.height &&
    dpr === state.canvasSize.dpr
  ) {
    return;
  }

  state.canvasSize = { width, height, dpr };
  refs.canvas.width = Math.round(width * dpr);
  refs.canvas.height = Math.round(height * dpr);
}

function cleanupWorker() {
  if (state.worker) {
    state.worker.terminate();
    state.worker = null;
  }
  if (state.workerTimeoutId) {
    window.clearTimeout(state.workerTimeoutId);
    state.workerTimeoutId = null;
  }
  state.tracing = false;
}

function setStatus(text) {
  refs.statusText.textContent = text;
}

function setTraceMeta(text) {
  refs.opsMeta.textContent = text;
}

function setTraceInfo(text) {
  refs.traceInfo.textContent = text;
}

function showError(error) {
  refs.errorBox.textContent = typeof error === 'string' ? error : error?.message || String(error);
  refs.errorBox.classList.remove('is-hidden');
}

function clearError() {
  refs.errorBox.textContent = '';
  refs.errorBox.classList.add('is-hidden');
}

function updateControlState() {
  refs.playPauseBtn.textContent = state.playing ? 'Pause' : 'Play';
  refs.playPauseBtn.disabled = state.tracing;
  refs.traceBtn.disabled = state.tracing;
  refs.stepBtn.disabled = state.tracing;
  refs.resetBtn.disabled = state.tracing || (!state.ops.length && !state.baseArray.length);
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isNonDecreasing(array) {
  for (let i = 1; i < array.length; i += 1) {
    if (array[i] < array[i - 1]) return false;
  }
  return true;
}

function getMaxArrayValue(array) {
  if (!array.length) return 1;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of array) {
    if (Number.isFinite(value) && value > max) {
      max = value;
    }
  }
  return Number.isFinite(max) ? max : 1;
}
